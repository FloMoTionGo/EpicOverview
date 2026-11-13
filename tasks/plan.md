# Implementation Plan: EPIC Overview

Status: **DRAFT rev. 4 (2026-11-12, evening): one version for everyone, phones and tablets, Log tab. Awaiting approval.** The mocks are `mock/` (first static mock) and the Claude Design canvas (layout A, the reference).
Tasks: `tasks/todo.md` (20 tasks). Review history: `tasks/review.md`. Known V2 errors: `tasks/v2_errors.md`.

## Overview

A companion website for a **real-life** 9-player EPIC Game of Thrones board game. **One version for everyone:** there is no GM view and no player view. Any phone or tablet at the table opens the same site over the local Wi-Fi, sees the same game and can change it. Every change is recorded in the **Log** tab.

Its job: everyone sees **what is happening now and what is needed from whom**. The current step of the round is shown with its rules and with the houses that still have to act. Who holds what stays visible all the time.

**In:**
- Round and phase flow with the corrected checklist (English) and a "what is needed now" list.
- The 9 houses with Supply tokens, castles, VP and objectives achieved (no Power, no Gold).
- Small Council, marriage rings and dowries, diplomacy levels, hostages, loans. (Sieges are guided in the battle guide, not tracked.)
- Limited, gold-buyable items with remaining stock.
- The EPIC Westeros decks I–IV, fully run by the app, including Master of Laws, Grand Maester and Raven peeks.

- A **Log** of every change (time, where in the round, what changed, from which device), with Undo.

**Out:** separate GM and player views, logins or roles, influence tracks, card library, bid panels, map, card-in-hand tracking. (Gold, Power and token holders are not tracked either; see the notes below.)

**Visual reference:** `mock/index.html`, a static clickable mock with sample data and real card art.

## Architecture Decisions

