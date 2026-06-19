from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os
import webbrowser

ROOT = Path(__file__).resolve().parent
os.chdir(ROOT)

address = ("127.0.0.1", 8080)
url = f"http://{address[0]}:{address[1]}/"

print(f"Paper Flock is running at {url}")
print("Press Ctrl+C to stop the server.")
webbrowser.open(url)

ThreadingHTTPServer(address, SimpleHTTPRequestHandler).serve_forever()
