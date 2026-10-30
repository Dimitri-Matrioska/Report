"""
instalar_projeto.py — Cria todos os arquivos do projeto BI HTML
Roda uma vez: python instalar_projeto.py
"""

import os
import textwrap

RAIZ = os.path.dirname(os.path.abspath(__file__))

ARQUIVOS = {}

# ============================================================
# assets/config.js
# ============================================================
ARQUIVOS["assets/config.js"] = """\
const BASE_URL = '../dados';
"""

# ============================================================
# assets/pbi.js
# ============================================================
ARQUIVOS["assets/pbi.js"] = """\
const FUNCOES = {
  0: (a) => a.length,
  1: (a) => a.length ? Math.min(...a) : 0,
  2: (a) => a.length ? Math.max(...a) : 0,
  3: (a) => a.length ? a.reduce((x,y)=>x+y,0) / a.length : 0,
  4: (a) => a.reduce((x,y)=>x+y, 0),
  5: (a) => new Set(a).size
};
function agregar(valores, funcCode) {
  const limpos = valores.filter(v => v !== null && v !== undefined && !isNaN(v));
  return (FUNCOES[funcCode] || FUNCOES[4])(limpos);
}
const fmt = {
  pct: (v) => (Number(v) || 0).toLocaleString('pt-BR', {minimumFractionDigits:1, maximumFractionDigits:1}) + '%',
  num: (v) => (Number(v) || 0).toLocaleString('pt-BR', {minimumFractionDigits:1, maximumFractionDigits:1}),
  int: (v) => Math.round(Number(v) || 0).toString()
};
function ultimaDataCom(dados, campo) {
  const comValor = dados.filter(d => d[campo] !== null && d[campo] !== undefined);
  if (!comValor.length) return null;
  return comValor.map(d => d.data).sort().pop();
}
function maxDe(dados, campo) {
  const valores = dados.map(d => d[campo]).filter(v => v !== null && v !== undefined && !isNaN(v));
  return valores.length ? Math.max(...valores) : 0;
}
function filtrarPorMes(dados, mes) {
  return dados.filter(d => d.mes === mes);
}
"""

# ============================================================
# assets/charts.js
# ============================================================
ARQUIVOS["assets/charts.js"] = """\
const TEMA_PBI = {
  fontFamily: '"Segoe UI", helvetica, arial, sans-serif',
  textColor: '#252423',
  corFundo: '#FFFFFF',
  corGrid: '#E8E8E8',
  cores: [
    '#118DFF', '#12239E', '#E66C37', '#6B007B', '#E044A7',
    '#744EC2', '#D9B300', '#D64550', '#197278', '#1AAB40'
  ]
};
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
      axisLabel: { fontSize: 9, color: TEMA_PBI.textColor, fontFamily: TEMA_PBI.fontFamily }
    },
    yAxis: { type: 'value', show: false, splitLine: { show: false } },
    series: series.map(s => ({
      name: s.nome,
      type: 'bar',
      data: s.dados,
      itemStyle: { color: s.cor },
      barGap: '10%',
      barCategoryGap: '30%',
      label: {
        show: true, position: 'top', fontSize: 8, color: TEMA_PBI.textColor,
        fontFamily: TEMA_PBI.fontFamily, formatter: (p) => p.value || ''
      }
    }))
  });
  window.addEventListener('resize', () => chart.resize());
  return chart;
}
const MESES_ABREV = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
function formatarMes(mesIso) {
  if (!mesIso) return '';
  const d = new Date(mesIso + 'T00:00:00');
  return MESES_ABREV[d.getMonth()] + '/' + String(d.getFullYear()).slice(-2);
}
"""

# ============================================================
# assets/sidebar.js
# ============================================================
ARQUIVOS["assets/sidebar.js"] = """\
const MENU_ITENS = [
  { id: 'stma',                  label: 'STMA' },
  { id: 'performance-semanal',   label: 'PERFORMANCE SEMANAL' },
  { id: 'mapa-avanco',           label: 'MAPA AVANÇO' },
  { id: 'mapa-avanco-drenagem',  label: 'MAPA AVANÇO DRENAGEM' },
  { id: 'pluviometria',          label: 'PLUVIOMETRIA' },
];
function renderSidebar() {
  const path = window.location.pathname.toLowerCase();
  const atual = MENU_ITENS.find(m => path.includes(m.id));
  const menuHtml = MENU_ITENS.map(m => {
    const ativo = atual && atual.id === m.id ? ' active' : '';
    return '<a href="./' + m.id + '.html" class="' + ativo.trim() + '">' + m.label + '</a>';
  }).join('');
  return '<aside class="sidebar">' +
    '<div class="sidebar-logo">' +
      '<img src="../imagens/logo-boticario.png" alt="Grupo Boticario" class="logo-img-boticario">' +
      '<div class="logo-sub">PROJETO AFRODITE</div>' +
    '</div>' +
    '<div class="sidebar-titles">' +
      '<div class="titulo">PERFORMANCE<br>CONTRATADAS</div>' +
    '</div>' +
    '<div class="sidebar-filtros">' +
      '<label class="filtro-label">Contratada</label>' +
      '<select class="filtro-select"><option>TERRAM ENGENHARI...</option></select>' +
      '<label class="filtro-label">Ano, Mês</label>' +
      '<select class="filtro-select"><option>2026 (Ano) + outubr...</option></select>' +
      '<label class="filtro-label">SemanaDoProjeto</label>' +
      '<select class="filtro-select"><option>31</option></select>' +
    '</div>' +
    '<nav class="sidebar-menu">' + menuHtml + '</nav>' +
    '<div class="sidebar-footer">' +
      '<img src="../imagens/logo-afry.png" alt="AFRY" class="logo-img-afry">' +
    '</div>' +
  '</aside>';
}
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('sidebar-container');
  if (container) container.outerHTML = renderSidebar();
});
"""

