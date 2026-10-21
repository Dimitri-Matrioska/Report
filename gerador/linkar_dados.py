"""
linkar_dados.py — Excel → JSONs individuais + dados.json unificado

Uso:
  python gerador/linkar_dados.py               # regera tudo
  python gerador/linkar_dados.py --verificar   # dry-run
"""

import os
import sys
import json
import unicodedata
from datetime import datetime
import pandas as pd

# ============================================================
# CONFIGURAÇÃO
# ============================================================
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXCEL = os.path.join(RAIZ, "DataBase", "Dados_GeraisReport_AFR.xlsx")
DADOS_DIR = os.path.join(RAIZ, "dados")

os.makedirs(DADOS_DIR, exist_ok=True)


# ============================================================
# HELPERS
# ============================================================
def normalizar(s):
    """Remove acentos, coloca minúsculo, remove espaços extras."""
    if not isinstance(s, str):
        return ""
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return " ".join(s.lower().split())


def achar_coluna(df, apelidos):
    """Busca uma coluna por vários nomes possíveis (tolerante)."""
    cols_orig = list(df.columns)
    cols_norm = {normalizar(c): c for c in cols_orig}
    
    for apelido in apelidos:
        apelido_norm = normalizar(apelido)
        # exato
        if apelido_norm in cols_norm:
            return cols_norm[apelido_norm]
    for apelido in apelidos:
        apelido_norm = normalizar(apelido)
        # substring
        for c_norm, c_orig in cols_norm.items():
            if apelido_norm in c_norm:
                return c_orig
    return None


def achar_aba(xls, apelidos):
    for apelido in apelidos:
        ap_norm = normalizar(apelido)
        for aba in xls.sheet_names:
            if normalizar(aba) == ap_norm:
                return aba
    for apelido in apelidos:
        ap_norm = normalizar(apelido)
        for aba in xls.sheet_names:
            if ap_norm in normalizar(aba):
                return aba
    return None


def to_iso(v):
    if pd.isna(v):
        return None
    try:
        return pd.Timestamp(v).strftime("%Y-%m-%d")
    except Exception:
        return None


def to_num(v):
    if pd.isna(v):
        return None
    try:
        if isinstance(v, str):
            v = v.replace(".", "").replace(",", ".") if "," in v else v
        return float(v)
    except (ValueError, TypeError):
        return None


def to_int(v):
    n = to_num(v)
    return int(n) if n is not None else None


def to_str(v):
    if pd.isna(v):
        return None
    s = str(v).strip()
    return s if s and s.lower() not in ("nan", "nat", "none") else None


def to_flag(v):
    if pd.isna(v):
        return None
    s = str(v).strip().lower()
    if s in ("sim", "s", "true", "1"):
        return "sim"
    if s in ("não", "nao", "n", "false", "0"):
        return "não"
    return to_str(v)


