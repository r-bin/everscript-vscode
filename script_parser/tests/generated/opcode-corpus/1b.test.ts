import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 27,
    "instructionAddress": 9740545,
    "expectedSize": 7,
    "text": "WRITE MAP Y start ($23eb) = 0x01e0"
  },
  {
    "opcode": 27,
    "instructionAddress": 9684621,
    "expectedSize": 7,
    "text": "WRITE MAP Y start ($23eb) = 0x0000"
  },
  {
    "opcode": 27,
    "instructionAddress": 9814450,
    "expectedSize": 7,
    "text": "WRITE MAP Y end   ($23ef) = 0x0150"
  },
  {
    "opcode": 27,
    "instructionAddress": 9740337,
    "expectedSize": 7,
    "text": "WRITE MAP Y start ($23eb) = 0x0030"
  },
  {
    "opcode": 27,
    "instructionAddress": 9759509,
    "expectedSize": 7,
    "text": "WRITE MAP Y start ($23eb) = 0x0000"
  },
  {
    "opcode": 27,
    "instructionAddress": 9757683,
    "expectedSize": 7,
    "text": "WRITE MAP Y end   ($23ef) = 0x0380"
  },
  {
    "opcode": 27,
    "instructionAddress": 10146744,
    "expectedSize": 7,
    "text": "WRITE MAP Y start ($23eb) = 0x0000"
  },
  {
    "opcode": 27,
    "instructionAddress": 9740285,
    "expectedSize": 7,
    "text": "WRITE MAP Y start ($23eb) = 0x0020"
  },
  {
    "opcode": 27,
    "instructionAddress": 9740519,
    "expectedSize": 7,
    "text": "WRITE MAP Y start ($23eb) = 0x0448"
  },
  {
    "opcode": 27,
    "instructionAddress": 9668176,
    "expectedSize": 7,
    "text": "WRITE MAP Y start ($23eb) = 0x0010"
  },
  {
    "opcode": 27,
    "instructionAddress": 9948063,
    "expectedSize": 7,
    "text": "WRITE MAP Y start ($23eb) = 0x0000"
  },
  {
    "opcode": 27,
    "instructionAddress": 9740526,
    "expectedSize": 7,
    "text": "WRITE MAP Y end   ($23ef) = 0x0590"
  },
  {
    "opcode": 27,
    "instructionAddress": 9824586,
    "expectedSize": 7,
    "text": "WRITE MAP Y end   ($23ef) = 0x0210"
  },
  {
    "opcode": 27,
    "instructionAddress": 10018576,
    "expectedSize": 7,
    "text": "WRITE MAP Y end   ($23ef) = 0x02a0"
  },
  {
    "opcode": 27,
    "instructionAddress": 9668183,
    "expectedSize": 7,
    "text": "WRITE MAP Y end   ($23ef) = 0x04b0"
  },
  {
    "opcode": 27,
    "instructionAddress": 9733812,
    "expectedSize": 7,
    "text": "WRITE MAP Y start ($23eb) = 0x0000"
  },
  {
    "opcode": 27,
    "instructionAddress": 9951272,
    "expectedSize": 7,
    "text": "WRITE MAP Y start ($23eb) = 0x0490"
  },
  {
    "opcode": 27,
    "instructionAddress": 9812878,
    "expectedSize": 7,
    "text": "WRITE $24af = 0x00b8"
  },
  {
    "opcode": 27,
    "instructionAddress": 9944874,
    "expectedSize": 7,
    "text": "WRITE $242d = 0x0158"
  },
  {
    "opcode": 27,
    "instructionAddress": 10063121,
    "expectedSize": 7,
    "text": "WRITE $242d = 0x0000"
  },
  {
    "opcode": 27,
    "instructionAddress": 9740422,
    "expectedSize": 7,
    "text": "WRITE MAP Y end   ($23ef) = 0x0360"
  },
  {
    "opcode": 27,
    "instructionAddress": 9679347,
    "expectedSize": 7,
    "text": "WRITE MAP Y end   ($23ef) = 0x0290"
  },
  {
    "opcode": 27,
    "instructionAddress": 10019220,
    "expectedSize": 7,
    "text": "WRITE MAP Y start ($23eb) = 0x0240"
  },
  {
    "opcode": 27,
    "instructionAddress": 9687922,
    "expectedSize": 7,
    "text": "WRITE $242d = 0x0008"
  },
  {
    "opcode": 27,
    "instructionAddress": 9667814,
    "expectedSize": 7,
    "text": "WRITE MAP Y end   ($23ef) = 0x04b0"
  },
  {
    "opcode": 27,
    "instructionAddress": 9757376,
    "expectedSize": 7,
    "text": "WRITE MAP Y end   ($23ef) = 0x0120"
  },
  {
    "opcode": 27,
    "instructionAddress": 9752133,
    "expectedSize": 7,
    "text": "WRITE $23bb = 0x0328"
  },
  {
    "opcode": 27,
    "instructionAddress": 9626989,
    "expectedSize": 7,
    "text": "WRITE $242d = 0x0008"
  },
  {
    "opcode": 27,
    "instructionAddress": 10063061,
    "expectedSize": 7,
    "text": "WRITE $24af = 0x00d8"
  },
  {
    "opcode": 27,
    "instructionAddress": 9757428,
    "expectedSize": 7,
    "text": "WRITE MAP Y end   ($23ef) = 0x0250"
  },
  {
    "opcode": 27,
    "instructionAddress": 9757295,
    "expectedSize": 7,
    "text": "WRITE MAP Y start ($23eb) = 0x0000"
  },
  {
    "opcode": 27,
    "instructionAddress": 9740396,
    "expectedSize": 7,
    "text": "WRITE MAP Y end   ($23ef) = 0x03e0"
  },
  {
    "opcode": 27,
    "instructionAddress": 9758162,
    "expectedSize": 7,
    "text": "WRITE $242d = 0x0020"
  },
  {
    "opcode": 27,
    "instructionAddress": 10019227,
    "expectedSize": 7,
    "text": "WRITE MAP Y end   ($23ef) = 0x03d0"
  },
  {
    "opcode": 27,
    "instructionAddress": 9758232,
    "expectedSize": 7,
    "text": "WRITE MAP Y end   ($23ef) = 0x0100"
  },
  {
    "opcode": 27,
    "instructionAddress": 10018647,
    "expectedSize": 7,
    "text": "WRITE MAP Y start ($23eb) = 0x0120"
  },
  {
    "opcode": 27,
    "instructionAddress": 9757553,
    "expectedSize": 7,
    "text": "WRITE MAP Y start ($23eb) = 0x0260"
  },
  {
    "opcode": 27,
    "instructionAddress": 9742361,
    "expectedSize": 7,
    "text": "WRITE MAP Y start ($23eb) = 0x0020"
  },
  {
    "opcode": 27,
    "instructionAddress": 9757369,
    "expectedSize": 7,
    "text": "WRITE MAP Y start ($23eb) = 0x0000"
  },
  {
    "opcode": 27,
    "instructionAddress": 9998611,
    "expectedSize": 7,
    "text": "WRITE MAP Y start ($23eb) = 0x0000"
  },
  {
    "opcode": 27,
    "instructionAddress": 9814522,
    "expectedSize": 7,
    "text": "WRITE MAP Y end   ($23ef) = 0x02e0"
  },
  {
    "opcode": 27,
    "instructionAddress": 10018917,
    "expectedSize": 7,
    "text": "WRITE MAP Y end   ($23ef) = 0x0240"
  },
  {
    "opcode": 27,
    "instructionAddress": 9733224,
    "expectedSize": 7,
    "text": "WRITE MAP Y start ($23eb) = 0x0000"
  },
  {
    "opcode": 27,
    "instructionAddress": 9740474,
    "expectedSize": 7,
    "text": "WRITE MAP Y end   ($23ef) = 0x04b0"
  },
  {
    "opcode": 27,
    "instructionAddress": 9626775,
    "expectedSize": 7,
    "text": "WRITE $24af = 0x00a0"
  },
  {
    "opcode": 27,
    "instructionAddress": 9814601,
    "expectedSize": 7,
    "text": "WRITE MAP Y start ($23eb) = 0x0180"
  },
  {
    "opcode": 27,
    "instructionAddress": 9629709,
    "expectedSize": 7,
    "text": "WRITE $242d = 0x00a0"
  },
  {
    "opcode": 27,
    "instructionAddress": 10205574,
    "expectedSize": 7,
    "text": "WRITE $242d = 0x0000"
  },
  {
    "opcode": 27,
    "instructionAddress": 9996614,
    "expectedSize": 7,
    "text": "WRITE MAP Y start ($23eb) = 0x0010"
  },
  {
    "opcode": 27,
    "instructionAddress": 9740552,
    "expectedSize": 7,
    "text": "WRITE MAP Y end   ($23ef) = 0x04b0"
  },
  {
    "opcode": 27,
    "instructionAddress": 10070055,
    "expectedSize": 7,
    "text": "WRITE $24af = 0x00a8"
  },
  {
    "opcode": 27,
    "instructionAddress": 10019587,
    "expectedSize": 7,
    "text": "WRITE MAP Y start ($23eb) = 0x0020"
  },
  {
    "opcode": 27,
    "instructionAddress": 9740292,
    "expectedSize": 7,
    "text": "WRITE MAP Y end   ($23ef) = 0x01e0"
  },
  {
    "opcode": 27,
    "instructionAddress": 9948070,
    "expectedSize": 7,
    "text": "WRITE MAP Y end   ($23ef) = 0x0190"
  },
  {
    "opcode": 27,
    "instructionAddress": 10138503,
    "expectedSize": 7,
    "text": "WRITE MAP Y end   ($23ef) = 0x0100"
  },
  {
    "opcode": 27,
    "instructionAddress": 9948183,
    "expectedSize": 7,
    "text": "WRITE $24a3 = 0x00f8"
  },
  {
    "opcode": 27,
    "instructionAddress": 10134549,
    "expectedSize": 7,
    "text": "WRITE MAP Y end   ($23ef) = 0x0618"
  },
  {
    "opcode": 27,
    "instructionAddress": 10018910,
    "expectedSize": 7,
    "text": "WRITE MAP Y start ($23eb) = 0x0040"
  },
  {
    "opcode": 27,
    "instructionAddress": 9679340,
    "expectedSize": 7,
    "text": "WRITE MAP Y start ($23eb) = 0x0030"
  },
  {
    "opcode": 27,
    "instructionAddress": 10087775,
    "expectedSize": 7,
    "text": "WRITE $24af = 0x0250"
  },
  {
    "opcode": 27,
    "instructionAddress": 9998618,
    "expectedSize": 7,
    "text": "WRITE MAP Y end   ($23ef) = 0x03a0"
  },
  {
    "opcode": 27,
    "instructionAddress": 10019079,
    "expectedSize": 7,
    "text": "WRITE MAP Y start ($23eb) = 0x0240"
  },
  {
    "opcode": 27,
    "instructionAddress": 9824569,
    "expectedSize": 7,
    "text": "WRITE MAP Y end   ($23ef) = 0x00e0"
  },
  {
    "opcode": 27,
    "instructionAddress": 9759556,
    "expectedSize": 7,
    "text": "WRITE $24d1 = 0x0068"
  },
  {
    "opcode": 27,
    "instructionAddress": 10138496,
    "expectedSize": 7,
    "text": "WRITE MAP Y start ($23eb) = 0x0000"
  },
  {
    "opcode": 27,
    "instructionAddress": 10019086,
    "expectedSize": 7,
    "text": "WRITE MAP Y end   ($23ef) = 0x03d0"
  },
  {
    "opcode": 27,
    "instructionAddress": 9757421,
    "expectedSize": 7,
    "text": "WRITE MAP Y start ($23eb) = 0x0130"
  },
  {
    "opcode": 27,
    "instructionAddress": 9946602,
    "expectedSize": 7,
    "text": "WRITE $24a3 = 0x00c8"
  },
  {
    "opcode": 27,
    "instructionAddress": 9740500,
    "expectedSize": 7,
    "text": "WRITE MAP Y end   ($23ef) = 0x0588"
  },
  {
    "opcode": 27,
    "instructionAddress": 9824579,
    "expectedSize": 7,
    "text": "WRITE MAP Y start ($23eb) = 0x0120"
  },
  {
    "opcode": 27,
    "instructionAddress": 9629730,
    "expectedSize": 7,
    "text": "WRITE $242d = 0x0030"
  },
  {
    "opcode": 27,
    "instructionAddress": 10019296,
    "expectedSize": 7,
    "text": "WRITE MAP Y start ($23eb) = 0x0040"
  },
  {
    "opcode": 27,
    "instructionAddress": 9998592,
    "expectedSize": 7,
    "text": "WRITE MAP Y end   ($23ef) = 0x03a0"
  },
  {
    "opcode": 27,
    "instructionAddress": 9742413,
    "expectedSize": 7,
    "text": "WRITE MAP Y start ($23eb) = 0x0020"
  },
  {
    "opcode": 27,
    "instructionAddress": 9757739,
    "expectedSize": 7,
    "text": "WRITE MAP Y end   ($23ef) = 0x0380"
  },
  {
    "opcode": 27,
    "instructionAddress": 10018491,
    "expectedSize": 7,
    "text": "WRITE MAP Y start ($23eb) = 0x0120"
  },
  {
    "opcode": 27,
    "instructionAddress": 9757260,
    "expectedSize": 7,
    "text": "WRITE MAP Y end   ($23ef) = 0x0120"
  },
  {
    "opcode": 27,
    "instructionAddress": 9742387,
    "expectedSize": 7,
    "text": "WRITE MAP Y start ($23eb) = 0x0030"
  },
  {
    "opcode": 27,
    "instructionAddress": 10146725,
    "expectedSize": 7,
    "text": "WRITE MAP Y end   ($23ef) = 0x01c0"
  },
  {
    "opcode": 27,
    "instructionAddress": 9951279,
    "expectedSize": 7,
    "text": "WRITE MAP Y end   ($23ef) = 0x0660"
  },
  {
    "opcode": 27,
    "instructionAddress": 10146031,
    "expectedSize": 7,
    "text": "WRITE $23bb = 0x01f8"
  },
  {
    "opcode": 27,
    "instructionAddress": 10018817,
    "expectedSize": 7,
    "text": "WRITE MAP Y start ($23eb) = 0x0260"
  },
  {
    "opcode": 27,
    "instructionAddress": 9740448,
    "expectedSize": 7,
    "text": "WRITE MAP Y end   ($23ef) = 0x03e0"
  },
  {
    "opcode": 27,
    "instructionAddress": 10146751,
    "expectedSize": 7,
    "text": "WRITE MAP Y end   ($23ef) = 0x01c0"
  },
  {
    "opcode": 27,
    "instructionAddress": 9742335,
    "expectedSize": 7,
    "text": "WRITE MAP Y start ($23eb) = 0x0020"
  },
  {
    "opcode": 27,
    "instructionAddress": 9679502,
    "expectedSize": 7,
    "text": "WRITE MAP Y end   ($23ef) = 0x0290"
  },
  {
    "opcode": 27,
    "instructionAddress": 9819302,
    "expectedSize": 14,
    "text": "WRITE $242d = 0x0000"
  },
  {
    "opcode": 27,
    "instructionAddress": 9945389,
    "expectedSize": 7,
    "text": "WRITE MAP Y start ($23eb) = 0x0000"
  },
  {
    "opcode": 27,
    "instructionAddress": 10136376,
    "expectedSize": 7,
    "text": "WRITE $23bb = 0x00c8"
  },
  {
    "opcode": 27,
    "instructionAddress": 10019018,
    "expectedSize": 7,
    "text": "WRITE MAP Y start ($23eb) = 0x0040"
  },
  {
    "opcode": 27,
    "instructionAddress": 10146718,
    "expectedSize": 7,
    "text": "WRITE MAP Y start ($23eb) = 0x0000"
  },
  {
    "opcode": 27,
    "instructionAddress": 9946728,
    "expectedSize": 7,
    "text": "WRITE $23bb = 0x0000"
  },
  {
    "opcode": 27,
    "instructionAddress": 9757560,
    "expectedSize": 7,
    "text": "WRITE MAP Y end   ($23ef) = 0x0380"
  },
  {
    "opcode": 27,
    "instructionAddress": 10214796,
    "expectedSize": 7,
    "text": "WRITE $24af = 0x02c8"
  },
  {
    "opcode": 27,
    "instructionAddress": 9629520,
    "expectedSize": 7,
    "text": "WRITE $242d = 0x02a0"
  },
  {
    "opcode": 27,
    "instructionAddress": 10019147,
    "expectedSize": 7,
    "text": "WRITE MAP Y start ($23eb) = 0x0040"
  },
  {
    "opcode": 27,
    "instructionAddress": 9814787,
    "expectedSize": 7,
    "text": "WRITE MAP Y start ($23eb) = 0x0000"
  },
  {
    "opcode": 27,
    "instructionAddress": 9629679,
    "expectedSize": 7,
    "text": "WRITE $242d = 0x00a0"
  },
  {
    "opcode": 27,
    "instructionAddress": 9814515,
    "expectedSize": 7,
    "text": "WRITE MAP Y start ($23eb) = 0x01c0"
  },
  {
    "opcode": 27,
    "instructionAddress": 9740363,
    "expectedSize": 7,
    "text": "WRITE MAP Y start ($23eb) = 0x0020"
  }
];

test('opcode corpus 0x1b', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
