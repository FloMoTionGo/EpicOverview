// The gathering, games, round summary and replay-bar screens render cleanly:  node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newGame } from '../web/js/core/model.js';
import { reduce } from '../web/js/core/reducer.js';
import { renderGather } from '../web/js/views/gather.js';
import { replayBar, renderGames, renderSummary, gameTitle, when } from '../web/js/views/replay.js';
import { renderRound } from '../web/js/views/round.js';
import { STEPS } from '../web/js/core/steps.js';
import { renderLog } from '../web/js/views/other.js';

const cards = JSON.parse(readFileSync(new URL('../web/data/westeros.json', import.meta.url), 'utf8')).cards;
const cardById = Object.fromEntries(cards.map((c) => [c.id, c]));

function clean(html, where) {
  assert.equal(typeof html, 'string');
  const bad = html.replace(/="[^"]*"/g, '').match(/.{0,40}(?:undefined|NaN|\[object Object\]).{0,40}/);
  if (bad) assert.fail(`${where}: ${bad[0]}`);
  return html;
}

// a short game the way the server stores it: gathering, start, three rounds, Tyrell wins
function history() {
  let g = newGame({ cards, seed: 3 });
  const frames = [{ v: 1, t: '2026-11-13T20:00:00+01:00', e: { summary: 'New game: gathering at the table.', kind: 'game' }, g }];
  const act = (a) => {
    const r = reduce(g, a, { cards, house: 'tyrell' });
    g = r.game;
    frames.push({ v: frames.length + 1, t: '2026-11-13T20:05:00+01:00', e: { ...r.entry, house: 'tyrell' }, g });
  };
  act({ type: 'gather/join', device: 'd1', house: 'tyrell' });
  act({ type: 'gather/join', device: 'd2', house: 'martell' });
  act({ type: 'game/start' });
  for (let round = 1; round <= 3; round++) {
    act({ type: 'objective/score', house: 'tyrell', vp: round });
    act({ type: 'house/adjust', house: 'martell', field: 'castles', delta: 1 });
    const steps = round === 1 ? 13 : STEPS.length;
    for (let k = 0; k < steps && round < 3; k++) act({ type: 'step/next' });
  }
  act({ type: 'win/confirm', house: 'tyrell', reason: '7 Victory Points' });
  return frames;
}

const frames = history();
const meta = { id: '20261113-200000-abcd', kind: 'game', started: '2026-11-13T20:00:00+01:00', ended: '2026-11-13T23:10:00+01:00', changes: frames.length, round: 3, step: 'P1', phase: 'playing', winner: 'tyrell' };
const base = (narrow, extra = {}) => ({ log: [], house: 'tyrell', ui: {}, cards, cardById, narrow, device: 'd1', joinUrl: 'https://flomotiongo.github.io/EpicOverview/', ...extra });

test('gathering: live with a QR code and buttons, read-only in a replay', () => {
  const g = frames[2].g;                                     // two devices joined
  for (const narrow of [false, true]) {
    const live = clean(renderGather({ ...base(narrow), game: g }), 'gather live');
    assert.match(live, /<svg role="img" aria-label="QR code to join: https:\/\/flomotiongo.github.io\/EpicOverview\/"/);
    assert.match(live, /data-act="game\/start"/);
    assert.match(live, /2 of 9 houses have joined/);
    assert.match(live, /This device plays Tyrell/);                    // d1 joined as Tyrell
    const replayed = clean(renderGather({ ...base(narrow), game: g, replay: { frames, index: 2, meta } }), 'gather replay');
    assert.doesNotMatch(replayed, /data-act="game\/start"|data-act="house\/choose"/);
  }
  const other = clean(renderGather({ ...base(false), device: 'd9', ui: { gatherPick: 'arryn' }, game: g }), 'gather pick');
  assert.match(other, /Play as Arryn/);
});

