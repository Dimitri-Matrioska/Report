const ORTOFOTO_IMG_SRC = '../ortofoto/ortofoto.jpg';
let FILTRO_VIEW = { contratada: '-', mes: null, semana: '-' }; 
let mapaLeaflet = null;
let camadaMarcadores = null;
let cacheAreasMapeadas = [];
let zoomBaseMapa = null;
let alturaGlobalImagem = 1200; 

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

const DEF_CONTRATADA = 'TERRAM ENGENHARIA DE INFRAESTRUTURA S.A.'; // Valor padrão caso não haja config.json ou config_padrao no JSON
const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']; // Para exibir no formato "out/26" ou "outubro (Ano) + 2026"

function mesLabel(m) { if(!m) return ''; const [a, mes] = m.split('-'); return MESES[parseInt(mes,10)-1] + '/' + a.slice(2); } // Para exibir no formato "out/26" ou "outubro (Ano) + 2026"
function mesValor(m) { if(!m) return ''; const [a, mes] = m.split('-'); return a + ' (Ano) + ' + MESES[parseInt(mes,10)-1]; } // Para exibir no formato "out/26" ou "outubro (Ano) + 2026"
function abrevia(t, max) { return !t ? '' : (t.length > max ? t.slice(0, max-1) + '…' : t); } // Abrevia texto para caber em dropdowns, ex: "TERRAM ENGENHARI…" (max = 20)


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

let modalFotoArea = null;
function garantirModalFotoArea() {
  if (modalFotoArea) return modalFotoArea;

  const host = document.createElement('div');
  host.className = 'foto-area-modal';
  host.hidden = true;
  host.innerHTML = `
    <div class="foto-area-modal-backdrop" data-fechar="1"></div>
    <div class="foto-area-modal-card" role="dialog" aria-modal="true" aria-label="Foto da area">
      <button type="button" class="foto-area-modal-fechar" data-fechar="1" aria-label="Fechar">×</button>
      <div class="foto-area-modal-titulo" id="foto-area-modal-titulo"></div>
      <img id="foto-area-modal-img" class="foto-area-modal-img" alt="Foto da area" src="">
    </div>
  `;

  host.addEventListener('click', (ev) => {
    const alvo = ev.target;
    if (alvo && alvo.dataset && alvo.dataset.fechar === '1') {
      host.hidden = true;
      document.body.classList.remove('foto-area-modal-open');
    }
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && modalFotoArea && !modalFotoArea.hidden) {
      modalFotoArea.hidden = true;
      document.body.classList.remove('foto-area-modal-open');
    }
  });

  document.body.appendChild(host);
  modalFotoArea = host;
  return host;
}

function abrirFotoEmMoldura(fotoPath, titulo) {
  const modal = garantirModalFotoArea();
  const img = modal.querySelector('#foto-area-modal-img');
  const lbl = modal.querySelector('#foto-area-modal-titulo');
  if (!img || !lbl) return;

  lbl.textContent = titulo || 'Foto da area';
  img.src = fotoPath;
  modal.hidden = false;
  document.body.classList.add('foto-area-modal-open');
}

function atualizarInteracaoMapa() {
  if (!mapaLeaflet || zoomBaseMapa == null) return;
  const podeNavegar = mapaLeaflet.getZoom() > zoomBaseMapa;

  if (podeNavegar) {
    mapaLeaflet.dragging.enable();
  } else {
    mapaLeaflet.dragging.disable();
    mapaLeaflet.panInsideBounds(mapaLeaflet.options.maxBounds, { animate: false });
  }
}

function toggleDropdown(id) {
  document.querySelectorAll('.dropdown-menu').forEach(el => { if (el.id !== id) el.classList.remove('active'); });
  document.getElementById(id).classList.toggle('active');
}

function toggleAnoMes(checkbox, ano) {
  const container = document.getElementById(`meses-${ano}`);
  if (container) {
    container.classList.toggle('active', checkbox.checked);
  }
}

document.addEventListener('click', function(event) {
  if (!event.target.closest('.sidebar-select') && !event.target.closest('.dropdown-menu')) {
    document.querySelectorAll('.dropdown-menu').forEach(el => el.classList.remove('active'));
  }
});

