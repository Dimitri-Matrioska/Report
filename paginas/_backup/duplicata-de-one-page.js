/* Duplicata de ONE PAGE - gerado automaticamente */

const MES_ALVO = '2026-10-31';


// Grafico: ADERÊNCIA REAL
function render_0267c21c(dados) {
  // TODO: montar grafico
  // Campos: {"Y": [{"queryRef": "% Físico Total.Aderência Acumulada", "displayName": null, "tipo": "measure", "entidade": "% Físico Total", "propriedade": "Aderência Acumulada"}]}
}

// Grafico: ADERÊNCIA REAL
function render_06100487(dados) {
  // TODO: montar grafico
  // Campos: {"Y": [{"queryRef": "Sum(Medições.Aderência)", "displayName": null, "tipo": "aggregation", "entidade": "Medições", "propriedade": "Aderência", "funcao": 4, "funcao_nome": "sum"}]}
}

// KPI: CANTEIRO GC (m³)
function calc_1ea3afbc(dados) {
  // TODO: implementar com base em EVM.CPI (sum)
  return 0;
}

// KPI: CANTEIRO GC (m³)
function calc_33be6eed(dados) {
  // TODO: implementar com base em Dados Contrato.Saldo (count)
  return 0;
}

// KPI: CANTEIRO GC (m³)
function calc_65767086(dados) {
  // TODO: implementar com base em Medições.Baseline Acumulada (sum)
  return 0;
}

// KPI: CANTEIRO GC (m³)
function calc_73b28a16(dados) {
  // TODO: implementar com base em Dados Contrato.ID Contrato (max)
  return 0;
}

// KPI: CANTEIRO GC (m³)
function calc_9e3b7bb7(dados) {
  // TODO: implementar com base em % Físico Total.Baseline 1 Acum (sum)
  return 0;
}

// KPI: CANTEIRO GC (m³)
function calc_a9d78a7d(dados) {
  // TODO: implementar com base em EVM.SPI (sum)
  return 0;
}

// KPI: CANTEIRO GC (m³)
function calc_b7651dbd(dados) {
  // TODO: implementar com base em Medições.R$ Acumulado (sum)
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
    console.log('Duplicata de ONE PAGE carregada', dados);
    // TODO: chamar as funcoes de renderizacao
  } catch (err) {
    console.error(err);
  }
}

document.addEventListener('DOMContentLoaded', render);
