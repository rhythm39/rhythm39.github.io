/* Rhythm-39 · QR code encoder (byte mode, error correction level L, versions 1 to 40)
   and a canvas renderer, for phone-to-phone share links. No dependencies. */
(() => {
  'use strict';
  // Per version, level L: [ec codewords per block, blocks, data codewords per block, (blocks, data codewords)]
  const EC_L = [
    [7, 1, 19], [10, 1, 34], [15, 1, 55], [20, 1, 80], [26, 1, 108], [18, 2, 68], [20, 2, 78], [24, 2, 97], [30, 2, 116], [18, 2, 68, 2, 69],
    [20, 4, 81], [24, 2, 92, 2, 93], [26, 4, 107], [30, 3, 115, 1, 116], [22, 5, 87, 1, 88], [24, 5, 98, 1, 99], [28, 1, 107, 5, 108], [30, 5, 120, 1, 121], [28, 3, 113, 4, 114], [28, 3, 107, 5, 108],
    [28, 4, 116, 4, 117], [28, 2, 111, 7, 112], [30, 4, 121, 5, 122], [30, 6, 117, 4, 118], [26, 8, 106, 4, 107], [28, 10, 114, 2, 115], [30, 8, 122, 4, 123], [30, 3, 117, 10, 118], [30, 7, 116, 7, 117], [30, 5, 115, 10, 116],
    [30, 13, 115, 3, 116], [30, 17, 115], [30, 17, 115, 1, 116], [30, 13, 115, 6, 116], [30, 12, 121, 7, 122], [30, 6, 121, 14, 122], [30, 17, 122, 4, 123], [30, 4, 122, 18, 123], [30, 20, 117, 4, 118], [30, 19, 118, 6, 119],
  ];
  // GF(256) with the QR polynomial 0x11d
  const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
  function rsDivisor(n) {
    let g = [1];
    for (let i = 0; i < n; i++) {
      const ng = new Array(g.length + 1).fill(0);
      for (let j = 0; j < g.length; j++) { ng[j] ^= g[j]; ng[j + 1] ^= mul(g[j], EXP[i]); }
      g = ng;
    }
    return g.slice(1); // monic: drop the leading 1
  }
  function rsRemainder(data, div) {
    const res = new Array(div.length).fill(0);
    for (const b of data) {
      const f = b ^ res.shift(); res.push(0);
      if (f) for (let j = 0; j < div.length; j++) res[j] ^= mul(div[j], f);
    }
    return res;
  }
  const dataCodewords = v => { const e = EC_L[v - 1]; return e[1] * e[2] + (e[3] ? e[3] * e[4] : 0); };
  const ccBits = v => (v <= 9 ? 8 : 16);

  function encode(text) {
    const bytes = Array.from(new TextEncoder().encode(text));
    let ver = 1;
    while (ver <= 40 && 4 + ccBits(ver) + bytes.length * 8 > dataCodewords(ver) * 8) ver += 1;
    if (ver > 40) throw new Error('too long for a QR code');
    // Bit stream: mode 0100, count, data, terminator, pad
    const bits = [];
    const push = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    push(4, 4); push(bytes.length, ccBits(ver)); bytes.forEach(b => push(b, 8));
    const cap = dataCodewords(ver) * 8;
    push(0, Math.min(4, cap - bits.length));
    while (bits.length % 8) bits.push(0);
    for (let p = 0xEC; bits.length < cap; p ^= 0xEC ^ 0x11) push(p, 8);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
    // Split into blocks, add EC, interleave
    const e = EC_L[ver - 1], div = rsDivisor(e[0]);
    const blocks = [];
    let k = 0;
    for (let b = 0; b < e[1]; b++) { blocks.push(data.slice(k, k + e[2])); k += e[2]; }
    if (e[3]) for (let b = 0; b < e[3]; b++) { blocks.push(data.slice(k, k + e[4])); k += e[4]; }
    const ecs = blocks.map(bl => rsRemainder(bl, div));
    const out = [];
    const maxLen = Math.max(...blocks.map(b => b.length));
    for (let i = 0; i < maxLen; i++) blocks.forEach(bl => { if (i < bl.length) out.push(bl[i]); });
    for (let i = 0; i < e[0]; i++) ecs.forEach(ec => out.push(ec[i]));
    return { ver, codewords: out };
  }

  function alignPositions(ver) {
    if (ver === 1) return [];
    const n = Math.floor(ver / 7) + 2, size = ver * 4 + 17;
    const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
    const res = [6];
    for (let pos = size - 7; res.length < n; pos -= step) res.splice(1, 0, pos);
    return res;
  }

  function matrix(text) {
    const { ver, codewords } = encode(text);
    const size = ver * 4 + 17;
    const mod = Array.from({ length: size }, () => new Uint8Array(size));   // 1 dark
    const fn = Array.from({ length: size }, () => new Uint8Array(size));    // 1 function module
    const set = (x, y, dark) => { if (x >= 0 && y >= 0 && x < size && y < size) { mod[y][x] = dark ? 1 : 0; fn[y][x] = 1; } };
    const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)); set(cx + dx, cy + dy, d !== 2 && d !== 4); } };
    const align = (cx, cy) => { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); };
    for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    const ap = alignPositions(ver);
    ap.forEach((ax, i) => ap.forEach((ay, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === ap.length - 1) || (i === ap.length - 1 && j === 0)) return;
      align(ax, ay);
    }));
    // Reserve format (and version) areas so data skips them
    const reserveFormat = () => { for (let i = 0; i <= 8; i++) { set(8, i, 0); set(i, 8, 0); set(size - 1 - i, 8, 0); set(8, size - 1 - i, 0); } };
    reserveFormat();
    if (ver >= 7) for (let i = 0; i < 18; i++) { const a = size - 11 + (i % 3), b = Math.floor(i / 3); set(a, b, 0); set(b, a, 0); }
    // Data placement: zigzag upwards from the bottom right, two columns at a time
    const bits = []; codewords.forEach(c => { for (let i = 7; i >= 0; i--) bits.push((c >>> i) & 1); });
    let bi = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let v = 0; v < size; v++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - v : v;
          if (!fn[y][x] && bi < bits.length) { mod[y][x] = bits[bi]; bi += 1; }
        }
      }
    }
    // Choose the mask with the lowest penalty
    const MASKS = [
      (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
      (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
    ];
    const applyMask = m => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[m](x, y)) mod[y][x] ^= 1; };
    const drawFormat = m => {
      const data = (1 << 3) | m; // level L = 01
      let rem = data;
      for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      const f = ((data << 10) | rem) ^ 0x5412;
      const bit = i => (f >>> i) & 1;
      for (let i = 0; i <= 5; i++) set(8, i, bit(i));
      set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
      for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
      for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
      for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
      set(8, size - 8, 1);
    };
    if (ver >= 7) {
      let rem = ver;
      for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
      const vb = (ver << 12) | rem;
      for (let i = 0; i < 18; i++) { const b = (vb >>> i) & 1, a = size - 11 + (i % 3), c = Math.floor(i / 3); set(a, c, b); set(c, a, b); }
    }
    const penalty = () => {
      let p = 0;
      const runPenalty = line => {
        let run = 1;
        for (let i = 1; i <= line.length; i++) {
          if (i < line.length && line[i] === line[i - 1]) run += 1;
          else { if (run >= 5) p += 3 + (run - 5); run = 1; }
        }
        // finder-like 1:1:3:1:1 with light margins
        const s = line.join('');
        for (const pat of ['00001011101', '10111010000']) { let idx = s.indexOf(pat); while (idx >= 0) { p += 40; idx = s.indexOf(pat, idx + 1); } }
      };
      for (let y = 0; y < size; y++) runPenalty(Array.from(mod[y]));
      for (let x = 0; x < size; x++) runPenalty(mod.map(r => r[x]));
      for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) { const c = mod[y][x]; if (c === mod[y][x + 1] && c === mod[y + 1][x] && c === mod[y + 1][x + 1]) p += 3; }
      let dark = 0; mod.forEach(r => r.forEach(v => { dark += v; }));
      const total = size * size, k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
      return p + k * 10;
    };
    let best = 0, bestP = Infinity;
    for (let m = 0; m < 8; m++) { applyMask(m); drawFormat(m); const pe = penalty(); if (pe < bestP) { bestP = pe; best = m; } applyMask(m); }
    applyMask(best); drawFormat(best);
    return { size, ver, mod };
  }

  function draw(canvas, text, { scale = 0, quiet = 4, dark = '#1f1d1a', light = '#fff' } = {}) {
    const { size, ver, mod } = matrix(text);
    const total = size + quiet * 2;
    const px = scale || Math.max(2, Math.floor(Math.min(480, canvas.clientWidth || 320) / total));
    canvas.width = total * px; canvas.height = total * px;
    const cx = canvas.getContext('2d');
    cx.fillStyle = light; cx.fillRect(0, 0, canvas.width, canvas.height);
    cx.fillStyle = dark;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (mod[y][x]) cx.fillRect((x + quiet) * px, (y + quiet) * px, px, px);
    return { size, ver };
  }
  window.RhythmQR = { encode, matrix, draw };
})();
