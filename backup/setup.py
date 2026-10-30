"""
setup.py — Cria a estrutura de pastas e arquivos do projeto BI HTML.
"""

import os

RAIZ = os.path.dirname(os.path.abspath(__file__))

PASTAS = ["conversor", "dados", "paginas", "assets", "DataBase"]

ARQUIVOS = {
    "assets/config.js": """// config.js
const BASE_URL = '../dados';
""",

    "assets/pbi.js": """// pbi.js — funções genéricas
const FUNCOES = {
  0: (a) => a.length,
  1: (a) => a.length ? Math.min(...a) : 0,
  2: (a) => a.length ? Math.max(...a) : 0,
  3: (a) => a.length ? a.reduce((x,y)=>x+y,0) / a.length : 0,
  4: (a) => a.reduce((x,y)=>x+y, 0),
  5: (a) => new Set(a).size
};
function agregar(valores, funcCode) {
  const limpos = valores.filter(v => v !== null && v !== undefined && !isNaN(v));
  return (FUNCOES[funcCode] || FUNCOES[4])(limpos);
}
const fmt = {
  pct: (v) => (Number(v) || 0).toLocaleString('pt-BR', {minimumFractionDigits:1, maximumFractionDigits:1}) + '%',
  num: (v) => (Number(v) || 0).toLocaleString('pt-BR', {minimumFractionDigits:1, maximumFractionDigits:1}),
  int: (v) => Math.round(Number(v) || 0).toString()
};
function ultimaDataCom(dados, campo) {
  const comValor = dados.filter(d => d[campo] !== null && d[campo] !== undefined);
  if (!comValor.length) return null;
  return comValor.map(d => d.data).sort().pop();
}
function maxDe(dados, campo) {
  const valores = dados.map(d => d[campo]).filter(v => v !== null && v !== undefined && !isNaN(v));
  return valores.length ? Math.max(...valores) : 0;
}
function filtrarPorMes(dados, mes) {
  return dados.filter(d => d.mes === mes);
}
""",

    "assets/style.css": """* { box-sizing: border-box; }
body {
  margin: 0; padding: 20px; background: #f3f2f1;
  font-family: "Segoe UI", helvetica, arial, sans-serif;
}
.pbi-canvas {
  position: relative; width: 1280px; height: 720px;
  background: #ffffff; border: 1px solid #d0d0d0; margin: 0 auto; overflow: hidden;
}
.kpi-flat {
  position: absolute; background: #F5F5F5; padding: 8px 10px;
  display: flex; flex-direction: column; justify-content: center;
  align-items: center; text-align: center;
}
.kpi-flat .kpi-label { font-size: 9pt; color: #252423; margin-bottom: 4px; line-height: 1; }
.kpi-flat .kpi-value { font-size: 22pt; font-weight: 600; color: #252423; line-height: 1; }
.kpi-flat .kpi-value.negative { color: #E53935; }
.kpi-bordered {
  position: absolute; background: transparent; border: 1px solid #e0e0e0;
  padding: 5px; display: flex; align-items: stretch;
}
.kpi-bordered .kpi-accent { width: 2px; background: #118DFF; margin-right: 6px; flex-shrink: 0; }
.kpi-bordered .kpi-content {
  flex: 1; display: flex; flex-direction: column; justify-content: center;
  align-items: center; text-align: center; min-width: 0;
}
.kpi-bordered .kpi-label { font-size: 8pt; color: #605e5c; line-height: 1.1; margin-bottom: 2px; }
.kpi-bordered .kpi-value { font-size: 10pt; font-weight: 600; color: #252423; }
.loading { color: #a0a0a0 !important; font-weight: 400 !important; }
.error { color: #d13438 !important; font-size: 8pt !important; }
.mock-banner {
  position: absolute; top: 0; left: 0; background: #fff4ce; color: #8a6d00;
  font-size: 11px; padding: 4px 10px; z-index: 9999; display: none;
}
""",
}


def criar():
    print(f"Criando estrutura em: {RAIZ}\n")

    for pasta in PASTAS:
        caminho = os.path.join(RAIZ, pasta)
        os.makedirs(caminho, exist_ok=True)
        print(f"  [dir]  {pasta}/")

    print()

    for relativo, conteudo in ARQUIVOS.items():
        caminho = os.path.join(RAIZ, relativo)
        os.makedirs(os.path.dirname(caminho), exist_ok=True)

        if os.path.exists(caminho):
            print(f"  [skip] {relativo} (já existe)")
            continue

        with open(caminho, "w", encoding="utf-8", newline="\n") as f:
            f.write(conteudo)
        print(f"  [file] {relativo}")

    print("\nOK! Estrutura criada.")


if __name__ == "__main__":
    criar()
