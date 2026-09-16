/* Rhythm-39 · core: the pure sequencer math and data helpers, shared by the app
   (window.RhythmCore) and the Node test suite (module.exports). No DOM, no audio. */
(function (root, factory) {
  const m = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  else root.RhythmCore = m;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const STEPS = 16;
  // `beat` is steps per beat: 4 for 4/4 (16ths), 3 for 12/8 (triplets)
  const BEATS = [4, 3];
  const LENGTHS = { 4: [8, 12, 16, 32, 64], 3: [12, 24, 48] };
  const validBeat = b => (BEATS.includes(+b) ? +b : 4);
  const validLength = (n, beat) => {
    const opts = LENGTHS[validBeat(beat)];
    if (!Number.isFinite(+n) || +n <= 0) return opts.includes(STEPS) ? STEPS : opts[0];
    return opts.reduce((best, l) => (Math.abs(l - n) < Math.abs(best - n) ? l : best), opts[0]);
  };
  const clampStep = v => Math.min(2, Math.max(0, Math.round(+v) || 0));

  // Step cells: numbers (0 off, 1 on, 2 accent) or lock objects { l, p, f, s, t }
  const stepLevel = v => (v && typeof v === 'object' ? clampStep(v.l) : clampStep(v));
  const stepLocks = v => (v && typeof v === 'object' ? v : null);
  // Turning a locked step off keeps the locks parked on it (l: 0) for when it comes back
  const setStepLevel = (row, s, lvl) => {
    const c = row[s];
    if (c && typeof c === 'object') c.l = lvl; else row[s] = lvl;
  };
  const normStep = v => {
    if (!v || typeof v !== 'object') return clampStep(v);
    const l = clampStep(v.l);
    const o = { l };
    const p = Math.round(+v.p || 0); if (p) o.p = Math.max(-24, Math.min(24, p));
    const f = Number.isFinite(+v.f) ? +v.f : 1; if (f < 1) o.f = Math.max(0, Math.round(f * 100) / 100);
    const s = Number.isFinite(+v.s) ? +v.s : 1; if (s !== 1) o.s = Math.max(0, Math.min(2, Math.round(s * 100) / 100));
    const t = Math.round((+v.t || 0) * 100) / 100; if (t) o.t = Math.max(-0.5, Math.min(0.5, t));
    return Object.keys(o).length > 1 ? o : l;
  };
  const copyStep = v => (v && typeof v === 'object' ? { ...v } : v);

  // Share-link rows: digits for plain steps, (l p-5 f30 s150 t-25) tokens for locked ones
  const encodeRow = row => row.map(v => {
    const o = stepLocks(v); if (!o) return String(stepLevel(v));
    let s = `(${stepLevel(v)}`;
    if (o.p) s += `p${o.p}`; if (o.f != null && o.f < 1) s += `f${Math.round(o.f * 100)}`;
    if (o.s != null && o.s !== 1) s += `s${Math.round(o.s * 100)}`; if (o.t) s += `t${Math.round(o.t * 100)}`;
    return `${s})`;
  }).join('');
  const decodeRow = str => {
    const out = []; const s = String(str || ''); let i = 0;
    while (i < s.length) {
      if (s[i] !== '(') { out.push(+s[i] || 0); i += 1; continue; }
      const end = s.indexOf(')', i); if (end < 0) break;
      const tok = s.slice(i + 1, end); i = end + 1;
      const o = { l: clampStep(tok[0]) };
      const m = tok.slice(1).match(/[pfst]-?\d+/g) || [];
      m.forEach(x => { const n = +x.slice(1); if (x[0] === 'p') o.p = n; if (x[0] === 'f') o.f = n / 100; if (x[0] === 's') o.s = n / 100; if (x[0] === 't') o.t = n / 100; });
      out.push(o);
    }
    return out;
  };

  // Bring any saved / imported / pasted pattern to `pads` rows of one valid length
  function normalizePattern(rows, beat, pads = 16) {
    const src = Array.isArray(rows) ? rows : [];
    const longest = src.reduce((m, r) => Math.max(m, Array.isArray(r) ? r.length : 0), 0);
    const len = validLength(longest, beat);
    return Array.from({ length: pads }, (_, i) => {
      const r = Array.isArray(src[i]) ? src[i] : [];
      return Array.from({ length: len }, (__, s) => normStep(r[s]));
    });
  }
  // Growing repeats the existing steps; shrinking drops the tail
  function resizePattern(rows, len) {
    const old = rows[0].length;
    rows.forEach((r, i) => {
      rows[i] = Array.from({ length: len }, (_, s) => copyStep(len > old ? r[s % old] : r[s]) || 0);
    });
    return rows;
  }

  // Timing. swingMode 16 delays every odd step, 8 only the off-beat eighths
  const swungStep = (step, swingMode) => (swingMode === 8 ? step % 4 === 2 : step % 2 === 1);
  // Seconds from the start of a pass to a step, with swing and a timing lock
  const stepTime = (step, dur, swing = 0, swingMode = 16, lock = null) =>
    step * dur + (swungStep(step, swingMode) ? swing * dur * 0.33 : 0) + (lock && lock.t ? lock.t * dur : 0);
  // A live hit `elapsed` seconds after the last scheduled step: nearest step and the
  // signed offset from it in steps (-0.5..0.5). `ahead` means the next step was chosen
  const quantizeHit = (elapsed, dur, lastStep, len) => {
    let target = lastStep, offset = elapsed / dur, ahead = false;
    if (elapsed > dur / 2) { target = (lastStep + 1) % len; offset -= 1; ahead = true; }
    return { target, offset: Math.max(-0.5, Math.min(0.5, offset)), ahead };
  };

  // Share payload <-> URL-safe base64 (works in browsers and Node 16+)
  const b64 = typeof btoa === 'function' ? { enc: s => btoa(s), dec: s => atob(s) } : { enc: s => Buffer.from(s, 'binary').toString('base64'), dec: s => Buffer.from(s, 'base64').toString('binary') };
  const shareEncode = obj => b64.enc(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const shareDecode = str => JSON.parse(decodeURIComponent(escape(b64.dec(str.replace(/-/g, '+').replace(/_/g, '/')))));

  // AudioBuffer-like -> 16-bit PCM WAV bytes (ArrayBuffer)
  function encodeWav(buffer) {
    const ch = buffer.numberOfChannels, n = buffer.length, sr = buffer.sampleRate;
    const bytes = 44 + n * ch * 2;
    const ab = new ArrayBuffer(bytes);
    const v = new DataView(ab);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); v.setUint32(4, bytes - 8, true); str(8, 'WAVE');
    str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true);
    str(36, 'data'); v.setUint32(40, n * ch * 2, true);
    const chans = Array.from({ length: ch }, (_, c) => buffer.getChannelData(c));
    let o = 44;
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < ch; c++) {
        const x = Math.max(-1, Math.min(1, chans[c][i]));
        v.setInt16(o, x < 0 ? x * 0x8000 : x * 0x7fff, true); o += 2;
      }
    }
    return ab;
  }

  return { STEPS, BEATS, LENGTHS, validBeat, validLength, clampStep, stepLevel, stepLocks, setStepLevel, normStep, copyStep, encodeRow, decodeRow, normalizePattern, resizePattern, swungStep, stepTime, quantizeHit, shareEncode, shareDecode, encodeWav };
});
