// The Deck I–IV steps of the Round tab: reveal on the step, no card information before it, Master of Laws on all four.
//   node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newGame } from '../web/js/core/model.js';
import { reduce } from '../web/js/core/reducer.js';
import { renderRound } from '../web/js/views/round.js';

const cards = JSON.parse(readFileSync(new URL('../web/data/westeros.json', import.meta.url), 'utf8')).cards;
const cardById = Object.fromEntries(cards.map((c) => [c.id, c]));
const ctx = { cards, house: 'bolton' };
const DECK_STEP = { 1: 'W3', 2: 'W4', 3: 'W5', 4: 'W6' };

function game(seed, laws = null) {
  const g = newGame({ cards, seed });
  Object.assign(g, { phase: 'playing', round: 2, step: 'W3' });
  g.council.laws = laws;
  return g;
}
const run = (g, ...actions) => actions.reduce((acc, a) => reduce(acc, a, ctx).game, g);
const view = (g, step, narrow = false) => renderRound({ game: { ...g, step }, log: [], house: 'bolton', ui: {}, cards, cardById, narrow });

test('face down, a Deck step shows nothing of the card it will reveal', () => {
  for (let seed = 1; seed <= 40; seed++) {
    let g = game(seed);
    for (const d of [1, 2, 3, 4]) {
      const next = cardById[reduce(g, { type: 'westeros/reveal', deck: d }, ctx).game.westeros.revealed[d]];
      for (const narrow of [false, true]) {
        const html = view(g, DECK_STEP[d], narrow);
        assert.ok(!html.includes(next.name), `seed ${seed}, deck ${d}: ${next.name} shows before the reveal`);
        assert.ok(!html.includes(`cards/westeros/${d}-`), `seed ${seed}, deck ${d}: a card picture shows before the reveal`);
        assert.doesNotMatch(html, /Cards that can act now/);
        assert.doesNotMatch(html, /[Hh]ouse rule/);
        assert.ok(html.includes(`data-act="westeros/reveal" data-p="{&quot;deck&quot;:${d}}"`), `seed ${seed}, deck ${d}: Reveal button`);
      }
      g = run(g, { type: 'westeros/reveal', deck: d });
      const after = view(g, DECK_STEP[d]);
      assert.ok(after.includes(next.name), `seed ${seed}, deck ${d}: the card shows after the reveal`);
      assert.doesNotMatch(after, /data-act="westeros\/reveal"/);
    }
  }
});

test('Reveal is blocked with the reason: an earlier deck first, or Master of Laws first', () => {
  let g = game(7, 'bolton');
  let html = view(g, 'W4');
  assert.match(html, /Reveal deck I first\./);
  assert.doesNotMatch(html, /data-act="westeros\/reveal"/);
  g = run(g, { type: 'westeros/reveal', deck: 1 });
  html = view(g, 'W4');
  assert.match(html, /Master of Laws decides on deck I first\./);
  assert.match(html, /Decide now, before deck II is revealed/);
  assert.match(html, /data-act="westeros\/laws" data-p="\{&quot;deck&quot;:1,&quot;choice&quot;:&quot;replace&quot;\}"/);
  g = run(g, { type: 'westeros/laws', deck: 1, choice: 'keep' });
  assert.match(view(g, 'W4'), /data-act="westeros\/reveal" data-p="\{&quot;deck&quot;:2\}"/);
});

test('Master of Laws: one strip on all four Deck steps, with the right state', () => {
  const strip = (html) => (html.match(/<div class="k-laws"[\s\S]*?<\/span>/) || [''])[0];
  let g = game(3);
  for (const step of ['W3', 'W4', 'W5', 'W6']) assert.match(strip(view(g, step)), /Nobody sits on Master of Laws/);
  g = game(3, 'bolton');
  for (const step of ['W3', 'W4', 'W5']) assert.match(strip(view(g, step)), /Master of Laws, Bolton\.<\/strong> Decides right after this card is revealed/);
  assert.match(strip(view(g, 'W6')), /works on decks I to III only/);
  g = run(g, { type: 'westeros/reveal', deck: 1 });
  for (const step of ['W3', 'W4', 'W5', 'W6']) assert.match(strip(view(g, step)), /Decide now/);
  g = run(g, { type: 'westeros/laws', deck: 1, choice: 'keep' });
  assert.match(strip(view(g, 'W3')), /Kept /);
  g = run(g, { type: 'westeros/reveal', deck: 2 }, { type: 'westeros/laws', deck: 2, choice: 'replace' });
  for (const step of ['W3', 'W4', 'W5', 'W6']) assert.match(strip(view(g, step)), /Used on deck II: .+ was replaced by .+\. Once per round\./);
});

