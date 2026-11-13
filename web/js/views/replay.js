// Replays: the bar under the screens, the list of games and the round summary.
// The summary is small multiples: one panel per house, all on the same scale, so no ninth colour is
// needed; VP and castles are told apart by colour AND marker shape (dot / square), and a table repeats
// every value. Series colours: blue #3987e5 and orange #d95926, checked with the dataviz palette
// validator on #2b1f16 and #211710 (all pairs: CVD ΔE 26.8, normal ΔE 31.8, contrast ≥ 3:1).
import { HOUSES, houseName, sigil } from '../core/data.js';
import { roundSummary, frameLabel } from '../core/replay.js';
import { frame } from '../ui/chrome.js';
import { esc, act, BAR } from '../ui/kit.js';

export const SERIES = { vp: { name: 'Victory Points', short: 'VP', color: '#3987e5' }, castles: { name: 'Castles', short: 'Castles', color: '#d95926' } };
const PANEL = '#2b1f16';
const GRID = '#4a3626';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "13 Nov 2026, 20:15" from "2026-11-13T20:15:30+01:00" (the server's local time, as written)
export function when(iso) {
  const m = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)/.exec(iso || '');
  return m ? `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}, ${m[4]}:${m[5]}` : '';
}

export function gameTitle(meta) {
  if (!meta) return 'This game';
  const kind = meta.kind === 'example' ? 'Round 4 example' : 'Game';
  const day = when(meta.started).split(',')[0];
  return day ? `${kind} of ${day}` : kind;
}

function status(meta) {
  if (!meta) return '';
  if (meta.winner) return `${houseName(meta.winner)} won in round ${meta.round}`;
  if (meta.phase === 'gathering') return 'Gathering, not started';
  return `Round ${meta.round ?? '–'}, not finished`;
}

const ICON = {
  first: '<path d="M6 5v14"/><path d="M18 5l-9 7 9 7z"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  play: '<path d="M7 5l12 7-12 7z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
  last: '<path d="M18 5v14"/><path d="M6 5l9 7-9 7z"/>'
};
const icon = (k) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;

// ---------------- the bar under every screen while a replay is open ----------------
export function replayBar(ctx) {
  const rp = ctx.replay, n = rp.frames.length, i = rp.index, f = rp.frames[i];
  const summary = f.e ? f.e.summary : 'The game begins.';
  const time = f.t ? f.t.slice(11, 16) : '';
  const btn = (name, p, label, k) => `<button type="button" ${act(name, p)} aria-label="${label}" title="${label}" class="k-rbtn">${icon(k)}</button>`;
  const onSummary = ctx.route === 'summary';
  return `<section class="k-replaybar" aria-label="Replay">
    <div class="k-rb-row">
      <span class="k-rb-badge">Replay</span>
      <span class="k-rb-title">${esc(gameTitle(rp.meta))}<span class="k-rb-status"> · ${esc(status(rp.meta))}</span></span>
      <span class="k-rb-spacer"></span>
      <a href="#/${onSummary ? 'round' : 'summary'}" class="k-rb-link">${onSummary ? 'Back to the screens' : 'Round summary'}</a>
      <button type="button" ${act('replay/exit')} class="k-rb-exit">Exit replay</button>
    </div>
    <div class="k-rb-row">
      <div class="k-rb-controls">
        ${btn('replay/round', { delta: -1 }, 'Previous round', 'first')}${btn('replay/step', { delta: -1 }, 'Previous change', 'back')}
        ${btn('replay/play', {}, rp.playing ? 'Pause' : 'Play', rp.playing ? 'pause' : 'play')}
        ${btn('replay/step', { delta: 1 }, 'Next change', 'next')}${btn('replay/round', { delta: 1 }, 'Next round', 'last')}
      </div>
      <input type="range" class="k-rb-seek" data-replay-seek min="0" max="${n - 1}" step="1" value="${i}" aria-label="Position in the game" aria-valuetext="Change ${i + 1} of ${n}, ${esc(frameLabel(f))}">
      <p class="k-rb-now" aria-live="polite"><strong>${esc(frameLabel(f))}</strong> · change ${i + 1} of ${n}${time ? ` · ${time}` : ''}<span class="k-rb-sum">${esc(summary)}</span></p>
    </div>
  </section>`;
}

