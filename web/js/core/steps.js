// The 26 steps of a round, in canvas order (rows "Round tab, …" on the canvas).
// Content and widgets live in web/js/views/steps.js; this file holds order, labels and modes only.

const P = (phase, short, list) => list.map(([title, mode, modeText], i) => ({
  id: short + (i + 1), phase, short, n: i + 1, total: list.length, title, mode, modeText
}));

export const STEPS = [
  ...P('Westeros', 'W', [
    ['Advance the hold counters', 'all', 'At the board, before any card is drawn.'],
    ['Reveal the cards, Master of Laws', 'seq', 'House rule at this table: deck I first, then II, III and IV.'],
    ['Deck I', 'turn', 'Resolve the card as printed.'],
    ['Deck II', 'turn', 'Resolve the card as printed.'],
    ['Deck III', 'all', 'Resolve the card as printed.'],
    ['Deck IV', 'all', 'Resolve the event; bid cards are bid in secret against the round target.'],
    ['Small Council: swap House cards', 'all', 'Only in a Westeros phase without a bid.']
  ]),
  ...P('Diplomacy', 'D', [
    ['Start of phase: Master of Whispers', 'one', 'The Master of Whispers draws first.'],
    ['Diplomatic bonus and hostage income', 'all', 'Everyone takes their Power at once.'],
    ['Executions', 'turn', 'Hostage holders, in reverse Throne order at the table.'],
    ['Change levels and marriages', 'all', 'Everyone negotiates at once; record each change in Relations.'],
    ['Loan interest', 'all', 'Everyone with a Gold loan, at once.'],
    ['New loans', 'turn', 'Throne order at the table. Each house decides once.']
  ]),
  ...P('Planning', 'P', [
    ['Blade bans an order type', 'one', 'The holder of the Valyrian Steel Blade.'],
    ['Assign orders, pick a Tactic', 'all', 'Handled at the table: everyone at once, in secret.'],
    ['Reveal orders and Tactics', 'all', 'Everyone flips at the same time.'],
    ['Immediate Tactic effects', 'turn', 'Handled at the table, in Sword order.'],
    ['Messenger Raven', 'one', 'The holder of the Messenger Raven.']
  ]),
  ...P('Action', 'A', [
    ['Raid orders', 'turn', 'Handled at the table: Throne order, one Raid each, round and round.'],
    ['March orders', 'turn', 'In turn, Throne order. One March order each, then the next house, until none are left.'],
    ['Consolidate Power', 'turn', 'Handled at the table: Throne order, one order each, round and round.'],
    ['Gain Power and supply', 'all', 'Everyone at once, in this order.'],
    ['Spend Gold', 'turn', 'Throne order at the table, one purchase per turn, until everyone passes.'],
    ['Clean up', 'all', 'Everyone at once.']
  ]),
  ...P('End of round', 'E', [
    ['Objectives', 'all', 'Everyone at once.'],
    ['Victory check', 'all', 'The app checks what it knows; the table confirms the rest.']
  ])
];

for (const s of STEPS) s.label = `${s.short === 'E' ? 'End' : s.phase} ${s.n}`;

export const STEP_IDS = STEPS.map((s) => s.id);
const BY_ID = Object.fromEntries(STEPS.map((s) => [s.id, s]));
export const stepById = (id) => BY_ID[id];

// Round 1 has no Westeros and no Diplomacy phase (EPIC p. 6, 8).
const inRound = (s, round) => !(round === 1 && (s.short === 'W' || s.short === 'D'));

export function nextStepId(id, round) {
  let i = STEP_IDS.indexOf(id);
  for (;;) {
    i += 1;
    if (i >= STEP_IDS.length) return { id: STEP_IDS.find((x) => inRound(BY_ID[x], round + 1)), newRound: true };
    if (inRound(BY_ID[STEP_IDS[i]], round)) return { id: STEP_IDS[i], newRound: false };
  }
}

export function prevStepId(id, round) {
  let i = STEP_IDS.indexOf(id);
  while (--i >= 0) if (inRound(BY_ID[STEP_IDS[i]], round)) return STEP_IDS[i];
  return null;
}

// Neighbours for the faded chips: two before, two after (wrapping into the previous/next round).
export function neighbours(id, round) {
  const ring = STEP_IDS.filter((x) => round > 1 || inRound(BY_ID[x], round));
  const i = ring.indexOf(id);
  const at = (k) => BY_ID[ring[(i + k + ring.length) % ring.length]];
  return { before: [at(-2), at(-1)], after: [at(1), at(2)] };
}
