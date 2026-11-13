// Replays: helpers over a game's history, the frames from GET /api/games/<id>/history.
// A frame is { v: version, t: time, e: log entry (null for the first), g: game }. Pure functions, no DOM.
import { HOUSE_IDS } from './data.js';
import { effectiveCastles } from './rules.js';
import { stepById } from './steps.js';

// The Log as it read at frame `index`, oldest first, with Undo marking what it took back
// (the same rule as server.py: the newest entry that is neither undone nor an undo).
export function logAt(frames, index) {
  const log = [];
  for (const f of frames.slice(0, index + 1)) {
    if (!f.e) continue;
    if (f.e.kind === 'undo') {
      for (let i = log.length - 1; i >= 0; i--) {
        if (!log[i].undone && log[i].kind !== 'undo') { log[i] = { ...log[i], undone: true, undoneAt: f.e.time || f.t }; break; }
      }
    }
    log.push(f.e);
  }
  return log;
}

const playing = (f) => f && f.g && f.g.phase !== 'gathering';

// First frame of each round that was played: [{ round, index }], in order.
export function roundStarts(frames) {
  const out = [];
  frames.forEach((f, i) => {
    if (!playing(f)) return;
    if (!out.length || out[out.length - 1].round !== f.g.round) out.push({ round: f.g.round, index: i });
  });
  return out;
}

// Where "next round" / "previous round" jump from frame `index`.
export function nextRoundIndex(frames, index) {
  const s = roundStarts(frames).find((r) => r.index > index);
  return s ? s.index : frames.length - 1;
}
export function prevRoundIndex(frames, index) {
  const starts = roundStarts(frames).filter((r) => r.index < index);
  // inside a round: back to its start; at a round's start: to the start of the one before
  return starts.length ? starts[starts.length - 1].index : 0;
}

// Standings at the end of each round (the last frame of that round): VP and castles per house.
export function roundSummary(frames) {
  const starts = roundStarts(frames);
  return starts.map((s, k) => {
    const last = k + 1 < starts.length ? starts[k + 1].index - 1 : frames.length - 1;
    const g = frames[last].g;
    const houses = Object.fromEntries(HOUSE_IDS.map((h) => [h, { vp: g.houses[h].vp, castles: effectiveCastles(g, h) }]));
    return { round: s.round, index: last, final: k + 1 === starts.length, houses };
  });
}

// "Round 6 · Diplomacy 4" (or "Gathering") for the replay bar.
export function frameLabel(frame) {
  if (!frame || !frame.g) return '';
  if (frame.g.phase === 'gathering') return 'Gathering at the table';
  const s = stepById(frame.g.step);
  return `Round ${frame.g.round}${s ? ` · ${s.label}` : ''}`;
}
