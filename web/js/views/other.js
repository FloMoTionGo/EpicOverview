// Loans, Market, Log, choose-your-house and setup screens (canvas boards of the same names).
import { HOUSES, HOUSE_IDS, LOAN_CARDS, STOCK, SUPPLY_POOL, houseName, sigil, loanImage } from '../core/data.js';
import { loansOf, bankLeft, suppliesUsed } from '../core/rules.js';
import { stepById } from '../core/steps.js';
import { frame, header, RING } from '../ui/chrome.js';
import { esc, act, BAR } from '../ui/kit.js';
import { api } from '../api.js';

// ---------------- Loans (read-only) ----------------
export function renderLoans(ctx) {
  const g = ctx.game;
  const bank = bankLeft(g);
  const goldLeft = bank.gold.length;
  const tiles = [{ img: loanImage('gold-1'), label: `Gold loans, ${goldLeft} left`, caption: `Gold, ${goldLeft} left`, owner: null, faded: goldLeft === 0 }]
    .concat(LOAN_CARDS.filter((l) => l.kind === 'red').map((l) => ({ img: loanImage(l.id), label: `Red loan, ${l.long}${g.loans.held[l.id] ? ', taken by ' + houseName(g.loans.held[l.id]) : ''}`, caption: l.label, owner: g.loans.held[l.id] || null })));
  const bankHtml = tiles.map((t) => `<figure style="margin:0;position:relative">
      <img src="${t.img}" alt="${esc(t.label)}" style="width:100%;border-radius:8px;${t.owner || t.faded ? 'opacity:.4;filter:grayscale(.5)' : 'box-shadow:0 6px 14px rgba(0,0,0,.45)'}">
      ${t.owner ? `<img src="${sigil(t.owner)}" alt="" style="position:absolute;right:-4px;top:-6px;width:34px;height:34px">` : ''}
      <figcaption style="margin-top:4px;font:500 13px ${BAR};color:#b9a88a">${esc(t.caption)}</figcaption></figure>`).join('');
  const owing = HOUSE_IDS.filter((h) => loansOf(g, h).length);
  const ROWGRID = 'display:grid;grid-template-columns:200px 110px minmax(0,1fr) minmax(0,1fr) 120px;gap:12px';
  const rows = owing.map((h) => {
    const ls = loansOf(g, h);
    const gold = ls.filter((l) => l.kind === 'gold'), red = ls.filter((l) => l.kind === 'red');
    const first = ls[0];
    const count = `${gold.length ? gold.length + ' Gold' : ''}${gold.length && red.length ? ', ' : ''}${red.length ? red.length + ' Red' : ''}`;
    const pill = `font:600 14px ${BAR};padding:2px 8px;border-radius:99px;` + (gold.length ? 'background:#7a5d1e;color:#fbe9cf' : 'background:#8d2a22;color:#fbe9cf');
    const interest = gold.length ? `${gold.length} Gold or ${gold.length} Footman (Braavos picks which Footman)` : 'nothing';
    const penalty = red.length ? red.map((l) => l.long).join(', ') : 'nothing';
    return `<div role="row" class="k-owerow" style="${ROWGRID};align-items:center;min-height:72px;padding:6px 4px;border-top:1px solid #4a3626">
      <span role="cell" style="display:flex;align-items:center;gap:8px;font-size:18px;font-weight:600"><img src="${sigil(h)}" alt="" style="width:36px;height:36px">${esc(houseName(h))}</span>
      <span role="cell" style="display:flex;align-items:center;gap:6px"><img src="${loanImage(first.id)}" alt="${first.kind === 'gold' ? 'Gold loan' : 'Red loan'}" style="width:62px;border-radius:5px"><span style="${pill}">${count}</span></span>
      <span role="cell" style="font-size:16px;line-height:1.25">${esc(interest)}</span>
      <span role="cell" style="font-size:16px;line-height:1.25">${esc(penalty)}</span>
      <span role="cell" style="font:600 18px ${BAR};color:#ead08a">${6 * ls.length} Gold</span></div>`;
  }).join('');
  const none = HOUSE_IDS.filter((h) => !loansOf(g, h).length).map(houseName);
  const body = `<main class="k-main k-loans" style="flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr);padding:14px 20px;overflow:auto">
    <section aria-label="Loans" style="display:flex;flex-direction:column;gap:12px;min-height:0">
      <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap"><h1 style="margin:0;font-size:26px">In the bank</h1><span style="font:500 15px ${BAR};color:#b9a88a">${goldLeft} of 5 Gold loans, ${bank.red.length} of 5 Red loans left</span></div>
      <div class="k-bank" style="display:grid;grid-template-columns:repeat(6,minmax(0,128px));gap:10px">${bankHtml}</div>
      <h2 style="margin:4px 0 0;font-size:22px;font-style:italic;font-weight:400;color:#c9a24c">Who owes what</h2>
      <div role="table" aria-label="Loans per house" style="display:flex;flex-direction:column;border-top:1px solid #5a4330">
        <div role="row" class="k-owerow" style="${ROWGRID};padding:6px 4px;font:500 14px ${BAR};color:#b9a88a"><span role="columnheader">House</span><span role="columnheader">Loans</span><span role="columnheader">Owes each Diplomacy phase</span><span role="columnheader">While open</span><span role="columnheader">To pay back</span></div>
        ${rows || `<div style="padding:10px 4px;font-size:16px">Nobody holds a loan.</div>`}
      </div>
      <p style="margin:0;font-size:15px;color:#b9a88a">${none.length ? 'No loans: ' + esc(none.join(', ')) + '.' : ''} Loans are taken and paid back in the Round tab, Diplomacy 6.</p>
    </section></main>`;
  return frame({ game: g, house: ctx.house, tab: 'loans', body });
}

