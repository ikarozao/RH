// COLE SUA URL AQUI - a que você copiou agora
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbycvnoUjVPy29UwHA5ta__YimrQy6qnHSQMoh32bKE5zJvcgU55UejYpugyv6Ap_Cvy/exec';

async function salvarNoGoogleSheets(dados) {
    try {
        console.log('Enviando dados:', dados);
        console.log('URL:', SCRIPT_URL);
        
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(dados)
        });
        
        console.log('Resposta status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const resultado = await response.json();
        console.log('Resultado:', resultado);
        
        if (resultado.success) {
            showToast('✅ Registro salvo no Google Sheets!', 'success');
            return true;
        } else {
            throw new Error(resultado.error);
        }
        
    } catch (error) {
        console.error('Erro detalhado:', error);
        showToast(`❌ Erro: ${error.message}`, 'error');
        return false;
    }
}

function showToast(message, type) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}

document.getElementById('uniformForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const dados = {
        data: document.getElementById('data').value,
        uniforme_tipo: document.getElementById('uniformeTipo').value,
        tamanho: document.getElementById('tamanho').value,
        local: document.getElementById('local').value,
        quantidade: parseInt(document.getElementById('quantidade').value),
        destinatario: document.getElementById('destinatario').value,
        tipo_movimento: document.getElementById('tipoMovimento').value,
        observacao: document.getElementById('observacao').value || ''
    };
    
    if (!dados.uniforme_tipo || !dados.tamanho || !dados.local || !dados.destinatario || !dados.data) {
        showToast('❌ Preencha todos os campos', 'error');
        return;
    }
    
    const btn = document.querySelector('.btn-submit');
    btn.disabled = true;
    btn.textContent = '💾 Salvando...';
    
    const sucesso = await salvarNoGoogleSheets(dados);
    
    if (sucesso) {
        document.getElementById('uniformForm').reset();
        document.getElementById('data').valueAsDate = new Date();
        showToast('✅ Registro enviado para planilha!', 'success');
    }
    
    btn.disabled = false;
    btn.textContent = '💾 Salvar Registro';
});

document.getElementById('data').valueAsDate = new Date();

// Testar conexão ao carregar
async function testarConexao() {
    try {
        const response = await fetch(SCRIPT_URL, { method: 'GET' });
        const texto = await response.text();
        console.log('Teste conexão:', texto);
        showToast('✅ Conectado ao Google Sheets', 'success');
    } catch(error) {
        console.error('Conexão falhou:', error);
        showToast('⚠️ Não conectado ao Google Sheets', 'error');
    }
}

testarConexao();