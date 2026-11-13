"""Check web/data/westeros.json against the Westeros card images.

Run from the EpicOverview folder:  python -I tools/check_cards.py
Stdlib only. Exits 1 if any problem is found, 0 otherwise.

Checks
- every card's image exists as mock/assets/<image>-z.webp
  (image is "cards/westeros/<stem>", so that is mock/assets/cards/westeros/<stem>-z.webp)
- every -z.webp in mock/assets/cards/westeros has a card entry (one entry per image file)
- ids are unique and equal the image stem
- deck is 1-4; every deck I-III card has a numeric value unless it is a reshuffle card
- every deck IV bid card has non-empty won / lowest / others; bids only appear in deck IV
- prints file and distinct-name counts per deck
"""
import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "web" / "data" / "westeros.json"
ASSETS = ROOT / "mock" / "assets"
IMG_DIR = ASSETS / "cards" / "westeros"
ROMAN = {1: "I", 2: "II", 3: "III", 4: "IV"}
REQUIRED = ("id", "deck", "name", "value", "text", "image", "reshuffle", "targaryen", "bid")


def rel(path):
    try:
        return path.relative_to(ROOT)
    except ValueError:
        return path


def main():
    problems = []

    def bad(msg):
        problems.append(msg)

    try:
        doc = json.loads(DATA.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        print(f"FAIL cannot load {DATA}: {exc}")
        return 1

    cards = doc.get("cards")
    if not isinstance(cards, list) or not cards:
        print(f"FAIL {DATA} has no 'cards' list")
        return 1

    ids = Counter(c.get("id") for c in cards if isinstance(c, dict))
    for cid, n in ids.items():
        if n > 1:
            bad(f"duplicate id {cid!r} ({n}x)")

    referenced = set()
    for i, c in enumerate(cards):
        if not isinstance(c, dict):
            bad(f"cards[{i}] is not an object")
            continue
        cid = c.get("id", f"cards[{i}]")
        missing = [k for k in REQUIRED if k not in c]
        if missing:
            bad(f"{cid}: missing keys {missing}")
            continue

        deck = c["deck"]
        if deck not in ROMAN:
            bad(f"{cid}: deck {deck!r} is not 1-4")
        if not isinstance(c["name"], str) or not c["name"].strip():
            bad(f"{cid}: empty name")
        if not isinstance(c["text"], str) or not c["text"].strip():
            bad(f"{cid}: empty text")
        for flag in ("reshuffle", "targaryen"):
            if not isinstance(c[flag], bool):
                bad(f"{cid}: {flag} must be true/false")

        image = c["image"]
        if not isinstance(image, str) or not image:
            bad(f"{cid}: empty image")
        else:
            path = ASSETS / f"{image}-z.webp"
            if not path.is_file():
                bad(f"{cid}: image not found: {rel(path)}")
            referenced.add(path.name)
            if image.rsplit("/", 1)[-1] != cid:
                bad(f"{cid}: id does not match image stem {image!r}")

        value = c["value"]
        if value is not None and (isinstance(value, bool) or not isinstance(value, int)):
            bad(f"{cid}: value {value!r} is neither a number nor null")
        if deck in (1, 2, 3) and not c["reshuffle"] and value is None:
            bad(f"{cid}: deck {ROMAN[deck]} card without a value")

        bid = c["bid"]
        if bid is not None:
            if deck != 4:
                bad(f"{cid}: bid on a deck {ROMAN.get(deck, deck)} card")
            if not isinstance(bid, dict):
                bad(f"{cid}: bid must be an object or null")
            else:
                for key in ("won", "lowest", "others"):
                    v = bid.get(key)
                    if not isinstance(v, str) or not v.strip():
                        bad(f"{cid}: bid.{key} missing or empty")
                if not isinstance(bid.get("tiebreak"), str) or not bid["tiebreak"].strip():
                    bad(f"{cid}: bid.tiebreak missing or empty")
                if bid.get("highest") is not None and not isinstance(bid["highest"], str):
                    bad(f"{cid}: bid.highest must be text or null")
        elif deck == 4 and "secretly bid" in c["text"]:
            bad(f"{cid}: text describes a bid but bid is null")

    on_disk = {p.name for p in IMG_DIR.glob("*-z.webp")}
    for name in sorted(on_disk - referenced):
        bad(f"image without card entry: {name}")

    print(f"{rel(DATA)}: {len(cards)} cards")
    for deck in sorted(ROMAN):
        in_deck = [c for c in cards if isinstance(c, dict) and c.get("deck") == deck]
        names = {c.get("name") for c in in_deck}
        bids = sum(1 for c in in_deck if c.get("bid"))
        shuffle = sum(1 for c in in_deck if c.get("reshuffle"))
        extra = f", {bids} bid" if bids else ""
        print(f"  deck {ROMAN[deck]:<3} {len(in_deck):>2} files, {len(names):>2} distinct names, "
              f"{shuffle} reshuffle{extra}")

    if problems:
        print(f"FAIL {len(problems)} problem(s):")
        for p in problems:
            print(f"  - {p}")
        return 1
    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
