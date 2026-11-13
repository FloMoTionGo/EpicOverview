// Screen chrome copied from the canvas boards: header, seats bar, tab bar, step frame.
import { HOUSES, LOAN, sigil, houseName, ROUNDS } from '../core/data.js';
import { councilSeat, loansOf } from '../core/rules.js';
import { neighbours } from '../core/steps.js';
import { esc, act, BAR } from './kit.js';

export const RING = 'assets/icons/ring-gold.webp';
export const RING_USED = 'assets/icons/ring-outline.webp';
const CHEV_L = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
const CHEV_R = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';

export const TABS = [['round', 'Round'], ['houses', 'Houses'], ['relations', 'Relations'], ['westeros', 'Westeros'], ['loans', 'Loans'], ['market', 'Market'], ['log', 'Log']];

export function header(game, house, opts = {}) {
  const chip = house
    ? `<a href="#/choose" class="k-playing" aria-label="Playing as ${esc(houseName(house))} on this device. Change house" style="min-height:48px;box-sizing:border-box;display:flex;align-items:center;gap:8px;padding:0 14px 0 6px;border-radius:24px;border:1px solid #5a4330;background:#2b1f16;color:#eadfc8;text-decoration:none"><img src="${sigil(house)}" alt="" style="width:36px;height:36px"><span class="k-playing-text" style="line-height:1.05"><span style="display:block;font:500 12px ${BAR};color:#b9a88a">Playing as</span><span style="font-size:17px;font-weight:600">${esc(houseName(house))}</span></span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b9a88a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></a>`
    : '';
  const undo = opts.noUndo ? '' : `<button type="button" ${act('undo')} style="min-height:48px;padding:0 18px;border-radius:10px;border:1px solid #5a4330;background:#3b2a1d;color:#eadfc8;font-size:16px">Undo</button>`;
  const round = game ? game.round : '·';
  // phones (board "A-Phone"): the view name as heading and a small "Round 4"; shown by app.css below 760px
  const tabName = (TABS.find(([id]) => id === opts.tab) || [])[1];
  const phone = tabName ? `<h1 class="k-phonetitle" style="display:none;margin:0;flex:1;font-size:26px">${esc(tabName)}</h1><span class="k-phoneround" style="display:none;font:600 14px ${BAR};color:#b9a88a">Round ${round}</span>` : '';
  return `<header class="k-header" style="height:68px;flex:none;display:flex;align-items:center;gap:20px;padding:0 20px;border-bottom:1px solid #5a4330">
    ${phone}<div class="k-roundbox" style="display:flex;align-items:center;gap:12px">
      <div style="width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 35% 30%,#c4473a,#8d2a22 55%,#5e1912);box-shadow:0 0 0 3px #211710,0 0 0 5px #c9a24c;font:600 22px ${BAR};color:#fbe9cf">${round}</div>
      <div style="line-height:1.1"><div style="font-size:20px;font-weight:700">Round ${round}</div><div style="font-size:14px;color:#b9a88a">of ${ROUNDS}</div></div>
    </div>
    <div class="k-spacer" style="flex:1"></div>
    ${opts.status || ''}${chip}${undo}
  </header>`;
}

const loanStyle = (kind, w = 12, h = 17) => `display:block;flex:none;width:${w}px;height:${h}px;border-radius:2px;box-shadow:0 1px 2px rgba(0,0,0,.6);`
  + (kind === 'gold' ? 'background:linear-gradient(160deg,#f0d77a,#a8801f);border:1px solid #5e4a12' : 'background:linear-gradient(160deg,#d0503f,#7a1a14);border:1px solid #3a0d0a');
export const loanIcons = (game, h, w, hh) => loansOf(game, h).map((l) =>
  `<span role="img" aria-label="${l.kind === 'gold' ? 'Gold loan' : 'Red loan: ' + esc(l.long)}" title="${l.kind === 'gold' ? 'Gold loan' : 'Red loan: ' + esc(l.long)}" style="${loanStyle(l.kind, w, hh)}"></span>`).join('');

export function badges(game, h) {
  const seat = councilSeat(game, h);
  return seat ? seat.short : 'No council seat';
}

