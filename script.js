// ========== CONFIGURAÇÕES ==========
const API_URL = 'https://script.google.com/macros/s/AKfycbxgc8YtEM5kcf3YgckQa525CmRsx9Avy31P0U4vqJ9bl-WC3fOpLxdS_mLT5Td880pH/exec';

const SUPABASE_URL = 'https://yhqdabswhtegwemajgnm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlocWRhYnN3aHRlZ3dlbWFqZ25tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NDM3MjgsImV4cCI6MjA5NDQxOTcyOH0.U68073tA6hGNKaxh4FN8q-Qd4BcXaNm9lzdZKTFW7Fs';

let supabaseClient = null;
let usuarioAtual = null;
let tipoMovimento = 'entrada';
let estoque = [];
let movimentacoes = [];
let relatorioFiltrado = [];

// ========== INICIAR SUPABASE ==========
function initSupabase() {
    if (!supabaseClient && window.supabase) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return supabaseClient;
}

// ========== FUNÇÕES DE LOGIN ==========
async function fazerLogin() {
    const email = document.getElementById('loginEmail').value;
    const senha = document.getElementById('loginSenha').value;
    const erroDiv = document.getElementById('loginErro');
    
    if (!email || !senha) {
        erroDiv.textContent = 'Preencha e-mail e senha!';
        return;
    }
    
    const supabase = initSupabase();
    if (!supabase) {
        erroDiv.textContent = 'Erro ao conectar com Supabase';
        return;
    }
    
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: senha
    });
    
    if (error) {
        erroDiv.textContent = 'Erro: ' + error.message;
        return;
    }
    
    usuarioAtual = data.user;
    document.getElementById('telaLogin').style.display = 'none';
    
    await carregarDadosDoSupabase();
    
    document.getElementById('sistemaPrincipal').style.display = 'block';
    
    const nomeUsuario = usuarioAtual.email?.split('@')[0] || 'Usuário';
    document.getElementById('userName').innerHTML = `👤 ${nomeUsuario}`;
    
    showToast('✅ Login realizado!');
}

async function fazerCadastro() {
    const email = document.getElementById('cadEmail').value;
    const senha = document.getElementById('cadSenha').value;
    const nome = document.getElementById('cadNome').value;
    const erroDiv = document.getElementById('cadErro');
    
    if (!email || !senha) {
        erroDiv.textContent = 'Preencha todos os campos!';
        return;
    }
    
    if (senha.length < 6) {
        erroDiv.textContent = 'Senha deve ter no mínimo 6 caracteres!';
        return;
    }
    
    const supabase = initSupabase();
    if (!supabase) {
        erroDiv.textContent = 'Erro ao conectar com Supabase';
        return;
    }
    
    const { data, error } = await supabase.auth.signUp({
        email: email,
        password: senha,
        options: { data: { nome: nome || email.split('@')[0] } }
    });
    
    if (error) {
        erroDiv.textContent = 'Erro: ' + error.message;
        return;
    }
    
    alert('✅ Conta criada! Faça login para continuar.');
    mostrarLogin();
}

async function fazerLogout() {
    const supabase = initSupabase();
    if (supabase) {
        await supabase.auth.signOut();
    }
    usuarioAtual = null;
    estoque = [];
    movimentacoes = [];
    
    document.getElementById('sistemaPrincipal').style.display = 'none';
    document.getElementById('telaLogin').style.display = 'flex';
    
    showToast('👋 Logout realizado!');
}

function mostrarLogin() {
    document.getElementById('telaCadastro').style.display = 'none';
    document.getElementById('telaLogin').style.display = 'flex';
}

function mostrarCadastro() {
    document.getElementById('telaLogin').style.display = 'none';
    document.getElementById('telaCadastro').style.display = 'flex';
}

