/* PLUVIOMETRIA - gerado automaticamente */

const MES_ALVO = '2026-10-31';


// KPI: Média mm/dia
function calc_3de37231(dados) {
  // TODO: implementar com base em Pluviometria.mm/dia (min)
  return 0;
}

// KPI: Dias impactados
function calc_462b62f5(dados) {
  // TODO: implementar com base em Pluviometria.dia paralisado? (distinctCount)
  return 0;
}

// Grafico: PLUVIOMETRIA HISTÓRICA X REAL
function render_92bf6e58(dados) {
  // TODO: montar grafico
  // Campos: {"Category": [{"queryRef": "Pluviometria.Mês", "displayName": null, "tipo": "column", "entidade": "Pluviometria", "propriedade": "Mês"}], "Y": [{"queryRef": "Sum(Pluviometria.histórica acum)", "displayName": "Histórica acum", "tipo": "aggregation", "entidade": "Pluviometria", "propriedade": "histórica acum", "funcao": 0, "funcao_nome": "count"}, {"queryRef": "Sum(Pluviometria.mm acum)", "displayName": "Real acum", "tipo": "aggregation", "entidade": "Pluviometria", "propriedade": "mm acum", "funcao": 4, "funcao_nome": "sum"}]}
}

// KPI: mm acum no mês
function calc_e092e2d6(dados) {
  // TODO: implementar com base em Pluviometria.mm acum (sum)
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
    console.log('PLUVIOMETRIA carregada', dados);
    // TODO: chamar as funcoes de renderizacao
  } catch (err) {
    console.error(err);
  }
}

document.addEventListener('DOMContentLoaded', render);
