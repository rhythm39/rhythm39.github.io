// Renders the site icon (orange waveform on black, the same drawing as icon.svg)
// to the PNG and ICO set the page links to. Pure Node, no dependencies:
//   node tools/build-icons.js
// Writes favicon.ico (16, 32, 48), favicon-16x16.png, favicon-32x32.png,
// apple-touch-icon.png (180) and img/icon-192.png, img/icon-512.png.
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const root = path.join(__dirname, '..');

// ---- Drawing, in a 512 x 512 space (keep in sync with icon.svg) ----
const BG = [0x1e, 0x1d, 0x1a];
const ACCENT = [0xff, 0x5a, 0x1f], DRUM = [0xff, 0x7a, 0x3d];
const HEIGHTS = [40, 90, 160, 230, 300, 250, 180, 120, 200, 280, 220, 150, 90, 60];
const bars = HEIGHTS.map((h, i) => {
  const hot = i >= 5 && i <= 9, a = hot ? 1 : 0.7, c = hot ? ACCENT : DRUM;
  return { cx: 44 + i * 31 + 10, y0: 256 - h / 2, y1: 256 + h / 2, r: 10,
    color: c.map((v, k) => Math.round(v * a + BG[k] * (1 - a))) };
});
// A bar is a pill: every point within r of the segment (cx, y0 + r) .. (cx, y1 - r)
function colorAt(x, y) {
  for (const b of bars) {
    if (Math.abs(x - b.cx) > b.r || y < b.y0 || y > b.y1) continue;
    const sy = Math.min(Math.max(y, b.y0 + b.r), b.y1 - b.r);
    const dx = x - b.cx, dy = y - sy;
    if (dx * dx + dy * dy <= b.r * b.r) return b.color;
  }
  return BG;
}
function render(size) {
  const SS = 4, px = new Uint8Array(size * size * 3), scale = 512 / size;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r = 0, g = 0, b = 0;
    for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) {
      const c = colorAt((x + (i + 0.5) / SS) * scale, (y + (j + 0.5) / SS) * scale);
      r += c[0]; g += c[1]; b += c[2];
    }
    const o = (y * size + x) * 3, n = SS * SS;
    px[o] = Math.round(r / n); px[o + 1] = Math.round(g / n); px[o + 2] = Math.round(b / n);
  }
  return px;
}

// ---- PNG encoder (8-bit RGB, no filter) ----
const crcTable = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size) {
  const px = render(size), raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) { raw[y * (size * 3 + 1)] = 0; Buffer.from(px.buffer, y * size * 3, size * 3).copy(raw, y * (size * 3 + 1) + 1); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
// ---- ICO container holding PNG images (fine for every current browser) ----
function ico(images) {
  const head = Buffer.alloc(6); head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(images.length, 4);
  const entries = [], blobs = []; let offset = 6 + 16 * images.length;
  for (const { size, data } of images) {
    const e = Buffer.alloc(16); e[0] = size === 256 ? 0 : size; e[1] = e[0]; e[2] = 0; e[3] = 0;
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(data.length, 8); e.writeUInt32LE(offset, 12);
    entries.push(e); blobs.push(data); offset += data.length;
  }
  return Buffer.concat([head, ...entries, ...blobs]);
}

const out = {};
for (const s of [16, 32, 48, 180, 192, 512]) out[s] = png(s);
fs.mkdirSync(path.join(root, 'img'), { recursive: true });
const files = {
  'favicon-16x16.png': out[16], 'favicon-32x32.png': out[32], 'apple-touch-icon.png': out[180],
  'img/icon-192.png': out[192], 'img/icon-512.png': out[512],
  'favicon.ico': ico([16, 32, 48].map(size => ({ size, data: out[size] }))),
};
for (const [name, data] of Object.entries(files)) { fs.writeFileSync(path.join(root, name), data); console.log(name, data.length + ' bytes'); }
