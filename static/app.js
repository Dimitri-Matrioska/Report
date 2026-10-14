const kpiRoot = document.getElementById('kpis');
const actionsList = document.getElementById('actionsList');
const statusList = document.getElementById('statusList');
const metadataBox = document.getElementById('metadata-box');
const disciplineFilter = document.getElementById('discipline-filter');
const statusFilter = document.getElementById('status-filter');
const title = document.getElementById('report-title');

const formatNumber = (value) => new Intl.NumberFormat('pt-BR').format(value);
const formatPercent = (value) => `${Number(value).toFixed(1)}%`;
let reportChart = null;

function renderKpis(cards) {
  const cardsDefinition = [
    { label: 'Emitidos', value: cards.emitidos, suffix: '' },
    { label: 'A emitir', value: cards.a_emitir, suffix: '' },
    { label: 'No prazo', value: cards.no_prazo, suffix: '' },
    { label: 'Atrasados', value: cards.atrasados, suffix: '' },
    { label: 'Progresso', value: cards.progresso_geral, suffix: '%' },
  ];

  kpiRoot.innerHTML = cardsDefinition.map((item) => `
    <article class="kpi-card">
      <div class="label">${item.label}</div>
      <div class="value">${item.suffix === '%' ? formatPercent(item.value) : formatNumber(item.value)}</div>
    </article>
  `).join('');
}

function renderList(target, entries) {
  if (!entries || !entries.length) {
    target.innerHTML = '<li><span>Sem dados</span></li>';
    return;
  }

  target.innerHTML = entries
    .slice(0, 6)
    .map((entry) => `
      <li>
        <span>${entry.label}</span>
        <span class="count">${entry.valor}</span>
      </li>
    `)
    .join('');
}

function renderPbipParameters(layout) {
  const entries = [];
  layout.pages.forEach((page) => {
    page.visuals.forEach((visual) => {
      if (!visual.fields || !visual.fields.length) return;
      entries.push({
        page: page.displayName,
        visualType: visual.visualType,
        fieldList: visual.fields,
        position: visual.position,
      });
    });
  });

  const cards = entries.slice(0, 8).map((entry) => `
    <div class="metadata-card">
      <h3>${entry.visualType}</h3>
      <p><strong>${entry.page}</strong></p>
      <p>x:${entry.position.x ?? '-'} y:${entry.position.y ?? '-'} / w:${entry.position.width ?? '-'} h:${entry.position.height ?? '-'}</p>
      <ul>${entry.fieldList.map((field) => `<li>${field}</li>`).join('')}</ul>
    </div>
  `).join('');

  metadataBox.innerHTML = cards || '<div class="metadata-card"><h3>Parâmetros BI</h3><p>Nenhum parâmetro PBIP encontrado.</p></div>';
}

function renderMetadata(meta) {
  const info = `
    <div class="metadata-card">
      <h3>Relatório</h3>
      <p>${meta.report_name}</p>
    </div>
    <div class="metadata-card">
      <h3>Páginas</h3>
      <p>${meta.page_count} páginas detectadas</p>
    </div>
    <div class="metadata-card">
      <h3>Tabelas</h3>
      <ul>${meta.tables.slice(0, 6).map((table) => `<li>${table}</li>`).join('')}</ul>
    </div>
    <div class="metadata-card">
      <h3>Observação</h3>
      <ul>${meta.notes.map((note) => `<li>${note}</li>`).join('')}</ul>
    </div>
  `;
  metadataBox.innerHTML = info;
}

function fillFilters(payload) {
  const disciplineOptions = ['<option value="all">Todas</option>']
    .concat(payload.filters.disciplinas.map((item) => `<option value="${item}">${item}</option>`))
    .join('');

  const statusOptions = ['<option value="all">Todos</option>']
    .concat(payload.filters.status.map((item) => `<option value="${item}">${item}</option>`))
    .join('');

  disciplineFilter.innerHTML = disciplineOptions;
  statusFilter.innerHTML = statusOptions;
}

async function loadDashboard() {
  const [dashboardJson, metadataJson, layoutJson] = await Promise.all([
    fetch('dashboard_data.json').then((res) => res.json()),
    fetch('report_metadata.json').then((res) => res.json()),
    fetch('pbip_layout.json').then((res) => res.json()),
  ]);

  const payload = dashboardJson;
  title.textContent = payload.report_title;
  renderKpis(payload.cards);
  renderList(actionsList, payload.status);
  renderList(statusList, payload.items);
  renderPbipParameters(layoutJson);
  fillFilters(payload);

  const labels = payload.disciplinas.map((item) => item.label).slice(0, 8);
  const values = payload.disciplinas.map((item) => item.progresso).slice(0, 8);

  if (reportChart) {
    reportChart.destroy();
  }

  reportChart = new Chart(document.getElementById('disciplineChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Progresso médio',
        data: values,
        borderRadius: 8,
        backgroundColor: ['#0e6ca9', '#1ab9d0', '#92d0ff', '#f5b84c', '#74c69d', '#de7b5a', '#6f8cff', '#7d9cbf'],
        borderColor: '#0d1f2d',
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      animation: false,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: {
          beginAtZero: false,
          ticks: {
            callback: (value) => `${value}%`,
          },
        },
      },
    },
  });
}

loadDashboard().catch((error) => {
  console.error(error);
  document.body.innerHTML = '<div style="padding: 40px; color: #fff; background: #012a42; font-family: sans-serif;">Não foi possível carregar o dashboard. Verifique se os JSONs foram gerados e se o servidor local está em execução.</div>';
});
