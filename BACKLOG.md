# Rhythm-39 backlog

Web-based homage to the Teenage Engineering EP-40 Rhythm. This file tracks what is
built and what comes next. Items are grouped by theme and roughly ordered by value
within each group. Sizes: S (an hour or two), M (half a day), L (multi-day).

Each open item carries the same planning notes: **Why** (what it unlocks), **Design**
(how it should behave), **Touches** (files and structures that change), **Risks**, and
**Done when** (the checks that close it). Dependencies between items are called out so
the order below can be followed without surprises.

## Shipped (v0.1, basic function)

- 4x4 pad grid, synthesized 16-sound rhythm kit (drums, perc, sub, pluck, skank, bubble, siren, dub hit)
- Keyboard play (1234 / QWER / ASDF / ZXCV), multi-touch pads with pointer capture
- 16-step sequencer, 4 pattern slots, step toggle editing, live quantized record
- BPM 40 to 240, swing, master volume
- Punch-in FX (hold): dotted-eighth dub delay throw, low-pass, high-pass, 1/32 stutter
- Playhead and pad flash driven off the audio clock (lookahead scheduler)
- Autosave to localStorage, first-run demo one drop pattern
- Responsive layout: phone portrait, phone landscape, desktop

## Shipped (v0.2)

- Renamed to Rhythm-39; storage key bumped to `rhythm39.v2`
- Four demo patterns, one style per slot: A one drop, B steppers, C dancehall (dembow), D digital rockers
- Step accents: step click cycles off / on / accent; Shift+pad or Shift+key records an accent
- Pattern switching queues to the next bar while playing (button blinks teal until the switch)
- Tap tempo (TAP button or T), metronome (MET button or M)
- Undo / redo of pattern edits (button, Ctrl+Z, Ctrl+Shift+Z), copy / paste whole pattern
- Hat choke group: closed hat cuts a ringing open hat
- Keyboard uses physical key codes, so Shift and non-US layouts do not break pad keys

## Shipped (v0.3)

- `start.bat` / `stop.bat` for running the local server on Windows (start opens the browser, detects an already running server)
- Step painting: press a step, then drag across others to set them all to the same value (mouse and touch)
- Scroll wheel over BPM, swing, or volume nudges the value; Shift for bigger steps
- Pad mute mode (MUTE button or N): tap pads to mute / unmute, muted pads are dimmed and skipped by the sequencer, mutes persist
- Record count-in: with REC armed, PLAY gives one bar of clicks before the sequence and recording start
- Haptic tick on touch pad hits where supported
- Screen wake lock while playing, audio context resume when the tab becomes visible again
- Runtime errors are shown on the LCD
- PWA: manifest, icon, service worker (network first, cache fallback) so the app installs to a home screen and works offline

## Shipped (v0.4)

- Payphone-style key caps on the pads: brushed steel square with the key and a small pad number, hideable in Settings
- Cassette-deck view keys along the top: OUTPUT (sequencer), INPUT (sampling), SETTINGS. F1 / F2 / F3 switch views
- INPUT view: record from the microphone (raw PCM capture, optional wait-for-signal, 12 s cap, quiet takes normalized), load or drag-drop an audio file, waveform with tap-to-trim, START / END / GAIN / PITCH, preview, assign to any pad, revert pad to synth. Samples persist in IndexedDB and reload with the page
- Sampled pads keep the sample name and an SMP tag, work in the sequencer, and honour accents, mutes, and the hat choke
- SETTINGS view: count-in, haptics, key caps, loud metronome toggles; project EXPORT / IMPORT as JSON; reset demo patterns; clear all samples
- Guided tour: a "?" pad in Settings (or press ?) walks through 14 steps, switching views and highlighting the control being explained
- Service worker is skipped and unregistered on localhost so development never fights the cache
- Code split: `app.js` (engine, sequencer, output UI), `sampler.js` (input view), `help.js` (tour)

## Shipped (v0.5)

- Four synth kits, one per pattern slot: A RHYTHM (original), B STEPPERS (organ, chop, melodica, deep 808 sub, metallic hats, spring splash), C DANCEHALL (synth stab, lazer, air horn, 808 sub with drop, congas, steel pan), D DIGITAL (cheap-keyboard organ, square bass, digital drums, zap, FM piano). Pad names follow the kit; user samples override any kit
- Demo patterns rewritten for their kits; default tempo 78; storage key bumped to `rhythm39.v3`
- Key caps reduced to the printed digit only (payphone lettering, no button)
- Transport rebuilt: PLAY, REC, A, B, C, D as six equal keys; tempo row underneath with matching heights
- Guided tour darkens the whole page and cuts a window around the control being described; the window follows scrolling
- Keyboard map moved into Settings
- Sample reverse toggle in INPUT (flips the audio, mirrors the trim)
- COPY SHARE LINK in Settings puts patterns, tempo and swing in the URL hash; opening such a link loads them
- Research done on open-license sample packs (see "Sample sourcing" below)

