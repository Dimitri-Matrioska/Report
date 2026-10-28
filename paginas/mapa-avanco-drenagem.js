const ORTOFOTO_SRC = '../ortofoto/ortofoto-drenagem.jpg';
const ORTOFOTO_FALLBACK_SRC = '../imagens/fundo-mapa-avanco-drenagem.jpg';
let FILTRO_VIEW = { contratada: '-', mes: null, semana: '-' };

const MESES = [
  'janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
];

function abrevia(txt, max) {
  if (!txt) return '';
  return txt.length > max ? txt.slice(0, max - 1) + '...' : txt;
}

function fmtPct(v) {
  if (v == null || Number.isNaN(v)) return '--';
  return `${v.toFixed(1).replace('.', ',')}%`;
}

function normalizarPct(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n <= 1 ? n * 100 : n;
}

function valorRealServico(registro) {
  if (registro.real != null && registro.real !== '') return registro.real;
  if (registro.avanco != null && registro.avanco !== '') return registro.avanco;
  return null;
}

function emCaixaAlta(txt) {
  return String(txt || '').toLocaleUpperCase('pt-BR');
}

function mesChave(mesRef) {
  if (!mesRef) return null;
  return String(mesRef).slice(0, 7);
}

function mesComoLabel(mesRef) {
  if (!mesRef) return '-';
  const [ano, mm] = String(mesRef).split('-');
  if (!ano || !mm) return '-';
  const nomeMes = MESES[parseInt(mm, 10) - 1] || mm;
  return `${ano} (Ano) + ${nomeMes}`;
}

function getCorAderencia(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return '#6b7280';
  if (n < 95) return '#e53935';
  if (n < 100) return '#f5b700';
  return '#1fae61';
}

function setStatus(texto) {
  const el = document.getElementById('status-superior');
  if (el) el.textContent = texto;
}

function toggleDropdown(id) {
  document.querySelectorAll('.dropdown-menu').forEach(el => {
    if (el.id !== id) el.classList.remove('active');
  });
  const alvo = document.getElementById(id);
  if (alvo) alvo.classList.toggle('active');
}

document.addEventListener('click', (event) => {
  if (!event.target.closest('.sidebar-select') && !event.target.closest('.dropdown-menu')) {
    document.querySelectorAll('.dropdown-menu').forEach(el => el.classList.remove('active'));
  }
});

window.toggleDropdown = toggleDropdown;

function getRegistrosFiltrados(registros) {
  return registros.filter(r => {
    const nomeServico = String(r.servico_notavel || '');
    if (!nomeServico.toLowerCase().includes('drenagem')) return false;
    if (FILTRO_VIEW.contratada && r.contratada && FILTRO_VIEW.contratada !== r.contratada) return false;
    if (FILTRO_VIEW.mes && mesChave(r.mes_referencia) && FILTRO_VIEW.mes !== mesChave(r.mes_referencia)) return false;
    if (FILTRO_VIEW.semana && FILTRO_VIEW.semana !== '-' && Number(r.semana) > Number(FILTRO_VIEW.semana)) return false;
    return true;
  });
}

