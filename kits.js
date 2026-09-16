/* Rhythm-39 · sampled kits. Reads samples/index.json, registers each kit in the KITS
   list (so the KIT button and every kit lookup see it) and decodes its files on first
   use. Buffers live in engine.kitBuffers[kitIndex][pad]. Depends on app.js. */
(() => {
  'use strict';
  const R = window.rhythm;
  if (!R) return;
  const { engine, KITS, seq, ui, lcd } = R;
  const GROUPS = ['fx', 'fx', 'fx', 'fx', 'perc', 'perc', 'bass', 'bass', 'perc', 'perc', 'perc', 'perc', 'drum', 'drum', 'drum', 'drum'];
  const loading = {};

  // Peak to -1 dBFS and fade the last 5 ms so cut samples do not click
  function condition(buf) {
    let peak = 0;
    for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; } }
    const k = peak > 0 ? 0.891 / peak : 1;
    const fade = Math.min(buf.length, Math.floor(buf.sampleRate * 0.005));
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < d.length; i++) d[i] *= k;
      for (let i = 0; i < fade; i++) d[buf.length - 1 - i] *= i / fade;
    }
  }

  engine.loadKit = async idx => {
    const k = KITS[idx];
    if (!k || !k.sampled) return null;
    engine.kitBuffers = engine.kitBuffers || {};
    if (engine.kitBuffers[idx]) return engine.kitBuffers[idx];
    if (loading[idx]) return loading[idx];
    loading[idx] = (async () => {
      await engine.init();
      lcd(`loading ${k.name} kit…`);
      let done = 0;
      const bufs = await Promise.all(k.sampled.files.map(async f => {
        const res = await fetch(`${k.sampled.dir}/${f}`);
        if (!res.ok) throw new Error(`${f}: ${res.status}`);
        const buf = await engine.ctx.decodeAudioData(await res.arrayBuffer());
        condition(buf);
        done += 1; if (done % 4 === 0) lcd(`loading ${k.name} kit… ${done}/${k.sampled.files.length}`);
        return buf;
      }));
      engine.kitBuffers[idx] = bufs;
      lcd(`${k.name} kit ready`);
      ui.refreshPadNames();
      return bufs;
    })().catch(err => { delete loading[idx]; lcd(`kit failed: ${String(err.message || err).slice(0, 30)}`); return null; });
    return loading[idx];
  };

  // Slots whose saved kit id was not known at load time (sampled kits register after
  // the project loads) get their kit now; anything still unknown stays on the synth kit
  function resolvePending() {
    let changed = false;
    seq.pendingKits.forEach((id, slot) => {
      if (!id) return;
      const i = KITS.findIndex(k => k.id === id);
      if (i >= 0) { seq.kits[slot] = i; changed = true; }
      else lcd(`kit "${id}" is not available here, slot ${'ABCD'[slot]} uses its synth kit`);
      seq.pendingKits[slot] = null;
    });
    if (changed) { engine.kit = seq.kits[seq.current]; ui.renderSteps(); ui.refreshPadNames(); document.dispatchEvent(new CustomEvent('rhythm:mix')); }
    loadUsed();
  }
  function loadUsed() { new Set(seq.kits).forEach(k => { if (KITS[k] && KITS[k].sampled) engine.loadKit(k); }); }

  async function register() {
    let idx;
    try {
      const res = await fetch('samples/index.json');
      if (!res.ok) throw new Error(res.status);
      idx = await res.json();
    } catch (_) { return; } // no samples folder (file:// or a trimmed deploy): synth kits only
    (idx.kits || []).forEach(k => {
      if (!k || !k.id || !Array.isArray(k.pads) || k.pads.length !== 16 || KITS.some(x => x.id === k.id)) return;
      KITS.push({
        id: k.id, name: k.name || k.id.toUpperCase(),
        sampled: { dir: k.dir, files: k.pads.map(p => p.file), license: k.license, source: k.source, credit: k.credit },
        pads: k.pads.map((p, i) => ({ name: p.name || `PAD ${i + 1}`, group: GROUPS[i], choke: p.choke, send: p.send || 0, verb: p.verb == null ? undefined : p.verb, gain: p.gain == null ? 1 : p.gain })),
      });
    });
    resolvePending();
  }
  document.addEventListener('rhythm:project', loadUsed);
  register();
  R.kits = { resolvePending, loadUsed, loading };
})();
