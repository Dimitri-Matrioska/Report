let DADOS = { fisico: [], desvios: [], stma: [] };
let FILTROS = { contratada: null, mes: null, semana: null };
const CHARTS = {};

const DEF_CONTRATADA = 'TERRAM';
const DEF_MES = '2026-09-30';
const DEF_SEMANA = "30";
const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

function mesLabel(m) { if(!m) return ''; const [a, mes] = m.split('-'); return MESES[parseInt(mes,10)-1] + '/' + a.slice(2); }
function mesValor(m) { if(!m) return ''; const [a, mes] = m.split('-'); return a + ' (Ano) + ' + MESES[parseInt(mes,10)-1]; }
function abrevia(t, max) { return !t ? '' : (t.length > max ? t.slice(0, max-1) + '…' : t); }

// Funções para desvios (usa desvios_stma.json)
const getGravidade = (x) => String(
  x.potencial_gravidade || x['Potencial de Gravidade'] || x['potencial_de_gravidade'] || 'Indefinido'
).trim().toLowerCase();

// NORMALIZA data para o formato YYYY-MM-DD (aceita DD/MM/YYYY, YYYY-MM-DDTHH:MM, etc)
const getData = (x) => {
  let d = x.data || x['Data'] || x['DATA'] || x.data_ocorrencia || x['Data Ocorrência'] || '';
  if (!d) return '';
  d = String(d).trim();
  // DD/MM/YYYY ou DD-MM-YYYY
  if (/^\d{2}[\/\-]\d{2}[\/\-]\d{4}/.test(d)) {
    const p = d.split(/[\/\-]/);
    return `${p[2]}-${p[1]}-${p[0]}`;
  }
  // YYYY-MM-DD... (com ou sem hora)
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
  return d;
};

// Busca descrição em vários nomes possíveis
const getDesc = (x) => {
  const nomes = ['descricao_macro'];
  for (const k of nomes) {
    const v = x[k];
    if (v != null && String(v).trim() !== '' && String(v).trim() !== '-') return String(v).trim();
  }
  for (const k in x) {
    const kl = k.toLowerCase();
    if (kl.includes('descri') || kl.includes('observ') || kl.includes('detalh') || kl.includes('texto')) {
      const v = String(x[k] || '').trim();
      if (v && v !== 'null' && v !== 'undefined') return v;
    }
  }
  return '-';
};

