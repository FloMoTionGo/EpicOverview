// Before the game: the table gathers. Every device scans the code, picks its house and joins;
// anyone presses Start the game. In a replay the screen is shown read-only.
import { HOUSES, HOUSE_IDS, houseName, sigil } from '../core/data.js';
import { header } from '../ui/chrome.js';
import { esc, act, BAR } from '../ui/kit.js';
import { qrSvg } from '../ui/qr.js';

export function renderGather(ctx) {
  const g = ctx.game, narrow = ctx.narrow, live = !ctx.replay;
  const joined = g.joined || {};
  const devices = (h) => Object.values(joined).filter((x) => x === h).length;
  const mine = joined[ctx.device] || null;
  const pick = ctx.ui.gatherPick || mine || (HOUSE_IDS.includes(ctx.house) ? ctx.house : null);
  const present = HOUSES.filter((h) => devices(h.id) > 0).length;

  const url = ctx.joinUrl || '';
  const qr = url ? qrSvg(url, { size: narrow ? 168 : 224, label: `QR code to join: ${url}` }) : '';
  const qrCard = `<section aria-labelledby="g-join" class="k-gather-qr" style="flex:none;width:${narrow ? 'auto' : '300px'};box-sizing:border-box;display:flex;flex-direction:column;align-items:center;gap:10px;padding:16px;border-radius:14px;background:#2b1f16;border:1px solid #5a4330;text-align:center">
      <h2 id="g-join" style="margin:0;font-size:22px;line-height:1.15">Join with your phone or tablet</h2>
      ${qr}
      <p style="margin:0;font:600 15px ${BAR};color:#ead08a;overflow-wrap:anywhere">${esc(url)}</p>
      <p style="margin:0;font-size:15px;line-height:1.3;color:#b9a88a">Scan the code or open the address, then pick the house you play.</p>
    </section>`;

  const tiles = HOUSES.map((h) => {
    const n = devices(h.id), on = h.id === pick;
    const status = n ? `${n} ${n === 1 ? 'device' : 'devices'}${mine === h.id ? ', this one' : ''}` : 'waiting';
    const look = on ? 'border:3px solid #ead08a;background:rgba(201,162,76,.16)' : 'border:1px solid #5a4330;background:rgba(59,42,29,.55)';
    const tick = n ? `<span aria-hidden="true" style="flex:none;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:600 15px ${BAR};background:#c9a24c;color:#211710">✓</span>` : '';
    const inner = `<img src="${sigil(h.id)}" alt="" style="width:${narrow ? 36 : 44}px;height:${narrow ? 36 : 44}px;flex:none">`
      + `<span style="flex:1;min-width:0;text-align:left;line-height:1.1"><span style="display:block;font-size:${narrow ? 16 : 19}px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(h.name)}</span>`
      + `<span style="font:500 13px ${BAR};color:${n ? '#ead08a' : '#b9a88a'}">${esc(status)}</span></span>${tick}`;
    const style = `min-width:0;min-height:${narrow ? 60 : 68}px;display:flex;align-items:center;gap:${narrow ? 6 : 10}px;padding:6px ${narrow ? 8 : 12}px;border-radius:12px;color:#eadfc8;${look};border-top:4px solid ${h.color}`;
    return live
      ? `<button type="button" role="radio" aria-checked="${on}" ${act('ui/set', { gatherPick: h.id })} style="${style}">${inner}</button>`
      : `<div style="${style}">${inner}</div>`;
  }).join('');

  const b = 'min-height:56px;box-sizing:border-box;padding:0 22px;border-radius:14px;font-size:19px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:10px';
  const joinBtn = !live ? '' : !pick
    ? `<button type="button" aria-disabled="true" style="${b};border:1px dashed #5a4330;background:transparent;color:#b9a88a">Pick your house above</button>`
    : mine === pick
      ? `<button type="button" aria-disabled="true" style="${b};border:1px solid #5a4330;background:#2b1f16;color:#ead08a"><img src="${sigil(pick)}" alt="" style="width:30px;height:30px">This device plays ${esc(houseName(pick))}</button>`
      : `<button type="button" ${act('house/choose', { house: pick })} style="${b};border:1px solid #c9a24c;background:#3b2a1d;color:#eadfc8"><img src="${sigil(pick)}" alt="" style="width:30px;height:30px">Play as ${esc(houseName(pick))}</button>`;
  const startBtn = live
    ? `<button type="button" ${act('game/start')} style="${b};border:0;background:#c9a24c;color:#211710">Start the game</button>`
    : '';
  const note = `${present} of ${HOUSES.length} houses have joined.${live ? ' Anyone can start; a device that comes later picks its house with the house button.' : ''}`;

  const housesCard = `<section aria-labelledby="g-houses" style="flex:1;min-width:0;display:flex;flex-direction:column;gap:10px">
      <h2 id="g-houses" style="margin:0;font-size:22px">${live ? 'Which house do you play on this device?' : 'Houses at the table'}</h2>
      <div role="${live ? 'radiogroup' : 'list'}" aria-label="Houses" style="display:grid;grid-template-columns:repeat(${narrow ? 2 : 3},minmax(0,1fr));gap:${narrow ? 6 : 10}px">${tiles}</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">${joinBtn}${startBtn}</div>
      <p style="margin:0;font-size:15px;line-height:1.3;color:#b9a88a">${esc(note)}</p>
    </section>`;

  const main = `<main class="k-main k-gather" style="flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:14px;padding:${narrow ? '14px 16px' : '20px 28px'}">
      <div><h1 style="margin:0;font-size:${narrow ? 28 : 34}px;line-height:1.1">Gather at the table</h1>
      <p style="margin:4px 0 0;font-size:16px;color:#b9a88a">New game. Round 1 starts with Planning once everyone is in.</p></div>
      <div style="display:flex;flex-direction:${narrow ? 'column' : 'row'};gap:18px;align-items:${narrow ? 'stretch' : 'flex-start'}">${qrCard}${housesCard}</div>
    </main>`;
  const chip = `<span style="font:600 14px ${BAR};padding:4px 10px;border-radius:99px;border:1px solid #c9a24c;color:#ead08a">Gathering</span>`;
  return `<div class="k-root" style="box-sizing:border-box;display:flex;flex-direction:column;background:#211710;color:#eadfc8;font-family:'EB Garamond',Georgia,serif;overflow:hidden">${header(g, ctx.house, { status: chip, noUndo: !live })}${main}</div>`;
}
