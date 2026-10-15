/* ============================================================
   CHARTS.JS — Funções genéricas para ECharts
   ============================================================ */

const TEMA_PBI = {
  fontFamily: '"Segoe UI", helvetica, arial, sans-serif',
  textColor: '#252423',
  corHist: '#0B1F3A',      // azul-marinho (Histórica)
  corReal: '#4A78D6',      // azul-claro (Real)
  corFundo: '#FFFFFF',
  corGrid: '#E8E8E8'
};

/**
 * Cria um gráfico de colunas agrupadas.
 * @param {string} elementoId — id do container no HTML
 * @param {string[]} categorias — labels do eixo X
 * @param {object[]} series — [{ nome, dados, cor }]
 */
function renderBarChartAgrupado(elementoId, categorias, series) {
  const el = document.getElementById(elementoId);
  if (!el) return null;

  const chart = echarts.init(el, null, { renderer: 'canvas' });

  chart.setOption({
    grid: {
      left: 8,
      right: 8,
      top: 24,
      bottom: 24,
      containLabel: false
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' }
    },
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

  // Responsivo: redimensiona quando a janela muda
  window.addEventListener('resize', () => chart.resize());

  return chart;
}