import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from PIL import Image, ImageTk
import json
import os

# Desativa o limite de proteção contra imagens gigantes (Decompression Bomb)
Image.MAX_IMAGE_PIXELS = None

# ============================================================
# DIRETÓRIOS BASE (Ancorados na raiz onde o engine.py é executado)
# ============================================================
RAIZ = os.getcwd()
DADOS_DIR = os.path.join(RAIZ, "dados")
JSON_PATH = os.path.join(DADOS_DIR, "mapeamento_areas.json")
SERVICOS_JSON_DEFAULT = os.path.join(DADOS_DIR, "servicos_notaveis.json")
CONFIG_PATH = os.path.join(RAIZ, "config.json")
FOTOS_DIR = os.path.join(RAIZ, "ortofoto", "fotos-detalhes")

os.makedirs(DADOS_DIR, exist_ok=True)
os.makedirs(FOTOS_DIR, exist_ok=True)

class MapAreaEditor:
    def __init__(self, root):
        self.root = root
        self.root.title("Gerador de Mapeamento de Áreas - Ortofoto Drenagem")
        self.root.geometry("1400x800")
        
        self.areas = []
        self.servicos_raw_data = []
        self.servicos_json_path = SERVICOS_JSON_DEFAULT
        self.current_img = None
        self.raw_img = None
        self.img_width = 0
        self.img_height = 0
        self.scale = 1.0
        self.zoom_scale = 1.0
        
        # Variáveis de controle para o modo "Marcar Realizado"
        self.realize_poly_target = None
        self.realize_start_pos = None
        self.hover_point = None
        
        self.lista_servicos_disponiveis = [
            "Drenagem Profunda", 
            "Drenagem Superficial",
            "Escada hidráulica",
            "Drenagem"
        ]
        
        self.servicos_status_vars = {}
        self.drawing_mode = tk.StringVar(value="ponto")
        self.current_polygon_points = []
        self.current_polyline_points = []

        # Layout Principal (Dividido entre Canvas e Painel Lateral com Abas)
        main_paned = tk.PanedWindow(root, orient=tk.HORIZONTAL, bg="#cccccc")
        main_paned.pack(fill=tk.BOTH, expand=True)

        # Frame esquerdo (Canvas e Topo)
        left_frame = tk.Frame(main_paned)
        main_paned.add(left_frame, minsize=850)

        # Barra Superior de Ferramentas
        top_frame = tk.Frame(left_frame, bg="#f0f0f0", padx=5, pady=5)
        top_frame.pack(fill=tk.X)

        btn_load_img = tk.Button(top_frame, text="1. Carregar Ortofoto", command=self.load_image, bg="#001d37", fg="white")
        btn_load_img.pack(side=tk.LEFT, padx=3)

        btn_load_json = tk.Button(top_frame, text="Carregar JSON Serviços", command=self.load_services_json, bg="#4a5568", fg="white")
        btn_load_json.pack(side=tk.LEFT, padx=3)

        # Controles de Zoom
        tk.Label(top_frame, text="Zoom:", bg="#f0f0f0", font=("Arial", 9, "bold")).pack(side=tk.LEFT, padx=(8, 2))
        btn_zoom_in = tk.Button(top_frame, text="🔍+", command=self.zoom_in, bg="#2563eb", fg="white", width=3)
        btn_zoom_in.pack(side=tk.LEFT, padx=1)
        btn_zoom_out = tk.Button(top_frame, text="🔍-", command=self.zoom_out, bg="#2563eb", fg="white", width=3)
        btn_zoom_out.pack(side=tk.LEFT, padx=1)
        btn_zoom_reset = tk.Button(top_frame, text="1:1", command=self.reset_zoom, bg="#475569", fg="white", width=3)
        btn_zoom_reset.pack(side=tk.LEFT, padx=1)

        tk.Label(top_frame, text="Raio(px):", bg="#f0f0f0").pack(side=tk.LEFT, padx=(8, 2))
        self.radius_spin = tk.Spinbox(top_frame, from_=10, to=300, width=4)
        self.radius_spin.delete(0, "end")
        self.radius_spin.insert(0, "50")
        self.radius_spin.pack(side=tk.LEFT, padx=2)

        tk.Label(top_frame, text="Modo:", bg="#f0f0f0", font=("Arial", 9, "bold")).pack(side=tk.LEFT, padx=(8, 2))
        tk.Radiobutton(top_frame, text="Ponto", variable=self.drawing_mode, value="ponto", bg="#f0f0f0", command=self.on_mode_change).pack(side=tk.LEFT)
        tk.Radiobutton(top_frame, text="Poligonal", variable=self.drawing_mode, value="poligono", bg="#f0f0f0", command=self.on_mode_change).pack(side=tk.LEFT)
        tk.Radiobutton(top_frame, text="Polilinha", variable=self.drawing_mode, value="polilinha", bg="#f0f0f0", command=self.on_mode_change).pack(side=tk.LEFT)
        tk.Radiobutton(top_frame, text="Marcar Realizado", variable=self.drawing_mode, value="marcar_realizado", bg="#f0f0f0", command=self.on_mode_change).pack(side=tk.LEFT)

        self.btn_finish_poly = tk.Button(top_frame, text="Finalizar Polig. (Dir)", command=self.finish_polygon, bg="#d97706", fg="white", state=tk.DISABLED)
        self.btn_finish_poly.pack(side=tk.LEFT, padx=2)

        self.btn_finish_line = tk.Button(top_frame, text="Finalizar Linha (Dir)", command=self.finish_polyline, bg="#0284c7", fg="white", state=tk.DISABLED)
        self.btn_finish_line.pack(side=tk.LEFT, padx=2)

        btn_save = tk.Button(top_frame, text="Salvar JSON", command=self.save_json, bg="#21a85a", fg="white")
        btn_save.pack(side=tk.RIGHT, padx=3)

        # Canvas com Scrollbars para Zoom e Pan
        canvas_frame = tk.Frame(left_frame)
        canvas_frame.pack(fill=tk.BOTH, expand=True)
        
        self.canvas = tk.Canvas(canvas_frame, bg="#333333", cursor="cross")
        hbar = ttk.Scrollbar(canvas_frame, orient=tk.HORIZONTAL, command=self.canvas.xview)
        vbar = ttk.Scrollbar(canvas_frame, orient=tk.VERTICAL, command=self.canvas.yview)
        self.canvas.config(xscrollcommand=hbar.set, yscrollcommand=vbar.set)
        
        vbar.pack(side=tk.RIGHT, fill=tk.Y)
        hbar.pack(side=tk.BOTTOM, fill=tk.X)
        self.canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        self.canvas.bind("<Button-1>", self.on_canvas_click)
        self.canvas.bind("<Button-3>", self.on_right_click)      # Botão direito para finalizar desenho
        self.canvas.bind("<Motion>", self.on_mouse_motion)       # Magnetismo e indicador de hover na polilinha
        self.canvas.bind("<ButtonPress-2>", self.start_pan)      # Botão do meio para arrastar (Pan)
        self.canvas.bind("<B2-Motion>", self.do_pan)
        self.canvas.bind("<MouseWheel>", self.on_mouse_wheel)    # Zoom com roda do mouse
        self.canvas.bind("<Button-4>", self.on_mouse_wheel)
        self.canvas.bind("<Button-5>", self.on_mouse_wheel)

        # ============================================================
        # Frame Direito (Painel Lateral com Abas / Notebook)
        # ============================================================
        right_container = tk.Frame(main_paned, bg="#f9f9f9")
        main_paned.add(right_container, minsize=380)

        self.notebook = ttk.Notebook(right_container)
        self.notebook.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        # --- ABA 1: Áreas e Linhas Mapeadas ---
        tab_areas = ttk.Frame(self.notebook)
        self.notebook.add(tab_areas, text="Áreas e Linhas")

        tk.Label(tab_areas, text="Gerenciar Pontos, Poligonais e Polilinhas", font=("Arial", 10, "bold")).pack(anchor="w", padx=10, pady=(10, 5))

        list_container = tk.Frame(tab_areas)
        list_container.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)

        self.areas_listbox = tk.Listbox(list_container, font=("Arial", 9), selectmode=tk.SINGLE)
        scrollbar = tk.Scrollbar(list_container, orient=tk.VERTICAL, command=self.areas_listbox.yview)
        self.areas_listbox.config(yscrollcommand=scrollbar.set)
        
        self.areas_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.areas_listbox.bind("<<ListboxSelect>>", self.on_area_select)

        btn_action_frame = tk.Frame(tab_areas)
        btn_action_frame.pack(fill=tk.X, padx=10, pady=10)

        btn_edit = tk.Button(btn_action_frame, text="Editar Selecionado", command=self.edit_selected_area, bg="#2563eb", fg="white", width=15)
        btn_edit.pack(side=tk.LEFT, padx=2)

        btn_delete = tk.Button(btn_action_frame, text="Excluir", command=self.delete_selected_area, bg="#dc2626", fg="white", width=12)
        btn_delete.pack(side=tk.RIGHT, padx=2)

        # --- ABA 2: Serviços Exibidos (Checkboxes) ---
        tab_servicos = ttk.Frame(self.notebook)
        self.notebook.add(tab_servicos, text="Serviços Exibidos")

        tk.Label(tab_servicos, text="Marque os serviços que deseja exibir no mapa:", font=("Arial", 10, "bold")).pack(anchor="w", padx=10, pady=(10, 5))

        servicos_scroll_container = tk.Frame(tab_servicos)
        servicos_scroll_container.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)

        self.servicos_canvas = tk.Canvas(servicos_scroll_container, borderwidth=0, highlightthickness=0)
        self.servicos_scrollbar = ttk.Scrollbar(servicos_scroll_container, orient="vertical", command=self.servicos_canvas.yview)
        self.servicos_frame_interno = ttk.Frame(self.servicos_canvas)

        self.servicos_frame_interno.bind(
            "<Configure>",
            lambda e: self.servicos_canvas.configure(scrollregion=self.servicos_canvas.bbox("all"))
        )
        self.servicos_canvas.create_window((0, 0), window=self.servicos_frame_interno, anchor="nw")
        self.servicos_canvas.configure(yscrollcommand=self.servicos_scrollbar.set)

        self.servicos_canvas.pack(side="left", fill="both", expand=True)
        self.servicos_scrollbar.pack(side="right", fill="y")

        btn_salvar_servicos = tk.Button(tab_servicos, text="Salvar Seleção de Serviços", command=self.salvar_servicos_visiveis, bg="#21a85a", fg="white")
        btn_salvar_servicos.pack(fill=tk.X, padx=10, pady=10)

        self.auto_load_state()

    def auto_load_state(self):
        if os.path.exists(JSON_PATH):
            try:
                with open(JSON_PATH, "r", encoding="utf-8") as f:
                    self.areas = json.load(f)
                self.update_listbox()
            except Exception:
                pass

        if os.path.exists(CONFIG_PATH):
            try:
                with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                    config = json.load(f)
                    img_path = config.get("last_image_path")
                    if img_path and os.path.exists(img_path):
                        self.load_image_from_path(img_path, save_config_flag=False)
            except Exception:
                pass

        if os.path.exists(SERVICOS_JSON_DEFAULT):
            try:
                with open(SERVICOS_JSON_DEFAULT, "r", encoding="utf-8") as f:
                    self.servicos_raw_data = json.load(f)
                self.servicos_json_path = SERVICOS_JSON_DEFAULT
                servicos = set()
                for item in self.servicos_raw_data:
                    if isinstance(item, dict):
                        val = item.get("servico_notavel")
                        if val is not None and str(val).strip() != "":
                            servicos.add(str(val).strip())
                if servicos:
                    self.lista_servicos_disponiveis = sorted(list(servicos))
            except Exception:
                pass

        self.popular_painel_servicos()

    def zoom_in(self):
        if self.raw_img:
            self.zoom_scale = min(self.zoom_scale * 1.25, 8.0)
            self.redraw_areas()

    def zoom_out(self):
        if self.raw_img:
            self.zoom_scale = max(self.zoom_scale / 1.25, 0.2)
            self.redraw_areas()

    def reset_zoom(self):
        if self.raw_img:
            self.zoom_scale = 1.0
            self.redraw_areas()

    def on_mouse_wheel(self, event):
        if not self.raw_img:
            return
        if event.delta > 0 or event.num == 4:
            self.zoom_in()
        elif event.delta < 0 or event.num == 5:
            self.zoom_out()

    def start_pan(self, event):
        self.canvas.scan_mark(event.x, event.y)

    def do_pan(self, event):
        self.canvas.scan_dragto(event.x, event.y, gain=1)

    def on_mouse_motion(self, event):
        if not self.raw_img:
            return
        if self.drawing_mode.get() == "marcar_realizado":
            canvas_x = self.canvas.canvasx(event.x)
            canvas_y = self.canvas.canvasy(event.y)
            real_x = canvas_x / self.scale
            real_y = canvas_y / self.scale
            
            poly, seg_idx, t_val, pt = self.find_closest_point_on_polyline(real_x, real_y, max_dist=35)
            if poly:
                self.hover_point = pt
            else:
                self.hover_point = None
            self.redraw_areas()

    def popular_painel_servicos(self):
        for widget in self.servicos_frame_interno.winfo_children():
            widget.destroy()
        self.servicos_status_vars.clear()

        for servico in self.lista_servicos_disponiveis:
            estado_inicial = True
            if self.servicos_raw_data:
                for item in self.servicos_raw_data:
                    if isinstance(item, dict) and str(item.get("servico_notavel") or "").strip() == servico:
                        if item.get("exibir") == "nao" or item.get("exibir") == "não" or item.get("exibir") is False:
                            estado_inicial = False
                        break

            var = tk.BooleanVar(value=estado_inicial)
            self.servicos_status_vars[servico] = var
            
            chk = ttk.Checkbutton(
                self.servicos_frame_interno, 
                text=servico, 
                variable=var, 
                command=self.salvar_servicos_visiveis
            )
            chk.pack(anchor="w", padx=5, pady=4)

    def salvar_servicos_visiveis(self):
        if not self.servicos_raw_data:
            if os.path.exists(self.servicos_json_path):
                try:
                    with open(self.servicos_json_path, "r", encoding="utf-8") as f:
                        self.servicos_raw_data = json.load(f)
                except Exception:
                    self.servicos_raw_data = []

        status_dict = {servico: var.get() for servico, var in self.servicos_status_vars.items()}
        
        for item in self.servicos_raw_data:
            if isinstance(item, dict):
                servico = str(item.get("servico_notavel") or "").strip()
                if servico in status_dict:
                    item["exibir"] = "sim" if status_dict[servico] else "nao"

        try:
            with open(self.servicos_json_path, "w", encoding="utf-8") as f:
                json.dump(self.servicos_raw_data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            messagebox.showerror("Erro", f"Não foi possível atualizar o parâmetro 'exibir' no JSON:\n{e}")

    def save_config(self, img_path):
        try:
            with open(CONFIG_PATH, "w", encoding="utf-8") as f:
                json.dump({"last_image_path": img_path}, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

    def on_mode_change(self):
        mode = self.drawing_mode.get()
        if mode != "poligono":
            self.cancel_current_polygon()
        if mode != "polilinha":
            self.cancel_current_polyline()
        if mode != "marcar_realizado":
            self.realize_poly_target = None
            self.realize_start_pos = None
            self.hover_point = None
            self.redraw_areas()

    def cancel_current_polygon(self):
        self.current_polygon_points.clear()
        self.btn_finish_poly.config(state=tk.DISABLED)
        self.redraw_areas()

    def cancel_current_polyline(self):
        self.current_polyline_points.clear()
        self.btn_finish_line.config(state=tk.DISABLED)
        self.redraw_areas()

    def load_image(self):
        file_path = filedialog.askopenfilename(filetypes=[("Imagens", "*.jpg *.jpeg *.png *.tif")])
        if not file_path:
            return
        self.zoom_scale = 1.0
        self.load_image_from_path(file_path, save_config_flag=True)

    def load_image_from_path(self, file_path, save_config_flag=True):
        try:
            self.raw_img = Image.open(file_path)
            self.img_width, self.img_height = self.raw_img.size
            self.redraw_areas()

            if save_config_flag:
                self.save_config(file_path)
        except Exception as e:
            messagebox.showerror("Erro", f"Não foi possível carregar a imagem:\n{e}")

    def load_services_json(self):
        file_path = filedialog.askopenfilename(filetypes=[("JSON Files", "*.json")])
        if not file_path:
            return
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                self.servicos_raw_data = json.load(f)
            self.servicos_json_path = file_path
            
            servicos = set()
            for item in self.servicos_raw_data:
                if isinstance(item, dict):
                    val = item.get("servico_notavel")
                    if val is not None and str(val).strip() != "":
                        servicos.add(str(val).strip())
            if servicos:
                self.lista_servicos_disponiveis = sorted(list(servicos))
                self.popular_painel_servicos()
                self.salvar_servicos_visiveis()
                messagebox.showinfo("Sucesso", f"{len(self.lista_servicos_disponiveis)} serviços carregados e atualizados!")
            else:
                messagebox.showwarning("Aviso", "Nenhum campo 'servico_notavel' válido encontrado no JSON.")
        except Exception as e:
            messagebox.showerror("Erro", f"Falha ao ler o ficheiro JSON:\n{e}")

    def find_closest_point_on_polyline(self, rx, ry, max_dist=30):
        best_dist = float('inf')
        best_poly = None
        best_seg_idx = 0
        best_t = 0.0
        best_pt = (0, 0)

        for area in self.areas:
            if area.get("tipo") == "polilinha":
                points = area["pontos"]
                for i in range(len(points) - 1):
                    p1 = points[i]
                    p2 = points[i+1]
                    
                    v_x = p2[0] - p1[0]
                    v_y = p2[1] - p1[1]
                    w_x = rx - p1[0]
                    w_y = ry - p1[1]

                    c1 = w_x * v_x + w_y * v_y
                    if c1 <= 0:
                        t = 0.0
                        proj_x, proj_y = p1[0], p1[1]
                    else:
                        c2 = v_x * v_x + v_y * v_y
                        if c2 <= c1:
                            t = 1.0
                            proj_x, proj_y = p2[0], p2[1]
                        else:
                            t = c1 / c2
                            proj_x = p1[0] + t * v_x
                            proj_y = p1[1] + t * v_y

                    dist = ((rx - proj_x)**2 + (ry - proj_y)**2)**0.5
                    if dist < best_dist:
                        best_dist = dist
                        best_poly = area
                        best_seg_idx = i
                        best_t = t
                        best_pt = (proj_x, proj_y)

        if best_dist <= max_dist:
            return best_poly, best_seg_idx, best_t, best_pt
        return None, -1, 0.0, (0, 0)

    def on_canvas_click(self, event):
        if not self.current_img:
            messagebox.showwarning("Aviso", "Carregue uma ortofoto primeiro!")
            return

        canvas_x = self.canvas.canvasx(event.x)
        canvas_y = self.canvas.canvasy(event.y)

        real_x = int(canvas_x / self.scale)
        real_y = int(canvas_y / self.scale)

        mode = self.drawing_mode.get()

        if mode == "ponto":
            raio = int(self.radius_spin.get())
            resultado = self.open_properties_dialog("Detalhes do Ponto", "Trecho Drenagem", self.lista_servicos_disponiveis[0] if self.lista_servicos_disponiveis else "", "")
            if not resultado:
                return

            nova_area = {
                "id": f"area_{len(self.areas) + 1}_{int(os.urandom(2).hex(), 16)}",
                "tipo": "ponto",
                "nome_area": resultado["nome_area"],
                "servico_notavel": resultado["servico_notavel"],
                "foto_miniatura": resultado["foto_miniatura"],
                "x": real_x,
                "y": real_y,
                "raio": raio
            }
            self.areas.append(nova_area)
            self.redraw_areas()
            self.update_listbox()
            self.save_json_silent()

        elif mode == "poligono":
            self.current_polygon_points.append([real_x, real_y])
            self.btn_finish_poly.config(state=tk.NORMAL)
            self.redraw_areas()

        elif mode == "polilinha":
            self.current_polyline_points.append([real_x, real_y])
            self.btn_finish_line.config(state=tk.NORMAL)
            self.redraw_areas()

        elif mode == "marcar_realizado":
            poly, seg_idx, t_val, pt = self.find_closest_point_on_polyline(real_x, real_y, max_dist=40)
            if not poly:
                messagebox.showwarning("Aviso", "Aproxime o cursor de uma polilinha para fixar o ponto de realizado.")
                return

            if self.realize_poly_target is None:
                self.realize_poly_target = poly
                self.realize_start_pos = (seg_idx, t_val)
                self.redraw_areas()
                # Pop-up inicial removido para maior fluidez
            else:
                if poly == self.realize_poly_target:
                    start_pos = self.realize_start_pos
                    end_pos = (seg_idx, t_val)
                    
                    if start_pos > end_pos:
                        start_pos, end_pos = end_pos, start_pos

                    # Suporte a múltiplos trechos realizados (realizado_ranges)
                    if "realizado_ranges" not in poly:
                        poly["realizado_ranges"] = []
                        if "realizado_range" in poly:
                            poly["realizado_ranges"].append(poly.pop("realizado_range"))

                    poly["realizado_ranges"].append({
                        "start_seg": start_pos[0],
                        "start_t": start_pos[1],
                        "end_seg": end_pos[0],
                        "end_t": end_pos[1]
                    })
                    
                    self.realize_poly_target = None
                    self.realize_start_pos = None
                    self.redraw_areas()
                    self.update_listbox()
                    self.save_json_silent()
                else:
                    self.realize_poly_target = poly
                    self.realize_start_pos = (seg_idx, t_val)
                    self.redraw_areas()

    def on_right_click(self, event):
        mode = self.drawing_mode.get()
        if mode == "poligono" and len(self.current_polygon_points) >= 3:
            self.finish_polygon()
        elif mode == "polilinha" and len(self.current_polyline_points) >= 2:
            self.finish_polyline()

    def finish_polygon(self):
        if len(self.current_polygon_points) < 3:
            messagebox.showwarning("Aviso", "Uma poligonal precisa de pelo menos 3 pontos.")
            return

        resultado = self.open_properties_dialog("Detalhes da Poligonal", "Área Poligonal", self.lista_servicos_disponiveis[0] if self.lista_servicos_disponiveis else "", "", is_polyline=False)
        if not resultado:
            self.cancel_current_polygon()
            return

        nova_area = {
            "id": f"area_{len(self.areas) + 1}_{int(os.urandom(2).hex(), 16)}",
            "tipo": "poligono",
            "nome_area": resultado["nome_area"],
            "servico_notavel": resultado["servico_notavel"],
            "foto_miniatura": resultado["foto_miniatura"],
            "pontos": list(self.current_polygon_points)
        }
        self.areas.append(nova_area)
        self.current_polygon_points.clear()
        self.btn_finish_poly.config(state=tk.DISABLED)
        self.redraw_areas()
        self.update_listbox()
        self.save_json_silent()

    def finish_polyline(self):
        if len(self.current_polyline_points) < 2:
            messagebox.showwarning("Aviso", "Uma polilinha precisa de pelo menos 2 pontos.")
            return

        resultado = self.open_properties_dialog("Detalhes da Polilinha", "Canaleta / Drenagem", "", "", is_polyline=True)
        if not resultado:
            self.cancel_current_polyline()
            return

        nova_area = {
            "id": f"area_{len(self.areas) + 1}_{int(os.urandom(2).hex(), 16)}",
            "tipo": "polilinha",
            "nome_area": resultado["nome_area"],
            "servico_notavel": "",  
            "realizado_ranges": [],
            "pontos": list(self.current_polyline_points)
        }
        self.areas.append(nova_area)
        self.current_polyline_points.clear()
        self.btn_finish_line.config(state=tk.DISABLED)
        self.redraw_areas()
        self.update_listbox()
        self.save_json_silent()

    def open_properties_dialog(self, title, default_name, default_service, default_foto, is_polyline=False):
        dialog = tk.Toplevel(self.root)
        dialog.title(title)
        dialog.geometry("400x320" if is_polyline else "400x280")
        dialog.grab_set()

        tk.Label(dialog, text="Nome da Área / Linha:", font=("Arial", 10, "bold")).pack(anchor="w", padx=15, pady=(10, 2))
        entry_nome = tk.Entry(dialog, width=45)
        entry_nome.pack(padx=15, pady=2)
        entry_nome.insert(0, default_name)

        combo_servico = None
        entry_foto = None

        if not is_polyline:
            tk.Label(dialog, text="Serviço Notável (Vínculo com o JSON):", font=("Arial", 10, "bold")).pack(anchor="w", padx=15, pady=(10, 2))
            combo_servico = ttk.Combobox(dialog, values=self.lista_servicos_disponiveis, width=42)
            combo_servico.pack(padx=15, pady=2)
            if default_service in self.lista_servicos_disponiveis:
                combo_servico.set(default_service)
            elif self.lista_servicos_disponiveis:
                combo_servico.current(0)

            tk.Label(dialog, text="Foto Miniatura:", font=("Arial", 10, "bold")).pack(anchor="w", padx=15, pady=(10, 2))
            
            foto_frame = tk.Frame(dialog)
            foto_frame.pack(padx=15, pady=2, fill=tk.X)

            entry_foto = tk.Entry(foto_frame, width=30)
            entry_foto.pack(side=tk.LEFT, padx=(0, 5))
            entry_foto.insert(0, default_foto)

            def procurar_foto():
                file_path = filedialog.askopenfilename(parent=dialog, filetypes=[("Imagens", "*.jpg *.jpeg *.png")])
                if file_path:
                    try:
                        filename = os.path.basename(file_path)
                        name, ext = os.path.splitext(filename)
                        dest_filename = f"{name}.jpg"
                        dest_path = os.path.join(FOTOS_DIR, dest_filename)
                        
                        with Image.open(file_path) as img:
                            if img.mode in ("RGBA", "P"):
                                img = img.convert("RGB")
                            
                            max_dim = 1200
                            if img.width > max_dim or img.height > max_dim:
                                img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
                            
                            img.save(dest_path, "JPEG", quality=80, optimize=True)
                        
                        entry_foto.delete(0, tk.END)
                        entry_foto.insert(0, f"ortofoto/fotos-detalhes/{dest_filename}")
                    except Exception as e:
                        messagebox.showerror("Erro", f"Não foi possível compactar e salvar a foto:\n{e}", parent=dialog)

            btn_procurar = tk.Button(foto_frame, text="Procurar...", command=procurar_foto, bg="#4a5568", fg="white")
            btn_procurar.pack(side=tk.LEFT)
        else:
            tk.Label(dialog, text="Dica: Use o modo 'Marcar Realizado' para adicionar\nmúltiplos trechos executados (verde) clicando na linha.", font=("Arial", 9), fg="#555555").pack(anchor="w", padx=15, pady=10)
            
            limpar_var = tk.BooleanVar(value=False)
            chk_limpar = tk.Checkbutton(dialog, text="Zerar/Limpar todos os trechos realizados desta linha", variable=limpar_var, fg="#dc2626")
            chk_limpar.pack(anchor="w", padx=15, pady=5)

        resultado = {}

        def confirmar():
            if not entry_nome.get().strip():
                messagebox.showerror("Erro", "O nome não pode estar vazio.", parent=dialog)
                return
            resultado["nome_area"] = entry_nome.get()
            if not is_polyline:
                resultado["servico_notavel"] = combo_servico.get() if combo_servico else ""
                resultado["foto_miniatura"] = entry_foto.get() if entry_foto else ""
            else:
                resultado["limpar_realizados"] = limpar_var.get()
            dialog.destroy()

        btn_ok = tk.Button(dialog, text="Salvar", command=confirmar, bg="#21a85a", fg="white", width=15)
        btn_ok.pack(pady=15)

        self.root.wait_window(dialog)
        return resultado if resultado else None

    def get_sub_polyline_points(self, points, seg_start, t_start, seg_end, t_end):
        if (seg_start, t_start) > (seg_end, t_end):
            seg_start, t_start, seg_end, t_end = seg_end, t_end, seg_start, t_start

        sub_pts = []
        p1 = points[seg_start]
        p2 = points[seg_start + 1]
        start_pt = [p1[0] + t_start * (p2[0] - p1[0]), p1[1] + t_start * (p2[1] - p1[1])]
        sub_pts.append(start_pt)

        for i in range(seg_start + 1, seg_end + 1):
            sub_pts.append(points[i])

        if seg_end < len(points) - 1:
            q1 = points[seg_end]
            q2 = points[seg_end + 1]
            end_pt = [q1[0] + t_end * (q2[0] - q1[0]), q1[1] + t_end * (q2[1] - q1[1])]
            if sub_pts[-1] != end_pt:
                sub_pts.append(end_pt)

        return sub_pts

    def redraw_areas(self):
        if not self.raw_img:
            return
        
        max_size = 800
        base_scale = min(max_size / self.img_width, max_size / self.img_height, 1.0)
        self.scale = base_scale * self.zoom_scale
        
        display_w = int(self.img_width * self.scale)
        display_h = int(self.img_height * self.scale)
        
        resized = self.raw_img.resize((display_w, display_h), Image.Resampling.LANCZOS)
        self.current_img = ImageTk.PhotoImage(resized)
        
        self.canvas.config(scrollregion=(0, 0, display_w, display_h))
        self.canvas.delete("all")
        self.canvas.create_image(0, 0, image=self.current_img, anchor=tk.NW)

        for idx, area in enumerate(self.areas):
            tipo = area.get("tipo", "ponto")
            
            if tipo == "ponto":
                sx = area["x"] * self.scale
                sy = area["y"] * self.scale
                sr = area["raio"] * self.scale

                self.canvas.create_oval(
                    sx - sr, sy - sr, sx + sr, sy + sr,
                    outline="#f5b700", width=2, fill="#f5b700",
                    tags="area_shape", stipple="gray50"
                )
                self.canvas.create_text(
                    sx, sy, text=f"{idx+1}: {area['nome_area']}",
                    fill="white", font=("Arial", 9, "bold"), tags="area_shape"
                )
                
            elif tipo == "poligono":
                scaled_points = [(p[0] * self.scale, p[1] * self.scale) for p in area["pontos"]]
                flat_points = [coord for pt in scaled_points for coord in pt]
                
                if len(flat_points) >= 4:
                    self.canvas.create_polygon(
                        flat_points, outline="#3b82f6", width=2, fill="#3b82f6",
                        tags="area_shape", stipple="gray50"
                    )
                    cx = sum(p[0] for p in scaled_points) / len(scaled_points)
                    cy = sum(p[1] for p in scaled_points) / len(scaled_points)
                    self.canvas.create_text(
                        cx, cy, text=f"{idx+1}: {area['nome_area']}",
                        fill="white", font=("Arial", 9, "bold"), tags="area_shape"
                    )
                    
            elif tipo == "polilinha":
                points = area["pontos"]
                scaled_points = [(p[0] * self.scale, p[1] * self.scale) for p in points]
                flat_points = [coord for pt in scaled_points for coord in pt]
                
                if len(flat_points) >= 4:
                    line_width = max(2, int(2 * self.zoom_scale))
                    # Linha inteira em Branco (Previsto)
                    self.canvas.create_line(
                        flat_points, fill="#ffffff", width=line_width,
                        tags="area_shape"
                    )
                    
                    # Suporte a múltiplos trechos realizados em Verde (#22c55e)
                    r_ranges = area.get("realizado_ranges", [])
                    if not r_ranges and area.get("realizado_range"):
                        r_ranges = [area.get("realizado_range")]

                    for r_range in r_ranges:
                        sub_pts = self.get_sub_polyline_points(points, r_range["start_seg"], r_range["start_t"], r_range["end_seg"], r_range["end_t"])
                        if len(sub_pts) >= 2:
                            sub_scaled = [(p[0] * self.scale, p[1] * self.scale) for p in sub_pts]
                            sub_flat = [coord for pt in sub_scaled for coord in pt]
                            self.canvas.create_line(
                                sub_flat, fill="#22c55e", width=line_width + 1,
                                tags="area_shape"
                            )

                    cx = sum(p[0] for p in scaled_points) / len(scaled_points)
                    cy = sum(p[1] for p in scaled_points) / len(scaled_points)
                    self.canvas.create_text(
                        cx, cy, text=f"{idx+1}: {area['nome_area']}",
                        fill="yellow", font=("Arial", 9, "bold"), tags="area_shape"
                    )

        if self.drawing_mode.get() == "marcar_realizado" and self.hover_point:
            hx = self.hover_point[0] * self.scale
            hy = self.hover_point[1] * self.scale
            r = 7
            self.canvas.create_oval(hx - r, hy - r, hx + r, hy + r, outline="#38bdf8", width=2, fill="#0284c7", tags="magnet_cursor")

        if self.drawing_mode.get() == "marcar_realizado" and self.realize_poly_target and self.realize_start_pos:
            seg, t = self.realize_start_pos
            pts = self.realize_poly_target["pontos"]
            if seg < len(pts) - 1:
                p1, p2 = pts[seg], pts[seg+1]
                sx_real = p1[0] + t * (p2[0] - p1[0])
                sy_real = p1[1] + t * (p2[1] - p1[1])
                sx = sx_real * self.scale
                sy = sy_real * self.scale
                r = 8
                self.canvas.create_oval(sx - r, sy - r, sx + r, sy + r, outline="#f59e0b", width=3, fill="#ef4444", tags="start_cursor")

        if self.current_polygon_points:
            scaled_curr = [(p[0] * self.scale, p[1] * self.scale) for p in self.current_polygon_points]
            for pt in scaled_curr:
                self.canvas.create_oval(pt[0]-4, pt[1]-4, pt[0]+4, pt[1]+4, fill="#ef4444", outline="white")
            if len(scaled_curr) >= 2:
                flat_curr = [coord for pt in scaled_curr for coord in pt]
                self.canvas.create_line(flat_curr, fill="#ef4444", width=2, dash=(4, 2))

        if self.current_polyline_points:
            scaled_curr = [(p[0] * self.scale, p[1] * self.scale) for p in self.current_polyline_points]
            for pt in scaled_curr:
                self.canvas.create_oval(pt[0]-3, pt[1]-3, pt[0]+3, pt[1]+3, fill="#38bdf8", outline="white")
            if len(scaled_curr) >= 2:
                flat_curr = [coord for pt in scaled_curr for coord in pt]
                self.canvas.create_line(flat_curr, fill="#ffffff", width=2, dash=(4, 2))

    def update_listbox(self):
        self.areas_listbox.delete(0, tk.END)
        for idx, area in enumerate(self.areas):
            tipo = area.get("tipo", "ponto")
            if tipo == "ponto":
                tipo_txt = "[Ponto]"
            elif tipo == "poligono":
                tipo_txt = "[Poligonal]"
            elif tipo == "polilinha":
                tipo_txt = "[Polilinha]"
            else:
                tipo_txt = "[Área]"
            self.areas_listbox.insert(tk.END, f"{idx+1}. {tipo_txt} {area['nome_area']}")

    def on_area_select(self, event):
        selection = self.areas_listbox.curselection()
        if not selection:
            return
        idx = selection[0]
        area = self.areas[idx]
        
        self.redraw_areas()
        
        tipo = area.get("tipo", "ponto")
        if tipo == "ponto":
            sx = area["x"] * self.scale
            sy = area["y"] * self.scale
            sr = area["raio"] * self.scale
            self.canvas.create_oval(sx - sr - 4, sy - sr - 4, sx + sr + 4, sy + sr + 4, outline="#ef4444", width=3, tags="highlight")
        elif tipo == "poligono" or tipo == "polilinha":
            scaled_points = [(p[0] * self.scale, p[1] * self.scale) for p in area["pontos"]]
            flat_points = [coord for pt in scaled_points for coord in pt]
            if len(flat_points) >= 4:
                self.canvas.create_line(flat_points, fill="#ef4444", width=4, tags="highlight")

    def edit_selected_area(self):
        selection = self.areas_listbox.curselection()
        if not selection:
            messagebox.showwarning("Aviso", "Selecione um item na lista para editar.")
            return
        idx = selection[0]
        area = self.areas[idx]

        tipo = area.get("tipo", "ponto")
        if tipo == "polilinha":
            resultado = self.open_properties_dialog(
                "Editar Polilinha",
                area["nome_area"],
                "",
                "",
                is_polyline=True
            )
            if resultado:
                area["nome_area"] = resultado["nome_area"]
                if resultado.get("limpar_realizados"):
                    area["realizado_ranges"] = []
                    area.pop("realizado_range", None)
                self.redraw_areas()
                self.update_listbox()
                self.save_json_silent()
        else:
            resultado = self.open_properties_dialog(
                "Editar Área Mapeada", 
                area["nome_area"], 
                area["servico_notavel"], 
                area.get("foto_miniatura", ""),
                is_polyline=False
            )
            if resultado:
                area["nome_area"] = resultado["nome_area"]
                area["servico_notavel"] = resultado["servico_notavel"]
                area["foto_miniatura"] = resultado["foto_miniatura"]
                self.redraw_areas()
                self.update_listbox()
                self.save_json_silent()

    def delete_selected_area(self):
        selection = self.areas_listbox.curselection()
        if not selection:
            messagebox.showwarning("Aviso", "Selecione um item na lista para excluir.")
            return
        idx = selection[0]
        
        if messagebox.askyesno("Confirmar Exclusão", "Deseja realmente excluir este item selecionado?"):
            del self.areas[idx]
            self.redraw_areas()
            self.update_listbox()
            self.save_json_silent()

    def save_json_silent(self):
        try:
            with open(JSON_PATH, "w", encoding="utf-8") as f:
                json.dump(self.areas, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

    def save_json(self):
        if not self.areas:
            messagebox.showwarning("Aviso", "Nenhum item mapeado para salvar.")
            return

        try:
            with open(JSON_PATH, "w", encoding="utf-8") as f:
                json.dump(self.areas, f, ensure_ascii=False, indent=2)
            messagebox.showinfo("Sucesso", f"Mapeamento salvo com sucesso em:\n{JSON_PATH}")
        except Exception as e:
            messagebox.showerror("Erro", f"Não foi possível salvar o arquivo:\n{e}")

if __name__ == "__main__":
    root = tk.Tk()
    app = MapAreaEditor(root)
    root.mainloop()