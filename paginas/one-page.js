/* ONE PAGE - gerado automaticamente */

const MES_ALVO = '2026-10-31';


// KPI: KPI
function calc_181c9427(dados) {
  // TODO: implementar com base em Medições.R$ Total (sum)
  return 0;
}

// KPI: CANTEIRO GC (m³)
function calc_3c5117f5(dados) {
  // TODO: implementar com base em EVM.SPI (sum)
  return 0;
}

// KPI: CANTEIRO GC (m³)
function calc_5149d1b1(dados) {
  // TODO: implementar com base em Medições._Desvio Medição (sum)
  return 0;
}

// KPI: CANTEIRO GC (m³)
function calc_66bb9195(dados) {
  // TODO: implementar com base em EVM.CPI (sum)
  return 0;
}

// KPI: CANTEIRO GC (m³)
function calc_6c28acc1(dados) {
  // TODO: implementar com base em Dados Contrato.Saldo (count)
  return 0;
}

// KPI: KPI
function calc_71edfd2f(dados) {
  // TODO: implementar com base em Medições.R$ Total (sum)
  return 0;
}

// Grafico: ADERÊNCIA REAL
function render_850f660a(dados) {
  // TODO: montar grafico
  // Campos: {"Y": [{"queryRef": "Sum(Medições.Aderência)", "displayName": null, "tipo": "aggregation", "entidade": "Medições", "propriedade": "Aderência", "funcao": 4, "funcao_nome": "sum"}]}
}

// KPI: CANTEIRO GC (m³)
function calc_8f5b2dc0(dados) {
  // TODO: implementar com base em Dados Contrato.ID Contrato (max)
  return 0;
}

// KPI: CANTEIRO GC (m³)
function calc_91235b82(dados) {
  // TODO: implementar com base em Medições.R$ Acumulado (sum)
  return 0;
}

// KPI: CANTEIRO GC (m³)
function calc_a58ec120(dados) {
  // TODO: implementar com base em % Físico Total._Desvio (sum)
  return 0;
}

// Grafico: ADERÊNCIA REAL
function render_e229319a(dados) {
  // TODO: montar grafico
  // Campos: {"Y": [{"queryRef": "% Físico Total.Aderência Acumulada", "displayName": null, "tipo": "measure", "entidade": "% Físico Total", "propriedade": "Aderência Acumulada"}]}
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
    console.log('ONE PAGE carregada', dados);
    // TODO: chamar as funcoes de renderizacao
  } catch (err) {
    console.error(err);
  }
}

document.addEventListener('DOMContentLoaded', render);
