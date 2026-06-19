#!/usr/bin/env python3
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
TARGET = ROOT / "android" / "app" / "src" / "main" / "assets" / "www"

if not (DIST / "index.html").exists():
    raise SystemExit("dist/index.html is missing. Run npm run build first.")

if TARGET.exists():
    shutil.rmtree(TARGET)
shutil.copytree(DIST, TARGET)

# Android packages local assets and does not use a service worker. The runtime
# detects the PaperFlockAndroid user-agent token and skips registration.
print(f"Synced {sum(1 for p in TARGET.rglob('*') if p.is_file())} files to {TARGET}")
