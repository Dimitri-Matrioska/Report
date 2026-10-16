/* ============================================================
   PERFORMANCE-SEMANAL.JS — Lógica específica desta página
   ============================================================ */

const MES_ALVO = '2026-10-31';

async function carregarDados() {
  const v = Date.now();
  const [pluv, fisico] = await Promise.all([
    fetch(`${BASE_URL}/pluviometria.json?v=${v}`).then(r => r.json()),
    fetch(`${BASE_URL}/fisico_total.json?v=${v}`).then(r => r.json())
  ]);
  return { pluv, fisico };
}

function calcMmAcum(pluv) {
  return maxDe(filtrarPorMes(pluv, MES_ALVO), 'mm_acum');
}

function calcDiasImpactados(pluv) {
  return filtrarPorMes(pluv, MES_ALVO).filter(d => d.dia_paralisado === 'sim').length;
}

function calcPrevisto(fisico) {
  const doMes = filtrarPorMes(fisico, MES_ALVO);
  const ultima = ultimaDataCom(doMes, 'real_acum');
  if (!ultima) return 0;
  return maxDe(doMes.filter(d => d.data === ultima), 'baseline_1_acum');
}

function calcReal(fisico) {
  const doMes = filtrarPorMes(fisico, MES_ALVO);
  const ultima = ultimaDataCom(doMes, 'real_acum');
  if (!ultima) return 0;
  return maxDe(doMes.filter(d => d.data === ultima), 'real_acum');
}

function calcDesvio(fisico) {
  return calcReal(fisico) - calcPrevisto(fisico);
}

/* ============================================================
   GRÁFICO — Pluviometria (Histórica vs Real)
   ============================================================ */
function montarGraficoPluviometria(pluv) {
  const meses = [...new Set(pluv.map(d => d.mes))]
    .filter(m => m !== null)
    .sort();

  const dadosHist = meses.map(mes => maxDe(filtrarPorMes(pluv, mes), 'historica_acum') || 0);
  const dadosReal = meses.map(mes => maxDe(filtrarPorMes(pluv, mes), 'mm_acum') || 0);
  const labels = meses.map(formatarMes);

  renderBarChartAgrupado('chart-pluviometria', labels, [
    { nome: 'Histórica acum', dados: dadosHist, cor: TEMA_PBI.cores[1] },  // #12239E
    { nome: 'Real acum',      dados: dadosReal, cor: TEMA_PBI.cores[0] }   // #118DFF
  ]);
}

/* ============================================================
   RENDER PRINCIPAL
   ============================================================ */
async function render() {
  try {
    const { pluv, fisico } = await carregarDados();

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

document.addEventListener('DOMContentLoaded', () => {
  ajustarEscalaCanvas();   // escala ANTES de renderizar (canvas já no tamanho certo)
  render();
});

/* ============================================================
   ESCALA PROPORCIONAL DO CANVAS (16:9)
   ------------------------------------------------------------
   O canvas é desenhado em 1280x720 (projeto). Para preencher a
   janela mantendo exatamente a proporção 16:9 e SEM cortar nada,
   calculamos a maior escala que caiba tanto em largura quanto em
   altura (descontando uma margem). A escala é aplicada via zoom
   (e não transform: scale) no canvas INTEIRO, então KPIs, gráfico
   e faixas escalam juntos, automaticamente — suas posições
   internas em px absolutos não são tocadas.

   Usamos zoom porque ele reflui o layout ANTES de rasterizar,
   mantendo textos e gráficos nítidos. O transform: scale()
   rasterizaria primeiro e depois esticaria, deixando borrado.

   Como o zoom reflui o layout, o .canvas-wrapper não precisa
   reservar dimensões manualmente: o próprio canvas já ocupa o
   tamanho escalado e o flex do body centraliza o conjunto.
   ============================================================ */

const CANVAS_LARGURA = 1280;
const CANVAS_ALTURA  = 720;
const ESCALA_MARGEM  = 40;   // 20px de folga de cada lado
const ESCALA_MAXIMA  = 2.0;  // teto p/ telas muito grandes
const ESCALA_MINIMA  = 0.2;  // piso de segurança

function ajustarEscalaCanvas() {
  const canvas = document.getElementById('pbiCanvas');
  if (!canvas) return;

  // Dimensões úteis da janela (descontando a margem)
  const larguraUtil = window.innerWidth  - ESCALA_MARGEM;
  const alturaUtil  = window.innerHeight - ESCALA_MARGEM;

  // Maior fator que cabe respeitando 16:9 (limita por largura E altura)
  let escala = Math.min(
    larguraUtil / CANVAS_LARGURA,
    alturaUtil  / CANVAS_ALTURA
  );

  // Limita entre mínimo e máximo
  escala = Math.max(ESCALA_MINIMA, Math.min(ESCALA_MAXIMA, escala));

  // Aplica a escala via variável CSS (usada por zoom: var(--escala))
  canvas.style.setProperty('--escala', escala);
}

// Recalcula ao redimensionar a janela (debounce simples)
let _resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(ajustarEscalaCanvas, 100);
});