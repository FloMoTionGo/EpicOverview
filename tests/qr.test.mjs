// QR encoder:  node --test
// The hashes below were frozen on 2026-11-13 after the module grids matched the reference library
// segno 1.6.6 (versions 1-4, 7, 8, 10, all 8 masks). One known difference is kept on purpose: segno adds
// a zero byte when the data already ends on a byte boundary; we pad as ISO/IEC 18004 7.4.10 says.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { qrMatrix, qrSvg } from '../web/js/ui/qr.js';

const hash = (m) => createHash('sha256').update(m.map((r) => r.map((c) => (c ? 1 : 0)).join('')).join('/')).digest('hex').slice(0, 16);

test('frozen module grids', () => {
  assert.equal(hash(qrMatrix('https://flomotiongo.github.io/EpicOverview/')), '5b0e9be5e3d4bc1c');
  assert.equal(hash(qrMatrix('http://192.168.2.20:8765/', { mask: 5 })), '39f8420e1506a145');
  assert.equal(hash(qrMatrix('https://flomotiongo.github.io/EpicOverview/?server=https://epic-overview-test.fly.dev/', { version: 7, mask: 3 })), '1235058e73f83ea4');
  assert.equal(hash(qrMatrix('x'.repeat(150), { mask: 6 })), '3d95954c7c78aaf1');
});

test('the smallest version that fits, and a clear error past version 10', () => {
  assert.equal(qrMatrix('A').length, 21);                                        // version 1
  assert.equal(qrMatrix('https://flomotiongo.github.io/EpicOverview/').length, 33); // version 4
  assert.equal(qrMatrix('x'.repeat(213)).length, 57);                            // version 10, full
  assert.throws(() => qrMatrix('x'.repeat(214)), /at most 213/);
});

test('finder patterns sit in three corners', () => {
  const m = qrMatrix('EPIC Overview');
  const s = m.length;
  const finder = (x0, y0) => {
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        const ring = Math.max(Math.abs(x - 3), Math.abs(y - 3));
        assert.equal(m[y0 + y][x0 + x], ring !== 2, `finder at ${x0},${y0}: ${x},${y}`);
      }
    }
  };
  finder(0, 0); finder(s - 7, 0); finder(0, s - 7);
  assert.equal(m[s - 8][8], true);                                               // the dark module
});

test('svg: quiet zone, one path, accessible name', () => {
  const svg = qrSvg('https://flomotiongo.github.io/EpicOverview/', { label: 'Join address' });
  assert.match(svg, /viewBox="0 0 41 41"/);                                      // 33 modules + 2 × 4
  assert.match(svg, /role="img" aria-label="Join address"/);
  assert.equal((svg.match(/<path /g) || []).length, 1);
});
