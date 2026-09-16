/* Rhythm-39 · microphone capture on the audio thread. Posts Float32 chunks of the
   first input channel to the main thread; replaces the deprecated ScriptProcessor
   path in sampler.js where AudioWorklet exists. */
class RhythmCapture extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input[0] && input[0].length) this.port.postMessage(input[0].slice());
    return true;
  }
}
registerProcessor('rhythm-capture', RhythmCapture);
