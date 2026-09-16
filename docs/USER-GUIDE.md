# Rhythm-39 User Guide

Version 0.29

Rhythm-39 is a sampler and step sequencer that runs in a web browser. It is a homage to pocket samplers: sixteen pads, a sixteen-step grid per pad, four pattern slots, live effects, a mixer, a sample recorder and a song arranger, all in one page with no installation. Everything you make autosaves in the browser.

This guide walks through every view and control. Keyboard shortcuts are shown in capitals.

## Getting started

- Open the app. On Windows, double-click start.bat; it starts a local server and opens the page (if a server is already running it is restarted, so updates are picked up). Anywhere else, run "node serve.js 8765" and open http://127.0.0.1:8765, or open index.html directly.
- Tap any pad to wake the audio. Browsers keep sound silent until you interact with the page.
- Press PLAY (or SPACE). The demo pattern in slot A plays: a one drop at 78 bpm.
- Tap pads while it plays. Arm REC and your hits are written into the pattern.
- Press ? at any time for the guided tour, which highlights each control and explains it.

Four demo patterns come with the app, one per slot: A one drop, B steppers, C dancehall, D digital rockers. RESET DEMO PATTERNS in Settings brings them back at any time.

## The four views

The push keys under the display switch views like the buttons on a cassette deck. F1 to F4 do the same from the keyboard.

- OUTPUT is the sequencer: pads, steps, transport, song row, live FX, the synth, master FX, swing and volume.
- INPUT captures samples: record from the microphone, load a file, resample the pattern, trim, shape and assign to a pad.
- MIXER balances the pads of the current pattern slot: level, pan, delay send, spring send, mute and solo.
- SETTINGS holds behaviour options, the skin switch, projects, the sample library, export and import, audio export, MIDI, the keyboard map and the tour.

## The display

The dark display at the top shows the current pattern slot, tempo and swing, a stereo output meter, and a message line that describes whatever you just did. When REC is armed a red REC mark blinks. The meter has a peak tick that holds for a second and turns red when the mix hits the limiter.

## Output view

### Pads

Sixteen pads in four colour groups: orange drums, yellow percussion, blue bass, pink effects. Tap a pad to play it. The last pad you hit becomes the selected pad, shown with a dark outline, and the step grid shows that pad's steps.

The big digit on each pad is its computer key: 1 2 3 4 on the top row, then Q W E R, A S D F, and Z X C V. Hold SHIFT for an accented, louder hit. Keys can be remapped or hidden in Settings.

With "Position velocity" on in Settings, a touch in the top third of a pad plays an accent, so you get two dynamics on a phone without SHIFT.

### Pad modes: PLAY, MUTE, KEYS

- PLAY is the normal mode: pads trigger sounds.
- MUTE (or N): each tap silences or restores a pad in the sequencer. Muted pads dim. Settings can make MUTE momentary, active only while the button or N is held.
- KEYS (or B): the selected pad is spread across the grid as a chromatic keyboard, root at the bottom left, rising left to right and bottom to top. Sixteen notes cover an octave and a fourth. Use it for bass lines and chords. With REC armed the notes are recorded onto the source pad as pitch locks.

### Transport

- PLAY starts the loop from step 1 and STOP halts it. SPACE toggles the two and ESC stops. Stopping lets the delay and reverb ring out, the way hardware sequencers do; press STOP (or ESC) a second time to cut every sound at once. Turn off "Let the delay and reverb ring out" in Settings if you want every stop to cut the tails.
- REC (ENTER) arms recording. With REC armed, PLAY gives one bar of count-in clicks (a Settings option), then every pad you hit is written into the pattern. While armed, two options appear under the transport: OVERDUB adds hits on top of what is there, REPLACE rewrites a held pad's steps as the playhead passes; QUANTIZE snaps hits to the grid, FREE TIME keeps each hit's offset as a timing lock.
- A B C D pick the pattern slot. Each slot has its own kit, tempo, length, mixer strips and pattern. While playing, choosing another slot waits for the loop to end, blinking until it switches.
- Tempo: type a BPM, use minus and plus, tap TAP in time (T), or scroll the wheel over the box. The square brackets nudge by 1, with SHIFT by 5. The tempo is saved with the current slot.
- MET (M) turns on a metronome click on every beat.
- SONG (SHIFT+SPACE) opens the song row, described below.

