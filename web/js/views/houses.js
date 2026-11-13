// Houses tab (canvas board "Houses: scores, Small Council, tokens"). No seats bar: the cards replace it.
import { HOUSES, ROLES, TRACKS, SUPPLY_MAX, houseName, sigil } from '../core/data.js';
import { councilSeat, holder } from '../core/rules.js';
import { frame, RING, RING_USED, loanIcons } from '../ui/chrome.js';
import { esc, act, BAR } from '../ui/kit.js';

const FIELDS = [['castles', 'Castles'], ['vp', 'Victory points'], ['obj', 'Objectives'], ['supply', 'Supply (max 3)']];

function badge(g, h) {
  const seat = councilSeat(g, h);
  const parts = [seat ? seat.card : 'No council seat'];
  for (const [owner, holder] of Object.entries(g.dowries)) if (holder === h) parts.push(`${houseName(owner)}’s dowry`);
  const held = g.hostages.filter((x) => x.holder === h).length;
  if (held) parts.push(`${held} hostage${held > 1 ? 's' : ''}`);
  return parts.join(', ');
}

function houseCard(g, { id, name, color }, move) {
  const x = g.houses[id];
  const box = `min-height:0;display:flex;flex-direction:column;justify-content:space-between;gap:4px;padding:8px 12px;border-radius:0 0 10px 10px;border-top:5px solid ${color};`
    + (move ? 'border-left:2px solid #ead08a;border-right:2px solid #ead08a;border-bottom:2px solid #ead08a;background:rgba(201,162,76,.14)'
      : 'border-left:1px solid #5a4330;border-right:1px solid #5a4330;border-bottom:1px solid #5a4330;background:rgba(59,42,29,.55)');
  const btn = 'width:44px;height:44px;border-radius:50%;border:1px solid #5a4330;background:#3b2a1d;color:#eadfc8;font-size:20px;line-height:1';
  const stats = FIELDS.map(([f, label]) => {
    const full = f === 'supply' && x[f] >= SUPPLY_MAX;
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px">
      <span style="font:500 13px ${BAR};color:#b9a88a">${label}</span>
      <span style="display:flex;align-items:center;gap:2px">
        <button type="button" ${act('house/adjust', { house: id, field: f, delta: -1 })} aria-label="${esc(label)} for ${esc(name)}: one less" style="${btn}">−</button>
        <span style="width:28px;text-align:center;font:600 22px ${BAR}">${x[f]}</span>
        <button type="button" ${act('house/adjust', { house: id, field: f, delta: 1 })} aria-label="${esc(label)} for ${esc(name)}: one more" style="${btn};${full ? 'opacity:.35' : ''}">+</button>
      </span></div>`;
  }).join('');
  return `<article class="k-housecard" style="${box}">
    <div style="display:flex;align-items:center;gap:8px;min-width:0">
      <img src="${sigil(id)}" alt="" style="width:36px;height:36px;flex:none">
      <span style="font-size:18px;font-weight:600;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(name)}</span>
      <img src="${x.ring ? RING : RING_USED}" alt="${x.ring ? 'Ring still available' : 'Ring used'}" title="${x.ring ? 'Ring still available' : 'Ring used'}" style="width:24px;height:24px;flex:none">
      ${move ? `<span style="margin-left:auto;flex:none;font:600 12px ${BAR};padding:3px 8px;border-radius:99px;background:#ead08a;color:#211710">Your move</span>` : ''}
    </div>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 8px">${stats}</div>
    <div style="display:flex;align-items:center;gap:6px;min-width:0">
      <span style="flex:1;min-width:0;font:500 13px ${BAR};color:#ead08a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(badge(g, id))}</span>
      ${loanIcons(g, id, 13, 18)}
    </div>
  </article>`;
}

function council(g, ui) {
  const editing = Boolean(ui.reassign);
  const pick = ui.reassignPick ?? (editing ? null : null);
  const rows = ROLES.map((role, i) => {
    const k = g.council[role.id];
    const once = role.once ? (g.councilUsed[role.id] ? 'used' : 'ready') : '';
    if (!editing) {
      return `<li style="border-top:1px solid #4a3626"><div style="min-height:44px;display:flex;align-items:center;gap:8px">
        ${k ? `<img src="${sigil(k)}" alt="" style="width:28px;height:28px">` : '<span style="width:28px"></span>'}
        <span style="flex:1;font-size:15px;line-height:1.15">${esc(role.name)}<span style="display:block;font-size:13px;color:#b9a88a">${k ? esc(houseName(k)) : 'nobody'}</span></span>
        <span style="font:500 12px ${BAR};color:#b9a88a">${once}</span></div></li>`;
    }
    const open = pick === i;
    const rowStyle = 'width:100%;min-height:44px;display:flex;align-items:center;gap:8px;padding:0 6px;text-align:left;border:0;border-radius:8px;color:#eadfc8;'
      + (open ? 'background:rgba(201,162,76,.18);outline:2px solid #ead08a;outline-offset:-2px' : 'background:transparent');
    const choices = open ? `<div role="group" aria-label="New holder for ${esc(role.name)}" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;padding:4px 0 8px">${HOUSES.map((h) => {
      const j = ROLES.findIndex((r) => g.council[r.id] === h.id), cur = j === i;
      const seat = cur ? 'holds it' : j >= 0 ? 'swaps ' + ROLES[j].short : 'no seat';
      const st = 'min-width:0;min-height:52px;padding:3px 2px;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:8px;'
        + (cur ? 'border:2px solid #ead08a;background:rgba(201,162,76,.18);color:#ead08a' : 'border:1px solid #5a4330;background:#3b2a1d;color:#eadfc8');
      return `<button type="button" ${cur ? act('ui/set', { reassignPick: null }) : act('council/assign', { role: role.id, house: h.id })} aria-label="${esc(h.name)}, ${seat}" style="${st}">
        <img src="${sigil(h.id)}" alt="" style="width:22px;height:22px">
        <span style="max-width:100%;font:600 12px ${BAR};line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(h.name)}</span>
        <span style="max-width:100%;font:500 11px ${BAR};line-height:1.1;color:#b9a88a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${seat}</span></button>`;
    }).join('')}</div>` : '';
    return `<li style="border-top:1px solid #4a3626"><button type="button" aria-expanded="${open}" ${act('ui/set', { reassignPick: open ? null : i })} style="${rowStyle}">
        ${k ? `<img src="${sigil(k)}" alt="" style="width:28px;height:28px;flex:none">` : '<span style="width:28px;flex:none"></span>'}
        <span style="flex:1;min-width:0;font-size:15px;line-height:1.15">${esc(role.name)}<span style="display:block;font-size:13px;color:#b9a88a">${k ? esc(houseName(k)) : 'nobody'}</span></span>
        <span style="flex:none;font:600 13px ${BAR};color:#ead08a">${open ? 'Pick a house' : 'Change'}</span></button>${choices}</li>`;
  }).join('');
  const seatless = HOUSES.filter((h) => !ROLES.some((r) => g.council[r.id] === h.id)).map((h) => h.name);
  const box = 'padding:12px 14px;border-radius:12px;background:#2b1f16;' + (editing ? 'border:2px solid #c9a24c' : 'border:1px solid #5a4330');
  const editBtn = 'min-height:44px;padding:0 14px;border-radius:10px;font-size:15px;' + (editing ? 'border:0;background:#c9a24c;color:#211710;font-weight:600' : 'border:1px solid #5a4330;background:#3b2a1d;color:#eadfc8');
  return `<section aria-labelledby="h-council" style="${box}">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px">
      <h2 id="h-council" style="margin:0;font-size:20px;font-style:italic;font-weight:400;color:#c9a24c">${editing ? 'Reassigning seats' : 'Small Council'}</h2>
      <button type="button" aria-pressed="${editing}" ${act('ui/set', { reassign: !editing, reassignPick: null })} style="${editBtn}">${editing ? 'Done' : 'Reassign'}</button>
    </div>
    ${editing ? '<p style="margin:0 0 6px;font-size:14px;line-height:1.25;color:#b9a88a">Tap a seat, then its new house. A house that already has a seat swaps.</p>' : ''}
    <ul style="list-style:none;margin:0;padding:0">${rows}</ul>
    <p style="margin:6px 0 0;font-size:14px;color:#b9a88a">${seatless.length ? 'No seat: ' + esc(seatless.join(' and ')) : 'Every house has a seat'}</p>
  </section>`;
}

// Tracks: who holds the Iron Throne, the Valyrian Steel Blade and the Messenger Raven. Looks and works like Small
// Council: Change, tap a token, then its new house (or nobody). One house may hold several tokens.
function tracksPane(g, ui) {
  const editing = Boolean(ui.tracksEdit);
  const pick = ui.trackPick || null;
  const short = (t) => t.name.split(' ').pop();
  const rows = TRACKS.map((t) => {
    const k = holder(g, t.id);
    const who = `<span style="flex:1;min-width:0;font-size:15px;line-height:1.15">${esc(t.name)}<span style="display:block;font-size:13px;color:#b9a88a">${k ? esc(houseName(k)) : 'nobody'}</span></span>`;
    const img = k ? `<img src="${sigil(k)}" alt="" style="width:28px;height:28px;flex:none">` : '<span style="width:28px;flex:none"></span>';
    if (!editing) {
      return `<li style="border-top:1px solid #4a3626"><div style="min-height:44px;display:flex;align-items:center;gap:8px">${img}${who}<span style="font:500 12px ${BAR};color:#b9a88a">${esc(t.track)}</span></div></li>`;
    }
    const open = pick === t.id;
    const rowStyle = 'width:100%;min-height:44px;display:flex;align-items:center;gap:8px;padding:0 6px;text-align:left;border:0;border-radius:8px;color:#eadfc8;'
      + (open ? 'background:rgba(201,162,76,.18);outline:2px solid #ead08a;outline-offset:-2px' : 'background:transparent');
    const st = (cur) => 'min-width:0;min-height:52px;padding:3px 2px;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:8px;'
      + (cur ? 'border:2px solid #ead08a;background:rgba(201,162,76,.18);color:#ead08a' : 'border:1px solid #5a4330;background:#3b2a1d;color:#eadfc8');
    const choice = (id, name, sub) => {
      const cur = k === id;
      return `<button type="button" ${cur ? act('ui/set', { trackPick: null }) : act('track/assign', { track: t.id, house: id })} aria-label="${esc(name)}${sub ? ', ' + esc(sub) : ''}" style="${st(cur)}">`
        + (id ? `<img src="${sigil(id)}" alt="" style="width:22px;height:22px">` : '')
        + `<span style="max-width:100%;font:600 12px ${BAR};line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(name)}</span>`
        + `<span style="max-width:100%;font:500 11px ${BAR};line-height:1.1;color:#b9a88a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(sub)}</span></button>`;
    };
    const choices = open ? `<div role="group" aria-label="New holder of the ${esc(t.name)}" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;padding:4px 0 8px">${HOUSES.map((h) => {
      const also = TRACKS.filter((o) => o.id !== t.id && holder(g, o.id) === h.id).map(short);
      return choice(h.id, h.name, k === h.id ? 'holds it' : also.length ? `holds ${also.join(', ')}` : '');
    }).join('')}${choice(null, 'Nobody', k ? '' : 'nobody holds it')}</div>` : '';
    return `<li style="border-top:1px solid #4a3626"><button type="button" aria-expanded="${open}" ${act('ui/set', { trackPick: open ? null : t.id })} style="${rowStyle}">
        ${img}${who}<span style="flex:none;font:600 13px ${BAR};color:#ead08a">${open ? 'Pick a house' : 'Change'}</span></button>${choices}</li>`;
  }).join('');
  const box = 'padding:12px 14px;border-radius:12px;background:#2b1f16;' + (editing ? 'border:2px solid #c9a24c' : 'border:1px solid #5a4330');
  const editBtn = 'min-height:44px;padding:0 14px;border-radius:10px;font-size:15px;' + (editing ? 'border:0;background:#c9a24c;color:#211710;font-weight:600' : 'border:1px solid #5a4330;background:#3b2a1d;color:#eadfc8');
  return `<section aria-labelledby="h-tracks" style="${box}">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px">
      <h2 id="h-tracks" style="margin:0;font-size:20px;font-style:italic;font-weight:400;color:#c9a24c">${editing ? 'Changing holders' : 'Tracks'}</h2>
      <button type="button" aria-pressed="${editing}" ${act('ui/set', { tracksEdit: !editing, trackPick: null })} style="${editBtn}">${editing ? 'Done' : 'Change'}</button>
    </div>
    ${editing ? '<p style="margin:0 0 6px;font-size:14px;line-height:1.25;color:#b9a88a">Tap a token, then its new holder. One house may hold several.</p>' : ''}
    <ul style="list-style:none;margin:0;padding:0">${rows}</ul>
  </section>`;
}

export function renderHouses(ctx) {
  const { game: g, ui } = ctx;
  const body = `<main class="k-main k-houses" style="flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:20px;padding:14px 20px;overflow:auto">
    <section aria-label="Houses" class="k-housegrid" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:repeat(3,minmax(0,1fr));gap:10px">
      ${HOUSES.map((h) => houseCard(g, h, (ctx.move || []).includes(h.id))).join('')}
    </section>
    <aside style="display:flex;flex-direction:column;gap:14px;min-height:0">${council(g, ui)}${tracksPane(g, ui)}</aside>
  </main>`;
  return frame({ game: g, house: ctx.house, tab: 'houses', body, noSeats: true });
}
