// ========== CONFIGURAÇÕES ==========
const API_URL = 'https://script.google.com/macros/s/AKfycbxgc8YtEM5kcf3YgckQa525CmRsx9Avy31P0U4vqJ9bl-WC3fOpLxdS_mLT5Td880pH/exec';

// SUPABASE - COLOQUE SUAS CREDENCIAIS AQUI!
const SUPABASE_URL = 'https://yhqdabswhtegwemajgnm.supabase.co';  // SUBSTITUA!
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlocWRhYnN3aHRlZ3dlbWFqZ25tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NDM3MjgsImV4cCI6MjA5NDQxOTcyOH0.U68073tA6hGNKaxh4FN8q-Qd4BcXaNm9lzdZKTFW7Fs';  // SUBSTITUA!

let supabase;
let usuarioAtual = null;
let tipoMovimento = 'entrada';
let estoque = [];
let movimentacoes = [];
let relatorioFiltrado = [];

// ========== INICIAR SUPABASE ==========
function initSupabase() {
    if (!supabase && SUPABASE_URL && !SUPABASE_URL.includes('SEU_PROJETO')) {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return true;
    }
    return false;
}

// ========== LOGIN ==========
async function fazerLogin() {
    const email = document.getElementById('loginEmail').value;
    const senha = document.getElementById('loginSenha').value;
    
    if (!email || !senha) {
        document.getElementById('loginErro').textContent = 'Preencha e-mail e senha!';
        return;
    }
    
    initSupabase();
    
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: senha
    });
    
    if (error) {
        document.getElementById('loginErro').textContent = 'Erro: ' + error.message;
        return;
    }
    
    usuarioAtual = data.user;
    document.getElementById('telaLogin').style.display = 'none';
    
    // Carregar dados do usuário do Supabase
    await carregarDadosDoSupabase();
    
    // Mostrar sistema
    document.getElementById('sistemaPrincipal').style.display = 'block';
    document.querySelector('.container').style.display = 'block';
    
    // Atualizar nome do usuário
    const { data: perfil } = await supabase.from('perfis').select('nome').eq('id', usuarioAtual.id).single();
    document.getElementById('userName').innerHTML = `👤 ${perfil?.nome || email.split('@')[0]}`;
    
    showToast('✅ Login realizado! Dados sincronizados!');
}

async function fazerCadastro() {
    const email = document.getElementById('cadEmail').value;
    const senha = document.getElementById('cadSenha').value;
    const nome = document.getElementById('cadNome').value;
    
    if (!email || !senha) {
        document.getElementById('cadErro').textContent = 'Preencha todos os campos!';
        return;
    }
    
    if (senha.length < 6) {
        document.getElementById('cadErro').textContent = 'Senha deve ter no mínimo 6 caracteres!';
        return;
    }
    
    initSupabase();
    
    const { data, error } = await supabase.auth.signUp({
        email: email,
        password: senha,
        options: { data: { nome: nome || email.split('@')[0] } }
    });
    
    if (error) {
        document.getElementById('cadErro').textContent = 'Erro: ' + error.message;
        return;
    }
    
    alert('✅ Conta criada! Faça login para continuar.');
    mostrarLogin();
}

