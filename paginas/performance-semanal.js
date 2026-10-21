/* ============================================================
   PERFORMANCE SEMANAL — página executável (piloto)
   ------------------------------------------------------------
   Filtros interativos:
     - Contratada        (coluna: contratada do fisico_total.json)
     - Ano, Mês          (coluna: mes do fisico_total.json)
     - SemanaDoProjeto   (coluna: semana do fisico_total.json)
   Ao mudar qualquer filtro, KPIs e gráficos são recalculados.
   ============================================================ */

let DADOS = { fisico: [], pluviometria: [], status: [] };
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
   Dados vindos de dados/status_semanal.json (aba "Status Semanal"
   da planilha Dados_GeraisReport_AFR.xlsx).
   Itens:
     - Fatos Relevantes -> HIGHLIGHTS
     - Pontos de Atenção -> PONTOS DE ATENÇÃO
     - Próximos Passos   -> PRÓXIMOS PASSOS
   ============================================================ */
function statusDoPeriodo() {
  // Filtra por contratada (substring) + semana vigente.
  // Se a semana não tiver registros, cai para a maior semana disponível.
  const base = DADOS.status.filter(d =>
    FILTROS.contratada === null ||
    (d.contratada && d.contratada.startsWith(DEF_CONTRATADA))
  );
  const daSemana = base.filter(d => Number(d.semana) === Number(FILTROS.semana));
  if (daSemana.length) return daSemana;
  const semanas = base.map(d => Number(d.semana)).filter(n => !isNaN(n));
  if (!semanas.length) return [];
  const maxSem = Math.max(...semanas);
  return base.filter(d => Number(d.semana) === maxSem);
}

/* Quebra a Descrição (bloco multi-linha com "•") em itens. */
function itensDescricao(desc) {
  if (!desc) return [];
  return desc
    .split(/\r?\n/)
    .map(l => l.replace(/^[•\-\*]\s*/, '').trim())
    .filter(l => l.length > 0)
    // remove rótulos soltos tipo "TERRAM:" / "GERAL:"
    .filter(l => !/^[A-ZÇÃÕÁÉÍÓÚÂÊÔ\- ]{2,20}:$/.test(l));
}

function itensDoStatus(registros, ...itens) {
  const alvo = itens.map(s => s.toLowerCase());
  const out = [];
  registros
    .filter(d => d.item && alvo.includes(d.item.toLowerCase()))
    .forEach(d => itensDescricao(d.descricao).forEach(t => out.push(t)));
  return out;
}

function renderTabelasTexto() {
  const regs = statusDoPeriodo();
  preencherTabela('table-b7008cbc', 'HIGHLIGHTS',
                  itensDoStatus(regs, 'Fatos Relevantes'));
  preencherTabela('table-9f78ce2d', 'PONTOS DE ATENÇÃO',
                  itensDoStatus(regs, 'Pontos de Atenção', 'Pontos de Atenção STMA'));
  preencherTabela('table-12e44aa3', 'PRÓXIMOS PASSOS',
                  itensDoStatus(regs, 'Próximos Passos', 'Próximos Passos STMA'));
}

function preencherTabela(id, titulo, itens) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = '';
  if (!itens.length) return;
  const ul = document.createElement('div');
  ul.style.padding = '6px 8px';
  ul.innerHTML = '<div style="font-weight:700;font-size:8pt;margin-bottom:3px">' +
    titulo + ':</div>' +
    itens.map(t => '<div style="font-size:8pt;line-height:1.25;margin-bottom:4px">• ' +
      t + '</div>').join('');
  el.appendChild(ul);
}