test('the round target shows only on Deck IV with a bid card', () => {
  let g = game(5);
  g = run(g, { type: 'westeros/reveal', deck: 1 }, { type: 'westeros/reveal', deck: 2 }, { type: 'westeros/reveal', deck: 3 });
  for (const step of ['W3', 'W4', 'W5', 'W6']) assert.doesNotMatch(view(g, step), /Round target/);
  const vals = [1, 2, 3].map((d) => cardById[g.westeros.revealed[d]].value ?? 0);
  const total = vals.reduce((a, b) => a + b, 0);
  const bid = cards.find((c) => c.deck === 4 && c.bid);
  const event = cards.find((c) => c.deck === 4 && !c.bid && !c.reshuffle);
  const withIV = (id) => ({ ...g, westeros: { ...g.westeros, shown: 4, revealed: { ...g.westeros.revealed, 4: id } } });
  assert.ok(view(withIV(bid.id), 'W6').includes(`Round target ${total} (${vals.join(' + ')})`));
  assert.doesNotMatch(view(withIV(event.id), 'W6'), /Round target/);
  for (const step of ['W3', 'W4', 'W5']) assert.doesNotMatch(view(withIV(bid.id), step), /Round target/);
});

// put the named card on top of deck d
function onTop(g, d, name) {
  const id = cards.find((c) => c.deck === d && c.name === name).id;
  g.westeros.decks[d].draw = [id, ...g.westeros.decks[d].draw.filter((x) => x !== id)];
  return g;
}
const throughIII = (g) => run(g, { type: 'westeros/reveal', deck: 1 }, { type: 'westeros/reveal', deck: 2 }, { type: 'westeros/reveal', deck: 3 });

test('council swap step: skipped after Clash of Kings, shown without a bid', async () => {
  const { nextStepId, prevStepId, neighbours, position, stepById } = await import('../web/js/core/steps.js');
  let g = throughIII(onTop(game(11), 3, 'Clash of Kings'));
  assert.equal(g.westeros.trackBid, true);
  assert.deepEqual(nextStepId('W6', g.round, g), { id: 'D1', newRound: false });
  assert.equal(prevStepId('D1', g.round, g), 'W6');
  assert.deepEqual(neighbours('W6', g.round, g).after.map((s) => s.id), ['D1', 'D2']);
  assert.deepEqual(position(stepById('W6'), g), { n: 5, total: 5 });
  assert.equal(run({ ...g, step: 'W6' }, { type: 'step/next' }).step, 'D1');
  assert.equal(run({ ...g, step: 'D1' }, { type: 'step/prev' }).step, 'W6');
  assert.match(view(g, 'W6'), /Westeros, step 5 of 5/);
  g = throughIII(onTop(game(11), 3, 'Secret Conspiracies'));
  assert.equal(g.westeros.trackBid, false);
  assert.equal(run({ ...g, step: 'W6' }, { type: 'step/next' }).step, 'W7');
  assert.match(view(g, 'W6'), /Westeros, step 5 of 6/);
  // the next round starts without the flag
  g = throughIII(onTop(game(11), 3, 'Clash of Kings'));
  g = run({ ...g, step: 'E2' }, { type: 'step/next' });
  assert.equal(g.westeros.trackBid, false);
  assert.deepEqual(g.westeros.chosen, []);
});

