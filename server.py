from __future__ import annotations

import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent


class QuietHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, format: str, *args) -> None:  # noqa: A003
        return


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    server = ThreadingHTTPServer(('127.0.0.1', port), QuietHandler)
    print(f'Serving dashboard at http://127.0.0.1:{port}')
    server.serve_forever()