test('games list: loading, error, empty and filled', () => {
  for (const narrow of [false, true]) {
    clean(renderGames({ ...base(narrow), game: null, games: null }), 'games loading');
    assert.match(renderGames({ ...base(narrow), game: null, games: { error: true } }), /could not be loaded/);
    assert.match(renderGames({ ...base(narrow), game: null, games: { current: null, past: [] } }), /No games yet/);
    const html = clean(renderGames({ ...base(narrow), game: frames[frames.length - 1].g, games: { current: { ...meta, winner: null, phase: 'gathering', changes: 3 }, past: [meta] } }), 'games');
    assert.match(html, /Tyrell won in round 3/);
    assert.match(html, /Gathering, not started/);
    assert.match(html, /data-p="\{&quot;id&quot;:&quot;current&quot;,&quot;at&quot;:0\}"/);
  }
  assert.equal(when('2026-11-13T20:15:30+01:00'), '13 Nov 2026, 20:15');
  assert.equal(gameTitle({ ...meta, kind: 'example' }), 'Round 4 example of 13 Nov 2026');
});

test('round summary: nine panels on one scale, legend, table with every value', () => {
  for (const narrow of [false, true]) {
    const html = clean(renderSummary({ ...base(narrow), game: frames[frames.length - 1].g, replay: { frames, index: frames.length - 1, meta } }), 'summary');
    assert.equal((html.match(/class="k-sumpanel"/g) || []).length, 9);
    assert.match(html, /Victory Points/);
    assert.match(html, /Tyrell \(won\)/);
    assert.match(html, /data-rounds="1,2,3"/);
    assert.match(html, /data-vp="1,3,6"/);                              // Tyrell: +1, +2, +3
    assert.match(html, /<th scope="col"[^>]*>R3<\/th>/);
    assert.match(html, />6 \/ 1<\/td>/);                                // Tyrell, round 3: 6 VP, 1 castle
  }
  const empty = renderSummary({ ...base(false), game: frames[0].g, replay: { frames: frames.slice(0, 2), index: 1, meta } });
  assert.match(empty, /No round has been played/);
});

test('replay bar and the screens at any frame', () => {
  for (const narrow of [false, true]) {
    for (const index of [0, 3, 20, frames.length - 1]) {
      const ctx = { ...base(narrow), game: frames[index].g, replay: { frames, index, meta, playing: index === 3 }, route: 'round' };
      const bar = clean(replayBar(ctx), `bar ${index}`);
      assert.match(bar, new RegExp(`change ${index + 1} of ${frames.length}`));
      assert.match(bar, index === 3 ? /aria-label="Pause"/ : /aria-label="Play"/);
      if (frames[index].g.phase !== 'gathering') clean(renderRound(ctx), `round at ${index}`);
      const log = clean(renderLog({ ...ctx, log: frames.slice(0, index + 1).map((f) => f.e) }), `log at ${index}`);
      assert.doesNotMatch(log, /Replay this game|download/);              // live-only buttons hidden in a replay
    }
  }
});

test('temporary test tab: every Westeros card on its Deck step, hidden without ?test', async () => {
  const { renderTest } = await import('../web/js/views/test.js');
  const { TABS, TEST_TAB } = await import('../web/js/ui/chrome.js');
  assert.equal(TEST_TAB, false);
  assert.ok(!TABS.some(([id]) => id === 'test'));
  for (const narrow of [false, true]) {
    const html = clean(renderTest({ ...base(narrow), game: frames[frames.length - 1].g }), 'test tab');
    assert.equal((html.match(/<article /g) || []).length, 43);                // 4 face down + 39 distinct cards
    assert.equal((html.match(/>Deck I: /g) || []).length, 10);
    assert.match(html, /Deck IV: Bands of Outlaws/);
    assert.match(html, /Round target 6 \(1 \+ 4 \+ 1\)/);
    assert.doesNotMatch(html, /Deck [I-V]+: Winter is Coming/);
    assert.equal(new Set([...html.matchAll(/ id="(t-\d+)"/g)].map((m) => m[1])).size, 43, 'unique heading ids');
  }
});

