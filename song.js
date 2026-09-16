/* Rhythm-39 · SONG row: the chip list under the transport that arranges the four
   pattern slots into a track. Playback logic lives in app.js (seq.song); this file
   only draws and edits the list. Depends on app.js. */
(() => {
  'use strict';
  const R = window.rhythm;
  if (!R) return;
  const { seq, lcd, song } = R;
  const $ = s => document.querySelector(s);

  let selected = -1; // chip being edited, -1 = none

  const chipsEl = $('#song-chips');
  const editEl = $('#song-edit');

  function render() {
    const list = seq.song.list;
    if (selected >= list.length) selected = -1;
    chipsEl.innerHTML = list.map((e, i) => {
      const cls = ['chip'];
      if (i === selected) cls.push('sel');
      if (seq.playing && seq.song.on && i === seq.song.pos) cls.push('playing');
      if (song.isEmptySlot(e.slot)) cls.push('empty');
      return `<button class="${cls.join(' ')}" data-i="${i}" title="Entry ${i + 1}: pattern ${'ABCD'[e.slot]} ${e.repeats} time${e.repeats > 1 ? 's' : ''}${song.isEmptySlot(e.slot) ? ' (slot is empty, plays silence)' : ''}">${'ABCD'[e.slot]}<small>x${e.repeats}</small></button>`;
    }).join('');
    $('#song-loop').classList.toggle('on', seq.song.loop);
    const bars = list.reduce((n, e) => n + e.repeats * (R.patLen(e.slot) / Math.min(R.patLen(e.slot), 4 * R.patBeat(e.slot))), 0);
    $('#song-status').textContent = list.length
      ? `${list.length} entr${list.length === 1 ? 'y' : 'ies'} · ${bars} bar${bars === 1 ? '' : 's'} · ${seq.song.loop ? 'loops' : 'stops at end'}`
      : 'empty';
    editEl.hidden = selected < 0;
    if (selected >= 0) {
      const e = list[selected];
      $('#song-edit-name').textContent = 'ABCD'[e.slot];
      $('#song-edit-rep').textContent = `x${e.repeats}`;
      $('#song-left').disabled = selected === 0;
      $('#song-right').disabled = selected === list.length - 1;
    }
  }

  chipsEl.addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    const i = +b.dataset.i;
    selected = selected === i ? -1 : i;
    render();
  });
  $('#song-add').addEventListener('click', () => {
    const i = song.add(seq.current, 1);
    if (i >= 0) { selected = i; render(); lcd(`added ${'ABCD'[seq.current]} to the song`); }
  });
  $('#song-loop').addEventListener('click', () => {
    R.history.push();
    seq.song.loop = !seq.song.loop; song.changed();
    lcd(seq.song.loop ? 'song loops' : 'song stops at the end');
  });
  $('#song-rep-down').addEventListener('click', () => { if (selected >= 0) song.update(selected, { repeats: seq.song.list[selected].repeats - 1 }); });
  $('#song-rep-up').addEventListener('click', () => { if (selected >= 0) song.update(selected, { repeats: seq.song.list[selected].repeats + 1 }); });
  $('#song-left').addEventListener('click', () => { if (selected > 0) { song.move(selected, -1); selected -= 1; render(); } });
  $('#song-right').addEventListener('click', () => { if (selected >= 0) { song.move(selected, 1); selected += 1; render(); } });
  $('#song-slot').addEventListener('click', () => { if (selected >= 0) song.update(selected, { slot: (seq.song.list[selected].slot + 1) % 4 }); });
  $('#song-remove').addEventListener('click', () => {
    if (selected < 0) return;
    song.remove(selected); selected = -1; render(); lcd('entry removed');
  });
  // Wheel over the repeat count nudges it
  $('#song-edit').addEventListener('wheel', e => {
    if (selected < 0) return;
    e.preventDefault();
    song.update(selected, { repeats: seq.song.list[selected].repeats + (e.deltaY < 0 ? 1 : -1) });
  }, { passive: false });

  document.addEventListener('rhythm:song', render);
  render();
  R.songUi = { render };
})();
