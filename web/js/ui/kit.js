// Building blocks for the step cards, ported 1:1 from the canvas board generator (canvas/tools/round_gen.py).
// The inline styles are the canvas styles; class names (k-…) only give the phone/portrait CSS something to hook.
import { sigil, houseName } from '../core/data.js';

export const BAR = "'Barlow Semi Condensed',sans-serif";
export const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// data-act attributes carry the action for the click handler in app.js
export const act = (name, params = {}) => `data-act="${esc(name)}" data-p="${esc(JSON.stringify(params))}"`;

export function focus(house, head, text) {
  const img = house ? `<img src="${sigil(house)}" alt="" style="width:52px;height:52px;flex:none">` : '';
  const box = house ? 'background:rgba(141,42,34,.08);border:2px solid #8d2a22' : 'background:rgba(42,32,23,.06);border:1px solid rgba(42,32,23,.3)';
  return `<div class="k-focus" style="display:flex;align-items:center;gap:14px;padding:10px 14px;border-radius:12px;${box}">${img}`
    + `<div style="min-width:0"><div style="font-size:21px;font-weight:700;line-height:1.15">${esc(head)}</div>`
    + `<div style="font-size:16px;line-height:1.3;color:#4a3d2c">${esc(text)}</div></div></div>`;
}

export function rules(items) {
  return `<div style="display:flex;flex-direction:column;gap:5px">${items.map(([a, b]) =>
    `<div style="font-size:15px;line-height:1.3"><strong>${esc(a)}:</strong> ${esc(b)}</div>`).join('')}</div>`;
}

export const para = (text) => `<p style="margin:0;font-size:16px;line-height:1.35">${esc(text)}</p>`;

export function cards(items, h = 150) {
  return `<div class="k-cards" style="display:flex;gap:14px;align-items:flex-start">${items.map(({ img, label, sub, state, extra = '' }) => {
    const st = state === 'out' ? 'opacity:.4;filter:grayscale(.6)' : state === 'pick' ? 'outline:3px solid #8d2a22;outline-offset:2px' : '';
    return `<figure style="margin:0;display:flex;flex-direction:column;gap:3px;min-width:0">`
      + `<img src="${img}" alt="${esc(label)}" style="height:${h}px;width:auto;max-width:100%;border-radius:8px;box-shadow:0 6px 14px rgba(0,0,0,.35);${st}">`
      + `<figcaption style="font:600 14px ${BAR};line-height:1.15">${esc(label)}<span style="display:block;font-weight:500;color:#66543d">${esc(sub)}</span></figcaption>${extra}</figure>`;
  }).join('')}</div>`;
}

export function rows(items, title) {
  const head = title ? `<div style="font:600 14px ${BAR};color:#66543d">${esc(title)}</div>` : '';
  return `<div style="display:flex;flex-direction:column">${head}${items.map(([houses, text, value]) =>
    `<div style="display:flex;align-items:center;gap:8px;min-height:34px;border-top:1px solid rgba(42,32,23,.15)">`
    + houses.map((k) => `<img src="${sigil(k)}" alt="" style="width:26px;height:26px;flex:none">`).join('')
    + `<span style="flex:1;min-width:0;font-size:15px;line-height:1.2">${esc(text)}</span>`
    + `<span style="flex:none;font:600 18px ${BAR}">${esc(value)}</span></div>`).join('')}</div>`;
}

// items: { label, sub, selected, act, disabled }
export function options(items, cols = 2) {
  return `<div class="k-options" style="display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:8px">${items.map((o) => {
    const st = o.selected ? 'border:0;background:#2a2017;color:#e8d7ae'
      : o.disabled ? 'border:1px dashed rgba(42,32,23,.35);background:transparent;color:#7a6a52'
      : 'border:2px solid #2a2017;background:transparent;color:#2a2017';
    const subc = o.selected ? '#cdb98d' : '#5a4a36';
    const sub = o.sub ? `<span style="font:500 13px ${BAR};color:${subc};line-height:1.2">${esc(o.sub)}</span>` : '';
    return `<button type="button" ${o.act || ''} ${o.disabled ? 'aria-disabled="true"' : ''} aria-pressed="${o.selected ? 'true' : 'false'}" style="min-height:52px;display:flex;flex-direction:column;justify-content:center;gap:2px;padding:6px 12px;text-align:left;border-radius:10px;${st};font:600 16px ${BAR}">${esc(o.label)}${sub}</button>`;
  }).join('')}</div>`;
}

