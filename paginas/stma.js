let DADOS = { fisico: [], desvios: [], stma: [] };
let FILTROS = { contratada: null, mes: null, semana: null };
const CHARTS = {};

const DEF_CONTRATADA = 'TERRAM';
const DEF_MES = '2026-10-31';
const DEF_SEMANA = 31;
const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

function mesLabel(m) { if(!m) return ''; const [a, mes] = m.split('-'); return MESES[parseInt(mes,10)-1] + '/' + a.slice(2); }
function mesValor(m) { if(!m) return ''; const [a, mes] = m.split('-'); return a + ' (Ano) + ' + MESES[parseInt(mes,10)-1]; }
function abrevia(t, max) { return !t ? '' : (t.length > max ? t.slice(0, max-1) + '…' : t); }

// Funções para desvios (usa desvios_stma.json)
const getGravidade = (x) => String(x.potencial_gravidade || x['Potencial de Gravidade'] || x['potencial_de_gravidade'] || 'Indefinido').trim().toLowerCase();
const getData = (x) => x.data || x['Data'] || '';
const getDesc = (x) => x.descricao || x['Descrição'] || x['descricao'] || '-';

// BUSCA ULTRA AGRESSIVA DO TIPO
const getTipo = (x) => {
  // 1. Tenta nomes exatos
  const nomes = ['tp_desvio', 'tipo_desvio', 'Tipo de Desvio', 'Tipo', 'classificacao', 'Classificação'];
  for (const k of nomes) {
    if (x[k] && String(x[k]).trim() !== '' && String(x[k]).trim() !== 'Indefinido') return String(x[k]).trim();
  }
  
  // 2. Se falhar, varre o objeto inteiro buscando algo que pareça com Tipo
  for (const k in x) {
    const kl = k.toLowerCase();
    if ((kl.includes('tp') || kl.includes('tipo') || kl.includes('classif') || kl.includes('categoria'))) {
      const val = String(x[k]).trim();
      if (val !== '' && val !== 'null' && val !== 'undefined') return val;
    }
  }
  
  // 3. DEBUG: Se não achou, cospe no console o objeto inteiro para investigarmos
  console.log("AQUI ESTÁ O OBJETO GRAVE:", x);
  return 'Outro (Vazio)';
};

// ==========================================
// LÓGICA DE FILTRO ACUMULATIVO
// ==========================================
function getDataCorte() {
  if (!FILTROS.mes) return '9999-12-31';
  let base = DADOS.fisico.filter(d => d.mes === FILTROS.mes);
  if (FILTROS.semana) {
    const daSemana = base.filter(d => Number(d.semana) === Number(FILTROS.semana));
    if (daSemana.length > 0) base = daSemana;
  }
  const datas = base.map(d => d.data).filter(d => d).sort();
  return datas.length > 0 ? datas[datas.length - 1] : FILTROS.mes;
}

function getDesviosAcumulados() {
  const dataCorte = getDataCorte();
  return DADOS.desvios.filter(d => {
    const dt = getData(d);
    // TRUQUE: Se a data não existir, assume que entra (para não perder dados)
    if (!dt) return true; 
    return dt <= dataCorte;
  });
}

function getDesviosDoMes() {
  if (!FILTROS.mes) return DADOS.desvios;
  const [anoRef, mesRef] = FILTROS.mes.split('-');
  return DADOS.desvios.filter(d => {
    const dt = getData(d);
    if (!dt) return false;
    const [ano, mes] = dt.split('-');
    return ano === anoRef && mes === mesRef;
  });
}

function render_KPIs() {
  const dAcum = getDesviosAcumulados();
  const dataCorte = getDataCorte();
  
  // Tenta pegar o total oficial do stma.json
  const stmaFiltrado = DADOS.stma.filter(s => {
    const dt = s.data || '';
    return dt && dt <= dataCorte && s.indicador === 'Desvios Registrados (Atos e Condições Inseguras)';
  });
  
  let totalOficial = dAcum.length;
  if (stmaFiltrado.length > 0) {
    totalOficial = Math.max(...stmaFiltrado.map(s => Number(s.resultado)));
  }

  setKPI('dias_seguros', '213');
  setKPI('acid_graves', '0');
  setKPI('acid_leves', '0');
  setKPI('quase_acid', '0');
  setKPI('desvios_total', totalOficial.toString());
  
  // Guarda o número para usar no Donut
  window.TOTAL_OFICIAL = totalOficial;
}

