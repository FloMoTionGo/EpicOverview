// Rules and reducer tests:  node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newGame, exampleGame } from '../web/js/core/model.js';
import { reduce, RuleError, ACTIONS } from '../web/js/core/reducer.js';
import { raiseBlock, level, diplomaticBonus, hostageIncome, victory, levelsText, suppliesUsed, bankLeft } from '../web/js/core/rules.js';
import { nextStepId, prevStepId, neighbours, STEPS } from '../web/js/core/steps.js';
import { renderRound } from '../web/js/views/round.js';

const cards = JSON.parse(readFileSync(new URL('../web/data/westeros.json', import.meta.url), 'utf8')).cards;
const ctx = { cards, house: 'greyjoy' };
const run = (g, ...actions) => actions.reduce((acc, a) => reduce(acc, a, ctx).game, g);

test('new game: round 1 starts with Planning, 48 cards in four decks', () => {
  const g = newGame({ cards });
  assert.equal(g.round, 1);
  assert.equal(g.step, 'P1');
  const total = [1, 2, 3, 4].reduce((n, d) => n + g.westeros.decks[d].draw.length, 0);
  assert.equal(total, 48);
});

test('26 steps; round 1 skips Westeros and Diplomacy; End 2 starts the next round at Westeros 1', () => {
  assert.equal(STEPS.length, 26);
  assert.equal(prevStepId('P1', 1), null);
  assert.deepEqual(nextStepId('E2', 1), { id: 'W1', newRound: true });
  assert.equal(prevStepId('P1', 2), 'D6');
  const n = neighbours('W1', 4);
  assert.deepEqual(n.before.map((s) => s.id), ['E1', 'E2']);
});

test('step/next past End 2 starts a new round and clears per-round state', () => {
  let g = exampleGame({ cards });
  g = { ...g, step: 'E2', records: { E1: { tyrell: '+2 VP' } }, councilUsed: { laws: true } };
  g = run(g, { type: 'step/next' });
  assert.equal(g.round, 5);
  assert.equal(g.step, 'W1');
  assert.deepEqual(g.records, {});
  assert.deepEqual(g.councilUsed, {});
});

test('relations: limits, one step per round, break back to War', () => {
  let g = newGame({ cards });
  g.round = 2;
  g = run(g, { type: 'relation/raise', a: 'lannister', b: 'tyrell' });
  assert.equal(level(g, 'lannister', 'tyrell'), 1);
  assert.match(raiseBlock(g, 'lannister', 'tyrell'), /one step per round/);
  assert.throws(() => reduce(g, { type: 'relation/raise', a: 'lannister', b: 'tyrell' }, ctx), RuleError);
  g = run(g, { type: 'relation/raise', a: 'lannister', b: 'bolton' }, { type: 'relation/raise', a: 'lannister', b: 'arryn' });
  assert.match(raiseBlock(g, 'lannister', 'martell'), /3 friendly levels/);
  const r = reduce(g, { type: 'relation/break', a: 'lannister', b: 'tyrell', breaker: 'tyrell' }, ctx);
  assert.equal(level(r.game, 'lannister', 'tyrell'), 0);
  assert.match(r.entry.summary, /Tyrell broke the Truce with Lannister\. Tyrell pays 3\./);
});

test('example game: bonus and hostage income as on the canvas (Diplomacy 2)', () => {
  const g = exampleGame({ cards });
  // the canvas shows the levels at the start of the phase; the example is after step 4, so check today's numbers
  assert.equal(diplomaticBonus(g, 'lannister'), 5);
  assert.equal(diplomaticBonus(g, 'bolton'), 6);
  assert.equal(hostageIncome(g, 'greyjoy').value, 1);
  assert.equal(hostageIncome(g, 'white').value, -1);
  assert.equal(levelsText(g, 'bolton'), 'Alliances with Arryn and Tully');
  assert.equal(suppliesUsed(g), 10);
});

test('marriage: ring spent, free raise, dowries swap once', () => {
  let g = newGame({ cards });
  g.round = 2;
  g = run(g, { type: 'marriage/set', proposer: 'martell', other: 'tully' });
  assert.equal(g.houses.martell.ring, false);
  assert.equal(level(g, 'martell', 'tully'), 1);
  assert.equal(g.dowries.martell, 'tully');
  assert.equal(g.dowries.tully, 'martell');
  assert.throws(() => reduce(g, { type: 'marriage/set', proposer: 'martell', other: 'arryn' }, ctx), /ring is already spent/);
});

test('hostages: at most two per holder, none between Alliance partners', () => {
  let g = newGame({ cards });
  g = run(g, { type: 'hostage/add', holder: 'greyjoy', owner: 'tully' }, { type: 'hostage/add', holder: 'greyjoy', owner: 'arryn' });
  assert.throws(() => reduce(g, { type: 'hostage/add', holder: 'greyjoy', owner: 'bolton' }, ctx), /holding cells are full/);
  g.relations['lannister|tyrell'] = 2;
  assert.throws(() => reduce(g, { type: 'hostage/add', holder: 'lannister', owner: 'tyrell' }, ctx), /cannot hold/);
});

