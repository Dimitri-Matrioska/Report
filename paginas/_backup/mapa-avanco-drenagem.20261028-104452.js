const MESES = [
  'janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
];

const DEF_CONTRATADA = 'TERRAM';
const TIF_URLS = [
  '../ortofoto/ortofoto.tif',
  '/ortofoto/ortofoto.tif'
];
const JSON_POLIGONOS_URL = BASE_URL + '/mapa_avanco_drenagem_poligonais.json';
const IMG_FALLBACK_URL = '../imagens/fundo-mapa-avanco-drenagem.jpg';

let FILTROS = { contratada: null, mes: null, semana: null };
let DADOS_FILTRO = [];
let mapa = null;
let rasterLayer = null;
let polygonsLayer = null;

function urlRecurso(path) {
  // Em file://, query string pode invalidar o caminho local do arquivo.
  if (window.location.protocol === 'file:') return path;
  return `${path}?v=${Date.now()}`;
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

function abrevia(txt, max) {
  if (!txt) return '';
  return txt.length > max ? txt.slice(0, max - 1) + '...' : txt;
}

function mesValor(mesIso) {
  if (!mesIso) return '';
  const [ano, mes] = mesIso.split('-');
  return ano + ' (Ano) + ' + MESES[parseInt(mes, 10) - 1];
}

function parsePercent(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return n <= 1 ? n * 100 : n;
}

function fmtPct(v) {
  if (v == null || Number.isNaN(v)) return '--';
  return `${v.toFixed(0)}%`;
}

function setStatus(texto) {
  const el = document.getElementById('status-superior');
  if (el) el.textContent = texto;
}

function mostrarMensagemMapa(texto) {
  const el = document.getElementById('mapa-mensagem');
  if (!el) return;
  el.hidden = false;
  el.textContent = texto;
}

function esconderMensagemMapa() {
  const el = document.getElementById('mapa-mensagem');
  if (!el) return;
  el.hidden = true;
}

function initMap() {
  if (mapa) return;

  mapa = L.map('mapa-leaflet', {
    zoomControl: true,
    attributionControl: false,
    preferCanvas: true
  }).setView([-16.5, -49.3], 15);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 20
  }).addTo(mapa);
}

async function carregarRasterGeotiff() {
  let ultimoErro = null;

  for (const tifUrl of TIF_URLS) {
    try {
      const recurso = urlRecurso(tifUrl);
      const resp = await fetch(recurso);
      if (!resp.ok) throw new Error(`HTTP ${resp.status} em ${tifUrl}`);

      const arr = await resp.arrayBuffer();
      const georaster = await parseGeoraster(arr);

      rasterLayer = new GeoRasterLayer({
        georaster,
        opacity: 1,
        resolution: 256,
        pixelValuesToColorFn: null
      });

      rasterLayer.addTo(mapa);
      mapa.fitBounds(rasterLayer.getBounds());
      esconderMensagemMapa();
      setStatus(`Ortofoto carregada: ${tifUrl}`);
      return true;
    } catch (err) {
      ultimoErro = err;
      console.warn(`Falha ao carregar GeoTIFF em ${tifUrl}:`, err);
    }
  }

  const detalhe = ultimoErro?.message || String(ultimoErro || 'erro desconhecido');
  mostrarMensagemMapa(`Falha ao abrir ortofoto.tif. Detalhe: ${detalhe}`);
  setStatus('Nao foi possivel carregar o GeoTIFF; fallback em imagem foi aplicado.');
  return false;
}

async function carregarPoligonosJson() {
  try {
    const resp = await fetch(urlRecurso(JSON_POLIGONOS_URL));
    if (!resp.ok) throw new Error(`JSON de poligonais nao encontrado (${resp.status})`);

    const raw = await resp.json();
    const geojson = normalizarParaGeoJson(raw);

    if (!geojson.features.length) {
      mostrarMensagemMapa('Arquivo de poligonais carregado, mas sem geometrias.');
      return geojson;
    }

    polygonsLayer = L.geoJSON(geojson, {
      style: () => ({
        color: '#1f1f1f',
        weight: 2,
        opacity: 0.95,
        fillColor: '#f9d549',
        fillOpacity: 0.08
      }),
      onEachFeature: (feature, layer) => {
        const nome = feature?.properties?.nome || feature?.properties?.area || feature?.properties?.id || 'Area sem nome';
        layer.bindTooltip(String(nome), { className: 'area-tooltip', sticky: true });

        layer.on('mouseover', () => {
          layer.setStyle({ fillOpacity: 0.28, color: '#ffef66', weight: 2.5 });
        });
        layer.on('mouseout', () => {
          layer.setStyle({ fillOpacity: 0.08, color: '#1f1f1f', weight: 2 });
        });
      }
    }).addTo(mapa);

    if (!rasterLayer) {
      mapa.fitBounds(polygonsLayer.getBounds(), { padding: [15, 15] });
    }

    return geojson;
  } catch (err) {
    console.warn('Falha ao carregar poligonais:', err);
    mostrarMensagemMapa('Poligonais ainda nao disponiveis em dados/mapa_avanco_drenagem_poligonais.json.');
    return { type: 'FeatureCollection', features: [] };
  }
}

