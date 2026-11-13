// The four Westeros decks, run by the app. Deck order lives in the state; it is never shown outside a peek.

// mulberry32: small seeded PRNG so a shuffle is reproducible from the seed in the state.
export function rngNext(rng) {
  let t = (rng.seed = (rng.seed + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function shuffle(list, rng) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rngNext(rng) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildDecks(cards, rng) {
  const decks = {};
  for (const d of [1, 2, 3, 4]) {
    const ids = cards.filter((c) => c.deck === d && !c.targaryen).map((c) => c.id);
    decks[d] = { draw: shuffle(ids, rng), discard: [] };
  }
  return { decks, revealed: { 1: null, 2: null, 3: null, 4: null }, shown: 0, laws: {}, lawsUsed: null, lawsOld: null, deck4: null, peeks: {}, chosen: [], trackBid: false };
}

// Draw the top card of a deck; an empty draw pile is refilled from its shuffled discards first.
export function draw(w, d, rng) {
  const deck = w.decks[d];
  if (!deck.draw.length) {
    deck.draw = shuffle(deck.discard, rng);
    deck.discard = [];
  }
  return deck.draw.shift() || null;
}

export function cardValue(card) {
  return card && typeof card.value === 'number' ? card.value : 0;
}

const DECK = ['', 'I', 'II', 'III', 'IV'];

// Was there a bid on the influence tracks this round? Clash of Kings on deck III, or Dark Wings, Dark Words with
// Clash of Kings chosen by the Raven holder. Then the Small Council swap step is left out (EPIC p. 8).
export function bidOnTracks(w, cards = []) {
  const c = cards.find((x) => x.id === w.revealed[3]);
  const name = c ? c.name : '';
  return name === 'Clash of Kings' || (name === 'Dark Wings, Dark Words' && (w.chosen || []).includes('Clash of Kings'));
}

// Master of Laws still has to decide on the card just revealed (decks I to III, once per round).
export function lawsPending(g) {
  const w = g.westeros;
  return Boolean(g.council.laws) && w.lawsUsed === null && w.shown >= 1 && w.shown <= 3 && !w.laws[w.shown];
}

// Why deck d can't be revealed now, or '' if it can: decks go I to IV, and Master of Laws decides on each of I–III first.
export function revealBlock(g, d) {
  const w = g.westeros;
  if (d <= w.shown) return `Deck ${DECK[d]} is already revealed.`;
  if (d > w.shown + 1) return `Reveal deck ${DECK[w.shown + 1]} first.`;
  if (lawsPending(g)) return `Master of Laws decides on deck ${DECK[w.shown]} first.`;
  return '';
}
