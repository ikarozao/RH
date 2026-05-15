// ========== CONFIGURAÇÕES ==========
const API_URL = 'https://script.google.com/macros/s/AKfycbxgc8YtEM5kcf3YgckQa525CmRsx9Avy31P0U4vqJ9bl-WC3fOpLxdS_mLT5Td880pH/exec';

// SUPABASE - SUAS CREDENCIAIS
const SUPABASE_URL = 'https://yhqdabswhtegwemajgnm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlocWRhYnN3aHRlZ3dlbWFqZ25tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NDM3MjgsImV4cCI6MjA5NDQxOTcyOH0.U68073tA6hGNKaxh4FN8q-Qd4BcXaNm9lzdZKTFW7Fs';

// Variáveis globais
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

// ========== FUNÇÃO PARA ENVIAR ESTOQUE PARA PLANILHA ==========
async function enviarEstoqueParaPlanilha() {
    try {
        // Buscar estoque atual do Supabase
        const supabase = initSupabase();
        let dadosEstoque = [];
        
        if (usuarioAtual && supabase) {
            const { data } = await supabase.from('estoque').select('*');
            if (data) dadosEstoque = data;
        } else {
            dadosEstoque = estoque;
        }
        
        // Enviar cada item do estoque para a planilha
        for (const item of dadosEstoque) {
            const dadosFormatados = {
                acao: 'sync_estoque',
                uniforme: item.uniforme,
                tamanho: item.tamanho,
                quantidade: item.quantidade,
                local: item.local || 'Almoxarifado',
                timestamp: new Date().toISOString()
            };
            
            await fetch(API_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dadosFormatados)
            });
        }
        
        console.log('✅ Estoque sincronizado com a planilha');
        return true;
    } catch(error) {
        console.error('Erro ao sincronizar estoque:', error);
        return false;
    }
}

// ========== FUNÇÕES DE LOGIN (GLOBAIS) ==========
window.mostrarLogin = function() {
    document.getElementById('telaCadastro').style.display = 'none';
    document.getElementById('telaLogin').style.display = 'flex';
};

window.mostrarCadastro = function() {
    document.getElementById('telaLogin').style.display = 'none';
    document.getElementById('telaCadastro').style.display = 'flex';
};

window.fazerLogin = async function() {
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
    
    // Carregar dados
    await carregarDadosDoSupabase();
    
    // Mostrar sistema
    document.getElementById('sistemaPrincipal').style.display = 'block';
    
    // Atualizar nome do usuário
    const nomeUsuario = usuarioAtual.email?.split('@')[0] || 'Usuário';
    document.getElementById('userName').innerHTML = `👤 ${nomeUsuario}`;
    
    showToast('✅ Login realizado! Dados sincronizados!');
};

window.fazerCadastro = async function() {
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
    window.mostrarLogin();
};

window.fazerLogout = async function() {
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
};

// ========== CARREGAR DADOS DO SUPABASE ==========
async function carregarDadosDoSupabase() {
    if (!usuarioAtual) return;
    
    showToast('🔄 Sincronizando dados...');
    const supabase = initSupabase();
    
    // Carregar movimentações
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
    
    // Carregar estoque
    const { data: estData } = await supabase
        .from('estoque')
        .select('*');
    
    if (estData) {
        estoque = estData;
        salvarEstoqueLocal();
        atualizarTabelaEstoque();
        
        // Sincronizar estoque com a planilha
        await enviarEstoqueParaPlanilha();
    }
    
    showToast('✅ Dados sincronizados!');
}

// ========== FUNÇÕES ORIGINAIS ==========
function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = `toast ${type} show`;
    setTimeout(() => toast.className = 'toast', 3000);
}

async function enviarParaPlanilha(dados) {
    try {
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
        
        await fetch(API_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dadosFormatados)
        });
        
        console.log('✅ Enviado para planilha');
        return true;
    } catch(error) {
        console.error('Erro planilha:', error);
        return false;
    }
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

window.setMovimento = function(tipo) {
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
};

