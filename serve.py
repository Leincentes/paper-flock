from argparse import ArgumentParser
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os
import webbrowser

ROOT = Path(__file__).resolve().parent


class PaperFlockHandler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".webmanifest": "application/manifest+json",
        ".js": "text/javascript; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".svg": "image/svg+xml",
    }

    def end_headers(self) -> None:
        if self.path.split("?", 1)[0].endswith("/service-worker.js"):
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.send_header("Service-Worker-Allowed", "./")
        elif self.path.split("?", 1)[0].endswith("/index.html") or self.path == "/":
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()


def main() -> None:
    parser = ArgumentParser(description="Run Paper Flock locally.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()

    os.chdir(ROOT)
    address = (args.host, args.port)
    display_host = "127.0.0.1" if args.host == "0.0.0.0" else args.host
    url = f"http://{display_host}:{args.port}/"

    print(f"Paper Flock is running at {url}")
    if args.host == "0.0.0.0":
        print(
            "LAN testing is available, but install/offline features require "
            "HTTPS or localhost."
        )
    print("Press Ctrl+C to stop the server.")

    if not args.no_browser:
        webbrowser.open(url)

    ThreadingHTTPServer(address, PaperFlockHandler).serve_forever()


if __name__ == "__main__":
    main()
