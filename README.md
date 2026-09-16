# Rhythm-39

A shameless, browser-based homage to the Teenage Engineering EP-40 Rhythm pocket sampler.
Plain HTML, CSS, and JavaScript with the Web Audio API. No build step. The four
kits are synthesized on the fly; one bundled 808 sample kit (CC0, about 1 MB, see
`LICENSES.md`) loads on first use.

## Run it

On Windows, double-click `start.bat`. It starts the local server and opens the app; run it again after pulling updates and it restarts the server so the new files are served. `stop.bat` shuts the server down.

Anywhere else, open `index.html` directly, or serve it for a proper origin (needed for the service worker and install prompt):

```bash
node serve.js 8765
```

Then visit http://127.0.0.1:8765. To try it on a phone on the same network, change the bind
address in `serve.js` from 127.0.0.1 to 0.0.0.0 and open your machine's LAN address.

## Play it

- **Pads:** tap, or use `1 2 3 4` / `Q W E R` / `A S D F` / `Z X C V` (top row to bottom).
- **Stopping:** STOP halts the sequencer and lets the delay and reverb ring out. Press STOP again (or `Esc` twice) to cut every sound at once; Settings can make every stop do that.
- **Transport:** PLAY and STOP keys, `Space` play/stop, `Enter` record arm, `Esc` stop, `[` and `]` for BPM (Shift for steps of 5), `T` tap tempo, `M` metronome.
- **Steps:** the last pad you hit is selected; clicking a step cycles off, on, accent. Press and drag across steps to paint them all the same. `Backspace` clears that pad.
- **Locks:** hold a step (or right-click it) for per-step PITCH, FILTER, SEND and TIME (micro-timing up to half a step). Locked steps carry a dot. Locks survive undo, copy, export and share links.
- **Record options:** while REC is armed, OVERDUB or REPLACE (held pads are rewritten as the playhead passes) and QUANTIZE or FREE TIME (hits keep their offset). Hold CLR PAD or `Backspace` while playing and tap pads to erase their hits live.
- **Swing:** 16TH swings every odd step, 8TH only the off-beat eighths.
- **Length:** the STEPS button cycles the pattern through 8, 12, 16, 32 and 64 steps in 4/4, then 12, 24 and 48 triplet steps in 12/8 (growing repeats the loop, shrinking cuts it). Patterns longer than a page get 1-4 page buttons that follow the playhead; tap a page to pin it while editing.
- **Wheel:** scroll over the BPM box, swing, or volume to nudge it. Shift for bigger steps.
- **Mute:** switch the pads to MUTE (or press `N`), then tap pads to silence them in the sequencer. Back to PLAY to jam. Settings can make MUTE momentary (held) instead.
- **Keys:** KEYS (or `B`) turns the grid into a chromatic keyboard for the selected pad: bottom left is the root, rising left to right and bottom to top. Synth pads are rendered once and repitched like samples. With REC armed the notes record as pitch locks.
- **Velocity by position:** turn on "Position velocity" in Settings and a touch in the top third of a pad plays an accent.
- **Sidechain:** turn it on in Settings and the kick ducks the bass and FX pads.
- **Count-in:** arm REC first, then PLAY. You get one bar of clicks before recording starts.
- **Theme:** a Light / Dark switch in Settings (it follows the system until you flip it). High contrast and reduced motion (system setting) are honoured.
- **Keyboard only:** Tab to the steps and use the arrows, Space (cycle), Shift+Space (cycle down) and Enter (locks); on a live FX button Space toggles it and Enter latches it. The LCD message is announced to screen readers.
- **Latency:** Settings reports the measured output latency; a low latency toggle asks the device for its smallest buffer (after a reload). Recording compensates for output latency.
- **MIDI:** Settings has a MIDI section (Chrome and Edge): pick an input and output, LEARN a pad map (GM drum notes 36 to 51 by default), follow incoming clock and transport, and send clock, transport and pad notes to hardware.
- **Install:** on a phone, use the browser's "Add to Home Screen". It runs full-screen and offline after the first visit (not on localhost, where the service worker is skipped for development).

## Views

The four push keys under the display switch views, like the buttons on a cassette deck. `F1` to `F4` also work.

- **OUTPUT** is the sequencer: pads, steps, transport, live FX, master FX.
- **MIXER** has a strip per pad for the current pattern slot: level, pan, delay send, spring send, mute and solo. Strips belong to the slot; mute and solo are shared. COPY MIX and PASTE MIX move a balance between slots.
- **INPUT** captures samples. Pick a target pad, then REC from the microphone (tick "wait for signal" to start on the first sound) or LOAD a file, or drag one onto the waveform. Tap the waveform or use START and END to trim, set GAIN, PITCH, FADE IN, FADE OUT and PAN, pick ONE-SHOT, GATE (plays while held) or LOOP (repeats while held) and a CHOKE group, PREVIEW, then ASSIGN. The pad shows the sample name with an SMP tag and behaves like any other pad. REVERT gives the synth sound back. Samples are stored in the browser.
- **SETTINGS** has the behaviour toggles, JSON export and import of the project, demo reset, sample wipe, a LIBRARY of every stored sample (load, move, rename, delete with a session trash, storage use), audio export, and the "?" pad that runs a guided tour of every control. Press `?` from anywhere to start it.