## Shipped (v0.6)

- Tempo stored per pattern slot (demos: A 78, B 74, C 98, D 92); switching slots, including at the bar while playing, changes tempo. Saved, exported, and carried in share links
- Keyboard remapper in Settings: click a pad slot, press a key; keys swap if taken; FX, tap, metronome and mute keys stay reserved; RESET KEYS restores the default layout; the map persists
- Footer note centered and clickable (jumps to Settings) without changing its look
- Keyboard map text styled like the About copy
- MIT license line in About and a LICENSE file
- Tour: cutouts can span several elements (patterns, steps with title, edit tool buttons only); the card jumps to the top of the screen whenever it would cover the described control; Input and Settings each broken into one step per element; a Views step added (23 steps total)

## Shipped (v0.7)

- Tempo row keys (minus, plus, TAP, MET) share the A-D key look: same drop shadow, press travel and bold lettering
- Behaviour options drawn as toggle switches
- Hold MUTE option: mute mode is momentary while the MUTE button or N is held
- Sidechain option: the kick pad ducks the bass and FX pads (fast dip, quarter-second recovery)
- Shift+COPY / Shift+PASTE copy and paste the selected pad row only
- INPUT view reorganized: waveform and controls first, target pads at the bottom as a 4x4 grid of three-quarter-height pads with full names, PAD n / SMP sub-labels; ASSIGN names the pad; tour steps reordered to match

## Shipped (v0.8, bug pass)

- A queued pattern switch could leave the A-D buttons, step grid and tempo display on the old slot when two scheduler entries landed in one animation frame (fast tempos, dropped frames). The visual drain now remembers the switch
- After a stalled timer (phone lock, long tab freeze) the scheduler fired every missed step at once as a burst. It now skips ahead to the current step. Background tabs schedule 1.5 s ahead so throttled timers do not leave gaps, and the visual queue is capped while hidden
- Keyboard play and transport stopped working after clicking a slider, toggle or button, because the focused input swallowed every key. Only text-style inputs do that now; arrow keys still adjust a focused slider
- Holding N in hold-mute mode and switching windows left the pads stuck in mute mode
- LCD messages for mute, unmute and CLR PAD used kit A names on every kit
- RESET DEMO PATTERNS restored the demo tempos without updating the tempo box, LCD or delay time
- Tapping the current pattern while another was queued cleared the queue silently; the LCD now says so
- Pad ARIA labels follow the kit and the key map
- INPUT: selecting a target pad before audio had started did not load its stored sample into the editor; the ASSIGN label did not follow a kit switch; a new mic take kept the previous gain, pitch and reverse settings

## Shipped (v0.9)

- Pattern length per slot: one STEPS button cycles 8, 12, 16, 32, 64 steps (Shift or wheel for the other direction). Growing repeats the existing loop, shrinking cuts the tail; both undo. Length lives in the row arrays, so undo, copy / paste, save, export and share links carry it without a separate field
- Beat per slot: the same button continues into the 12/8 triplet lengths (12, 24, 48 steps, three per beat). A 12-step 4/4 pattern reads as 3/4
- Step grid shows one page (16 cells in 4/4, 12 in 12/8); longer patterns get page buttons 1-4 that follow the playhead while playing. Editing a step or tapping a page pins it; tapping the pinned page again resumes following; STOP unpins. Beat cells are marked, bar starts are marked stronger
- Metronome clicks per beat, downbeat per bar; count-in is one bar of the slot's beat; queued pattern switches happen at the loop end (LCD says "at loop end" for multi-bar patterns)
- Storage key bumped to `rhythm39.v4`; v3 saves load unchanged (16 steps, 4/4). Export is version 3 with a `beats` array; share links are v3 with a `t` field and variable-length row strings; old files and links still load

## Shipped (v0.10)