test('phone Relations shows the matrix with the bottom sheet; no Objectives count on Houses or in the seats strip', async () => {
  const { exampleGame } = await import('../web/js/core/model.js');
  const { renderRelations } = await import('../web/js/views/relations.js');
  const { renderHouses } = await import('../web/js/views/houses.js');
  const g = exampleGame({ cards });
  const count = (html, re) => (html.match(re) || []).length;
  for (const ui of [{}, { cell: 'lannister|tyrell' }]) {
    const phone = clean(renderRelations({ ...base(true), game: g, ui }), 'phone relations');
    assert.equal(count(phone, / id="r-matrix"/g), 1);
    assert.equal(count(phone, /, tap for options"/g), 72);               // 81 cells without the diagonal
    assert.doesNotMatch(phone, /k-relpop|friendly of 3/);                // the tablet popover and column stay away
    assert.equal(count(phone, /role="dialog" aria-modal="true" aria-label="Lannister and Tyrell" class="k-relsheet"/g), ui.cell ? 1 : 0);
    assert.equal(count(phone, /role="dialog"/g), ui.cell ? 1 : 0);
    assert.doesNotMatch(phone, /role="grid"/);
    assert.match(phone, /Levels with the other houses/);                 // the per-house list is still there
  }
  const tablet = clean(renderRelations({ ...base(false), game: g, ui: { cell: 'lannister|tyrell' } }), 'tablet relations');
  assert.match(tablet, /k-relpop/);
  assert.match(tablet, /friendly of 3/);
  for (const narrow of [false, true]) {
    const houses = clean(renderHouses({ ...base(narrow), game: g }), 'houses');
    assert.doesNotMatch(houses, /Objectives|obj\./);
    assert.equal(count(houses, /&quot;field&quot;:&quot;supply&quot;/g), 18);  // − and + for nine houses
    assert.doesNotMatch(clean(renderRound({ ...base(narrow), house: 'greyjoy', game: g }), 'round').split('class="k-seats"')[1] || '', /obj\./);
  }
});

test('Thwarted Plans names the houses with 2 or more Objectives scored in the app', async () => {
  const { exampleGame } = await import('../web/js/core/model.js');
  const base0 = exampleGame({ cards });
  const card = cards.find((c) => c.name === 'Thwarted Plans');
  const at = (houses) => clean(renderRound({ ...base(false), house: 'greyjoy', game: { ...base0, step: 'W3', houses, westeros: { ...base0.westeros, revealed: { ...base0.westeros.revealed, [card.deck]: card.id } } } }), 'Thwarted Plans');
  const set = (n) => Object.fromEntries(Object.entries(base0.houses).map(([h, x]) => [h, { ...x, obj: n[h] || 0 }]));
  assert.match(at(set({})), /Deck I: Thwarted Plans/);
  assert.match(at(set({ lannister: 1 })), /<strong>Scored in the app:<\/strong> No house has 2 or more\. Check the scored cards on the table\./);
  assert.match(at(set({ lannister: 2, tyrell: 1, greyjoy: 3 })), /<strong>Scored in the app:<\/strong> 2 or more: Lannister, Greyjoy\. Check/);
});

test('Round tab: no button in a step card only goes to the next step or opens another tab', async () => {
  const { exampleGame } = await import('../web/js/core/model.js');
  const g = exampleGame({ cards });
  const article = (html) => html.slice(html.indexOf('<article'), html.indexOf('</article>'));
  for (const s of STEPS) {
    for (const narrow of [false, true]) {
      const html = article(clean(renderRound({ ...base(narrow), house: 'greyjoy', game: { ...g, step: s.id } }), s.id));
      assert.doesNotMatch(html, /data-act="step\/next"/, `${s.id}: a Next button in the card`);
      assert.doesNotMatch(html, /href="#\//, `${s.id}: a link to another tab`);
      assert.doesNotMatch(html, /Seats on the Houses tab|Assign the Small Council seats/, s.id);
    }
  }
  const d3 = article(renderRound({ ...base(false), house: 'greyjoy', game: { ...g, step: 'D3' } }));
  assert.match(d3, /&quot;result&quot;:&quot;executed&quot;/);
  assert.doesNotMatch(d3, /&quot;result&quot;:&quot;(spared|kept)&quot;|>Spared<|Keep the hostage/);
});
