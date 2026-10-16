"""
gerar.py — Gerador automático de páginas HTML a partir do PBIP

Uso:
  python gerador/gerar.py

O script faz 2 coisas:
  1. EXTRAI    → lê todos os visual.json + page.json e gera _estrutura.json
  2. RENDERIZA → gera paginas/<slug>.html, .css, .js para cada página
"""

import os
import sys
import json
import re
import unicodedata

# Garante UTF-8 no terminal do Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# ============================================================
# CONFIGURAÇÃO
# ============================================================
RAIZ_PROJETO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

PBIP_BASE       = os.path.join(RAIZ_PROJETO, "PBIP", "Report")
PAGES_DIR       = os.path.join(PBIP_BASE, "definition", "pages")
IMAGENS_DIR     = os.path.join(RAIZ_PROJETO, "imagens")
SAIDA_DIR       = os.path.join(RAIZ_PROJETO, "paginas")
ESTRUTURA_JSON  = os.path.join(RAIZ_PROJETO, "gerador", "_estrutura.json")
BACKUP_DIR      = os.path.join(SAIDA_DIR, "_backup")

# ============================================================
# MAPEAMENTOS
# ============================================================
TIPOS_VISUAIS = {
    "cardVisual": "kpi",
    "clusteredColumnChart": "bar",
    "columnChart": "bar",
    "barChart": "bar_horizontal",
    "lineChart": "line",
    "lineClusteredColumnComboChart": "combo",
    "tableEx": "table",
    "pivotTable": "table",
    "gauge": "gauge",
    "slicer": "slicer",
    "pieChart": "pie",
    "donutChart": "donut",
}

TIPOS_IGNORADOS = {
    "shape", "textbox", "image", "pageNavigator",
    "basicShape", "text", "actionButton",
}

FUNCOES_DAX = {
    0: "count",
    1: "min",
    2: "max",
    3: "avg",
    4: "sum",
    5: "distinctCount",
}

# ============================================================
# MENU LATERAL (sobreposto na imagem de fundo)
# ------------------------------------------------------------
# Os botões e filtros NÃO são renderizados por assets/sidebar.js.
# Eles ficam sobrepostos na própria imagem de fundo, seguindo o
# padrão da página PERFORMANCE SEMANAL (paginas/performance-semanal.html).
# As posições (classes st-*) são calibradas no CSS gerado.
# ============================================================
MENU_ITENS = [
    {"slug": "stma",                 "label": "STMA"},
    {"slug": "performance-semanal",  "label": "PERFORMANCE SEMANAL"},
    {"slug": "mapa-avanco",          "label": "MAPA AVANÇO"},
    {"slug": "mapa-avanco-drenagem", "label": "MAPA AVANÇO DRENAGEM"},
    {"slug": "pluviometria",         "label": "PLUVIOMETRIA"},
]

FILTROS_SIDEBAR = [
    {"label": "Contratada",      "valor": "TERRAM ENGENHARI"},
    {"label": "Ano, Mês",        "valor": "2026 (Ano) + outubr"},
    {"label": "SemanaDoProjeto", "valor": "31"},
]

# Posições (top/height), em px absolutos do canvas 1280x720,
# calibradas conforme paginas/performance-semanal.css (st-btn-*).
POS_BOTOES_MENU = [
    {"top": 370, "height": 35},
    {"top": 415, "height": 50},
    {"top": 475, "height": 40},
    {"top": 525, "height": 50},
    {"top": 585, "height": 40},
]

# Posições dos filtros da sidebar (st-label-*/st-sel-*).
POS_FILTROS_LABEL = [190, 250, 310]
POS_FILTROS_SELECT = [208, 268, 328]


# ============================================================
# HELPERS
# ============================================================
def slugify(texto):
    texto = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    texto = texto.lower().strip()
    texto = re.sub(r"[^\w\s-]", "", texto)
    texto = re.sub(r"[\s_]+", "-", texto)
    texto = re.sub(r"-+", "-", texto)
    return texto.strip("-")


def formatar_px(v):
    return round(float(v), 2)


def garantir_ascii_seguro(texto):
    """Mantém UTF-8 correto mas evita surpresas."""
    if texto is None:
        return ""
    return str(texto).strip()


