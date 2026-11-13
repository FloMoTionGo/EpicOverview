// Relations tab: canvas boards "Relations: tap a cell for options…" (tablet) and "Phone: Relations" (phone).
import { HOUSES, HOUSE_IDS, LEVELS, BREAK_COST, houseName, sigil } from '../core/data.js';
import { pairKey, level, raiseBlock, lowerBlock, breakBlock, marriageBlock, allianceChain, counts, changedThisRound, married, LEVEL_SHIELD } from '../core/rules.js';
import { DOWRY } from '../core/model.js';
import { frame, RING, RING_USED } from '../ui/chrome.js';
import { esc, act, BAR } from '../ui/kit.js';

const shield = (lv, w) => `display:inline-flex;align-items:center;justify-content:center;width:${w}px;height:${Math.round(w * 1.17)}px;font:700 14px ${BAR};color:#211710;clip-path:polygon(0 0,100% 0,100% 55%,50% 100%,0 55%);background:${LEVEL_SHIELD[lv]}`;

// The options for one pair, with cost or the reason it is blocked (shared by tablet popover and phone sheet).
function optionList(g, a, b, ui) {
  const l = level(g, a, b);
  const rb = raiseBlock(g, a, b);
  const chain = allianceChain(g, a, b);
  const raiseSub = "Both agree. Each pays Power equal to the areas between their closest castles, minus their King's Court stars."
    + (chain.length ? ` Alliances chain: also needs Alliance with ${chain.map(houseName).join(' and ')} this phase.` : '');
  return [
    { title: l < 3 ? `Raise to ${LEVELS[l + 1]}` : 'Raise', sub: rb || raiseSub, block: Boolean(rb), kind: 'main', act: act('relation/raise', { a, b }) },
    { title: l > 0 ? `Lower to ${LEVELS[l - 1]}` : 'Lower', sub: lowerBlock(g, a, b) || 'Free. Either house decides alone.', block: Boolean(lowerBlock(g, a, b)), kind: 'plain', act: act('relation/lower', { a, b }) },
    { title: l > 0 ? `Break the ${LEVELS[l]}` : 'Break', sub: breakBlock(g, a, b) || `Back to War. The house that broke it pays ${BREAK_COST[l]}, in Power or Supply steps, any mix.`, block: Boolean(breakBlock(g, a, b)), kind: 'break', act: act('ui/set', { relStage: 'break' }) },
    { title: 'Set marriage', sub: married(g, a, b) ? 'Already married.' : "The proposer's ring is spent. Raises one level for free, unless raised this round. Dowries swap.", block: married(g, a, b), kind: 'plain', ring: true, act: act('ui/set', { relStage: 'marry' }) }
  ];
}

function optionButton(o) {
  const st = o.block ? 'border:1px dashed rgba(42,32,23,.35);background:transparent;color:#7a6a52'
    : o.kind === 'main' ? 'border:0;background:#2a2017;color:#e8d7ae' : o.kind === 'break' ? 'border:2px solid #8d2a22;background:transparent;color:#8d2a22' : 'border:2px solid #2a2017;background:transparent;color:#2a2017';
  const subc = o.block ? '#7a6a52' : o.kind === 'main' ? '#cdb98d' : o.kind === 'break' ? '#7a3a2c' : '#5a4a36';
  return `<button type="button" ${o.block ? 'aria-disabled="true"' : o.act} style="min-height:58px;display:flex;align-items:center;gap:10px;padding:6px 12px;text-align:left;border-radius:10px;font:600 16px ${BAR};${st}">`
    + (o.ring ? `<img src="${RING}" alt="" style="width:22px;height:22px;flex:none">` : '')
    + `<span style="display:flex;flex-direction:column;gap:2px;min-width:0">${esc(o.title)}<span style="font:500 13px ${BAR};color:${subc};line-height:1.2">${esc(o.sub)}</span></span></button>`;
}

