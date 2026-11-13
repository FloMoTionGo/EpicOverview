// The Round tab: one screen per step, built like the canvas boards "Round, <phase> <n>".
import { HOUSE_IDS, HOUSES, ROLE, LEVELS, BREAK_COST, LOAN, LOAN_CONDITIONS, STOCK, ORDER_TYPES, houseName, sigil } from '../core/data.js';
import { level, diplomaticBonus, hostageIncome, levelsText, loansOf, bankLeft, victory, effectiveCastles, pairKey } from '../core/rules.js';
import { stepById } from '../core/steps.js';
import { stepFrame, frame } from '../ui/chrome.js';
import { esc, act, BAR, focus, rules, para, cards, rows, options, substeps, stepper, banner, col, split, queue, chips, footer } from '../ui/kit.js';

const DECK = ['', 'I', 'II', 'III', 'IV'];
const cardImg = (c, size = 't') => `assets/${c.image}-${size}.webp`;
const next = (label) => ({ label, kind: 'primary', act: act('step/next') });

// Guidance per Westeros card, from EPIC p. 6–8. The printed card text is always shown as well.
const GUIDE = {
  'New Information': { mode: 'turn', modeText: 'In Throne order at the table.', rules: [['At the table', 'Each house may pay any number of Power, then draws and discards that many Objectives.'], ['Objectives in hand', 'Not tracked; only achieved ones are counted.']] },
  'Shifting Ambitions': { mode: 'turn', modeText: 'First all at once, then in Throne order at the table.', sub: [['all', 'Choose 1 Objective'], ['all', 'Reveal them together'], ['turn', 'Each takes one, Throne order']], para: 'Each house chooses one Objective from its hand and all are revealed together. Then, in Throne order, each house takes one of them into its hand.', rules: [['At the table', 'Objectives in hand are not tracked; only achieved ones are counted.']] },
  'Thwarted Plans': { mode: 'all', modeText: 'At once.', rules: [['Victory Points', 'Each house with at least 2 scored Objectives loses 1 VP: change it on the Houses tab.']] },
  'The Burden of Power': { mode: 'one', modeText: 'The holder of the Iron Throne.', rules: [['Choice', 'The Throne holder picks, in order, any of New Information, Shifting Ambitions and Thwarted Plans.']] },
  'Mustering Troops': { mode: 'turn', modeText: 'In reverse Sword order at the table.', muster: 'every one of its areas with a Stronghold or a Castle: Stronghold 2 points, Castle 1', source: 'EPIC p. 7, base game mustering' },
  'Rally the Men': { mode: 'turn', modeText: 'In reverse Sword order at the table.', muster: 'every one of its areas with a Castle: 1 point each', source: 'EPIC p. 7, base game mustering' },
  'Prepare Tactics': { mode: 'all', modeText: 'Handled at the table.', rules: [['Discards', 'Pay 3 Power to shuffle your discarded Tactics back into your deck.'], ['New hand', 'Shuffle the Tactics in your hand into the deck and choose a new hand of three.']] },
  'Drought': { mode: 'turn', modeText: 'In Sword order at the table.', rules: [['Supply', 'Each house drops two steps on the Supply track and reconciles its armies; Supply tokens may be discarded instead of steps.'], ['Rivers', 'River borders are passable this round.']] },
  'Strategical Superiority': { mode: 'one', modeText: 'The holder of the Valyrian Steel Blade.', rules: [['Choice', 'The Blade holder picks, in order, any of Mustering Troops, Prepare Tactics and Drought.']] },
  'Clash of Kings': { mode: 'all', modeText: 'Handled at the table: secret bids, one track after another.', clash: true, source: 'EPIC p. 7–8, B16, B20' },
  'Secret Conspiracies': { mode: 'all', modeText: 'Handled at the table.', rules: [['Intrigue', "Each house may pay up to 2 Power to draw that many Intrigue cards, up to its King's Court stars plus 1."], ['Masters of Intrigue', 'Its holder draws one more for free.']] },
  'Storm in the Skies': { mode: 'all', modeText: 'For this round.', rules: [['Special orders', "Each house may place two special orders fewer than its King's Court stars allow."]] },
  'Dark Wings, Dark Words': { mode: 'one', modeText: 'The holder of the Messenger Raven.', rules: [['Choice', 'The Raven holder picks, in order, any of Clash of Kings, Secret Conspiracies and Storm in the Skies.']] }
};

function revealed(ctx, d) {
  const id = ctx.game.westeros.revealed[d];
  return id ? ctx.cardById[id] : null;
}

// Is a Westeros card with this name face up this round? (round-effect flags: Storm in the Skies, Drought)
function inEffect(ctx, name) {
  return [1, 2, 3, 4].some((d) => (revealed(ctx, d) || {}).name === name);
}

function notRevealed(d) {
  return { body: col(banner(`Deck ${DECK[d]} is not revealed yet.`), para('The cards are revealed one by one in Westeros 2.')),
    footer: footer([{ label: 'Go to Westeros 2', kind: 'primary', act: act('step/goto', { step: 'W2' }) }]) };
}

function deckStep(ctx, d) {
  const c = revealed(ctx, d);
  if (!c) return notRevealed(d);
  const known = GUIDE[c.name];
  const gd = known || { mode: 'all', modeText: 'Resolve the card as printed.', rules: [] };
  const w = ctx.game.westeros;
  const old = w.laws[d] === 'replace' && w.lawsOld ? ctx.cardById[w.lawsOld] : null;
  const value = c.value != null ? `value ${c.value}` : 'no value';
  const card = cards([{ img: cardImg(c), label: c.name, sub: old ? `replaced ${old.name}, ${value}` : value }], 130);
  // the boards show the card picture with its printed text; the text is spelled out only for cards without a guide
  const text = known ? '' : `<p style="margin:0;font-size:15px;line-height:1.35;white-space:pre-line"><strong>As printed:</strong> ${esc(c.text)}</p>`;
  let body;
  if (gd.muster) {
    // as on the board "Round, Westeros 4": no card picture, one box and the costs
    body = split(`<div style="padding:12px 16px;border-radius:12px;background:rgba(42,32,23,.07);border:2px solid #2d3a45"><div style="font-size:21px;font-weight:700;line-height:1.15">Mustering happens at the table</div>`
      + `<div style="font-size:16px;line-height:1.35;color:#4a3d2c;margin-top:4px">Each house musters in ${esc(gd.muster)}. Houses go in reverse Sword order. The app keeps no list of who has mustered.</div></div>`,
      rules([['Costs', 'Footman 1, Knight 2, Ship 1, Siege engine 2, Archer 2, Flagship 2; Footman to Knight or Siege engine 1.'], ['Supply', 'New units may not break your Supply track.'],
        [c.name === 'Rally the Men' ? 'No Castle' : 'No Castle or Stronghold', 'Nothing to muster: pass.']]));
  } else if (gd.clash) {
    body = col(substeps([['all', 'Iron Throne bid', ''], ['all', 'Small Council bid', ''], ['all', 'Fiefdoms bid', ''], ['all', "King's Court bid", ''], ['all', 'Seats on the Houses tab', '']]),
      split(col(para('Each house bids in secret, then all bids are revealed together, one track after another. After the Throne bid comes the Small Council bid: one House card from your hand plus any Power and Gold.'),
        rules([['Bids', "Power and Gold count 1:1; everything bid is discarded. King's Landing adds 2 to the Throne bid."]])),
        rules([['Small Council', "First all council cards go back to their owners' hands. Seats go by the House card's strength; ties by Power, then Throne order. The card sits on the seat and cannot fight. Nine houses, seven seats."],
          ['Hand of the King', 'Gains 2 Power when the title changes owner; wins bid ties against anyone without the Iron Throne.'], ['Track positions', 'Stay on the board; the app does not record them.']])));
  } else if (gd.sub) {
    body = split(col(substeps(gd.sub.map(([m, t]) => [m, t, ''])), para(gd.para), text), col(card, rules(gd.rules)));
  } else {
    body = split(col(card, text), rules(gd.rules.length ? gd.rules : [['At the table', 'Resolve the card as printed; the app records nothing here.']]));
  }
  const btns = gd.clash ? [{ label: 'Assign the Small Council seats', kind: 'secondary', href: '#/houses' }] : [];
  const source = gd.source || (known ? ['', 'EPIC p. 6–7', 'EPIC p. 7', 'EPIC p. 7–8'][d] : 'EPIC p. 6–8, card text');
  return { title: `Deck ${DECK[d]}: ${c.name}`, mode: gd.mode, modeText: gd.modeText, body, footer: footer(btns), source };
}