### Steps

The grid shows one page of steps for the selected pad, named in the title. Click a step to cycle it: off, on, accent (outlined). Press on one step and drag across others to paint them all the same. Every beat is marked; bar starts are marked stronger.

- KIT picks which kit this slot plays: the four synth kits (RHYTHM, STEPPERS, DANCEHALL, DIGITAL) or the bundled 808 SMP sample kit, which loads on first use. Sampled pads carry a KIT tag.
- STEPS cycles the pattern length: 8, 12, 16, 32 and 64 steps in 4/4, then 12, 24 and 48 triplet steps in 12/8. Growing repeats the loop, shrinking cuts it. Longer patterns get page buttons that follow the playhead; tap a page to pin it while editing, tap it again to follow.
- UNDO (CTRL+Z, CTRL+SHIFT+Z to redo) reverses pattern edits, recorded hits, song edits and mixer moves.
- COPY and PASTE move a whole pattern between slots; hold SHIFT to copy or paste only the selected pad row.
- CLR PAD empties the selected pad (BACKSPACE), CLR PTN empties the slot. While playing, hold CLR PAD or BACKSPACE and tap pads to erase just their hits as the playhead passes.

### Parameter locks

Hold a step for half a second, or right-click it, to open its locks:

- PITCH in semitones, an octave each way.
- FILTER, a low-pass on that hit from 300 Hz to fully open.
- SEND, a multiplier on the pad's delay send.
- TIME, a nudge of up to half a step early or late.

HEAR auditions the step with its locks, CLEAR removes them. Locked steps carry a dot. Turning a step off keeps its locks parked; they return when the step comes back. Locks survive undo, copy, export and share links.

### Song mode

SONG opens a row of chips under the transport. + ADD appends the current slot as a chip. Tap a chip to edit it: minus and plus set how many times it repeats (the wheel works too), the arrows move it, SLOT changes which pattern it plays, REMOVE deletes it. Chips for empty slots are dimmed.

With SONG on, PLAY runs the list from the top, switching at loop ends and following each slot's tempo. LOOP repeats the song; off, it stops at the end. Tapping A to D during a song plays that slot for one pass, then the song continues. The song is saved with the project and travels in share links.

### Live FX

Hold a button for a momentary effect:

- DELAY (U) throws everything into the tape delay.
- LO-PASS (I) and HI-PASS (O) sweep the master filters.
- STUTTER (P) repeats the current step at 1/32.
- TAPE STOP (J) slows the whole mix to a halt like a tape deck.
- HALF (K) plays at half speed and snaps back to the grid on release.
- REPEAT 1/8 (L) repeats the current step at 1/8.
- SWEEP (;) runs a slow bandpass over the mix.

Double-tap a button to latch it, tap again to release. Drag up or down while holding to set the intensity, shown as a fill. PLAY and STOP clear every latch. With the keyboard, SPACE on a focused button toggles it and ENTER latches it.

### Synth

Rhythm-39 has a built-in synth. USE IN SLOT puts the SYNTH kit on the current pattern slot: the sixteen pads become notes, C at the bottom left rising left to right and bottom to top (an octave and a fourth), and the sequencer records and plays them exactly like drum pads, parameter locks included. The KIT button switches the slot back to a drum kit. Notes held on a pad or key sustain until you let go; in the sequencer a step lasts one step.

The voice is two detuned oscillators (SAW, SQUARE, TRIANGLE or SINE) plus a sub oscillator an octave down, a resonant low-pass filter with its own envelope (CUTOFF, RESO, ENV), DRIVE, an amp envelope (ATTACK, DECAY, SUSTAIN, RELEASE), DETUNE, SUB level and GLIDE. OCT shifts the whole keyboard.

The X/Y surface is for playing: drag on it and two parameters follow, X left to right and Y bottom to top. The buttons under it pick what each axis controls (cutoff, resonance, envelope, decay, release, detune, sub, drive or glide). With the surface focused, the arrow keys nudge it. A change applies to the next note, so ride the surface while a sequence runs. RESET returns the default sound. The synth settings are saved with the project, travel in share links and render into audio exports.

### Master FX

Three dub tools on the master bus, each with WET and one character knob:

