"""Copy the web-sized art into web/assets.

Sources (read-only):
- art/canvas/      the exact images used on the Claude Design canvas (sigils, rings, tokens, loans, card backs)
- mock/assets/     the WebP copies made from the original art by mock/make_assets.py

Only the files listed below are copied. A rerun skips files whose size and mtime are unchanged.
Nothing from the Targaryen deck, Beyond the Wall or the EPIC house cards is included.

Run from the project folder:  python -I tools/build_assets.py
"""
import json
import os
import shutil
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CANVAS = os.path.join(ROOT, "art", "canvas")
MOCK = os.path.join(ROOT, "mock", "assets")
OUT = os.path.join(ROOT, "web", "assets")

HOUSES = ["lannister", "tyrell", "bolton", "arryn", "martell", "greyjoy", "red", "tully", "white"]
CANVAS_SIGIL = {"red": "rote_targaryen", "white": "weisse_targaryen"}

# (source, target) pairs relative to the source roots and web/assets
PLAN = []
for h in HOUSES:
    PLAN.append((os.path.join(CANVAS, f"sigil-{CANVAS_SIGIL.get(h, h)}.webp"), f"sigils/{h}.webp"))
for name in ["ring-gold", "ring-outline", "token-supply", "token-port", "token-fortification", "token-stronghold",
             "token-bridge", "token-support", "token-holdingcell", "back-mercenary", "loan-gold"]:
    PLAN.append((os.path.join(CANVAS, f"{name}.webp"), f"icons/{name}.webp"))
for i in range(1, 6):
    PLAN.append((os.path.join(CANVAS, f"loan-red-{i}.webp"), f"icons/loan-red-{i}.webp"))
for sub in ["westeros", "council", "loan", "dowry"]:
    folder = os.path.join(MOCK, "cards", sub)
    for f in sorted(os.listdir(folder)):
        if not f.endswith(".webp") or "targaryen" in f and sub == "westeros":
            continue
        PLAN.append((os.path.join(folder, f), f"cards/{sub}/{f}"))
for f in sorted(os.listdir(os.path.join(MOCK, "backs"))):
    PLAN.append((os.path.join(MOCK, "backs", f), f"backs/{f}"))


def same(src, dst):
    if not os.path.exists(dst):
        return False
    a, b = os.stat(src), os.stat(dst)
    return a.st_size == b.st_size and int(a.st_mtime) <= int(b.st_mtime)


def main():
    copied = skipped = 0
    missing = []
    manifest = {}
    for src, rel in PLAN:
        if not os.path.exists(src):
            missing.append(src)
            continue
        dst = os.path.join(OUT, rel.replace("/", os.sep))
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        if same(src, dst):
            skipped += 1
        else:
            shutil.copy2(src, dst)
            copied += 1
        manifest[rel] = os.path.getsize(dst)
    with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=1, sort_keys=True)
    total = sum(manifest.values())
    print(f"copied {copied}, unchanged {skipped}, files {len(manifest)}, {total / 1e6:.1f} MB")
    if missing:
        print("missing:", *missing, sep="\n  ")
        return 1
    if total > 40e6:
        print("too large: more than 40 MB")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