# ============================================================
# 1. EXTRAIR ESTRUTURA
# ============================================================
def extrair_paginas():
    caminho = os.path.join(PAGES_DIR, "pages.json")
    with open(caminho, encoding="utf-8") as f:
        pages_meta = json.load(f)

    paginas = []
    for page_id in pages_meta.get("pageOrder", []):
        page_json = os.path.join(PAGES_DIR, page_id, "page.json")
        if not os.path.isfile(page_json):
            continue

        with open(page_json, encoding="utf-8") as f:
            page = json.load(f)

        display = page.get("displayName", page_id)
        slug = slugify(display)

        fundo = None
        try:
            fundo_orig = page["objects"]["background"][0]["properties"]["image"]["image"]["url"]["expr"]["ResourcePackageItem"]["ItemName"]
            for arq in os.listdir(IMAGENS_DIR):
                if arq.startswith("fundo-") and slug in arq:
                    fundo = arq
                    break
            if not fundo:
                fundo = f"fundo-{slug}.jpg"
        except (KeyError, IndexError, TypeError):
            fundo = None

        paginas.append({
            "id": page_id,
            "slug": slug,
            "displayName": display,
            "largura": page.get("width", 1280),
            "altura": page.get("height", 720),
            "fundo": fundo,
        })

    return paginas


def extrair_visuais(page_id):
    visuals_dir = os.path.join(PAGES_DIR, page_id, "visuals")
    if not os.path.isdir(visuals_dir):
        return []

    visuais = []
    for vid in sorted(os.listdir(visuals_dir)):
        vjson = os.path.join(visuals_dir, vid, "visual.json")
        if not os.path.isfile(vjson):
            continue

        with open(vjson, encoding="utf-8") as f:
            v = json.load(f)

        tipo_pbi = v.get("visual", {}).get("visualType", "?")
        if tipo_pbi in TIPOS_IGNORADOS:
            continue

        componente = TIPOS_VISUAIS.get(tipo_pbi, "desconhecido")
        pos = v.get("position", {})

        visual = {
            "id": vid,
            "tipo_pbi": tipo_pbi,
            "componente": componente,
            "pos": {
                "x": formatar_px(pos.get("x", 0)),
                "y": formatar_px(pos.get("y", 0)),
                "w": formatar_px(pos.get("width", 0)),
                "h": formatar_px(pos.get("height", 0)),
            },
            "campos": extrair_campos(v),
            "filtros": extrair_filtros(v),
            "titulo": extrair_titulo(v, componente),
        }
        visuais.append(visual)

    return visuais


def extrair_campos(v):
    campos = {}
    qs = v.get("visual", {}).get("query", {}).get("queryState", {})
    for secao, conteudo in qs.items():
        projecoes = []
        for p in conteudo.get("projections", []):
            field = p.get("field", {})
            info = {
                "queryRef": p.get("queryRef"),
                "displayName": p.get("displayName"),
            }
            if "Column" in field:
                col = field["Column"]
                info["tipo"] = "column"
                info["entidade"] = col["Expression"]["SourceRef"]["Entity"]
                info["propriedade"] = col["Property"]
            elif "Aggregation" in field:
                agg = field["Aggregation"]
                col = agg["Expression"]["Column"]
                info["tipo"] = "aggregation"
                info["entidade"] = col["Expression"]["SourceRef"]["Entity"]
                info["propriedade"] = col["Property"]
                info["funcao"] = agg["Function"]
                info["funcao_nome"] = FUNCOES_DAX.get(agg["Function"], "sum")
            elif "Measure" in field:
                m = field["Measure"]
                info["tipo"] = "measure"
                info["entidade"] = m["Expression"]["SourceRef"]["Entity"]
                info["propriedade"] = m["Property"]
            projecoes.append(info)
        campos[secao] = projecoes
    return campos


def extrair_filtros(v):
    filtros = []
    for f_ in v.get("filterConfig", {}).get("filters", []):
        campo = f_.get("field", {})
        info = {"tipo": f_.get("type")}
        if "Column" in campo:
            col = campo["Column"]
            info["entidade"] = col["Expression"]["SourceRef"]["Entity"]
            info["propriedade"] = col["Property"]
        filtros.append(info)
    return filtros