- Song mode: SONG key in the tempo row (or Shift+Space) shows a row of chips under the transport, up to 32 entries of `{ slot, repeats }`. + ADD appends the current slot; tapping a chip opens an editor with repeat minus / plus (wheel works too), move earlier / later, SLOT to cycle A-D, REMOVE. Chips for empty slots are dimmed. LOOP toggles looping or stop-at-end
- With SONG on, PLAY starts from the first entry's slot, advances at each loop end through the existing queue mechanism (tempo per slot follows), and the LCD reports "song 3/8 · B x2" on each entry change. A slot tapped by hand plays for one pass and counts as one repeat, then the song continues. Playing chip is highlighted
- Song saved in the project, in export / import (`song` object) and in share links (`g` field). `song.js` holds the chip UI; playback lives in `app.js`
- Brand line reads "sampler · sequencer · web edition"; EXPORT / IMPORT lose the JSON suffix; CLEAR ALL SAMPLES needs a second click within four seconds

## Shipped (v0.11)

- One STEPS button cycles every pattern length: 8, 12, 16, 32, 64 in 4/4, then 12, 24, 48 in 12/8 (the separate beat button is gone)
- Offline renderer: `Engine._build(ctx)` builds the graph on any BaseAudioContext and `Engine.offline(live, ctx)` clones the live engine (kits, samples, sidechain, master level) onto an OfflineAudioContext. `renderAudio({ list, tail })` walks a list of `{ slot, repeats }` with the live scheduler's timing (per-slot tempo, beat, length, swing, accents, mutes, delay time following each slot's tempo), returns the AudioBuffer, and scales hot renders down to -1 dBFS
- EXPORT AUDIO in Settings: PATTERN x1 / x2 / x4 / x8 or SONG, optional one-bar tail, EXPORT WAV downloads 16-bit stereo at the context sample rate (`export.js`). The LCD reports duration, size and render time
- RESAMPLE in INPUT bounces one pass of the current pattern into the sample editor as `LOOP A 1` (slot, take number), ready to trim and assign

## Shipped (v0.12)

- "PUNCH-IN FX" renamed to "LIVE FX" everywhere the user sees it
- Master FX section under the live FX: SPRING (convolver with a generated spring impulse: a train of downward chirps with stretching spacing plus a diffuse tail, bandpassed at 1.5 kHz; WET and DECAY 0.5 to 3 s, impulse regenerated on change), TAPE (the shared delay line gains a 0.4 Hz wow LFO whose depth grows with feedback, a tanh soft clip in the feedback path, 3 kHz tone; WET and FEEDBK 0.2 to 0.9), CRUSH (an AudioWorklet bit reducer with sample-and-hold downsampling tied to the bit depth, wet / dry insert before the filters; WET and BITS 12 to 4; bypass where AudioWorklet is missing). RESET restores defaults
- Pads send to the spring by group (fx 0.4, perc 0.15, drum 0.1, bass 0), a pad can override with `verb`
- FX settings saved with the project, exported / imported, in share links (`x` field, only when changed) and cloned into the offline renderer, so exports carry them
- Tour step for the master FX

## Shipped (v0.13)

- Brick-wall output: after the volume, a limiter (threshold -1 dB, ratio 20, 1 ms attack, 50 ms release) and a ceiling soft clip that is unity below 0.9 and bends the last 10 percent into 1.0. The offline renderer carries the same chain, so exports cannot exceed full scale even before normalization
- Stereo output meter in the LCD: two bars with a quick rise and smooth fall, a peak tick with a one-second hold, red at -0.5 dBFS. Draws only while playing or within two seconds of a hit

## Shipped (v0.14)

- MIXER view (fourth deck key, F3): sixteen strips for the current slot with LVL (0 to 150 percent), PAN (StereoPannerNode where available), DLY and VRB sends, M, S (exclusive, Shift adds), R (strip reset), double-click on a slider resets it, name tap auditions. COPY MIX / PASTE MIX between slots, CLEAR SOLO, RESET MIX
- Strips default to the kit pad's send values, are saved per slot, exported / imported, in share links (`m` field, changed strips only) and used by the offline renderer. Solo wins, then mute; pads that solo silences are dimmed on the pad grid
- Settings moved to F4

## Shipped (v0.15)

- Four more live FX in a second row: TAPE STOP (J, delay-line emulation with a low-pass sweep, release ramps back in 120 ms), HALF (K, every step at double length while held, snaps back to the pass grid on release), REPEAT ⅛ (L, the stutter at 1/8), SWEEP (;, bandpass with a 0.5 Hz LFO crossfaded in). Semicolon is mapped by key code; the four keys are reserved in the remapper
- Latch: double-tap a live FX button to hold it, tap again to release; PLAY / STOP clear all latches. Intensity: drag up or down on a held button (fill shows the amount), reset on release unless latched. Keyboard FX keys respect latches

