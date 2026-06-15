import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 24,
    "instructionAddress": 9667850,
    "expectedSize": 4,
    "text": "WRITE PRIZE 1 RATE ($239b) = 0x000a"
  },
  {
    "opcode": 24,
    "instructionAddress": 9740645,
    "expectedSize": 4,
    "text": "WRITE $23bf = 0x0000"
  },
  {
    "opcode": 24,
    "instructionAddress": 9747963,
    "expectedSize": 6,
    "text": "WRITE SCREEN SHAKING MAGNITUDE Y ($240b) = $2854"
  },
  {
    "opcode": 24,
    "instructionAddress": 9670956,
    "expectedSize": 4,
    "text": "WRITE CHANGE DOGGO ($2443) = Wolf (0x02)"
  },
  {
    "opcode": 24,
    "instructionAddress": 10130096,
    "expectedSize": 5,
    "text": "WRITE $242f = 0x0080"
  },
  {
    "opcode": 24,
    "instructionAddress": 10214832,
    "expectedSize": 4,
    "text": "WRITE $23bf = 0x0001"
  },
  {
    "opcode": 24,
    "instructionAddress": 10007432,
    "expectedSize": 4,
    "text": "WRITE PRIZE 2 RATE ($239d) = 0x0003"
  },
  {
    "opcode": 24,
    "instructionAddress": 10083229,
    "expectedSize": 5,
    "text": "WRITE PRIZE 1 RATE ($239b) = 0x0064"
  },
  {
    "opcode": 24,
    "instructionAddress": 10134223,
    "expectedSize": 4,
    "text": "WRITE CHANGE DOGGO ($2443) = Poodle (0x08)"
  },
  {
    "opcode": 24,
    "instructionAddress": 9935596,
    "expectedSize": 6,
    "text": "WRITE PRIZE 3 DROP ($23a5) = 0x0807"
  },
  {
    "opcode": 24,
    "instructionAddress": 9680884,
    "expectedSize": 4,
    "text": "WRITE PRIZE 2 DROP ($23a3) = 0x0001"
  },
  {
    "opcode": 24,
    "instructionAddress": 9680892,
    "expectedSize": 6,
    "text": "WRITE PRIZE 3 DROP ($23a5) = 0x0801"
  },
  {
    "opcode": 24,
    "instructionAddress": 9684482,
    "expectedSize": 4,
    "text": "WRITE PRIZE 2 RATE ($239d) = 0x0002"
  },
  {
    "opcode": 24,
    "instructionAddress": 10126344,
    "expectedSize": 4,
    "text": "WRITE PRIZE 1 RATE ($239b) = 0x0003"
  },
  {
    "opcode": 24,
    "instructionAddress": 9736204,
    "expectedSize": 4,
    "text": "WRITE PRIZE 2 QTY  ($23a9) = 0x0014"
  },
  {
    "opcode": 24,
    "instructionAddress": 9804373,
    "expectedSize": 4,
    "text": "WRITE PRIZE 3 RATE ($239f) = 0x0001"
  },
  {
    "opcode": 24,
    "instructionAddress": 10019536,
    "expectedSize": 4,
    "text": "WRITE $2455 = last entity ($0341)"
  },
  {
    "opcode": 24,
    "instructionAddress": 10007549,
    "expectedSize": 4,
    "text": "WRITE $2433 = 0x0003"
  },
  {
    "opcode": 24,
    "instructionAddress": 10192578,
    "expectedSize": 4,
    "text": "WRITE $2433 = 0x000a"
  },
  {
    "opcode": 24,
    "instructionAddress": 9679312,
    "expectedSize": 4,
    "text": "WRITE PRIZE 2 RATE ($239d) = 0x0002"
  },
  {
    "opcode": 24,
    "instructionAddress": 9823635,
    "expectedSize": 4,
    "text": "WRITE $2433 = 0x0001"
  },
  {
    "opcode": 24,
    "instructionAddress": 9691369,
    "expectedSize": 6,
    "text": "WRITE PRIZE 3 DROP ($23a5) = 0x0801"
  },
  {
    "opcode": 24,
    "instructionAddress": 9802724,
    "expectedSize": 4,
    "text": "WRITE PRIZE 2 DROP ($23a3) = 0x0001"
  },
  {
    "opcode": 24,
    "instructionAddress": 9952883,
    "expectedSize": 6,
    "text": "WRITE PRIZE 1 DROP ($23a1) = 0x0801"
  },
  {
    "opcode": 24,
    "instructionAddress": 10076911,
    "expectedSize": 6,
    "text": "WRITE PRIZE 3 DROP ($23a5) = 0x020c"
  },
  {
    "opcode": 24,
    "instructionAddress": 9683692,
    "expectedSize": 6,
    "text": "WRITE PRIZE 1 DROP ($23a1) = 0x0800"
  },
  {
    "opcode": 24,
    "instructionAddress": 9877076,
    "expectedSize": 7,
    "text": "WRITE $236b = RAND & 3"
  },
  {
    "opcode": 24,
    "instructionAddress": 9999681,
    "expectedSize": 10,
    "text": "WRITE $24b5 = $24b5 - 0x37"
  },
  {
    "opcode": 24,
    "instructionAddress": 10064105,
    "expectedSize": 4,
    "text": "WRITE $2433 = 0x0001"
  },
  {
    "opcode": 24,
    "instructionAddress": 10018877,
    "expectedSize": 4,
    "text": "WRITE $2437 = 0x0007"
  },
  {
    "opcode": 24,
    "instructionAddress": 9798951,
    "expectedSize": 4,
    "text": "WRITE $23bf = 0x0001"
  },
  {
    "opcode": 24,
    "instructionAddress": 10087995,
    "expectedSize": 4,
    "text": "WRITE PRIZE 2 RATE ($239d) = 0x0005"
  },
  {
    "opcode": 24,
    "instructionAddress": 10001559,
    "expectedSize": 4,
    "text": "WRITE CHANGE DOGGO ($2443) = Poodle (0x08)"
  },
  {
    "opcode": 24,
    "instructionAddress": 9683905,
    "expectedSize": 4,
    "text": "WRITE $2433 = 0x0001"
  },
  {
    "opcode": 24,
    "instructionAddress": 10007573,
    "expectedSize": 4,
    "text": "WRITE $2433 = 0x0003"
  },
  {
    "opcode": 24,
    "instructionAddress": 9944744,
    "expectedSize": 4,
    "text": "WRITE CHANGE DOGGO ($2443) = Greyhound (0x06)"
  },
  {
    "opcode": 24,
    "instructionAddress": 10021053,
    "expectedSize": 4,
    "text": "WRITE $2437 = 0x0007"
  },
  {
    "opcode": 24,
    "instructionAddress": 9733322,
    "expectedSize": 4,
    "text": "WRITE $24b7 = 0x0000"
  },
  {
    "opcode": 24,
    "instructionAddress": 9955571,
    "expectedSize": 4,
    "text": "WRITE PRIZE 2 RATE ($239d) = 0x0000"
  },
  {
    "opcode": 24,
    "instructionAddress": 9951455,
    "expectedSize": 6,
    "text": "WRITE PRIZE 1 DROP ($23a1) = 0x0801"
  },
  {
    "opcode": 24,
    "instructionAddress": 10125781,
    "expectedSize": 4,
    "text": "WRITE PRIZE 2 DROP ($23a3) = 0x0001"
  },
  {
    "opcode": 24,
    "instructionAddress": 9804365,
    "expectedSize": 4,
    "text": "WRITE PRIZE 1 RATE ($239b) = 0x000a"
  },
  {
    "opcode": 24,
    "instructionAddress": 10063173,
    "expectedSize": 4,
    "text": "WRITE $238f = 0x000f"
  },
  {
    "opcode": 24,
    "instructionAddress": 10064097,
    "expectedSize": 4,
    "text": "WRITE $2433 = 0x0001"
  },
  {
    "opcode": 24,
    "instructionAddress": 9680878,
    "expectedSize": 6,
    "text": "WRITE PRIZE 1 DROP ($23a1) = 0x0800"
  },
  {
    "opcode": 24,
    "instructionAddress": 9736236,
    "expectedSize": 6,
    "text": "WRITE $23c5 = 0x0280"
  },
  {
    "opcode": 24,
    "instructionAddress": 9739152,
    "expectedSize": 4,
    "text": "WRITE $23bf = 0x0000"
  },
  {
    "opcode": 24,
    "instructionAddress": 9679509,
    "expectedSize": 4,
    "text": "WRITE $23bf = 0x0000"
  },
  {
    "opcode": 24,
    "instructionAddress": 9804369,
    "expectedSize": 4,
    "text": "WRITE PRIZE 2 RATE ($239d) = 0x0003"
  },
  {
    "opcode": 24,
    "instructionAddress": 9812771,
    "expectedSize": 4,
    "text": "WRITE PRIZE 2 RATE ($239d) = 0x0003"
  },
  {
    "opcode": 24,
    "instructionAddress": 10216196,
    "expectedSize": 4,
    "text": "WRITE $2433 = 0x0001"
  },
  {
    "opcode": 24,
    "instructionAddress": 9683688,
    "expectedSize": 4,
    "text": "WRITE PRIZE 3 RATE ($239f) = 0x0001"
  },
  {
    "opcode": 24,
    "instructionAddress": 9681120,
    "expectedSize": 4,
    "text": "WRITE $2433 = 0x000a"
  },
  {
    "opcode": 24,
    "instructionAddress": 10064113,
    "expectedSize": 4,
    "text": "WRITE $2433 = 0x0001"
  },
  {
    "opcode": 24,
    "instructionAddress": 9752076,
    "expectedSize": 4,
    "text": "WRITE $238f = 0x0000"
  },
  {
    "opcode": 24,
    "instructionAddress": 10008725,
    "expectedSize": 10,
    "text": "WRITE MAP Y end   ($23ef) = $23eb + 0xe0"
  },
  {
    "opcode": 24,
    "instructionAddress": 9736308,
    "expectedSize": 4,
    "text": "WRITE $2433 = 0x0005"
  },
  {
    "opcode": 24,
    "instructionAddress": 10146806,
    "expectedSize": 4,
    "text": "WRITE CHANGE DOGGO ($2443) = Toaster (0x0C)"
  },
  {
    "opcode": 24,
    "instructionAddress": 10192340,
    "expectedSize": 4,
    "text": "WRITE CHANGE DOGGO ($2443) = Toaster (0x0C)"
  },
  {
    "opcode": 24,
    "instructionAddress": 10195708,
    "expectedSize": 4,
    "text": "WRITE $23bf = 0x0000"
  },
  {
    "opcode": 24,
    "instructionAddress": 9667878,
    "expectedSize": 4,
    "text": "WRITE PRIZE 3 QTY  ($23ab) = 0x0005"
  },
  {
    "opcode": 24,
    "instructionAddress": 9952889,
    "expectedSize": 4,
    "text": "WRITE PRIZE 2 DROP ($23a3) = 0x0001"
  },
  {
    "opcode": 24,
    "instructionAddress": 9734557,
    "expectedSize": 4,
    "text": "WRITE $23bf = 0x0000"
  },
  {
    "opcode": 24,
    "instructionAddress": 10007517,
    "expectedSize": 4,
    "text": "WRITE $2433 = 0x0003"
  },
  {
    "opcode": 24,
    "instructionAddress": 9681076,
    "expectedSize": 4,
    "text": "WRITE $2433 = 0x000a"
  },
  {
    "opcode": 24,
    "instructionAddress": 9672028,
    "expectedSize": 6,
    "text": "WRITE PRIZE 1 DROP ($23a1) = 0x0800"
  },
  {
    "opcode": 24,
    "instructionAddress": 10009638,
    "expectedSize": 4,
    "text": "WRITE $2433 = 0x0001"
  },
  {
    "opcode": 24,
    "instructionAddress": 10007533,
    "expectedSize": 4,
    "text": "WRITE $2433 = 0x0003"
  },
  {
    "opcode": 24,
    "instructionAddress": 10063027,
    "expectedSize": 4,
    "text": "WRITE $2455 = last entity ($0341)"
  },
  {
    "opcode": 24,
    "instructionAddress": 9691375,
    "expectedSize": 4,
    "text": "WRITE $23bf = 0x0000"
  },
  {
    "opcode": 24,
    "instructionAddress": 10011712,
    "expectedSize": 4,
    "text": "WRITE $23bf = 0x0001"
  },
  {
    "opcode": 24,
    "instructionAddress": 10146696,
    "expectedSize": 13,
    "text": "WRITE CHANGE DOGGO ($2443) = Poodle (0x08)"
  },
  {
    "opcode": 24,
    "instructionAddress": 9812785,
    "expectedSize": 4,
    "text": "WRITE PRIZE 2 DROP ($23a3) = 0x0001"
  },
  {
    "opcode": 24,
    "instructionAddress": 10064185,
    "expectedSize": 4,
    "text": "WRITE $2433 = 0x0001"
  },
  {
    "opcode": 24,
    "instructionAddress": 10079708,
    "expectedSize": 4,
    "text": "WRITE CHANGE DOGGO ($2443) = Poodle (0x08)"
  },
  {
    "opcode": 24,
    "instructionAddress": 9684500,
    "expectedSize": 4,
    "text": "WRITE PRIZE 2 QTY  ($23a9) = 0x000a"
  },
  {
    "opcode": 24,
    "instructionAddress": 9744838,
    "expectedSize": 4,
    "text": "WRITE PRIZE 2 DROP ($23a3) = 0x0001"
  },
  {
    "opcode": 24,
    "instructionAddress": 9740572,
    "expectedSize": 4,
    "text": "WRITE $2455 = last entity ($0341)"
  },
  {
    "opcode": 24,
    "instructionAddress": 9736564,
    "expectedSize": 4,
    "text": "WRITE $2433 = 0x000a"
  },
  {
    "opcode": 24,
    "instructionAddress": 9684014,
    "expectedSize": 4,
    "text": "WRITE $238f = 0x0004"
  },
  {
    "opcode": 24,
    "instructionAddress": 9798878,
    "expectedSize": 4,
    "text": "WRITE $23db = 0x0010"
  },
  {
    "opcode": 24,
    "instructionAddress": 9804392,
    "expectedSize": 6,
    "text": "WRITE PRIZE 3 DROP ($23a5) = 0x0802"
  },
  {
    "opcode": 24,
    "instructionAddress": 9812845,
    "expectedSize": 4,
    "text": "WRITE $23bf = 0x0001"
  },
  {
    "opcode": 24,
    "instructionAddress": 9687768,
    "expectedSize": 4,
    "text": "WRITE $2437 = 0x0007"
  },
  {
    "opcode": 24,
    "instructionAddress": 9734514,
    "expectedSize": 4,
    "text": "WRITE $2433 = 0x000a"
  },
  {
    "opcode": 24,
    "instructionAddress": 10125790,
    "expectedSize": 6,
    "text": "WRITE PRIZE 3 DROP ($23a5) = 0x0802"
  },
  {
    "opcode": 24,
    "instructionAddress": 10087999,
    "expectedSize": 4,
    "text": "WRITE PRIZE 3 RATE ($239f) = 0x0001"
  },
  {
    "opcode": 24,
    "instructionAddress": 9816691,
    "expectedSize": 4,
    "text": "WRITE CHANGE DOGGO ($2443) = Greyhound (0x06)"
  },
  {
    "opcode": 24,
    "instructionAddress": 10128808,
    "expectedSize": 13,
    "text": "WRITE $242b = (signed arg0 + 0x20) - 0x80"
  },
  {
    "opcode": 24,
    "instructionAddress": 9752140,
    "expectedSize": 10,
    "text": "WRITE $23b9 = $23b9 + 0xd0 signed"
  },
  {
    "opcode": 24,
    "instructionAddress": 9681054,
    "expectedSize": 4,
    "text": "WRITE $2433 = 0x0006"
  },
  {
    "opcode": 24,
    "instructionAddress": 9672216,
    "expectedSize": 4,
    "text": "WRITE $2433 = 0x0002"
  },
  {
    "opcode": 24,
    "instructionAddress": 9955585,
    "expectedSize": 6,
    "text": "WRITE PRIZE 2 DROP ($23a3) = 0x0801"
  },
  {
    "opcode": 24,
    "instructionAddress": 9810729,
    "expectedSize": 4,
    "text": "WRITE CHANGE DOGGO ($2443) = Greyhound (0x06)"
  },
  {
    "opcode": 24,
    "instructionAddress": 9999766,
    "expectedSize": 4,
    "text": "WRITE $238f = 0x0000"
  },
  {
    "opcode": 24,
    "instructionAddress": 9672020,
    "expectedSize": 4,
    "text": "WRITE PRIZE 2 RATE ($239d) = 0x0005"
  },
  {
    "opcode": 24,
    "instructionAddress": 9683995,
    "expectedSize": 4,
    "text": "WRITE $23bf = 0x0000"
  },
  {
    "opcode": 24,
    "instructionAddress": 9672040,
    "expectedSize": 4,
    "text": "WRITE PRIZE 3 DROP ($23a5) = 0x0001"
  },
  {
    "opcode": 24,
    "instructionAddress": 9933030,
    "expectedSize": 4,
    "text": "WRITE $23bf = 0x0000"
  },
  {
    "opcode": 24,
    "instructionAddress": 10193134,
    "expectedSize": 4,
    "text": "WRITE CHANGE DOGGO ($2443) = Toaster (0x0C)"
  }
];

test('opcode corpus 0x18', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
