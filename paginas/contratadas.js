/* CONTRATADAS - gerado automaticamente */

const MES_ALVO = '2026-10-31';


// Grafico: CURVA FÍSICA - ANO
function render_3c983f28(dados) {
  // TODO: montar grafico
  // Campos: {"Category": [{"queryRef": "dCalendario.Date.Variation.Hierarquia de datas.Ano", "displayName": null}, {"queryRef": "dCalendario.Date.Variation.Hierarquia de datas.Mês", "displayName": null}], "Y2": [{"queryRef": "Sum(% Físico Total.Real Acum)", "displayName": "Real Acum", "tipo": "aggregation", "entidade": "% Físico Total", "propriedade": "Real Acum", "funcao": 4, "funcao_nome": "sum"}, {"queryRef": "Sum(% Físico Total.Projetado Acum)", "displayName": "Tendência Acum", "tipo": "aggregation", "entidade": "% Físico Total", "propriedade": "Projetado Acum", "funcao": 4, "funcao_nome": "sum"}, {"queryRef": "Sum(% Físico Total.Baseline 1 Acum)", "displayName": "Planejado Acum", "tipo": "aggregation", "entidade": "% Físico Total", "propriedade": "Baseline 1 Acum", "funcao": 4, "funcao_nome": "sum"}]}
}

// Grafico: ADERÊNCIA REAL
function render_900707d0(dados) {
  // TODO: montar grafico
  // Campos: {"Y": [{"queryRef": "% Físico Total.Aderência mês", "displayName": null, "tipo": "measure", "entidade": "% Físico Total", "propriedade": "Aderência mês"}]}
}

// Grafico: CURVA FÍSICA (S+1)
function render_ce9c8e98(dados) {
  // TODO: montar grafico
  // Campos: {"Category": [{"queryRef": "dCalendario.Date.Variation.Hierarquia de datas.Ano", "displayName": null}, {"queryRef": "dCalendario.Date.Variation.Hierarquia de datas.Mês", "displayName": null}], "Y": [{"queryRef": "Sum(% Físico Total.Baseline 1)", "displayName": "Planejado", "tipo": "aggregation", "entidade": "% Físico Total", "propriedade": "Baseline 1", "funcao": 0, "funcao_nome": "count"}, {"queryRef": "Sum(% Físico Total.Real)", "displayName": "Real", "tipo": "aggregation", "entidade": "% Físico Total", "propriedade": "Real", "funcao": 0, "funcao_nome": "count"}], "Y2": [{"queryRef": "Sum(% Físico Total.Baseline 1 Acum)", "displayName": "Planejado Acum", "tipo": "aggregation", "entidade": "% Físico Total", "propriedade": "Baseline 1 Acum", "funcao": 4, "funcao_nome": "sum"}, {"queryRef": "Sum(% Físico Total.Real Acum)", "displayName": "Real Acum", "tipo": "aggregation", "entidade": "% Físico Total", "propriedade": "Real Acum", "funcao": 4, "funcao_nome": "sum"}]}
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
    console.log('CONTRATADAS carregada', dados);
    // TODO: chamar as funcoes de renderizacao
  } catch (err) {
    console.error(err);
  }
}

document.addEventListener('DOMContentLoaded', render);
