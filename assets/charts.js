/* ============================================================
   CHARTS.JS — Funções genéricas para ECharts
   ============================================================ */

const TEMA_PBI = {
  fontFamily: '"Segoe UI", helvetica, arial, sans-serif',
  textColor: '#252423',
  corFundo: '#FFFFFF',
  corGrid: '#E8E8E8',

  /* Paleta extraída do tema CY26SU02 */
  cores: [
    '#118DFF', '#12239E', '#E66C37', '#6B007B', '#E044A7',
    '#744EC2', '#D9B300', '#D64550', '#197278', '#1AAB40'
  ]
};

/**
 * Cria um gráfico de colunas agrupadas (clusteredColumnChart).
 */
function renderBarChartAgrupado(elementoId, categorias, series) {
  const el = document.getElementById(elementoId);
  if (!el) return null;

  const chart = echarts.init(el, null, { renderer: 'canvas' });

  chart.setOption({
    grid: { left: 8, right: 8, top: 24, bottom: 24, containLabel: false },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: {
      type: 'category',
      data: categorias,
      axisLine: { lineStyle: { color: TEMA_PBI.corGrid } },
      axisTick: { show: false },
      axisLabel: {
        fontSize: 9,
        color: TEMA_PBI.textColor,
        fontFamily: TEMA_PBI.fontFamily
      }
    },
    yAxis: {
      type: 'value',
      show: false,
      splitLine: { show: false }
    },
    series: series.map(s => ({
      name: s.nome,
      type: 'bar',
      data: s.dados,
      itemStyle: { color: s.cor },
      barGap: '10%',
      barCategoryGap: '30%',
      label: {
        show: true,
        position: 'top',
        fontSize: 8,
        color: TEMA_PBI.textColor,
        fontFamily: TEMA_PBI.fontFamily,
        formatter: (p) => p.value || ''
      }
    }))
  });

  window.addEventListener('resize', () => chart.resize());
  return chart;
}

/**
 * Formata um mês ISO ("2026-03-31") como "mar/26".
 */
const MESES_ABREV = ['jan','fev','mar','abr','mai','jun',
                     'jul','ago','set','out','nov','dez'];
function formatarMes(mesIso) {
  if (!mesIso) return '';
  const d = new Date(mesIso + 'T00:00:00');
  const abrev = MESES_ABREV[d.getMonth()];
  const ano = String(d.getFullYear()).slice(-2);
  return `${abrev}/${ano}`;
}