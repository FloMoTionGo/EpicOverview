// Gathering, game start and replay helpers:  node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newGame, exampleGame } from '../web/js/core/model.js';
import { reduce, RuleError } from '../web/js/core/reducer.js';
import { logAt, roundStarts, nextRoundIndex, prevRoundIndex, roundSummary, frameLabel } from '../web/js/core/replay.js';

const cards = JSON.parse(readFileSync(new URL('../web/data/westeros.json', import.meta.url), 'utf8')).cards;
const ctx = { cards, house: 'greyjoy' };

// A history the way the server stores it: one frame per version.
function play(game, actions) {
  const frames = [{ v: 1, t: 't1', e: { summary: 'New game', kind: 'game' }, g: game }];
  let g = game;
  for (const a of actions) {
    if (a === 'undo') {
      // the server restores the version before the newest change
      g = frames[frames.length - 2].g;
      frames.push({ v: frames.length + 1, t: 't', e: { summary: 'Undone', kind: 'undo' }, g });
      continue;
    }
    const r = reduce(g, a, ctx);
    g = r.game;
    frames.push({ v: frames.length + 1, t: 't', e: r.entry, g });
  }
  return frames;
}

test('a new game gathers first; the example is already playing', () => {
  assert.equal(newGame({ cards }).phase, 'gathering');
  assert.deepEqual(newGame({ cards }).joined, {});
  assert.equal(exampleGame({ cards }).phase, 'playing');
});

test('devices join with their house, can switch, and anyone starts the game once', () => {
  let g = newGame({ cards });
  const join = (device, house) => { const r = reduce(g, { type: 'gather/join', device, house }, ctx); g = r.game; return r.entry; };
  assert.equal(join('d1', 'greyjoy').summary, 'Greyjoy joined the table.');
  assert.equal(join('d2', 'greyjoy').summary, 'Greyjoy joined the table (2 devices).');
  assert.equal(join('d2', 'tully').summary, 'Greyjoy switched to Tully.');
  assert.deepEqual(g.joined, { d1: 'greyjoy', d2: 'tully' });
  assert.throws(() => reduce(g, { type: 'gather/join', device: 'd3', house: 'stark' }, ctx), RuleError);
  assert.throws(() => reduce(g, { type: 'gather/join', house: 'tully' }, ctx), RuleError);
  const r = reduce(g, { type: 'game/start' }, ctx);
  assert.equal(r.game.phase, 'playing');
  assert.equal(r.entry.summary, 'The game starts: round 1, Planning. 2 of 9 houses at the table.');
  assert.deepEqual(r.entry.houses, ['greyjoy', 'tully']);
  assert.equal(r.game.round, 1);
  assert.equal(r.game.step, 'P1');
  assert.throws(() => reduce(r.game, { type: 'game/start' }, ctx), /already started/);
  assert.throws(() => reduce(r.game, { type: 'gather/join', device: 'd9', house: 'arryn' }, ctx), /already started/);
});

test('round starts, jumps and the Log at a frame (with undo)', () => {
  const frames = play(newGame({ cards }), [
    { type: 'gather/join', device: 'd1', house: 'lannister' },
    { type: 'game/start' },
    { type: 'step/next' }, { type: 'step/next' }, { type: 'step/next' }, { type: 'step/next' },   // P2..P5
    { type: 'step/next' }, { type: 'step/next' },                                                // A1, A2
    'undo',
    { type: 'step/next' }, { type: 'step/next' }, { type: 'step/next' }, { type: 'step/next' },   // A2..A5
    { type: 'step/next' }, { type: 'step/next' }, { type: 'step/next' },                          // A6, E1, E2
    { type: 'step/next' }                                                                         // round 2, W1
  ]);
  const starts = roundStarts(frames);
  assert.deepEqual(starts.map((s) => s.round), [1, 2]);
  assert.equal(frames[starts[0].index].e.kind, 'game');            // round 1 starts with Start the game
  assert.equal(frames[starts[1].index].g.step, 'W1');
  assert.equal(nextRoundIndex(frames, 0), starts[0].index);
  assert.equal(nextRoundIndex(frames, starts[1].index), frames.length - 1);
  assert.equal(prevRoundIndex(frames, starts[1].index + 0), starts[0].index);
  assert.equal(prevRoundIndex(frames, starts[0].index + 3), starts[0].index);
  assert.equal(prevRoundIndex(frames, 1), 0);
  const undoAt = frames.findIndex((f) => f.e && f.e.kind === 'undo');
  const log = logAt(frames, undoAt);
  assert.equal(log.length, undoAt + 1);
  assert.equal(log[undoAt - 1].undone, true);                      // the step the undo took back
  assert.equal(log.filter((e) => e.undone).length, 1);
  assert.equal(frameLabel(frames[0]), 'Gathering at the table');
  assert.equal(frameLabel(frames[starts[1].index]), 'Round 2 · Westeros 1');
});

test('two undos in a row take back two different changes in the replayed Log', () => {
  const frames = [
    { v: 1, t: 't1', e: { summary: 'A', kind: 'step' }, g: {} },
    { v: 2, t: 't2', e: { summary: 'B', kind: 'step' }, g: {} },
    { v: 3, t: 't3', e: { summary: 'C', kind: 'step' }, g: {} },
    { v: 4, t: 't4', e: { summary: 'Undone: C', kind: 'undo' }, g: {} },
    { v: 5, t: 't5', e: { summary: 'Undone: B', kind: 'undo' }, g: {} }
  ];
  const log = logAt(frames, 4);
  assert.deepEqual(log.map((e) => [e.summary, Boolean(e.undone)]),
    [['A', false], ['B', true], ['C', true], ['Undone: C', false], ['Undone: B', false]]);
  assert.equal(log[1].undoneAt, 't5');
  assert.equal(logAt(frames, 3)[1].undone, undefined);              // at frame 3 only C is undone
});

test('round summary: VP and castles at the end of every round', () => {
  const g0 = newGame({ cards });
  const frames = play(g0, [
    { type: 'game/start' },
    { type: 'objective/score', house: 'tyrell', vp: 2 },
    ...Array(13).fill({ type: 'step/next' }),                        // to round 2, W1
    { type: 'objective/score', house: 'tyrell', vp: 1 },
    { type: 'house/adjust', house: 'martell', field: 'castles', delta: 2 }
  ]);
  const rows = roundSummary(frames);
  assert.deepEqual(rows.map((r) => r.round), [1, 2]);
  assert.equal(rows[0].houses.tyrell.vp, 2);
  assert.equal(rows[1].houses.tyrell.vp, 3);
  assert.equal(rows[1].final, true);
  assert.equal(rows[0].houses.martell.castles, 1);
  assert.equal(rows[1].houses.martell.castles, 3);
  assert.equal(frames[rows[0].index].g.round, 1);
  assert.equal(frames[rows[0].index + 1].g.round, 2);
});