test('Dark Wings, Dark Words: the Raven holder ticks the events; Clash of Kings hides the swap, Storm counts for Planning 2', () => {
  let g = throughIII(onTop(game(12), 3, 'Dark Wings, Dark Words'));
  let html = view(g, 'W5');
  assert.match(html, /The Raven holder chose/);
  assert.match(html, /data-act="westeros\/choose" data-p="\{&quot;event&quot;:&quot;Clash of Kings&quot;,&quot;on&quot;:true\}"/);
  assert.equal(g.westeros.trackBid, false);
  let r = reduce(g, { type: 'westeros/choose', event: 'Clash of Kings', on: true }, ctx);
  assert.equal(r.entry.summary, 'The Raven holder chose Clash of Kings for Dark Wings, Dark Words.');
  g = run(r.game, { type: 'westeros/choose', event: 'Storm in the Skies', on: true });
  assert.deepEqual(g.westeros.chosen, ['Clash of Kings', 'Storm in the Skies']);
  assert.equal(g.westeros.trackBid, true);
  assert.equal(run({ ...g, step: 'W6' }, { type: 'step/next' }).step, 'D1');
  assert.match(view(g, 'W5'), /aria-pressed="true"[^>]*>Clash of Kings/);
  assert.match(view(g, 'P2'), /minus 2: Storm in the Skies is face up this round/);
  r = reduce(g, { type: 'westeros/choose', event: 'Clash of Kings', on: false }, ctx);
  assert.match(r.entry.summary, /took back Clash of Kings/);
  assert.equal(r.game.westeros.trackBid, false);
  assert.throws(() => reduce(g, { type: 'westeros/choose', event: 'Drought', on: true }, ctx), /Unknown event/);
  const other = throughIII(onTop(game(12), 3, 'Secret Conspiracies'));
  assert.throws(() => reduce(other, { type: 'westeros/choose', event: 'Clash of Kings', on: true }, ctx), /not face up/);
});

test('a Master of Laws replacement on deck III updates the bid flag', () => {
  let g = run(onTop(game(13, 'bolton'), 3, 'Clash of Kings'),
    { type: 'westeros/reveal', deck: 1 }, { type: 'westeros/laws', deck: 1, choice: 'keep' },
    { type: 'westeros/reveal', deck: 2 }, { type: 'westeros/laws', deck: 2, choice: 'keep' }, { type: 'westeros/reveal', deck: 3 });
  assert.equal(g.westeros.trackBid, true);
  // the next card of deck III is not Clash of Kings
  const next = cards.find((c) => c.deck === 3 && c.name === 'Secret Conspiracies').id;
  g.westeros.decks[3].draw = [next, ...g.westeros.decks[3].draw.filter((x) => x !== next)];
  g = run(g, { type: 'westeros/laws', deck: 3, choice: 'replace' });
  assert.equal(g.westeros.trackBid, false);
});

