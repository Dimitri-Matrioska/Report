"""
linkar_dados.py — Excel → JSONs individuais + dados.json unificado (com Interface Gráfica)
"""

import os
import sys
import json
import unicodedata
from datetime import datetime
import threading
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import pandas as pd

# ============================================================
# CONFIGURAÇÃO
# ============================================================
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXCEL_PADRAO = os.path.join(RAIZ, "DataBase", "Dados_GeraisReport_AFR.xlsx")
DADOS_DIR = os.path.join(RAIZ, "dados")

os.makedirs(DADOS_DIR, exist_ok=True)


# ============================================================
# HELPERS (Inalterados)
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
        if apelido_norm in cols_norm:
            return cols_norm[apelido_norm]
    for apelido in apelidos:
        apelido_norm = normalizar(apelido)
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
            "tp_desvio":          (["tp_desvio"], to_str),
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
            "id_desvio":         (["ID Desvio"], to_str),
            "data_desvio":       (["Data do Desvio"], to_iso),
            "acao":              (["Ação"], to_str),
            "status":            (["Status"], to_str),
            "prazo":             (["Prazo"], to_iso),
            "data_conclusao":    (["Data real de conclusão"], to_iso),
            "potencial_gravidade": (["Potencial de Gravidade"], to_str),
            "tipo":              (["Tipo"], to_str),
        },
    },
    "sla": {
        "abas": ["SLA"],
        "cols": {
            "validacao":        (["Validação"], to_str),
            "id_contrato":      (["ID Contrato"], to_str),
            "contratada":       (["Contratada"], to_str),
            "mes":              (["Mês"], to_iso),
            "indicador":        (["Indicador"], to_str),
            "meta":             (["Meta"], to_str),
            "resultado":        (["Resultado"], to_num),
            "aplicacao":        (["Aplicação SLA"], to_num),
        },
    },
    "medicoes": {
        "abas": ["Medições"],
        "cols": {
            "id_contrato":         (["ID Contrato"], to_str),
            "contratada":          (["Contratada"], to_str),
            "mes_referencia":      (["Mês Referência"], to_iso),
            "baseline_acum":       (["Baseline Acumulada"], to_num),
            "r_acumulado":         (["R$ Acumulado"], to_num),
            "r_saldo":             (["R$ Saldo"], to_num),
            "status":              (["Status"], to_str),
            "aderencia":           (["Aderência"], to_num),
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
            "previsto":         (["Avanço Previsto"], to_num),
            "real":             (["Real"], to_num),
            "avanco":           (["Avanço"], to_num),
            "aderencia_real":   (["Aderência Real"], to_num),
        },
    },
}


# ============================================================
# PROCESSAMENTO (Inalterado na essência)
# ============================================================
def processar_aba(df, spec):
    """Aplica o mapeamento declarativo e retorna lista de dicts."""
    mapa = {}
    faltando = []
    for campo, (apelidos, _tipo) in spec["cols"].items():
        col_real = achar_coluna(df, apelidos)
        if col_real is None:
            faltando.append(campo)
        else:
            mapa[campo] = (col_real, _tipo)

    registros = []
    for _, row in df.iterrows():
        reg = {}
        for campo, (col_real, func) in mapa.items():
            reg[campo] = func(row[col_real])
        if any(v is not None for v in reg.values()):
            registros.append(reg)
    return registros


def filtrar_servicos_notaveis(registros):
    """Mantém apenas os serviços notáveis relacionados a drenagem."""
    filtrados = []
    for r in registros:
        servico = str(r.get("servico_notavel") or "")
        if "drenagem" in normalizar(servico):
            filtrados.append(r)
    return filtrados


def extrair_config_padrao(excel_path):
    """Lê a aba Config da planilha e retorna os valores de A1:A3/B1:B3 padronizados."""
    padrao = {
        "raw": {},
        "data_status": None,
        "semana": None,
        "ano": None,
        "mes_referencia": None,
    }
    try:
        xls = pd.ExcelFile(excel_path)
        aba_config = achar_aba(xls, ["Config"])
        if not aba_config:
            return padrao

        df = pd.read_excel(excel_path, sheet_name=aba_config, header=None)
        if df.empty or df.shape[1] < 2:
            return padrao

        for idx in range(3):
            if idx >= len(df):
                continue
            label = df.iloc[idx, 0]
            valor = df.iloc[idx, 1]
            if pd.isna(label) or str(label).strip() == "":
                continue
            chave = str(label).strip()
            
            # Converte objetos datetime/timestamp para string ISO evitando erro no JSON
            if isinstance(valor, (pd.Timestamp, datetime)):
                valor = to_iso(valor)
            elif hasattr(valor, "strftime"):
                valor = valor.strftime("%Y-%m-%d")

            padrao["raw"][chave] = valor

        chaves_norm = {normalizar(k): k for k in padrao["raw"]}

        for nome, destino in [
            ("Data de status", "data_status"),
            ("Data Status", "data_status"),
            ("Data status", "data_status"),
            ("Semana", "semana"),
            ("Ano", "ano"),
        ]:
            chave = chaves_norm.get(normalizar(nome))
            if chave is None:
                continue
            valor = padrao["raw"][chave]
            if destino == "data_status":
                padrao[destino] = to_iso(valor)
            elif destino == "semana":
                padrao[destino] = to_int(valor)
            elif destino == "ano":
                padrao[destino] = to_int(valor)

        if padrao["data_status"]:
            padrao["mes_referencia"] = padrao["data_status"][:7]

        return padrao
    except Exception:
        return padrao