// ========== CARREGAR DADOS ==========
async function carregarDadosDoSupabase() {
    if (!usuarioAtual) return;
    
    showToast('🔄 Carregando dados...');
    const supabase = initSupabase();
    
    const { data: movData } = await supabase
        .from('movimentacoes')
        .select('*')
        .order('data', { ascending: false });
    
    if (movData) {
        movimentacoes = movData;
        salvarMovimentacoesLocal();
        atualizarTabelaMovimentacoes();
        atualizarFiltrosUniformes();
        filtrarRelatorio();
    }
    
    const { data: estData } = await supabase
        .from('estoque')
        .select('*');
    
    if (estData) {
        estoque = estData;
        salvarEstoqueLocal();
        atualizarTabelaEstoque();
    }
    
    showToast('✅ Dados carregados!');
}

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
            uniforme, tamanho, quantidade,
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
    
    // Buscar estoque atual CORRETAMENTE
    const supabase = initSupabase();
    let estoqueAtual = 0;
    
    if (usuarioAtual && supabase) {
        // Buscar estoque atual do Supabase
        const { data: estData } = await supabase
            .from('estoque')
            .select('quantidade')
            .eq('uniforme', uniforme)
            .eq('tamanho', tamanho)
            .single();
        
        estoqueAtual = estData ? estData.quantidade : 0;
    } else {
        estoqueAtual = getEstoqueAtual(uniforme, tamanho);
    }
    
    document.getElementById('mov_estoque_inicial').value = estoqueAtual;
    
    let estoqueFinal = estoqueAtual;
    
    if(tipo === 'entrada') {
        estoqueFinal = estoqueAtual + quantidade;
    } else if(quantidade > estoqueAtual) {
        showToast(`⚠️ Estoque insuficiente! Disponível: ${estoqueAtual}`, 'error');
        return;
    } else {
        estoqueFinal = estoqueAtual - quantidade;
    }
    
    document.getElementById('mov_estoque_final').value = estoqueFinal;
    
    const mov = {
        id: Date.now(),
        data, uniforme, tamanho, local, quantidade,
        destinatario, tipo, estoqueInicial: estoqueAtual, 
        estoqueFinal: estoqueFinal, observacao
    };
    
    // Salvar localmente
    movimentacoes.unshift(mov);
    salvarMovimentacoesLocal();
    
    // Atualizar array local de estoque
    const indexLocal = estoque.findIndex(e => e.uniforme === uniforme && e.tamanho === tamanho);
    if(indexLocal !== -1) {
        estoque[indexLocal].quantidade = estoqueFinal;
        estoque[indexLocal].local = local;
    } else {
        estoque.push({ uniforme, tamanho, quantidade: estoqueFinal, local });
    }
    salvarEstoqueLocal();
    atualizarTabelaEstoque();
    
    // Enviar para planilha
    try {
        await fetch(API_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                data, uniforme, tamanho, local, quantidade,
                destinatario, tipo: tipo === 'entrada' ? 'ENTRADA' : 'SAÍDA',
                estoque_inicial: estoqueAtual, estoque_final: estoqueFinal, observacao,
                timestamp: new Date().toISOString()
            })
        });
    } catch(e) { console.error('Erro planilha:', e); }
    
    // Salvar no Supabase
    if (usuarioAtual && supabase) {
        // Salvar movimentação
        await supabase.from('movimentacoes').insert([{
            data, uniforme, tamanho, local, quantidade,
            destinatario, tipo, estoque_inicial: estoqueAtual,
            estoque_final: estoqueFinal, observacao
        }]);
        
        // ATUALIZAR ESTOQUE NO SUPABASE (parte corrigida)
        const { data: estoqueExistente } = await supabase
            .from('estoque')
            .select('id, quantidade')
            .eq('uniforme', uniforme)
            .eq('tamanho', tamanho)
            .single();
        
        if (estoqueExistente) {
            // Atualizar estoque existente
            await supabase
                .from('estoque')
                .update({ 
                    quantidade: estoqueFinal, 
                    local: local,
                    ultima_atualizacao: new Date().toISOString()
                })
                .eq('id', estoqueExistente.id);
        } else {
            // Criar novo registro de estoque
            const { data: newEstoque } = await supabase
                .from('estoque')
                .insert([{ 
                    uniforme, tamanho, 
                    quantidade: estoqueFinal, 
                    local: local,
                    ultima_atualizacao: new Date().toISOString()
                }])
                .select();
            
            if (newEstoque && newEstoque[0]) {
                const idx = estoque.findIndex(e => e.uniforme === uniforme && e.tamanho === tamanho);
                if (idx !== -1) estoque[idx].id = newEstoque[0].id;
            }
        }
    }
    
    showToast('✅ Movimentação salva!');
    
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

