/* RHYTHM-39 · sampler and sequencer, web edition
   Plain script, no build step. Web Audio synthesized kit, 16 pads,
   16-step sequencer with live record, live FX, localStorage autosave. */
(() => {
  'use strict';

  // ------------------------------------------------------------------
  // Config
  // ------------------------------------------------------------------
  const STEPS = 16;               // default pattern length and the size of one grid page
  const NUM_PATTERNS = 4;
  const STORAGE_KEY = 'rhythm39.v4';
  const OLD_STORAGE_KEYS = ['rhythm39.v3'];
  // Pure helpers (pattern lengths, step cells and locks, share rows, timing) live in
  // core.js so the Node tests can load them without a browser
  const CORE = window.RhythmCore;
  const { BEATS, LENGTHS, validBeat, validLength, clampStep, stepLevel, stepLocks, setStepLevel, normStep, copyStep, encodeRow, decodeRow, resizePattern, quantizeHit, shareEncode, shareDecode } = CORE;
  const KEYS = ['1', '2', '3', '4', 'q', 'w', 'e', 'r', 'a', 's', 'd', 'f', 'z', 'x', 'c', 'v'];
  const FX_KEYS = { u: 'delay', i: 'lp', o: 'hp', p: 'stutter', j: 'tapestop', k: 'half', l: 'rep8', ';': 'sweep' };
  // KeyboardEvent.code -> our lowercase key name ('Digit1' -> '1', 'KeyQ' -> 'q')
  const codeToKey = code => {
    if (!code) return '';
    if (code.startsWith('Digit')) return code.slice(5);
    if (code.startsWith('Key')) return code.slice(3).toLowerCase();
    if (code === 'Semicolon') return ';';
    return '';
  };

  // Pad layout, top row first. Every kit uses the same colour groups per position.
  // `send` = delay send baked into the pad. `synth` = hand-written voice in kit A,
  // `voice` + `p` = parameterized voice for the other kits.
  const GROUPS = ['fx', 'fx', 'fx', 'fx', 'perc', 'perc', 'bass', 'bass', 'perc', 'perc', 'perc', 'perc', 'drum', 'drum', 'drum', 'drum'];
  const kit = (name, pads) => ({
    id: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    pads: pads.map((p, i) => ({ ...p, group: GROUPS[i], choke: i >= 14 ? 'hat' : undefined })),
  });
  const KITS = [
    // A · RHYTHM (the original hand-tuned kit)
    kit('RHYTHM', [
      { name: 'SKANK',   synth: 'skank',   send: 0.15 },
      { name: 'BUBBLE',  synth: 'bubble',  send: 0.10 },
      { name: 'SIREN',   synth: 'siren',   send: 0.45 },
      { name: 'DUB HIT', synth: 'dubhit',  send: 0.90 },
      { name: 'TOM LO',  synth: 'tomlo',   send: 0.05 },
      { name: 'TOM HI',  synth: 'tomhi',   send: 0.05 },
      { name: 'SUB',     synth: 'sub',     send: 0.00 },
      { name: 'PLUCK',   synth: 'pluck',   send: 0.20 },
      { name: 'RIM',     synth: 'rim',     send: 0.10 },
      { name: 'CLAP',    synth: 'clap',    send: 0.10 },
      { name: 'SHAKER',  synth: 'shaker',  send: 0.00 },
      { name: 'BELL',    synth: 'cowbell', send: 0.15 },
      { name: 'KICK',    synth: 'kick',    send: 0.00 },
      { name: 'SNARE',   synth: 'snare',   send: 0.08 },
      { name: 'CL HAT',  synth: 'chat',    send: 0.00 },
      { name: 'OP HAT',  synth: 'ohat',    send: 0.05 },
    ]),
    // B · STEPPERS (roots dub: organ, melodica, deep 808 sub, metallic hats, spring splash)
    kit('STEPPERS', [
      { name: 'ORGAN',   voice: 'chord', p: { freqs: [220, 261.63, 329.63], wave: 'square', cut0: 1800, cut1: 900, dec: 0.18 }, send: 0.20 },
      { name: 'CHOP',    voice: 'chord', p: { freqs: [440, 523.25, 659.25], wave: 'sawtooth', cut0: 2600, cut1: 700, dec: 0.12 }, send: 0.15 },
      { name: 'SIREN 2', voice: 'sweep', p: { f0: 500, f1: 1000, f2: 500, t1: 0.3, t2: 0.6, wave: 'square', level: 0.18, dec: 0.7 }, send: 0.5 },
      { name: 'SPRING',  voice: 'hit',   p: { noiseF: 2500, q: 0.5, dec: 0.6 }, send: 0.95 },
      { name: 'TIMBALE', voice: 'tom',   p: { f0: 400, f1: 300, dec: 0.2, noise: 0.5 }, send: 0.1 },
      { name: 'BONGO',   voice: 'tom',   p: { f0: 330, f1: 280, dec: 0.12, noise: 0.2 }, send: 0.05 },
      { name: 'DEEP SUB', voice: 'sub',  p: { f: 41.2, dec: 1.0, wave: 'sine', glideFrom: 60, glideT: 0.06, lp: 200 }, send: 0 },
      { name: 'MELODICA', voice: 'lead', p: { f: 329.63, wave: 'sawtooth', dec: 0.45, vib: 6, cut: 1400 }, send: 0.3 },
      { name: 'STICK',   voice: 'rim',   p: { f: 1100, dec: 0.05 }, send: 0.1 },
      { name: 'SNAP',    voice: 'clap',  p: { f: 2200, count: 2, spread: 0.008, dec: 0.1 }, send: 0.1 },
      { name: 'TAMB',    voice: 'noise', p: { f: 6500, q: 1.2, dec: 0.18, atk: 0.005 }, send: 0.05 },
      { name: 'AGOGO',   voice: 'bell',  p: { freqs: [1200, 1800], f: 1500, q: 3, dec: 0.35, wave: 'square' }, send: 0.2 },
      { name: 'KICK 808', voice: 'kick', p: { f0: 120, f1: 40, pd: 0.15, dec: 0.7, click: 0.15 }, send: 0 },
      { name: 'SNARE 2', voice: 'snare', p: { tone: 180, noise: 2400, ndec: 0.12, tdec: 0.08, q: 1.2 }, send: 0.1 },
      { name: 'HAT MTL', voice: 'hat',   p: { metal: true, dec: 0.05, hp: 8000 }, send: 0 },
      { name: 'HAT MTL O', voice: 'hat', p: { metal: true, dec: 0.4, hp: 7000 }, send: 0.05 },
    ]),
    // C · DANCEHALL (synth stabs, lazer, air horn, 808 sub with drop, tight snare, congas)
    kit('DANCEHALL', [
      { name: 'SYN STAB', voice: 'chord', p: { freqs: [261.63, 311.13, 392], wave: 'sawtooth', cut0: 4000, cut1: 900, dec: 0.22, detune: 12 }, send: 0.15 },
      { name: 'LAZER',   voice: 'sweep', p: { f0: 2400, f1: 300, f2: 300, t1: 0.15, t2: 0.2, wave: 'sawtooth', level: 0.22, dec: 0.25 }, send: 0.3 },
      { name: 'AIR HORN', voice: 'sweep', p: { f0: 380, f1: 420, f2: 410, t1: 0.05, t2: 0.6, wave: 'sawtooth', level: 0.22, dec: 0.8, voices: 3 }, send: 0.35 },
      { name: 'IMPACT',  voice: 'hit',   p: { noiseF: 800, q: 0.7, dec: 0.5, thumpF0: 120, thumpF1: 40 }, send: 0.6 },
      { name: 'CONGA LO', voice: 'tom',  p: { f0: 190, f1: 170, dec: 0.25, noise: 0.15 }, send: 0.05 },
      { name: 'CONGA HI', voice: 'tom',  p: { f0: 260, f1: 240, dec: 0.2, noise: 0.15 }, send: 0.05 },
      { name: '808 SUB', voice: 'sub',   p: { f: 49, dec: 0.9, glideFrom: 110, glideT: 0.08, wave: 'triangle', lp: 300 }, send: 0 },
      { name: 'STEEL',   voice: 'pan',   p: { f: 392, dec: 0.6 }, send: 0.3 },
      { name: 'TICK',    voice: 'rim',   p: { f: 1500, dec: 0.03 }, send: 0.05 },
      { name: 'CLAP DH', voice: 'clap',  p: { f: 1500, count: 4, spread: 0.01, dec: 0.25 }, send: 0.15 },
      { name: 'SHKR 2',  voice: 'noise', p: { f: 8000, q: 1, dec: 0.06, atk: 0.01 }, send: 0 },
      { name: 'BLOCK',   voice: 'bell',  p: { freqs: [900], f: 900, q: 6, dec: 0.1, wave: 'sine' }, send: 0.1 },
      { name: 'KICK DH', voice: 'kick',  p: { f0: 200, f1: 50, pd: 0.06, dec: 0.25, click: 0.6 }, send: 0 },
      { name: 'SNARE DH', voice: 'snare', p: { tone: 260, noise: 3000, ndec: 0.18, tdec: 0.1, q: 0.7 }, send: 0.1 },
      { name: 'HAT DH',  voice: 'hat',   p: { hp: 9000, dec: 0.03 }, send: 0 },
      { name: 'HAT DH O', voice: 'hat',  p: { hp: 8000, dec: 0.25 }, send: 0.05 },
    ]),
    // D · DIGITAL (sleng teng era: cheap-keyboard organ, square bass, digital drums, zap)
    kit('DIGITAL', [
      { name: 'ORGAN DG', voice: 'chord', p: { freqs: [261.63, 329.63, 392, 523.25], wave: 'square', cut0: 2500, cut1: 2000, dec: 0.15 }, send: 0.15 },
      { name: 'ORG BUB', voice: 'chord', p: { freqs: [329.63, 392, 493.88], wave: 'square', cut0: 1600, cut1: 1200, dec: 0.09 }, send: 0.1 },
      { name: 'ZAP',     voice: 'sweep', p: { f0: 3000, f1: 100, f2: 100, t1: 0.08, t2: 0.1, wave: 'square', level: 0.22, dec: 0.12 }, send: 0.4 },
      { name: 'NOISE HIT', voice: 'hit', p: { noiseF: 1200, q: 0.4, dec: 0.3, thumpF0: 90, thumpF1: 60 }, send: 0.7 },
      { name: 'SYN TOM L', voice: 'tom', p: { f0: 200, f1: 90, dec: 0.35, noise: 0 }, send: 0.1 },
      { name: 'SYN TOM H', voice: 'tom', p: { f0: 320, f1: 150, dec: 0.3, noise: 0 }, send: 0.1 },
      { name: 'MT BASS', voice: 'sub',   p: { f: 65.4, dec: 0.35, wave: 'square', lp: 500 }, send: 0 },
      { name: 'PIANO',   voice: 'fm',    p: { f: 261.63, ratio: 2, index: 2.5, dec: 0.5 }, send: 0.25 },
      { name: 'CLAVE',   voice: 'bell',  p: { freqs: [2500], f: 2500, q: 8, dec: 0.08, wave: 'sine' }, send: 0.1 },
      { name: 'CLAP 80', voice: 'clap',  p: { f: 1100, count: 3, spread: 0.015, dec: 0.3 }, send: 0.15 },
      { name: 'CABASA',  voice: 'noise', p: { f: 7000, q: 0.8, dec: 0.1, atk: 0.003 }, send: 0 },
      { name: 'COWBL DG', voice: 'bell', p: { freqs: [800, 540], f: 800, q: 2, dec: 0.25, wave: 'square' }, send: 0.15 },
      { name: 'KICK DG', voice: 'kick',  p: { f0: 140, f1: 55, pd: 0.05, dec: 0.18, click: 0.3 }, send: 0 },
      { name: 'SNARE DG', voice: 'snare', p: { tone: 220, noise: 1500, ndec: 0.25, tdec: 0.06, q: 0.5, nmix: 1.0 }, send: 0.1 },
      { name: 'HAT DG',  voice: 'hat',   p: { hp: 6500, dec: 0.04 }, send: 0 },
      { name: 'HAT DG O', voice: 'hat',  p: { hp: 6000, dec: 0.2 }, send: 0.05 },
    ]),
    // The built-in synth: every pad is a note, root C at the bottom left rising left to
    // right and bottom to top (an octave and a fourth). Octave and voice come from seq.synth
    (() => {
      const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      const k = kit('SYNTH', Array.from({ length: 16 }, (_, i) => {
        const semis = (3 - Math.floor(i / 4)) * 4 + (i % 4);
        return { name: NOTES[semis % 12] + (semis >= 12 ? "'" : ''), note: semis, send: 0.12, verb: 0.12 };
      }));
      k.synth = true;
      k.pads.forEach(p => { p.choke = undefined; p.group = 'bass'; });
      return k;
    })(),
  ];
  // Synth parameters (0..1 unless noted). X and Y are the live surface on the OUTPUT view,
  // each aimed at one parameter; the effective value is the X or Y position
  const SYNTH_TARGETS = ['cutoff', 'reso', 'env', 'decay', 'release', 'detune', 'sub', 'drive', 'glide'];
  const DEFAULT_SYNTH = () => ({ wave: 'saw', octave: 2, cutoff: 0.55, reso: 0.25, env: 0.5, attack: 0.01, decay: 0.35, sustain: 0.5, release: 0.25, detune: 0.15, sub: 0.35, drive: 0, glide: 0, x: { target: 'cutoff', value: 0.55 }, y: { target: 'reso', value: 0.25 } });
  const SYNTH_WAVES = ['saw', 'square', 'triangle', 'sine'];
  function normalizeSynth(v) {
    const d = DEFAULT_SYNTH(), c = (x, lo, hi, dflt) => (Number.isFinite(+x) ? Math.min(hi, Math.max(lo, +x)) : dflt);
    if (!v || typeof v !== 'object') return d;
    const o = { wave: SYNTH_WAVES.includes(v.wave) ? v.wave : d.wave, octave: Math.round(c(v.octave, 0, 5, d.octave)) };
    ['cutoff', 'reso', 'env', 'decay', 'sustain', 'release', 'detune', 'sub', 'drive', 'glide'].forEach(k => { o[k] = c(v[k], 0, 1, d[k]); });
    o.attack = c(v.attack, 0, 1, d.attack);
    o.x = { target: SYNTH_TARGETS.includes(v.x && v.x.target) ? v.x.target : 'cutoff', value: c(v.x && v.x.value, 0, 1, o.cutoff) };
    o.y = { target: SYNTH_TARGETS.includes(v.y && v.y.target) ? v.y.target : 'reso', value: c(v.y && v.y.value, 0, 1, o.reso) };
    return o;
  }
  // PADS keeps the position-based layout (groups, count); names come from the active kit
  const PADS = KITS[0].pads;
  // Any kit can play in any slot (seq.kits); the demos assume kit == slot
  const kitOf = slot => KITS[seq.kits[slot] == null ? slot : seq.kits[slot]];
  // A saved kit is an id ('808') or, in older saves, an index. Unknown ids (a sampled
  // kit that registers later, or one this install lacks) are parked in seq.pendingKits
  const resolveKit = (v, slot) => {
    if (typeof v === 'number' && KITS[v] && !KITS[v].sampled) return v;
    if (typeof v === 'string') { const i = KITS.findIndex(k => k.id === v); if (i >= 0) return i; seq.pendingKits[slot] = v; }
    return slot;
  };
  const kitIds = () => seq.kits.map(k => KITS[k].id);
  // Step levels: 0 off, 1 normal, 2 accent
  const LEVEL_VEL = [0, 0.85, 1.15];
  // Spring reverb send per pad group (a pad can override with a `verb` field)
  const VERB_SEND = { fx: 0.4, perc: 0.15, drum: 0.1, bass: 0 };
  const DEFAULT_FX = () => ({ spring: { wet: 0, decay: 1.4 }, tape: { wet: 1, fb: 0.48 }, crush: { wet: 0, bits: 8 } });
  // Per-pad mixer, one set per slot: level (0..1.5), pan (-1..1), delay send `a`
  // and spring send `b` (0..1). Defaults come from the slot's kit pad definition
  const padDefaultMix = (slot, i) => {
    const pad = kitOf(slot).pads[i];
    return { lvl: 1, pan: 0, a: pad.send || 0, b: pad.verb == null ? VERB_SEND[pad.group] : pad.verb };
  };
  const defaultMix = slot => PADS.map((_, i) => padDefaultMix(slot, i));
  function normalizeMix(m, slot) {
    const c = (v, lo, hi, d) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, +v)) : d);
    return PADS.map((_, i) => {
      const d = padDefaultMix(slot, i), s = Array.isArray(m) && m[i] && typeof m[i] === 'object' ? m[i] : {};
      return { lvl: c(s.lvl, 0, 1.5, 1), pan: c(s.pan, -1, 1, 0), a: c(s.a, 0, 1, d.a), b: c(s.b, 0, 1, d.b) };
    });
  }
  const isDefaultMix = (m, slot, i) => { const d = padDefaultMix(slot, i); return m.lvl === 1 && m.pan === 0 && m.a === d.a && m.b === d.b; };
  function normalizeFx(f) {
    const d = DEFAULT_FX(), c = (v, lo, hi, dflt) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, +v)) : dflt);
    if (!f || typeof f !== 'object') return d;
    return {
      spring: { wet: c(f.spring && f.spring.wet, 0, 1, 0), decay: c(f.spring && f.spring.decay, 0.5, 3, 1.4) },
      tape: { wet: c(f.tape && f.tape.wet, 0, 1, 1), fb: c(f.tape && f.tape.fb, 0.2, 0.9, 0.48) },
      crush: { wet: c(f.crush && f.crush.wet, 0, 1, 0), bits: c(f.crush && f.crush.bits, 4, 12, 8) },
    };
  }
  const GROUP_COLOR = {
    drum: 'var(--pad-drum)', perc: 'var(--pad-perc)', bass: 'var(--pad-bass)', fx: 'var(--pad-fx)',
  };

  // ------------------------------------------------------------------
  // Audio engine
  // ------------------------------------------------------------------
  class Engine {
    constructor() {
      this.ctx = null;
      this.ready = false;
      this.punch = { delay: false, lp: false, hp: false };
      this.samples = PADS.map(() => null); // per pad: { buffer, name, start, end, gain, pitch }
      this.pending = [];                    // raw samples loaded from storage before the context exists
      this.clickLevel = 1;
    }

    // Build an AudioBuffer from raw channel data (Float32Array[])
    makeBuffer(channels, sampleRate) {
      const ctx = this.ctx;
      const buf = ctx.createBuffer(channels.length, channels[0].length, sampleRate);
      channels.forEach((ch, i) => buf.copyToChannel(ch, i));
      return buf;
    }
    setSample(padIdx, s) { this.samples[padIdx] = s; }
    clearSample(padIdx) { this.samples[padIdx] = null; }
    _materializePending() {
      this.pending.forEach(p => {
        try { this.samples[p.pad] = { ...p, buffer: this.makeBuffer(p.channels, p.sampleRate) }; } catch (_) {}
      });
      this.pending = [];
    }
    // Play a trimmed sample into `out` at time t. Sample record fields beyond the trim:
    // fadeIn / fadeOut (s), pan (-1..1), mode ('oneshot' | 'gate' | 'loop'). GATE and LOOP
    // voices keep playing until release(pad) or `stopAt`; the sequencer passes stopAt
    // (one step) because it has no note-off
    playSample(t, out, s, { pad = -1, stopAt = 0 } = {}) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = s.buffer;
      src.playbackRate.value = Math.pow(2, (s.pitch || 0) / 12);
      const dur = s.buffer.duration;
      const off = Math.max(0, Math.min(dur, (s.start || 0) * dur));
      const end = Math.max(off + 0.005, Math.min(dur, (s.end == null ? 1 : s.end) * dur));
      const len = end - off;
      const g = ctx.createGain();
      const lvl = s.gain == null ? 1 : s.gain;
      const fin = Math.max(0.003, s.fadeIn || 0), fout = Math.max(0.008, s.fadeOut || 0);
      const mode = s.mode || 'oneshot';
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(lvl, t + fin);
      let dest = out;
      if (s.pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = s.pan; p.connect(out); dest = p; }
      src.connect(g).connect(dest);
      const handle = { src, g, lvl, fout };
      if (mode === 'loop') {
        src.loop = true; src.loopStart = off; src.loopEnd = end;
        src.start(t, off);
      } else {
        const playLen = len / src.playbackRate.value;
        if (mode === 'oneshot' || !stopAt) {
          // natural end: fade out over the last `fout` seconds
          g.gain.setValueAtTime(lvl, t + Math.max(fin, playLen - fout));
          g.gain.linearRampToValueAtTime(0.0001, t + playLen);
        }
        src.start(t, off, len);
      }
      if (mode !== 'oneshot') {
        if (stopAt) this._stopHandle(handle, stopAt);
        else if (pad >= 0) { this.held = this.held || {}; if (this.held[pad]) this._stopHandle(this.held[pad], t); this.held[pad] = handle; }
      }
      return src;
    }
    _stopHandle(h, at) {
      const t = Math.max(at, this.now), g = h.g.gain;
      // Hold whatever the fade-in has reached, then fade out from there
      if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(t);
      else { g.cancelScheduledValues(t); g.setValueAtTime(Math.max(0.0001, g.value), t); }
      if (h.live) g.setTargetAtTime(0.0001, t, h.fout / 4); else g.linearRampToValueAtTime(0.0001, t + h.fout);
      try { h.src.stop(t + h.fout + 0.01); } catch (_) {}
    }
    // Note-off for GATE and LOOP samples played live
    release(pad) {
      if (!this.held || !this.held[pad]) return;
      this._stopHandle(this.held[pad], this.now);
      delete this.held[pad];
    }
    releaseAll() { if (this.held) Object.keys(this.held).forEach(p => this.release(+p)); }
    previewSample(s) {
      if (!this.ready) return null;
      const out = this.ctx.createGain(); out.connect(this.bus);
      // Previews of GATE / LOOP run until STOP (pad -2 is the preview slot)
      return this.playSample(this.now, out, s, { pad: -2 });
    }

    init() {
      if (this.ctx) return this.ctx.resume();
      const AC = window.AudioContext || window.webkitAudioContext;
      // LOW LATENCY (Settings) asks for the smallest buffer the device allows
      const ctx = new AC({ latencyHint: settings.lowLatency ? 0 : 'interactive' });
      this._build(ctx);
      this._materializePending();
      if (this.fx) this.applyFx(this.fx, true);
      this.loadCrush();
      this.prerender();
      // WebKit treats Web Audio as media (silent switch, background rules) once a
      // buffer has played, so play one silent frame right away
      try { const b = ctx.createBuffer(1, 1, ctx.sampleRate); const src = ctx.createBufferSource(); src.buffer = b; src.connect(ctx.destination); src.start(); } catch (_) {}
      // A phone call, a headphone switch or the silent switch can interrupt the context
      ctx.addEventListener('statechange', () => { if (this.onState) this.onState(ctx.state); });
      return ctx.resume();
    }
    // A second engine on an OfflineAudioContext with the same graph, kits, samples and
    // settings as the live one, for rendering (audio export, resample). AudioBuffers
    // are not tied to a context, so the sample buffers are shared, not copied
    static offline(live, ctx) {
      const e = new Engine();
      e._build(ctx);
      e.samples = live.samples.slice();
      e.rendered = live.rendered;
      e.kitBuffers = live.kitBuffers;
      e.kit = live.kit; e.sidechain = live.sidechain; e.clickLevel = live.clickLevel;
      e.master.gain.value = live.master ? live.master.gain.value : 0.8;
      if (live.fx) e.applyFx(live.fx, true);
      e.synth = live.synth;
      return e;
    }
    // Build the whole graph against any BaseAudioContext (live or offline)
    _build(ctx) {
      this.ctx = ctx;

      // Master chain: bus -> lp -> hp -> comp -> master -> out
      this.bus = ctx.createGain();
      this.lp = ctx.createBiquadFilter();
      this.lp.type = 'lowpass'; this.lp.frequency.value = 20000; this.lp.Q.value = 0.9;
      this.hp = ctx.createBiquadFilter();
      this.hp.type = 'highpass'; this.hp.frequency.value = 20; this.hp.Q.value = 0.9;
      this.comp = ctx.createDynamicsCompressor();
      this.comp.threshold.value = -12; this.comp.ratio.value = 4;
      this.comp.attack.value = 0.003; this.comp.release.value = 0.12;
      this.master = ctx.createGain();
      this.master.gain.value = 0.8;
      // CRUSH sits between the bus and the filters as a wet / dry insert. The bit
      // reducer is an AudioWorklet loaded later (loadCrush); until then it is a bypass
      this.crushIn = ctx.createGain(); this.crushOut = ctx.createGain();
      this.crushDry = ctx.createGain(); this.crushDry.gain.value = 1;
      this.crushWet = ctx.createGain(); this.crushWet.gain.value = 0;
      this.crushIn.connect(this.crushDry).connect(this.crushOut);
      this.crushNode = null;
      this.bus.connect(this.crushIn);
      // Brick wall after the volume: a fast limiter, then a soft clip that only touches
      // the last 10 percent, then a stereo analyser for the LCD meter
      this.limiter = ctx.createDynamicsCompressor();
      this.limiter.threshold.value = -1; this.limiter.knee.value = 0; this.limiter.ratio.value = 20;
      this.limiter.attack.value = 0.001; this.limiter.release.value = 0.05;
      this.clip = ctx.createWaveShaper(); this.clip.curve = Engine.ceilingCurve(); this.clip.oversample = '2x';
      this.split = ctx.createChannelSplitter(2);
      this.meters = [ctx.createAnalyser(), ctx.createAnalyser()];
      this.meters.forEach((a, i) => { a.fftSize = 256; a.smoothingTimeConstant = 0; this.split.connect(a, i); });
      this.meterBuf = new Float32Array(256);
      this.lastHit = -10;
      // TAPE STOP: a delay line whose time grows quadratically while held, so the
      // playback rate falls linearly to zero (the graph clock cannot slow down)
      this.stopDelay = ctx.createDelay(1.5); this.stopDelay.delayTime.value = 0;
      // SWEEP: a bandpass with a 0.5 Hz LFO, crossfaded in while held
      this.sweepDry = ctx.createGain(); this.sweepDry.gain.value = 1;
      this.sweepWet = ctx.createGain(); this.sweepWet.gain.value = 0;
      this.sweepBP = ctx.createBiquadFilter(); this.sweepBP.type = 'bandpass'; this.sweepBP.frequency.value = 900; this.sweepBP.Q.value = 2.5;
      this.sweepLfo = ctx.createOscillator(); this.sweepLfo.type = 'sine'; this.sweepLfo.frequency.value = 0.5;
      this.sweepDepth = ctx.createGain(); this.sweepDepth.gain.value = 700;
      this.sweepLfo.connect(this.sweepDepth).connect(this.sweepBP.frequency); this.sweepLfo.start();
      this.crushOut.connect(this.stopDelay);
      this.stopDelay.connect(this.sweepDry).connect(this.lp);
      this.stopDelay.connect(this.sweepBP).connect(this.sweepWet).connect(this.lp);
      this.lp.connect(this.hp).connect(this.comp).connect(this.master).connect(this.limiter).connect(this.clip).connect(ctx.destination);
      this.clip.connect(this.split);

      // TAPE delay: delayIn -> delay -> tone -> soft clip -> feedback -> delay ; tone -> wet -> bus
      // A slow LFO wobbles the delay time (wow and flutter)
      this.delayIn = ctx.createGain();
      this.delay = ctx.createDelay(2.0);
      this.delayTone = ctx.createBiquadFilter();
      this.delayTone.type = 'lowpass'; this.delayTone.frequency.value = 3000;
      this.tapeSat = ctx.createWaveShaper(); this.tapeSat.curve = Engine.softClipCurve(); this.tapeSat.oversample = '2x';
      this.feedback = ctx.createGain(); this.feedback.gain.value = 0.48;
      this.delayWet = ctx.createGain(); this.delayWet.gain.value = 1;
      this.delayIn.connect(this.delay).connect(this.delayTone).connect(this.tapeSat).connect(this.feedback).connect(this.delay);
      this.delayTone.connect(this.delayWet).connect(this.bus);
      this.wow = ctx.createOscillator(); this.wow.type = 'sine'; this.wow.frequency.value = 0.4;
      this.wowDepth = ctx.createGain(); this.wowDepth.gain.value = 0.0012;
      this.wow.connect(this.wowDepth).connect(this.delay.delayTime);
      this.wow.start();

      // SPRING reverb: verbIn -> convolver (generated spring impulse) -> bandpass -> wet -> bus
      this.verbIn = ctx.createGain();
      this.verb = ctx.createConvolver();
      this.verbDecay = 1.4;
      this.verb.buffer = Engine.springImpulse(ctx, this.verbDecay);
      this.verbTone = ctx.createBiquadFilter();
      this.verbTone.type = 'bandpass'; this.verbTone.frequency.value = 1500; this.verbTone.Q.value = 0.5;
      this.verbWet = ctx.createGain(); this.verbWet.gain.value = 0;
      this.verbIn.connect(this.verb).connect(this.verbTone).connect(this.verbWet).connect(this.bus);

      // Punch-in delay: everything on the bus gets thrown into the delay while held
      this.punchSend = ctx.createGain(); this.punchSend.gain.value = 0;
      this.bus.connect(this.punchSend).connect(this.delayIn);

      // Sidechain: bass and FX voices pass through this gain, which the kick dips
      this.duck = ctx.createGain(); this.duck.gain.value = 1;
      this.duck.connect(this.bus);

      // Shared noise buffer, seeded so every device gets the same hats and claps
      this.noise = Engine.seededNoise(ctx);
      this.rendered = this.rendered || {}; // 'kit:pad' -> pre-rendered voice buffer

      this.ready = true;
    }
    static seededNoise(ctx, seconds = 2) {
      const len = Math.floor(ctx.sampleRate * seconds);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      let s = 0x2545f491; // xorshift32
      for (let i = 0; i < len; i++) { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; d[i] = (s / 4294967296) * 2 - 1; }
      return buf;
    }
    static isNoiseVoice(pad) {
      return ['hat', 'noise', 'clap'].includes(pad.voice) || ['clap', 'chat', 'ohat', 'shaker'].includes(pad.synth);
    }
    // Render one synth pad into a mono buffer on a throwaway offline context. Voices only
    // touch this.ctx, this.noise and the small helpers, so a bare object with the Engine
    // prototype is enough (no master graph, no convolver)
    async renderPad(kit, padIdx, seconds = 0.9) {
      const key = `${kit}:${padIdx}`;
      if (this.rendered[key]) return this.rendered[key];
      const pad = KITS[kit].pads[padIdx];
      const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      const sr = this.ctx ? this.ctx.sampleRate : 44100;
      const octx = new OAC(1, Math.ceil(sr * seconds), sr);
      const e = Object.create(Engine.prototype);
      e.ctx = octx; e.noise = this.noise && this.noise.sampleRate === sr ? this.noise : Engine.seededNoise(octx);
      const out = octx.createGain(); out.connect(octx.destination);
      if (pad.voice) { const v = e[`v_${pad.voice}`]; if (v) v.call(e, 0, out, pad.p || {}); }
      else { const fn = e[`s_${pad.synth}`]; if (fn) fn.call(e, 0, out); }
      const buf = await octx.startRendering();
      this.rendered[key] = buf;
      return buf;
    }
    // Pre-render every noise-based pad of every kit (hats, claps, shakers): identical on
    // every device and one buffer source per hit instead of a filter and envelope chain
    async prerender() {
      if (this._prerendered) return; this._prerendered = true;
      for (let k = 0; k < KITS.length; k++) {
        for (let i = 0; i < PADS.length; i++) {
          if (Engine.isNoiseVoice(KITS[k].pads[i])) { try { await this.renderPad(k, i); } catch (_) {} }
        }
      }
    }

    get now() { return this.ctx ? this.ctx.currentTime : 0; }
    // Seconds between a scheduled time and the sound leaving the device (0 when unknown)
    get latency() { return this.ctx ? (this.ctx.baseLatency || 0) + (this.ctx.outputLatency || 0) : 0; }

    // --- built-in synth --------------------------------------------------
    // Effective parameters: the X and Y surface positions override their targets
    synthParams() {
      const P = this.synth || DEFAULT_SYNTH();
      const e = { ...P };
      if (P.x) e[P.x.target] = P.x.value;
      if (P.y) e[P.y.target] = P.y.value;
      return e;
    }
    // Two oscillators (detuned) plus a sub, resonant low-pass with an envelope, drive,
    // amp envelope with sustain. Held until release(pad) or stopAt like GATE samples
    playSynth(t, out, semis, { pad = -1, stopAt = 0 } = {}) {
      const ctx = this.ctx, P = this.synthParams();
      const freq = 65.4064 * Math.pow(2, P.octave - 2) * Math.pow(2, semis / 12); // C2 root
      const g = ctx.createGain();
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.5 + P.reso * 14;
      const fc = 60 * Math.pow(200, P.cutoff);                 // 60 Hz .. 12 kHz
      const peak = Math.min(18000, fc * (1 + P.env * 10));
      f.frequency.setValueAtTime(fc, t);
      if (P.env > 0) { f.frequency.linearRampToValueAtTime(peak, t + 0.004); f.frequency.setTargetAtTime(fc, t + 0.004, 0.02 + P.decay * 0.6); }
      let pre = f;
      if (P.drive > 0) { const ws = ctx.createWaveShaper(); const n = 512, c = new Float32Array(n), k = 1 + P.drive * 12; for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * k) / Math.tanh(k); } ws.curve = c; ws.oversample = '2x'; ws.connect(f); pre = ws; }
      const mk = (type, level) => { const o = ctx.createOscillator(); o.type = type; const og = ctx.createGain(); og.gain.value = level; o.connect(og).connect(pre); return o; };
      const oscs = [mk(P.wave, 0.45), mk(P.wave, 0.45)];
      if (P.sub > 0) oscs.push(mk('sine', P.sub * 0.6));
      oscs[1].detune.value = 4 + P.detune * 40;
      oscs[0].detune.value = -(P.detune * 10);
      const target = i => (i === 2 ? freq / 2 : freq);
      // Glide slides in from the previous note
      if (P.glide > 0 && this.lastSynthFreq) {
        const from = this.lastSynthFreq;
        oscs.forEach((o, i) => { o.frequency.setValueAtTime(from * (i === 2 ? 0.5 : 1), t); o.frequency.exponentialRampToValueAtTime(target(i), t + 0.01 + P.glide * 0.4); });
      } else oscs.forEach((o, i) => o.frequency.setValueAtTime(target(i), t));
      this.lastSynthFreq = freq;
      const atk = 0.002 + P.attack * 1.2, dec = 0.03 + P.decay * 1.5, sus = Math.max(0.0001, P.sustain), rel = 0.01 + P.release * 1.5;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(1, t + atk);
      g.gain.setTargetAtTime(sus, t + atk, dec / 3);
      f.connect(g).connect(out);
      oscs.forEach(o => { o.start(t); o.stop(t + 30); });
      const handle = { src: { stop: at => oscs.forEach(o => { try { o.stop(at); } catch (_) {} }) }, g, lvl: sus, fout: rel, live: true };
      if (stopAt) this._stopHandle(handle, stopAt);
      else if (pad >= 0) { this.held = this.held || {}; if (this.held[pad]) this._stopHandle(this.held[pad], t); this.held[pad] = handle; }
      else this._stopHandle(handle, t + atk + dec);
    }
    // --- master FX -----------------------------------------------------
    // Unity below 0.9, then a tanh bend into 1.0: inaudible on a normal mix, a safety
    // net when the limiter's 1 ms attack lets a transient through
    static ceilingCurve() {
      const n = 4096, c = new Float32Array(n), k = 0.9;
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * 2 - 1, a = Math.abs(x);
        c[i] = Math.sign(x) * (a <= k ? a : k + (1 - k) * Math.tanh((a - k) / (1 - k)));
      }
      return c;
    }
    // Peak per channel since the last read (0..1+), for the LCD meter
    readMeter() {
      return this.meters.map(a => {
        a.getFloatTimeDomainData(this.meterBuf);
        let p = 0;
        for (let i = 0; i < this.meterBuf.length; i++) { const v = Math.abs(this.meterBuf[i]); if (v > p) p = v; }
        return p;
      });
    }
    static softClipCurve() {
      const n = 1024, c = new Float32Array(n);
      for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * 1.6) / Math.tanh(1.6); }
      return c;
    }
    // A spring is a dispersive delay line: the impulse is a train of short downward
    // chirps whose spacing stretches a little each time, decaying over `decay` seconds
    static springImpulse(ctx, decay = 1.4) {
      const sr = ctx.sampleRate, len = Math.floor(sr * Math.min(2, decay + 0.3));
      const buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
      let seed = 1337;
      const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      let t = 0.004, k = 0;
      while (t < len / sr) {
        const amp = Math.exp(-t / (decay * 0.45)) * (0.9 + rnd() * 0.2);
        const start = Math.floor(t * sr), burst = Math.floor(sr * 0.006);
        for (let i = 0; i < burst && start + i < len; i++) {
          const ph = i / burst;
          const f = 2600 - 1800 * ph; // chirp down
          d[start + i] += amp * Math.sin(2 * Math.PI * f * i / sr) * Math.exp(-ph * 3) * 0.6;
        }
        k += 1;
        t += 0.0052 * (1 + k * 0.012);
      }
      // A little diffuse tail underneath so it does not sound like a pure comb
      for (let i = 0; i < len; i++) d[i] += (rnd() * 2 - 1) * Math.exp(-i / (sr * decay * 0.35)) * 0.08;
      let peak = 0; for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(d[i]));
      if (peak > 0) for (let i = 0; i < len; i++) d[i] /= peak;
      return buf;
    }
    // Load the CRUSH worklet on this context and patch it into the insert (no-op when
    // AudioWorklet is missing: the insert stays a bypass)
    async loadCrush() {
      if (this.crushNode || !this.ctx || !this.ctx.audioWorklet) return;
      try {
        await this.ctx.audioWorklet.addModule('crush-worklet.js');
        const n = new AudioWorkletNode(this.ctx, 'rhythm-crush', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2] });
        this.crushNode = n;
        this.crushIn.connect(n).connect(this.crushWet).connect(this.crushOut);
        if (this.fx) this.applyFx(this.fx, true);
      } catch (_) { /* leave the bypass */ }
    }
    // fx = { spring: { wet, decay }, tape: { wet, fb }, crush: { wet, bits } }, all 0..1 except decay (s) and bits
    applyFx(fx, now = false) {
      this.fx = fx;
      if (!this.ctx) return;
      const t = this.now, set = (p, v) => (now ? p.setValueAtTime(v, t) : p.setTargetAtTime(v, t, 0.03));
      set(this.verbWet.gain, fx.spring.wet * 1.4);
      if (Math.abs(fx.spring.decay - this.verbDecay) > 0.05) { this.verbDecay = fx.spring.decay; this.verb.buffer = Engine.springImpulse(this.ctx, fx.spring.decay); }
      set(this.delayWet.gain, fx.tape.wet);
      set(this.feedback.gain, fx.tape.fb);
      set(this.wowDepth.gain, 0.0004 + fx.tape.fb * 0.002);
      const w = this.crushNode ? fx.crush.wet : 0;
      set(this.crushWet.gain, w); set(this.crushDry.gain, 1 - w);
      if (this.crushNode) {
        set(this.crushNode.parameters.get('bits'), fx.crush.bits);
        set(this.crushNode.parameters.get('reduce'), Math.round(1 + (12 - fx.crush.bits) * 0.6));
      }
    }

    // Panic: silence everything now. Held voices get their release, the master dips to
    // zero for a moment, and the delay feedback, delay return and spring return are
    // muted long enough for the lines to empty (the delay holds up to 2 s), then the
    // master FX settings come back
    panic() {
      if (!this.ctx) return;
      const t = this.now;
      this.panicked = true;
      this.releaseAll();
      const cut = (p, from) => { p.cancelScheduledValues(t); p.setValueAtTime(from, t); p.linearRampToValueAtTime(0, t + 0.03); };
      cut(this.master.gain, this.master.gain.value);
      [this.feedback.gain, this.delayWet.gain, this.verbWet.gain, this.punchSend.gain, this.delayIn.gain, this.verbIn.gain].forEach(p => cut(p, p.value));
      this.panicked = true;
      clearTimeout(this._panicTimer);
      this._panicTimer = setTimeout(() => this.unpanic(), 2200);
    }
    // Bring the master and the FX returns back (after the panic timer, or as soon as PLAY is pressed)
    unpanic() {
      clearTimeout(this._panicTimer); this._panicTimer = null;
      if (!this.ctx || !this.panicked) return;
      this.panicked = false;
      const now = this.now;
      [this.delayIn.gain, this.verbIn.gain].forEach(p => { p.cancelScheduledValues(now); p.setValueAtTime(1, now); });
      if (this.fx) this.applyFx(this.fx, true);
      this.master.gain.cancelScheduledValues(this.now);
      this.master.gain.setTargetAtTime(this._masterLevel == null ? 0.8 : this._masterLevel, this.now, 0.05);
    }
    setBpm(bpm) {
      if (!this.ctx) return;
      // dotted-eighth dub delay
      const t = (60 / bpm) * 0.75;
      this.delay.delayTime.setTargetAtTime(t, this.now, 0.05);
    }

    setVolume(v) {
      this._masterLevel = v;
      if (!this.ctx) return;
      this.master.gain.setTargetAtTime(v, this.now, 0.02);
    }

    // amount 0..1 is the live FX intensity (drag on a held button); 0.7 is the plain press
    setPunch(fx, on, amount = 0.7) {
      if (!this.ctx) return;
      const t = this.now, a = Math.min(1, Math.max(0, amount));
      this.punch[fx] = on;
      switch (fx) {
        case 'delay':
          this.punchSend.gain.setTargetAtTime(on ? 0.3 + 0.7 * a : 0, t, 0.01);
          break;
        case 'lp': {
          // a = 1 closes to 420 Hz, a = 0 leaves it open (log scale in between)
          const f = 20000 * Math.pow(420 / 20000, a);
          this.lp.frequency.cancelScheduledValues(t);
          this.lp.frequency.setTargetAtTime(on ? f : 20000, t, on ? 0.03 : 0.08);
          break;
        }
        case 'hp': {
          const f = 20 * Math.pow(1400 / 20, a);
          this.hp.frequency.cancelScheduledValues(t);
          this.hp.frequency.setTargetAtTime(on ? f : 20, t, on ? 0.03 : 0.08);
          break;
        }
        case 'tapestop': {
          // Stop over 0.35 s (a = 0) to 1.4 s (a = 1); delay(t) = t^2 / (2 T) reaches rate 0 at T
          const p = this.stopDelay.delayTime;
          p.cancelScheduledValues(t);
          if (on) {
            const T = 0.35 + 1.05 * a, n = 64, curve = new Float32Array(n);
            for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * T; curve[i] = Math.min(1.45, (x * x) / (2 * T)); }
            p.setValueAtTime(p.value, t);
            p.setValueCurveAtTime(curve, t + 0.001, T);
            this.lp.frequency.cancelScheduledValues(t);
            this.lp.frequency.setTargetAtTime(300, t, T * 0.5);
          } else {
            p.setValueAtTime(p.value, t);
            p.linearRampToValueAtTime(0, t + 0.12);
            if (!this.punch.lp) { this.lp.frequency.cancelScheduledValues(t); this.lp.frequency.setTargetAtTime(20000, t, 0.08); }
          }
          break;
        }
        case 'sweep':
          this.sweepDepth.gain.setTargetAtTime(300 + 600 * a, t, 0.02);
          this.sweepWet.gain.setTargetAtTime(on ? 1 : 0, t, 0.02);
          this.sweepDry.gain.setTargetAtTime(on ? 0 : 1, t, 0.02);
          break;
      }
    }

    // --- helpers -----------------------------------------------------
    _voice(t, vel, send, ducked = false, verb = 0, pan = 0, filter = 1) {
      const out = this.ctx.createGain();
      out.gain.value = vel;
      // Voice cap: at most 32 voices younger than 2.5 s; the oldest non-bass one is
      // faded out in 5 ms when the cap is hit (bass is exempt unless it is all bass)
      this.voices = this.voices || [];
      const now = this.now;
      this.voices = this.voices.filter(v => v.t > now - 2.5);
      if (this.voices.length >= 32) {
        let idx = this.voices.findIndex(v => !v.bass); if (idx < 0) idx = 0;
        const v = this.voices.splice(idx, 1)[0];
        try { v.g.gain.cancelScheduledValues(t); v.g.gain.setValueAtTime(v.g.gain.value, t); v.g.gain.linearRampToValueAtTime(0, t + 0.005); } catch (_) {}
        this.stolen = (this.stolen || 0) + 1;
      }
      this.voices.push({ g: out, t, bass: ducked && verb === 0 });
      const dest = ducked ? this.duck : this.bus;
      // Per-hit low-pass from a parameter lock: 300 Hz (0) to 18 kHz (1), log scale
      let node = out;
      if (filter < 1) {
        const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.8;
        lp.frequency.value = 300 * Math.pow(60, Math.max(0, filter));
        out.connect(lp); node = lp;
      }
      if (pan && this.ctx.createStereoPanner) {
        const p = this.ctx.createStereoPanner(); p.pan.value = pan;
        node.connect(p).connect(dest);
      } else node.connect(dest);
      if (send > 0) {
        const s = this.ctx.createGain();
        s.gain.value = send;
        node.connect(s).connect(this.delayIn);
      }
      if (verb > 0 && this.verbIn) {
        const s = this.ctx.createGain();
        s.gain.value = verb;
        node.connect(s).connect(this.verbIn);
      }
      return out;
    }
    _env(param, t, peak, decay, attack = 0.001) {
      param.cancelScheduledValues(t);
      param.setValueAtTime(0.0001, t);
      param.linearRampToValueAtTime(peak, t + attack);
      param.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    }
    _osc(type, freq, t) {
      const o = this.ctx.createOscillator();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      return o;
    }
    _noise(t, dur) {
      const s = this.ctx.createBufferSource();
      s.buffer = this.noise; s.loop = true;
      s.start(t); s.stop(t + dur + 0.05);
      return s;
    }
    _filt(type, freq, q = 1) {
      const f = this.ctx.createBiquadFilter();
      f.type = type; f.frequency.value = freq; f.Q.value = q;
      return f;
    }

    // mix = { lvl, pan, a, b } from the per-pad mixer; without it the kit defaults apply
    // semis: pitch offset for KEYS mode. Samples change playbackRate; synth pads play
    // their pre-rendered buffer at the new rate (rendered on demand the first time)
    trigger(padIdx, time, vel = 1, mix = null, { stopAt = 0, semis = 0, filter = 1, sendMul = 1 } = {}) {
      if (!this.ready) return;
      const kit = this.kit || 0;
      const pad = KITS[kit].pads[padIdx];
      if (semis && !this.samples[padIdx] && !KITS[kit].sampled && !KITS[kit].synth && !this.rendered[`${kit}:${padIdx}`]) {
        // First note on this pad: render it, then play (a few ms late, once)
        this.renderPad(kit, padIdx, 1.5).then(() => this.trigger(padIdx, time, vel, mix, { stopAt, semis, filter, sendMul })).catch(() => {});
        return;
      }
      const t = Math.max(time, this.now);
      this.lastHit = Math.max(this.lastHit, t);
      const ducked = this.sidechain && (pad.group === 'bass' || pad.group === 'fx');
      const m = mix || padDefaultMix(this.kit || 0, padIdx);
      if (this.onNote) this.onNote(padIdx, t, vel, m);
      if (m.lvl <= 0) return;
      const out = this._voice(t, vel * m.lvl, m.a * sendMul, ducked, m.b, m.pan, filter);
      const smp = this.samples[padIdx];
      // A sample's own choke group beats the kit default ('none' opts out)
      const choke = smp && smp.choke != null ? (smp.choke === 'none' ? undefined : smp.choke) : pad.choke;
      if (this.sidechain && padIdx === 12) {
        // Kick pad: dip the duck bus fast, let it breathe back over a quarter second
        const g = this.duck.gain;
        g.cancelScheduledValues(t);
        g.setValueAtTime(Math.max(0.05, g.value), t);
        g.linearRampToValueAtTime(0.3, t + 0.012);
        g.exponentialRampToValueAtTime(1, t + 0.28);
      }
      if (choke) {
        // Cut any other voice still ringing in this choke group (e.g. open hat)
        this.chokes = this.chokes || {};
        const list = this.chokes[choke] || [];
        list.forEach(g => { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + 0.012); });
        this.chokes[choke] = [out];
      }
      if (smp && smp.buffer) { this.playSample(t, out, semis ? { ...smp, pitch: (smp.pitch || 0) + semis } : smp, { pad: padIdx, stopAt }); return; }
      // Sampled kit: its decoded file (silent until the kit has loaded); synth pads may
      // have a pre-rendered buffer instead
      if (KITS[kit].synth) { this.playSynth(t, out, (pad.note || 0) + semis, { pad: padIdx, stopAt }); return; }
      const sampled = !!KITS[kit].sampled;
      const pre = sampled ? (this.kitBuffers && this.kitBuffers[kit] ? this.kitBuffers[kit][padIdx] : null) : this.rendered[`${kit}:${padIdx}`];
      if (sampled && !pre) return;
      if (pre) {
        const src = this.ctx.createBufferSource();
        src.buffer = pre;
        src.playbackRate.value = Math.pow(2, semis / 12);
        if (sampled) out.gain.value *= pad.gain == null ? 1 : pad.gain;
        else out.gain.value *= 0.94 + ((t * 7919) % 1) * 0.06; // level jitter so rolls do not sound like a machine gun
        src.connect(out); src.start(t);
        if (stopAt && sampled && pre.duration > 1.5) { try { src.stop(stopAt + 0.5); } catch (_) {} }
        return;
      }
      if (pad.voice) { const v = this[`v_${pad.voice}`]; if (v) v.call(this, t, out, pad.p || {}); return; }
      const fn = this[`s_${pad.synth}`];
      if (fn) fn.call(this, t, out);
    }

    // --- parameterized voices (kits B, C, D) ---------------------------
    v_kick(t, out, p) {
      const ctx = this.ctx;
      const o = this._osc('sine', p.f0 || 150, t);
      o.frequency.exponentialRampToValueAtTime(p.f1 || 45, t + (p.pd || 0.1));
      const g = ctx.createGain(); this._env(g.gain, t, 1.1, p.dec || 0.4);
      o.connect(g).connect(out); o.start(t); o.stop(t + (p.dec || 0.4) + 0.1);
      if (p.click) {
        const n = this._noise(t, 0.03);
        const f = this._filt('bandpass', 3000, 1.2);
        const ng = ctx.createGain(); this._env(ng.gain, t, p.click, 0.02);
        n.connect(f).connect(ng).connect(out);
      }
    }
    v_snare(t, out, p) {
      const ctx = this.ctx;
      const n = this._noise(t, p.ndec || 0.2);
      const f = this._filt('bandpass', p.noise || 1800, p.q || 0.8);
      const ng = ctx.createGain(); this._env(ng.gain, t, p.nmix == null ? 0.8 : p.nmix, p.ndec || 0.2);
      n.connect(f).connect(ng).connect(out);
      const o = this._osc('triangle', p.tone || 200, t);
      o.frequency.exponentialRampToValueAtTime((p.tone || 200) * 0.7, t + 0.08);
      const g = ctx.createGain(); this._env(g.gain, t, 0.7, p.tdec || 0.12);
      o.connect(g).connect(out); o.start(t); o.stop(t + (p.tdec || 0.12) + 0.1);
    }
    v_hat(t, out, p) {
      const ctx = this.ctx;
      const g = ctx.createGain(); this._env(g.gain, t, 0.45, p.dec || 0.05);
      const f = this._filt('highpass', p.hp || 7000);
      f.connect(g).connect(out);
      if (p.metal) {
        // 808-style: six square waves at inharmonic ratios through a bandpass
        const bp = this._filt('bandpass', 10000, 1); bp.connect(f);
        [1, 1.342, 1.2312, 1.6532, 1.9523, 2.1523].forEach(r => {
          const o = this._osc('square', 40 * r * 10, t);
          const og = ctx.createGain(); og.gain.value = 0.18;
          o.connect(og).connect(bp); o.start(t); o.stop(t + (p.dec || 0.05) + 0.1);
        });
      } else {
        this._noise(t, p.dec || 0.05).connect(f);
      }
    }
    v_tom(t, out, p) {
      const ctx = this.ctx;
      const o = this._osc('sine', p.f0 || 200, t);
      o.frequency.exponentialRampToValueAtTime(p.f1 || 100, t + (p.dec || 0.3) * 0.6);
      const g = ctx.createGain(); this._env(g.gain, t, 0.9, p.dec || 0.3);
      o.connect(g).connect(out); o.start(t); o.stop(t + (p.dec || 0.3) + 0.1);
      if (p.noise) {
        const n = this._noise(t, 0.04);
        const nf = this._filt('bandpass', 1500, 1);
        const ng = ctx.createGain(); this._env(ng.gain, t, p.noise * 0.6, 0.03);
        n.connect(nf).connect(ng).connect(out);
      }
    }
    v_rim(t, out, p) {
      const ctx = this.ctx;
      const o = this._osc('square', p.f || 1000, t);
      const f = this._filt('bandpass', (p.f || 1000) * 2, 4);
      const g = ctx.createGain(); this._env(g.gain, t, 0.8, p.dec || 0.05);
      o.connect(f).connect(g).connect(out); o.start(t); o.stop(t + (p.dec || 0.05) + 0.05);
      const n = this._noise(t, 0.02);
      const nf = this._filt('highpass', 4000);
      const ng = ctx.createGain(); this._env(ng.gain, t, 0.3, 0.02);
      n.connect(nf).connect(ng).connect(out);
    }
    v_noise(t, out, p) {
      const ctx = this.ctx;
      const n = this._noise(t, p.dec || 0.1);
      const f = this._filt('bandpass', p.f || 5000, p.q || 1);
      const g = ctx.createGain(); this._env(g.gain, t, 0.5, p.dec || 0.1, p.atk || 0.005);
      n.connect(f).connect(g).connect(out);
    }
    v_clap(t, out, p) {
      const ctx = this.ctx;
      const f = this._filt('bandpass', p.f || 1300, 1.4); f.connect(out);
      const count = p.count || 3, spread = p.spread || 0.011;
      for (let i = 0; i < count; i++) {
        const tt = t + i * spread;
        const n = this._noise(tt, 0.03);
        const g = ctx.createGain(); this._env(g.gain, tt, 0.6, 0.02);
        n.connect(g).connect(f);
      }
      const tail = this._noise(t + count * spread, p.dec || 0.2);
      const tg = ctx.createGain(); this._env(tg.gain, t + count * spread, 0.7, p.dec || 0.2);
      tail.connect(tg).connect(f);
    }
    v_bell(t, out, p) {
      const ctx = this.ctx;
      const f = this._filt('bandpass', p.f || 700, p.q || 2.5);
      const g = ctx.createGain(); this._env(g.gain, t, 0.5, p.dec || 0.3);
      f.connect(g).connect(out);
      (p.freqs || [562, 845]).forEach(fr => {
        const o = this._osc(p.wave || 'square', fr, t);
        o.connect(f); o.start(t); o.stop(t + (p.dec || 0.3) + 0.1);
      });
    }
    v_sub(t, out, p) {
      const ctx = this.ctx;
      const o = this._osc(p.wave || 'sine', p.glideFrom || p.f || 55, t);
      if (p.glideFrom) o.frequency.exponentialRampToValueAtTime(p.f || 55, t + (p.glideT || 0.06));
      const f = this._filt('lowpass', p.lp || 260, 0.7);
      const g = ctx.createGain(); this._env(g.gain, t, 1.0, p.dec || 0.7, 0.004);
      o.connect(f).connect(g).connect(out); o.start(t); o.stop(t + (p.dec || 0.7) + 0.2);
      if ((p.wave || 'sine') !== 'sine') {
        // add a clean sine underneath so square / triangle basses still have weight
        const s = this._osc('sine', p.f || 55, t);
        const sg = ctx.createGain(); sg.gain.value = 0.5;
        s.connect(sg).connect(g); s.start(t); s.stop(t + (p.dec || 0.7) + 0.2);
      }
    }
    v_chord(t, out, p) {
      const ctx = this.ctx;
      const f = this._filt('lowpass', p.cut0 || 3000, 1.2);
      f.frequency.setValueAtTime(p.cut0 || 3000, t);
      f.frequency.exponentialRampToValueAtTime(p.cut1 || 500, t + (p.dec || 0.2) * 0.8);
      const g = ctx.createGain(); this._env(g.gain, t, 0.26 / Math.sqrt((p.freqs || []).length || 1) * 1.6, p.dec || 0.2, 0.003);
      f.connect(g).connect(out);
      (p.freqs || [220, 261.63, 329.63]).forEach((fr, i) => {
        const o = this._osc(p.wave || 'sawtooth', fr, t + i * 0.003);
        if (p.detune) o.detune.value = (i % 2 ? 1 : -1) * p.detune;
        o.connect(f); o.start(t + i * 0.003); o.stop(t + (p.dec || 0.2) + 0.1);
      });
    }
    v_lead(t, out, p) {
      const ctx = this.ctx;
      const o = this._osc(p.wave || 'sawtooth', p.f || 330, t);
      if (p.vib) {
        const lfo = this._osc('sine', p.vib, t);
        const lg = ctx.createGain(); lg.gain.value = (p.f || 330) * 0.012;
        lfo.connect(lg).connect(o.frequency); lfo.start(t); lfo.stop(t + (p.dec || 0.4) + 0.1);
      }
      const f = this._filt('lowpass', p.cut || 1500, 1);
      const g = ctx.createGain(); this._env(g.gain, t, 0.35, p.dec || 0.4, 0.01);
      o.connect(f).connect(g).connect(out); o.start(t); o.stop(t + (p.dec || 0.4) + 0.1);
    }
    v_sweep(t, out, p) {
      // siren / lazer / air horn: pitch f0 -> f1 by t1, then -> f2 by t2
      const ctx = this.ctx;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(p.level || 0.25, t + 0.02);
      g.gain.setValueAtTime(p.level || 0.25, t + Math.max(0.03, (p.dec || 0.5) - 0.12));
      g.gain.exponentialRampToValueAtTime(0.0001, t + (p.dec || 0.5));
      g.connect(out);
      const n = p.voices || 1;
      for (let i = 0; i < n; i++) {
        const o = this._osc(p.wave || 'sine', p.f0 || 700, t);
        o.detune.value = (i - (n - 1) / 2) * 9;
        o.frequency.linearRampToValueAtTime(p.f1 || 1200, t + (p.t1 || 0.3));
        o.frequency.linearRampToValueAtTime(p.f2 || p.f0 || 700, t + (p.t2 || 0.6));
        const og = ctx.createGain(); og.gain.value = 1 / n;
        o.connect(og).connect(g); o.start(t); o.stop(t + (p.dec || 0.5) + 0.05);
      }
    }
    v_hit(t, out, p) {
      const ctx = this.ctx;
      const n = this._noise(t, p.dec || 0.3);
      const f = this._filt('bandpass', p.noiseF || 1400, p.q || 0.7);
      const g = ctx.createGain(); this._env(g.gain, t, 0.9, p.dec || 0.3);
      n.connect(f).connect(g).connect(out);
      if (p.thumpF0) {
        const o = this._osc('triangle', p.thumpF0, t);
        o.frequency.exponentialRampToValueAtTime(p.thumpF1 || 60, t + 0.15);
        const og = ctx.createGain(); this._env(og.gain, t, 0.8, Math.min(0.3, p.dec || 0.3));
        o.connect(og).connect(out); o.start(t); o.stop(t + 0.4);
      }
    }
    v_pan(t, out, p) {
      // steel pan: a few sine partials with a fast bright attack
      const ctx = this.ctx;
      const f = p.f || 392;
      const g = ctx.createGain(); this._env(g.gain, t, 0.35, p.dec || 0.6, 0.004);
      g.connect(out);
      [[1, 1], [2, 0.5], [3.01, 0.25], [4.2, 0.12]].forEach(([r, a]) => {
        const o = this._osc('sine', f * r, t);
        const og = ctx.createGain(); og.gain.setValueAtTime(a, t);
        og.gain.exponentialRampToValueAtTime(a * 0.05, t + (p.dec || 0.6) / (r * 0.7));
        o.connect(og).connect(g); o.start(t); o.stop(t + (p.dec || 0.6) + 0.1);
      });
    }
    v_fm(t, out, p) {
      // two-operator FM: electric piano / bright keys
      const ctx = this.ctx;
      const car = this._osc('sine', p.f || 261.63, t);
      const mod = this._osc('sine', (p.f || 261.63) * (p.ratio || 2), t);
      const mg = ctx.createGain();
      mg.gain.setValueAtTime((p.f || 261.63) * (p.index || 2), t);
      mg.gain.exponentialRampToValueAtTime(1, t + (p.dec || 0.5) * 0.6);
      mod.connect(mg).connect(car.frequency);
      const g = ctx.createGain(); this._env(g.gain, t, 0.4, p.dec || 0.5, 0.003);
      car.connect(g).connect(out);
      mod.start(t); car.start(t); mod.stop(t + (p.dec || 0.5) + 0.1); car.stop(t + (p.dec || 0.5) + 0.1);
    }

    // Metronome click: high on the downbeat, low on other quarters
    click(t, downbeat) {
      if (!this.ready) return;
      const ctx = this.ctx;
      const o = this._osc('square', downbeat ? 1800 : 1200, t);
      const g = ctx.createGain(); this._env(g.gain, t, (downbeat ? 0.35 : 0.2) * this.clickLevel, 0.03);
      o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.05);
    }

    // --- kit ---------------------------------------------------------
    s_kick(t, out) {
      const ctx = this.ctx;
      const o = this._osc('sine', 165, t);
      o.frequency.exponentialRampToValueAtTime(46, t + 0.11);
      const g = ctx.createGain(); this._env(g.gain, t, 1.1, 0.5);
      o.connect(g).connect(out); o.start(t); o.stop(t + 0.6);
      // click
      const n = this._noise(t, 0.03);
      const f = this._filt('bandpass', 3200, 1.2);
      const ng = ctx.createGain(); this._env(ng.gain, t, 0.5, 0.02);
      n.connect(f).connect(ng).connect(out);
    }
    s_snare(t, out) {
      const ctx = this.ctx;
      const n = this._noise(t, 0.25);
      const f = this._filt('bandpass', 1900, 0.8);
      const ng = ctx.createGain(); this._env(ng.gain, t, 0.8, 0.22);
      n.connect(f).connect(ng).connect(out);
      const o = this._osc('triangle', 210, t);
      o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
      const g = ctx.createGain(); this._env(g.gain, t, 0.7, 0.13);
      o.connect(g).connect(out); o.start(t); o.stop(t + 0.2);
    }
    s_rim(t, out) {
      const ctx = this.ctx;
      const o = this._osc('square', 820, t);
      const f = this._filt('bandpass', 1800, 4);
      const g = ctx.createGain(); this._env(g.gain, t, 0.9, 0.06);
      o.connect(f).connect(g).connect(out); o.start(t); o.stop(t + 0.1);
      const n = this._noise(t, 0.03);
      const nf = this._filt('highpass', 4000);
      const ng = ctx.createGain(); this._env(ng.gain, t, 0.4, 0.025);
      n.connect(nf).connect(ng).connect(out);
    }
    s_clap(t, out) {
      const ctx = this.ctx;
      const f = this._filt('bandpass', 1300, 1.4);
      f.connect(out);
      for (let i = 0; i < 3; i++) {
        const tt = t + i * 0.011;
        const n = this._noise(tt, 0.03);
        const g = ctx.createGain(); this._env(g.gain, tt, 0.6, 0.02);
        n.connect(g).connect(f);
      }
      const tail = this._noise(t + 0.033, 0.25);
      const tg = ctx.createGain(); this._env(tg.gain, t + 0.033, 0.7, 0.2);
      tail.connect(tg).connect(f);
    }
    s_chat(t, out) {
      const ctx = this.ctx;
      const n = this._noise(t, 0.06);
      const f = this._filt('highpass', 7500);
      const g = ctx.createGain(); this._env(g.gain, t, 0.5, 0.05);
      n.connect(f).connect(g).connect(out);
    }
    s_ohat(t, out) {
      const ctx = this.ctx;
      const n = this._noise(t, 0.4);
      const f = this._filt('highpass', 6500);
      const g = ctx.createGain(); this._env(g.gain, t, 0.45, 0.35);
      n.connect(f).connect(g).connect(out);
    }
    s_tomlo(t, out) { this._tom(t, out, 130, 78, 0.38); }
    s_tomhi(t, out) { this._tom(t, out, 230, 150, 0.28); }
    _tom(t, out, f0, f1, dec) {
      const ctx = this.ctx;
      const o = this._osc('sine', f0, t);
      o.frequency.exponentialRampToValueAtTime(f1, t + dec * 0.6);
      const g = ctx.createGain(); this._env(g.gain, t, 0.9, dec);
      o.connect(g).connect(out); o.start(t); o.stop(t + dec + 0.1);
      const n = this._noise(t, 0.04);
      const nf = this._filt('bandpass', 1500, 1);
      const ng = ctx.createGain(); this._env(ng.gain, t, 0.3, 0.03);
      n.connect(nf).connect(ng).connect(out);
    }
    s_cowbell(t, out) {
      const ctx = this.ctx;
      const f = this._filt('bandpass', 700, 2.5);
      const g = ctx.createGain(); this._env(g.gain, t, 0.5, 0.3);
      f.connect(g).connect(out);
      [562, 845].forEach(fr => {
        const o = this._osc('square', fr, t);
        o.connect(f); o.start(t); o.stop(t + 0.4);
      });
    }
    s_shaker(t, out) {
      const ctx = this.ctx;
      const n = this._noise(t, 0.12);
      const f = this._filt('bandpass', 5200, 1.5);
      const g = ctx.createGain(); this._env(g.gain, t, 0.5, 0.09, 0.015);
      n.connect(f).connect(g).connect(out);
    }
    s_sub(t, out) {
      const ctx = this.ctx;
      const o = this._osc('sine', 55, t);
      const o2 = this._osc('triangle', 55, t);
      const f = this._filt('lowpass', 260, 0.7);
      const g = ctx.createGain(); this._env(g.gain, t, 1.0, 0.7, 0.004);
      const g2 = ctx.createGain(); g2.gain.value = 0.35;
      o.connect(g); o2.connect(g2).connect(f).connect(g); g.connect(out);
      o.start(t); o2.start(t); o.stop(t + 0.9); o2.stop(t + 0.9);
    }
    s_pluck(t, out) {
      const ctx = this.ctx;
      const f = this._filt('lowpass', 2400, 2);
      f.frequency.setValueAtTime(2400, t);
      f.frequency.exponentialRampToValueAtTime(300, t + 0.25);
      const g = ctx.createGain(); this._env(g.gain, t, 0.55, 0.32);
      f.connect(g).connect(out);
      [164.81, 165.6].forEach(fr => { // E3, slight detune
        const o = this._osc('sawtooth', fr, t);
        o.connect(f); o.start(t); o.stop(t + 0.4);
      });
    }
    s_skank(t, out) {
      // Reggae guitar-style chord stab: A minor, short, filtered
      const ctx = this.ctx;
      const f = this._filt('lowpass', 3200, 1.2);
      f.frequency.setValueAtTime(3200, t);
      f.frequency.exponentialRampToValueAtTime(500, t + 0.18);
      const g = ctx.createGain(); this._env(g.gain, t, 0.28, 0.22, 0.003);
      f.connect(g).connect(out);
      [220, 261.63, 329.63, 440].forEach((fr, i) => {
        const o = this._osc('sawtooth', fr, t + i * 0.004);
        o.connect(f); o.start(t + i * 0.004); o.stop(t + 0.3);
      });
    }
    s_bubble(t, out) {
      // Organ bubble: short, slightly detuned square chord with click
      const ctx = this.ctx;
      const f = this._filt('lowpass', 1800, 0.8);
      const g = ctx.createGain(); this._env(g.gain, t, 0.22, 0.12, 0.002);
      f.connect(g).connect(out);
      [261.63, 329.63, 392.0].forEach(fr => {
        const o = this._osc('square', fr, t);
        o.detune.value = (Math.random() - 0.5) * 8;
        o.connect(f); o.start(t); o.stop(t + 0.2);
      });
    }
    s_siren(t, out) {
      const ctx = this.ctx;
      const o = this._osc('sine', 700, t);
      o.frequency.linearRampToValueAtTime(1250, t + 0.35);
      o.frequency.linearRampToValueAtTime(700, t + 0.75);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.35, t + 0.02);
      g.gain.setValueAtTime(0.35, t + 0.65);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
      o.connect(g).connect(out); o.start(t); o.stop(t + 0.85);
    }
    s_dubhit(t, out) {
      // Big snare-ish hit with high send into the delay (see PADS)
      const ctx = this.ctx;
      const n = this._noise(t, 0.3);
      const f = this._filt('bandpass', 1400, 0.7);
      const g = ctx.createGain(); this._env(g.gain, t, 0.9, 0.25);
      n.connect(f).connect(g).connect(out);
      const o = this._osc('triangle', 180, t);
      o.frequency.exponentialRampToValueAtTime(90, t + 0.15);
      const og = ctx.createGain(); this._env(og.gain, t, 0.8, 0.2);
      o.connect(og).connect(out); o.start(t); o.stop(t + 0.3);
    }
  }

  // ------------------------------------------------------------------
  // Sequencer
  // ------------------------------------------------------------------
  const emptyPattern = (len = STEPS) => PADS.map(() => new Array(len).fill(0));
  // Bring any saved / imported / pasted pattern to a consistent shape: 16 rows of one
  // valid length, values 0..2. Length comes from the longest row, snapped to the beat's
  // allowed lengths; a missing pattern means 16 empty steps
  const normalizePattern = (rows, beat) => CORE.normalizePattern(rows, beat, PADS.length);

  const seq = {
    playing: false,
    recording: false,
    bpm: 78,
    bpms: [78, 74, 98, 92], // tempo stored per pattern slot; bpm mirrors the active one
    beats: [4, 4, 4, 4],    // steps per beat per slot: 4 = 4/4 in 16ths, 3 = 12/8 triplets
    swing: 0,          // 0..1
    step: 0,           // next step to schedule
    nextTime: 0,       // audio time of `step`
    lastStepTime: 0,   // audio time of most recently scheduled step
    lastStep: 0,
    timer: null,
    stutter: false,
    stutterStep: -1,
    repeatMul: 0.5,    // repeat size in steps while stuttering: 0.5 = 1/32, 2 = 1/8
    half: false,       // HALF live FX: every step lasts twice as long while held
    loopStart: 0,      // audio time of step 0 of the current pass at normal rate (HALF realigns to it)
    patterns: Array.from({ length: NUM_PATTERNS }, emptyPattern),
    current: 0,
    queued: -1,        // pattern to switch to at the next bar, -1 = none
    metronome: false,
    mutes: PADS.map(() => false),
    padMode: 'play',   // 'play' | 'mute' | 'keys'
    keysSource: 12,    // pad spread across the grid in KEYS mode
    swingMode: 16,     // 16: swing every odd 16th; 8: only the off-beat 8ths
    heldPads: new Set(), // pads currently held (touch or key), for REPLACE and erase
    justRecorded: new Set(), // 'pad:step' written by recordHit, spared from REPLACE once
    erasing: false,    // CLR PAD or Backspace held while playing
    eraseTouched: false,
    passHist: false,   // undo snapshot taken for the current replace / erase gesture
    perf: { last: 0, max: 0, ticks: 0 }, // scheduleStep cost in ms (R.seq.perf in the console)
    playheadStep: -1,  // step the listener currently hears (set by the visual drain)
    countInUntil: 0,   // audio time when a record count-in ends (hits before it are ignored)
    // Song mode: an ordered list of { slot, repeats } played back to back. `pos` is the
    // entry playing, `played` how many passes of it have started, `ended` set when a
    // non-looping song runs out (the scheduler stops the transport)
    song: { on: false, loop: true, list: [], pos: 0, played: 0, ended: false },
    fx: DEFAULT_FX(),  // master FX: spring reverb, tape delay, bit crusher
    synth: DEFAULT_SYNTH(), // built-in synth parameters (the engine reads the same object)
    kits: [0, 1, 2, 3], // kit index per slot
    pendingKits: [null, null, null, null], // kit ids waiting for a sampled kit to register
    mix: null, // per slot, per pad; filled in right after (kit defaults need seq.kits)
    solo: PADS.map(() => false), // like mutes: global, a performance state
    wakeLock: null,
    skipOnce: new Set(),
    visualQueue: [],
  };
  seq.mix = Array.from({ length: NUM_PATTERNS }, (_, s) => defaultMix(s));
  const setSynth = v => { seq.synth = normalizeSynth(v); engine.synth = seq.synth; };
  const LOOKAHEAD = 0.1;         // seconds
  const LOOKAHEAD_HIDDEN = 1.5;  // seconds, while the tab is in the background
  const TICK = 25;               // ms

  // A step is always a quarter of a beat in 4/4 and a third of a beat in 12/8, so the
  // beat length in seconds is fixed by the tempo and the step length follows the slot
  const beatDur = () => 60 / seq.bpm;
  const stepDur = () => beatDur() / patBeat();
  const pattern = () => seq.patterns[seq.current];
  const patBeat = (slot = seq.current) => seq.beats[slot] || 4;
  const patLen = (slot = seq.current) => seq.patterns[slot][0].length;
  // One bar is four beats, or the whole pattern when it is shorter than that (3/4 = 12 steps)
  const barSteps = (slot = seq.current) => Math.min(patLen(slot), 4 * patBeat(slot));
  const pageSize = (slot = seq.current) => 4 * patBeat(slot);

  // Swing: 16th mode delays every odd step, 8th mode only the off-beat 8ths (2, 6, 10, 14)
  const swungStep = s => CORE.swungStep(s, seq.swingMode);
  // Solo wins, then mute: a soloed pad plays even when others are soloed too; with any
  // solo active, un-soloed pads are silent
  const anySolo = () => seq.solo.some(Boolean);
  const audible = p => !seq.mutes[p] && (!anySolo() || seq.solo[p]);

  const SONG_MAX = 32;
  const songActive = () => seq.song.on && seq.song.list.length > 0;
  // At the top of a pass, walk the song: finish the current entry's repeats, move on,
  // loop or end. A slot the user queued by hand plays for that pass instead and counts
  // as one of the entry's repeats
  function songAdvance(time) {
    const sg = seq.song;
    let entryChanged = false;
    if (sg.played >= sg.list[sg.pos].repeats) {
      sg.pos += 1; sg.played = 0; entryChanged = true;
      if (sg.pos >= sg.list.length) {
        if (!sg.loop) { sg.ended = true; sg.pos = sg.list.length - 1; return; }
        sg.pos = 0;
      }
    }
    sg.played += 1;
    if (seq.queued < 0) {
      const slot = sg.list[sg.pos].slot;
      if (slot !== seq.current) seq.queued = slot;
    }
    if (entryChanged || sg.played === 1) seq.visualQueue.push({ songPos: sg.pos, time });
  }

  function scheduleStep(stepIdx, time) {
    let ptn = -1;
    if (stepIdx === 0 && seq.playing && songActive()) {
      songAdvance(time);
      if (seq.song.ended) return;
    }
    if (stepIdx === 0 && seq.queued >= 0) {
      // Pattern boundary: switch to the queued pattern (and its kit)
      seq.current = seq.queued; seq.queued = -1; ptn = seq.current; engine.kit = seq.kits[seq.current];
      if (seq.bpms[seq.current]) { seq.bpm = seq.bpms[seq.current]; engine.setBpm(seq.bpm); }
    }
    const pat = pattern(), mix = seq.mix[seq.current];
    // REPLACE recording and erase-while-playing: held pads lose this step as the
    // playhead passes it (a hit just recorded onto it is kept)
    if (seq.playing && seq.heldPads.size && (seq.erasing || (seq.recording && settings.recMode === 'replace'))) {
      let changed = false;
      seq.heldPads.forEach(p => {
        const key = `${p}:${stepIdx}`;
        if (seq.justRecorded.has(key)) { seq.justRecorded.delete(key); return; }
        if (stepLevel(pat[p][stepIdx])) { if (!seq.passHist) { history.push(); seq.passHist = true; } pat[p][stepIdx] = 0; changed = true; }
      });
      if (changed) { ui.renderSteps(); saveSoon(); }
    }
    const dur = stepDur();
    for (let p = 0; p < PADS.length; p++) {
      const key = `${p}:${stepIdx}`;
      if (seq.skipOnce.has(key)) { seq.skipOnce.delete(key); continue; }
      const cell = pat[p][stepIdx], lvl = stepLevel(cell), lk = stepLocks(cell);
      if (lvl && audible(p)) {
        const t = time + (lk && lk.t ? lk.t * dur : 0);
        engine.trigger(p, t, LEVEL_VEL[Math.min(lvl, 2)], mix[p], { stopAt: t + dur, semis: lk ? lk.p || 0 : 0, filter: lk && lk.f != null ? lk.f : 1, sendMul: lk && lk.s != null ? lk.s : 1 });
      }
    }
    if (seq.metronome && stepIdx % patBeat() === 0) engine.click(time, stepIdx % barSteps() === 0);
    seq.visualQueue.push({ step: stepIdx, time, ptn, pads: pat.map((row, p) => stepLevel(row[stepIdx]) && audible(p) ? p : -1).filter(p => p >= 0) });
  }

  function scheduler() {
    const ctx = engine.ctx;
    // Background tabs throttle timers to about once a second, so schedule further
    // ahead there; the visual queue is not drained while hidden, so keep it short
    const hidden = document.hidden;
    const ahead = hidden ? LOOKAHEAD_HIDDEN : LOOKAHEAD;
    if (hidden && seq.visualQueue.length > 64) seq.visualQueue.splice(0, seq.visualQueue.length - 64);
    // A paused timer (phone lock, long stall) leaves nextTime far in the past; skip
    // the missed steps instead of firing them all at once
    if (seq.nextTime < ctx.currentTime - 0.25) {
      const dur = seq.stutter ? stepDur() * seq.repeatMul : stepDur() * (seq.half ? 2 : 1);
      const missed = Math.floor((ctx.currentTime - seq.nextTime) / dur) + 1;
      if (settings.stallResume) seq.nextTime = ctx.currentTime + 0.02; // pick up where the loop stopped
      else { if (!seq.stutter) seq.step = (seq.step + missed) % patLen(); seq.nextTime += missed * dur; }
      seq.visualQueue.length = 0;
    }
    // Half a step of extra horizon so a negative micro-timing lock still lands ahead of now
    while (seq.nextTime < ctx.currentTime + ahead + stepDur() * 0.5) {
      const dur = stepDur();
      if (seq.stutter) {
        // retrigger the frozen step every repeatMul steps (1/32 for STUTTER, 1/8 for REPEAT)
        if (seq.stutterStep < 0) seq.stutterStep = seq.lastStep;
        scheduleStep(seq.stutterStep, seq.nextTime);
        seq.lastStepTime = seq.nextTime; seq.lastStep = seq.stutterStep;
        seq.nextTime += dur * seq.repeatMul;
        continue;
      }
      seq.stutterStep = -1;
      const sdur = seq.half ? dur * 2 : dur;
      let t = seq.nextTime;
      if (swungStep(seq.step)) t += seq.swing * sdur * 0.33; // swing pushes off-beats late
      if (seq.step === 0 && !seq.half) seq.loopStart = seq.nextTime;
      const t0 = performance.now();
      scheduleStep(seq.step, t);
      if (seq.onStep) seq.onStep(seq.step, t, sdur); // MIDI clock out
      const ms = performance.now() - t0;
      seq.perf.last = ms; if (ms > seq.perf.max) seq.perf.max = ms; seq.perf.ticks += 1;
      if (seq.song.ended) { stop(); lcd('song finished'); return; }
      seq.lastStepTime = t; seq.lastStep = seq.step;
      seq.nextTime += sdur;
      seq.step = (seq.step + 1) % patLen();
    }
  }
  // HALF released: snap the next step back onto the normal-rate grid of this pass
  function realignToGrid() {
    if (!seq.playing) return;
    const dur = stepDur(), len = patLen();
    const k = Math.ceil((seq.nextTime - seq.loopStart) / dur - 1e-6);
    seq.step = ((k % len) + len) % len;
    seq.nextTime = seq.loopStart + k * dur;
    if (k >= len) seq.loopStart += Math.floor(k / len) * len * dur;
  }

  function play(opts = {}) {
    engine.init().then(() => {
      // Song mode starts from the top of the list, on that entry's slot
      if (engine._panicTimer) engine.unpanic();
      const sg = seq.song;
      sg.pos = 0; sg.played = 0; sg.ended = false;
      if (songActive() && sg.list[0].slot !== seq.current) ui.setPattern(sg.list[0].slot, { now: true });
      seq.playing = true;
      seq.step = 0;
      seq.nextTime = engine.now + 0.05;
      seq.countInUntil = 0;
      if (opts.countIn) {
        // One bar of metronome clicks before the sequence (and recording) starts
        const dur = stepDur(), beat = patBeat(), bar = barSteps();
        for (let i = 0; i < bar / beat; i++) engine.click(seq.nextTime + i * dur * beat, i === 0);
        seq.countInUntil = seq.nextTime + dur * bar;
        seq.nextTime = seq.countInUntil;
        lcd('count-in · 1 bar');
      } else {
        lcd(seq.recording ? 'recording · hit pads' : 'playing');
      }
      seq.timer = setInterval(scheduler, TICK);
      ui.setPlaying(true);
      requestWakeLock();
    });
  }
  async function requestWakeLock() {
    try {
      if (navigator.wakeLock && !seq.wakeLock) {
        seq.wakeLock = await navigator.wakeLock.request('screen');
        seq.wakeLock.addEventListener('release', () => { seq.wakeLock = null; });
      }
    } catch (_) { /* not granted or unsupported */ }
  }
  function releaseWakeLock() {
    if (seq.wakeLock) { seq.wakeLock.release().catch(() => {}); seq.wakeLock = null; }
  }
  // STOP halts the sequencer and lets the delay and reverb ring out, like most hardware.
  // A second STOP (or Escape) within 1.5 s is a panic that silences everything; turning
  // the ring-out setting off makes every stop do that
  let lastStopAt = 0;
  function stop() {
    const again = !seq.playing && performance.now() - lastStopAt < 1500;
    lastStopAt = performance.now();
    if (!seq.playing) {
      if (again) { engine.panic(); lcd('all sound cut'); lastStopAt = 0; } // the next press plays again
      return;
    }
    seq.playing = false;
    seq.countInUntil = 0;
    engine.releaseAll();
    if (!settings.ringOut) engine.panic();
    releaseWakeLock();
    clearInterval(seq.timer); seq.timer = null;
    seq.visualQueue.length = 0;
    seq.skipOnce.clear();
    seq.stutterStep = -1;
    if (seq.queued >= 0) { seq.current = seq.queued; seq.queued = -1; ui.setPattern(seq.current); }
    ui.setPlaying(false);
    ui.setCurrentStep(-1);
    ui.pinnedPage = false; ui.renderSteps();
    seq.song.pos = 0; seq.song.played = 0; seq.playheadStep = -1;
    document.dispatchEvent(new CustomEvent('rhythm:song'));
    lcd(settings.ringOut ? 'stopped · press STOP again to cut the tails' : 'stopped');
  }
  // Song list editing (the chips live in song.js; these keep the data sane and saved)
  const songChanged = () => { saveSoon(); document.dispatchEvent(new CustomEvent('rhythm:song')); };
  function setSong(on) {
    seq.song.on = !!on;
    $('#btn-song').classList.toggle('on', seq.song.on);
    $('#song').hidden = !seq.song.on;
    lcd(seq.song.on ? (seq.song.list.length ? 'song mode · PLAY runs the list' : 'song mode · ADD the first entry') : 'song mode off');
    songChanged();
  }
  function songAdd(slot = seq.current, repeats = 1) {
    if (seq.song.list.length >= SONG_MAX) { lcd(`song is full (${SONG_MAX} entries)`); return -1; }
    history.push();
    seq.song.list.push({ slot, repeats });
    songChanged();
    return seq.song.list.length - 1;
  }
  function songUpdate(i, changes) {
    const e = seq.song.list[i]; if (!e) return;
    history.push();
    if (typeof changes.repeats === 'number') e.repeats = Math.min(64, Math.max(1, Math.round(changes.repeats)));
    if (typeof changes.slot === 'number') e.slot = Math.min(NUM_PATTERNS - 1, Math.max(0, changes.slot));
    songChanged();
  }
  function songRemove(i) {
    if (!seq.song.list[i]) return;
    history.push();
    seq.song.list.splice(i, 1);
    if (seq.song.pos >= seq.song.list.length) seq.song.pos = Math.max(0, seq.song.list.length - 1);
    songChanged();
  }
  function songMove(i, dir) {
    const l = seq.song.list, j = i + dir;
    if (!l[i] || !l[j]) return;
    history.push();
    [l[i], l[j]] = [l[j], l[i]];
    songChanged();
  }
  const isEmptySlot = slot => seq.patterns[slot].every(row => row.every(v => !stepLevel(v)));
  // Erase gesture (CLR PAD held, or Backspace): while playing, pads tapped meanwhile lose
  // their hits as the playhead passes; a plain tap with no pad still clears the selected pad
  function eraseStart() {
    if (seq.erasing) return;
    seq.erasing = true; seq.eraseTouched = false; seq.passHist = false;
    if (seq.playing) lcd('hold and tap pads to erase their hits');
  }
  function eraseEnd() {
    if (!seq.erasing) return;
    seq.erasing = false;
    if (!seq.eraseTouched) ui.clearPad();
    else { lcd('erase done'); ui.renderSteps(); }
    seq.passHist = false;
  }
  // Validate a song list from storage, a file or a link
  function normalizeSong(s) {
    const out = { on: false, loop: true, list: [] };
    if (!s || typeof s !== 'object') return out;
    out.on = !!s.on; out.loop = s.loop !== false;
    if (Array.isArray(s.list)) {
      out.list = s.list.slice(0, SONG_MAX).map(e => {
        const slot = Array.isArray(e) ? e[0] : e && e.slot, rep = Array.isArray(e) ? e[1] : e && e.repeats;
        return { slot: Math.min(NUM_PATTERNS - 1, Math.max(0, Math.round(+slot) || 0)), repeats: Math.min(64, Math.max(1, Math.round(+rep) || 1)) };
      });
    }
    return out;
  }
  function applySong(s) {
    const n = normalizeSong(s);
    seq.song.list = n.list; seq.song.loop = n.loop; seq.song.on = n.on && n.list.length > 0;
    seq.song.pos = 0; seq.song.played = 0; seq.song.ended = false;
  }
  // PLAY / STOP: a press while stopped within 1.5 s of the last stop is the panic, not a restart
  function togglePlay() {
    ui.clearFx();
    if (seq.playing) stop(); else play({ countIn: seq.recording && settings.countIn });
  }

  // Live hit: quantize to nearest step while recording. level 1 = normal, 2 = accent
  // While recording, a hit that lands on a step the scheduler has already queued (and
  // that already holds a hit) would sound twice: once live, once from the queue. The
  // queued one is within the lookahead, so the live one is dropped
  function liveHitRedundant(padIdx) {
    if (!seq.recording || !seq.playing || engine.now < seq.countInUntil) return false;
    const hitTime = engine.now - engine.latency;
    const { target, ahead } = quantizeHit(hitTime - seq.lastStepTime, stepDur(), seq.lastStep, patLen());
    return !ahead && seq.lastStepTime > hitTime && stepLevel(pattern()[padIdx][target]) > 0 && audible(padIdx);
  }
  function recordHit(padIdx, level, locks = null) {
    if (!seq.recording) return;
    if (!seq.playing) {
      // Armed but stopped: start the transport and put this hit on step 0
      history.push();
      play();
      const row0 = pattern()[padIdx];
      setStepLevel(row0, 0, level);
      if (locks) row0[0] = normStep(Object.assign(stepLocks(row0[0]) || { l: level }, locks));
      seq.skipOnce.add(`${padIdx}:0`);
      ui.renderSteps();
      return;
    }
    if (engine.now < seq.countInUntil) return; // still counting in
    const dur = stepDur();
    // The player reacts to what they hear, which left the speaker `latency` ago
    const elapsed = engine.now - engine.latency - seq.lastStepTime;
    const { target, offset, ahead } = quantizeHit(elapsed, dur, seq.lastStep, patLen());
    // If the chosen next step has not been scheduled yet, skip its playback once so we don't double-hit
    if (ahead && seq.nextTime > engine.now) seq.skipOnce.add(`${padIdx}:${target}`);
    history.push();
    const row = pattern()[padIdx];
    setStepLevel(row, target, Math.max(stepLevel(row[target]), level));
    if (locks) row[target] = normStep(Object.assign(stepLocks(row[target]) || { l: stepLevel(row[target]) }, locks));
    // Quantize off: keep the real offset as a micro-timing lock (within half a step)
    if (settings.quantize === false && Math.abs(offset) > 0.02) {
      const lk = stepLocks(row[target]) || { l: stepLevel(row[target]) };
      lk.t = Math.max(-0.5, Math.min(0.5, offset));
      row[target] = normStep(lk);
    }
    seq.justRecorded.add(`${padIdx}:${target}`);
    ui.renderSteps(); saveSoon();
  }

  // KEYS mode: the grid is a chromatic keyboard for the source pad (the pad selected
  // when KEYS was switched on). Bottom-left is the root, rising left to right and
  // bottom to top: 16 notes, an octave and a fourth
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const keySemis = padIdx => (3 - Math.floor(padIdx / 4)) * 4 + (padIdx % 4);
  const keyLabel = padIdx => { const s = keySemis(padIdx); return NOTE_NAMES[s % 12] + (s >= 12 ? '′' : ''); };
  function hitPad(padIdx, level = 1) {
    engine.init();
    if (seq.padMode === 'mute') { toggleMute(padIdx); return; }
    if (seq.erasing && seq.playing) {
      // Erase gesture: the pad is only marked held; scheduleStep clears its steps
      seq.eraseTouched = true; seq.heldPads.add(padIdx);
      lcd(`erasing ${ui.padName(padIdx)}`);
      return;
    }
    if (seq.padMode === 'keys') {
      // Notes record onto the source pad as pitch locks
      const src = seq.keysSource, semis = keySemis(padIdx);
      if (!liveHitRedundant(src)) engine.trigger(src, engine.now, LEVEL_VEL[level], seq.mix[seq.current][src], { semis });
      recordHit(src, level, semis ? { p: semis } : null);
      return;
    }
    if (!liveHitRedundant(padIdx)) engine.trigger(padIdx, engine.now, LEVEL_VEL[level], seq.mix[seq.current][padIdx]);
    ui.selectPad(padIdx);
    recordHit(padIdx, level);
  }
  // Position velocity (Settings): a touch in the top third of a pad is an accent. Real
  // pressure is used where the device reports it; most phones report a constant 0 or
  // 0.5, which is treated as "no data"
  function padHitLevel(e, el) {
    if (!settings.posVel || e.pointerType === 'mouse') return 1;
    const p = e.pressure;
    if (typeof p === 'number' && p > 0 && p < 1 && Math.abs(p - 0.5) > 0.001) return p > 0.6 ? 2 : 1;
    const r = el.getBoundingClientRect();
    return (e.clientY - r.top) / r.height < 1 / 3 ? 2 : 1;
  }
  function toggleMute(padIdx) {
    seq.mutes[padIdx] = !seq.mutes[padIdx];
    ui.renderMutes(); saveSoon();
    lcd(`${ui.padName(padIdx)} ${seq.mutes[padIdx] ? 'muted' : 'unmuted'}`);
  }
  // Solo is exclusive by default; `add` keeps the others (Shift in the mixer)
  function toggleSolo(padIdx, add = false) {
    const was = seq.solo[padIdx];
    if (!add) seq.solo = PADS.map(() => false);
    seq.solo[padIdx] = !was;
    ui.renderMutes(); saveSoon();
    lcd(seq.solo[padIdx] ? `${ui.padName(padIdx)} solo` : (anySolo() ? `${ui.padName(padIdx)} solo off` : 'solo cleared'));
  }
  const mixChanged = () => { saveSoon(); document.dispatchEvent(new CustomEvent('rhythm:mix')); };

  // ------------------------------------------------------------------
  // Undo / redo, copy / paste, tap tempo
  // ------------------------------------------------------------------
  const history = {
    undo: [], redo: [], max: 100,
    snapshot: () => JSON.stringify({ p: seq.patterns, b: seq.beats, g: { loop: seq.song.loop, list: seq.song.list }, m: seq.mix }),
    push() {
      const s = this.snapshot();
      if (this.undo[this.undo.length - 1] === s) return;
      this.undo.push(s); if (this.undo.length > this.max) this.undo.shift();
      this.redo.length = 0;
      ui.updateUndo();
    },
    apply(s) {
      const d = JSON.parse(s);
      seq.patterns = d.p; seq.beats = d.b;
      if (d.g) { seq.song.loop = d.g.loop; seq.song.list = d.g.list; if (seq.song.pos >= seq.song.list.length) seq.song.pos = 0; }
      if (d.m) seq.mix = d.m;
      ui.renderSteps(); saveSoon(); ui.updateUndo();
      document.dispatchEvent(new CustomEvent('rhythm:song'));
      document.dispatchEvent(new CustomEvent('rhythm:mix'));
    },
    doUndo() {
      if (!this.undo.length) return lcd('nothing to undo');
      this.redo.push(this.snapshot()); this.apply(this.undo.pop()); lcd('undo');
    },
    doRedo() {
      if (!this.redo.length) return lcd('nothing to redo');
      this.undo.push(this.snapshot()); this.apply(this.redo.pop()); lcd('redo');
    },
  };

  let clipboard = null;
  let rowClipboard = null;
  // Single pad row (Shift+COPY / Shift+PASTE)
  function copyRow() {
    rowClipboard = pattern()[ui.selected].map(copyStep);
    ui.updateUndo();
    lcd(`${ui.padName(ui.selected)} row copied`);
  }
  function pasteRow() {
    if (!rowClipboard) { lcd('no row copied yet'); return; }
    history.push();
    // A row from a longer pattern is cut, a shorter one is repeated to fill the slot
    const len = patLen();
    pattern()[ui.selected] = Array.from({ length: len }, (_, s) => copyStep(rowClipboard[s % rowClipboard.length]) || 0);
    ui.renderSteps(); saveSoon();
    lcd(`row pasted into ${ui.padName(ui.selected)}`);
  }
  function copyPattern() {
    clipboard = { rows: JSON.parse(JSON.stringify(pattern())), beat: patBeat() };
    ui.updateUndo();
    lcd(`pattern ${'ABCD'[seq.current]} copied`);
  }
  // Paste carries length and beat, so a 32-step pattern extends the target slot
  function pastePattern() {
    if (!clipboard) return;
    history.push();
    seq.patterns[seq.current] = JSON.parse(JSON.stringify(clipboard.rows));
    seq.beats[seq.current] = clipboard.beat;
    ui.renderSteps(); saveSoon();
    lcd(`pasted into ${'ABCD'[seq.current]}`);
  }
  // LEN button: one control cycles every length, the 4/4 ones first (8, 12, 16, 32, 64
  // steps) and then the triplet 12/8 ones (12, 24, 48). Wheel or Shift goes backwards
  const LENGTH_OPTIONS = BEATS.flatMap(beat => LENGTHS[beat].map(len => ({ len, beat })));
  function cycleLength(dir = 1) {
    const i = LENGTH_OPTIONS.findIndex(o => o.len === patLen() && o.beat === patBeat());
    const o = LENGTH_OPTIONS[(i + dir + LENGTH_OPTIONS.length) % LENGTH_OPTIONS.length];
    setLength(o.len, o.beat);
  }
  function setLength(len, beat = patBeat()) {
    beat = validBeat(beat); len = validLength(len, beat);
    if (len === patLen() && beat === patBeat()) return;
    history.push();
    seq.beats[seq.current] = beat;
    resizePattern(pattern(), len);
    if (seq.playing && seq.step >= len) seq.step = 0;
    ui.pinnedPage = false; ui.page = 0;
    ui.renderSteps(); saveSoon();
    lcd(`pattern ${'ABCD'[seq.current]} · ${describeLength()}`);
  }
  const beatName = (beat = patBeat()) => (beat === 3 ? '12/8' : (patLen() === 12 ? '3/4' : '4/4'));
  const lengthLabel = () => (patBeat() === 3 ? `${patLen()} STEPS · 12/8` : `${patLen()} STEPS`);
  function describeLength() {
    const len = patLen(), bar = barSteps();
    const bars = len / bar;
    return `${len} steps · ${bars === 1 ? '1 bar' : `${bars} bars`} of ${beatName()}`;
  }

  // ------------------------------------------------------------------
  // Offline render: play a list of { slot, repeats } through a copy of the engine on
  // an OfflineAudioContext and return the AudioBuffer. Shared by audio export and
  // resample. Uses the same step timing as the live scheduler (swing on odd steps),
  // tempo, beat and length per slot, accents, mutes and the sidechain; punch-ins and
  // the metronome are left out
  async function renderAudio({ list, tail = 0, metronome = false, liveFx = true } = {}) {
    await engine.init();
    const passes = [];
    list.forEach(e => { for (let r = 0; r < (e.repeats || 1); r++) passes.push(e.slot); });
    if (!passes.length) throw new Error('nothing to render');
    const events = []; let total = 0; const marks = [];
    passes.forEach(slot => {
      const bpm = seq.bpms[slot] || seq.bpm, beat = patBeat(slot), len = patLen(slot);
      const dur = 60 / bpm / beat;
      marks.push({ t: total, bpm });
      if (metronome) for (let s = 0; s < len; s += beat) events.push({ click: true, t: total + s * dur, down: s % Math.min(len, 4 * beat) === 0 });
      const pat = seq.patterns[slot], mix = seq.mix[slot];
      for (let s = 0; s < len; s++) {
        const t0 = total + s * dur + (swungStep(s) ? seq.swing * dur * 0.33 : 0);
        for (let p = 0; p < PADS.length; p++) {
          const cell = pat[p][s], lvl = stepLevel(cell), lk = stepLocks(cell);
          if (!lvl || !audible(p)) continue;
          const t = Math.max(0, t0 + (lk && lk.t ? lk.t * dur : 0));
          events.push({ t, p, vel: LEVEL_VEL[Math.min(lvl, 2)], kit: seq.kits[slot], mix: mix[p], stopAt: t + dur, semis: lk ? lk.p || 0 : 0, filter: lk && lk.f != null ? lk.f : 1, sendMul: lk && lk.s != null ? lk.s : 1 });
        }
      }
      total += len * dur;
    });
    for (const slot of new Set(passes)) { const k = seq.kits[slot]; if (KITS[k] && KITS[k].sampled && engine.loadKit) await engine.loadKit(k); }
    const sr = engine.ctx.sampleRate;
    const seconds = total + tail;
    if (seconds > 60 * 20) throw new Error('render longer than 20 minutes');
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const octx = new OAC(2, Math.ceil(seconds * sr), sr);
    const off = Engine.offline(engine, octx);
    if (engine.fx && engine.fx.crush.wet > 0) await off.loadCrush();
    // Dub delay follows the tempo of each pass
    marks.forEach(m => off.delay.delayTime.setValueAtTime((60 / m.bpm) * 0.75, m.t));
    // Pitched synth steps need their pad rendered first (a cached buffer per kit pad)
    for (const ev of events) { if (ev.semis && !engine.samples[ev.p]) { try { await engine.renderPad(ev.kit, ev.p, 1.5); } catch (_) {} } }
    off.rendered = engine.rendered;
    off.clickLevel = engine.clickLevel;
    // Latched live FX (delay throw, filters, sweep, tape stop) render as held from the start
    if (liveFx && ui.fxLatched) Object.keys(ui.fxLatched).forEach(fx => { if (ui.fxLatched[fx] && ['delay', 'lp', 'hp', 'sweep', 'tapestop'].includes(fx)) off.setPunch(fx, true, ui.fxAmount[fx] == null ? 0.7 : ui.fxAmount[fx]); });
    events.forEach(ev => {
      if (ev.click) { off.click(ev.t, ev.down); return; }
      off.kit = ev.kit; off.trigger(ev.p, ev.t, ev.vel, ev.mix, { stopAt: ev.stopAt, semis: ev.semis, filter: ev.filter, sendMul: ev.sendMul });
    });
    const buffer = await octx.startRendering();
    // The live output may run above full scale on accented stacks (the speaker path
    // clips it); a file must not, so scale hot renders down to -1 dBFS. Quiet renders
    // are left alone so levels stay comparable between exports
    let peak = 0;
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const d = buffer.getChannelData(c);
      for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; }
    }
    const ceiling = 0.891; // -1 dBFS
    if (peak > ceiling) {
      const k = ceiling / peak;
      for (let c = 0; c < buffer.numberOfChannels; c++) {
        const d = buffer.getChannelData(c);
        for (let i = 0; i < d.length; i++) d[i] *= k;
      }
    }
    return { buffer, seconds: total, tail, peak };
  }

  const taps = [];
  function tapTempo() {
    const now = performance.now();
    if (taps.length && now - taps[taps.length - 1] > 2000) taps.length = 0;
    taps.push(now);
    if (taps.length > 8) taps.shift();
    if (taps.length < 2) { lcd('tap again'); return; }
    const avg = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
    ui.setBpm(60000 / avg);
    lcd(`tap ${seq.bpm}`);
  }

  // ------------------------------------------------------------------
  // Persistence
  // ------------------------------------------------------------------
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        patterns: seq.patterns, beats: seq.beats, kits: kitIds(), bpm: seq.bpm, bpms: seq.bpms, swing: seq.swing, swingMode: seq.swingMode, current: seq.current,
        volume: ui.volume, mutes: seq.mutes,
        song: { on: seq.song.on, loop: seq.song.loop, list: seq.song.list },
        fx: seq.fx, mix: seq.mix, solo: seq.solo, synth: seq.synth,
      }));
    } catch (e) { /* private mode etc. */ }
    document.dispatchEvent(new CustomEvent('rhythm:saved'));
  }
  // First-run demos, one style per slot, each written for that slot's kit
  function seedDemo() {
    // one drop 78, steppers 74, dancehall 98, digital rockers 92
    seq.bpms = [78, 74, 98, 92];
    seq.bpm = seq.bpms[seq.current] || 78;
    seq.beats = [4, 4, 4, 4];
    seq.kits = [0, 1, 2, 3];
    seq.patterns.forEach(p => { if (p[0].length !== STEPS) resizePattern(p, STEPS); });
    const fill = (slot, rows) => {
      const p = seq.patterns[slot];
      const idx = name => KITS[slot].pads.findIndex(x => x.name === name);
      Object.entries(rows).forEach(([name, spec]) => {
        if (idx(name) < 0) { console.warn('demo: unknown pad', name, 'in kit', slot); return; }
        const steps = Array.isArray(spec) ? spec : spec.on;
        const acc = Array.isArray(spec) ? [] : (spec.acc || []);
        steps.forEach(s => { p[idx(name)][s] = 1; });
        acc.forEach(s => { p[idx(name)][s] = 2; });
      });
    };
    // A: one drop (roots reggae). Kick and rim together on beat 3, skank on the off-beats.
    fill(0, {
      'KICK':   { on: [8], acc: [8] },
      'RIM':    [8],
      'CL HAT': [0, 2, 4, 6, 8, 10, 12, 14],
      'OP HAT': [15],
      'SHAKER': [1, 3, 5, 7, 9, 11, 13, 15],
      'SKANK':  [2, 6, 10, 14],
      'BUBBLE': [1, 3, 9, 11],
      'SUB':    [0, 3, 8, 11],
    });
    // B: steppers (roots dub, STEPPERS kit). Four-on-the-floor 808 kick, deep sub, organ
    // on the off-beats, melodica answer, spring splash thrown into the delay at the turn.
    fill(1, {
      'KICK 808': { on: [0, 4, 8, 12], acc: [0, 8] },
      'SNARE 2':  [4, 12],
      'STICK':    [2, 10],
      'HAT MTL':  [0, 2, 4, 6, 8, 10, 12, 14],
      'HAT MTL O': [14],
      'TAMB':     [1, 3, 5, 7, 9, 11, 13, 15],
      'ORGAN':    [2, 6, 10, 14],
      'CHOP':     [1, 5, 9, 13],
      'DEEP SUB': { on: [0, 3, 6, 8, 11, 14], acc: [0, 8] },
      'MELODICA': [12, 15],
      'SPRING':   [15],
    });
    // C: dancehall (dembow / 3-3-2, DANCEHALL kit). Syncopated kick with clap on 2 and 4,
    // 808 sub following the kick, stab and steel pan answers, air horn on the one.
    fill(2, {
      'KICK DH':  { on: [0, 3, 6, 8, 11, 14], acc: [0, 8] },
      'CLAP DH':  [4, 12],
      'TICK':     [2, 7, 10, 15],
      'HAT DH':   [0, 2, 4, 6, 8, 10, 12, 14],
      'SHKR 2':   [1, 3, 5, 7, 9, 11, 13, 15],
      'CONGA HI': [5, 13],
      '808 SUB':  [0, 3, 6, 8, 11, 14],
      'SYN STAB': [4, 12],
      'STEEL':    [1, 9, 15],
      'AIR HORN': [0],
    });
    // D: digital rockers (sleng teng era, DIGITAL kit). Kick on 1 and 3 with pickups,
    // 16th digital hats, cowbell riff, square bass line, organ bubble on every off 16th.
    fill(3, {
      'KICK DG':  { on: [0, 6, 8, 14], acc: [0, 8] },
      'SNARE DG': [4, 12],
      'HAT DG':   [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      'HAT DG O': [3, 11],
      'COWBL DG': [2, 6, 10, 14],
      'CLAVE':    [3, 7, 11],
      'ORGAN DG': [2, 6, 10, 14],
      'ORG BUB':  [1, 3, 5, 7, 9, 11, 13, 15],
      'MT BASS':  { on: [0, 2, 3, 7, 8, 10, 11, 15], acc: [0, 8] },
      'PIANO':    [12],
    });
  }

  let loadedFresh = false; // no autosave found at boot (first run, or storage cleared)
  function load() {
    try {
      // Older saves (v3: fixed 16 steps, no beats) load unchanged under the new key
      const raw = localStorage.getItem(STORAGE_KEY) || OLD_STORAGE_KEYS.map(k => localStorage.getItem(k)).find(Boolean);
      if (!raw) { seedDemo(); loadedFresh = true; return; }
      const d = JSON.parse(raw);
      if (Array.isArray(d.beats) && d.beats.length === NUM_PATTERNS) seq.beats = d.beats.map(validBeat);
      if (Array.isArray(d.kits) && d.kits.length === NUM_PATTERNS) seq.kits = d.kits.map((k, i) => resolveKit(k, i));
      if (Array.isArray(d.patterns) && d.patterns.length === NUM_PATTERNS) {
        seq.patterns = d.patterns.map((p, slot) => normalizePattern(p, seq.beats[slot]));
      }
      if (d.bpm) seq.bpm = Math.min(240, Math.max(40, +d.bpm));
      if (Array.isArray(d.bpms) && d.bpms.length === NUM_PATTERNS) seq.bpms = d.bpms.map(b => Math.min(240, Math.max(40, +b || 78)));
      else if (d.bpm) seq.bpms[typeof d.current === 'number' ? d.current % NUM_PATTERNS : 0] = seq.bpm; // older save: keep its tempo on the active slot, demo tempos elsewhere
      if (typeof d.swing === 'number') seq.swing = d.swing;
      seq.swingMode = d.swingMode === 8 ? 8 : 16;
      if (typeof d.current === 'number') seq.current = d.current % NUM_PATTERNS;
      seq.bpm = seq.bpms[seq.current];
      if (typeof d.volume === 'number') ui.volume = d.volume;
      if (Array.isArray(d.mutes)) seq.mutes = PADS.map((_, i) => !!d.mutes[i]);
      if (d.song) applySong(d.song);
      if (d.fx) seq.fx = normalizeFx(d.fx);
      if (Array.isArray(d.mix)) seq.mix = seq.mix.map((m, s) => normalizeMix(d.mix[s], s));
      if (Array.isArray(d.solo)) seq.solo = PADS.map((_, i) => !!d.solo[i]);
      if (d.synth) setSynth(d.synth);
    } catch (e) { /* ignore corrupt */ }
  }
  let saveTimer = null;
  const saveSoon = () => { clearTimeout(saveTimer); saveTimer = setTimeout(save, 250); };

  // Settings (separate key so a project import never touches them)
  const SETTINGS_KEY = 'rhythm39.settings';
  const DEFAULT_KEYS = KEYS.slice();
  const RESERVED_KEYS = new Set([...Object.keys(FX_KEYS), 't', 'm', 'n', 'b']);
  const settings = { countIn: true, haptics: true, keycaps: true, loudMet: false, muteHold: false, sidechain: false, posVel: false, recMode: 'overdub', quantize: true, lowLatency: false, highContrast: false, theme: 'auto', stallResume: false, keyHints: false, ringOut: true, keys: null };
  try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch (_) {}
  const saveSettings = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (_) {} };
  // Apply a saved key map if it is sane: 16 distinct single characters, none reserved
  if (Array.isArray(settings.keys) && settings.keys.length === KEYS.length
      && new Set(settings.keys).size === KEYS.length
      && settings.keys.every(k => typeof k === 'string' && /^[a-z0-9]$/.test(k) && !RESERVED_KEYS.has(k))) {
    KEYS.splice(0, KEYS.length, ...settings.keys);
  } else {
    settings.keys = null;
  }

  // Project export / import (patterns, tempo, swing, mutes; samples stay in the browser)
  // Everything that makes up a project (the export file, and a named project record)
  function projectData() {
    return {
      app: 'rhythm39', version: 3, patterns: seq.patterns, beats: seq.beats, kits: kitIds(), bpm: seq.bpm, bpms: seq.bpms, swing: seq.swing, swingMode: seq.swingMode,
      current: seq.current, mutes: seq.mutes,
      song: { on: seq.song.on, loop: seq.song.loop, list: seq.song.list },
      fx: seq.fx, mix: seq.mix, synth: seq.synth,
    };
  }
  // Load a project object (from a file or a named project) into the sequencer
  function applyProject(d) {
    if (!d || !Array.isArray(d.patterns)) throw new Error('not a Rhythm-39 project');
    seq.beats = Array.from({ length: NUM_PATTERNS }, (_, p) => validBeat(Array.isArray(d.beats) ? d.beats[p] : 4));
    seq.kits = Array.from({ length: NUM_PATTERNS }, (_, p) => (Array.isArray(d.kits) ? resolveKit(d.kits[p], p) : p));
    seq.patterns = Array.from({ length: NUM_PATTERNS }, (_, p) => normalizePattern(d.patterns[p], seq.beats[p]));
    if (Array.isArray(d.bpms) && d.bpms.length === NUM_PATTERNS) seq.bpms = d.bpms.map(b => Math.min(240, Math.max(40, +b || 78)));
    else if (d.bpm) seq.bpms = seq.bpms.map(() => Math.min(240, Math.max(40, +d.bpm)));
    if (typeof d.current === 'number') seq.current = Math.max(0, Math.min(NUM_PATTERNS - 1, Math.round(d.current)));
    seq.bpm = seq.bpms[seq.current];
    if (typeof d.swing === 'number') { seq.swing = Math.min(1, Math.max(0, d.swing)); }
    seq.swingMode = d.swingMode === 8 ? 8 : 16;
    seq.mutes = PADS.map((_, i) => Array.isArray(d.mutes) ? !!d.mutes[i] : false);
    seq.solo = PADS.map(() => false);
    applySong(d.song);
    seq.fx = normalizeFx(d.fx);
    seq.mix = seq.mix.map((m, s) => normalizeMix(Array.isArray(d.mix) ? d.mix[s] : null, s));
    setSynth(d.synth);
    if (seq.playing) stop();
    ui.syncAll(); save();
    document.dispatchEvent(new CustomEvent('rhythm:project'));
  }
  function exportProject() {
    const data = projectData();
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rhythm39-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    lcd('project exported');
  }
  // Share link: patterns packed as one digit per step per pad row (row length = pattern
  // length), `t` = steps per beat per slot, base64 in the URL hash
  function encodeShare() {
    const d = { v: 3, b: seq.bpms, t: seq.beats, s: Math.round(seq.swing * 100), p: seq.patterns.map(pat => pat.map(encodeRow)) };
    if (seq.swingMode === 8) d.w = 8;
    if (seq.kits.some((k, i) => k !== i)) d.k = kitIds();
    // `g` = song: [loop, on, [slot, repeats]...], only when there is a list
    if (seq.song.list.length) d.g = [seq.song.loop ? 1 : 0, seq.song.on ? 1 : 0, ...seq.song.list.map(e => [e.slot, e.repeats])];
    // `x` = master FX as six rounded numbers, only when something differs from the defaults
    const f = seq.fx, r = v => Math.round(v * 100) / 100;
    if (JSON.stringify(f) !== JSON.stringify(DEFAULT_FX())) d.x = [r(f.spring.wet), r(f.spring.decay), r(f.tape.wet), r(f.tape.fb), r(f.crush.wet), r(f.crush.bits)];
    // `m` = mixer strips that differ from the kit defaults: [slot, pad, lvl, pan, a, b]
    // `z` = synth, only when it differs from the defaults
    if (JSON.stringify(seq.synth) !== JSON.stringify(DEFAULT_SYNTH())) d.z = seq.synth;
    const m = [];
    seq.mix.forEach((strips, s) => strips.forEach((st, i) => { if (!isDefaultMix(st, s, i)) m.push([s, i, r(st.lvl), r(st.pan), r(st.a), r(st.b)]); }));
    if (m.length) d.m = m;
    return shareEncode(d);
  }
  function decodeShare(str) {
    const d = shareDecode(str);
    if (!d || !Array.isArray(d.p)) throw new Error('bad link');
    return d;
  }
  const shareUrl = () => `${location.origin}${location.pathname}#s=${encodeShare()}`;
  function shareLink() {
    const url = shareUrl();
    const done = () => lcd('share link copied');
    const fallback = () => { window.prompt('Copy this link:', url); lcd('share link ready'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, fallback);
    else fallback();
  }
  function loadShareFromHash() {
    const m = /^#s=([A-Za-z0-9_-]+)/.exec(location.hash || '');
    if (!m) return false;
    try {
      const d = decodeShare(m[1]);
      if (Array.isArray(d.t) && d.t.length === NUM_PATTERNS) seq.beats = d.t.map(validBeat);
      seq.patterns = Array.from({ length: NUM_PATTERNS }, (_, p) =>
        normalizePattern(PADS.map((__, i) => decodeRow((d.p[p] || [])[i])), seq.beats[p]));
      seq.swingMode = d.w === 8 ? 8 : 16;
      seq.kits = Array.from({ length: NUM_PATTERNS }, (_, p) => (Array.isArray(d.k) ? resolveKit(d.k[p], p) : p));
      if (Array.isArray(d.b)) seq.bpms = seq.bpms.map((cur, i) => Math.min(240, Math.max(40, +d.b[i] || cur)));
      else if (d.b) seq.bpms = seq.bpms.map(() => Math.min(240, Math.max(40, +d.b)));
      seq.bpm = seq.bpms[seq.current];
      if (typeof d.s === 'number') seq.swing = Math.min(1, Math.max(0, d.s / 100));
      applySong(Array.isArray(d.g) ? { loop: !!d.g[0], on: !!d.g[1], list: d.g.slice(2) } : null);
      seq.fx = Array.isArray(d.x) && d.x.length === 6
        ? normalizeFx({ spring: { wet: d.x[0], decay: d.x[1] }, tape: { wet: d.x[2], fb: d.x[3] }, crush: { wet: d.x[4], bits: d.x[5] } })
        : DEFAULT_FX();
      seq.mix = Array.from({ length: NUM_PATTERNS }, (_, s) => defaultMix(s));
      setSynth(d.z || null);
      if (Array.isArray(d.m)) d.m.forEach(e => {
        if (!Array.isArray(e) || e.length < 6) return;
        const s = +e[0], i = +e[1];
        if (seq.mix[s] && seq.mix[s][i]) seq.mix[s][i] = normalizeMix([...Array(i).fill(null), { lvl: e[2], pan: e[3], a: e[4], b: e[5] }], s)[i];
      });
      window.history.replaceState(null, '', location.pathname);
      return true;
    } catch (_) { return false; }
  }

  function importProject(file) {
    file.text().then(txt => {
      const d = JSON.parse(txt);
      if (!d || d.app !== 'rhythm39' || !Array.isArray(d.patterns)) throw new Error('not a Rhythm-39 project');
      history.push();
      applyProject(d);
      lcd('project imported');
    }).catch(err => lcd(`import failed: ${String(err.message || err).slice(0, 30)}`));
  }

  // ------------------------------------------------------------------
  // UI
  // ------------------------------------------------------------------
  const $ = sel => document.querySelector(sel);
  const lcdMsg = $('#lcd-msg');
  // The visible line updates at once; the screen-reader live region gets at most one
  // update every 700 ms so bursts of messages do not flood it
  const lcdSr = $('#lcd-sr');
  let lcdSrTimer = null;
  function lcd(msg) {
    lcdMsg.textContent = msg;
    if (!lcdSr || lcdSrTimer) return;
    lcdSrTimer = setTimeout(() => { lcdSrTimer = null; lcdSr.textContent = lcdMsg.textContent; }, 700);
  }

  const ui = {
    selected: 12, // KICK
    volume: 0.8,
    padEls: [],
    stepEls: [],
    heldKeys: new Set(),

    build() {
      // Pads
      const padsEl = $('#pads');
      PADS.forEach((pad, i) => {
        const b = document.createElement('button');
        b.className = 'pad';
        b.style.setProperty('--pad-color', GROUP_COLOR[pad.group]);
        b.dataset.pad = i;
        b.setAttribute('aria-label', `${pad.name} pad, key ${KEYS[i].toUpperCase()}`);
        b.innerHTML = `<span class="pad-name">${pad.name}</span><span class="pad-tag">SMP</span><span class="pad-key" data-sub="${String(i + 1).padStart(2, '0')}">${KEYS[i].toUpperCase()}</span>`;
        b.addEventListener('pointerdown', e => {
          e.preventDefault();
          if (seq.padMode === 'play') b.classList.add('down');
          try { b.setPointerCapture(e.pointerId); } catch (_) {}
          if (settings.haptics && e.pointerType === 'touch' && navigator.vibrate) { try { navigator.vibrate(8); } catch (_) {} }
          seq.heldPads.add(i);
          hitPad(i, e.shiftKey ? 2 : padHitLevel(e, b));
        });
        const up = () => { b.classList.remove('down'); seq.heldPads.delete(i); engine.release(i); };
        b.addEventListener('pointerup', up);
        b.addEventListener('pointercancel', up);
        b.addEventListener('lostpointercapture', up);
        b.addEventListener('contextmenu', e => e.preventDefault());
        padsEl.appendChild(b);
        this.padEls.push(b);
      });

      // Steps: one page of cells (16 in 4/4, 12 in 12/8); longer patterns page through
      const grid = $('#step-grid');
      for (let s = 0; s < STEPS; s++) {
        const b = document.createElement('button');
        b.className = 'step';
        b.dataset.step = s;
        b.addEventListener('pointerdown', e => {
          e.preventDefault();
          engine.init();
          if (e.button === 2) return; // right-click opens the lock popover (contextmenu)
          history.push();
          const idx = this.page * pageSize() + s;
          const row = pattern()[this.selected];
          const before = stepLevel(row[idx]);
          setStepLevel(row, idx, (before + 1) % 3); // off -> on -> accent -> off
          // Start a paint stroke: dragging across other steps sets them to this value
          this.paint = { value: stepLevel(row[idx]), pointerId: e.pointerId, touched: new Set([idx]) };
          if (seq.playing) this.pinnedPage = true; // do not flip the page under an edit
          this.renderSteps();
          saveSoon();
          // Long-press (no painting meanwhile) opens the parameter locks for this step
          clearTimeout(this.lockTimer);
          this.lockTimer = setTimeout(() => {
            if (!this.paint || this.paint.touched.size > 1) return;
            this.paint = null;
            if (!stepLevel(row[idx])) setStepLevel(row, idx, before || 1); // the tap turned it off: bring it back
            this.openLock(idx);
          }, 400);
        });
        b.addEventListener('contextmenu', e => { e.preventDefault(); this.openLock(this.page * pageSize() + s); });
        // Keyboard: roving focus across the visible steps, Space cycles up, Shift+Space
        // cycles down, Enter opens the locks
        b.tabIndex = s === 0 ? 0 : -1;
        b.addEventListener('keydown', e => {
          const idx = this.page * pageSize() + s;
          const row = pattern()[this.selected];
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            if (e.key === 'Enter') { this.openLock(idx); return; }
            history.push();
            setStepLevel(row, idx, (stepLevel(row[idx]) + (e.shiftKey ? 2 : 1)) % 3);
            this.renderSteps(); saveSoon();
            return;
          }
          const visible = this.stepEls.filter(el => !el.hidden);
          const at = visible.indexOf(b);
          let to = -1;
          if (e.key === 'ArrowRight') to = (at + 1) % visible.length;
          if (e.key === 'ArrowLeft') to = (at - 1 + visible.length) % visible.length;
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { const half = Math.ceil(visible.length / 2); to = (at + half) % visible.length; }
          if (e.key === 'Home') to = 0;
          if (e.key === 'End') to = visible.length - 1;
          if (to >= 0) { e.preventDefault(); visible.forEach(el => { el.tabIndex = -1; }); visible[to].tabIndex = 0; visible[to].focus(); }
        });
        grid.appendChild(b);
        this.stepEls.push(b);
      }
      // Paint stroke: follow the pointer, mouse or touch, across the step grid
      const paintMove = e => {
        if (!this.paint || e.pointerId !== this.paint.pointerId) return;
        const el = document.elementFromPoint(e.clientX, e.clientY);
        if (!el || !el.classList.contains('step') || el.hidden) return;
        const idx = this.page * pageSize() + +el.dataset.step;
        if (this.paint.touched.has(idx)) return;
        this.paint.touched.add(idx);
        clearTimeout(this.lockTimer); // painting cancels the long-press
        const row = pattern()[this.selected];
        if (stepLevel(row[idx]) !== this.paint.value) { setStepLevel(row, idx, this.paint.value); this.renderSteps(); saveSoon(); }
      };
      // Page buttons (1-4), length and beat
      $('#step-pages').addEventListener('click', e => {
        const b = e.target.closest('.page-btn'); if (!b) return;
        const p = +b.dataset.page;
        // Tapping the shown page while playing toggles between pinned and following
        if (p === this.page) this.pinnedPage = seq.playing ? !this.pinnedPage : false;
        else { this.page = p; this.pinnedPage = seq.playing; }
        this.renderSteps();
      });
      const lenBtn = $('#btn-len');
      lenBtn.addEventListener('click', e => cycleLength(e.shiftKey ? -1 : 1));
      lenBtn.addEventListener('wheel', e => { e.preventDefault(); cycleLength(e.deltaY < 0 ? 1 : -1); }, { passive: false });
      // KIT: any of the four synth kits in this slot. Strips that still sit at the old
      // kit's defaults follow the new kit; edited strips keep their values
      $('#btn-kit').addEventListener('click', () => {
        const slot = seq.current;
        const wasDefault = seq.mix[slot].map((st, i) => isDefaultMix(st, slot, i));
        seq.kits[slot] = (seq.kits[slot] + 1) % KITS.length;
        seq.mix[slot] = seq.mix[slot].map((st, i) => (wasDefault[i] ? padDefaultMix(slot, i) : st));
        engine.kit = seq.kits[slot];
        this.renderSteps(); this.refreshPadNames(); saveSoon();
        document.dispatchEvent(new CustomEvent('rhythm:mix'));
        lcd(`slot ${'ABCD'[slot]} plays the ${kitOf(slot).name} kit`);
        if (kitOf(slot).sampled && engine.loadKit) engine.loadKit(seq.kits[slot]);
        this.syncSynth();
      });
      const paintEnd = e => { if (this.paint && e.pointerId === this.paint.pointerId) this.paint = null; clearTimeout(this.lockTimer); };
      window.addEventListener('pointermove', paintMove);
      window.addEventListener('pointerup', paintEnd);
      window.addEventListener('pointercancel', paintEnd);

      // Scroll wheel nudges BPM and the sliders when hovering them
      const wheelOpts = { passive: false };
      const bpmWheel = e => {
        e.preventDefault();
        const dir = e.deltaY < 0 ? 1 : -1;
        this.setBpm(seq.bpm + dir * (e.shiftKey ? 5 : 1));
      };
      $('#bpm').addEventListener('wheel', bpmWheel, wheelOpts);
      $('#lcd-bpm').parentElement.addEventListener('wheel', bpmWheel, wheelOpts);
      document.querySelectorAll('input[type=range]').forEach(r => {
        r.addEventListener('wheel', e => {
          e.preventDefault();
          const dir = e.deltaY < 0 ? 1 : -1;
          const stepSize = e.shiftKey ? 10 : 2;
          r.value = Math.min(+r.max, Math.max(+r.min, +r.value + dir * stepSize));
          r.dispatchEvent(new Event('input', { bubbles: true }));
        }, wheelOpts);
      });

      // Transport
      // PLAY starts (Shift+PLAY toggles song mode); STOP stops, and a second STOP within
      // a moment cuts the effect tails. Space still toggles play / stop from the keyboard
      $('#btn-play').addEventListener('click', e => { if (e.shiftKey) { setSong(!seq.song.on); return; } if (!seq.playing) { ui.clearFx(); play({ countIn: seq.recording && settings.countIn }); } });
      $('#btn-stop').addEventListener('click', () => { ui.clearFx(); stop(); });
      $('#btn-song').addEventListener('click', () => setSong(!seq.song.on));
      $('#btn-rec').addEventListener('click', () => this.setRecording(!seq.recording));
      $('#bpm').addEventListener('change', e => this.setBpm(+e.target.value));
      $('#bpm-down').addEventListener('click', () => this.setBpm(seq.bpm - 1));
      $('#bpm-up').addEventListener('click', () => this.setBpm(seq.bpm + 1));
      document.querySelectorAll('.pbtn').forEach(b =>
        b.addEventListener('click', () => this.setPattern(+b.dataset.ptn)));
      // CLR PAD: a tap clears the selected pad; held while playing, pads tapped meanwhile are erased
      const clrBtn = $('#btn-clear-pad');
      clrBtn.addEventListener('pointerdown', e => { e.preventDefault(); try { clrBtn.setPointerCapture(e.pointerId); } catch (_) {} eraseStart(); });
      clrBtn.addEventListener('pointerup', eraseEnd);
      clrBtn.addEventListener('pointercancel', eraseEnd);
      clrBtn.addEventListener('contextmenu', e => e.preventDefault());
      // Record options (shown while REC is armed)
      const recModeBtn = $('#rec-mode'), recQuantBtn = $('#rec-quant');
      const syncRecOpts = () => {
        recModeBtn.textContent = settings.recMode === 'replace' ? 'REPLACE' : 'OVERDUB';
        recModeBtn.classList.toggle('on', settings.recMode === 'replace');
        recQuantBtn.textContent = settings.quantize === false ? 'FREE TIME' : 'QUANTIZE';
        recQuantBtn.classList.toggle('on', settings.quantize !== false);
      };
      recModeBtn.addEventListener('click', () => { settings.recMode = settings.recMode === 'replace' ? 'overdub' : 'replace'; saveSettings(); syncRecOpts(); lcd(settings.recMode === 'replace' ? 'replace: held pads are rewritten as the playhead passes' : 'overdub: hits pile up'); });
      recQuantBtn.addEventListener('click', () => { settings.quantize = settings.quantize === false; saveSettings(); syncRecOpts(); lcd(settings.quantize ? 'hits snap to the grid' : 'free time: hits keep their offset'); });
      syncRecOpts();
      // Parameter-lock popover for a step (long-press or right-click)
      const lock = { p: $('#lock-p'), f: $('#lock-f'), s: $('#lock-s'), t: $('#lock-t') };
      const lockRow = () => pattern()[this.selected];
      const lockObj = () => { const row = lockRow(), c = row[this.lockStep]; return stepLocks(c) || { l: stepLevel(c) || 1 }; };
      const applyLock = o => { const row = lockRow(); row[this.lockStep] = normStep(o); this.renderSteps(); this.syncLock(); saveSoon(); };
      lock.p.addEventListener('input', () => { const o = lockObj(); o.p = +lock.p.value; applyLock(o); });
      lock.f.addEventListener('input', () => { const o = lockObj(); o.f = +lock.f.value / 100; applyLock(o); });
      lock.s.addEventListener('input', () => { const o = lockObj(); o.s = +lock.s.value / 100; applyLock(o); });
      lock.t.addEventListener('input', () => { const o = lockObj(); o.t = +lock.t.value / 100; applyLock(o); });
      Object.values(lock).forEach(r => r.addEventListener('wheel', e => {
        e.preventDefault();
        r.value = Math.min(+r.max, Math.max(+r.min, +r.value + (e.deltaY < 0 ? 1 : -1) * (r === lock.p ? 1 : 5)));
        r.dispatchEvent(new Event('input', { bubbles: true }));
      }, { passive: false }));
      $('#lock-clear').addEventListener('click', () => { history.push(); const row = lockRow(); row[this.lockStep] = stepLevel(row[this.lockStep]); this.renderSteps(); this.syncLock(); saveSoon(); lcd('locks cleared'); });
      $('#lock-close').addEventListener('click', () => this.closeLock());
      $('#lock-audition').addEventListener('click', () => {
        const o = lockObj();
        engine.init(); engine.trigger(this.selected, engine.now, LEVEL_VEL[o.l || 1], seq.mix[seq.current][this.selected], { semis: o.p || 0, filter: o.f == null ? 1 : o.f, sendMul: o.s == null ? 1 : o.s });
      });
      $('#btn-clear-ptn').addEventListener('click', () => {
        history.push();
        seq.patterns[seq.current] = emptyPattern(patLen());
        this.renderSteps(); saveSoon(); lcd(`pattern ${'ABCD'[seq.current]} cleared`);
      });
      $('#btn-undo').addEventListener('click', () => history.doUndo());
      $('#btn-copy').addEventListener('click', e => (e.shiftKey ? copyRow() : copyPattern()));
      $('#btn-paste').addEventListener('click', e => (e.shiftKey ? pasteRow() : pastePattern()));
      $('#btn-tap').addEventListener('click', () => { engine.init(); tapTempo(); });
      $('#btn-met').addEventListener('click', () => this.setMetronome(!seq.metronome));
      $('#mode-play').addEventListener('click', () => this.setPadMode('play'));
      $('#mode-keys').addEventListener('click', () => this.setPadMode(seq.padMode === 'keys' ? 'play' : 'keys'));
      // MUTE: a toggle by default; in "hold" mode it is active only while pressed
      const muteBtn = $('#mode-mute');
      muteBtn.addEventListener('pointerdown', e => {
        if (!settings.muteHold) return;
        e.preventDefault();
        try { muteBtn.setPointerCapture(e.pointerId); } catch (_) {}
        this.setPadMode('mute');
      });
      const muteRelease = () => { if (settings.muteHold) this.setPadMode('play'); };
      muteBtn.addEventListener('pointerup', muteRelease);
      muteBtn.addEventListener('pointercancel', muteRelease);
      muteBtn.addEventListener('click', () => { if (!settings.muteHold) this.setPadMode('mute'); });

      // Cassette deck view keys
      document.querySelectorAll('.deck-key').forEach(b =>
        b.addEventListener('click', () => this.setView(b.dataset.view)));

      // Settings
      const bindSetting = (id, key, fn) => {
        const el = $(id);
        el.checked = !!settings[key];
        el.addEventListener('change', () => { settings[key] = el.checked; saveSettings(); if (fn) fn(el.checked); });
        if (fn) fn(el.checked);
      };
      bindSetting('#set-countin', 'countIn');
      bindSetting('#set-haptics', 'haptics');
      bindSetting('#set-keycaps', 'keycaps', on => $('#unit').classList.toggle('no-keycaps', !on));
      bindSetting('#set-metvol-row', 'loudMet', on => { engine.clickLevel = on ? 2.2 : 1; });
      bindSetting('#set-mutehold', 'muteHold', on => { if (!on && seq.padMode === 'mute') this.setPadMode('play'); });
      bindSetting('#set-sidechain', 'sidechain', on => { engine.sidechain = on; });
      bindSetting('#set-posvel', 'posVel', on => $('#unit').classList.toggle('pos-vel', on));
      bindSetting('#set-hc', 'highContrast', on => $('#unit').classList.toggle('hc', on));
      bindSetting('#set-stall', 'stallResume');
      bindSetting('#set-ringout', 'ringOut');
      bindSetting('#set-keyhints', 'keyHints', on => document.documentElement.classList.toggle('show-keys', on));
      bindSetting('#set-lowlat', 'lowLatency', () => { if (engine.ctx) lcd('low latency applies after a reload'); this.syncLatency(); });
      // Theme: AUTO follows the OS, CREAM and BLACK force a skin. An inline script in the
      // head applies the stored choice before first paint
      const themeSwitch = $('#set-dark');
      const applyTheme = () => {
        const t = settings.theme || 'auto';
        const dark = t === 'black' || (t === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
        document.documentElement.classList.toggle('theme-black', dark);
        themeSwitch.checked = dark;
        $('#set-theme-note').textContent = t === 'auto' ? 'following the system setting' : (dark ? 'dark skin' : 'light skin');
        const meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.content = dark ? '#1c1b19' : '#e9e4d8';
      };
      themeSwitch.addEventListener('change', () => { settings.theme = themeSwitch.checked ? 'black' : 'cream'; saveSettings(); applyTheme(); });
      if (window.matchMedia) { try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme); } catch (_) {} }
      applyTheme();
      $('#set-demos').addEventListener('click', () => {
        history.push();
        seq.patterns = Array.from({ length: NUM_PATTERNS }, emptyPattern);
        seedDemo();
        this.setPattern(seq.current, { now: true }); // resyncs tempo display and delay time
        this.renderSteps(); saveSoon(); lcd('demo patterns restored');
      });
      $('#set-export').addEventListener('click', exportProject);
      $('#set-share').addEventListener('click', shareLink);
      // SHOW QR: draw the share link as a code (qr.js); links over 2 KB get a warning
      $('#set-qr').addEventListener('click', () => {
        const box = $('#qr-box');
        if (!box.hidden) { box.hidden = true; return; }
        if (!window.RhythmQR) { lcd('qr encoder missing'); return; }
        const url = shareUrl();
        try {
          const { ver } = window.RhythmQR.draw($('#qr-canvas'), url);
          box.hidden = false;
          $('#qr-note').textContent = `${url.length} characters · QR version ${ver}.${url.length > 2000 ? ' Over 2 KB: a dense code, hold the phone steady and close. Some chat apps also cut links this long.' : ''}`;
          lcd('qr ready · scan it with a phone');
        } catch (err) { lcd(`qr failed: ${String(err.message || err).slice(0, 30)}`); }
      });
      $('#set-import').addEventListener('change', e => { const f = e.target.files[0]; if (f) importProject(f); e.target.value = ''; });
      // Clearing every sample is destructive: the first click arms the button for 4 s,
      // the second click within that window clears
      const clearBtn = $('#set-clear-samples');
      let clearArm = null;
      const disarmClear = () => { clearTimeout(clearArm); clearArm = null; clearBtn.textContent = 'CLEAR ALL SAMPLES'; clearBtn.classList.remove('accent'); };
      clearBtn.addEventListener('click', () => {
        if (!clearArm) {
          clearBtn.textContent = 'SURE? CLICK AGAIN'; clearBtn.classList.add('accent');
          lcd('click again to clear all samples');
          clearArm = setTimeout(() => { disarmClear(); lcd('clear cancelled'); }, 4000);
          return;
        }
        disarmClear();
        if (window.rhythm && window.rhythm.sampler) window.rhythm.sampler.clearAll();
      });

      // Footer note jumps to settings
      $('#foot-settings').addEventListener('click', () => this.setView('settings'));

      // Keyboard remapper: 16 slots, click one then press a key
      const kg = $('#keymap-grid');
      this.keymapEls = PADS.map((pad, i) => {
        const b = document.createElement('button');
        b.className = 'keymap-key';
        b.style.setProperty('--pad-color', GROUP_COLOR[pad.group]);
        b.addEventListener('click', () => this.startRemap(i));
        kg.appendChild(b);
        return b;
      });
      $('#keymap-reset').addEventListener('click', () => {
        KEYS.splice(0, KEYS.length, ...DEFAULT_KEYS);
        settings.keys = null; saveSettings();
        this.remapPad = -1; this.refreshKeyCaps(); lcd('keys reset');
      });
      this.refreshKeyCaps();

      // Mixer
      const swing = $('#swing'), swingOut = $('#swing-out');
      const swingModeBtn = $('#swing-mode');
      const syncSwingMode = () => { swingModeBtn.textContent = seq.swingMode === 8 ? '8TH' : '16TH'; };
      swingModeBtn.addEventListener('click', () => { seq.swingMode = seq.swingMode === 8 ? 16 : 8; syncSwingMode(); saveSoon(); lcd(seq.swingMode === 8 ? 'swing on the off-beat 8ths' : 'swing on every odd 16th'); });
      this.syncSwingMode = syncSwingMode; syncSwingMode();
      swing.addEventListener('input', () => {
        seq.swing = +swing.value / 100; swingOut.value = swing.value;
        $('#lcd-swg').textContent = swing.value; saveSoon();
      });
      const vol = $('#volume'), volOut = $('#volume-out');
      vol.addEventListener('input', () => {
        this.volume = +vol.value / 100; volOut.value = vol.value;
        engine.setVolume(this.volume); saveSoon();
      });

      // Master FX sliders: each writes one field of seq.fx (slider 0..100 -> the field's range)
      const FX_SLIDERS = [
        { id: '#fx-spring-wet', unit: 'spring', key: 'wet', lo: 0, hi: 1, fmt: v => `${Math.round(v * 100)}` },
        { id: '#fx-spring-decay', unit: 'spring', key: 'decay', lo: 0.5, hi: 3, fmt: v => `${v.toFixed(1)}s` },
        { id: '#fx-tape-wet', unit: 'tape', key: 'wet', lo: 0, hi: 1, fmt: v => `${Math.round(v * 100)}` },
        { id: '#fx-tape-fb', unit: 'tape', key: 'fb', lo: 0.2, hi: 0.9, fmt: v => `${Math.round(v * 100)}` },
        { id: '#fx-crush-wet', unit: 'crush', key: 'wet', lo: 0, hi: 1, fmt: v => `${Math.round(v * 100)}` },
        { id: '#fx-crush-bits', unit: 'crush', key: 'bits', lo: 4, hi: 12, fmt: v => `${Math.round(v)}b` },
      ];
      this.fxSliders = FX_SLIDERS;
      FX_SLIDERS.forEach(s => {
        const el = $(s.id);
        el.addEventListener('input', () => {
          seq.fx[s.unit][s.key] = s.lo + (+el.value / 100) * (s.hi - s.lo);
          el.nextElementSibling.value = s.fmt(seq.fx[s.unit][s.key]);
          engine.init(); engine.applyFx(seq.fx); saveSoon();
        });
      });
      // Built-in synth panel: sliders write seq.synth, the X/Y surface drives two of them live
      const SYN = [
        { id: '#syn-cutoff', key: 'cutoff' }, { id: '#syn-reso', key: 'reso' }, { id: '#syn-env', key: 'env' }, { id: '#syn-attack', key: 'attack' },
        { id: '#syn-decay', key: 'decay' }, { id: '#syn-sustain', key: 'sustain' }, { id: '#syn-release', key: 'release' }, { id: '#syn-detune', key: 'detune' },
        { id: '#syn-sub', key: 'sub' }, { id: '#syn-drive', key: 'drive' }, { id: '#syn-glide', key: 'glide' },
      ];
      this.synSliders = SYN;
      SYN.forEach(sl => {
        const el = $(sl.id);
        el.addEventListener('input', () => {
          seq.synth[sl.key] = +el.value / 100;
          // Moving the slider a surface axis is aimed at also moves the surface
          if (seq.synth.x.target === sl.key) seq.synth.x.value = seq.synth[sl.key];
          if (seq.synth.y.target === sl.key) seq.synth.y.value = seq.synth[sl.key];
          this.syncSynth(true); saveSoon();
        });
      });
      $('#syn-wave').addEventListener('click', () => { seq.synth.wave = SYNTH_WAVES[(SYNTH_WAVES.indexOf(seq.synth.wave) + 1) % SYNTH_WAVES.length]; this.syncSynth(); saveSoon(); this.auditionSynth(); });
      $('#syn-oct-down').addEventListener('click', () => { seq.synth.octave = Math.max(0, seq.synth.octave - 1); this.syncSynth(); saveSoon(); this.auditionSynth(); });
      $('#syn-oct-up').addEventListener('click', () => { seq.synth.octave = Math.min(5, seq.synth.octave + 1); this.syncSynth(); saveSoon(); this.auditionSynth(); });
      $('#syn-x-target').addEventListener('click', () => { const t = SYNTH_TARGETS[(SYNTH_TARGETS.indexOf(seq.synth.x.target) + 1) % SYNTH_TARGETS.length]; seq.synth.x = { target: t, value: seq.synth[t] }; this.syncSynth(); saveSoon(); });
      $('#syn-y-target').addEventListener('click', () => { const t = SYNTH_TARGETS[(SYNTH_TARGETS.indexOf(seq.synth.y.target) + 1) % SYNTH_TARGETS.length]; seq.synth.y = { target: t, value: seq.synth[t] }; this.syncSynth(); saveSoon(); });
      $('#syn-reset').addEventListener('click', () => { setSynth(null); this.syncSynth(); saveSoon(); lcd('synth reset'); });
      $('#syn-use').addEventListener('click', () => {
        // Put the SYNTH kit on the current slot
        const idx = KITS.findIndex(k => k.synth);
        if (idx < 0) return;
        const slot = seq.current;
        if (seq.kits[slot] !== idx) { const wasDefault = seq.mix[slot].map((st, i) => isDefaultMix(st, slot, i)); seq.kits[slot] = idx; seq.mix[slot] = seq.mix[slot].map((st, i) => (wasDefault[i] ? padDefaultMix(slot, i) : st)); engine.kit = idx; this.renderSteps(); this.refreshPadNames(); saveSoon(); document.dispatchEvent(new CustomEvent('rhythm:mix')); }
        lcd(`slot ${'ABCD'[slot]} plays the SYNTH: pads are notes, C at the bottom left`);
        this.syncSynth();
      });
      // X/Y surface: drag anywhere; the dot follows, X left to right, Y bottom to top
      const xy = $('#syn-xy');
      let xyPointer = null;
      const xyAt = e => {
        const r = xy.getBoundingClientRect();
        const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
        const yv = Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height));
        seq.synth.x.value = Math.round(x * 100) / 100; seq.synth.y.value = Math.round(yv * 100) / 100;
        seq.synth[seq.synth.x.target] = seq.synth.x.value; seq.synth[seq.synth.y.target] = seq.synth.y.value;
        this.syncSynth(true);
      };
      xy.addEventListener('pointerdown', e => { e.preventDefault(); xyPointer = e.pointerId; try { xy.setPointerCapture(e.pointerId); } catch (_) {} engine.init(); xyAt(e); });
      xy.addEventListener('pointermove', e => { if (e.pointerId === xyPointer) xyAt(e); });
      const xyUp = e => { if (e.pointerId === xyPointer) { xyPointer = null; saveSoon(); } };
      xy.addEventListener('pointerup', xyUp); xy.addEventListener('pointercancel', xyUp); xy.addEventListener('lostpointercapture', xyUp);
      xy.addEventListener('contextmenu', e => e.preventDefault());
      xy.addEventListener('keydown', e => {
        const d = e.shiftKey ? 0.1 : 0.02; let used = true;
        if (e.key === 'ArrowLeft') seq.synth.x.value = Math.max(0, seq.synth.x.value - d);
        else if (e.key === 'ArrowRight') seq.synth.x.value = Math.min(1, seq.synth.x.value + d);
        else if (e.key === 'ArrowDown') seq.synth.y.value = Math.max(0, seq.synth.y.value - d);
        else if (e.key === 'ArrowUp') seq.synth.y.value = Math.min(1, seq.synth.y.value + d);
        else used = false;
        if (used) { e.preventDefault(); seq.synth[seq.synth.x.target] = seq.synth.x.value; seq.synth[seq.synth.y.target] = seq.synth.y.value; this.syncSynth(true); saveSoon(); }
      });
      $('#fx-reset').addEventListener('click', () => {
        seq.fx = DEFAULT_FX(); this.syncFx(); engine.applyFx(seq.fx); saveSoon(); lcd('master fx reset');
      });

      // Live FX buttons: hold for the effect, double-tap to latch (tap again to release),
      // drag up or down while holding to set the intensity (shown as a fill)
      document.querySelectorAll('.fxbtn').forEach(b => {
        const fx = b.dataset.fx;
        let lastDown = 0, startY = 0, startAmt = 0.7, pointerId = null;
        const on = e => {
          e.preventDefault();
          try { b.setPointerCapture(e.pointerId); } catch (_) {}
          pointerId = e.pointerId; startY = e.clientY;
          const now = performance.now();
          if (this.fxLatched[fx]) {
            // A tap on a latched button releases it
            this.fxLatched[fx] = false; b.classList.remove('latched'); this.setFx(fx, false); pointerId = null;
            lcd(`${fx} unlatched`);
            return;
          }
          if (now - lastDown < 350) {
            this.fxLatched[fx] = true; b.classList.add('latched');
            lcd(`${fx} latched · tap to release`);
          }
          lastDown = now;
          startAmt = this.fxAmount[fx] == null ? 0.7 : this.fxAmount[fx];
          this.setFx(fx, true, startAmt);
        };
        const move = e => {
          if (e.pointerId !== pointerId || !b.classList.contains('active')) return;
          const amt = Math.min(1, Math.max(0, startAmt + (startY - e.clientY) / 120));
          if (Math.abs(amt - (this.fxAmount[fx] == null ? 0.7 : this.fxAmount[fx])) > 0.01) this.setFx(fx, true, amt);
        };
        const off = e => {
          if (pointerId === null) return;
          pointerId = null;
          if (this.fxLatched[fx]) return; // stays on with its intensity
          this.fxAmount[fx] = 0.7;         // intensity resets unless latched
          this.setFx(fx, false);
        };
        b.addEventListener('pointerdown', on);
        b.addEventListener('pointermove', move);
        b.addEventListener('pointerup', off);
        b.addEventListener('pointercancel', off);
        b.addEventListener('lostpointercapture', off);
        b.addEventListener('contextmenu', e => e.preventDefault());
        // Keyboard on a focused button: Space toggles the effect, Enter toggles the latch
        b.addEventListener('keydown', e => {
          if (e.key !== ' ' && e.key !== 'Enter') return;
          e.preventDefault();
          if (e.repeat) return;
          if (e.key === 'Enter') {
            this.fxLatched[fx] = !this.fxLatched[fx];
            b.classList.toggle('latched', this.fxLatched[fx]);
            this.setFx(fx, this.fxLatched[fx]);
            return;
          }
          const on = !b.classList.contains('active');
          if (!on && this.fxLatched[fx]) { this.fxLatched[fx] = false; b.classList.remove('latched'); }
          this.setFx(fx, on);
        });
      });

      // Keyboard
      window.addEventListener('keydown', e => this.onKeyDown(e));
      window.addEventListener('keyup', e => this.onKeyUp(e));
      window.addEventListener('blur', () => this.releaseAll());

      // Wake audio on any first interaction
      const wake = () => { engine.init().then(() => { if (!seq.playing) lcd('ready'); }); engine.setBpm(seq.bpm); engine.setVolume(this.volume); };
      window.addEventListener('pointerdown', wake, { once: true });
      window.addEventListener('keydown', wake, { once: true });

      requestAnimationFrame(() => this.animate());
    },

    // --- state setters --------------------------------------------
    setBpm(v) {
      if (!Number.isFinite(v)) v = 88;
      seq.bpm = Math.min(240, Math.max(40, Math.round(v)));
      seq.bpms[seq.current] = seq.bpm;
      $('#bpm').value = seq.bpm;
      $('#lcd-bpm').textContent = seq.bpm;
      engine.setBpm(seq.bpm);
      saveSoon();
    },
    setPattern(i, opts = {}) {
      const btns = document.querySelectorAll('.pbtn');
      if (seq.playing && !opts.now && i !== seq.current) {
        // Queue: the scheduler flips at step 0
        seq.queued = seq.queued === i ? -1 : i;
        btns.forEach(b => b.classList.toggle('queued', +b.dataset.ptn === seq.queued));
        lcd(seq.queued >= 0 ? `${patLen() > barSteps() ? 'at loop end' : 'next bar'}: ${'ABCD'[seq.queued]}` : 'queue cleared');
        return;
      }
      const changed = seq.current !== i;
      const hadQueue = seq.queued >= 0 && !opts.now;
      seq.current = i; seq.queued = -1; engine.kit = seq.kits[i];
      if (changed) { this.page = 0; this.pinnedPage = false; }
      btns.forEach(b => { b.classList.toggle('on', +b.dataset.ptn === i); b.classList.remove('queued'); });
      $('#lcd-ptn').textContent = 'ABCD'[i];
      this.setBpm(seq.bpms[i] || seq.bpm);
      this.renderSteps(); this.refreshPadNames(); saveSoon();
      if (changed) lcd(`pattern ${'ABCD'[i]} · ${kitOf(i).name} kit · ${seq.bpm} bpm`);
      else if (hadQueue) lcd('queue cleared');
    },
    setMetronome(on) {
      seq.metronome = on;
      $('#btn-met').classList.toggle('on', on);
      engine.init();
      lcd(on ? 'metronome on' : 'metronome off');
    },
    updateUndo() {
      $('#btn-undo').disabled = history.undo.length === 0;
      $('#btn-paste').disabled = clipboard === null && rowClipboard === null;
    },
    setPadMode(mode) {
      const was = seq.padMode;
      seq.padMode = mode;
      if (mode === 'keys') seq.keysSource = this.selected;
      $('#mode-play').classList.toggle('on', mode === 'play');
      $('#mode-mute').classList.toggle('on', mode === 'mute');
      $('#mode-keys').classList.toggle('on', mode === 'keys');
      $('#unit').classList.toggle('mute-mode', mode === 'mute');
      $('#unit').classList.toggle('keys-mode', mode === 'keys');
      $('#padmode-hint').textContent = mode === 'mute' ? 'tap a pad to mute / unmute' : (mode === 'keys' ? `${this.padName(seq.keysSource)} across the grid · REC writes pitch locks` : '');
      this.padEls.forEach(el => el.classList.remove('down'));
      if (mode === 'keys' || was === 'keys') this.refreshPadNames();
    },
    renderMutes() {
      const solo = anySolo();
      this.padEls.forEach((el, i) => {
        el.classList.toggle('muted', !!seq.mutes[i] || (solo && !seq.solo[i]));
        el.classList.toggle('solo', !!seq.solo[i]);
      });
      document.dispatchEvent(new CustomEvent('rhythm:mix'));
    },
    // Name shown for a pad: the sample name when one is loaded, else the synth name
    padName(i) {
      const s = engine.samples[i];
      return s && s.name ? s.name : kitOf(seq.current).pads[i].name;
    },
    refreshPadNames() {
      const keys = seq.padMode === 'keys';
      const kitSampled = !!kitOf(seq.current).sampled;
      this.padEls.forEach((el, i) => {
        el.querySelector('.pad-name').textContent = keys ? keyLabel(i) : this.padName(i);
        el.classList.toggle('sampled', !keys && !!engine.samples[i]);
        el.classList.toggle('kitsmp', !keys && !engine.samples[i] && kitSampled);
        el.querySelector('.pad-tag').textContent = engine.samples[i] ? 'SMP' : 'KIT';
      });
      $('#steps-pad').textContent = this.padName(this.selected);
      if (this.keymapEls.length) this.refreshKeyCaps();
      document.dispatchEvent(new CustomEvent('rhythm:pads'));
    },
    // --- keyboard remapping ------------------------------------------
    remapPad: -1,
    keymapEls: [],
    startRemap(i) {
      this.remapPad = this.remapPad === i ? -1 : i;
      this.refreshKeyCaps();
      $('#keymap-hint').textContent = this.remapPad >= 0 ? `press a key for pad ${i + 1} (Esc cancels)` : '';
    },
    finishRemap(k) {
      const i = this.remapPad;
      if (i < 0) return false;
      if (!k) return true; // swallow keys we cannot map
      if (RESERVED_KEYS.has(k)) { $('#keymap-hint').textContent = `${k.toUpperCase()} is reserved`; return true; }
      const j = KEYS.indexOf(k);
      if (j >= 0 && j !== i) KEYS[j] = KEYS[i]; // swap with the pad that had it
      KEYS[i] = k;
      settings.keys = KEYS.slice(); saveSettings();
      this.remapPad = -1;
      this.refreshKeyCaps();
      $('#keymap-hint').textContent = j >= 0 && j !== i ? `pad ${i + 1} = ${k.toUpperCase()}, pad ${j + 1} = ${KEYS[j].toUpperCase()}` : `pad ${i + 1} = ${k.toUpperCase()}`;
      return true;
    },
    refreshKeyCaps() {
      this.padEls.forEach((el, i) => {
        el.querySelector('.pad-key').textContent = KEYS[i].toUpperCase();
        el.setAttribute('aria-label', `${this.padName(i)} pad, key ${KEYS[i].toUpperCase()}`);
      });
      this.keymapEls.forEach((el, i) => {
        el.innerHTML = `${this.remapPad === i ? '…' : KEYS[i].toUpperCase()}<small>${kitOf(seq.current).pads[i].name}</small>`;
        el.classList.toggle('listening', this.remapPad === i);
      });
    },
    view: 'output',
    setView(name) {
      if (!document.querySelector(`.view[data-view="${name}"]`)) return;
      this.view = name;
      document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.dataset.view === name));
      document.querySelectorAll('.deck-key').forEach(b => {
        const on = b.dataset.view === name;
        b.classList.toggle('active', on); b.setAttribute('aria-selected', on);
      });
      this.releaseAll();
      if (name === 'settings') this.syncLatency();
      document.dispatchEvent(new CustomEvent('rhythm:view', { detail: { view: name } }));
    },
    setPlaying(on) {
      $('#btn-play').classList.toggle('active', on);
    },
    setRecording(on) {
      seq.recording = on;
      $('#btn-rec').classList.toggle('active', on);
      $('#lcd').classList.toggle('recording', on);
      $('#rec-opts').hidden = !on;
      seq.passHist = false; seq.justRecorded.clear();
      const mode = `${settings.recMode === 'replace' ? 'replace' : 'overdub'} · ${settings.quantize === false ? 'free time' : 'quantized'}`;
      lcd(on ? (seq.playing ? `recording · ${mode}` : `rec armed · ${mode}`) : (seq.playing ? 'playing' : 'stopped'));
    },
    // --- parameter-lock popover -------------------------------------
    lockStep: -1,
    openLock(idx) {
      this.lockStep = idx;
      history.push();
      $('#lock-pop').hidden = false;
      this.syncLock(); this.renderSteps();
      if (seq.playing) this.pinnedPage = true;
    },
    closeLock() { $('#lock-pop').hidden = true; this.lockStep = -1; this.renderSteps(); },
    syncLock() {
      if (this.lockStep < 0) return;
      const c = pattern()[this.selected][this.lockStep], o = stepLocks(c) || {};
      $('#lock-step').textContent = `${this.lockStep + 1} · ${this.padName(this.selected)}`;
      const set = (id, v, txt) => { const el = $(id); el.value = v; el.nextElementSibling.value = txt; };
      set('#lock-p', o.p || 0, `${o.p > 0 ? '+' : ''}${o.p || 0}`);
      set('#lock-f', Math.round((o.f == null ? 1 : o.f) * 100), o.f == null || o.f >= 1 ? 'open' : `${Math.round(300 * Math.pow(60, o.f))}Hz`);
      set('#lock-s', Math.round((o.s == null ? 1 : o.s) * 100), `${Math.round((o.s == null ? 1 : o.s) * 100)}%`);
      set('#lock-t', Math.round((o.t || 0) * 100), `${o.t > 0 ? '+' : ''}${Math.round((o.t || 0) * 100)}%`);
    },
    fxAmount: {},   // intensity per live FX while held (drag), 0..1
    fxLatched: {},  // latched live FX stay on after release (double tap)
    setFx(fx, on, amount) {
      const b = document.querySelector(`.fxbtn[data-fx="${fx}"]`);
      if (amount != null) this.fxAmount[fx] = amount;
      const a = this.fxAmount[fx] == null ? 0.7 : this.fxAmount[fx];
      if (b) { b.classList.toggle('active', on); b.style.setProperty('--amt', on ? a : 0); }
      engine.init();
      if (fx === 'stutter' || fx === 'rep8') {
        if (on) {
          seq.repeatMul = fx === 'rep8' ? 2 : 0.5; seq.stutter = true;
          // Freeze what is sounding, not the lookahead: the last drained visual step, or the
          // newest queued entry already in the past when the animation loop is throttled
          const past = seq.visualQueue.filter(v => v.step != null && v.time <= engine.now);
          const heard = past.length ? past[past.length - 1].step : seq.playheadStep;
          if (heard >= 0) seq.stutterStep = heard;
        }
        else if (seq.stutter && ((fx === 'rep8') === (seq.repeatMul === 2))) { seq.stutter = false; seq.stutterStep = -1; }
        return;
      }
      if (fx === 'half') {
        if (on && !seq.half) seq.half = true;
        else if (!on && seq.half) { seq.half = false; realignToGrid(); }
        return;
      }
      engine.setPunch(fx, on, a);
    },
    // Release everything held or latched (PLAY / STOP, view change)
    clearFx() {
      Object.keys(this.fxLatched).forEach(fx => { this.fxLatched[fx] = false; });
      document.querySelectorAll('.fxbtn').forEach(b => { b.classList.remove('latched'); if (b.classList.contains('active')) this.setFx(b.dataset.fx, false); });
      this.fxAmount = {};
    },
    selectPad(i) {
      if (this.selected === i) return;
      this.selected = i;
      if (this.lockStep >= 0) this.closeLock();
      this.padEls.forEach((el, j) => el.classList.toggle('selected', j === i));
      $('#steps-pad').textContent = this.padName(i);
      this.renderSteps();
    },
    clearPad() {
      history.push();
      pattern()[this.selected].fill(0);
      this.renderSteps(); saveSoon();
      lcd(`${this.padName(this.selected)} cleared`);
    },

    // --- rendering -------------------------------------------------
    page: 0,           // step grid page shown (0-based)
    pinnedPage: false, // true: the page stays put while playing instead of following the playhead
    renderSteps() {
      const row = pattern()[this.selected];
      const len = row.length, size = pageSize(), beat = patBeat();
      const pages = Math.ceil(len / size);
      if (this.page >= pages) this.page = pages - 1;
      const off = this.page * size;
      const grid = $('#step-grid');
      grid.style.setProperty('--cols', size);
      grid.style.setProperty('--cols-half', size / 2);
      this.stepEls.forEach((el, s) => {
        const idx = off + s;
        const shown = s < size && idx < len;
        el.hidden = !shown;
        if (!shown) return;
        const lvl = stepLevel(row[idx]);
        el.classList.toggle('on', lvl > 0);
        el.classList.toggle('acc', lvl > 1);
        el.classList.toggle('lk', !!stepLocks(row[idx]));
        el.classList.toggle('editing', this.lockStep === idx && !$('#lock-pop').hidden);
        el.classList.toggle('beat', idx % beat === 0);
        el.classList.toggle('bar', idx % barSteps() === 0 && len > barSteps());
        el.setAttribute('aria-label', `Step ${idx + 1}`);
      });
      // Page buttons only when there is more than one page
      const pagesEl = $('#step-pages');
      pagesEl.hidden = pages < 2;
      if (pagesEl.childElementCount !== pages) {
        pagesEl.innerHTML = Array.from({ length: pages }, (_, p) =>
          `<button class="mini txt page-btn" data-page="${p}" title="Show steps ${p * size + 1} to ${Math.min(len, (p + 1) * size)}">${p + 1}</button>`).join('');
      }
      pagesEl.querySelectorAll('.page-btn').forEach(b => {
        b.classList.toggle('on', +b.dataset.page === this.page);
        b.classList.toggle('pin', this.pinnedPage && +b.dataset.page === this.page);
      });
      $('#btn-len').textContent = lengthLabel();
      $('#btn-kit').textContent = `KIT: ${kitOf(seq.current).name}`;
      $('#btn-len').title = `${describeLength()}. Click to cycle 8, 12, 16, 32, 64 steps, then the 12/8 triplet lengths (Shift or wheel for the other way)`;
    },
    setCurrentStep(s) {
      const size = pageSize();
      if (s >= 0 && !this.pinnedPage) {
        const p = Math.floor(s / size);
        if (p !== this.page) { this.page = p; this.renderSteps(); }
      }
      const cell = s - this.page * size;
      this.stepEls.forEach((el, i) => el.classList.toggle('cur', i === cell));
    },
    flashPads(pads) {
      pads.forEach(p => {
        const el = this.padEls[p];
        el.classList.add('hit');
        clearTimeout(el._t);
        el._t = setTimeout(() => el.classList.remove('hit'), 90);
      });
    },
    animate() {
      if (seq.playing && engine.ctx) {
        const now = engine.ctx.currentTime;
        // Drain every entry that is due; a pattern switch must not be lost when more
        // than one entry lands in the same frame (fast tempo, dropped frame)
        let latest = null, ptn = -1, songPos = -1;
        while (seq.visualQueue.length && seq.visualQueue[0].time <= now) {
          const v = seq.visualQueue.shift();
          if (v.songPos >= 0) { songPos = v.songPos; continue; }
          latest = v;
          if (latest.ptn >= 0) ptn = latest.ptn;
        }
        if (songPos >= 0) {
          const e = seq.song.list[songPos];
          if (e) lcd(`song ${songPos + 1}/${seq.song.list.length} · ${'ABCD'[e.slot]} x${e.repeats}`);
          document.dispatchEvent(new CustomEvent('rhythm:song'));
        }
        if (latest) {
          if (ptn >= 0) this.setPattern(ptn, { now: true });
          seq.playheadStep = latest.step;
          this.setCurrentStep(latest.step); this.flashPads(latest.pads);
        }
      }
      this.drawMeter();
      requestAnimationFrame(() => this.animate());
    },
    // Output meter: reads the analysers while playing or within 2 s of a hit, with a
    // 1 s peak hold per channel and red above -0.5 dBFS
    meterState: [{ lvl: 0, peak: 0, at: 0 }, { lvl: 0, peak: 0, at: 0 }],
    meterIdle: true,
    drawMeter() {
      if (!engine.ready || !engine.meters) return;
      const now = engine.ctx.currentTime;
      const active = seq.playing || now - engine.lastHit < 2;
      if (!active) {
        if (!this.meterIdle) {
          this.meterIdle = true;
          $('#lcd-meter').querySelectorAll('i').forEach(el => { el.querySelector('b').style.width = '0'; el.querySelector('u').style.opacity = '0'; el.classList.remove('hot'); });
        }
        return;
      }
      this.meterIdle = false;
      const peaks = engine.readMeter();
      const t = performance.now();
      $('#lcd-meter').querySelectorAll('i').forEach((el, c) => {
        const m = this.meterState[c], p = peaks[c] || 0;
        m.lvl = Math.max(p, m.lvl * 0.85);                 // quick rise, smooth fall
        if (p >= m.peak || t - m.at > 1000) { m.peak = p; m.at = t; }
        const pct = v => `${Math.min(100, Math.round(Math.pow(v, 0.6) * 100))}%`; // gentle curve so quiet material still moves
        el.querySelector('b').style.width = pct(m.lvl);
        const u = el.querySelector('u');
        u.style.left = `calc(${pct(m.peak)} - 2px)`; u.style.opacity = m.peak > 0.02 ? '1' : '0';
        el.classList.toggle('hot', m.peak >= 0.944); // -0.5 dBFS
      });
    },
    syncAll() {
      $('#bpm').value = seq.bpm; $('#lcd-bpm').textContent = seq.bpm;
      $('#swing').value = Math.round(seq.swing * 100);
      $('#swing-out').value = Math.round(seq.swing * 100);
      $('#lcd-swg').textContent = Math.round(seq.swing * 100);
      $('#volume').value = Math.round(this.volume * 100);
      $('#volume-out').value = Math.round(this.volume * 100);
      this.padEls[this.selected].classList.add('selected');
      $('#steps-pad').textContent = PADS[this.selected].name;
      this.setPattern(seq.current, { now: true });
      this.updateUndo();
      this.renderMutes();
      this.setPadMode('play');
      $('#btn-song').classList.toggle('on', seq.song.on);
      $('#song').hidden = !seq.song.on;
      document.dispatchEvent(new CustomEvent('rhythm:song'));
      this.syncFx(); engine.applyFx(seq.fx);
      engine.synth = seq.synth; this.syncSynth();
      if (this.syncSwingMode) this.syncSwingMode();
      this.closeLock();
    },
    // Synth panel <- seq.synth. quiet = the surface is being dragged (skip the LCD)
    syncSynth(quiet = false) {
      const P = seq.synth;
      (this.synSliders || []).forEach(sl => { const el = $(sl.id); el.value = Math.round(P[sl.key] * 100); el.nextElementSibling.value = Math.round(P[sl.key] * 100); });
      $('#syn-wave').textContent = P.wave.toUpperCase();
      $('#syn-oct').textContent = `OCT ${P.octave}`;
      $('#syn-x-target').textContent = `X: ${P.x.target.toUpperCase()}`;
      $('#syn-y-target').textContent = `Y: ${P.y.target.toUpperCase()}`;
      const dot = $('#syn-dot');
      dot.style.left = `${P.x.value * 100}%`; dot.style.top = `${(1 - P.y.value) * 100}%`;
      $('#syn-xy').setAttribute('aria-valuetext', `${P.x.target} ${Math.round(P.x.value * 100)}, ${P.y.target} ${Math.round(P.y.value * 100)}`);
      $('#syn-xy-read').textContent = `${Math.round(P.x.value * 100)} · ${Math.round(P.y.value * 100)}`;
      const synthIdx = KITS.findIndex(k => k.synth);
      $('#syn-use').classList.toggle('on', seq.kits[seq.current] === synthIdx);
      if (!quiet) engine.synth = seq.synth;
    },
    auditionSynth() {
      engine.init().then(() => {
        const idx = KITS.findIndex(k => k.synth), was = engine.kit;
        engine.kit = idx; engine.trigger(12, engine.now, 0.9, null, { stopAt: engine.now + 0.35 }); engine.kit = was;
      });
    },
    // Settings: output latency line (needs a running context)
    syncLatency() {
      const el = $('#set-latency'); if (!el) return;
      if (!engine.ctx) { el.textContent = 'Output latency: tap a pad first to measure.'; return; }
      const ms = Math.round(engine.latency * 1000);
      el.textContent = `Output latency: ${ms} ms (${engine.ctx.sampleRate} Hz).${ms > 40 ? ' That is high: try wired headphones, close other audio apps, or turn on low latency.' : ''}${settings.lowLatency ? ' Low latency is on.' : ''}`;
    },
    syncFx() {
      (this.fxSliders || []).forEach(s => {
        const v = seq.fx[s.unit][s.key], el = $(s.id);
        el.value = Math.round(((v - s.lo) / (s.hi - s.lo)) * 100);
        el.nextElementSibling.value = s.fmt(v);
      });
    },

    // --- keyboard ----------------------------------------------------
    onKeyDown(e) {
      // A focused step or live FX button handles Space, Enter and the arrows itself
      if (e.target && e.target.closest && e.target.closest('.step, .fxbtn') && (e.key === ' ' || e.key === 'Enter' || e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End')) return;
      // Only real typing targets swallow keys. A focused slider, toggle or button
      // (you just clicked it) must not stop the pads and transport from working.
      const tag = (e.target.tagName || '').toLowerCase();
      const type = tag === 'input' ? (e.target.type || 'text').toLowerCase() : '';
      const typing = tag === 'textarea' || (tag === 'input' && !['range', 'checkbox', 'radio', 'button', 'file'].includes(type));
      if (typing) {
        if (e.key === 'Enter') e.target.blur();
        return;
      }
      if (tag === 'input' && (type === 'range' || type === 'checkbox') && (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End')) return;
      if (e.repeat) return;
      if (this.remapPad >= 0) {
        e.preventDefault();
        if (e.key === 'Escape') { this.startRemap(this.remapPad); return; }
        this.finishRemap(codeToKey(e.code));
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.code === 'KeyZ') {
        e.preventDefault(); e.shiftKey ? history.doRedo() : history.doUndo(); return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Use physical key codes so Shift (accent) does not change the key identity
      const k = codeToKey(e.code);

      const padIdx = KEYS.indexOf(k);
      if (padIdx >= 0) {
        e.preventDefault();
        this.heldKeys.add(k);
        this.padEls[padIdx].classList.add('down');
        seq.heldPads.add(padIdx);
        hitPad(padIdx, e.shiftKey ? 2 : 1);
        return;
      }
      if (FX_KEYS[k]) { e.preventDefault(); this.heldKeys.add(k); this.setFx(FX_KEYS[k], true); return; }
      if (k === 't') { engine.init(); tapTempo(); return; }
      if (k === 'm') { this.setMetronome(!seq.metronome); return; }
      if (k === 'n') {
        if (settings.muteHold) { this.heldKeys.add('n'); this.setPadMode('mute'); }
        else this.setPadMode(seq.padMode === 'mute' ? 'play' : 'mute');
        return;
      }
      if (k === 'b') { this.setPadMode(seq.padMode === 'keys' ? 'play' : 'keys'); return; }
      if (e.key === 'F1') { e.preventDefault(); this.setView('output'); return; }
      if (e.key === 'F2') { e.preventDefault(); this.setView('input'); return; }
      if (e.key === 'F3') { e.preventDefault(); this.setView('mixer'); return; }
      if (e.key === 'F4') { e.preventDefault(); this.setView('settings'); return; }
      if (e.key === '?') { e.preventDefault(); if (window.rhythm && window.rhythm.tour) window.rhythm.tour.start(); return; }

      switch (e.key) {
        case ' ': e.preventDefault(); e.shiftKey ? setSong(!seq.song.on) : togglePlay(); break;
        case 'Enter': e.preventDefault(); this.setRecording(!seq.recording); break;
        case 'Escape': stop(); break;
        case '[': case '{': this.setBpm(seq.bpm - (e.shiftKey ? 5 : 1)); break;
        case ']': case '}': this.setBpm(seq.bpm + (e.shiftKey ? 5 : 1)); break;
        case 'Backspace':
        case 'Delete': e.preventDefault(); eraseStart(); break;
        default: break;
      }
    },
    onKeyUp(e) {
      if ((e.key === 'Backspace' || e.key === 'Delete') && seq.erasing) { eraseEnd(); return; }
      const k = codeToKey(e.code);
      if (!this.heldKeys.has(k)) return;
      this.heldKeys.delete(k);
      const padIdx = KEYS.indexOf(k);
      if (padIdx >= 0) { this.padEls[padIdx].classList.remove('down'); seq.heldPads.delete(padIdx); engine.release(padIdx); }
      if (FX_KEYS[k] && !this.fxLatched[FX_KEYS[k]]) this.setFx(FX_KEYS[k], false);
      if (k === 'n' && settings.muteHold) this.setPadMode('play');
    },
    releaseAll() {
      this.heldKeys.forEach(k => { if (FX_KEYS[k] && !this.fxLatched[FX_KEYS[k]]) this.setFx(FX_KEYS[k], false); });
      if (this.heldKeys.has('n') && settings.muteHold) this.setPadMode('play');
      this.heldKeys.clear();
      seq.heldPads.clear();
      if (seq.erasing) { seq.eraseTouched = true; eraseEnd(); }
      this.padEls.forEach(el => el.classList.remove('down'));
      engine.releaseAll();
    },
  };

  // ------------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------------
  const engine = new Engine();
  ui.build();
  load();
  const fromLink = loadShareFromHash();
  ui.syncAll();
  if (fromLink) { save(); lcd('loaded from share link'); }

  // Surface runtime errors on the LCD, not only the console
  window.addEventListener('error', e => lcd(`err: ${(e.message || 'unknown').slice(0, 40)}`));
  window.addEventListener('unhandledrejection', e => lcd(`err: ${String(e.reason || '').slice(0, 40)}`));

  // Interrupted contexts (calls, headphone switches, the silent switch on iOS) resume
  // on the next touch or key; the LCD says so
  engine.onState = st => {
    if (st === 'running') { if (engine.wasInterrupted) { engine.wasInterrupted = false; lcd(seq.playing ? 'audio back' : 'ready'); } return; }
    if (st === 'closed') return;
    engine.wasInterrupted = true;
    lcd('audio paused · tap to resume');
  };
  const resumeIfNeeded = () => { if (engine.ctx && engine.ctx.state !== 'running' && engine.ctx.state !== 'closed') engine.ctx.resume().catch(() => {}); };
  window.addEventListener('pointerdown', resumeIfNeeded, true);
  window.addEventListener('keydown', resumeIfNeeded, true);
  // Coming back to the tab (or unlocking the phone) can leave the context suspended
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && engine.ctx && engine.ctx.state === 'suspended') engine.ctx.resume().catch(() => {});
    if (!document.hidden && seq.playing) requestWakeLock();
    if (document.hidden && seq.playing && engine.ctx) scheduler(); // fill the longer background horizon right away
  });

  // Installable / offline: service workers only run over http(s), so file:// just skips this.
  // On localhost (development) we skip it too, and clean up any old registration, so edits
  // always show up without a cache fight.
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
    const dev = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
    if (dev) {
      navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(() => {});
      if (window.caches) caches.keys().then(ks => ks.forEach(k => caches.delete(k))).catch(() => {});
    } else {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  // Shared with sampler.js / help.js (and handy in the console)
  window.rhythm = {
    engine, seq, ui, PADS, KITS, KEYS, settings, lcd, history, saveSoon, hitPad, seedDemo, setLength, patLen, patBeat, barSteps, renderAudio,
    song: { set: setSong, add: songAdd, update: songUpdate, remove: songRemove, move: songMove, isEmptySlot, changed: songChanged, MAX: SONG_MAX },
    mix: { toggleMute, toggleSolo, changed: mixChanged, defaults: padDefaultMix, isDefault: isDefaultMix, audible },
    kitOf, resolveKit, play, stop, togglePlay, setSynth, SYNTH_TARGETS,
    project: { data: projectData, apply: applyProject, fresh: loadedFresh, fromLink, shareUrl, seedDemo: () => { seq.patterns = Array.from({ length: NUM_PATTERNS }, emptyPattern); seedDemo(); seq.fx = DEFAULT_FX(); seq.mix = Array.from({ length: NUM_PATTERNS }, (_, s) => defaultMix(s)); setSynth(null); applySong(null); ui.syncAll(); save(); } },
  };
})();
