# Plan: feedback from the creator (2026-11-13)

Source: `message_from_tje_creator` (repo root, untracked). Tasks: `tasks/feedback-todo.md`.
The first build's `tasks/plan.md` and `tasks/todo.md` still have open boxes (look, test evening) and stay as they are.
Reviewed by a fresh-context agent against the code on 2026-11-13; its findings are folded in.

## What the message asks for

| # | Message item | Task |
|---|---|---|
| 1 | Temporary "test tab" showing the Round tab for every Westeros card | T4 |
| 2 | Round: remove buttons that only lead to another tab | T5 |
| 3 | Round: remove buttons that only jump to the next step (e.g. Diplomacy 2 "Everyone has taken it") | T5 |
| 4 | Westeros 1: remove "Dice turned" | T5 |
| 5 | Westeros 2 goes; its reveal moves into the Deck I–IV steps: no house-rule text, round target only where the card needs it, Master of Laws area on all four, no card info before Reveal, the card takes the Reveal tile's place | T1, T2, T3 |
| 6 | Deck III Clash of Kings: remove "≡ all Seats on the Houses tab" and "Assign the Small Council seats" | T5 |
| 7 | Westeros 7 "Small Council: swap House cards" only when there was no bid | T6 |
| 8 | Diplomacy 3: remove "Spared" and "Keep the hostage" | T5 |
| 9 | Diplomacy 4 goes (house rule: diplomacy all game long; not mentioned in the app) | T3 |
| 10 | Westeros tab: short loading symbol over the deck while shuffling | T9 |
| 11 | Houses tab: "Tracks" pane for Throne, Sword, Raven; prompt those houses where they act; no assign buttons or Houses links on the Round tab after bidding | T7, T8 |

## Answers from you (2026-11-13)

- **Tracks:** holders only (Iron Throne, Valyrian Steel Blade, Messenger Raven), no track order.
- **Swap step:** hidden when deck III is Clash of Kings. On Dark Wings, Dark Words the Raven holder ticks the events
  they chose on the Deck III step; Clash of Kings hides the swap step, Storm in the Skies feeds the Planning 2 note.
- **Test tab:** every card on one page, grouped by deck, read-only.
- **Test tab access:** only with `?test` in the address.

## Decisions I made (correct me)

1. **Step ids stay stable.** W2 and D4 leave the step list; the other ids keep their names (W1, W3–W7, D1–D3, D5,
   D6), because `records`, `TRIGGERS`, Log lines, saved games and replays all use them. Labels renumber from the
   position ("Westeros 2" is now Deck I, id W3). A round has 24 steps (Westeros 6, Diplomacy 5).
   The retired ids W2 and D4 resolve to W3 and D5 everywhere: rendering, Next, Previous, `step/goto`, the faded chips
   and the step key that D5 and D6 use in `records`. A game parked on W2 or D4 is stored with the new id on its next
   step move.
