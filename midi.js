/* Rhythm-39 · MIDI in and out (Web MIDI, Chrome and Edge). Notes from a controller
   play the pads (LEARN maps them), incoming clock can drive the tempo, and the app
   can send 24 ppqn clock, start / stop and pad notes to hardware. Depends on app.js. */
(() => {
  'use strict';
  const R = window.rhythm;
  if (!R) return;
  const { seq, ui, engine, PADS, lcd, hitPad } = R;
  const $ = s => document.querySelector(s);
  const KEY = 'rhythm39.midi';
  const supported = !!navigator.requestMIDIAccess;
  // GM drum notes 36..51 on the pads, bottom row first: 36 = pad 13 (KICK) ... 51 = pad 4
  const defaultMap = () => { const m = {}; for (let n = 36; n < 52; n++) { const i = n - 36; m[n] = 12 - 4 * Math.floor(i / 4) + (i % 4); } return m; };
  const st = { on: false, inId: '', outId: '', channel: 10, map: defaultMap(), syncIn: false, clockOut: false, notesOut: true };
  try { Object.assign(st, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (_) {}
  if (!st.map || typeof st.map !== 'object') st.map = defaultMap();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (_) {} };

  let access = null, input = null, output = null, learnPad = -1;
  const clock = { times: [], last: 0 };

  function status(msg) { $('#midi-status').textContent = msg; }
  function fillPorts() {
    const inSel = $('#midi-in'), outSel = $('#midi-out');
    const opts = (ports, cur) => `<option value="">none</option>` + [...ports.values()].map(p => `<option value="${p.id}" ${p.id === cur ? 'selected' : ''}>${p.name || p.id}</option>`).join('');
    inSel.innerHTML = opts(access ? access.inputs : new Map(), st.inId);
    outSel.innerHTML = opts(access ? access.outputs : new Map(), st.outId);
  }
  function bindPorts() {
    if (input) input.onmidimessage = null;
    input = access && st.inId ? access.inputs.get(st.inId) : null;
    if (input) input.onmidimessage = onMessage;
    output = access && st.outId ? access.outputs.get(st.outId) : null;
    status(`${input ? `in: ${input.name}` : 'no input'} · ${output ? `out: ${output.name}` : 'no output'}`);
  }
  async function enable() {
    if (!supported) { status('Web MIDI is not available in this browser (Chrome and Edge have it).'); return; }
    try {
      access = await navigator.requestMIDIAccess({ sysex: false });
      access.onstatechange = () => { fillPorts(); bindPorts(); };
      st.on = true; save();
      fillPorts(); bindPorts();
      $('#midi-enable').textContent = 'MIDI ON';
      if (!st.inId && access.inputs.size) { st.inId = [...access.inputs.keys()][0]; save(); fillPorts(); bindPorts(); }
    } catch (err) { status(`MIDI access refused: ${(err && err.message) || err}`); }
  }

  // ---- input ----
  function onMessage(e) {
    const [s, d1, d2] = e.data;
    const type = s & 0xf0;
    if (s === 0xf8) { onClockPulse(e.timeStamp); return; }
    if (s === 0xfa || s === 0xfb) { if (st.syncIn && !seq.playing) R.play(); return; }
    if (s === 0xfc) { if (st.syncIn && seq.playing) R.stop(); return; }
    if (type === 0x90 && d2 > 0) {
      if (learnPad >= 0) {
        Object.keys(st.map).forEach(n => { if (st.map[n] === learnPad) delete st.map[n]; });
        st.map[d1] = learnPad; save();
        lcd(`note ${d1} → pad ${learnPad + 1}`); learnPad = -1; renderLearn();
        return;
      }
      const pad = st.map[d1];
      if (pad == null) return;
      seq.heldPads.add(pad);
      hitPad(pad, d2 >= 64 ? 2 : 1);
      return;
    }
    if (type === 0x80 || (type === 0x90 && d2 === 0)) {
      const pad = st.map[d1];
      if (pad != null) { seq.heldPads.delete(pad); engine.release(pad); }
    }
  }
  // Incoming clock: 24 pulses per quarter; average the last 24 gaps and smooth
  function onClockPulse(t) {
    if (!st.syncIn) return;
    clock.times.push(t);
    if (clock.times.length > 25) clock.times.shift();
    if (clock.times.length < 25) return;
    const span = clock.times[24] - clock.times[0]; // 24 gaps = one beat, in ms
    if (span <= 0) return;
    const bpm = 60000 / span;
    if (!Number.isFinite(bpm) || bpm < 40 || bpm > 240) return;
    const smooth = clock.last ? clock.last * 0.7 + bpm * 0.3 : bpm;
    clock.last = smooth;
    if (Math.abs(Math.round(smooth) - seq.bpm) >= 1) ui.setBpm(Math.round(smooth));
  }

  // ---- output ----
  // Audio-clock time -> Web MIDI timestamp (DOMHighResTimeStamp, ms)
  const toPerf = t => performance.now() + (t - engine.now) * 1000;
  seq.onStep = (step, t, dur) => {
    if (!output || !st.clockOut) return;
    const per = R.patBeat() === 3 ? 8 : 6; // 24 ppqn spread across the step
    for (let k = 0; k < per; k++) { try { output.send([0xf8], toPerf(t + (k * dur) / per)); } catch (_) {} }
  };
  engine.onNote = (pad, t, vel) => {
    if (!output || !st.notesOut) return;
    const note = Object.keys(st.map).find(n => st.map[n] === pad);
    if (note == null) return;
    const ch = (st.channel - 1) & 0x0f, v = Math.min(127, Math.round(vel * 100));
    try { output.send([0x90 | ch, +note, v], toPerf(t)); output.send([0x80 | ch, +note, 0], toPerf(t) + 60); } catch (_) {}
  };
  // Transport messages ride on the play state
  let wasPlaying = false;
  setInterval(() => {
    if (!output || !st.clockOut) { wasPlaying = seq.playing; return; }
    if (seq.playing && !wasPlaying) { try { output.send([0xfa]); } catch (_) {} }
    if (!seq.playing && wasPlaying) { try { output.send([0xfc]); } catch (_) {} }
    wasPlaying = seq.playing;
  }, 50);

  // ---- settings UI ----
  function renderLearn() {
    const grid = $('#midi-learn-grid');
    grid.innerHTML = PADS.map((p, i) => {
      const note = Object.keys(st.map).find(n => st.map[n] === i);
      return `<button class="mini txt midi-learn ${learnPad === i ? 'on' : ''}" data-pad="${i}" title="Click, then hit a controller pad">${i + 1}<small>${note == null ? '–' : note}</small></button>`;
    }).join('');
    $('#midi-learn-hint').textContent = learnPad >= 0 ? `hit a controller pad for pad ${learnPad + 1}` : '';
  }
  $('#midi-enable').addEventListener('click', () => { if (st.on && access) { st.on = false; save(); if (input) input.onmidimessage = null; input = output = null; $('#midi-enable').textContent = 'ENABLE MIDI'; status('MIDI off'); } else enable(); });
  $('#midi-in').addEventListener('change', e => { st.inId = e.target.value; save(); bindPorts(); });
  $('#midi-out').addEventListener('change', e => { st.outId = e.target.value; save(); bindPorts(); });
  $('#midi-channel').addEventListener('change', e => { st.channel = Math.max(1, Math.min(16, +e.target.value || 10)); save(); });
  const bindToggle = (id, key) => { const el = $(id); el.checked = !!st[key]; el.addEventListener('change', () => { st[key] = el.checked; save(); }); };
  bindToggle('#midi-sync', 'syncIn'); bindToggle('#midi-clockout', 'clockOut'); bindToggle('#midi-notesout', 'notesOut');
  $('#midi-channel').value = st.channel;
  $('#midi-learn-grid').addEventListener('click', e => { const b = e.target.closest('.midi-learn'); if (!b) return; learnPad = learnPad === +b.dataset.pad ? -1 : +b.dataset.pad; renderLearn(); });
  $('#midi-reset').addEventListener('click', () => { st.map = defaultMap(); learnPad = -1; save(); renderLearn(); lcd('midi map reset'); });
  renderLearn();
  if (!supported) status('Web MIDI is not available in this browser (Chrome and Edge have it).');
  else if (st.on) enable(); else status('off');
  R.midi = { state: st, onMessage, defaultMap, enable };
})();
