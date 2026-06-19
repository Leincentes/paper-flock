#!/usr/bin/env python3
from pathlib import Path
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
BUNDLE = ROOT / "release-bundle"
VERSION = "1.0"

if not DIST.exists():
    raise SystemExit("Run npm run build first.")

BUNDLE.mkdir(exist_ok=True)
archive_path = BUNDLE / f"paper-flock-v{VERSION}-release.zip"
checksum_path = BUNDLE / "release-checksums.txt"
sbom_path = BUNDLE / "sbom.cdx.json"

if not sbom_path.exists():
    raise SystemExit("Generate release-bundle/sbom.cdx.json first.")

fixed_time = (2026, 1, 1, 0, 0, 0)
if archive_path.exists():
    archive_path.unlink()

files = sorted(
    path for path in DIST.rglob("*")
    if path.is_file()
)

with zipfile.ZipFile(
    archive_path,
    "w",
    compression=zipfile.ZIP_DEFLATED,
    compresslevel=9
) as archive:
    for path in files:
        relative = path.relative_to(DIST).as_posix()
        info = zipfile.ZipInfo(
            f"paper-flock-v{VERSION}/{relative}",
            fixed_time
        )
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        archive.writestr(info, path.read_bytes())

    info = zipfile.ZipInfo(
        f"paper-flock-v{VERSION}/sbom.cdx.json",
        fixed_time
    )
    info.compress_type = zipfile.ZIP_DEFLATED
    info.external_attr = 0o644 << 16
    archive.writestr(info, sbom_path.read_bytes())

digest = hashlib.sha256(archive_path.read_bytes()).hexdigest()
checksum_path.write_text(
    f"{digest}  {archive_path.name}\n",
    encoding="utf-8"
)

print(json.dumps({
    "archive": str(archive_path),
    "sha256": digest,
    "files": len(files) + 1
}, indent=2))
