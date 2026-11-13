// Talks to server.py: loads the shared game, sends actions, follows changes from other devices.
// A change made on an outdated version gets a 409; the store reloads, re-applies the action and retries.
import { reduce, RuleError } from './core/reducer.js';
import { newGame, exampleGame } from './core/model.js';
import { api } from './api.js';

const HOUSE_KEY = 'epic-overview.house';

export const store = {
  version: 0, game: null, log: [], cards: [], cardById: {},
  house: null, online: false, message: '', listeners: new Set(),

  subscribe(fn) { this.listeners.add(fn); },
  emit() { for (const fn of this.listeners) fn(); },

  async init() {
    try { this.house = localStorage.getItem(HOUSE_KEY); } catch { this.house = null; }
    const fromUrl = new URLSearchParams(location.search).get('house');
    if (fromUrl) this.setHouse(fromUrl);
    const data = await fetch('data/westeros.json').then((r) => r.json());
    this.cards = data.cards;
    this.cardById = Object.fromEntries(this.cards.map((c) => [c.id, c]));
    await this.reload();
    this.listen();
  },

  async reload() {
    const r = await fetch(api('api/state'), { cache: 'no-store' });
    const doc = await r.json();
    Object.assign(this, { version: doc.version, game: doc.game, log: doc.log || [], online: true });
    this.emit();
  },

  listen() {
    const es = new EventSource(api('api/events'));
    es.addEventListener('version', (ev) => {
      const v = JSON.parse(ev.data).version;
      this.online = true;
      if (v !== this.version) this.reload();
    });
    es.onerror = () => { this.online = false; this.emit(); };
    es.onopen = () => { this.online = true; this.emit(); };
  },

  setHouse(h) {
    this.house = h;
    try { localStorage.setItem(HOUSE_KEY, h); } catch { /* private mode: keep it for this tab only */ }
    this.emit();
  },

  say(text) {
    this.message = text;
    this.emit();
    clearTimeout(this._msgTimer);
    this._msgTimer = setTimeout(() => { this.message = ''; this.emit(); }, 5000);
  },

  async post(path, body) {
    const r = await fetch(api(path), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  },

  // Apply an action locally, send the new state, retry on a version clash.
  async dispatch(action) {
    for (let attempt = 0; attempt < 4; attempt++) {
      let result;
      try {
        result = reduce(this.game, action, { cards: this.cards, house: this.house });
      } catch (e) {
        if (e instanceof RuleError) { this.say(e.message); return false; }
        throw e;
      }
      const entry = { ...result.entry, house: this.house };
      const r = await this.post('api/action', { baseVersion: this.version, state: result.game, entry });
      if (r.status === 200) {
        this.version = r.body.version;
        this.game = result.game;
        this.log = this.log.concat([r.body.entry]);
        this.message = '';
        this.emit();
        return true;
      }
      if (r.status === 409) { await this.reload(); continue; }
      this.say(r.body.error || `The server answered ${r.status}.`);
      return false;
    }
    this.say('Another device keeps changing the game; try again.');
    return false;
  },

  async replaceGame(game, summary) {
    const r = await this.post('api/action', { baseVersion: this.version, state: game, entry: { summary, kind: 'game', house: this.house, round: game.round, step: game.step, houses: [] } });
    if (r.status === 409) { await this.reload(); return this.replaceGame(game, summary); }
    await this.reload();
    return r.status === 200;
  },
  newGame() { return this.replaceGame(newGame({ cards: this.cards, seed: Date.now() >>> 0 }), 'New game started: round 1, Planning.'); },
  exampleGame() { return this.replaceGame(exampleGame({ cards: this.cards }), 'Loaded the round 4 example from the canvas.'); },

  async undo() {
    const r = await this.post('api/undo', { house: this.house });
    if (r.status === 409) this.say('Nothing to undo.');
    await this.reload();
  }
};