# ============================================================
# assets/style.css
# ============================================================
ARQUIVOS["assets/style.css"] = """\
:root {
  --pbi-foreground: #252423;
  --pbi-background: #FFFFFF;
  --pbi-accent: #118DFF;
  --pbi-good: #1AAB40;
  --pbi-bad: #D64550;
  --pbi-azul-escuro: #0B1F3A;
  --pbi-sidebar-fundo: #0B1F3A;
  --pbi-sidebar-borda: #4a6fa5;
  --pbi-botao-ativo: #3a2a20;
  --fonte-principal: "Segoe UI", helvetica, arial, sans-serif;
}
* { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0; background: #f3f2f1;
  font-family: var(--fonte-principal);
  min-height: 100vh; overflow: hidden;
}
/* O body centraliza o canvas (caso o canvas esteja solto no body).
   Para paginas com .app > .report-area, a centralizacao fica no .app. */
body { display: flex; justify-content: center; align-items: center; overflow: auto; }
.app { display: flex; width: 100vw; height: 100vh; }
.sidebar {
  width: 230px; flex-shrink: 0; background: var(--pbi-sidebar-fundo);
  color: #ffffff; display: flex; flex-direction: column;
  padding: 20px 16px; overflow-y: auto;
}
.sidebar-logo { text-align: center; margin-bottom: 18px; }
.sidebar-logo .logo-img-boticario {
  max-width: 180px; width: 100%; height: auto;
  display: block; margin: 0 auto 8px auto;
}
.sidebar-logo .logo-sub {
  font-size: 10px; color: #b8c4d9; letter-spacing: 2px; text-transform: uppercase;
}
.sidebar-titles { text-align: center; margin-bottom: 20px; }
.sidebar-titles .titulo {
  font-size: 13px; font-weight: 700; color: #ffffff;
  letter-spacing: 0.5px; line-height: 1.3;
}
.sidebar-filtros { margin-bottom: 18px; }
.sidebar-filtros .filtro-label {
  display: block; font-size: 10px; color: #b8c4d9;
  margin-bottom: 4px; margin-top: 12px;
}
.filtro-select {
  width: 100%; background: var(--pbi-sidebar-fundo);
  border: 1px solid var(--pbi-sidebar-borda); color: #ffffff;
  padding: 8px 10px; border-radius: 2px; font-size: 12px; font-family: inherit;
}
.sidebar-menu { display: flex; flex-direction: column; gap: 8px; flex: 1; }
.sidebar-menu a {
  display: block; padding: 14px 10px; text-align: center;
  background: var(--pbi-sidebar-fundo); border: 1px solid var(--pbi-sidebar-borda);
  color: #ffffff; font-size: 11px; font-weight: 700; letter-spacing: 1px;
  text-transform: uppercase; text-decoration: none; border-radius: 2px;
  line-height: 1.3;
}
.sidebar-menu a:hover { background: #16294a; }
.sidebar-menu a.active { background: var(--pbi-botao-ativo); border-color: var(--pbi-botao-ativo); }
.sidebar-footer { text-align: center; margin-top: 16px; padding-top: 16px; border-top: 1px solid #1a2f4a; }
.sidebar-footer .logo-img-afry { max-width: 90px; width: 100%; height: auto; display: block; margin: 0 auto; opacity: 0.85; }
.report-area {
  flex: 1; background: #d9d9d9; padding: 20px; overflow: auto;
  display: flex; justify-content: center; align-items: center;
}
.canvas-wrapper {
  display: block; flex-shrink: 0;
}
.pbi-canvas {
  position: relative; width: 1280px; height: 720px;
  background: #F2F2F2; border-radius: 4px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.15); overflow: hidden; flex-shrink: 0;
  /* --escala e calculada no JS; zoom escala o canvas inteiro mantendo nitidez */
  --escala: 1;
  zoom: var(--escala);
}
.kpi-flat {
  position: absolute; background: #FFFFFF; padding: 8px 10px;
  display: flex; flex-direction: column; justify-content: center;
  align-items: center; text-align: center; border-radius: 3px;
}
.kpi-flat .kpi-label {
  font-size: 9pt; color: var(--pbi-foreground); margin-bottom: 4px;
  line-height: 1; font-weight: 600;
}
.kpi-flat .kpi-value { font-size: 22pt; font-weight: 600; color: var(--pbi-foreground); line-height: 1; }
.kpi-flat .kpi-value.negative { color: var(--pbi-bad); }
.kpi-bordered {
  position: absolute; background: #FFFFFF; border: 1px solid #e0e0e0;
  padding: 5px; display: flex; align-items: stretch; border-radius: 3px;
}
.kpi-bordered .kpi-accent { width: 3px; background: var(--pbi-accent); margin-right: 6px; flex-shrink: 0; }
.kpi-bordered .kpi-content {
  flex: 1; display: flex; flex-direction: column; justify-content: center;
  align-items: center; text-align: center; min-width: 0;
}
.kpi-bordered .kpi-label { font-size: 8pt; color: #605e5c; line-height: 1.1; margin-bottom: 2px; }
.kpi-bordered .kpi-value { font-size: 10pt; font-weight: 600; color: var(--pbi-foreground); }
.faixa-azul {
  position: absolute; background: var(--pbi-azul-escuro); color: #ffffff;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 600; letter-spacing: 1.5px;
  text-transform: uppercase; border-radius: 2px;
  font-family: "DIN", "Segoe UI", sans-serif;
}
.loading { color: #a0a0a0 !important; font-weight: 400 !important; }
.error { color: var(--pbi-bad) !important; font-size: 8pt !important; }
.mock-banner {
  position: absolute; top: 0; left: 0; background: #fff4ce; color: #8a6d00;
  font-size: 11px; padding: 4px 10px; z-index: 9999; display: none;
}
"""