function whoButtons(a, b, stage) {
  const l = stage === 'break';
  const st = `min-height:56px;display:flex;align-items:center;justify-content:center;gap:8px;border-radius:12px;font:600 16px ${BAR};` + (l ? 'border:2px solid #8d2a22;background:transparent;color:#8d2a22' : 'border:2px solid #2a2017;background:transparent;color:#2a2017');
  const btn = (h, other) => `<button type="button" ${l ? act('relation/break', { a, b, breaker: h }) : act('marriage/set', { proposer: h, other })} style="${st}"><img src="${sigil(h)}" alt="" style="width:24px;height:24px">${esc(houseName(h))}</button>`;
  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${btn(a, b)}${btn(b, a)}</div>`;
}

function menuInner(g, a, b, ui) {
  const l = level(g, a, b);
  const status = `${LEVELS[l]}${married(g, a, b) ? ', married' : ''}${changedThisRound(g, a, b) ? ', changed this round' : ', not changed this round'}.`;
  const head = `<div style="display:flex;align-items:center;gap:6px"><img src="${sigil(a)}" alt="" style="width:28px;height:28px"><img src="${sigil(b)}" alt="" style="width:28px;height:28px"><span style="font-size:17px;font-weight:700;line-height:1.1">${esc(houseName(a))} and ${esc(houseName(b))}</span></div>`
    + `<div style="font-size:15px;color:#4a3d2c">${esc(status)}</div>`;
  let body;
  if (ui.relStage === 'break') {
    body = `<div style="font-size:16px;font-weight:700">Who broke the ${LEVELS[l]}?</div><div style="font-size:14px;color:#4a3d2c">That house pays ${BREAK_COST[l]} at the table, in Power or Supply steps, any mix. The level goes back to War.</div>` + whoButtons(a, b, 'break');
  } else if (ui.relStage === 'marry') {
    const blocks = [a, b].map((h) => marriageBlock(g, h, h === a ? b : a));
    body = `<div style="font-size:16px;font-weight:700">Who proposed?</div><div style="font-size:14px;color:#4a3d2c">The proposer's ring is spent. ${esc(blocks.filter(Boolean).join(' '))}</div>` + whoButtons(a, b, 'marry');
  } else {
    body = optionList(g, a, b, ui).map(optionButton).join('') + `<div style="font:500 12px ${BAR};color:#66543d">Alliance costs 5 to break, Dynasty 8.</div>`;
  }
  const back = ui.relStage ? act('ui/set', { relStage: null }) : act('ui/set', { cell: null, relStage: null });
  return head + body + `<button type="button" ${back} style="min-height:48px;border-radius:12px;border:1px solid rgba(42,32,23,.4);background:rgba(255,255,255,.3);color:#2a2017;font:600 16px ${BAR}">${ui.relStage ? 'Back' : 'Close'}</button>`;
}

