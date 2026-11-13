# Plan Review – 2026-11-12

## Rev. 3 – your answers (2026-11-12, later)

- **Real-life companion on one shared screen.** The GM also plays, everyone has a house screen, and the site shows what is happening and who must act now.
- **Removed:** influence tracks, card library, bid panels. Secret/public split, phone view, GM token, trades and Ravens' messages tasks are gone; T7 bid panel, T11 trades, T17 hands, T23 library and T24 TV mode are dropped.
- **Westeros:** EPIC decks I–IV, nothing Targaryen; fully run in the app. Peeks go through an eyes-only curtain instead of phone links.
- **Objectives:** a simple achieved counter. **Language:** English.
- **Result:** 19 tasks instead of 25. The visual direction is fixed by `mock/`.

## Rev. 2 – findings of the fresh-context review

A fresh-context agent reviewed `plan.md` rev. 1 and `todo.md` rev. 1 against the goal, the rulebook text and the decision files. All 13 findings were checked against the sources and accepted; rev. 2 incorporates them.

| # | Sev. | Finding | Resolution in rev. 2 |
|---|---|---|---|
| 1 | High | No way to enter bids (Clash of Kings, council, deck IV, executions, Direct Confrontation, Display of Power); Gold counts 1:1, King's Landing +2, Claim to the Throne +4, tie rules | New **T7 Bid panel**, reused by T8, T12, T13 and T21; ruling B20 |
| 2 | High | Secrets can leak through the top-level log and the SSE payload; the planned "scan for `secret` key" test could never fail | A4: log `text`/`detail` split, version-only SSE, seeded secret-id scan in the Definition of Done |
| 3 | High | Tracking every secret card is too much GM input; no private view for Grand Maester, Master of Laws or Raven peeks | A10 counts by default (Q4); one-time `/peek/<nonce>` links in T21 |
| 4 | High | Missing board facts needed for loans, bids, victory and siege upkeep (King's Landing, Braavos, sieges, home held) | A9 + T2/T6 `board` facts and `homeHeld` |
| 5 | Med | Rule errors in tasks: loan interest chooser, Red Wedding discard, Raven peek timing, council roles (Master of Whispers, Master of Coin), 2 players without a role, Power cap 20, stock changes outside the market, double dice update | Fixed in T10, T12, T14, T15, T21, T2; dice single owner T8; rulings B16, B21 |
| 6 | Med | The "V2 errors" list referenced in T15/T16 didn't exist; "exactly one step per card" fails for multi-trigger cards | New `tasks/v2_errors.md` (E1–E19); T19 criterion "every trigger clause ≥ 1 step" |
| 7 | Med | Relationships under-specified: no transfers, no Ravens' messages | New **T11 Trades and Ravens' messages** |
| 8 | Med | GM speed: per-faction drawers for 9-faction steps | Bulk 9-row tables (T6); confirmations only for irreversible actions |
| 9 | Med | Design pass last although it is a headline request; first workflow test too late; "TV fits everything" unrealistic | New **T5 Design system** before Checkpoint A; timed walkthrough at Checkpoint B; TV panels follow the phase (T24) |
| 10 | Med | Q1 knock-on work (decision file, "no trigger" notes) had no task | Added to T4 (Westeros part waits for Q1) |
| 11 | Med | Game-night infrastructure: token lost on restart and visible in the URL, Windows MIME bug, non-atomic save, sleeping phones, localhost default vs. phones | T1 / A2 / A5 / A6 |
| 12 | Low | Mercenary art lost by folder exclusion; intrigue 30 images vs 60 cards | Include list (A7, T3); `copies` field and totals check (T4) |
| 13 | Low | Over-scope (draft helper, tactic identities); transitivity should block; missing dependencies (T19→T7, T17→T7–T12) | Draft helper dropped; identities optional; group-raise action (T9); dependencies fixed (now T20, T22) |

Questions the reviewer raised that were resolved as best-guess rulings instead of being asked:
- **B17:** Secret Conspiracies hand limit = King's Court stars + 1.
- **B18:** "most Power tokens" for the Raven win = available Power.
- **B19:** empty tactic deck: no automatic reshuffle.
- **B20:** Gold counts 1:1 in every bid.
- **B21:** Power cap 20.
