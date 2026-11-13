# Tasks: feedback from the creator (2026-11-13)

**Status 2026-11-13:** T1–T10 built, reviewed by a fresh-context agent (four bugs fixed: the bid flag for older games,
Executed after a vote against, a stuck shuffle spinner, the test tab's tap guard) and verified (`node --test`: 49, server: 34; screens checked in headless Edge at
1180×820, 820×1180 and 390×844, no console errors). Winter is Coming after a Master of Laws replacement is covered by a
reducer test, not clicked through in the browser. Open: your review before pushing.

Plan and decisions: `tasks/feedback-plan.md`. Order: T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10.
T5, T7 and T9 don't depend on each other. Every task leaves the app working.

Verification for every task:
- `node --test` and `python -I -m unittest discover -s tests -p "test_*.py"`
- Changed screens checked at 1180×820 and 390×844 (headless Edge, as in `tasks/todo.md`); no console errors.

---

## Phase 1: Westeros reveal on the Deck steps (highest risk first)

### T1 Reveal each Westeros card on its own Deck step
**Description:** The Deck I–IV steps (ids W3–W6) get the reveal that now lives on Westeros 2. Face down, a Deck step
shows a face-down tile with **Reveal** where the card will be; tapping it reveals that deck and the card takes the
tile's place, as on Westeros 2 today. Westeros 2 keeps working until T3 removes it.

**Acceptance:**
- [x] Face down, a Deck step shows no card information: title "Deck I", a neutral mode text, no card picture, value,
      guide, rules, printed text or "Cards that can act now" line. Only generic hints (Winter is Coming, Grand Maester).
- [x] **Reveal** reveals exactly that deck (`westeros/reveal { deck }`; without `deck` the next one, as Westeros 2
      and the smoke test still send). Disabled with the reason when the deck before isn't revealed ("Reveal deck I
      first") or Master of Laws hasn't decided ("Master of Laws decides on deck I first"). The reducer rejects an
      out-of-order deck.
- [x] A Master of Laws replacement that draws Winter is Coming reshuffles and draws again, like a reveal does.

**Verification:** tests: face-down render of each deck doesn't contain the top card's name or image path; reveal
order and blocking; Winter is Coming after a replacement (seed 12, round 4 reproduces it).

**Dependencies:** none.
**Files:** `web/js/views/round.js`, `web/js/core/reducer.js`, `tests/core.test.mjs`, `tests/views.test.mjs`
**Size:** M

### T2 Master of Laws area and round target on the Deck steps
**Description:** One Master of Laws area on all four Deck steps: holder, what has happened this round, and
**Replace / Keep** when a decision is due, also for the previous deck's card (that decision blocks the next Reveal).
On Deck IV it shows the state only. The round target shows only where the card needs it.

**Acceptance:**
- [x] The area appears on Deck I–IV, face down and revealed, with the right state: nobody seated, decides after the
      reveal, decide now, kept, used on deck N.
- [x] "Round target 6 (2 + 1 + 3)" only on Deck IV with a bid card; not on Deck I–III or Deck IV events.
- [x] No "house rule" text on the Deck steps.

**Verification:** render tests for each Master of Laws state and for the target; screenshots of W3–W6.

**Dependencies:** T1.
**Files:** `web/js/views/round.js`, `tests/views.test.mjs`
**Size:** S

### T3 Remove Westeros 2 and Diplomacy 4 from the round
**Description:** Drop "Reveal the cards, Master of Laws" (W2) and "Change levels and marriages" (D4): 24 steps per
round (Westeros 6, Diplomacy 5). Ids stay stable, labels renumber, and W2 and D4 resolve to W3 and D5 in every lookup
(plan decision 1). The diplomacy house rule isn't mentioned in the app.

**Acceptance:**
- [x] Next, Previous and the faded chips never show W2 or D4; labels and "step n of N" have no gaps.
- [x] From a game parked at W2 or D4: the screen shows Deck I or Loan interest; Next and Previous go to the right
      neighbours; Loan interest records under D5. A Log line and a replay frame at W2 or D4 render. An unknown step
      id falls back to the first step instead of crashing.
- [x] Westeros tab buttons that pointed at Westeros 2 point at the next unrevealed Deck step; the Loans tab says
      "Diplomacy 5".
- [x] Tests and tools follow: smoke test (24 steps, reveals on W3–W6), `tests/views.test.mjs` (26 per round),
      `tools/compare_boards.mjs` board map, old step names in comments (`replay.js`, `app.css`).

**Verification:** step tests in `tests/core.test.mjs`, the smoke test, `node tools/compare_boards.mjs` runs.

