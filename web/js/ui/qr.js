// QR codes for the join address on the gathering screen. No dependencies.
// Byte mode, error correction level M, versions 1–10 (up to 213 bytes), as in ISO/IEC 18004.
// The structure follows Project Nayuki's "QR Code generator library" (MIT License,
// https://www.nayuki.io/page/qr-code-generator-library); this is a reduced rewrite of it.

const ECC_PER_BLOCK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];   // level M, versions 1..10
const BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
const FORMAT_M = 0;                                                    // the 2 level bits of M

const bit = (x, i) => ((x >>> i) & 1) !== 0;

function rawModules(ver) {
  let n = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const align = Math.floor(ver / 7) + 2;
    n -= (25 * align - 10) * align - 55;
    if (ver >= 7) n -= 36;
  }
  return n;
}
const dataCodewords = (ver) => Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[ver] * BLOCKS[ver];

// ---- Reed–Solomon over GF(256), polynomial 0x11D
function gfMul(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}
function rsDivisor(degree) {
  const out = new Array(degree).fill(0);
  out[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      out[j] = gfMul(out[j], root);
      if (j + 1 < degree) out[j] ^= out[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return out;
}
function rsRemainder(data, divisor) {
  const out = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ out.shift();
    out.push(0);
    divisor.forEach((coef, i) => { out[i] ^= gfMul(coef, factor); });
  }
  return out;
}

// Data bits -> codewords with error correction, interleaved over the blocks.
function codewords(bytes, ver) {
  const bits = [];
  const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(0b0100, 4);                                   // byte mode
  put(bytes.length, ver <= 9 ? 8 : 16);
  for (const b of bytes) put(b, 8);
  const capacity = dataCodewords(ver) * 8;
  put(0, Math.min(4, capacity - bits.length));      // terminator
  put(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) put(pad, 8);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));

  const nBlocks = BLOCKS[ver], ecc = ECC_PER_BLOCK[ver];
  const raw = Math.floor(rawModules(ver) / 8);
  const shortBlocks = nBlocks - (raw % nBlocks);
  const shortLen = Math.floor(raw / nBlocks);
  const divisor = rsDivisor(ecc);
  const blocks = [];
  for (let i = 0, k = 0; i < nBlocks; i++) {
    const dat = data.slice(k, k + shortLen - ecc + (i < shortBlocks ? 0 : 1));
    k += dat.length;
    const block = dat.concat(rsRemainder(dat, divisor));
    if (i < shortBlocks) block.splice(shortLen - ecc, 0, null);   // keeps the columns aligned
    blocks.push(block);
  }
  const out = [];
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((b) => { if (b[i] !== null) out.push(b[i]); });
  }
  return out;
}

function alignmentPositions(ver, size) {
  if (ver === 1) return [];
  const n = Math.floor(ver / 7) + 2;
  const step = Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
  const out = [6];
  for (let pos = size - 7; out.length < n; pos -= step) out.splice(1, 0, pos);
  return out;
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
];

class Matrix {
  constructor(ver) {
    this.ver = ver;
    this.size = ver * 4 + 17;
    this.dark = Array.from({ length: this.size }, () => new Array(this.size).fill(false));
    this.fixed = Array.from({ length: this.size }, () => new Array(this.size).fill(false));
  }
  set(x, y, dark) { this.dark[y][x] = dark; this.fixed[y][x] = true; }

