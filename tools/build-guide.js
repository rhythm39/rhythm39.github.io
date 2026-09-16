// Rhythm-39 · builds docs/Rhythm-39-User-Guide.pdf from docs/USER-GUIDE.md with no
// dependencies: a small PDF writer using the standard Helvetica fonts. Run:
//   node tools/build-guide.js
'use strict';
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'docs', 'USER-GUIDE.md');
const out = path.join(__dirname, '..', 'docs', 'Rhythm-39-User-Guide.pdf');

// ---- Helvetica metrics (widths per 1000 em for chars 32..126) ----
const W = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const width = (text, size, bold) => { let w = 0; for (const ch of text) { const c = ch.charCodeAt(0); w += (c >= 32 && c <= 126 ? W[c - 32] : 556); } return (w / 1000) * size * (bold ? 1.04 : 1); };

// Characters outside WinAnsi get a plain replacement
const clean = s => s.replace(/⅛/g, '1/8').replace(/′/g, "'").replace(/→/g, '->').replace(/…/g, '...').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/–/g, '-').replace(/·/g, '·').replace(/[^\x20-\x7e -ÿ]/g, '?');
const esc = s => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
// WinAnsi bytes for the content stream (latin-1 is a subset)
const enc = s => Buffer.from(s, 'latin1');

// ---- page layout ----
const PAGE = { w: 595.28, h: 841.89 }; // A4
const M = { l: 60, r: 60, t: 64, b: 64 };
const TEXT_W = PAGE.w - M.l - M.r;
const pages = []; // each: array of content ops (strings)
let ops = null, y = 0, pageNo = 0;

function newPage() {
  ops = []; pages.push(ops); pageNo += 1; y = PAGE.h - M.t;
}
function footer(idx, total) {
  const label = `Rhythm-39 User Guide  ${'·'}  ${idx + 1} / ${total}`;
  const w = width(label, 8, false);
  return `BT /F1 8 Tf 0.45 g 1 0 0 1 ${(PAGE.w - w) / 2} 36 Tm (${esc(label)}) Tj 0 g ET`;
}
function ensure(h) { if (y - h < M.b) newPage(); }
// Inline **bold** runs
function runs(text) {
  const parts = text.split('**'); const r = [];
  parts.forEach((p, i) => { if (p) r.push({ t: p, bold: i % 2 === 1 }); });
  return r;
}
function wrap(text, size, maxW, boldAll) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = []; let line = '';
  words.forEach(w => {
    const test = line ? `${line} ${w}` : w;
    if (width(test.replace(/\*\*/g, ''), size, boldAll) > maxW && line) { lines.push(line); line = w; } else line = test;
  });
  if (line) lines.push(line);
  return lines;
}
function drawLine(line, x, size, boldAll, gray = 0) {
  let cx = x;
  const parts = boldAll ? [{ t: line, bold: true }] : runs(line);
  const segs = parts.map(p => `/F${p.bold ? 2 : 1} ${size} Tf 1 0 0 1 ${cx.toFixed(2)} ${y.toFixed(2)} Tm (${esc(clean(p.t))}) Tj` + (cx += width(p.t, size, p.bold), ''));
  ops.push(`BT ${gray ? `${gray} g ` : ''}${segs.join(' ')}${gray ? ' 0 g' : ''} ET`);
}
function paragraph(text, { size = 10.5, lead = 14.5, indent = 0, bullet = false, bold = false, gray = 0, before = 4, after = 6 } = {}) {
  const x = M.l + indent + (bullet ? 14 : 0);
  const lines = wrap(text, size, TEXT_W - indent - (bullet ? 14 : 0), bold);
  ensure(before + lead * Math.min(lines.length, 2));
  y -= before;
  lines.forEach((ln, i) => {
    ensure(lead);
    if (bullet && i === 0) ops.push(`BT /F1 ${size} Tf 1 0 0 1 ${(M.l + indent + 3).toFixed(2)} ${y.toFixed(2)} Tm (•) Tj ET`.replace('•', ''));
    drawLine(ln, x, size, bold, gray);
    y -= lead;
  });
  y -= after;
}
function heading(text, level) {
  const size = level === 1 ? 22 : level === 2 ? 15 : 12;
  const before = level === 1 ? 18 : level === 2 ? 16 : 10;
  ensure(before + size * 2.2);
  y -= before;
  const lines = wrap(text, size, TEXT_W, true);
  lines.forEach(ln => { drawLine(ln, M.l, size, true); y -= size * 1.25; });
  if (level <= 2) { ops.push(`0.75 G 0.8 w ${M.l} ${(y + size * 0.55).toFixed(2)} m ${(PAGE.w - M.r).toFixed(2)} ${(y + size * 0.55).toFixed(2)} l S 0 G`); }
  y -= level === 1 ? 6 : 2;
}