## Shipped (v0.16)

- INPUT gains FADE IN and FADE OUT (0 to 500 ms, drawn as shaded corners on the waveform), PAN, a mode button (ONE-SHOT, GATE plays while the pad or key is held, LOOP repeats between the trim points while held) and a CHOKE button (kit default, none, hat, free groups A and B). All ride on the sample record in IndexedDB; old records mean one-shot with the kit choke
- Engine: `playSample` handles fades, pan, loop points and note-off; `release(pad)` is wired to pad pointer-up, key-up and window blur; the sequencer and the renderer stop GATE / LOOP voices after one step. A sample's choke group overrides the pad's

## Shipped (v0.17)

- LIBRARY section in Settings (`library.js`): one row per stored sample with name, pad, length, size and mode; LOAD opens it in INPUT, MOVE shows a pad picker (an occupied target goes to the trash), DELETE moves it to a session trash with RESTORE and EMPTY TRASH, tapping the name renames it. Storage use from `navigator.storage.estimate()` (quota only quoted under 1 GB) and the Safari seven-day eviction note
- `sampler.js` exposes `db.get`, `assignRecord`, `removeRecord`, `loadRecord` for the library

## Shipped (v0.18)

- Position velocity (Settings): on touch, the top third of a pad plays an accent; a faint line marks the zone. Real pressure is used where the screen reports it
- KEYS pad mode (button or B): the selected pad spread across the grid as a chromatic keyboard, note names on the pads, root bottom left. Samples repitch through playbackRate; synth pads are rendered once into a buffer and repitched the same way. Not recorded
- Seeded noise (xorshift32) so hats and claps are identical on every device; every noise-based pad is pre-rendered at init and played as one buffer source per hit with a deterministic level jitter. The offline renderer shares the buffers

## Shipped (v0.19)

- Parameter locks: hold a step 400 ms or right-click it for a popover with PITCH (semitones), FILTER (per-hit low-pass 300 Hz to 18 kHz), SEND (delay send multiplier) and TIME (-50 to +50 percent of a step), HEAR to audition, CLEAR. Locked steps carry a dot. Plain steps stay numbers; locked ones are `{ l, p, f, s, t }` objects, so old saves and links load unchanged. Painting keeps locks; copy / paste, undo, export, import and share links (`(2p-5f40s150t-25)` tokens) carry them; the offline renderer applies them
- Swing mode: 16TH (every odd step) or 8TH (off-beat eighths only), saved with the project
- Record options while REC is armed: OVERDUB / REPLACE (held pads are rewritten as the playhead passes) and QUANTIZE / FREE TIME (the real offset becomes a TIME lock)
- Erase while playing: hold CLR PAD or Backspace and tap pads to clear their hits as the playhead passes; one undo per gesture

## Shipped (v0.20)

- Settings: measured output latency line, LOW LATENCY toggle (`latencyHint: 0` after a reload), HIGH CONTRAST toggle, THEME auto / cream / black. Recording compensates for output latency
- Black skin: colour tokens for the desk, body, pad face, highlights and steps; the inline bootstrap in the head applies the stored theme before first paint; AUTO follows `prefers-color-scheme` live
- Accessibility: steps are a roving-tabindex grid (arrows, Home, End, Space cycles, Shift+Space cycles down, Enter opens locks), live FX buttons take Space (toggle) and Enter (latch), the LCD message is mirrored into a throttled `aria-live` region, `prefers-reduced-motion` removes animations and press travel, icon-only buttons carry labels
- Landscape phones: slim top band, pads left, steps and FX right, two-column INPUT

## Shipped (v0.21)

- Named projects in Settings (`projects.js`, IndexedDB `rhythm39-projects`): the open project autosaves a second after each change; NEW PROJECT (from the demos), LOAD, DUPLICATE, DELETE to a session trash with RESTORE, rename by tapping the name; rows show a pattern A thumbnail, modified time and tempo. The working copy in localStorage becomes PROJECT 1 on first boot, and an opened share link becomes its own SHARED project instead of overwriting
- `projectData()` / `applyProject()` in `app.js` back export, import and projects alike
- SHOW QR in Settings draws the share link as a QR code (`qr.js`, byte mode, level L, up to version 40, best-of-eight mask) with the link length and a warning over 2 KB

## Shipped (v0.22)