function matrix(g, ui) {
  const cols = HOUSES.map((h) => `<img src="${sigil(h.id)}" alt="${esc(h.name)}" style="width:40px;height:40px;margin:auto">`).join('');
  const rows = HOUSES.map((ra, r) => {
    const a = ra.id;
    const c = counts(g, a);
    const cells = HOUSES.map((cb) => {
      const b = cb.id;
      if (a === b) return '<span style="width:50px;height:46px;border-radius:8px;background:repeating-linear-gradient(45deg,rgba(255,255,255,.05) 0 4px,transparent 4px 8px)"></span>';
      const lv = level(g, a, b), isC = changedThisRound(g, a, b), isM = married(g, a, b);
      const isFocus = ui.cell === `${a}|${b}`;
      const box = 'position:relative;width:50px;height:46px;padding:0;display:flex;align-items:center;justify-content:center;border-radius:8px;background:rgba(0,0,0,.22);'
        + (isFocus ? 'border:2px solid #ead08a;box-shadow:0 0 0 3px rgba(234,208,138,.25)' : isC ? 'border:1.5px dotted #b9a88a' : 'border:1px solid #3b2a1d');
      return `<button type="button" ${act('ui/set', { cell: `${a}|${b}`, relStage: null })} aria-label="${esc(`${houseName(a)} and ${houseName(b)}: ${LEVELS[lv]}${isM ? ', married' : ''}${isC ? ', changed this round' : ''}, tap for options`)}" style="${box}">`
        + `<span style="${lv ? shield(lv, 24) : `font:600 16px ${BAR};color:rgba(234,223,200,.28)`}">${lv || '–'}</span>`
        + (isM ? `<img src="${RING}" alt="" style="position:absolute;right:1px;top:1px;width:16px;height:16px">` : '') + `</button>`;
    }).join('');
    return `<img src="${sigil(a)}" alt="${esc(ra.name)}" style="width:40px;height:40px">${cells}<span style="text-align:center;font:600 16px ${BAR};color:${c.friendly >= 3 ? '#ead08a' : '#eadfc8'}">${c.friendly} / 3</span>`;
  }).join('');
  let pop = '';
  if (ui.cell) {
    const [a, b] = ui.cell.split('|');
    const r = HOUSE_IDS.indexOf(a), c = HOUSE_IDS.indexOf(b);
    const x = 48 + 54 * c, y = 50 + 50 * r;
    const left = c <= 4 ? x + 62 : x - 352;
    const top = Math.max(0, Math.min(y + 23 - 195, 120));
    const arrowTop = y + 23 - top - 8;
    const arrow = c <= 4 ? `left:-9px;box-shadow:-1px 1px 0 #4a3121` : `right:-9px;box-shadow:1px -1px 0 #4a3121`;
    pop = `<div role="dialog" aria-label="${esc(houseName(a))} and ${esc(houseName(b))}" class="k-relpop" style="position:absolute;left:${left}px;top:${top}px;width:340px;box-sizing:border-box;padding:12px 14px;border-radius:14px;color:#2a2017;background:linear-gradient(180deg,#efe0bb,#dcc796);box-shadow:0 0 0 1px #120c08,0 0 0 4px #4a3121,0 16px 34px rgba(0,0,0,.6);display:flex;flex-direction:column;gap:8px;z-index:5">`
      + `<span aria-hidden="true" style="position:absolute;${arrow};top:${arrowTop}px;width:16px;height:16px;transform:rotate(45deg);background:#e6d4a9"></span>`
      + menuInner(g, a, b, ui) + `</div>`;
  }
  const legend = [1, 2, 3].map((l) => `<span style="display:inline-flex;align-items:center;gap:6px"><span style="${shield(l, 18)}">${l}</span>${LEVELS[l]}</span>`).join('');
  return `<section aria-labelledby="r-matrix" style="display:flex;flex-direction:column;gap:8px;min-height:0">
    <div style="display:flex;align-items:baseline;gap:14px;flex-wrap:wrap"><h1 id="r-matrix" style="margin:0;font-size:24px">Diplomatic levels</h1><span style="font:500 15px ${BAR};color:#b9a88a">Tap a cell to raise, lower, break or set a marriage. Each option shows its cost.</span></div>
    <div style="position:relative">
      <div role="grid" aria-label="Diplomatic levels between all houses" style="display:grid;grid-template-columns:44px repeat(9,50px) 64px;grid-auto-rows:46px;gap:4px;align-items:center">
        <span></span>${cols}<span style="font:600 12px ${BAR};color:#b9a88a;text-align:center;line-height:1.1">friendly of 3</span>${rows}
      </div>${pop}
    </div>
    <div style="display:flex;flex-wrap:wrap;align-items:center;gap:18px;font:500 14px ${BAR};color:#b9a88a">${legend}<span style="display:inline-flex;align-items:center;gap:6px"><img src="${RING}" alt="" style="width:18px;height:18px">married</span><span>Dotted: changed this round</span></div>
  </section>`;
}

function picker(label, chosen, actName) {
  return `<div role="group" aria-label="${esc(label)}" style="display:grid;grid-template-columns:repeat(9,minmax(0,1fr));gap:2px;margin-top:6px">${HOUSES.map((h) =>
    `<button type="button" ${act('ui/set', { [actName]: h.id })} aria-label="${esc(h.name)}" style="min-height:44px;padding:0;border-radius:8px;background:transparent;${chosen === h.id ? 'border:2px solid #ead08a' : 'border:1px solid #5a4330'}"><img src="${sigil(h.id)}" alt="" style="width:24px;height:24px"></button>`).join('')}</div>`;
}