- SPRING is a spring reverb fed by the pads. Effects pads send the most, drums a little, bass none; the MIXER changes the sends per pad. DECAY sets the ring, half a second to three.
- TAPE is the delay the pads and the DELAY key throw into, with wow, flutter and tape saturation. FEEDBK at the top self-oscillates.
- CRUSH is a bit reducer with sample-rate dropping. BITS runs from 12 (clean) to 4 (broken).

RESET restores the defaults. Master FX are saved with the project and rendered into exports.

### Swing and volume

SWING pushes off-beats late for a lazier feel. 16TH swings every odd step, 8TH only the off-beat eighths. VOLUME is the master output. Scroll the wheel over either slider to nudge it.

## Input view

### Capturing a sample

- REC records from the microphone, up to 12 seconds. STOP ends the take early. Tick "wait for signal" and recording starts on the first sound.
- LOAD opens an audio file; dragging a file onto the waveform works too.
- RESAMPLE (or SHIFT+REC) bounces one pass of the current pattern into the editor, the classic way to layer or chop a loop. Tick "resample with delay tail" to include the delay ring-out.
- TEST TONE plays a click through the speaker, useful on phones to confirm output still works after the microphone opened.
- PREVIEW plays the trimmed result with the current settings.

### Shaping it

The waveform shows the kept part bright and the trimmed ends dimmed. Tap anywhere on it to move the nearest trim handle. The bar underneath is the live input level while the microphone is open.

- START and END set the played region. GAIN scales the level from silence to double. PITCH shifts in semitones, an octave each way, which also changes the length.
- FADE IN and FADE OUT ramp the edges, drawn as shaded corners on the waveform. PAN places the sample.
- ONE-SHOT plays through. GATE plays only while the pad or key is held. LOOP repeats between the trim points while held. In the sequencer both last one step.
- CHOKE picks which group cuts the sample: the kit default (hats), none, the hats, or the free groups A and B.
- "reverse" flips the audio; the trim points flip with it.

### Assigning

Choose a target pad in the grid at the bottom; it mirrors the output pads with the current kit names, and tapping one plays it. ASSIGN writes the sample to that pad and stores it in the browser. With "store only the trimmed part" ticked, only the region between the trim handles is stored. The pad shows the sample name with an SMP tag and keeps working in the sequencer, mutes and all. REVERT returns the pad to its kit sound. CLEAR EDITOR empties the editor without touching the pad. Samples are shared by all projects.

## Mixer view

One strip per pad for the pattern slot shown:

- LVL from silence to 150 percent, PAN, DLY (send to the tape delay), VRB (send to the spring).
- M mutes, S solos. Solo is exclusive; hold SHIFT to add a second solo. Solo and mute are shared by all slots; the strips belong to the slot.
- R resets the strip, double-click resets one slider, tapping the name auditions the pad.
- COPY MIX and PASTE MIX carry a balance to another slot; CLEAR SOLO and RESET MIX do what they say.

Strips start at the kit's own defaults and are saved with the project. Switching a slot's kit moves untouched strips to the new kit's defaults and keeps edited ones.

## Settings

### Behaviour

- Count-in adds one bar of clicks before recording starts.
- Haptics gives a small buzz on touch pad hits.
- Key caps shows or hides the digits on the pads.
- Loud metronome makes the click easier to hear.
- Hold MUTE makes mute mode momentary.
- Sidechain lets the kick duck the bass and FX pads for a pumping feel.
- High contrast darkens pad text and thickens step outlines.
- Low latency asks the device for its smallest audio buffer, after a reload. The line under it reports the measured output latency; recording compensates for it automatically.
- The Light / Dark switch picks the skin. It follows the system setting until you flip it.
- "Let the delay and reverb ring out after STOP" (on by default) keeps the effect tails going when you stop; off, every STOP silences everything.
- "Resume where the loop stopped" keeps your place after a phone lock instead of skipping ahead.
- "Always show key hints" brings the key letters and legend back on touch devices.
- Position velocity makes the top third of a pad an accent on touch.

### Projects

Every project keeps its own patterns, tempos, song, master FX and mixer. The open one autosaves. NEW PROJECT starts another from the demos, LOAD switches, DUPLICATE copies, DELETE moves one to a session trash with RESTORE, and tapping a name renames it. A share link you open becomes its own project.

### Project files and sharing

