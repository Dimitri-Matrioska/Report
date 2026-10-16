/* Detalhe One Page - gerado automaticamente */

const MES_ALVO = '2026-10-31';


// KPI: CANTEIRO GC (m³)
function calc_2b6a640f(dados) {
  // TODO: implementar com base em EVM.SPI (sum)
  return 0;
}

// Grafico: ADERÊNCIA REAL
function render_444d14f0(dados) {
  // TODO: montar grafico
  // Campos: {"Y": [{"queryRef": "% Físico Total.Aderência Acumulada", "displayName": null, "tipo": "measure", "entidade": "% Físico Total", "propriedade": "Aderência Acumulada"}]}
}

// Grafico: ADERÊNCIA REAL
function render_8d3e19d7(dados) {
  // TODO: montar grafico
  // Campos: {"Y": [{"queryRef": "Sum(Medições.Aderência)", "displayName": null, "tipo": "aggregation", "entidade": "Medições", "propriedade": "Aderência", "funcao": 4, "funcao_nome": "sum"}]}
}

// KPI: CANTEIRO GC (m³)
function calc_b3947410(dados) {
  // TODO: implementar com base em EVM.CPI (sum)
  return 0;
}

// KPI: CANTEIRO GC (m³)
function calc_b6c5ec85(dados) {
  // TODO: implementar com base em Medições.Baseline Acumulada (sum)
  return 0;
}

// KPI: CANTEIRO GC (m³)
function calc_fa816701(dados) {
  // TODO: implementar com base em % Físico Total.Baseline 1 Acum (sum)
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
    console.log('Detalhe One Page carregada', dados);
    // TODO: chamar as funcoes de renderizacao
  } catch (err) {
    console.error(err);
  }
}

document.addEventListener('DOMContentLoaded', render);
