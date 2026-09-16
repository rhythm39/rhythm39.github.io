/* Rhythm-39 · audio export. Renders the current pattern or the song through the
   offline renderer in app.js and downloads a 16-bit WAV. Depends on app.js. */
(() => {
  'use strict';
  const R = window.rhythm;
  if (!R) return;
  const { seq, lcd, renderAudio } = R;
  const $ = s => document.querySelector(s);

  // AudioBuffer -> WAV blob (the encoder lives in core.js so the tests can cover it)
  const encodeWav = buffer => new Blob([window.RhythmCore.encodeWav(buffer)], { type: 'audio/wav' });

  // Options cycle on tap, like the other mini buttons
  const opt = { what: 'pattern', bars: 1, tail: 0, met: false };
  const WHAT = ['pattern', 'song'];
  const BARS = [1, 2, 4, 8];
  const TAIL = [0, 1];
  let busy = false;

  function songOk() { return seq.song.list.length > 0; }
  function render() {
    $('#exp-what').textContent = opt.what === 'song' ? 'SONG' : `PATTERN ${'ABCD'[seq.current]}`;
    $('#exp-bars').textContent = `x${opt.bars}`;
    $('#exp-bars').hidden = opt.what === 'song';
    $('#exp-tail').textContent = opt.tail ? 'TAIL 1 BAR' : 'NO TAIL';
    $('#exp-met').textContent = opt.met ? 'MET ON' : 'MET OFF';
    $('#exp-met').classList.toggle('on', opt.met);
    $('#exp-go').disabled = busy || (opt.what === 'song' && !songOk());
    $('#exp-note').textContent = opt.what === 'song'
      ? (songOk() ? `Renders the song list once (${seq.song.list.length} entr${seq.song.list.length === 1 ? 'y' : 'ies'}) at each slot's tempo.` : 'The song is empty. Add entries in the SONG row first.')
      : `Renders pattern ${'ABCD'[seq.current]} ${opt.bars} time${opt.bars > 1 ? 's' : ''} at ${seq.bpms[seq.current]} bpm.`;
  }
  const cycle = (arr, cur) => arr[(arr.indexOf(cur) + 1) % arr.length];
  $('#exp-what').addEventListener('click', () => { opt.what = cycle(WHAT, opt.what); render(); });
  $('#exp-bars').addEventListener('click', () => { opt.bars = cycle(BARS, opt.bars); render(); });
  $('#exp-tail').addEventListener('click', () => { opt.tail = cycle(TAIL, opt.tail); render(); });
  $('#exp-met').addEventListener('click', () => { opt.met = !opt.met; render(); });

  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  $('#exp-go').addEventListener('click', async () => {
    if (busy) return;
    busy = true; render();
    lcd('rendering audio…');
    try {
      const list = opt.what === 'song' ? seq.song.list : [{ slot: seq.current, repeats: opt.bars }];
      // A tail of one bar uses the last slot's bar length so the delay can ring out
      const last = list[list.length - 1].slot;
      const tail = opt.tail ? R.barSteps(last) * (60 / seq.bpms[last] / R.patBeat(last)) : 0;
      const t0 = performance.now();
      const { buffer } = await renderAudio({ list, tail, metronome: opt.met });
      const blob = encodeWav(buffer);
      const stamp = new Date().toISOString().slice(0, 10);
      const name = opt.what === 'song' ? `rhythm39-song-${stamp}.wav` : `rhythm39-${'ABCD'[seq.current]}-${stamp}.wav`;
      download(blob, name);
      lcd(`exported ${buffer.duration.toFixed(1)}s wav (${(blob.size / 1048576).toFixed(1)} MB, ${Math.round(performance.now() - t0)} ms)`);
    } catch (err) {
      lcd(`export failed: ${String(err.message || err).slice(0, 30)}`);
    }
    busy = false; render();
  });

  document.addEventListener('rhythm:song', render);
  document.addEventListener('rhythm:view', render);
  render();
  R.exportAudio = { encodeWav, opt };
})();
