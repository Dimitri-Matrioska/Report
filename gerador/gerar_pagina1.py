import os
import json
import re
import sys
import unicodedata

# Configuração de caminhos
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
        print(f"[!] Página '{slug_alvo}' não encontrada no _estrutura.json.")
        return

    # 2. Ler arquivos base (Ouro)
    with open(BASE_HTML, "r", encoding="utf-8") as f: base_html = f.read()
    with open(BASE_CSS, "r", encoding="utf-8") as f: base_css = f.read()
    with open(BASE_JS, "r", encoding="utf-8") as f: base_js = f.read()

    # 3. Gerar Bloco HTML
    html_visuais = []
    
    # Caso especial: Imagem da Pirâmide para a STMA
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
            # Se tiver título, coloca label, senão é só o valor
            label_html = f'<div class="kpi-label">{titulo}</div>' if titulo else ''
            html_visuais.append(f'''
    <div class="kpi-flat" id="kpi-{vid}" data-visual="{v['id']}" style="z-index: 10;">
      {label_html}
      <div class="kpi-value loading" data-kpi="{vid}">...</div>
    </div>''')
        
        elif tipo == "table":
            html_visuais.append(f'''
    <div id="table-{vid}" class="table-container" data-visual="{v['id']}"></div>''')
            
        elif tipo in ["bar", "line", "pie", "donut", "gauge", "combo", "bar_horizontal"]:
            html_visuais.append(f'''
    <div id="chart-{vid}" class="chart-container" data-visual="{v['id']}"></div>
    <div class="visual-title" id="title-{vid}">{titulo}</div>''')

    # 4. Substituir no HTML
    # Mantém tudo até a abertura da .pbi-canvas, depois injeta os filtros e visuais, e fecha
    parte_cima = base_html.split('<div class="pbi-canvas" id="pbiCanvas">')[0] + '<div class="pbi-canvas" id="pbiCanvas">\n'
    
    # Extrair o bloco de sidebar e filtros do HTML base para reaproveitar
    filtros_regex = re.compile(r'(<!-- Filtros da sidebar.*?)(?=<!-- Botões do menu)', re.DOTALL)
    filtros_html = filtros_regex.search(base_html).group(1)
    
    botoes_regex = re.compile(r'(<!-- Botões do menu -->.*?</a>\n)', re.DOTALL)
    botoes_html = botoes_regex.search(base_html).group(1)
    # Adaptar botão ativo
    botoes_html = botoes_html.replace('class="menu-botao ativo st-btn-2"', 'class="menu-botao st-btn-2"')
    botoes_html = botoes_html.replace(f'href="./{slug_alvo}.html" class="menu-botao st-btn-', f'href="./{slug_alvo}.html" class="menu-botao ativo st-btn-')

    parte_baixo = '''
</div>
</div>

<script src="../assets/config.js"></script>
<script src="../assets/pbi.js"></script>
<script src="../assets/charts.js"></script>
<script src="''' + slug_alvo + '''.js"></script>

</body>
</html>'''

    html_final = parte_cima + filtros_html + botoes_html + "\n".join(html_visuais) + parte_baixo

    # 5. Gerar Bloco CSS
    css_visuais = []
    for v in pagina_dados["visuais"]:
        vid = v["id"][:8]
        pos = v["pos"]
        tipo = v["componente"]
        
        prefixo = "kpi-" if tipo == "kpi" else "table-" if tipo == "table" else "chart-"
        
        # Esconde a label do KPI se não tiver titulo (como nos números soltos da pirâmide)
        css_extra = ""
        if tipo == "kpi" and not v.get("titulo"):
            css_extra = " justify-content: flex-start; align-items: flex-start; padding: 0;"
            
        css_visuais.append(f"#{prefixo}{vid} {{ left: {pos['x']}px; top: {pos['y']}px; width: {pos['w']}px; height: {pos['h']}px; z-index: 10;{css_extra} }}")
        
        if tipo in ["bar", "line", "pie", "donut", "combo"]:
            # Título (faixa azul) logo acima do gráfico
            css_visuais.append(f"#title-{vid} {{ left: {pos['x']}px; top: {pos['y']-18}px; width: {pos['w']}px; height: 18px; z-index: 10; }}")

    # Substitui o fundo da página e as posições
    css_final = re.sub(r'\.pbi-canvas \{.*?\}', f'.pbi-canvas {{\n  background: var(--pbi-fundo-pagina) url(\'../imagens/{pagina_dados["fundo"]}\') center/cover no-repeat;\n}}', base_css, flags=re.DOTALL)
    # Limpa as posições antigas
    css_final = re.sub(r'/\* =+\s*POSIÇÕES DOS ELEMENTOS.*?/\* Ocultar containers de filtro originais \*/', "/* POSIÇÕES DOS ELEMENTOS */\n" + "\n".join(css_visuais) + "\n\n/* Ocultar containers */", css_final, flags=re.DOTALL)

    # 6. Gerar Bloco JS
    js_stubs = []
    for v in pagina_dados["visuais"]:
        vid = v["id"][:8]
        if v["componente"] != "kpi":
            js_stubs.append(f'''
function render_{vid}() {{
  const el = document.getElementById('chart-{vid}');
  if (!el) return;
  CHARTS['{vid}'] = CHARTS['{vid}'] || echarts.init(el);
  // TODO: Implementar gráfico {v['tipo_pbi']}
  // {json.dumps(v['campos'], ensure_ascii=False)}
}}''')

    # Remove as funções de render antigas e injeta os stubs
    js_final = re.sub(r'function render_curva_ano\(\).*?function render_Aderencia', "function render_Aderencia", base_js, flags=re.DOTALL)
    js_final = re.sub(r'function render_curva_mes\(\).*?function render_Aderencia', "function render_Aderencia", js_final, flags=re.DOTALL)
    js_final = re.sub(r'function render_PluvioCurto\(\).*?function popularFiltros', "function popularFiltros", js_final, flags=re.DOTALL)
    
    # Substitui a função render_Graficos
    js_final = re.sub(r'function render_Graficos\(\) \{.*?\}', 'function render_Graficos() {\n    ' + "\n    ".join([f"render_{v['id'][:8]}();" for v in pagina_dados["visuais"] if v['componente'] != 'kpi']) + '\n}', js_final, flags=re.DOTALL)
    
    # Injeta os stubs antes de render_Graficos
    js_final = js_final.replace("function render_Graficos()", "\n".join(js_stubs) + "\n\nfunction render_Graficos()")

    # 7. Salvar arquivos
    os.makedirs(PAGINAS_DIR, exist_ok=True)
    with open(os.path.join(PAGINAS_DIR, f"{slug_alvo}.html"), "w", encoding="utf-8") as f: f.write(html_final)
    with open(os.path.join(PAGINAS_DIR, f"{slug_alvo}.css"), "w", encoding="utf-8") as f: f.write(css_final)
    with open(os.path.join(PAGINAS_DIR, f"{slug_alvo}.js"), "w", encoding="utf-8") as f: f.write(js_final)

    print(f"[OK] Arquivos gerados para {slug_alvo}.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python gerador/gerar_pagina.py <slug_da_pagina>")
        print("Exemplo: python gerador/gerar_pagina.py stma")
    else:
        gerar_pagina(sys.argv[1])