async function fazerLogout() {
    await supabase.auth.signOut();
    usuarioAtual = null;
    
    // Limpar dados locais
    estoque = [];
    movimentacoes = [];
    
    // Mostrar login
    document.getElementById('sistemaPrincipal').style.display = 'none';
    document.querySelector('.container').style.display = 'none';
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

// ========== CARREGAR DADOS DO SUPABASE ==========
async function carregarDadosDoSupabase() {
    if (!usuarioAtual) return;
    
    showToast('🔄 Sincronizando dados...');
    
    // Carregar movimentações do usuário
    const { data: movData } = await supabase
        .from('movimentacoes')
        .select('*')
        .eq('user_id', usuarioAtual.id)
        .order('data', { ascending: false });
    
    if (movData) {
        movimentacoes = movData;
        salvarMovimentacoesLocal(); // Backup local
        atualizarTabelaMovimentacoes();
        atualizarFiltrosUniformes();
        filtrarRelatorio();
    }
    
    // Carregar estoque do usuário
    const { data: estData } = await supabase
        .from('estoque')
        .select('*')
        .eq('user_id', usuarioAtual.id);
    
    if (estData) {
        estoque = estData;
        salvarEstoqueLocal(); // Backup local
        atualizarTabelaEstoque();
    }
    
    showToast('✅ Dados sincronizados!');
}

// ========== FUNÇÕES MODIFICADAS PARA SUPABASE ==========
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
    
    // 1. SALVAR LOCAL (para já aparecer)
    movimentacoes.unshift(mov);
    salvarMovimentacoesLocal();
    atualizarEstoque(uniforme, tamanho, quantidade, tipo, local);
    
    // 2. ENVIAR PARA PLANILHA (Google Sheets)
    enviarParaPlanilha(mov);
    
    // 3. SALVAR NO SUPABASE (se estiver logado)
    if (usuarioAtual) {
        const { error } = await supabase
            .from('movimentacoes')
            .insert([{
                user_id: usuarioAtual.id,
                data, uniforme, tamanho, local, quantidade,
                destinatario, tipo, estoque_inicial: estoqueInicial,
                estoque_final: estoqueFinal, observacao
            }]);
        
        if (error) console.error('Erro Supabase:', error);
        
        // Atualizar estoque no Supabase
        const estoqueExistente = estoque.find(e => e.uniforme === uniforme && e.tamanho === tamanho);
        
        if (estoqueExistente) {
            await supabase
                .from('estoque')
                .update({ quantidade: estoqueFinal, local, ultima_atualizacao: new Date() })
                .eq('user_id', usuarioAtual.id)
                .eq('uniforme', uniforme)
                .eq('tamanho', tamanho);
        } else {
            await supabase
                .from('estoque')
                .insert([{ user_id: usuarioAtual.id, uniforme, tamanho, quantidade: estoqueFinal, local }]);
        }
    }
    
    showToast('✅ Movimentação salva! (Planilha + Nuvem)');
    
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

// ========== SALVAR ESTOQUE MODIFICADO ==========
async function salvarEstoqueInicial() {
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
    
    // Salvar no Supabase se logado
    if (usuarioAtual) {
        const existe = estoque.find(e => e.uniforme === uniforme && e.tamanho === tamanho);
        
        if (existe && existe.id) {
            await supabase
                .from('estoque')
                .update({ quantidade, local, ultima_atualizacao: new Date() })
                .eq('id', existe.id);
        } else {
            await supabase
                .from('estoque')
                .insert([{ user_id: usuarioAtual.id, uniforme, tamanho, quantidade, local }]);
        }
    }
    
    showToast('✅ Estoque salvo!');
}

// ========== VERIFICAR SE USUÁRIO JÁ ESTÁ LOGADO ==========
async function verificarSessao() {
    initSupabase();
    
    const { data } = await supabase.auth.getSession();
    
    if (data.session) {
        usuarioAtual = data.session.user;
        document.getElementById('telaLogin').style.display = 'none';
        document.getElementById('sistemaPrincipal').style.display = 'block';
        document.querySelector('.container').style.display = 'block';
        await carregarDadosDoSupabase();
        
        const { data: perfil } = await supabase.from('perfis').select('nome').eq('id', usuarioAtual.id).single();
        document.getElementById('userName').innerHTML = `👤 ${perfil?.nome || usuarioAtual.email?.split('@')[0]}`;
    } else {
        // Se não tiver sessão, carregar dados do localStorage mesmo
        document.getElementById('sistemaPrincipal').style.display = 'block';
        document.querySelector('.container').style.display = 'block';
        document.getElementById('telaLogin').style.display = 'none';
        carregarDados();
    }
}

// ========== SUAS FUNÇÕES ORIGINAIS (mantidas) ==========
// [Mantenha TODAS as suas funções originais aqui:]
// showToast, enviarParaPlanilha, carregarDados, salvarEstoqueLocal, 
// salvarMovimentacoesLocal, getEstoqueAtual, atualizarEstoque, 
// verificarEstoque, setMovimento, editarEstoque, excluirEstoque,
// atualizarTabelaEstoque, atualizarTabelaMovimentacoes, 
// atualizarFiltrosUniformes, filtrarRelatorio, limparFiltros,
// limparRelatorios, exportarRelatorioCSV, mudarPagina

// ========== INICIALIZAÇÃO ==========
document.getElementById('mov_data').valueAsDate = new Date();
document.getElementById('filtroMes').value = new Date().toISOString().substring(0,7);

// Iniciar
verificarSessao();