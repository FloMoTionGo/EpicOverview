// TEMPORARY test tab, shown only with ?test in the address: the Round tab's Deck step for every Westeros card,
// one below the other, to check how each card looks. Read-only (app.js ignores taps on #/test).
// To remove: delete this file, its route in app.js, TEST_TAB in ui/chrome.js and .k-testcard in app.css.
import { exampleGame } from '../core/model.js';
import { frame } from '../ui/chrome.js';
import { esc, BAR } from '../ui/kit.js';
import { deckStepCard } from './round.js';

const DECK = ['', 'I', 'II', 'III', 'IV'];

// every distinct card (deck, name, value); Winter is Coming never stays face up, so it is only a note
function distinct(cards, d) {
  const seen = new Set();
  return cards.filter((c) => c.deck === d && !c.targaryen && !c.reshuffle && !seen.has(`${c.name}|${c.value}`) && seen.add(`${c.name}|${c.value}`));
}

// The round-4 example's houses and seats, with this round's Westeros state built for one moment:
// decks before d revealed and kept, deck d face down (card null) or showing card, Master of Laws not used yet.
function moment(base, cards, d, card) {
  const g = JSON.parse(JSON.stringify(base));
  const revealed = { 1: null, 2: null, 3: null, 4: null };
  const laws = {};
  for (let k = 1; k < d; k++) { revealed[k] = distinct(cards, k)[0].id; laws[k] = 'keep'; }
  if (card) revealed[d] = card.id;
  g.councilUsed = {};
  g.westeros = { ...g.westeros, revealed, shown: card ? d : d - 1, laws, lawsUsed: null, lawsOld: null, deck4: null, peeks: {} };
  g.step = ['', 'W3', 'W4', 'W5', 'W6'][d];
  return g;
}

export function renderTest(ctx) {
  const base = exampleGame({ cards: ctx.cards });
  let n = 0;
  const one = (g, d) => {
    n += 1;
    // a fresh local UI per card: nothing here reaches the live Round tab (bid total, picks)
    return `<div class="k-testcard" style="height:452px;display:flex;flex-direction:column">${deckStepCard({ ...ctx, game: g, ui: {} }, d, `t-${n}`)}</div>`;
  };
  const groups = [1, 2, 3, 4].map((d) => {
    const list = distinct(ctx.cards, d);
    return `<section aria-labelledby="t-deck${d}" style="display:flex;flex-direction:column;gap:10px">
      <h2 id="t-deck${d}" style="margin:0;font-size:24px;font-style:italic;font-weight:400;color:#c9a24c">Deck ${DECK[d]}: face down, then ${list.length} cards</h2>
      ${one(moment(base, ctx.cards, d, null), d)}${list.map((c) => one(moment(base, ctx.cards, d, c), d)).join('')}
    </section>`;
  }).join('');
  const body = `<main class="k-main k-test" style="flex:1;min-height:0;display:flex;flex-direction:column;gap:18px;padding:14px 20px;overflow:auto">
    <p style="margin:0;padding:10px 14px;border-radius:10px;background:#2b1f16;border:1px solid #5a4330;font:500 16px ${BAR};color:#ead08a">${esc(`Temporary test page: every Westeros card on its Deck step, as the Round tab shows it (round-4 example, earlier decks kept, Master of Laws not used yet). Nothing here can be tapped. Winter is Coming is not listed: the app never leaves it face up, it shuffles the deck and draws again.`)}</p>
    ${groups}
  </main>`;
  return frame({ game: ctx.game, house: ctx.house, tab: 'test', body, noSeats: true });
}