function renderCurvaMensal() {
  const el = document.getElementById('chart-1ecebfde');
  if (!el) return;
  CHARTS['1ecebfde'] = CHARTS['1ecebfde'] || echarts.init(el);
  
  const anoAlvo = FILTROS.mes ? FILTROS.mes.split('-')[0] : '2026';
  
  const rows = DADOS.fisico.filter(d => 
    (FILTROS.contratada === null || d.contratada === FILTROS.contratada) &&
    (d.mes && d.mes.startsWith(anoAlvo))
  );

  const map = {};
  rows.forEach(d => {
    if (!map[d.mes]) map[d.mes] = { prevAc: 0, realAc: 0, tend: 0 };
    map[d.mes].prevAc = Math.max(map[d.mes].prevAc, Number(d.baseline_1_acum) || 0);
    map[d.mes].realAc = Math.max(map[d.mes].realAc, Number(d.real_acum) || 0);
    
    const proj = Number(d.projetado_acum);
    if (!isNaN(proj) && proj > 0) {
      map[d.mes].tend = Math.max(map[d.mes].tend, proj);
    }
  });

  const meses = Object.keys(map).sort();
  const labels = meses.map(mesLabel); 
  
  const prev = [], real = [], tend = [];

  meses.forEach((m) => {
    const p = map[m].prevAc;
    const r = map[m].realAc;
    const t = map[m].tend > 0 ? map[m].tend : null; 

    prev.push(p);
    real.push(r);
    tend.push(t);
  });

  CHARTS['1ecebfde'].setOption({
    backgroundColor: 'transparent',
    grid: { left: 20, right: 20, top: 30, bottom: 30, containLabel: true },
    tooltip: { 
      trigger: 'axis',
      backgroundColor: '#ffffff', // Tooltip sólido
      borderColor: '#001d37',
      textStyle: { color: '#252423', fontSize: 10 },
      formatter: function(params) {
        let res = params[0].name + '<br/>';
        params.forEach(p => {
          if (p.value === undefined || p.value === null) return;
          res += p.marker + p.seriesName + ': ' + (p.value * 100).toFixed(1) + '%<br/>';
        });
        return res;
      }
    },
    legend: { 
      bottom: 0, itemWidth: 10, itemHeight: 8, textStyle: { fontSize: 8 },
      data: [
        { name: 'Previsto Acum', icon: 'circle', itemStyle: { color: '#001d37' } },
        { name: 'Real Acum', icon: 'circle', itemStyle: { color: '#ffbe83' } },
        { name: 'Tendência Acum', icon: 'circle', itemStyle: { color: '#2750ec' } }
      ]
    },
    xAxis: { 
      type: 'category', data: labels, 
      axisLabel: { fontSize: 9, color: '#605e5c', interval: 0 }, 
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#dcdcda' } },
      boundaryGap: false 
    },
    yAxis: { type: 'value', show: false, min: 0, max: 1 },
    series: [
      { 
        name: 'Previsto Acum', type: 'line', data: prev, 
        lineStyle: { color: '#001d37', width: 2 }, itemStyle: { color: '#001d37' }, symbol: 'none', z: 10,
        label: { 
          show: true, position: 'top', formatter: (p) => (p.value * 100).toFixed(1) + '%',
          color: '#001d37', backgroundColor: 'rgba(0, 29, 55, 0.3)', // 30% transparência
          padding: [2, 4], borderRadius: 2, fontSize: 8, fontWeight: 'bold'
        }
      },
      { 
        name: 'Real Acum', type: 'line', data: real, 
        lineStyle: { color: '#ffbe83', width: 2 }, itemStyle: { color: '#ffbe83' }, symbol: 'none', z: 10,
        label: { 
          show: true, position: 'bottom', formatter: (p) => (p.value * 100).toFixed(1) + '%',
          color: '#b06000', backgroundColor: 'rgba(255, 190, 131, 0.3)', // 30% transparência
          padding: [2, 4], borderRadius: 2, fontSize: 8, fontWeight: 'bold'
        }
      },
      { 
        name: 'Tendência Acum', type: 'line', data: tend, smooth: true,
        lineStyle: { color: '#2750ec', width: 2, type: 'dashed' }, itemStyle: { color: '#2750ec' }, symbol: 'none', z: 10,
        label: { 
          show: true, position: 'top', formatter: (p) => (p.value * 100).toFixed(1) + '%',
          color: '#0020a0', backgroundColor: 'rgba(39, 80, 236, 0.3)', // 30% transparência
          padding: [2, 4], borderRadius: 2, fontSize: 8, fontWeight: 'bold'
        }
      }
    ]
  }, true);
}

