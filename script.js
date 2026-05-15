// ========== CONFIGURAÇÃO ==========
const API_URL = 'https://script.google.com/macros/s/AKfycbxgc8YtEM5kcf3YgckQa525CmRsx9Avy31P0U4vqJ9bl-WC3fOpLxdS_mLT5Td880pH/exec';

let tipoMovimento = 'entrada';
let estoque = [];
let movimentacoes = [];
let relatorioFiltrado = [];

// ========== UTILITÁRIOS ==========
function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = `toast ${type} show`;
    setTimeout(() => toast.className = 'toast', 3000);
}

// ========== FUNÇÃO CORRIGIDA PARA CONTORNAR CORS ==========
async function enviarParaPlanilha(dados) {
    try {
        // Formatar dados para envio
        const dadosFormatados = {
            data: dados.data,
            uniforme: dados.uniforme,
            tamanho: dados.tamanho,
            local: dados.local,
            quantidade: parseInt(dados.quantidade),
            destinatario: dados.destinatario,
            tipo: dados.tipo === 'entrada' ? 'ENTRADA' : 'SAÍDA',
            estoque_inicial: parseInt(dados.estoqueInicial),
            estoque_final: parseInt(dados.estoqueFinal),
            observacao: dados.observacao || '',
            timestamp: new Date().toISOString()
        };
        
        console.log('Enviando dados:', dadosFormatados);
        
        // SOLUÇÃO 1: Usar mode: 'no-cors' (funciona mas não permite ler resposta)
        const response = await fetch(API_URL, {
            method: 'POST',
            mode: 'no-cors', // 👈 CRUCIAL! Isso contorna o CORS
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dadosFormatados)
        });
        
        // Com 'no-cors', não podemos ler a resposta diretamente
        console.log('✅ Requisição enviada (modo no-cors)');
        showToast('✅ Enviado para a planilha!', 'success');
        return true;
        
    } catch(error) {
        console.error('Erro detalhado:', error);
        
        // SOLUÇÃO 2: Tentar com redirect (fallback)
        try {
            const formData = new FormData();
            formData.append('data', JSON.stringify(dadosFormatados));
            
            await fetch(API_URL, {
                method: 'POST',
                mode: 'no-cors',
                body: formData
            });
            
            showToast('✅ Enviado para planilha (método alternativo)!', 'success');
            return true;
        } catch(error2) {
            console.error('Erro no fallback:', error2);
            showToast('⚠️ Erro ao enviar, mas salvo localmente', 'warning');
            return false;
        }
    }
}

// ========== GERENCIAMENTO LOCAL ==========
function carregarDados() {
    const savedEstoque = localStorage.getItem('opcao_telecom_estoque');
    if(savedEstoque) estoque = JSON.parse(savedEstoque);
    
    const savedMov = localStorage.getItem('opcao_telecom_movimentacoes');
    if(savedMov) movimentacoes = JSON.parse(savedMov);
    
    atualizarTabelaEstoque();
    atualizarTabelaMovimentacoes();
    atualizarFiltrosUniformes();
    filtrarRelatorio();
}

function salvarEstoqueLocal() {
    localStorage.setItem('opcao_telecom_estoque', JSON.stringify(estoque));
}

function salvarMovimentacoesLocal() {
    localStorage.setItem('opcao_telecom_movimentacoes', JSON.stringify(movimentacoes));
}

function getEstoqueAtual(uniforme, tamanho) {
    const item = estoque.find(e => e.uniforme === uniforme && e.tamanho === tamanho);
    return item ? item.quantidade : 0;
}

function atualizarEstoque(uniforme, tamanho, quantidade, tipo, local) {
    const index = estoque.findIndex(e => e.uniforme === uniforme && e.tamanho === tamanho);
    
    if(index === -1 && tipo === 'entrada') {
        estoque.push({
            uniforme,
            tamanho,
            quantidade,
            local: local || 'Almoxarifado',
            ultimaAtualizacao: new Date().toLocaleString()
        });
    } else if(index !== -1) {
        if(tipo === 'entrada') {
            estoque[index].quantidade += quantidade;
        } else {
            estoque[index].quantidade -= quantidade;
            if(estoque[index].quantidade < 0) estoque[index].quantidade = 0;
        }
        estoque[index].ultimaAtualizacao = new Date().toLocaleString();
        if(local) estoque[index].local = local;
    }
    
    salvarEstoqueLocal();
    atualizarTabelaEstoque();
}

