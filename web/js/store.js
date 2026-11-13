// Talks to server.py: loads the shared game, sends actions, follows changes from other devices.
// A change made on an outdated version gets a 409; the store reloads, re-applies the action and retries.
// Replays: a game's history from the server, stepped through on this device only (nothing is sent).
import { reduce, RuleError } from './core/reducer.js';
import { newGame, exampleGame, upgradeGame } from './core/model.js';
import { api, API_BASE } from './api.js';

const HOUSE_KEY = 'epic-overview.house';
const DEVICE_KEY = 'epic-overview.device';
const PLAY_MS = 900;           // one change per tick while a replay plays

export const store = {
  version: 0, game: null, log: [], cards: [], cardById: {},
  house: null, online: false, message: '', listeners: new Set(),
  deviceId: '', joinUrl: '',
  games: null,                       // GET api/games: { current, past }
  replay: null,                      // { id, meta, frames, index, playing }

  subscribe(fn) { this.listeners.add(fn); },
  emit() { for (const fn of this.listeners) fn(); },

  async init() {
    try { this.house = localStorage.getItem(HOUSE_KEY); } catch { this.house = null; }
    try { this.deviceId = localStorage.getItem(DEVICE_KEY) || ''; } catch { this.deviceId = ''; }
    if (!this.deviceId) {
      // crypto.randomUUID needs https; a laptop server on the Wi-Fi is plain http
      this.deviceId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      try { localStorage.setItem(DEVICE_KEY, this.deviceId); } catch { /* private mode: new id per visit */ }
    }
    const fromUrl = new URLSearchParams(location.search).get('house');
    if (fromUrl) this.setHouse(fromUrl);
    const data = await fetch('data/westeros.json').then((r) => r.json());
    this.cards = data.cards;
    this.cardById = Object.fromEntries(this.cards.map((c) => [c.id, c]));
    await this.reload();
    this.listen();
    this.joinUrl = await this.findJoinUrl();
    this.emit();
  },

  // The address other devices open to join (the QR code on the gathering screen).
  async findJoinUrl() {
    const server = new URLSearchParams(location.search).get('server');
    if (API_BASE) return location.origin + location.pathname + (server ? `?server=${encodeURIComponent(server)}` : '');
    if (['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
      try {
        const info = await (await fetch(api('api/info'), { cache: 'no-store' })).json();
        if (info.lan && info.lan[0]) return `http://${info.lan[0]}:${info.port}/`;
      } catch { /* fall back to this page's own address */ }
    }
    return location.origin + location.pathname;
  },

  async reload() {
    const r = await fetch(api('api/state'), { cache: 'no-store' });
    const doc = await r.json();
    Object.assign(this, { version: doc.version, game: upgradeGame(doc.game, this.cards), log: doc.log || [], online: true });
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

  // A new game: the server moves the current one to the past games (for replays).
  async replaceGame(game, summary, kind) {
    const r = await this.post('api/new', { baseVersion: this.version, kind, state: game, entry: { summary, kind: 'game', house: this.house, round: game.round, step: game.step, houses: [] } });
    if (r.status === 409) { await this.reload(); return this.replaceGame(game, summary, kind); }
    this.games = null;
    await this.reload();
    return r.status === 200;
  },
  newGame() { return this.replaceGame(newGame({ cards: this.cards, seed: Date.now() >>> 0 }), 'New game: gathering at the table.', 'new'); },
  exampleGame() { return this.replaceGame(exampleGame({ cards: this.cards }), 'Loaded the round 4 example from the canvas.', 'example'); },

  // Pick the house this device plays; while the table gathers, tell the others too.
  async join(house) {
    this.setHouse(house);
    const g = this.game;
    if (this.replay || !g || g.phase !== 'gathering' || (g.joined || {})[this.deviceId] === house) return true;
    return this.dispatch({ type: 'gather/join', device: this.deviceId, house });
  },

  // ---- past games and replays (read-only)
  async loadGames() {
    try {
      const r = await fetch(api('api/games'), { cache: 'no-store' });
      this.games = await r.json();
    } catch {
      this.games = { current: null, past: [], error: true };
    }
    this.emit();
  },
  async openReplay(id, at = 0) {
    this.pause();
    let doc = null;
    try {
      const r = await fetch(api(`api/games/${encodeURIComponent(id)}/history`), { cache: 'no-store' });
      if (r.ok) doc = await r.json();
    } catch { /* reported below */ }
    if (!doc || !doc.frames || !doc.frames.length) { this.say('That game could not be loaded.'); return false; }
    for (const f of doc.frames) upgradeGame(f.g, this.cards);        // games from older versions of the app
    this.replay = { id: doc.id, meta: doc.meta || {}, frames: doc.frames, index: at === 'end' ? doc.frames.length - 1 : 0, playing: false };
    this.emit();
    return true;
  },
  seek(index) {
    if (!this.replay) return;
    this.replay.index = Math.max(0, Math.min(this.replay.frames.length - 1, Math.round(index)));
    this.emit();
  },
  play() {
    const rp = this.replay;
    if (!rp) return;
    clearInterval(this._playTimer);
    if (rp.index >= rp.frames.length - 1) rp.index = 0;
    rp.playing = true;
    this._playTimer = setInterval(() => {
      if (!this.replay || this.replay.index >= this.replay.frames.length - 1) { this.pause(); return; }
      this.replay.index += 1;
      this.emit();
    }, PLAY_MS);
    this.emit();
  },
  pause() {
    clearInterval(this._playTimer);
    if (this.replay && this.replay.playing) { this.replay.playing = false; this.emit(); }
  },
  exitReplay() {
    this.pause();
    this.replay = null;
    this.emit();
  },

  async undo() {
    const r = await this.post('api/undo', { house: this.house });
    if (r.status === 409) this.say('Nothing to undo.');
    await this.reload();
  }
};