- EXPORT saves the project as a JSON file; IMPORT loads one back.
- COPY SHARE LINK puts the whole project in a URL you can send to someone. SHOW QR draws that link as a code another phone can scan. Links longer than 2 KB make a dense code; hold the phone steady.
- RESET DEMO PATTERNS restores the four demos.
- CLEAR ALL SAMPLES returns every pad to its kit sound. It asks for a second click.

### Library

Every sample stored in this browser, with its pad, length and size. LOAD opens it in INPUT, MOVE puts it on another pad (a sample already there goes to the trash), DELETE moves it to the trash, and tapping the name renames it. Trashed samples can be restored until you close the page. The line under the list shows how much storage the site uses. Safari may discard samples after seven days without a visit unless the app is installed to the home screen.

### Export audio

Pick the current pattern (x1 to x8 passes) or the song, optionally a one-bar tail so the delay can ring out, and MET to render the metronome. EXPORT WAV downloads a 16-bit stereo file. Master FX, mixer settings, parameter locks and any latched live FX are rendered. The result is scaled to -1 dBFS if it runs hot.

### MIDI

ENABLE MIDI asks the browser for your controllers (Chrome and Edge). Pick an input and an output and set the channel. Hits on the controller play the pads: GM drum notes 36 to 51 by default, bottom row first, or LEARN your own map by clicking a pad slot and hitting a controller pad. Velocity under 64 is a normal hit, over is an accent. The app can follow an incoming clock and start / stop, and send its own 24 ppqn clock, transport and pad notes to hardware.

### Keyboard

Click a pad slot and press a key to remap it; keys swap if the new one is taken. RESET KEYS restores the default layout. The full keyboard map is printed below the remapper.

## Keyboard reference

- Pads: 1 2 3 4, Q W E R, A S D F, Z X C V (top row to bottom). SHIFT for an accent.
- Transport: SPACE play / stop, ENTER record arm, ESC stop, [ and ] tempo (SHIFT for 5), T tap tempo, M metronome, SHIFT+SPACE song mode.
- Steps: click cycles, drag paints, hold or right-click for locks, BACKSPACE clears the pad (hold it while playing to erase live). With a step focused: arrows move, SPACE cycles, SHIFT+SPACE cycles down, ENTER opens locks.
- Live FX: U I O P and J K L ; while held. On a focused button SPACE toggles, ENTER latches.
- Modes: N mute mode, B keys mode.
- Views: F1 output, F2 input, F3 mixer, F4 settings. ? opens the tour; arrows step through it, ESC closes.
- Undo: CTRL+Z, redo CTRL+SHIFT+Z.
- Wheel: over the tempo box, any slider, the STEPS button or a step lock to nudge it. SHIFT for bigger steps.

## Tips

- Build a track from four loops: make A your groove, duplicate it into B with COPY and PASTE, add a fill on the last bar of B with a 32-step length, then chain A x4, B x1 in the song row.
- A dub mix is mostly sends: raise the spring WET, then push individual pads into it from the MIXER and throw the DELAY key on the snare.
- Resample a busy pattern, assign it to a pad, and play that pad in KEYS mode for instant re-pitched breaks.
- Parameter locks on a single hat row (a few pitch and filter changes) do more for movement than adding pads.
- Use REPLACE recording to fix one bad pad without clearing the rest, and FREE TIME when the feel matters more than the grid.

## Troubleshooting

- No sound: tap a pad first, check the master VOLUME and the phone's silent switch, and look at the display for "audio paused, tap to resume".
- Crackles or dropouts: turn off Low latency, close other audio apps, try wired headphones. The Settings latency line tells you how the device is doing.
- The pads react late: that is output latency, shown in Settings. Recording already compensates for it.
- Samples disappeared: Safari removes site storage after seven days without a visit unless the app is installed to the home screen. Export projects you care about.
- MIDI missing: only Chrome and Edge support Web MIDI. Firefox and Safari show a note instead.
- The page looks stale after an update: reload once. On localhost the service worker is disabled so development always shows fresh files.

## Licences

Rhythm-39 is MIT licensed. The bundled 808 sample kit is the Michael Fischer TR-808 set redistributed by TidalCycles under CC0 1.0; see LICENSES.md for details. "808" is used to mean 808-style; TR-808 is a trademark of Roland Corporation, which is not associated with this project.
