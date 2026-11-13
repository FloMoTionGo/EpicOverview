// App shell: routes (#/round, #/houses, …), renders the current screen, handles taps.
import { store } from './store.js';
import { renderRound } from './views/round.js';
import { renderHouses } from './views/houses.js';
import { renderRelations } from './views/relations.js';
import { renderWesteros } from './views/westeros.js';
import { renderLoans, renderMarket, renderLog, renderChoose, renderSetup } from './views/other.js';
import { renderGather } from './views/gather.js';
import { renderTest } from './views/test.js';
import { TEST_TAB } from './ui/chrome.js';
import { replayBar, renderGames, renderSummary, readPanel, showRound, hideRound } from './views/replay.js';
import { logAt, nextRoundIndex, prevRoundIndex } from './core/replay.js';
import { HOUSE_IDS } from './core/data.js';
import { API_BASE } from './api.js';

const app = document.getElementById('app');
// The replay bar lives outside #app so dragging its slider survives the re-render of the screens.
const bar = document.getElementById('replaybar') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'replaybar' }));
let seeking = false;
const ui = {};                       // this device only: open menus, picks, peeks
const narrowQuery = window.matchMedia('(max-width: 760px)');

const VIEWS = { round: renderRound, houses: renderHouses, relations: renderRelations, westeros: renderWesteros, loans: renderLoans, market: renderMarket, log: renderLog,
  ...(TEST_TAB ? { test: renderTest } : {}) };   // TEMPORARY test tab, only with ?test