async function salvarEstoqueInicial() {
    const uniforme = document.getElementById('est_uniforme').value;
    const tamanho = document.getElementById('est_tamanho').value;
    const quantidade = parseInt(document.getElementById('est_quantidade').value);
    const local = document.getElementById('est_local').value || 'Almoxarifado';
    
    if(!uniforme || !tamanho) {
        showToast('❌ Selecione uniforme e tamanho!', 'error');
        return;
    }
    
    // Atualizar array local
    const index = estoque.findIndex(e => e.uniforme === uniforme && e.tamanho === tamanho);
    
    if(index !== -1) {
        estoque[index].quantidade = quantidade;
        estoque[index].local = local;
        estoque[index].ultimaAtualizacao = new Date().toLocaleString();
    } else {
        estoque.push({ 
            uniforme, tamanho, quantidade, local, 
            ultimaAtualizacao: new Date().toLocaleString() 
        });
    }
    
    salvarEstoqueLocal();
    atualizarTabelaEstoque();
    
    // Salvar no Supabase
    const supabase = initSupabase();
    if (usuarioAtual && supabase) {
        const { data: estoqueExistente } = await supabase
            .from('estoque')
            .select('id')
            .eq('uniforme', uniforme)
            .eq('tamanho', tamanho)
            .single();
        
        if (estoqueExistente) {
            await supabase
                .from('estoque')
                .update({ 
                    quantidade: quantidade, 
                    local: local,
                    ultima_atualizacao: new Date().toISOString()
                })
                .eq('id', estoqueExistente.id);
        } else {
            const { data: newEstoque } = await supabase
                .from('estoque')
                .insert([{ 
                    uniforme, tamanho, quantidade, local,
                    ultima_atualizacao: new Date().toISOString()
                }])
                .select();
            
            if (newEstoque && newEstoque[0]) {
                const idx = estoque.findIndex(e => e.uniforme === uniforme && e.tamanho === tamanho);
                if (idx !== -1) estoque[idx].id = newEstoque[0].id;
            }
        }
    }
    
    showToast('✅ Estoque salvo!');
}

async function excluirEstoque(uniforme, tamanho) {
    if(confirm(`Remover ${uniforme} - ${tamanho}?`)) {
        const itemRemover = estoque.find(e => e.uniforme === uniforme && e.tamanho === tamanho);
        
        estoque = estoque.filter(e => !(e.uniforme === uniforme && e.tamanho === tamanho));
        salvarEstoqueLocal();
        atualizarTabelaEstoque();
        
        const supabase = initSupabase();
        if (usuarioAtual && supabase && itemRemover && itemRemover.id) {
            await supabase.from('estoque').delete().eq('id', itemRemover.id);
        }
        
        showToast(`✅ ${uniforme} - ${tamanho} removido!`, 'success');
    }
}

