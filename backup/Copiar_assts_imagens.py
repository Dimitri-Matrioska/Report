"""
copiar_assets.py — Copia assets do Power BI para imagens/ com nomes amigáveis.
"""

import os
import json
import shutil

ORIGEM = "PBIP/Report/StaticResources/RegisteredResources"
DESTINO = "imagens"
PAGES_DIR = "PBIP/Report/definition/pages"

os.makedirs(DESTINO, exist_ok=True)


# ============================================================
# 1. Mapear qual Slide cada página usa (page.json)
# ============================================================
print("=== MAPEANDO FUNDOS POR PÁGINA ===\n")

mapa_pagina_slide = {}  # { "performance-semanal": "Slide27033151397060093.JPG" }

for page_id in sorted(os.listdir(PAGES_DIR)):
    page_path = os.path.join(PAGES_DIR, page_id)
    if not os.path.isdir(page_path):
        continue

    page_json = os.path.join(page_path, "page.json")
    if not os.path.isfile(page_json):
        continue

    with open(page_json, encoding="utf-8") as f:
        page = json.load(f)

    display = page.get("displayName", page_id)
    # Normaliza o nome: minúsculas, sem acento, com hífens
    import unicodedata
    slug = unicodedata.normalize("NFKD", display).encode("ascii", "ignore").decode()
    slug = slug.lower().replace(" ", "-").replace("_", "-")
    slug = "".join(c for c in slug if c.isalnum() or c == "-")

    # Procura pelo ItemName do fundo
    try:
        fundo = page["objects"]["background"][0]["properties"]["image"]["image"]["url"]["expr"]["ResourcePackageItem"]["ItemName"]
    except (KeyError, IndexError, TypeError):
        fundo = None

    if fundo:
        mapa_pagina_slide[slug] = fundo
        print(f"  {slug:35} -> {fundo}")
    else:
        print(f"  {slug:35} -> (sem fundo)")

print(f"\nTotal: {len(mapa_pagina_slide)} páginas com fundo mapeadas.")


# ============================================================
# 2. Copiar fundos com nomes amigáveis
# ============================================================
print("\n=== COPIANDO FUNDOS ===\n")

copiados = 0
for slug, nome_origem in mapa_pagina_slide.items():
    origem = os.path.join(ORIGEM, nome_origem)
    if not os.path.isfile(origem):
        print(f"  [!] não encontrado: {nome_origem}")
        continue

    ext = os.path.splitext(nome_origem)[1].lower()
    if ext == ".jpeg":
        ext = ".jpg"
    destino = os.path.join(DESTINO, f"fundo-{slug}{ext}")

    shutil.copy2(origem, destino)
    print(f"  ✓ fundo-{slug}{ext}")
    copiados += 1

print(f"\nFundos copiados: {copiados}")


# ============================================================
# 3. Copiar logos com nomes amigáveis
# ============================================================
print("\n=== COPIANDO LOGOS ===\n")

# Mapeamento manual (você ajusta se necessário)
LOGOS = {
    "Grupo_Botic_rio21638983150856683.json": None,  # não é imagem, é JSON do tema
    "ChatGPT_Image_15_de_jul._de_2039198068076033843.png": "logo-boticario.png",
}

for nome_origem, nome_destino in LOGOS.items():
    if nome_destino is None:
        continue
    origem = os.path.join(ORIGEM, nome_origem)
    if not os.path.isfile(origem):
        print(f"  [!] não encontrado: {nome_origem}")
        continue
    shutil.copy2(origem, os.path.join(DESTINO, nome_destino))
    print(f"  ✓ {nome_destino}")

# Se você já tem logo-afry.png manualmente, mantém.
print("\n✓ Concluído.")
print(f"\nArquivos em: {os.path.abspath(DESTINO)}")