# ============================================================
# SPECS — mapeamento declarativo de cada aba
# ============================================================
SPECS = {
    "fisico_total": {
        "abas": ["% Físico Total"],
        "cols": {
            "id_contrato":     (["ID Contrato"], to_str),
            "contratada":      (["Contratada"], to_str),
            "mes":             (["Mês"], to_iso),
            "semana":          (["Semana"], to_int),
            "data":            (["Data"], to_iso),
            "baseline_1":      (["Baseline 1"], to_num),
            "baseline_1_acum": (["Baseline 1 Acum"], to_num),
            "real":            (["Real"], to_num),
            "real_acum":       (["Real Acum"], to_num),
            "projetado_acum":  (["Projetado Acum"], to_num),
            "aderencia":       (["Aderência"], to_num),
        },
    },
    "pluviometria": {
        "abas": ["Pluviometria"],
        "cols": {
            "mes":              (["Mês"], to_iso),
            "semana":           (["Semana"], to_int),
            "data":             (["Data"], to_iso),
            "historica_acum":   (["histórica acum"], to_num),
            "historica_media":  (["histórica média/dia"], to_num),
            "mm_dia":           (["mm/dia"], to_num),
            "mm_acum":          (["mm acum"], to_num),
            "dia_paralisado":   (["dia paralisado?"], to_flag),
        },
    },
    "status_semanal": {
        "abas": ["Status Semanal"],
        "cols": {
            "id_contrato":    (["ID Contrato"], to_str),
            "contratada":     (["Contratada"], to_str),
            "mes_referencia": (["Mês Referência"], to_iso),
            "semana":         (["Semana"], to_int),
            "item":           (["Item"], to_str),
            "descricao":      (["Descrição"], to_str),
        },
    },
    "stma": {
        "abas": ["STMA"],
        "cols": {
            "id_contrato":    (["ID Contrato"], to_str),
            "contratada":     (["Contratada"], to_str),
            "mes_referencia": (["Mês Referência"], to_iso),
            "data":           (["Data"], to_iso),
            "semana":         (["Semana"], to_int),
            "agenda":         (["Agenda"], to_str),
            "indicador":      (["Indicador"], to_str),
            "resultado":      (["Resultado"], to_num),
            "tipo":           (["Tipo"], to_str),
            "observacoes":    (["Observações"], to_str),
        },
    },
    "desvios_stma": {
        "abas": ["Desvios STMA"],
        "cols": {
            "id":                 (["ID"], to_str),
            "data":               (["Data"], to_iso),
            "diretoria":          (["Diretoria"], to_str),
            "site":               (["Site"], to_str),
            "area":               (["Área"], to_str),
            "setor":              (["Setor"], to_str),
            "linha":              (["Linha"], to_str),
            "turno":              (["Turno"], to_str),
            "descricao":          (["Descrição"], to_str),
            "descricao_macro":    (["Descrição macro"], to_str),
            "potencial_gravidade":([ "Potencial de Gravidade"], to_str),
            "tp_desvio":          (["tp_desvio"], to_str),        # ← A CHAVE QUE FALTAVA
            "recorrente":         (["Recorrente?"], to_flag),
            "status":             (["Status"], to_str),
            "plano_acao":         (["Plano de Ação?"], to_str),
            "causa_raiz":         (["Causa Raiz"], to_str),
            "data_encerramento":  (["Data de Encerramento"], to_iso),
            "dias_resolucao":     (["Qtde. de dias para a resolução"], to_int),
            "acao_sugerida":      (["Ação Sugerida"], to_str),
            "acoes_tomadas":      (["Ações Tomadas"], to_str),
            "tad":                (["TAD"], to_str),
            "identificacao":      (["Identificação"], to_str),
            "vinculo":            (["Vínculo"], to_str),
            "nome_colaborador":   (["Nome Colaborador"], to_str),
        },
    },
    "acoes_desvios": {
        "abas": ["Ações Desvios"],
        "cols": {
            "id_desvio":       (["ID Desvio"], to_str),
            "data_desvio":     (["Data do Desvio"], to_iso),
            "acao":            (["Ação"], to_str),
            "status":          (["Status"], to_str),
            "prazo":           (["Prazo"], to_iso),
            "data_conclusao":  (["Data real de conclusão"], to_iso),
            "potencial_gravidade": (["Potencial de Gravidade"], to_str),
            "tipo":            (["Tipo"], to_str),
        },
    },
    "sla": {
        "abas": ["SLA"],
        "cols": {
            "validacao":       (["Validação"], to_str),
            "id_contrato":     (["ID Contrato"], to_str),
            "contratada":      (["Contratada"], to_str),
            "mes":             (["Mês"], to_iso),
            "indicador":       (["Indicador"], to_str),
            "meta":            (["Meta"], to_str),
            "resultado":       (["Resultado"], to_num),
            "aplicacao":       (["Aplicação SLA"], to_num),
        },
    },
    "medicoes": {
        "abas": ["Medições"],
        "cols": {
            "id_contrato":        (["ID Contrato"], to_str),
            "contratada":         (["Contratada"], to_str),
            "mes_referencia":     (["Mês Referência"], to_iso),
            "baseline_acum":      (["Baseline Acumulada"], to_num),
            "r_acumulado":        (["R$ Acumulado"], to_num),
            "r_saldo":            (["R$ Saldo"], to_num),
            "status":             (["Status"], to_str),
            "aderencia":          (["Aderência"], to_num),
        },
    },
    "milestones": {
        "abas": ["Milestones"],
        "cols": {
            "id_contrato":    (["ID Contrato"], to_str),
            "contratada":     (["Contratada"], to_str),
            "sequencia":      (["Sequencia"], to_int),
            "etapa":          (["Etapa"], to_str),
            "milestone":      (["Milestone"], to_str),
            "data_baseline":  (["Data Baseline"], to_iso),
            "data_real":      (["Data Real/Projetada"], to_iso),
            "farol":          (["Farol"], to_str),
        },
    },
    "acoes": {
        "abas": ["Ações"],
        "cols": {
            "data_acao":      (["Data Ação"], to_iso),
            "acao":           (["Ação"], to_str),
            "responsavel":    (["Responsável"], to_str),
            "status":         (["Status"], to_str),
            "data_conclusao": (["Data Conclusão"], to_iso),
        },
    },
    "dados_contrato": {
        "abas": ["Dados Contrato"],
        "cols": {
            "id_contrato":       (["ID Contrato"], to_str),
            "contratada":        (["Contratada"], to_str),
            "contratada_reduzida": (["Contratada reduzida"], to_str),
            "gestor":            (["Gestor"], to_str),
            "escopo_macro":      (["Escopo Macro"], to_str),
            "inicio":            (["Início"], to_iso),
            "termino":           (["Término"], to_iso),
            "r_inicial":         (["R$ Inicial"], to_num),
            "r_total":           (["R$ Total"], to_num),
            "medido":            (["Medido"], to_num),
            "saldo":             (["Saldo"], to_num),
        },
    },
    "histograma": {
        "abas": ["Histograma"],
        "cols": {
            "id_contrato": (["ID Contrato"], to_str),
            "contratada":  (["Contratada"], to_str),
            "tipo":        (["Tipo"], to_str),
            "mes":         (["Mês"], to_iso),
            "equipamento": (["Equipamento"], to_str),
            "prev":        (["Prev"], to_int),
            "real":        (["Real"], to_num),
        },
    },
    "igpp_gf": {
        "abas": ["IGPP-GF"],
        "cols": {
            "id_contrato":    (["ID Contrato"], to_str),
            "contratada":     (["Contratada"], to_str),
            "mes_referencia": (["Mês Referência"], to_iso),
            "composicao":     (["Composição"], to_str),
            "peso":           (["Peso"], to_num),
            "metrica":        (["Métrica"], to_str),
            "descricao_item": (["Descrição Item"], to_str),
            "resultado_igpp": (["Resultado IGPP"], to_num),
            "meta_contrato":  (["Meta Contrato"], to_num),
        },
    },
    "servicos_notaveis": {
        "abas": ["Serviços Notáveis"],
        "cols": {
            "id_contrato":      (["ID Contrato"], to_str),
            "contratada":       (["Contratada"], to_str),
            "mes_referencia":   (["Mês Referência"], to_iso),
            "semana":           (["Semana"], to_int),
            "dia":              (["Dia"], to_iso),
            "servico_notavel":  (["Serviço Notável"], to_str),
            "un":               (["Un"], to_str),
            "total":            (["Total"], to_num),
            "previsto":         (["Previsto"], to_num),
            "real":             (["Real"], to_num),
            "avanco":           (["Avanço"], to_num),
            "aderencia_real":   (["Aderência Real"], to_num),
        },
    },
}


