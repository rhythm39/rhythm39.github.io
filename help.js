/* Rhythm-39 · guided tour. Walks through the controls one at a time, switching
   views, darkening everything except the control (a cutout in the shade) and
   keeping the explanation card out of the way. Depends on app.js. */
(() => {
  'use strict';
  const R = window.rhythm;
  if (!R) return;
  const { ui } = R;
  const $ = s => document.querySelector(s);

  // `target` may match several elements; the cutout covers all of them.
  const STEPS = [
    // ---- OUTPUT ----
    { view: 'output', target: '#pads', title: 'PADS',
      text: 'Sixteen sounds in four colour groups: orange drums, yellow percussion, blue bass, pink dub effects. Tap a pad to play it. The last pad you hit becomes the selected pad for step editing, shown with a dark outline. With "Position velocity" on in Settings, a touch in the top third of a pad plays an accent.' },
    { view: 'output', target: '#pads', title: 'KEYS',
      text: 'The big digit on each pad is its computer key: 1 2 3 4 on the top row, then Q W E R, A S D F, and Z X C V. Hold Shift while pressing for an accented, louder hit. You can remap or hide the keys in Settings.' },
    { view: 'output', target: '#btn-play, #btn-stop', title: 'PLAY / STOP',
      text: 'PLAY starts the loop from step 1, STOP halts it (Space toggles the two, Escape stops). STOP lets the delay and reverb ring out like a hardware box; press STOP a second time to cut every sound at once. A Settings option makes every stop cut the tails. The step row shows the playhead as a teal bar while it runs. The two small bars at the top right of the display are the output meter, left and right, with a peak tick that holds for a second and turns red when the mix hits the limiter.' },
    { view: 'output', target: '#btn-rec', title: 'RECORD',
      text: 'Arm REC (or press Enter), then PLAY. You get one bar of clicks, then every pad you hit is written into the pattern. Two options appear while armed: OVERDUB piles hits on top of what is there, REPLACE rewrites the steps of a held pad as the playhead passes; QUANTIZE snaps to the grid, FREE TIME keeps the offset of each hit as a timing lock.' },
    { view: 'output', target: '.pbtn', title: 'PATTERNS',
      text: 'Four pattern slots, A to D, each with its own kit and its own tempo. The demos are one drop, steppers, dancehall and digital rockers. While the loop is playing, choosing another slot waits for the bar to end, blinking until it switches.' },
    { view: 'output', target: '#btn-song', title: 'SONG MODE',
      text: 'SONG (or Shift+Space) opens a row where you chain the four slots into a track: + ADD appends the current pattern as a chip, tap a chip to set how many times it repeats, move it, change its slot or remove it. With SONG on, PLAY runs the list from the top, switching at loop ends and following each slot\'s tempo. LOOP repeats the song; off, it stops at the end.' },
    { view: 'output', target: '.bpm', title: 'TEMPO',
      text: 'Type a BPM, use minus and plus, tap TAP in time, or scroll the wheel over the box. Square brackets nudge by 1, with Shift by 5. The tempo is saved with the current pattern slot. MET turns on a metronome click on every quarter note.' },
    { view: 'output', target: '.steps-title, #step-grid', title: 'STEPS',
      text: 'One page of steps for the selected pad, named in the title. Click a step to cycle it: off, on, accent (outlined). Press on one step and drag across others to paint them all the same. Every beat is marked. Hold a step (or right-click it) to open its locks: PITCH in semitones, a FILTER low-pass, the delay SEND and a TIME nudge of up to half a step either way; locked steps carry a dot. The KIT button picks which kit this slot plays: the four synth kits, or the bundled 808 sample kit (CC0, loaded on first use; its pads carry a KIT tag). The STEPS button cycles the pattern length: 8, 12, 16, 32 and 64 steps in 4/4, then 12, 24 and 48 triplet steps in 12/8. Longer patterns get page buttons that follow the playhead until you pin one.' },
    { view: 'output', target: '.steps-head .mini', title: 'EDIT TOOLS',
      text: 'UNDO reverses any pattern change, including recorded hits (Ctrl+Z, Ctrl+Shift+Z to redo). COPY and PASTE move a whole pattern between slots; hold Shift to copy or paste just the selected pad row. CLR PAD empties the selected pad, CLR PTN empties the slot. Backspace also clears the pad. While playing, hold CLR PAD or Backspace and tap pads to erase just their hits as the playhead passes.' },
    { view: 'output', target: '.padmode', title: 'MUTE AND KEYS',
      text: 'Switch the pads to MUTE (or press N) and each tap silences or restores a pad in the sequencer, handy for dropping the drums out. Muted pads dim. KEYS (or B) spreads the selected pad across the grid as a chromatic keyboard, root at the bottom left, rising left to right and bottom to top, for bass lines and chords; with REC armed, the notes record onto the source pad as pitch locks. Back to PLAY to trigger sounds again.' },
    { view: 'output', target: '.fx-grid', title: 'LIVE FX',
      text: 'Hold a button for a momentary effect: DELAY throws everything into the tape delay, LO-PASS and HI-PASS sweep the master filters, STUTTER repeats the current step at 1/32, TAPE STOP slows the mix to a halt, HALF plays at half speed and snaps back to the grid on release, REPEAT plays the step at 1/8, SWEEP is a slow bandpass. Keys: U I O P and J K L ;. Double-tap a button to latch it, tap again to release; drag up or down while holding to set the intensity. PLAY and STOP clear every latch.' },
    { view: 'output', target: '.synth', title: 'SYNTH',
      text: 'A built-in synth. USE IN SLOT puts the SYNTH kit on the current slot: the pads become notes (C at the bottom left, rising left to right and bottom to top) and the sequencer records and plays them like any other pad; the KIT button gets you back. Two detuned oscillators, a sub, a resonant filter with its own envelope, drive and an amp envelope. The X/Y surface plays two of those live: drag it, or use the arrows when it is focused; the X and Y buttons choose what each axis controls. Everything is saved with the project and rendered into exports.' },
    { view: 'output', target: '.mfx', title: 'MASTER FX',
      text: 'Three dub tools on the master bus. SPRING is a spring reverb fed by the pads (effects pads send the most, bass none); WET is the return, DECAY the ring. TAPE is the delay the pads and the DELAY key throw into, now with wow, flutter and tape saturation; FEEDBK at the top self-oscillates. CRUSH is a bit reducer with sample-rate dropping; WET blends it in, BITS from 12 (clean) to 4 (broken). All of it is saved and rendered into exports.' },
    { view: 'output', target: '.mixer', title: 'SWING AND VOLUME',
      text: 'SWING pushes the off-beats late for a lazier feel; 16TH swings every odd step, 8TH only the off-beat eighths. VOLUME is the master output. Scroll the wheel over either slider to nudge it.' },
    // ---- INPUT ----
    { view: 'input', target: '.deck', title: 'VIEWS',
      text: 'The four push keys switch views like the buttons on a cassette deck: OUTPUT is the sequencer, INPUT captures samples, MIXER balances the pads, SETTINGS holds preferences and this tour. F1 to F4 do the same from the keyboard.' },
    { view: 'input', target: '.in-transport', title: 'INPUT: RECORD, PREVIEW, LOAD',
      text: 'REC captures from the microphone (up to 12 seconds), STOP ends the take early. LOAD opens an audio file; dragging a file onto the waveform works too. RESAMPLE (or Shift+REC) bounces one pass of the current pattern into the editor, with the delay tail if that box is ticked. PREVIEW plays the trimmed result with the current gain and pitch.' },
    { view: 'input', target: '.in-checks', title: 'INPUT: OPTIONS',
      text: '"Wait for signal" arms the recorder so it only starts when you make a sound, useful when the mic is across the room. "Reverse" flips the audio; the trim points flip with it.' },
    { view: 'input', target: '#wave-wrap', title: 'INPUT: WAVEFORM',
      text: 'Your take, drawn with the kept part bright and the trimmed ends dimmed. Tap anywhere on it to move the nearest trim handle. The bar underneath is the live input level while the mic is open.' },
    { view: 'input', target: '.in-knobs', title: 'INPUT: TRIM, GAIN, PITCH',
      text: 'START and END set the played region in seconds. GAIN scales the level from silence to double. PITCH shifts the sample in semitones, an octave each way, which also changes its length. FADE IN and FADE OUT ramp the edges (drawn as shaded corners on the waveform), PAN places it. ONE-SHOT plays through; GATE plays only while the pad is held and LOOP repeats between the trim points while held (in the sequencer both last one step). CHOKE picks which group cuts the sample: the kit default, none, the hats, or the free groups A and B. The wheel works on every slider.' },
    { view: 'input', target: '.in-actions', title: 'INPUT: ASSIGN',
      text: 'ASSIGN writes the edited sample to the target pad and saves it in this browser; the pad shows the sample name with an SMP tag and keeps working in the sequencer, mutes and all. REVERT returns the pad to its synth sound. CLEAR EDITOR empties the editor without touching the pad.' },
    { view: 'input', target: '.in-target', title: 'INPUT: TARGET PAD',
      text: 'Choose which pad receives the sample. The grid mirrors the output pads with the current kit names. Tapping a pad here also plays it. Pads that already hold a sample show an SMP tag, and selecting one loads its sample back into the editor so you can re-trim it.' },
    // ---- MIXER ----
    { view: 'mixer', target: '#mixer-grid', title: 'MIXER',
      text: 'One strip per pad for the pattern slot shown: LVL up to 150 percent, PAN, DLY (send to the tape delay) and VRB (send to the spring). M mutes, S solos (exclusive; Shift adds), R resets the strip, double-click resets one slider, tapping the name auditions the pad. Each slot keeps its own strips, so a kit balance travels with its pattern; COPY MIX and PASTE MIX carry one to another slot. F3 opens this view.' },
    // ---- SETTINGS ----
    { view: 'settings', target: '.set-help', title: 'SETTINGS: TOUR',
      text: 'The ? pad starts this walkthrough at any time. You can also press ? from anywhere. Arrow keys step through it, Esc closes it.' },
    { view: 'settings', target: '#set-behaviour', title: 'SETTINGS: BEHAVIOUR',
      text: 'Count-in adds one bar of clicks before recording starts. Haptics gives a small buzz on touch pad hits. Key caps shows or hides the digits on the pads. Loud metronome makes the click easier to hear. Hold MUTE makes mute mode momentary: active only while the MUTE button or N is held. Sidechain lets the kick duck the bass and FX pads for a pumping dub feel. High contrast darkens pad text and thickens step outlines. Low latency asks for the smallest audio buffer after a reload; the line below it reports the measured output latency. The Light / Dark switch picks the skin (it starts on the system setting). "Resume where the loop stopped" keeps your place after a phone lock. "Always show key hints" brings the key letters back on touch devices. Position velocity makes the top third of a pad an accent on touch.' },
    { view: 'settings', target: '#set-projects', title: 'SETTINGS: PROJECTS',
      text: 'Named projects, each with its own patterns, tempos, song, master FX and mixer. The open one autosaves; NEW PROJECT starts another from the demos, LOAD switches, DUPLICATE copies, DELETE moves one to a session trash, and tapping a name renames it. A share link you open becomes its own project.' },
    { view: 'settings', target: '#set-project', title: 'SETTINGS: PROJECT',
      text: 'EXPORT saves patterns, tempos, swing, mutes and the song to a JSON file; IMPORT loads one back. EXPORT AUDIO below renders the current pattern or the whole song to a WAV file, with the metronome if MET is on; latched live FX are rendered as held. COPY SHARE LINK puts the same in a URL you can send to someone; SHOW QR draws that link as a code another phone can scan. RESET DEMO PATTERNS restores the four demos. CLEAR ALL SAMPLES returns every pad to its synth sound (it asks for a second click).' },
    { view: 'settings', target: '#set-library', title: 'SETTINGS: LIBRARY',
      text: 'Every sample stored in this browser, with its pad, length and size. LOAD opens it in the INPUT editor, MOVE puts it on another pad (a sample already there goes to the trash), DELETE moves it to the trash, and tapping the name renames it. Trashed samples can be restored until you close the page. The line underneath shows how much storage the site uses.' },
    { view: 'settings', target: '#set-midi', title: 'SETTINGS: MIDI',
      text: 'ENABLE MIDI asks the browser for your controllers (Chrome and Edge). Pick an input and an output, set the channel, and hits on the controller play the pads: GM drum notes 36 to 51 by default, or LEARN your own map. The app can follow an incoming clock and start / stop, and send its own 24 ppqn clock, transport and pad notes to hardware.' },
    { view: 'settings', target: '#set-keyboard', title: 'SETTINGS: KEYBOARD',
      text: 'Click a pad slot and press a key to remap it; keys swap if the new one is taken, and RESET KEYS restores the default 1234 / QWER / ASDF / ZXCV layout. Below that is the full keyboard map for transport, steps, wheel, live FX and views.' },
    { view: 'settings', target: '#set-about', title: 'SETTINGS: ABOUT',
      text: 'Version and license. Rhythm-39 is MIT licensed: use it, change it, share it, keep the notice. That is the end of the tour.' },
  ];

  const tour = {
    i: 0, open: false, spotEls: [],
    start() {
      this.open = true; this.i = 0;
      $('#tour').hidden = false;
      $('#tour-shade').hidden = false;
      this.render();
    },
    close() {
      this.open = false;
      $('#tour').hidden = true;
      $('#tour-shade').hidden = true;
      this.unspot();
    },
    next() { if (this.i < STEPS.length - 1) { this.i++; this.render(); } else this.close(); },
    prev() { if (this.i > 0) { this.i--; this.render(); } },
    unspot() { this.spotEls.forEach(el => el.classList.remove('spot')); this.spotEls = []; },

    // Union of the highlighted elements' boxes, in viewport coordinates
    holeRect() {
      let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
      this.spotEls.forEach(el => {
        const x = el.getBoundingClientRect();
        if (!x.width && !x.height) return;
        l = Math.min(l, x.left); t = Math.min(t, x.top); r = Math.max(r, x.right); b = Math.max(b, x.bottom);
      });
      if (l === Infinity) return null;
      const pad = 6;
      return { left: l - pad, top: t - pad, width: r - l + pad * 2, height: b - t + pad * 2 };
    },
    // Position the cutout and keep the card on the opposite side of the screen
    placeHole() {
      if (!this.open || !this.spotEls.length) return;
      const rect = this.holeRect();
      if (!rect) return;
      const h = $('#tour-hole');
      h.style.left = `${rect.left}px`; h.style.top = `${rect.top}px`;
      h.style.width = `${rect.width}px`; h.style.height = `${rect.height}px`;
      const tourEl = $('#tour');
      const card = $('#tour-card').getBoundingClientRect();
      const vh = window.innerHeight;
      const holeMid = rect.top + rect.height / 2;
      // Card at the bottom by default; move it to the top when the hole sits in the
      // lower part of the screen or would be covered by the card.
      const wouldCoverAtBottom = rect.top + rect.height > vh - card.height - 8;
      const wouldCoverAtTop = rect.top < card.height + 8;
      let top = holeMid > vh * 0.55;
      if (top && wouldCoverAtTop && !wouldCoverAtBottom) top = false;
      if (!top && wouldCoverAtBottom && !wouldCoverAtTop) top = true;
      tourEl.classList.toggle('top', top);
    },
    render() {
      const s = STEPS[this.i];
      ui.setView(s.view);
      $('#tour-title').textContent = s.title;
      $('#tour-text').textContent = s.text;
      $('#tour-count').textContent = `${this.i + 1} / ${STEPS.length}`;
      $('#tour-prev').disabled = this.i === 0;
      $('#tour-next').textContent = this.i === STEPS.length - 1 ? 'DONE' : '▶';
      $('#tour-dots').innerHTML = STEPS.map((_, j) => `<i class="${j === this.i ? 'on' : ''}"></i>`).join('');
      this.unspot();
      this.spotEls = [...document.querySelectorAll(s.target)];
      this.spotEls.forEach(el => el.classList.add('spot'));
      if (this.spotEls.length) {
        // Scroll the group to the middle of the screen, then track it while the scroll settles
        const rect = this.holeRect();
        if (rect) {
          const targetY = window.scrollY + rect.top + rect.height / 2 - window.innerHeight / 2;
          window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
        }
        this.placeHole();
        const t0 = performance.now();
        const track = () => { this.placeHole(); if (this.open && performance.now() - t0 < 800) requestAnimationFrame(track); };
        requestAnimationFrame(track);
      }
    },
  };
  window.addEventListener('scroll', () => tour.placeHole(), { passive: true });
  window.addEventListener('resize', () => tour.placeHole());

  $('#btn-help').addEventListener('click', () => tour.start());
  $('#tour-close').addEventListener('click', () => tour.close());
  $('#tour-next').addEventListener('click', () => tour.next());
  $('#tour-prev').addEventListener('click', () => tour.prev());
  window.addEventListener('keydown', e => {
    if (!tour.open) return;
    if (e.key === 'Escape') { tour.close(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); tour.next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); tour.prev(); }
  });

  R.tour = tour;
  R.tourSteps = STEPS;
})();
