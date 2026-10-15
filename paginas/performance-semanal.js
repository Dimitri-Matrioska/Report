/* ============================================================
   PERFORMANCE-SEMANAL.JS — Lógica específica desta página
   ============================================================ */

const MES_ALVO = '2026-10-31';

/* ============================================================
   CARREGAMENTO DOS DADOS
   ============================================================ */
async function carregarDados() {
  const v = Date.now();
  const [pluv, fisico] = await Promise.all([
    fetch(`${BASE_URL}/pluviometria.json?v=${v}`).then(r => r.json()),
    fetch(`${BASE_URL}/fisico_total.json?v=${v}`).then(r => r.json())
  ]);
  return { pluv, fisico };
}

/* ============================================================
   CÁLCULO DOS KPIs
   ============================================================ */
function calcMmAcum(pluv) {
  return maxDe(filtrarPorMes(pluv, MES_ALVO), 'mm_acum');
}

function calcDiasImpactados(pluv) {
  return filtrarPorMes(pluv, MES_ALVO).filter(d => d.dia_paralisado === 'sim').length;
}

function calcPrevisto(fisico) {
  const ultima = ultimaDataCom(fisico, 'real_acum');
  if (!ultima) return 0;
  return maxDe(fisico.filter(d => d.data === ultima), 'baseline_1_acum');
}

function calcReal(fisico) {
  const ultima = ultimaDataCom(fisico, 'real_acum');
  if (!ultima) return 0;
  return maxDe(fisico.filter(d => d.data === ultima), 'real_acum');
}

function calcDesvio(fisico) {
  return calcReal(fisico) - calcPrevisto(fisico);
}

/* ============================================================
   GRÁFICO — Pluviometria (Histórica vs Real)
   ============================================================ */
function montarGraficoPluviometria(pluv) {
  // Agrupa por Mês
  const meses = [...new Set(pluv.map(d => d.mes))]
    .filter(m => m !== null)
    .sort();

  // Para cada mês, pega o MAX (acumulado até o último dia do mês)
  const dadosHist = meses.map(mes => {
    const doMes = filtrarPorMes(pluv, mes);
    return maxDe(doMes, 'historica_acum') || 0;
  });

  const dadosReal = meses.map(mes => {
    const doMes = filtrarPorMes(pluv, mes);
    return maxDe(doMes, 'mm_acum') || 0;
  });

  // Formata o rótulo do eixo X: "2026-03-31" → "mar/26"
  const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun',
                       'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const labels = meses.map(mes => {
    const d = new Date(mes + 'T00:00:00');
    const abrev = MESES_ABREV[d.getMonth()];
    const ano = String(d.getFullYear()).slice(-2);
    return `${abrev}/${ano}`;
  });

  renderBarChartAgrupado('chart-pluviometria', labels, [
    { nome: 'Histórica acum', dados: dadosHist, cor: TEMA_PBI.corHist },
    { nome: 'Real acum',      dados: dadosReal, cor: TEMA_PBI.corReal }
  ]);
}

/* ============================================================
   RENDER PRINCIPAL
   ============================================================ */
async function render() {
  try {
    const { pluv, fisico } = await carregarDados();

    // KPIs
    const previsto = calcPrevisto(fisico);
    const real     = calcReal(fisico);
    const desvio   = calcDesvio(fisico);

    const kpis = {
      previsto:        fmt.pct(previsto),
      real:            fmt.pct(real),
      desvio:          fmt.pct(desvio),
      mm_acum:         fmt.int(calcMmAcum(pluv)),
      dias_impactados: fmt.int(calcDiasImpactados(pluv))
    };

    document.querySelectorAll('[data-kpi]').forEach(el => {
      const k = el.getAttribute('data-kpi');
      el.classList.remove('loading');
      el.textContent = kpis[k] ?? '-';
      if (k === 'desvio' && desvio < 0) el.classList.add('negative');
    });

    // Gráfico
    montarGraficoPluviometria(pluv);

  } catch (err) {
    console.error(err);
    document.querySelectorAll('[data-kpi]').forEach(el => {
      el.classList.remove('loading');
      el.classList.add('error');
      el.textContent = 'erro';
    });
  }
}

document.addEventListener('DOMContentLoaded', render);