function sidePanels(g, ui) {
  const marriages = Object.entries(g.married).map(([k, r]) => { const [a, b] = k.split('|'); return `${esc(houseName(a))} and ${esc(houseName(b))}, round ${r}`; });
  const hostages = g.hostages.map((x) => `<div style="min-height:52px;display:flex;align-items:center;gap:8px;border-top:1px solid #4a3626">
      <img src="${sigil(x.holder)}" alt="" style="width:28px;height:28px">
      <span style="flex:1;font-size:15px;line-height:1.2">${esc(houseName(x.holder))} holds a ${esc(houseName(x.owner))} House card${x.strength ? ` (strength ${x.strength})` : ''}</span>
      <button type="button" ${act('hostage/release', { id: x.id })} style="min-height:44px;padding:0 10px;border-radius:10px;border:1px solid #5a4330;background:#3b2a1d;color:#eadfc8;font-size:14px">Release</button></div>`).join('');
  const adding = ui.addHostage;
  const addForm = adding ? `<div style="border-top:1px solid #4a3626;padding-top:6px;font-size:14px;color:#b9a88a">Holder${picker('Holder', ui.hHolder, 'hHolder')}<div style="margin-top:6px">Card of${picker('Owner', ui.hOwner, 'hOwner')}</div>
      <div style="display:flex;gap:6px;margin-top:8px"><button type="button" ${ui.hHolder && ui.hOwner ? act('hostage/add', { holder: ui.hHolder, owner: ui.hOwner }) : 'aria-disabled="true"'} style="flex:1;min-height:44px;border-radius:10px;border:0;background:#c9a24c;color:#211710;font:600 15px ${BAR};${ui.hHolder && ui.hOwner ? '' : 'opacity:.45'}">Add hostage</button>
      <button type="button" ${act('ui/set', { addHostage: false, hHolder: null, hOwner: null })} style="min-height:44px;padding:0 12px;border-radius:10px;border:1px solid #5a4330;background:#3b2a1d;color:#eadfc8;font-size:14px">Cancel</button></div></div>`
    : '';
  const addBtn = adding ? '' : `<button type="button" ${act('ui/set', { addHostage: true })} style="min-height:44px;padding:0 12px;border-radius:10px;border:1px solid #5a4330;background:#3b2a1d;color:#eadfc8;font-size:15px">Add</button>`;
  const dowries = Object.entries(g.dowries).filter(([, holder]) => holder).map(([owner, holder]) => `${esc(houseName(holder))} holds ${esc(DOWRY[owner])} (${esc(houseName(owner))})`);
  const panel = 'padding:12px 14px;border-radius:12px;background:#2b1f16;border:1px solid #5a4330';
  const h2 = 'margin:0 0 6px;font-size:20px;font-style:italic;font-weight:400;color:#c9a24c';
  return `<aside class="k-relside" style="display:flex;flex-direction:column;gap:12px;min-height:0">
    <section aria-labelledby="r-marriages" style="${panel}"><h2 id="r-marriages" style="${h2}">Marriages</h2>
      <div style="font-size:15px;line-height:1.5">${marriages.length ? marriages.join('<br>') : 'None yet.'}</div>
      <p style="margin:6px 0 10px;font-size:14px;color:#b9a88a">Proposals are answered at the table. Record the result by tapping a cell, then Set marriage.</p>
      <button type="button" ${act('ui/set', { marryHint: true })} style="width:100%;min-height:48px;display:flex;align-items:center;justify-content:center;gap:8px;border-radius:10px;border:0;background:#c9a24c;color:#211710;font:600 16px ${BAR}"><img src="${RING}" alt="" style="width:22px;height:22px">${ui.marryHint ? 'Tap the pair’s cell in the matrix' : 'Set marriage'}</button>
    </section>
    <section aria-labelledby="r-hostages" style="${panel}"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px"><h2 id="r-hostages" style="${h2};margin:0">Hostages</h2>${addBtn}</div>${hostages || '<div style="font-size:15px">None.</div>'}${addForm}</section>
    <section aria-labelledby="r-dowries" style="${panel}"><h2 id="r-dowries" style="${h2}">Dowries changed hands</h2><div style="font-size:15px;line-height:1.5">${dowries.length ? dowries.join('<br>') : 'None yet.'}</div></section>
  </aside>`;
}