function editarEstoque(uniforme, tamanho) {
    const item = estoque.find(e => e.uniforme === uniforme && e.tamanho === tamanho);
    if(item) {
        document.getElementById('est_uniforme').value = uniforme;
        document.getElementById('est_tamanho').value = tamanho;
        document.getElementById('est_quantidade').value = item.quantidade;
        document.getElementById('est_local').value = item.local || '';
        mudarPagina('estoque');
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
            <td>${m.estoque_inicial || m.estoqueInicial}</td>
            <td>${m.estoque_final || m.estoqueFinal}</td>
        </tr>
    `).join('');
}

function atualizarFiltrosUniformes() {
    const uniformes = [...new Set(movimentacoes.map(m => m.uniforme))];
    const select = document.getElementById('filtroUniforme');
    select.innerHTML = '<option value="">Todos uniformes</option>' + uniformes.map(u => `<option value="${u}">${u}</option>`).join('');
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
        tbody.innerHTML = filtrados.map(m => `
            <tr>
                <td>${m.data}</td>
                <td>${m.uniforme}</td>
                <td>${m.tamanho}</td>
                <td>${m.local}</td>
                <td>${m.quantidade}</td>
                <td>${m.destinatario}</td>
                <td><span class="badge ${m.tipo}">${m.tipo === 'entrada' ? 'ENTRADA' : 'SAÍDA'}</span></td>
                <td>${m.estoque_inicial || m.estoqueInicial}</td>
                <td>${m.estoque_final || m.estoqueFinal}</td>
            </tr>
        `).join('');
    }
}

function limparFiltros() {
    document.getElementById('filtroMes').value = '';
    document.getElementById('filtroTipo').value = 'todos';
    document.getElementById('filtroUniforme').value = '';
    filtrarRelatorio();
    showToast('✅ Filtros limpos!');
}

function limparRelatorios() {
    if(confirm('⚠️ Isso vai limpar TODO o histórico?')) {
        movimentacoes = [];
        salvarMovimentacoesLocal();
        atualizarTabelaMovimentacoes();
        atualizarFiltrosUniformes();
        filtrarRelatorio();
        showToast('🗑️ Histórico limpo!');
    }
}

function exportarRelatorioCSV() {
    if(relatorioFiltrado.length === 0) {
        showToast('Nenhum dado para exportar', 'error');
        return;
    }
    const headers = ['Data', 'Uniforme', 'Tamanho', 'Local', 'Quantidade', 'Destinatário', 'Tipo', 'Estoque Inicial', 'Estoque Final'];
    const linhas = relatorioFiltrado.map(m => [m.data, m.uniforme, m.tamanho, m.local, m.quantidade, m.destinatario, m.tipo, m.estoque_inicial || m.estoqueInicial, m.estoque_final || m.estoqueFinal]);
    const csv = [headers, ...linhas].map(row => row.join(',')).join('\n');
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_uniformes_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    showToast('📥 Relatório exportado!');
}

function mudarPagina(pagina) {
    document.querySelectorAll('.pagina').forEach(p => p.classList.remove('ativa'));
    document.getElementById(`pagina${pagina.charAt(0).toUpperCase() + pagina.slice(1)}`).classList.add('ativa');
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('ativo'));
    document.querySelector(`.nav-tab[data-pagina="${pagina}"]`).classList.add('ativo');
    if(pagina === 'relatorios') filtrarRelatorio();
}

function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = `toast ${type} show`;
    setTimeout(() => toast.className = 'toast', 3000);
}

// ========== VERIFICAR SESSÃO ==========
async function verificarSessao() {
    const supabase = initSupabase();
    if (!supabase) return;
    
    const { data } = await supabase.auth.getSession();
    
    if (data.session) {
        usuarioAtual = data.session.user;
        document.getElementById('telaLogin').style.display = 'none';
        document.getElementById('sistemaPrincipal').style.display = 'block';
        await carregarDadosDoSupabase();
        document.getElementById('userName').innerHTML = `👤 ${usuarioAtual.email?.split('@')[0] || 'Usuário'}`;
    } else {
        document.getElementById('telaLogin').style.display = 'flex';
        document.getElementById('sistemaPrincipal').style.display = 'none';
        carregarDados();
    }
}

// ========== EVENTOS ==========
document.addEventListener('DOMContentLoaded', function() {
    // Data atual
    document.getElementById('mov_data').valueAsDate = new Date();
    document.getElementById('filtroMes').value = new Date().toISOString().substring(0,7);
    
    // Login/Cadastro
    document.getElementById('btnLogin').onclick = fazerLogin;
    document.getElementById('btnMostrarCadastro').onclick = mostrarCadastro;
    document.getElementById('btnCadastrar').onclick = fazerCadastro;
    document.getElementById('btnVoltarLogin').onclick = mostrarLogin;
    document.getElementById('btnLogout').onclick = fazerLogout;
    
    // Ações principais
    document.getElementById('btnSalvarMov').onclick = enviarMovimentacao;
    document.getElementById('btnSalvarEstoque').onclick = salvarEstoqueInicial;
    
    // Relatórios
    document.getElementById('btnLimparFiltros').onclick = limparFiltros;
    document.getElementById('btnLimparHistorico').onclick = limparRelatorios;
    document.getElementById('btnExportarCSV').onclick = exportarRelatorioCSV;
    document.getElementById('filtroMes').onchange = filtrarRelatorio;
    document.getElementById('filtroTipo').onchange = filtrarRelatorio;
    document.getElementById('filtroUniforme').onchange = filtrarRelatorio;
    
    // Navegação
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.onclick = () => mudarPagina(tab.getAttribute('data-pagina'));
    });
    
    // Radio buttons tipo movimento
    document.querySelectorAll('.radio-btn').forEach(btn => {
        btn.onclick = () => setMovimento(btn.getAttribute('data-tipo'));
    });
    
    // Verificar estoque ao mudar campos
    document.getElementById('mov_uniforme').onchange = () => {
        const u = document.getElementById('mov_uniforme').value;
        const t = document.getElementById('mov_tamanho').value;
        const q = parseInt(document.getElementById('mov_quantidade').value);
        if(u && t) verificarEstoque(u, t, q);
    };
    document.getElementById('mov_tamanho').onchange = () => {
        const u = document.getElementById('mov_uniforme').value;
        const t = document.getElementById('mov_tamanho').value;
        const q = parseInt(document.getElementById('mov_quantidade').value);
        if(u && t) verificarEstoque(u, t, q);
    };
    document.getElementById('mov_quantidade').oninput = () => {
        const u = document.getElementById('mov_uniforme').value;
        const t = document.getElementById('mov_tamanho').value;
        const q = parseInt(document.getElementById('mov_quantidade').value);
        if(u && t) verificarEstoque(u, t, q);
    };
    
    initSupabase();
    verificarSessao();
});