export function seatsBar(game, move = []) {
  return `<section aria-label="Houses" class="k-seats" style="height:88px;flex:none;display:grid;grid-template-columns:repeat(9,minmax(0,1fr));gap:6px;padding:8px 20px;border-top:1px solid #5a4330;background:rgba(0,0,0,.25)">
    ${HOUSES.map(({ id, name, color }) => {
      const x = game.houses[id];
      const box = `position:relative;display:flex;flex-direction:column;justify-content:space-between;gap:1px;min-width:0;padding:5px 8px;text-align:left;color:#eadfc8;border-radius:0 0 8px 8px;border-top:4px solid ${color};`
        + (move.includes(id) ? 'border-left:2px solid #ead08a;border-right:2px solid #ead08a;border-bottom:2px solid #ead08a;background:rgba(201,162,76,.18)'
          : 'border-left:1px solid #5a4330;border-right:1px solid #5a4330;border-bottom:1px solid #5a4330;background:rgba(59,42,29,.6)');
      const stat = (v, l) => `<span style="font:600 16px ${BAR}">${v}<span style="display:block;font:500 11px ${BAR};color:#b9a88a">${l}</span></span>`;
      return `<a href="#/houses" class="k-seat" style="${box};text-decoration:none">
        <span style="display:flex;align-items:center;gap:6px;min-width:0">
          <img src="${sigil(id)}" alt="" style="width:30px;height:30px;flex:none">
          <span style="font-size:14px;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(name)}</span>
          <img src="${x.ring ? RING : RING_USED}" alt="${x.ring ? 'Ring still available' : 'Ring used'}" title="${x.ring ? 'Ring still available' : 'Ring used'}" style="width:22px;height:22px;flex:none">
        </span>
        <span style="display:grid;grid-template-columns:repeat(4,auto);justify-content:space-between;text-align:center;line-height:1">${stat(x.castles, 'castles')}${stat(x.vp, 'VP')}${stat(x.obj, 'obj.')}${stat(x.supply, 'supply')}</span>
        <span style="font:500 12px ${BAR};color:#ead08a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:32px">${esc(badges(game, id))}</span>
        <span style="position:absolute;right:6px;bottom:5px;display:flex;gap:3px">${loanIcons(game, id)}</span>
      </a>`;
    }).join('')}
  </section>`;
}

export function tabBar(current) {
  return `<nav aria-label="Views" class="k-tabs" style="height:64px;flex:none;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));border-top:1px solid #5a4330;background:#1a120c">
    ${TABS.map(([id, name]) => `<a href="#/${id}" ${id === current ? 'aria-current="page"' : ''} style="min-height:56px;display:flex;align-items:center;justify-content:center;text-decoration:none;font-size:17px;${id === current ? 'color:#ead08a;box-shadow:inset 0 3px 0 #c9a24c' : 'color:#b9a88a'}">${name}</a>`).join('')}
  </nav>`;
}

export function frame({ game, house, tab, body, move, noSeats }) {
  return `<div class="k-root" style="box-sizing:border-box;display:flex;flex-direction:column;background:#211710;color:#eadfc8;font-family:'EB Garamond',Georgia,serif;overflow:hidden">
    ${header(game, house, { tab })}
    ${body}
    ${noSeats ? '' : seatsBar(game, move)}
    ${tabBar(tab)}
  </div>`;
}

// ---- step frame -------------------------------------------------------------
const MODE = { seq: ['⇢ One by one', '#c9a24c'], all: ['≡ All at once', '#c9a24c'], turn: ['→ In turn', '#8fa8bd'], one: ['● One house', '#d9c6e8'] };
const MODE_BOX = { seq: '#5e4a1c', all: '#5e4a1c', turn: '#2d3a45', one: '#47385a' };
const MODE_ICON = {
  seq: '<path d="M4 12h4M10 12h4M16 12h4"/><path d="M18 9l3 3-3 3"/>',
  all: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  turn: '<circle cx="4" cy="12" r="2.4"/><circle cx="12" cy="12" r="2.4"/><circle cx="20" cy="12" r="2.4"/><path d="M6.8 12h2.4M14.8 12h2.4"/>',
  one: '<circle cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r="8"/>'
};

function fadedChip(s, opacity, done) {
  const [name, col] = MODE[s.mode];
  const tail = done ? `<span style="margin-left:auto;font:600 14px ${BAR};color:#c9a24c">done</span>` : '';
  return `<button type="button" ${act('step/goto', { step: s.id })} class="k-fade" style="flex:1;min-width:0;height:48px;box-sizing:border-box;display:flex;align-items:center;gap:10px;padding:0 14px;border-radius:12px;border:1px solid #4a3626;background:rgba(59,42,29,.45);white-space:nowrap;overflow:hidden;opacity:${opacity};color:#eadfc8;text-align:left">`
    + `<span style="flex:none;font:600 13px ${BAR};padding:3px 9px;border-radius:99px;border:1px solid ${col};color:${col}">${name}</span>`
    + `<span style="font-size:13px;color:#b9a88a;font-family:${BAR}">${esc(s.label)}</span><span style="font-size:17px;overflow:hidden;text-overflow:ellipsis">${esc(s.title)}</span>${tail}</button>`;
}

// Cards whose timing falls on this step. A long list folds away behind a tap so the step keeps its room.
function cardsLine(text) {
  const st = 'margin:0;flex:none;font-size:14px;line-height:1.3;color:#4a3d2c';
  if (text.length <= 160) return `<p class="k-cardsnow" style="${st}"><strong>Cards that can act now:</strong> ${esc(text)}.</p>`;
  return `<details class="k-cardsnow" style="${st}"><summary style="cursor:pointer;min-height:24px"><strong>Cards that can act now</strong> <span style="color:#66543d">(tap to show)</span></summary>${esc(text)}.</details>`;
}

export function stepFrame(game, step, { title, modeText, bodyHtml, footerHtml, source, cardsNow }) {
  const n = neighbours(step.id, game.round);
  const [mname] = MODE[step.mode];
  const head = `<div class="k-stephead" style="display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex:none"><div><p style="margin:0;font-size:15px;color:#66543d">${esc(step.phase)}, step ${step.n} of ${step.total}</p>`
    + `<h1 id="r-now" style="margin:0;font-size:32px;line-height:1.1">${esc(title || step.title)}</h1></div>`
    + `<div class="k-mode" style="flex:none;max-width:520px;display:flex;align-items:center;gap:10px;padding:8px 14px;border-radius:10px;background:${MODE_BOX[step.mode]};color:#f4ead6;font-size:16px;line-height:1.25">`
    + `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" style="flex:none">${MODE_ICON[step.mode]}</svg>`
    + `<span><strong>${esc(step.mode === 'seq' ? 'One after another' : mname.slice(2))}.</strong> ${esc(modeText || step.modeText)}</span></div></div>`;
  return `<main class="k-main" style="flex:1;min-height:0;display:flex;flex-direction:column;gap:8px;padding:12px 20px">
    <div class="k-steprow" style="display:flex;align-items:center;gap:10px;height:48px;flex:none">
      <button type="button" ${act('step/prev')} style="flex:none;min-width:168px;min-height:48px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:8px;border-radius:12px;border:1px solid #5a4330;background:#3b2a1d;color:#eadfc8;font-size:17px">${CHEV_L}Previous step</button>
      ${fadedChip(n.before[0], 0.35, true)}${fadedChip(n.before[1], 0.6, true)}
    </div>
    <article aria-labelledby="r-now" class="k-article" style="flex:1;min-height:0;display:flex;flex-direction:column;gap:10px;padding:14px 22px;border-radius:14px;color:#2a2017;background:linear-gradient(180deg,#e8d7ae,#dcc796);box-shadow:0 0 0 1px #120c08,0 0 0 7px #4a3121,0 0 0 8px rgba(201,162,76,.45),0 18px 36px rgba(0,0,0,.5);margin:8px;overflow:hidden">
      ${head}
      <div class="k-body" style="flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:10px">${bodyHtml}</div>
      ${cardsNow ? cardsLine(cardsNow) : ''}
      ${footerHtml || ''}
      <p style="margin:0;flex:none;font-size:13px;color:#5e4d37">Source: ${esc(source || '')}</p>
    </article>
    <div class="k-steprow" style="display:flex;align-items:center;gap:10px;height:48px;flex:none">
      ${fadedChip(n.after[0], 0.6, false)}${fadedChip(n.after[1], 0.35, false)}
      <button type="button" ${act('step/next')} style="flex:none;min-width:168px;min-height:48px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:8px;border-radius:12px;border:0;background:#c9a24c;color:#211710;font-size:17px;font-weight:600">Next step${CHEV_R}</button>
    </div>
  </main>`;
}