| # | Decision | Rationale |
|---|---|---|
| A1 | **No framework, no build step, no npm packages.** Plain HTML/CSS/JS, as in the mock. | No installs; the mock code carries over. |
| A2 | **Server:** one Python 3.12 stdlib file started by `Start-EpicOverview.cmd`. It listens on the local network and prints the address to open on phones and tablets. It serves the page with explicit MIME types, saves the game atomically to `data/save/current.json`, keeps snapshots for undo, stores the log, and has export/import. | A browser alone could lose the game (cleared storage); a file on disk survives. One server lets many devices share one game. |
| A2b | **Many devices, one game state.** A device applies an action with the shared JS reducer and sends it with the version it started from (`POST /api/action`). The server accepts it only if that version is still current, saves it and appends the log entry; otherwise it answers 409, and the device reloads the state, re-applies the action and retries. All devices hear about new versions through `GET /api/events` (server-sent events, stdlib). | No duplicated rules on the server; no lost updates when two people tap at once. |
| A3 | **One version for everyone, no roles, no secrets in the state.** Every device can change everything. On first connect a device chooses **which house it plays** (stored on the device); several devices may play the same house, and the house button in the top bar changes it at any time. The Log records every change under that house; Undo takes back the newest change and logs that too. Hidden information exists only during peeks. | Requested 2026-11-12: don't differentiate between GM and players; houses instead of "Phone 2" names. The log replaces permissions as the safety net. |
| A3b | **The app knows no map.** No areas, units, placed orders, influence-track positions or holders of Throne, Blade and Raven. It knows Small Council seats, relations, marriages, hostages, dowries, loans, stock, VP, castles, objectives and supply tokens. "In turn" steps show which houses have already acted; the table keeps the order, and each device shows "Your turn?" actions for its own house. | Requested 2026-11-12 (canvas comment). Settles the turn-order question: no order lists. |
| A4 | **Eyes-only peeks** for Grand Maester, Master of Laws and Raven: the peek opens only on the device that started it, behind a reveal/hide curtain; other devices show "Arryn is looking at decks II and IV" without the cards. Deck order is never displayed otherwise. (It is in the state JSON, so a determined person could read it in dev tools; fine for a friendly table.) | Private looks without a separate player app. |
| A5 | **Pure JS reducer** (`state + action → state`) for all rules, tested with `node --test`. | Rules stay testable and separate from the UI. |
| A6 | **Data files:** `factions.json`, `cards.json` (Westeros I–IV plus the cards named in steps), `checklist.json` (English, sourced), `stock.json`. | Content can be fixed without touching code. |
| A7 | **Assets from `tools/build_assets.py`** (the mock's `make_assets.py`, promoted to an include list). | Same art as the mock. |
| A8 | **Phones and tablets, one responsive layout.** Tablet (landscape about 1180×820, also portrait) as on the canvas boards; phone (360–430 px wide) as one column with the same 7-tab bar at the bottom. The 9×9 matrix becomes the per-house list on phones. Touch targets at least 48 px. | Requested: everything usable on phone and tablet. No TV layout. |

## Screens (as on the canvas, layout A)

Every screen has the same header (round, "Playing as <house>", Undo), the seats bar (9 houses: castles, VP, objectives, supply, ring, council role, loan icons; highlighted only where a step records something from a house) and a bottom tab bar with 7 tabs. A device without a house first shows "Choose your house" (tablet and phone boards):
- **Round:** one screen per step, 26 steps per round (canvas rows: Westeros 7, Diplomacy 6, Planning 5, Action 6, End 2): the current step in focus with its mode (All at once / In turn / One house), the 2 previous and 2 next steps faded, Previous/Next.
  - Westeros (7): 1 hold counters, 2 reveal the cards **one by one (house rule)**; Master of Laws decides on each card of decks I–III right after it is revealed, before the next one (house rule), 3–6 decks I–IV, 7 Small Council swap (only without a bid).
  - Diplomacy (6): 1 Master of Whispers and phase rules, 2 diplomatic bonus and hostage income (one table: bonus, hostages, total per house; live from Relations until Next step), 3 executions, 4 levels and marriages, 5 loan interest, 6 new loans.
  - Planning 2 shows what each special order does (March +1, Defense +2, Support +1, Raid, Consolidate Power).
  - **Rule from the canvas review:** steps handled at the table (mustering, bidding, Shifting Ambitions, Tactic effects, Raid, Consolidate Power, …) are a reminder and overview only, with no house order, no per-house prompts or tokens and no "done" confirmations. The app asks for input only where it records something (cards, seats, relations, hostages, loans, stock, objectives).
  - Planning: 1 Blade bans an order type, 2 assign orders and Tactic, 3 reveal, 4 immediate Tactic effects, 5 Messenger Raven.
  - Action: 1 Raid, 2 March with a general, resettable battle guide (field battle, siege, sea battle, neutral force), 3 Consolidate Power, 4 gain Power and supply, 5 spend Gold, 6 clean up.
  - End of round: 1 objectives, 2 victory check.
- **Top bar on every screen:** round, "Playing as <house>" (tap to change), Undo.
- **Houses:** 9 cards with − / + for castles, VP, objectives, supply; Small Council with Reassign.
- **Relations:** 9×9 matrix (phone: list); tapping a cell opens raise / lower / break / set marriage with costs; marriages, hostages, dowries.
- **Westeros:** decks I–IV with shuffle buttons, round target, the three peek abilities.
- **Loans:** read-only bank and "who owes what".
- **Market:** limited stock with − / +; supply as a read-only total.
- **Log:** every change, newest first, filterable (this round, relations, loans, houses, Westeros), undone entries struck through.

## Data model (summary)

`game = { meta, factions[9], relations, marriages, dowries, hostages, council, loans, stock, westeros, checklist, log[] }`

- **`meta`:** round 1–12, phase, step; per-step records only where the app records something (loans taken, purchases, objectives, executions).
- **`factions[i]`:** Supply tokens (≤ 3), castles, VP, objectives achieved, ring, house colour and sigil. No Power, Gold, token holders, map, units, orders or track positions (A3b).
- **`westeros`:** for each deck I–IV, the draw pile order (never rendered except inside a peek), discard pile and revealed card; reveal position (one by one), the Master of Laws decision per card, once-per-round ability flags and the deck IV result (won or lost).

## Task List (index; full tasks in `tasks/todo.md`)

### Phase 1 – Foundation
- [ ] T1 Local server, persistence, undo, export/import
- [ ] T2 State model and reducer core
- [ ] T3 Asset pipeline (from the mock script)
- [ ] T4 Card data: Westeros I–IV transcription plus cards named in steps
- [ ] T5 App shell and design system (ported from the mock)

### Checkpoint A – The mock runs on real state; your look-and-feel OK
### Phase 2 – Panels
- [ ] T6 Houses: seats, house cards (castles, VP, objectives, supply), choose-your-house
- [ ] T7 Diplomacy matrix, validation, diplomatic bonus
- [ ] T8 Marriage rings and dowries
- [ ] T9 Small Council
- [ ] T10 Hostages and executions
- [ ] T11 Loans
- [ ] T12 Limited stock (Market)
- [ ] T20 Log tab: every change from every device, filters, Undo entries

### Checkpoint B – Timed walkthrough of a Diplomacy phase with 9 houses
### Phase 3 – Game flow
- [ ] T13 Checklist content, part 1 (setup steps, Westeros, Diplomacy)
- [ ] T14 Checklist content, part 2 (Planning, Action, Combat, end of round, victory)
- [ ] T15 Round engine: one screen per step (26), step card, battle guide
- [ ] T16 Westeros module: one-by-one reveal, Master of Laws at once, peeks, shuffles
- [ ] T17 End of round and victory check

### Checkpoint C – Rounds 1–3 playable at the table
### Phase 4 – Finish
- [ ] T18 Responsive pass: phone (360–430 px) and tablet (landscape and portrait), touch targets, two devices editing at once
- [ ] T19 Full-game smoke test, README

### Checkpoint D – Complete

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Checklist content wrong (V2 history) | High | `v2_errors.md` as input; every item sourced; check script; fresh-context content review. |
| Too slow at the table | High | "What is needed now" generated from the step; one-tap actions; several devices can work at once; timed walkthrough at Checkpoint B. |
| Two devices change the same thing at once | Medium | Version check with 409, re-apply and retry (A2b); every change in the Log; Undo. |
| Wrong taps by anyone (no roles) | Medium | Log by house; Undo of the newest change; snapshots; export. |
| Peek leaks | Medium | Peek only on the device that started it, behind reveal/hide; deck order never rendered outside it. |
| Phone and tablet layouts drift apart | Medium | One responsive codebase; screenshots at 390×844 and 1180×820 in every checkpoint. |
| Westeros deck IV text not yet in data | Medium | T4 transcribes all 48 cards first (deck IV already read for the mock). |
| No art for Bolton, White and Red Targaryen | Low | Generated sigils (in the mock); `art_override/`. |

## Notes of 2026-11-12 (after the first mock), to fold in once a layout is chosen
- Seats show **no Gold and no Power**: castles, VP, objectives achieved and badges only.
- Every step is marked **All at once**, **In turn** (with its order: Throne, Sword, reverse) or **One house** (a role or token holder).
- New **Loans** tab.
- **Loan conditions** are tracked on the physical board. The app only names them; it does not compute eligibility. This changes T11.
- **Diplomacy:** ~~raising a level is one tap in Relations~~ superseded: tapping a cell always opens the options menu (see Relations, latest).
- **Phones and tablets first:** touch targets at least 48 px, bottom or rail navigation.
- **Layout A is chosen** (Claude Design canvas "EPIC Overview layouts", https://claude.ai/artifact/R8juq7RoAXzhjJgh6u4C1f). B and C are discarded. The canvas has one tablet screen per tab, linked in Play:
  - **Round:** the current step in focus, the previous 2 and next 2 steps faded, Previous/Next step buttons, and a mode chip per step.
  - **Header on every tab:** round counter, "Playing as <house>" and Undo. The phase ribbon was removed (requested); the step card names the phase and step.
  - **Battles and sieges** are guided in the Round tab, not tracked on houses (requested). Board "Round: Action, March orders with a siege battle" (`Round-March.dc.html`): March orders in Throne order with a turn strip, and a battle card with 6 sub-steps (Call for support, defender picks siege or normal, choose and reveal House cards, Tides of Battle, Valyrian Steel Blade, result with hostages and loot), card hints (Lord Commander, Hidden Mole, Escape Tunnels) and a siege rules box (EPIC p. 16). T15 needs these sub-steps.
  - **Houses:** cards with a 2×2 grid of − / + controls: castles, VP, objectives, supply (max 3). Small Council alongside. Token holders and "On the board" were removed on request.
  - **Action examples, bottom row of the canvas:** `Round-MarchToBattle` (Greyjoy's march into Riverrun, supporters tap Greyjoy / Tully / Neither), `Round-March` (that siege battle at the House card step), `Round-Battle` (a field battle: strength table per side, a 10-to-10 tie, Matching Forces, tie-breaker on Fiefdoms).
  - **Phone board** is fully playable: house picker, tap a row for the options sheet with costs and rule checks (one step per round, 3 friendly / 2 Alliances / 1 Dynasty, ring spent), Break asks who broke it, Undo, tab bar links.
  - **Log board** (`Log.dc.html`) and a 7th tab "Log" on every board.
  - **Small Council Reassign** (shown on request): Reassign turns the panel into "Reassigning seats" with a Done button. Tap a seat, then pick its new house from a 3×3 grid; each house is labelled "holds it", "swaps <seat>" or "no seat". Picking a house that already has a seat swaps the two seats. House badges and the "No seat" line follow.
  - **Ring symbol:** the Marriage Ring token from the sources, cut out and angled; a hollow line outline of the same ring when spent. Asset files: scratchpad `design_assets/ring-gold.webp` and `ring-outline.webp`; T3 must generate them.
  - **Relations (latest):**
    - Marriages show as a small ring in the matrix cell.
    - **Tapping** a cell always opens the menu; no instant raise, no hold gesture (requested). Example drawn on Martell × Red Targaryen. Each option shows its cost (EPIC p. 9–10): Raise = both agree, each pays Power equal to the areas between their closest castles minus their King's Court stars; Lower = free, one house decides; Break = back to War, the breaker pays 3 / 5 / 8 (Truce / Alliance / Dynasty) in Power or Supply steps, any mix; Set marriage = proposer's ring spent, +1 level free unless already raised this round, dowries swap. War cells show a dash. The phone list works the same: tap a house row.
    - Proposals are answered at the table, so the app only records "Set marriage".
    - The Undo bar was removed.
  - **Loans on houses:** small upright red and gold loan card icons (about 12 × 17 px, drawn in CSS) in the bottom-right corner of each house, in the bar and on the Houses cards.
  - **Relations (first version):** a 9×9 **matrix** (requested). Tap a cell to raise that pair by one level, with an Undo bar; hold a cell to lower or break. Changed-this-round pairs are dotted. Each row shows "friendly x / 3". Also marriages with accept/decline, hostages and dowries. The phone keeps a per-house list, since 9×9 doesn't fit at 390 px.
  - **Westeros:** decks I–IV, round target, and the three peek abilities. Each deck has **Shuffle deck** and **Shuffle discards in** buttons (requested); Winter is Coming still shuffles its own deck automatically.
  - **Loans:** read-only (requested): bank cards, and "Who owes what" per house (loans held, interest each Diplomacy phase, penalty while open, 6 Gold to pay back). Interest, taking and paying back happen only in the Round tab at Diplomacy steps 6 and 7. The "Paid and taken in the round" side panel was removed (requested).
  - **Market:** compact rows (requested): Buildings (Port, Fortification, Stronghold, Bridge, each with where built), Mercenaries and more (units, mercenary cards, Support −1), and Supply tokens **read-only** per house (they are changed on the Houses cards; requested). The pool is computed: 27 minus what the houses hold.
  - **Supply tokens are tracked per house.** They show as a 4th number in the bottom house bar on every tab and as a barrel count on the Houses cards.
  - **Seats bar:** ring symbol, filled when the ring is still available, hollow when used.
- **Token holders (Iron Throne, Blade, Raven) are not tracked** (removed from Houses on request). The board shows them. A peek opens on the device that taps it (the Grand Maester seat is known from the Small Council). The 4-rounds-held wins are checked at the table, not computed.

## Open Questions
- ~~Turn order for "In turn" steps~~ settled by A3b: the app keeps no order lists; it shows who has acted.
- ~~Battle guide kinds~~ settled 2026-11-12: field battle, siege, sea battle and neutral force are enough (no port attack).
- The board question stays on hold; nothing depends on it.
