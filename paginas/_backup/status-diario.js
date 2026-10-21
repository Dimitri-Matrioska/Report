/* Status Diário - gerado automaticamente */

const MES_ALVO = '2026-10-31';


// KPI: CURVA FÍSICA SEMANA
function calc_3d1fed76(dados) {
  // TODO: implementar com base em Atividades Diárias.Desvio/Ocorrência de alto potencial (STMA) (sum)
  return 0;
}

// Grafico: CURVA FÍSICA - EXECUÇÃO
function render_44419e25(dados) {
  // TODO: montar grafico
  // Campos: {"Category": [{"queryRef": "dCalendario.Date.Variation.Hierarquia de datas.Mês", "displayName": null}, {"queryRef": "dCalendario.Date.Variation.Hierarquia de datas.Dia", "displayName": null}], "Y": [{"queryRef": "Sum(Cronograma Geral.Avanço %)", "displayName": "Baseline", "tipo": "aggregation", "entidade": "Cronograma Geral", "propriedade": "Avanço %", "funcao": 0, "funcao_nome": "count"}], "Y2": [{"queryRef": "Cronograma Geral.Avanço Acumulado %", "displayName": "BL Acum", "tipo": "measure", "entidade": "Cronograma Geral", "propriedade": "Avanço Acumulado %"}]}
}

// KPI: CURVA FÍSICA SEMANA
function calc_5169a572(dados) {
  // TODO: implementar com base em Atividades Diárias.Ocorrência S2P (count)
  return 0;
}

// KPI: CURVA FÍSICA SEMANA
function calc_a46feaf0(dados) {
  // TODO: implementar com base em Atividades Diárias.Nº acessos portaria (count)
  return 0;
}

// KPI: KPI
function calc_f411c8d9(dados) {
  // TODO: implementar com base em Atividades Diárias.Legenda Foto (avg)
  return 0;
}

// KPI: CURVA FÍSICA SEMANA
function calc_fc9cc674(dados) {
  // TODO: implementar com base em Atividades Diárias.Dias seguros (avg)
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
    console.log('Status Diário carregada', dados);
    // TODO: chamar as funcoes de renderizacao
  } catch (err) {
    console.error(err);
  }
}

document.addEventListener('DOMContentLoaded', render);