function popularFiltros() {
  const cfg = window.__CONFIG_PADRAO__ || {};
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
    const anoAtivo = FILTROS.mes && String(FILTROS.mes).startsWith(ano) ? 'checked' : '';
    const grupo = document.createElement('div');
    grupo.innerHTML = `
      <div class="dropdown-group-title">
        <label class="dropdown-year-item">
          <input type="checkbox" value="${ano}" ${anoAtivo} onchange="toggleAnoMes(this, '${ano}')">
          <span>${ano}</span>
        </label>
        <span class="dropdown-year-toggle" onclick="const cb = this.parentElement.querySelector('input'); if (cb) { cb.checked = !cb.checked; toggleAnoMes(cb, '${ano}'); }">▾</span>
      </div>
      <div class="dropdown-group-items ${anoAtivo ? 'active' : ''}" id="meses-${ano}"></div>
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

  const mesCfg = cfg.mes_referencia || (cfg.data_status ? String(cfg.data_status).slice(0, 7) : null);
  const semanaCfg = cfg.semana != null ? Number(cfg.semana) : null;

  FILTROS.contratada = (cfg.contratada_principal && contratadas.includes(cfg.contratada_principal))
    ? cfg.contratada_principal
    : (contratadas.find(c => c.startsWith(DEF_CONTRATADA)) || contratadas[0]);
  FILTROS.mes = mesCfg && meses.includes(mesCfg) ? mesCfg : (meses[meses.length - 1] || null);
  FILTROS.ano = FILTROS.mes ? String(FILTROS.mes).slice(0, 4) : null;
  
  document.getElementById('txt-contratada').textContent = abrevia(FILTROS.contratada, 20);
  document.getElementById('txt-mes').textContent = mesValor(FILTROS.mes);
  
  const cbContr = document.querySelector(`#drop-contratada input[value="${FILTROS.contratada}"]`);
  if (cbContr) cbContr.checked = true;
  const cbMes = document.querySelector(`#drop-mes input[value="${FILTROS.mes}"]`);
  if (cbMes) cbMes.checked = true;

  popularSemanas(semanaCfg);
}

function popularSemanas(semanaPreferida = null) {
  const dropSemana = document.getElementById('drop-semana');
  const base = DADOS.fisico.filter(d => {
    if (FILTROS.ano && String(d.mes || '').slice(0, 4) !== String(FILTROS.ano)) return false;
    if (FILTROS.mes && d.mes !== FILTROS.mes) return false;
    return true;
  });
  const semanas = [...new Set(base.map(d => Number(d.semana)))].filter(n => !Number.isNaN(n)).sort((a, b) => a - b);
  dropSemana.innerHTML = '';
  semanas.forEach(s => {
    const label = document.createElement('label');
    label.className = 'dropdown-item';
    const checked = FILTROS.semana !== null && Number(FILTROS.semana) === Number(s) ? 'checked' : '';
    label.innerHTML = `<input type="checkbox" value="${s}" ${checked} onchange="filtrarSemana(this)"> ${s}`;
    dropSemana.appendChild(label);
  });

  const semanaPadrao = (semanaPreferida != null && semanas.includes(Number(semanaPreferida)))
    ? Number(semanaPreferida)
    : (semanas.length ? semanas[semanas.length - 1] : null);
  FILTROS.semana = semanaPadrao;
  if (FILTROS.semana !== null) {
    document.getElementById('txt-semana').textContent = FILTROS.semana;
    const cb = document.querySelector(`#drop-semana input[value="${FILTROS.semana}"]`);
    if (cb) cb.checked = true;
  } else { document.getElementById('txt-semana').textContent = '-'; }
}

function filtrarContratada(el) { FILTROS.contratada = el.checked ? el.value : null; document.getElementById('txt-contratada').textContent = el.checked ? abrevia(el.value, 20) : 'Todas'; document.querySelectorAll('#drop-contratada input').forEach(cb => { if (cb !== el) cb.checked = false; }); atualizar(); }
function filtrarMes(el) {
  FILTROS.mes = el.checked ? el.value : null;
  FILTROS.ano = FILTROS.mes ? String(FILTROS.mes).slice(0, 4) : null;
  document.getElementById('txt-mes').textContent = el.checked ? mesValor(el.value) : 'Todos';
  document.querySelectorAll('#drop-mes input').forEach(cb => { if (cb !== el) cb.checked = false; });
  popularSemanas();
  atualizar();
}
function filtrarSemana(el) { FILTROS.semana = el.checked ? Number(el.value) : null; document.getElementById('txt-semana').textContent = el.checked ? el.value : '-'; document.querySelectorAll('#drop-semana input').forEach(cb => { if (cb !== el) cb.checked = false; }); atualizar(); }