def extrair_titulo(v, componente):
    """Tenta várias fontes até achar um título legível."""
    # 1. Título visual do container
    try:
        t = v["visual"]["visualContainerObjects"]["title"][0]
        valor = t["properties"]["text"]["expr"]["Literal"]["Value"].strip("'")
        if valor:
            return valor
    except (KeyError, IndexError, TypeError):
        pass

    # 2. displayName da primeira projeção (qualquer seção)
    qs = v.get("visual", {}).get("query", {}).get("queryState", {})
    for secao in ("Data", "Values", "Y", "Category"):
        for p in qs.get(secao, {}).get("projections", []):
            dn = p.get("displayName")
            if dn:
                return dn

    # 3. Fallback genérico por tipo
    fallback = {
        "kpi": "KPI",
        "bar": "Gráfico",
        "line": "Gráfico",
        "combo": "Gráfico",
        "gauge": "Gauge",
        "table": "Tabela",
        "slicer": "Filtro",
        "pie": "Pizza",
        "donut": "Rosca",
    }
    return fallback.get(componente, "Visual")


def extrair_estrutura():
    print("Extraindo estrutura do PBIP...\n")

    paginas = extrair_paginas()
    for p in paginas:
        p["visuais"] = extrair_visuais(p["id"])
        print(f"  {p['slug']:35} -> {len(p['visuais'])} visuais")

    estrutura = {"paginas": paginas}

    os.makedirs(os.path.dirname(ESTRUTURA_JSON), exist_ok=True)
    with open(ESTRUTURA_JSON, "w", encoding="utf-8") as f:
        json.dump(estrutura, f, ensure_ascii=False, indent=2)

    print(f"\n[OK] Estrutura salva em: {ESTRUTURA_JSON}")
    print(f"     Total de paginas: {len(paginas)}")
    print(f"     Total de visuais: {sum(len(p['visuais']) for p in paginas)}")
    return estrutura


# ============================================================
# 2. RENDERIZAR
# ============================================================
def gerar_html_elementos(pagina):
    elementos = []
    for v in pagina["visuais"]:
        c = v["componente"]
        vid = v["id"][:8]
        titulo = v["titulo"] or "Visual"

        if c == "kpi":
            elementos.append(f'''
    <div class="kpi-flat" id="kpi-{vid}" data-visual="{v['id']}">
      <div class="kpi-label">{titulo}</div>
      <div class="kpi-value loading" data-kpi="{vid}">...</div>
    </div>''')
        elif c in ("bar", "bar_horizontal", "line", "combo", "pie", "donut", "gauge"):
            elementos.append(f'''
    <div id="chart-{vid}" class="chart-container" data-visual="{v['id']}"></div>''')
        elif c == "table":
            elementos.append(f'''
    <div id="table-{vid}" class="table-container" data-visual="{v['id']}"></div>''')
        elif c == "slicer":
            elementos.append(f'''
    <div id="slicer-{vid}" class="slicer-container" data-visual="{v['id']}"></div>''')
        elif c == "desconhecido":
            elementos.append(f'''
    <!-- Visual nao suportado: {v['tipo_pbi']} (id: {v['id']}) -->''')

    return "\n".join(elementos)


def gerar_html_sidebar_overlay(pagina):
    """Gera os filtros e botões de menu SOBREPOSTOS na imagem de fundo.

    Segue o padrão da página PERFORMANCE SEMANAL: nada de <div
    id="sidebar-container"> nem assets/sidebar.js. Tudo são divs com
    classes st-* posicionadas em px absolutos do canvas 1280x720.
    """
    partes = []

    # --- Filtros (títulos, labels e selects) ---
    partes.append('''
    <!-- Filtros da sidebar (sobrepostos na imagem) -->
    <div class="sidebar-filtro st-projeto">PROJETO AFRODITE</div>
    <div class="sidebar-filtro st-titulo">PERFORMANCE GERAL</div>''')

    for i, f in enumerate(FILTROS_SIDEBAR, start=1):
        partes.append(
            f'\n    <div class="sidebar-label st-label-{i}">{f["label"]}</div>'
        )
        partes.append(
            f'\n    <div class="sidebar-select st-sel-{i}">'
            f'{f["valor"]}<span class="arrow">▾</span></div>'
        )

    # --- Botões do menu ---
    partes.append('\n\n    <!-- Botões do menu -->')
    for i, item in enumerate(MENU_ITENS, start=1):
        ativo = " ativo" if item["slug"] == pagina["slug"] else ""
        partes.append(
            f'\n    <a href="./{item["slug"]}.html" '
            f'class="menu-botao{ativo} st-btn-{i}">{item["label"]}</a>'
        )

    return "".join(partes)


