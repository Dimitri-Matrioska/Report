/* COMMODITIES - gerado automaticamente */

const MES_ALVO = '2026-10-31';


// Grafico: CURVA DE SERVIÇOS NOTÁVEIS
function render_71ae4f17(dados) {
  // TODO: montar grafico
  // Campos: {"Category": [{"queryRef": "dCalendario.Date.Variation.Hierarquia de datas.Ano", "displayName": null}, {"queryRef": "dCalendario.Date.Variation.Hierarquia de datas.Mês", "displayName": null}, {"queryRef": "dCalendario.Date.Variation.Hierarquia de datas.Dia", "displayName": null}], "Y": [{"queryRef": "CountNonNull(Serviços Notáveis.Previsto)", "displayName": "Previsto", "tipo": "aggregation", "entidade": "Serviços Notáveis", "propriedade": "Previsto", "funcao": 0, "funcao_nome": "count"}, {"queryRef": "Sum(Serviços Notáveis.Real)", "displayName": "Real", "tipo": "aggregation", "entidade": "Serviços Notáveis", "propriedade": "Real", "funcao": 0, "funcao_nome": "count"}], "Y2": [{"queryRef": "Sum(Serviços Notáveis.Previsto Acum)", "displayName": "Previsto Acum", "tipo": "aggregation", "entidade": "Serviços Notáveis", "propriedade": "Previsto Acum", "funcao": 4, "funcao_nome": "sum"}, {"queryRef": "Sum(Serviços Notáveis.Real Acum)", "displayName": "Real Acum", "tipo": "aggregation", "entidade": "Serviços Notáveis", "propriedade": "Real Acum", "funcao": 4, "funcao_nome": "sum"}]}
}

// KPI: KPI
function calc_7278752c(dados) {
  // TODO: implementar com base em Serviços Notáveis.Aderência (sum)
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
    console.log('COMMODITIES carregada', dados);
    // TODO: chamar as funcoes de renderizacao
  } catch (err) {
    console.error(err);
  }
}

document.addEventListener('DOMContentLoaded', render);
