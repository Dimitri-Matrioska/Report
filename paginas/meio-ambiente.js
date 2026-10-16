/* MEIO AMBIENTE - gerado automaticamente */

const MES_ALVO = '2026-10-31';


// Grafico: AUDITORIA - DESVIOS
function render_7f820373(dados) {
  // TODO: montar grafico
  // Campos: {"Category": [{"queryRef": "Desvios STMA.Potencial de Gravidade", "displayName": null, "tipo": "column", "entidade": "Desvios STMA", "propriedade": "Potencial de Gravidade"}], "Y": [{"queryRef": "CountNonNull(Desvios STMA.ID)", "displayName": null, "tipo": "aggregation", "entidade": "Desvios STMA", "propriedade": "ID", "funcao": 2, "funcao_nome": "max"}]}
}

async function carregarDados() {
  const v = Date.now();
  const [fisico, pluviometria] = await Promise.all([
    fetch(BASE_URL + '/fisico_total.json?v=' + v).then(r => r.json()),
    fetch(BASE_URL + '/pluviometria.json?v=' + v).then(r => r.json())
  ]);
  return { fisico, pluviometria };
}

async function render() {
  try {
    const dados = await carregarDados();
    console.log('MEIO AMBIENTE carregada', dados);
    // TODO: chamar as funcoes de renderizacao
  } catch (err) {
    console.error(err);
  }
}

document.addEventListener('DOMContentLoaded', render);
