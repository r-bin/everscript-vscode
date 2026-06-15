import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 20,
    "instructionAddress": 9668276,
    "expectedSize": 5,
    "text": "WRITE $234a = 0x0063"
  },
  {
    "opcode": 20,
    "instructionAddress": 9740243,
    "expectedSize": 4,
    "text": "WRITE Hut/house to enter ($234b) = 0x0008"
  },
  {
    "opcode": 20,
    "instructionAddress": 9740269,
    "expectedSize": 4,
    "text": "WRITE Hut/house to enter ($234b) = 0x0004"
  },
  {
    "opcode": 20,
    "instructionAddress": 9948134,
    "expectedSize": 4,
    "text": "WRITE $2355 = 0x0002"
  },
  {
    "opcode": 20,
    "instructionAddress": 9877704,
    "expectedSize": 4,
    "text": "WRITE $2348 = 0x0003"
  },
  {
    "opcode": 20,
    "instructionAddress": 9885299,
    "expectedSize": 4,
    "text": "WRITE Hut/house to enter ($234b) = 0x0000"
  },
  {
    "opcode": 20,
    "instructionAddress": 9946517,
    "expectedSize": 4,
    "text": "WRITE $2355 = 0x0002"
  },
  {
    "opcode": 20,
    "instructionAddress": 9887607,
    "expectedSize": 4,
    "text": "WRITE $2348 = 0x0003"
  },
  {
    "opcode": 20,
    "instructionAddress": 9883392,
    "expectedSize": 4,
    "text": "WRITE $2357 = 0x0000"
  },
  {
    "opcode": 20,
    "instructionAddress": 9883396,
    "expectedSize": 4,
    "text": "WRITE $2358 = 0x0000"
  },
  {
    "opcode": 20,
    "instructionAddress": 9883420,
    "expectedSize": 4,
    "text": "WRITE $2350 = 0x0000"
  },
  {
    "opcode": 20,
    "instructionAddress": 9883731,
    "expectedSize": 4,
    "text": "WRITE $2350 = 0x0000"
  },
  {
    "opcode": 20,
    "instructionAddress": 9802628,
    "expectedSize": 4,
    "text": "WRITE $2357 = 0x0001"
  },
  {
    "opcode": 20,
    "instructionAddress": 9802632,
    "expectedSize": 4,
    "text": "WRITE $2358 = 0x0001"
  },
  {
    "opcode": 20,
    "instructionAddress": 9802656,
    "expectedSize": 4,
    "text": "WRITE $2350 = 0x0000"
  },
  {
    "opcode": 20,
    "instructionAddress": 9802952,
    "expectedSize": 4,
    "text": "WRITE $2350 = 0x0000"
  },
  {
    "opcode": 20,
    "instructionAddress": 9804327,
    "expectedSize": 4,
    "text": "WRITE $2357 = 0x0002"
  },
  {
    "opcode": 20,
    "instructionAddress": 9804331,
    "expectedSize": 4,
    "text": "WRITE $2358 = 0x0002"
  },
  {
    "opcode": 20,
    "instructionAddress": 9804355,
    "expectedSize": 4,
    "text": "WRITE $2350 = 0x0000"
  },
  {
    "opcode": 20,
    "instructionAddress": 9804616,
    "expectedSize": 4,
    "text": "WRITE $2350 = 0x0000"
  },
  {
    "opcode": 20,
    "instructionAddress": 10011723,
    "expectedSize": 4,
    "text": "WRITE $2348 = 0x0006"
  },
  {
    "opcode": 20,
    "instructionAddress": 10013107,
    "expectedSize": 5,
    "text": "WRITE Hut/house to enter ($234b) = 0x0089"
  },
  {
    "opcode": 20,
    "instructionAddress": 10018435,
    "expectedSize": 4,
    "text": "WRITE $2348 = 0x0006"
  },
  {
    "opcode": 20,
    "instructionAddress": 10063007,
    "expectedSize": 4,
    "text": "WRITE $2355 = 0x0001"
  },
  {
    "opcode": 20,
    "instructionAddress": 10063247,
    "expectedSize": 4,
    "text": "WRITE $2356 = 0x0003"
  },
  {
    "opcode": 20,
    "instructionAddress": 10146002,
    "expectedSize": 4,
    "text": "WRITE $2356 = 0x0004"
  },
  {
    "opcode": 20,
    "instructionAddress": 10142610,
    "expectedSize": 4,
    "text": "WRITE Hut/house to enter ($234b) = 0x0000"
  },
  {
    "opcode": 20,
    "instructionAddress": 9996965,
    "expectedSize": 9,
    "text": "WRITE Hut/house to enter ($234b) = (($234b)&0xff) & 15"
  },
  {
    "opcode": 20,
    "instructionAddress": 9997139,
    "expectedSize": 4,
    "text": "WRITE Hut/house to enter ($234b) = 0x0000"
  },
  {
    "opcode": 20,
    "instructionAddress": 9998625,
    "expectedSize": 9,
    "text": "WRITE Hut/house to enter ($234b) = (($234b)&0xff) & 15"
  },
  {
    "opcode": 20,
    "instructionAddress": 9998684,
    "expectedSize": 4,
    "text": "WRITE Hut/house to enter ($234b) = 0x0000"
  },
  {
    "opcode": 20,
    "instructionAddress": 10001596,
    "expectedSize": 4,
    "text": "WRITE Hut/house to enter ($234b) = 0x0000"
  },
  {
    "opcode": 20,
    "instructionAddress": 10146810,
    "expectedSize": 4,
    "text": "WRITE $2348 = 0x0009"
  },
  {
    "opcode": 20,
    "instructionAddress": 10192344,
    "expectedSize": 4,
    "text": "WRITE $2348 = 0x0009"
  },
  {
    "opcode": 20,
    "instructionAddress": 10194892,
    "expectedSize": 4,
    "text": "WRITE $2348 = 0x0009"
  },
  {
    "opcode": 20,
    "instructionAddress": 10190871,
    "expectedSize": 4,
    "text": "WRITE $2348 = 0x0009"
  },
  {
    "opcode": 20,
    "instructionAddress": 10193138,
    "expectedSize": 4,
    "text": "WRITE $2348 = 0x0009"
  },
  {
    "opcode": 20,
    "instructionAddress": 10198858,
    "expectedSize": 4,
    "text": "WRITE $2348 = 0x0009"
  },
  {
    "opcode": 20,
    "instructionAddress": 10195704,
    "expectedSize": 4,
    "text": "WRITE $2348 = 0x0009"
  },
  {
    "opcode": 20,
    "instructionAddress": 10216120,
    "expectedSize": 4,
    "text": "WRITE $2348 = 0x0009"
  }
];

test('opcode corpus 0x14', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
