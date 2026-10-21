# CONTEXTO DO PROJETO — BI HTML

## 🎯 Objetivo
Clonar relatório Power BI (.pbix) em HTML/CSS/JS estático para exibir
no site do cliente (que não tem ecossistema Microsoft). Dados servidos
via JSON, hospedados eventualmente no Cloudflare R2 (privado). HTML no
GitHub Pages (público).

## 🏗️ Arquitetura

- **Planilha Excel** (`DataBase/Dados_GeralReport_AFR.xlsx`) é a fonte
- **gerador/linkar_dados.py** lê a planilha e gera os JSONs **crus** em `dados/`
- **gerador/agregacoes.py** materializa as medidas DAX (count/sum/avg/distinct…)
  e grava `dados/agregacoes.json`
- **gerador/gerar.py** extrai a estrutura do PBIP e renderiza `paginas/*`
- **dados/*.json** são consumidos pelo front-end
- **assets/** tem código compartilhado (não muda por página)
- **paginas/** tem o conteúdo específico de cada página do BI
- **imagens/** tem logos e fundos extraídos do PBIP original

> **Legacy (aposentado):** `conversor/converter.py` e
> `gerador/coletar_dados.py` não fazem mais parte do pipeline. Foram
> substituídos por `linkar_dados.py` + `agregacoes.py`. Mantidos apenas
> como histórico — não usar em builds novos (ver seção 8).

## 🔄 Pipeline de dados

```
DataBase/Dados_GeraisReport_AFR.xlsx
        │
        │  python gerador/linkar_dados.py     (13 abas → 13 JSONs crus)
        ▼
dados/*.json            (registros linha-a-linha, sem agregação)
        │
        │  python gerador/agregacoes.py       (medidas DAX + contexto de filtro)
        ▼
dados/agregacoes.json   {dataset: {contexto, registros, medidas}}
        │
        ▼
paginas/*.js  ←  fetch(BASE_URL + '/agregacoes.json')
```

Regenerar tudo em sequência:

```powershell
python gerador/linkar_dados.py
python gerador/agregacoes.py
python gerador/gerar.py
```

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
```

### 5. Link planilha → JSON é declarativo (`linkar_dados.py`)
`gerador/linkar_dados.py` substitui o antigo `coletar_dados.py`, que cobria
só 3 abas. A lógica é declarativa: a lista `SPECS` descreve, para cada aba,
o nome do JSON de saída e as colunas de interesse.

| JSON | Aba | Registros |
|---|---|---|
| `fisico_total` | % Físico Total | 621 |
| `pluviometria` | Pluviometria | 243 |
| `status_semanal` | Status Semanal | 120 |
| `stma` | STMA | 526 |
| `sla` | SLA | 153 |
| `medicoes` | Medições | 237 |
| `milestones` | Milestones | 48 |
| `acoes` | Ações | 7 |
| `igpp_gf` | IGPP-GF | 96 |
| `desvios_stma` | Desvios STMA | 741 |
| `histograma` | Histograma | 599 |
| `dados_contrato` | Dados Contrato | 16 |
| `servicos_notaveis` | Serviços Notáveis | 685 |

Características:

- **Colunas resolvidas por apelido tolerante** — `achar_coluna()` compara
  nomes normalizados (sem acento, minúsculo, espaços colapsados), tenta
  match exato e depois substring. Renomear uma coluna no Excel não quebra
  a geração; apenas emite `[aviso] colunas ausentes -> [...]`.
- **`achar_aba()`** também é tolerante a variações de encoding/acentuação.
- **Tipagem explícita** via dicionário `TIPOS` (`texto`, `data`, `num`,
  `int`, `flag`). `num()` aceita vírgula decimal; `iso_data()` normaliza
  para `YYYY-MM-DD`.
- **Escrita atômica**: grava `<nome>.json.tmp` e faz `os.replace()` — nunca
  deixa um JSON pela metade se o processo morrer.
- **`versao.json` descreve o estado atual da pasta** (via `_inventario()`),
  não só o subconjunto regerado. Rodar `--somente sla` não apaga do manifesto
  os outros 12 datasets.

CLI:

```powershell
python gerador/linkar_dados.py                 # regera todos
python gerador/linkar_dados.py --somente stma  # apenas um
python gerador/linkar_dados.py --verificar     # dry-run, não grava
python gerador/linkar_dados.py --xlsx outro.xlsx
```

Como biblioteca:

```python
from gerador.linkar_dados import linkar_dados
linkar_dados()           # dict {json: n_registros}
```

> **Pegadinha documentada:** em `milestones`, o campo `mes_referencia` não
> contém data — vem com o rótulo `"OLD"`. Por isso o spec declara o tipo
> `texto`, e não `data` (que aceitaria a string silenciosamente).

### 6. Agregações DAX materializadas em Python (`agregacoes.py`)
O link gera registros **crus**; mas os visuais do PBIP apontam para campos
agregados (`Count(Desvios STMA.ID)`, `Sum(Medições.Aderência)`,
`STMA.Resultado`) que não existem linha-a-linha. `gerador/agregacoes.py`
fecha essa lacuna.

- **Catálogo declarativo `PAGINAS`**: cada página lista os datasets que usa
  e as medidas que consome.
- **Materialização**: `aplicar_agregacoes()` copia cada registro e injeta os
  campos agregados. Medidas agregadas recebem o **mesmo valor em todas as
  linhas** (o valor do contexto filtrado) — reproduz o comportamento de
  slicer do Power BI. Medidas `expr` são calculadas linha a linha.
- **Unicidade por dataset**: um dataset declarado por várias páginas tem as
  listas de medidas **unificadas** (senão a última declaração apagaria as
  anteriores). Ex.: `fisico_total` é usado por `performance-semanal`,
  `one-page` e `detalhe-one-page`.
- **Contexto de filtro automático** (`_contexto_padrao`): contratada
  principal (a que mais aparece, = TERRAM) + último mês **em execução**.
  O contexto fica gravado em `dados/agregacoes.json` para auditoria.
- **O filtro de mês aceita qualquer campo de data** (`mes_referencia`,
  `mes` ou `data`), porque nem todo dataset tem `mes` preenchido.

Tipos de medida suportados: `count`, `counta`, `distinct`, `sum`, `avg`,
`min`, `max`, `const`, `expr` (expressão binária linha a linha).

**Como o "mês em execução" é escolhido** (a parte mais delicada):

1. Só datas ISO (`YYYY-MM-DD`) são candidatas — rótulos como `"OLD"`
   (Milestones) são ignorados.
2. Um mês precisa ter ao menos `MIN_CONTEUDO = 3` campos de conteúdo.
   Colunas de calendário/acumulado (`historica_*`, `baseline_1_acum`,
   `real_acum`, `projetado_acum`) estão em `CAMPOS_ESTRUTURAIS` e **não
   contam**: o Excel as preenche até o fim do contrato.
3. Entre os meses completos, prioriza os que têm alguma medida **real**
   (campo `real` não vazio) — meses futuros do calendário têm previsão,
   mas nenhum realizado.
4. Por fim, entre os meses "em andamento" (≥ metade do conteúdo do mês mais
   completo), vence o mais recente.

> **Pegadinha documentada:** o Excel preenche o calendário até o fim do
> contrato. Sem essas regras, `fisico_total` escolhia **out/2030** e
> `servicos_notaveis`/`histograma` meses de 2027 — todos futuros e vazios,
> zerando os KPIs. Com as regras acima os três caem em **out/2026**.

### 7. Consumo no front-end
`dados/agregacoes.json` tem o formato:

```json
{
  "stma": {
    "contexto": { "contratada": "TERRAM ...", "mes_referencia": "2026-10-31" },
    "medidas": ["resultado_count", "resultado_sum", "resultado_media"],
    "registros": [
      { "...campos crus...": "...", "resultado_count": 6.0, "resultado_sum": 206919.0 }
    ]
  }
}
```

As páginas continuam carregando os JSONs crus
(`BASE_URL + '/<dataset>.json'`) para os gráficos interativos; o catálogo
serve como referência determinística para KPIs que precisam bater com o
valor do PDF de referência.

### 8. Ponto de entrada do build
O build oficial é:

```powershell
python gerador/linkar_dados.py   # 1) Excel → dados/*.json
python gerador/agregacoes.py     # 2) dados/*.json → dados/agregacoes.json
python gerador/gerar.py          # 3) PBIP → paginas/*.html/.css/.js
```

`gerar.py` faz backup automático de cada página em `paginas/_backup/`
antes de sobrescrever.

**Não** execute `gerador/coletar_dados.py` nem `conversor/converter.py`:
eles geram apenas 3 datasets e sobrescreveriam `versao.json` com um
manifesto parcial, além de produzirem valores divergentes do link novo.

## ⚠️ Armadilhas conhecidas

- PowerShell **não** aceita `&&` como separador de comandos; rode cada
  comando em uma linha separada.
- Os JSONs grandes (`fisico_total.json` ~220 KB, `desvios_stma.json`) não
  renderizam na pré-visualização de alguns editores — verifique a
  integridade com `python -c "import json; json.load(open(...))"`.
- Abas da planilha ainda **não** mapeadas: `Atividades Diárias`,
  `Histograma Diário - Real`, `Cronograma Geral`, `2WLA e 8WLA`,
  `% Físico Entregas`, `Ações Desvios`, `Condicionantes MA`,
  `Ponderação Crono Integrado`, `Engenharia`, `Calendário`.
  Para mapear uma delas, basta adicionar uma entrada em `SPECS`
  (`linkar_dados.py`) e registrar as medidas em `PAGINAS` (`agregacoes.py`).
