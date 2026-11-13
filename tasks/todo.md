# Task List – EPIC Overview (rev. 4: one version for everyone, phones and tablets, Log tab)

**Status 2026-11-13 (build night):** everything below is implemented; ticked boxes were verified by tests
(`node --test`: 19, server: 18) or by screenshots against the canvas boards. Open boxes need you (look, test
evening, timed walkthrough) or a content review. Guesses and deviations: `decisions.md`. Step texts live in
`web/js/views/round.js` instead of `data/checklist.json` (see decisions.md, Technical).

Plan: `tasks/plan.md`. Mock: `mock/index.html`. Paths are relative to `F:\EPIC Game of Thrones\EpicOverview\`.

Verification commands:
- `node --test tests/` (rules)
- `python -I -m unittest discover -s tests -p "test_*.py"` (server)
- Headless Edge screenshots at phone 390×844 and tablet 1180×820 (device metrics via CDP `Emulation.setDeviceMetricsOverride`, because a headless window can't go below about 477 px; fresh profile, `--disable-extensions --disable-sync`, processes closed by profile afterwards).

Definition of Done:
- Tests green; no console errors.
- Every screen works on a phone (390×844) and a tablet (1180×820, landscape and portrait); touch targets at least 48 px; no horizontal scroll.
- One version for everyone: no GM-only or player-only screens.
- Every state change appears in the Log.
- Westeros deck order never visible outside the curtain.
- Source art untouched.

---

## Phase 1 – Foundation

### T1 Local server, persistence, undo, export/import
**Description:** `server.py` (stdlib, `ThreadingHTTPServer`):
- Listens on the local network and prints the address for phones and tablets.
- Serves `web/` with explicit MIME types (`.js`, `.webp`, `.json`, `.css`).
- `GET /api/state` with a version number; `POST /api/action` with `{baseVersion, action, state, summary, house}` (plan A2b).
- `GET /api/events`: server-sent events with the new version after every accepted change.
- `POST /api/undo`: restores the previous snapshot and logs "Undone: …".
- Log entries `{time, version, round, step, summary, house, undone}` saved with the game.
- Atomic save to `data/save/current.json`; the last 300 snapshots are kept.
- `GET /api/export` and `POST /api/import`.

`Start-EpicOverview.cmd` starts the server and opens the browser.

**Acceptance:**
- [x] A restart keeps the game and the log.
- [x] Undo restores the previous state and adds a log entry.
- [x] A stale `baseVersion` returns 409; export → import is identical.
- [x] Two clients: a change on one reaches the other through `/api/events` within 1 s.

**Verify:** server unittest. **Deps:** none. **Files:** `server.py`, `Start-EpicOverview.cmd`, `tests/test_server.py`. **Size:** S

### T2 State model and reducer core
**Description:**
- `model.js` builds a new game from `data/factions.json`: 9 houses (Bolton, White Targaryen, Red Targaryen, Lannister, Martell, Arryn, Tully, Tyrell, Greyjoy) with castles, VP, objectives, Supply tokens and ring.
- No Power, Gold, token holders, map, units, orders or track positions (plan A3b).
- `reducer.js` applies typed actions immutably; every action writes a log line under the acting house.

**Acceptance:**
- [x] `newGame()` is correct: round 1 starts with Planning.
- [x] Clamps: Supply tokens ≤ 3, no negative values.
- [x] Unknown actions throw.

**Verify:** `node --test tests/reducer.test.mjs`. **Deps:** T1. **Files:** `web/js/model.js`, `web/js/reducer.js`, `data/factions.json`, `tests/reducer.test.mjs`. **Size:** M

### T3 Asset pipeline (sigils, Westeros cards, ring and loan icons as on the canvas)
**Description:** Move `mock/make_assets.py` to `tools/build_assets.py` with an include list.
- Westeros I–IV and backs.
- The cards named in checklist steps: intrigue, council, dowry, loans.
- Tokens and sigils.

Output goes to `web/assets/` plus `manifest.js`. A rerun skips unchanged files.

**Acceptance:**
- [x] All referenced assets exist; ≤ 40 MB.
- [x] Nothing from the Targaryen deck, Beyond the Wall or EPIC house cards.
- [x] Rerun is fast.

**Verify:** a check script. **Deps:** none. **Files:** `tools/build_assets.py`, `art_override/README.txt`. **Size:** S

### T4 Card data
**Description:**
- Transcribe all 48 Westeros cards: deck, value, text. For deck IV, the bid lines (won / lowest / others, tie order) or the event text.
- Add the step-linked cards from the transcription file.
- Write `data/cards.json`.
- Append the Westeros texts to `overview/EPIC_Kartentexte_Transkription.md`.

**Acceptance:**
- [x] 48 Westeros entries; the 6 deck IV bid cards marked.
- [x] Every card id used by `checklist.json` exists. (No checklist.json: every card named in the step guides of `web/js/views/round.js` exists in `westeros.json`, checked by script.)
- [x] Spot-check of 10 cards against the images passes. (28 cards checked, all deck IV cards included: no mismatch.)

**Verify:** `python -I tools/check_cards.py`. **Deps:** T3. **Files:** `data/cards.json`, `tools/check_cards.py`, `../overview/EPIC_Kartentexte_Transkription.md`. **Size:** M

### T5 App shell and design system
**Description:** Port the canvas layout (layout A) into `web/`:
- Top bar (round, "Playing as <house>", Undo), 7-tab bar, seats bar, parchment step card, overlays (peek curtain, menus, bottom sheet).
- Rendered from real state, reading the store from T2.

- Responsive from the start: tablet layout as on the canvas boards, phone layout as the phone board (one column, 7-tab bar at the bottom).
- First start on a device asks which house it plays (stored on that device; several devices may pick the same house). The top bar shows "Playing as <house>" and changes it on tap. The Log records changes under that house.
- Live updates from `/api/events`; on 409 the store reloads, re-applies and retries.

**Acceptance:**
- [x] It looks like the canvas boards at 1180×820 and the phone board at 390×844.
- [x] Keyboard focus is visible; Esc closes overlays.
- [x] No horizontal scroll from 360 px up.

**Verify:** screenshots next to the canvas boards. **Deps:** T2, T3. **Files:** `web/index.html`, `web/css/app.css`, `web/js/ui.js`, `web/js/store.js`. **Size:** M

### Checkpoint A
- [ ] Tests green; the app starts from the `.cmd`; your OK on the look

---

## Phase 2 – Panels (each: reducer actions + tests + UI)

### T6 Houses
**Description:**
- Seats bar on every tab: castles, VP, objectives, supply, ring, council role, loan icons.
- Houses tab: 9 cards with − / + for castles, VP, objectives, Supply tokens (max 3); Small Council alongside.
- Choose-your-house screen (tablet and phone); several devices per house; change via the top bar.

**Acceptance:**
- [x] Edits persist, undo and appear in the Log under the acting house.
- [x] Limits are enforced.
- [x] All 9 house cards fit one tablet screen.

**Verify:** `node --test tests/houses.test.mjs`. **Deps:** T5. **Files:** `web/js/views/houses.js`, `web/js/rules/houses.js`, `tests/houses.test.mjs`. **Size:** M

### T7 Diplomacy
**Description:**
- 9×9 matrix with levels 0–3 (phone: small matrix above a per-house list). Tapping a cell always opens the menu: raise, lower, break, set marriage, each with its cost.
- **Blocking checks:** ±1 step per pair per round; at most 3 positive levels, 2 Alliances, 1 Dynasty; never a Dynasty next to an Alliance; the reason is shown instead of the cost.
- **Alliance transitivity**, with a group raise.
- **Break:** asks who broke it; back to War with the breaking-cost reminder (3/5/8).
- **Diplomatic bonus and hostage income** table for Diplomacy step 2 (bonus, hostages, total per house), recomputed live from Relations until Next step. Power itself is not tracked.

**Acceptance:**
- [x] Illegal changes are blocked with the reason shown.
- [x] The bonus and hostage figures are correct and update live.
- [x] The Relations views match the canvas boards (tablet and phone).

**Verify:** `node --test tests/diplomacy.test.mjs`. **Deps:** T6. **Files:** `web/js/rules/diplomacy.js`, `web/js/views/relations.js`, `tests/diplomacy.test.mjs`. **Size:** M

### T8 Marriage rings and dowries
**Description:**
- Proposals are answered at the table. **Set marriage:** the proposer's ring is used up, +1 level for free unless already raised this round, and the dowries swap. A declined proposal is recorded as "ring used" only.
- **A Red Wedding:** a random House card is discarded (noted only), and the marriage stands only if both pay 2 Power (paid at the table).
- The starting dowry per house is set at game setup (any device).

**Acceptance:**
- [x] All branches covered by tests.
- [x] The seats show "Ring" while it is unused.

**Verify:** `node --test tests/marriage.test.mjs`. **Deps:** T7. **Files:** `web/js/rules/marriage.js`, `web/js/views/relations.js`, `tests/marriage.test.mjs`. **Size:** S

### T9 Small Council
**Description:**
- 7 roles assigned after each Clash of Kings (B16) with the Reassign flow on the Houses tab. The bid happens at the table; the app records the result. 2 houses get no seat.
- **Hand of the King:** reminder "+2 Power" when the holder changes (Power is taken at the table).
- **Prompts:** Master of Whispers at the start of Diplomacy; Master of Coin's +1 Gold in Gain Power.
- **Once-per-round flags,** reset each round.
- **Swap prompt** after a Westeros phase without bidding.

**Acceptance:**
- [x] Flags reset.
- [x] Hand of the King reminder only on a change.
- [x] The side panel and seats show the roles.

**Verify:** `node --test tests/council.test.mjs`. **Deps:** T6. **Files:** `web/js/rules/council.js`, `web/js/views/council.js`, `tests/council.test.mjs`. **Size:** S

### T10 Hostages and executions
**Description:**
- **Holding cells:** at most 2; a 3rd forces a release or a kill. An Alliance auto-returns hostages.
- **Hostage income** feeds the Diplomacy step 2 table (T7): +1 per hostage held, −1 per own card held elsewhere.
- **Execution** (Diplomacy step 3): the table vote's result is recorded (executed, spared, kept).
- Sieges are not tracked (no map); the battle guide (T15) and Clean Up remind of them.

**Acceptance:**
- [x] Limit and auto-return enforced.
- [x] Income correct.
- [x] An execution removes the card and is logged.

**Verify:** `node --test tests/hostages.test.mjs`. **Deps:** T7. **Files:** `web/js/rules/hostages.js`, `web/js/views/relations.js`, `tests/hostages.test.mjs`. **Size:** S

### T11 Loans
**Description:**
- 10 cards (5 Gold, 5 Red). A loan is taken in Throne order at the table (Diplomacy step 6, "Your turn?" on each house's device); the 5 conditions are only named, since they are checked on the board. Gold is paid at the table.
- **Interest step:** the debtor chooses 1 Gold or a Footman; Braavos picks which one.
- **Close:** pay back 6 Gold.
- Red penalties feed the displays and the victory check (VP and castles).

**Acceptance:**
- [x] Bank stock correct; at most 5 of each kind.
- [x] Penalties applied.
- [x] Loans shown as icons on seats and in the read-only Loans tab.

**Verify:** `node --test tests/loans.test.mjs`. **Deps:** T6. **Files:** `web/js/rules/loans.js`, `web/js/views/market.js`, `tests/loans.test.mjs`. **Size:** S

### T12 Limited stock (Market)
**Description:** `data/stock.json` (EPIC p. 14 / p. 29):
- Port 3, Fortification 6, Stronghold 4, Bridge 2.
- Mercenary units: 12 Footmen, 6 Knights, 6 Ships, 3 Siege Engines, 6 upgrade disks.
- Support −1: 1. Mercenary cards: 14.
- Supply tokens: read-only total "used / 27", summed from the houses (changed on the Houses tab).

Actions: take one (purchase in Spend Gold, or free with Consolidate Power), return one. Gold is paid at the table.

**Acceptance:**
- [x] No take at 0 stock.
- [x] Pool conserved.
- [x] The Market view matches the canvas board.

**Verify:** `node --test tests/stock.test.mjs`. **Deps:** T6. **Files:** `data/stock.json`, `web/js/rules/stock.js`, `web/js/views/market.js`, `tests/stock.test.mjs`. **Size:** M

### T20 Log tab
**Description:** The Log tab lists every change from every device, newest first: time, round and step, houses involved (sigils), what changed in plain words, and the house whose device made the change. Filter chips: all, this round, relations, loans, houses, Westeros. Undone entries stay, struck through, with "undone hh:mm". Undo in the header always takes back the newest change.

**Acceptance:**
- [x] Every reducer action produces exactly one readable log line (test over all action types).
- [x] Filters work; undone entries are struck through.
- [x] Works at 390 px and 1180 px.

**Verify:** `node --test tests/log.test.mjs`; screenshots. **Deps:** T1, T2, T5. **Files:** `web/js/views/log.js`, `web/js/rules/log.js`, `tests/log.test.mjs`. **Size:** S

### Checkpoint B
- [ ] Timed walkthrough: one Diplomacy phase with 9 houses (bonus, hostages, level changes, a marriage, loans) in under 10 minutes, using two devices at once
- [ ] Your review

---

## Phase 3 – Game flow

### T13 Checklist content, part 1
**Description:** `data/checklist.json` in English. Each step has:
- if/then rules, source and page, linked cards, round-1 skip flag, quick action
- a mode (All at once / In turn with the order named / One house) and, only for steps where the app records something, which houses can act
- steps handled at the table are reminder-only: no house order, no per-house prompts, no "done" confirmations

Covers the setup steps, the Westeros phase (7 steps, house rules: cards one by one, Master of Laws decides at once) and the Diplomacy phase (6 steps). The canvas step boards are the reference. Input: `tasks/v2_errors.md`, decisions and rulings.

**Acceptance:**
- [x] Every item sourced.
- [x] No V2 error in these phases. (Fresh-context review 2026-11-13: E4, E10, E13 had come back and are fixed; see decisions.md.)
- [ ] Every V2-1 section covered. (All but Mercenary unit rules and placing MoD Sea orders; see decisions.md.)

**Verify:** fresh-context content review; fixes applied. **Deps:** T4. **Files:** `data/checklist.json`. **Size:** M

### T14 Checklist content, part 2
**Description:** Same format, covering:
- Planning: the Blade's forbidden order type, orders and tactics (with the special-order effects), reveal, immediate Tactic effects, Raven.
- Action: Raid, March, Consolidate.
- Battle guide content, general (no houses or areas): field battle, siege, sea battle, neutral force; standard Tides of Battle, Matching Forces (C1–C8), hostages and loot.
- Gain Power, Spend Gold, Clean Up, end of round, victory.

**Acceptance:**
- [x] Every item sourced.
- [x] Every trigger clause of the active cards mapped to ≥ 1 step. ("Cards that can act now" line per step; battle cards behind the guide's Cards button.)

**Verify:** `python -I tools/check_checklist.py`; fresh-context review. **Deps:** T13. **Files:** `data/checklist.json`, `tools/check_checklist.py`. **Size:** M

### T15 Round engine and current step card
**Description:**
- One screen per step (26 per round), no phase ribbon; the step card shows the mode, the previous 2 and next 2 steps faded, Previous/Next. Round 1 skips Westeros and Diplomacy; the Small Council swap step only runs in a round without a bid.
- Where the app records something (new loans, Spend Gold, objectives, executions), the step shows who has acted and "Your turn?" actions for the device's house. Everything else is reminder-only.
- **Battle guide** in Action step 2: resettable, general, with its own sub-steps per battle kind; Next step goes to Consolidate Power.
- Quick actions call the T6–T12 actions.

**Acceptance:**
- [x] A full round walks all 26 steps in order.
- [x] Recording steps show the right houses as acted/waiting (tests for 4 steps).
- [x] Reminder-only steps have no per-house prompts.

**Verify:** `node --test tests/flow.test.mjs`; screenshot. **Deps:** T14, T6–T12. **Files:** `web/js/rules/flow.js`, `web/js/views/table.js`, `tests/flow.test.mjs`. **Size:** M

### T16 Westeros module
**Description:**
- **Digital decks I–IV** (seeded shuffle): house rule, revealed one by one (I, II, III, IV).
- **Master of Laws** (house rule): decides on each I–III card right after it is revealed (replace with the next card, or keep), before the next reveal; once per round, no going back.
- **Winter is Coming:** reshuffle and draw again. **Shuffle buttons** per deck: shuffle the deck, shuffle the discards back in.
- **Round target:** sum of the I–III values. The deck IV result is entered (won / lost) and its lines are shown.
- **Peeks, once per round,** opening only on the device that taps them, behind the curtain:
  - Grand Maester peeks at 2 decks.
  - Raven, in Planning: look at the top of deck IV and keep it or bury it (the holder taps it; holders aren't tracked).
- **Round-effect flags:** Storm in the Skies, Drought.

**Acceptance:**
- [x] Deck conservation and reshuffle correct (seeded tests).
- [x] Abilities enforced and reset.
- [x] Deck order only inside the curtain.

**Verify:** `node --test tests/westeros.test.mjs`; screenshot. **Deps:** T4, T9, T15. **Files:** `web/js/rules/westeros.js`, `web/js/views/westeros.js`, `tests/westeros.test.mjs`. **Size:** M

### T17 End of round and victory check
**Description:**
- **Clean Up:** reset flags; reminders for orders, Tactics and sieges (sieges aren't tracked). The hold-counter dice live on the board (Westeros step 1 reminds).
- **Victory check:**
  - Computed: 7 VP; 7 castles (Red loan −1; besieged castles don't count, entered at the table); Dynasty 10 VP and 10 castles combined.
  - Checked at the table: Throne, Blade or Raven held 4 rounds (plus King's Landing / most castles / most Power, B18), and the Dynasty partners leading tracks.
- **Tie-breaks** and round 12 scoring.
- Any device confirms a win; it is logged.

**Acceptance:**
- [x] Each computed condition tested.
- [x] A confirmed win is logged.
- [x] The end screen is shown.

**Verify:** `node --test tests/victory.test.mjs`. **Deps:** T6, T7, T11, T15. **Files:** `web/js/rules/victory.js`, `web/js/views/table.js`, `tests/victory.test.mjs`. **Size:** M

### Checkpoint C
- [ ] Rounds 1–3 playable; your test evening

---

## Phase 4 – Finish

### T18 Responsive pass
**Description:**
- Check every tab on a real phone and a real tablet (landscape and portrait); adjust sizes.
- Touch targets ≥ 48 px; contrast ≥ 4.5:1.
- Two devices editing at once: no lost change, both see the same state and log.

**Acceptance:**
- [ ] Your OK on your phone and tablet.
- [x] Contrast checked. (Text ≥ 4.5:1 after three small colour tweaks, see decisions.md; disabled buttons excepted.)
- [x] No horizontal scroll from 360 px up.

**Deps:** T15–T17. **Files:** `web/css/app.css`. **Size:** S

### T19 Full-game smoke test, README
**Description:**
- 12 scripted rounds through the reducer.
- Export/import round-trip.
- English README: start, backup, undo, sigil override.

**Acceptance:**
- [x] The smoke game ends with the expected winner.
- [ ] A cold start works from the README alone.

**Deps:** all. **Files:** `tests/smoke_game.mjs`, `README.md`. **Size:** S

### Checkpoint D
- [ ] All acceptance criteria met; your approval