// ---- parse the markdown ----
const md = fs.readFileSync(src, 'utf8').split(/\r?\n/);
newPage();
let title = null;
for (let i = 0; i < md.length; i++) {
  const line = md[i];
  if (!line.trim()) continue;
  if (line.startsWith('# ')) {
    if (!title) {
      // Title page block
      title = line.slice(2);
      y = PAGE.h - 220;
      drawLine(title, M.l, 34, true); y -= 46;
      const sub = (md[i + 2] || '').trim();
      if (sub) { drawLine(sub, M.l, 13, false, 0.35); y -= 22; i += 2; }
      ops.push(`0.5 G 1.2 w ${M.l} ${y.toFixed(2)} m ${(PAGE.w - M.r).toFixed(2)} ${y.toFixed(2)} l S 0 G`);
      y -= 28;
      continue;
    }
    heading(line.slice(2), 1); continue;
  }
  if (line.startsWith('## ')) { heading(line.slice(3), 2); continue; }
  if (line.startsWith('### ')) { heading(line.slice(4), 3); continue; }
  if (line.startsWith('- ')) { paragraph(line.slice(2), { bullet: true, before: 1, after: 3 }); continue; }
  paragraph(line);
}

// ---- write the PDF ----
const total = pages.length;
const objects = []; // strings or buffers
const add = obj => { objects.push(obj); return objects.length; }; // 1-based ids
const fontIds = [add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'), add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')];
const pagesId = objects.length + 1 + pages.length * 2; // reserved after page + content objects
const pageIds = [];
pages.forEach((p, idx) => {
  const content = enc([...p, footer(idx, total)].join('\n'));
  const cid = add(Buffer.concat([Buffer.from(`<< /Length ${content.length} >>\nstream\n`), content, Buffer.from('\nendstream')]));
  const pid = add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE.w} ${PAGE.h}] /Resources << /Font << /F1 ${fontIds[0]} 0 R /F2 ${fontIds[1]} 0 R >> >> /Contents ${cid} 0 R >>`);
  pageIds.push(pid);
});
const realPagesId = add(`<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
if (realPagesId !== pagesId) throw new Error('page tree id mismatch');
const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
const infoId = add(`<< /Title (Rhythm-39 User Guide) /Producer (Rhythm-39 build-guide.js) /CreationDate (D:${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}) >>`);

const chunks = [Buffer.from('%PDF-1.4\n%âãÏÓ\n', 'latin1')];
const offsets = [];
let pos = chunks[0].length;
objects.forEach((obj, i) => {
  offsets.push(pos);
  const body = Buffer.isBuffer(obj) ? obj : Buffer.from(obj, 'latin1');
  const parts = [Buffer.from(`${i + 1} 0 obj\n`), body, Buffer.from('\nendobj\n')];
  parts.forEach(b => { chunks.push(b); pos += b.length; });
});
const xref = pos;
let table = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
offsets.forEach(o => { table += `${String(o).padStart(10, '0')} 00000 n \n`; });
table += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
chunks.push(Buffer.from(table, 'latin1'));
fs.writeFileSync(out, Buffer.concat(chunks));
console.log(`wrote ${path.relative(process.cwd(), out)}: ${total} pages, ${Math.round(fs.statSync(out).size / 1024)} KB`);