# ============================================================
# paginas/performance-semanal.css
# ============================================================
ARQUIVOS["paginas/performance-semanal.css"] = """\
.pbi-canvas {
  background-image: url('../imagens/fundo-performance-semanal.jpg');
  background-size: 1280px 720px;
  background-repeat: no-repeat;
  background-position: center;
}
#kpi-previsto        { left: 252.38px; top: 37.49px; width: 136.67px; height: 67.51px; }
#kpi-real            { left: 404.69px; top: 35.85px; width: 136.67px; height: 67.51px; }
#kpi-desvio          { left: 557.01px; top: 35.85px; width: 136.67px; height: 67.51px; }
#kpi-mm-acum         { left: 944.22px; top: 158.12px; width: 150px; height: 50px; }
#kpi-dias-impactados { left: 1103.94px; top: 157.83px; width: 150.74px; height: 50px; }
#faixa-curva-fisica  { left: 245px;    top: 120px;   width: 697px;    height: 20px; }
#faixa-pluviometria  { left: 942.56px; top: 12px;    width: 308.57px; height: 16px; }
#chart-pluviometria {
  position: absolute;
  left: 942.56px;
  top: 28.37px;
  width: 308.57px;
  height: 130.34px;
}
"""

# ============================================================
# paginas/performance-semanal.js
# ============================================================
ARQUIVOS["paginas/performance-semanal.js"] = """\
const MES_ALVO = '2026-10-31';
async function carregarDados() {
  const v = Date.now();
  const [pluv, fisico] = await Promise.all([
    fetch(BASE_URL + '/pluviometria.json?v=' + v).then(r => r.json()),
    fetch(BASE_URL + '/fisico_total.json?v=' + v).then(r => r.json())
  ]);
  return { pluv, fisico };
}
function calcMmAcum(pluv) { return maxDe(filtrarPorMes(pluv, MES_ALVO), 'mm_acum'); }
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
function calcDesvio(fisico) { return calcReal(fisico) - calcPrevisto(fisico); }
function montarGraficoPluviometria(pluv) {
  const meses = [...new Set(pluv.map(d => d.mes))].filter(m => m !== null).sort();
  const dadosHist = meses.map(mes => maxDe(filtrarPorMes(pluv, mes), 'historica_acum') || 0);
  const dadosReal = meses.map(mes => maxDe(filtrarPorMes(pluv, mes), 'mm_acum') || 0);
  const labels = meses.map(formatarMes);
  renderBarChartAgrupado('chart-pluviometria', labels, [
    { nome: 'Historica acum', dados: dadosHist, cor: TEMA_PBI.cores[1] },
    { nome: 'Real acum',      dados: dadosReal, cor: TEMA_PBI.cores[0] }
  ]);
}
async function render() {
  try {
    const { pluv, fisico } = await carregarDados();
    const previsto = calcPrevisto(fisico);
    const real = calcReal(fisico);
    const desvio = calcDesvio(fisico);
    const kpis = {
      previsto: fmt.pct(previsto),
      real: fmt.pct(real),
      desvio: fmt.pct(desvio),
      mm_acum: fmt.int(calcMmAcum(pluv)),
      dias_impactados: fmt.int(calcDiasImpactados(pluv))
    };
    document.querySelectorAll('[data-kpi]').forEach(el => {
      const k = el.getAttribute('data-kpi');
      el.classList.remove('loading');
      el.textContent = kpis[k] || '-';
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
  ajustarEscalaCanvas();
  render();
});
const CANVAS_LARGURA = 1280;
const CANVAS_ALTURA  = 720;
const ESCALA_MARGEM  = 40;
const ESCALA_MAXIMA  = 2.0;
const ESCALA_MINIMA  = 0.2;
function ajustarEscalaCanvas() {
  const canvas = document.getElementById('pbiCanvas');
  if (!canvas) return;
  const larguraUtil = window.innerWidth  - ESCALA_MARGEM;
  const alturaUtil  = window.innerHeight - ESCALA_MARGEM;
  let escala = Math.min(larguraUtil / CANVAS_LARGURA, alturaUtil / CANVAS_ALTURA);
  escala = Math.max(ESCALA_MINIMA, Math.min(ESCALA_MAXIMA, escala));
  canvas.style.setProperty('--escala', escala);
}
let _resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(ajustarEscalaCanvas, 100);
});
"""

