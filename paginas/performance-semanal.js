/* ============================================================
   PERFORMANCE SEMANAL — página executável (piloto)
   ------------------------------------------------------------
   Filtros interativos:
     - Contratada        (coluna: contratada do fisico_total.json)
     - Ano, Mês          (coluna: mes do fisico_total.json)
     - SemanaDoProjeto   (coluna: semana do fisico_total.json)
   Ao mudar qualquer filtro, KPIs e gráficos são recalculados.
   ============================================================ */

let DADOS = { fisico: [], pluviometria: [] };
let FILTROS = { contratada: null, mes: null, semana: null };
const CHARTS = {};

// Defaults conforme o relatório vigente (PBIP / PDF):
// Contratada=TERRAM, Ano/Mês=2026+outubro, SemanaDoProjeto=31
const DEF_CONTRATADA = 'TERRAM';
const DEF_MES = '2026-10-31';
const DEF_SEMANA = 31;

const MESES = ['janeiro','fevereiro','março','abril','maio','junho',
               'julho','agosto','setembro','outubro','novembro','dezembro'];

function mesLabel(mesIso) {
  if (!mesIso) return '';
  const [a, m] = mesIso.split('-');
  return MESES[parseInt(m, 10) - 1] + '/' + a.slice(2);
}
function mesValor(mesIso) {
  if (!mesIso) return '';
  const [a, m] = mesIso.split('-');
  return a + ' (Ano) + ' + MESES[parseInt(m, 10) - 1];
}
function abrevia(texto, max) {
  if (!texto) return '';
  return texto.length > max ? texto.slice(0, max - 1) + '…' : texto;
}
function fmtPct(v) {
  return ((Number(v) || 0) * 100).toLocaleString('pt-BR',
    { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
}
function fmtInt(v) { return Math.round(Number(v) || 0).toLocaleString('pt-BR'); }

function fisicoFiltrado() {
  return DADOS.fisico.filter(d =>
    (FILTROS.contratada === null || d.contratada === FILTROS.contratada) &&
    (FILTROS.mes === null || d.mes === FILTROS.mes) &&
    (FILTROS.semana === null || Number(d.semana) === Number(FILTROS.semana))
  );
}
/* Pluviometria do mês selecionado (independente da semana):
   usada pelos KPIs "mm acum no mês" e "Dias impactados". */
function pluvioDoMes() {
  return DADOS.pluviometria.filter(d =>
    (FILTROS.mes === null || d.mes === FILTROS.mes)
  );
}
/* Pluviometria do período (mês + semana) — quando precisar da semana. */
function pluvioFiltrado() {
  return DADOS.pluviometria.filter(d =>
    (FILTROS.mes === null || d.mes === FILTROS.mes) &&
    (FILTROS.semana === null || Number(d.semana) === Number(FILTROS.semana))
  );
}

function renderKPIs() {
  const rows = fisicoFiltrado();       // avanço/desvio: mês + semana
  const pluv = pluvioDoMes();          // mm/dias: mês inteiro

  const prev = rows.length ? Math.max(...rows.map(d => Number(d.baseline_1_acum) || 0)) : 0;
  const real = rows.length ? Math.max(...rows.map(d => Number(d.real_acum) || 0)) : 0;
  const desv = real - prev;
  const mmAcum = pluv.length ? Math.max(...pluv.map(d => Number(d.mm_acum) || 0)) : 0;
  // Dias impactados = valores distintos não nulos de 'dia paralisado?' no mês
  const diasImp = new Set(
    pluv.filter(d => d.dia_paralisado !== null &&
                     d.dia_paralisado !== undefined &&
                     d.dia_paralisado !== '')
        .map(d => d.data)
  ).size;

  setKPI('22e35e93', fmtPct(prev));
  setKPI('6b304c5c', fmtPct(real));
  setKPI('02f6851e', (desv >= 0 ? '' : '-') + fmtPct(Math.abs(desv)));
  setKPI('01b213fc', fmtInt(mmAcum) + ' mm');
  setKPI('613f2719', fmtInt(diasImp));
}

function setKPI(vid, valor) {
  const el = document.querySelector('[data-kpi="' + vid + '"]');
  if (!el) return;
  el.classList.remove('loading');
  el.textContent = valor;
}

function renderGraficos() {
  renderCurvaMensal();
  renderCurvaS1();
  renderAderencia();
  renderPluvioCurto();
}

/* ============================================================
   Tabelas de texto (Status Semanal.Descrição)
   Os dados não vêm de dados/*.json (tabela Status Semanal não
   foi exportada). Por ora usamos o conteúdo do relatório vigente
   (PDF). Substituir por fetch(BASE_URL+'/status_semanal.json')
   quando o export existir.
   ============================================================ */
const TEXTOS = {
  highlights: [
    'Recebimento de pleito de postergação de prazo do Contrato de Terraplanagem. Solicitado extensão de 87 dias, levando o final das atividades de 10/04/2027 para 06/07/2027. Em andamento análise de mérito pela AFRY.',
    'Recebimento de planilha de Reequilíbrio do Contrato de Terraplanagem contemplando: (i) redução da drenagem profunda (ii) encaminhamento de drenagem para a APP (iii) dispositivos de drenagem provisória para o terreno (iiii) ampliação do prazo nos itens de indireto em 87 dias. Em andamento análise de mérito pela AFRY.'
  ],
  atencao: [
    'Morosidade na recomposição dos tapumes danificados pós chuvas intensas. Solicitado tratativas para a Terram desde 01/09/26.',
    'Manutenção da drenagem provisória para garantir encaminhamento das águas das chuvas.'
  ],
  proximos: [
    'Término da recomposição dos tapumes.'
  ]
};

function renderTabelasTexto() {
  preencherTabela('table-b7008cbc', 'TERRAM', TEXTOS.highlights);
  preencherTabela('table-9f78ce2d', 'TERRAM', TEXTOS.atencao);
  preencherTabela('table-12e44aa3', 'TERRAM', TEXTOS.proximos);
}

function preencherTabela(id, responsavel, itens) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = '';
  if (!itens.length) return;
  const ul = document.createElement('div');
  ul.style.padding = '6px 8px';
  ul.innerHTML = '<div style="font-weight:700;font-size:8pt;margin-bottom:3px">' +
    responsavel + ':</div>' +
    itens.map(t => '<div style="font-size:8pt;line-height:1.25;margin-bottom:4px">• ' +
      t + '</div>').join('');
  el.appendChild(ul);
}

function renderCurvaMensal() {
  const el = document.getElementById('chart-1ecebfde');
  if (!el) return;
  CHARTS['1ecebfde'] = CHARTS['1ecebfde'] || echarts.init(el);
  const rows = fisicoFiltrado();
  const meses = [...new Set(rows.map(d => d.mes))].sort();
  const prev = [], real = [], tend = [];
  meses.forEach(m => {
    const g = rows.filter(d => d.mes === m);
    prev.push(Math.max(...g.map(d => Number(d.baseline_1_acum) || 0)));
    real.push(Math.max(...g.map(d => Number(d.real_acum) || 0)));
    const ord = g.map(d => Number(d.semana) || 0);
    const ultima = g[ord.indexOf(Math.max(...ord))];
    tend.push(ultima ? Number(ultima.real_acum) || 0 : 0);
  });

  CHARTS['1ecebfde'].setOption({
    grid: { left: 40, right: 16, top: 12, bottom: 30, containLabel: true },
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, itemWidth: 10, itemHeight: 8, textStyle: { fontSize: 8 } },
    xAxis: { type: 'category', data: meses.map(mesLabel),
             axisLabel: { fontSize: 9 }, axisTick: { show: false } },
    yAxis: { type: 'value', show: false },
    /* Cores conforme CY26SU02.json (ThemeDataColor do PBIP):
         Previsto Acum  -> ColorId 2 = #12239E
         Real Acum      -> ColorId 5 = #744EC2
         Tendência Acum -> ColorId 3 = #E66C37 */
    series: [
      { name: 'Previsto Acum', type: 'bar', data: prev, itemStyle: { color: '#12239E' }, barMaxWidth: 12 },
      { name: 'Real Acum', type: 'bar', data: real, itemStyle: { color: '#744EC2' }, barMaxWidth: 12 },
      { name: 'Tendência Acum', type: 'line', data: tend, smooth: true,
        itemStyle: { color: '#E66C37' }, lineStyle: { color: '#E66C37', width: 2 }, symbol: 'circle', symbolSize: 4 }
    ]
  }, true);
}