function renderCurvaS1() {
  const el = document.getElementById('chart-62f295f1');
  if (!el) return;
  CHARTS['62f295f1'] = CHARTS['62f295f1'] || echarts.init(el);
  
  const rows = fisicoFiltrado().sort((a, b) => (a.data || '').localeCompare(b.data || ''));
  
  const map = {};
  rows.forEach(d => {
    if (!map[d.data]) map[d.data] = { prevAc: 0, realAc: 0, prevDia: 0, realDia: 0 };
    map[d.data].prevAc = Math.max(map[d.data].prevAc, Number(d.baseline_1_acum) || 0);
    map[d.data].realAc = Math.max(map[d.data].realAc, Number(d.real_acum) || 0);
    // Soma os valores diários (se houver mais de uma linha por data, tipo contrato)
    map[d.data].prevDia += Number(d.baseline_1) || 0;
    map[d.data].realDia += Number(d.real) || 0;
  });

  const datas = Object.keys(map).sort();
  const labels = datas.map(d => d.slice(8, 10) + '/' + d.slice(5, 7));
  
  const prevAc = datas.map(d => map[d].prevAc);
  const realAc = datas.map(d => map[d].realAc);
  const prevDia = datas.map(d => map[d].prevDia);
  const realDia = datas.map(d => map[d].realDia);

  CHARTS['62f295f1'].setOption({
    backgroundColor: 'transparent',
    grid: { left: 20, right: 20, top: 40, bottom: 30, containLabel: true },
        tooltip: { 
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#dcdcda',
      textStyle: { color: '#252423', fontSize: 10 },
      formatter: function(params) {
        const nome = (params[0] && params[0].axisValue) || '';
        const bruto = {};
        params.forEach(p => {
          bruto[p.seriesName] = (p.value === undefined || p.value === null)
            ? null : Number(p.value);
        });
        const linha = (rotulo, valor, fmt) => {
          if (valor === null || isNaN(valor)) return '';
          return rotulo + ': <b>' + fmt(valor) + '</b><br/>';
        };
        const pct = v => (v * 100).toFixed(1) + '%';
        const num = v => v.toLocaleString('pt-BR',
          { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        return nome + '<br/>' +
          linha('Previsto Dia', bruto['Previsto Dia'], num) +
          linha('Real Dia', bruto['Real Dia'], num) +
          linha('Previsto Acum', bruto['Previsto Acum'], pct) +
          linha('Real Acum', bruto['Real Acum'], pct);
      }
    },
    legend: { 
      bottom: 0, itemWidth: 10, itemHeight: 8, textStyle: { fontSize: 8 },
      data: [
        { name: 'Previsto Acum', icon: 'circle', itemStyle: { color: '#001d37' } },
        { name: 'Real Acum', icon: 'circle', itemStyle: { color: '#ffbe83' } },
        { name: 'Previsto Dia', icon: 'rect', itemStyle: { color: '#dcdcda' } },
        { name: 'Real Dia', icon: 'rect', itemStyle: { color: '#f5e6d6' } }
      ]
    },
    xAxis: { 
      type: 'category', 
      data: labels, 
      axisLabel: { fontSize: 12, color: '#605e5c', interval: 0 }, // interval 0 = mostra todos
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#dcdcda' } } 
    },
        yAxis: [
      { 
        // Eixo 0: % Acumulada (0 a 100%) — usado SÓ pelas linhas
        type: 'value', 
        show: false, 
        min: 0, 
        max: 1, 
        axisLabel: { show: false },
        splitLine: { show: false } 
      },
      { 
                // Eixo 1: Valores diários — usado SÓ pelas barras.
                // Escala fixa em 130% (barra máxima ocupa ~77% da altura).
        type: 'value',  
        show: false, 
        min: 0,
        max: 1.3,
        axisLabel: { show: true },
        splitLine: { show: true } 
      }
    ],
    series: [
            // BARRAS (Eixo Y 1) — lado a lado
      { 
        name: 'Previsto Dia', 
        type: 'bar', 
        yAxisIndex: 1, 
        data: prevDia, 
        itemStyle: { color: '#001e38' },
        barMaxWidth: 14,
        barGap: '10%',
        z: 6
      },
      {
        name: 'Real Dia', 
        type: 'bar', 
        yAxisIndex: 1, 
        data: realDia, 
        itemStyle: { color: '#ffbe83' },
        barMaxWidth: 14,
        z: 6,
        label: { 
          show: true, 
          position: 'top', 
          distance: 6, 
                    rotate: 90,
          align: 'left',
          verticalAlign: 'bottom',
          formatter: (p) => (p.value * 100).toFixed(1) + '%',
          color: '#fff', 
          backgroundColor: 'rgb(255, 191, 131)', 
          padding: [2, 3], 
          borderRadius: 3, 
          fontSize: 8, 
          fontWeight: 'bold'
        },
      },
      // LINHAS (Eixo Y 0)
            { 
                name: 'Previsto Acum', 
        type: 'line', 
        yAxisIndex: 0, 
        data: prevAc,    
        lineStyle: { color: '#001d37', width: 2 }, 
        itemStyle: { color: '#001d37' }, 
        symbol: 'circle', 
        symbolSize: 0,
        z: 10,
        label: { 
          show: true, 
          position: 'top', 
          distance: 5, 
          formatter: (p) => (p.value * 100).toFixed(1) + '%',
          color: '#001e38', 
          backgroundColor: 'rgba(0, 29, 55, 0.3)', 
          padding: [3, 5], 
          borderRadius: 3, 
          fontSize: 10, 
          fontWeight: 'bold'
        },
        // TRUQUE PARA NÃO ESCONDER O RÓTULO:
        labelLayout: { hideOverlap: false }
      },
      { 
                name: 'Real Acum', 
        type: 'line', 
        yAxisIndex: 0, 
        data: realAc,  
        lineStyle: { color: '#ffbe83', width: 2 }, 
        itemStyle: { color: '#ffbe83' }, 
        symbol: 'circle', 
        symbolSize: 0,
        z: 10,
        label: { 
          show: true, 
          position: 'bottom', 
          distance: 5, 
          formatter: (p) => (p.value * 100).toFixed(1) + '%',
          color: '#001e38',
          backgroundColor: 'rgba(255, 191, 131, 0.5)', 
          padding: [3, 5], 
          borderRadius: 3, 
          fontSize: 10, 
          fontWeight: 'bold'
        },
        labelLayout: { hideOverlap: false }
      }
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
      type: 'gauge', startAngle: 180, endAngle: 0, min: 0, max: 1,
      center: ['50%', '90%'], radius: '125%',
      axisLine: { lineStyle: { width: 9, color: [[1, '#f3f0eb']] } },
      progress: { show: true, width: 12, roundCap: false,
                  itemStyle: { color: '#ff3636' } },
      pointer: { show: false },
      axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false },
      detail: { fontSize: 12, fontWeight: 'bold', offsetCenter: [0, '-22%'],
                formatter: () => fmtPct(ader), color: '#252423' },
      data: [{ value: ader }]
    }]
  }, true);
}

