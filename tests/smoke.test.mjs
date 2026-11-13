// Full-game smoke test (T19): 12 rounds through the reducer, every screen rendered at every step.
//   node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newGame } from '../web/js/core/model.js';
import { reduce } from '../web/js/core/reducer.js';
import { victory, suppliesUsed } from '../web/js/core/rules.js';
import { HOUSE_IDS, STOCK, SUPPLY_POOL } from '../web/js/core/data.js';
import { STEPS } from '../web/js/core/steps.js';
import { lawsPending } from '../web/js/core/westeros.js';
import { renderRound } from '../web/js/views/round.js';
import { renderHouses } from '../web/js/views/houses.js';
import { renderRelations } from '../web/js/views/relations.js';
import { renderWesteros } from '../web/js/views/westeros.js';
import { renderLoans, renderMarket, renderLog, renderChoose } from '../web/js/views/other.js';

const cards = JSON.parse(readFileSync(new URL('../web/data/westeros.json', import.meta.url), 'utf8')).cards;
const DECK_OF = { W3: 1, W4: 2, W5: 3, W6: 4 };   // the Deck step that reveals each deck
const cardById = Object.fromEntries(cards.map((c) => [c.id, c]));
const VIEWS = [renderRound, renderHouses, renderRelations, renderWesteros, renderLoans, renderMarket, renderLog, renderChoose];

function renderAll(g, log, house) {
  for (const narrow of [false, true]) {
    for (const view of VIEWS) {
      const html = view({ game: g, log, house, ui: {}, cards, cardById, narrow });
      assert.equal(typeof html, 'string');
      const bad = html.replace(/="[^"]*"/g, '').match(/.{0,40}(?:undefined|NaN|\[object Object\]).{0,40}/);
      if (bad) assert.fail(`${view.name} at ${g.step}, round ${g.round}: ${bad[0]}`);
    }
  }
}

function deckCount(w, d) {
  return w.decks[d].draw.length + w.decks[d].discard.length + (w.revealed[d] ? 1 : 0);
}

test('12 rounds: every step renders, decks and stock are conserved, Lannister wins with 7 VP', () => {
  let g = newGame({ cards, seed: 12 });
  const log = [];
  const start = Object.fromEntries([1, 2, 3, 4].map((d) => [d, deckCount(g.westeros, d)]));
  const act = (action, house = 'lannister') => {
    const r = reduce(g, action, { cards, house });
    g = r.game;
    log.unshift({ ...r.entry, id: log.length + 1, house, time: '2026-11-13T20:00:00+01:00' });
  };
  // a small, fixed table: council seats, two friendly pairs, a hostage, a marriage
  act({ type: 'council/assign', role: 'laws', house: 'bolton' });
  act({ type: 'council/assign', role: 'coin', house: 'martell' });
  act({ type: 'council/assign', role: 'maester', house: 'arryn' });
  act({ type: 'relation/raise', a: 'lannister', b: 'tyrell' });
  act({ type: 'relation/raise', a: 'bolton', b: 'tully' });
  act({ type: 'hostage/add', holder: 'greyjoy', owner: 'tully', strength: 2 });
  let steps = 0;
  while (!g.winner && g.round <= 12) {
    renderAll(g, log, HOUSE_IDS[steps % 9]);
    const s = g.step;
    const d = DECK_OF[s];
    if (d) {
      // each Deck step reveals its deck; Master of Laws decides right after a card of decks I to III
      act({ type: 'westeros/reveal', deck: d });
      renderAll(g, log, 'bolton');
      if (lawsPending(g)) {
        act({ type: 'westeros/laws', deck: d, choice: g.round % 2 ? 'keep' : 'replace' }, 'bolton');
        renderAll(g, log, 'bolton');
      }
    }
    if (s === 'W6' && cardById[g.westeros.revealed[4]]?.bid) act({ type: 'westeros/deck4', result: g.round % 3 ? 'won' : 'lost', total: 6, target: 5 });
    if (s === 'D3') for (const x of g.hostages.filter((y) => !(g.records.D3 || {})[y.id])) act({ type: 'hostage/execute', id: x.id, result: 'kept' }, x.holder);
    if (s === 'D5') for (const h of HOUSE_IDS) if (Object.entries(g.loans.held).some(([id, o]) => o === h && id.startsWith('gold'))) act({ type: 'loan/interest', house: h, choice: 'gold' }, h);
    if (s === 'D6' && g.round === 3) act({ type: 'loan/take', house: 'white', kind: 'red' }, 'white');
    if (s === 'D6' && g.round === 4) act({ type: 'loan/take', house: 'greyjoy', kind: 'gold' }, 'greyjoy');
    if (s === 'A5' && g.stock.port.left) act({ type: 'stock/take', item: 'port', house: 'greyjoy', step: 'A5' }, 'greyjoy');
    if (s === 'E1') act({ type: 'objective/score', house: 'lannister', vp: 1 });
    if (s === 'E2') {
      const v = victory(g);
      const win = v.winners.find((x) => x.house === 'lannister');
      if (win) { act({ type: 'win/confirm', house: 'lannister', reason: win.reason }); break; }
    }
    act({ type: 'step/next' });
    for (const d of [1, 2, 3, 4]) assert.equal(deckCount(g.westeros, d), start[d], `deck ${d} after ${s}, round ${g.round}`);
    for (const it of STOCK) assert.ok(g.stock[it.id].left >= 0 && g.stock[it.id].left <= it.total);
    assert.ok(suppliesUsed(g) <= SUPPLY_POOL);
    steps++;
  }
  renderAll(g, log, 'lannister');
  assert.equal(g.winner?.house, 'lannister');
  assert.equal(g.winner.reason, '7 Victory Points');
  assert.equal(g.round, 7, 'one VP per round from round 1: the 7th Objective lands in round 7');
  // round 1 skips Westeros and Diplomacy: 13 steps, then a full round each (this seed never draws Clash of Kings
  // on deck III, so the council swap step is always there), up to End 2 of round 7
  assert.equal(steps, 13 + STEPS.length * 5 + (STEPS.length - 1));
  assert.ok(log.some((e) => /wins the game/.test(e.summary)));
});