## Files

- `index.html`, `style.css`: layout and the hardware look.
- `core.js`: pure sequencer math and data helpers, shared with the tests.
- `app.js`: audio engine, synth kits, sequencer, output view, settings, persistence.
- `sampler.js`: input view, microphone capture, file decoding, IndexedDB sample store.
- `song.js`: song mode chip row.
- `mixer.js`: mixer view.
- `library.js`: sample library panel in Settings.
- `projects.js`: named projects in IndexedDB.
- `qr.js`: QR code encoder for share links.
- `midi.js`: Web MIDI in and out.
- `export.js`: WAV encoder and the audio export panel.
- `help.js`: guided tour.
- `crush-worklet.js`: bit crusher AudioWorklet.
- `capture-worklet.js`: microphone capture AudioWorklet.
- `sw.js`, `manifest.json`, `icon.svg`: install and offline support.
- `tests/`: unit tests, run with `npm test` (Node 18 or newer, no dependencies).
- `kits.js`, `samples/`: sampled kit loader, the bundled 808 kit and `samples/index.json`.
- `LICENSES.md`: where every bundled sample comes from.
- `deploy.bat`: builds a `dist/` folder for a static host.
- `serve.js`, `start.bat`, `stop.bat`: local server.
- **Record:** arm REC, press play, hit pads. Hits are quantized to the nearest 16th. Hold Shift for an accent.
- **Edit:** UNDO (or `Ctrl+Z`, `Ctrl+Shift+Z` to redo), COPY and PASTE a whole pattern, or hold Shift to copy and paste just the selected pad row.
- **Live FX:** hold DELAY / LO-PASS / HI-PASS / STUTTER (`U I O P`) or TAPE STOP / HALF / REPEAT ⅛ / SWEEP (`J K L ;`). Double-tap a button to latch it, tap again to release. Drag up or down on a held button for intensity.
- **Synth:** a built-in synth (two detuned oscillators, sub, resonant filter with envelope, drive, amp envelope, glide). USE IN SLOT makes the pads of the current slot play its notes, C at the bottom left; the sequencer records and plays them like any pad. An X/Y surface on the OUTPUT view drives two chosen parameters live.
- **Master FX:** SPRING reverb (pads send by group: effects most, bass none), TAPE delay with wow, flutter and saturation (the DELAY key throws into it), and CRUSH bit reduction. Each has WET and one character knob. Saved with the project and rendered into exports.
- **Limiter and meter:** a brick-wall limiter and soft clip after the volume keep the output under full scale. The two bars in the display are the stereo output meter with a one-second peak hold; red means the limiter is working.
- **Patterns:** A B C D, each with its own kit (RHYTHM, STEPPERS, DANCEHALL, DIGITAL by default; the KIT button next to STEPS puts any kit in any slot, including the bundled 808 SMP sample kit). While playing, a new pattern starts at the next bar. Everything autosaves in the browser.
- **Song:** SONG (or Shift+Space) opens the arrangement row. + ADD appends the current slot as a chip; tap a chip to change its repeats, move it, switch its slot or remove it. With SONG on, PLAY runs the list from the top and either loops or stops at the end (LOOP). Tapping A-D during a song plays that slot for one pass, then the song continues. The song is saved, exported and carried in share links.
- **Demos:** A one drop at 78, B steppers at 74, C dancehall at 98, D digital rockers at 92. Tempo is saved per slot. Clear a slot with CLR PTN to start fresh.
- **Keys:** remap the pad keys in Settings (click a slot, press a key). The full keyboard map is there too.
- **License:** MIT, see `LICENSE`.
- **Share:** Settings has COPY SHARE LINK. Anyone opening the link gets your patterns, tempo, swing, song, FX and mix, as a new project on their side. SHOW QR draws the link as a code for phone-to-phone sharing (links over 2 KB make a dense code).
- **Projects:** Settings lists named projects. The open one autosaves; NEW PROJECT, LOAD, DUPLICATE, DELETE (session trash) and rename by tapping the name.
- **Audio export:** Settings has EXPORT AUDIO: pick the current pattern (1 to 8 passes) or the song, optionally a one-bar tail for the delay, and EXPORT WAV downloads a 16-bit stereo file rendered offline. RESAMPLE in INPUT bounces one pass of the current pattern into the sample editor.

## User guide

`docs/USER-GUIDE.md` is the full guide; `npm run guide` renders it to `docs/Rhythm-39-User-Guide.pdf` with no dependencies (the PDF is committed too).

## Test and deploy

```bash
npm test
```

runs the unit tests over `core.js`. `deploy.bat` copies the app into `dist/` with a fresh service-worker cache name; upload that folder to any static host (GitHub Pages, Netlify).

See `BACKLOG.md` for what is next.
