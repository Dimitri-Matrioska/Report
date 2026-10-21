/* Duplicata de PERFORMANCE SEMANAL - gerado automaticamente */

const MES_ALVO = '2026-10-31';


// Grafico: CURVA FÍSICA (S+1)
function render_07f4cc30(dados) {
  // TODO: montar grafico
  // Campos: {"Category": [{"queryRef": "dCalendario.Date", "displayName": null, "tipo": "column", "entidade": "dCalendario", "propriedade": "Date"}], "Y": [{"queryRef": "Sum(% Físico Total.Real)", "displayName": "Real", "tipo": "aggregation", "entidade": "% Físico Total", "propriedade": "Real", "funcao": 0, "funcao_nome": "count"}, {"queryRef": "Sum(% Físico Total.Baseline 1)", "displayName": "Previsto", "tipo": "aggregation", "entidade": "% Físico Total", "propriedade": "Baseline 1", "funcao": 0, "funcao_nome": "count"}], "Y2": [{"queryRef": "Sum(% Físico Total.Real Acum)", "displayName": "Real Acum", "tipo": "aggregation", "entidade": "% Físico Total", "propriedade": "Real Acum", "funcao": 4, "funcao_nome": "sum"}, {"queryRef": "Sum(% Físico Total.Baseline 1 Acum)", "displayName": "Previsto Acum", "tipo": "aggregation", "entidade": "% Físico Total", "propriedade": "Baseline 1 Acum", "funcao": 4, "funcao_nome": "sum"}]}
}

// KPI: DESVIO
function calc_1e7c049f(dados) {
  // TODO: implementar com base em % Físico Total._Desvio (sum)
  return 0;
}

// KPI: AVANÇO REAL
function calc_221209c8(dados) {
  // TODO: implementar com base em % Físico Total.Real Acum (sum)
  return 0;
}

// KPI: Dias impactados
function calc_2a23eac0(dados) {
  // TODO: implementar com base em Pluviometria.dia paralisado? (distinctCount)
  return 0;
}

// KPI: mm acum no mês
function calc_33090d3b(dados) {
  // TODO: implementar com base em Pluviometria.mm acum (sum)
  return 0;
}

// Grafico: ADERÊNCIA REAL
function render_3a60811a(dados) {
  // TODO: montar grafico
  // Campos: {"Y": [{"queryRef": "% Físico Total.Aderência Semana", "displayName": null, "tipo": "measure", "entidade": "% Físico Total", "propriedade": "Aderência Semana"}]}
}

// KPI: AVANÇO PREVISTO
function calc_646731b5(dados) {
  // TODO: implementar com base em % Físico Total.Baseline 1 Acum (sum)
  return 0;
}

// Grafico: PLUVIOMETRIA HISTÓRICA X REAL (mm)
function render_a669ee41(dados) {
  // TODO: montar grafico
  // Campos: {"Category": [{"queryRef": "Pluviometria.Mês", "displayName": null, "tipo": "column", "entidade": "Pluviometria", "propriedade": "Mês"}], "Y": [{"queryRef": "Sum(Pluviometria.histórica acum)", "displayName": "Histórica acum", "tipo": "aggregation", "entidade": "Pluviometria", "propriedade": "histórica acum", "funcao": 0, "funcao_nome": "count"}, {"queryRef": "Sum(Pluviometria.mm acum)", "displayName": "Real acum", "tipo": "aggregation", "entidade": "Pluviometria", "propriedade": "mm acum", "funcao": 4, "funcao_nome": "sum"}]}
}

// Grafico: CURVA FÍSICA - ANO
function render_fdd4bb01(dados) {
  // TODO: montar grafico
  // Campos: {"Category": [{"queryRef": "dCalendario.Date.Variation.Hierarquia de datas.Ano", "displayName": null}, {"queryRef": "dCalendario.Date.Variation.Hierarquia de datas.Mês", "displayName": null}], "Y2": [{"queryRef": "Sum(% Físico Total.Real Acum)", "displayName": "Real Acum", "tipo": "aggregation", "entidade": "% Físico Total", "propriedade": "Real Acum", "funcao": 4, "funcao_nome": "sum"}, {"queryRef": "Sum(% Físico Total.Projetado Acum)", "displayName": "Tendência Acum", "tipo": "aggregation", "entidade": "% Físico Total", "propriedade": "Projetado Acum", "funcao": 4, "funcao_nome": "sum"}, {"queryRef": "Sum(% Físico Total.Baseline 1 Acum)", "displayName": "Previsto Acum", "tipo": "aggregation", "entidade": "% Físico Total", "propriedade": "Baseline 1 Acum", "funcao": 4, "funcao_nome": "sum"}]}
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
    console.log('Duplicata de PERFORMANCE SEMANAL carregada', dados);
    // TODO: chamar as funcoes de renderizacao
  } catch (err) {
    console.error(err);
  }
}

document.addEventListener('DOMContentLoaded', render);
