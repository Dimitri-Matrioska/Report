/* STMA mês - gerado automaticamente */

const MES_ALVO = '2026-10-31';


// Grafico: DESVIOS GRAVES
function render_66677346(dados) {
  // TODO: montar grafico
  // Campos: {"Category": [{"queryRef": "dCalendario.Date.Variation.Hierarquia de datas.Mês", "displayName": null}], "Series": [{"queryRef": "Desvios STMA.Potencial de Gravidade", "displayName": null, "tipo": "column", "entidade": "Desvios STMA", "propriedade": "Potencial de Gravidade"}], "Y2": [{"queryRef": "Count(Desvios STMA.ID)", "displayName": null, "tipo": "aggregation", "entidade": "Desvios STMA", "propriedade": "ID", "funcao": 2, "funcao_nome": "max"}]}
}

// Grafico: TOTAL DESVIOS
function render_7d50e95b(dados) {
  // TODO: montar grafico
  // Campos: {"Category": [{"queryRef": "Desvios STMA.Potencial de Gravidade", "displayName": null, "tipo": "column", "entidade": "Desvios STMA", "propriedade": "Potencial de Gravidade"}], "Y": [{"queryRef": "Count(Desvios STMA.ID)", "displayName": null, "tipo": "aggregation", "entidade": "Desvios STMA", "propriedade": "ID", "funcao": 2, "funcao_nome": "max"}]}
}

// KPI: CURVA FÍSICA SEMANA
function calc_97e49d1d(dados) {
  // TODO: implementar com base em Desvios STMA.ID (max)
  return 0;
}

// KPI: CURVA FÍSICA SEMANA
function calc_f37f9600(dados) {
  // TODO: implementar com base em STMA.Dias seguros (sum)
  return 0;
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
    console.log('STMA mês carregada', dados);
    // TODO: chamar as funcoes de renderizacao
  } catch (err) {
    console.error(err);
  }
}

document.addEventListener('DOMContentLoaded', render);
