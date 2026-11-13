// reduce(game, action, ctx) -> { game, entry }. Pure: the input game is never changed.
// ctx = { house, cards } — the house this device plays and the Westeros card list (for names and values).
// Every action produces one log entry { summary, kind, houses }.
import { HOUSE_IDS, ROLE, ROLES, TRACK, LEVELS, BREAK_COST, LOAN, STOCK_ITEM, SUPPLY_MAX, HOLDING_CELLS, houseName } from './data.js';
import { pairKey, level, raiseBlock, lowerBlock, breakBlock, marriageBlock } from './rules.js';
import { draw, shuffle, revealBlock, bidOnTracks } from './westeros.js';
import { upgradeGame } from './model.js';
import { STEP_IDS, stepById, nextStepId, prevStepId } from './steps.js';

export class RuleError extends Error {}
const fail = (msg) => { throw new RuleError(msg); };
const clone = (x) => JSON.parse(JSON.stringify(x));
const entry = (summary, kind, houses = []) => ({ summary, kind, houses });
const isHouse = (h) => HOUSE_IDS.includes(h) || fail(`Unknown house: ${h}`);
const cardName = (ctx, id) => {
  const c = (ctx.cards || []).find((x) => x.id === id);
  return c ? c.name : id;
};
const DECK = ['', 'I', 'II', 'III', 'IV'];
const FIELD = { castles: 'castles', vp: 'Victory Points', obj: 'objectives', supply: 'Supply tokens' };

function rng(g) {
  return { get seed() { return g.seed; }, set seed(v) { g.seed = v; } };
}

// Draw the next card of deck d. Winter is Coming shuffles that deck (its discards included) and draws again;
// notes collects what happened for the Log line.
function drawCard(g, d, ctx, notes) {
  const w = g.westeros;
  let id = draw(w, d, rng(g));
  for (let guard = 0; id && guard < 10; guard++) {
    const card = (ctx.cards || []).find((c) => c.id === id);
    if (!card || !card.reshuffle) break;
    notes.push(`${card.name} shuffled deck ${DECK[d]}`);
    w.decks[d].discard.push(id);
    w.decks[d].draw = shuffle(w.decks[d].draw.concat(w.decks[d].discard), rng(g));
    w.decks[d].discard = [];
    id = draw(w, d, rng(g));
  }
  return id;
}

function startRound(g, ctx) {
  // Revealed Westeros cards go to their discard piles; per-round flags reset.
  const w = g.westeros;
  for (const d of [1, 2, 3, 4]) {
    if (w.revealed[d]) w.decks[d].discard.push(w.revealed[d]);
    w.revealed[d] = null;
  }
  Object.assign(w, { shown: 0, laws: {}, lawsUsed: null, lawsOld: null, deck4: null, peeks: {}, chosen: [], trackBid: false });
  g.councilUsed = {};
  g.records = {};
  g.bannedOrder = null;
}

// After deck III changes or the Raven holder chooses: the Dark Wings choices belong to that card only, and the
// bid flag follows (bidOnTracks in westeros.js).
const DARK_WINGS = 'Dark Wings, Dark Words';
const DARK_WINGS_EVENTS = ['Clash of Kings', 'Secret Conspiracies', 'Storm in the Skies'];
function refreshBid(g, ctx) {
  const w = g.westeros;
  if (cardName(ctx, w.revealed[3]) !== DARK_WINGS) w.chosen = [];
  w.trackBid = bidOnTracks(w, ctx.cards);
}

// Alliance or Dynasty partners can't hold each other's hostages: the cards go back for free (EPIC p. 9).
function returnHostages(g, a, b) {
  if (level(g, a, b) < 2) return '';
  const back = g.hostages.filter((x) => (x.holder === a && x.owner === b) || (x.holder === b && x.owner === a));
  if (!back.length) return '';
  g.hostages = g.hostages.filter((x) => !back.includes(x));
  return ` ${back.map((x) => `${houseName(x.holder)} gives the ${houseName(x.owner)} card back`).join('; ')} for free.`;
}