- `core.js`: the pure helpers (lengths, step cells and locks, share rows, pattern normalisation and resizing, swing and timing, hit quantisation, share payload, WAV encoder) as one file that both the app and Node load. `npm test` runs nine unit tests over it
- KIT button per slot: any synth kit in any slot, saved, exported and shared
- Voice cap of 32 with oldest-first stealing (bass exempt), scheduler cost counters
- Mic capture through an AudioWorklet (`capture-worklet.js`) with the ScriptProcessor fallback; TEST TONE in INPUT
- iOS: silent buffer at init, interruption recovery on the next touch with an LCD message
- `deploy.bat` builds a `dist/` folder with a fresh service worker cache name

## Shipped (v0.23)

- MIDI in and out in Settings (`midi.js`): ENABLE MIDI, input / output / channel, LEARN grid with RESET MAP, follow incoming clock and transport, send clock and transport, send pad notes. Message handling was exercised with synthetic events; no hardware was available

## Shipped (v0.24)

- Bundled 808 sample kit (CC0, Fischer set via TidalCycles), `kits.js` loader with lazy decode and progress on the LCD, KIT tag on sampled pads, kit ids in saves, exports and share links with a graceful fallback, `LICENSES.md`

## Shipped (v0.25)

- Undo now covers song list edits and mixer changes; turning a step off keeps its parameter locks parked (dot stays) and they return when the step comes back
- KEYS mode records: with REC armed, notes land on the source pad as pitch locks
- STUTTER and REPEAT freeze the step the listener hears (the visual playhead), not the last step in the lookahead
- A recorded hit that lands on an already queued step with a hit no longer sounds twice
- ASSIGN stores only the trimmed part (checkbox, on by default); RESAMPLE has a delay-tail checkbox and Shift+REC runs it
- Audio export can render the metronome (MET) and renders latched live FX (delay, filters, sweep, tape stop) as held
- Settings: Light / Dark switch with the word inside the toggle replaces the THEME button (auto until first flipped); "resume where the loop stopped" after a stall; "always show key hints" on touch devices
- Deferred with reasons: more sampled kits need a manual 590 MB download (Big Rusty Drums); the full ES-module split of app.js stays open (see 6.1)

## Shipped (v0.25, docs)

- User guide: `docs/USER-GUIDE.md` and a PDF rendered by `tools/build-guide.js` (`npm run guide`), a dependency-free writer using the standard Helvetica fonts

## Shipped (v0.26)

- Built-in synth: a SYNTH kit whose pads are notes (C at the bottom left, an octave and a fourth), so the sequencer, KEYS mode, locks, mixer and exports treat it like any kit. Voice: two detuned oscillators (saw / square / triangle / sine), sub, resonant low-pass with envelope, drive, amp envelope with sustain, glide; held notes release on pad or key up, sequenced notes last a step
- SYNTH panel on the OUTPUT view with an X/Y surface (drag or arrow keys) aimed at any two parameters, eleven sliders, wave, octave, USE IN SLOT, RESET. Settings live in `seq.synth`, saved with the project, exported, in share links (`z`) and cloned into the offline renderer
- Open ideas: record X/Y moves as per-step locks; a second synth voice per slot

## Shipped (v0.26, scripts)

- `start.bat` restarts a running server instead of reusing it, so it always serves the current files

## Shipped (v0.27)

- STOP behaviour like hardware: the sequencer halts and the delay and spring ring out; a second STOP or Escape within 1.5 s is a panic (held voices released, master dipped, delay feedback and returns muted until the lines empty, then the FX settings restored). Settings: "STOP cuts the effect tails" makes every stop a panic. STOP now also releases held GATE, LOOP and synth notes

## Shipped (v0.28)

- STOP silences everything by default (linear 30 ms cut of the master, the delay and spring inputs and returns, and the feedback; held voices released; the returns come back once the lines have emptied or on the next PLAY). The hardware-style ring-out is now the opt-in setting "Let the delay and reverb ring out after STOP"

## Shipped (v0.29)

- Dedicated STOP key in the transport (PLAY STOP REC A B C D). STOP lets the tails ring (the default again); a second STOP within 1.5 s, or Escape twice, cuts every sound. PLAY only starts; Space still toggles. The ring-out setting stays as the opt-out

## Sample sourcing (research; the Fischer 808 set is now bundled)

Candidates that are genuinely redistributable, ranked:

