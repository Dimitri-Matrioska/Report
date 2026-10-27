let DADOS = { pluviometria: [] };
let FILTROS = { mes: null };
const CHARTS = {};
const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

function mesLabel(m) { if(!m) return ''; const [a, mes] = m.split('-'); return MESES[parseInt(mes,10)-1] + '/' + a.slice(2); }
function mesValor(m) { if(!m) return ''; const [a, mes] = m.split('-'); return a + ' (Ano) + ' + MESES[parseInt(mes,10)-1]; }
function fmtNum(v) { return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
function fmtInt(v) { return Math.round(Number(v) || 0).toString(); }

// ==========================================
// SISTEMA DE FILTROS (Dropdown)
// ==========================================
function toggleDropdown(id) {
  document.querySelectorAll('.dropdown-menu').forEach(el => { if (el.id !== id) el.classList.remove('active'); });
  document.getElementById(id).classList.toggle('active');
}

// Fecha dropdown ao clicar fora
document.addEventListener('click', function(event) {
  if (!event.target.closest('.sidebar-select') && !event.target.closest('.dropdown-menu')) {
    document.querySelectorAll('.dropdown-menu').forEach(el => el.classList.remove('active'));
  }
});

function popularFiltros() {
  const meses = [...new Set(DADOS.pluviometria.map(d => d.mes))].sort();
  const anos = [...new Set(meses.map(m => m.split('-')[0]))];
  const dropMes = document.getElementById('drop-mes');
  dropMes.innerHTML = '';
  
  anos.forEach(ano => {
    const grupo = document.createElement('div');
    grupo.innerHTML = `
      <div class="dropdown-group-title" onclick="this.nextElementSibling.classList.toggle('active')">${ano} <span>▾</span></div>
      <div class="dropdown-group-items" id="meses-${ano}"></div>
    `;
    const containerMeses = grupo.querySelector(`#meses-${ano}`);
    meses.filter(m => m.startsWith(ano)).forEach(m => {
      const label = document.createElement('label');
      label.className = 'dropdown-item';
      label.innerHTML = `<input type="checkbox" value="${m}" onchange="filtrarMes(this)"> ${mesLabel(m)}`;
      containerMeses.appendChild(label);
    });
    dropMes.appendChild(grupo);
  });

  // Inicia no último mês disponível (ex: Outubro de 2026)
  FILTROS.mes = meses[meses.length - 1];
  document.getElementById('txt-mes').textContent = mesValor(FILTROS.mes);
  
  const cbMes = document.querySelector(`#drop-mes input[value="${FILTROS.mes}"]`);
  if (cbMes) cbMes.checked = true;
}

function filtrarMes(el) {
  FILTROS.mes = el.checked ? el.value : null;
  document.getElementById('txt-mes').textContent = el.checked ? mesValor(el.value) : 'Todos';
  document.querySelectorAll('#drop-mes input').forEach(cb => { if (cb !== el) cb.checked = false; });
  atualizar();
}

// ==========================================
// RENDERIZAÇÃO DOS DADOS
// ==========================================
function setKPI(k, v) {
  const el = document.querySelector(`[data-kpi="${k}"]`);
  if(el) { el.classList.remove('loading'); el.textContent = v; }
}

function render_KPIs() {
  const dadosMes = DADOS.pluviometria.filter(d => d.mes === FILTROS.mes);
  
  // 1. mm acum no mês
  const ultimoDia = dadosMes.filter(d => d.mm_acum !== null).pop();
  const mmAcum = ultimoDia ? ultimoDia.mm_acum : 0;
  
  // 2. Média mm/dia
  const diasComHistorico = dadosMes.filter(d => d.historica_media !== null);
  let mediaHist = 0;
  if (diasComHistorico.length > 0) {
      mediaHist = diasComHistorico.reduce((acc, curr) => acc + Number(curr.historica_media), 0) / diasComHistorico.length;
  }
  
  // 3. Dias impactados
  const diasImpactados = dadosMes.filter(d => d.dia_paralisado === 'sim').length;

  setKPI('mm_acum_mes', fmtInt(mmAcum));
  setKPI('media_mm_dia', fmtNum(mediaHist).replace('.', ','));
  setKPI('dias_impactados', fmtInt(diasImpactados));
}

function render_GraficoHistorico() {
  const dadosHist = DADOS.pluviometria.filter(d => d.historica_acum !== null).sort((a,b) => a.data.localeCompare(b.data));
  
  const labels = dadosHist.map(d => mesLabel(d.mes));
  const valHist = dadosHist.map(d => d.historica_acum);
  const valReal = dadosHist.map(d => d.mm_acum || 0);

  CHARTS['historico'] = CHARTS['historico'] || echarts.init(document.getElementById('chart-pluvio-historico'));
  CHARTS['historico'].setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { bottom: 0, icon: 'circle', itemGap: 15, textStyle: { fontSize: 10, color: '#605e5c' } },
    grid: { left: 30, right: 20, top: 20, bottom: 40, containLabel: true },
    xAxis: { 
      type: 'category', data: labels, 
      axisLabel: { fontSize: 9, color: '#605e5c' }, axisTick: { show: false }, axisLine: { lineStyle: { color: '#dcdcda' } }
    },
    yAxis: { type: 'value', show: false },
    series: [
      { name: 'Histórica acum', type: 'bar', data: valHist, itemStyle: { color: '#001d37' }, barMaxWidth: 15 },
      { name: 'Real acum', type: 'bar', data: valReal, itemStyle: { color: '#2750ec' }, barMaxWidth: 15 }
    ]
  }, true);
}

