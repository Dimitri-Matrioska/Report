/* ============================================================
   {{TITULO}} — gerado automaticamente
   ============================================================ */

{{FUNCOES_CALCULO}}

async function carregarDados() {
  const v = Date.now();
  const [fisico, pluviometria] = await Promise.all([
    fetch(BASE_URL + '/fisico_total.json?v=' + v).then(r => r.json()),
    fetch(BASE_URL + '/pluviometria.json?v=' + v).then(r => r.json())
  ]);
  return { fisico, pluviometria };
}

{{RENDER_KPIS}}

{{RENDER_GRAFICOS}}

async function render() {
  try {
    const dados = await carregarDados();
    renderizarKPIs(dados);
    renderizarGraficos(dados);
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