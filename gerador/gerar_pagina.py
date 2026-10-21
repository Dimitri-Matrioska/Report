import os
import json
import re
import sys
import unicodedata

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGINAS_DIR = os.path.join(RAIZ, "paginas")
ESTRUTURA_JSON = os.path.join(RAIZ, "gerador", "_estrutura.json")
BASE_HTML = os.path.join(PAGINAS_DIR, "performance-semanal.html")
BASE_CSS = os.path.join(PAGINAS_DIR, "performance-semanal.css")
BASE_JS = os.path.join(PAGINAS_DIR, "performance-semanal.js")

def slugify(texto):
    texto = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    texto = texto.lower().strip()
    texto = re.sub(r"[^\w\s-]", "", texto)
    texto = re.sub(r"[\s_]+", "-", texto)
    return re.sub(r"-+", "-", texto).strip("-")

def gerar_pagina(slug_alvo):
    print(f"Gerando página: {slug_alvo}...")
    
    # 1. Ler Estrutura
    with open(ESTRUTURA_JSON, "r", encoding="utf-8") as f:
        estrutura = json.load(f)
        
    pagina_dados = next((p for p in estrutura["paginas"] if p["slug"] == slug_alvo), None)
    if not pagina_dados:
        print(f"[!] Página '{slug_alvo}' não encontrada.")
        return

    # 2. Ler arquivos base
    with open(BASE_HTML, "r", encoding="utf-8") as f: base_html = f.read()
    with open(BASE_CSS, "r", encoding="utf-8") as f: base_css = f.read()
    with open(BASE_JS, "r", encoding="utf-8") as f: base_js = f.read()

    # =========================================================
    # GERAR HTML
    # =========================================================
    corte_html = '<div class="kpi-flat boxed" id="kpi-01b213fc"'
    parte_cima_html = base_html.split(corte_html)[0]
    
    # Forçar a classe 'ativo' no botão correto e tirar dos outros
    parte_cima_html = parte_cima_html.replace('class="menu-botao ativo st-btn-2"', 'class="menu-botao st-btn-2"')
    parte_cima_html = parte_cima_html.replace(f'href="./{slug_alvo}.html" class="menu-botao st-btn-', f'href="./{slug_alvo}.html" class="menu-botao ativo st-btn-')
    
    corte_baixo = '<script src="../assets/config.js"></script>'
    parte_baixo_html = corte_baixo + base_html.split(corte_baixo)[1]
    parte_baixo_html = parte_baixo_html.replace('performance-semanal.js', f'{slug_alvo}.js')

    html_visuais = []
    
    # Inserir a pirâmide se for STMA
    if slug_alvo == "stma":
        html_visuais.append('''
    <!-- Imagem Estática da Pirâmide -->
    <img src="../imagens/Imagem_Piramide.png" style="position: absolute; left: 245px; top: 35px; width: 540px; height: 380px; z-index: 1;">
''')

    for v in pagina_dados["visuais"]:
        vid = v["id"][:8]
        tipo = v["componente"]
        titulo = v.get("titulo") or ""
        
        if tipo == "kpi":
            # Se não tiver título, usamos a classe kpi-raw para tirar o padding e centralizar
            classe = "kpi-flat" if titulo else "kpi-raw"
            label_html = f'<div class="kpi-label">{titulo}</div>' if titulo else ''
            html_visuais.append(f'''
    <div class="{classe}" id="kpi-{vid}" data-visual="{v['id']}">
      {label_html}
      <div class="kpi-value loading" data-kpi="{vid}">...</div>
    </div>''')
        elif tipo == "table":
            html_visuais.append(f'''
    <div id="table-{vid}" class="table-container" data-visual="{v['id']}"></div>''')
        elif tipo in ["bar", "line", "pie", "donut", "gauge", "combo", "bar_horizontal"]:
            # Adiciona o título azul apenas se houver título
            title_html = f'\n    <div class="visual-title" id="title-{vid}">{titulo}</div>' if titulo else ''
            html_visuais.append(f'''
    <div id="chart-{vid}" class="chart-container" data-visual="{v['id']}"></div>{title_html}''')

    html_final = parte_cima_html + "\n".join(html_visuais) + "\n</div>\n</div>\n\n" + parte_baixo_html

    # =========================================================
    # GERAR CSS
    # =========================================================
    parte_cima_css = base_css.split("/* ============================================================\n   POSIÇÕES DOS ELEMENTOS")[0]
    
    # Adiciona o estilo da classe kpi-raw
    parte_cima_css += """
/* KPI sem label (apenas o número solto) */
.kpi-raw {
  position: absolute;
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
  z-index: 10;
}
.kpi-raw .kpi-value {
  font-size: 14pt;
  font-weight: 700;
  color: var(--pbi-foreground);
  line-height: 1;
}
"""
    parte_baixo_css = "/* Ocultar containers de filtro originais */\n.slicer-container { display: none !important; }\n"

    # Ajustar fundo
    fundo_nome = pagina_dados["fundo"]
    parte_cima_css = re.sub(r'\.pbi-canvas \{.*?\}', f'.pbi-canvas {{\n  background: var(--pbi-fundo-pagina) url(\'../imagens/{fundo_nome}\') center/cover no-repeat;\n}}', parte_cima_css, flags=re.DOTALL)

    css_visuais = ["/* POSIÇÕES DOS ELEMENTOS */"]
    for v in pagina_dados["visuais"]:
        vid = v["id"][:8]
        pos = v["pos"]
        tipo = v["componente"]
        prefixo = "kpi-" if tipo == "kpi" else "table-" if tipo == "table" else "chart-"
        
        css_visuais.append(f"#{prefixo}{vid} {{ left: {pos['x']}px; top: {pos['y']}px; width: {pos['w']}px; height: {pos['h']}px; }}")
        
        if tipo in ["bar", "line", "pie", "donut", "combo", "bar_horizontal"] and v.get("titulo"):
            # A faixa azul fica logo acima do gráfico
            css_visuais.append(f"#title-{vid} {{ left: {pos['x']}px; top: {pos['y']-18}px; width: {pos['w']}px; height: 18px; }}")

    css_final = parte_cima_css + "\n".join(css_visuais) + "\n\n" + parte_baixo_css

    # =========================================================
    # GERAR JS
    # =========================================================
    parte_cima_js = base_js.split("function render_curva_ano()")[0]
    parte_baixo_js = "function popularFiltros()" + base_js.split("function popularFiltros()")[1]
    
    js_stubs = []
    chamadas_render = []
    
    for v in pagina_dados["visuais"]:
        vid = v["id"][:8]
        if v["componente"] != "kpi":
            chamadas_render.append(f"  render_{vid}();")
            
            # Cria um gráfico ECharts de placeholder para não ficar em branco
            tipo_echart = "bar" if v["componente"] in ["bar", "bar_horizontal"] else "line" if v["componente"] == "line" else "pie" if v["componente"] in ["pie", "donut"] else "bar"
            
            js_stubs.append(f'''
function render_{vid}() {{
  const el = document.getElementById('chart-{vid}');
  if (!el) return;
  CHARTS['{vid}'] = CHARTS['{vid}'] || echarts.init(el);
  
  // Placeholder para você ver a área do gráfico
  CHARTS['{vid}'].setOption({{
    title: {{ text: 'Aguardando Dados', left: 'center', top: 'center', textStyle: {{ fontSize: 10, color: '#999', fontWeight: 'normal' }} }},
    xAxis: {{ show: false }}, yAxis: {{ show: false }}, series: []
  }});
  
  // TODO: Implementar {v['tipo_pbi']}
  // Campos: {json.dumps(v['campos'], ensure_ascii=False)}
}}''')

    nova_render_graficos = "function render_Graficos() {\n" + "\n".join(chamadas_render) + "\n}\n\n"
    js_final = parte_cima_js + "\n".join(js_stubs) + "\n\n" + nova_render_graficos + parte_baixo_js

    # =========================================================
    # SALVAR
    # =========================================================
    with open(os.path.join(PAGINAS_DIR, f"{slug_alvo}.html"), "w", encoding="utf-8") as f: f.write(html_final)
    with open(os.path.join(PAGINAS_DIR, f"{slug_alvo}.css"), "w", encoding="utf-8") as f: f.write(css_final)
    with open(os.path.join(PAGINAS_DIR, f"{slug_alvo}.js"), "w", encoding="utf-8") as f: f.write(js_final)

    print(f"[OK] Arquivos gerados para {slug_alvo} com sucesso!")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python gerador/gerar_pagina.py <slug_da_pagina>")
    else:
        gerar_pagina(sys.argv[1])