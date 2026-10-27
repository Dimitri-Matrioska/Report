---
{}
---

In paginas/stma.js, the "renderTabela" function must list ONLY desvios "Grave" whose date belongs to FILTROS.mes (reference month of the filter). Never fall back to accumulated data. Show only the "descricao_macro" field (empty/null -> placeholder), and never repeat the same macro description twice.