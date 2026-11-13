/* Sample game state for the static mock. All values are invented examples. */
window.MOCK = {
  round: 4,
  phase: "diplomacy",
  phases: [
    { id: "westeros", name: "Westeros" },
    { id: "diplomacy", name: "Diplomacy" },
    { id: "planning", name: "Planning" },
    { id: "action", name: "Action" },
    { id: "end", name: "End of round" }
  ],

  /* Holders of the three dominance tokens (needed for Westeros abilities and ties). */
  tokens: { throne: "lannister", blade: "greyjoy", raven: "red_targaryen" },

  factions: [
    { id: "lannister", name: "Lannister", sigil: "lannister", color: "#a3262a", power: 9, gold: 7, supplyTok: 1, castles: 5, vp: 3, objectives: 2 },
    { id: "tyrell", name: "Tyrell", sigil: "tyrell", color: "#4d7a2c", power: 6, gold: 3, supplyTok: 2, castles: 4, vp: 2, objectives: 1 },
    { id: "bolton", name: "Bolton", sigil: "bolton", color: "#b56a73", power: 4, gold: 2, supplyTok: 0, castles: 4, vp: 1, objectives: 1 },
    { id: "arryn", name: "Arryn", sigil: "arryn", color: "#5d8fc4", power: 7, gold: 1, supplyTok: 3, castles: 3, vp: 2, objectives: 1 },
    { id: "martell", name: "Martell", sigil: "martell", color: "#d27a2c", power: 5, gold: 7, supplyTok: 1, castles: 3, vp: 1, objectives: 1 },
    { id: "greyjoy", name: "Greyjoy", sigil: "greyjoy", color: "#55585c", power: 3, gold: 5, supplyTok: 0, castles: 4, vp: 1, objectives: 2 },
    { id: "red_targaryen", name: "Red Targaryen", sigil: "rote_targaryen", color: "#8a1520", power: 8, gold: 0, supplyTok: 1, castles: 2, vp: 1, objectives: 1 },
    { id: "tully", name: "Tully", sigil: "tully", color: "#2c4f86", power: 2, gold: 1, supplyTok: 0, castles: 3, vp: 0, objectives: 0 },
    { id: "white_targaryen", name: "White Targaryen", sigil: "weisse_targaryen", color: "#d8d2c4", power: 5, gold: 2, supplyTok: 2, castles: 2, vp: 1, objectives: 1 }
  ],

  council: [
    { role: "Hand of the King", holder: "lannister", card: "council-1-hand-of-the-king", once: null },
    { role: "Lord Commander of the Kingsguard", holder: "tyrell", card: "council-2-lord-commander-of-the-kingsguard", once: false },
    { role: "Master of Coin", holder: "martell", card: "council-3-master-of-coin", once: null },
    { role: "Master of Laws", holder: "bolton", card: "council-4-master-of-laws", once: true },
    { role: "Master of Whispers", holder: "red_targaryen", card: "council-5-master-of-whispers", once: true },
    { role: "Master of Ships", holder: "greyjoy", card: "council-6-master-of-ships", once: false },
    { role: "Grand Maester", holder: "arryn", card: "council-7-grand-maester", once: false }
  ],
  councilNone: ["tully", "white_targaryen"],

  /* Diplomacy: 1 Truce, 2 Alliance, 3 Dynasty. War is everything not listed. */
  levels: ["War", "Truce", "Alliance", "Dynasty"],
  relations: [
    { a: "lannister", b: "tyrell", level: 3 },
    { a: "bolton", b: "arryn", level: 2 },
    { a: "bolton", b: "tully", level: 2, changed: true },
    { a: "arryn", b: "tully", level: 2, changed: true },
    { a: "martell", b: "red_targaryen", level: 1 },
    { a: "tyrell", b: "martell", level: 1, changed: true },
    { a: "greyjoy", b: "white_targaryen", level: 1 }
  ],
  breaks: [{ round: 3, who: "greyjoy", with: "tully", level: "Truce", paid: "3 Power" }],

  ringsUsed: ["lannister", "bolton", "red_targaryen"],
  marriages: [
    { proposer: "lannister", partner: "tyrell", round: 2, state: "married" },
    { proposer: "bolton", partner: "arryn", round: 3, state: "married" },
    { proposer: "red_targaryen", partner: "martell", round: 4, state: "proposed" }
  ],
  /* Which dowry card each house started with is your setup choice; this mapping is a sample. */
  dowries: [
    { owner: "lannister", card: "dowry-dowry-lannister-f", name: "Masters of Intrigue", holder: "tyrell" },
    { owner: "tyrell", card: "dowry-dowry-tyrell-f", name: "Fruits of the Reach", holder: "lannister" },
    { owner: "bolton", card: "dowry-dowry-stark-f", name: "The North Remembers", holder: "arryn" },
    { owner: "arryn", card: "dowry-dowry-arryn-f", name: "Knights of the Vale", holder: "bolton" }
  ],

  hostages: [
    { holder: "greyjoy", owner: "tully", card: "House card, strength 2", since: 3 },
    { holder: "red_targaryen", owner: "white_targaryen", card: "House card, strength 3", since: 4 }
  ],

  loans: [
    { owner: "lannister", type: "Gold", card: "loan-gold-loan-1", effect: "Interest: 1 Gold or 1 Footman" },
    { owner: "greyjoy", type: "Red", card: "loan-red-loan-1", effect: "−1 Victory Point" },
    { owner: "white_targaryen", type: "Red", card: "loan-red-loan-4", effect: "Counts as 8th on Fiefdoms" }
  ],

  board: { kingsLanding: "lannister", braavos: null, sieges: [{ area: "Riverrun", besieger: "greyjoy", owner: "tully", since: 3 }] },

  /* Limited stock (EPIC p. 14 / p. 29). */
  stock: [
    { name: "Port", cost: 2, total: 3, left: 1, token: "port", placed: [["greyjoy", "Flint's Finger"], ["tyrell", "Oldtown"]] },
    { name: "Fortification", cost: 2, total: 6, left: 4, token: "fortification", placed: [["bolton", "Moat Cailin"], ["martell", "Prince's Pass"]] },
    { name: "Stronghold upgrade", cost: 3, total: 4, left: 3, token: "stronghold", placed: [["lannister", "Golden Tooth"]] },
    { name: "Bridge", cost: 4, total: 2, left: 1, token: "bridge", placed: [["tully", "Riverrun to the Twins"]] },
    { name: "Supply token", cost: 2, total: 27, left: 17, token: "supply", placed: [] }
  ],
  mercUnits: [
    { name: "Footmen", total: 12, left: 9, cost: "2" },
    { name: "Knights", total: 6, left: 5, cost: "3" },
    { name: "Ships", total: 6, left: 6, cost: "2" },
    { name: "Siege engines", total: 3, left: 3, cost: "3" },
    { name: "Upgrade disks", total: 6, left: 6, cost: "with unit" }
  ],
  otherStock: [
    { name: "Mercenary cards in deck", left: 12, total: 14 },
    { name: "Gold loans", left: 4, total: 5 },
    { name: "Red loans", left: 3, total: 5 },
    { name: "Support −1 token", left: 1, total: 1 }
  ],

  /* Westeros: EPIC decks I–IV, no Targaryen deck. */
  westeros: {
    revealed: [
      { deck: 1, name: "Shifting Ambitions", value: 2, note: "Replaced Thwarted Plans (Master of Laws)" },
      { deck: 2, name: "Mustering Troops", value: 1 },
      { deck: 3, name: "Clash of Kings", value: 2 },
      { deck: 4, name: "Bands of Outlaws", value: null, result: "Bid against round target 5: won. Martell bid highest and gains 3 Gold." }
    ],
    left: [8, 9, 9, 9],
    discards: [4, 3, 3, 3],
    abilities: [
      { who: "bolton", role: "Master of Laws", text: "Replace one revealed card of decks I–III with the next one.", state: "used", detail: "Used on Thwarted Plans" },
      { who: "arryn", role: "Grand Maester", text: "Look at the top card of any two Westeros decks.", state: "ready", peek: [2, 3] },
      { who: "red_targaryen", role: "Messenger Raven", text: "In Planning, after orders are revealed: look at the top card of deck IV and keep it or put it at the bottom.", state: "later" }
    ],
    peekCards: {
      2: { deck: 2, name: "Drought", value: 4 },
      3: { deck: 3, name: "Secret Conspiracies", value: 2 }
    }
  },

  /* Checklist for the Diplomacy phase (EPIC p. 8–11 and the rulings). */
  checklist: {
    title: "Diplomacy phase",
    current: 3,
    steps: [
      {
        title: "Start of phase",
        done: true,
        rules: [
          ["Someone is Master of Whispers", "They draw 2 Intrigue cards and discard 1."],
          ["During the whole phase", "Each house may send ravens: one per King's Court star, at least 1. At most 10 words, and every sending is announced."],
          ["A house holds Throne, Blade or Raven", "Throne protects 1 message, Blade destroys 1, Raven reads 1 and passes it on. Each once per round."],
          ["Two houses trade", "Only now can both hand over at the same time. Outside this phase, one gives first."]
        ],
        source: "EPIC p. 8–9",
        cards: ["council-5-master-of-whispers"]
      },
      {
        title: "Diplomatic bonus",
        done: true,
        rules: [["Two houses are at Truce, Alliance or Dynasty", "Each gains 1, 3 or 5 Power per relationship."]],
        source: "EPIC p. 9",
        action: "Apply bonus"
      },
      {
        title: "Hostages",
        done: true,
        rules: [
          ["This Was Not the Deal is played", "Now, before hostage income: kill a hostage. Its holder loses 3 Power."],
          ["A house holds hostages", "It gains 1 Power per hostage. The card's owner loses 1 Power."],
          ["A holder asks for an execution", "Everyone bids in secret with Power and Gold. More in favour: the card leaves the game and the holder may swap places with its owner on one influence track. A tie goes to the Iron Throne."],
          ["Several executions are asked", "Resolve them in reverse Throne order."]
        ],
        source: "EPIC p. 9",
        cards: ["intrigue-this-was-not-the-deal", "intrigue-secure-hostages", "intrigue-extract-information"],
        action: "Apply hostage income"
      },
      {
        title: "Change diplomatic levels",
        done: false,
        rules: [
          ["Two houses want to raise their level", "Both agree. Each pays Power equal to the shortest path between their nearest castles, minus their own King's Court stars."],
          ["The pair already changed this round", "No further change. One step per pair per round."],
          ["The new level would break a limit", "Blocked. At most 3 positive levels, 2 Alliances and 1 Dynasty, and never a Dynasty next to an Alliance."],
          ["One of them is already in an Alliance", "Alliances are transitive: every partner has to join in this phase."],
          ["A house wants to lower a level", "It may do so alone; the other house cannot stop it."],
          ["A house discards its ring to propose", "If accepted, the level rises by one for free (unless already raised) and the dowry cards swap. If declined, the ring stays discarded."]
        ],
        source: "EPIC p. 9–10, Reference sheet 1",
        cards: ["intrigue-a-red-wedding"],
        token: "ring",
        actions: ["Change a level", "Record a marriage", "Record a break"]
      },
      {
        title: "Loans",
        done: false,
        rules: [
          ["A house has a Gold Loan", "It chooses: pay 1 Gold or lose 1 Footman. The Braavos holder picks which Footman; if Braavos is neutral, the debtor picks."],
          ["A house wants a new loan", "In Throne order. Count the conditions met: home plus 3 castles, King's Landing, Throne, Blade, Raven. Loans after taking may not exceed that count. The house takes 6 Gold and a Gold or Red loan."],
          ["A house pays back 6 Gold", "The loan is closed and its card goes back into the deck."]
        ],
        source: "EPIC p. 11",
        cards: ["loan-gold-loan-1", "loan-red-loan-1"]
      }
    ],
    /* What is needed from whom right now. */
    waiting: [
      { who: ["greyjoy", "white_targaryen"], task: "Raise your Truce to an Alliance? Each of you pays 2 Power.", state: "open" },
      { who: ["martell"], task: "Red Targaryen proposed marriage. Accept or decline.", state: "open" },
      { who: ["red_targaryen"], task: "Ring discarded. Waiting for Martell's answer.", state: "waiting" },
      { who: ["bolton", "arryn", "tully"], task: "Alliance raised and paid.", state: "done" },
      { who: ["tyrell", "martell"], task: "Truce raised and paid.", state: "done" }
    ],
    reminder: "If Martell accepts, anyone holding A Red Wedding may play it at once."
  },

  log: [
    [4, "Westeros", "Lannister holds the Iron Throne for the 3rd round in a row, Greyjoy the Blade for the 2nd."],
    [4, "Westeros", "Deck I shows Thwarted Plans. Master of Laws (Bolton) replaces it with Shifting Ambitions."],
    [4, "Westeros", "Deck II shows Mustering Troops, deck III Clash of Kings, deck IV Bands of Outlaws."],
    [4, "Westeros", "Clash of Kings resolved. Small Council reassigned; Tully and White Targaryen have no seat."],
    [4, "Westeros", "Bands of Outlaws: round target 5, bids 7, won. Martell gains 3 Gold."],
    [4, "Diplomacy", "Master of Whispers (Red Targaryen) draws 2 Intrigue cards and discards 1."],
    [4, "Diplomacy", "Diplomatic bonus applied to 8 houses, 22 Power in total."],
    [4, "Diplomacy", "Hostage income: Greyjoy +1, Tully −1, Red Targaryen +1, White Targaryen −1."],
    [4, "Diplomacy", "Bolton, Arryn and Tully form a joint Alliance."],
    [4, "Diplomacy", "Tyrell and Martell raise to Truce."],
    [4, "Diplomacy", "Red Targaryen discards their ring and proposes to Martell."]
  ]
};