function normalizarParaGeoJson(raw) {
  if (raw && raw.type === 'FeatureCollection' && Array.isArray(raw.features)) return raw;

  if (Array.isArray(raw)) {
    const features = raw
      .map((item, idx) => {
        if (!item) return null;

        if (item.type === 'Feature' && item.geometry) return item;

        const coords = item.coordinates || item.coordenadas || item.points || null;
        if (!Array.isArray(coords) || !coords.length) return null;

        const ring = coords.map(p => [Number(p[0]), Number(p[1])]).filter(p => !Number.isNaN(p[0]) && !Number.isNaN(p[1]));
        if (ring.length < 3) return null;

        if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
          ring.push([ring[0][0], ring[0][1]]);
        }

        return {
          type: 'Feature',
          properties: {
            id: item.id || `area_${idx + 1}`,
            nome: item.nome || item.area || `Area ${idx + 1}`,
            ...item
          },
          geometry: {
            type: 'Polygon',
            coordinates: [ring]
          }
        };
      })
      .filter(Boolean);

    return { type: 'FeatureCollection', features };
  }

  return { type: 'FeatureCollection', features: [] };
}

function atualizarKPIsPorPoligonos(geojson) {
  const grupos = {
    escadas: { prev: [], real: [] },
    subestacao: { prev: [], real: [] },
    canteiro: { prev: [], real: [] }
  };

  geojson.features.forEach(f => {
    const p = f.properties || {};
    const nome = String((p.grupo || p.frente || p.nome || '')).toLowerCase();
    const prev = parsePercent(p.previsto ?? p.avanco_previsto ?? p.prev);
    const real = parsePercent(p.real ?? p.avanco_real);

    if (nome.includes('escada')) {
      if (prev != null) grupos.escadas.prev.push(prev);
      if (real != null) grupos.escadas.real.push(real);
    } else if (nome.includes('subestacao')) {
      if (prev != null) grupos.subestacao.prev.push(prev);
      if (real != null) grupos.subestacao.real.push(real);
    } else if (nome.includes('canteiro')) {
      if (prev != null) grupos.canteiro.prev.push(prev);
      if (real != null) grupos.canteiro.real.push(real);
    }
  });

  aplicarKpi('kpi-escadas-prev', media(grupos.escadas.prev));
  aplicarKpi('kpi-escadas-real', media(grupos.escadas.real));
  aplicarKpi('kpi-sub-prev', media(grupos.subestacao.prev));
  aplicarKpi('kpi-sub-real', media(grupos.subestacao.real));
  aplicarKpi('kpi-cant-prev', media(grupos.canteiro.prev));
  aplicarKpi('kpi-cant-real', media(grupos.canteiro.real));
}

function media(vs) {
  if (!vs.length) return null;
  return vs.reduce((a, b) => a + b, 0) / vs.length;
}

function aplicarKpi(id, valor) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = fmtPct(valor);
}

async function carregarDadosFiltros() {
  const resp = await fetch(urlRecurso(BASE_URL + '/fisico_total.json'));
  if (!resp.ok) throw new Error('Nao foi possivel carregar fisico_total.json');
  DADOS_FILTRO = await resp.json();
}

function popularFiltros() {
  const contratadas = [...new Set(DADOS_FILTRO.map(d => d.contratada).filter(Boolean))].sort();
  const meses = [...new Set(DADOS_FILTRO.map(d => d.mes).filter(Boolean))].sort();

  FILTROS.contratada = contratadas.find(c => c.toUpperCase().includes(DEF_CONTRATADA)) || contratadas[0] || null;
  FILTROS.mes = meses[meses.length - 1] || null;

  popularDropdownContratada(contratadas);
  popularDropdownMes(meses);
  popularDropdownSemana();

  atualizarTextosFiltro();
}

