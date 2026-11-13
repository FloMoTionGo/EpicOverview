// Compares the words on each Round step with its canvas board (canvas/live/*.dc.html).
// usage: node tools/compare_boards.mjs [STEP ...]
// Prints, per step, the words the board has and the app lacks (−) and the other way round (+).
// The boards show one fixed state, so names and numbers can differ on purpose; read the list, don't chase zero.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { exampleGame } from '../web/js/core/model.js';
import { renderRound } from '../web/js/views/round.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cards = JSON.parse(readFileSync(join(root, 'web/data/westeros.json'), 'utf8')).cards;
const cardById = Object.fromEntries(cards.map((c) => [c.id, c]));

const BOARD = {
  // W2 (reveal) and D4 (levels and marriages) left the round; their boards Round-W2 and Round-D5 have no step now
  W1: 'Round-W1', W3: 'Round-W4', W4: 'Round-W5', W5: 'Round-W6', W6: 'Round-W7', W7: 'Round-W8',
  D1: 'Round-D1', D2: 'Round-D2', D3: 'Round-D4', D5: 'Round-D6', D6: 'Round-D7',
  P1: 'Round-P1', P2: 'Round-P2', P3: 'Round-P3', P4: 'Round-P4', P5: 'Round-P5',
  A1: 'Round-A1', A2: 'Round-MarchToBattle', A3: 'Round-A3', A4: 'Round-A4', A5: 'Round-A5', A6: 'Round-A6',
  E1: 'Round-E1', E2: 'Round-E2'
};

function article(html) {
  const a = html.indexOf('<article');
  const b = html.indexOf('</article>', a);
  return a < 0 ? '' : html.slice(a, b);
}
function words(html) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/\{\{[^}]*\}\}/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#39;|&rsquo;|’/g, "'");
  return text.split(/[\s.,:;()…!?"]+/).filter((w) => w && w.length > 1).map((w) => w.toLowerCase());
}
function bag(list) {
  const m = new Map();
  for (const w of list) m.set(w, (m.get(w) || 0) + 1);
  return m;
}
function diff(a, b) {
  const out = [];
  for (const [w, n] of a) { const k = n - (b.get(w) || 0); if (k > 0) out.push(k > 1 ? `${w}×${k}` : w); }
  return out;
}

// tab boards: compare the <main> (or the whole page for the phone boards)
import { renderHouses } from '../web/js/views/houses.js';
import { renderRelations } from '../web/js/views/relations.js';
import { renderWesteros } from '../web/js/views/westeros.js';
import { renderLoans, renderMarket, renderChoose } from '../web/js/views/other.js';
const TAB = {
  houses: ['Houses', renderHouses], relations: ['Relations', renderRelations], westeros: ['Westeros', renderWesteros],
  loans: ['Loans', renderLoans], market: ['Market', renderMarket], choose: ['Choose-House', renderChoose],
  'phone-relations': ['A-Phone', renderRelations, true], 'phone-choose': ['Phone-Choose', renderChoose, true]
};
const mainOf = (html) => { const a = html.indexOf('<main'); const b = html.indexOf('</main>', a); return a < 0 ? html : html.slice(a, b); };
const args = process.argv.slice(2);
if (args[0] === '--tabs') {
  for (const [id, [file, fn, narrow]] of Object.entries(TAB)) {
    const g = exampleGame({ cards });
    const ctx = { game: g, log: [], house: 'greyjoy', ui: {}, cards, cardById, narrow: Boolean(narrow) };
    const board = readFileSync(join(root, 'canvas/live', file + '.dc.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
    const A = bag(words(narrow ? fn(ctx) : mainOf(fn(ctx)))); const B = bag(words(narrow ? board : mainOf(board)));
    console.log(`\n== ${id} (${file})`);
    console.log('  − board only:', diff(B, A).join(' ') || '(none)');
    console.log('  + app only:  ', diff(A, B).join(' ') || '(none)');
  }
  process.exit(0);
}
const showText = args.includes('--text');
const steps = args.filter((a) => a !== '--text').length ? args.filter((a) => a !== '--text') : Object.keys(BOARD);
const plain = (html) => html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' | ').replace(/(\s*\|\s*)+/g, ' | ').replace(/&amp;/g, '&');
for (const id of steps) {
  const g = exampleGame({ cards });
  g.step = id;
  const ctx = { game: g, log: [], house: 'greyjoy', ui: {}, cards, cardById, narrow: false };
  const app = words(article(renderRound(ctx)));
  const board = words(article(readFileSync(join(root, 'canvas/live', BOARD[id] + '.dc.html'), 'utf8')));
  const A = bag(app); const B = bag(board);
  console.log(`\n== ${id} (${BOARD[id]})`);
  if (showText) {
    console.log('  BOARD:', plain(article(readFileSync(join(root, 'canvas/live', BOARD[id] + '.dc.html'), 'utf8'))));
    console.log('  APP:  ', plain(article(renderRound(ctx))));
    continue;
  }
  console.log('  − board only:', diff(B, A).join(' ') || '(none)');
  console.log('  + app only:  ', diff(A, B).join(' ') || '(none)');
}