function render_GraficoMes() {
  const dadosMes = DADOS.pluviometria.filter(d => d.mes === FILTROS.mes).filter(d => d.mm_dia !== null);
  
  const labels = dadosMes.map(d => d.data.slice(8, 10) + '/' + d.data.slice(5, 7));
  const valReal = dadosMes.map(d => d.mm_dia || 0);
  const valHistorica = dadosMes.map(d => d.historica_media || 0);

  CHARTS['mes'] = CHARTS['mes'] || echarts.init(document.getElementById('chart-pluvio-mes'));
  CHARTS['mes'].setOption({
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, icon: 'circle', itemGap: 15, textStyle: { fontSize: 10, color: '#605e5c' } },
    grid: { left: 20, right: 20, top: 20, bottom: 40, containLabel: true },
    xAxis: { 
      type: 'category', data: labels, 
      axisLabel: { fontSize: 9, color: '#605e5c', interval: 0, rotate: 45 }, axisTick: { show: false }, axisLine: { lineStyle: { color: '#dcdcda' } } 
    },
    yAxis: { type: 'value', show: false },
    series: [
      { 
        name: 'mm/dia', type: 'line', data: valReal, smooth: false, 
        areaStyle: { color: 'rgba(0, 29, 55, 0.2)' },
        lineStyle: { color: '#001d37', width: 2 }, itemStyle: { color: '#001d37' }, symbol: 'circle', symbolSize: 4
      },
      { 
        name: 'Histórica média', type: 'line', data: valHistorica, smooth: false, 
        lineStyle: { color: '#a0a0a0', width: 2, type: 'dashed' }, itemStyle: { color: '#a0a0a0' }, symbol: 'none'
      }
    ]
  }, true);
}

function render_Calendario() {
  const dadosMes = DADOS.pluviometria.filter(d => d.mes === FILTROS.mes);
  const dadosHeatmap = [];
  
  // Encontra a semana do primeiro dia
  let semanaIndex = 0;
  let diaAnterior = 0;

  dadosMes.forEach(item => {
    const dia = parseInt(item.data.slice(8, 10), 10);
    const dataObj = new Date(item.data + 'T00:00:00');
    const diaSemana = dataObj.getDay(); 

    if (dia < diaAnterior) semanaIndex++; 
    diaAnterior = dia;

    const valorChuva = item.mm_dia || 0;
    const textoDia = dia.toString();
    
    dadosHeatmap.push({
      value: [diaSemana, semanaIndex, valorChuva],
      dia: textoDia,
      paralisado: item.dia_paralisado === 'sim',
      itemStyle: item.dia_paralisado === 'sim' ? { borderColor: '#ff0000', borderWidth: 2 } : {}
    });
  });

  CHARTS['calendario'] = CHARTS['calendario'] || echarts.init(document.getElementById('chart-calendario'));
  CHARTS['calendario'].setOption({
    tooltip: {
      formatter: function (params) {
        const val = params.value[2];
        return `Dia ${params.data.dia}<br/>Chuva: ${val} mm<br/>Paralisado: ${params.data.paralisado ? 'Sim' : 'Não'}`;
      }
    },
    grid: { top: 30, left: 30, right: 20, bottom: 20 },
    xAxis: {
      type: 'category', data: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
      splitArea: { show: true }, axisLabel: { fontSize: 9, color: '#605e5c' }
    },
    yAxis: {
      type: 'category', data: ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5'],
      splitArea: { show: true }, axisLabel: { show: false }
    },
    visualMap: {
      min: 0, max: 80, show: false,
      inRange: { color: ['#f3f0eb', '#ffbe83', '#e66c37', '#d64550'] }
    },
    series: [{
      name: 'Calendário', type: 'heatmap', data: dadosHeatmap,
      label: { show: true, formatter: (params) => params.data.dia, fontSize: 10, color: '#252423' },
      itemStyle: { borderColor: '#fff', borderWidth: 1 }
    }]
  }, true);
}

function atualizar() {
  render_KPIs();
  render_GraficoHistorico();
  render_GraficoMes();
  render_Calendario();
}

async function carregarDados() {
  const v = Date.now();
  // Usa a variável BASE_URL se ela existir no seu config.js, senão tenta o caminho relativo
  const url = typeof BASE_URL !== 'undefined' ? BASE_URL + '/pluviometria.json?v=' + v : 'pluviometria.json?v=' + v;
  const res = await fetch(url);
  return await res.json();
}

async function render_() {
  try {
    DADOS.pluviometria = await carregarDados();
    popularFiltros();
    atualizar();
    
    // Responsividade
    window.addEventListener('resize', () => Object.values(CHARTS).forEach(c => c && c.resize()));
  } catch (err) {
    console.error("Erro ao carregar dados:", err);
    document.querySelectorAll('.kpi-value').forEach(el => el.textContent = "Erro");
  }
}

document.addEventListener('DOMContentLoaded', render_);