// Cards whose timing falls on a step: shown as one line above the step's buttons.
const TRIGGERS = {
  W4: 'The North Remembers (mustering), Fruits of the Reach (Supply losses)',
  W5: "Claim to the Throne and Blood of Kings, if used (Throne bid), Master of Whispers (after the King's Court bid), Chaos is a Ladder (after all bids), Master Thief",
  W6: 'Fruits of the Reach (Supply losses)',
  W7: 'Hired Assassin; without a bid also Display of Power, Direct Confrontation',
  D1: 'Master Thief, Espionage Network',
  D3: 'Secure Hostages, Extract Information',
  D4: 'A Red Wedding',
  P2: 'A Hidden Path, The Old Ways, Careful Planning, Advanced Planning, Master of Ships (once per round; one sea army may hold 4 units)',
  P3: 'Scout the Land, Information Leak',
  A1: 'Hit and Run Incursion, Support Allies (a raided Support becomes −1 Support), Maneuver Warfare',
  A2battle: 'Intrigue: Timely Distraction, A Fiery Shipment, Everyone Has a Price, A Knife in the Back, Unveiling Secrets, Wildfire Trap. Tactics: Offensive Maneuver, Conquering Plan, Press Forward, Strategic Attacks, Support Allies, Ambush Set Up, Manage Troops, Expand Control. Dowries: Claim to the Throne, Knights of the Vale, Unbowed Unbent Unbroken, Lords of the Rivers. Also Lord Commander of the Kingsguard, Janos Slynt',
  A3: 'Foster Riots, Peaceful Takeover, Ties With the Lords',
  A4: 'Ties With the Lords, Master of Coin',
  A5: 'Sellswords Company, A Better Offer'
};

// Deck IV bids in the words of the board "Round, Westeros 6" (card text in data/westeros.json).
const BID4 = {
  'Bands of Outlaws': { won: 'The highest bid gains 3 Gold.', lost: 'Lowest bid loses 1 Gold and 2 Supply steps; everyone else 1 Gold and 1 Supply step. Supply tokens may be discarded instead of steps.', done: 'The highest bidder takes 3 Gold at the table.' },
  'Flawless Strategy': { won: 'The highest bid may take any House card back into its hand.', lost: 'Lowest bid discards all its House cards with the highest strength; everyone else discards one House card at random.' },
  'Knights of the Seven Kingdoms': { won: 'The highest bid may replace up to two Footmen with Knights.', lost: 'Lowest bid replaces all its Knights with Footmen; everyone else replaces two Knights with Footmen.' },
  'Treachery and Deceit': { won: 'The highest bid moves to the top of any influence track.', lost: 'Lowest bid loses 2 positions on its highest influence track; everyone else discards 2 Power.' },
  'War Preparations': { won: 'The highest bid may muster at a Castle or Stronghold.', lost: 'Lowest bid destroys 2 of its units, at a Castle if possible; everyone else destroys 1.' },
  'Wavering Loyalties': { won: 'The highest bid puts Power from its reserve on 3 controlled areas.', lost: 'Lowest bid discards the Power from all its controlled areas; everyone else from 2 of them.' }
};

