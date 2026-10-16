# ANTES DE MEXER — Página de referência

## Página modelo: PERFORMANCE SEMANAL
Arquivos funcionando:
- paginas/performance-semanal.html
- paginas/performance-semanal.css
- paginas/performance-semanal.js

## Regras obrigatórias
1. NÃO criar sidebar separada em HTML. A sidebar (com logo Boticário + filtros + botões + AFRY) JÁ ESTÁ dentro da imagem `fundo-performance-semanal.jpg`.
2. Botões do menu e filtros são SOBREPOSTOS na imagem via `position: absolute`.
3. Canvas é 1280x720 com `zoom: var(--escala)` para responsividade nítida.
4. KPIs têm dois estilos: `.kpi-flat` (topo, sem borda) e `.kpi-bordered` (com accent bar).
5. Fórmulas DAX estão em `assets/pbi.js` (funções genéricas) ou nas funções `calc_*` de cada página.
6. `fmt.pct` multiplica por 100 — os valores de baseline são decimais (0.63 = 63%).

## O que NÃO fazer
- ❌ Criar `<div id="sidebar-container">`
- ❌ Carregar `assets/sidebar.js`
- ❌ Cortar a imagem de fundo
- ❌ Duplicar sidebar