# ============================================================
# PROCESSAMENTO
# ============================================================
def processar_aba(df, spec):
    """Aplica o mapeamento declarativo e retorna lista de dicts."""
    # Resolve os nomes reais das colunas
    mapa = {}
    faltando = []
    for campo, (apelidos, _tipo) in spec["cols"].items():
        col_real = achar_coluna(df, apelidos)
        if col_real is None:
            faltando.append(campo)
        else:
            mapa[campo] = (col_real, _tipo)

    if faltando:
        print(f"    [aviso] colunas ausentes: {faltando}")

    registros = []
    for _, row in df.iterrows():
        reg = {}
        for campo, (col_real, func) in mapa.items():
            reg[campo] = func(row[col_real])
        if any(v is not None for v in reg.values()):
            registros.append(reg)
    return registros


def inventario():
    """Lista os JSONs existentes + contagem + tamanho."""
    inv = {}
    for arq in sorted(os.listdir(DADOS_DIR)):
        if arq.endswith(".json") and arq != "dados.json" and arq != "versao.json":
            caminho = os.path.join(DADOS_DIR, arq)
            try:
                with open(caminho, encoding="utf-8") as f:
                    conteudo = json.load(f)
                inv[arq.replace(".json", "")] = len(conteudo)
            except Exception:
                inv[arq.replace(".json", "")] = "erro"
    return inv