**Dependencies:** T1, T2.
**Files:** `web/js/core/steps.js`, `web/js/core/reducer.js`, `web/js/views/round.js`, `web/js/views/westeros.js`,
`web/js/views/other.js`, tests and `tools/compare_boards.mjs`
**Size:** M

### Checkpoint A
- [x] Tests green; a whole Westeros phase in the browser: reveal I–IV, Master of Laws replace and keep, Winter is
      Coming, Deck IV bid and event.

---

## Phase 2: Test tab (to check the rest with)

### T4 Temporary test tab (`?test`)
**Description:** With `?test` in the address an 8th tab "Test" appears (`#/test`). It shows the Round tab's Deck step
for every Westeros card, one below the other, grouped by deck I–IV: first the face-down step, then each distinct
card (deck, name, value). It builds its own Westeros state per card (Master of Laws seated and unused; bid cards with
a sample round target) and its own local UI state. Read-only: no tap reaches the server, as in a replay.

**Acceptance:**
- [x] Without `?test`: no Test tab, and `#/test` shows the Round tab. Node tests run without a `location`.
- [x] With `?test`: 43 step cards render cleanly at the Round tab's size, on tablet and phone; the tab bar shows 8
      tabs in one row.
- [x] No tap on the page changes the game or the live Deck steps (e.g. the bid total).

**Verification:** a render test (count, no undefined/NaN); in the browser with and without `?test`.

**Dependencies:** T3.
**Files:** `web/js/views/test.js` (new), `web/js/app.js`, `web/js/ui/chrome.js`, `web/js/views/round.js`,
`tests/views.test.mjs`
**Size:** M

---

## Phase 3: Round tab clean-up

### T5 Remove pass-through buttons from the Round tab
**Description:** Footer buttons that only go to the next step or open another tab go; **Next step** in the step row
is the one way forward.
- Only Next step: W1 "Dice turned"; W7 "Swaps done" / "Skip to Diplomacy"; D1 "… has drawn" / "Next step"; D2
  "Everyone has taken it"; D3 "Next step"; D5 "Interest settled"; P1 "… is banned: next step" (becomes a disabled
  "… is banned"); P3 "Revealed"; P5 "Raven used" and "Pass"; A4 "Everyone done"; A6 "Clean up done"; E2
  "Start round N" / "Game over".
- Only another tab: D2 "Open Relations"; A4 "Open Houses"; A5 "Open Market"; Clash of Kings "Assign the Small
  Council seats".
- Clash of Kings: the substep "≡ all Seats on the Houses tab".
- D3: "Spared" and "Keep the hostage"; "Executed" and the In favour / Against counters stay.
- Stay, because they record something: Deck IV "Done", D3 "Executed", D6 loans and Pass, P1 "Ban …", A3
  Fortification, A5 buy and pass, E1 Score and Pass, E2 "A house has won". "Choose your house" stays (replays only).

**Acceptance:**
- [x] A render test over every step (house chosen) finds no footer button with `step/next` and no `href="#/…"`.
- [x] D3 shows only "Executed"; `decisions.md` guess 7 updated.

**Verification:** `tests/views.test.mjs`; screenshots of W1, D2, D3, P1, P5, E2.

**Dependencies:** T3.
**Files:** `web/js/views/round.js`, `tests/views.test.mjs`, `decisions.md`
**Size:** S

### T6 Show the council swap step only without a bid
**Description:** W7 "Small Council: swap House cards" is skipped when there was a bid on the influence tracks: deck III
is Clash of Kings, or it is Dark Wings, Dark Words and the Raven holder chose Clash of Kings. With Dark Wings, Dark
Words face up, the Deck III step gets three toggles (Clash of Kings, Secret Conspiracies, Storm in the Skies) for the
Raven holder's choice. Storm in the Skies chosen there counts as face up for the Planning 2 note.

**Acceptance:**
- [x] With a bid, Next from Deck IV goes to Diplomacy 1, Previous from Diplomacy 1 goes to Deck IV, the faded chips
      skip W7, and Deck IV says "step 5 of 5". Without a bid W7 shows as today.
- [x] The choice is shared and logged ("Greyjoy (Raven) chose Clash of Kings for Dark Wings, Dark Words."), can be
      untoggled, and resets with the round. A Master of Laws replacement on deck III updates the bid flag.
- [x] Planning 2 says "minus 2" when Storm in the Skies was chosen through Dark Wings, Dark Words.

