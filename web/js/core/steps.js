// The steps of a round, in canvas order (rows "Round tab, …" on the canvas).
// Content and widgets live in web/js/views/round.js; this file holds order, labels and modes only.
//
// Ids are fixed names, not positions: saved games, per-step records, the Log and replays store them. A step that
// leaves the round keeps its id retired (see RETIRED), and the labels ("Westeros 2") count only the steps in use.

const P = (phase, short, list) => list.map(([id, title, mode, modeText], i) => ({
  id, phase, short, n: i + 1, total: list.length, title, mode, modeText
}));

export const STEPS = [
  ...P('Westeros', 'W', [
    ['W1', 'Advance the hold counters', 'all', 'At the board, before any card is drawn.'],
    // face down these say nothing about the card; the revealed card brings its own mode
    ['W3', 'Deck I', 'all', 'Reveal the card, then resolve it.'],
    ['W4', 'Deck II', 'all', 'Reveal the card, then resolve it.'],
    ['W5', 'Deck III', 'all', 'Reveal the card, then resolve it.'],
    ['W6', 'Deck IV', 'all', 'Reveal the card, then resolve it.'],
    ['W7', 'Small Council: swap House cards', 'all', 'Only in a Westeros phase without a bid.']
  ]),
  ...P('Diplomacy', 'D', [
    ['D1', 'Start of phase: Master of Whispers', 'one', 'The Master of Whispers draws first.'],
    ['D2', 'Diplomatic bonus and hostage income', 'all', 'Everyone takes their Power at once.'],
    ['D3', 'Executions', 'turn', 'Hostage holders, in reverse Throne order at the table.'],
    ['D5', 'Loan interest', 'all', 'Everyone with a Gold loan, at once.'],
    ['D6', 'New loans', 'turn', 'Throne order at the table. Each house decides once.']
  ]),
  ...P('Planning', 'P', [
    ['P1', 'Blade bans an order type', 'one', 'The holder of the Valyrian Steel Blade.'],
    ['P2', 'Assign orders, pick a Tactic', 'all', 'Handled at the table: everyone at once, in secret.'],
    ['P3', 'Reveal orders and Tactics', 'all', 'Everyone flips at the same time.'],
    ['P4', 'Immediate Tactic effects', 'turn', 'Handled at the table, in Sword order.'],
    ['P5', 'Messenger Raven', 'one', 'The holder of the Messenger Raven.']
  ]),
  ...P('Action', 'A', [
    ['A1', 'Raid orders', 'turn', 'Handled at the table: Throne order, one Raid each, round and round.'],
    ['A2', 'March orders', 'turn', 'In turn, Throne order. One March order each, then the next house, until none are left.'],
    ['A3', 'Consolidate Power', 'turn', 'Handled at the table: Throne order, one order each, round and round.'],
    ['A4', 'Gain Power and supply', 'all', 'Everyone at once, in this order.'],
    ['A5', 'Spend Gold', 'turn', 'Throne order at the table, one purchase per turn, until everyone passes.'],
    ['A6', 'Clean up', 'all', 'Everyone at once.']
  ]),
  ...P('End of round', 'E', [
    ['E1', 'Objectives', 'all', 'Everyone at once.'],
    ['E2', 'Victory check', 'all', 'The app checks what it knows; the table confirms the rest.']
  ])
];

for (const s of STEPS) s.label = `${s.short === 'E' ? 'End' : s.phase} ${s.n}`;

// Steps that only happen in some rounds: skip(game) is true when the step is left out.
// The council swap needs a Westeros phase without a bid on the influence tracks (EPIC p. 8; reducer sets trackBid).
STEPS.find((s) => s.id === 'W7').skip = (g) => Boolean(g && g.westeros && g.westeros.trackBid);
const skipped = (s, game) => Boolean(game && s.skip && s.skip(game));

// Retired steps and where a game parked on them continues: "Reveal the cards" moved into the Deck steps;
// "Change levels and marriages" left the round (diplomacy happens all game long at this table).
const RETIRED = { W2: 'W3', D4: 'D5' };
export const canonicalStep = (id) => RETIRED[id] || id;

export const STEP_IDS = STEPS.map((s) => s.id);
const BY_ID = Object.fromEntries(STEPS.map((s) => [s.id, s]));
export const stepById = (id) => BY_ID[canonicalStep(id)];

// Round 1 has no Westeros and no Diplomacy phase (EPIC p. 6, 8). With the game, steps it skips are left out too.
const inRound = (s, round, game) => !(round === 1 && (s.short === 'W' || s.short === 'D')) && !skipped(s, game);

export function nextStepId(id, round, game) {
  let i = STEP_IDS.indexOf(canonicalStep(id));
  for (;;) {
    i += 1;
    if (i >= STEP_IDS.length) return { id: STEP_IDS.find((x) => inRound(BY_ID[x], round + 1)), newRound: true };
    if (inRound(BY_ID[STEP_IDS[i]], round, game)) return { id: STEP_IDS[i], newRound: false };
  }
}

export function prevStepId(id, round, game) {
  let i = STEP_IDS.indexOf(canonicalStep(id));
  while (--i >= 0) if (inRound(BY_ID[STEP_IDS[i]], round, game)) return STEP_IDS[i];
  return null;
}

// "Step n of N" within the phase, counting only the steps this game shows.
export function position(step, game) {
  const shown = STEPS.filter((s) => s.short === step.short && !skipped(s, game));
  const i = shown.findIndex((s) => s.id === step.id);
  return i < 0 ? { n: step.n, total: step.total } : { n: i + 1, total: shown.length };
}

// Neighbours for the faded chips: two before, two after (wrapping into the previous/next round).
export function neighbours(id, round, game) {
  // a skipped step stays in the ring while the table stands on it (reached with a tap on its chip earlier)
  const ring = STEP_IDS.filter((x) => (round > 1 || inRound(BY_ID[x], round)) && (x === canonicalStep(id) || !skipped(BY_ID[x], game)));
  const i = Math.max(0, ring.indexOf(canonicalStep(id)));
  const at = (k) => BY_ID[ring[(i + k + ring.length) % ring.length]];
  return { before: [at(-2), at(-1)], after: [at(1), at(2)] };
}
