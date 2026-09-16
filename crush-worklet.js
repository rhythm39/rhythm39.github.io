/* Rhythm-39 · CRUSH: bit depth reduction plus sample-and-hold downsampling.
   Runs on the audio thread as an AudioWorkletProcessor. Parameters:
   bits (4..12), reduce (1..8, hold each sample for this many frames). */
class RhythmCrush extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'bits', defaultValue: 8, minValue: 2, maxValue: 16, automationRate: 'k-rate' },
      { name: 'reduce', defaultValue: 1, minValue: 1, maxValue: 16, automationRate: 'k-rate' },
    ];
  }
  constructor() {
    super();
    this.hold = [0, 0];
    this.count = 0;
  }
  process(inputs, outputs, params) {
    const input = inputs[0], output = outputs[0];
    if (!input || !input.length) return true;
    const bits = params.bits[0], reduce = Math.max(1, Math.round(params.reduce[0]));
    const steps = Math.pow(2, bits - 1);
    const chans = output.length;
    const n = output[0].length;
    for (let i = 0; i < n; i++) {
      if (this.count === 0) {
        for (let c = 0; c < chans; c++) {
          const src = input[Math.min(c, input.length - 1)];
          const x = src ? src[i] : 0;
          this.hold[c] = Math.round(x * steps) / steps;
        }
      }
      this.count = (this.count + 1) % reduce;
      for (let c = 0; c < chans; c++) output[c][i] = this.hold[c];
    }
    return true;
  }
}
registerProcessor('rhythm-crush', RhythmCrush);