# ============================================================
# MAIN
# ============================================================
def main():
    if not os.path.isfile(EXCEL):
        print(f"[!] Arquivo não encontrado: {EXCEL}")
        return

    print(f"Lendo: {EXCEL}")
    xls = pd.ExcelFile(EXCEL)

    todos = {}

    for nome, spec in SPECS.items():
        aba_real = achar_aba(xls, spec["abas"])
        if not aba_real:
            print(f"  [!] '{nome}': aba não encontrada {spec['abas']}")
            continue

        print(f"\n→ {nome} (aba: {aba_real})")
        df = pd.read_excel(EXCEL, sheet_name=aba_real)
        print(f"    linhas: {len(df)} | colunas: {len(df.columns)}")

        registros = processar_aba(df, spec)
        todos[nome] = registros

        # Salva o JSON individual (debug)
        caminho = os.path.join(DADOS_DIR, f"{nome}.json")
        with open(caminho, "w", encoding="utf-8") as f:
            json.dump(registros, f, ensure_ascii=False, indent=2)
        print(f"    [ok] {len(registros)} registros → {nome}.json")

    # ============================================================
    # ARQUIVO UNIFICADO (dados.json)
    # ============================================================
    print(f"\n{'='*60}")
    print("Unificando em dados.json...")
    
    dados_unificados = {
        "versao": datetime.now().isoformat(),
        "contexto": {
            "contratada_principal": "TERRAM ENGENHARIA DE INFRAESTRUTURA S.A.",
        },
        **todos
    }

    caminho_unif = os.path.join(DADOS_DIR, "dados.json")
    tmp = caminho_unif + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(dados_unificados, f, ensure_ascii=False)
    os.replace(tmp, caminho_unif)
    
    tamanho_kb = os.path.getsize(caminho_unif) / 1024
    print(f"[ok] dados.json criado: {tamanho_kb:.1f} KB")

    # ============================================================
    # MANIFESTO (versao.json)
    # ============================================================
    versao = {
        "gerado_em": datetime.now().isoformat(),
        "total_datasets": len(todos),
        "inventario": {nome: len(regs) for nome, regs in todos.items()},
        "arquivo_unificado": "dados.json",
        "tamanho_unificado_kb": round(tamanho_kb, 1),
    }
    with open(os.path.join(DADOS_DIR, "versao.json"), "w", encoding="utf-8") as f:
        json.dump(versao, f, ensure_ascii=False, indent=2)

    print(f"\n{'='*60}")
    print("✅ Concluído!")
    print(f"   {len(todos)} JSONs individuais + 1 dados.json unificado")
    print(f"   Local: {DADOS_DIR}")


if __name__ == "__main__":
    main()