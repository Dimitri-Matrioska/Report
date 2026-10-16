# CONTEXTO DO PROJETO — BI HTML

## 🎯 Objetivo
Clonar relatório Power BI (.pbix) em HTML/CSS/JS estático para exibir
no site do cliente (que não tem ecossistema Microsoft). Dados servidos
via JSON, hospedados eventualmente no Cloudflare R2 (privado). HTML no
GitHub Pages (público).

## 🏗️ Arquitetura
- **Planilha Excel** (`DataBase/Dados_GeralReport_AFR.xlsx`) é a fonte
- **conversor/converter.py** converte abas do Excel em JSONs otimizados
- **dados/*.json** são consumidos pelo front-end
- **assets/** tem código compartilhado (não muda por página)
- **paginas/** tem o conteúdo específico de cada página do BI
- **imagens/** tem logos e fundos extraídos do PBIP original

## 📋 Decisões técnicas

### 1. Canvas fixo 1280x720 com imagem de fundo
Cada página usa uma imagem JPG de fundo (1280x720) extraída do PBIP.
Os elementos interativos (botões, filtros, KPIs, gráficos) são
sobrepostos em posições absolutas (extraídas do visual.json).

### 2. Escala responsiva com zoom (não scale!)
Usar `zoom: var(--escala)` em vez de `transform: scale()`. O scale
deixa o texto borrado; o zoom mantém nitidez.

### 3. Reaproveitamento total
Todo código de `assets/` é compartilhado entre todas as páginas.
Só `paginas/<nome>.*` é específico.

### 4. Fórmulas DAX replicadas em JS
As medidas DAX foram extraídas do `.SemanticModel/definition/tables/*.tmdl`
e estão em `assets/pbi.js` ou nas funções `calc*` de cada página.

**Regra crítica do _Desvio:**
```dax
_Desvio = CALCULATE(MAX('% Físico Total'[Real Acum]) - MAX('% Físico Total'[Baseline 1 Acum]))