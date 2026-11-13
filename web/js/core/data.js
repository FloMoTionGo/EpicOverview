// Fixed game data shared by the browser and the Node tests.
// Values follow the canvas "EPIC Overview layouts" and the EPIC rules (see decisions.md).

export const HOUSES = [
  { id: 'lannister', name: 'Lannister', color: '#a3262a' },
  { id: 'tyrell', name: 'Tyrell', color: '#4d7a2c' },
  { id: 'bolton', name: 'Bolton', color: '#b56a73' },
  { id: 'arryn', name: 'Arryn', color: '#5d8fc4' },
  { id: 'martell', name: 'Martell', color: '#d27a2c' },
  { id: 'greyjoy', name: 'Greyjoy', color: '#8a8d91' },
  { id: 'red', name: 'Red Targaryen', color: '#8a1520' },
  { id: 'tully', name: 'Tully', color: '#2c4f86' },
  { id: 'white', name: 'White Targaryen', color: '#d8d2c4' }
];
export const HOUSE_IDS = HOUSES.map((h) => h.id);
export const HOUSE = Object.fromEntries(HOUSES.map((h) => [h.id, h]));
export const houseName = (id) => (HOUSE[id] ? HOUSE[id].name : id);
export const sigil = (id) => `assets/sigils/${id}.webp`;

export const ROLES = [
  { id: 'hand', name: 'Hand of the King', short: 'Hand', card: 'Hand of the King' },
  { id: 'kingsguard', name: 'Lord Commander of the Kingsguard', short: 'Kingsguard', card: 'Kingsguard', once: true },
  { id: 'coin', name: 'Master of Coin', short: 'Coin', card: 'Master of Coin' },
  { id: 'laws', name: 'Master of Laws', short: 'Laws', card: 'Master of Laws', once: true },
  { id: 'whispers', name: 'Master of Whispers', short: 'Whispers', card: 'Master of Whispers', once: true },
  { id: 'ships', name: 'Master of Ships', short: 'Ships', card: 'Master of Ships', once: true },
  { id: 'maester', name: 'Grand Maester', short: 'Maester', card: 'Grand Maester', once: true }
];
export const ROLE = Object.fromEntries(ROLES.map((r) => [r.id, r]));

// The three dominance tokens: the app records only who holds each (Houses tab), not the track order.
export const TRACKS = [
  { id: 'throne', name: 'Iron Throne', track: 'Throne track' },
  { id: 'blade', name: 'Valyrian Steel Blade', track: 'Fiefdoms track' },
  { id: 'raven', name: 'Messenger Raven', track: "King's Court track" }
];
export const TRACK = Object.fromEntries(TRACKS.map((t) => [t.id, t]));

export const LEVELS = ['War', 'Truce', 'Alliance', 'Dynasty'];
export const BONUS = [0, 1, 3, 5];          // Power per level, EPIC p. 9
export const BREAK_COST = [0, 3, 5, 8];     // Power or Supply steps, EPIC p. 10
export const LIMITS = { friendly: 3, alliances: 2, dynasty: 1 };

// Loans, EPIC p. 11. Red loan penalties as printed on the five red cards (canvas Loans board).
export const LOAN_CARDS = [
  { id: 'gold-1', kind: 'gold' }, { id: 'gold-2', kind: 'gold' }, { id: 'gold-3', kind: 'gold' },
  { id: 'gold-4', kind: 'gold' }, { id: 'gold-5', kind: 'gold' },
  { id: 'red-1', kind: 'red', penalty: 'vp', label: 'Red: −1 VP', long: '1 Victory Point less' },
  { id: 'red-2', kind: 'red', penalty: 'castle', label: 'Red: −1 castle', long: 'counts one castle less' },
  { id: 'red-3', kind: 'red', penalty: 'throne', label: 'Red: Throne 8th', long: 'counts as 8th on the Iron Throne' },
  { id: 'red-4', kind: 'red', penalty: 'fiefdoms', label: 'Red: Fiefdoms 8th', long: 'counts as 8th on Fiefdoms' },
  { id: 'red-5', kind: 'red', penalty: 'court', label: "Red: Court 8th", long: "counts as 8th on King's Court" }
];
export const LOAN = Object.fromEntries(LOAN_CARDS.map((l) => [l.id, l]));
export const LOAN_CONDITIONS = ['Home and 3 more castles', "King's Landing", 'Iron Throne', 'Valyrian Steel Blade', 'Messenger Raven'];
export const loanImage = (id) => (id.startsWith('gold') ? 'assets/icons/loan-gold.webp' : `assets/icons/loan-${id}.webp`);

// Limited stock, EPIC p. 14 and the canvas Market board.
export const STOCK = [
  { id: 'port', name: 'Port', group: 'build', cost: '2 Gold', total: 3, token: 'assets/icons/token-port.webp' },
  { id: 'fortification', name: 'Fortification', group: 'build', cost: '2 Gold, or free with Consolidate', total: 6, token: 'assets/icons/token-fortification.webp' },
  { id: 'stronghold', name: 'Stronghold upgrade', group: 'build', cost: '3 Gold', total: 4, token: 'assets/icons/token-stronghold.webp' },
  { id: 'bridge', name: 'Bridge', group: 'build', cost: '4 Gold', total: 2, token: 'assets/icons/token-bridge.webp' },
  { id: 'footmen', name: 'Mercenary footmen', group: 'merc', cost: '2 Gold', total: 12 },
  { id: 'knights', name: 'Mercenary knights', group: 'merc', cost: '3 Gold', total: 6 },
  { id: 'ships', name: 'Mercenary ships', group: 'merc', cost: '2 Gold', total: 6 },
  { id: 'siege', name: 'Siege engines', group: 'merc', cost: '3 Gold', total: 3 },
  { id: 'disks', name: 'Upgrade disks', group: 'merc', cost: 'with a unit', total: 6 },
  { id: 'merccards', name: 'Mercenary cards', group: 'merc', cost: '4 Gold: draw 2, keep 1', total: 14 },
  { id: 'support', name: 'Support −1 token', group: 'merc', cost: 'from Tactic cards', total: 1 }
];
export const STOCK_ITEM = Object.fromEntries(STOCK.map((s) => [s.id, s]));
export const SUPPLY_POOL = 27;
export const SUPPLY_MAX = 3;
export const HOLDING_CELLS = 2;

export const ORDER_TYPES = ['Raid', 'March', 'Support', 'Defense', 'Consolidate Power'];
export const ROUNDS = 12;
