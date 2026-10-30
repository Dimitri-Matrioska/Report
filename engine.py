import tkinter as tk
from tkinter import ttk, messagebox
import subprocess
import sys
import os

class MainDashboard(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Sistema de Gestão - Relatório de Drenagem")
        self.geometry("500x350")
        self.minsize(450, 300)

        # Configuração de estilo visual simples e moderno
        style = ttk.Style()
        style.theme_use("clam")

        self.criar_widgets()

    def criar_widgets(self):
        # Título Principal
        lbl_titulo = tk.Label(
            self, 
            text="Painel de Controle Principal", 
            font=("Arial", 16, "bold"), 
            fg="#001d37"
        )
        lbl_titulo.pack(pady=20)

        lbl_sub = tk.Label(
            self, 
            text="Selecione o módulo que deseja abrir:", 
            font=("Arial", 10), 
            fg="#555555"
        )
        lbl_sub.pack(pady=(0, 20))

        # Frame central para os botões
        frame_botoes = tk.Frame(self)
        frame_botoes.pack(fill=tk.BOTH, expand=True, padx=40)

        # Botão 1: Conversor do Excel
        btn_converter = tk.Button(
            frame_botoes, 
            text="📊 Executar Conversor (Excel → JSONs)", 
            command=self.abrir_conversor,
            bg="#4a5568", 
            fg="white", 
            font=("Arial", 11, "bold"),
            padx=10, pady=12,
            cursor="hand2"
        )
        btn_converter.pack(fill=tk.X, pady=10)

        # Botão 2: Editor de Mapeamento de Áreas
        btn_editor = tk.Button(
            frame_botoes, 
            text="🗺️ Abrir Editor de Áreas (Ortofoto)", 
            command=self.abrir_editor_areas,
            bg="#21a85a", 
            fg="white", 
            font=("Arial", 11, "bold"),
            padx=10, pady=12,
            cursor="hand2"
        )
        btn_editor.pack(fill=tk.X, pady=10)

        # Rodapé com informações
        lbl_rodape = tk.Label(
            self, 
            text="Dica: Os scripts rodam de forma independente.", 
            font=("Arial", 8, "italic"), 
            fg="#888888"
        )
        lbl_rodape.pack(side=tk.BOTTOM, pady=10)

    def abrir_conversor(self):
        script_nome = "Engine/converter.py"  # Certifique-se de que o arquivo se chama assim
        self.executar_script(script_nome)

    def abrir_editor_areas(self):
        script_nome = "Engine/Gerador-imagem.py"  # Nome do seu script atualizado
        self.executar_script(script_nome)

    def executar_script(self, nome_arquivo):
        if not os.path.exists(nome_arquivo):
            messagebox.showerror(
                "Erro", 
                f"O arquivo '{nome_arquivo}' não foi encontrado na pasta atual!\nCertifique-se de que ele está no mesmo diretório."
            )
            return
        
        try:
            # Abre o script em um processo separado usando o mesmo interpretador python ativo
            subprocess.Popen([sys.executable, nome_arquivo])
        except Exception as e:
            messagebox.showerror("Erro", f"Não foi possível abrir o script:\n{e}")

if __name__ == "__main__":
    app = MainDashboard()
    app.mainloop()
