/* ============================================================
   PLUVIOMETRIA — página executável
   ------------------------------------------------------------
   Filtros interativos e leitura do config.json:
     - Contratada        (coluna: contratada do fisico_total.json)
     - Ano, Mês          (coluna: mes do fisico_total.json)
   Ao mudar qualquer filtro, KPIs, gráficos e calendário são recalculados.
   ============================================================ */

function toggleDropdown(id) {
  // Fecha todos os outros
  document.querySelectorAll('.dropdown-menu').forEach(el => {
    if (el.id !== id) el.classList.remove('active');
  });
  // Alterna o atual
  document.getElementById(id).classList.toggle('active');
}

// Fecha dropdown ao clicar fora
document.addEventListener('click', function(event) {
  if (!event.target.closest('.sidebar-select') && !event.target.closest('.dropdown-menu')) {
    document.querySelectorAll('.dropdown-menu').forEach(el => el.classList.remove('active'));
  }
});

let DADOS = { fisico: [], pluviometria: [] };
let FILTROS = { contratada: null, mes: null, semana: null, mesesDisponiveis: [] };
const CHARTS = {};

const DEF_CONTRATADA = 'TERRAM ENGENHARIA DE INFRAESTRUTURA S.A.';

const CALENDARIO_ICONS = {
  sol: 'https://cdn.meteocons.com/3.0.0-next.10/svg/flat/clear-day.svg',
  nublado: 'https://cdn.meteocons.com/3.0.0-next.10/svg/flat/extreme-day.svg',
  chuva: 'https://cdn.meteocons.com/3.0.0-next.10/svg/flat/extreme-rain.svg',
  tempestade: 'https://cdn.meteocons.com/3.0.0-next.10/svg/flat/extreme-thunderstorms-extreme-night-rain.svg'
};

const MESES = ['janeiro','fevereiro','março','abril','maio','junho',
               'julho','agosto','setembro','outubro','novembro','dezembro'];

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const CALENDARIO_ROTULOS = {
  sol: 'Ensolarado',
  nublado: 'Nublado',
  chuva: 'Chuva',
  tempestade: 'Tempestade'
};

async function carregarConfigRelatorio() {
  try {
    const urlBase = typeof BASE_URL !== 'undefined' ? BASE_URL : '.';
    const resp = await fetch(urlBase + '/config.json?v=' + Date.now());
    if (!resp.ok) {
      const fallback = await fetch(urlBase + '/dados.json?v=' + Date.now());
      if (!fallback.ok) return null;
      const json = await fallback.json();
      return json.config_padrao || null;
    }
    return resp.json();
  } catch (err) {
    console.warn('Config padrao do relatorio nao foi encontrada.', err);
    return null;
  }
}

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