def gerar_html(pagina):
    slug = pagina["slug"]
    titulo = pagina["displayName"]
    elementos = gerar_html_elementos(pagina)
    sidebar_overlay = gerar_html_sidebar_overlay(pagina)

    return f'''<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>{titulo}</title>
<link rel="stylesheet" href="../assets/style.css">
<link rel="stylesheet" href="{slug}.css">
<script src="https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"></script>
</head>
<body>

<div class="canvas-wrapper" id="canvasWrapper">
<div class="pbi-canvas" id="pbiCanvas">
{sidebar_overlay}

{elementos}

</div>
</div>

<script src="../assets/config.js"></script>
<script src="../assets/pbi.js"></script>
<script src="../assets/charts.js"></script>
<script src="{slug}.js"></script>

</body>
</html>'''


def gerar_css(pagina):
    slug = pagina["slug"]
    titulo = pagina["displayName"]
    fundo = pagina["fundo"] or f"fundo-{slug}.jpg"

    regras = []
    for v in pagina["visuais"]:
        pos = v["pos"]
        c = v["componente"]
        vid = v["id"][:8]

        if c == "kpi":
            prefixo = "kpi-"
        elif c in ("bar", "bar_horizontal", "line", "combo", "pie", "donut", "gauge"):
            prefixo = "chart-"
        elif c == "table":
            prefixo = "table-"
        elif c == "slicer":
            prefixo = "slicer-"
        else:
            prefixo = "visual-"

        regras.append(
            f"#{prefixo}{vid} {{ left: {pos['x']}px; top: {pos['y']}px; "
            f"width: {pos['w']}px; height: {pos['h']}px; }}"
        )

    css_regras = "\n".join(regras)

    # Estilos do menu/filtros sobrepostos (padrão performance-semanal).
    botoes_css = "\n".join(
        f".st-btn-{i} {{ top: {b['top']}px; height: {b['height']}px; }}"
        for i, b in enumerate(POS_BOTOES_MENU, start=1)
    )
    labels_css = "\n".join(
        f".st-label-{i} {{ top: {t}px; }}" for i, t in enumerate(POS_FILTROS_LABEL, start=1)
    )
    selects_css = "\n".join(
        f".st-sel-{i} {{ top: {t}px; }}" for i, t in enumerate(POS_FILTROS_SELECT, start=1)
    )

    return f'''/* {titulo} - gerado automaticamente */

.pbi-canvas {{
  background-image: url('../imagens/{fundo}');
}}

/* ============================================================
   TEXTOS DA SIDEBAR (sobrepostos na imagem)
   ============================================================ */
.sidebar-filtro {{
  position: absolute;
  color: #ffffff;
  font-weight: 700;
  text-align: center;
  letter-spacing: 0.5px;
  z-index: 10;
}}
.st-projeto {{ left: 20px; top: 120px; width: 190px; font-size: 11px; }}
.st-titulo  {{ left: 20px; top: 150px; width: 190px; font-size: 13px; }}

.sidebar-label {{
  position: absolute;
  left: 20px;
  color: #b8c4d9;
  font-size: 10px;
  font-weight: 400;
  letter-spacing: 0.5px;
  z-index: 10;
}}
{labels_css}

.sidebar-select {{
  position: absolute;
  left: 20px;
  width: 190px;
  background: transparent;
  border: 1px solid #4a6fa5;
  color: #ffffff;
  padding: 7px 8px;
  border-radius: 2px;
  font-size: 11px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-sizing: border-box;
  z-index: 10;
}}
{selects_css}

.sidebar-select .arrow {{
  color: #b8c4d9;
  font-size: 10px;
}}

/* ============================================================
   BOTÕES DO MENU
   ============================================================ */
.menu-botao {{
  position: absolute;
  left: 20px;
  width: 190px;
  text-align: center;
  border: 1px solid #4a6fa5;
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  text-decoration: none;
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  background: transparent;
  transition: all 0.15s ease;
  cursor: pointer;
  font-family: inherit;
  z-index: 10;
}}
.menu-botao:hover {{ background: #16294a; }}
.menu-botao.ativo {{
  background: #3a2a20;
  border-color: #3a2a20;
}}
{botoes_css}

/* ============================================================
   VISUAIS (posições extraídas do PBIP)
   ============================================================ */
{css_regras}

/* Estados */
.loading {{ color: #a0a0a0 !important; font-weight: 400 !important; }}
.error   {{ color: #d13438 !important; font-size: 8pt !important; }}
'''