1. tidalcycles/sounds-tr808-fischer, CC0, 116 WAV, ~7 MB. Backbone for the DIGITAL kit.
2. Karoryfer Big Rusty Drums, CC0, acoustic kit with velocity layers, 590 MB FLAC (trim to a few dozen hits). Best for one drop and steppers.
3. Boochi44/free-drum-samples, CC0 stated in README (no LICENSE file), 1.5 MB WAV, 808-derived kits with synthesized subs.
4. Sonic Pi bundled samples (sample-pi / sonic-pi-samples mirrors), CC0 per Sonic Pi, elec_* digital hits, tabla, cowbell.
5. Freesound "dub sirens & harsh synth" by hello_flowers, CC0, sirens for the FX row.
6. Freesound "Drum One Shots - Snares" by deadrobotmusic, CC0, lo-fi dubby snares.
7. Beckstrom's Weird TR-808 pack (archive.org), CC BY 4.0, tape and amp processed 808s (needs credit).

Plan: bundle a trimmed CC0 demo kit (Fischer 808 plus a handful of Big Rusty hits plus two sirens) under 15 MB as `samples/`, with a `LICENSES.md`. Label 808 material "808-style" (Roland trademark). Skip Legowelt, MusicRadar, and archive.org rip collections (no redistribution rights). No clean Casio MT-40 pack exists; the DIGITAL kit stays synthesized.

## Suggested order

1. Bundled sample kit (1.1) once the download is approved, and the sample library panel (1.4) to manage what it adds.
2. Device testing: iOS Safari and Android for the mic worklet (1.5), interruptions (4.2), landscape (4.6), the QR scan (5.2) and MIDI hardware (4.1).
3. Tests (6.2) before anything that reshapes the scheduler (parameter locks, micro-timing).
4. MIDI (4.1) when a controller is available to test with.

## 1. Sound and sampling

### 1.1 Bundle a CC0 demo sample kit (shipped in v0.24)

- `samples/808/`: sixteen files from the Fischer TR-808 set (CC0, confirmed through the GitHub licence API), about 1.1 MB, listed in `samples/index.json` and credited in `LICENSES.md`. Loaded lazily on the first KIT switch or project load, decoded in parallel, peak-normalised to -1 dBFS with a 5 ms end fade at load time. Big Rusty Drums, Freesound packs and Boochi44 were left out (size, download access, missing LICENSE file). The service worker caches the files on demand.

### 1.2 Sample editing extras (shipped in v0.16)

- FADE IN / FADE OUT, PAN, ONE-SHOT / GATE / LOOP and a CHOKE selector (kit default, none, hat, A, B) on the sample record. GATE and LOOP last one step in the sequencer and in renders; a per-step length would come with parameter locks (2.3). Release fades use the sample's FADE OUT (8 ms minimum).

### 1.3 Resample the loop (shipped in v0.11)

- RESAMPLE in INPUT renders one pass of the current pattern through `renderAudio()`. Remaining polish: a "with delay tail" toggle and a Shift+REC shortcut; a resampled loop that runs hot is scaled to -1 dBFS, so re-layering it changes the balance slightly.

### 1.4 Sample library panel (shipped in v0.17)

- The trash is in memory for the session rather than an IndexedDB store: simpler, and the backlog only asked for session restore. Sizes are the stored Float32 PCM (4 bytes per sample per channel), which is what IndexedDB actually holds.

### 1.5 Mic input on iOS (shipped in v0.22, untested on devices)

- `capture-worklet.js` captures on the audio thread where AudioWorklet exists; ScriptProcessor stays as the fallback. TEST TONE in INPUT plays a click through the speaker. A sample-rate change after the mic opens cannot happen to an existing context, so nothing rebuilds. Still needs a real iPhone and Android phone.

### 1.6 Factory sample kits (shipped in v0.24)

- `KITS` is a registry with ids; `kits.js` appends every kit from `samples/index.json`. Kits are saved, exported and shared by id; a link naming a kit this install lacks falls back to the slot's synth kit with an LCD notice. More kits are a matter of adding a folder and an index entry.

### 1.7 Pad velocity layers (shipped in v0.18)

- "Position velocity" toggle in Settings; mouse hits still need Shift. Pressure is used only when it is strictly between 0 and 1 and not the constant 0.5 most touch screens report.

### 1.8 Keys / chord mode (shipped in v0.18, performance only)

- KEYS (B) repitches the selected pad across the grid: samples through playbackRate, synth pads through a buffer rendered on demand (1.5 s) and repitched the same way, so length follows pitch like a sampler. Sixteen pads give an octave and a fourth, not two octaves. Recording notes waits for parameter locks (2.3).

### 1.9 Better synth voices (shipped in v0.18)

