import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 163,
    "instructionAddress": 9739133,
    "expectedSize": 2,
    "text": "CALL \"Fade-out / stop music\" (0x00)"
  },
  {
    "opcode": 163,
    "instructionAddress": 10001575,
    "expectedSize": 2,
    "text": "CALL \"Fade-in / start music\" (0x01)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9691387,
    "expectedSize": 2,
    "text": "CALL \"Fade-in / start music\" (0x01)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9752230,
    "expectedSize": 2,
    "text": "CALL \"Fade-in / start music\" (0x01)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9951700,
    "expectedSize": 2,
    "text": "CALL \"Fade-in / start music\" (0x01)"
  },
  {
    "opcode": 163,
    "instructionAddress": 10064766,
    "expectedSize": 2,
    "text": "CALL \"Fade-out / stop music\" (0x00)"
  },
  {
    "opcode": 163,
    "instructionAddress": 10021069,
    "expectedSize": 2,
    "text": "CALL \"Fade-in / start music\" (0x01)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9878753,
    "expectedSize": 2,
    "text": "CALL \"Fade-out / stop music\" (0x00)"
  },
  {
    "opcode": 163,
    "instructionAddress": 10214557,
    "expectedSize": 2,
    "text": "CALL \"Fade-in / start music\" (0x01)"
  },
  {
    "opcode": 163,
    "instructionAddress": 10146687,
    "expectedSize": 2,
    "text": "CALL \"Fade-out / stop music\" (0x00)"
  },
  {
    "opcode": 163,
    "instructionAddress": 10134214,
    "expectedSize": 2,
    "text": "CALL \"Fade-out / stop music\" (0x00)"
  },
  {
    "opcode": 163,
    "instructionAddress": 10194918,
    "expectedSize": 2,
    "text": "CALL \"Fade-in / start music\" (0x01)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9933028,
    "expectedSize": 2,
    "text": "CALL \"Fade-in / start music\" (0x01)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9877521,
    "expectedSize": 2,
    "text": "CALL \"Fade-in / start music\" (0x01)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9627125,
    "expectedSize": 2,
    "text": "CALL \"Fade-out / stop music\" (0x00)"
  },
  {
    "opcode": 163,
    "instructionAddress": 10129839,
    "expectedSize": 8,
    "text": "CALL \"Unnamed Global script 0x34\" (0x34)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9758626,
    "expectedSize": 2,
    "text": "CALL \"Fade-out / stop music\" (0x00)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9627176,
    "expectedSize": 2,
    "text": "CALL \"Fade-out / stop music\" (0x00)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9877196,
    "expectedSize": 2,
    "text": "CALL \"Fade-out / stop music\" (0x00)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9808087,
    "expectedSize": 2,
    "text": "CALL \"Fade-out / stop music\" (0x00)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9684643,
    "expectedSize": 2,
    "text": "CALL \"Fade-in / start music\" (0x01)"
  },
  {
    "opcode": 163,
    "instructionAddress": 10018480,
    "expectedSize": 2,
    "text": "CALL \"Fade-in / start music\" (0x01)"
  },
  {
    "opcode": 163,
    "instructionAddress": 10060612,
    "expectedSize": 2,
    "text": "CALL \"Fade-in / start music\" (0x01)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9804510,
    "expectedSize": 2,
    "text": "CALL \"Fade-in / start music\" (0x01)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9758673,
    "expectedSize": 2,
    "text": "CALL \"Fade-in / start music\" (0x01)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9935523,
    "expectedSize": 2,
    "text": "CALL \"Fade-out / stop music\" (0x00)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9680851,
    "expectedSize": 2,
    "text": "CALL \"Fade-out / stop music\" (0x00)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9687637,
    "expectedSize": 2,
    "text": "CALL \"Fade-in / start music\" (0x01)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9757179,
    "expectedSize": 2,
    "text": "CALL \"Fade-out / stop music\" (0x00)"
  },
  {
    "opcode": 163,
    "instructionAddress": 10205639,
    "expectedSize": 2,
    "text": "CALL \"Fade-out / stop music\" (0x00)"
  },
  {
    "opcode": 163,
    "instructionAddress": 10198870,
    "expectedSize": 2,
    "text": "CALL \"Fade-in / start music\" (0x01)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9740778,
    "expectedSize": 2,
    "text": "CALL \"Fade-in / start music\" (0x01)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9734359,
    "expectedSize": 2,
    "text": "CALL \"Fade-out / stop music\" (0x00)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9743681,
    "expectedSize": 2,
    "text": "CALL \"Fade-in / start music\" (0x01)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9945383,
    "expectedSize": 2,
    "text": "CALL \"Fade-in / start music\" (0x01)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9932375,
    "expectedSize": 2,
    "text": "CALL \"Fade-in / start music\" (0x01)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9955392,
    "expectedSize": 2,
    "text": "CALL \"Fade-out / stop music\" (0x00)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9955409,
    "expectedSize": 2,
    "text": "CALL \"Fade-in / start music\" (0x01)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9752180,
    "expectedSize": 2,
    "text": "CALL \"Unnamed Global script 0x1f\" (0x1f)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9877546,
    "expectedSize": 2,
    "text": "CALL \"Unnamed Global script 0x36\" (0x36)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9937607,
    "expectedSize": 2,
    "text": "CALL \"Fade-out / stop music\" (0x00)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9752640,
    "expectedSize": 2,
    "text": "CALL \"Unnamed Global script 0x09\" (0x09)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9687982,
    "expectedSize": 2,
    "text": "CALL \"Attraction mode, after Thraxx\" (0x59)"
  },
  {
    "opcode": 163,
    "instructionAddress": 10129570,
    "expectedSize": 9,
    "text": "CALL \"Fade-out / stop music\" (0x00)"
  },
  {
    "opcode": 163,
    "instructionAddress": 10138452,
    "expectedSize": 2,
    "text": "CALL \"Fade-out / stop music\" (0x00)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9758895,
    "expectedSize": 2,
    "text": "CALL \"Fade-out / stop music\" (0x00)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9742251,
    "expectedSize": 2,
    "text": "CALL \"Fade-out / stop music\" (0x00)"
  },
  {
    "opcode": 163,
    "instructionAddress": 10140780,
    "expectedSize": 2,
    "text": "CALL \"Fade-out / stop music\" (0x00)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9819966,
    "expectedSize": 2,
    "text": "CALL \"Unnamed Global script 0x36\" (0x36)"
  },
  {
    "opcode": 163,
    "instructionAddress": 10205522,
    "expectedSize": 2,
    "text": "CALL \"Fade-in / start music\" (0x01)"
  },
  {
    "opcode": 163,
    "instructionAddress": 10130053,
    "expectedSize": 2,
    "text": "CALL \"Fade-out / stop music\" (0x00)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9742727,
    "expectedSize": 2,
    "text": "CALL \"Fade-in / start music\" (0x01)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9629486,
    "expectedSize": 2,
    "text": "CALL \"Fade-in / start music\" (0x01)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9948013,
    "expectedSize": 2,
    "text": "CALL \"Fade-out / stop music\" (0x00)"
  },
  {
    "opcode": 163,
    "instructionAddress": 10082716,
    "expectedSize": 2,
    "text": "CALL \"Fade-in / start music\" (0x01)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9759625,
    "expectedSize": 2,
    "text": "CALL \"Fade-in / start music\" (0x01)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9739150,
    "expectedSize": 2,
    "text": "CALL \"Fade-in / start music\" (0x01)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9758139,
    "expectedSize": 2,
    "text": "CALL \"Fade-in / start music\" (0x01)"
  },
  {
    "opcode": 163,
    "instructionAddress": 10205787,
    "expectedSize": 2,
    "text": "CALL \"Fade-in / start music\" (0x01)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9996631,
    "expectedSize": 2,
    "text": "CALL \"Fade-out / stop music\" (0x00)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9733267,
    "expectedSize": 2,
    "text": "CALL \"Fade-in / start music\" (0x01)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9822774,
    "expectedSize": 2,
    "text": "CALL \"Unnamed Global script 0x36\" (0x36)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9733215,
    "expectedSize": 2,
    "text": "CALL \"Fade-out / stop music\" (0x00)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9798949,
    "expectedSize": 2,
    "text": "CALL \"Fade-in / start music\" (0x01)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9948402,
    "expectedSize": 2,
    "text": "CALL \"Fade-in / start music\" (0x01)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9809925,
    "expectedSize": 2,
    "text": "CALL \"Fade-out / stop music\" (0x00)"
  },
  {
    "opcode": 163,
    "instructionAddress": 10146766,
    "expectedSize": 2,
    "text": "CALL \"Fade-in / start music\" (0x01)"
  },
  {
    "opcode": 163,
    "instructionAddress": 10060587,
    "expectedSize": 2,
    "text": "CALL \"Fade-out / stop music\" (0x00)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9946765,
    "expectedSize": 2,
    "text": "CALL \"Unnamed Global script 0x36\" (0x36)"
  },
  {
    "opcode": 163,
    "instructionAddress": 10022831,
    "expectedSize": 2,
    "text": "CALL \"Fade-out / stop music\" (0x00)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9952700,
    "expectedSize": 2,
    "text": "CALL \"Fade-in / start music\" (0x01)"
  },
  {
    "opcode": 163,
    "instructionAddress": 10146826,
    "expectedSize": 2,
    "text": "CALL \"Fade-in / start music\" (0x01)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9948057,
    "expectedSize": 2,
    "text": "CALL \"Fade-in / start music\" (0x01)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9684457,
    "expectedSize": 2,
    "text": "CALL \"Fade-out / stop music\" (0x00)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9679583,
    "expectedSize": 2,
    "text": "CALL \"Attraction mode, after Thraxx\" (0x59)"
  },
  {
    "opcode": 163,
    "instructionAddress": 10128450,
    "expectedSize": 2,
    "text": "CALL \"Fade-in / start music\" (0x01)"
  },
  {
    "opcode": 163,
    "instructionAddress": 10130059,
    "expectedSize": 2,
    "text": "CALL \"Fade-in / start music\" (0x01)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9944757,
    "expectedSize": 2,
    "text": "CALL \"Fade-out / stop music\" (0x00)"
  },
  {
    "opcode": 163,
    "instructionAddress": 10022802,
    "expectedSize": 2,
    "text": "CALL \"Fade-out / stop music\" (0x00)"
  },
  {
    "opcode": 163,
    "instructionAddress": 10079530,
    "expectedSize": 2,
    "text": "CALL \"Fade-in / start music\" (0x01)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9822395,
    "expectedSize": 2,
    "text": "CALL \"Fade-out / stop music\" (0x00)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9997062,
    "expectedSize": 2,
    "text": "CALL \"Fade-in / start music\" (0x01)"
  },
  {
    "opcode": 163,
    "instructionAddress": 10130033,
    "expectedSize": 2,
    "text": "CALL \"Open message box?\" (0x0a)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9626842,
    "expectedSize": 2,
    "text": "CALL \"Fade-in / start music\" (0x01)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9679285,
    "expectedSize": 2,
    "text": "CALL \"Fade-out / stop music\" (0x00)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9679500,
    "expectedSize": 2,
    "text": "CALL \"Fade-in / start music\" (0x01)"
  },
  {
    "opcode": 163,
    "instructionAddress": 10205650,
    "expectedSize": 2,
    "text": "CALL \"Fade-in / start music\" (0x01)"
  },
  {
    "opcode": 163,
    "instructionAddress": 10087742,
    "expectedSize": 2,
    "text": "CALL \"Fade-in / start music\" (0x01)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9759533,
    "expectedSize": 2,
    "text": "CALL \"Fade-out / stop music\" (0x00)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9932354,
    "expectedSize": 2,
    "text": "CALL \"Fade-out / stop music\" (0x00)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9747901,
    "expectedSize": 2,
    "text": "CALL \"Attraction mode, after Thraxx\" (0x59)"
  },
  {
    "opcode": 163,
    "instructionAddress": 10145704,
    "expectedSize": 2,
    "text": "CALL \"Fade-out / stop music\" (0x00)"
  },
  {
    "opcode": 163,
    "instructionAddress": 10125748,
    "expectedSize": 2,
    "text": "CALL \"Fade-out / stop music\" (0x00)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9816917,
    "expectedSize": 2,
    "text": "CALL \"Fade-in / start music\" (0x01)"
  },
  {
    "opcode": 163,
    "instructionAddress": 10129511,
    "expectedSize": 7,
    "text": "CALL \"Fade-in / start music\" (0x01)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9938962,
    "expectedSize": 2,
    "text": "CALL \"Fade-in / start music\" (0x01)"
  },
  {
    "opcode": 163,
    "instructionAddress": 10126307,
    "expectedSize": 2,
    "text": "CALL \"Fade-out / stop music\" (0x00)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9940839,
    "expectedSize": 2,
    "text": "CALL \"Fade-in / start music\" (0x01)"
  },
  {
    "opcode": 163,
    "instructionAddress": 10214518,
    "expectedSize": 2,
    "text": "CALL \"Fade-out / stop music\" (0x00)"
  },
  {
    "opcode": 163,
    "instructionAddress": 9816967,
    "expectedSize": 2,
    "text": "CALL \"Open message box?\" (0x07)"
  }
];

test('opcode corpus 0xa3', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