**Verification:** its own reducer and step tests (Clash of Kings; Dark Wings with and without Clash of Kings; a
replaced Clash of Kings; the step count with a skip), since the smoke test's seed never draws Clash of Kings on deck
III. Deck III with Dark Wings in the test tab.

**Dependencies:** T3.
**Files:** `web/js/core/steps.js`, `web/js/core/reducer.js`, `web/js/views/round.js`, `web/js/ui/chrome.js`,
`tests/core.test.mjs`
**Size:** M

### Checkpoint B
- [x] Tests green; one full round in the browser, including a Clash of Kings round and a round with the swap step.

---

## Phase 4: Tracks

### T7 Tracks pane on the Houses tab
**Description:** A "Tracks" pane under Small Council records who holds the Iron Throne, the Valyrian Steel Blade and
the Messenger Raven (holders only). It looks and works like Small Council: **Change**, then pick a house or nobody.
One house may hold several tokens. The Round tab gets no assign button and no link to the Houses tab.

**Acceptance:**
- [x] `track/assign { track, house | null }` sets the holder and logs it ("Iron Throne: Lannister (was Tyrell).").
- [x] New games start with nobody; games saved before this change open with nobody.
- [x] The picker has its own UI key, closes after a pick and on Esc (like Small Council's).
- [x] The pane fits at 1180×820 and 390×844, also while changing a holder.

**Verification:** reducer tests; screenshots of the Houses tab.

**Dependencies:** none.
**Files:** `web/js/core/model.js`, `web/js/core/reducer.js`, `web/js/core/data.js`, `web/js/views/houses.js`,
`web/js/app.js`, `tests/core.test.mjs`
**Size:** M

### T8 Name and highlight the token holders where they act
**Description:** Where a token holder acts, the step names the house, shows its sigil and highlights it in the seats
bar. Every device can still tap everything. Without a holder set, the text stays generic ("The Blade holder").
- W1: the current holders, instead of "The app does not know who holds Throne, Blade or Raven".
- Deck I The Burden of Power (Throne), Deck II Strategical Superiority (Blade), Deck III Dark Wings, Dark Words
  (Raven, with T6's toggles).
- D1: the ravens rule (Throne protects, Blade destroys, Raven reads); D3: the tie ("the Iron Throne holder decides").
- P1 Blade ban; P5 Messenger Raven: "Swap one of my orders" is recorded under the Raven holder, not under
  `ctx.house || 'greyjoy'`.
- A2 battle guide, Valyrian Steel Blade step.
- Westeros tab, Messenger Raven ability.
- Clash of Kings "Track positions" rule: says the app records only the three holders, without pointing to the Houses tab.

**Acceptance:**
- [x] With holders set, these screens show the house and the highlight; with none set they render the generic text.
- [x] No new button or link to the Houses tab on the Round tab.

**Verification:** render tests with and without holders; P1, P5 and the Deck steps in the browser and the test tab.

**Dependencies:** T7, T6.
**Files:** `web/js/views/round.js`, `web/js/views/westeros.js`, `web/js/core/rules.js`, `tests/views.test.mjs`
**Size:** M

### Checkpoint C
- [x] Tests green; holders set on the Houses tab show up on P1, P5 and the Deck steps in the browser.

---

## Phase 5: Westeros tab and docs

### T9 Loading symbol while shuffling
**Description:** Westeros tab: "Shuffle deck" and "Shuffle discards in" show a short spinner over that deck's picture
(about 0.8 s, longer if the server is slower) with the deck's buttons disabled meanwhile. With reduced motion a still
"Shuffling…" label. Only on the device that tapped.

**Acceptance:**
- [x] The symbol shows at once and goes away by itself; the shuffle is logged once; nothing on the page moves.

**Verification:** in the browser at both sizes, also with reduced motion.

**Dependencies:** none.
**Files:** `web/js/views/westeros.js`, `web/js/app.js`, `web/css/app.css`
**Size:** S

### T10 Docs
**Description:** README (24 steps, reveal on the Deck steps, tracks on the Houses tab, diplomacy house rule),
`decisions.md` (step list, the Westeros 2 heading decision, A3b now with token holders, guesses 6 and 7, Diplomacy 4
removed because diplomacy runs all game), `issues.md` (step-id fallback done; "Diplomacy 6" wording item now
Diplomacy 5; test tab to remove).

**Dependencies:** T1–T9.
**Files:** `README.md`, `decisions.md`, `issues.md`
**Size:** S

### Checkpoint D: done
- [x] All tests green (node and server).
- [x] Every changed screen checked at 1180×820 and 390×844.
- [ ] Your review before pushing to `main` (a push deploys to Fly.io and GitHub Pages; push between game evenings).