- Seeded xorshift noise and pre-rendered noise voices (hats, claps, shakers, tambourine, cabasa in every kit) played as buffer sources with a small deterministic level jitter. The 808 sub with glide is not added: it needs the kit picker from 1.6.

## 2. Sequencer

### 2.1 Pattern length and time signature (shipped in v0.9)

- Row arrays carry the length; `seq.beats[slot]` carries steps per beat. Helpers: `patLen()`, `patBeat()`, `barSteps()`, `pageSize()`, `normalizePattern()`, `resizePattern()`. Remaining polish: unit tests for the scheduler math once 6.2 lands, and 6/8 (two dotted beats) is not a separate option; use 12/8 with a 6-step feel.

### 2.2 Pattern chaining / song mode (shipped in v0.10)

- `seq.song = { on, loop, list, pos, played, ended }`; `songAdvance()` runs at step 0 of each pass. Chip editing uses buttons (move earlier / later) instead of drag-to-reorder and long-press, which are awkward on a phone and invisible on a mouse. Song edits are not in the undo history.

### 2.3 Per-pad parameter locks (shipped in v0.19)

- Cells stay numbers unless locked; `normStep` collapses an object back to a number when every lock is at its default. Pitch on synth pads goes through the rendered-buffer path from KEYS mode. The wheel-over-a-held-step pitch gesture was not added; the popover has wheel support on its sliders instead.

### 2.4 Micro-timing / nudge (shipped in v0.19)

- `t` lock -0.5..0.5 of a step, SWING mode 16TH / 8TH next to the swing slider (saved, exported, in share links as `w`). The scheduler looks half a step further ahead so negative offsets on any step, including step 0, still land ahead of the clock.

### 2.5 Quantize toggle and overdub vs. replace (shipped in v0.19)

- OVERDUB / REPLACE and QUANTIZE / FREE TIME in a row under the transport while REC is armed, persisted in settings. `seq.heldPads` unifies touch and keyboard holds. A hit recorded onto a step is spared from the same pass's REPLACE erase.

### 2.6 Erase while playing (shipped in v0.19)

- Hold CLR PAD or Backspace, tap pads. A plain tap of either still clears the selected pad (when stopped, or when no pad was tapped during the hold). One undo snapshot per gesture.

## 3. Effects and mixing

### 3.1 Master FX section (shipped in v0.12)

- Lives in `Engine._build` / `Engine.applyFx` and `crush-worklet.js`; no separate `fx.js`. Not yet measured on a phone (convolver CPU with a 1.7 s mono impulse). The limiter (3.5) is still open, so high feedback can exceed full scale on the live output.

### 3.2 Per-pad mixer (shipped in v0.14)

- MIXER is a fourth deck view (F3; Settings moved to F4). Mute and solo stayed global rather than per slot: they are performance state and mute mode already treats them that way. Native range inputs were kept (two columns on phones); tap-and-drag strips are a possible polish. Level changes apply on the next hit, not to a ringing voice.

### 3.3 More live FX (shipped in v0.15)

- TAPE STOP, HALF, REPEAT ⅛ and SWEEP on J K L ;. REPEAT 1/16 was dropped to keep two rows of four. Tape stop is emulated with a quadratic delay-time curve (rate falls linearly to zero), so the sequencer keeps running underneath and audio resumes where the clock is on release.

### 3.4 Live FX latch and intensity (shipped in v0.15)

- Double-tap latches (dot in the corner, outline), tap releases. Vertical drag on a held button sets the intensity 0..1 (delay send 0.3 to 1, filter cutoff on a log scale, tape stop length 0.35 to 1.4 s, sweep depth); the fill shows it. Intensity resets to 0.7 on release unless latched; PLAY / STOP clear every latch. Repeat sizes do not follow the intensity.

### 3.5 Master limiter and output meter (shipped in v0.13)

- Chain is comp → volume → limiter (-1 dB, 20:1, 1 ms / 50 ms) → ceiling soft clip (unity below 0.9) → out, with a channel splitter and two 256-point analysers after the clip. The render-time -1 dBFS normalization in `renderAudio` stays as a belt-and-braces step.

## 4. Interaction and platform

### 4.1 MIDI in/out (shipped in v0.23, untested with hardware)

- `midi.js`: Web MIDI with sysex off, input and output pickers, channel, LEARN map persisted in localStorage, GM drum default. Note-on velocity under 64 is a normal hit, over is an accent; note-off releases GATE / LOOP samples. Incoming clock averages 24 pulses and smooths the tempo; start / stop follow when enabled. Output: 24 ppqn clock scheduled from the audio clock via Web MIDI timestamps, start / stop, and pad notes. Needs a controller and a clocked device to verify latency and drift.

