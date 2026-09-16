/* Rhythm-39 · sample library (Settings): every stored sample with its pad, length and
   size, plus LOAD, MOVE, RENAME and DELETE. Deleted samples sit in a session trash
   and can be restored until the page is closed. Depends on app.js and sampler.js. */
(() => {
  'use strict';
  const R = window.rhythm;
  if (!R || !R.sampler) return;
  const { engine, ui, PADS, lcd, sampler } = R;
  const $ = s => document.querySelector(s);
  const trash = []; // { rec, at }
  let moving = -1;  // pad whose MOVE picker is open

  const kb = n => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);
  const recSize = s => (s.channels ? s.channels.reduce((n, c) => n + c.length * 4, 0) : (s.buffer ? s.buffer.length * s.buffer.numberOfChannels * 4 : 0));
  const recLen = s => (s.buffer ? s.buffer.duration : (s.channels && s.sampleRate ? s.channels[0].length / s.sampleRate : 0));

  function render() {
    const rows = $('#lib-rows');
    const items = PADS.map((_, i) => engine.samples[i] ? { pad: i, s: engine.samples[i] } : null).filter(Boolean);
    rows.innerHTML = items.length ? items.map(({ pad, s }) => `
      <div class="lib-row" data-pad="${pad}">
        <button class="lib-name" title="Rename">${s.name || 'SAMPLE'}</button>
        <span class="lib-meta">pad ${pad + 1} · ${recLen(s).toFixed(2)}s · ${kb(recSize(s))}${s.mode && s.mode !== 'oneshot' ? ` · ${s.mode}` : ''}</span>
        <span class="lib-btns">
          <button class="mini txt lib-load" title="Load into the INPUT editor">LOAD</button>
          <button class="mini txt lib-move" title="Move to another pad">MOVE</button>
          <button class="mini txt lib-del" title="Move to the trash (restorable this session)">DELETE</button>
        </span>
        ${moving === pad ? `<div class="lib-picker">${PADS.map((__, j) => j === pad ? '' : `<button class="mini txt lib-pick" data-to="${j}" title="${ui.padName(j)}">${j + 1}${engine.samples[j] ? '*' : ''}</button>`).join('')}<span class="lib-hint">* pad already holds a sample (it goes to the trash)</span></div>` : ''}
      </div>`).join('') : '<p class="in-note">No samples stored. Record or load one in INPUT and ASSIGN it to a pad.</p>';
    const total = items.reduce((n, x) => n + recSize(x.s), 0);
    $('#lib-count').textContent = `${items.length} sample${items.length === 1 ? '' : 's'} · ${kb(total)}`;
    const tr = $('#lib-trash');
    tr.hidden = !trash.length;
    if (trash.length) {
      $('#lib-trash-rows').innerHTML = trash.map((t, i) => `<div class="lib-row"><span class="lib-name">${t.rec.name}</span><span class="lib-meta">was pad ${t.rec.pad + 1} · ${kb(recSize(t.rec))}</span><span class="lib-btns"><button class="mini txt lib-restore" data-i="${i}">RESTORE</button></span></div>`).join('');
    }
  }

  async function storageLine() {
    const el = $('#lib-storage');
    try {
      if (!navigator.storage || !navigator.storage.estimate) { el.textContent = ''; return; }
      const { usage, quota } = await navigator.storage.estimate();
      // Quotas are browser-specific and often huge; only quote one under 1 GB
      el.textContent = `${kb(usage || 0)} used by this site${quota && quota < 1073741824 ? ` of about ${kb(quota)}` : ''}.`;
    } catch (_) { el.textContent = ''; }
  }

  $('#lib-rows').addEventListener('click', async e => {
    const row = e.target.closest('.lib-row'); if (!row) return;
    const pad = +row.dataset.pad, s = engine.samples[pad];
    if (e.target.closest('.lib-load')) { sampler.loadRecord({ ...s, pad }); ui.setView('input'); return; }
    if (e.target.closest('.lib-move')) { moving = moving === pad ? -1 : pad; render(); return; }
    if (e.target.closest('.lib-pick')) {
      const to = +e.target.closest('.lib-pick').dataset.to;
      const rec = await sampler.removeRecord(pad);
      if (engine.samples[to]) { const old = await sampler.removeRecord(to); if (old) trash.push({ rec: old, at: Date.now() }); }
      if (rec) await sampler.assignRecord({ ...rec, pad: to }).catch(() => {});
      moving = -1; render(); lcd(`${rec ? rec.name : 'sample'} moved to pad ${to + 1}`);
      return;
    }
    if (e.target.closest('.lib-del')) {
      const rec = await sampler.removeRecord(pad);
      if (rec) trash.push({ rec, at: Date.now() });
      render(); lcd(`${rec ? rec.name : 'sample'} moved to trash`);
      return;
    }
    if (e.target.closest('.lib-name')) {
      const name = window.prompt('Sample name (up to 10 characters):', s.name || '');
      if (name == null) return;
      const clean = name.trim().toUpperCase().slice(0, 10) || s.name;
      const rec = await sampler.removeRecord(pad);
      if (rec) await sampler.assignRecord({ ...rec, name: clean }).catch(() => {});
      render(); lcd(`renamed to ${clean}`);
    }
  });
  $('#lib-trash-rows').addEventListener('click', async e => {
    const b = e.target.closest('.lib-restore'); if (!b) return;
    const t = trash.splice(+b.dataset.i, 1)[0]; if (!t) return;
    const pad = t.rec.pad;
    if (engine.samples[pad]) { const old = await sampler.removeRecord(pad); if (old) trash.push({ rec: old, at: Date.now() }); }
    await sampler.assignRecord(t.rec).catch(() => {});
    render(); lcd(`${t.rec.name} restored to pad ${pad + 1}`);
  });
  $('#lib-empty-trash').addEventListener('click', () => { trash.length = 0; render(); lcd('trash emptied'); });

  document.addEventListener('rhythm:pads', render);
  document.addEventListener('rhythm:view', e => { if (e.detail.view === 'settings') { render(); storageLine(); } });
  render(); storageLine();
  R.library = { render, trash };
})();
