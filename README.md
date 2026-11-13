# EPIC Overview

A companion web app for an EPIC Game of Thrones evening with nine houses. One laptop runs a small server;
every phone and tablet at the table opens it in the browser. The app keeps what the board doesn't show well:
council seats, diplomatic levels, marriages, hostages, dowries, loans, the limited stock, Victory Points,
castles, Objectives, Supply tokens, who holds the Iron Throne, the Blade and the Raven, and the digital Westeros
decks. It walks the table through the 24 steps of a round (23 after a bid, when the council swap is left out).
It knows nothing about the map, units, orders or the order on the influence tracks.

**Credits.** The rules, card texts and card art are from [EPIC Game of Thrones](https://boardgamegeek.com/thread/2865288/epic-game-of-thrones/page/1)
by Christian Zoli, a fan expansion of *A Game of Thrones: The Board Game* (2nd edition) and *Mother of Dragons*
by Fantasy Flight Games. This is an unofficial, non-commercial fan tool.

## Online

- **https://flomotiongo.github.io/EpicOverview/** opens the app on any phone, tablet or computer. It uses the
  shared game on **https://epic-overview.fly.dev/**, which also serves the app itself.
- The Fly.io server sleeps when no device is connected; the first visit wakes it in a few seconds.
- Anyone with the address can change the game. Download a backup from the Log before a game evening.
- Without internet, run the laptop server below and open its own address; the Pages copy cannot reach it.

## Start on a laptop

1. Install Python 3.9 or newer (python.org, tick "Add python.exe to PATH"). Nothing else is needed.
2. Double-click `Start-EpicOverview.cmd`. The browser opens on this computer.
3. The window shows an address like `http://192.168.2.20:8765/`. Open it on every phone and tablet on the same Wi-Fi.
   The first time, Windows asks about the firewall: allow Python on private networks.
4. Choose **Start a new game** (or **Load the round 4 example** to look around). A new game first gathers
   the table: the screen shows a QR code with the address. Every device scans it, picks the house it plays and
   taps **Play as …**; everyone sees which houses have joined. Anyone then taps **Start the game**.
5. Several devices can play the same house; change it any time with the house button in the top bar.

Stop the server by closing its window. The game is saved after every change in `data/save/` and is there
again on the next start. **Log → Download a backup** saves the whole game as a file.

Other port: `set EPIC_PORT=8800` before starting, or `python server.py --port 8800`.

## At the table

- **Round** shows the current step: what happens, who acts (all at once, in turn, or one house), and
  the previous and next steps. Next step moves every device on.
- **Houses**: castles, VP, Objectives, Supply tokens, council seats (Reassign), and **Tracks**: who holds the Iron
  Throne, the Valyrian Steel Blade and the Messenger Raven (Change). The steps where a holder acts name that house.
- **Relations**: tap a cell to raise, lower, break or marry; costs and limits are shown. Hostages and dowries on the side.
- **Westeros**: the four decks, the round target, shuffle buttons, Master of Laws, Grand Maester (eyes only) and the Raven.
- **Loans**, **Market**: the Bank of Braavos and the limited stock.
- **Log**: every change with time, step and the house that made it. **Undo** in the top bar takes back the newest change.
- **Games and replays** (in the Log, on the start screen and after a win): every game is kept. **Replay** steps
  through it change by change, or plays it, with every tab showing the game as it was; nothing can be changed
  while a replay is open. **Round summary** shows VP and castles of every house after each round. A new game
  moves the current one to this list.

House rules built in: Westeros cards are revealed one after another, each on its own Deck step (nothing of the
card shows before **Reveal**); Master of Laws decides on each card of decks I–III right after it is revealed.
Diplomacy happens all game long, so the round has no separate step for changing levels and marriages.

## For developers

- `web/` is the app (plain HTML, CSS and JavaScript modules, no build step). `server.py` serves it and stores the game:
  `data/save/current.json` (the game), `snapshots.json` (Undo), `history.jsonl` (every version, for replays) and
  `games/<id>/` (finished games). The API is described at the top of `server.py`.
- `?test` in the address adds a temporary **Test** tab: every Westeros card on its Deck step, read-only
  (`web/js/views/test.js`; remove it once the cards are checked, see `issues.md`).
- Replays: `web/js/core/replay.js` (pure helpers), `web/js/views/replay.js` (bar, games list, round summary).
  The QR code comes from `web/js/ui/qr.js`, a small encoder after Project Nayuki's QR Code generator (MIT).
- Rules: `web/js/core/` (`reducer.js` holds every change; `rules.js` the checks). Screens: `web/js/views/`.
- Tests: `node --test` and `python -I -m unittest discover -s tests -p "test_*.py"`.
- `node tools/compare_boards.mjs` compares the screens with the canvas boards in `canvas/live/`.
- `python tools/build_assets.py` rebuilds `web/assets/` from the art folders.
- Decisions and open guesses: `decisions.md`.
- Deploy: every push to `main` runs `.github/workflows/deploy.yml`: tests, then `flyctl deploy` (`Dockerfile`,
  `fly.toml`, secret `FLY_API_TOKEN`), then GitHub Pages from `web/`. `web/js/api.js` points the Pages copy at Fly.io.
