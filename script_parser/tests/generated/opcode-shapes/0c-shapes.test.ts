import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "{mem} &= {hex} (8bit mode) (running showcase)",
    "instructionAddress": 9625802,
    "expectedSize": 4,
    "opcode": 12
  },
  {
    "shape": "{mem} |= {hex} (running showcase)",
    "instructionAddress": 9626485,
    "expectedSize": 4,
    "opcode": 12
  },
  {
    "shape": "{mem} |= {hex} (unknown intro/outro? flag in prof. lab)",
    "instructionAddress": 9629739,
    "expectedSize": 4,
    "opcode": 12
  },
  {
    "shape": "{mem} |= {hex} (desert spin???)",
    "instructionAddress": 9671097,
    "expectedSize": 4,
    "opcode": 12
  },
  {
    "shape": "{mem} |= {hex} (inside outro?)",
    "instructionAddress": 9678031,
    "expectedSize": 4,
    "opcode": 12
  },
  {
    "shape": "{mem} |= {hex} (thraxx dead)",
    "instructionAddress": 9685225,
    "expectedSize": 4,
    "opcode": 12
  },
  {
    "shape": "{mem} &= {hex} (8bit mode) (stepped on geyser)",
    "instructionAddress": 9733302,
    "expectedSize": 4,
    "opcode": 12
  },
  {
    "shape": "{mem} &= {hex} (8bit mode) (volcano - viper commander spawn?)",
    "instructionAddress": 9739120,
    "expectedSize": 4,
    "opcode": 12
  },
  {
    "shape": "{mem} &= {hex} (8bit mode) (unknown intro/outro? flag in prof. lab)",
    "instructionAddress": 9742468,
    "expectedSize": 4,
    "opcode": 12
  },
  {
    "shape": "{mem} |= {hex} (pipe maze raptor shown?)",
    "instructionAddress": 9745441,
    "expectedSize": 4,
    "opcode": 12
  },
  {
    "shape": "{mem} |= {hex} (magmar fight started?)",
    "instructionAddress": 9747934,
    "expectedSize": 4,
    "opcode": 12
  },
  {
    "shape": "{mem} &= {hex} (8bit mode) (sniffed ash in fire eyes' village (#{num}))",
    "instructionAddress": 9752595,
    "expectedSize": 4,
    "opcode": 12
  },
  {
    "shape": "{mem} |= {hex} (village post-thraxx message shown?)",
    "instructionAddress": 9757825,
    "expectedSize": 4,
    "opcode": 12
  },
  {
    "shape": "{mem} |= {hex} (fe visited pre-thraxx (east exit check))",
    "instructionAddress": 9757853,
    "expectedSize": 4,
    "opcode": 12
  },
  {
    "shape": "{mem} |= {hex} (crustacia elevator in top position)",
    "instructionAddress": 9798810,
    "expectedSize": 4,
    "opcode": 12
  },
  {
    "shape": "{mem} &= {hex} (8bit mode) (crustacia elevator in top position)",
    "instructionAddress": 9798861,
    "expectedSize": 4,
    "opcode": 12
  },
  {
    "shape": "{mem} |= {hex} (boy unavailable)",
    "instructionAddress": 9802868,
    "expectedSize": 4,
    "opcode": 12
  },
  {
    "shape": "{mem} &= {hex} (8bit mode) (boy unavailable)",
    "instructionAddress": 9804347,
    "expectedSize": 4,
    "opcode": 12
  },
  {
    "shape": "{mem} &= {hex} (8bit mode) (falling into a pit)",
    "instructionAddress": 9810821,
    "expectedSize": 4,
    "opcode": 12
  },
  {
    "shape": "{mem} &= {hex} (8bit mode) (crush dialog to be shown)",
    "instructionAddress": 9812853,
    "expectedSize": 4,
    "opcode": 12
  },
  {
    "shape": "{mem} |= {hex} (market timer expired)",
    "instructionAddress": 9877179,
    "expectedSize": 4,
    "opcode": 12
  },
  {
    "shape": "{mem} |= {hex} (square-reminder message in market shown)",
    "instructionAddress": 9877664,
    "expectedSize": 4,
    "opcode": 12
  },
  {
    "shape": "{mem} &= {hex} (8bit mode) (unknown 'mids flag)",
    "instructionAddress": 9883404,
    "expectedSize": 4,
    "opcode": 12
  },
  {
    "shape": "{mem} |= {hex} (dog unavailable)",
    "instructionAddress": 9883690,
    "expectedSize": 4,
    "opcode": 12
  },
  {
    "shape": "{mem} &= {hex} (8bit mode) (dog unavailable)",
    "instructionAddress": 9883700,
    "expectedSize": 4,
    "opcode": 12
  },
  {
    "shape": "{mem} |= {hex}",
    "instructionAddress": 9883754,
    "expectedSize": 4,
    "opcode": 12
  },
  {
    "shape": "{mem} |= {hex} (windwalker unlocked)",
    "instructionAddress": 9946464,
    "expectedSize": 4,
    "opcode": 12
  },
  {
    "shape": "{mem} &= {hex} (8bit mode) (ww landing (set before loading fire pit from ow))",
    "instructionAddress": 9948230,
    "expectedSize": 4,
    "opcode": 12
  },
  {
    "shape": "{mem} |= {hex} (ww landing (set before loading fire pit from ow))",
    "instructionAddress": 9948492,
    "expectedSize": 4,
    "opcode": 12
  },
  {
    "shape": "{mem} |= {hex} (queen cutscene below chessboard watched)",
    "instructionAddress": 10001606,
    "expectedSize": 4,
    "opcode": 12
  },
  {
    "shape": "{mem} |= {hex} (prison door {num} open)",
    "instructionAddress": 10006522,
    "expectedSize": 4,
    "opcode": 12
  },
  {
    "shape": "{mem} &= {hex} (8bit mode) (prison door {num} open)",
    "instructionAddress": 10006648,
    "expectedSize": 4,
    "opcode": 12
  },
  {
    "shape": "{mem} &= {hex} (8bit mode)",
    "instructionAddress": 10013420,
    "expectedSize": 4,
    "opcode": 12
  },
  {
    "shape": "{mem} &= {hex} (8bit mode) (in animation)",
    "instructionAddress": 10083219,
    "expectedSize": 4,
    "opcode": 12
  },
  {
    "shape": "{mem} |= {hex} (sterling dead)",
    "instructionAddress": 10128411,
    "expectedSize": 4,
    "opcode": 12
  },
  {
    "shape": "{mem} |= {hex} (in animation)",
    "instructionAddress": 10130124,
    "expectedSize": 4,
    "opcode": 12
  },
  {
    "shape": "{mem} &= {hex} (8bit mode) (crustacia intro to be shown)",
    "instructionAddress": 10140439,
    "expectedSize": 4,
    "opcode": 12
  },
  {
    "shape": "{mem} |= {hex} (naris' age?)",
    "instructionAddress": 10140834,
    "expectedSize": 4,
    "opcode": 12
  },
  {
    "shape": "{mem} &= {hex} (8bit mode) (naris' age?)",
    "instructionAddress": 10140848,
    "expectedSize": 4,
    "opcode": 12
  },
  {
    "shape": "{mem} |= {hex} if (!{mem} & {hex}) else {mem} &= ~{hex}",
    "instructionAddress": 10140859,
    "expectedSize": 7,
    "opcode": 12
  },
  {
    "shape": "{mem} |= {hex} (jaguar ring)",
    "instructionAddress": 10205601,
    "expectedSize": 28,
    "opcode": 12
  }
];

test('opcode shape corpus 0x0c', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
