# Rhythm-39

A shameless, browser-based homage to the Teenage Engineering EP-40 Rhythm pocket sampler:
a 16-pad sampler and step sequencer that runs entirely in a web page.

Plain HTML, CSS and JavaScript on the Web Audio API. No build step, no dependencies,
no server-side anything. The four default kits are synthesized on the fly; one bundled
808 sample kit (CC0, about 1 MB, see `LICENSES.md`) loads on first use. Everything you
make autosaves in the browser and the app installs as a PWA that works offline.

Live: https://rhythm39.github.io

## Run it

It is a static site, so any web server will do. From the project folder:

```bash
npx serve .
```

or

```bash
python -m http.server 8765
```

Then open the address it prints. Opening `index.html` straight off disk works for
playing around, but a real origin is needed for the service worker and the install
prompt. The service worker is skipped on localhost so development always serves fresh
files.

To try it on a phone, serve on `0.0.0.0` and open your machine's LAN address.

## What it does

**Pads and sequencer.** 16 pads, 4 pattern slots (A B C D), patterns of 8 to 64 steps in
4/4 or 12 to 48 triplet steps in 12/8. Steps cycle off, on and accent; drag to paint a
run of them. Long patterns get page buttons that follow the playhead. Per-slot tempo,
swing (16th or 8th), metronome, tap tempo, count-in, undo and redo, copy and paste of a
whole pattern or a single pad row.

**Per-step locks.** Hold or right-click a step for PITCH, FILTER, SEND and TIME
(micro-timing up to half a step). Locks survive undo, copy, export and share links.

**Recording.** Arm REC and play the pads. OVERDUB or REPLACE, QUANTIZE to the nearest
16th or FREE TIME that keeps your offsets, Shift for an accent, and live erase by
holding CLR PAD while tapping pads. Recording compensates for measured output latency.

**Sampling.** The INPUT view records from the microphone (optionally waiting for the
first sound) or loads and decodes a file, including drag and drop. Trim with START and
END, set GAIN, PITCH, FADE IN, FADE OUT and PAN, choose ONE-SHOT, GATE or LOOP and a
choke group, PREVIEW, then ASSIGN to a pad. RESAMPLE bounces one pass of the current
pattern back into the editor. Samples live in IndexedDB; REVERT restores the synth
sound.

**Synth and keys.** A built-in synth (two detuned oscillators, sub, resonant filter with
envelope, drive, amp envelope, glide) can take over a slot's pads, and an X/Y surface
drives two of its parameters live. KEYS turns the grid into a chromatic keyboard for the
selected pad, sampled or synth, and records notes as pitch locks.

**Effects.** Held or latched live FX (DELAY, LO-PASS, HI-PASS, STUTTER, TAPE STOP, HALF,
REPEAT 1/8, SWEEP) with drag for intensity, plus master SPRING reverb, TAPE delay with
wow, flutter and saturation, and CRUSH bit reduction. A brick-wall limiter and soft clip
keep the output under full scale, with a stereo meter and peak hold in the display.
Optional kick sidechain ducks the bass and FX pads.

**Mixer.** A strip per pad per slot: level, pan, delay send, spring send, mute and solo.
COPY MIX and PASTE MIX move a balance between slots.

**Song mode.** Append slots as chips, set repeats per chip, reorder them, loop or stop at
the end. Tapping A-D mid-song plays that slot for one pass, then the song resumes.

**Projects, sharing and export.** Named projects in IndexedDB, JSON export and import,
COPY SHARE LINK (with a QR code) that carries patterns, tempo, swing, song, FX and mix,
and EXPORT AUDIO which renders the pattern or the song offline to a 16-bit stereo WAV.

**MIDI.** In Chrome and Edge: pick an input and output, LEARN a pad map (GM drum notes 36
to 51 by default), follow incoming clock and transport, and send clock, transport and
pad notes to hardware.

**Accessibility.** Full keyboard operation, screen-reader announcements for the LCD,
light and dark themes that follow the system, high contrast and reduced motion support,
and a guided tour of every control on the "?" pad.

## Keyboard

- **Pads:** `1 2 3 4` / `Q W E R` / `A S D F` / `Z X C V`, top row to bottom. Remappable
  in Settings.
- **Transport:** `Space` play/stop, `Enter` record arm, `Esc` stop (twice to cut all
  sound), `[` and `]` for BPM (Shift for 5), `T` tap tempo, `M` metronome.
- **Live FX:** `U I O P` and `J K L ;`. Double-tap a button to latch it.
- **Modes:** `N` mute, `B` keys, Shift+Space song, `?` guided tour.
- **Editing:** `Backspace` clears the selected pad, `Ctrl+Z` undo, `Ctrl+Shift+Z` redo.
- **Views:** `F1` to `F4`.

## Views

The four push keys under the display switch views, like the buttons on a cassette deck.

- **OUTPUT:** pads, steps, transport, live FX, master FX, synth X/Y.
- **MIXER:** per-pad strips for the current slot.
- **INPUT:** sample recording, loading, trimming and assignment.
- **SETTINGS:** behaviour toggles, key map, theme, latency, MIDI, projects, share links,
  JSON export and import, the sample library, audio export and the guided tour.

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
- `crush-worklet.js`, `capture-worklet.js`: bit crusher and microphone capture
  AudioWorklets.
- `sw.js`, `manifest.json`, `icon.svg`: install and offline support.
- `kits.js`, `samples/`: sampled kit loader, the bundled 808 kit and `samples/index.json`.
- `tools/build-guide.js`: renders the user guide PDF.
- `tests/core.test.js`: unit tests over `core.js`.
- `LICENSES.md`: where every bundled sample comes from.

Local-only helpers (a dev server and Windows start, stop and deploy scripts) are not
part of this repository.

## User guide

`docs/USER-GUIDE.md` is the full guide.

```bash
npm run guide
```

renders it to `docs/Rhythm-39-User-Guide.pdf` with no dependencies. The PDF is committed
too.

## Tests

```bash
npm test
```

runs the Node test runner over `core.js`. Node 18 or newer, no dependencies.

## Deploying

Copy the files in this repository to any static host. Bump `CACHE` in `sw.js` when you
publish so installed clients pick up the new files. This repository is itself published
with GitHub Pages from `main`; `.nojekyll` keeps Pages from processing the files.

See `BACKLOG.md` for what is next.

## License

MIT, see `LICENSE`. Bundled samples are CC0; see `LICENSES.md`.
