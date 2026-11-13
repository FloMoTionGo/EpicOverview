// Westeros tab (canvas board "Westeros: decks and abilities") plus the eyes-only peek curtain.
import { houseName, sigil } from '../core/data.js';
import { frame } from '../ui/chrome.js';
import { esc, act, BAR } from '../ui/kit.js';

const DECK = ['', 'I', 'II', 'III', 'IV'];
const cardImg = (c) => `assets/${c.image}-t.webp`;

function deckColumn(ctx, d) {
  const { game: g } = ctx;
  const w = g.westeros, deck = w.decks[d];
  const c = w.revealed[d] ? ctx.cardById[w.revealed[d]] : null;
  const value = !c ? '' : d === 4 ? (c.bid ? 'bid' : 'event') : `value ${c.value ?? '–'}`;
  const valueStyle = `font:600 14px ${BAR};padding:3px 9px;border-radius:99px;` + (value === 'bid' ? 'background:#8d2a22;color:#fbe9cf' : 'background:#3b2a1d;color:#ead08a');
  const note = !c ? 'Not revealed this round.' : w.laws[d] === 'replace' ? `${c.name}: replaced the first card (Master of Laws).`
    : d === 4 && w.deck4 ? `${c.name}: ${w.deck4}.` : c.name;
  const sbtn = `min-height:48px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;padding:4px 6px;border-radius:10px;border:1px solid #5a4330;background:#3b2a1d;color:#eadfc8;font:600 14px ${BAR};line-height:1.1`;
  return `<section style="display:flex;flex-direction:column;gap:6px;min-width:0">
    <div style="display:flex;align-items:baseline;justify-content:space-between"><h2 style="margin:0;font-size:20px;font-style:italic;font-weight:400;color:#c9a24c">Deck ${DECK[d]}</h2>${value ? `<span style="${valueStyle}">${value}</span>` : ''}</div>
    <img src="${c ? cardImg(c) : `assets/backs/westeros${d}.webp`}" alt="${esc(c ? c.name : `Deck ${DECK[d]}, face down`)}" style="height:150px;width:auto;max-width:100%;align-self:center;border-radius:10px;box-shadow:0 10px 22px rgba(0,0,0,.5)">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
      <button type="button" ${act('westeros/shuffle', { deck: d, which: 'deck' })} aria-label="Shuffle deck ${DECK[d]}, ${deck.draw.length} in deck" style="${sbtn}">Shuffle deck<span style="font:500 12px ${BAR};color:#b9a88a">${deck.draw.length} in deck</span></button>
      <button type="button" ${deck.discard.length ? act('westeros/shuffle', { deck: d, which: 'discards' }) : 'aria-disabled="true"'} aria-label="Shuffle the ${deck.discard.length} discards back into deck ${DECK[d]}" style="${sbtn};${deck.discard.length ? '' : 'opacity:.45'}">Shuffle discards in<span style="font:500 12px ${BAR};color:#b9a88a">${deck.discard.length} discarded</span></button>
    </div>
    <p style="margin:0;font-size:15px;line-height:1.3">${esc(note)}</p>
  </section>`;
}

function ability(sigilHouse, role, sub, text, btn) {
  return `<article style="padding:14px 18px;border-radius:14px;color:#2a2017;background:linear-gradient(180deg,#e8d7ae,#dcc796);box-shadow:0 0 0 1px #120c08,0 0 0 6px #4a3121,0 0 0 7px rgba(201,162,76,.45);margin:7px;display:flex;flex-direction:column;gap:8px">
    <div style="display:flex;align-items:center;gap:10px">${sigilHouse ? `<img src="${sigil(sigilHouse)}" alt="" style="width:36px;height:36px">` : ''}<div style="line-height:1.15"><div style="font-size:20px;font-weight:700">${esc(role)}</div><div style="font-size:15px;color:#66543d">${esc(sub)}</div></div></div>
    <p style="margin:0;font-size:15px;line-height:1.35">${esc(text)}</p>${btn}</article>`;
}
const readyBtn = (label, a) => `<button type="button" ${a} style="min-height:52px;border-radius:12px;font-size:17px;border:0;background:#2a2017;color:#e8d7ae">${esc(label)}</button>`;
const laterBtn = (label, a = '') => `<button type="button" ${a || 'aria-disabled="true"'} style="min-height:52px;border-radius:12px;font-size:17px;border:1px dashed #8a7350;background:transparent;color:#66543d">${esc(label)}</button>`;

