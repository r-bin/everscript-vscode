import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 12,
    "instructionAddress": 10006648,
    "expectedSize": 4,
    "text": "$22f5 &= 0xfd (8bit mode) (Prison door 7 open)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9678021,
    "expectedSize": 4,
    "text": "$22eb &= 0xdf (8bit mode) (in animation)"
  },
  {
    "opcode": 12,
    "instructionAddress": 10138457,
    "expectedSize": 4,
    "text": "$22eb &= 0xdf (8bit mode) (in animation)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9758635,
    "expectedSize": 4,
    "text": "$22ee &= 0xfe (8bit mode) (unknown intro/outro? flag in prof. lab)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9937842,
    "expectedSize": 4,
    "text": "$22ee &= 0xfe (8bit mode) (unknown intro/outro? flag in prof. lab)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9671097,
    "expectedSize": 4,
    "text": "$225d |= 0x04 (Desert spin???)"
  },
  {
    "opcode": 12,
    "instructionAddress": 10006530,
    "expectedSize": 4,
    "text": "$22f4 |= 0x40 (Prison door 4 open)"
  },
  {
    "opcode": 12,
    "instructionAddress": 10020941,
    "expectedSize": 4,
    "text": "$22f5 &= 0xfb (8bit mode)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9687601,
    "expectedSize": 4,
    "text": "$22eb &= 0xdf (8bit mode) (in animation)"
  },
  {
    "opcode": 12,
    "instructionAddress": 10126312,
    "expectedSize": 4,
    "text": "$22eb &= 0xdf (8bit mode) (in animation)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9733808,
    "expectedSize": 4,
    "text": "$22eb &= 0xdf (8bit mode) (in animation)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9952622,
    "expectedSize": 4,
    "text": "$22eb &= 0xdf (8bit mode) (in animation)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9747851,
    "expectedSize": 4,
    "text": "$22eb &= 0xdf (8bit mode) (in animation)"
  },
  {
    "opcode": 12,
    "instructionAddress": 10006725,
    "expectedSize": 4,
    "text": "$22eb &= 0xdf (8bit mode) (in animation)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9948028,
    "expectedSize": 4,
    "text": "$22f1 |= 0x40 (Inside outro?)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9742557,
    "expectedSize": 4,
    "text": "$22ee &= 0xfe (8bit mode) (unknown intro/outro? flag in prof. lab)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9812689,
    "expectedSize": 4,
    "text": "$22eb &= 0xdf (8bit mode) (in animation)"
  },
  {
    "opcode": 12,
    "instructionAddress": 10064774,
    "expectedSize": 4,
    "text": "$22f1 |= 0x40 (Inside outro?)"
  },
  {
    "opcode": 12,
    "instructionAddress": 10022807,
    "expectedSize": 4,
    "text": "$22eb &= 0xdf (8bit mode) (in animation)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9680856,
    "expectedSize": 4,
    "text": "$22eb &= 0xdf (8bit mode) (in animation)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9678616,
    "expectedSize": 4,
    "text": "$22ee &= 0xfe (8bit mode) (unknown intro/outro? flag in prof. lab)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9804339,
    "expectedSize": 4,
    "text": "$22e5 &= 0xfb (8bit mode) (Unknown 'mids flag)"
  },
  {
    "opcode": 12,
    "instructionAddress": 10193130,
    "expectedSize": 4,
    "text": "$22eb &= 0xdf (8bit mode) (in animation)"
  },
  {
    "opcode": 12,
    "instructionAddress": 10060592,
    "expectedSize": 4,
    "text": "$22eb &= 0xdf (8bit mode) (in animation)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9804547,
    "expectedSize": 4,
    "text": "$2261 |= 0x02 (Boy unavailable)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9802878,
    "expectedSize": 4,
    "text": "$2261 &= 0xfd (8bit mode) (Boy unavailable)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9626801,
    "expectedSize": 4,
    "text": "$22ea &= 0xdf (8bit mode)"
  },
  {
    "opcode": 12,
    "instructionAddress": 10145709,
    "expectedSize": 4,
    "text": "$22eb &= 0xdf (8bit mode) (in animation)"
  },
  {
    "opcode": 12,
    "instructionAddress": 10013115,
    "expectedSize": 4,
    "text": "$22eb &= 0xdf (8bit mode) (in animation)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9798916,
    "expectedSize": 4,
    "text": "$22df |= 0x02 (Crustacia elevator in top position)"
  },
  {
    "opcode": 12,
    "instructionAddress": 10195696,
    "expectedSize": 4,
    "text": "$22eb &= 0xdf (8bit mode) (in animation)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9877055,
    "expectedSize": 4,
    "text": "$22eb &= 0xdf (8bit mode) (in animation)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9809930,
    "expectedSize": 4,
    "text": "$22eb &= 0xdf (8bit mode) (in animation)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9946464,
    "expectedSize": 4,
    "text": "$22dc |= 0x08 (windwalker unlocked)"
  },
  {
    "opcode": 12,
    "instructionAddress": 10194884,
    "expectedSize": 4,
    "text": "$22eb &= 0xdf (8bit mode) (in animation)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9877179,
    "expectedSize": 4,
    "text": "$225d |= 0x08 (Market timer expired)"
  },
  {
    "opcode": 12,
    "instructionAddress": 10198850,
    "expectedSize": 4,
    "text": "$22eb &= 0xdf (8bit mode) (in animation)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9932925,
    "expectedSize": 4,
    "text": "$22eb &= 0xdf (8bit mode) (in animation)"
  },
  {
    "opcode": 12,
    "instructionAddress": 10006522,
    "expectedSize": 4,
    "text": "$22f4 |= 0x10 (Prison door 2 open)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9946620,
    "expectedSize": 4,
    "text": "$22e5 &= 0xf7 (8bit mode) (WW Landing (set before loading fire pit from OW))"
  },
  {
    "opcode": 12,
    "instructionAddress": 10006534,
    "expectedSize": 4,
    "text": "$22f4 |= 0x80 (Prison door 5 open)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9685225,
    "expectedSize": 4,
    "text": "$2260 |= 0x10 (Thraxx dead)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9627168,
    "expectedSize": 4,
    "text": "$22eb &= 0xfe (8bit mode)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9747934,
    "expectedSize": 4,
    "text": "$2260 |= 0x20 (Magmar fight started?)"
  },
  {
    "opcode": 12,
    "instructionAddress": 10079727,
    "expectedSize": 4,
    "text": "$22eb &= 0xdf (8bit mode) (in animation)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9629745,
    "expectedSize": 4,
    "text": "$22eb |= 0x20 (in animation)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9877664,
    "expectedSize": 4,
    "text": "$22ef |= 0x02 (Square-reminder message in market shown)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9948151,
    "expectedSize": 4,
    "text": "$22e5 |= 0x08 (WW Landing (set before loading fire pit from OW))"
  },
  {
    "opcode": 12,
    "instructionAddress": 10079470,
    "expectedSize": 4,
    "text": "$22eb &= 0xdf (8bit mode) (in animation)"
  },
  {
    "opcode": 12,
    "instructionAddress": 10006644,
    "expectedSize": 4,
    "text": "$22f5 &= 0xfe (8bit mode) (Prison door 6 open)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9814406,
    "expectedSize": 4,
    "text": "$22eb &= 0xdf (8bit mode) (in animation)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9822400,
    "expectedSize": 4,
    "text": "$22eb &= 0xdf (8bit mode) (in animation)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9752595,
    "expectedSize": 4,
    "text": "$2292 &= 0xef (8bit mode) (Sniffed Ash in Fire Eyes' Village (#20))"
  },
  {
    "opcode": 12,
    "instructionAddress": 10062964,
    "expectedSize": 4,
    "text": "$22eb &= 0xdf (8bit mode) (in animation)"
  },
  {
    "opcode": 12,
    "instructionAddress": 10140848,
    "expectedSize": 4,
    "text": "$22f5 &= 0x7f (8bit mode) (Naris' age?)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9883416,
    "expectedSize": 4,
    "text": "$2261 &= 0xfe (8bit mode) (Dog unavailable)"
  },
  {
    "opcode": 12,
    "instructionAddress": 10214788,
    "expectedSize": 4,
    "text": "$22ee &= 0xfe (8bit mode) (unknown intro/outro? flag in prof. lab)"
  },
  {
    "opcode": 12,
    "instructionAddress": 10198942,
    "expectedSize": 4,
    "text": "$22f8 &= 0xfb (8bit mode)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9626478,
    "expectedSize": 4,
    "text": "$22ea |= 0x10"
  },
  {
    "opcode": 12,
    "instructionAddress": 10013420,
    "expectedSize": 4,
    "text": "$22eb &= 0xbf (8bit mode)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9798741,
    "expectedSize": 4,
    "text": "$22eb &= 0xdf (8bit mode) (in animation)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9733365,
    "expectedSize": 4,
    "text": "$22eb |= 0x20 (in animation)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9804594,
    "expectedSize": 4,
    "text": "$2261 &= 0xfe (8bit mode) (Dog unavailable)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9804335,
    "expectedSize": 4,
    "text": "$22e4 &= 0xfb (8bit mode)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9691177,
    "expectedSize": 4,
    "text": "$22eb &= 0xdf (8bit mode) (in animation)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9824615,
    "expectedSize": 4,
    "text": "$22ee &= 0xfe (8bit mode) (unknown intro/outro? flag in prof. lab)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9946847,
    "expectedSize": 4,
    "text": "$22e5 |= 0x08 (WW Landing (set before loading fire pit from OW))"
  },
  {
    "opcode": 12,
    "instructionAddress": 9818044,
    "expectedSize": 4,
    "text": "$22eb &= 0xdf (8bit mode) (in animation)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9802892,
    "expectedSize": 4,
    "text": "$22e5 &= 0xfd (8bit mode) (Unknown 'mids flag)"
  },
  {
    "opcode": 12,
    "instructionAddress": 10145729,
    "expectedSize": 4,
    "text": "$22f1 |= 0x40 (Inside outro?)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9745441,
    "expectedSize": 4,
    "text": "$225f |= 0x10 (Pipe Maze Raptor shown?)"
  },
  {
    "opcode": 12,
    "instructionAddress": 10205644,
    "expectedSize": 4,
    "text": "$22eb &= 0xdf (8bit mode) (in animation)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9798861,
    "expectedSize": 4,
    "text": "$22df &= 0xfd (8bit mode) (Crustacia elevator in top position)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9819189,
    "expectedSize": 4,
    "text": "$22eb &= 0xdf (8bit mode) (in animation)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9668048,
    "expectedSize": 4,
    "text": "$22eb &= 0xdf (8bit mode) (in animation)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9629470,
    "expectedSize": 4,
    "text": "$22eb &= 0xdf (8bit mode) (in animation)"
  },
  {
    "opcode": 12,
    "instructionAddress": 10146802,
    "expectedSize": 4,
    "text": "$22eb &= 0xdf (8bit mode) (in animation)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9802640,
    "expectedSize": 4,
    "text": "$22e5 &= 0xfb (8bit mode) (Unknown 'mids flag)"
  },
  {
    "opcode": 12,
    "instructionAddress": 10205601,
    "expectedSize": 28,
    "text": "$2262 |= 0x02 (Jaguar Ring)"
  },
  {
    "opcode": 12,
    "instructionAddress": 10064781,
    "expectedSize": 4,
    "text": "$22eb &= 0xdf (8bit mode) (in animation)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9814475,
    "expectedSize": 4,
    "text": "$22ee &= 0xfe (8bit mode) (unknown intro/outro? flag in prof. lab)"
  },
  {
    "opcode": 12,
    "instructionAddress": 10079480,
    "expectedSize": 4,
    "text": "$22ee &= 0xfe (8bit mode) (unknown intro/outro? flag in prof. lab)"
  },
  {
    "opcode": 12,
    "instructionAddress": 10142645,
    "expectedSize": 4,
    "text": "$22eb &= 0xdf (8bit mode) (in animation)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9810747,
    "expectedSize": 4,
    "text": "$22eb &= 0xdf (8bit mode) (in animation)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9745363,
    "expectedSize": 4,
    "text": "$22ee &= 0xfe (8bit mode) (unknown intro/outro? flag in prof. lab)"
  },
  {
    "opcode": 12,
    "instructionAddress": 10087744,
    "expectedSize": 4,
    "text": "$2261 |= 0x01 (Dog unavailable)"
  },
  {
    "opcode": 12,
    "instructionAddress": 10006624,
    "expectedSize": 4,
    "text": "$22f4 &= 0xf7 (8bit mode) (Prison door 1 open)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9802636,
    "expectedSize": 4,
    "text": "$22e4 &= 0xfb (8bit mode)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9932359,
    "expectedSize": 4,
    "text": "$22eb &= 0xdf (8bit mode) (in animation)"
  },
  {
    "opcode": 12,
    "instructionAddress": 10001606,
    "expectedSize": 4,
    "text": "$22de |= 0x04 (Queen cutscene below chessboard watched)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9996636,
    "expectedSize": 4,
    "text": "$22eb &= 0xdf (8bit mode) (in animation)"
  },
  {
    "opcode": 12,
    "instructionAddress": 10205744,
    "expectedSize": 4,
    "text": "$22eb &= 0xdf (8bit mode) (in animation)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9999635,
    "expectedSize": 4,
    "text": "$2261 |= 0x02 (Boy unavailable)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9877735,
    "expectedSize": 4,
    "text": "$225d |= 0x08 (Market timer expired)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9948018,
    "expectedSize": 4,
    "text": "$22eb &= 0xdf (8bit mode) (in animation)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9802652,
    "expectedSize": 4,
    "text": "$2261 &= 0xfe (8bit mode) (Dog unavailable)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9802648,
    "expectedSize": 4,
    "text": "$2261 &= 0xfd (8bit mode) (Boy unavailable)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9672274,
    "expectedSize": 4,
    "text": "$22eb &= 0xdf (8bit mode) (in animation)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9802666,
    "expectedSize": 4,
    "text": "$22ee &= 0xfe (8bit mode) (unknown intro/outro? flag in prof. lab)"
  },
  {
    "opcode": 12,
    "instructionAddress": 9887749,
    "expectedSize": 4,
    "text": "$22ee &= 0xfe (8bit mode) (unknown intro/outro? flag in prof. lab)"
  }
];

test('opcode corpus 0x0c', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