function setKPI(k, v) {
  const el = document.querySelector(`[data-kpi="${k}"]`);
  if(el) { el.classList.remove('loading'); el.textContent = v; }
}

function render_Graficos() {
  const dAcum = getDesviosAcumulados();
  const dMes = getDesviosDoMes();

  // 1. DONUT
  const mapGrav = { grave: 0, leve: 0, moderado: 0 };
  dAcum.forEach(x => {
    const g = getGravidade(x);
    if (mapGrav.hasOwnProperty(g)) mapGrav[g]++;
  });

  const dataDonut = [
    { name: 'Moderado', value: mapGrav['moderado'] || 0, itemStyle: { color: '#ffbe83' } },
    { name: 'Leve', value: mapGrav['leve'] || 0, itemStyle: { color: '#2750ec' } },
    { name: 'Grave', value: mapGrav['grave'] || 0, itemStyle: { color: '#001d37' } }
  ];

  CHARTS['donut'] = CHARTS['donut'] || echarts.init(document.getElementById('chart-donut'));
  CHARTS['donut'].setOption({
    tooltip: { trigger: 'item' },
    title: {
      text: window.TOTAL_OFICIAL.toString(), // Usa o 681 oficial
      left: 'center', top: '38%',
      textStyle: { fontSize: 22, fontWeight: 'bold', color: '#252423' }
    },
    legend: { bottom: 0, icon: 'circle', itemGap: 15, textStyle: { fontSize: 11, color: '#605e5c' } },
    series: [{
      type: 'pie', radius: ['45%', '70%'], center: ['50%', '45%'],
      label: { show: true, position: 'outside', formatter: '{c}', fontSize: 12, color: '#605e5c' },
      labelLine: { length: 15, length2: 10, lineStyle: { color: '#dcdcda' } },
      data: dataDonut
    }]
  }, true);

  // 2. BARRAS HORIZONTAIS
  const mapTipoGrave = {};
  dAcum.filter(x => getGravidade(x) === 'grave').forEach(x => {
    const t = getTipo(x);
    mapTipoGrave[t] = (mapTipoGrave[t] || 0) + 1;
  });
  
  const catHoriz = Object.keys(mapTipoGrave).sort((a,b) => mapTipoGrave[a] - mapTipoGrave[b]);
  const valHoriz = catHoriz.map(k => mapTipoGrave[k]);
  
  CHARTS['barras_horiz'] = CHARTS['barras_horiz'] || echarts.init(document.getElementById('chart-barras_horiz'));
  CHARTS['barras_horiz'].setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 140, right: 40, top: 5, bottom: 5 },
    xAxis: { type: 'value', show: false },
    yAxis: { 
      type: 'category', data: catHoriz, 
      axisLabel: { fontSize: 10, color: '#605e5c' }, 
      axisTick: { show: false }, axisLine: { show: false } 
    },
    series: [{ 
      type: 'bar', data: valHoriz, 
      itemStyle: { color: '#001d37' }, barWidth: 14, 
      label: { show: true, position: 'right', fontSize: 10, fontWeight: 'bold', color: '#252423', distance: 8 } 
    }]
  }, true);

  // 3. LINHA
  const mapMes = {};
  dAcum.filter(x => getGravidade(x) === 'grave').forEach(x => {
    const dt = getData(x);
    if(dt) {
      const m = dt.slice(0, 7) + '-01';
      mapMes[m] = (mapMes[m] || 0) + 1;
    }
  });
  const catLinha = Object.keys(mapMes).sort().map(m => mesLabel(m).split('/')[0]);
  const valLinha = Object.keys(mapMes).sort().map(m => mapMes[m]);
  
  CHARTS['linha'] = CHARTS['linha'] || echarts.init(document.getElementById('chart-linha'));
  CHARTS['linha'].setOption({
    grid: { left: 20, right: 20, top: 30, bottom: 30, containLabel: true },
    xAxis: { type: 'category', data: catLinha, axisLabel: { fontSize: 10 }, axisTick: { show: false } },
    yAxis: { type: 'value', show: false },
    series: [{ 
      type: 'line', data: valLinha, smooth: false, 
      lineStyle: { color: '#001d37', width: 3 }, itemStyle: { color: '#001d37' },
      symbol: 'circle', symbolSize: 6, showSymbol: true,
      label: { show: true, position: 'top', fontSize: 10, fontWeight: 'bold' } 
    }]
  }, true);

  // 4. PIZZA
  CHARTS['pizza'] = CHARTS['pizza'] || echarts.init(document.getElementById('chart-pizza'));
  CHARTS['pizza'].setOption({
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, icon: 'circle', textStyle: { fontSize: 9, color: '#605e5c' }, itemGap: 10 },
    series: [{ 
      type: 'pie', radius: '65%', center: ['50%', '45%'], 
      data: [
        {value: 27, name: 'Concluído', itemStyle: { color: '#22c55e' }}, 
        {value: 1, name: 'Andamento', itemStyle: { color: '#f59e0b' }}
      ], 
      label: { show: true, fontSize: 10, formatter: '{c}', position: 'outside' },
      labelLine: { length: 5, length2: 5 }
    }]
  }, true);

  // 5. BARRAS VERTICAIS
  const mapVigente = {};
  dMes.forEach(x => { 
    const g = getGravidade(x); 
    const nome = g.charAt(0).toUpperCase() + g.slice(1);
    mapVigente[nome] = (mapVigente[nome] || 0) + 1; 
  });
  const catVert = Object.keys(mapVigente);
  const valVert = Object.values(mapVigente);
  
  CHARTS['barras_vert'] = CHARTS['barras_vert'] || echarts.init(document.getElementById('chart-barras_vert'));
  CHARTS['barras_vert'].setOption({
    grid: { left: 20, right: 20, top: 20, bottom: 20, containLabel: true },
    xAxis: { type: 'category', data: catVert, axisLabel: { fontSize: 10 }, axisTick: { show: false } },
    yAxis: { type: 'value', show: false },
    series: [{ 
      type: 'bar', data: valVert, barWidth: 40, 
      itemStyle: { color: '#3b82f6' },
      label: { show: true, position: 'top', fontSize: 10, fontWeight: 'bold' } 
    }]
  }, true);

  renderTabela(dMes);
}

