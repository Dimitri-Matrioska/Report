"""
Converte abas específicas do Excel em JSONs otimizados para o site.
Roda localmente; depois suba os JSONs para o R2.
"""

import pandas as pd
import json
import os

# ============================================================
# CONFIGURAÇÃO
# ============================================================
EXCEL_PATH = "../DataBase/Dados_GeraisReport_AFR.xlsx"
OUTPUT_DIR = "../dados"

os.makedirs(OUTPUT_DIR, exist_ok=True)

# ============================================================
# HELPERS
# ============================================================
def limpar_data(v):
    if pd.isna(v):
        return None
    try:
        return pd.Timestamp(v).strftime("%Y-%m-%d")
    except Exception:
        return None

def limpar_num(v):
    if pd.isna(v):
        return None
    try:
        f = float(v)
        if f != f:  # NaN
            return None
        return f
    except (ValueError, TypeError):
        return None

def limpar_str(v):
    if pd.isna(v):
        return None
    s = str(v).strip()
    return s if s and s.lower() not in ("nan", "nat", "none") else None

# ============================================================
# CONVERSORES POR ABA
# ============================================================

def converter_pluviometria(df):
    """Aba: Pluviometria
    Colunas: Mês, Semana, Data, histórica acum, histórica média/dia, mm/dia, mm acum, dia paralisado?
    """
    resultado = []
    for _, r in df.iterrows():
        data = limpar_data(r["Data"])
        if not data:
            continue
        resultado.append({
            "mes": limpar_data(r["Mês"]),
            "semana": int(r["Semana"]) if not pd.isna(r["Semana"]) else None,
            "data": data,
            "historica_acum": limpar_num(r["histórica acum"]),
            "historica_media_dia": limpar_num(r["histórica média/dia"]),
            "mm_dia": limpar_num(r["mm/dia"]),
            "mm_acum": limpar_num(r["mm acum"]),
            "dia_paralisado": limpar_str(r["dia paralisado?"]),
        })
    return resultado


def converter_fisico_total(df):
    """Aba: % Físico Total
    Só as colunas necessárias para os KPIs e o combo chart.
    """
    resultado = []
    for _, r in df.iterrows():
        data = limpar_data(r["Data"])
        if not data:
            continue
        resultado.append({
            "id_contrato": limpar_str(r["ID Contrato"]),
            "contratada": limpar_str(r["Contratada"]),
            "mes": limpar_data(r["Mês"]),
            "semana": int(r["Semana"]) if not pd.isna(r["Semana"]) else None,
            "data": data,
            "baseline_1_acum": limpar_num(r["Baseline 1 Acum"]),
            "real_acum": limpar_num(r["Real Acum"]),
            "aderencia": limpar_num(r["Aderência"]),
            "baseline_1": limpar_num(r["Baseline 1"]),
            "real": limpar_num(r["Real"]),
        })
    return resultado


# ============================================================
# REGISTRO DE CONVERSORES
# ============================================================
CONVERSORES = {
    "Pluviometria": ("pluviometria.json", converter_pluviometria),
    "% Físico Total": ("fisico_total.json", converter_fisico_total),
    # Adicione mais abas conforme formos avançando:
    # "Desvios STMA": ("desvios_stma.json", converter_desvios),
    # "Medições": ("medicoes.json", converter_medicoes),
}

# ============================================================
# EXECUÇÃO
# ============================================================
def main():
    print(f"Lendo: {EXCEL_PATH}")
    xls = pd.ExcelFile(EXCEL_PATH)

    for aba, (arquivo, func) in CONVERSORES.items():
        if aba not in xls.sheet_names:
            print(f"  [!] Aba '{aba}' não encontrada")
            continue

        print(f"\n→ Convertendo '{aba}' → {arquivo}")
        df = pd.read_excel(EXCEL_PATH, sheet_name=aba)
        dados = func(df)

        caminho = os.path.join(OUTPUT_DIR, arquivo)
        with open(caminho, "w", encoding="utf-8") as f:
            json.dump(dados, f, ensure_ascii=False, indent=2)

        print(f"  ✓ {len(dados)} registros salvos em {caminho}")

    # Gera um arquivo de versão para cache busting
    versao = {
        "gerado_em": pd.Timestamp.now().isoformat(),
        "arquivos": [arq for arq, _ in CONVERSORES.values()]
    }
    with open(os.path.join(OUTPUT_DIR, "versao.json"), "w", encoding="utf-8") as f:
        json.dump(versao, f, ensure_ascii=False, indent=2)

    print(f"\n✓ Concluído. Arquivos em: {os.path.abspath(OUTPUT_DIR)}")


if __name__ == "__main__":
    main()
