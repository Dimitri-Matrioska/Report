/* STMA  - gerado automaticamente */

const MES_ALVO = '2026-10-31';


// KPI: CURVA FÍSICA SEMANA
function calc_17a2d7b6(dados) {
  // TODO: implementar com base em STMA.Resultado (count)
  return 0;
}

// Grafico: DESVIOS NO MÊS VIGENTE
function render_1bedbc29(dados) {
  // TODO: montar grafico
  // Campos: {"Category": [{"queryRef": "Desvios STMA.Potencial de Gravidade", "displayName": null, "tipo": "column", "entidade": "Desvios STMA", "propriedade": "Potencial de Gravidade"}], "Y": [{"queryRef": "Count(Desvios STMA.ID)", "displayName": null, "tipo": "aggregation", "entidade": "Desvios STMA", "propriedade": "ID", "funcao": 2, "funcao_nome": "max"}]}
}

// Grafico: TOTAL DESVIOS
function render_4ab2cd84(dados) {
  // TODO: montar grafico
  // Campos: {"Category": [{"queryRef": "Desvios STMA.Potencial de Gravidade", "displayName": null, "tipo": "column", "entidade": "Desvios STMA", "propriedade": "Potencial de Gravidade"}], "Y": [{"queryRef": "Count(Desvios STMA.ID)", "displayName": null, "tipo": "aggregation", "entidade": "Desvios STMA", "propriedade": "ID", "funcao": 2, "funcao_nome": "max"}]}
}

// KPI: CURVA FÍSICA SEMANA
function calc_56b0aaba(dados) {
  // TODO: implementar com base em Desvios STMA.ID (max)
  return 0;
}

// KPI: CURVA FÍSICA SEMANA
function calc_69b3af43(dados) {
  // TODO: implementar com base em Desvios STMA.ID (max)
  return 0;
}

// Grafico: AÇÕES DESVIOS GRAVES
function render_c125deaf(dados) {
  // TODO: montar grafico
  // Campos: {"Category": [{"queryRef": "Ações Desvios.Status", "displayName": null, "tipo": "column", "entidade": "Ações Desvios", "propriedade": "Status"}], "Y": [{"queryRef": "Count(Ações Desvios.Ação)", "displayName": null, "tipo": "aggregation", "entidade": "Ações Desvios", "propriedade": "Ação", "funcao": 2, "funcao_nome": "max"}]}
}

// Grafico: DESVIOS GRAVES
function render_e8ef26fc(dados) {
  // TODO: montar grafico
  // Campos: {"Category": [{"queryRef": "dCalendario.Date.Variation.Hierarquia de datas.Ano", "displayName": null}, {"queryRef": "dCalendario.Date.Variation.Hierarquia de datas.Mês", "displayName": null}], "Series": [{"queryRef": "Desvios STMA.Potencial de Gravidade", "displayName": null, "tipo": "column", "entidade": "Desvios STMA", "propriedade": "Potencial de Gravidade"}], "Y2": [{"queryRef": "Count(Desvios STMA.ID)", "displayName": null, "tipo": "aggregation", "entidade": "Desvios STMA", "propriedade": "ID", "funcao": 2, "funcao_nome": "max"}]}
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
    console.log('STMA  carregada', dados);
    // TODO: chamar as funcoes de renderizacao
  } catch (err) {
    console.error(err);
  }
}

document.addEventListener('DOMContentLoaded', render);