const STEP_RENDER = {
  W1: (ctx) => ({
    body: split(col(para('Turn the die next to each influence track: one up if the same house still holds the token as last round, back to 1 if it changed hands.'),
      rules([['A die reaches 4', "That house can win at the end of the round: Throne with King's Landing, Blade with the most castles, or Raven with the most Power."], ['Round 1', 'The whole Westeros phase is skipped.'],
        ...(ctx.game.round === 7 ? [['Round 7', 'Discard Varys and Janos Slynt; draw a free Mercenary card and apply it (ruling B7).']] : [])])),
      col(banner('The dice live on the board. The app does not know who holds Throne, Blade or Raven.'))),
    footer: footer([next('Dice turned')]), source: 'EPIC p. 5–6'
  }),

  W2: (ctx) => {
    const { game } = ctx;
    const w = game.westeros;
    const laws = game.council.laws;
    const last = w.shown;
    const pending = laws && w.lawsUsed === null && last >= 1 && last <= 3 && !w.laws[last];
    const vals = [1, 2, 3].filter((d) => d <= w.shown).map((d) => (revealed(ctx, d) || {}).value ?? 0);
    const target = w.shown >= 3 ? `Round target for deck IV: ${vals.reduce((a, b) => a + b, 0)} (${vals.join(' + ')})`
      : `Round target for deck IV: ${vals.length ? vals.join(' + ') + ' + …' : '…'}, still adding up`;
    const decks = [1, 2, 3, 4].map((d) => {
      const c = revealed(ctx, d);
      const up = d <= w.shown && c;
      const sub = !up ? (d === w.shown + 1 ? (pending ? 'waits for Master of Laws' : 'next to reveal') : 'face down')
        : d === 4 ? (c.bid ? 'bid against the round target' : 'event')
        : `value ${c.value ?? '–'}${w.laws[d] === 'keep' ? ', kept' : w.laws[d] === 'replace' ? ', replaced' : d === last && pending ? ', Master of Laws decides now' : ''}`;
      const face = up ? `<img src="${cardImg(c)}" alt="${esc(`Deck ${DECK[d]}: ${c.name}`)}" style="height:90px;width:auto;max-width:100%;border-radius:8px;box-shadow:0 6px 14px rgba(0,0,0,.35)">`
        : `<div style="height:90px;width:140px;max-width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;border-radius:8px;background:repeating-linear-gradient(135deg,#3b2a1d 0 8px,#33241a 8px 16px);box-shadow:inset 0 0 0 2px #c9a24c;color:#ead08a">`
          + `<span style="font:600 16px ${BAR}">Deck ${DECK[d]}</span><span style="font:500 13px ${BAR};color:#d8c9a8">face down</span>`
          + (d === w.shown + 1 && !pending ? `<button type="button" ${act('westeros/reveal')} style="min-height:44px;padding:0 14px;border-radius:10px;border:0;background:#c9a24c;color:#211710;font:600 15px ${BAR}">Reveal</button>` : '') + `</div>`;
      return `<figure style="margin:0;display:flex;flex-direction:column;gap:3px;min-width:0">${face}<figcaption style="font:600 14px ${BAR};line-height:1.15">${esc(up ? `Deck ${DECK[d]}: ${c.name}` : `Deck ${DECK[d]}`)}<span style="display:block;font-weight:500;color:#66543d">${esc(sub)}</span></figcaption></figure>`;
    }).join('');
    const lawsCard = last >= 1 && last <= 3 ? revealed(ctx, last) : null;
    const hint = !laws ? 'Nobody sits on Master of Laws: no replacements this round.'
      : w.lawsUsed !== null ? `Used on deck ${DECK[w.lawsUsed]}. Once per round, so no more decisions.`
      : pending ? `Decide now, before the next card is revealed: replace ${lawsCard.name} with the next card of deck ${DECK[last]}, or keep it. No going back to earlier cards.`
      : w.shown >= 3 ? 'Kept decks I to III. Not used this round.' : 'Decides on each card of decks I to III as soon as it is revealed.';
    const lawBtns = pending ? `<div role="group" aria-label="Master of Laws" style="display:flex;gap:6px">`
      + `<button type="button" ${act('westeros/laws', { deck: last, choice: 'replace' })} style="flex:1;min-width:0;min-height:44px;padding:0 8px;border-radius:10px;font:600 15px ${BAR};border:0;background:#8d2a22;color:#fbe9cf">Replace ${esc(lawsCard.name)}</button>`
      + `<button type="button" ${act('westeros/laws', { deck: last, choice: 'keep' })} style="flex:1;min-width:0;min-height:44px;padding:0 8px;border-radius:10px;font:600 15px ${BAR};border:2px solid #2a2017;background:transparent;color:#2a2017">Keep ${esc(lawsCard.name)}</button></div>` : '';
    const body = `<div class="k-cards" style="display:flex;gap:14px;align-items:flex-start">${decks}</div>`
      + `<div class="k-split" style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:20px;align-items:start"><div style="display:flex;flex-direction:column;gap:8px;min-width:0">`
      + `<div style="padding:10px 14px;border-radius:10px;font:600 17px ${BAR};background:#2b1f16;color:#ead08a">${esc(target)}</div>`
      + `<div style="display:flex;flex-direction:column;gap:6px;padding:6px 10px;border-radius:10px;border:2px solid #8d2a22;background:rgba(141,42,34,.06)"><div style="display:flex;align-items:center;gap:8px">`
      + (laws ? `<img src="${sigil(laws)}" alt="" style="width:28px;height:28px;flex:none">` : '')
      + `<span style="font-size:15px;line-height:1.2"><strong>Master of Laws${laws ? ', ' + esc(houseName(laws)) : ''}.</strong> ${esc(hint)}</span></div>${lawBtns}</div></div>`
      + rules([['Winter is Coming', 'The app shuffles that deck and draws again by itself.'], ['Grand Maester', 'Once per round: top of two decks (Westeros tab).'], ['House rules', 'one card at a time, deck I to IV (the rulebook reveals all four at once); Master of Laws decides right after each card of decks I to III.']]) + `</div>`;
    const done = w.shown >= 4;
    const foot = `<div class="k-footer" style="display:flex;gap:10px;flex:none"><button type="button" ${done || pending ? 'aria-disabled="true"' : act('westeros/reveal')} style="min-height:52px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;border-radius:12px;font-size:18px;flex:1;border:0;background:#2a2017;color:#e8d7ae;${done || pending ? 'opacity:.45;cursor:default' : ''}">${pending ? 'Master of Laws decides first' : done ? 'All four revealed' : 'Reveal deck ' + DECK[w.shown + 1]}</button>`
      + `<a href="#/westeros" style="min-height:52px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;border-radius:12px;font-size:18px;flex:0 0 auto;min-width:190px;padding:0 16px;border:2px solid #2a2017;background:transparent;color:#2a2017;text-decoration:none">Open the Westeros tab</a></div>`;
    return { title: 'Reveal the Westeros cards', body, footer: foot, source: 'EPIC p. 6–8, house rules', move: laws && pending ? [laws] : [] };
  },

  W3: (ctx) => deckStep(ctx, 1),
  W4: (ctx) => deckStep(ctx, 2),
  W5: (ctx) => deckStep(ctx, 3),

  W6: (ctx) => {
    const c = revealed(ctx, 4);
    if (!c) return notRevealed(4);
    const vals = [1, 2, 3].map((d) => (revealed(ctx, d) || {}).value ?? 0);
    const target = vals.reduce((a, b) => a + b, 0);
    const res = ctx.game.westeros.deck4;
    const card = cards([{ img: cardImg(c), label: c.name, sub: c.bid ? `ties in ${c.bid.tiebreak}` : 'event' }], 112);
    if (!c.bid) {
      return { title: `Deck IV: ${c.name}`, mode: 'all', modeText: 'Resolve the event as printed.',
        body: split(col(card), col(`<p style="margin:0;font-size:16px;line-height:1.35;white-space:pre-line">${esc(c.text)}</p>`, banner('Handled at the table; the app records nothing here.'))),
        footer: '', source: 'Deck IV card, EPIC p. 7' };
    }
    const t4 = BID4[c.name] || { won: `The highest bid ${c.bid.won}`, lost: `Lowest bid ${c.bid.lowest} Everyone else: ${c.bid.others}` };
    const total = ctx.ui.bidTotal;
    const result = total == null ? res : total >= target ? 'won' : 'lost';
    const line = total == null ? (res ? `Recorded: ${res}.` : '')
      : result === 'won' ? `${total} against a round target of ${target}: won. ${t4.done || 'The highest bidder resolves it at the table.'}`
      : `${total} against a round target of ${target}: lost. The lowest bid and everyone else take their lines at the table.`;
    // board layout, except A Calculated Risk sits under the total so nothing is cut off at 1180×820
    const body = split(col(card, rules([['Won', t4.won], ['Lost', t4.lost]])),
      col(stepper('Total of all bids', total ?? 0, act('ui/add', { bidTotal: -1 }), act('ui/add', { bidTotal: 1 })), line ? banner(line, result === 'won' ? 'good' : 'bad') : '',
        rules([['A Calculated Risk', 'Its lowest bidder suffers nothing; the next lowest takes the lowest line.']])));
    return { title: `Deck IV: ${c.name}`, mode: 'all', modeText: 'Everyone bids in secret against the round target.', body,
      footer: footer([{ label: 'Done', kind: 'primary', disabled: total == null && !res, act: act('deck4/done', { result: result || 'lost', total: total ?? undefined, target }) }]),
      source: 'Deck IV card, EPIC p. 7' };
  },

  W7: (ctx) => {
    const c3 = revealed(ctx, 3);
    const bid = c3 && (c3.name === 'Clash of Kings' || c3.name === 'Dark Wings, Dark Words');
    const why = !c3 ? 'Deck III is not revealed yet.' : c3.name === 'Clash of Kings' ? 'No council swap this round: Clash of Kings was bid.'
      : bid ? 'Only if the Raven holder did not choose Clash of Kings for Dark Wings, Dark Words.' : 'No bid this round: houses with a seat may swap now.';
    return { body: col(banner(why, bid && c3.name === 'Clash of Kings' ? 'dark' : 'good'),
      para('In a round without a bid on the influence tracks, each house with a seat may swap a House card from its hand with its card on the Small Council.'),
      rules([['No seat', 'Nothing to swap.'], ['End of every Westeros phase', 'Hired Assassin can be played now. In a round without a bid also Display of Power and Direct Confrontation.']])),
      footer: footer([next(bid ? 'Skip to Diplomacy' : 'Swaps done')]), source: 'EPIC p. 8, Intrigue cards' };
  },

  D1: (ctx) => {
    const h = ctx.game.council.whispers;
    return { modeText: h ? `${houseName(h)} sits on Master of Whispers (Small Council).` : 'Nobody sits on Master of Whispers.',
      body: split(col(h ? focus(h, houseName(h), 'Draw 2 Intrigue cards, keep 1, discard 1.') : banner('Nobody sits on Master of Whispers this round.'), para('Round 1 has no Diplomacy phase.')),
        rules([['Ravens, all phase', "Each house may send messages: one per King's Court star, at least 1, at most 10 words. Announce every sending."],
          ['Throne, Blade, Raven', 'Once per round: the Throne protects 1 message, the Blade destroys 1, the Raven reads 1 and passes it on.'],
          ['Trades', 'Only in this phase can both sides hand over at the same time.']])),
      footer: footer([next(h ? `${houseName(h)} has drawn` : 'Next step')]), source: 'EPIC p. 8–9', move: h ? [h] : [] };
  },

  D2: (ctx) => {
    const g = ctx.game;
    const GRID = 'display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1.9fr) 52px minmax(0,1.9fr) 52px;gap:8px;align-items:center';
    const sign = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v);
    const head = `<div role="row" class="k-d2row" style="${GRID};min-height:26px;font:600 13px ${BAR};color:#66543d"><span role="columnheader" class="k-d2house">House</span><span role="columnheader">Diplomatic levels</span><span role="columnheader" style="text-align:center">Bonus</span><span role="columnheader">Hostages</span><span role="columnheader" style="text-align:center">Total</span></div>`;
    const lines = HOUSE_IDS.map((h) => {
      const b = diplomaticBonus(g, h), hi = hostageIncome(g, h), t = b + hi.value;
      return `<div role="row" class="k-d2row" style="${GRID};min-height:22px;border-top:1px solid rgba(42,32,23,.15);font-size:14px;line-height:1.1">`
        + `<span role="cell" style="display:flex;align-items:center;gap:6px;min-width:0"><img src="${sigil(h)}" alt="${esc(houseName(h))}" title="${esc(houseName(h))}" style="width:20px;height:20px;flex:none"><span class="k-d2name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(houseName(h))}</span></span>`
        + `<span role="cell" class="k-wrap" style="color:#4a3d2c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(levelsText(g, h))}</span>`
        + `<span role="cell" style="text-align:center;font:600 16px ${BAR}">+${b}</span>`
        + `<span role="cell" class="k-wrap" style="color:#4a3d2c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${hi.value || hi.text ? esc(`${sign(hi.value)} ${hi.text}`) : '–'}</span>`
        + `<span role="cell" style="text-align:center;font:600 17px ${BAR};color:#8d2a22">${t ? sign(t) : '0'}</span></div>`;
    }).join('');
    const table = `<div style="display:flex;flex-direction:column;min-width:0"><div role="table" aria-label="Power this phase per house" style="display:flex;flex-direction:column">${head}${lines}</div>`
      + `<p style="margin:3px 0 0;font:500 13px ${BAR};color:#66543d">Live from the Relations tab: a level or hostage changed there before Next step updates this table at once.</p></div>`;
    return { body: split(table, rules([['Diplomatic bonus', '1 Power per Truce, 3 per Alliance, 5 per Dynasty.'], ['Hostages', "The holder gains 1 Power per hostage; the card's owner loses 1."],
      ['This Was Not the Deal', 'Before the income: kill a hostage; its holder loses 3 Power, you gain 2 if it was your card.'], ['Alliance or Dynasty', "Partners can't hold each other's hostages; the card goes back free."],
      ['Power', 'Not tracked: take it from the bank.']]), 'minmax(0,1fr) 290px'),
      footer: footer([next('Everyone has taken it'), { label: 'Open Relations', kind: 'secondary', href: '#/relations' }]), source: 'EPIC p. 9' };
  },

  D3: (ctx) => {
    // as on the board "Round, Diplomacy 3": one hostage at a time; the others are listed until their turn
    const g = ctx.game;
    const done = g.records.D3 || {};
    const open = g.hostages.filter((x) => !done[x.id]);
    if (!open.length) {
      const text = g.hostages.length || Object.keys(done).length ? 'Every hostage has been dealt with this round.' : 'No house holds a hostage: nothing to execute.';
      return { body: col(banner(text, 'good')), footer: footer([next('Next step')]), source: 'EPIC p. 9' };
    }
    const sel = open.find((x) => x.id === ctx.ui.execId) || open[0];
    const f = ctx.ui.favour ?? 0, a = ctx.ui.against ?? 0;
    const holder = houseName(sel.holder), owner = houseName(sel.owner);
    const who = ctx.house === sel.holder ? `You hold a ${owner} House card.` : `${holder} holds a ${owner} House card.`;
    const others = open.filter((x) => x.id !== sel.id).map((x) => `<div style="font-size:15px;line-height:1.3"><button type="button" ${act('ui/set', { execId: x.id, favour: 0, against: 0 })} title="Resolve this one first" style="padding:0;border:0;background:none;color:inherit;font:inherit;font-weight:700;text-decoration:underline dotted;text-underline-offset:3px">${esc(houseName(x.holder))}:</button> Also holds a hostage (a ${esc(houseName(x.owner))} card) and may execute it in turn.</div>`);
    const result = f === 0 && a === 0 ? '' : f > a ? banner(`Executed: the card leaves the game. ${holder} may swap places with ${owner} on one influence track.`, 'good')
      : f < a ? banner('Spared: the hostage stays where it is.', 'dark') : banner('Tie: the Iron Throne holder decides.', 'dark');
    const notes = `<div style="display:flex;flex-direction:column;gap:5px">${others.join('')}<div style="font-size:15px;line-height:1.3"><strong>Tie:</strong> The Iron Throne holder decides.</div></div>`;
    return {
      body: split(col(focus(sel.holder, `${holder} executes the ${owner} card`, `${who} Everyone bid Power and Gold in secret, without saying for or against; the bids are revealed.`), notes),
        col(stepper('In favour', f, act('ui/add', { favour: -1 }), act('ui/add', { favour: 1 })), stepper('Against', a, act('ui/add', { against: -1 }), act('ui/add', { against: 1 })), result)),
      footer: footer([{ label: 'Executed', kind: 'danger', act: act('hostage/execute', { id: sel.id, result: 'executed', favour: f, against: a }) },
        { label: 'Spared', kind: 'secondary', act: act('hostage/execute', { id: sel.id, result: 'spared', favour: f, against: a }) },
        { label: 'Keep the hostage', kind: 'secondary', act: act('hostage/execute', { id: sel.id, result: 'kept' }) }]),
      source: 'EPIC p. 9', move: [sel.holder]
    };
  },

  D4: (ctx) => {
    const g = ctx.game;
    const changed = Object.entries(g.changed).filter(([, r]) => r === g.round).map(([k]) => {
      const [a, b] = k.split('|');
      const l = g.relations[k] || 0;
      return [[a, b], `${LEVELS[l]}${g.married[k] === g.round ? ', married' : ''}`, ''];
    });
    return { body: split(rules([['Raise', "Both agree; each pays Power equal to the areas between their closest castles, minus their King's Court stars."], ['Lower', 'Free; either house alone.'],
      ['Limits', 'One step per pair per round; 3 friendly levels, 2 Alliances, 1 Dynasty, never a Dynasty next to an Alliance.'], ['Break', "Ignoring a level's limits drops it to War at once; the breaker pays 3, 5 or 8 Power or Supply steps."], ['Marriage', "The proposer's ring is spent; if accepted, +1 level for free and dowries swap."]]),
      changed.length ? rows(changed, 'Changed so far this round') : col(banner('No level changed yet this round.'))),
      footer: footer([{ label: 'Open Relations', kind: 'primary', href: '#/relations' }, { label: 'Nothing more to change', kind: 'secondary', act: act('step/next') }]), source: 'EPIC p. 9–10' };
  },

  D5: (ctx) => {
    const g = ctx.game;
    const rec = g.records[g.step] || {};
    // interest is owed for each Gold loan (EPIC p. 11); one choice per loan
    const goldOf = (h) => loansOf(g, h).filter((l) => l.kind === 'gold');
    const goldHolders = HOUSE_IDS.filter((h) => goldOf(h).length);
    const paid = (h, l, n) => rec[`${h}#${l.id}`] || (n === 1 ? rec[h] : undefined);
    const owes = (h) => goldOf(h).some((l, i, all) => !paid(h, l, all.length));
    const reds = HOUSE_IDS.flatMap((h) => loansOf(g, h).filter((l) => l.kind === 'red').map((l) => [[h], `Red loan: no interest, ${l.penalty === 'vp' ? `${l.long} while open` : l.long}`, '–']));
    const blocks = goldHolders.map((h) => {
      const mine = goldOf(h), n = mine.length;
      const done = mine.map((l) => paid(h, l, n));
      const said = done.filter(Boolean).map((v) => (v === 'gold' ? '1 Gold' : 'lost a Footman'));
      const text = said.length === n ? `Paid: ${said.join(', ')}.` : n > 1 ? 'For each loan: pay 1 Gold, or lose a Footman on the board.' : 'Pay 1 Gold, or lose a Footman on the board.';
      return col(focus(h, `${houseName(h)}: ${n} Gold loan${n > 1 ? 's' : ''}`, text),
        ...mine.map((l, i) => options([{ label: n > 1 ? `Loan ${i + 1}: pay 1 Gold` : 'Pay 1 Gold', selected: done[i] === 'gold', act: act('loan/interest', { house: h, loan: l.id, choice: 'gold' }) },
          { label: 'Lose a Footman', sub: 'Braavos controller picks which', selected: done[i] === 'footman', act: act('loan/interest', { house: h, loan: l.id, choice: 'footman' }) }])));
    });
    return { body: split(col(...(blocks.length ? blocks : [banner('Nobody holds a Gold loan: no interest this round.', 'good')])),
      col(reds.length ? rows(reds, 'No interest for Red loans') : para('No Red loans are open.'),
        rules([['Braavos still neutral', 'The loan holder picks the Footman.'], ['No Footman on the board', 'Another unit instead.']]))),
      footer: footer([next('Interest settled')]), source: 'EPIC p. 11', move: goldHolders.filter(owes) };
  },

  D6: (ctx) => {
    const g = ctx.game, me = ctx.house;
    const rec = g.records[g.step] || {};
    const label = { gold: 'took Gold', red: 'took Red', pass: 'passed', payback: 'paid back' };
    const states = Object.fromEntries(HOUSE_IDS.map((h) => [h, rec[h] ? ['done', label[rec[h]] || rec[h]] : ['wait', 'waiting']]));
    if (me && !rec[me]) states[me] = ['you', 'you'];
    const mine = me ? loansOf(g, me) : [];
    const bank = bankLeft(g);
    const meText = !me ? 'Choose the house this device plays to act here.'
      : `${mine.length ? `You hold ${mine.length} loan${mine.length > 1 ? 's' : ''}. ` : ''}You may hold one loan for each of these you meet on the board:`;
    const buttons = me ? [
      { label: 'Take a Gold loan', kind: 'primary', act: act('loan/take', { house: me, kind: 'gold' }), disabled: !bank.gold.length },
      { label: 'Take a Red loan', kind: 'danger', act: act('loan/take', { house: me, kind: 'red' }), disabled: !bank.red.length },
      ...mine.map((l) => ({ label: `Pay back ${l.kind === 'gold' ? 'Gold' : 'Red'} (6 Gold)`, kind: 'secondary', act: act('loan/payback', { house: me, id: l.id }) })).slice(0, 1),
      { label: 'Pass', kind: 'secondary', act: act('record/set', { step: g.step, house: me, value: 'pass', label: 'no new loan', kind: 'loans' }) }
    ] : [{ label: 'Choose your house', kind: 'primary', href: '#/choose' }];
    return {
      queue: queue(HOUSE_IDS, states, 'Who has decided'),
      body: split(col(me ? focus(me, `Your turn, ${houseName(me)}?`, meText) : banner(meText), chips(LOAN_CONDITIONS)),
        rules([['A loan', 'Pays 6 Gold (the Master of Coin gets 1 more). Gold comes from the Bank of Braavos, Red from other sources.'], ['Red loans', 'Carry their penalty until paid back.'],
          ['Paying back', '6 Gold closes a loan; its card goes back into the deck.'], ['Bank', `${bank.gold.length} Gold and ${bank.red.length} Red loans left.`]])),
      footer: footer(buttons), source: 'EPIC p. 11', move: me && !rec[me] ? [me] : []
    };
  },

  P1: (ctx) => {
    // as on the board "Round, Planning 1": tap a type to select it, then Ban
    const b = ctx.game.bannedOrder;
    const pick = ctx.ui.banPick || b;
    const btn = pick && pick !== b ? { label: `Ban ${pick}`, kind: 'primary', act: act('order/ban', { order: pick }) }
      : b ? next(`${b} is banned: next step`) : { label: 'Ban an order type', kind: 'primary', disabled: true };
    return { body: split(col(focus(null, 'The Blade holder picks', 'One order type that no house may put on its Tactic card this round. Whoever holds the Blade taps it on their device.'),
      rules([['Still on the board', "The banned type can be used as a normal order; only Tactic cards can't take it."], ['The Blade holder', 'Needs no order on its own Tactic card.']])),
      options(ORDER_TYPES.map((o) => ({ label: o, sub: o === b ? 'banned this round' : o === pick ? 'selected' : '', selected: o === pick, act: act('ui/set', { banPick: o }) })))),
      footer: footer([btn]), source: 'EPIC p. 12' };
  },

  P2: (ctx) => {
    const SPECIAL = [['March +1', 'The attacker gets +1 combat strength in a battle started by this order.'],
      ['Defense +2', 'The defender of this area gets +2. In a siege at a Stronghold it adds 2 towers instead of 1.'],
      ['Support +1', "Adds +1 on top of the supporting units' strength."],
      ['Raid', 'Works as a normal Raid, or removes an adjacent Defense order. Or it steals 1 Gold or 1 Supply token from the raided house, and then does nothing else.'],
      ['Consolidate Power', 'Works as a normal Consolidate Power, or musters in its own area if that area has a Castle or Stronghold (base game).']];
    const sp = SPECIAL.map(([a, b]) => `<div style="display:grid;grid-template-columns:150px minmax(0,1fr);gap:10px;align-items:baseline;padding:5px 0;border-top:1px solid rgba(42,32,23,.15)"><span style="font:600 16px ${BAR}">★ ${esc(a)}</span><span style="font-size:15px;line-height:1.25">${esc(b)}</span></div>`).join('');
    const banned = ctx.game.bannedOrder ? `Banned this round: ${ctx.game.bannedOrder}.` : 'Nothing is banned this round.';
    return { body: split(col(`<div style="padding:10px 14px;border-radius:12px;background:rgba(42,32,23,.06);border:1px solid rgba(42,32,23,.3)"><div style="font-size:21px;font-weight:700;line-height:1.15">Place orders face down</div><div style="font-size:16px;line-height:1.3;color:#4a3d2c">Plus one Tactic card from your hand, face down, with an order token on it. Handled at the table.</div></div>`,
      rules([['Special orders', inEffect(ctx, 'Storm in the Skies') ? "As many as your King's Court stars allow, minus 2: Storm in the Skies is face up this round." : "As many as your King's Court stars allow; Storm in the Skies: 2 fewer."], ['Master of Ships', 'May use a normal sea order as the special one.'], ['Tactic card', `Its order must match the card's icon or it does nothing. ${banned}`]])),
      `<div style="display:flex;flex-direction:column;min-width:0"><div style="font:600 14px ${BAR};color:#66543d;margin-bottom:2px">What the special orders do</div>${sp}</div>`, '330px minmax(0,1fr)'),
      footer: '', source: 'Base game p. 22, EPIC p. 12' };
  },

  P3: () => ({ body: split(focus(null, 'Flip all orders and Tactic cards', 'Then the immediate Tactic effects follow in Sword order.'),
    rules([['Order does not match the Tactic', 'The Tactic has no effect.'], ['The Blade holder', 'Its Tactic works without an order.'], ['Orders', 'Stay on the board; the app does not record them.']])),
    footer: footer([next('Revealed')]), source: 'EPIC p. 12' }),

  P4: () => ({ body: split(focus(null, 'Resolve immediate Tactic effects', 'In Sword order, each house with an immediate effect on its revealed Tactic card resolves it.'),
    rules([['Ongoing effects', 'Last the whole round; once-per-round options can be used later.'], ['End of the Action phase', 'Revealed Tactics are discarded; everyone draws back to 3.']])),
    footer: '', source: 'EPIC p. 12' }),

  P5: (ctx) => {
    const g = ctx.game, used = g.westeros.peeks.raven;
    const peeking = ctx.ui.peek === 'raven';
    const top = g.westeros.decks[4].draw[0];
    const topCard = top ? ctx.cardById[top] : null;
    const right = peeking && topCard
      ? col(`<div style="padding:10px 12px;border-radius:12px;background:#2b1f16;color:#eadfc8;display:flex;gap:12px;align-items:center"><img src="${cardImg(topCard)}" alt="${esc(topCard.name)}" style="height:110px;border-radius:8px"><div><div style="font:600 14px ${BAR};color:#ead08a">Eyes only: top of deck IV</div><div style="font-size:18px;font-weight:700">${esc(topCard.name)}</div></div></div>`,
        options([{ label: 'Keep on top', act: act('westeros/raven', { choice: 'keep' }) }, { label: 'Put at the bottom', act: act('westeros/raven', { choice: 'bottom' }) }]))
      : col(banner(used ? 'The Raven was used this round.' : 'Eyes only: the card opens only on the device that tapped Look, behind a curtain. Every other device shows which house is looking.'),
        options([{ label: 'Keep on top', disabled: true }, { label: 'Put at the bottom', disabled: true }]));
    return { body: split(col(focus(null, 'The Raven holder chooses', 'Swap one of your orders, or look at the top card of deck IV. Whoever holds the Raven taps it on their device.'),
      options([{ label: 'Swap one of my orders', sub: 'with an unused order token', act: act('record/set', { step: 'P5', house: ctx.house || 'greyjoy', value: 'swap', label: 'the Raven swapped an order', kind: 'step' }) },
        { label: 'Look at deck IV', sub: used ? 'already used this round' : 'keep it on top or put it at the bottom', selected: peeking, disabled: used && !peeking, act: used ? '' : act('raven/look') }]),
      rules([['Raided by Maneuver Warfare', 'No Raven this round.'], ['Afterwards (Mother of Dragons)', 'Remove Sea orders that sit on land areas.']])), right),
      footer: footer([next('Raven used'), { label: 'Pass', kind: 'secondary', act: act('step/next') }]), source: 'Base game, FAQ, EPIC p. 7, ruling B1' };
  },

  A1: () => ({ body: split(focus(null, 'Resolve Raid orders', 'Each Raid removes an adjacent enemy Raid, Support or Consolidate Power order. A special Raid may also remove Defense.'),
    rules([['A Consolidate Power is raided', 'The raider gains 1 Power, the owner loses 1.'], ['Special Raid', 'May instead steal 1 Gold or 1 Supply token from the raided house.'], ['Alliance or Dynasty', 'Cannot raid each other; a Truce may.'], ['Mountain border', 'No Raid across it (a river allows it).']])),
    footer: '', source: 'EPIC p. 10, 12, 18' }),

  A2: (ctx) => ({ ...battleGuide(ctx), cardsNow: '' }),

  A3: (ctx) => ({ body: split(col(focus(null, 'Resolve Consolidate Power orders', 'For each order, choose one of the three below.'), rules([['At sea', 'Only Gold.']])),
    rows([[[], '1 Power or 1 Gold', 'no extra for icons'], [[], 'Supply tokens: 1 per Supply icon here', 'max 3 held'], [[], 'Build a Fortification: only with no castle or fortification here', 'from the stock']], 'Choose one')),
    footer: footer([{ label: 'A Fortification was built: take one from the stock', kind: 'secondary', act: act('stock/take', { item: 'fortification' }), disabled: !ctx.game.stock.fortification.left }]),
    source: 'EPIC p. 12–13' }),

  A4: (ctx) => {
    const coin = ctx.game.council.coin;
    return { body: split(rows([[[], '1 Power per Power icon in your areas', ''], [[], '1 Gold per Port with a Ship and no enemy Ship in front', ''], [[], 'Braavos holder: 1 Gold', ''],
      [coin ? [coin] : [], coin ? 'Master of Coin: 1 Gold' : 'Master of Coin: nobody this round', ''], [[], 'Update the Supply track', '']], 'Checklist'),
      rules([['Ports', 'Ships of Alliance or Dynasty partners are not enemies.'], ['Supply track', 'Set it lower to gain Supply tokens, or higher by spending them. Never more than 3 tokens.'], ['Tokens', "Change each house's tokens on the Houses tab."]])),
      footer: footer([next('Everyone done'), { label: 'Open Houses', kind: 'secondary', href: '#/houses' }]), source: 'EPIC p. 13' };
  },

  A5: (ctx) => {
    const g = ctx.game, me = ctx.house;
    const rec = g.records.A5 || {};
    const states = Object.fromEntries(HOUSE_IDS.map((h) => [h, rec[h] ? ['done', rec[h]] : ['wait', 'waiting']]));
    if (me) states[me] = ['you', rec[me] ? `you: ${rec[me]}` : 'you'];
    const items = ['port', 'fortification', 'stronghold', 'bridge', 'footmen', 'knights', 'ships', 'siege', 'merccards'].map((id) => {
      const s = STOCK.find((x) => x.id === id), left = g.stock[id].left;
      return { label: s.id === 'footmen' ? 'Mercenary footman' : s.id === 'knights' ? 'Mercenary knight' : s.id === 'ships' ? 'Mercenary ship' : s.id === 'siege' ? 'Siege engine' : s.name,
        sub: id === 'merccards' ? s.cost : `${s.cost.replace(/, or free with Consolidate$/, '')}, ${left} left`, disabled: !left || !me,
        act: left && me ? act('stock/take', { item: id, house: me, step: 'A5' }) : '' };
    });
    items.push({ label: 'Other, 2 Gold', sub: 'Garrison, Supply, gift', disabled: true });
    return { queue: queue(HOUSE_IDS, states, 'Last action'),
      body: split(col(me ? focus(me, `Your turn, ${houseName(me)}?`, 'Buy one thing or pass; passing ends your buying. Gold is paid at the table, the app takes it from the stock.') : banner('Choose the house this device plays to buy here.')),
        `<div class="k-buy">${options(items, 5)}</div>`, '330px minmax(0,1fr)'),
      footer: footer([me ? { label: `${houseName(me)} passes`, kind: 'secondary', act: act('record/set', { step: 'A5', house: me, value: 'passed', label: 'passes in Spend Gold', kind: 'market' }) } : { label: 'Choose your house', kind: 'primary', href: '#/choose' },
        { label: 'Open Market', kind: 'secondary', href: '#/market' }]),
      source: 'EPIC p. 13–15', move: me && !rec[me] ? [me] : [] };
  },

  A6: () => ({ body: split(rows([[[], 'Remove all orders from the board', ''], [[], 'Discard revealed Tactics, draw back to 3', ''], [[], 'Every castle still under siege: its defender loses 1 Supply step or 1 unit there', ''], [[], 'Stand routed units up; flip the Blade and the Raven back', '']], 'Checklist'),
    rules([['Sieges', 'Known only at the table; the app does not track them.'], ['Supply step', 'A Supply token may be discarded instead.'], ['Round effects end', "Drought, Storm in the Skies and this round's Tactic effects."]])),
    footer: footer([next('Clean up done')]), source: 'Base game p. 16, EPIC p. 12, 16' }),

  E1: (ctx) => {
    const g = ctx.game, me = ctx.house;
    const rec = g.records.E1 || {};
    const states = Object.fromEntries(HOUSE_IDS.map((h) => [h, rec[h] ? ['done', rec[h]] : ['wait', 'waiting']]));
    if (me && !rec[me]) states[me] = ['you', 'you'];
    const vp = ctx.ui.vp ?? 2;
    return { queue: queue(HOUSE_IDS, states, 'Scored or passed'),
      body: split(me ? focus(me, `Score an Objective, ${houseName(me)}?`, 'Reveal one Objective card you have achieved, score its VP, then draw back to 3.') : banner('Choose the house this device plays to score here.'),
        col(stepper('VP on the card', vp, act('ui/add', { vp: -1, min: 0 }), act('ui/add', { vp: 1 })), rules([['VP per card', 'Differs per house: read it from the card.'], ['House Objectives', 'Not used in this game.']]))),
      footer: footer(me ? [{ label: 'Score it', kind: 'primary', act: act('objective/score', { house: me, vp }), disabled: Boolean(rec[me]) },
        { label: 'Pass', kind: 'secondary', act: act('record/set', { step: 'E1', house: me, value: 'passed', label: 'no Objective this round', kind: 'houses' }), disabled: Boolean(rec[me]) }]
        : [{ label: 'Choose your house', kind: 'primary', href: '#/choose' }]),
      source: 'EPIC p. 6', move: me && !rec[me] ? [me] : [] };
  },

  E2: (ctx) => {
    const g = ctx.game, v = victory(g);
    const dyn = v.dynasties[0];
    const winner = g.winner;
    const lines = [[[v.topVp.h], `7 Victory Points: highest is ${houseName(v.topVp.h)}`, String(v.topVp.v)],
      [[v.topCastles.h], `7 Castles or Strongholds: highest is ${houseName(v.topCastles.h)}`, String(v.topCastles.v)],
      [dyn ? [dyn.a, dyn.b] : [], dyn ? 'Dynasty: 10 VP and 10 castles together' : 'Dynasty: no Dynasty yet', dyn ? `${dyn.vp}, ${dyn.castles}` : '–'],
      [[], 'Throne, Blade or Raven held 4 rounds; Dynasty leading tracks', 'table']];
    const status = winner ? banner(`${houseName(winner.house)} has won${winner.reason ? ': ' + winner.reason : ''}.`, 'good')
      : v.winners.length ? banner(`${v.winners.map((w) => `${houseName(w.house)} (${w.reason})`).join(', ')} may have won: confirm below.`, 'good')
      : g.round >= 12 ? banner('Round 12 is over: highest VP plus castles wins.', 'good') : banner(`Nobody has won. Round ${g.round + 1} starts.`, 'good');
    const picking = ctx.ui.pickWinner;
    const pick = picking ? options(HOUSES.map((h) => ({ label: h.name, act: act('win/confirm', { house: h.id, reason: v.winners.find((w) => w.house === h.id)?.reason || 'confirmed at the table' }) })), 3) : '';
    return { body: split(rows(lines, 'Win conditions'), col(status, pick, rules([['Several winners', 'Single houses beat a Dynasty; then the highest VP plus castles; then Throne order.'], ['After round 12', 'Highest VP plus castles wins.']]))),
      footer: footer([{ label: g.round >= 12 ? 'Game over' : `Start round ${g.round + 1}`, kind: 'primary', act: act('step/next'), disabled: g.round >= 12 },
        { label: picking ? 'Cancel' : 'A house has won', kind: 'secondary', act: act('ui/set', { pickWinner: !picking }) }]),
      source: 'EPIC p. 5' };
  }
};

