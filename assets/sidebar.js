/* ============================================================
   SIDEBAR.JS — Injeta a sidebar em qualquer página
   Uso: <div id="sidebar-container"></div> + <script src="../assets/sidebar.js"></script>
   ============================================================ */

const MENU_ITENS = [
  { id: 'stma',                  label: 'STMA' },
  { id: 'performance-semanal',   label: 'PERFORMANCE SEMANAL' },
  { id: 'mapa-avanco',           label: 'MAPA AVANÇO' },
  { id: 'mapa-avanco-drenagem',  label: 'MAPA AVANÇO DRENAGEM' },
  { id: 'pluviometria',          label: 'PLUVIOMETRIA' },
];

function renderSidebar() {
  // Detecta qual página está ativa pela URL
  const path = window.location.pathname.toLowerCase();
  const atual = MENU_ITENS.find(m => path.includes(m.id));

  const menuHtml = MENU_ITENS
    .map(m => {
      const ativo = atual && atual.id === m.id ? ' active' : '';
      return `<a href="./${m.id}.html" class="${ativo.trim()}">${m.label}</a>`;
    })
    .join('');

  return `
    <aside class="sidebar">
      <div class="sidebar-logo">
        <div class="logo-top">GrupoBoticário</div>
        <div class="logo-sub">PROJETO AFRODITE</div>
      </div>

      <div class="sidebar-titles">
        <div class="titulo">PERFORMANCE GERAL</div>
        <div class="subtitulo">TERRAM ENGENHARIA</div>
      </div>

      <div class="sidebar-filtros">
        <div class="filtro-label">Ano, Mês</div>
        <div class="filtro-valor">2026 (Ano) + outubr...</div>
        <div class="filtro-label">SemanaDoProjeto</div>
        <div class="filtro-valor">31</div>
      </div>

      <nav class="sidebar-menu">
        ${menuHtml}
      </nav>

      <div class="sidebar-footer">AFRY</div>
    </aside>
  `;
}

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('sidebar-container');
  if (container) {
    container.outerHTML = renderSidebar();
  }
});