// ---------------- past games ----------------
export function renderGames(ctx) {
  const list = ctx.games;
  const b = `min-height:48px;padding:0 16px;border-radius:10px;font:600 15px ${BAR}`;
  const row = (meta, id, current) => `<li style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:12px 4px;border-top:1px solid #4a3626">
      ${meta.winner ? `<img src="${sigil(meta.winner)}" alt="" style="width:40px;height:40px;flex:none">` : '<span aria-hidden="true" style="width:40px;flex:none"></span>'}
      <span style="flex:1;min-width:200px;line-height:1.2"><span style="display:block;font-size:19px;font-weight:600">${esc(current ? 'This game' : gameTitle(meta))}</span>
        <span style="font:500 14px ${BAR};color:#b9a88a">${esc(status(meta))} · ${meta.changes} changes · started ${esc(when(meta.started))}</span></span>
      <span style="display:flex;gap:8px">
        <button type="button" ${act('replay/open', { id, at: 0 })} style="${b};border:0;background:#c9a24c;color:#211710">Replay</button>
        <button type="button" ${act('replay/open', { id, at: 'end', view: 'summary' })} style="${b};border:1px solid #5a4330;background:#3b2a1d;color:#eadfc8">Round summary</button>
      </span></li>`;
  let content;
  if (!list) content = '<p style="margin:0;font-size:17px;color:#b9a88a">Loading the games…</p>';
  else if (list.error) content = '<p style="margin:0;font-size:17px;color:#b9a88a">The list could not be loaded. Is the server running?</p>';
  else {
    const rows = (list.current ? [row(list.current, 'current', true)] : []).concat((list.past || []).map((m) => row(m, m.id, false)));
    content = rows.length
      ? `<ol aria-label="Games" style="list-style:none;margin:0;padding:0;border-bottom:1px solid #4a3626">${rows.join('')}</ol>`
      : '<p style="margin:0;font-size:17px;color:#b9a88a">No games yet.</p>';
  }
  const body = `<main class="k-main" style="flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:12px;padding:16px 20px">
    <div style="display:flex;align-items:baseline;gap:14px;flex-wrap:wrap"><h1 style="margin:0;font-size:28px">Games</h1>
      <span style="font:500 15px ${BAR};color:#b9a88a">Replay any game change by change, or see the standings after each round. A game moves here when a new one starts.</span></div>
    ${content}
  </main>`;
  return frame({ game: ctx.game, house: ctx.house, tab: 'log', body, noSeats: true });
}

