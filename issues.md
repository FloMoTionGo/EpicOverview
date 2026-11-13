# Open issues

State of 2026-11-13, after the go-live (GitHub Pages + Fly.io) and the replay update.
Tick a box when it is done; details for the rule guesses are in `decisions.md`.

## Decisions needed

- [ ] **Ten rule guesses** in `decisions.md` → "Top 10 to check":
  - [ ] Starting values per house (1 castle, 0 VP, 0 Objectives, 0 Supply, ring unused, no seat, all at War)
  - [ ] Red Targaryen's dowry: "Blood of Kings" is marked as excluded in the card transcription
  - [ ] Limited stock totals and the Supply token pool (count the box)
  - [ ] Red loans: random draw; "−1 VP" given back on payback; "−1 castle" for the victory check only
  - [ ] Deck IV: won when the total of all bids is at least the round target
  - [x] Dark Wings, Dark Words: the Raven holder now ticks the events; Clash of Kings skips the council swap
  - [ ] Executions handled in the order the hostages were added
  - [ ] Dynasty win: 10 VP and 10 castles together, both houses win
  - [ ] Rally the Men: muster only in areas with a Castle
  - [ ] Undo is global (takes back the newest change from any device)
- [ ] **Checklist V3 rulings V3-1 … V3-11** (last page of `Checkliste_Spielablauf_Epic_Agot_V3.pdf`), all best guesses
- [ ] **Board and King's Court stars**; which faction takes which objective column and which dowry
- [ ] **From the creator's feedback (2026-11-13):** do Deck IV bid cards count as "a bid" for the council swap
      step? (Now: no, only Clash of Kings.) Where should the "A Red Wedding" card line go now that Diplomacy 4 is gone?
- [ ] **Canvas or app wording:** 24 of 26 round steps now differ from the canvas boards after the rules review
      (`decisions.md`, "Rules review of the step texts"). Update the canvas to the app, or the other way round?
- [ ] **Artboard comparison:** which artboard was meant by the link `…#play-15a28b81bf77`? (Every board was compared
      by words and styles; a pixel comparison needs the board's name.)
- [ ] **Table code / password** for the public server (anyone with the address can change the live game)
- [ ] **Where the working copy lives:** it is still the recovery copy of the lost USB stick; if the stick comes back,
      compare it with this repo before trusting either

## Not tested yet

- [ ] A real phone scanning the gathering QR code (the encoder matches the segno library module by module, apart from
      the standard-conform padding, but no camera has read it)
- [ ] The gathering screen on GitHub Pages (QR shows the Pages address); tested only on a laptop server, because a test
      on the live server would archive the running game
- [ ] Several devices joining and playing at the same time (only the server's version-clash handling is tested)
- [ ] A replay of a full 12-round game (~1,000 changes); tested with 55
- [ ] Tablet portrait and phone landscape (tested at 1180 × 820 and 390 × 844)
- [ ] The look on a real phone and tablet, and a test evening (`decisions.md`, "Not done yet")
- [ ] A timed two-device Diplomacy walkthrough (needs two people)
- [ ] A fresh-context review of the step texts against the rulebook

## Known issues

- [ ] **Public server can still be overloaded.** Bodies are capped at 512 KB, but 300 undo snapshots of that size are
      ~150 MB of JSON, more than the 256 MB Fly machine holds once parsed; it reloads them on start, so it could keep
      crashing until the volume is cleaned. History files grow by up to 512 KB per change and could fill the 1 GB
      volume. Fix: a table code for every write, a byte cap on the snapshots (and the history).
      (`server.py`, `MAX_BODY_BYTES`, `MAX_SNAPSHOTS`)
- [ ] **Start-up errors all read as connection errors:** `web/js/app.js` reports every start-up error as "Could not
      reach the EPIC Overview server". (An unknown step id no longer crashes: the Round tab shows the first step, and
      the retired W2 and D4 lead to Deck I and Loan interest.) Fix: tell screen errors from network errors.
- [ ] **Undocumented wording:** Diplomacy 5 (New loans) says "Pays 6 Gold (the Master of Coin gets 1 more)"
      (`web/js/views/round.js`, `D6`); add it to `decisions.md` or change it.
- [ ] **The running live game's replay starts at round 2, Diplomacy 5:** it began before histories were kept.

## Not built yet

- [ ] Mercenary unit rules (units come with the card; a lone mercenary unit is destroyed)
- [ ] Placing Mother of Dragons Sea orders
- [ ] Optional: `node tools/compare_boards.mjs` as an informational CI report, so new differences from the canvas show up

## Housekeeping

- [ ] Remove the temporary Test tab once the Westeros cards are checked: delete `web/js/views/test.js`, its route and
      tap guard in `web/js/app.js`, `TEST_TAB` in `web/js/ui/chrome.js`, `.k-testcard` in `web/css/app.css` and its
      test in `tests/views.test.mjs`
- [ ] The Fly.io deploy token (GitHub secret `FLY_API_TOKEN`) expires around 2027-11-13: create a new one with
      `fly tokens create deploy -a epic-overview` and store it with `gh secret set FLY_API_TOKEN`
