/* STATUS EXECUÇÃO - gerado automaticamente */

const MES_ALVO = '2026-10-31';


// Grafico: CURVA FÍSICA - ANO
function render_3b83100e(dados) {
  // TODO: montar grafico
  // Campos: {"Category": [{"queryRef": "dCalendario.Date.Variation.Hierarquia de datas.Ano", "displayName": null}, {"queryRef": "dCalendario.Date.Variation.Hierarquia de datas.Mês", "displayName": null}], "Y2": [{"queryRef": "Sum(% Físico Total.Baseline 1 Acum)", "displayName": "Planejado", "tipo": "aggregation", "entidade": "% Físico Total", "propriedade": "Baseline 1 Acum", "funcao": 4, "funcao_nome": "sum"}, {"queryRef": "Sum(% Físico Total.Real Acum)", "displayName": "Real", "tipo": "aggregation", "entidade": "% Físico Total", "propriedade": "Real Acum", "funcao": 4, "funcao_nome": "sum"}, {"queryRef": "Sum(% Físico Total.Projetado Acum)", "displayName": "Tendência", "tipo": "aggregation", "entidade": "% Físico Total", "propriedade": "Projetado Acum", "funcao": 4, "funcao_nome": "sum"}]}
}

// KPI: AVANÇO PREVISTO
function calc_65322dc1(dados) {
  // TODO: implementar com base em % Físico Total.Baseline 1 Acum (sum)
  return 0;
}

// Grafico: CURVA FÍSICA - PLURI
function render_686e2342(dados) {
  // TODO: montar grafico
  // Campos: {"Category": [{"queryRef": "dCalendario.Date.Variation.Hierarquia de datas.Ano", "displayName": null}], "Y2": [{"queryRef": "Sum(% Físico Total.Baseline 1 Acum)", "displayName": "Planejado", "tipo": "aggregation", "entidade": "% Físico Total", "propriedade": "Baseline 1 Acum", "funcao": 4, "funcao_nome": "sum"}, {"queryRef": "Sum(% Físico Total.Projetado Acum)", "displayName": "Tendência", "tipo": "aggregation", "entidade": "% Físico Total", "propriedade": "Projetado Acum", "funcao": 4, "funcao_nome": "sum"}]}
}

// Grafico: ADERÊNCIA REAL
function render_72434220(dados) {
  // TODO: montar grafico
  // Campos: {"Y": [{"queryRef": "% Físico Total.Aderência mês", "displayName": null, "tipo": "measure", "entidade": "% Físico Total", "propriedade": "Aderência mês"}]}
}

// KPI: DESVIO
function calc_76a82a0e(dados) {
  // TODO: implementar com base em % Físico Total._Desvio (sum)
  return 0;
}

// KPI: AVANÇO REAL
function calc_e4ce7724(dados) {
  // TODO: implementar com base em % Físico Total.Real Acum (sum)
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
    console.log('STATUS EXECUÇÃO carregada', dados);
    // TODO: chamar as funcoes de renderizacao
  } catch (err) {
    console.error(err);
  }
}

document.addEventListener('DOMContentLoaded', render);