export function peekCurtain(ctx) {
  const p = ctx.ui.peek;
  if (!p || p.kind !== 'maester') return '';
  const w = ctx.game.westeros;
  const shown = p.decks.map((d) => {
    const id = w.decks[d].draw[0];
    const c = id ? ctx.cardById[id] : null;
    return `<figure style="margin:0;display:flex;flex-direction:column;align-items:center;gap:6px"><img src="${c ? cardImg(c) : `assets/backs/westeros${d}.webp`}" alt="${esc(c ? c.name : 'empty')}" style="height:180px;border-radius:10px"><figcaption style="font:600 16px ${BAR}">Deck ${DECK[d]}: ${esc(c ? c.name : 'empty')}</figcaption></figure>`;
  }).join('');
  return `<div role="dialog" aria-label="Eyes only" style="position:fixed;inset:0;z-index:30;background:#0b0705;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;color:#eadfc8;padding:20px">
    <div style="font:600 18px ${BAR};color:#ead08a">Eyes only: top of decks ${p.decks.map((d) => DECK[d]).join(' and ')}</div>
    <div style="display:flex;gap:24px;flex-wrap:wrap;justify-content:center">${shown}</div>
    <button type="button" ${act('ui/set', { peek: null })} style="min-height:52px;padding:0 28px;border-radius:12px;border:0;background:#c9a24c;color:#211710;font:600 18px ${BAR}">Hide the cards</button></div>`;
}

export function renderWesteros(ctx) {
  const { game: g, ui } = ctx;
  const w = g.westeros;
  const vals = [1, 2, 3].map((d) => (w.revealed[d] ? ctx.cardById[w.revealed[d]].value ?? 0 : null));
  const target = vals.every((v) => v !== null) ? vals.reduce((a, b) => a + b, 0) : null;
  const laws = g.council.laws, maester = g.council.maester;
  const lawsBtn = w.lawsUsed !== null ? laterBtn(`Used on deck ${DECK[w.lawsUsed]}`) : laterBtn('Decides in Westeros 2, after each reveal', act('step/goto', { step: 'W2' }));
  let maesterBtn;
  if (!maester) maesterBtn = laterBtn('Nobody sits on Grand Maester');
  else if (g.councilUsed.maester) maesterBtn = laterBtn('Used this round');
  else if (ui.maesterPick) {
    const chosen = ui.maesterDecks || [];
    maesterBtn = `<div role="group" aria-label="Choose two decks" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px">${[1, 2, 3, 4].map((d) => {
      const on = chosen.includes(d);
      const nextSel = on ? chosen.filter((x) => x !== d) : chosen.concat([d]).slice(-2);
      return `<button type="button" aria-pressed="${on}" ${act('ui/set', { maesterDecks: nextSel })} style="min-height:48px;border-radius:10px;font:600 16px ${BAR};${on ? 'border:0;background:#2a2017;color:#e8d7ae' : 'border:2px solid #2a2017;background:transparent;color:#2a2017'}">${DECK[d]}</button>`;
    }).join('')}</div>` + readyBtn(chosen.length === 2 ? `Look at decks ${chosen.map((d) => DECK[d]).join(' and ')}` : 'Choose two decks', chosen.length === 2 ? act('peek/maester', { decks: chosen }) : 'aria-disabled="true"');
  } else maesterBtn = readyBtn('Look at two decks, eyes only', act('ui/set', { maesterPick: true, maesterDecks: [] }));
  const body = `<main class="k-main k-westeros" style="flex:1;min-height:0;display:flex;flex-direction:column;gap:14px;padding:14px 20px;overflow:auto">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
      <h1 style="margin:0;font-size:26px">Westeros cards, round ${g.round}</h1>
      ${g.round === 1 ? `<button type="button" aria-disabled="true" style="min-height:48px;padding:0 16px;border-radius:10px;border:1px dashed #5a4330;background:transparent;color:#b9a88a;font-size:16px">Round 1 has no Westeros phase</button>`
        : `<button type="button" ${w.shown >= 4 ? 'aria-disabled="true"' : act('step/goto', { step: 'W2' })} style="min-height:48px;padding:0 16px;border-radius:10px;border:1px dashed #5a4330;background:transparent;color:#b9a88a;font-size:16px">${w.shown >= 4 ? 'Draw cards in the next Westeros phase' : 'Reveal the cards in Westeros 2'}</button>`}
    </div>
    <div class="k-decks" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px">${[1, 2, 3, 4].map((d) => deckColumn(ctx, d)).join('')}</div>
    <p style="margin:0;padding:10px 14px;border-radius:10px;background:#2b1f16;border:1px solid #5a4330;font-size:16px">Round target for deck IV: <strong style="font:600 20px ${BAR};color:#ead08a">${target ?? '…'}</strong>, the sum of the values on decks I to III. Winter is Coming shuffles its deck by itself; the shuffle buttons are for everything else.</p>
    <div class="k-abilities" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px">
      ${ability(laws, 'Master of Laws', `${laws ? houseName(laws) : 'Nobody'}, once per round`, 'Replace a revealed card of decks I to III with the next card of that deck, right after it is revealed (house rule).', lawsBtn)}
      ${ability(maester, 'Grand Maester', `${maester ? houseName(maester) : 'Nobody'}, once per round`, 'Look at the top card of any two Westeros decks. The cards open only on the device that taps it.', maesterBtn)}
      ${ability(null, 'Messenger Raven', 'Whoever holds the Raven, in Planning', 'After orders are revealed: look at the top of deck IV and keep it or put it at the bottom, instead of swapping an order.', w.peeks.raven ? laterBtn('Used this round') : laterBtn('Available in Planning 5', act('step/goto', { step: 'P5' })))}
    </div>
  </main>`;
  return frame({ game: g, house: ctx.house, tab: 'westeros', body }) + peekCurtain(ctx);
}
