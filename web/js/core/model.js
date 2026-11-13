// Building a game: a new game, and the round-4 example that the canvas boards show.
import { HOUSE_IDS, ROLES, STOCK } from './data.js';
import { buildDecks, rngNext } from './westeros.js';

export const SCHEMA = 1;

// Dowry card per house (EPIC dowry cards belong to the original houses; see decisions.md).
export const DOWRY = {
  lannister: 'Masters of Intrigue',
  tyrell: 'Fruits of the Reach',
  bolton: 'The North Remembers',
  arryn: 'Knights of the Vale',
  martell: 'Unbowed, Unbent, Unbroken',
  greyjoy: 'The Old Ways',
  tully: 'Lords of the Rivers',
  white: 'Claim to the Throne',
  red: 'Blood of Kings'
};

function blankHouse() {
  return { castles: 1, vp: 0, obj: 0, supply: 0, ring: true };
}

export function newGame({ cards = [], seed = 20261112 } = {}) {
  const rng = { seed };
  const g = {
    schema: SCHEMA,
    round: 1,
    step: 'P1',
    houses: Object.fromEntries(HOUSE_IDS.map((h) => [h, blankHouse()])),
    council: Object.fromEntries(ROLES.map((r) => [r.id, null])),
    councilUsed: {},
    relations: {},
    changed: {},
    married: {},
    dowries: Object.fromEntries(HOUSE_IDS.map((h) => [h, null])),
    hostages: [],
    loans: { held: {} },
    stock: Object.fromEntries(STOCK.map((s) => [s.id, { left: s.total, by: [] }])),
    westeros: buildDecks(cards, rng),
    records: {},
    bannedOrder: null,
    winner: null,
    seed: rng.seed,
    nextId: 1
  };
  rngNext(rng);
  g.seed = rng.seed;
  return g;
}

// The state behind the canvas boards: round 4, Diplomacy step 6 (New loans), playing as Greyjoy.
export function exampleGame({ cards = [], seed = 4 } = {}) {
  const g = newGame({ cards, seed });
  g.round = 4;
  g.step = 'D6';
  const seats = {
    lannister: [5, 3, 2, 1, false], tyrell: [4, 2, 1, 2, true], bolton: [4, 1, 1, 0, false],
    arryn: [3, 2, 1, 3, true], martell: [3, 1, 1, 1, true], greyjoy: [4, 1, 2, 0, true],
    red: [2, 1, 1, 1, false], tully: [3, 0, 0, 0, true], white: [2, 1, 1, 2, true]
  };
  for (const [h, [castles, vp, obj, supply, ring]] of Object.entries(seats)) g.houses[h] = { castles, vp, obj, supply, ring };
  g.council = { hand: 'lannister', kingsguard: 'tyrell', coin: 'martell', laws: 'bolton', whispers: 'red', ships: 'greyjoy', maester: 'arryn' };
  g.councilUsed = { laws: true, whispers: true };
  g.relations = {
    'lannister|tyrell': 3, 'bolton|arryn': 2, 'bolton|tully': 2, 'arryn|tully': 2,
    'martell|red': 1, 'tyrell|martell': 1, 'greyjoy|white': 1
  };
  g.changed = { 'bolton|tully': 4, 'arryn|tully': 4, 'tyrell|martell': 4, 'martell|greyjoy': 4 };
  g.married = { 'lannister|tyrell': 2, 'bolton|arryn': 3 };
  g.dowries = { lannister: 'tyrell', tyrell: 'lannister', bolton: 'arryn', arryn: 'bolton', martell: null, greyjoy: null, red: null, tully: null, white: null };
  g.hostages = [
    { id: 'h1', holder: 'greyjoy', owner: 'tully', strength: 2 },
    { id: 'h2', holder: 'red', owner: 'white', strength: 3 }
  ];
  g.loans = { held: { 'gold-1': 'lannister', 'red-1': 'greyjoy', 'red-4': 'white' } };
  const left = { port: 1, fortification: 4, stronghold: 3, bridge: 1, footmen: 9, knights: 5, ships: 6, siege: 3, disks: 6, merccards: 12, support: 1 };
  const by = { port: ['greyjoy', 'tyrell'], fortification: ['bolton', 'martell'], stronghold: ['lannister'], bridge: ['tully'] };
  for (const s of STOCK) g.stock[s.id] = { left: left[s.id], by: by[s.id] || [] };
  g.records = { D6: { lannister: 'gold', tyrell: 'pass', bolton: 'pass' }, D5: { lannister: 'gold' } };
  // This round's Westeros cards as on the canvas: Thwarted Plans replaced by Shifting Ambitions (Master of Laws).
  const pick = (deck, name, value) => cards.find((c) => c.deck === deck && c.name === name && (value === undefined || c.value === value));
  const shown = [pick(1, 'Shifting Ambitions', 2), pick(2, 'Mustering Troops', 1), pick(3, 'Clash of Kings', 2), pick(4, 'Bands of Outlaws')];
  const thwarted = pick(1, 'Thwarted Plans');
  if (shown.every(Boolean) && thwarted) {
    const w = g.westeros;
    shown.forEach((c, i) => {
      const d = i + 1;
      w.decks[d].draw = w.decks[d].draw.filter((id) => id !== c.id && id !== thwarted.id);
      w.revealed[d] = c.id;
    });
    w.decks[1].discard.push(thwarted.id);
    Object.assign(w, { shown: 4, laws: { 1: 'replace' }, lawsUsed: 1, lawsOld: thwarted.id, deck4: 'won' });
  }
  return g;
}
