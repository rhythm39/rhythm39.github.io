// Rhythm-39 unit tests: run with `npm test` (Node 18+, built-in test runner)
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../core.js');

test('validLength snaps to the allowed lengths per beat', () => {
  assert.equal(C.validLength(16, 4), 16);
  assert.equal(C.validLength(17, 4), 16);
  assert.equal(C.validLength(30, 4), 32);
  assert.equal(C.validLength(undefined, 4), 16);
  assert.equal(C.validLength(16, 3), 12);
  assert.equal(C.validLength(100, 3), 48);
  assert.equal(C.validBeat(5), 4);
});

test('step cells: levels, locks and canonical form', () => {
  assert.equal(C.stepLevel(2), 2);
  assert.equal(C.stepLevel({ l: 1, p: -5 }), 1);
  assert.equal(C.stepLocks(1), null);
  assert.deepEqual(C.normStep({ l: 1, p: 0, f: 1, s: 1, t: 0 }), 1);
  assert.deepEqual(C.normStep({ l: 2, p: -5, f: 0.4 }), { l: 2, p: -5, f: 0.4 });
  assert.deepEqual(C.normStep({ l: 0, p: 3 }), { l: 0, p: 3 }, 'an off step keeps parked locks');
  assert.equal(C.normStep({ l: 0 }), 0);
  assert.equal(C.normStep('7'), 2);
  const row = [0, { l: 1, p: 3 }, 2];
  C.setStepLevel(row, 1, 2);
  assert.deepEqual(row[1], { l: 2, p: 3 }, 'painting a level keeps the locks');
  C.setStepLevel(row, 1, 0);
  assert.deepEqual(row[1], { l: 0, p: 3 }, 'off keeps the locks');
  assert.equal(C.stepLevel(row[1]), 0);
  assert.equal(C.encodeRow([row[1]]), '(0p3)');
  assert.deepEqual(C.decodeRow('(0p3)').map(C.normStep), [{ l: 0, p: 3 }]);
});

test('share rows round-trip plain and locked steps', () => {
  const row = [0, 1, 2, { l: 2, p: -5, f: 0.4, s: 1.5, t: -0.25 }, 0, { l: 1, t: 0.5 }];
  const enc = C.encodeRow(row);
  assert.equal(enc, '012(2p-5f40s150t-25)0(1t50)');
  const dec = C.decodeRow(enc).map(C.normStep);
  assert.deepEqual(dec, row);
  assert.equal(C.encodeRow([1, 0, 0, 1]), '1001', 'plain rows serialize as before');
});

test('normalizePattern pads rows and picks the length from the longest row', () => {
  const p = C.normalizePattern([[1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [1]], 4, 16);
  assert.equal(p.length, 16);
  assert.equal(p[0].length, 32);
  assert.equal(p[1][0], 1);
  assert.equal(p[15].length, 32);
  const q = C.normalizePattern(null, 4, 16);
  assert.equal(q[0].length, 16);
});

test('resizePattern repeats when growing and cuts when shrinking', () => {
  const rows = [[1, 0, 2, 0], [0, { l: 1, p: 2 }, 0, 0]];
  C.resizePattern(rows, 8);
  assert.deepEqual(rows[0], [1, 0, 2, 0, 1, 0, 2, 0]);
  assert.notEqual(rows[1][1], rows[1][5], 'repeated locks are copies, not shared');
  assert.deepEqual(rows[1][5], { l: 1, p: 2 });
  C.resizePattern(rows, 2);
  assert.deepEqual(rows[0], [1, 0]);
});

test('stepTime applies swing on the right steps and timing locks', () => {
  const dur = 0.125;
  assert.equal(C.stepTime(0, dur), 0);
  assert.equal(C.stepTime(4, dur), 0.5);
  assert.ok(C.stepTime(1, dur, 1, 16) > dur, '16th swing delays odd steps');
  assert.equal(C.stepTime(1, dur, 1, 8), dur, '8th swing leaves step 1 alone');
  assert.ok(C.stepTime(2, dur, 1, 8) > 2 * dur, '8th swing delays step 2');
  assert.equal(C.stepTime(3, dur, 0, 16, { t: -0.5 }), 3 * dur - dur / 2);
  assert.ok(Math.abs(C.stepTime(0, dur, 0.5, 16, { t: 0.3 }) - 0.3 * dur) < 1e-12);
});

test('quantizeHit picks the nearest step and keeps the offset', () => {
  const dur = 0.2;
  const near = C.quantizeHit(0.02, dur, 5, 16);
  assert.equal(near.target, 5); assert.equal(near.ahead, false); assert.ok(Math.abs(near.offset - 0.1) < 1e-12);
  const late = C.quantizeHit(0.15, dur, 5, 16);
  assert.equal(late.target, 6); assert.equal(late.ahead, true);
  assert.ok(Math.abs(late.offset - (-0.25)) < 1e-12);
  assert.equal(C.quantizeHit(0.15, dur, 15, 16).target, 0, 'wraps at the pattern end');
});

test('share payload round-trips through URL-safe base64', () => {
  const d = { v: 3, b: [78, 74, 98, 92], p: [['1010', '(2p-5)000']], s: 25, x: [0.5, 1.4, 1, 0.48, 0, 8] };
  const s = C.shareEncode(d);
  assert.match(s, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(C.shareDecode(s), d);
});

test('encodeWav writes a valid 16-bit RIFF header and clamps samples', () => {
  const buf = { numberOfChannels: 2, length: 4, sampleRate: 44100, getChannelData: c => new Float32Array(c === 0 ? [0, 0.5, -0.5, 2] : [1, -1, 0, -2]) };
  const ab = C.encodeWav(buf);
  const v = new DataView(ab);
  assert.equal(ab.byteLength, 44 + 4 * 2 * 2);
  assert.equal(String.fromCharCode(v.getUint8(0), v.getUint8(1), v.getUint8(2), v.getUint8(3)), 'RIFF');
  assert.equal(v.getUint16(22, true), 2);
  assert.equal(v.getUint32(24, true), 44100);
  assert.equal(v.getInt16(44, true), 0);
  assert.equal(v.getInt16(46, true), 32767, 'right channel first sample is full scale');
  assert.equal(v.getInt16(44 + 3 * 4, true), 32767, 'over-range clamps');
  assert.equal(v.getInt16(46 + 3 * 4, true), -32768);
});