# ============================================================
# paginas/performance-semanal.html
# ============================================================
ARQUIVOS["paginas/performance-semanal.html"] = """\
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>PERFORMANCE SEMANAL</title>
<link rel="stylesheet" href="../assets/style.css">
<link rel="stylesheet" href="performance-semanal.css">
<script src="https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"></script>
</head>
<body>
<div class="app">
  <div id="sidebar-container"></div>
  <main class="report-area">
    <div class="canvas-wrapper" id="canvasWrapper">
    <div class="pbi-canvas" id="pbiCanvas">
      <div class="mock-banner" id="mockBanner">Mock</div>
      <div class="faixa-azul" id="faixa-curva-fisica">CURVA FISICA - MES</div>
      <div class="faixa-azul" id="faixa-pluviometria">PLUVIOMETRIA HISTORICA X REAL (mm)</div>
      <div id="chart-pluviometria"></div>
      <div class="kpi-flat" id="kpi-previsto">
        <div class="kpi-label">AVANCO PREVISTO</div>
        <div class="kpi-value loading" data-kpi="previsto">...</div>
      </div>
      <div class="kpi-flat" id="kpi-real">
        <div class="kpi-label">AVANCO REAL</div>
        <div class="kpi-value loading" data-kpi="real">...</div>
      </div>
      <div class="kpi-flat" id="kpi-desvio">
        <div class="kpi-label">DESVIO</div>
        <div class="kpi-value loading" data-kpi="desvio">...</div>
      </div>
      <div class="kpi-bordered" id="kpi-mm-acum">
        <div class="kpi-accent"></div>
        <div class="kpi-content">
          <div class="kpi-label">mm acum no mes</div>
          <div class="kpi-value loading" data-kpi="mm_acum">...</div>
        </div>
      </div>
      <div class="kpi-bordered" id="kpi-dias-impactados">
        <div class="kpi-accent"></div>
        <div class="kpi-content">
          <div class="kpi-label">Dias impactados</div>
          <div class="kpi-value loading" data-kpi="dias_impactados">...</div>
        </div>
      </div>
    </div>
  </main>
</div>
<script src="../assets/config.js"></script>
<script src="../assets/pbi.js"></script>
<script src="../assets/charts.js"></script>
<script src="../assets/sidebar.js"></script>
<script src="performance-semanal.js"></script>
</body>
</html>
"""

# ============================================================
# EXECUÇÃO
# ============================================================
def criar():
    print(f"Criando arquivos em: {RAIZ}\n")
    for relativo, conteudo in ARQUIVOS.items():
        caminho = os.path.join(RAIZ, relativo)
        os.makedirs(os.path.dirname(caminho), exist_ok=True)
        with open(caminho, "w", encoding="utf-8", newline="\n") as f:
            f.write(conteudo)
        print(f"  [OK] {relativo}")
    print("\nTodos os arquivos foram criados/sobrescritos.")
    print("\nAgora rode:")
    print("  python -m http.server 8000")
    print("  Abra http://localhost:8000/paginas/performance-semanal.html")

if __name__ == "__main__":
    criar()
