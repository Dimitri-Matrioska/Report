/* ============================================================
   PERFORMANCE SEMANAL — página executável (piloto)
   ------------------------------------------------------------
   Filtros interativos:
     - Contratada        (coluna: contratada do fisico_total.json)
     - Ano, Mês          (coluna: mes do fisico_total.json)
     - SemanaDoProjeto   (coluna: semana do fisico_total.json)
   Ao mudar qualquer filtro, KPIs e gráficos são recalculados.
   ============================================================ */

  function toggleDropdown(id) {
  // Fecha todos os outros
  document.querySelectorAll('.dropdown-menu').forEach(el => {
    if (el.id !== id) el.classList.remove('active');
  });
  // Alterna o atual
  document.getElementById(id).classList.toggle('active');
  }

let DADOS = { fisico: [], pluviometria: [], status: [] };
let FILTROS = { contratada: null, mes: null, semana: null };
const CHARTS = {};

// Defaults conforme o relatório vigente (PBIP / PDF):
// Contratada=TERRAM, Ano/Mês=2026+outubro, SemanaDoProjeto=31
const DEF_CONTRATADA = 'TERRAM ENGENHARIA DE INFRAESTRUTURA S.A.';
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

function render_KPIs() {
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

function render_Graficos() {
  render_curva_ano();
  render_curva_mes();
  render_Aderencia();
  render_PluvioCurto();
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

function render_TabelasTexto() {
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

function render_curva_ano() {
  const el = document.getElementById('chart-grafico_curva_ano');
  if (!el) return;
  
  const chartInstance = CHARTS['grafico_curva_ano'] || echarts.init(el);
  CHARTS['grafico_curva_ano'] = chartInstance;
  
  const anoAlvo = FILTROS.mes ? FILTROS.mes.split('-')[0] : '2026';
  
  const rows = DADOS.fisico.filter(d => 
    (FILTROS.contratada === null || d.contratada === FILTROS.contratada) &&
    (d.mes && d.mes.startsWith(anoAlvo))
  );

  const map = {};
  rows.forEach(d => {
    if (!map[d.mes]) map[d.mes] = { prevAc: 0, realAc: null, tend: null };
    
    map[d.mes].prevAc = Math.max(map[d.mes].prevAc, Number(d.baseline_1_acum) || 0);
    
    const rVal = Number(d.real_acum);
    if (d.real_acum !== null && d.real_acum !== undefined && d.real_acum !== '' && !isNaN(rVal)) {
      map[d.mes].realAc = map[d.mes].realAc === null ? rVal : Math.max(map[d.mes].realAc, rVal);
    }
    
    const proj = Number(d.projetado_acum);
    if (!isNaN(proj) && proj > 0) {
      map[d.mes].tend = map[d.mes].tend === null ? proj : Math.max(map[d.mes].tend, proj);
    }
  });

  const meses = Object.keys(map).sort();

  // Só o nome do mês (sem "/26"), igual à imagem
  const labels = meses.map(m => {
    const mm = m.split('-')[1];
    return MESES[parseInt(mm, 10) - 1];
  });
  
  const prev = [], real = [], tend = [];

  meses.forEach((m) => {
    const p = map[m].prevAc;
    const r = map[m].realAc;
    const t = map[m].tend; 

    prev.push(p);
    real.push(r !== null && r !== undefined ? r : null);
    tend.push(t !== null && t !== undefined ? t : null);
  });

  // Formata "5,4%" (vírgula no lugar de ponto)
  const fmt = v => (Number(v) * 100).toFixed(1).replace('.', ',') + '%';

  chartInstance.setOption({
    backgroundColor: 'transparent',
    // Top/bottom maiores pra dar espaço aos rótulos
    grid: { left: 20, right: 20, top: 50, bottom: 55, containLabel: true },
    // Só zoom com a roda do mouse — sem slider
    dataZoom: [{ type: 'inside', xAxisIndex: 0 }],
    tooltip: { 
      trigger: 'axis',
      backgroundColor: '#ffffff', 
      borderColor: '#001d37',
      textStyle: { color: '#252423', fontSize: 10 },
      formatter: function(params) {
        let res = params[0].name + '<br/>';
        params.forEach(p => {
          if (p.value === undefined || p.value === null) return;
          res += p.marker + p.seriesName + ': ' + fmt(p.value) + '<br/>';
        });
        return res;
      }
    },
    xAxis: { 
      type: 'category', 
      data: labels,
      name: anoAlvo,
      nameLocation: 'middle',
      nameGap: 32,
      nameTextStyle: { fontSize: 13, color: '#605e5c' },
      axisLabel: { 
        fontSize: 11, 
        color: '#605e5c', 
        interval: 0,
        margin: 12
      }, 
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#dcdcda' } },
      boundaryGap: false 
    },
    yAxis: { type: 'value', show: false, min: 0, max: 1 },
    series: [
      { 
        name: 'Previsto Acum', 
        type: 'line', 
        data: prev, 
        // CORREÇÃO: usa showSymbol:false em vez de symbol:'none' 
        // (mantém o anchor para o rótulo, mas esconde o ponto)
        showSymbol: false,
        clip: false,                                 // não recorta rótulos nas bordas
        lineStyle: { color: '#001d37', width: 2 }, 
        itemStyle: { color: '#001d37' },
        z: 10,
        label: { 
          show: true, 
          position: 'top',
          distance: 6,
          formatter: (p) => fmt(p.value),
          color: '#001d37', 
          backgroundColor: 'rgba(0, 29, 55, 0.10)', 
          padding: [4, 6], 
          borderRadius: 3, 
          fontSize: 10, 
          fontWeight: 'bold'
        },
        emphasis: { label: { show: true } }         // reforço no hover
      },
      { 
        name: 'Real Acum', 
        type: 'line', 
        data: real, 
        showSymbol: false,
        clip: false,
        lineStyle: { color: '#ffbe83', width: 2 }, 
        itemStyle: { color: '#ffbe83' }, 
        z: 10,
        label: { 
          show: true, 
          position: 'bottom',
          distance: 6,
          formatter: (p) => fmt(p.value),
          color: '#b06000', 
          backgroundColor: 'rgba(255, 190, 131, 0.15)', 
          padding: [4, 6], 
          borderRadius: 3, 
          fontSize: 10, 
          fontWeight: 'bold'
        },
        emphasis: { label: { show: true } }
      },
      { 
        name: 'Tendência Acum', 
        type: 'line', 
        data: tend, 
        smooth: true,
        showSymbol: false,
        clip: false,
        lineStyle: { color: '#2750ec', width: 2, type: 'dashed' }, 
        itemStyle: { color: '#2750ec' }, 
        z: 10,
        label: { 
          show: true, 
          position: 'bottom',       // abaixo da linha, como na imagem
          distance: 6,
          formatter: (p) => fmt(p.value),
          color: '#0020a0', 
          backgroundColor: 'rgba(39, 80, 236, 0.10)', 
          padding: [4, 6], 
          borderRadius: 3, 
          fontSize: 10, 
          fontWeight: 'bold'
        },
        emphasis: { label: { show: true } }
      }
    ]
  }, true);

  // Mantém o clique para dar zoom no mês
  chartInstance.off('click');
  chartInstance.on('click', function(params) {
    let index = null;

    if (params.dataIndex !== undefined) {
      index = params.dataIndex;
    } else if (params.offsetX !== undefined && params.offsetY !== undefined) {
      const coord = chartInstance.convertFromPixel({ gridIndex: 0 }, [params.offsetX, params.offsetY]);
      if (coord && !isNaN(coord[0])) {
        index = Math.round(coord[0]);
      }
    }

    if (index !== null && index >= 0 && index < meses.length) {
      if (chartInstance._zoomedIndex === index) {
        chartInstance.dispatchAction({ type: 'dataZoom', startValue: 0, endValue: meses.length - 1 });
        chartInstance._zoomedIndex = null;
      } else {
        const startIdx = Math.max(0, index - 1);
        const endIdx = Math.min(meses.length - 1, index + 1);
        chartInstance.dispatchAction({ type: 'dataZoom', startValue: startIdx, endValue: endIdx });
        chartInstance._zoomedIndex = index;
      }
    }
  });
}

function render_curva_mes() {
  const el = document.getElementById('chart-grafico_curva_mes');
  if (!el) return;
  CHARTS['grafico_curva_mes'] = CHARTS['grafico_curva_mes'] || echarts.init(el);
  
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

  CHARTS['grafico_curva_mes'].setOption({
    backgroundColor: 'transparent',
    grid: { left: 20, right: 20, top: 30, bottom: 30, containLabel: true },
      
    // Evento ao passar o mouse  (Previsto/real + Previsto/Real Acum)
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
          linha('Previsto', bruto['Previsto'], num) +
          linha('Real', bruto['Real'], num) +
          linha('Previsto Acum', bruto['Previsto Acum'], pct) +
          linha('Real Acum', bruto['Real Acum'], pct);
      }
    },
    // Legenda (Previsto/real + Previsto/Real Acum)
    legend: { 
      bottom: 0, itemWidth: 10, itemHeight: 8, textStyle: { fontSize: 12},
      data: [
        { name: 'Previsto', icon: 'circle', itemStyle: { color: '#001d37' } },
        { name: 'Real', icon: 'circle', itemStyle: { color: '#ffbe83' } },
        { name: 'Previsto Acum', icon: 'circle', itemStyle: { color: '#001d37' } },
        { name: 'Real Acum', icon: 'circle', itemStyle: { color: '#ffbe83' } }
        
        
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
        // Eixo 1: Valores diários (ex: 0.013 = 1.3%)
        type: 'value',  
        show: false,       // Mude para true se quiser ver as linhas de grade de fundo
        min: 0,         // Valor mínimo do eixo (permite negativo)
        max: 0.65,          // Valor máximo do eixo
        interval: 0.1,     // Força o eixo a pular de 0.1 em 0.1 (opcional, ajuda na precisão)
        axisLabel: { 
          show: true, 
          // AQUI ESTÁ O SEGREDO DOS DECIMAIS:
          // formatter converte o valor bruto (ex: 0.5) para porcentagem (50.0%)
          formatter: function (value) {
            return (value * 100).toFixed(1) + '%'; 
          },
          color: '#605e5c',
          fontSize: 9
        },
        splitLine: { 
          show: true, 
          lineStyle: { color: '#f3f0eb' } // Cor da linha de grade (bege-fundo)
        } 
      },
      { 
                // Eixo 1: Valores diários — usado SÓ pelas barras.
                
        type: 'value',  
        show: false, 
        min: 0,
        max: 0.05,
        axisLabel: { show: true },
        splitLine: { show: true } 
      }
    ],
    series: [
            // BARRAS (Eixo Y 1) — lado a lado Previsto
      { 
        name: 'Previsto', 
        type: 'bar', 
        yAxisIndex: 1, 
        data: prevDia, 
        itemStyle: { color: '#001e38' },
        barMaxWidth: 27,
        barGap: '5%',
        z: 6,
        // Rótulo de valor no topo da barra
        label: {
          show: true, 
          position: 'top', 
          distance: 5, 
                    rotate: 90,
          align: 'left',
          verticalAlign: 'center',
          formatter: (p) => (p.value * 100).toFixed(1) + '%',
          color: '#001e38', 
          backgroundColor: 'rgba(0, 29, 55, 0.2)', 
          padding: [5, 8], 
          borderRadius: 3, 
          fontSize: 10, 
          //fontWeight: 'bold'
         },


      },
      {
        name: 'Real', // real
        type: 'bar', 
        yAxisIndex: 1, 
        data: realDia, 
        itemStyle: { color: '#ffbe83' },
        barMaxWidth: 27,
        z: 6,
        // Rótulo de valor no topo da barra
        label: { 
          show: true, 
          position: 'top', 
          distance: 5, 
                    rotate: 90,
          align: 'left',
          verticalAlign: 'center',
          formatter: (p) => (p.value * 100).toFixed(1) + '%',
          color: '#001e38', 
          backgroundColor: 'rgba(255, 191, 131, 0.2)', 
          padding: [5, 8], 
          borderRadius: 3, 
          fontSize: 10, 
          //fontWeight: 'bold'
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
        
        // rotulo de valor no topo da linha
        label: { 
          show: true, 
          position: 'top', 
          distance: 5, 
          formatter: (p) => (p.value * 100).toFixed(1) + '%',
          color: '#001e38', 
          backgroundColor: 'rgba(0, 29, 55, 0.2)', 
          padding: [5, 8], 
          borderRadius: 3, 
          fontSize: 10, 
          //fontWeight: 'bold'
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
        // rotulo de valor no topo da linha
        label: { 
          show: true, 
          position: 'bottom', 
          distance: 5, 
          formatter: (p) => (p.value * 100).toFixed(1) + '%',
          color: '#001e38',
          backgroundColor: 'rgba(255, 191, 131, 0.2)', 
          padding: [5, 8], 
          borderRadius: 3, 
          fontSize: 10, 
          //fontWeight: 'bold'
        },
        labelLayout: { hideOverlap: false }
      }
    ]
  }, true);
}
function render_Aderencia() {
  const el = document.getElementById('chart-aderencia');
  if (!el) return;
  CHARTS['aderencia'] = CHARTS['aderencia'] || echarts.init(el);
  const rows = fisicoFiltrado();
  const ader = rows.length ? Math.max(...rows.map(d => Number(d.aderencia) || 0)) : 0;

  CHARTS['aderencia'].setOption({
  series: [{
    type: 'gauge', 
    startAngle: 180, 
    endAngle: 0, 
    min: 0, 
    max: 1,
    center: ['50%', '90%'], 
    radius: '125%',
    axisLine: { lineStyle: { width: 9, color: [[1, '#f3f0eb']] } },
    progress: { 
      show: true, 
      width: 12, 
      roundCap: false,
      itemStyle: { color: ader > 0.95 ? '' : '#ff3636' } 
    
    },
    pointer: { show: false },
    axisTick: { show: false }, 
    splitLine: { show: false }, 
    
    // --- ADICIONE ESTES DOIS ITENS AQUI ---
    axisLabel: {
      show: true,
      distance: 75, // Distância das legendas em relação à linha do gráfico (ajuste se necessário)
      formatter: (value) => `${Math.round(value * 100)}%`, // Converte 0 e 1 para "0%" e "100%"
      color: '#001e38a4',
      fontSize: 10
    },
    splitNumber: 1, // Garante que existirá apenas 1 divisão (mostrando apenas os extremos: min e max)
    // ---------------------------------------

    detail: { 
      fontSize: 12, 
      fontWeight: 'bold', 
      offsetCenter: [0, '-22%'],
      formatter: () => fmtPct(ader), 
      color: '#252423' 
    },
    data: [{ value: ader }]
  }]
  }, true);
}

/* Estado do gráfico pluviométrico.
   pluvioTodosMeses=false -> mostra só o mês vigente (do filtro)
   pluvioTodosMeses=true  -> mostra o ano inteiro
   A alternância é feita clicando no próprio gráfico. */
let pluvioTodosMeses = false;

function render_PluvioCurto() {
  const el = document.getElementById('chart-grafico_pluviometro');
  if (!el) return;
  CHARTS['grafico_pluviometro'] = CHARTS['grafico_pluviometro'] || echarts.init(el);
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

  CHARTS['grafico_pluviometro'].setOption({
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
  const chart = CHARTS['grafico_pluviometro'];
  if (!chart) return;
  chart.off && chart.off('click');
  chart.getZr().off('click');
  chart.getZr().on('click', function () {
    const n = [...new Set(DADOS.pluviometria.map(d => d.mes))].length;
    if (n <= 1) return;           // só 1 mês: nada a alternar
    pluvioTodosMeses = !pluvioTodosMeses;
    render_PluvioCurto();
  });
}

/* Atualiza o cursor para indicar que o gráfico é clicável. */
(function indicarClicavel() {
  var el = document.getElementById('chart-grafico_pluviometro');
  if (el) el.style.cursor = 'pointer';
})();

function popularFiltros() {
  // 1. Popular Contratada
  const contratadas = [...new Set(DADOS.fisico.map(d => d.contratada))].sort();
  const dropContratada = document.getElementById('drop-contratada');
  dropContratada.innerHTML = '';
  contratadas.forEach(c => {
    const label = document.createElement('label');
    label.className = 'dropdown-item';
    label.innerHTML = `<input type="checkbox" value="${c}" onchange="filtrarContratada(this)"> ${abrevia(c, 20)}`;
    dropContratada.appendChild(label);
  });

  // 2. Popular Ano/Mês (Acordeão)
  const meses = [...new Set(DADOS.fisico.map(d => d.mes))].sort();
  const anos = [...new Set(meses.map(m => m.split('-')[0]))];
  const dropMes = document.getElementById('drop-mes');
  dropMes.innerHTML = '';

  anos.forEach(ano => {
    // Título do Ano
    const grupo = document.createElement('div');
    grupo.innerHTML = `
      <div class="dropdown-group-title" onclick="this.nextElementSibling.classList.toggle('active')">
        ${ano} <span>▾</span>
      </div>
      <div class="dropdown-group-items" id="meses-${ano}"></div>
    `;
    
    // Meses dentro do Ano
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

  // 3. Popular Semanas
  const dropSemana = document.getElementById('drop-semana');
  dropSemana.innerHTML = '';
  // O resto da função chamará popularSemanas, que já existe no seu código.
  
  // Resetar filtros para os defaults do relatório
  FILTROS.contratada = DEF_CONTRATADA;
  FILTROS.mes = DEF_MES;
  
  // Atualiza os textos visuais nos botões
  document.getElementById('txt-contratada').textContent = abrevia(DEF_CONTRATADA, 20);
  document.getElementById('txt-mes').textContent = mesValor(DEF_MES);

  // Marca o checkbox correto
  document.querySelector(`#drop-contratada input[value="${DEF_CONTRATADA}"]`).checked = true;
  document.querySelector(`#drop-mes input[value="${DEF_MES}"]`).checked = true;

  popularSemanas();
}

// Funções chamadas pelos checkboxes:
function filtrarContratada(el) {
  FILTROS.contratada = el.checked ? el.value : null;
  document.getElementById('txt-contratada').textContent = el.checked ? abrevia(el.value, 20) : 'Todas';
  
  // Desmarca os outros (só permite 1)
  const checkboxes = document.querySelectorAll('#drop-contratada input');
  checkboxes.forEach(cb => { if (cb !== el) cb.checked = false; });

  atualizar();
}

function filtrarMes(el) {
  FILTROS.mes = el.checked ? el.value : null;
  document.getElementById('txt-mes').textContent = el.checked ? mesValor(el.value) : 'Todos';

  const checkboxes = document.querySelectorAll('#drop-mes input');
  checkboxes.forEach(cb => { if (cb !== el) cb.checked = false; });

  popularSemanas(); // Recalcula as semanas
  atualizar();
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

  // Define a semana atual
  FILTROS.semana = semanas.includes(DEF_SEMANA) ? DEF_SEMANA : (semanas[semanas.length - 1] || null);
  
  if (FILTROS.semana !== null) {
    document.getElementById('txt-semana').textContent = FILTROS.semana;
    const cb = document.querySelector(`#drop-semana input[value="${FILTROS.semana}"]`);
    if (cb) cb.checked = true;
  } else {
    document.getElementById('txt-semana').textContent = '-';
  }
}

function filtrarSemana(el) {
  FILTROS.semana = el.checked ? Number(el.value) : null;
  document.getElementById('txt-semana').textContent = el.checked ? el.value : '-';

  const checkboxes = document.querySelectorAll('#drop-semana input');
  checkboxes.forEach(cb => { if (cb !== el) cb.checked = false; });

  atualizar();
}

function atualizar() {
  render_KPIs();
  render_Graficos();
  render_TabelasTexto();
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

async function render_() {
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

document.addEventListener('DOMContentLoaded', render_);