const handlers = {
  // ---- before the game: devices gather and pick their houses
  'gather/join'(g, a) {
    if (g.phase !== 'gathering') fail('The game has already started.');
    isHouse(a.house);
    if (typeof a.device !== 'string' || !a.device) fail('This device has no id.');
    const before = (g.joined || {})[a.device];
    g.joined = { ...(g.joined || {}), [a.device]: a.house };
    const n = Object.values(g.joined).filter((h) => h === a.house).length;
    const what = before && before !== a.house ? `${houseName(before)} switched to ${houseName(a.house)}` : `${houseName(a.house)} joined the table`;
    return entry(`${what}${n > 1 ? ` (${n} devices)` : ''}.`, 'gather', [a.house]);
  },
  'game/start'(g) {
    if (g.phase !== 'gathering') fail('The game has already started.');
    g.phase = 'playing';
    const houses = HOUSE_IDS.filter((h) => Object.values(g.joined || {}).includes(h));
    return entry(`The game starts: round 1, Planning. ${houses.length} of ${HOUSE_IDS.length} houses at the table.`, 'game', houses);
  },
  'step/goto'(g, a) {
    stepById(a.step) || fail(`Unknown step: ${a.step}`);
    g.step = stepById(a.step).id;
    return entry(`Went to ${stepById(a.step).label}: ${stepById(a.step).title}.`, 'step');
  },
  'step/next'(g, a, ctx) {
    const next = nextStepId(g.step, g.round, g);
    if (next.newRound) {
      if (g.round >= 12) fail('Round 12 is the last round.');
      g.round += 1;
      startRound(g, ctx);
    }
    g.step = next.id;
    const s = stepById(next.id);
    return entry(next.newRound ? `Round ${g.round} starts: ${s.label}, ${s.title}.` : `Next step: ${s.label}, ${s.title}.`, 'step');
  },
  'step/prev'(g) {
    const prev = prevStepId(g.step, g.round, g);
    if (!prev) fail('This is the first step of the round.');
    g.step = prev;
    const s = stepById(prev);
    return entry(`Back to ${s.label}, ${s.title}.`, 'step');
  },

  'house/adjust'(g, a) {
    isHouse(a.house);
    FIELD[a.field] || fail(`Unknown field: ${a.field}`);
    const h = g.houses[a.house];
    const before = h[a.field];
    let after = before + a.delta;
    if (after < 0) fail(`${FIELD[a.field]} cannot go below 0.`);
    if (a.field === 'supply' && after > SUPPLY_MAX) fail(`At most ${SUPPLY_MAX} Supply tokens; any extra is lost.`);
    h[a.field] = after;
    return entry(`${houseName(a.house)} ${FIELD[a.field]} ${before} → ${after}.`, 'houses', [a.house]);
  },

  'council/assign'(g, a) {
    const role = ROLE[a.role] || fail(`Unknown seat: ${a.role}`);
    if (a.house !== null) isHouse(a.house);
    const old = g.council[a.role];
    const other = ROLES.find((r) => r.id !== a.role && g.council[r.id] === a.house && a.house !== null);
    if (other) g.council[other.id] = old;
    g.council[a.role] = a.house;
    let s = `${role.name}: ${a.house ? houseName(a.house) : 'nobody'}`;
    if (other) s += old ? ` (swapped with ${houseName(old)}, now ${other.name})` : ` (left ${other.name})`;
    if (a.role === 'hand' && a.house && a.house !== old) s += '. Takes 2 Power at the table';
    return entry(s + '.', 'houses', [a.house, old].filter(Boolean));
  },
  // Houses tab, Tracks: who holds a dominance token. One house may hold several; nobody is allowed.
  'track/assign'(g, a) {
    const t = TRACK[a.track] || fail(`Unknown track: ${a.track}`);
    if (a.house !== null) isHouse(a.house);
    g.tracks = { throne: null, blade: null, raven: null, ...(g.tracks || {}) };
    const old = g.tracks[a.track];
    if (old === a.house) fail(`${a.house ? houseName(a.house) : 'Nobody'} already holds the ${t.name}.`);
    g.tracks[a.track] = a.house;
    // Log: "Iron Throne: Lannister (was Tyrell)."
    return entry(`${t.name}: ${a.house ? houseName(a.house) : 'nobody'}${old ? ` (was ${houseName(old)})` : ''}.`, 'houses', [a.house, old].filter(Boolean));
  },
  'council/use'(g, a) {
    const role = ROLE[a.role] || fail(`Unknown seat: ${a.role}`);
    if (g.councilUsed[a.role]) fail(`${role.name} was already used this round.`);
    g.councilUsed[a.role] = true;
    return entry(`${role.name} (${houseName(g.council[a.role])}) used: ${a.note || 'done'}.`, 'houses', [g.council[a.role]].filter(Boolean));
  },

  'relation/raise'(g, a) {
    isHouse(a.a); isHouse(a.b);
    const why = raiseBlock(g, a.a, a.b);
    if (why) fail(why);
    const k = pairKey(a.a, a.b);
    g.relations[k] = level(g, a.a, a.b) + 1;
    g.changed[k] = g.round;
    return entry(`${houseName(a.a)} and ${houseName(a.b)} raised to ${LEVELS[g.relations[k]]}.${returnHostages(g, a.a, a.b)}`, 'relations', [a.a, a.b]);
  },
  'relation/lower'(g, a) {
    isHouse(a.a); isHouse(a.b);
    const why = lowerBlock(g, a.a, a.b);
    if (why) fail(why);
    const k = pairKey(a.a, a.b);
    const l = level(g, a.a, a.b) - 1;
    if (l) g.relations[k] = l; else delete g.relations[k];
    g.changed[k] = g.round;
    return entry(`${houseName(a.a)} and ${houseName(a.b)} lowered to ${LEVELS[l]}.`, 'relations', [a.a, a.b]);
  },
  'relation/break'(g, a) {
    isHouse(a.a); isHouse(a.b); isHouse(a.breaker);
    const why = breakBlock(g, a.a, a.b);
    if (why) fail(why);
    const l = level(g, a.a, a.b);
    const k = pairKey(a.a, a.b);
    delete g.relations[k];
    g.changed[k] = g.round;
    const victim = a.breaker === a.a ? a.b : a.a;
    return entry(`${houseName(a.breaker)} broke the ${LEVELS[l]} with ${houseName(victim)}. ${houseName(a.breaker)} pays ${BREAK_COST[l]}.`, 'relations', [a.breaker, victim]);
  },
  'marriage/set'(g, a) {
    isHouse(a.proposer); isHouse(a.other);
    const why = marriageBlock(g, a.proposer, a.other);
    if (why) fail(why);
    const k = pairKey(a.proposer, a.other);
    g.houses[a.proposer].ring = false;
    g.married[k] = g.round;
    let s = `${houseName(a.proposer)} and ${houseName(a.other)} married`;
    if (!raiseBlock(g, a.proposer, a.other)) {
      g.relations[k] = level(g, a.proposer, a.other) + 1;
      g.changed[k] = g.round;
      s += `, now ${LEVELS[g.relations[k]]}`;
      const back = returnHostages(g, a.proposer, a.other);
      if (back) s += ';' + back.slice(0, -1);
    } else {
      s += ', level unchanged';
    }
    const swapped = [];
    if (g.dowries[a.proposer] === null) { g.dowries[a.proposer] = a.other; swapped.push(houseName(a.proposer)); }
    if (g.dowries[a.other] === null) { g.dowries[a.other] = a.proposer; swapped.push(houseName(a.other)); }
    if (swapped.length) s += `; dowry of ${swapped.join(' and ')} handed over`;
    return entry(s + '.', 'relations', [a.proposer, a.other]);
  },
  'ring/use'(g, a) {
    isHouse(a.house);
    if (!g.houses[a.house].ring) fail(`${houseName(a.house)}'s ring is already spent.`);
    g.houses[a.house].ring = false;
    return entry(`${houseName(a.house)} proposed a marriage; it was declined. The ring is spent.`, 'relations', [a.house]);
  },

  'hostage/add'(g, a) {
    isHouse(a.holder); isHouse(a.owner);
    if (a.holder === a.owner) fail('A house cannot hold its own card.');
    if (level(g, a.holder, a.owner) >= 2) fail('Alliance or Dynasty partners cannot hold each other\'s hostages: the card goes back for free.');
    const held = g.hostages.filter((x) => x.holder === a.holder).length;
    if (held >= HOLDING_CELLS) fail(`${houseName(a.holder)}'s holding cells are full: release or execute a hostage first.`);
    g.hostages.push({ id: `h${g.nextId++}`, holder: a.holder, owner: a.owner, strength: a.strength ?? null });
    return entry(`${houseName(a.holder)} took a ${houseName(a.owner)} House card hostage.`, 'relations', [a.holder, a.owner]);
  },
  'hostage/release'(g, a) {
    const x = g.hostages.find((y) => y.id === a.id) || fail('No such hostage.');
    g.hostages = g.hostages.filter((y) => y.id !== a.id);
    return entry(`${houseName(x.holder)} released the ${houseName(x.owner)} card.`, 'relations', [x.holder, x.owner]);
  },
  'hostage/execute'(g, a) {
    const x = g.hostages.find((y) => y.id === a.id) || fail('No such hostage.');
    if (!['executed', 'spared', 'kept'].includes(a.result)) fail('Result is executed, spared or kept.');
    (g.records.D3 = g.records.D3 || {})[x.id] = a.result;
    if (a.result === 'kept') return entry(`${houseName(x.holder)} keeps the ${houseName(x.owner)} card: no execution this round.`, 'relations', [x.holder, x.owner]);
    if (a.result === 'executed') {
      g.hostages = g.hostages.filter((y) => y.id !== a.id);
      return entry(`${houseName(x.holder)} executed the ${houseName(x.owner)} card (${a.favour ?? '?'} for, ${a.against ?? '?'} against). It leaves the game.`, 'relations', [x.holder, x.owner]);
    }
    return entry(`The execution of the ${houseName(x.owner)} card held by ${houseName(x.holder)} failed (${a.favour ?? '?'} for, ${a.against ?? '?'} against).`, 'relations', [x.holder, x.owner]);
  },

  'loan/take'(g, a) {
    isHouse(a.house);
    const free = Object.values(LOAN).filter((l) => l.kind === a.kind && !g.loans.held[l.id]);
    if (!free.length) fail(`No ${a.kind === 'gold' ? 'Gold' : 'Red'} loans left in the bank.`);
    const card = a.kind === 'gold' ? free[0] : shuffle(free, rng(g))[0];
    g.loans.held[card.id] = a.house;
    if (card.penalty === 'vp') g.houses[a.house].vp = Math.max(0, g.houses[a.house].vp - 1);
    (g.records[g.step] = g.records[g.step] || {})[a.house] = a.kind;
    // wording of the Log board: "Lannister took a Gold loan. Bank: 4 Gold loans left."
    const what = card.kind === 'gold' ? 'a Gold loan' : `a Red loan (${card.long})`;
    const left = Object.values(LOAN).filter((l) => l.kind === card.kind && !g.loans.held[l.id]).length;
    return entry(`${houseName(a.house)} took ${what}. Bank: ${left} ${card.kind === 'gold' ? 'Gold' : 'Red'} loan${left === 1 ? '' : 's'} left.`, 'loans', [a.house]);
  },
  'loan/payback'(g, a) {
    isHouse(a.house);
    if (g.loans.held[a.id] !== a.house) fail('That house does not hold this loan.');
    delete g.loans.held[a.id];
    const card = LOAN[a.id];
    if (card.penalty === 'vp') g.houses[a.house].vp += 1;
    return entry(`${houseName(a.house)} paid back ${card.kind === 'gold' ? 'a Gold loan' : 'a Red loan'} (6 Gold).`, 'loans', [a.house]);
  },
  'loan/interest'(g, a) {
    isHouse(a.house);
    const rec = (g.records[g.step] = g.records[g.step] || {});
    if (a.loan) {
      // one choice per Gold loan; the house counts as done when every Gold loan is settled
      if (g.loans.held[a.loan] !== a.house) fail('That house does not hold this loan.');
      rec[`${a.house}#${a.loan}`] = a.choice;
      const golds = Object.entries(g.loans.held).filter(([id, h]) => h === a.house && LOAN[id].kind === 'gold').map(([id]) => id);
      if (golds.every((id) => rec[`${a.house}#${id}`])) rec[a.house] = a.choice;
    } else {
      rec[a.house] = a.choice;
    }
    return entry(`${houseName(a.house)} paid interest: ${a.choice === 'gold' ? '1 Gold' : 'lost a Footman'}.`, 'loans', [a.house]);
  },

  'stock/take'(g, a) {
    const item = STOCK_ITEM[a.item] || fail(`Unknown item: ${a.item}`);
    const s = g.stock[a.item];
    if (s.left <= 0) fail(`No ${item.name} left in the stock.`);
    s.left -= 1;
    if (a.house) s.by.push(a.house);
    if (a.house && a.step) (g.records[a.step] = g.records[a.step] || {})[a.house] = 'bought';
    return entry(`${a.house ? houseName(a.house) + ' took' : 'Taken from the stock:'} ${item.name}. ${s.left} of ${item.total} left.`, 'market', a.house ? [a.house] : []);
  },
  'stock/return'(g, a) {
    const item = STOCK_ITEM[a.item] || fail(`Unknown item: ${a.item}`);
    const s = g.stock[a.item];
    if (s.left >= item.total) fail(`All ${item.name} are already in the stock.`);
    s.left += 1;
    s.by.pop();
    return entry(`${item.name} returned to the stock. ${s.left} of ${item.total} left.`, 'market');
  },

  'westeros/reveal'(g, a, ctx) {
    const w = g.westeros;
    if (w.shown >= 4) fail('All four Westeros cards are revealed.');
    // a Deck step names its deck; without one, the next deck is revealed
    const d = a.deck ?? w.shown + 1;
    if (![1, 2, 3, 4].includes(d)) fail('Unknown deck.');
    const why = revealBlock(g, d);
    if (why) fail(why);
    const notes = [];
    const id = drawCard(g, d, ctx, notes);
    w.revealed[d] = id;
    w.shown = d;
    refreshBid(g, ctx);
    return entry(`Deck ${DECK[d]} revealed: ${id ? cardName(ctx, id) : 'no card'}${notes.length ? ' (' + notes.join('; ') + ')' : ''}.`, 'westeros');
  },
  'westeros/laws'(g, a, ctx) {
    const w = g.westeros;
    const d = a.deck;
    if (d < 1 || d > 3 || d !== w.shown) fail('Master of Laws decides on the card just revealed (decks I to III).');
    if (w.lawsUsed !== null) fail('Master of Laws was already used this round.');
    if (w.laws[d]) fail('Already decided for this card.');
    const holder = g.council.laws;
    if (a.choice === 'keep') {
      w.laws[d] = 'keep';
      return entry(`${holder ? houseName(holder) : 'Master of Laws'} kept ${cardName(ctx, w.revealed[d])} (deck ${DECK[d]}).`, 'westeros', [holder].filter(Boolean));
    }
    // the replaced card is discarded after the draw, so a Winter is Coming reshuffle can't bring it straight back
    const old = w.revealed[d];
    const notes = [];
    const id = drawCard(g, d, ctx, notes);
    if (!id) fail(`Deck ${DECK[d]} has no other card.`);
    w.decks[d].discard.push(old);
    w.revealed[d] = id;
    w.laws[d] = 'replace';
    w.lawsUsed = d;
    w.lawsOld = old;
    g.councilUsed.laws = true;
    refreshBid(g, ctx);
    // Log board: "Bolton replaced Thwarted Plans (deck I) with Shifting Ambitions."
    return entry(`${holder ? houseName(holder) : 'Master of Laws'} replaced ${cardName(ctx, old)} (deck ${DECK[d]}) with ${cardName(ctx, id)}${notes.length ? ' (' + notes.join('; ') + ')' : ''}.`, 'westeros', [holder].filter(Boolean));
  },
  // Dark Wings, Dark Words: the Raven holder ticks the events they choose (any of three, in order at the table)
  'westeros/choose'(g, a, ctx) {
    const w = g.westeros;
    if (cardName(ctx, w.revealed[3]) !== DARK_WINGS) fail('Dark Wings, Dark Words is not face up on deck III.');
    if (!DARK_WINGS_EVENTS.includes(a.event)) fail(`Unknown event: ${a.event}`);
    const chosen = (w.chosen || []).filter((e) => e !== a.event);
    w.chosen = a.on ? DARK_WINGS_EVENTS.filter((e) => chosen.includes(e) || e === a.event) : chosen;
    refreshBid(g, ctx);
    const raven = (g.tracks || {}).raven;
    const who = raven ? `${houseName(raven)} (Raven)` : 'The Raven holder';
    return entry(a.on ? `${who} chose ${a.event} for ${DARK_WINGS}.` : `${who} took back ${a.event} for ${DARK_WINGS}.`, 'westeros', raven ? [raven] : []);
  },
  'westeros/shuffle'(g, a) {
    const deck = g.westeros.decks[a.deck] || fail('Unknown deck.');
    if (a.which === 'discards') {
      const n = deck.discard.length;
      deck.draw = shuffle(deck.draw.concat(deck.discard), rng(g));
      deck.discard = [];
      return entry(`Deck ${DECK[a.deck]}: ${n} discards shuffled back in.`, 'westeros');
    }
    deck.draw = shuffle(deck.draw, rng(g));
    return entry(`Deck ${DECK[a.deck]} shuffled.`, 'westeros');
  },
  'westeros/deck4'(g, a, ctx) {
    if (!['won', 'lost'].includes(a.result)) fail('Result is won or lost.');
    g.westeros.deck4 = a.result;
    // Log board: "Bands of Outlaws: bids 7 against target 5, won."
    const bids = Number.isFinite(a.total) ? `bids ${a.total} against target ${a.target}, ` : '';
    return entry(`${cardName(ctx, g.westeros.revealed[4])}: ${bids}${a.result}.`, 'westeros');
  },
  'westeros/peek'(g, a, ctx) {
    isHouse(a.house);
    if (a.kind === 'maester') {
      if (g.councilUsed.maester) fail('Grand Maester was already used this round.');
      g.councilUsed.maester = true;
      return entry(`${houseName(a.house)} (Grand Maester) looked at the top of decks ${a.decks.map((d) => DECK[d]).join(' and ')}.`, 'westeros', [a.house]);
    }
    if (g.westeros.peeks.raven) fail('The Raven was already used this round.');
    g.westeros.peeks.raven = true;
    return entry(`${houseName(a.house)} (Raven) looked at the top of deck IV.`, 'westeros', [a.house]);
  },
  'westeros/raven'(g, a) {
    const deck = g.westeros.decks[4];
    if (a.choice === 'bottom' && deck.draw.length) deck.draw.push(deck.draw.shift());
    return entry(a.choice === 'bottom' ? 'The Raven put the top card of deck IV at the bottom.' : 'The Raven kept the top card of deck IV.', 'westeros');
  },

  'order/ban'(g, a) {
    g.bannedOrder = a.order;
    return entry(`The Blade bans ${a.order} on Tactic cards this round.`, 'step');
  },
  'record/set'(g, a) {
    isHouse(a.house);
    (g.records[a.step] = g.records[a.step] || {})[a.house] = a.value;
    return entry(`${houseName(a.house)}: ${a.label || a.value}.`, a.kind || 'step', [a.house]);
  },
  'objective/score'(g, a) {
    isHouse(a.house);
    const vp = Math.max(0, a.vp | 0);
    g.houses[a.house].obj += 1;
    g.houses[a.house].vp += vp;
    (g.records.E1 = g.records.E1 || {})[a.house] = `+${vp} VP`;
    return entry(`${houseName(a.house)} scored an Objective: +${vp} VP (now ${g.houses[a.house].vp}).`, 'houses', [a.house]);
  },
  'win/confirm'(g, a) {
    isHouse(a.house);
    g.winner = { house: a.house, reason: a.reason || '', round: g.round };
    return entry(`${houseName(a.house)} wins the game${a.reason ? ': ' + a.reason : ''}.`, 'houses', [a.house]);
  }
};

export const ACTIONS = Object.keys(handlers);

export function reduce(game, action, ctx = {}) {
  const fn = handlers[action && action.type];
  if (!fn) throw new RuleError(`Unknown action: ${action && action.type}`);
  const g = clone(game);
  // a game from an older version: retired step ids, missing tracks and Westeros flags (records are keyed by step)
  upgradeGame(g, ctx.cards);
  const e = fn(g, action, ctx);
  return { game: g, entry: { ...e, round: g.round, step: g.step } };
}

export { STEP_IDS };