// NOVO — busca status/conclusão do desvio
const getStatus = (x) => {
  const nomes = ['status', 'Status', 'situacao', 'situação', 'Situação',
                 'tratamento', 'tratativa', 'acao', 'ação', 'Ação',
                 'concluido', 'em_andamento', 'estagio', 'estágio', 'fase'];
  for (const k of nomes) {
    const v = x[k];
    if (v != null && String(v).trim() !== '') return String(v).trim().toLowerCase();
  }
  for (const k in x) {
    const kl = k.toLowerCase();
    if (kl.includes('status') || kl.includes('situa') || kl.includes('tratat') ||
        kl.includes('tratament') || kl.includes('conclu') || kl.includes('andamento')) {
      const v = String(x[k] || '').trim();
      if (v && v !== 'null' && v !== 'undefined') return v.toLowerCase();
    }
  }
  return '';
};
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
  // Pega a data exata de corte da semana selecionada (ex: 2026-10-31)
  const dataCorte = getDataCorte(); 

  return DADOS.desvios.filter(d => {
    const dt = getData(d);
    if (!dt) return false;
    
    const [ano, mes] = dt.split('-');
    
    // Filtra pelo mês e ano corretos E garante que a data seja menor ou igual ao fim da semana
    return ano === anoRef && mes === mesRef && dt <= dataCorte;
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

  setKPI('dias_seguros', '215');
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
      textStyle: { fontSize: 14, fontWeight: 'normal', color: '#252423' }
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
      itemStyle: { color: '#001d37' }, barWidth: 24, 
      label: { show: true, position: 'right', fontSize: 11, fontWeight: 'normal', color: '#252423', distance: 8 } 
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
    xAxis: { type: 'category', data: catLinha, axisLabel: { fontSize: 10 },axisLabel: { rotate: 90 }, axisTick: { show: false } },
    yAxis: { type: 'value', show: false },
    series: [{ 
      type: 'line', data: valLinha, smooth: false, 
      lineStyle: { color: '#001d37', width: 3 }, itemStyle: { color: '#001d37' },
      symbol: 'circle', symbolSize: 6, showSymbol: true,
      label: { show: true, position: 'top', fontSize: 12, fontWeight: '' } 
    }]
  }, true);

    // 4. PIZZA — Concluído vs Andamento (ACUMULADO DESVIOS GRAVES)
 
  const basePizza = dAcum.filter(x => getGravidade(x) === 'grave');

  let qtdConcluido = 0, qtdAndamento = 0, qtdSemStatus = 0;

  basePizza.forEach(x => {
    const s = getStatus(x);
    if (!s) { 
      qtdSemStatus++; 
      return; 
    }
    
    // Verifica se o status indica que a ação foi concluída
    if (s.includes('conclu') || s.includes('fechad') || s.includes('encerr') ||
        s.includes('resolv')  || s.includes('finaliz') || s === 'sim' || s === 'ok') {
      qtdConcluido++;
    } else {
      // Qualquer outro status (aberto, em andamento, pendente) cai aqui
      qtdAndamento++; 
    }
  });

  // Fallback: Se por acaso o JSON não tiver coluna de status preenchida,
  // joga todos os graves na fatia de "Andamento" para não zerar o gráfico.
  if (qtdConcluido + qtdAndamento === 0 && qtdSemStatus > 0) {
    qtdAndamento = qtdSemStatus;
  }

  CHARTS['pizza'] = CHARTS['pizza'] || echarts.init(document.getElementById('chart-pizza'));
  CHARTS['pizza'].setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { 
      bottom: 0, 
      icon: 'circle', 
      textStyle: { fontSize: 11, color: '#605e5c' }, 
      itemGap: 5 
    },
    series: [{
      type: 'pie', 
      radius: '65%',              // Pizza sólida (sem buraco)
      center: ['50%', '45%'],     // Centralizada
      data: [
        { value: qtdConcluido,  name: 'Concluído', itemStyle: { color: '#22c55e' } }, // Verde
        { value: qtdAndamento, name: 'Andamento', itemStyle: { color: '#f59e0b' } }  // Amarelo
      ],
      label: { 
        show: true, 
        fontSize: 12, 
        formatter: '{c}',         // Exibe apenas o número
        position: 'outside' 
      },
      labelLine: { length: 10, length2: 15 }
    }]
  }, true);

  CHARTS['pizza'] = CHARTS['pizza'] || echarts.init(document.getElementById('chart-pizza'));
  CHARTS['pizza'].setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    // Removido o 'title' que ficava no centro (não existe na pizza sólida)
    legend: { 
      bottom: 0, 
      top:200,
      icon: 'circle', 
      textStyle: { fontSize: 10, color: '#605e5c' }, 
      itemGap: 15 
    },
    series: [{
      type: 'pie', 
      radius: '65%',          // <-- Única string = pizza sólida (sem buraco)
      center: ['50%', '45%'], // Centralizado
      data: [
        { value: qtdConcluido,  name: 'Concluído', itemStyle: { color: '#22c55e' } }, // Verde
        { value: qtdAndamento, name: 'Andamento', itemStyle: { color: '#f59e0b' } }  // Amarelo
      ],
      label: { 
        show: true, 
        fontSize: 12, 
        formatter: '{c}',       // Mostra apenas o número (ex: 27)
        position: 'outside', 
      },
      labelLine: { length: 5, length2: 1 }, color: '#605e5c'
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
  
  // Defina as cores para cada coluna aqui:
  const coresBarras = ['#001d37', '#254eec', '#ffbe83', '#ef4444', '#8b5cf6', '#ec4899'];
  const dadosComCores = valVert.map((val, idx) => ({
    value: val,
    itemStyle: { color: coresBarras[idx % coresBarras.length] }
  }));

  CHARTS['barras_vert'] = CHARTS['barras_vert'] || echarts.init(document.getElementById('chart-barras_vert'));
  CHARTS['barras_vert'].setOption({
    grid: { left: 20, right: 20, top: 20, bottom: 20, containLabel: true },
    xAxis: { type: 'category', data: catVert, axisLabel: { fontSize: 10 }, axisTick: { show: false } },
    yAxis: { type: 'value', show: false },
    series: [{ 
      type: 'bar', data: dadosComCores, barWidth: 120, 
      label: { show: true, position: 'top', fontSize: 12, fontWeight: 'normal' } 
    }]
  }, true);

  renderTabela(dMes);
}
// ========================================== Tabela de Desvios Graves do Mês ==========================================
function renderTabela(dMes) {
  const el = document.getElementById('table-descricao');
  if (!el) return;

  // Filtra SOMENTE os desvios graves do período (mês + semana selecionados)
  let graves = dMes.filter(x => getGravidade(x) === 'grave');

  // Ordena pela data (mais recentes primeiro)
  graves.sort((a, b) => getData(b).localeCompare(getData(a)));

  const titulo = 'Descrição desvios graves do mês - ' +
    (FILTROS.mes ? mesLabel(FILTROS.mes).split('/')[0].toUpperCase() : 'TODOS'); 
   
  let html = `
    <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
      
      <!-- ========================================== -->
      <!-- 1. AJUSTE DAS LARGURAS DAS COLUNAS         -->
      <!-- ========================================== -->
      <colgroup>
        <col style="width: 80%;"> <!-- Largura da 1ª coluna (Descrição) -->
        <col style="width: 20%;"> <!-- Largura da 2ª coluna (Classificação) -->
      </colgroup>

      <!-- CABEÇALHO FIXO AO ROLAR -->
      <thead style="position: sticky; top: 0; background-color: #f3f0eb; z-index: 2;">
        <tr>
          <!-- ========================================== -->
          <!-- 2. AJUSTES DO TÍTULO DA COLUNA 1           -->
          <!-- ========================================== -->
          <th style="font-weight: 700; font-size: 10pt; padding-bottom: 5px; text-align: left; color: #001d37;">${titulo}</th>
          
          <!-- ========================================== -->
          <!-- 3. AJUSTES DO TÍTULO DA COLUNA 2           -->
          <!-- ========================================== -->
          <th style="font-weight: 700; font-size: 10pt; padding-bottom: 8px; text-align: left; color: #001d37;">Classificação</th>
        </tr>
      </thead>
      <tbody>`;

  if (graves.length === 0) {
    html += `<tr><td colspan="2" style="padding: 14px; font-size: 9pt; color: #999; font-style: italic; text-align: left;">
                 Nenhum desvio grave.
               </td></tr>`;
  } else {
    graves.forEach(x => {
      const desc = x.descricao_macro || x.descricao || 'Sem descrição disponível.';
      const tipo = x.tp_desvio || getTipo(x) || '-';
      
      html += `
        <tr>
          <!-- ========================================== -->
          <!-- 4. AJUSTES DOS DADOS DA COLUNA 1           -->
          <!-- ========================================== -->
          <td style="border-bottom: 1px solid #dcdcda; padding: 8px 14px 8px 0; font-size: 8.5pt; line-height: 1.4; color: #252423; text-align: left; vertical-align: top;">${desc}</td>
          
          <!-- ========================================== -->
          <!-- 5. AJUSTES DOS DADOS DA COLUNA 2           -->
          <!-- ========================================== -->
          <td style="border-bottom: 1px solid #dcdcda; padding: 8px 0; font-size: 8.5pt; text-align: left; color: #252423; vertical-align: top;">${tipo}</td>
        </tr>`;
    });
  }
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