//window.toggleDropdown = toggleDropdown;

function normalizarTextoJS(s) {
  if (!s) return '';
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function getRegistrosFiltrados(registros) {
  return registros.filter(r => {
    if (r.exibir === 'nao' || r.exibir === 'não' || r.exibir === false) {
      return false;
    }
    
    const nomeServico = String(r.servico_notavel || '').trim();
    if (!nomeServico || nomeServico === '-') {
      return false;
    }

    if (FILTRO_VIEW.contratada && FILTRO_VIEW.contratada !== '-' && r.contratada && FILTRO_VIEW.contratada !== r.contratada) {
      return false;
    }
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
  
  // ALTERAÇÃO AQUI: Adicionado padrao.Empresa
  const contratadaPadrao = padrao.Empresa || padrao.contratada_principal || contratadas[0] || '-';

  FILTRO_VIEW = {
    contratada: contratadaPadrao,
    mes: mesPadrao && meses.includes(mesPadrao) ? mesPadrao : (meses.length ? meses[meses.length - 1] : null),
    semana: semanaPadrao !== '-' && semanas.includes(Number(semanaPadrao)) ? String(semanaPadrao) : (semanas.length ? String(semanas[semanas.length - 1] ) : '-')
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
        // Filtra por contratada
        if (FILTRO_VIEW.contratada && FILTRO_VIEW.contratada !== '-' && r.contratada && FILTRO_VIEW.contratada !== r.contratada) return false;
        
        // NOVO: Filtra por mês/ano selecionado
        if (FILTRO_VIEW.mes) {
          const mReg = mesChave(r.mes_referencia) || r.mes;
          if (mReg && mReg !== FILTRO_VIEW.mes) return false;
        }
        
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
    vazio.textContent = 'Sem semanas disponíveis';
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

  const anos = [...new Set(meses.map(m => String(m).slice(0, 4)))].sort();
  dropMes.innerHTML = '';
  anos.forEach(ano => {
    const anoAtivo = FILTRO_VIEW.mes && String(FILTRO_VIEW.mes).startsWith(ano) ? 'checked' : '';
    const grupo = document.createElement('div');
    grupo.innerHTML = `
      <div class="dropdown-group-title">
        <label class="dropdown-year-item">
          <input type="checkbox" value="${ano}" ${anoAtivo} onchange="toggleAnoMes(this, '${ano}')">
          <span>${ano}</span>
        </label>
        <span class="dropdown-year-toggle" onclick="const cb = this.parentElement.querySelector('input'); if (cb) { cb.checked = !cb.checked; toggleAnoMes(cb, '${ano}'); }">▾</span>
      </div>
      <div class="dropdown-group-items ${anoAtivo ? 'active' : ''}" id="meses-${ano}"></div>
    `;

    const containerMeses = grupo.querySelector(`#meses-${ano}`);
    meses.filter(m => String(m).startsWith(ano)).forEach(m => {
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
      containerMeses.appendChild(el);
    });

    dropMes.appendChild(grupo);
  });

  atualizarComboSemana();
}

function inicializarMapaLeaflet() {
  const wrapper = document.getElementById('mapa-wrapper');
  if (!wrapper) return;

  wrapper.innerHTML = '<div id="leaflet-map"></div><div id="mapa-mensagem" class="mapa-mensagem" hidden></div>';

  const imgTest = new Image();
  imgTest.src = ORTOFOTO_IMG_SRC;
  imgTest.onload = () => {
    const w = imgTest.naturalWidth || 1600;
    const h = imgTest.naturalHeight || 1200;
    alturaGlobalImagem = h; 

    mapaLeaflet = L.map('leaflet-map', {
      crs: L.CRS.Simple,
      minZoom: -3,
      maxZoom: 4,
      attributionControl: false,
      zoomControl: true,
      dragging: false
    });

    const bounds = [[0, 0], [h, w]];
    L.imageOverlay(ORTOFOTO_IMG_SRC, bounds).addTo(mapaLeaflet);
    
    mapaLeaflet.setMaxBounds(bounds);
    mapaLeaflet.fitBounds(bounds);

    zoomBaseMapa = mapaLeaflet.getZoom();
    mapaLeaflet.setMinZoom(zoomBaseMapa);
    mapaLeaflet.setZoom(zoomBaseMapa);
    const zoomInicial = zoomBaseMapa + 1; 
    mapaLeaflet.setZoom(zoomInicial);

    mapaLeaflet.on('zoomend', atualizarInteracaoMapa);
    atualizarInteracaoMapa();

    camadaMarcadores = L.layerGroup().addTo(mapaLeaflet);
    setStatus('Mapa maximizado carregado com sucesso.');
    aplicarFiltros();
  };
  imgTest.onerror = () => {
    setStatus('Erro ao carregar a imagem da ortofoto.');
  };
}

async function carregarMapeamentoAreas() {
  try {
    let resp = await fetch(`../dados/mapeamento_areas.json?v=${Date.now()}`);
    if (!resp.ok) {
      resp = await fetch(`mapeamento_areas.json?v=${Date.now()}`);
      if (!resp.ok) return [];
    }
    return await resp.json();
  } catch (err) {
    console.warn('mapeamento_areas.json não encontrado ou vazio.', err);
    return [];
  }
}

function servicoEstaVisivel(nomeServico) {
  if (!nomeServico) return true;
  const registros = window.__MAPA_DADOS__ || [];
  const nomeBusca = normalizarTextoJS(nomeServico);
  const regsServico = registros.filter(r => normalizarTextoJS(r.servico_notavel) === nomeBusca);
  if (regsServico.length === 0) return true;
  const desmarcado = regsServico.some(r => r.exibir === 'nao' || r.exibir === 'não' || r.exibir === false);
  return !desmarcado;
}

function calcularSubPolylines(points, r_range) {
  if (!r_range || points.length < 2) return [];
  let seg_start = r_range.start_seg;
  let t_start = r_range.start_t;
  let seg_end = r_range.end_seg;
  let t_end = r_range.end_t;

  if (seg_start > seg_end || (seg_start === seg_end && t_start > t_end)) {
    let tempSeg = seg_start; let tempT = t_start;
    seg_start = seg_end; t_start = t_end;
    seg_end = tempSeg; t_end = tempT;
  }

  let subPts = [];
  const p1 = points[seg_start];
  const p2 = points[seg_start + 1];
  subPts.push([p1[0] + t_start * (p2[0] - p1[0]), p1[1] + t_start * (p2[1] - p1[1])]);

  for (let i = seg_start + 1; i <= seg_end; i++) {
    subPts.push(points[i]);
  }

  if (seg_end < points.length - 1) {
    const q1 = points[seg_end];
    const q2 = points[seg_end + 1];
    const endPt = [q1[0] + t_end * (q2[0] - q1[0]), q1[1] + t_end * (q2[1] - q1[1])];
    if (subPts.length === 0 || subPts[subPts.length - 1][0] !== endPt[0] || subPts[subPts.length - 1][1] !== endPt[1]) {
      subPts.push(endPt);
    }
  }

  return subPts.map(p => [alturaGlobalImagem - p[1], p[0]]);
}

function renderizarAreasNoMapa(resumoServicos) {
  if (!camadaMarcadores) return;
  camadaMarcadores.clearLayers();

  cacheAreasMapeadas.forEach(area => {
    const tipo = area.tipo || (area.pontos ? 'poligono' : 'ponto');

    if (tipo === 'polilinha' && area.pontos && Array.isArray(area.pontos) && area.pontos.length >= 2) {
      const latLngs = area.pontos.map(p => [alturaGlobalImagem - Number(p[1]), Number(p[0])]);
      const nomeLinha = String(area.nome_area || 'Polilinha');

      // Linha prevista (branca)
      const camadaPrevista = L.polyline(latLngs, {
        color: '#ffffff',
        weight: 5,
        opacity: 0.9
      });

      camadaPrevista.bindTooltip(`<b>${nomeLinha}</b><br>Status: Previsto`, {
        direction: 'auto',
        sticky: true
      });
      camadaMarcadores.addLayer(camadaPrevista);

      let rangesToDraw = [];
      if (area.realizado_ranges && Array.isArray(area.realizado_ranges)) {
        rangesToDraw = area.realizado_ranges;
      } else if (area.realizado_range) {
        rangesToDraw = [area.realizado_range];
      }

      rangesToDraw.forEach(r_range => {
        const subLatLngs = calcularSubPolylines(area.pontos, r_range);
        if (subLatLngs.length >= 2) {
          // Efeito Neon: Camada de fundo (halo brilhante e translúcido)
          const camadaBrilho = L.polyline(subLatLngs, {
            color: '#22c55e',
            weight: 10,
            opacity: 0.35
          });

          // Efeito Neon: Camada principal (verde vibrante por cima)
          const camadaRealizada = L.polyline(subLatLngs, {
            color: '#4ade80',
            weight: 4,
            opacity: 1.0
          });

          camadaRealizada.bindTooltip(`<b>${nomeLinha}</b><br>Status: Realizado`, {
            direction: 'auto',
            sticky: true
          });

          // Adiciona o brilho primeiro (ficando embaixo) e depois a linha principal
          camadaMarcadores.addLayer(camadaBrilho);
          camadaMarcadores.addLayer(camadaRealizada);
        }
      });
      return;
    }

    if (!servicoEstaVisivel(area.servico_notavel)) {
      return;
    }

    const nomeAreaNorm = normalizarTextoJS(area.servico_notavel);

    let servicoMatch = resumoServicos.find(r => {
      const nomeRNorm = normalizarTextoJS(r.servico_notavel);
      return nomeRNorm === nomeAreaNorm || nomeRNorm.includes(nomeAreaNorm) || nomeAreaNorm.includes(nomeRNorm);
    });

    if (!servicoMatch && resumoServicos.length > 0) {
      const palavrasArea = nomeAreaNorm.split(' ').filter(p => p.length > 3);
      servicoMatch = resumoServicos.find(r => {
        const nomeRNorm = normalizarTextoJS(r.servico_notavel);
        return palavrasArea.some(palavra => nomeRNorm.includes(palavra));
      });
    }

    const previsto = servicoMatch ? normalizarPct(servicoMatch.previsto_exibicao) : null;
    const real = servicoMatch ? normalizarPct(valorRealServico(servicoMatch)) : null;

    let fotoPath = '';
    if (area.foto_miniatura) {
      const fotoTrim = String(area.foto_miniatura).trim();
      if (fotoTrim.startsWith('GitHub/Report/')) {
        fotoPath = `../../${fotoTrim.replace('GitHub/Report/', '')}`;
      } else if (fotoTrim.startsWith('ortofoto/')) {
        fotoPath = `../${fotoTrim}`;
      } else {
        fotoPath = `../imagens/fotos_campo/${fotoTrim}`;
      }
    }

    let layer = null;

    if (tipo === 'poligono' && area.pontos && Array.isArray(area.pontos) && area.pontos.length >= 3) {
      const latLngs = area.pontos.map(p => {
        const px = Number(p[0]);
        const py = Number(p[1]);
        return [alturaGlobalImagem - py, px];
      });

      layer = L.polygon(latLngs, {
        color: 'transparent',
        weight: 1,
        opacity: 0,
        fillOpacity: 0,
        stroke: false
      });

      layer.on('mouseover', () => {
        if (mapaLeaflet && mapaLeaflet.getContainer) {
          mapaLeaflet.getContainer().style.cursor = 'pointer';
        }
        layer.setStyle({
          color: '#ffffff',
          weight: 1,
          opacity: 0.4,
          fillColor: '#3b82f6',
          fillOpacity: 0.3,
          stroke: true
        });
        layer.openPopup();
      });

      layer.on('mouseout', () => {
        if (mapaLeaflet && mapaLeaflet.getContainer) {
          mapaLeaflet.getContainer().style.cursor = '';
        }
        layer.setStyle({
          color: 'transparent',
          weight: 1,
          opacity: 0,
          fillOpacity: 0,
          stroke: false
        });
        layer.closePopup();
      });

    } else {
      const x = Number(area.x);
      const y = Number(area.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;

      const yCorrigido = alturaGlobalImagem - y;

      layer = L.circleMarker([yCorrigido, x], {
        radius: 22,
        opacity: 0,
        fillOpacity: 0,
        stroke: false
      });

      layer.on('mouseover', () => {
        if (mapaLeaflet && mapaLeaflet.getContainer) {
          mapaLeaflet.getContainer().style.cursor = 'pointer';
        }
        layer.openPopup();
      });

      layer.on('mouseout', () => {
        if (mapaLeaflet && mapaLeaflet.getContainer) {
          mapaLeaflet.getContainer().style.cursor = '';
        }
        layer.closePopup();
      });
    }

    if (!layer) return;

    const conteudoPopup = `
      <div class="popup-area-box">
        ${fotoPath ? `<img class="popup-area-thumb" src="${fotoPath}" alt="Miniatura da area">` : '<div class="popup-area-sem-foto">Sem miniatura</div>'}
        <div class="popup-area-titulo">${String(area.nome_area || '-')}</div>
        <div class="popup-area-linha"><strong>Previsto:</strong> ${fmtPct(previsto)}</div>
        <div class="popup-area-linha"><strong>Realizado:</strong> ${fmtPct(real)}</div>
      </div>
    `;

    layer.bindPopup(conteudoPopup, {
      closeButton: false,
      autoClose: false,
      closeOnClick: false,
      autoPan: false,
      className: 'popup-area-drenagem'
    });

    layer.on('click', () => {
      if (!area.foto_miniatura) {
        setStatus(`Area ${area.nome_area || '-'} sem imagem vinculada.`);
        return;
      }
      abrirFotoEmMoldura(fotoPath, area.nome_area || 'Foto da area');
      setStatus(`Abrindo imagem da area ${area.nome_area || '-'}. Previsto ${fmtPct(previsto)} / Realizado ${fmtPct(real)}.`);
    });

    camadaMarcadores.addLayer(layer);
  });
}

function resumirPorServico(registros) {
  const porServico = new Map();

  // Filtra de forma acumulada até o período selecionado para os valores mudarem dinamicamente
  const registrosAtePeriodo = registros.filter(r => {
    if (FILTRO_VIEW.mes) {
      const mReg = mesChave(r.mes_referencia);
      if (mReg && mReg > FILTRO_VIEW.mes) return false;
    }
    if (FILTRO_VIEW.semana && FILTRO_VIEW.semana !== '-') {
      const semReg = Number(r.semana);
      const semFiltro = Number(FILTRO_VIEW.semana);
      if (Number.isFinite(semReg) && Number.isFinite(semFiltro)) {
        if (semReg > semFiltro) return false;
      }
    }
    return true;
  });

  // Fallback seguro: se o filtro estrito resultar vazio, utiliza todos os registros para nunca deixar os KPIs vazios
  const baseRegistros = registrosAtePeriodo.length > 0 ? registrosAtePeriodo : registros;

  baseRegistros.forEach(r => {
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
  renderizarAreasNoMapa(resumo);
  setStatus(`Exibindo ${resumo.length} serviços notáveis para ${FILTRO_VIEW.contratada || 'todas'} / ${FILTRO_VIEW.mes ? mesComoLabel(FILTRO_VIEW.mes) : 'todos os meses'} / ${FILTRO_VIEW.semana !== '-' ? FILTRO_VIEW.semana : 'todas as semanas'}.`);
}

async function carregarServicosNotaveis() {
  const resp = await fetch(`../dados/servicos_notaveis.json?v=${Date.now()}`);
  if (!resp.ok) throw new Error(`Falha ao carregar servicos_notaveis.json (${resp.status})`);
  return resp.json();
}

async function carregarConfigRelatorio() {
  try {
    const resp = await fetch(`../dados/config.json?v=${Date.now()}`);
    if (!resp.ok) {
      const fallback = await fetch(`../dados/dados.json?v=${Date.now()}`);
      if (!fallback.ok) return null;
      const json = await fallback.json();
      return json.config_padrao || null;
    }
    return resp.json();
  } catch (err) {
    return null;
  }
}

async function bootstrap() {
  try {
    const [registros, configPadrao, areasMapeadas] = await Promise.all([
      carregarServicosNotaveis(),
      carregarConfigRelatorio(),
      carregarMapeamentoAreas()
    ]);

    window.__MAPA_DADOS__ = registros;
    window.__RELATORIO_CONFIG__ = configPadrao || {};
    cacheAreasMapeadas = areasMapeadas;

    setSidebarInfo(registros, configPadrao);
    inicializarMapaLeaflet();
  } catch (err) {
    console.error(err);
    setStatus('Falha ao carregar dados da página.');
  }
}

document.addEventListener('DOMContentLoaded', bootstrap);