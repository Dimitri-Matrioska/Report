const MENU_ITENS = [
  { id: 'stma',                  label: 'STMA' },
  { id: 'performance-semanal',   label: 'PERFORMANCE SEMANAL' },
  { id: 'mapa-avanco',           label: 'MAPA AVANÇO' },
  { id: 'mapa-avanco-drenagem',  label: 'MAPA AVANÇO DRENAGEM' },
  { id: 'pluviometria',          label: 'PLUVIOMETRIA' },
];
function renderSidebar() {
  const path = window.location.pathname.toLowerCase();
  const atual = MENU_ITENS.find(m => path.includes(m.id));
  const menuHtml = MENU_ITENS.map(m => {
    const ativo = atual && atual.id === m.id ? ' active' : '';
    return '<a href="./' + m.id + '.html" class="' + ativo.trim() + '">' + m.label + '</a>';
  }).join('');
  return '<aside class="sidebar">' +
    '<div class="sidebar-logo">' +
      '<img src="../imagens/logo-boticario.png" alt="Grupo Boticario" class="logo-img-boticario">' +
      '<div class="logo-sub">PROJETO AFRODITE</div>' +
    '</div>' +
    '<div class="sidebar-titles">' +
      '<div class="titulo">PERFORMANCE<br>CONTRATADAS</div>' +
    '</div>' +
    '<div class="sidebar-filtros">' +
      '<label class="filtro-label">Contratada</label>' +
      '<select class="filtro-select"><option>TERRAM ENGENHARI...</option></select>' +
      '<label class="filtro-label">Ano, Mês</label>' +
      '<select class="filtro-select"><option>2026 (Ano) + outubr...</option></select>' +
      '<label class="filtro-label">SemanaDoProjeto</label>' +
      '<select class="filtro-select"><option>31</option></select>' +
    '</div>' +
    '<nav class="sidebar-menu">' + menuHtml + '</nav>' +
    '<div class="sidebar-footer">' +
      '<img src="../imagens/logo-afry.png" alt="AFRY" class="logo-img-afry">' +
    '</div>' +
  '</aside>';
}
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('sidebar-container');
  if (container) container.outerHTML = renderSidebar();
});