function renderTabela(dMes) {
  const el = document.getElementById('table-descricao');
  if(!el) return;
  const graves = dMes.filter(x => getGravidade(x) === 'grave').slice(0, 5);
  
  let html = '<table style="width:100%;"><thead><tr><th style="font-weight:700;font-size:10pt;padding-bottom:8px;text-align:left;color:#001d37;">Descrição desvios graves do mês - ' + (FILTROS.mes ? mesLabel(FILTROS.mes).split('/')[0].toUpperCase() : '') + '</th><th style="font-weight:700;font-size:10pt;text-align:right;padding-bottom:8px;color:#001d37;">Classificação</th></tr></thead><tbody>';
  graves.forEach(x => {
    html += `<tr>
      <td style="border-bottom:1px solid #dcdcda;padding:8px 0;font-size:8.5pt;line-height:1.4;color:#252423;padding-right:15px;">${getDesc(x)}</td>
      <td style="border-bottom:1px solid #dcdcda;padding:8px 0;font-size:8.5pt;text-align:right;color:#252423;vertical-align:top;">${getTipo(x)}</td>
    </tr>`;
  });
  html += '</tbody></table>';
  el.innerHTML = html;
}

// ==========================================
// LÓGICA DE FILTROS
// ==========================================
function toggleDropdown(id) {
  document.querySelectorAll('.dropdown-menu').forEach(el => { if (el.id !== id) el.classList.remove('active'); });
  document.getElementById(id).classList.toggle('active');
}
document.addEventListener('click', function(event) {
  if (!event.target.closest('.sidebar-select') && !event.target.closest('.dropdown-menu')) {
    document.querySelectorAll('.dropdown-menu').forEach(el => el.classList.remove('active'));
  }
});

