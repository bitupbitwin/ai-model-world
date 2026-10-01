"""本地静态验收：目录映射 index.html；未知地址返回本站 404.html 和 HTTP 404。"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / "out"
if not (ROOT / "index.html").is_file() or not (ROOT / "404.html").is_file():
    raise SystemExit("请先执行 npm run build")

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_error(self, code, message=None, explain=None):
        if code != 404:
            return super().send_error(code, message, explain)
        content = (ROOT / "404.html").read_bytes()
        self.send_response(404)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(content)

if __name__ == "__main__":
    print("本地验收地址：http://127.0.0.1:4321/", flush=True)
    ThreadingHTTPServer(("127.0.0.1", 4321), Handler).serve_forever()
