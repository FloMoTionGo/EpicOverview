"""Build the web-sized assets for the static mock.

Reads the original art under F:\\EPIC Game of Thrones (read-only) and writes
WebP copies plus assets.js (window.ASSETS) into mock/assets. Run:
    python -I make_assets.py
"""
import glob
import json
import math
import os
import re
import sys

from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.abspath(os.path.join(HERE, "..", ".."))  # F:\EPIC Game of Thrones
OUT = os.path.join(HERE, "assets")
Image.MAX_IMAGE_PIXELS = None


def out_path(*parts):
    p = os.path.join(OUT, *parts)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    return p


def rel(p):
    return os.path.relpath(p, HERE).replace("\\", "/")


def save_webp(im, path, quality=82):
    if im.mode not in ("RGB", "RGBA"):
        im = im.convert("RGBA")
    im.save(path, "WEBP", quality=quality, method=5)
    return rel(path)


def resized(src, width):
    im = Image.open(src)
    im = im.convert("RGBA") if "A" in im.getbands() else im.convert("RGB")
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    return im


# ---------------------------------------------------------------- sigils
def sigils():
    d = os.path.join(SRC, "EPIC Tokens", "Diplomacy tokens")
    files = {
        "lannister": "token - Diplomacy Lannister.png",
        "martell": "token - Diplomacy Martell.png",
        "arryn": "token - Diplomacy Arryn.png",
        "tully": "token - Diplomacy Tully.png",
        "tyrell": "token - Diplomacy Tyrell.png",
        "greyjoy": "token - Diplomacy Greyjoy.png",
        "rote_targaryen": "token - Diplomacy Targaryen .png",
    }
    res = {}
    for key, f in files.items():
        res[key] = save_webp(resized(os.path.join(d, f), 192), out_path("sigils", key + ".webp"))

    # White Targaryen: the red dragon becomes ivory.
    im = resized(os.path.join(d, files["rote_targaryen"]), 192).convert("RGBA")
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if r > g + 35 and r > b + 35:
                v = min(255, 110 + int(r * 0.62))
                px[x, y] = (v, v - 6, v - 18, a)
    res["weisse_targaryen"] = save_webp(im, out_path("sigils", "weisse_targaryen.webp"))

    # Bolton placeholder: medallion ring like the others, pink field, flayed man.
    size = 192
    ring = resized(os.path.join(d, "token - Diplomacy Stark .png"), size).convert("RGBA")
    field = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    g = ImageDraw.Draw(field)
    for r in range(78, 0, -1):  # radial gradient
        t = r / 78
        col = (int(196 - 70 * t), int(120 - 62 * t), int(128 - 60 * t), 255)
        g.ellipse((96 - r, 96 - r, 96 + r, 96 + r), fill=col)
    noise = Image.effect_noise((size, size), 22).convert("L").filter(ImageFilter.GaussianBlur(0.6))
    field = Image.composite(field, Image.new("RGBA", (size, size), (90, 30, 38, 255)),
                            noise.point(lambda v: 255 if v > 40 else 225))
    fig = ImageDraw.Draw(field)
    ink = (52, 14, 20, 255)
    cx = 96
    fig.ellipse((cx - 11, 128, cx + 11, 150), fill=ink)          # head (hanging down)
    fig.line((cx, 128, cx, 76), fill=ink, width=10)               # body
    fig.line((cx, 112, cx - 38, 138), fill=ink, width=7)          # arms
    fig.line((cx, 112, cx + 38, 138), fill=ink, width=7)
    fig.line((cx, 78, cx - 26, 46), fill=ink, width=8)            # legs (up)
    fig.line((cx, 78, cx + 26, 46), fill=ink, width=8)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((96 - 78, 96 - 78, 96 + 78, 96 + 78), fill=255)
    bolton = ring.copy()
    bolton.paste(field, (0, 0), mask)
    res["bolton"] = save_webp(bolton, out_path("sigils", "bolton.webp"))
    return res


# ---------------------------------------------------------------- tokens
def tokens():
    t = os.path.join(SRC, "EPIC Tokens")
    files = {
        "fortification": "token - fortification.png",
        "stronghold": "token - stronghold.png",
        "bridge": "token  - bridge.png",
        "port": "Port token.png",
        "supply": "token - supply.png",
        "ring": "Marriage Ring token.png",
        "holdingcell": "Holding Cell token.png",
        "gold": os.path.join("Orders", "consolidate sea.png"),
    }
    res = {k: save_webp(resized(os.path.join(t, f), 160), out_path("tokens", k + ".webp")) for k, f in files.items()}
    for f in sorted(glob.glob(os.path.join(t, "Orders", "*.png"))):
        key = "order_" + re.sub(r"[^a-z0-9]+", "_", os.path.splitext(os.path.basename(f))[0].lower()).strip("_")
        res[key] = save_webp(resized(f, 120), out_path("tokens", key + ".webp"))
    return res