function verificarEstoque(uniforme, tamanho, quantidade) {
    const atual = getEstoqueAtual(uniforme, tamanho);
    document.getElementById('mov_estoque_inicial').value = atual;
    
    const final = tipoMovimento === 'entrada' ? atual + quantidade : atual - quantidade;
    document.getElementById('mov_estoque_final').value = final >= 0 ? final : 0;
    
    if(tipoMovimento === 'saida' && final < 0) {
        showToast(`⚠️ Estoque insuficiente! Disponível: ${atual}`, 'error');
        return false;
    }
    return true;
}

// ========== MOVIMENTAÇÕES ==========
function setMovimento(tipo) {
    tipoMovimento = tipo;
    document.getElementById('mov_tipoMovimento').value = tipo;
    
    const btnEntrada = document.querySelector('.radio-btn.entrada');
    const btnSaida = document.querySelector('.radio-btn.saida');
    
    if(tipo === 'entrada') {
        btnEntrada.classList.add('ativo');
        btnSaida.classList.remove('ativo');
    } else {
        btnSaida.classList.add('ativo');
        btnEntrada.classList.remove('ativo');
    }
    
    const u = document.getElementById('mov_uniforme').value;
    const t = document.getElementById('mov_tamanho').value;
    const q = parseInt(document.getElementById('mov_quantidade').value);
    
    if(u && t) verificarEstoque(u, t, q);
}

async function enviarMovimentacao() {
    const uniforme = document.getElementById('mov_uniforme').value;
    const tamanho = document.getElementById('mov_tamanho').value;
    const local = document.getElementById('mov_local').value.trim();
    const quantidade = parseInt(document.getElementById('mov_quantidade').value);
    const destinatario = document.getElementById('mov_destinatario').value.trim();
    const data = document.getElementById('mov_data').value;
    const observacao = document.getElementById('mov_observacao').value || '';
    const tipo = tipoMovimento;
    
    if(!uniforme || !tamanho || !local || !destinatario || !data) {
        showToast('❌ Preencha todos os campos!', 'error');
        return;
    }
    
    const estoqueInicial = getEstoqueAtual(uniforme, tamanho);
    let estoqueFinal = estoqueInicial;
    
    if(tipo === 'entrada') {
        estoqueFinal = estoqueInicial + quantidade;
    } else if(quantidade > estoqueInicial) {
        showToast(`⚠️ Estoque insuficiente! Disponível: ${estoqueInicial}`, 'error');
        return;
    } else {
        estoqueFinal = estoqueInicial - quantidade;
    }
    
    const mov = {
        id: Date.now(),
        data,
        uniforme,
        tamanho,
        local,
        quantidade,
        destinatario,
        tipo,
        estoqueInicial,
        estoqueFinal,
        observacao
    };
    
    movimentacoes.unshift(mov);
    salvarMovimentacoesLocal();
    atualizarEstoque(uniforme, tamanho, quantidade, tipo, local);
    await enviarParaPlanilha(mov);
    
    showToast('✅ Movimentação salva!', 'success');
    
    // Limpar campos
    document.getElementById('mov_local').value = '';
    document.getElementById('mov_destinatario').value = '';
    document.getElementById('mov_observacao').value = '';
    document.getElementById('mov_quantidade').value = '1';
    document.getElementById('mov_estoque_inicial').value = '';
    document.getElementById('mov_estoque_final').value = '';
    
    atualizarTabelaMovimentacoes();
    atualizarFiltrosUniformes();
    filtrarRelatorio();
}

// ========== ESTOQUE ==========
function salvarEstoqueInicial() {
    const uniforme = document.getElementById('est_uniforme').value;
    const tamanho = document.getElementById('est_tamanho').value;
    const quantidade = parseInt(document.getElementById('est_quantidade').value);
    const local = document.getElementById('est_local').value || 'Almoxarifado';
    
    if(!uniforme || !tamanho) {
        showToast('❌ Selecione uniforme e tamanho!', 'error');
        return;
    }
    
    const index = estoque.findIndex(e => e.uniforme === uniforme && e.tamanho === tamanho);
    
    if(index !== -1) {
        estoque[index].quantidade = quantidade;
        estoque[index].local = local;
        estoque[index].ultimaAtualizacao = new Date().toLocaleString();
    } else {
        estoque.push({
            uniforme,
            tamanho,
            quantidade,
            local,
            ultimaAtualizacao: new Date().toLocaleString()
        });
    }
    
    salvarEstoqueLocal();
    atualizarTabelaEstoque();
    showToast('✅ Estoque salvo!', 'success');
}