function popularFiltros() {
  const contratadas = [...new Set(DADOS.fisico.map(d => d.contratada))].sort();
  const dropContratada = document.getElementById('drop-contratada');
  dropContratada.innerHTML = '';
  contratadas.forEach(c => {
    const label = document.createElement('label');
    label.className = 'dropdown-item';
    label.innerHTML = `<input type="checkbox" value="${c}" onchange="filtrarContratada(this)"> ${abrevia(c, 20)}`;
    dropContratada.appendChild(label);
  });

  const meses = [...new Set(DADOS.fisico.map(d => d.mes))].sort();
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

  FILTROS.contratada = contratadas.find(c => c.startsWith(DEF_CONTRATADA)) || contratadas[0];
  FILTROS.mes = meses.includes(DEF_MES) ? DEF_MES : meses[meses.length - 1];
  
  document.getElementById('txt-contratada').textContent = abrevia(FILTROS.contratada, 20);
  document.getElementById('txt-mes').textContent = mesValor(FILTROS.mes);
  
  const cbContr = document.querySelector(`#drop-contratada input[value="${FILTROS.contratada}"]`);
  if (cbContr) cbContr.checked = true;
  const cbMes = document.querySelector(`#drop-mes input[value="${FILTROS.mes}"]`);
  if (cbMes) cbMes.checked = true;

  popularSemanas();
}

function popularSemanas() {
  const dropSemana = document.getElementById('drop-semana');
  const base = DADOS.fisico.filter(d => FILTROS.mes === null || d.mes === FILTROS.mes);
  const semanas = [...new Set(base.map(d => Number(d.semana)))].sort((a, b) => a - b);
  dropSemana.innerHTML = '';
  semanas.forEach(s => {
    const label = document.createElement('label');
    label.className = 'dropdown-item';
    label.innerHTML = `<input type="checkbox" value="${s}" onchange="filtrarSemana(this)"> ${s}`;
    dropSemana.appendChild(label);
  });
  FILTROS.semana = semanas.includes(DEF_SEMANA) ? DEF_SEMANA : (semanas[semanas.length - 1] || null);
  if (FILTROS.semana !== null) {
    document.getElementById('txt-semana').textContent = FILTROS.semana;
    const cb = document.querySelector(`#drop-semana input[value="${FILTROS.semana}"]`);
    if (cb) cb.checked = true;
  } else { document.getElementById('txt-semana').textContent = '-'; }
}

function filtrarContratada(el) { FILTROS.contratada = el.checked ? el.value : null; document.getElementById('txt-contratada').textContent = el.checked ? abrevia(el.value, 20) : 'Todas'; document.querySelectorAll('#drop-contratada input').forEach(cb => { if (cb !== el) cb.checked = false; }); atualizar(); }
function filtrarMes(el) { FILTROS.mes = el.checked ? el.value : null; document.getElementById('txt-mes').textContent = el.checked ? mesValor(el.value) : 'Todos'; document.querySelectorAll('#drop-mes input').forEach(cb => { if (cb !== el) cb.checked = false; }); popularSemanas(); atualizar(); }
function filtrarSemana(el) { FILTROS.semana = el.checked ? Number(el.value) : null; document.getElementById('txt-semana').textContent = el.checked ? el.value : '-'; document.querySelectorAll('#drop-semana input').forEach(cb => { if (cb !== el) cb.checked = false; }); atualizar(); }

function atualizar() { render_KPIs(); render_Graficos(); }

async function carregarDados() {
  const v = Date.now();
  const [fisico, desvios, stma] = await Promise.all([
    fetch(BASE_URL + '/fisico_total.json?v=' + v).then(r => r.json()).catch(() => []),
    fetch(BASE_URL + '/desvios_stma.json?v=' + v).then(r => r.json()).catch(() => []),
    fetch(BASE_URL + '/stma.json?v=' + v).then(r => r.json()).catch(() => [])
  ]);
  return { fisico, desvios, stma };
}

async function render_() {
  try {
    const dados = await carregarDados();
    DADOS.fisico = dados.fisico;
    DADOS.desvios = dados.desvios;
    DADOS.stma = dados.stma;
    popularFiltros();
    atualizar();
    window.addEventListener('resize', () => Object.values(CHARTS).forEach(c => c && c.resize()));
  } catch (err) { console.error(err); }
}
document.addEventListener('DOMContentLoaded', render_);