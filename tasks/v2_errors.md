# Known errors in the ChatGPT checklist V2 / V2-1

Input for tasks T18 and T19 (checklist content V3). Every item must be absent or fixed in `data/checklist.json`.
Sources: `overview/EPIC_Kartentexte_Transkription.md`, `overview/EPIC_Variantenentscheidungen.md`, `overview/EPIC_Quellenwidersprueche.md`, rulebooks.

| # | V2 section | Error | Correct |
|---|---|---|---|
| E1 | 6.3, 8.2 Tactic Cards | All 11 cards invented: Army on the Move, Battle Preparations, Concealed Supplies, Entrenched Position, Hidden Forces, Incursion Forces, Lure into Trap, Secret Path, Superior Ground, Trained Raiders, Watch Towers. | The real 14 general cards: Conquering Plan, Offensive Maneuver, Press Forward, Strategic Attacks, Advanced Planning, Careful Planning, Expand Control, Manage Troops, Hold Territory, Rallying Call, Hit and Run Incursion, Maneuver Warfare, Ambush Set Up, Support Allies. |
| E2 | 7.2 A Hidden Path | "zwei Footmen" | Trigger: start of the Assign Orders step. Once in this Action Phase: pay X Power to march X Footmen/Archers through a Mountain or River border, ignoring its restrictions. |
| E3 | 4.5 A Red Wedding | Outcome reversed ("zahlen beide, wird die Marriage aufgehoben") | First a random House card from one of the two players is discarded. The marriage stands only if **both** pay 2 Power; otherwise its effects are cancelled. |
| E4 | 4.2 This Was Not the Deal | "dessen Besitzer verliert 3" | The **holder** loses 3 Power; if the hostage was the player's own card, they gain 2. |
| E5 | 3.2 Direct Confrontation | Only "gewinnt" | Win **or tie** → swap places on **any** influence track. |
| E6 | Intrigue lists | Escape Tunnels missing | Defender lost a siege: no casualties, may retreat normally, not routed; 2 Power returns the played house card. |
| E7 | 11.3 Mercenaries | Syrio Forel invented effect; Bronn reversed; Tattered Prince only 1 Knight; Gylo "danach abwerfen" mandatory; strengths and icons missing | See transcription §3 (strengths 0–4, icons, exact texts). |
| E8 | 13.1 Small Council | Roles only at the **first** Clash of Kings | Auction at **every** Clash of Kings (ruling B16). |
| E9 | 12.1 Objectives | VP "gemäß Karte" without house dependence | VP depend on the house column (0–6); see transcription §4. |
| E10 | 7.1 / 8 Orders | Missing EPIC order rules | Defense order in siege: +1 tower (special at Stronghold: +2). Sea support to a land battle: −1 strength, order removed after the battle (EPIC p. 12). |
| E11 | 5.2 Power gifts | "jederzeit" without exception | During a combat only in "Call for Support" (FAQ p. 1); the recipient may refuse (FAQ p. 7). |
| E12 | 15.1 MoD | Improvement/Degradation tokens "used" | They have no source in this variant (Iron Bank and Targaryen deck are out). |
| E13 | 7 Action phase | Base Clean Up step missing | Clean Up: remove Support/Defense orders, stand routed units up, flip Blade and Raven (base p. 16). Siege upkeep happens here (EPIC p. 16). |
| E14 | 17.2 Matching Forces | "Fiefdoms-Gleichstandsentscheidung entfällt" | The tie-breaker still decides the winner; both sides additionally deal sword casualties (ruling C1–C8). |
| E15 | 14 House rules | EPIC house abilities listed | House abilities are **off**. |
| E16 | 1.2 Start | 5 Power | **7 Power + 1 Gold** (decision). No Lannister bonus. |
| E17 | 3, 15.3 Westeros | EPIC Westeros decks treated as excluded; Raven's wildling-deck look "entfällt" | Pending open question Q1. If the EPIC decks are used: four decks, deck IV bids, Raven looks at the top of deck IV at the end of Reveal Orders (instead of the order swap). |
| E18 | 17.1 Tides | Option open | **Standard rules**, combat sequence per FAQ p. 1. |
| E19 | 6.1 Tactics | Tactic chosen "zu Beginn der Planungsphase" | The Blade holder names the forbidden order type at the start; Tactic is chosen together with the order assignment (Sheet 1: "Assign Orders and choose Tactic card"). |