# ============================================================
# INTERFACE GRÁFICA (GUI)
# ============================================================
class AppConversor(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Conversor Excel → JSON (Linkar Dados)")
        self.geometry("750x700")
        self.minsize(650, 600)

        self.caminho_excel = tk.StringVar(value=EXCEL_PADRAO)
        self.vars_abas = {}

        self.criar_widgets()
        self.carregar_abas_arquivo()

    def criar_widgets(self):
        # Frame Superior: Caminho do Arquivo
        frame_topo = ttk.LabelFrame(self, text=" Arquivo Excel ", padding=10)
        frame_topo.pack(fill="x", padx=10, pady=10)

        self.entry_path = ttk.Entry(frame_topo, textvariable=self.caminho_excel, width=70)
        self.entry_path.pack(side="left", padx=(0, 5), expand=True, fill="x")

        btn_procurar = ttk.Button(frame_topo, text="Procurar...", command=self.procurar_arquivo)
        btn_procurar.pack(side="left", padx=5)

        btn_atualizar = ttk.Button(frame_topo, text="Carregar Abas", command=self.carregar_abas_arquivo)
        btn_atualizar.pack(side="left")

        # Frame Central: Abas com Checkbox
        frame_centro = ttk.LabelFrame(self, text=" Abas Disponíveis na Planilha ", padding=10)
        frame_centro.pack(fill="both", expand=True, padx=10, pady=5)

        # Selecionar Todas
        self.var_todas = tk.BooleanVar(value=True)
        chk_todas = ttk.Checkbutton(frame_centro, text="Selecionar / Desselecionar Todas", variable=self.var_todas, command=self.alternar_todas)
        chk_todas.pack(anchor="w", pady=(0, 5))

        # Canvas com Scroll para as abas
        self.canvas_abas = tk.Canvas(frame_centro, borderwidth=0, highlightthickness=0)
        self.scrollbar_abas = ttk.Scrollbar(frame_centro, orient="vertical", command=self.canvas_abas.yview)
        self.scrollable_frame = ttk.Frame(self.canvas_abas)

        self.scrollable_frame.bind(
            "<Configure>",
            lambda e: self.canvas_abas.configure(scrollregion=self.canvas_abas.bbox("all"))
        )
        self.canvas_abas.create_window((0, 0), window=self.scrollable_frame, anchor="nw")
        self.canvas_abas.configure(yscrollcommand=self.scrollbar_abas.set)

        self.canvas_abas.pack(side="left", fill="both", expand=True)
        self.scrollbar_abas.pack(side="right", fill="y")

        # Frame Inferior: Ações e Progresso
        frame_acoes = ttk.Frame(self, padding=5)
        frame_acoes.pack(fill="x", padx=10, pady=5)

        self.btn_converter = ttk.Button(frame_acoes, text="Converter Selecionadas", command=self.iniciar_conversao)
        self.btn_converter.pack(side="left", padx=(0, 10))

        self.progress = ttk.Progressbar(frame_acoes, orient="horizontal", mode="determinate")
        self.progress.pack(side="left", fill="x", expand=True, padx=5)

        # Frame Log: Fundo preto e fonte verde limão
        frame_log = ttk.LabelFrame(self, text=" Tela de Log ", padding=5)
        frame_log.pack(fill="both", expand=True, padx=10, pady=(5, 10))

        self.txt_log = tk.Text(frame_log, bg="black", fg="#00FF00", insertbackground="#00FF00", font=("Consolas", 10))
        scrollbar_log = ttk.Scrollbar(frame_log, orient="vertical", command=self.txt_log.yview)
        self.txt_log.configure(yscrollcommand=scrollbar_log.set)

        self.txt_log.pack(side="left", fill="both", expand=True)
        scrollbar_log.pack(side="right", fill="y")

    def log(self, mensagem):
        self.txt_log.insert("end", mensagem + "\n")
        self.txt_log.see("end")

    def procurar_arquivo(self):
        caminho_inicial = os.path.dirname(self.caminho_excel.get())
        if not os.path.exists(caminho_inicial):
            caminho_inicial = RAIZ
        
        arquivo = filedialog.askopenfilename(
            initialdir=caminho_inicial,
            title="Selecionar Planilha Excel",
            filetypes=[("Arquivos Excel", "*.xlsx *.xls")]
        )
        if arquivo:
            self.caminho_excel.set(arquivo)
            self.carregar_abas_arquivo()

    def carregar_abas_arquivo(self):
        for widget in self.scrollable_frame.winfo_children():
            widget.destroy()
        self.vars_abas.clear()

        excel_path = self.caminho_excel.get()
        if not os.path.isfile(excel_path):
            self.log(f"[!] Arquivo não encontrado: {excel_path}")
            return

        try:
            xls = pd.ExcelFile(excel_path)
            self.log(f"Lendo abas de: {os.path.basename(excel_path)}")
            for aba in xls.sheet_names:
                var = tk.BooleanVar(value=True)
                chk = ttk.Checkbutton(self.scrollable_frame, text=aba, variable=var)
                chk.pack(anchor="w", padx=5, pady=2)
                self.vars_abas[aba] = var
            self.log(f"-> {len(xls.sheet_names)} abas encontradas.")
        except Exception as e:
            self.log(f"[!] Erro ao ler abas do Excel: {e}")

    def alternar_todas(self):
        estado = self.var_todas.get()
        for var in self.vars_abas.values():
            var.set(estado)

    def iniciar_conversao(self):
        excel_path = self.caminho_excel.get()
        if not os.path.isfile(excel_path):
            messagebox.showerror("Erro", f"Arquivo não encontrado:\n{excel_path}")
            return

        abas_selecionadas = [aba for aba, var in self.vars_abas.items() if var.get()]
        if not abas_selecionadas:
            messagebox.showwarning("Aviso", "Selecione pelo menos uma aba para converter.")
            return

        self.btn_converter.config(state="disabled")
        self.txt_log.delete("1.0", "end")
        
        # Executa em thread separada para não congelar a interface
        threading.Thread(target=self.processar_conversao, args=(excel_path, abas_selecionadas), daemon=True).start()

    def processar_conversao(self, excel_path, abas_selecionadas):
        try:
            self.log(f"Lendo: {excel_path}")
            xls = pd.ExcelFile(excel_path)
            todos = {}
            config_padrao = extrair_config_padrao(excel_path)

            total_specs = len(SPECS)
            self.progress["maximum"] = total_specs
            self.progress["value"] = 0

            i = 0
            for nome, spec in SPECS.items():
                i += 1
                self.progress["value"] = i
                self.update_idletasks()

                # Verifica se a aba real associada a esta spec está entre as selecionadas
                aba_real = achar_aba(xls, spec["abas"])
                if not aba_real:
                    continue
                
                if aba_real not in abas_selecionadas:
                    continue

                self.log(f"\n→ {nome} (aba: {aba_real})")
                try:
                    df = pd.read_excel(excel_path, sheet_name=aba_real)
                    self.log(f"    linhas: {len(df)} | colunas: {len(df.columns)}")

                    registros = processar_aba(df, spec)
                    if nome == "servicos_notaveis":
                        registros = filtrar_servicos_notaveis(registros)
                    todos[nome] = registros

                    # Salva o JSON individual
                    caminho = os.path.join(DADOS_DIR, f"{nome}.json")
                    with open(caminho, "w", encoding="utf-8") as f:
                        json.dump(registros, f, ensure_ascii=False, indent=2)
                    self.log(f"    [ok] {len(registros)} registros extraídos → {nome}.json")
                except Exception as ex:
                    self.log(f"    [!] Erro ao processar aba {aba_real}: {ex}")

            if not todos:
                self.log("\n[!] Nenhum dataset compatível foi processado nas abas selecionadas.")
                self.btn_converter.config(state="normal")
                return

            # ============================================================
            # ARQUIVO UNIFICADO (dados.json)
            # ============================================================
            self.log(f"\n" + "="*40)
            self.log("Unificando em dados.json...")
            
            dados_unificados = {
                "versao": datetime.now().isoformat(),
                "contexto": {
                    "contratada_principal": "TERRAM ENGENHARIA DE INFRAESTRUTURA S.A.",
                },
                "config_padrao": {
                    "data_status": config_padrao.get("data_status"),
                    "semana": config_padrao.get("semana"),
                    "ano": config_padrao.get("ano"),
                    "mes_referencia": config_padrao.get("mes_referencia"),
                    "raw": config_padrao.get("raw", {}),
                },
                **todos
            }

            caminho_unif = os.path.join(DADOS_DIR, "dados.json")
            tmp = caminho_unif + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(dados_unificados, f, ensure_ascii=False)
            os.replace(tmp, caminho_unif)

            caminho_config = os.path.join(DADOS_DIR, "config.json")
            with open(caminho_config, "w", encoding="utf-8") as f:
                json.dump(dados_unificados.get("config_padrao", {}), f, ensure_ascii=False, indent=2)

            tamanho_kb = os.path.getsize(caminho_unif) / 1024
            self.log(f"[ok] dados.json criado: {tamanho_kb:.1f} KB")
            self.log(f"[ok] config.json criado: {os.path.basename(caminho_config)}")

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

            self.log(f"\n" + "="*40)
            self.log("✅ Concluído com sucesso!")
            self.log(f"    {len(todos)} JSONs individuais + 1 dados.json unificado")
            self.log(f"    Local: {DADOS_DIR}")

        except Exception as e:
            self.log(f"\n[!] Erro fatal durante a conversão: {e}")
        finally:
            self.progress["value"] = self.progress["maximum"]
            self.btn_converter.config(state="normal")


if __name__ == "__main__":
    app = AppConversor()
    app.mainloop()
