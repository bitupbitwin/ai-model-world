"""目录首页与 404 验收；--gzip-dir 模拟 OSS 按原对象键返回预压缩字节及响应头。"""
import argparse
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

WORKSPACE = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser(description="OneNova 本地静态验收服务器")
parser.add_argument("--port", type=int, default=4321)
parser.add_argument("--gzip-dir", help="本地 --plan 生成的预压缩目录")
parser.add_argument("--manifest", help="同次 --plan 生成的 version 2 清单")
args = parser.parse_args()
if bool(args.gzip_dir) != bool(args.manifest):
    raise SystemExit("模拟 gzip 必须同时提供 --gzip-dir 和 --manifest")
ROOT = (WORKSPACE / (args.gzip_dir or "out")).resolve()
ROOT.relative_to(WORKSPACE)  # 仅允许本站工作目录。
HEADERS = None
if args.manifest:
    manifest_path = (WORKSPACE / args.manifest).resolve()
    manifest_path.relative_to(WORKSPACE)
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("version") != 2:
        raise SystemExit("模拟 gzip 只接受 version 2 清单")
    HEADERS = manifest["files"]
if not (ROOT / "index.html").is_file() or not (ROOT / "404.html").is_file():
    raise SystemExit("缺少首页或 404；请先构建并生成预压缩目录")

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *handler_args, **kwargs):
        super().__init__(*handler_args, directory=str(ROOT), **kwargs)

    def object_headers(self, key):
        if HEADERS is None:
            self.send_header("Content-Type", "text/html; charset=utf-8")
            return
        metadata = HEADERS[key]
        self.send_header("Content-Type", metadata["contentType"])
        self.send_header("Cache-Control", metadata["cacheControl"])
        if metadata["contentEncoding"]:
            self.send_header("Content-Encoding", metadata["contentEncoding"])

    def send_head(self):
        if HEADERS is None:
            return super().send_head()
        file = Path(self.translate_path(self.path)).resolve()
        try:
            file.relative_to(ROOT)
        except ValueError:
            self.send_error(404)
            return None
        if file.is_dir():
            parts = urlsplit(self.path)
            if not parts.path.endswith("/"):
                self.send_response(301)
                self.send_header("Location", urlunsplit((parts.scheme, parts.netloc, parts.path + "/", parts.query, parts.fragment)))
                self.send_header("Content-Length", "0")
                self.end_headers()
                return None
            file = file / "index.html"
        key = file.relative_to(ROOT).as_posix()
        if key not in HEADERS or not file.is_file():
            self.send_error(404)
            return None
        self.send_response(200)
        self.object_headers(key)
        self.send_header("Content-Length", str(file.stat().st_size))
        self.end_headers()
        return file.open("rb")

    def send_error(self, code, message=None, explain=None):
        if code != 404:
            return super().send_error(code, message, explain)
        content = (ROOT / "404.html").read_bytes()
        self.send_response(404)
        self.object_headers("404.html")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(content)

if __name__ == "__main__":
    print(f"本地验收地址：http://127.0.0.1:{args.port}/；gzip 模拟：{HEADERS is not None}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()