### 4.2 iOS audio edge cases (shipped in v0.22, untested on devices)

- A silent buffer plays at init so WebKit treats the app as media; `statechange` to interrupted or suspended puts "audio paused · tap to resume" on the LCD and the next touch or key resumes the context. Needs a real iPhone to confirm the silent switch and call interruptions.

### 4.3 Latency tuning (shipped in v0.20)

- Latency line and LOW LATENCY toggle in Settings; `recordHit` subtracts `engine.latency` from the hit time. Not measured against a loopback (no hardware here); the figure is what the browser reports.

### 4.4 Accessibility pass (shipped in v0.20)

- Roving tabindex on the steps, keyboard on the live FX buttons, a throttled `aria-live` mirror of the LCD line, reduced-motion query, HIGH CONTRAST toggle, labels on the icon-only buttons. Not tested with NVDA.

### 4.5 Dark theme and skin variants (shipped in v0.20)

- Tokens for every surface colour, `:root.theme-black`, an inline bootstrap in the head, THEME (auto / cream / black) in Settings, `theme-color` meta follows the skin. Contrast of the group colours on the dark pad face was not measured with a tool.

### 4.6 Landscape phone layout polish (shipped in v0.20)

- Two-column dense grid under 500 px tall: pads left, steps / live FX / master FX / mixer right, slim LCD and deck; INPUT puts the target grid beside the waveform. Verified at 844x390 in the browser pane; not on a physical phone.

## 5. Persistence and sharing

### 5.1 Named projects (shipped in v0.21)

- `projects.js` keeps records in its own IndexedDB database; localStorage stays the working copy plus the current id. The first boot adopts the working copy as PROJECT 1 (the migration). Samples remain global.

### 5.2 Share link QR (shipped in v0.21)

- `qr.js` is a self-contained byte-mode encoder, level L, versions 1 to 40, with mask selection. Kit ids wait for 1.6. Not yet scanned with a physical phone; the encoder was checked for internal consistency (Reed-Solomon syndromes and format bits) in the browser.

### 5.3 Audio export (shipped in v0.11)

- WAV only; MP3 through a wasm encoder was skipped (200 KB for a feature a DAW does better). Renders longer than 20 minutes are refused. Not yet tested on iOS Safari, which downloads through a share sheet. Punch-ins and the metronome are not rendered.

### 5.4 Cloud sync (not planned)

- **Why.** Only if a backend appears. Otherwise out of scope; share links and JSON export cover the use case.
- **Design (if ever).** A tiny key-value service keyed by an anonymous device id, storing the project JSON and samples as blobs; opt-in, with a passphrase-derived key so the server never sees plaintext.
- **Done when.** Not planned.

## 6. Engineering

### 6.1 ES modules (partly done in v0.22)

- The pure helpers moved to `core.js`, a UMD-style file that is both `window.RhythmCore` and a CommonJS module, which is what the tests needed. The rest of `app.js` (engine, sequencer, output UI) is still one classic script: a full native-module split would drop `file://` loading and touch every file for little user-facing gain. Reconsider if `app.js` keeps growing.

### 6.2 Tests (shipped in v0.22)

- `npm test` runs the Node test runner over `tests/core.test.js`: lengths, step cells and locks, share rows, pattern normalisation and resizing, swing and timing locks, hit quantisation, the share payload and the WAV encoder. No Playwright smoke test (it needs a browser download); the browser checks were done by hand.

### 6.3 Deploy (script shipped in v0.22; no public URL yet)

- `deploy.bat` builds `dist/` with a date-stamped service worker cache name. The folder is not a git repository and there is no remote, so nothing was pushed; the manifest already uses relative `start_url` and `scope`.

### 6.4 Performance audit (shipped in v0.22)

- Voice cap of 32 (voices younger than 2.5 s), oldest non-bass voice faded in 5 ms when exceeded; the noise voices are pre-rendered (1.9); `R.seq.perf` reports the last and worst `scheduleStep` cost in the console. Not measured on a budget Android.

## Known issues

- The playhead, pad flashes and the output meter freeze in a background tab (browsers pause animation frames); audio keeps running.
- The Node dev server (`serve.js`) is for local development only: no directory listing, no range requests.
- Microphone capture falls back to the deprecated ScriptProcessorNode only where AudioWorklet is missing.
- The service worker only registers on non-localhost hosts, so offline mode cannot be tried from `start.bat`; use a LAN address or a deployment.