function renderCurvaS1() {
  const el = document.getElementById('chart-62f295f1');
  if (!el) return;
  CHARTS['62f295f1'] = CHARTS['62f295f1'] || echarts.init(el);
  const rows = fisicoFiltrado().sort((a, b) => (a.data || '').localeCompare(b.data || ''));
  const dias = [], prev = [], real = [], prevAc = [], realAc = [];
  const map = {};
  rows.forEach(d => {
    if (!map[d.data]) map[d.data] = { prev: 0, real: 0, prevAc: 0, realAc: 0 };
    map[d.data].prev += Number(d.baseline_1) || 0;
    map[d.data].real += Number(d.real) || 0;
    map[d.data].prevAc = Math.max(map[d.data].prevAc, Number(d.baseline_1_acum) || 0);
    map[d.data].realAc = Math.max(map[d.data].realAc, Number(d.real_acum) || 0);
  });
  Object.keys(map).sort().forEach(k => {
    dias.push(k.slice(8, 10) + '/' + k.slice(5, 7));
    prev.push(map[k].prev); real.push(map[k].real);
    prevAc.push(map[k].prevAc); realAc.push(map[k].realAc);
  });

  CHARTS['62f295f1'].setOption({
    grid: { left: 40, right: 40, top: 12, bottom: 30, containLabel: true },
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, itemWidth: 10, itemHeight: 8, textStyle: { fontSize: 8 } },
    xAxis: { type: 'category', data: dias, axisLabel: { fontSize: 8 }, axisTick: { show: false } },
    yAxis: [{ type: 'value', show: false }, { type: 'value', show: false }],
    /* Cores conforme CY26SU02.json (via ThemeDataColor do PBIP):
         Previsto / Previsto Acum -> ColorId 2 = #12239E
         Real     / Real Acum     -> ColorId 5 = #744EC2 */
    series: [
      { name: 'Previsto', type: 'bar', data: prev, itemStyle: { color: '#12239E' }, barMaxWidth: 8 },
      { name: 'Real', type: 'bar', data: real, itemStyle: { color: '#744EC2' }, barMaxWidth: 8 },
      { name: 'Previsto Acum', type: 'line', yAxisIndex: 1, data: prevAc, smooth: true,
        itemStyle: { color: '#12239E' }, lineStyle: { color: '#12239E', width: 2 }, symbol: 'circle', symbolSize: 4 },
      { name: 'Real Acum', type: 'line', yAxisIndex: 1, data: realAc, smooth: true,
        itemStyle: { color: '#744EC2' }, lineStyle: { color: '#744EC2', width: 2 }, symbol: 'circle', symbolSize: 4 }
    ]
  }, true);
}