  functionPatterns() {
    const s = this.size;
    for (let i = 0; i < s; i++) { this.set(6, i, i % 2 === 0); this.set(i, 6, i % 2 === 0); }
    for (const [cx, cy] of [[3, 3], [s - 4, 3], [3, s - 4]]) {
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy));
          if (x >= 0 && x < s && y >= 0 && y < s) this.set(x, y, d !== 2 && d !== 4);
        }
      }
    }
    const pos = alignmentPositions(this.ver, s), n = pos.length;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) this.set(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
    this.formatBits(0);
    if (this.ver >= 7) {
      let rem = this.ver;
      for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
      const bits = (this.ver << 12) | rem;
      for (let i = 0; i < 18; i++) {
        const a = s - 11 + (i % 3), b = Math.floor(i / 3);
        this.set(a, b, bit(bits, i));
        this.set(b, a, bit(bits, i));
      }
    }
  }

  formatBits(mask) {
    const s = this.size;
    const data = (FORMAT_M << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    for (let i = 0; i <= 5; i++) this.set(8, i, bit(bits, i));
    this.set(8, 7, bit(bits, 6));
    this.set(8, 8, bit(bits, 7));
    this.set(7, 8, bit(bits, 8));
    for (let i = 9; i < 15; i++) this.set(14 - i, 8, bit(bits, i));
    for (let i = 0; i < 8; i++) this.set(s - 1 - i, 8, bit(bits, i));
    for (let i = 8; i < 15; i++) this.set(8, s - 15 + i, bit(bits, i));
    this.set(8, s - 8, true);
  }

  place(data) {
    const s = this.size;
    let i = 0;
    for (let right = s - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < s; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const y = ((right + 1) & 2) === 0 ? s - 1 - vert : vert;
          if (!this.fixed[y][x] && i < data.length * 8) {
            this.dark[y][x] = bit(data[i >>> 3], 7 - (i & 7));
            i++;
          }
        }
      }
    }
  }

  mask(m) {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) if (!this.fixed[y][x] && MASKS[m](x, y)) this.dark[y][x] = !this.dark[y][x];
    }
  }

  penalty() {
    const s = this.size, d = this.dark;
    let score = 0;
    const lines = (get) => {
      for (let a = 0; a < s; a++) {
        let color = false, run = 0;
        const hist = [0, 0, 0, 0, 0, 0, 0];
        const add = (len) => { if (hist[0] === 0) len += s; hist.pop(); hist.unshift(len); };
        const count = () => {
          const n = hist[1];
          const core = n > 0 && hist[2] === n && hist[3] === n * 3 && hist[4] === n && hist[5] === n;
          return (core && hist[0] >= n * 4 && hist[6] >= n ? 1 : 0) + (core && hist[6] >= n * 4 && hist[0] >= n ? 1 : 0);
        };
        for (let b = 0; b < s; b++) {
          if (get(a, b) === color) {
            run++;
            if (run === 5) score += 3;
            else if (run > 5) score++;
          } else {
            add(run);
            if (!color) score += count() * 40;
            color = get(a, b);
            run = 1;
          }
        }
        if (color) { add(run); run = 0; }
        add(run + s);
        score += count() * 40;
      }
    };
    lines((y, x) => d[y][x]);
    lines((x, y) => d[y][x]);
    for (let y = 0; y < s - 1; y++) {
      for (let x = 0; x < s - 1; x++) {
        const c = d[y][x];
        if (c === d[y][x + 1] && c === d[y + 1][x] && c === d[y + 1][x + 1]) score += 3;
      }
    }
    const dark = d.reduce((n, row) => n + row.filter(Boolean).length, 0);
    const total = s * s;
    score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
    return score;
  }
}

// The module grid of a QR code for `text`: rows of booleans (true = dark), without the quiet zone.
// opts.mask (0–7) and opts.version force those choices (tests); otherwise the smallest version and the best mask.
export function qrMatrix(text, opts = {}) {
  const bytes = Array.from(new TextEncoder().encode(String(text)));
  let ver = opts.version || 0;
  if (!ver) {
    for (let v = 1; v <= 10 && !ver; v++) if (Math.ceil((4 + (v <= 9 ? 8 : 16) + bytes.length * 8) / 8) <= dataCodewords(v)) ver = v;
  }
  if (!ver) throw new Error(`Too long for a QR code here: ${bytes.length} bytes (at most 213).`);
  const m = new Matrix(ver);
  m.functionPatterns();
  m.place(codewords(bytes, ver));
  let mask = opts.mask;
  if (mask === undefined) {
    let best = Infinity;
    for (let k = 0; k < 8; k++) {
      m.mask(k);
      m.formatBits(k);
      const p = m.penalty();
      if (p < best) { best = p; mask = k; }
      m.mask(k);
    }
  }
  m.mask(mask);
  m.formatBits(mask);
  return m.dark;
}

// An SVG drawing of the code with a 4-module quiet zone, dark modules on a light square.
export function qrSvg(text, { size = 220, dark = '#211710', light = '#fffaf0', label = 'QR code' } = {}) {
  const grid = qrMatrix(text);
  const n = grid.length + 8;
  let path = '';
  grid.forEach((row, y) => row.forEach((on, x) => { if (on) path += `M${x + 4} ${y + 4}h1v1h-1z`; }));
  return `<svg role="img" aria-label="${label}" width="${size}" height="${size}" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" style="display:block;border-radius:8px"><rect width="${n}" height="${n}" fill="${light}"/><path d="${path}" fill="${dark}"/></svg>`;
}