function fmtNum(v) { return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
function fmtInt(v) { return Math.round(Number(v) || 0).toLocaleString('pt-BR'); }
function formatarData(dataStr) {
  const data = new Date(`${dataStr}T00:00:00`);
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ==========================================
// SISTEMA DE FILTROS & NAVEGAÇÃO
// ==========================================
function popularFiltros() {
  const cfg = window.__CONFIG_PADRAO__ || {};
  
  // 1. Popular Contratada (usa DADOS.fisico)
  const contratadas = [...new Set(DADOS.fisico.map(d => d.contratada))].filter(Boolean).sort();
  const dropContratada = document.getElementById('drop-contratada');
  if (dropContratada) {
    dropContratada.innerHTML = '';
    contratadas.forEach(c => {
      const label = document.createElement('label');
      label.className = 'dropdown-item';
      label.innerHTML = `<input type="checkbox" value="${c}" onchange="filtrarContratada(this)"> ${abrevia(c, 20)}`;
      dropContratada.appendChild(label);
    });
  }

  // 2. Popular Ano/Mês (Acordeão)
  const meses = [...new Set(DADOS.fisico.map(d => d.mes))].filter(Boolean).sort();
  FILTROS.mesesDisponiveis = meses;
  const anos = [...new Set(meses.map(m => m.split('-')[0]))];
  const dropMes = document.getElementById('drop-mes');
  
  if (dropMes) {
    dropMes.innerHTML = '';
    anos.forEach(ano => {
      const grupo = document.createElement('div');
      grupo.innerHTML = `
        <div class="dropdown-group-title" onclick="this.nextElementSibling.classList.toggle('active')">
          ${ano} <span>▾</span>
        </div>
        <div class="dropdown-group-items" id="meses-${ano}"></div>
      `;
      
      const containerMeses = grupo.querySelector(`#meses-${ano}`);
      const mesesDoAno = meses.filter(m => m.startsWith(ano));
      
      mesesDoAno.forEach(m => {
        const label = document.createElement('label');
        label.className = 'dropdown-item';
        label.innerHTML = `<input type="checkbox" value="${m}" onchange="filtrarMes(this)"> ${mesLabel(m)}`;
        containerMeses.appendChild(label);
      });

      dropMes.appendChild(grupo);
    });
  }

  // 3. Aplicar defaults baseados no config.json
  const mesCfg = cfg.mes_referencia || (cfg.data_status ? String(cfg.data_status).slice(0, 7) : null);

  FILTROS.contratada = (cfg.Empresa && contratadas.includes(cfg.Empresa))
    ? cfg.Empresa
    : (contratadas.includes(DEF_CONTRATADA) ? DEF_CONTRATADA : (contratadas[0] || null));
    
  FILTROS.mes = mesCfg && meses.includes(mesCfg) ? mesCfg : (meses[meses.length - 1] || null);

  // Atualizar os textos nos botões da interface
  if (document.getElementById('txt-contratada')) {
    document.getElementById('txt-contratada').textContent = FILTROS.contratada ? abrevia(FILTROS.contratada, 20) : 'Todas';
  }
  if (document.getElementById('txt-mes')) {
    document.getElementById('txt-mes').textContent = FILTROS.mes ? mesValor(FILTROS.mes) : 'Todos';
  }

  // Marcar as checkboxes selecionadas
  if (FILTROS.contratada) {
    const cb = document.querySelector(`#drop-contratada input[value="${FILTROS.contratada}"]`);
    if (cb) cb.checked = true;
  }
  if (FILTROS.mes) {
    const cb = document.querySelector(`#drop-mes input[value="${FILTROS.mes}"]`);
    if (cb) cb.checked = true;
  }
}

function filtrarContratada(el) {
  FILTROS.contratada = el.checked ? el.value : null;
  const txt = document.getElementById('txt-contratada');
  if (txt) txt.textContent = el.checked ? abrevia(el.value, 20) : 'Todas';

  const checkboxes = document.querySelectorAll('#drop-contratada input');
  checkboxes.forEach(cb => { if (cb !== el) cb.checked = false; });

  atualizar();
}

function filtrarMes(el) {
  FILTROS.mes = el.checked ? el.value : null;
  const txt = document.getElementById('txt-mes');
  if (txt) txt.textContent = el.checked ? mesValor(el.value) : 'Todos';

  const checkboxes = document.querySelectorAll('#drop-mes input');
  checkboxes.forEach(cb => { if (cb !== el) cb.checked = false; });

  atualizar();
}

function navegarMes(delta) {
  const meses = FILTROS.mesesDisponiveis || [];
  if (!meses.length) return;

  const indiceAtual = meses.indexOf(FILTROS.mes);
  const novoIndice = indiceAtual === -1 ? meses.length - 1 + delta : indiceAtual + delta;
  const proximoMes = meses[Math.max(0, Math.min(meses.length - 1, novoIndice))];

  if (!proximoMes) return;
  FILTROS.mes = proximoMes;
  
  const txt = document.getElementById('txt-mes');
  if (txt) txt.textContent = mesValor(proximoMes);
  
  document.querySelectorAll('#drop-mes input').forEach(cb => {
    cb.checked = cb.value === proximoMes;
  });
  
  atualizar();
}

function getIconeChuva(mm) {
  const valor = Number(mm || 0);
  if (valor < 2) return 'sol';
  if (valor < 5) return 'nublado';
  if (valor < 15) return 'chuva';
  return 'tempestade';
}

// ==========================================
// RENDERIZAÇÃO DOS DADOS
// ==========================================
function setKPI(k, v) {
  const el = document.querySelector(`[data-kpi="${k}"]`);
  if (el) { 
    el.classList.remove('loading'); 
    el.textContent = v; 
  }
}

function render_KPIs() {
  const dadosMes = DADOS.pluviometria.filter(d => d.mes === FILTROS.mes);
  
  // 1. mm acumulado no mês
  const ultimoDia = dadosMes.filter(d => d.mm_acum !== null && d.mm_acum !== undefined).pop();
  const mmAcum = ultimoDia ? ultimoDia.mm_acum : 0;
  
  // 2. Média mm/dia realizada
  const diasComMedicao = dadosMes.filter(d => d.mm_dia !== null && d.mm_dia !== '');
  let mediaReal = 0;
  if (diasComMedicao.length > 0) {
    mediaReal = diasComMedicao.reduce((acc, curr) => acc + Number(curr.mm_dia || 0), 0) / diasComMedicao.length;
  }
  
  // 3. Dias impactados/paralisados
  const diasImpactados = dadosMes.filter(d => d.dia_paralisado === 'sim' || d.dia_paralisado === true).length;

  setKPI('mm_acum_mes', fmtInt(mmAcum));
  setKPI('media_mm_dia', fmtNum(mediaReal).replace('.', ','));
  setKPI('dias_impactados', fmtInt(diasImpactados));
}

function render_GraficoHistorico() {
  const el = document.getElementById('chart-pluvio-historico');
  if (!el) return;

  const dadosHist = DADOS.pluviometria.filter(d => d.historica_acum !== null).sort((a,b) => (a.data || '').localeCompare(b.data || ''));
  const labels = dadosHist.map(d => mesLabel(d.mes));
  const valHist = dadosHist.map(d => d.historica_acum);
  const valReal = dadosHist.map(d => d.mm_acum || 0);

  CHARTS['historico'] = CHARTS['historico'] || echarts.init(el);
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
  const el = document.getElementById('chart-pluvio-mes');
  if (!el) return;

  const dadosMes = DADOS.pluviometria
    .filter(d => d.mes === FILTROS.mes)
    .sort((a, b) => (a.data || '').localeCompare(b.data || ''));

  const mesSelecionado = FILTROS.mes;
  if (!mesSelecionado) return;

  const [ano, mesNum] = mesSelecionado.split('-');
  const totalDias = new Date(Number(ano), Number(mesNum), 0).getDate();
  const porData = Object.fromEntries(dadosMes.map(d => [d.data, d]));

  const labels = [];
  const valReal = [];
  const diasParalisados = [];

  for (let dia = 1; dia <= totalDias; dia++) {
    const dataStr = `${ano}-${mesNum}-${String(dia).padStart(2, '0')}`;
    const item = porData[dataStr] || null;

    labels.push(`${String(dia).padStart(2, '0')}/${mesNum}`);
    valReal.push(item && item.mm_dia != null && item.mm_dia !== '' ? Number(item.mm_dia) : null);
    diasParalisados.push(!!item && (item.dia_paralisado === 'sim' || item.dia_paralisado === true));
  }

  const indicesParalisados = diasParalisados
    .map((isParalisado, i) => isParalisado ? i : -1)
    .filter(i => i >= 0);

  const blocosParalisados = [];
  indicesParalisados.forEach((indice) => {
    const ultimo = blocosParalisados[blocosParalisados.length - 1];
    if (!ultimo || indice > ultimo.fim + 1) {
      blocosParalisados.push({ inicio: indice, fim: indice });
      return;
    }
    ultimo.fim = indice;
  });

  const faixaParalisada = blocosParalisados.map((bloco) => ([
    { xAxis: labels[bloco.inicio] },
    { xAxis: labels[bloco.fim] }
  ]));

  CHARTS['mes'] = CHARTS['mes'] || echarts.init(el);
  CHARTS['mes'].setOption({
    tooltip: { trigger: 'axis' },
    legend: {
      bottom: 0,
      itemGap: 15,
      textStyle: { fontSize: 10, color: '#605e5c' },
      data: [
        { name: 'mm/dia', icon: 'circle' },
        { name: 'Dias paralisados', icon: 'roundRect' }
      ]
    },
    grid: { left: 20, right: 20, top: 20, bottom: 40, containLabel: true },
    xAxis: { 
      type: 'category', data: labels, 
      axisLabel: { fontSize: 9, color: '#605e5c', interval: 0, rotate: 45 }, axisTick: { show: false }, axisLine: { lineStyle: { color: '#dcdcda' } } 
    },
    yAxis: { type: 'value', show: false },
    series: [
      { 
        name: 'mm/dia', type: 'line', data: valReal, smooth: 0.35,
        areaStyle: { color: 'rgba(0, 29, 55, 0.35)' },
        lineStyle: { color: '#001d37', width: 2, type: 'dashed' },
        itemStyle: { color: '#001d37' },
        symbol: 'circle',
        symbolSize: 5,
        label: {
          show: true,
          position: 'top',
          color: '#001d37',
          fontSize: 12,
          fontWeight: '600',
          formatter: (p) => {
            const v = p.value;
            if (v == null || Number(v) <= 0) return '';
            const n = Number(v);
            return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',');
          }
        },
        markArea: {
          silent: true,
          itemStyle: { color: 'rgba(39, 80, 236, 0.5)' },
          data: faixaParalisada
        }
      },
      {
        name: 'Dias paralisados',
        type: 'line',
        data: [],
        showSymbol: false,
        lineStyle: { color: 'rgba(39, 80, 236, 0.5)', width: 8 },
        itemStyle: { color: 'rgba(39, 80, 236, 0.5)' },
        tooltip: { show: false }
      }
    ]
  }, true);
}

function render_Calendario() {
  const container = document.getElementById('chart-calendario');
  if (!container) return;

  const mesSelecionado = FILTROS.mes;
  if (!mesSelecionado) {
    container.innerHTML = '<div class="calendario-vazio">Sem dados para exibir</div>';
    return;
  }

  const [ano, mesNum] = mesSelecionado.split('-');
  const mesIndex = Number(mesNum) - 1;
  const totalDias = new Date(Number(ano), Number(mesNum), 0).getDate();
  const primeiroDiaSemana = new Date(Number(ano), mesIndex, 1).getDay();
  const diasDoMes = DADOS.pluviometria.filter(d => d.mes === mesSelecionado);
  const porData = Object.fromEntries(diasDoMes.map(d => [d.data, d]));

  const header = document.createElement('div');
  header.className = 'calendario-header';
  header.innerHTML = `
    <button type="button" class="calendario-nav" data-direcao="-1" aria-label="Mês anterior">‹</button>
    <div class="calendario-titulo">${MESES[mesIndex]} ${ano}</div>
    <button type="button" class="calendario-nav" data-direcao="1" aria-label="Próximo mês">›</button>
  `;
  header.querySelector('[data-direcao="-1"]').addEventListener('click', () => navegarMes(-1));
  header.querySelector('[data-direcao="1"]').addEventListener('click', () => navegarMes(1));

  const semana = document.createElement('div');
  semana.className = 'calendario-semana';
  DIAS_SEMANA.forEach(dia => {
    const el = document.createElement('div');
    el.className = 'calendario-dia-semana';
    el.textContent = dia;
    semana.appendChild(el);
  });

  const grade = document.createElement('div');
  grade.className = 'calendario-grade';

  for (let i = 0; i < primeiroDiaSemana; i++) {
    const vazio = document.createElement('div');
    vazio.className = 'calendario-dia vazio';
    grade.appendChild(vazio);
  }

  const tooltipExiste = document.querySelector('.calendario-tooltip');
  if (tooltipExiste) tooltipExiste.remove();

  const tooltip = document.createElement('div');
  tooltip.className = 'calendario-tooltip';
  tooltip.style.display = 'none';
  document.body.appendChild(tooltip);

  for (let dia = 1; dia <= totalDias; dia++) {
    const dataStr = `${ano}-${String(mesIndex + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    const item = porData[dataStr];
    const valor = item ? Number(item.mm_dia || 0) : 0;
    const paralisado = item && (item.dia_paralisado === 'sim' || item.dia_paralisado === true);

    const celula = document.createElement('div');
    celula.className = 'calendario-dia';
    if (paralisado) celula.classList.add('paralisado');
    if (valor <= 0) celula.classList.add('sem-chuva');

    const numero = document.createElement('span');
    numero.className = 'calendario-numero';
    numero.textContent = dia;
    celula.appendChild(numero);

    const temDadoReal = !!item && item.mm_dia != null && item.mm_dia !== '';
    if (temDadoReal) {
      const tipo = getIconeChuva(valor);
      const icone = document.createElement('img');
      icone.src = CALENDARIO_ICONS[tipo];
      icone.alt = CALENDARIO_ROTULOS[tipo];
      icone.className = 'calendario-icone';
      icone.loading = 'lazy';
      celula.appendChild(icone);

      celula.addEventListener('mousemove', (event) => {
        tooltip.innerHTML = `
          <div><strong>${formatarData(dataStr)}</strong></div>
          <div><span class="tooltip-label">Chuva:</span> <span class="tooltip-value">${valor.toFixed(1).replace('.', ',')} mm</span></div>
          <div><span class="tooltip-label">Acumulado:</span> <span class="tooltip-status">${item && item.mm_acum != null ? Number(item.mm_acum).toFixed(1).replace('.', ',') + ' mm' : '—'}</span></div>
        `;
        tooltip.style.display = 'block';
        tooltip.style.left = `${event.clientX + 12}px`;
        tooltip.style.top = `${event.clientY + 12}px`;
      });
      celula.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
      });
    } else {
      celula.classList.add('vazio');
      celula.style.background = 'transparent';
      celula.style.borderColor = 'transparent';
      celula.title = 'Sem dado realizado';
    }

    grade.appendChild(celula);
  }

  const legenda = document.createElement('div');
  legenda.className = 'calendario-legenda';

  Object.entries(CALENDARIO_ICONS).forEach(([tipo, src]) => {
    const linha = document.createElement('span');
    linha.className = 'calendario-legenda-item';
    linha.innerHTML = `<img src="${src}" alt="${CALENDARIO_ROTULOS[tipo]}" />${CALENDARIO_ROTULOS[tipo]}`;
    legenda.appendChild(linha);
  });

  container.innerHTML = '';
  container.appendChild(header);
  container.appendChild(semana);
  container.appendChild(grade);
  container.appendChild(legenda);
}

function atualizar() {
  render_KPIs();
  render_GraficoHistorico();
  render_GraficoMes();
  render_Calendario();
}

async function carregarDados() {
  const v = Date.now();
  const urlBase = typeof BASE_URL !== 'undefined' ? BASE_URL : '.';
  
  const [fisico, pluviometria] = await Promise.all([
    fetch(urlBase + '/fisico_total.json?v=' + v).then(r => r.json()).catch(() => []),
    fetch(urlBase + '/pluviometria.json?v=' + v).then(r => r.json()).catch(() => [])
  ]);
  
  return { fisico, pluviometria };
}

async function render_() {
  try {
    DADOS = await carregarDados();
    window.__CONFIG_PADRAO__ = await carregarConfigRelatorio();
    popularFiltros();
    atualizar();
    
    // Responsividade dos gráficos
    window.addEventListener('resize', () => Object.values(CHARTS).forEach(c => c && c.resize()));
  } catch (err) {
    console.error("Erro ao carregar dados do pluviômetro:", err);
    document.querySelectorAll('[data-kpi]').forEach(el => el.textContent = "Erro");
  }
}

document.addEventListener('DOMContentLoaded', render_);