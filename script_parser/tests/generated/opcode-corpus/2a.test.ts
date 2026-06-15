import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 42,
    "instructionAddress": 9752489,
    "expectedSize": 4,
    "text": "Make $283b script controlled"
  },
  {
    "opcode": 42,
    "instructionAddress": 9678641,
    "expectedSize": 4,
    "text": "Make $2455 script controlled"
  },
  {
    "opcode": 42,
    "instructionAddress": 9744956,
    "expectedSize": 2,
    "text": "Make non-controlled char script controlled"
  },
  {
    "opcode": 42,
    "instructionAddress": 9745432,
    "expectedSize": 2,
    "text": "Make non-controlled char script controlled"
  },
  {
    "opcode": 42,
    "instructionAddress": 9948218,
    "expectedSize": 4,
    "text": "Make $2836 script controlled"
  },
  {
    "opcode": 42,
    "instructionAddress": 9877428,
    "expectedSize": 4,
    "text": "Make $2857 script controlled"
  },
  {
    "opcode": 42,
    "instructionAddress": 9877450,
    "expectedSize": 4,
    "text": "Make $284b script controlled"
  },
  {
    "opcode": 42,
    "instructionAddress": 9877472,
    "expectedSize": 4,
    "text": "Make $283f script controlled"
  },
  {
    "opcode": 42,
    "instructionAddress": 9877488,
    "expectedSize": 4,
    "text": "Make $2839 script controlled"
  },
  {
    "opcode": 42,
    "instructionAddress": 10087767,
    "expectedSize": 4,
    "text": "Make $244d script controlled"
  },
  {
    "opcode": 42,
    "instructionAddress": 10087808,
    "expectedSize": 4,
    "text": "Make $2835 script controlled"
  },
  {
    "opcode": 42,
    "instructionAddress": 9885180,
    "expectedSize": 4,
    "text": "Make $283f script controlled"
  },
  {
    "opcode": 42,
    "instructionAddress": 9885184,
    "expectedSize": 4,
    "text": "Make $2841 script controlled"
  },
  {
    "opcode": 42,
    "instructionAddress": 9885188,
    "expectedSize": 4,
    "text": "Make $283d script controlled"
  },
  {
    "opcode": 42,
    "instructionAddress": 9816878,
    "expectedSize": 4,
    "text": "Make $2837 script controlled"
  },
  {
    "opcode": 42,
    "instructionAddress": 9810773,
    "expectedSize": 4,
    "text": "Make $2455 script controlled"
  },
  {
    "opcode": 42,
    "instructionAddress": 9810867,
    "expectedSize": 4,
    "text": "Make $2455 script controlled"
  },
  {
    "opcode": 42,
    "instructionAddress": 9814622,
    "expectedSize": 2,
    "text": "Make last entity ($0341) script controlled"
  },
  {
    "opcode": 42,
    "instructionAddress": 9814641,
    "expectedSize": 2,
    "text": "Make last entity ($0341) script controlled"
  },
  {
    "opcode": 42,
    "instructionAddress": 9814660,
    "expectedSize": 2,
    "text": "Make last entity ($0341) script controlled"
  },
  {
    "opcode": 42,
    "instructionAddress": 9814686,
    "expectedSize": 2,
    "text": "Make last entity ($0341) script controlled"
  },
  {
    "opcode": 42,
    "instructionAddress": 9814712,
    "expectedSize": 2,
    "text": "Make last entity ($0341) script controlled"
  },
  {
    "opcode": 42,
    "instructionAddress": 9809973,
    "expectedSize": 4,
    "text": "Make $283b script controlled"
  },
  {
    "opcode": 42,
    "instructionAddress": 9742505,
    "expectedSize": 4,
    "text": "Make $2455 script controlled"
  },
  {
    "opcode": 42,
    "instructionAddress": 10136337,
    "expectedSize": 4,
    "text": "Make $2835 script controlled"
  },
  {
    "opcode": 42,
    "instructionAddress": 10022886,
    "expectedSize": 4,
    "text": "Make $2836 script controlled"
  },
  {
    "opcode": 42,
    "instructionAddress": 10063057,
    "expectedSize": 4,
    "text": "Make $2455 script controlled"
  },
  {
    "opcode": 42,
    "instructionAddress": 10063107,
    "expectedSize": 4,
    "text": "Make $2455 script controlled"
  },
  {
    "opcode": 42,
    "instructionAddress": 10145946,
    "expectedSize": 4,
    "text": "Make $2455 script controlled"
  },
  {
    "opcode": 42,
    "instructionAddress": 10128543,
    "expectedSize": 4,
    "text": "Make $2837 script controlled"
  },
  {
    "opcode": 42,
    "instructionAddress": 10129188,
    "expectedSize": 4,
    "text": "Make $283b script controlled"
  },
  {
    "opcode": 42,
    "instructionAddress": 10129192,
    "expectedSize": 14,
    "text": "Make $283f script controlled"
  },
  {
    "opcode": 42,
    "instructionAddress": 10214600,
    "expectedSize": 4,
    "text": "Make $285b script controlled"
  },
  {
    "opcode": 42,
    "instructionAddress": 10192473,
    "expectedSize": 4,
    "text": "Make $283d script controlled"
  },
  {
    "opcode": 42,
    "instructionAddress": 10192494,
    "expectedSize": 4,
    "text": "Make $2839 script controlled"
  },
  {
    "opcode": 42,
    "instructionAddress": 10192498,
    "expectedSize": 4,
    "text": "Make $283b script controlled"
  },
  {
    "opcode": 42,
    "instructionAddress": 10192514,
    "expectedSize": 4,
    "text": "Make $2837 script controlled"
  },
  {
    "opcode": 42,
    "instructionAddress": 10192518,
    "expectedSize": 4,
    "text": "Make $283b script controlled"
  },
  {
    "opcode": 42,
    "instructionAddress": 10192534,
    "expectedSize": 4,
    "text": "Make $2837 script controlled"
  },
  {
    "opcode": 42,
    "instructionAddress": 10192538,
    "expectedSize": 4,
    "text": "Make $2839 script controlled"
  },
  {
    "opcode": 42,
    "instructionAddress": 9626087,
    "expectedSize": 11,
    "text": "Make signed arg30 script controlled"
  },
  {
    "opcode": 42,
    "instructionAddress": 9685162,
    "expectedSize": 2,
    "text": "Make controlled char script controlled"
  }
];

test('opcode corpus 0x2a', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