function renderAderencia() {
  const el = document.getElementById('chart-a2d9b88a');
  if (!el) return;
  CHARTS['a2d9b88a'] = CHARTS['a2d9b88a'] || echarts.init(el);
  const rows = fisicoFiltrado();
  const ader = rows.length ? Math.max(...rows.map(d => Number(d.aderencia) || 0)) : 0;

  CHARTS['a2d9b88a'].setOption({
    series: [{
      type: 'gauge', startAngle: 200, endAngle: -20, min: 0, max: 1,
      center: ['50%', '90%'], radius: '120%',
      axisLine: { lineStyle: { width: 9, color: [[1, '#f3f0eb']] } },
      progress: { show: true, width: 9, roundCap: false,
                  itemStyle: { color: '#ff3636' } },
      pointer: { show: false },
      axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false },
      detail: { fontSize: 16, fontWeight: 'bold', offsetCenter: [0, '-22%'],
                formatter: () => fmtPct(ader), color: '#252423' },
      data: [{ value: ader }]
    }]
  }, true);
}

function renderPluvioCurto() {
  const el = document.getElementById('chart-cfaada41');
  if (!el) return;
  CHARTS['cfaada41'] = CHARTS['cfaada41'] || echarts.init(el);
  const pluv = DADOS.pluviometria;
  const meses = [...new Set(pluv.map(d => d.mes))].sort();
  const hist = [], real = [];
  meses.forEach(m => {
    const g = pluv.filter(d => d.mes === m);
    hist.push(Math.max(...g.map(d => Number(d.historica_acum) || 0)));
    real.push(Math.max(...g.map(d => Number(d.mm_acum) || 0)));
  });

  CHARTS['cfaada41'].setOption({
    title: { text: 'PLUVIOMETRIA HISTÓRICA X REAL (mm)', left: 'center', top: 0,
             textStyle: { fontSize: 7.5, fontWeight: 'bold', color: '#252423' } },
    grid: { left: 8, right: 8, top: 34, bottom: 22, containLabel: true },
    tooltip: { trigger: 'axis' },
    legend: { top: 16, itemWidth: 10, itemHeight: 8, textStyle: { fontSize: 8 } },
    xAxis: { type: 'category', data: meses.map(mesLabel),
             axisLabel: { fontSize: 8 }, axisTick: { show: false } },
    yAxis: { type: 'value', show: false },
    series: [
      { name: 'Histórica acum', type: 'bar', data: hist, itemStyle: { color: '#118DFF' }, barMaxWidth: 8 },
      { name: 'Real acum', type: 'bar', data: real, itemStyle: { color: '#12239E' }, barMaxWidth: 8 }
    ]
  }, true);
}