test('loans: bank stock, VP penalty on and off', () => {
  assert.equal(bankLeft(exampleGame({ cards })).gold.length, 4);
  let g = newGame({ cards });
  g.houses.tully.vp = 2;
  for (let i = 0; i < 5; i++) g = run(g, { type: 'loan/take', house: 'tully', kind: 'red' });
  assert.equal(bankLeft(g).red.length, 0);
  assert.equal(g.houses.tully.vp, 1, 'the VP loan moves Tully one step down');
  assert.throws(() => reduce(g, { type: 'loan/take', house: 'tully', kind: 'red' }, ctx), /No Red loans left/);
  g = run(g, { type: 'loan/payback', house: 'tully', id: 'red-1' });
  assert.equal(g.loans.held['red-1'], undefined);
  assert.equal(g.houses.tully.vp, 2, 'paying it back moves Tully up again');
});

test('westeros: one by one, Master of Laws must decide before the next reveal', () => {
  let g = newGame({ cards });
  g.round = 2; g.step = 'W2';
  g.council.laws = 'bolton';
  g = run(g, { type: 'westeros/reveal' });
  assert.equal(g.westeros.shown, 1);
  assert.throws(() => reduce(g, { type: 'westeros/reveal' }, ctx), /decides on the last card first/);
  const first = g.westeros.revealed[1];
  g = run(g, { type: 'westeros/laws', deck: 1, choice: 'replace' });
  assert.notEqual(g.westeros.revealed[1], first);
  assert.ok(g.westeros.decks[1].discard.includes(first));
  g = run(g, { type: 'westeros/reveal' }, { type: 'westeros/reveal' }, { type: 'westeros/reveal' });
  assert.equal(g.westeros.shown, 4);
  for (const d of [1, 2, 3, 4]) {
    const c = cards.find((x) => x.id === g.westeros.revealed[d]);
    assert.equal(c.deck, d);
    assert.ok(!c.reshuffle, 'Winter is Coming is resolved by reshuffling');
  }
});

test('stock: no take at 0, pool conserved', () => {
  let g = newGame({ cards });
  g = run(g, { type: 'stock/take', item: 'bridge', house: 'tully' }, { type: 'stock/take', item: 'bridge' });
  assert.throws(() => reduce(g, { type: 'stock/take', item: 'bridge' }, ctx), /No Bridge left/);
  g = run(g, { type: 'stock/return', item: 'bridge' });
  assert.equal(g.stock.bridge.left, 1);
});

test('supply tokens: at most 3; unknown actions throw', () => {
  let g = newGame({ cards });
  g = run(g, ...Array(3).fill({ type: 'house/adjust', house: 'arryn', field: 'supply', delta: 1 }));
  assert.throws(() => reduce(g, { type: 'house/adjust', house: 'arryn', field: 'supply', delta: 1 }, ctx), /At most 3/);
  assert.throws(() => reduce(g, { type: 'nope' }, ctx), /Unknown action/);
});

test('victory: 7 VP wins, Red castle loan counts one castle less', () => {
  let g = exampleGame({ cards });
  g.houses.martell.castles = 7;
  g.loans.held['red-2'] = 'martell';
  assert.equal(victory(g).winners.length, 0);
  g.houses.arryn.vp = 7;
  assert.deepEqual(victory(g).winners.map((w) => w.house), ['arryn']);
});

test('every action writes one readable log line', () => {
  const g = exampleGame({ cards });
  const samples = [
    { type: 'step/next' }, { type: 'house/adjust', house: 'arryn', field: 'vp', delta: 1 },
    { type: 'council/assign', role: 'maester', house: 'tully' }, { type: 'stock/take', item: 'port', house: 'greyjoy' },
    { type: 'loan/take', house: 'martell', kind: 'gold' }, { type: 'objective/score', house: 'tyrell', vp: 2 }
  ];
  for (const a of samples) {
    const { entry } = reduce(g, a, ctx);
    assert.ok(entry.summary && entry.summary.endsWith('.'), a.type);
    assert.ok(entry.kind, a.type);
  }
  assert.ok(ACTIONS.length >= 25);
});

test('hostages go back for free when the pair reaches Alliance', () => {
  let g = newGame({ cards });
  g = run(g, { type: 'relation/raise', a: 'greyjoy', b: 'tully' }, { type: 'hostage/add', holder: 'greyjoy', owner: 'tully', strength: 2 });
  g.round = 2;
  const r = reduce(g, { type: 'relation/raise', a: 'greyjoy', b: 'tully' }, ctx);
  assert.equal(r.game.hostages.length, 0);
  assert.match(r.entry.summary, /Greyjoy gives the Tully card back for free/);
});