// ---- phone (canvas "Phone: Relations, every button works") ----
function phone(g, ui, house) {
  const me = ui.relMe || house || 'greyjoy';
  const mc = counts(g, me);
  const pick = HOUSES.map((h) => `<button type="button" ${act('ui/set', { relMe: h.id, cell: null, relStage: null })} aria-label="Show ${esc(h.name)}" aria-pressed="${h.id === me}" style="flex:none;width:52px;height:52px;border-radius:50%;padding:0;display:flex;align-items:center;justify-content:center;background:transparent;${h.id === me ? 'border:3px solid #ead08a' : 'border:1px solid #5a4330'}"><img src="${sigil(h.id)}" alt="" style="width:40px;height:40px"></button>`).join('');
  const list = HOUSE_IDS.filter((o) => o !== me).map((o) => {
    const l = level(g, me, o), isC = changedThisRound(g, me, o), isM = married(g, me, o);
    return `<li style="display:flex"><button type="button" ${act('ui/set', { cell: `${me}|${o}`, relStage: null })} aria-label="${esc(`${houseName(me)} and ${houseName(o)}: ${LEVELS[l]}. Tap for options.`)}" style="flex:1;min-height:60px;display:flex;align-items:center;gap:10px;padding:6px 10px 6px 8px;text-align:left;border-radius:12px;background:rgba(59,42,29,.55);color:#eadfc8;${isC ? 'border:1.5px dotted #b9a88a' : 'border:1px solid #4a3626'}">
      <img src="${sigil(o)}" alt="" style="width:38px;height:38px;flex:none">
      <span style="flex:1;min-width:0"><span style="display:block;font-size:17px;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(houseName(o))}</span>
      <span style="display:flex;align-items:center;gap:6px;font:500 13px ${BAR};color:#b9a88a"><span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:21px;font:700 12px ${BAR};color:#211710;clip-path:polygon(0 0,100% 0,100% 55%,50% 100%,0 55%);background:${LEVEL_SHIELD[l]}">${l || ''}</span>${LEVELS[l]}${isC ? ', changed this round' : ''}</span></span>
      ${isM ? `<img src="${RING}" alt="Married" style="width:22px;height:22px;flex:none">` : ''}
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b9a88a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none"><path d="M9 5l7 7-7 7"/></svg></button></li>`;
  }).join('');
  let sheet = '';
  if (ui.cell) {
    const [a, b] = ui.cell.split('|');
    sheet = `<button type="button" ${act('ui/set', { cell: null, relStage: null })} aria-label="Close the options" style="position:fixed;inset:0;border:0;padding:0;background:rgba(10,6,3,.62);z-index:10"></button>
      <div role="dialog" style="position:fixed;left:0;right:0;bottom:0;box-sizing:border-box;padding:10px 16px 16px;border-radius:18px 18px 0 0;color:#2a2017;background:linear-gradient(180deg,#efe0bb,#dcc796);box-shadow:0 -12px 30px rgba(0,0,0,.55);display:flex;flex-direction:column;gap:8px;z-index:11;max-height:90vh;overflow:auto">
      <span aria-hidden="true" style="align-self:center;width:44px;height:5px;border-radius:3px;background:rgba(42,32,23,.3)"></span>${menuInner(g, a, b, ui)}</div>`;
  }
  const ring = g.houses[me].ring;
  return `<main class="k-main k-phone-rel" style="flex:1;min-height:0;display:flex;flex-direction:column;overflow:auto">
    <div style="flex:none;padding:10px 12px 6px"><div role="group" aria-label="Whose relations to show" style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px">${pick}</div></div>
    <section style="flex:none;margin:0 12px;padding:10px 12px;border-radius:12px;background:#2b1f16;border:1px solid #5a4330;display:flex;align-items:center;gap:12px">
      <img src="${sigil(me)}" alt="" style="width:44px;height:44px"><div style="flex:1;min-width:0"><div style="font-size:20px;font-weight:700;line-height:1.1">${esc(houseName(me))}</div>
      <div style="font:500 14px ${BAR};color:#b9a88a">${mc.friendly} of 3 friendly levels, ${mc.alliances} of 2 Alliances, ${mc.dynasty} of 1 Dynasty</div></div>
      <span style="flex:none;display:inline-flex;align-items:center;gap:5px;font:600 13px ${BAR};padding:4px 8px;border-radius:6px;${ring ? 'border:1px solid #7a5d1e;color:#ead08a' : 'border:1px dashed #5a4330;color:#b9a88a'}"><img src="${ring ? RING : RING_USED}" alt="" style="width:20px;height:20px">${ring ? 'Ring' : 'Ring spent'}</span>
    </section>
    <ul aria-label="Levels with the other houses" style="list-style:none;margin:8px 0 0;padding:0 12px;display:flex;flex-direction:column;gap:6px">${list}</ul>
    <p style="flex:none;margin:6px 16px 8px;font-size:14px;color:#b9a88a">Tap a house for raise, lower, break or marriage. Each option shows its cost; Power is paid at the table.</p>
    <div style="padding:0 12px 12px">${sidePanels(g, ui)}</div>
    ${sheet}
  </main>`;
}

export function renderRelations(ctx) {
  const { game: g, ui } = ctx;
  const body = ctx.narrow ? phone(g, ui, ctx.house)
    : `<main class="k-main k-relations" style="flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:20px;padding:10px 20px;overflow:auto">${matrix(g, ui)}${sidePanels(g, ui)}</main>`;
  return frame({ game: g, house: ctx.house, tab: 'relations', body });
}
