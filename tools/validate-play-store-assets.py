#!/usr/bin/env python3
from pathlib import Path
import json
import struct

ROOT = Path(__file__).resolve().parents[1]
STORE = ROOT / "play-store"
ANDROID = ROOT / "android"

problems = []

def text(path):
    return path.read_text(encoding="utf-8").strip()

def png_info(path):
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"{path} is not PNG")
    width, height, bit_depth, color_type = struct.unpack(">IIBB", data[16:26])
    return width, height, bit_depth, color_type, len(data)

title = text(STORE / "listing/en-US/title.txt")
short = text(STORE / "listing/en-US/short-description.txt")
full = text(STORE / "listing/en-US/full-description.txt")
if len(title) > 30:
    problems.append(f"title is {len(title)} characters; maximum is 30")
if len(short) > 80:
    problems.append(f"short description is {len(short)} characters; maximum is 80")
if len(full) > 4000:
    problems.append(f"full description is {len(full)} characters; maximum is 4000")

icon = png_info(STORE / "graphics/app-icon-512.png")
if icon[:2] != (512, 512):
    problems.append(f"store icon dimensions are {icon[:2]}, expected 512x512")
if icon[3] not in (4, 6):
    problems.append("store icon must include alpha")
if icon[4] > 1024 * 1024:
    problems.append("store icon exceeds 1 MB")

feature = png_info(STORE / "graphics/feature-graphic-1024x500.png")
if feature[:2] != (1024, 500):
    problems.append(f"feature graphic dimensions are {feature[:2]}, expected 1024x500")
if feature[3] in (4, 6):
    problems.append("feature graphic must not include alpha")

screens = sorted((STORE / "graphics/phone").glob("*.png"))
if len(screens) < 3:
    problems.append("at least three phone screenshots are required by this project gate")
for screen in screens:
    info = png_info(screen)
    if info[:2] != (1080, 1920):
        problems.append(f"{screen.name} is {info[:2]}, expected 1080x1920")
    if info[3] in (4, 6):
        problems.append(f"{screen.name} must not include alpha")

manifest = text(ANDROID / "app/src/main/AndroidManifest.xml")
if "android.permission.INTERNET" in manifest:
    problems.append("Android manifest unexpectedly requests Internet permission")
if "android.permission.VIBRATE" not in manifest:
    problems.append("Android manifest is missing VIBRATE permission")
if 'android:appCategory="game"' not in manifest:
    problems.append("Android manifest is missing game app category")

gradle = text(ANDROID / "app/build.gradle.kts")
for required in (
    'applicationId = "com.gamelostudio.paperflock"',
    "targetSdk = 36",
    "versionCode = 10404",
    'versionName = "1.4.4"',
    'androidx.webkit:webkit:1.16.0',
):
    if required not in gradle:
        problems.append(f"Android Gradle configuration missing: {required}")

result = {
    "product": "Paper Flock",
    "version": "1.4.4",
    "packageName": "com.gamelostudio.paperflock",
    "titleCharacters": len(title),
    "shortDescriptionCharacters": len(short),
    "fullDescriptionCharacters": len(full),
    "storeIcon": {
        "width": icon[0], "height": icon[1], "bytes": icon[4]
    },
    "featureGraphic": {
        "width": feature[0], "height": feature[1], "bytes": feature[4]
    },
    "phoneScreenshots": [
        {"file": p.name, "width": png_info(p)[0], "height": png_info(p)[1], "bytes": png_info(p)[4]}
        for p in screens
    ],
    "targetSdk": 36,
    "permissionSet": ["android.permission.VIBRATE"],
    "problems": problems,
    "passed": not problems,
}
(STORE / "asset-validation.json").write_text(
    json.dumps(result, indent=2) + "\n",
    encoding="utf-8"
)
print(json.dumps(result, indent=2))
if problems:
    raise SystemExit(1)