test('victory: a Dynasty wins with 10 VP and 10 castles together; both partners are listed', () => {
  const g = exampleGame({ cards });  // Lannister and Tyrell are a Dynasty
  g.houses.lannister.vp = 5; g.houses.tyrell.vp = 4;
  assert.equal(victory(g).winners.length, 0);
  g.houses.tyrell.vp = 5;  // 10 VP, but only 9 castles
  assert.equal(victory(g).winners.length, 0);
  g.houses.tyrell.castles = 5;
  const w = victory(g).winners.filter((x) => x.dynasty);
  assert.deepEqual(w.map((x) => x.house).sort(), ['lannister', 'tyrell']);
});

test('recording steps show who has acted and who is waiting (D5, D6, A5, E1)', () => {
  const cardById = Object.fromEntries(cards.map((c) => [c.id, c]));
  const view = (g, house = 'greyjoy') => renderRound({ game: g, log: [], house, ui: {}, cards, cardById, narrow: false });
  const queueLabels = (html) => [...html.matchAll(/<li[^>]*><img src="[^"]*" alt="([^"]+)"[^>]*><span[^>]*>([^<]+)<\/span>/g)].map((m) => [m[1].split(' ')[0], m[2]]);
  let g = exampleGame({ cards });
  // D6 New loans: Lannister took Gold, Tyrell and Bolton passed, this device's house is "you", the rest wait
  let q = Object.fromEntries(queueLabels(view(g)));
  assert.equal(q.Lannister, 'took Gold'); assert.equal(q.Tyrell, 'passed'); assert.equal(q.Greyjoy, 'you'); assert.equal(q.Tully, 'waiting');
  // D5 Loan interest: the Gold loan holder is shown as paid
  g = run(g, { type: 'step/goto', step: 'D5' });
  assert.match(view(g), /Paid: 1 Gold\./);
  // A5 Spend Gold: a purchase shows as bought
  g = run(g, { type: 'step/goto', step: 'A5' }, { type: 'stock/take', item: 'port', house: 'tyrell', step: 'A5' });
  q = Object.fromEntries(queueLabels(view(g)));
  assert.equal(q.Tyrell, 'bought'); assert.equal(q.Arryn, 'waiting');
  // E1 Objectives: a score shows its VP
  g = run(g, { type: 'step/goto', step: 'E1' }, { type: 'objective/score', house: 'arryn', vp: 2 });
  q = Object.fromEntries(queueLabels(view(g)));
  assert.equal(q.Arryn, '+2 VP');
});

test('marriage branches: level unchanged when blocked, dowry given only once, declined proposal spends the ring', () => {
  let g = newGame({ cards });
  g.round = 2;
  g = run(g, { type: 'relation/raise', a: 'martell', b: 'tully' });          // changed this round
  let r = reduce(g, { type: 'marriage/set', proposer: 'martell', other: 'tully' }, ctx);
  assert.equal(level(r.game, 'martell', 'tully'), 1, 'one step per pair per round: the marriage gives no extra level');
  assert.match(r.entry.summary, /level unchanged/);
  g = r.game;
  assert.throws(() => reduce(g, { type: 'marriage/set', proposer: 'tully', other: 'martell' }, ctx), /Already married/);
  // Tully proposes to Arryn: Tully's dowry already went to Martell, so only Arryn's changes hands
  g = run(g, { type: 'marriage/set', proposer: 'tully', other: 'arryn' });
  assert.equal(g.dowries.tully, 'martell');
  assert.equal(g.dowries.arryn, 'tully');
  // a declined proposal
  r = reduce(g, { type: 'ring/use', house: 'bolton' }, ctx);
  assert.equal(r.game.houses.bolton.ring, false);
  assert.match(r.entry.summary, /declined/);
  assert.throws(() => reduce(r.game, { type: 'ring/use', house: 'bolton' }, ctx), /already spent/);
});

test('loan interest is owed per Gold loan; the house is done when every Gold loan is settled', () => {
  let g = newGame({ cards });
  g = run(g, { type: 'loan/take', house: 'tyrell', kind: 'gold' }, { type: 'loan/take', house: 'tyrell', kind: 'gold' }, { type: 'step/goto', step: 'D5' });
  const [l1, l2] = Object.keys(g.loans.held).filter((id) => g.loans.held[id] === 'tyrell');
  g = run(g, { type: 'loan/interest', house: 'tyrell', loan: l1, choice: 'gold' });
  assert.equal(g.records.D5.tyrell, undefined, 'one of two loans settled');
  g = run(g, { type: 'loan/interest', house: 'tyrell', loan: l2, choice: 'footman' });
  assert.equal(g.records.D5.tyrell, 'footman');
  assert.throws(() => reduce(g, { type: 'loan/interest', house: 'arryn', loan: l1, choice: 'gold' }, ctx), /does not hold/);
});
