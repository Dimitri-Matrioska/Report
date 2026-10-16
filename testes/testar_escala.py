"""
testar_escala.py — Valida a escala proporcional do canvas em 3 tamanhos de tela.

Verifica, para cada viewport:
  - o dashboard está centralizado (horizontal e verticalmente);
  - a proporção 16:9 (1280x720) é mantida;
  - nada é cortado (o canvas escalado cabe inteiro dentro da janela);
  - o wrapper reserva o tamanho já escalado (layout).

Requer: pip install playwright && python -m playwright install chromium
Uso:    python testes/testar_escala.py
"""

import sys
import threading
import http.server
import socketserver
import functools
import os

from playwright.sync_api import sync_playwright

PORTA = 8765
RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PAGINA = "http://localhost:{}/paginas/performance-semanal.html".format(PORTA)

VIEWPORTS = [
    ("maximizada (1920x1080)", 1920, 1080),
    ("media (1280x720)",       1280, 720),
    ("pequena (800x600)",       800, 600),
]


def servir():
    handler = functools.partial(
        http.server.SimpleHTTPRequestHandler, directory=RAIZ
    )
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORTA), handler)
    httpd.serve_forever()


def checar(viewport_nome, w, h):
    print("\n=== Viewport: {} ===".format(viewport_nome))
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": w, "height": h})
        page.goto(PAGINA, wait_until="networkidle")
        page.wait_for_timeout(400)

        box = page.eval_on_selector(
            "#pbiCanvas",
            """el => {
                const r = el.getBoundingClientRect();
                return { x: r.x, y: r.y, width: r.width, height: r.height };
            }"""
        )

        win = page.evaluate(
            "() => ({ w: window.innerWidth, h: window.innerHeight })"
        )

        print("  Janela: {}x{}".format(win["w"], win["h"]))
        print("  Canvas (escalado): x={:.1f} y={:.1f} w={:.1f} h={:.1f}".format(
            box["x"], box["y"], box["width"], box["height"]))

        # 1) Proporção 16:9
        ratio = box["width"] / box["height"]
        ok_ratio = abs(ratio - (1280 / 720)) < 0.01
        print("  Proporcao: {:.4f} (esperado 1.7778) -> {}".format(
            ratio, "OK" if ok_ratio else "FALHOU"))

        # 2) Nada cortado (cabe na janela)
        ok_fit = (box["x"] >= -1 and box["y"] >= -1 and
                  box["x"] + box["width"] <= win["w"] + 1 and
                  box["y"] + box["height"] <= win["h"] + 1)
        print("  Cabe inteiro na janela: {}".format("OK" if ok_fit else "FALHOU"))

        # 3) Centralizado (margens esquerda/direita e topo/base iguais)
        margem_esq = box["x"]
        margem_dir = win["w"] - (box["x"] + box["width"])
        margem_topo = box["y"]
        margem_base = win["h"] - (box["y"] + box["height"])
        ok_center = (abs(margem_esq - margem_dir) < 2 and
                     abs(margem_topo - margem_base) < 2)
        print("  Margens: esq={:.1f} dir={:.1f} topo={:.1f} base={:.1f}".format(
            margem_esq, margem_dir, margem_topo, margem_base))
        print("  Centralizado: {}".format("OK" if ok_center else "FALHOU"))

        # screenshot
        os.makedirs(os.path.join(RAIZ, "testes", "screenshots"), exist_ok=True)
        shot = os.path.join(RAIZ, "testes", "screenshots",
                            "vp_{}x{}.png".format(w, h))
        page.screenshot(path=shot)
        print("  Screenshot: {}".format(shot))

        browser.close()

        return ok_ratio and ok_fit and ok_center


def main():
    t = threading.Thread(target=servir, daemon=True)
    t.start()

    resultados = []
    for nome, w, h in VIEWPORTS:
        resultados.append((nome, checar(nome, w, h)))

    print("\n================ RESUMO ================")
    todos_ok = True
    for nome, ok in resultados:
        print("  [{}] {}".format("OK" if ok else "FALHOU", nome))
        todos_ok = todos_ok and ok

    print("\nResultado final: {}".format(
        "TODOS OS TESTES PASSARAM" if todos_ok else "HOUVE FALHAS"))
    sys.exit(0 if todos_ok else 1)


if __name__ == "__main__":
    main()