# ---------------------------------------------------------------- cards
def card_set(kind, pattern, parse, thumb_w, zoom_w):
    items = []
    for f in sorted(glob.glob(os.path.join(SRC, pattern))):
        base = os.path.splitext(os.path.basename(f))[0]
        info = parse(base)
        if info is None:
            continue
        slug = re.sub(r"[^a-z0-9]+", "-", base.lower()).strip("-")
        im = Image.open(f)
        landscape = im.width > im.height
        tw, zw = (thumb_w[1], zoom_w[1]) if landscape else (thumb_w[0], zoom_w[0])
        info.update(
            id=f"{kind}-{slug}",
            thumb=save_webp(resized(f, tw), out_path("cards", kind, slug + "-t.webp")),
            zoom=save_webp(resized(f, zw), out_path("cards", kind, slug + "-z.webp"), quality=84),
            landscape=landscape,
        )
        items.append(info)
    return items


def p_plain(b):
    return {"name": b}


def p_tactic(b):
    grp, name = b.split(" - ", 1)
    return {"name": name, "order": {"att": "March", "con": "Consolidate", "def": "Defense",
                                    "raid": "Raid", "sup": "Support"}[grp]}


def p_merc(b):
    m = re.match(r"merc - (\d) (.+)", b)
    return {"name": m.group(2), "strength": int(m.group(1))} if m else None


def p_council(b):
    m = re.match(r"(\d) (.+)", b)
    return {"name": m.group(2), "seat": int(m.group(1))}


def p_dowry(b):
    m = re.match(r"dowry - (\w+) F", b)
    return {"house": m.group(1)} if m else None


def p_westeros(b):
    m = re.match(r"(\d) (.+?)(?: (\d)[ab]?| (I{1,3}|IV))?$", b)
    deck, name, val = int(m.group(1)), m.group(2), m.group(3)
    return {"deck": deck, "name": name, "value": int(val) if val else None}


def cards():
    hi = ((300, 360), (720, 900))
    return {
        "intrigue": card_set("intrigue", "EPIC Intrigue Cards/Intrigue Cards - 30/*.png", p_plain, *hi),
        "tactic": card_set("tactic", "EPIC Tactic Cards/Tactic Cards - 14/*.png", p_tactic, *hi),
        "objective": card_set("objective", "EPIC Objectives/Objective Cards - 49/*.png", p_plain, *hi),
        "mercenary": card_set("mercenary", "EPIC House Cards/Mercenaries - 14/merc*.png", p_merc, *hi),
        "council": card_set("council", "EPIC Small Council/[1-7]*.png", p_council, *hi),
        "dowry": card_set("dowry", "EPIC Dowry Cards/*F.png", p_dowry, *hi),
        "loan": card_set("loan", "EPIC Loan Cards/Loans - 10/*.png", p_plain, *hi),
        "westeros": card_set("westeros", "EPIC Westeros Cards/Deck I*/*.png", p_westeros, *hi),
    }


def backs():
    w = os.path.join(SRC, "EPIC Westeros Cards")
    files = {
        "westeros1": os.path.join(w, "Westeros Deck I - back.png"),
        "westeros2": os.path.join(w, "Westeros Deck II - back.png"),
        "westeros3": os.path.join(w, "Westeros Deck III - back.png"),
        "westeros4": os.path.join(w, "Westeros Deck IV - back.png"),
        "intrigue": os.path.join(SRC, "EPIC Intrigue Cards", "Intrigue Card - back.png"),
        "objective": os.path.join(SRC, "EPIC Objectives", "Objective Card - back.png"),
        "tactic": os.path.join(SRC, "EPIC Tactic Cards", "Tactic Card - back.png"),
        "mercenary": os.path.join(SRC, "EPIC House Cards", "Mercenaries - 14", "House Back - Mercenaries.png"),
    }
    out = {}
    for k, f in files.items():
        landscape = Image.open(f).width > Image.open(f).height
        out[k] = save_webp(resized(f, 360 if landscape else 300), out_path("backs", k + ".webp"))
    return out


def board():
    im = resized(os.path.join(SRC, "EPIC main board.png"), 1400).convert("RGB")
    return save_webp(im, out_path("board.webp"), quality=70)


def main():
    data = {"sigils": sigils(), "tokens": tokens(), "cards": cards(), "backs": backs(), "board": board()}
    # Deck I*/ also matched "Deck II/III/IV" folders; split by the parsed deck number.
    with open(os.path.join(OUT, "assets.js"), "w", encoding="utf-8") as fh:
        fh.write("window.ASSETS = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n")
    total = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(OUT) for f in fs)
    counts = {k: len(v) for k, v in data["cards"].items()}
    print("cards:", counts, "| size MB:", round(total / 1e6, 1))


if __name__ == "__main__":
    sys.exit(main())