test('token holders: named and highlighted where they act, generic text without them', async () => {
  const { exampleGame } = await import('../web/js/core/model.js');
  const { renderWesteros } = await import('../web/js/views/westeros.js');
  const lit = (html) => [...html.matchAll(/<a href="#\/houses" class="k-seat" style="[^"]*rgba\(201,162,76,\.18\)[^"]*">\s*<span[^>]*>\s*<img src="assets\/sigils\/(\w+)\.webp"/g)].map((m) => m[1]);
  const at = (g, step, extra = {}) => renderRound({ game: { ...g, step, ...extra }, log: [], house: 'bolton', ui: {}, cards, cardById, narrow: false });
  const none = { ...exampleGame({ cards }), bannedOrder: null, records: {} };
  const set = { ...none, tracks: { throne: 'lannister', blade: 'tyrell', raven: 'greyjoy' } };
  // Planning 1: the Blade holder bans
  assert.match(at(set, 'P1'), /Tyrell picks/);
  assert.deepEqual(lit(at(set, 'P1')), ['tyrell']);
  assert.match(at(none, 'P1'), /The Blade holder picks/);
  assert.deepEqual(lit(at(none, 'P1')), []);
  // Planning 5: the Raven holder chooses; a swap is recorded under the Raven holder
  const p5 = at(set, 'P5');
  assert.match(p5, /Greyjoy chooses/);
  assert.deepEqual(lit(p5), ['greyjoy']);
  assert.match(p5, /&quot;step&quot;:&quot;P5&quot;,&quot;house&quot;:&quot;greyjoy&quot;/);
  assert.match(at(none, 'P5'), /The Raven holder chooses/);
  // Westeros 1, Diplomacy 1 and 3
  assert.match(at(set, 'W1'), /Iron Throne: Lannister/);
  assert.match(at(none, 'W1'), /Iron Throne: not recorded/);
  assert.match(at(set, 'D1'), /the Throne \(Lannister\) protects 1 message, the Blade \(Tyrell\) destroys 1, the Raven \(Greyjoy\) reads 1/);
  assert.match(at(set, 'D3'), /Lannister, holder of the Iron Throne, decides/);
  assert.match(at(none, 'D3'), /The Iron Throne holder decides/);
  // a Deck card the holder resolves
  const withCard = (g, d, name) => ({ ...g, westeros: { ...g.westeros, revealed: { ...g.westeros.revealed, [d]: cards.find((c) => c.name === name).id } } });
  const burden = at(withCard(set, 1, 'The Burden of Power'), 'W3');
  assert.match(burden, /Lannister chooses/);
  assert.ok(lit(burden).includes('lannister'));
  assert.match(at(withCard(set, 3, 'Dark Wings, Dark Words'), 'W5'), /Greyjoy holds the Messenger Raven/);
  assert.doesNotMatch(at(withCard(none, 2, 'Strategical Superiority'), 'W4'), /chooses<\/div>/);
  // battle guide, Blade step; Westeros tab, Raven ability
  const blade = renderRound({ game: { ...set, step: 'A2' }, log: [], house: 'bolton', ui: { battleStep: 3 }, cards, cardById, narrow: false });
  assert.match(blade, /If its holder, Tyrell, fights here/);
  assert.match(renderWesteros({ game: set, log: [], house: 'bolton', ui: {}, cards, cardById, narrow: false }), /Greyjoy, in Planning/);
  // no assign button or Houses link on the Round tab
  for (const step of ['W1', 'W5', 'D1', 'D3', 'P1', 'P5']) {
    const html = at(set, step);
    const card = html.slice(html.indexOf('<article'), html.indexOf('</article>'));
    assert.doesNotMatch(card, /track\/assign|href="#\/houses"/, step);
  }
});

test('games without the bid flag (example, older saves, old replays) still leave the swap step out after Clash of Kings', async () => {
  const { exampleGame, upgradeGame } = await import('../web/js/core/model.js');
  const { prevStepId } = await import('../web/js/core/steps.js');
  const ex = exampleGame({ cards });                                  // deck III is Clash of Kings
  assert.equal(ex.westeros.trackBid, true);
  assert.equal(prevStepId('D1', ex.round, ex), 'W6');
  // an older save: no trackBid, no chosen, no tracks, parked on a retired step
  const old = JSON.parse(JSON.stringify(ex));
  delete old.westeros.trackBid; delete old.westeros.chosen; delete old.tracks;
  old.step = 'W2';
  assert.equal(run({ ...old, step: 'W6' }, { type: 'step/next' }).step, 'D1');
  const up = upgradeGame(JSON.parse(JSON.stringify(old)), cards);
  assert.equal(up.westeros.trackBid, true);
  assert.deepEqual(up.westeros.chosen, []);
  assert.deepEqual(up.tracks, { throne: null, blade: null, raven: null });
  assert.equal(up.step, 'W3');
  assert.match(view(up, 'W7'), /No council swap this round: there was a bid/);
});

test('Diplomacy 3: Executed only when the vote did not go against it', async () => {
  const { exampleGame } = await import('../web/js/core/model.js');
  const g = { ...exampleGame({ cards }), step: 'D3' };
  const at = (ui) => renderRound({ game: g, log: [], house: 'greyjoy', ui, cards, cardById, narrow: false });
  const exec = (html) => (html.match(/<button type="button"[^>]*>Executed<\/button>/) || [''])[0];
  assert.match(exec(at({})), /data-act="hostage\/execute"/);
  assert.match(exec(at({ favour: 2, against: 2 })), /data-act="hostage\/execute"/, 'a tie: the Throne holder decides');
  assert.match(exec(at({ favour: 1, against: 3 })), /aria-disabled="true"/);
  assert.doesNotMatch(exec(at({ favour: 1, against: 3 })), /data-act=/);
});