/* Estado do gráfico pluviométrico.
   pluvioTodosMeses=false -> mostra só o mês vigente (do filtro)
   pluvioTodosMeses=true  -> mostra o ano inteiro
   A alternância é feita clicando no próprio gráfico. */
let pluvioTodosMeses = false;

function renderPluvioCurto() {
  const el = document.getElementById('chart-cfaada41');
  if (!el) return;
  CHARTS['cfaada41'] = CHARTS['cfaada41'] || echarts.init(el);
  const pluv = DADOS.pluviometria;
  const todosMeses = [...new Set(pluv.map(d => d.mes))].sort();

  let meses;
  if (pluvioTodosMeses || FILTROS.mes === null) {
    meses = todosMeses;
  } else {
    meses = todosMeses.includes(FILTROS.mes)
      ? [FILTROS.mes]
      : [todosMeses[todosMeses.length - 1]];
  }

  const hist = [], real = [];
  meses.forEach(m => {
    const g = pluv.filter(d => d.mes === m);
    hist.push(g.length ? Math.max(...g.map(d => Number(d.historica_acum) || 0)) : 0);
    real.push(g.length ? Math.max(...g.map(d => Number(d.mm_acum) || 0)) : 0);
  });

  CHARTS['cfaada41'].setOption({
    grid: { left: 8, right: 8, top: 20, bottom: 22, containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#ffffff',
      borderColor: '#dcdcda',
      padding: [3, 6],
      textStyle: { color: '#252423', fontSize: 8 },
      formatter: function (params) {
        if (!params || !params.length) return '';
        var nome = params[0].axisValue || '';
        var res = '<div style="font-size:8px;font-weight:600">' + nome + '</div>';
        params.forEach(function (p) {
          if (p.value === undefined || p.value === null) return;
          res += p.marker +
            '<span style="font-size:8px">' + p.seriesName + ': <b>' +
            fmtInt(p.value) + ' mm</b></span><br/>';
        });
        return res;
      }
    },
    legend: { top: 16, itemWidth: 10, itemHeight: 8, textStyle: { fontSize: 8 } },
    xAxis: { type: 'category', data: meses.map(mesLabel),
             axisLabel: { fontSize: 8, color: '#605e5c' }, axisTick: { show: false },
             axisLine: { lineStyle: { color: '#dcdcda' } } },
    yAxis: { type: 'value', show: false },
    series: [
      { name: 'Histórica acum', type: 'bar', data: hist, itemStyle: { color: '#001d37' }, barMaxWidth: 18 },
      { name: 'Real acum', type: 'bar', data: real, itemStyle: { color: '#ffbe83' }, barMaxWidth: 18 }
    ]
  }, true);

  configurarCliquePluvio();
}

/* Clique no gráfico alterna entre mês vigente e ano inteiro. */
function configurarCliquePluvio() {
  const chart = CHARTS['cfaada41'];
  if (!chart) return;
  chart.off && chart.off('click');
  chart.getZr().off('click');
  chart.getZr().on('click', function () {
    const n = [...new Set(DADOS.pluviometria.map(d => d.mes))].length;
    if (n <= 1) return;           // só 1 mês: nada a alternar
    pluvioTodosMeses = !pluvioTodosMeses;
    renderPluvioCurto();
  });
}

/* Atualiza o cursor para indicar que o gráfico é clicável. */
(function indicarClicavel() {
  var el = document.getElementById('chart-cfaada41');
  if (el) el.style.cursor = 'pointer';
})();

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
  const [fisico, pluviometria, status] = await Promise.all([
    fetch(BASE_URL + '/fisico_total.json?v=' + v).then(r => r.json()),
    fetch(BASE_URL + '/pluviometria.json?v=' + v).then(r => r.json()),
    fetch(BASE_URL + '/status_semanal.json?v=' + v).then(r => r.json())
      .catch(() => [])
  ]);
  return { fisico, pluviometria, status };
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
