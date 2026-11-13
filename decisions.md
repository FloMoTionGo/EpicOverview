# EPIC Overview — decisions and guesses (build night 2026-11-12/13)

You asked me to work through `tasks/todo.md` without stopping and to collect every guess here.
Each entry says what I decided and where it lives. Tags:

- **GUESS** — a rule or number I had to assume. Please check these first.
- **DEVIATION** — the app differs from the canvas board on purpose; the reason is given.
- **DECIDED** — follows the canvas, your comments or the rulebook; listed so you can see it was a conscious choice.

The canvas "EPIC Overview layouts" (https://claude.ai/artifact/R8juq7RoAXzhjJgh6u4C1f) is the visual
reference. A local copy of every board is in `canvas/live/`; `node tools/compare_boards.mjs` compares the
words on each Round step with its board (`--text` prints both, `--tabs` checks the tab boards).

## How to run

- Double-click `Start-EpicOverview.cmd`. It finds Python 3.9+, starts `server.py` on port 8765 and opens the browser.
- Phones and tablets on the same Wi-Fi open the address the server prints (`http://192.168.x.y:8765/`).
  On the first start Windows asks about the firewall: allow Python for **private** networks.
- First screen: "No game yet" → **Start a new game** or **Load the round 4 example** (the canvas state).
- Each device then picks its house ("Which house do you play on this device?").
- Tests: `node --test` (rules, reducer, 12-round smoke game) and
  `python -I -m unittest discover -s tests -p "test_*.py"` (server). Both green: 19 + 18 tests.

## Top 10 to check tomorrow

1. **GUESS** New-game values: every house starts with 1 castle, 0 VP, 0 Objectives, 0 Supply tokens, ring unused,
   no council seat, all relations at War. Set the real start on the Houses tab. (`web/js/core/model.js`, `blankHouse`)
2. **GUESS** Dowry card per house. Your notes say the table assigns dowries itself (Variantenentscheidungen,
   "Dowry-Zuordnung legt ihr selbst fest"). The printed cards belong to Arryn, Baratheon, Greyjoy, Lannister,
   Martell, Stark, Targaryen, Tully and Tyrell, so the app uses: the seven matching houses as printed, Bolton
   "The North Remembers" (Stark's card), White Targaryen "Claim to the Throne" (Baratheon's) and Red Targaryen
   "Blood of Kings" (Targaryen's). The transcription marks "Blood of Kings" as **excluded**, so Red Targaryen's
   dowry needs your choice. Change it in `web/js/core/model.js`, `DOWRY`; the names are only shown, not used in rules.
3. **GUESS** Limited stock totals: Port 3, Fortification 6, Stronghold upgrade 4, Bridge 2, Mercenary footmen 12,
   knights 6, ships 6, Siege engines 3, Upgrade disks 6, Mercenary cards 14, Support −1 token 1; Supply token pool 27.
   Count your box and change `STOCK` / `SUPPLY_POOL` in `web/js/core/data.js` if they differ.
4. **GUESS** Red loans: a Red loan is drawn at random from the Red cards left in the bank. "−1 VP" takes 1 VP
   at once and gives it back on payback; "−1 castle" lowers the castle count for the victory check only.
5. **GUESS** Deck IV: the round is **won** when the total of all bids is **at least** the round target (sum of the
   I–III values). The Deck IV step has a "Total of all bids" counter, as on the board; Done records won/lost.
6. **DECIDED 2026-11-13** Dark Wings, Dark Words on deck III: the Raven holder ticks the events they choose on the
   Deck III step; Clash of Kings (there or as the card itself) leaves the council swap step out of the round.
7. **GUESS** Executions: hostages are handled one at a time in the order they were added (the app doesn't know the
   Throne order). Tap the underlined name of another holder to take that one first. Only **Executed** records
   anything, and only when the vote did not go against it (a tie goes to the Throne holder); a spared or kept
   hostage just stays where it is (the creator removed "Spared" and "Keep the hostage").
8. **GUESS** Victory: a Dynasty wins when the two partners together have **10 VP and 10 castles**; both houses are
   listed as winners. Besieged castles aren't tracked: lower the castle count on the Houses tab while a siege lasts.
9. **GUESS** Rally the Men = muster in areas with a Castle only (1 point each), from the card text in `web/data/westeros.json`.
10. **DECIDED, please confirm** Undo is global: it takes back the newest change from any device (the Log board says
    "Undo takes back the newest change and logs that too"). It is not limited to the device's own changes.

## Rules in the app

### Round flow
- **DECIDED** 24 steps per round (Westeros 6, Diplomacy 5, Planning 5, Action 6, End 2); 26 on the boards, see
  "Feedback from the creator" below.
  Round 1 starts at Planning 1 and skips Westeros and Diplomacy. Next step after End 2 starts the next round.
- **DECIDED** A new round puts the revealed Westeros cards on their discard piles and clears the per-round flags:
  council powers used, Master of Laws, peeks, deck IV result, the Blade's ban, and all "who has acted" records.
- **DECIDED** Step moves (Next, Previous, tapping a faded step) are logged, so the Log shows where the table was.
- **DECIDED** Reminder-only steps (your comments: Raid, Consolidate, Mustering, Clash of Kings, orders) have no house
  order, no per-house prompts and no "done" per house. Only these steps record per house: New loans (D6),
  Loan interest (D5), Executions (D3), Spend Gold (A5), Objectives (E1).
- **DECIDED** Blade ban (Planning 1), as on its board: tap an order type to select it, then **Ban Support** (etc.).

### Westeros
- **DECIDED** House rules: cards revealed one by one, deck I → IV, each on its own Deck step; Master of Laws
  decides on each I–III card right after it is revealed (replace with the next card of that deck, or keep). The
  next Reveal is blocked until the decision; once used, no more decisions that round; no going back.
- **DECIDED** Winter is Coming shuffles its deck and draws again by itself; the Log names it.
- **DECIDED** Decks are digital and shuffled with a seed (new game = time-based seed). Shuffle buttons per deck on
  the Westeros tab: shuffle the draw pile, or shuffle the discards back in.
- **DECIDED** Grand Maester (two decks) and the Raven (top of deck IV, keep or bottom) open only on the device that
  taps them, behind a full-screen "eyes only" curtain. The Log says who looked, never which card.
  Both are once per round.
- **DECIDED** Round-effect flags: when Storm in the Skies is face up, Planning 2 says "minus 2" for special orders;
  when Drought is face up, the March step says river borders are passable. Nothing else changes.
- **DECIDED** The Deck I–III steps show the printed card text only for cards without a written guide; the card
  picture carries the text, as on the boards. A replaced card is named under the new one ("replaced Thwarted Plans").

### Diplomacy
- **DECIDED** Levels War / Truce / Alliance / Dynasty; bonus 0 / 1 / 3 / 5 Power; one step per pair per round;
  at most 3 friendly levels, 2 Alliances, 1 Dynasty, never a Dynasty next to an Alliance. Illegal changes are
  greyed out with the reason.
- **GUESS** Breaking costs the breaker 3 / 5 / 8 Power (from Truce / Alliance / Dynasty), taken from the canvas text
  "Tyrell broke the Truce with Lannister. Tyrell pays 3."
- **DECIDED** Marriage: the proposer's ring is spent; if accepted, one level up for free (when the limits allow)
  and both dowry cards change hands the first time.
- **DECIDED** Hostages: at most 2 per holder (two holding cells); none between Alliance partners.
  Income: holder +1 Power per hostage, owner −1. Diplomacy 2 updates live from the Relations tab.
- **DECIDED** Hand of the King: assigning it shows "Takes 2 Power at the table" in the Log.

### Loans and market
- **DECIDED** Bank of Braavos: 5 Gold and 5 Red loans; a loan pays 6 Gold; paying back costs 6 Gold.
  Gold loans owe 1 Gold or 1 Footman (Braavos picks) every Diplomacy phase; Red loans owe nothing but carry their penalty.
- **DECIDED** Market: − takes one from the stock, + returns one. Gold is paid at the table; the app keeps counts only.
  The houses that took buildings are listed under each building.
- **DECIDED** Supply tokens: at most 3 per house, pool of 27, changed per house on the Houses tab.

### End of round
- **DECIDED** Objectives step: each device scores its own Objective with a VP counter (default 2, since the VP per
  card differs per house) or passes.
- **DECIDED** Victory check computes 7 VP, 7 castles (Red "−1 castle" loan counted) and Dynasty 10 + 10.
  Throne / Blade / Raven held 4 rounds and the Dynasty track conditions are checked at the table.
  Any device can confirm a win; it is logged and an end screen with the standings follows (no board exists for it,
  so it uses the start screen's style). "Back to the round" hides it on that device; Undo takes the win back.

### Rules review of the step texts (fresh-context check against EPIC, base game, FAQ and your rulings)
A separate reviewer compared every step text with `EPICRules.pdf`, the base rulebook, the FAQ,
`EPIC_Variantenentscheidungen.md`, `EPIC_Quellenwidersprueche.md` and `v2_errors.md`. I checked each claim in the
rulebook text before changing anything. These texts now **differ from the canvas boards** (the boards still
have the old wording; tell me if the canvas should follow):
- **Battle guide, field battle:** Siege engine counts 0 outside a siege (it was "4 only against a castle"), Archers
  +1 with a Defense or Support order (EPIC p. 15). Losing attacker goes back where it came from; only a losing
  defender picks the retreat area; retreated units are routed (base p. 21). House card texts in the fixed order of
  your ruling. Ships support a land battle at −1 and lose that order; no support across Mountain or River borders
  (EPIC p. 12, 18 — v2 error E10 had come back). Tides: the Blade may redraw the Tides card or add +1; skulls cost a
  casualty whoever wins (FAQ p. 1). Hostages (one casualty fewer; loser can pay 4 Power; at most 2) and Loot
  (1 Gold, 1 Supply token, or 1 Power for a hostage) added (EPIC p. 16–17).
- **Battle guide, siege:** the defender chooses siege or normal battle **before** the Call for support
  (**GUESS**, follows your unconfirmed ruling V3-1). "No defenders left: the attacker takes the castle, whoever won
  a tie" (ruling C7). Sea battle: Flagship +1; same retreat rule.
- **Battle guide, new "Moving" tab and "Cards" toggle:** movement rules (Knights 2 areas, Mountain/River one
  Footman, Swamp, Bridge, Open Sea, leaving a Power token; EPIC p. 15, 18) and the list of cards that can act in a
  battle. Both are additions; the board has neither.
- **Mustering:** "every one of its areas with a Stronghold or a Castle" (it read like the home Stronghold only);
  costs add Archer 2, Flagship 2, Footman to Siege engine 1.
- **Clash of Kings:** all council cards go back to their owners first (ruling B16); everything bid is discarded;
  King's Landing +2 on the Throne bid; Hand of the King +2 Power only when the title changes owner.
- **Westeros 7:** Hired Assassin at the end of every Westeros phase (also in a bid round); Display of Power and
  Direct Confrontation without a bid. The bid-round banner no longer says "skips this step".
- **Westeros 1:** in round 7 it reminds you to swap Varys and Janos Slynt for a free Mercenary card (ruling B7).
- **Diplomacy 2:** "This Was Not the Deal" includes "you gain 2 if it was your card" (v2 error E4).
- **Diplomacy 4:** new "Break" rule (back to War at once; 3, 5 or 8 Power or Supply steps; EPIC p. 10).
- **Diplomacy 5 (interest):** owed **per Gold loan**, one choice per loan; Braavos controller picks the Footman,
  the loan holder if Braavos is neutral; no Footman → another unit (EPIC p. 11). The reducer records it per loan.
- **Planning 5:** "Raided by Maneuver Warfare: no Raven" and "remove Sea orders on land areas" (ruling B1).
- **Action 1:** no Raid across a Mountain border. **Action 5:** Mercenary ship added to the buy tiles, plus a tile
  for the purchases without stock (Garrison, Supply token, gift to a Lord). **Action 6:** stand routed units up,
  flip Blade and Raven back, round effects end.
- **Sources:** Deck IV p. 7 (not 8), victory p. 5 (not 6), Westeros 1 p. 5–6, Deck I p. 6–7, battles p. 15–17.
- **"Cards that can act now":** a short line on each step where a card's timing applies (Dowries, Intrigue,
  Tactics, Small Council, Mercenaries; names from your transcription). The battle list sits behind the guide's
  **Cards** button.
- **Not covered:** Mercenary unit rules (units come with the card; a lone mercenary unit is destroyed) and placing
  Mother of Dragons Sea orders. The 1180×820 step card has no room left; they would need a new screen.
- To fit 1180×820 without scrolling, some board texts are a little shorter now (Westeros 2 house rule, the March
  intro, Diplomacy 2 rules) and Spend Gold uses five slightly smaller tiles per row.

## Screens

### Matching the canvas
- **DECIDED** Every screen is ported from the board markup with the same inline styles, so sizes, colours and texts
  match at 1180×820 (tablet) and 390×844 (phone). I compared each Round step's words with its board; the remaining
  differences are the boards showing other moments of the game (for example Diplomacy 2 before the level changes).
- **DEVIATION** Fonts: the boards load EB Garamond and Barlow Semi Condensed from Google; the app ships them in
  `web/assets/fonts/` so it works without internet at the table. Some boards had a broken font rule
  (`font:600 13px font-family:...`), which made the canvas fall back to the serif font there; the app uses the
  intended Barlow Semi Condensed.
- **DEVIATION** Seats strip: the four numbers per house (castles, VP, obj., supply) size to their labels;
  on the board "castles" and "VP" overlapped.
- **DEVIATION** Deck IV step: "A Calculated Risk" sits under the bid total instead of under the card, so nothing
  is cut off at 1180×820 (the board clips it too, invisibly).
- **DEVIATION** Relations: "Add a hostage" is a small **Add** button in the Hostages header (the full-width button
  made the side column scroll).
- **DEVIATION** Market counters keep "12 / 14" on one line; the Log's "undone hh:mm" tag stays on one line.
- **DEVIATION** Contrast: three canvas colours were a little below 4.5:1 for small text and are slightly darker or
  lighter now: the "Source:" line on step cards (#5e4d37 instead of #66543d), the "you" label in the who-has-acted
  row (#6b5018 instead of #7a5d1e) and struck-through Log text (#968670 instead of #8a7a62). Everything else passes as is.
- **DEVIATION** Phone Log: the page heading "Log" is hidden because the top bar already says it.
- **DECIDED** Log lines use the wording of the Log board's examples ("Lannister took a Gold loan. Bank: 4 Gold loans
  left.", "Bolton replaced Thwarted Plans (deck I) with Shifting Ambitions.", "Bands of Outlaws: bids 7 against
  target 5, won.").
- **DEVIATION** Scroll bars are thin and brown where a screen has to scroll; the boards never scroll.
- **RETIRED 2026-11-13** Westeros 2 ("Reveal the Westeros cards") left the round; its reveal is on the Deck steps.

### Phones and tablets
- **DECIDED** Phones (up to 760 px) follow the phone boards: the view name as heading with "Round 4" beside it,
  the house sigil as the house button, no seats strip, the 7 tabs at the bottom. Who is acting shows in each step's
  own queue instead of the seats strip.
- **DECIDED** Tablet portrait and small laptops (up to 1100 px): Houses and Relations go to one column, and the
  nine seats keep their tablet size and scroll sideways inside their strip (side by side they no longer fit).
- **DECIDED** Phones: Diplomacy 2's table shows sigils instead of house names and lets the texts wrap; card rows
  show two cards per row; the battle guide's four battle kinds sit in a 2 × 2 grid.
- **DECIDED** Relations on a phone is the "A-Phone" board: pick a house, see its eight relations, tap one for a
  bottom sheet with raise / lower / break / marriage.
- **DECIDED** Phone Choose screen: "EPIC Overview" and the round in the top bar, as on "Phone-Choose".
- **DECIDED** The choose screen shows no "2 devices" counts: the server doesn't track devices.
- **DECIDED** Esc closes the curtain, a Relations popover or sheet, open pickers and the game menu.

### Devices and the Log
- **DECIDED** The chosen house is stored per device (browser storage) and shown in the top bar; tap it to change.
  Several devices can play the same house. `?house=greyjoy` in the address sets it too (handy for testing).
- **DECIDED** Every change is one Log line with time, round, step, the houses involved and the house of the device
  that made it. Undone lines are struck through with "undone hh:mm". Filters: all, this round, relations, loans,
  houses, Westeros. "Download a backup" saves the whole game as a file.
- **DECIDED** Local helpers (the open popover, a selected order type, the bid total, the execution counters,
  battle-guide position) are per device and are not logged.

## Technical

- **DECIDED** Plain HTML/CSS/JS ES modules in `web/`, Python standard-library server, no npm packages.
  `package.json` only marks `.js` as modules for Node; `npm test` runs `node --test`.
- **DECIDED** The rules (reducer) run in the browser. The server stores the game, the log and up to 300 undo
  snapshots in `data/save/` (atomic writes with fsync) and pushes a "version" event to every device.
  A device whose change arrives on an old version gets 409, reloads, re-applies and retries (up to 4 times).
- **DECIDED** Server details: port 8765 (`--port` or `EPIC_PORT`), "port in use" message if it's already running,
  bodies over 5 MB refused (413), wrong method 405, times stored with the local UTC offset, a damaged save file
  stops the server with a message instead of being overwritten. Import accepts an empty game (`null`).
- **DEVIATION from todo.md** The step texts live in `web/js/views/round.js` (one renderer per step, with its
  source shown on screen) instead of a separate `data/checklist.json`; the boards were the source, and keeping text
  next to its layout made it easier to match them. So `tools/check_checklist.py` (T14) doesn't exist; the 12-round
  smoke test renders every step instead.
- **DECIDED** Card data: 48 Westeros cards, 12 per deck, no Targaryen deck (its 12 scans are left out on purpose,
  per your rulings). A fresh-context check compared 28 cards (all of deck IV) with the images: no mismatch.
- **DECIDED** Assets: `tools/build_assets.py` copies the canvas images (sigils, ring, tokens, loan cards, card backs)
  and the Westeros card scans into `web/assets/` (181 files, 11.4 MB); originals untouched.
- **DECIDED** Tests: `tests/core.test.mjs` (rules), `tests/smoke.test.mjs` (12 rounds: every screen at every step,
  phone and tablet, decks and stock conserved, Lannister wins with 7 VP in round 7), `tests/test_server.py` (server).
- **DECIDED** `node --test` without a folder argument: on Node 24, `node --test tests/` fails to find the files.

## Gathering, games and replays (2026-11-13)

- **DECIDED** One game per server stays (no lobbies or tables): the group sits at one table. A new game moves the
  current one to the archive (`games/<id>/` on the server) when anything happened in it; Undo starts empty.
- **DECIDED** A new game begins with **Gather at the table**: QR code with the join address, the nine houses with
  how many devices joined each, **Play as …** for this device and **Start the game** for anyone. Nobody has to
  join; a device that comes later picks its house with the house button, as before. On a laptop server the QR code
  shows the laptop's Wi-Fi address (`/api/info`), on GitHub Pages the Pages address.
- **DECIDED** Replays are read-only and local to the device: the bar under the screens steps by change or by round,
  plays one change per 0.9 s, and has a slider; every tab shows the game at that moment, the Log as it read then
  (Undo marks included). Buttons that would change the game are dimmed and refused with a message.
- **DECIDED** Round summary: small multiples (one panel per house, same scale, line at 7) instead of one chart with
  nine colours, which colour-blind players could not tell apart (Lannister/Red Targaryen, Arryn/Tully). VP blue
  #3987e5 with dots, castles orange #d95926 with squares (checked with the dataviz palette validator on the app's
  dark surfaces), a crosshair readout per panel, and a table with every value.
- **DECIDED** Request bodies are capped at 512 KB (was 5 MB): a whole game is about 3 KB, and the history keeps
  every version, so a big body would fill the Fly volume quickly.

## Feedback from the creator (2026-11-13)

Tasks and the full list of choices: `tasks/feedback-plan.md`, `tasks/feedback-todo.md`.
- **DECIDED** Westeros 2 is gone: each Deck step (I–IV) shows a face-down card with **Reveal**; the card takes its
  place. Face down, a Deck step shows nothing of the card: no name, picture, mode, guide or "Cards that can act
  now". The Master of Laws strip sits on all four Deck steps; the round target only on Deck IV with a bid card.
  No house-rule text on these steps.
- **DECIDED** Diplomacy 4 (levels and marriages) is gone: at this table diplomacy happens all game long (house rule,
  not mentioned in the app). Its "A Red Wedding" card line went with it.
- **DECIDED** Step ids stay fixed (W1, W3–W7, D1–D3, D5, D6, …): records, the Log, saved games and replays use them.
  The retired W2 and D4 lead to W3 (Deck I) and D5 (Loan interest); a game parked on one moves on from there.
  Labels count the steps in use, so "Westeros 2" is now Deck I. An unknown step id shows the first step.
- **DECIDED** Buttons in a step card that only went to the next step or opened another tab are gone; **Next step**
  in the step row moves on. Deck IV **Done** stays (it records won or lost first); End 2 keeps "A house has won".
- **DECIDED** The council swap step (Westeros 6) is left out of the round after a bid on the influence tracks.
  Deck IV bid cards don't count as such a bid (to confirm with the creator).
- **DECIDED** A Master of Laws replacement that draws Winter is Coming reshuffles and draws again (it stayed face up
  before); the replaced card is discarded after that draw, so it can't come straight back.
- **DECIDED** Tracks (Houses tab): holders only, one house may hold several tokens, nobody is allowed. Where a holder
  acts (Burden of Power, Strategical Superiority, Dark Wings, Blade ban, Messenger Raven, execution ties, the ravens
  rule, the battle guide's Blade step, the Westeros tab's Raven) the step names and highlights that house; every
  device can still tap everything. The Round tab has no assign button and no link to the Houses tab.
- **DECIDED** Shuffling on the Westeros tab shows "Shuffling…" over that deck for 0.8 s on the device that tapped.
- **DECIDED** A temporary Test tab (`?test` only) shows every Westeros card's Deck step, read-only.

## Not done yet

- Your look on a real phone and tablet (T18) and a test evening (Checkpoint C).
- Timed two-device Diplomacy walkthrough (Checkpoint B) — needs two people.
- A fresh-context content review of the step texts against the rulebook (T13/T14 "Verify").