function popularDropdownContratada(contratadas) {
  const drop = document.getElementById('drop-contratada');
  drop.innerHTML = '';

  contratadas.forEach(c => {
    const item = document.createElement('label');
    item.className = 'dropdown-item';
    item.innerHTML = `<input type="checkbox" value="${c}" ${c === FILTROS.contratada ? 'checked' : ''}> ${abrevia(c, 35)}`;
    item.querySelector('input').addEventListener('change', (ev) => {
      FILTROS.contratada = ev.target.checked ? ev.target.value : null;
      document.querySelectorAll('#drop-contratada input').forEach(cb => { if (cb !== ev.target) cb.checked = false; });
      popularDropdownSemana();
      atualizarTextosFiltro();
    });
    drop.appendChild(item);
  });
}

function popularDropdownMes(meses) {
  const drop = document.getElementById('drop-mes');
  drop.innerHTML = '';

  const anos = [...new Set(meses.map(m => m.split('-')[0]))];
  anos.forEach(ano => {
    const grupo = document.createElement('div');
    grupo.innerHTML = `<div class="dropdown-group-title">${ano} <span>▾</span></div><div class="dropdown-group-items"></div>`;

    const header = grupo.querySelector('.dropdown-group-title');
    const items = grupo.querySelector('.dropdown-group-items');
    header.addEventListener('click', () => items.classList.toggle('active'));

    meses.filter(m => m.startsWith(ano)).forEach(m => {
      const item = document.createElement('label');
      item.className = 'dropdown-item';
      item.innerHTML = `<input type="checkbox" value="${m}" ${m === FILTROS.mes ? 'checked' : ''}> ${mesValor(m)}`;
      item.querySelector('input').addEventListener('change', (ev) => {
        FILTROS.mes = ev.target.checked ? ev.target.value : null;
        document.querySelectorAll('#drop-mes input').forEach(cb => { if (cb !== ev.target) cb.checked = false; });
        popularDropdownSemana();
        atualizarTextosFiltro();
      });
      items.appendChild(item);
    });

    drop.appendChild(grupo);
  });
}

function popularDropdownSemana() {
  const drop = document.getElementById('drop-semana');
  drop.innerHTML = '';

  const semanas = [...new Set(
    DADOS_FILTRO
      .filter(d => (!FILTROS.contratada || d.contratada === FILTROS.contratada) && (!FILTROS.mes || d.mes === FILTROS.mes))
      .map(d => Number(d.semana))
      .filter(v => !Number.isNaN(v))
  )].sort((a, b) => a - b);

  FILTROS.semana = semanas.length ? semanas[semanas.length - 1] : null;

  semanas.forEach(s => {
    const item = document.createElement('label');
    item.className = 'dropdown-item';
    item.innerHTML = `<input type="checkbox" value="${s}" ${s === FILTROS.semana ? 'checked' : ''}> ${s}`;
    item.querySelector('input').addEventListener('change', (ev) => {
      FILTROS.semana = ev.target.checked ? Number(ev.target.value) : null;
      document.querySelectorAll('#drop-semana input').forEach(cb => { if (cb !== ev.target) cb.checked = false; });
      atualizarTextosFiltro();
    });
    drop.appendChild(item);
  });
}

function atualizarTextosFiltro() {
  document.getElementById('txt-contratada').textContent = FILTROS.contratada ? abrevia(FILTROS.contratada, 26) : '-';
  document.getElementById('txt-mes').textContent = FILTROS.mes ? mesValor(FILTROS.mes) : '-';
  document.getElementById('txt-semana').textContent = FILTROS.semana != null ? String(FILTROS.semana) : '-';
}

function aplicarImagemFallbackNoMapa() {
  const imgBounds = [[-16.5045, -49.3045], [-16.4920, -49.2860]];
  L.imageOverlay(IMG_FALLBACK_URL, imgBounds, { opacity: 0.95 }).addTo(mapa);
  mapa.fitBounds(imgBounds);
  mostrarMensagemMapa('GeoTIFF nao encontrado no caminho padrao. Exibindo imagem de fundo provisoria.');
}

async function bootstrap() {
  try {
    initMap();
    await carregarDadosFiltros();
    popularFiltros();

    const rasterOk = await carregarRasterGeotiff();
    if (!rasterOk) aplicarImagemFallbackNoMapa();

    const geojson = await carregarPoligonosJson();
    atualizarKPIsPorPoligonos(geojson);

    setStatus('Base pronta. Estrutura preparada para hover detalhado por area na proxima etapa.');
  } catch (err) {
    console.error(err);
    setStatus('Falha na carga inicial da pagina de mapa.');
    mostrarMensagemMapa('Erro de inicializacao: ' + err.message);
  }
}

document.addEventListener('DOMContentLoaded', bootstrap);
