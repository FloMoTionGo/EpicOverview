// App shell: routes (#/round, #/houses, …), renders the current screen, handles taps.
import { store } from './store.js';
import { renderRound } from './views/round.js';
import { renderHouses } from './views/houses.js';
import { renderRelations } from './views/relations.js';
import { renderWesteros } from './views/westeros.js';
import { renderLoans, renderMarket, renderLog, renderChoose, renderSetup } from './views/other.js';
import { HOUSE_IDS } from './core/data.js';
import { API_BASE } from './api.js';

const app = document.getElementById('app');
const ui = {};                       // this device only: open menus, picks, peeks
const narrowQuery = window.matchMedia('(max-width: 760px)');

const VIEWS = { round: renderRound, houses: renderHouses, relations: renderRelations, westeros: renderWesteros, loans: renderLoans, market: renderMarket, log: renderLog };

function route() {
  const h = (location.hash || '#/round').replace(/^#\//, '').split('/');
  return h[0] || 'round';
}

function render() {
  const ctx = { game: store.game, log: store.log, house: store.house, ui, cards: store.cards, cardById: store.cardById, narrow: narrowQuery.matches };
  const r = route();
  let html;
  if (!store.game || ui.menu) html = renderSetup(ctx, { menu: Boolean(store.game && ui.menu) });
  else if (r === 'choose' || !store.house || !HOUSE_IDS.includes(store.house)) html = renderChoose(ctx);
  else html = (VIEWS[r] || renderRound)(ctx);
  if (store.message) html += `<div class="k-status" role="status">${escapeHtml(store.message)}</div>`;
  else if (!store.online) html += '<div class="k-status k-offline" role="status">Connection to the server lost. Changes will not be saved until it is back.</div>';
  const scroller = app.querySelector('.k-body, .k-main');
  const keep = scroller ? scroller.scrollTop : 0;
  app.innerHTML = html;
  const again = app.querySelector('.k-body, .k-main');
  if (again && sameScreen === r) again.scrollTop = keep;
  sameScreen = r;
}
let sameScreen = null;
const escapeHtml = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');

// UI-only actions (never sent to the server)
const LOCAL = {
  'ui/set': (p) => { Object.assign(ui, p); },
  'ui/add': (p) => {
    for (const [k, v] of Object.entries(p)) if (k !== 'min') ui[k] = Math.max(p.min ?? 0, (ui[k] ?? (k === 'vp' ? 2 : 0)) + v);
  },
  'house/choose': (p) => { store.setHouse(p.house); location.hash = '#/round'; },
  'game/menu': () => { ui.menu = true; },
  'game/new': async () => { ui.menu = false; await store.newGame(); },
  'game/example': async () => { ui.menu = false; await store.exampleGame(); },
  'undo': async () => { await store.undo(); },
  'peek/maester': async (p) => {
    const ok = await store.dispatch({ type: 'westeros/peek', kind: 'maester', house: store.game.council.maester, decks: p.decks });
    if (ok) Object.assign(ui, { peek: { kind: 'maester', decks: p.decks }, maesterPick: false, maesterDecks: [] });
  },
  'deck4/done': async (p) => {
    // Deck IV: record the result from the total of all bids, then go on (board "Round, Westeros 6")
    if (await store.dispatch({ type: 'westeros/deck4', ...p })) {
      ui.bidTotal = null;
      await store.dispatch({ type: 'step/next' });
    }
  },
  'raven/look': async () => {
    const ok = await store.dispatch({ type: 'westeros/peek', kind: 'raven', house: store.house });
    if (ok) ui.peek = 'raven';
  }
};

// after a shared action, close the local helpers that belonged to it
const AFTER = {
  'relation/raise': () => { ui.cell = null; ui.relStage = null; },
  'relation/lower': () => { ui.cell = null; ui.relStage = null; },
  'relation/break': () => { ui.cell = null; ui.relStage = null; },
  'marriage/set': () => { ui.cell = null; ui.relStage = null; ui.marryHint = false; },
  'hostage/add': () => { Object.assign(ui, { addHostage: false, hHolder: null, hOwner: null }); },
  'hostage/execute': () => { Object.assign(ui, { favour: 0, against: 0, execId: null }); },
  'council/assign': () => { ui.reassignPick = null; },
  'westeros/raven': () => { ui.peek = null; },
  'win/confirm': () => { ui.pickWinner = false; ui.hideEnd = false; },
  'order/ban': () => { ui.banPick = null; },
  'step/next': () => { Object.assign(ui, { battleStep: 0, peek: null, bidTotal: null, banPick: null, favour: 0, against: 0, execId: null }); },
  'step/prev': () => { Object.assign(ui, { peek: null, bidTotal: null, banPick: null }); },
  'step/goto': () => { Object.assign(ui, { peek: null, bidTotal: null, banPick: null }); }
};

app.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el || el.getAttribute('aria-disabled') === 'true') return;
  ev.preventDefault();
  const name = el.dataset.act;
  const params = el.dataset.p ? JSON.parse(el.dataset.p) : {};
  if (LOCAL[name]) {
    await LOCAL[name](params);
    render();
    return;
  }
  const ok = await store.dispatch({ type: name, ...params });
  if (ok && AFTER[name]) AFTER[name]();
  render();
});

window.addEventListener('hashchange', () => { ui.cell = null; ui.relStage = null; render(); });
// Esc closes whatever is open on top: the eyes-only curtain, a Relations popover or sheet, pickers, the game menu
window.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Escape') return;
  const open = ['peek', 'cell', 'relStage', 'addHostage', 'reassign', 'maesterPick', 'pickWinner', 'menu'].filter((k) => ui[k]);
  if (!open.length) return;
  for (const k of open) ui[k] = k === 'addHostage' || k === 'reassign' || k === 'maesterPick' || k === 'pickWinner' || k === 'menu' ? false : null;
  render();
});
narrowQuery.addEventListener('change', render);
store.subscribe(render);

store.init().catch((e) => {
  const hint = API_BASE
    ? `Could not reach the EPIC Overview server at ${escapeHtml(API_BASE)}. It may be waking up: reload in a moment.`
    : 'Could not reach the EPIC Overview server. Start it with Start-EpicOverview.cmd and reload.';
  app.innerHTML = `<p style="padding:20px;font-size:18px">${hint} (${escapeHtml(e.message)})</p>`;
});
