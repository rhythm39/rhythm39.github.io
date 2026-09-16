/* Rhythm-39 · MIXER view: sixteen strips (level, pan, delay send, spring send,
   mute, solo) for the current pattern slot. Data lives in seq.mix[slot][pad] and
   seq.mutes / seq.solo in app.js; this file only draws and edits. Depends on app.js. */
(() => {
  'use strict';
  const R = window.rhythm;
  if (!R) return;
  const { seq, ui, PADS, KITS, lcd, mix } = R;
  const $ = s => document.querySelector(s);
  const GROUP_COLOR = { drum: 'var(--pad-drum)', perc: 'var(--pad-perc)', bass: 'var(--pad-bass)', fx: 'var(--pad-fx)' };

  const KNOBS = [
    { key: 'lvl', label: 'LVL', min: 0, max: 150, to: v => Math.round(v * 100), from: v => v / 100, fmt: v => `${Math.round(v * 100)}` },
    { key: 'pan', label: 'PAN', min: -100, max: 100, to: v => Math.round(v * 100), from: v => v / 100, fmt: v => (Math.abs(v) < 0.005 ? 'C' : `${Math.abs(Math.round(v * 100))}${v < 0 ? 'L' : 'R'}`) },
    { key: 'a', label: 'DLY', min: 0, max: 100, to: v => Math.round(v * 100), from: v => v / 100, fmt: v => `${Math.round(v * 100)}` },
    { key: 'b', label: 'VRB', min: 0, max: 100, to: v => Math.round(v * 100), from: v => v / 100, fmt: v => `${Math.round(v * 100)}` },
  ];

  const grid = $('#mixer-grid');
  const strips = PADS.map((pad, i) => {
    const el = document.createElement('div');
    el.className = 'strip';
    el.style.setProperty('--pad-color', GROUP_COLOR[pad.group]);
    el.innerHTML = `
      <div class="strip-head"><span class="strip-name"></span><span class="strip-num">${i + 1}</span></div>
      <div class="strip-btns">
        <button class="mini txt strip-mute" title="Mute">M</button>
        <button class="mini txt strip-solo" title="Solo (Shift adds to the current solo)">S</button>
        <button class="mini txt strip-reset" title="Reset this strip to the kit defaults">R</button>
      </div>
      ${KNOBS.map(k => `<label class="strip-knob"><span>${k.label}</span><input type="range" min="${k.min}" max="${k.max}" data-key="${k.key}" aria-label="Pad ${i + 1} ${k.label}"><output></output></label>`).join('')}`;
    el.querySelector('.strip-mute').addEventListener('click', () => mix.toggleMute(i));
    el.querySelector('.strip-solo').addEventListener('click', e => mix.toggleSolo(i, e.shiftKey));
    el.querySelector('.strip-reset').addEventListener('click', () => {
      R.history.push();
      seq.mix[seq.current][i] = mix.defaults(seq.current, i);
      mix.changed(); lcd(`${ui.padName(i)} strip reset`);
    });
    el.querySelectorAll('input[type=range]').forEach(inp => {
      const k = KNOBS.find(x => x.key === inp.dataset.key);
      // One undo step per slider gesture (the snapshot is taken before the first change)
      inp.addEventListener('pointerdown', () => R.history.push());
      inp.addEventListener('keydown', () => R.history.push());
      inp.addEventListener('input', () => {
        const st = seq.mix[seq.current][i];
        st[k.key] = k.from(+inp.value);
        inp.nextElementSibling.value = k.fmt(st[k.key]);
        el.classList.toggle('changed', !mix.isDefault(st, seq.current, i));
        R.saveSoon();
      });
      // Double-click a knob to return that one value to the kit default
      inp.addEventListener('dblclick', () => {
        R.history.push();
        seq.mix[seq.current][i][k.key] = mix.defaults(seq.current, i)[k.key];
        mix.changed();
      });
      // Wheel nudges (app.js only wires the wheel for sliders that exist at boot)
      inp.addEventListener('wheel', e => {
        e.preventDefault();
        inp.value = Math.min(+inp.max, Math.max(+inp.min, +inp.value + (e.deltaY < 0 ? 1 : -1) * (e.shiftKey ? 10 : 2)));
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      }, { passive: false });
    });
    // Tap the name to audition the pad with its strip settings
    el.querySelector('.strip-head').addEventListener('click', () => { R.engine.init().then(() => R.engine.trigger(i, R.engine.now, 0.9, seq.mix[seq.current][i])); });
    grid.appendChild(el);
    return el;
  });

  function render() {
    const slot = seq.current, solo = seq.solo.some(Boolean);
    $('#mixer-slot').textContent = `${'ABCD'[slot]} · ${R.kitOf(slot).name}`;
    strips.forEach((el, i) => {
      const st = seq.mix[slot][i];
      el.querySelector('.strip-name').textContent = ui.padName(i);
      el.querySelector('.strip-mute').classList.toggle('on', !!seq.mutes[i]);
      el.querySelector('.strip-solo').classList.toggle('on', !!seq.solo[i]);
      el.classList.toggle('silent', !!seq.mutes[i] || (solo && !seq.solo[i]));
      el.classList.toggle('changed', !mix.isDefault(st, slot, i));
      el.querySelectorAll('input[type=range]').forEach(inp => {
        const k = KNOBS.find(x => x.key === inp.dataset.key);
        inp.value = k.to(st[k.key]);
        inp.nextElementSibling.value = k.fmt(st[k.key]);
      });
    });
  }
  $('#mixer-copy').addEventListener('click', () => {
    R.mixClipboard = JSON.parse(JSON.stringify(seq.mix[seq.current]));
    $('#mixer-paste').disabled = false;
    lcd(`mix ${'ABCD'[seq.current]} copied`);
  });
  $('#mixer-paste').addEventListener('click', () => {
    if (!R.mixClipboard) return;
    R.history.push();
    seq.mix[seq.current] = JSON.parse(JSON.stringify(R.mixClipboard));
    mix.changed(); lcd(`mix pasted into ${'ABCD'[seq.current]}`);
  });
  $('#mixer-reset').addEventListener('click', () => {
    R.history.push();
    seq.mix[seq.current] = PADS.map((_, i) => mix.defaults(seq.current, i));
    seq.solo = PADS.map(() => false);
    ui.renderMutes(); mix.changed(); lcd(`mix ${'ABCD'[seq.current]} reset`);
  });
  $('#mixer-clear-solo').addEventListener('click', () => { seq.solo = PADS.map(() => false); ui.renderMutes(); R.saveSoon(); lcd('solo cleared'); });

  document.addEventListener('rhythm:mix', render);
  document.addEventListener('rhythm:pads', render);
  document.addEventListener('rhythm:view', e => { if (e.detail.view === 'mixer') render(); });
  render();
  R.mixerUi = { render };
})();
