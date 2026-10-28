let DADOS = { servicos: [] };
let FILTROS = { contratada: null, mes: null, semana: null, servico: null };
const CHARTS = {};
const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

const DEF_CONTRATADA = 'TERRAM';
const DEF_SERVICO = 'Aterro Geral';

async function carregarConfigRelatorio() {
  try {
    const resp = await fetch(BASE_URL + '/config.json?v=' + Date.now());
    if (!resp.ok) {
      const fallback = await fetch(BASE_URL + '/dados.json?v=' + Date.now());
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

function mesChave(m) {
  if (!m) return null;
  return String(m).slice(0, 7);
}

function mesLabel(m) { if(!m) return ''; const [a, mes] = m.split('-'); return MESES[parseInt(mes, 10) - 1] + '/' + a.slice(2); }
function mesValor(m) { if(!m) return ''; const [a, mes] = m.split('-'); return a + ' (Ano) + ' + MESES[parseInt(mes,10)-1]; }
function abrevia(t, max) { return !t ? '' : (t.length > max ? t.slice(0, max - 1) + '...' : t); }
function fmtInt(v) { return Math.round(Number(v) || 0).toLocaleString('pt-BR'); }
function fmtMil(v, casas = 0) {
  const n = Number(v) || 0;
  const valor = n / 1000;
  return `${valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })} Mil`;
}

function toggleDropdown(id) {
  document.querySelectorAll('.dropdown-menu').forEach(el => { if (el.id !== id) el.classList.remove('active'); });
  document.getElementById(id).classList.toggle('active');
}

document.addEventListener('click', (event) => {
  if (!event.target.closest('.sidebar-select') && !event.target.closest('.dropdown-menu')) {
    document.querySelectorAll('.dropdown-menu').forEach(el => el.classList.remove('active'));
  }
});

function getDadosBase() {
  return DADOS.servicos.filter(d => {
    if (FILTROS.contratada && d.contratada !== FILTROS.contratada) return false;
    if (FILTROS.mes && mesChave(d.mes_referencia) !== FILTROS.mes) return false;
    if (FILTROS.semana != null && Number(d.semana) > Number(FILTROS.semana)) return false;
    return true;
  });
}

function getDadosCurva() {
  return DADOS.servicos.filter(d => {
    if (FILTROS.contratada && d.contratada !== FILTROS.contratada) return false;
    if (FILTROS.servico && d.servico_notavel !== FILTROS.servico) return false;
    return true;
  });
}

function popularFiltros() {
  const cfg = window.__CONFIG_PADRAO__ || {};
  const contratadas = [...new Set(DADOS.servicos.map(d => d.contratada).filter(Boolean))].sort();
  const meses = [...new Set(DADOS.servicos.map(d => mesChave(d.mes_referencia)).filter(Boolean))].sort();

  const mesCfg = mesChave(cfg.mes_referencia) || mesChave(cfg.data_status);
  const semanaCfg = cfg.semana != null ? Number(cfg.semana) : null;

  FILTROS.contratada = (cfg.contratada_principal && contratadas.includes(cfg.contratada_principal))
    ? cfg.contratada_principal
    : (contratadas.find(c => c.startsWith(DEF_CONTRATADA)) || contratadas[0] || null);
  FILTROS.mes = mesCfg && meses.includes(mesCfg) ? mesCfg : (meses[meses.length - 1] || null);

  const dropContratada = document.getElementById('drop-contratada');
  dropContratada.innerHTML = '';
  contratadas.forEach(c => {
    const label = document.createElement('label');
    label.className = 'dropdown-item';
    label.innerHTML = `<input type="checkbox" value="${c}" onchange="filtrarContratada(this)"> ${abrevia(c, 35)}`;
    dropContratada.appendChild(label);
  });

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

  document.getElementById('txt-contratada').textContent = abrevia(FILTROS.contratada, 27);
  document.getElementById('txt-mes').textContent = mesValor(FILTROS.mes);

  const cbContr = FILTROS.contratada ? document.querySelector(`#drop-contratada input[value="${FILTROS.contratada}"]`) : null;
  if (cbContr) cbContr.checked = true;

  const cbMes = FILTROS.mes ? document.querySelector(`#drop-mes input[value="${FILTROS.mes}"]`) : null;
  if (cbMes) cbMes.checked = true;

  popularSemanas(semanaCfg);
  popularServicos();
}

function popularSemanas(semanaPreferida = null) {
  const dropSemana = document.getElementById('drop-semana');
  const base = DADOS.servicos.filter(d => {
    if (FILTROS.contratada && d.contratada !== FILTROS.contratada) return false;
    if (FILTROS.mes && mesChave(d.mes_referencia) !== FILTROS.mes) return false;
    return true;
  });

  const semanas = [...new Set(base.map(d => Number(d.semana)).filter(s => !Number.isNaN(s)))].sort((a, b) => a - b);
  FILTROS.semana = (semanaPreferida != null && semanas.includes(Number(semanaPreferida)))
    ? Number(semanaPreferida)
    : (semanas.length ? semanas[semanas.length - 1] : null);

  dropSemana.innerHTML = '';
  semanas.forEach(s => {
    const label = document.createElement('label');
    label.className = 'dropdown-item';
    label.innerHTML = `<input type="checkbox" value="${s}" onchange="filtrarSemana(this)"> ${s}`;
    dropSemana.appendChild(label);
  });

  document.getElementById('txt-semana').textContent = FILTROS.semana != null ? String(FILTROS.semana) : '-';
  const cbSem = FILTROS.semana != null ? document.querySelector(`#drop-semana input[value="${FILTROS.semana}"]`) : null;
  if (cbSem) cbSem.checked = true;
}

function popularServicos() {
  const dropServico = document.getElementById('drop-servico');
  const base = getDadosBase();
  const servicos = [...new Set(base.map(d => d.servico_notavel).filter(Boolean))].sort();

  if (!servicos.length) {
    FILTROS.servico = null;
  } else if (!FILTROS.servico || !servicos.includes(FILTROS.servico)) {
    FILTROS.servico = servicos.find(s => s === DEF_SERVICO) || servicos[0];
  }

  dropServico.innerHTML = '';
  servicos.forEach(s => {
    const label = document.createElement('label');
    label.className = 'dropdown-item';
    label.innerHTML = `<input type="checkbox" value="${s}" onchange="filtrarServico(this)"> ${abrevia(s, 38)}`;
    dropServico.appendChild(label);
  });

  document.getElementById('txt-servico').textContent = FILTROS.servico ? abrevia(FILTROS.servico, 40) : '-';
  const cbServico = FILTROS.servico ? document.querySelector(`#drop-servico input[value="${FILTROS.servico}"]`) : null;
  if (cbServico) cbServico.checked = true;
}

function filtrarContratada(el) {
  FILTROS.contratada = el.checked ? el.value : null;
  document.getElementById('txt-contratada').textContent = FILTROS.contratada ? abrevia(FILTROS.contratada, 27) : 'Todas';
  document.querySelectorAll('#drop-contratada input').forEach(cb => { if (cb !== el) cb.checked = false; });
  popularSemanas();
  popularServicos();
  atualizar();
}

function filtrarMes(el) {
  FILTROS.mes = el.checked ? el.value : null;
  document.getElementById('txt-mes').textContent = FILTROS.mes ? mesValor(FILTROS.mes) : 'Todos';
  document.querySelectorAll('#drop-mes input').forEach(cb => { if (cb !== el) cb.checked = false; });
  popularSemanas();
  popularServicos();
  atualizar();
}

function filtrarSemana(el) {
  FILTROS.semana = el.checked ? Number(el.value) : null;
  document.getElementById('txt-semana').textContent = FILTROS.semana != null ? String(FILTROS.semana) : '-';
  document.querySelectorAll('#drop-semana input').forEach(cb => { if (cb !== el) cb.checked = false; });
  popularServicos();
  atualizar();
}

function filtrarServico(el) {
  FILTROS.servico = el.checked ? el.value : null;
  document.getElementById('txt-servico').textContent = FILTROS.servico ? abrevia(FILTROS.servico, 40) : 'Todos';
  document.querySelectorAll('#drop-servico input').forEach(cb => { if (cb !== el) cb.checked = false; });
  atualizar();
}

function setKPI(k, v, color) {
  const el = document.querySelector(`[data-kpi="${k}"]`);
  if (el) {
    el.classList.remove('loading');
    el.textContent = v;
    if (color) el.style.color = color;
  }
}

function renderKPI() {
  const base = getDadosBase();
  const previsto = base.reduce((acc, d) => acc + Number(d.previsto || 0), 0);
  const real = base.reduce((acc, d) => acc + Number(d.real || 0), 0);
  const aderencia = previsto > 0 ? real / previsto : 0;

  const cor = aderencia >= 1 ? '#1AAB40' : (aderencia >= 0.95 ? '#D9B300' : '#FF3636');
  setKPI('aderencia', `${(aderencia * 100).toFixed(1).replace('.', ',')}%`, cor);
}

function renderChart() {
  const base = getDadosCurva();
  const porDia = {};

  base.forEach(d => {
    const dia = String(d.dia || '').slice(0, 10);
    if (!dia) return;
    if (!porDia[dia]) porDia[dia] = { previsto: 0, real: 0 };
    porDia[dia].previsto += Number(d.previsto || 0);
    porDia[dia].real += Number(d.real || 0);
  });

  const labels = [];
  const previstoDia = [];
  const realDia = [];
  const previstoAcum = [];
  const realAcum = [];

  const datas = Object.keys(porDia).sort();
  let accPrev = 0;
  let accReal = 0;
  datas.forEach((data) => {
    const atual = porDia[data];
    accPrev += atual.previsto;
    accReal += atual.real;

    labels.push(data);
    previstoDia.push(atual.previsto);
    realDia.push(atual.real);
    previstoAcum.push(accPrev);
    realAcum.push(accReal);
  });

  const indiceInicio = Math.max(0, labels.length - 40);

  CHARTS.servicos = CHARTS.servicos || echarts.init(document.getElementById('chart-servicos'));
  CHARTS.servicos.setOption({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line' },
      formatter: (params) => {
        if (!params || !params.length) return '';
        const dataIso = params[0].axisValue;
        const [y, m, d] = String(dataIso).split('-');
        let html = `<div><strong>${d}/${m}/${String(y).slice(2)}</strong></div>`;
        params.forEach(p => {
          html += `<div>${p.marker} ${p.seriesName}: <strong>${fmtMil(p.value, 2)}</strong></div>`;
        });
        return html;
      }
    },
    legend: {
      bottom: 0,
      icon: 'circle',
      itemGap: 16,
      textStyle: { fontSize: 10, color: '#605e5c' },
      data: ['Previsto', 'Real', 'Previsto Acum', 'Real Acum']
    },
    grid: { left: 24, right: 54, top: 18, bottom: 72, containLabel: true },
    dataZoom: [
      {
        type: 'slider',
        bottom: 28,
        height: 12,
        startValue: indiceInicio,
        endValue: labels.length - 1,
        borderColor: 'transparent',
        handleSize: 0,
        fillerColor: 'rgba(120,120,120,0.35)',
        backgroundColor: 'rgba(220,220,218,0.6)'
      }
    ],
    xAxis: {
      type: 'category',
      data: labels,
      axisLabel: {
        fontSize: 9,
        color: '#605e5c',
        interval: 0,
        formatter: (value) => {
          const data = new Date(`${value}T00:00:00`);
          return data.getDate();
        }
      },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#dcdcda' } }
    },
    yAxis: [
      { type: 'value', show: false },
      {
        type: 'value',
        position: 'right',
        min: 0,
        axisLabel: {
          color: '#605e5c',
          formatter: (v) => `${(v / 1000000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} M`
        },
        splitLine: { show: false },
        axisLine: { show: false },
        axisTick: { show: false }
      }
    ],
    series: [
      {
        name: 'Previsto',
        type: 'bar',
        barMaxWidth: 10,
        itemStyle: { color: '#0d2642' },
        data: previstoDia,
        label: {
          show: true,
          position: 'top',
          distance: 6,
          fontSize: 10,
          color: '#0d2642',
          formatter: p => Number(p.value) ? fmtMil(p.value, 0) : '0 Mil'
        }
      },
      {
        name: 'Real',
        type: 'bar',
        barMaxWidth: 10,
        itemStyle: { color: '#ffbe83' },
        data: realDia,
        label: { show: false }
      },
      {
        name: 'Previsto Acum',
        type: 'line',
        yAxisIndex: 1,
        data: previstoAcum,
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#0d2642', width: 2, type: 'dashed' },
        itemStyle: { color: '#001d37' },
        label: {
          show: true,
          position: 'top',
          distance: 10,
          fontSize: 9,
          color: '#0d2642',
          backgroundColor: 'rgba(220,220,218,0.7)',
          borderRadius: 6,
          padding: [3, 6],
          formatter: (p) => Number(p.value) ? fmtMil(p.value, 2) : '0 Mil'
        }
      },
      {
        name: 'Real Acum',
        type: 'line',
        yAxisIndex: 1,
        data: realAcum,
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#ffbe83', width: 2, type: 'dashed' },
        itemStyle: { color: '#ffbe83' },
        label: {
          show: true,
          position: 'bottom',
          distance: 8,
          fontSize: 9,
          color: '#7b5f3a',
          backgroundColor: 'rgba(248,235,221,0.9)',
          borderRadius: 6,
          padding: [3, 6],
          formatter: (p) => Number(p.value) ? fmtMil(p.value, 2) : '0 Mil'
        }
      }
    ]
  }, true);
}

function renderTabela() {
  const el = document.getElementById('table-servicos');
  if (!el) return;

  const base = getDadosBase();
  const grupos = {};
  base.forEach(d => {
    const nome = d.servico_notavel || '-';
    const un = d.un || '-';
    const key = `${nome}||${un}`;
    if (!grupos[key]) grupos[key] = { nome, un, total: 0, previstoAcum: 0, realAcum: 0 };

    grupos[key].total = Math.max(grupos[key].total, Number(d.total || 0));
    grupos[key].previstoAcum += Number(d.previsto || 0);
    grupos[key].realAcum += Number(d.real || 0);
  });

  const linhas = Object.values(grupos).sort((a, b) => a.nome.localeCompare(b.nome));

  let html = `
    <table>
      <thead>
        <tr>
          <th style="width:45%">Serviço Notável</th>
          <th style="width:9%">Un</th>
          <th class="num" style="width:12%">Total</th>
          <th class="num" style="width:17%">Previsto Acum</th>
          <th class="num" style="width:17%">Real Acum</th>
        </tr>
      </thead>
      <tbody>`;

  if (!linhas.length) {
    html += `<tr><td colspan="5" style="color:#999;font-style:italic;">Sem dados para o filtro atual.</td></tr>`;
  } else {
    linhas.forEach(l => {
      html += `
        <tr>
          <td>${l.nome}</td>
          <td>${l.un}</td>
          <td class="num">${fmtInt(l.total)}</td>
          <td class="num">${fmtInt(l.previstoAcum)}</td>
          <td class="num">${fmtInt(l.realAcum)}</td>
        </tr>`;
    });
  }

  html += '</tbody></table>';
  el.innerHTML = html;
}

function atualizar() {
  renderKPI();
  renderChart();
  renderTabela();
}

async function carregarDados() {
  const v = Date.now();
  const url = typeof BASE_URL !== 'undefined' ? BASE_URL + '/servicos_notaveis.json?v=' + v : '../dados/servicos_notaveis.json?v=' + v;
  const res = await fetch(url);
  return await res.json();
}

async function render_() {
  try {
    DADOS.servicos = await carregarDados();
    window.__CONFIG_PADRAO__ = await carregarConfigRelatorio();
    popularFiltros();
    atualizar();
    window.addEventListener('resize', () => Object.values(CHARTS).forEach(c => c && c.resize()));
  } catch (err) {
    console.error('Erro ao carregar Serviços Notáveis:', err);
    const kpi = document.querySelector('[data-kpi="aderencia"]');
    if (kpi) {
      kpi.classList.remove('loading');
      kpi.textContent = 'Erro';
      kpi.style.color = '#D64550';
    }
  }
}

document.addEventListener('DOMContentLoaded', render_);
