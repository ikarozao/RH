// ========== CONFIGURAÇÕES ==========
const SPREADSHEET_ID = '1SdvK160AI76el6__5I2viewDMA8sGx7h-2PS1m23ujU';
const ABA_MOVIMENTACOES = 'Movimentacoes';
const ABA_ESTOQUE = 'Estoque';

// ========== FUNÇÃO DO GET (buscar dados) ==========
function doGet(e) {
  const header = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
  
  const tipo = e?.parameter?.tipo || 'movimentacoes';
  
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    if (tipo === 'estoque') {
      const sheet = ss.getSheetByName(ABA_ESTOQUE);
      const dados = sheet.getDataRange().getValues();
      
      const resultado = [];
      for (let i = 1; i < dados.length; i++) {
        if (dados[i][0]) {
          resultado.push({
            uniforme: dados[i][0],
            tamanho: dados[i][1],
            quantidade: dados[i][2],
            local: dados[i][3],
            ultimaAtualizacao: dados[i][4]
          });
        }
      }
      
      return ContentService
        .createTextOutput(JSON.stringify(resultado))
        .setMimeType(ContentService.MimeType.JSON)
        .setHeaders(header);
        
    } else {
      const sheet = ss.getSheetByName(ABA_MOVIMENTACOES);
      const dados = sheet.getDataRange().getValues();
      
      const resultado = [];
      for (let i = 1; i < dados.length; i++) {
        resultado.push({
          data: dados[i][0],
          uniforme: dados[i][1],
          tamanho: dados[i][2],
          local: dados[i][3],
          quantidade: dados[i][4],
          destinatario: dados[i][5],
          tipo: dados[i][6],
          estoque_inicial: dados[i][7],
          estoque_final: dados[i][8],
          observacao: dados[i][9],
          timestamp: dados[i][10]
        });
      }
      
      return ContentService
        .createTextOutput(JSON.stringify(resultado))
        .setMimeType(ContentService.MimeType.JSON)
        .setHeaders(header);
    }
    
  } catch(error) {
    return ContentService
      .createTextOutput(JSON.stringify({ erro: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders(header);
  }
}

// ========== FUNÇÃO DO POST (salvar dados) ==========
function doPost(e) {
  const header = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
  
  if (e && e.method === 'OPTIONS') {
    return ContentService
      .createTextOutput('')
      .setMimeType(ContentService.MimeType.TEXT)
      .setHeaders(header);
  }
  
  try {
    let dados;
    
    if (e && e.postData && e.postData.contents) {
      dados = JSON.parse(e.postData.contents);
    } else if (e && e.parameter && e.parameter.data) {
      dados = JSON.parse(e.parameter.data);
    } else {
      throw new Error('Dados não encontrados');
    }
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(ABA_MOVIMENTACOES);
    
    sheet.appendRow([
      dados.data,
      dados.uniforme,
      dados.tamanho,
      dados.local,
      dados.quantidade,
      dados.destinatario,
      dados.tipo,
      dados.estoque_inicial,
      dados.estoque_final,
      dados.observacao || '',
      dados.timestamp || new Date().toISOString()
    ]);
    
    atualizarEstoque(dados, ss);
    
    return ContentService
      .createTextOutput(JSON.stringify({ 
        success: true, 
        message: "Movimentação salva com sucesso!" 
      }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders(header);
      
  } catch(error) {
    return ContentService
      .createTextOutput(JSON.stringify({ 
        success: false, 
        erro: error.toString() 
      }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders(header);
  }
}

// ========== FUNÇÃO DO DELETE (remover item do estoque) ==========
function doDelete(e) {
  const header = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
  
  try {
    let dados;
    if (e && e.postData && e.postData.contents) {
      dados = JSON.parse(e.postData.contents);
    }
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(ABA_ESTOQUE);
    const todosDados = sheet.getDataRange().getValues();
    
    let linhaEncontrada = -1;
    
    for (let i = 1; i < todosDados.length; i++) {
      if (todosDados[i][0] === dados.uniforme && todosDados[i][1] === dados.tamanho) {
        linhaEncontrada = i + 1;
        break;
      }
    }
    
    if (linhaEncontrada !== -1) {
      sheet.getRange(linhaEncontrada, 1, 1, 5).clearContent();
    }
    
    return ContentService
      .createTextOutput(JSON.stringify({ success: true, message: "Item removido da planilha!" }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders(header);
      
  } catch(error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, erro: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders(header);
  }
}

// ========== FUNÇÃO PARA ATUALIZAR ESTOQUE ==========
function atualizarEstoque(mov, ss) {
  const sheet = ss.getSheetByName(ABA_ESTOQUE);
  const dados = sheet.getDataRange().getValues();
  
  let linhaEncontrada = -1;
  
  for (let i = 1; i < dados.length; i++) {
    if (dados[i][0] === mov.uniforme && dados[i][1] === mov.tamanho) {
      linhaEncontrada = i + 1;
      break;
    }
  }
  
  const quantidadeMov = parseInt(mov.quantidade);
  let novaQuantidade = 0;
  
  if (linhaEncontrada === -1) {
    novaQuantidade = mov.tipo === 'ENTRADA' ? quantidadeMov : -quantidadeMov;
    if (novaQuantidade < 0) novaQuantidade = 0;
    
    sheet.appendRow([
      mov.uniforme,
      mov.tamanho,
      novaQuantidade,
      mov.local,
      new Date().toLocaleString()
    ]);
  } else {
    const quantidadeAtual = parseInt(dados[linhaEncontrada - 1][2]);
    
    if (mov.tipo === 'ENTRADA') {
      novaQuantidade = quantidadeAtual + quantidadeMov;
    } else {
      novaQuantidade = quantidadeAtual - quantidadeMov;
      if (novaQuantidade < 0) novaQuantidade = 0;
    }
    
    sheet.getRange(linhaEncontrada, 3).setValue(novaQuantidade);
    sheet.getRange(linhaEncontrada, 4).setValue(mov.local);
    sheet.getRange(linhaEncontrada, 5).setValue(new Date().toLocaleString());
  }
}

// ========== FUNÇÃO PARA LIMPAR HISTÓRICO DE MOVIMENTAÇÕES ==========
function limparHistoricoMovimentacoes() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(ABA_MOVIMENTACOES);
  
  const ultimaLinha = sheet.getLastRow();
  if (ultimaLinha > 1) {
    sheet.getRange(2, 1, ultimaLinha - 1, 11).clearContent();
  }
  
  return "Histórico limpo!";
}

// ========== FUNÇÃO PARA CRIAR AS PLANILHAS ==========
function criarPlanilhas() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  let sheet = ss.getSheetByName(ABA_MOVIMENTACOES);
  if (!sheet) {
    sheet = ss.insertSheet(ABA_MOVIMENTACOES);
    sheet.getRange(1, 1, 1, 11).setValues([[
      'Data', 'Uniforme', 'Tamanho', 'Local', 'Quantidade', 
      'Destinatário', 'Tipo', 'Estoque Inicial', 'Estoque Final', 
      'Observação', 'Timestamp'
    ]]);
    sheet.getRange(1, 1, 1, 11).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  
  sheet = ss.getSheetByName(ABA_ESTOQUE);
  if (!sheet) {
    sheet = ss.insertSheet(ABA_ESTOQUE);
    sheet.getRange(1, 1, 1, 5).setValues([[
      'Uniforme', 'Tamanho', 'Quantidade', 'Local', 'Última Atualização'
    ]]);
    sheet.getRange(1, 1, 1, 5).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  
  SpreadsheetApp.getUi().alert('✅ Planilhas criadas com sucesso!');
}

// ========== FUNÇÃO PARA TESTAR CONEXÃO ==========
function testarConexao() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const nomePlanilha = ss.getName();
    
    const sheetMov = ss.getSheetByName(ABA_MOVIMENTACOES);
    const sheetEst = ss.getSheetByName(ABA_ESTOQUE);
    
    let status = `✅ Conexão OK!\n`;
    status += `📊 Planilha: ${nomePlanilha}\n`;
    status += `📝 Aba Movimentações: ${sheetMov ? 'OK' : 'NÃO ENCONTRADA'}\n`;
    status += `📦 Aba Estoque: ${sheetEst ? 'OK' : 'NÃO ENCONTRADA'}`;
    
    SpreadsheetApp.getUi().alert(status);
    return status;
  } catch(error) {
    SpreadsheetApp.getUi().alert(`❌ Erro: ${error.toString()}`);
    return error.toString();
  }
}

// ========== FUNÇÃO PARA LIMPAR TUDO ==========
function limparTudo() {
  const ui = SpreadsheetApp.getUi();
  const resposta = ui.alert(
    '⚠️ ATENÇÃO!',
    'Isso vai APAGAR TODOS os dados das planilhas. Continuar?',
    ui.ButtonSet.YES_NO
  );
  
  if (resposta === ui.Button.YES) {
    try {
      const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      
      let sheet = ss.getSheetByName(ABA_MOVIMENTACOES);
      if (sheet) {
        const ultimaLinha = sheet.getLastRow();
        if (ultimaLinha > 1) {
          sheet.getRange(2, 1, ultimaLinha - 1, 11).clearContent();
        }
      }
      
      sheet = ss.getSheetByName(ABA_ESTOQUE);
      if (sheet) {
        const ultimaLinha = sheet.getLastRow();
        if (ultimaLinha > 1) {
          sheet.getRange(2, 1, ultimaLinha - 1, 5).clearContent();
        }
      }
      
      ui.alert('✅ Todos os dados foram limpos!');
    } catch(error) {
      ui.alert(`❌ Erro: ${error.toString()}`);
    }
  }
}
window.excluirEstoque = async function(uniforme, tamanho) {
    if(confirm(`Remover ${uniforme} - ${tamanho} do sistema e da planilha?`)) {
        const itemRemover = estoque.find(e => e.uniforme === uniforme && e.tamanho === tamanho);
        
        // 1. Remover do array local
        estoque = estoque.filter(e => !(e.uniforme === uniforme && e.tamanho === tamanho));
        salvarEstoqueLocal();
        atualizarTabelaEstoque();
        
        // 2. Remover do Supabase
        const supabase = initSupabase();
        if (usuarioAtual && supabase && itemRemover && itemRemover.id) {
            await supabase
                .from('estoque')
                .delete()
                .eq('id', itemRemover.id);
        }
        
        // 3. Remover da PLANILHA via DELETE
        try {
            await fetch(API_URL, {
                method: 'DELETE',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    uniforme: uniforme,
                    tamanho: tamanho
                })
            });
            console.log('✅ Item removido da planilha');
        } catch(error) {
            console.error('Erro ao remover da planilha:', error);
        }
        
        showToast(`✅ ${uniforme} - ${tamanho} removido!`, 'success');
    }
};