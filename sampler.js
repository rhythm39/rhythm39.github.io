/* Rhythm-39 · INPUT view: record from the mic or load a file, trim, gain, pitch,
   assign to a pad. Samples persist in IndexedDB as raw PCM. Depends on app.js. */
(() => {
  'use strict';
  const R = window.rhythm;
  if (!R) return;
  const { engine, ui, PADS, lcd } = R;
  const $ = s => document.querySelector(s);

  const MAX_SEC = 12;          // longest mic take
  const THRESHOLD = 0.02;      // RMS that counts as "signal" for auto-start
  const GROUP_COLOR = { drum: 'var(--pad-drum)', perc: 'var(--pad-perc)', bass: 'var(--pad-bass)', fx: 'var(--pad-fx)' };

  const state = {
    target: 12,               // KICK by default
    buffer: null, name: '', start: 0, end: 1, gain: 1, pitch: 0,
    fadeIn: 0, fadeOut: 0, pan: 0, mode: 'oneshot', choke: 'default',
    monitoring: false, stream: null, source: null, processor: null, sink: null,
    recording: false, armed: false, chunks: [], recLen: 0, level: 0,
    preview: null, dirty: false,
  };

  // ------------------------------------------------------------------
  // IndexedDB (samples survive reloads)
  // ------------------------------------------------------------------
  const db = {
    _p: null,
    open() {
      if (this._p) return this._p;
      this._p = new Promise((resolve, reject) => {
        if (!window.indexedDB) return reject(new Error('no indexedDB'));
        const req = indexedDB.open('rhythm39', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('samples', { keyPath: 'pad' });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      return this._p;
    },
    tx(mode, fn) {
      return this.open().then(d => new Promise((resolve, reject) => {
        const t = d.transaction('samples', mode);
        const req = fn(t.objectStore('samples'));
        t.oncomplete = () => resolve(req && req.result);
        t.onerror = () => reject(t.error);
      }));
    },
    put(rec) { return this.tx('readwrite', s => s.put(rec)); },
    del(pad) { return this.tx('readwrite', s => s.delete(pad)); },
    get(pad) { return this.tx('readonly', s => s.get(pad)); },
    clear() { return this.tx('readwrite', s => s.clear()); },
    all() { return this.tx('readonly', s => s.getAll()); },
  };
  // Put a full record (from storage, the library or a move) onto a pad: engine + disk
  function assignRecord(rec) {
    engine.setSample(rec.pad, { ...rec, buffer: engine.ready ? engine.makeBuffer(rec.channels, rec.sampleRate) : null });
    if (!engine.ready) engine.pending.push(rec);
    ui.refreshPadNames(); renderTargets();
    return db.put(rec);
  }
  // Take a pad's sample off the engine and disk; returns the record (for the trash)
  async function removeRecord(pad) {
    const s = engine.samples[pad];
    const rec = s ? { ...s } : null;
    if (rec) { delete rec.buffer; if (!rec.channels && s.buffer) { rec.channels = []; for (let c = 0; c < s.buffer.numberOfChannels; c++) rec.channels.push(s.buffer.getChannelData(c).slice()); rec.sampleRate = s.buffer.sampleRate; } }
    engine.clearSample(pad);
    ui.refreshPadNames(); renderTargets();
    await db.del(pad).catch(() => {});
    return rec;
  }

  // ------------------------------------------------------------------
  // Boot: restore stored samples
  // ------------------------------------------------------------------
  db.all().then(recs => {
    (recs || []).forEach(rec => {
      if (engine.ready) engine.setSample(rec.pad, { ...rec, buffer: engine.makeBuffer(rec.channels, rec.sampleRate) });
      else { engine.samples[rec.pad] = { ...rec, buffer: null }; engine.pending.push(rec); }
    });
    ui.refreshPadNames();
    renderTargets();
  }).catch(() => { /* storage unavailable: samples just will not persist */ });

  // ------------------------------------------------------------------
  // Target pad grid
  // ------------------------------------------------------------------
  const grid = $('#in-target-grid');
  const targetEls = PADS.map((pad, i) => {
    const b = document.createElement('button');
    b.className = 'tpad';
    b.style.setProperty('--pad-color', GROUP_COLOR[pad.group]);
    b.dataset.pad = i;
    b.innerHTML = '<span class="tpad-name"></span><span class="tpad-sub"></span>';
    // Start audio first so a sample restored from storage is materialized before the
    // editor tries to load it, then select and audition
    b.addEventListener('click', () => { engine.init().then(() => { selectTarget(i); engine.trigger(i, engine.now, 0.9); }); });
    grid.appendChild(b);
    return b;
  });
  function renderTargets() {
    targetEls.forEach((b, i) => {
      const s = engine.samples[i];
      b.querySelector('.tpad-name').textContent = ui.padName(i);
      b.querySelector('.tpad-sub').textContent = s ? 'SMP' : `PAD ${i + 1}`;
      b.classList.toggle('on', i === state.target);
      b.classList.toggle('sampled', !!s);
    });
  }
  function selectTarget(i) {
    state.target = i;
    renderTargets();
    const s = engine.samples[i];
    if (s && s.buffer && !state.dirty) {
      // Load the pad's current sample back into the editor for re-trimming
      state.buffer = s.buffer; state.name = s.name;
      state.start = s.start || 0; state.end = s.end == null ? 1 : s.end;
      state.gain = s.gain == null ? 1 : s.gain; state.pitch = s.pitch || 0;
      state.fadeIn = s.fadeIn || 0; state.fadeOut = s.fadeOut || 0; state.pan = s.pan || 0;
      state.mode = s.mode || 'oneshot'; state.choke = s.choke == null ? 'default' : s.choke;
      $('#in-reverse').checked = false; // stored audio is already in its final direction
      syncKnobs(); draw(); status(`${s.name} · from pad ${i + 1}`);
    }
    $('#in-assign').textContent = `ASSIGN TO ${PADS[i] && ui.padName(i)}`;
  }
  document.addEventListener('rhythm:pads', () => {
    renderTargets();
    // Kit switch renames the pads; keep the ASSIGN label in step
    $('#in-assign').textContent = `ASSIGN TO ${ui.padName(state.target)}`;
  });

  // ------------------------------------------------------------------
  // Mic monitoring + recording
  // ------------------------------------------------------------------
  async function startMonitor() {
    if (state.monitoring) return true;
    try {
      await engine.init();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      const ctx = engine.ctx;
      state.stream = stream;
      state.source = ctx.createMediaStreamSource(stream);
      state.sink = ctx.createGain(); state.sink.gain.value = 0; // keeps the capture node alive without monitoring the mic
      // Capture on the audio thread where AudioWorklet exists; ScriptProcessor otherwise
      let node = null;
      if (ctx.audioWorklet) {
        try {
          await ctx.audioWorklet.addModule('capture-worklet.js');
          node = new AudioWorkletNode(ctx, 'rhythm-capture', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1 });
          node.port.onmessage = e => onChunk(e.data, ctx.sampleRate);
        } catch (_) { node = null; }
      }
      if (!node) {
        node = ctx.createScriptProcessor(4096, 1, 1);
        node.onaudioprocess = e => onChunk(e.inputBuffer.getChannelData(0), e.inputBuffer.sampleRate);
      }
      state.processor = node;
      state.source.connect(node).connect(state.sink).connect(ctx.destination);
      state.monitoring = true;
      status('mic live');
      return true;
    } catch (err) {
      status(`mic unavailable: ${(err && err.name) || 'error'}`);
      return false;
    }
  }
  function stopMonitor() {
    if (!state.monitoring) return;
    if (state.recording) finishRecording();
    try { state.processor.disconnect(); state.source.disconnect(); state.sink.disconnect(); } catch (_) {}
    state.stream.getTracks().forEach(t => t.stop());
    state.monitoring = false; state.level = 0;
    $('#meter-bar').style.width = '0%';
  }
  function onChunk(data, sampleRate) {
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
    const rms = Math.sqrt(sum / data.length);
    state.level = rms;
    if (!state.recording) return;
    if (state.armed) {
      if (rms < THRESHOLD) return;
      state.armed = false;
      setRecUi('recording');
    }
    state.chunks.push(new Float32Array(data));
    state.recLen += data.length;
    if (state.recLen >= MAX_SEC * sampleRate) finishRecording();
  }
  async function startRecording() {
    if (state.recording) return;
    if (!(await startMonitor())) return;
    state.chunks = []; state.recLen = 0;
    state.armed = $('#in-threshold').checked;
    state.recording = true;
    setRecUi(state.armed ? 'armed' : 'recording');
    status(state.armed ? 'waiting for signal…' : 'recording…');
  }
  function finishRecording() {
    if (!state.recording) return;
    state.recording = false; state.armed = false;
    setRecUi('idle');
    if (!state.recLen) { status('nothing recorded'); return; }
    const ctx = engine.ctx;
    const pcm = new Float32Array(state.recLen);
    let off = 0;
    state.chunks.forEach(c => { pcm.set(c, off); off += c.length; });
    state.chunks = [];
    // Normalize quiet takes a little so mic recordings sit near the synth levels
    let peak = 0; for (let i = 0; i < pcm.length; i++) peak = Math.max(peak, Math.abs(pcm[i]));
    if (peak > 0 && peak < 0.5) { const k = 0.8 / peak; for (let i = 0; i < pcm.length; i++) pcm[i] *= k; }
    state.buffer = engine.makeBuffer([pcm], ctx.sampleRate);
    state.name = `MIC ${new Date().toTimeString().slice(0, 5).replace(':', '')}`;
    state.start = 0; state.end = 1; state.gain = 1; state.pitch = 0; state.dirty = true;
      state.fadeIn = 0; state.fadeOut = 0; state.pan = 0; state.mode = 'oneshot'; state.choke = 'default';
    $('#in-reverse').checked = false;
    syncKnobs(); draw();
    status(`${state.name} · ${state.buffer.duration.toFixed(2)}s`);
  }
  function setRecUi(mode) {
    const b = $('#in-rec');
    b.classList.toggle('recording', mode === 'recording');
    b.classList.toggle('armed', mode === 'armed');
    b.querySelector('.tlabel').textContent = mode === 'idle' ? 'REC' : (mode === 'armed' ? 'WAIT' : 'REC…');
  }

  // ------------------------------------------------------------------
  // File load (picker or drop)
  // ------------------------------------------------------------------
  async function loadFile(file) {
    if (!file) return;
    try {
      await engine.init();
      const ab = await file.arrayBuffer();
      const buf = await engine.ctx.decodeAudioData(ab);
      state.buffer = buf;
      state.name = file.name.replace(/\.[^.]+$/, '').toUpperCase().slice(0, 10) || 'SAMPLE';
      state.start = 0; state.end = 1; state.gain = 1; state.pitch = 0; state.dirty = true;
      state.fadeIn = 0; state.fadeOut = 0; state.pan = 0; state.mode = 'oneshot'; state.choke = 'default';
      $('#in-reverse').checked = false;
      syncKnobs(); draw();
      status(`${state.name} · ${buf.duration.toFixed(2)}s · ${buf.numberOfChannels}ch`);
    } catch (err) {
      status(`could not decode: ${(err && err.message) || 'unknown format'}`);
    }
  }
  $('#in-file').addEventListener('change', e => { loadFile(e.target.files[0]); e.target.value = ''; });

  // Resample: bounce one pass of the current pattern (no live FX) into the editor,
  // ready to trim and assign to a pad. Shares the offline renderer with audio export
  let takeNo = 0;
  async function resample() {
    const b = $('#in-resample');
    if (b.disabled) return;
    b.disabled = true;
    status('rendering pattern…');
    try {
      const slot = R.seq.current;
      const tail = $('#in-tail').checked ? R.barSteps(slot) * (60 / R.seq.bpms[slot] / R.patBeat(slot)) : 0;
      const { buffer } = await R.renderAudio({ list: [{ slot, repeats: 1 }], tail });
      takeNo += 1;
      state.buffer = buffer;
      state.name = `LOOP ${'ABCD'[R.seq.current]} ${takeNo}`;
      state.start = 0; state.end = 1; state.gain = 1; state.pitch = 0; state.dirty = true;
      state.fadeIn = 0; state.fadeOut = 0; state.pan = 0; state.mode = 'oneshot'; state.choke = 'default';
      $('#in-reverse').checked = false;
      syncKnobs(); draw();
      status(`${state.name} · ${buffer.duration.toFixed(2)}s · pattern ${'ABCD'[R.seq.current]} bounced`);
    } catch (err) {
      status(`resample failed: ${(err && err.message) || 'unknown'}`);
    }
    b.disabled = false;
  }
  $('#in-resample').addEventListener('click', resample);
  const wrap = $('#wave-wrap');
  ['dragenter', 'dragover'].forEach(ev => wrap.addEventListener(ev, e => { e.preventDefault(); wrap.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach(ev => wrap.addEventListener(ev, e => { e.preventDefault(); wrap.classList.remove('dragover'); }));
  wrap.addEventListener('drop', e => { const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) loadFile(f); });

  // ------------------------------------------------------------------
  // Waveform
  // ------------------------------------------------------------------
  const canvas = $('#wave');
  const cx = canvas.getContext('2d');
  function draw() {
    const W = canvas.width, H = canvas.height;
    cx.clearRect(0, 0, W, H);
    wrap.classList.toggle('has-sample', !!state.buffer);
    if (!state.buffer) return;
    const data = state.buffer.getChannelData(0);
    const per = Math.max(1, Math.floor(data.length / W));
    const mid = H / 2;
    // trimmed-out regions
    cx.fillStyle = 'rgba(0,0,0,.45)';
    cx.fillRect(0, 0, state.start * W, H);
    cx.fillRect(state.end * W, 0, W - state.end * W, H);
    cx.strokeStyle = '#c8f2d0';
    cx.lineWidth = 1;
    cx.beginPath();
    for (let x = 0; x < W; x++) {
      let min = 1, max = -1;
      const base = x * per;
      for (let i = 0; i < per; i++) { const v = data[base + i]; if (v < min) min = v; if (v > max) max = v; }
      const inRange = x >= state.start * W && x <= state.end * W;
      cx.strokeStyle = inRange ? '#c8f2d0' : '#4b6b52';
      cx.beginPath();
      cx.moveTo(x + 0.5, mid + min * mid * 0.95 * state.gain);
      cx.lineTo(x + 0.5, mid + max * mid * 0.95 * state.gain);
      cx.stroke();
    }
    // fades as shaded ramps inside the kept region
    const kept = (state.end - state.start) * state.buffer.duration;
    const ramp = (secs, fromLeft) => {
      if (!secs || kept <= 0) return;
      const w = Math.min(1, secs / kept) * (state.end - state.start) * W;
      const x0 = fromLeft ? state.start * W : state.end * W;
      cx.fillStyle = 'rgba(0,0,0,.35)';
      cx.beginPath();
      if (fromLeft) { cx.moveTo(x0, 0); cx.lineTo(x0 + w, 0); cx.lineTo(x0, H); }
      else { cx.moveTo(x0, 0); cx.lineTo(x0 - w, 0); cx.lineTo(x0, H); }
      cx.closePath(); cx.fill();
    };
    ramp(state.fadeIn, true); ramp(state.fadeOut, false);
    // trim handles
    cx.fillStyle = '#ff5a1f';
    cx.fillRect(state.start * W - 1, 0, 2, H);
    cx.fillRect(state.end * W - 1, 0, 2, H);
  }

  // Tap on the waveform sets the nearest trim handle
  canvas.addEventListener('pointerdown', e => {
    if (!state.buffer) return;
    const r = canvas.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    if (Math.abs(x - state.start) <= Math.abs(x - state.end)) state.start = Math.min(x, state.end - 0.005);
    else state.end = Math.max(x, state.start + 0.005);
    state.dirty = true; syncKnobs(); draw();
  });

  // ------------------------------------------------------------------
  // Knobs
  // ------------------------------------------------------------------
  const knobs = {
    start: $('#in-start'), end: $('#in-end'), gain: $('#in-gain'), pitch: $('#in-pitch'),
    fadeIn: $('#in-fadein'), fadeOut: $('#in-fadeout'), pan: $('#in-pan'),
  };
  const MODES = ['oneshot', 'gate', 'loop'], MODE_LABEL = { oneshot: 'ONE-SHOT', gate: 'GATE', loop: 'LOOP' };
  const CHOKES = ['default', 'none', 'hat', 'A', 'B'], CHOKE_LABEL = { default: 'CHOKE: KIT', none: 'CHOKE: NONE', hat: 'CHOKE: HAT', A: 'CHOKE: A', B: 'CHOKE: B' };
  const fmtSec = frac => state.buffer ? `${(frac * state.buffer.duration).toFixed(2)}s` : '0.00s';
  function syncKnobs() {
    knobs.start.value = Math.round(state.start * 1000);
    knobs.end.value = Math.round(state.end * 1000);
    knobs.gain.value = Math.round(state.gain * 100);
    knobs.pitch.value = state.pitch;
    knobs.fadeIn.value = Math.round(state.fadeIn * 1000);
    knobs.fadeOut.value = Math.round(state.fadeOut * 1000);
    knobs.pan.value = Math.round(state.pan * 100);
    $('#in-start-out').value = fmtSec(state.start);
    $('#in-end-out').value = fmtSec(state.end);
    $('#in-gain-out').value = Math.round(state.gain * 100);
    $('#in-pitch-out').value = (state.pitch > 0 ? '+' : '') + state.pitch;
    $('#in-fadein-out').value = `${Math.round(state.fadeIn * 1000)}ms`;
    $('#in-fadeout-out').value = `${Math.round(state.fadeOut * 1000)}ms`;
    $('#in-pan-out').value = Math.abs(state.pan) < 0.005 ? 'C' : `${Math.abs(Math.round(state.pan * 100))}${state.pan < 0 ? 'L' : 'R'}`;
    $('#in-mode').textContent = MODE_LABEL[state.mode] || 'ONE-SHOT';
    $('#in-choke').textContent = CHOKE_LABEL[state.choke] || 'CHOKE: KIT';
    $('#in-assign').disabled = !state.buffer;
  }
  knobs.fadeIn.addEventListener('input', () => { state.fadeIn = +knobs.fadeIn.value / 1000; state.dirty = true; syncKnobs(); draw(); });
  knobs.fadeOut.addEventListener('input', () => { state.fadeOut = +knobs.fadeOut.value / 1000; state.dirty = true; syncKnobs(); draw(); });
  knobs.pan.addEventListener('input', () => { state.pan = +knobs.pan.value / 100; state.dirty = true; syncKnobs(); });
  $('#in-mode').addEventListener('click', () => {
    state.mode = MODES[(MODES.indexOf(state.mode) + 1) % MODES.length]; state.dirty = true; syncKnobs();
    status(state.mode === 'oneshot' ? 'one-shot: plays through' : state.mode === 'gate' ? 'gate: plays while the pad is held' : 'loop: repeats between the trim points while held');
  });
  $('#in-choke').addEventListener('click', () => {
    state.choke = CHOKES[(CHOKES.indexOf(state.choke) + 1) % CHOKES.length]; state.dirty = true; syncKnobs();
  });
  knobs.start.addEventListener('input', () => {
    state.start = Math.min(+knobs.start.value / 1000, state.end - 0.005); state.dirty = true; syncKnobs(); draw();
  });
  knobs.end.addEventListener('input', () => {
    state.end = Math.max(+knobs.end.value / 1000, state.start + 0.005); state.dirty = true; syncKnobs(); draw();
  });
  knobs.gain.addEventListener('input', () => { state.gain = +knobs.gain.value / 100; state.dirty = true; syncKnobs(); draw(); });
  knobs.pitch.addEventListener('input', () => { state.pitch = +knobs.pitch.value; state.dirty = true; syncKnobs(); });

  // Reverse flips the audio itself (and mirrors the trim points), so playback and
  // storage need no special case
  $('#in-reverse').addEventListener('change', () => {
    if (!state.buffer) { $('#in-reverse').checked = false; return; }
    const src = state.buffer;
    const out = engine.ctx.createBuffer(src.numberOfChannels, src.length, src.sampleRate);
    for (let c = 0; c < src.numberOfChannels; c++) {
      const d = src.getChannelData(c).slice(); d.reverse(); out.copyToChannel(d, c);
    }
    state.buffer = out;
    const s = state.start, e = state.end;
    state.start = 1 - e; state.end = 1 - s;
    state.dirty = true; syncKnobs(); draw();
    status(`${state.name} · ${$('#in-reverse').checked ? 'reversed' : 'forward'}`);
  });
  Object.values(knobs).forEach(r => r.addEventListener('wheel', e => {
    e.preventDefault();
    const dir = e.deltaY < 0 ? 1 : -1;
    const stepSize = r === knobs.pitch ? 1 : (e.shiftKey ? 50 : 10);
    r.value = Math.min(+r.max, Math.max(+r.min, +r.value + dir * stepSize));
    r.dispatchEvent(new Event('input', { bubbles: true }));
  }, { passive: false }));

  // ------------------------------------------------------------------
  // Transport + actions
  // ------------------------------------------------------------------
  $('#in-rec').addEventListener('click', e => (e.shiftKey ? resample() : startRecording()));
  // TEST TONE: a click through the speaker, to hear that output still works after the mic opens
  $('#in-tone').addEventListener('click', () => { engine.init().then(() => { engine.click(engine.now, true); status('test tone'); }); });
  $('#in-stop').addEventListener('click', () => { if (state.recording) finishRecording(); else { engine.release(-2); if (state.preview) { try { state.preview.stop(); } catch (_) {} } } });
  $('#in-play').addEventListener('click', () => {
    if (!state.buffer) return;
    engine.init().then(() => {
      if (state.preview) { try { state.preview.stop(); } catch (_) {} }
      state.preview = engine.previewSample(current());
    });
  });
  const extras = () => ({ fadeIn: state.fadeIn, fadeOut: state.fadeOut, pan: state.pan, mode: state.mode, choke: state.choke === 'default' ? undefined : state.choke });
  const current = () => ({ buffer: state.buffer, name: state.name, start: state.start, end: state.end, gain: state.gain, pitch: state.pitch, ...extras() });

  $('#in-assign').addEventListener('click', () => {
    if (!state.buffer) return;
    // Crop to the trimmed region so a long file does not fill IndexedDB
    if ($('#in-crop').checked && (state.start > 0.0005 || state.end < 0.9995)) {
      const src = state.buffer, a = Math.floor(state.start * src.length), b = Math.max(a + 1, Math.floor(state.end * src.length));
      const out = engine.ctx.createBuffer(src.numberOfChannels, b - a, src.sampleRate);
      for (let c = 0; c < src.numberOfChannels; c++) out.copyToChannel(src.getChannelData(c).slice(a, b), c);
      state.buffer = out; state.start = 0; state.end = 1;
      syncKnobs(); draw();
    }
    const buf = state.buffer;
    const channels = [];
    for (let c = 0; c < buf.numberOfChannels; c++) channels.push(buf.getChannelData(c).slice());
    const rec = { pad: state.target, name: state.name, sampleRate: buf.sampleRate, channels,
      start: state.start, end: state.end, gain: state.gain, pitch: state.pitch, ...extras() };
    engine.setSample(state.target, { ...rec, buffer: buf });
    state.dirty = false;
    ui.refreshPadNames(); renderTargets();
    db.put(rec).then(() => lcd(`${state.name} → pad ${state.target + 1} (saved)`))
      .catch(() => lcd(`${state.name} → pad ${state.target + 1} (not saved)`));
    status(`assigned to ${PADS[state.target].name} pad`);
  });
  $('#in-revert').addEventListener('click', () => {
    engine.clearSample(state.target);
    ui.refreshPadNames(); renderTargets();
    db.del(state.target).catch(() => {});
    lcd(`pad ${state.target + 1} back to ${PADS[state.target].name}`);
  });
  $('#in-clear').addEventListener('click', () => {
    state.buffer = null; state.name = ''; state.start = 0; state.end = 1; state.gain = 1; state.pitch = 0; state.dirty = false;
    state.fadeIn = 0; state.fadeOut = 0; state.pan = 0; state.mode = 'oneshot'; state.choke = 'default';
    syncKnobs(); draw(); status('no sample loaded');
  });
  function clearAll() {
    PADS.forEach((_, i) => engine.clearSample(i));
    ui.refreshPadNames(); renderTargets();
    db.clear().catch(() => {});
    lcd('all samples cleared');
  }

  function status(msg) { $('#in-status').textContent = msg; }

  // Meter animation while the input view is open
  function meterLoop() {
    if (ui.view === 'input') {
      const pct = Math.min(100, Math.round(Math.sqrt(state.level) * 130));
      $('#meter-bar').style.width = `${pct}%`;
    }
    requestAnimationFrame(meterLoop);
  }
  requestAnimationFrame(meterLoop);

  // Release the mic when leaving the input view
  document.addEventListener('rhythm:view', e => {
    if (e.detail.view !== 'input') stopMonitor();
  });

  selectTarget(state.target);
  syncKnobs(); draw();
  // Load a stored record into the editor (library LOAD)
  function loadRecord(rec) {
    engine.init().then(() => {
      state.buffer = engine.makeBuffer(rec.channels, rec.sampleRate); state.name = rec.name;
      state.start = rec.start || 0; state.end = rec.end == null ? 1 : rec.end;
      state.gain = rec.gain == null ? 1 : rec.gain; state.pitch = rec.pitch || 0;
      state.fadeIn = rec.fadeIn || 0; state.fadeOut = rec.fadeOut || 0; state.pan = rec.pan || 0;
      state.mode = rec.mode || 'oneshot'; state.choke = rec.choke == null ? 'default' : rec.choke;
      state.dirty = true; state.target = rec.pad; renderTargets();
      $('#in-reverse').checked = false;
      $('#in-assign').textContent = `ASSIGN TO ${ui.padName(rec.pad)}`;
      syncKnobs(); draw(); status(`${rec.name} · from the library`);
    });
  }
  R.sampler = { state, startMonitor, stopMonitor, startRecording, finishRecording, loadFile, clearAll, selectTarget, db, assignRecord, removeRecord, loadRecord };
})();