// ---- Action 2: the general, resettable battle guide (canvas board Round-MarchToBattle) ----
const KINDS = [['land', 'Field battle'], ['siege', 'Siege'], ['sea', 'Sea battle'], ['neutral', 'Neutral force'], ['move', 'Moving']];
const SUPPORT_RULES = 'Dynasty can’t refuse; Truce or better never backs the other side. Ships back a land battle at −1 and lose that order. None across Mountain or River borders. Power gifts only now.';
const TIDES = ['Each side draws one Tides of Battle card and looks at it (all Tides cards are reshuffled before each battle).'];
const BLADE = ['If its holder fights here and has not used it this round: discard its Tides card and draw a new one before the reveal, or add +1 after it.'];
const CARD_ORDER = 'Card texts: Ignore and Cancel first, then "immediately", then the rest, each in Throne order. Win or lose texts once the winner is known; "after combat" at the very end.';
const GUIDE_STEPS = {
  land: [
    ['turn', 'Call for support', ['Every house with a Support order next to the battle says whom it backs: attacker, defender or neither.', SUPPORT_RULES]],
    ['all', 'Reveal House cards', ['Attacker and defender each choose a House card and reveal them together.', CARD_ORDER]],
    ['all', 'Tides of Battle', TIDES],
    ['one', 'Valyrian Steel Blade', BLADE],
    ['all', 'Add up, find the winner', ['Footman 1, Knight 2, Siege engine 0 (it counts only in a siege). An army with an Archer and a Defense or Support order gets +1. Add order bonus, support, House card and Tides.', 'Higher total wins. A tie is Matching Forces: both sides take casualties, and the house higher on the Fiefdoms track still wins.']],
    ['turn', 'Casualties, retreat, hostage', ['Swords beyond the loser’s towers: one casualty each. Skulls on a Tides card: one casualty each for the other side, whoever wins.', 'Hostage: the winner may take one casualty fewer, or destroy an army that cannot retreat, to claim the loser’s House card; the loser can pay 4 Power to stop it. At most 2 hostages.', 'A losing attacker goes back where it came from; a losing defender retreats to one adjacent empty or own area. Retreated units are routed; units that cannot retreat are destroyed.', 'Taking a Castle or Stronghold: Loot 1 Gold, 1 Supply token, or pay 1 Power for a hostage from the loser’s cells.']]
  ],
  siege: [
    ['one', 'Defender: siege or normal', ['When the attacker marches in, the defender of the castle chooses: a siege, or a normal battle (ruling V3-1: before the Call for support).', 'Normal battle: switch the guide to Field battle.']],
    ['turn', 'Call for support', ['Every house with a Support order next to the castle says whom it backs: attacker, defender or neither.', SUPPORT_RULES]],
    ['all', 'Reveal House cards', ['Both sides choose a House card and reveal them together.', 'Hidden Mole: after the reveal, the attacker or an attack supporter may turn the siege into a normal battle.']],
    ['all', 'Tides of Battle', TIDES],
    ['one', 'Valyrian Steel Blade', BLADE],
    ['all', 'Add up, siege values', ['Knights count 1. An army with an Archer gets +1. Siege engines count 4 attacking (or supporting the attack), 2 defending.', 'Defense order: +1 tower; a special Defense order at a Stronghold: +2. Then compare the totals as in a field battle.']],
    ['turn', 'Result', ['Nobody retreats or is routed. Defender wins: the attacker only takes the sword casualties.', 'Attacker wins: extra swords equal to the strength difference. No defenders left: the attacker takes the castle, whoever won a tie (ruling C7), and may Loot.', 'Defenders left: the castle stays besieged; at Clean up the defender loses 1 Supply step or 1 unit there.', 'Escape Tunnels: a defender who loses takes no casualties and retreats normally.']]
  ],
  sea: [
    ['turn', 'Call for support', ['Only ships support a sea battle: houses with ships on a Support order next to the sea area say whom they back.']],
    ['all', 'Reveal House cards', ['Both sides choose a House card and reveal them together.', CARD_ORDER]],
    ['all', 'Tides of Battle', TIDES],
    ['one', 'Valyrian Steel Blade', BLADE],
    ['all', 'Add up, find the winner', ['Each ship counts 1; an army with a Flagship gets +1. Add order bonus, support, House card and Tides.', 'Higher total wins; a tie is Matching Forces, as on land.']],
    ['turn', 'Casualties and retreat', ['Swords beyond the loser’s towers: one ship each; skulls on a Tides card: one each for the other side.', 'Losing attacker: back where it came from. Losing defender: an adjacent empty or own sea area, or an own port. Ships that cannot retreat are destroyed.']]
  ],
  move: [
    ['turn', 'March and move', ['Units move to adjacent areas or by ship transport; one March order starts at most one battle. Leaving an area empty: a Power token can keep it.',
      'Knights may move 2 areas if neither move starts a battle; then they are routed. Swamp border: a marching Knight counts 1 this round and gets no second move.',
      'Mountain or River border: only one Footman or Archer crosses, and only without a battle. A Bridge connects the two areas across its river.',
      'Open Sea: fleets of several houses may share it; whoever moves in decides whether to fight. Ship transport through it only if everyone there is at Alliance or Dynasty.']]
  ],
  neutral: [
    ['turn', 'Call for support', ['Houses with a Support order next to the area may back the attacker. The neutral force gets no support.']],
    ['one', 'Add up the attacker', ['Units, March order bonus and support. No House cards, no Tides of Battle, no Valyrian Steel Blade.']],
    ['one', 'Result', ['Equal to or above the value on the token: remove the token and move in.', 'Below it: the units cannot move into that area.']]
  ]
};
const GM = { all: ['≡ both sides', '#8a5e12'], turn: ['→ in turn', '#2d5878'], one: ['● one house', '#5d3f7a'] };