window.enviarMovimentacao = async function() {
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
        data, uniforme, tamanho, local, quantidade,
        destinatario, tipo, estoqueInicial, estoqueFinal, observacao
    };
    
    // Salvar local
    movimentacoes.unshift(mov);
    salvarMovimentacoesLocal();
    atualizarEstoque(uniforme, tamanho, quantidade, tipo, local);
    
    // Enviar para planilha (movimentação)
    enviarParaPlanilha(mov);
    
    // Salvar no Supabase
    const supabase = initSupabase();
    if (usuarioAtual && supabase) {
        await supabase
            .from('movimentacoes')
            .insert([{
                data, uniforme, tamanho, local, quantidade,
                destinatario, tipo, estoque_inicial: estoqueInicial,
                estoque_final: estoqueFinal, observacao
            }]);
        
        // Atualizar estoque no Supabase
        const estoqueExistente = estoque.find(e => e.uniforme === uniforme && e.tamanho === tamanho);
        
        if (estoqueExistente && estoqueExistente.id) {
            await supabase
                .from('estoque')
                .update({ quantidade: estoqueFinal, local, ultima_atualizacao: new Date() })
                .eq('id', estoqueExistente.id);
        } else {
            const { data: newEstoque } = await supabase
                .from('estoque')
                .insert([{ uniforme, tamanho, quantidade: estoqueFinal, local }])
                .select();
            
            if (newEstoque && newEstoque[0]) {
                const index = estoque.findIndex(e => e.uniforme === uniforme && e.tamanho === tamanho);
                if (index !== -1) {
                    estoque[index].id = newEstoque[0].id;
                }
            }
        }
        
        // Sincronizar estoque com a planilha
        await enviarEstoqueParaPlanilha();
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
};

window.salvarEstoqueInicial = async function() {
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
            uniforme, tamanho, quantidade, local,
            ultimaAtualizacao: new Date().toLocaleString()
        });
    }
    
    salvarEstoqueLocal();
    atualizarTabelaEstoque();
    
    // Salvar no Supabase
    const supabase = initSupabase();
    if (usuarioAtual && supabase) {
        const existe = estoque.find(e => e.uniforme === uniforme && e.tamanho === tamanho);
        
        if (existe && existe.id) {
            await supabase
                .from('estoque')
                .update({ quantidade, local, ultima_atualizacao: new Date() })
                .eq('id', existe.id);
        } else {
            const { data: newEstoque } = await supabase
                .from('estoque')
                .insert([{ uniforme, tamanho, quantidade, local }])
                .select();
            
            if (newEstoque && newEstoque[0]) {
                const idx = estoque.findIndex(e => e.uniforme === uniforme && e.tamanho === tamanho);
                if (idx !== -1) {
                    estoque[idx].id = newEstoque[0].id;
                }
            }
        }
        
        // Sincronizar estoque com a planilha
        await enviarEstoqueParaPlanilha();
    }
    
    showToast('✅ Estoque salvo e sincronizado com a planilha!');
};

window.editarEstoque = function(uniforme, tamanho) {
    const item = estoque.find(e => e.uniforme === uniforme && e.tamanho === tamanho);
    if(item) {
        document.getElementById('est_uniforme').value = uniforme;
        document.getElementById('est_tamanho').value = tamanho;
        document.getElementById('est_quantidade').value = item.quantidade;
        document.getElementById('est_local').value = item.local || '';
        window.mudarPagina('estoque', document.querySelector('.nav-tab:nth-child(2)'));
    }
};

window.excluirEstoque = async function(uniforme, tamanho) {
    if(confirm(`Remover ${uniforme} - ${tamanho}?`)) {
        const itemRemover = estoque.find(e => e.uniforme === uniforme && e.tamanho === tamanho);
        
        estoque = estoque.filter(e => !(e.uniforme === uniforme && e.tamanho === tamanho));
        salvarEstoqueLocal();
        atualizarTabelaEstoque();
        
        // Remover do Supabase
        const supabase = initSupabase();
        if (usuarioAtual && supabase && itemRemover && itemRemover.id) {
            await supabase
                .from('estoque')
                .delete()
                .eq('id', itemRemover.id);
            
            // Sincronizar estoque com a planilha
            await enviarEstoqueParaPlanilha();
        }
        
        showToast('✅ Produto removido!', 'success');
    }
};