// ---------------- round summary ----------------
function panel(h, rows, yMax, narrow, winner) {
  const W = narrow ? 160 : 340, H = narrow ? 100 : 96;    // tablet: all nine panels fit above the fold
  const L = 22, R = 8, T = 8, B = 20;
  const pw = W - L - R, ph = H - T - B;
  const n = rows.length;
  const x = (k) => L + (n === 1 ? pw / 2 : (k * pw) / (n - 1));
  const y = (v) => T + ph - (v / yMax) * ph;
  const vals = (key) => rows.map((r) => r.houses[h.id][key]);
  const vp = vals('vp'), castles = vals('castles');
  const line = (vs, color) => n > 1 ? `<polyline points="${vs.map((v, k) => `${x(k).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>` : '';
  // end markers only (selective): dot for VP, square for castles, with a 2px surface ring
  const lastX = x(n - 1);
  const dot = `<circle cx="${lastX.toFixed(1)}" cy="${y(vp[n - 1]).toFixed(1)}" r="4.5" fill="${SERIES.vp.color}" stroke="${PANEL}" stroke-width="2"/>`;
  const sq = `<rect x="${(lastX - 4.5).toFixed(1)}" y="${(y(castles[n - 1]) - 4.5).toFixed(1)}" width="9" height="9" rx="1.5" fill="${SERIES.castles.color}" stroke="${PANEL}" stroke-width="2"/>`;
  const step = Math.max(1, Math.ceil((n * (narrow ? 22 : 26)) / pw));
  const ticks = rows.map((r, k) => (k % step === 0 || k === n - 1) && !(k !== n - 1 && n - 1 - k < step)
    ? `<text x="${x(k).toFixed(1)}" y="${H - 5}" text-anchor="middle" font-size="11" fill="#b9a88a" font-family="'Barlow Semi Condensed',sans-serif">${r.round}</text>` : '').join('');
  const grid = [0, 7].filter((v) => v <= yMax).map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="${GRID}" stroke-width="1" vector-effect="non-scaling-stroke"/>`
    + `<text x="${L - 5}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="#b9a88a" font-family="'Barlow Semi Condensed',sans-serif">${v}</text>`).join('');
  const final = `${SERIES.vp.short} ${vp[n - 1]} · ${SERIES.castles.short} ${castles[n - 1]}`;
  const won = winner === h.id;
  const box = `min-width:0;display:flex;flex-direction:column;gap:4px;padding:${narrow ? '6px 8px' : '8px 12px'};border-radius:0 0 10px 10px;background:${PANEL};border-top:4px solid ${h.color};`
    + (won ? 'border-left:2px solid #ead08a;border-right:2px solid #ead08a;border-bottom:2px solid #ead08a' : 'border-left:1px solid #5a4330;border-right:1px solid #5a4330;border-bottom:1px solid #5a4330');
  return `<figure class="k-sumpanel" style="margin:0;${box}">
    <figcaption style="display:flex;align-items:center;gap:6px;min-width:0">
      <img src="${sigil(h.id)}" alt="" style="width:${narrow ? 22 : 28}px;height:${narrow ? 22 : 28}px;flex:none">
      <span style="flex:1;min-width:0;font-size:${narrow ? 15 : 17}px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(h.name)}${won ? ' (won)' : ''}</span>
      <span class="k-sumread" data-final="${esc(final)}" style="flex:none;font:600 ${narrow ? 12 : 14}px ${BAR};color:#eadfc8;font-variant-numeric:tabular-nums">${esc(final)}</span>
    </figcaption>
    <svg class="k-sumplot" tabindex="0" role="img" aria-label="${esc(h.name)}: ${esc(final)} after round ${rows[n - 1].round}. Table below."
      data-rounds="${rows.map((r) => r.round).join(',')}" data-vp="${vp.join(',')}" data-castles="${castles.join(',')}" data-xs="${rows.map((r, k) => x(k).toFixed(1)).join(',')}" data-w="${W}"
      viewBox="0 0 ${W} ${H}" width="100%" style="display:block;overflow:visible;touch-action:pan-y;cursor:crosshair">
      ${grid}${ticks}
      <line class="k-sumx" x1="0" x2="0" y1="${T}" y2="${T + ph}" stroke="#b9a88a" stroke-width="1" vector-effect="non-scaling-stroke" visibility="hidden"/>
      ${line(castles, SERIES.castles.color)}${line(vp, SERIES.vp.color)}${sq}${dot}
    </svg>
  </figure>`;
}