function editarEstoque(uniforme, tamanho) {
    const item = estoque.find(e => e.uniforme === uniforme && e.tamanho === tamanho);
    if(item) {
        document.getElementById('est_uniforme').value = uniforme;
        document.getElementById('est_tamanho').value = tamanho;
        document.getElementById('est_quantidade').value = item.quantidade;
        document.getElementById('est_local').value = item.local || '';
        mudarPagina('estoque', document.querySelector('.nav-tab:nth-child(2)'));
    }
}

function excluirEstoque(uniforme, tamanho) {
    if(confirm(`Remover ${uniforme} - ${tamanho}?`)) {
        estoque = estoque.filter(e => !(e.uniforme === uniforme && e.tamanho === tamanho));
        salvarEstoqueLocal();
        atualizarTabelaEstoque();
        showToast('✅ Produto removido!', 'success');
    }
}

function atualizarTabelaEstoque() {
    const tbody = document.getElementById('estoqueBody');
    const totalItens = estoque.reduce((sum, i) => sum + i.quantidade, 0);
    
    document.getElementById('totalItens').textContent = totalItens;
    document.getElementById('totalTipos').textContent = estoque.length;
    document.getElementById('valorTotal').textContent = movimentacoes.length;
    
    if(estoque.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">Nenhum produto</td></tr>';
        return;
    }
    
    tbody.innerHTML = estoque.map(i => `
        <tr>
            <td>${i.uniforme}</td>
            <td>${i.tamanho}</td>
            <td><strong>${i.quantidade}</strong></td>
            <td>${i.local || '-'}</td>
            <td>
                <button class="btn-icon btn-edit" onclick="editarEstoque('${i.uniforme}', '${i.tamanho}')">✏️</button>
                <button class="btn-icon btn-delete" onclick="excluirEstoque('${i.uniforme}', '${i.tamanho}')">🗑️</button>
            </td>
        </tr>
    `).join('');
}

// ========== TABELAS ==========
function atualizarTabelaMovimentacoes() {
    const tbody = document.getElementById('movimentacoesBody');
    
    if(movimentacoes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9">Nenhuma movimentação</td></tr>';
        return;
    }
    
    tbody.innerHTML = movimentacoes.slice(0, 30).map(m => `
        <tr>
            <td>${m.data}</td>
            <td>${m.uniforme}</td>
            <td>${m.tamanho}</td>
            <td>${m.local}</td>
            <td>${m.quantidade}</td>
            <td>${m.destinatario}</td>
            <td><span class="badge ${m.tipo}">${m.tipo === 'entrada' ? 'ENTRADA' : 'SAÍDA'}</span></td>
            <td>${m.estoqueInicial}</td>
            <td>${m.estoqueFinal}</td>
        </tr>
    `).join('');
}

// ========== RELATÓRIOS ==========
function atualizarFiltrosUniformes() {
    const uniformes = [...new Set(movimentacoes.map(m => m.uniforme))];
    const select = document.getElementById('filtroUniforme');
    select.innerHTML = '<option value="">Todos uniformes</option>' + 
        uniformes.map(u => `<option value="${u}">${u}</option>`).join('');
}