function atualizarTabelaEstoque() {
    const tbody = document.getElementById('estoqueBody');
    const totalItens = estoque.reduce((sum, i) => sum + i.quantidade, 0);
    
    document.getElementById('totalItens').textContent = totalItens;
    document.getElementById('totalTipos').textContent = estoque.length;
    document.getElementById('valorTotal').textContent = movimentacoes.length;
    
    if(estoque.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">Nenhum produto</td</tr>';
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
        tbody.innerHTML = '<tr><td colspan="9">Nenhuma movimentação</td</tr>';
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
    select.innerHTML = '<option value="">Todos uniformes</option>' + 
        uniformes.map(u => `<option value="${u}">${u}</option>`).join('');
}

window.filtrarRelatorio = function() {
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
                <td>${m.estoque_inicial || m.estoqueInicial}</td>
                <td>${m.estoque_final || m.estoqueFinal}</td>
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
                    <td>${g.uniforme}</td>
                    <td>${g.tamanho}</td>
                    <td><strong>${estoqueAtual}</strong></td>
                    <td>${g.entradas}</td>
                    <td>${g.saidas}</td>
                </tr>
            `;
        }).join('');
    }
};

window.limparFiltros = function() {
    document.getElementById('filtroMes').value = '';
    document.getElementById('filtroTipo').value = 'todos';
    document.getElementById('filtroUniforme').value = '';
    window.filtrarRelatorio();
    showToast('✅ Filtros limpos!', 'success');
};

window.limparRelatorios = function() {
    if(confirm('⚠️ Isso vai limpar TODO o histórico de movimentações. Confirmar?')) {
        movimentacoes = [];
        salvarMovimentacoesLocal();
        atualizarTabelaMovimentacoes();
        atualizarFiltrosUniformes();
        window.filtrarRelatorio();
        showToast('🗑️ Histórico limpo!', 'warning');
    }
};

window.exportarRelatorioCSV = function() {
    if(relatorioFiltrado.length === 0) {
        showToast('Nenhum dado para exportar', 'error');
        return;
    }
    
    const headers = ['Data', 'Uniforme', 'Tamanho', 'Local', 'Quantidade', 'Destinatário', 'Tipo', 'Estoque Inicial', 'Estoque Final'];
    const linhas = relatorioFiltrado.map(m => [
        m.data, m.uniforme, m.tamanho, m.local, m.quantidade,
        m.destinatario, m.tipo, m.estoque_inicial || m.estoqueInicial, m.estoque_final || m.estoqueFinal
    ]);
    
    const csv = [headers, ...linhas].map(row => row.join(',')).join('\n');
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_uniformes_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast('📥 Relatório exportado!', 'success');
};

window.mudarPagina = function(pagina, elemento) {
    document.querySelectorAll('.pagina').forEach(p => p.classList.remove('ativa'));
    document.getElementById(`pagina${pagina.charAt(0).toUpperCase() + pagina.slice(1)}`).classList.add('ativa');
    
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('ativo'));
    if(elemento) elemento.classList.add('ativo');
    
    if(pagina === 'relatorios') window.filtrarRelatorio();
};

// ========== VERIFICAR SESSÃO AO CARREGAR ==========
async function verificarSessao() {
    const supabase = initSupabase();
    if (!supabase) return;
    
    const { data } = await supabase.auth.getSession();
    
    if (data.session) {
        usuarioAtual = data.session.user;
        document.getElementById('telaLogin').style.display = 'none';
        document.getElementById('sistemaPrincipal').style.display = 'block';
        await carregarDadosDoSupabase();
        
        const nomeUsuario = usuarioAtual.email?.split('@')[0] || 'Usuário';
        document.getElementById('userName').innerHTML = `👤 ${nomeUsuario}`;
    } else {
        document.getElementById('telaLogin').style.display = 'flex';
        document.getElementById('sistemaPrincipal').style.display = 'none';
        carregarDados();
    }
}

// ========== BOTÃO MANUAL PARA SINCRONIZAR ESTOQUE ==========
window.sincronizarEstoqueComPlanilha = async function() {
    showToast('🔄 Sincronizando estoque com a planilha...');
    await enviarEstoqueParaPlanilha();
    showToast('✅ Estoque sincronizado!');
};

// Adicionar botão de sincronização no card de estoque (opcional)
function adicionarBotaoSincronizar() {
    const cardEstoque = document.querySelector('#paginaEstoque .card:first-child');
    if (cardEstoque && !document.getElementById('btnSyncEstoque')) {
        const btnSync = document.createElement('button');
        btnSync.id = 'btnSyncEstoque';
        btnSync.className = 'btn-primary btn-secondary';
        btnSync.style.marginTop = '10px';
        btnSync.style.background = 'linear-gradient(135deg, #10b981, #059669)';
        btnSync.innerHTML = '🔄 SINCRONIZAR ESTOQUE COM PLANILHA';
        btnSync.onclick = window.sincronizarEstoqueComPlanilha;
        cardEstoque.appendChild(btnSync);
    }
}

// ========== EVENT LISTENERS ==========
document.getElementById('mov_data').valueAsDate = new Date();
document.getElementById('filtroMes').value = new Date().toISOString().substring(0,7);

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

// ========== INICIAR ==========
initSupabase();
verificarSessao();
setTimeout(adicionarBotaoSincronizar, 1000);

showToast('✅ Sistema pronto!');