def gerar_js(pagina):
    titulo = pagina["displayName"]
    funcoes = []

    for v in pagina["visuais"]:
        c = v["componente"]
        vid = v["id"][:8]
        titulo_v = v["titulo"] or vid

        if c == "kpi":
            campos = v["campos"].get("Data") or v["campos"].get("Values") or []
            if campos:
                campo = campos[0]
                funcoes.append(f'''
// KPI: {titulo_v}
function calc_{vid}(dados) {{
  // TODO: implementar com base em {campo.get('entidade')}.{campo.get('propriedade')} ({campo.get('funcao_nome', 'sum')})
  return 0;
}}''')
        elif c in ("bar", "combo", "line", "pie", "donut", "gauge"):
            campos_json = json.dumps(v["campos"], ensure_ascii=False)
            funcoes.append(f'''
// Grafico: {titulo_v}
function render_{vid}(dados) {{
  // TODO: montar grafico
  // Campos: {campos_json}
}}''')

    funcoes_str = "\n".join(funcoes)

    return f'''/* {titulo} - gerado automaticamente */

const MES_ALVO = '2026-10-31';

{funcoes_str}

async function carregarDados() {{
  const v = Date.now();
  const [fisico, pluviometria] = await Promise.all([
    fetch(BASE_URL + '/fisico_total.json?v=' + v).then(r => r.json()),
    fetch(BASE_URL + '/pluviometria.json?v=' + v).then(r => r.json())
  ]);
  return {{ fisico, pluviometria }};
}}

async function render() {{
  try {{
    const dados = await carregarDados();
    console.log('{titulo} carregada', dados);
    // TODO: chamar as funcoes de renderizacao
  }} catch (err) {{
    console.error(err);
  }}
}}

document.addEventListener('DOMContentLoaded', render);
'''


def fazer_backup(slug):
    """Faz backup dos 3 arquivos se já existirem."""
    os.makedirs(BACKUP_DIR, exist_ok=True)
    for ext in ("html", "css", "js"):
        origem = os.path.join(SAIDA_DIR, f"{slug}.{ext}")
        if os.path.isfile(origem):
            destino = os.path.join(BACKUP_DIR, f"{slug}.{ext}")
            with open(origem, encoding="utf-8") as f_in:
                with open(destino, "w", encoding="utf-8", newline="\n") as f_out:
                    f_out.write(f_in.read())


def renderizar_pagina(pagina):
    slug = pagina["slug"]

    # Backup automático
    fazer_backup(slug)

    # HTML
    with open(os.path.join(SAIDA_DIR, f"{slug}.html"), "w",
              encoding="utf-8", newline="\n") as f:
        f.write(gerar_html(pagina))

    # CSS
    with open(os.path.join(SAIDA_DIR, f"{slug}.css"), "w",
              encoding="utf-8", newline="\n") as f:
        f.write(gerar_css(pagina))

    # JS
    with open(os.path.join(SAIDA_DIR, f"{slug}.js"), "w",
              encoding="utf-8", newline="\n") as f:
        f.write(gerar_js(pagina))

    print(f"  [OK] {slug}.html / .css / .js")


# ============================================================
# MAIN
# ============================================================
def main():
    print("=" * 70)
    print("GERADOR DE PAGINAS - PBIP -> HTML/CSS/JS")
    print("=" * 70 + "\n")

    estrutura = extrair_estrutura()

    print("\nRenderizando paginas...\n")
    for p in estrutura["paginas"]:
        renderizar_pagina(p)

    print("\n[OK] Concluido!")
    print(f"     Arquivos gerados em: {os.path.abspath(SAIDA_DIR)}")
    print(f"     Backups em:          {os.path.abspath(BACKUP_DIR)}")


if __name__ == "__main__":
    main()