function filtrarRelatorio() {
    const mes = document.getElementById('filtroMes').value;
    const tipo = document.getElementById('filtroTipo').value;
    const uniforme = document.getElementById('filtroUniforme').value;
    
    let filtrados = [...movimentacoes];
    
    if(mes) filtrados = filtrados.filter(m => m.data.substring(0,7) === mes);
    if(tipo !== 'todos') filtrados = filtrados.filter(m => m.tipo === tipo);
    if(uniforme) filtrados = filtrados.filter(m => m.uniforme === uniforme);
    
    relatorioFiltrado = filtrados;
    
    const tbody = document.getElementById('relatorioBody');
    if(filtrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9">Nenhum registro encontrado</td</tr>';
    } else {
        tbody.innerHTML = filtrados.slice(0, 100).map(m => `
            <tr>
                <td>${m.data}</td>
                <td>${m.uniforme}</td>
                <td>${m.tamanho}</td>
                <td>${m.local}</td>
                <td>${m.quantidade}</td>
                <td>${m.destinatario}</td>
                <td><span class="badge ${m.tipo}">${m.tipo === 'entrada' ? 'ENTRADA' : 'SAÍDA'}</span></td>
                <td>${m.estoqueInicial}</td
                <td>${m.estoqueFinal}</td
            </tr>
        `).join('');
    }
    
    const grupos = new Map();
    filtrados.forEach(m => {
        const key = `${m.uniforme}|${m.tamanho}`;
        if(!grupos.has(key)) {
            grupos.set(key, {
                uniforme: m.uniforme,
                tamanho: m.tamanho,
                entradas: 0,
                saidas: 0
            });
        }
        const item = grupos.get(key);
        if(m.tipo === 'entrada') item.entradas += m.quantidade;
        else item.saidas += m.quantidade;
    });
    
    const resumoBody = document.getElementById('resumoUniformeBody');
    const gruposArray = Array.from(grupos.values());
    
    if(gruposArray.length === 0) {
        resumoBody.innerHTML = '<tr><td colspan="5">Nenhum dado</td</tr>';
    } else {
        resumoBody.innerHTML = gruposArray.map(g => {
            const estoqueAtual = getEstoqueAtual(g.uniforme, g.tamanho);
            return `
                <tr>
                    <td>${g.uniforme}</td
                    <td>${g.tamanho}</td
                    <td><strong>${estoqueAtual}</strong></td
                    <td>${g.entradas}</td
                    <td>${g.saidas}</td
                </tr>
            `;
        }).join('');
    }
}

function limparFiltros() {
    document.getElementById('filtroMes').value = '';
    document.getElementById('filtroTipo').value = 'todos';
    document.getElementById('filtroUniforme').value = '';
    filtrarRelatorio();
    showToast('✅ Filtros limpos!', 'success');
}

function limparRelatorios() {
    if(confirm('⚠️ Isso vai limpar TODO o histórico de movimentações. Confirmar?')) {
        movimentacoes = [];
        salvarMovimentacoesLocal();
        atualizarTabelaMovimentacoes();
        atualizarFiltrosUniformes();
        filtrarRelatorio();
        showToast('🗑️ Histórico limpo!', 'warning');
    }
}

function exportarRelatorioCSV() {
    if(relatorioFiltrado.length === 0) {
        showToast('Nenhum dado para exportar', 'error');
        return;
    }
    
    const headers = ['Data', 'Uniforme', 'Tamanho', 'Local', 'Quantidade', 'Destinatário', 'Tipo', 'Estoque Inicial', 'Estoque Final'];
    const linhas = relatorioFiltrado.map(m => [
        m.data, m.uniforme, m.tamanho, m.local, m.quantidade,
        m.destinatario, m.tipo, m.estoqueInicial, m.estoqueFinal
    ]);
    
    const csv = [headers, ...linhas].map(row => row.join(',')).join('\n');
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_uniformes_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast('📥 Relatório exportado!', 'success');
}

// ========== NAVEGAÇÃO ==========
function mudarPagina(pagina, elemento) {
    document.querySelectorAll('.pagina').forEach(p => p.classList.remove('ativa'));
    document.getElementById(`pagina${pagina.charAt(0).toUpperCase() + pagina.slice(1)}`).classList.add('ativa');
    
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('ativo'));
    if(elemento) elemento.classList.add('ativo');
    
    if(pagina === 'relatorios') filtrarRelatorio();
}

// ========== EVENT LISTENERS ==========
document.getElementById('mov_uniforme')?.addEventListener('change', () => {
    const u = document.getElementById('mov_uniforme').value;
    const t = document.getElementById('mov_tamanho').value;
    const q = parseInt(document.getElementById('mov_quantidade').value);
    if(u && t) verificarEstoque(u, t, q);
});

document.getElementById('mov_tamanho')?.addEventListener('change', () => {
    const u = document.getElementById('mov_uniforme').value;
    const t = document.getElementById('mov_tamanho').value;
    const q = parseInt(document.getElementById('mov_quantidade').value);
    if(u && t) verificarEstoque(u, t, q);
});

document.getElementById('mov_quantidade')?.addEventListener('input', () => {
    const u = document.getElementById('mov_uniforme').value;
    const t = document.getElementById('mov_tamanho').value;
    const q = parseInt(document.getElementById('mov_quantidade').value);
    if(u && t) verificarEstoque(u, t, q);
});

// ========== INICIALIZAÇÃO ==========
document.getElementById('mov_data').valueAsDate = new Date();
document.getElementById('filtroMes').value = new Date().toISOString().substring(0,7);
carregarDados();

showToast('✅ Sistema pronto! Dados vão para a planilha automaticamente!', 'success');