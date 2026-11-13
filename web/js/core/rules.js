// Pure rule helpers: no state changes here, only questions about a game.
import { HOUSE_IDS, LEVELS, BONUS, LIMITS, LOAN, ROLES, SUPPLY_POOL, houseName } from './data.js';

export const pairKey = (a, b) => (HOUSE_IDS.indexOf(a) < HOUSE_IDS.indexOf(b) ? `${a}|${b}` : `${b}|${a}`);
export const level = (g, a, b) => (a === b ? 0 : g.relations[pairKey(a, b)] || 0);
export const changedThisRound = (g, a, b) => g.changed[pairKey(a, b)] === g.round;
export const married = (g, a, b) => Boolean(g.married[pairKey(a, b)]);

export function counts(g, h, skip) {
  const c = { friendly: 0, alliances: 0, dynasty: 0 };
  for (const o of HOUSE_IDS) {
    if (o === h || o === skip) continue;
    const l = level(g, h, o);
    if (l > 0) c.friendly++;
    if (l === 2) c.alliances++;
    if (l === 3) c.dynasty++;
  }
  return c;
}

// Why a raise is not allowed, or '' when it is (EPIC p. 9–11).
export function raiseBlock(g, a, b) {
  const l = level(g, a, b);
  if (a === b) return 'A house has no relation with itself.';
  if (l >= 3) return 'Already a Dynasty, the highest level.';
  if (changedThisRound(g, a, b)) return 'Already changed this round: one step per round.';
  for (const h of [a, b]) {
    const c = counts(g, h, h === a ? b : a);
    if (l === 0 && c.friendly >= LIMITS.friendly) return `${houseName(h)} already has 3 friendly levels.`;
    if (l === 1 && c.dynasty) return `${houseName(h)} is in a Dynasty and cannot add an Alliance.`;
    if (l === 1 && c.alliances >= LIMITS.alliances) return `${houseName(h)} already has 2 Alliances.`;
    if (l === 2 && c.dynasty) return `${houseName(h)} already has a Dynasty.`;
    if (l === 2 && c.alliances) return `${houseName(h)} has another Alliance; a Dynasty allows none.`;
  }
  return '';
}

export function lowerBlock(g, a, b) {
  if (level(g, a, b) === 0) return 'Already at War.';
  if (changedThisRound(g, a, b)) return 'Already changed this round: one step per round.';
  return '';
}

export const breakBlock = (g, a, b) => (level(g, a, b) === 0 ? 'Nothing to break at War.' : '');

export function marriageBlock(g, proposer, other) {
  if (married(g, proposer, other)) return 'Already married.';
  if (!g.houses[proposer].ring) return `${houseName(proposer)}'s ring is already spent.`;
  return '';
}

// Alliances chain (EPIC p. 10): a new Alliance must also be reached with the partners' allies this phase.
export function allianceChain(g, a, b) {
  if (level(g, a, b) !== 1) return [];
  return HOUSE_IDS.filter((h) => h !== a && h !== b && (level(g, a, h) === 2 || level(g, b, h) === 2));
}

export function relationsOf(g, h) {
  return HOUSE_IDS.filter((o) => o !== h && level(g, h, o) > 0).map((o) => ({ other: o, level: level(g, h, o) }));
}

export function diplomaticBonus(g, h) {
  return relationsOf(g, h).reduce((sum, r) => sum + BONUS[r.level], 0);
}

export function levelsText(g, h) {
  const rs = relationsOf(g, h);
  if (!rs.length) return 'No friendly levels';
  const plural = ['', 'Truces', 'Alliances', 'Dynasties'];
  const by = {};
  for (const r of rs) (by[r.level] = by[r.level] || []).push(houseName(r.other));
  return [3, 2, 1].filter((l) => by[l])
    .map((l) => `${by[l].length > 1 ? plural[l] : LEVELS[l]} with ${by[l].join(' and ')}`)
    .join(', ');
}

export function hostageIncome(g, h) {
  const held = g.hostages.filter((x) => x.holder === h);
  const lost = g.hostages.filter((x) => x.owner === h);
  const parts = [];
  for (const x of held) parts.push(`holds a ${houseName(x.owner)} card`);
  for (const x of lost) parts.push(`its card is held by ${houseName(x.holder)}`);
  return { value: held.length - lost.length, text: parts.join(', ') };
}

export function councilSeat(g, h) {
  const r = ROLES.find((role) => g.council[role.id] === h);
  return r || null;
}

export function loansOf(g, h) {
  return Object.entries(g.loans.held).filter(([, holder]) => holder === h).map(([id]) => LOAN[id]);
}

export function bankLeft(g) {
  const taken = new Set(Object.keys(g.loans.held));
  return {
    gold: Object.values(LOAN).filter((l) => l.kind === 'gold' && !taken.has(l.id)),
    red: Object.values(LOAN).filter((l) => l.kind === 'red' && !taken.has(l.id))
  };
}

export const suppliesUsed = (g) => HOUSE_IDS.reduce((n, h) => n + g.houses[h].supply, 0);
export const suppliesLeft = (g) => SUPPLY_POOL - suppliesUsed(g);

// Castles that count for victory: a Red castle loan counts one less (EPIC p. 11).
export function effectiveCastles(g, h) {
  const minus = loansOf(g, h).some((l) => l.penalty === 'castle') ? 1 : 0;
  return Math.max(0, g.houses[h].castles - minus);
}

// What the app can compute of the win conditions (EPIC p. 6). Token holds and track leads are checked at the table.
export function victory(g) {
  const vp = HOUSE_IDS.map((h) => ({ h, v: g.houses[h].vp })).sort((a, b) => b.v - a.v);
  const castles = HOUSE_IDS.map((h) => ({ h, v: effectiveCastles(g, h) })).sort((a, b) => b.v - a.v);
  const winners = [];
  for (const x of vp) if (x.v >= 7) winners.push({ house: x.h, reason: '7 Victory Points' });
  for (const x of castles) if (x.v >= 7) winners.push({ house: x.h, reason: '7 Castles or Strongholds' });
  const dynasties = [];
  for (let i = 0; i < HOUSE_IDS.length; i++) {
    for (let j = i + 1; j < HOUSE_IDS.length; j++) {
      const a = HOUSE_IDS[i], b = HOUSE_IDS[j];
      if (level(g, a, b) !== 3) continue;
      const v = g.houses[a].vp + g.houses[b].vp, c = effectiveCastles(g, a) + effectiveCastles(g, b);
      const reached = v >= 10 && c >= 10;
      dynasties.push({ a, b, vp: v, castles: c, reached });
      if (reached) for (const h of [a, b]) winners.push({ house: h, reason: 'Dynasty: 10 VP and 10 castles together', dynasty: [a, b] });
    }
  }
  return { topVp: vp[0], topCastles: castles[0], winners, dynasties, lastRound: g.round >= 12 };
}

export const LEVEL_SHIELD = ['#4a3626', '#b77a3a', '#aeb6be', '#d9b44a'];