export function renderSummary(ctx) {
  const rp = ctx.replay, narrow = ctx.narrow;
  const rows = rp ? roundSummary(rp.frames) : [];
  const winner = rp && rp.meta ? rp.meta.winner : null;
  let content;
  if (!rows.length) content = '<p style="margin:0;font-size:17px;color:#b9a88a">No round has been played in this game yet.</p>';
  else {
    const yMax = Math.max(7, ...rows.flatMap((r) => HOUSES.flatMap((h) => [r.houses[h.id].vp, r.houses[h.id].castles])));
    const key = (s, shape) => `<span style="display:inline-flex;align-items:center;gap:6px"><svg width="26" height="12" viewBox="0 0 26 12" aria-hidden="true"><line x1="1" x2="25" y1="6" y2="6" stroke="${s.color}" stroke-width="2" stroke-linecap="round"/>${shape}</svg>${s.name}</span>`;
    const legend = `<div aria-label="Legend" style="display:flex;gap:18px;flex-wrap:wrap;font:600 15px ${BAR};color:#eadfc8">
      ${key(SERIES.vp, `<circle cx="13" cy="6" r="4" fill="${SERIES.vp.color}"/>`)}${key(SERIES.castles, `<rect x="9" y="2" width="8" height="8" rx="1.5" fill="${SERIES.castles.color}"/>`)}
      <span style="color:#b9a88a;font-weight:500">Line at 7: enough to win. Tap or point at a panel for one round.</span></div>`;
    const panels = `<div class="k-sumgrid" style="display:grid;grid-template-columns:repeat(${narrow ? 2 : 3},minmax(0,1fr));gap:${narrow ? 8 : 12}px">${HOUSES.map((h) => panel(h, rows, yMax, narrow, winner)).join('')}</div>`;
    const head = rows.map((r) => `<th scope="col" style="padding:4px 8px;text-align:right;font-weight:600">R${r.round}</th>`).join('');
    const body = HOUSES.map((h) => `<tr style="border-top:1px solid #4a3626"><th scope="row" style="padding:4px 8px;text-align:left;font-weight:600;white-space:nowrap"><img src="${sigil(h.id)}" alt="" style="width:20px;height:20px;vertical-align:-4px;margin-right:6px">${esc(h.name)}</th>`
      + rows.map((r) => `<td style="padding:4px 8px;text-align:right;white-space:nowrap">${r.houses[h.id].vp} / ${r.houses[h.id].castles}</td>`).join('') + '</tr>').join('');
    const table = `<details class="k-sumtable" ${narrow ? '' : 'open'} style="border-radius:12px;background:${PANEL};border:1px solid #5a4330;padding:8px 12px">
      <summary style="cursor:pointer;min-height:32px;font:600 16px ${BAR}">Table: VP / castles after each round</summary>
      <div style="overflow-x:auto"><table style="border-collapse:collapse;font:500 15px ${BAR};font-variant-numeric:tabular-nums;color:#eadfc8">
        <thead><tr><th scope="col" style="padding:4px 8px;text-align:left">House</th>${head}</tr></thead><tbody>${body}</tbody></table></div></details>`;
    content = legend + panels + table;
  }
  const main = `<main class="k-main k-summary" style="flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:12px;padding:${narrow ? '12px 12px' : '14px 20px'}">
    <div style="display:flex;align-items:baseline;gap:14px;flex-wrap:wrap"><h1 style="margin:0;font-size:28px">Round summary</h1>
      <span style="font:500 15px ${BAR};color:#b9a88a">${esc(rp ? gameTitle(rp.meta) : '')}${rows.length ? ` · standings at the end of each round, rounds 1–${rows[rows.length - 1].round}` : ''}</span></div>
    ${content}
  </main>`;
  return frame({ game: ctx.game, house: ctx.house, tab: 'log', body: main, noSeats: true });
}

// Crosshair readout for a summary panel at the pointer's x (called from app.js; values via textContent).
export function readPanel(svg, clientX) {
  const rect = svg.getBoundingClientRect();
  const W = Number(svg.dataset.w), xs = svg.dataset.xs.split(',').map(Number);
  const vx = ((clientX - rect.left) / rect.width) * W;
  let k = 0;
  xs.forEach((v, j) => { if (Math.abs(v - vx) < Math.abs(xs[k] - vx)) k = j; });
  showRound(svg, k);
  return k;
}
export function showRound(svg, k) {
  const xs = svg.dataset.xs.split(',');
  const rounds = svg.dataset.rounds.split(','), vp = svg.dataset.vp.split(','), castles = svg.dataset.castles.split(',');
  k = Math.max(0, Math.min(xs.length - 1, k));
  const line = svg.querySelector('.k-sumx');
  line.setAttribute('x1', xs[k]);
  line.setAttribute('x2', xs[k]);
  line.setAttribute('visibility', 'visible');
  svg.dataset.k = String(k);
  const read = svg.closest('.k-sumpanel').querySelector('.k-sumread');
  read.textContent = `Round ${rounds[k]}: ${SERIES.vp.short} ${vp[k]} · ${SERIES.castles.short} ${castles[k]}`;
}
export function hideRound(svg) {
  svg.querySelector('.k-sumx').setAttribute('visibility', 'hidden');
  const read = svg.closest('.k-sumpanel').querySelector('.k-sumread');
  read.textContent = read.dataset.final;
  delete svg.dataset.k;
}
