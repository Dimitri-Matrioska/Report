/* STMA Recorrências - gerado automaticamente */

const MES_ALVO = '2026-10-31';


// KPI: CURVA FÍSICA SEMANA
function calc_083fe9fb(dados) {
  // TODO: implementar com base em Desvios STMA.ID (max)
  return 0;
}

// Grafico: DESVIOS RECORRENTES
function render_231f6c5a(dados) {
  // TODO: montar grafico
  // Campos: {"Category": [{"queryRef": "Desvios STMA.Recorrente?", "displayName": null, "tipo": "column", "entidade": "Desvios STMA", "propriedade": "Recorrente?"}], "Y": [{"queryRef": "Count(Desvios STMA.ID)", "displayName": null, "tipo": "aggregation", "entidade": "Desvios STMA", "propriedade": "ID", "funcao": 2, "funcao_nome": "max"}]}
}

// Grafico: TOTAL DESVIOS
function render_823bad52(dados) {
  // TODO: montar grafico
  // Campos: {"Category": [{"queryRef": "Desvios STMA.Potencial de Gravidade", "displayName": null, "tipo": "column", "entidade": "Desvios STMA", "propriedade": "Potencial de Gravidade"}], "Y": [{"queryRef": "Count(Desvios STMA.ID)", "displayName": null, "tipo": "aggregation", "entidade": "Desvios STMA", "propriedade": "ID", "funcao": 2, "funcao_nome": "max"}]}
}

// Grafico: CLASSIFICAÇÃO DESVIOS RECORRENTES
function render_c5915b48(dados) {
  // TODO: montar grafico
  // Campos: {"Category": [{"queryRef": "Desvios STMA.Potencial de Gravidade", "displayName": null, "tipo": "column", "entidade": "Desvios STMA", "propriedade": "Potencial de Gravidade"}], "Y": [{"queryRef": "Count(Desvios STMA.ID)", "displayName": null, "tipo": "aggregation", "entidade": "Desvios STMA", "propriedade": "ID", "funcao": 2, "funcao_nome": "max"}]}
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
    console.log('STMA Recorrências carregada', dados);
    // TODO: chamar as funcoes de renderizacao
  } catch (err) {
    console.error(err);
  }
}

document.addEventListener('DOMContentLoaded', render);