function route() {
  const h = (location.hash || '#/round').replace(/^#\//, '').split('/');
  return h[0] || 'round';
}

function render() {
  const rp = store.replay;
  const shown = rp ? rp.frames[rp.index] : null;           // in a replay: the game as it was
  const r = route();
  const ctx = { game: shown ? shown.g : store.game, log: shown ? logAt(rp.frames, rp.index) : store.log, house: store.house, ui, cards: store.cards, cardById: store.cardById, narrow: narrowQuery.matches,
    replay: rp, route: r, games: store.games, joinUrl: store.joinUrl, device: store.deviceId };
  let html;
  if (r === 'games') html = renderGames(ctx);
  else if (rp) html = r === 'summary' ? renderSummary(ctx) : ctx.game && ctx.game.phase === 'gathering' ? renderGather(ctx) : (VIEWS[r] || renderRound)(ctx);
  else if (!store.game || ui.menu) html = renderSetup(ctx, { menu: Boolean(store.game && ui.menu) });
  else if (store.game.phase === 'gathering') html = renderGather(ctx);
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
  document.body.classList.toggle('k-replaying', Boolean(rp));
  if (!rp) bar.innerHTML = '';
  else if (!seeking) {
    // keep keyboard focus on the same control across the re-render
    const a = document.activeElement && bar.contains(document.activeElement) ? document.activeElement : null;
    bar.innerHTML = replayBar(ctx);
    if (a) {
      const same = [...bar.querySelectorAll('[data-replay-seek], [data-act]')].find((b) => (a.matches('[data-replay-seek]') ? b.matches('[data-replay-seek]') : b.dataset.act === a.dataset.act && b.dataset.p === a.dataset.p));
      if (same) same.focus();
    }
  }
}
let sameScreen = null;
const escapeHtml = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');

// UI-only actions (never sent to the server)
const LOCAL = {
  'ui/set': (p) => { Object.assign(ui, p); },
  'ui/add': (p) => {
    for (const [k, v] of Object.entries(p)) if (k !== 'min') ui[k] = Math.max(p.min ?? 0, (ui[k] ?? (k === 'vp' ? 2 : 0)) + v);
  },
  'house/choose': async (p) => { await store.join(p.house); if (route() === 'choose') location.hash = '#/round'; },
  'games/open': async () => { location.hash = '#/games'; await store.loadGames(); },
  'replay/open': async (p) => { if (await store.openReplay(p.id, p.at)) location.hash = p.view === 'summary' ? '#/summary' : '#/round'; },
  'replay/exit': () => { store.exitReplay(); location.hash = '#/log'; },
  'replay/play': () => { if (store.replay.playing) store.pause(); else store.play(); },
  'replay/step': (p) => { store.pause(); store.seek(store.replay.index + p.delta); },
  'replay/round': (p) => {
    const rp = store.replay;
    store.pause();
    store.seek(p.delta > 0 ? nextRoundIndex(rp.frames, rp.index) : prevRoundIndex(rp.frames, rp.index));
  },
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
  'track/assign': () => { ui.trackPick = null; },
  'westeros/raven': () => { ui.peek = null; },
  'win/confirm': () => { ui.pickWinner = false; ui.hideEnd = false; },
  'order/ban': () => { ui.banPick = null; },
  'step/next': () => { Object.assign(ui, { battleStep: 0, peek: null, bidTotal: null, banPick: null, favour: 0, against: 0, execId: null }); },
  'step/prev': () => { Object.assign(ui, { peek: null, bidTotal: null, banPick: null }); },
  'step/goto': () => { Object.assign(ui, { peek: null, bidTotal: null, banPick: null }); }
};

// In a replay only looking around is allowed: no change reaches the shared game.
const REPLAY_OK = /^(ui\/|replay\/|games\/|house\/choose$)/;

const SHUFFLE_MS = 800;            // how long "Shuffling…" stays over a deck at least

async function onClick(ev) {
  const el = ev.target.closest('[data-act]');
  if (!el || el.getAttribute('aria-disabled') === 'true') return;
  ev.preventDefault();
  const name = el.dataset.act;
  const params = el.dataset.p ? JSON.parse(el.dataset.p) : {};
  if (el.closest('.k-test')) return;                         // the test tab only shows; nothing on it changes the game
  if (store.replay && !REPLAY_OK.test(name)) { store.say('This is a replay. Exit the replay to change the game.'); return; }
  if (LOCAL[name]) {
    await LOCAL[name](params);
    render();
    return;
  }
  // a shuffle shows nothing new on the deck: a short "Shuffling…" over it tells the tap was taken
  const shuffle = name === 'westeros/shuffle' ? Date.now() : 0;
  if (shuffle) { ui.shuffling = [...(ui.shuffling || []), params.deck]; render(); }
  let ok = false;
  try {
    ok = await store.dispatch({ type: name, ...params });
  } finally {
    if (shuffle) {
      await new Promise((r) => setTimeout(r, Math.max(0, SHUFFLE_MS - (Date.now() - shuffle))));
      ui.shuffling = ui.shuffling.filter((d) => d !== params.deck);
      render();
    }
  }
  if (ok && AFTER[name]) AFTER[name]();
  render();
}
app.addEventListener('click', onClick);
bar.addEventListener('click', onClick);

// The replay slider: move while dragging without rebuilding the bar, rebuild on release.
bar.addEventListener('pointerdown', (ev) => { if (ev.target.matches('[data-replay-seek]')) seeking = true; });
window.addEventListener('pointerup', () => { if (seeking) { seeking = false; render(); } });
bar.addEventListener('input', (ev) => {
  if (!ev.target.matches('[data-replay-seek]') || !store.replay) return;
  store.pause();
  store.seek(Number(ev.target.value));
});

// Round summary panels: the crosshair follows the pointer or a finger; arrow keys step through the rounds.
const plotAt = (ev) => (ev.target.closest ? ev.target.closest('.k-sumplot') : null);
app.addEventListener('pointermove', (ev) => { const svg = plotAt(ev); if (svg) readPanel(svg, ev.clientX); });
app.addEventListener('pointerdown', (ev) => { const svg = plotAt(ev); if (svg) readPanel(svg, ev.clientX); });
app.addEventListener('pointerout', (ev) => { const svg = plotAt(ev); if (svg && ev.pointerType === 'mouse' && !svg.contains(ev.relatedTarget)) hideRound(svg); });
app.addEventListener('focusout', (ev) => { const svg = plotAt(ev); if (svg) hideRound(svg); });
app.addEventListener('keydown', (ev) => {
  const svg = plotAt(ev);
  if (!svg || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(ev.key)) return;
  ev.preventDefault();
  const n = svg.dataset.xs.split(',').length;
  const k = svg.dataset.k === undefined ? n - 1 : Number(svg.dataset.k);
  showRound(svg, ev.key === 'Home' ? 0 : ev.key === 'End' ? n - 1 : k + (ev.key === 'ArrowRight' ? 1 : -1));
});

window.addEventListener('hashchange', () => {
  ui.cell = null; ui.relStage = null;
  loadGamesIfShown();
  render();
});
// Esc closes whatever is open on top: the eyes-only curtain, a Relations popover or sheet, pickers, the game menu
window.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Escape') return;
  const open = ['peek', 'cell', 'relStage', 'addHostage', 'reassign', 'tracksEdit', 'trackPick', 'maesterPick', 'pickWinner', 'menu'].filter((k) => ui[k]);
  if (!open.length) return;
  for (const k of open) ui[k] = ['addHostage', 'reassign', 'tracksEdit', 'maesterPick', 'pickWinner', 'menu'].includes(k) ? false : null;
  render();
});
narrowQuery.addEventListener('change', render);
store.subscribe(render);
// opened (or reloaded) straight at #/games: load the list once the game is there
const loadGamesIfShown = () => { if (route() === 'games' && !store.games) store.loadGames(); };

store.init().then(loadGamesIfShown).catch((e) => {
  const hint = API_BASE
    ? `Could not reach the EPIC Overview server at ${escapeHtml(API_BASE)}. It may be waking up: reload in a moment.`
    : 'Could not reach the EPIC Overview server. Start it with Start-EpicOverview.cmd and reload.';
  app.innerHTML = `<p style="padding:20px;font-size:18px">${hint} (${escapeHtml(e.message)})</p>`;
});
