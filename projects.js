/* Rhythm-39 · named projects (Settings). Every project is a record in IndexedDB
   { id, name, modified, data } where data is what EXPORT writes. The current
   project autosaves whenever the sequencer saves; localStorage keeps only the
   working copy and the current id, so a broken record never blocks boot. Depends
   on app.js. */
(() => {
  'use strict';
  const R = window.rhythm;
  if (!R) return;
  const { seq, ui, lcd, project } = R;
  const $ = s => document.querySelector(s);
  const CUR_KEY = 'rhythm39.project';
  const trash = [];
  let current = null;   // current record { id, name, modified, data }
  let available = true; // IndexedDB usable
  let saveTimer = null;

  const db = {
    _p: null,
    open() {
      if (this._p) return this._p;
      this._p = new Promise((resolve, reject) => {
        if (!window.indexedDB) return reject(new Error('no indexedDB'));
        const req = indexedDB.open('rhythm39-projects', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('projects', { keyPath: 'id', autoIncrement: true });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      return this._p;
    },
    tx(mode, fn) {
      return this.open().then(d => new Promise((resolve, reject) => {
        const t = d.transaction('projects', mode);
        const req = fn(t.objectStore('projects'));
        t.oncomplete = () => resolve(req && req.result);
        t.onerror = () => reject(t.error);
      }));
    },
    put(rec) { return this.tx('readwrite', s => s.put(rec)); },
    add(rec) { return this.tx('readwrite', s => s.add(rec)); },
    del(id) { return this.tx('readwrite', s => s.delete(id)); },
    get(id) { return this.tx('readonly', s => s.get(id)); },
    all() { return this.tx('readonly', s => s.getAll()); },
  };

  const fmtDate = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const setCurrentId = id => { try { localStorage.setItem(CUR_KEY, String(id)); } catch (_) {} };
  const getCurrentId = () => { try { const v = +localStorage.getItem(CUR_KEY); return Number.isFinite(v) && v > 0 ? v : null; } catch (_) { return null; } };
  const snapshot = () => JSON.parse(JSON.stringify(project.data()));
  const nextName = recs => {
    const used = new Set(recs.map(r => r.name));
    for (let i = 1; i < 1000; i++) { const n = `PROJECT ${i}`; if (!used.has(n)) return n; }
    return `PROJECT ${Date.now()}`;
  };

  async function createFromCurrent(name) {
    const rec = { name, modified: Date.now(), data: snapshot() };
    rec.id = await db.add(rec);
    current = rec; setCurrentId(rec.id);
    return rec;
  }
  // Autosave: every sequencer save lands in the current record after a second of quiet
  document.addEventListener('rhythm:saved', () => {
    if (!available || !current) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      current.data = snapshot(); current.modified = Date.now();
      db.put(current).then(() => render()).catch(() => {});
    }, 1000);
  });

  // Draw pattern A of a project as a tiny grid: pads down, steps across
  function thumb(canvas, data) {
    const cx = canvas.getContext('2d');
    const pat = data && data.patterns && data.patterns[0];
    cx.clearRect(0, 0, canvas.width, canvas.height);
    if (!pat) return;
    const len = Math.max(1, (pat[0] || []).length), rows = pat.length;
    const w = canvas.width / len, h = canvas.height / rows;
    cx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#ff5a1f';
    pat.forEach((row, p) => row.forEach((v, s) => { const l = v && typeof v === 'object' ? v.l : v; if (l) { cx.globalAlpha = l > 1 ? 1 : 0.6; cx.fillRect(s * w + 0.5, p * h + 0.5, Math.max(1, w - 1), Math.max(1, h - 1)); } }));
    cx.globalAlpha = 1;
  }

  async function render() {
    const list = $('#proj-rows');
    if (!available) { list.innerHTML = '<p class="in-note">Named projects need IndexedDB, which this browser blocks here (private mode?). The working project still autosaves.</p>'; $('#proj-current').textContent = 'working copy'; return; }
    let recs = [];
    try { recs = await db.all(); } catch (_) { available = false; return render(); }
    recs.sort((a, b) => b.modified - a.modified);
    $('#proj-current').textContent = current ? current.name : '…';
    list.innerHTML = recs.map(r => `
      <div class="lib-row proj-row ${current && r.id === current.id ? 'cur' : ''}" data-id="${r.id}">
        <canvas class="proj-thumb" width="48" height="24" aria-hidden="true"></canvas>
        <button class="lib-name" title="Rename">${r.name}</button>
        <span class="lib-meta">${fmtDate(r.modified)} · ${r.data && r.data.bpms ? r.data.bpms[r.data.current || 0] : (r.data && r.data.bpm) || '?'} bpm${current && r.id === current.id ? ' · open' : ''}</span>
        <span class="lib-btns">
          ${current && r.id === current.id ? '' : '<button class="mini txt proj-load">LOAD</button>'}
          <button class="mini txt proj-dup" title="Copy this project">DUPLICATE</button>
          <button class="mini txt proj-del" title="Move to the trash (restorable this session)">DELETE</button>
        </span>
      </div>`).join('');
    list.querySelectorAll('.proj-row').forEach(row => { const r = recs.find(x => x.id === +row.dataset.id); thumb(row.querySelector('.proj-thumb'), r && r.data); });
    const tr = $('#proj-trash');
    tr.hidden = !trash.length;
    if (trash.length) $('#proj-trash-rows').innerHTML = trash.map((t, i) => `<div class="lib-row"><span class="lib-name">${t.name}</span><span class="lib-meta">${fmtDate(t.modified)}</span><span class="lib-btns"><button class="mini txt proj-restore" data-i="${i}">RESTORE</button></span></div>`).join('');
  }

  async function flushCurrent() {
    clearTimeout(saveTimer);
    if (current) { current.data = snapshot(); current.modified = Date.now(); await db.put(current).catch(() => {}); }
  }
  async function loadRecord(rec) {
    await flushCurrent();
    current = rec; setCurrentId(rec.id);
    R.history.push();
    project.apply(rec.data);
    lcd(`project ${rec.name}`);
    render();
  }

  $('#proj-new').addEventListener('click', async () => {
    await flushCurrent();
    const recs = await db.all().catch(() => []);
    const name = nextName(recs);
    // A new project starts from the demos, in a fresh record
    project.seedDemo();
    current = null;
    await createFromCurrent(name);
    lcd(`new project ${name}`); render();
  });
  $('#proj-rows').addEventListener('click', async e => {
    const row = e.target.closest('.proj-row'); if (!row) return;
    const id = +row.dataset.id;
    const rec = await db.get(id).catch(() => null); if (!rec) return;
    if (e.target.closest('.proj-load')) { loadRecord(rec); return; }
    if (e.target.closest('.proj-dup')) {
      await flushCurrent();
      const recs = await db.all().catch(() => []);
      const copy = { name: `${rec.name} COPY`.slice(0, 24), modified: Date.now(), data: JSON.parse(JSON.stringify(current && rec.id === current.id ? snapshot() : rec.data)) };
      if (recs.some(r => r.name === copy.name)) copy.name = nextName(recs);
      copy.id = await db.add(copy);
      lcd(`duplicated as ${copy.name}`); render();
      return;
    }
    if (e.target.closest('.proj-del')) {
      await db.del(id).catch(() => {});
      trash.push(rec);
      if (current && current.id === id) {
        // Deleting the open project: open the most recent other one, or start fresh
        current = null;
        const recs = (await db.all().catch(() => [])).sort((a, b) => b.modified - a.modified);
        if (recs.length) { current = recs[0]; setCurrentId(current.id); R.history.push(); project.apply(current.data); lcd(`project ${current.name}`); }
        else { project.seedDemo(); await createFromCurrent('PROJECT 1'); lcd('new project'); }
      } else lcd(`${rec.name} moved to trash`);
      render();
      return;
    }
    if (e.target.closest('.lib-name')) {
      const name = window.prompt('Project name:', rec.name);
      if (name == null) return;
      rec.name = (name.trim() || rec.name).slice(0, 24);
      if (current && current.id === rec.id) current.name = rec.name;
      await db.put(rec).catch(() => {});
      render();
    }
  });
  $('#proj-trash-rows').addEventListener('click', async e => {
    const b = e.target.closest('.proj-restore'); if (!b) return;
    const rec = trash.splice(+b.dataset.i, 1)[0]; if (!rec) return;
    delete rec.id;
    rec.id = await db.add(rec).catch(() => null);
    lcd(`${rec.name} restored`); render();
  });
  $('#proj-empty-trash').addEventListener('click', () => { trash.length = 0; render(); });
  $('#proj-current').addEventListener('click', () => { if (current) { const row = $(`.proj-row[data-id="${current.id}"] .lib-name`); if (row) row.click(); } });

  // Boot: adopt the working copy as a project, or reopen the last one
  (async () => {
    try {
      let recs = await db.all();
      const curId = getCurrentId();
      const found = curId != null ? recs.find(r => r.id === curId) : null;
      if (project.fromLink) {
        // A share link opens as its own project, leaving the previous one intact
        await createFromCurrent(`SHARED ${fmtDate(Date.now()).slice(5, 16)}`);
      } else if (found) {
        current = found;
        if (project.fresh) { project.apply(found.data); lcd(`project ${found.name}`); }
      } else if (recs.length) {
        recs.sort((a, b) => b.modified - a.modified);
        if (project.fresh) { current = recs[0]; setCurrentId(current.id); project.apply(current.data); lcd(`project ${current.name}`); }
        else await createFromCurrent(nextName(recs));
      } else {
        await createFromCurrent('PROJECT 1');
      }
    } catch (_) { available = false; }
    render();
  })();
  document.addEventListener('rhythm:view', e => { if (e.detail.view === 'settings') render(); });
  R.projects = { render, trash, get current() { return current; } };
})();