function battleGuide(ctx) {
  const kind = ctx.ui.battleKind || 'land';
  const list = GUIDE_STEPS[kind];
  const step = Math.min(ctx.ui.battleStep || 0, list.length - 1);
  const showCards = Boolean(ctx.ui.battleCards);
  const [nm, ntitle, nlines] = showCards ? ['all', 'Cards that can act in a battle', TRIGGERS.A2battle.split('. ').map((t) => t.replace(/\.$/, '') + '.')] : list[step];
  const last = step === list.length - 1;
  const kinds = KINDS.map(([k, label]) => `<button type="button" aria-pressed="${k === kind}" ${act('ui/set', { battleKind: k, battleStep: 0, battleStatus: '', battleCards: false })} style="min-height:44px;padding:0 14px;border-radius:10px;font:600 15px ${BAR};${k === kind ? 'border:0;background:#8d2a22;color:#fbe9cf' : 'border:1px solid rgba(42,32,23,.4);background:rgba(255,255,255,.3);color:#2a2017'}">${label}</button>`).join('');
  const steps = list.map(([m, title], i) => {
    const state = i < step ? 'done' : i === step ? 'now' : 'next';
    const box = 'flex:1;min-width:0;min-height:52px;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;gap:1px;padding:4px 8px;text-align:left;border-radius:8px;'
      + (state === 'now' ? 'border:0;background:#8d2a22;color:#fbe9cf' : state === 'done' ? 'border:0;background:rgba(42,32,23,.12);color:#66543d' : 'background:rgba(255,255,255,.35);color:#2a2017;border:1px dashed rgba(42,32,23,.35)');
    return `<li style="display:flex"><button type="button" ${state === 'now' ? 'aria-current="step"' : ''} ${act('ui/set', { battleStep: i, battleStatus: '', battleCards: false })} style="${box}"><span style="font:600 12px ${BAR};color:${state === 'now' ? '#fbe9cf' : GM[m][1]}">${state === 'done' ? '✓ ' : ''}${GM[m][0]}</span><span style="font-size:14px;line-height:1.1">${esc(title)}</span></button></li>`;
  }).join('');
  const backOff = step === 0;
  const drought = inEffect(ctx, 'Drought') ? `<p style="margin:0;font:600 15px ${BAR};color:#8a5e12">Drought this round: river borders are passable.</p>` : '';
  const body = `<p style="margin:0;font-size:15px;color:#4a3d2c">Play the March orders at the table; walk through each fight here. The app doesn't know the map, units or orders.</p>${drought}
    <section aria-labelledby="mb-guide" style="flex:1;min-height:0;display:flex;flex-direction:column;gap:8px;padding:10px 14px;border-radius:12px;background:rgba(42,32,23,.07);border:2px solid #8d2a22">
      <div class="k-guidehead" style="display:flex;align-items:center;gap:10px">
        <h2 id="mb-guide" style="margin:0;font-size:20px">Battle guide</h2>
        <div role="group" aria-label="Kind of battle" class="k-kinds" style="flex:1;display:flex;gap:6px;flex-wrap:wrap">${kinds}</div>
        <button type="button" aria-pressed="${showCards}" ${act('ui/set', { battleCards: !showCards })} style="flex:none;min-height:44px;padding:0 14px;border-radius:10px;font:600 15px ${BAR};${showCards ? 'border:0;background:#2a2017;color:#e8d7ae' : 'border:1px solid rgba(42,32,23,.45);background:transparent;color:#2a2017'}">Cards</button>
        <button type="button" ${act('ui/set', { battleKind: 'land', battleStep: 0, battleStatus: 'Guide reset', battleCards: false })} style="flex:none;min-height:44px;display:flex;align-items:center;gap:6px;padding:0 14px;border-radius:10px;border:1px solid rgba(42,32,23,.45);background:transparent;color:#2a2017;font:600 15px ${BAR}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4v6h6"/><path d="M4.6 15a8 8 0 1 0 1.9-8.3L4 10"/></svg>Reset guide</button>
      </div>
      <ol aria-label="Battle steps" class="k-guidesteps" style="list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px">${steps}</ol>
      <div style="flex:1 1 auto;min-height:72px;overflow:auto;padding:10px 14px;border-radius:10px;background:rgba(255,255,255,.4);border:1px solid rgba(42,32,23,.2)">
        <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:4px"><span style="font:600 13px ${BAR};color:#66543d">${showCards ? 'All battles' : `Step ${step + 1} of ${list.length}`}</span><h3 style="margin:0;font-size:21px">${esc(ntitle)}</h3><span style="font:600 13px ${BAR};color:${GM[nm][1]}">${GM[nm][0]}</span></div>
        <ul style="margin:0;padding:0 0 0 18px;font-size:15px;line-height:1.35">${nlines.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <button type="button" ${backOff ? 'aria-disabled="true"' : act('ui/set', { battleStep: step - 1, battleStatus: '', battleCards: false })} style="min-height:48px;padding:0 16px;border-radius:10px;border:1px solid rgba(42,32,23,.45);background:transparent;color:#2a2017;font:600 16px ${BAR};${backOff ? 'opacity:.4;cursor:default' : ''}">‹ Previous battle step</button>
        <button type="button" ${act('ui/set', last ? { battleStep: 0, battleStatus: kind === 'move' ? 'Ready for the next March order.' : 'Battle done. Ready for the next one.', battleCards: false } : { battleStep: step + 1, battleStatus: '', battleCards: false })} style="min-height:48px;padding:0 18px;border-radius:10px;border:0;background:#2a2017;color:#e8d7ae;font:600 16px ${BAR}">${last ? (kind === 'move' ? 'Done' : 'Battle done, reset') : 'Next battle step ›'}</button>
        <span role="status" style="font:600 14px ${BAR};color:#3f6b2a">${esc(ctx.ui.battleStatus || '')}</span>
      </div>
    </section>`;
  return { body, footer: '', source: 'Base game p. 18–23, FAQ p. 1, EPIC p. 12, 15–18, Matching Forces' };
}