function popularFiltros() {
  const selContr = document.getElementById('sel-contratada');
  const selMes = document.getElementById('sel-mes');
  const selSem = document.getElementById('sel-semana');

  const contratadas = [...new Set(DADOS.fisico.map(d => d.contratada))].sort();
  contratadas.forEach(c => selContr.appendChild(new Option(abrevia(c, 20), c)));
  FILTROS.contratada = contratadas.find(c => c.startsWith(DEF_CONTRATADA)) || contratadas[0] || null;
  selContr.value = FILTROS.contratada;

  const meses = [...new Set(DADOS.fisico.map(d => d.mes))].sort();
  meses.forEach(m => selMes.appendChild(new Option(mesValor(m), m)));
  FILTROS.mes = meses.includes(DEF_MES) ? DEF_MES : (meses[meses.length - 1] || null);
  selMes.value = FILTROS.mes;

  popularSemanas();

  selContr.addEventListener('change', () => {
    FILTROS.contratada = selContr.value;
    atualizar();
  });
  selMes.addEventListener('change', () => {
    FILTROS.mes = selMes.value;
    popularSemanas();
    atualizar();
  });
  selSem.addEventListener('change', () => {
    FILTROS.semana = selSem.value === '' ? null : Number(selSem.value);
    atualizar();
  });
}

function popularSemanas() {
  const selSem = document.getElementById('sel-semana');
  const base = DADOS.fisico.filter(d => FILTROS.mes === null || d.mes === FILTROS.mes);
  const semanas = [...new Set(base.map(d => Number(d.semana)))].sort((a, b) => a - b);
  selSem.innerHTML = '';
  semanas.forEach(s => selSem.appendChild(new Option(s, s)));
  // Semana vigente: a do relatório (DEF_SEMANA) se existir; senão a maior
  FILTROS.semana = semanas.includes(DEF_SEMANA) ? DEF_SEMANA
                   : (semanas[semanas.length - 1] || null);
  if (FILTROS.semana !== null) selSem.value = FILTROS.semana;
}

function atualizar() {
  renderKPIs();
  renderGraficos();
  renderTabelasTexto();
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
    DADOS = await carregarDados();
    popularFiltros();
    atualizar();
    window.addEventListener('resize', () =>
      Object.values(CHARTS).forEach(c => c && c.resize()));
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
