// Load the round 4 canvas example into a running server:  node tools/load_example.mjs [port] [step]
import { readFileSync } from 'node:fs';
import { exampleGame } from '../web/js/core/model.js';
const port = process.argv[2] || 8765;
const cards = JSON.parse(readFileSync(new URL('../web/data/westeros.json', import.meta.url), 'utf8')).cards;
const base = `http://127.0.0.1:${port}/api`;
const state = await (await fetch(`${base}/state`)).json();
const game = exampleGame({ cards });
if (process.argv[3]) game.step = process.argv[3];
const r = await fetch(`${base}/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ baseVersion: state.version, state: game, entry: { summary: 'Loaded the round 4 example from the canvas.', kind: 'game', round: game.round, step: game.step, houses: [] } }) });
console.log(r.status, await r.text());