function setSidebarInfo(registros, configPadrao = null) {
  const contratadas = [...new Set(registros.map(r => r.contratada).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const meses = [...new Set(registros.map(r => mesChave(r.mes_referencia)).filter(Boolean))].sort();
  const semanas = [...new Set(registros.map(r => Number(r.semana)).filter(Number.isFinite))].sort((a, b) => a - b);

  const padrao = configPadrao || {};
  const dataStatus = padrao.data_status || null;
  const mesPadrao = mesChave(padrao.mes_referencia) || mesChave(dataStatus);
  const semanaPadrao = padrao.semana != null ? String(padrao.semana) : (semanas.length ? String(semanas[semanas.length - 1]) : '-');
  const contratadaPadrao = padrao.contratada_principal || contratadas[0] || '-';

  const contratada = contratadaPadrao || contratadas[0] || '-';
  const mes = mesPadrao && meses.includes(mesPadrao) ? mesPadrao : (meses.length ? meses[meses.length - 1] : null);
  const semana = semanaPadrao !== '-' && semanas.includes(Number(semanaPadrao)) ? String(semanaPadrao) : (semanas.length ? String(semanas[semanas.length - 1]) : '-');

  FILTRO_VIEW = {
    contratada,
    mes,
    semana: semana == null ? '-' : String(semana)
  };

  atualizarTextosSidebar();
  popularCombos(contratadas, meses);
}

function atualizarTextosSidebar() {
  const txtContratada = document.getElementById('txt-contratada');
  const txtMes = document.getElementById('txt-mes');
  const txtSemana = document.getElementById('txt-semana');

  if (txtContratada) txtContratada.textContent = abrevia(FILTRO_VIEW.contratada || '-', 26);
  if (txtMes) txtMes.textContent = FILTRO_VIEW.mes ? mesComoLabel(FILTRO_VIEW.mes) : '-';
  if (txtSemana) txtSemana.textContent = FILTRO_VIEW.semana || '-';
}

function getSemanasDisponiveis(registros) {
  return [...new Set(
    registros
      .filter(r => {
        if (FILTRO_VIEW.contratada && r.contratada && FILTRO_VIEW.contratada !== r.contratada) return false;
        if (FILTRO_VIEW.mes && mesChave(r.mes_referencia) && FILTRO_VIEW.mes !== mesChave(r.mes_referencia)) return false;
        return true;
      })
      .map(r => Number(r.semana))
      .filter(Number.isFinite)
  )].sort((a, b) => a - b);
}

function atualizarComboSemana() {
  const dropSemana = document.getElementById('drop-semana');
  if (!dropSemana) return;

  const registros = window.__MAPA_DADOS__ || [];
  const semanas = getSemanasDisponiveis(registros);

  dropSemana.innerHTML = '';

  if (!semanas.length) {
    FILTRO_VIEW.semana = '-';
    const vazio = document.createElement('div');
    vazio.className = 'dropdown-item';
    vazio.textContent = 'Sem semanas disponiveis';
    dropSemana.appendChild(vazio);
    return;
  }

  if (!semanas.includes(Number(FILTRO_VIEW.semana))) {
    FILTRO_VIEW.semana = String(semanas[semanas.length - 1]);
  }

  semanas.forEach(s => {
    const sem = String(s);
    const el = document.createElement('label');
    el.className = 'dropdown-item';
    const checked = sem === FILTRO_VIEW.semana ? 'checked' : '';
    el.innerHTML = `<input type="checkbox" ${checked}> ${sem}`;
    el.querySelector('input').addEventListener('change', (ev) => {
      if (!ev.target.checked) return;
      FILTRO_VIEW.semana = sem;
      atualizarTextosSidebar();
      document.querySelectorAll('#drop-semana input').forEach(cb => { if (cb !== ev.target) cb.checked = false; });
      aplicarFiltros();
    });
    dropSemana.appendChild(el);
  });
}

function popularCombos(contratadas, meses) {
  const dropContratada = document.getElementById('drop-contratada');
  const dropMes = document.getElementById('drop-mes');

  dropContratada.innerHTML = '';
  contratadas.forEach(c => {
    const el = document.createElement('label');
    el.className = 'dropdown-item';
    const checked = c === FILTRO_VIEW.contratada ? 'checked' : '';
    el.innerHTML = `<input type="checkbox" ${checked}> ${abrevia(c, 35)}`;
    el.querySelector('input').addEventListener('change', (ev) => {
      if (!ev.target.checked) return;
      FILTRO_VIEW.contratada = c;
      atualizarComboSemana();
      atualizarTextosSidebar();
      document.querySelectorAll('#drop-contratada input').forEach(cb => { if (cb !== ev.target) cb.checked = false; });
      aplicarFiltros();
    });
    dropContratada.appendChild(el);
  });

  dropMes.innerHTML = '';
  meses.forEach(m => {
    const el = document.createElement('label');
    el.className = 'dropdown-item';
    const checked = m === FILTRO_VIEW.mes ? 'checked' : '';
    el.innerHTML = `<input type="checkbox" ${checked}> ${mesComoLabel(m)}`;
    el.querySelector('input').addEventListener('change', (ev) => {
      if (!ev.target.checked) return;
      FILTRO_VIEW.mes = m;
      atualizarComboSemana();
      atualizarTextosSidebar();
      document.querySelectorAll('#drop-mes input').forEach(cb => { if (cb !== ev.target) cb.checked = false; });
      aplicarFiltros();
    });
    dropMes.appendChild(el);
  });

  atualizarComboSemana();
}

function carregarOrtofotoSimples() {
  const img = document.getElementById('ortofoto-img');
  const msg = document.getElementById('mapa-mensagem');

  if (!img) return;

  img.src = ORTOFOTO_SRC;
  img.onload = () => {
    if (msg) msg.hidden = true;
    setStatus('Ortofoto carregada com sucesso. Exibindo todos os servicos notaveis.');
  };
  img.onerror = () => {
    img.src = ORTOFOTO_FALLBACK_SRC;
    if (msg) {
      msg.hidden = false;
      msg.textContent = 'Nao foi possivel abrir ortofoto-drenagem.jpg. Exibindo imagem de fallback.';
    }
    setStatus('Ortofoto JPG nao carregou no modo atual; fallback aplicado.');
  };
}

function resumirPorServico(registros) {
  const porServico = new Map();

  registros.forEach(r => {
    const nome = r.servico_notavel || 'Servico sem nome';
    const atual = porServico.get(nome) || { base: null, diaBase: '', diaPrevisto: '', previstoValor: null };
    const diaAtual = atual.diaBase || '';
    const diaNovo = (r.dia || '') || '';

    const previstoNum = Number(r.previsto);
    const previstoValido = r.previsto !== null && r.previsto !== '' && Number.isFinite(previstoNum);

    if (previstoValido && diaNovo >= (atual.diaPrevisto || '')) {
      atual.previstoValor = r.previsto;
      atual.diaPrevisto = diaNovo;
    }

    if (!atual.base || diaNovo > diaAtual) {
      atual.base = r;
      atual.diaBase = diaNovo;
    }

    porServico.set(nome, atual);
  });

  return [...porServico.values()]
    .map(item => ({
      ...item.base,
      previsto_exibicao: item.previstoValor
    }))
    .sort((a, b) => String(a.servico_notavel).localeCompare(String(b.servico_notavel), 'pt-BR'));
}

function renderCardsServicos(resumo) {
  const host = document.getElementById('kpi-servicos-host');
  if (!host) return;

  const cards = resumo.map(r => {
    const previsto = normalizarPct(r.previsto_exibicao);
    const real = normalizarPct(valorRealServico(r));

    const aderenciaDireta = normalizarPct(r.aderencia_real);
    const previstoNum = Number(r.previsto);
    const realRaw = valorRealServico(r);
    const realNum = Number(realRaw);
    const aderenciaCalculada = Number.isFinite(previstoNum) && previstoNum > 0 && Number.isFinite(realNum)
      ? (realNum / previstoNum) * 100
      : null;
    const aderencia = aderenciaDireta ?? aderenciaCalculada;

    const corAderencia = getCorAderencia(aderencia);

    return `
      <section class="kpi-painel">
        <div class="kpi-titulo" title="${String(r.servico_notavel || '').replace(/"/g, '&quot;')}">${emCaixaAlta(r.servico_notavel || '-')}</div>
        <div class="kpi-grid">
          <div><span class="kpi-valor">${fmtPct(previsto)}</span><span class="kpi-legenda">Previsto</span></div>
          <div><span class="kpi-valor real" style="color:${corAderencia};">${fmtPct(real)}</span><span class="kpi-legenda">Real</span></div>
        </div>
      </section>`;
  }).join('');

  host.innerHTML = cards;
}

function aplicarFiltros() {
  const registros = window.__MAPA_DADOS__ || [];
  const filtrados = getRegistrosFiltrados(registros);
  const resumo = resumirPorServico(filtrados);
  renderCardsServicos(resumo);
  setStatus(`Exibindo ${resumo.length} servicos notaveis para ${FILTRO_VIEW.contratada || 'todas'} / ${FILTRO_VIEW.mes ? mesComoLabel(FILTRO_VIEW.mes) : 'todos os meses'} / ${FILTRO_VIEW.semana !== '-' ? FILTRO_VIEW.semana : 'todas as semanas'}.`);
}

async function carregarServicosNotaveis() {
  const resp = await fetch(`${BASE_URL}/servicos_notaveis.json?v=${Date.now()}`);
  if (!resp.ok) throw new Error(`Falha ao carregar servicos_notaveis.json (${resp.status})`);
  return resp.json();
}

async function carregarConfigRelatorio() {
  try {
    const resp = await fetch(`${BASE_URL}/config.json?v=${Date.now()}`);
    if (!resp.ok) {
      const fallback = await fetch(`${BASE_URL}/dados.json?v=${Date.now()}`);
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

async function bootstrap() {
  try {
    carregarOrtofotoSimples();
    const [registros, configPadrao] = await Promise.all([
      carregarServicosNotaveis(),
      carregarConfigRelatorio()
    ]);
    window.__MAPA_DADOS__ = registros;
    window.__RELATORIO_CONFIG__ = configPadrao || {};

    setSidebarInfo(registros, configPadrao);
    aplicarFiltros();

    setStatus(`Exibindo ${resumirPorServico(getRegistrosFiltrados(registros)).length} servicos notaveis no padrao KPI.`);
  } catch (err) {
    console.error(err);
    setStatus('Falha ao carregar dados da pagina.');
    const msg = document.getElementById('mapa-mensagem');
    if (msg) {
      msg.hidden = false;
      msg.textContent = `Erro: ${err.message}`;
    }
  }
}

document.addEventListener('DOMContentLoaded', bootstrap);