const BM = { all: ['≡ all', '#8a5e12'], turn: ['→ in turn', '#2d5878'], one: ['● one', '#5d3f7a'] };
export function substeps(items) {
  return `<ol class="k-substeps" style="list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(${items.length},minmax(0,1fr));gap:6px">${items.map(([m, title, st, a]) => {
    const label = (st === 'done' ? '✓ ' : '') + BM[m][0];
    const color = st === 'now' ? '#fbe9cf' : BM[m][1];
    const box = st === 'now' ? 'background:#8d2a22;color:#fbe9cf' : st === 'done' ? 'background:rgba(42,32,23,.12);color:#66543d'
      : 'background:rgba(255,255,255,.35);color:#2a2017;border:1px dashed rgba(42,32,23,.35)';
    return `<li ${a || ''} style="min-height:44px;display:flex;flex-direction:column;justify-content:center;gap:1px;padding:4px 8px;border-radius:8px;${box}${a ? ';cursor:pointer' : ''}">`
      + `<span style="font:600 12px ${BAR};color:${color}">${label}</span><span style="font-size:14px;line-height:1.1">${esc(title)}</span></li>`;
  }).join('')}</ol>`;
}

export function stepper(label, value, minus, plus) {
  const btn = 'flex:none;width:44px;height:44px;border-radius:50%;border:1px solid rgba(42,32,23,.45);background:rgba(255,255,255,.35);color:#2a2017;font-size:20px;line-height:1';
  return `<div style="display:flex;align-items:center;gap:8px;min-height:50px">`
    + `<span style="flex:1;font-size:16px">${esc(label)}</span>`
    + `<button type="button" ${minus || ''} aria-label="${esc(label)}: one less" style="${btn}">−</button>`
    + `<span style="width:40px;text-align:center;font:600 24px ${BAR}">${esc(value)}</span>`
    + `<button type="button" ${plus || ''} aria-label="${esc(label)}: one more" style="${btn}">+</button></div>`;
}

export function banner(text, tone = 'dark') {
  const st = tone === 'dark' ? 'background:#2b1f16;color:#ead08a'
    : tone === 'bad' ? 'background:rgba(141,42,34,.12);color:#8d2a22;border:1px solid #8d2a22'
    : 'background:rgba(63,107,42,.15);color:#2f5a1e;border:1px solid #3f6b2a';
  return `<div style="padding:10px 14px;border-radius:10px;font:600 17px ${BAR};${st}">${esc(text)}</div>`;
}

export const col = (...parts) => `<div style="display:flex;flex-direction:column;gap:10px;min-width:0">${parts.join('')}</div>`;
export const split = (left, right, ratio = 'minmax(0,1fr) minmax(0,1fr)') =>
  `<div class="k-split" style="display:grid;grid-template-columns:${ratio};gap:20px;align-items:start">${left}${right}</div>`;

// houses in seat order with a state each: done / wait / you
export function queue(order, states, label) {
  return `<div style="display:flex;flex-direction:column;gap:2px;flex:none"><span style="font:600 13px ${BAR};color:#66543d">${esc(label)}</span>`
    + `<ol class="k-queue" aria-label="${esc(label)}" style="list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(9,minmax(0,1fr));gap:4px;align-items:end">`
    + order.map((k) => {
      const [kind, text] = states[k] || ['wait', 'waiting'];
      const img = kind === 'you' ? 'width:44px;height:44px;border-radius:50%;box-shadow:0 0 0 3px #c9a24c'
        : kind === 'done' ? 'width:38px;height:38px;opacity:.5;filter:grayscale(.7)' : 'width:38px;height:38px';
      const color = kind === 'you' ? '#6b5018' : '#66543d';
      return `<li style="display:flex;flex-direction:column;align-items:center;gap:2px"><img src="${sigil(k)}" alt="${esc(houseName(k))}" style="${img}">`
        + `<span style="font:600 12px ${BAR};white-space:nowrap;color:${color}">${esc(text)}</span></li>`;
    }).join('') + `</ol></div>`;
}

export const chips = (items) => `<div style="display:flex;flex-wrap:wrap;gap:6px">${items.map((t) =>
  `<span style="font:500 14px ${BAR};padding:4px 10px;border-radius:99px;background:rgba(42,32,23,.1);color:#4a3d2c">${esc(t)}</span>`).join('')}</div>`;

// buttons: { label, kind: primary|danger|secondary, act, href, disabled }
export function footer(buttons) {
  if (!buttons.length) return '';
  return `<div class="k-footer" style="display:flex;gap:10px;flex:none">${buttons.map((b) => {
    const st = { primary: 'flex:1;border:0;background:#2a2017;color:#e8d7ae', danger: 'flex:1;border:0;background:#8d2a22;color:#fbe9cf',
      secondary: 'flex:0 0 auto;min-width:190px;padding:0 16px;border:2px solid #2a2017;background:transparent;color:#2a2017' }[b.kind || 'primary'];
    const base = `min-height:52px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;border-radius:12px;font-size:18px;${st}${b.disabled ? ';opacity:.45' : ''}`;
    if (b.href) return `<a href="${b.href}" style="${base};text-decoration:none">${esc(b.label)}</a>`;
    return `<button type="button" ${b.act || ''} ${b.disabled ? 'aria-disabled="true"' : ''} style="${base}">${esc(b.label)}</button>`;
  }).join('')}</div>`;
}