2. **"No bid" means no bid on the influence tracks** (the swap step's own rule text, EPIC p. 8). Deck IV bid cards
   don't count. *To confirm with the creator.*
3. **Deck IV "Done" stays.** It records won or lost before moving on, so it is more than a jump.
4. **E2 "Start round N" goes** (it is only Next step); "A house has won" stays. After round 12 the step row's Next
   says "Round 12 is the last round." as today.
5. **"Choose your house" stays** on New loans, Spend Gold and Objectives. It only shows in a replay, where no house
   is needed to look around.
6. **Face-down Deck steps show nothing card-related:** no "Cards that can act now" line (Deck III's mentions the
   Throne bid, Deck II's mustering) and a neutral mode text ("Reveal the card, then resolve it"). They come back once
   the card is revealed.
7. **Winter is Coming after a Master of Laws replacement** stays face up today (the replacement draw skips the
   reshuffle; the review reproduced it with seed 12, round 4). T1 fixes this, because the Deck steps would show it.
8. **Westeros tab:** its two buttons that point at Westeros 2 ("Reveal the cards in Westeros 2", Master of Laws
   "Decides in Westeros 2") point at the next unrevealed Deck step instead. The Westeros tab keeps its round target
   line. The Loans tab's "Diplomacy 6" becomes "Diplomacy 5".
9. **Track holders:** one house may hold several tokens, "nobody" is allowed, no swapping logic.
10. **Shuffle symbol** shows only on the device that tapped, about 0.8 s; with reduced motion a still "Shuffling…".
11. **Test tab:** builds its own Westeros state per card (Master of Laws seated and unused, so its buttons show; bid
    cards with a sample round target) and its own local UI state, so nothing there touches the live Deck steps. Each
    deck group starts with the face-down step, then each distinct card (deck, name, value): 43 step cards. It comes
    right after the reveal work, so it can be used to check the later tasks for leaks and layout.
12. **Westeros 2's other two hints** (Winter is Coming reshuffles by itself; Grand Maester on the Westeros tab) move
    to the face-down Deck steps; the house-rule line goes.
13. **README** keeps its house-rule paragraph and adds the diplomacy one; the app texts don't mention them.

## Architecture

- `web/js/core/steps.js`: explicit ids instead of `short + (i + 1)`; one `canonicalStep(id)` (W2 → W3, D4 → D5)
  used by `stepById`, `nextStepId`, `prevStepId` and `neighbours`; an optional `skip(game)` per step, so the
  navigation helpers take the game instead of only the round, and "step n of N" counts only shown steps.
- New state, missing in older saves and read as empty there: `tracks: { throne, blade, raven }` (game-long),
  `westeros.trackBid` and `westeros.chosen` (per round, reset by `startRound`).
- Reducer: `westeros/reveal` takes an optional `deck` (must be the next one; without it, the next deck as today);
  the Master of Laws replacement draw runs the Winter is Coming reshuffle; new `westeros/choose` and `track/assign`.
- `round.js`: `deckStep` splits into face-down and revealed states; one `lawsArea(ctx, d)` for all four Deck steps.
  The step card (the article inside `stepFrame`) moves into its own function in `chrome.js`, so the test tab reuses it.
- Test tab: one file `web/js/views/test.js` plus a route, a tab entry (the tab grid takes its column count from the
  list) and a read-only guard in `app.js`; `?test` is read with the `typeof location` guard from `api.js`, so node
  tests keep working. Removing it later is deleting the file and those lines.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Retired step ids (W2, D4) in saved games, Log and replays: crash, Next jumping to Westeros 1, interest stored under D4 | High | `canonicalStep` in every lookup and in the `records` key; tests for render, Next, Previous and D5 records from W2 and D4 |
| Card info leaks on a face-down Deck step (title, mode text, image, alt text, guide, "Cards that can act now") | High | Test renders each deck face down and asserts the top card's name and image are absent; the test tab shows all four |
| Live game mid-round when this deploys | Med | At W2 it opens on Deck I with the revealed cards kept; at D4 on Loan interest. Push between games |
| Deck steps no longer fit 1180×820 with the Master of Laws area (Clash of Kings is the fullest) | Med | Screenshots of every Deck step via the test tab; `.k-body` scrolls as a fallback |
| Test tab reachable on the live site with `?test` | Low | Read-only like a replay, with its own local UI state |
| Houses tab side column too tall with Tracks + Small Council while changing a holder | Low | Screenshot at 1180×820 and 390×844 |

## Left out for now (open)

- **Deck IV bid cards and the swap step** (decision 2): the creator's "no bid" may include them.
- **A Red Wedding:** its "Cards that can act now" line was on Diplomacy 4 and goes with it.
- **The Burden of Power and Strategical Superiority** have the same "holder chooses events" shape as Dark Wings;
  recording those choices (Drought flag for the March step) isn't asked for.
- **Hold counters:** with the holders known, Westeros 1 could count rounds held; not asked for.
- **Shuffle symbol on every device**, not only the one that tapped.
- **Removing the test tab** once it has served.