// After a confirmed win (no canvas board for this; styled like the start screen). "Back to the round" hides it on this device.
function endScreen(ctx) {
  const g = ctx.game, w = g.winner;
  const reason = w.reason ? w.reason[0].toUpperCase() + w.reason.slice(1) : 'Confirmed at the table';
  const b = 'min-height:56px;padding:0 24px;border-radius:14px;font-size:19px;font-weight:600';
  const standing = HOUSE_IDS.map((h) => ({ h, vp: g.houses[h].vp, c: effectiveCastles(g, h) })).sort((x, y) => (y.vp + y.c) - (x.vp + x.c) || y.vp - x.vp);
  const list = standing.map((s, i) => `<li style="display:grid;grid-template-columns:24px 30px minmax(0,1fr) auto;gap:10px;align-items:center;padding:5px 0;border-top:1px solid #3b2a1d"><span style="font:600 16px ${BAR};color:#b9a88a">${i + 1}</span><img src="${sigil(s.h)}" alt="" style="width:30px;height:30px"><span style="font-size:18px;text-align:left${s.h === w.house ? ';font-weight:700;color:#ead08a' : ''}">${esc(houseName(s.h))}</span><span style="font:600 16px ${BAR}">${s.vp} VP, ${s.c} castles</span></li>`).join('');
  const main = `<main class="k-main" style="flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;gap:14px;padding:24px 20px;text-align:center;overflow:auto">
    <img src="${sigil(w.house)}" alt="" style="width:84px;height:84px">
    <h1 style="margin:0;font-size:38px">${esc(houseName(w.house))} has won</h1>
    <p style="margin:0;font-size:18px;color:#b9a88a">${esc(reason)}, round ${w.round}.</p>
    <ol style="list-style:none;margin:0;padding:0;width:100%;max-width:900px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr));column-gap:32px">${list}</ol>
    <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center">
      <button type="button" ${act('ui/set', { hideEnd: true })} style="${b};border:1px solid #5a4330;background:#3b2a1d;color:#eadfc8">Back to the round</button>
      ${ctx.replay ? '' : `<button type="button" ${act('replay/open', { id: 'current', at: 0 })} style="${b};border:1px solid #5a4330;background:#3b2a1d;color:#eadfc8">Watch the replay</button>
      <button type="button" ${act('replay/open', { id: 'current', at: 'end', view: 'summary' })} style="${b};border:1px solid #5a4330;background:#3b2a1d;color:#eadfc8">Round summary</button>
      <button type="button" ${act('game/menu')} style="${b};border:0;background:#c9a24c;color:#211710">New game or example…</button>`}
    </div>
    <p style="margin:0;font-size:15px;color:#b9a88a">A wrong win? Undo in the top bar takes it back.</p></main>`;
  return frame({ game: g, house: ctx.house, tab: 'round', body: main, move: [w.house] });
}

export function renderRound(ctx) {
  if (ctx.game.winner && !ctx.ui.hideEnd) return endScreen(ctx);
  const step = stepById(ctx.game.step);
  const r = STEP_RENDER[step.id](ctx);
  const s = { ...step, mode: r.mode || step.mode };
  const bodyHtml = (r.queue || '') + r.body;
  const main = stepFrame(ctx.game, s, { title: r.title, modeText: r.modeText, bodyHtml, footerHtml: r.footer, source: r.source, cardsNow: r.cardsNow ?? TRIGGERS[step.id] });
  return frame({ game: ctx.game, house: ctx.house, tab: 'round', body: main, move: r.move || [] });
}
