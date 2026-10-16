"""
extrair_tema.py — Extrai as cores do tema para usar no CSS
"""

import json

CAMINHO = "PBIP/Report/StaticResources/SharedResources/BaseThemes/CY26SU02.json"

with open(CAMINHO, encoding="utf-8") as f:
    tema = json.load(f)

print("=== ESTRUTURA DO TEMA ===")
print("Chaves principais:", list(tema.keys()))

# Cores de dados (paleta principal)
print("\n=== DATA COLORS ===")
for i, c in enumerate(tema.get("dataColors", [])):
    print(f"  [{i}] {c}")

# Cores do fundo/texto
print("\n=== FOREGROUND/BACKGROUND ===")
print(f"  Foreground: {tema.get('foreground')}")
print(f"  Background: {tema.get('background')}")
print(f"  Table Accent: {tema.get('tableAccent')}")

# Texto
print("\n=== TEXT CLASSES ===")
for k, v in tema.get("textClasses", {}).items():
    print(f"  {k}: {v.get('color')} | fontSize: {v.get('fontSize')} | fontFace: {v.get('fontFace')}")

# Elementos visuais
print("\n=== VISUAL STYLES (alguns) ===")
vs = tema.get("visualStyles", {})
for tipo in ["*", "page", "card", "slicer"]:
    if tipo in vs:
        print(f"\n  [{tipo}]")
        print("  ", json.dumps(vs[tipo], indent=4, ensure_ascii=False)[:800])