// ---------------- Market ----------------
export function renderMarket(ctx) {
  const g = ctx.game;
  const btn = 'flex:none;width:44px;height:44px;border-radius:50%;border:1px solid #5a4330;background:#3b2a1d;color:#eadfc8;font-size:20px;line-height:1';
  const line = (s, minHeight) => {
    const st = g.stock[s.id];
    const by = s.group === 'build' ? (st.by.length ? st.by.map(houseName).join(', ') : 'none built yet') : '';
    return `<div style="display:flex;align-items:center;gap:8px;min-height:${minHeight}px;border-top:1px solid #4a3626">
      ${s.token ? `<img src="${s.token}" alt="" style="width:30px;height:30px;object-fit:contain;flex:none">` : ''}
      <span style="flex:1;min-width:0;font-size:16px;line-height:1.15">${esc(s.name)}<span style="display:block;font:500 12px ${BAR};color:#b9a88a">${esc(s.cost)}</span>${by ? `<span style="display:block;font:500 12px ${BAR};color:#ead08a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(by)}</span>` : ''}</span>
      <button type="button" ${act('stock/take', { item: s.id })} aria-label="${esc(s.name)}: take one from the stock" style="${btn};${st.left ? '' : 'opacity:.35'}">−</button>
      <span style="flex:none;width:46px;text-align:center;white-space:nowrap;letter-spacing:-.02em;font:600 17px ${BAR}">${st.left} / ${s.total}</span>
      <button type="button" ${act('stock/return', { item: s.id })} aria-label="${esc(s.name)}: return one to the stock" style="${btn};${st.left < s.total ? '' : 'opacity:.35'}">+</button></div>`;
  };
  const sec = 'display:flex;flex-direction:column;padding:12px 14px;border-radius:12px;background:#2b1f16;border:1px solid #5a4330';
  const h2 = 'margin:0 0 4px;font-size:20px;font-style:italic;font-weight:400;color:#c9a24c';
  const body = `<main class="k-main k-market" style="flex:1;min-height:0;display:flex;flex-direction:column;gap:10px;padding:12px 20px;overflow:auto">
    <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap"><h1 style="margin:0;font-size:26px">Limited stock</h1><span style="font-size:15px;color:#b9a88a">Gold is paid at the table; the app only keeps count.</span></div>
    <div class="k-marketgrid" style="flex:1;min-height:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;align-items:start">
      <section aria-labelledby="m-build" style="${sec}"><h2 id="m-build" style="${h2}">Buildings</h2>${STOCK.filter((s) => s.group === 'build').map((s) => line(s, 62)).join('')}
        <p style="margin:6px 0 0;font-size:13px;color:#b9a88a">Count shows what is left. − takes one from the stock, + returns one.</p></section>
      <section aria-labelledby="m-merc" style="${sec}"><h2 id="m-merc" style="${h2}">Mercenaries and more</h2>${STOCK.filter((s) => s.group === 'merc').map((s) => line(s, 50)).join('')}</section>
      <section aria-labelledby="m-supply" style="${sec}">
        <div style="display:flex;align-items:center;gap:8px"><img src="assets/icons/token-supply.webp" alt="" style="width:26px;height:26px;object-fit:contain"><h2 id="m-supply" style="margin:0;flex:1;font-size:20px;font-style:italic;font-weight:400;color:#c9a24c">Supply tokens</h2></div>
        <div style="display:flex;align-items:baseline;gap:8px;margin-top:6px"><span style="font:600 34px ${BAR};line-height:1;color:#ead08a">${suppliesUsed(g)} / ${SUPPLY_POOL}</span><span style="font:500 14px ${BAR};color:#b9a88a">used / total</span></div>
        <p style="margin:6px 0 0;font-size:13px;color:#b9a88a">Each house changes its own supply in the Houses tab.</p></section>
    </div></main>`;
  return frame({ game: g, house: ctx.house, tab: 'market', body });
}

// ---------------- Log ----------------
const CHIPS = [['all', 'All changes'], ['round', 'This round'], ['relations', 'Relations'], ['loans', 'Loans'], ['houses', 'Houses'], ['westeros', 'Westeros']];
const timeOf = (iso) => (iso ? iso.slice(11, 16) : '');
export function renderLog(ctx) {
  const g = ctx.game;
  const filter = ctx.ui.logFilter || 'all';
  const all = ctx.log.slice().reverse();
  const shown = all.filter((e) => filter === 'all' || (filter === 'round' ? e.round === g.round : e.kind === filter));
  const chips = CHIPS.map(([k, name]) => `<button type="button" aria-pressed="${k === filter}" ${act('ui/set', { logFilter: k })} style="min-height:44px;padding:0 16px;border-radius:22px;font:600 15px ${BAR};${k === filter ? 'border:0;background:#e8d7ae;color:#2a2017' : 'border:1px solid #5a4330;background:#3b2a1d;color:#eadfc8'}">${name}</button>`).join('');
  const rows = shown.slice(0, 200).map((e) => {
    const s = e.step ? stepById(e.step) : null;
    const where = `Round ${e.round ?? '–'}${s ? ', ' + s.label + ', ' + s.title : ''}`;
    const undone = e.undone;
    return `<li class="k-logrow" style="min-height:52px;display:grid;grid-template-columns:52px 210px minmax(0,1fr) 92px 150px;align-items:center;gap:12px;padding:2px 6px;border-bottom:1px solid #3b2a1d">
      <span style="font:600 15px ${BAR};color:#b9a88a">${esc(timeOf(e.time))}</span>
      <span style="font:500 14px ${BAR};color:#b9a88a;line-height:1.15">${esc(where)}</span>
      <span style="display:flex;align-items:center;gap:6px;min-width:0">${(e.houses || []).map((h) => `<img src="${sigil(h)}" alt="" style="width:28px;height:28px;flex:none">`).join('')}
        <span style="min-width:0;font-size:16px;line-height:1.2;${undone ? 'text-decoration:line-through;color:#968670' : ''}">${esc(e.summary)}</span></span>
      <span style="font:600 12px ${BAR};white-space:nowrap;${undone ? 'padding:2px 8px;border-radius:99px;border:1px solid #8a7a62;color:#b9a88a' : ''}">${undone ? 'undone ' + esc(timeOf(e.undoneAt)) : ''}</span>
      <span style="display:flex;align-items:center;justify-content:flex-end;gap:6px;min-width:0;font:500 14px ${BAR};color:#b9a88a">${e.house ? `<img src="${sigil(e.house)}" alt="" style="width:22px;height:22px;flex:none"><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(houseName(e.house))}</span>` : ''}</span></li>`;
  }).join('');
  const body = `<main class="k-main k-log" style="flex:1;min-height:0;display:flex;flex-direction:column;gap:10px;padding:12px 20px">
    <div style="display:flex;align-items:baseline;gap:14px;flex-wrap:wrap"><h1 class="k-dup" style="margin:0;font-size:26px">Log</h1><span style="font:500 15px ${BAR};color:#b9a88a">Every change from every phone and tablet, newest first, with the house that made it. Undo takes back the newest change and logs that too.</span></div>
    <div role="group" aria-label="Show" style="display:flex;gap:8px;flex-wrap:wrap">${chips}<span style="margin-left:auto;align-self:center;font:500 14px ${BAR};color:#b9a88a">${shown.length} ${shown.length === 1 ? 'change' : 'changes'} shown</span></div>
    <ol aria-label="Changes" style="list-style:none;margin:0;padding:0;flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;border-top:1px solid #5a4330">${rows || '<li style="padding:12px 6px;font-size:16px">No changes yet.</li>'}</ol>
    <div style="display:flex;gap:10px;flex-wrap:wrap">${ctx.replay ? '' : `<button type="button" ${act('replay/open', { id: 'current', at: 0 })} style="min-height:44px;padding:0 16px;border-radius:10px;border:0;background:#c9a24c;color:#211710;font:600 15px ${BAR}">Replay this game</button>`}
      <button type="button" ${act('games/open')} style="min-height:44px;padding:0 16px;border-radius:10px;border:1px solid #5a4330;background:#3b2a1d;color:#eadfc8;font:600 15px ${BAR}">Games and replays</button>
      ${ctx.replay ? '' : `<a href="${api('api/export')}" download style="min-height:44px;display:flex;align-items:center;padding:0 16px;border-radius:10px;border:1px solid #5a4330;background:#3b2a1d;color:#eadfc8;text-decoration:none;font:600 15px ${BAR}">Download a backup</a>
      <button type="button" ${act('game/menu')} style="min-height:44px;padding:0 16px;border-radius:10px;border:1px solid #5a4330;background:#3b2a1d;color:#eadfc8;font:600 15px ${BAR}">New game or example…</button>`}</div>
  </main>`;
  return frame({ game: g, house: ctx.house, tab: 'log', body });
}

// ---------------- Choose your house ----------------
export function renderChoose(ctx) {
  const pick = ctx.ui.choosePick || ctx.house || 'greyjoy';
  const narrow = ctx.narrow;
  const tiles = HOUSES.map((h) => {
    const on = h.id === pick;
    const st = narrow
      ? 'min-width:0;min-height:112px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:8px 4px;border-radius:12px;color:#eadfc8;'
      : 'min-height:96px;display:flex;align-items:center;gap:14px;padding:12px 16px;border-radius:14px;color:#eadfc8;';
    const look = on ? 'border:3px solid #ead08a;background:rgba(201,162,76,.16)' : 'border:1px solid #5a4330;background:rgba(59,42,29,.55)';
    const inner = narrow
      ? `<img src="${sigil(h.id)}" alt="" style="width:52px;height:52px"><span style="max-width:100%;font:600 14px ${BAR};line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(h.name)}</span>`
      : `<img src="${sigil(h.id)}" alt="" style="width:64px;height:64px;flex:none"><span style="flex:1;min-width:0;text-align:left;line-height:1.15"><span style="display:block;font-size:22px;font-weight:600">${esc(h.name)}</span></span>`
        + `<span style="flex:none;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:600 18px ${BAR};${on ? 'background:#c9a24c;color:#211710' : 'color:transparent'}">✓</span>`;
    return `<button type="button" role="radio" aria-checked="${on}" ${act('ui/set', { choosePick: h.id })} style="${st}${look}">${inner}</button>`;
  }).join('');
  const body = `<main class="k-main" style="flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;gap:16px;padding:${narrow ? '20px 16px' : '28px 40px'};overflow:auto">
    <div style="text-align:${narrow ? 'left' : 'center'};width:100%;max-width:1000px">
      <h1 style="margin:0;font-size:${narrow ? 27 : 34}px;line-height:1.15">Which house do you play on this ${narrow ? 'phone' : 'device'}?</h1>
      <p style="margin:6px 0 0;font-size:${narrow ? 15 : 17}px;color:#b9a88a">Your changes show in the Log under this house. Several devices can play the same house.</p></div>
    <div role="radiogroup" aria-label="Houses" style="width:100%;max-width:1000px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:${narrow ? 8 : 12}px">${tiles}</div>
    <button type="button" ${act('house/choose', { house: pick })} style="min-width:${narrow ? 0 : 340}px;width:${narrow ? '100%' : 'auto'};min-height:56px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:10px;padding:0 24px;border-radius:14px;border:0;background:#c9a24c;color:#211710;font-size:20px;font-weight:600"><img src="${sigil(pick)}" alt="" style="width:34px;height:34px">Play as ${esc(houseName(pick))}</button>
    ${narrow ? `<p style="margin:0;font-size:14px;line-height:1.35;color:#b9a88a">Change it any time with your house's sigil in the top bar.</p>`
      : '<p style="margin:0;font-size:15px;color:#b9a88a">You can change it any time with the house button in the top bar.</p>'}
  </main>`;
  // phone board "Phone-Choose": app name and round in the top bar
  const head = narrow ? `<header style="height:60px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 16px;border-bottom:1px solid #5a4330"><span style="font-size:22px;font-weight:700">EPIC Overview</span><span style="font:600 14px ${BAR};color:#b9a88a">Round ${ctx.game ? ctx.game.round : '·'}</span></header>`
    : header(ctx.game, null, { noUndo: true });
  return `<div class="k-root" style="box-sizing:border-box;display:flex;flex-direction:column;background:#211710;color:#eadfc8;font-family:'EB Garamond',Georgia,serif;overflow:hidden">${head}${body}</div>`;
}

// ---------------- No game yet, or the game menu ----------------
export function renderSetup(ctx, { menu } = {}) {
  const b = `min-height:56px;padding:0 24px;border-radius:14px;font-size:19px;font-weight:600`;
  const body = `<main class="k-main" style="flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:28px 20px;text-align:center">
    <h1 style="margin:0;font-size:34px">${menu ? 'Start over?' : 'No game yet'}</h1>
    <p style="margin:0;max-width:560px;font-size:17px;color:#b9a88a">${menu ? 'A new game replaces the current one for every device. The current game moves to Games and replays, where you can watch it again.' : 'Start a new game for the table, or load the round 4 example that the canvas boards show.'}</p>
    <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center">
      <button type="button" ${act('game/new')} style="${b};border:0;background:#c9a24c;color:#211710">Start a new game</button>
      <button type="button" ${act('game/example')} style="${b};border:1px solid #5a4330;background:#3b2a1d;color:#eadfc8">Load the round 4 example</button>
      <button type="button" ${act('games/open')} style="${b};border:1px solid #5a4330;background:transparent;color:#eadfc8">Games and replays</button>
      ${menu ? `<button type="button" ${act('ui/set', { menu: false })} style="${b};border:1px solid #5a4330;background:transparent;color:#eadfc8">Cancel</button>` : ''}
    </div></main>`;
  return `<div class="k-root" style="box-sizing:border-box;display:flex;flex-direction:column;background:#211710;color:#eadfc8;font-family:'EB Garamond',Georgia,serif;overflow:hidden">${header(ctx.game, ctx.house, { noUndo: !ctx.game })}${body}</div>`;
}
