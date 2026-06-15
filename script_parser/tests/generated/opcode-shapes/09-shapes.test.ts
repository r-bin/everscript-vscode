import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "if (({mem} == {mem}) && ({mem} == {mem})) == false then skip {num} (to {hex})",
    "instructionAddress": 9625948,
    "expectedSize": 21,
    "opcode": 9
  },
  {
    "shape": "if (signed arg0 < signed arg6) == false then skip {num} (to {hex})",
    "instructionAddress": 9626113,
    "expectedSize": 16,
    "opcode": 9
  },
  {
    "shape": "if (signed arg2 > signed arg8) == false then skip {num} (to {hex})",
    "instructionAddress": 9626129,
    "expectedSize": 9,
    "opcode": 9
  },
  {
    "shape": "if (signed arg26 >= {hex}) == false then skip {num} (to {hex})",
    "instructionAddress": 9626328,
    "expectedSize": 9,
    "opcode": 9
  },
  {
    "shape": "if (signed arg26 <= {hex}) == false then skip {num} (to {hex})",
    "instructionAddress": 9626383,
    "expectedSize": 23,
    "opcode": 9
  },
  {
    "shape": "if !({mem}&{hex}) not(start pressed in intro) skip {num} (to {hex})",
    "instructionAddress": 9626696,
    "expectedSize": 6,
    "opcode": 9
  },
  {
    "shape": "if (signed arg0 > {num}) == false then skip {num} (to {hex})",
    "instructionAddress": 9627146,
    "expectedSize": 8,
    "opcode": 9
  },
  {
    "shape": "if (signed arg0 < {hex}) == false then skip {num} (to {hex})",
    "instructionAddress": 9671178,
    "expectedSize": 9,
    "opcode": 9
  },
  {
    "shape": "if !({mem}&{hex}) not(inside outro?) skip {num} (to {hex})",
    "instructionAddress": 9678025,
    "expectedSize": 6,
    "opcode": 9
  },
  {
    "shape": "if {mem}&{hex} (acid rain) skip {num} (to {hex})",
    "instructionAddress": 9678634,
    "expectedSize": 7,
    "opcode": 9
  },
  {
    "shape": "if !({mem}&{hex}) not(thraxx dead) skip {num} (to {hex})",
    "instructionAddress": 9679482,
    "expectedSize": 6,
    "opcode": 9
  },
  {
    "shape": "if !({mem}&{hex}) not(on bug legs) skip {num} (to {hex})",
    "instructionAddress": 9681300,
    "expectedSize": 6,
    "opcode": 9
  },
  {
    "shape": "if !({mem}&{hex}) not(running showcase) skip {num} (to {hex})",
    "instructionAddress": 9683999,
    "expectedSize": 12,
    "opcode": 9
  },
  {
    "shape": "if (script[{hex}] & {hex}) == false then skip {num} (to {hex})",
    "instructionAddress": 9685153,
    "expectedSize": 9,
    "opcode": 9
  },
  {
    "shape": "if ({mem} >= {mem}) == false then skip {num} (to {hex})",
    "instructionAddress": 9685214,
    "expectedSize": 11,
    "opcode": 9
  },
  {
    "shape": "if !({mem}&{hex}) not(debug) skip {num} (to {hex})",
    "instructionAddress": 9687605,
    "expectedSize": 6,
    "opcode": 9
  },
  {
    "shape": "if {mem}&{hex} (thraxx dead) skip {num} (to {hex})",
    "instructionAddress": 9687672,
    "expectedSize": 7,
    "opcode": 9
  },
  {
    "shape": "if ((!({mem}&{hex})) && ({mem}&{hex})) == false then skip {num} (to {hex})",
    "instructionAddress": 9687756,
    "expectedSize": 12,
    "opcode": 9
  },
  {
    "shape": "if (({mem}&{hex}) && ({mem} < {num})) == false then skip {num} (to {hex})",
    "instructionAddress": 9688014,
    "expectedSize": 14,
    "opcode": 9
  },
  {
    "shape": "if ({mem} > {num}) == false then skip {num} (to {hex})",
    "instructionAddress": 9688170,
    "expectedSize": 9,
    "opcode": 9
  },
  {
    "shape": "if ((({mem}&{hex}) == {num}) && ({mem} > {num})) == false then skip {num} (to {hex})",
    "instructionAddress": 9688186,
    "expectedSize": 17,
    "opcode": 9
  },
  {
    "shape": "if {mem}&{hex} (windwalker unlocked) skip {num} (to {hex})",
    "instructionAddress": 9733238,
    "expectedSize": 7,
    "opcode": 9
  },
  {
    "shape": "if !({mem}&{hex}) not(stepped on geyser) skip {num} (to {hex})",
    "instructionAddress": 9733273,
    "expectedSize": 6,
    "opcode": 9
  },
  {
    "shape": "if !({mem}&{hex}) not(volcano - viper commander spawn?) skip {num} (to {hex})",
    "instructionAddress": 9739104,
    "expectedSize": 6,
    "opcode": 9
  },
  {
    "shape": "if {mem}&{hex} (hard ball) skip {num} (to {hex})",
    "instructionAddress": 9742492,
    "expectedSize": 7,
    "opcode": 9
  },
  {
    "shape": "if {mem}&{hex} (cave raptors killed) skip {num} (to {hex})",
    "instructionAddress": 9742603,
    "expectedSize": 7,
    "opcode": 9
  },
  {
    "shape": "if (((((({mem})&{hex}) == {num}) || ((({mem})&{hex}) == {num})) || ((({mem})&{hex}) == {num})) || ((({mem})&{hex}) == {num})) == false then skip {num} (to {hex})",
    "instructionAddress": 9742687,
    "expectedSize": 33,
    "opcode": 9
  },
  {
    "shape": "if (((({mem})&{hex}) == {num}) && (!({mem}&{hex}))) == false then skip {num} (to {hex})",
    "instructionAddress": 9742753,
    "expectedSize": 15,
    "opcode": 9
  },
  {
    "shape": "if !({mem}&{hex}) not(pipe maze switch pressed?) skip {num} (to {hex})",
    "instructionAddress": 9744994,
    "expectedSize": 6,
    "opcode": 9
  },
  {
    "shape": "if {mem} == {hex} skip {num} (to {hex})",
    "instructionAddress": 9745426,
    "expectedSize": 6,
    "opcode": 9
  },
  {
    "shape": "if ({mem} < {hex}) == false then skip {num} (to {hex})",
    "instructionAddress": 9745491,
    "expectedSize": 11,
    "opcode": 9
  },
  {
    "shape": "if ({mem} <= {num}) == false then skip {num} (to {hex})",
    "instructionAddress": 9747954,
    "expectedSize": 9,
    "opcode": 9
  },
  {
    "shape": "if {mem}&{hex} (magmar dead) skip {num} (to {hex})",
    "instructionAddress": 9748038,
    "expectedSize": 7,
    "opcode": 9
  },
  {
    "shape": "if ({mem} >= {num}) == false then skip {num} (to {hex})",
    "instructionAddress": 9748078,
    "expectedSize": 9,
    "opcode": 9
  },
  {
    "shape": "if ({mem} > {hex}) == false then skip {num} (to {hex})",
    "instructionAddress": 9748094,
    "expectedSize": 10,
    "opcode": 9
  },
  {
    "shape": "if !({mem}&{hex}) not(talked to defend guy) skip {num} (to {hex})",
    "instructionAddress": 9752373,
    "expectedSize": 6,
    "opcode": 9
  },
  {
    "shape": "if ((gametimer&{hex}) <= ({mem} + {hex})) == false then skip {num} (to {hex})",
    "instructionAddress": 9752563,
    "expectedSize": 14,
    "opcode": 9
  },
  {
    "shape": "if !({mem}&{hex}) not(sniffed ash in fire eyes' village (#{num})) skip {num} (to {hex})",
    "instructionAddress": 9752577,
    "expectedSize": 6,
    "opcode": 9
  },
  {
    "shape": "if (({mem}&{hex}) && (!({mem}&{hex}))) == false then skip {num} (to {hex})",
    "instructionAddress": 9752651,
    "expectedSize": 12,
    "opcode": 9
  },
  {
    "shape": "if !({mem}&{hex}) not(fe visited pre-thraxx (east exit check)) skip {num} (to {hex})",
    "instructionAddress": 9757610,
    "expectedSize": 6,
    "opcode": 9
  },
  {
    "shape": "if (({mem}&{hex}) && ((({mem})&{hex}) == {num})) == false then skip {num} (to {hex})",
    "instructionAddress": 9757780,
    "expectedSize": 14,
    "opcode": 9
  },
  {
    "shape": "if {mem}&{hex} (talked to blimp in hut?) skip {num} (to {hex})",
    "instructionAddress": 9757872,
    "expectedSize": 7,
    "opcode": 9
  },
  {
    "shape": "if change music ({mem}) == {hex} skip {num} (to {hex})",
    "instructionAddress": 9758239,
    "expectedSize": 6,
    "opcode": 9
  },
  {
    "shape": "if (({mem}&{hex}) == {num}) == false then skip {num} (to {hex})",
    "instructionAddress": 9798814,
    "expectedSize": 9,
    "opcode": 9
  },
  {
    "shape": "if !({mem}&{hex}) not(crustacia intro to be shown) skip {num} (to {hex})",
    "instructionAddress": 9798955,
    "expectedSize": 6,
    "opcode": 9
  },
  {
    "shape": "if !({mem}&{hex}) not(unknown flag checked out and inside 'mids. dog freed?) skip {num} (to {hex})",
    "instructionAddress": 9802622,
    "expectedSize": 6,
    "opcode": 9
  },
  {
    "shape": "if !({mem}&{hex}) not(unknown 'mids flag) skip {num} (to {hex})",
    "instructionAddress": 9802919,
    "expectedSize": 6,
    "opcode": 9
  },
  {
    "shape": "if !({mem}&{hex}) not(wall below 'mids broken) skip {num} (to {hex})",
    "instructionAddress": 9808139,
    "expectedSize": 6,
    "opcode": 9
  },
  {
    "shape": "if !({mem}&{hex}) not(unknown flag checked below 'mids. levitated?) skip {num} (to {hex})",
    "instructionAddress": 9808179,
    "expectedSize": 6,
    "opcode": 9
  },
  {
    "shape": "if !({mem}&{hex}) not(diamond eye 'mids) skip {num} (to {hex})",
    "instructionAddress": 9809934,
    "expectedSize": 6,
    "opcode": 9
  },
  {
    "shape": "if {mem}&{hex} (diamond eye 'mids) skip {num} (to {hex})",
    "instructionAddress": 9810145,
    "expectedSize": 7,
    "opcode": 9
  },
  {
    "shape": "if ({mem}&{hex}) == false then skip {num} (to {hex})",
    "instructionAddress": 9810154,
    "expectedSize": 6,
    "opcode": 9
  },
  {
    "shape": "if (({mem} > {mem}) && (!({mem}&{hex}))) == false then skip {num} (to {hex})",
    "instructionAddress": 9810190,
    "expectedSize": 17,
    "opcode": 9
  },
  {
    "shape": "if (({mem} > {num}) && (!({mem}&{hex}))) == false then skip {num} (to {hex})",
    "instructionAddress": 9810214,
    "expectedSize": 15,
    "opcode": 9
  },
  {
    "shape": "if !({mem}&{hex}) not(crush dialog to be shown) skip {num} (to {hex})",
    "instructionAddress": 9812839,
    "expectedSize": 6,
    "opcode": 9
  },
  {
    "shape": "if (!(({mem}&{hex}) || (({mem})&{hex}))) == false then skip {num} (to {hex})",
    "instructionAddress": 9814485,
    "expectedSize": 12,
    "opcode": 9
  },
  {
    "shape": "if (({mem}&{hex}) || (({mem})&{hex})) == false then skip {num} (to {hex})",
    "instructionAddress": 9814840,
    "expectedSize": 11,
    "opcode": 9
  },
  {
    "shape": "if !({mem}&{hex}) not(market timer expired) skip {num} (to {hex})",
    "instructionAddress": 9816904,
    "expectedSize": 6,
    "opcode": 9
  },
  {
    "shape": "if !({mem}&{hex}) not(vigor defeated) skip {num} (to {hex})",
    "instructionAddress": 9819350,
    "expectedSize": 6,
    "opcode": 9
  },
  {
    "shape": "if (entity attached to script? == boy) == false then skip {num} (to {hex})",
    "instructionAddress": 9822947,
    "expectedSize": 7,
    "opcode": 9
  },
  {
    "shape": "if {mem}&{hex} (atlas) skip {num} (to {hex})",
    "instructionAddress": 9824639,
    "expectedSize": 7,
    "opcode": 9
  },
  {
    "shape": "if ({mem} == {num}) == false then skip {num} (to {hex})",
    "instructionAddress": 9877083,
    "expectedSize": 9,
    "opcode": 9
  },
  {
    "shape": "if {mem} == false then skip {num} (to {hex})",
    "instructionAddress": 9877153,
    "expectedSize": 6,
    "opcode": 9
  },
  {
    "shape": "if ((!({mem}&{hex})) && (((gametimer&{hex}) - {mem}) > {hex})) == false then skip {num} (to {hex})",
    "instructionAddress": 9877159,
    "expectedSize": 20,
    "opcode": 9
  },
  {
    "shape": "if {mem}&{hex} (dog unavailable) skip {num} (to {hex})",
    "instructionAddress": 9877618,
    "expectedSize": 7,
    "opcode": 9
  },
  {
    "shape": "if {mem}&{hex} (vigor defeated) skip {num} (to {hex})",
    "instructionAddress": 9877672,
    "expectedSize": 7,
    "opcode": 9
  },
  {
    "shape": "if {mem}&{hex} (aegis dead) skip {num} (to {hex})",
    "instructionAddress": 9877688,
    "expectedSize": 7,
    "opcode": 9
  },
  {
    "shape": "if (({mem}&{hex}) or ({mem}&{hex})) skip {num} (to {hex})",
    "instructionAddress": 9877708,
    "expectedSize": 13,
    "opcode": 9
  },
  {
    "shape": "if (((gametimer&{hex}) - {mem}) > {hex}) == false then skip {num} (to {hex})",
    "instructionAddress": 9877721,
    "expectedSize": 14,
    "opcode": 9
  },
  {
    "shape": "if (!({mem}&{hex})) == false then skip {num} (to {hex})",
    "instructionAddress": 9877746,
    "expectedSize": 7,
    "opcode": 9
  },
  {
    "shape": "if !({mem}&{hex}) not(aegis dead) skip {num} (to {hex})",
    "instructionAddress": 9883547,
    "expectedSize": 6,
    "opcode": 9
  },
  {
    "shape": "if (({mem}&{hex}) && ({mem}&{hex})) == false then skip {num} (to {hex})",
    "instructionAddress": 9883587,
    "expectedSize": 11,
    "opcode": 9
  },
  {
    "shape": "if ((({mem})&{hex}) != {num}) == false then skip {num} (to {hex})",
    "instructionAddress": 9883635,
    "expectedSize": 9,
    "opcode": 9
  },
  {
    "shape": "if ((({mem}&{hex}) && ({mem}&{hex})) && (!({mem}&{hex}))) == false then skip {num} (to {hex})",
    "instructionAddress": 9883737,
    "expectedSize": 17,
    "opcode": 9
  },
  {
    "shape": "if ((({mem})&{hex}) == {hex}) == false then skip {num} (to {hex})",
    "instructionAddress": 9885289,
    "expectedSize": 10,
    "opcode": 9
  },
  {
    "shape": "if !({mem}&{hex}) not(falling into a pit) skip {num} (to {hex})",
    "instructionAddress": 9887782,
    "expectedSize": 6,
    "opcode": 9
  },
  {
    "shape": "if !({mem}&{hex}) not(fireball) skip {num} (to {hex})",
    "instructionAddress": 9937616,
    "expectedSize": 6,
    "opcode": 9
  },
  {
    "shape": "if (({mem}&{hex}) || ({mem} == {num})) == false then skip {num} (to {hex})",
    "instructionAddress": 9945409,
    "expectedSize": 14,
    "opcode": 9
  },
  {
    "shape": "if {mem} & {hex} (ww landing (set before loading fire pit from ow)) && {mem}=={hex} skip {num} (to {hex})",
    "instructionAddress": 9945572,
    "expectedSize": 24,
    "opcode": 9
  },
  {
    "shape": "if !({mem}&{hex}) not(windwalker unlocked) skip {num} (to {hex})",
    "instructionAddress": 9946638,
    "expectedSize": 6,
    "opcode": 9
  },
  {
    "shape": "if !({mem}&{hex}) not(dog unavailable) skip {num} (to {hex})",
    "instructionAddress": 9946755,
    "expectedSize": 6,
    "opcode": 9
  },
  {
    "shape": "if (({mem}&{hex}) && ({mem} == {num})) == false then skip {num} (to {hex})",
    "instructionAddress": 9948093,
    "expectedSize": 14,
    "opcode": 9
  },
  {
    "shape": "if ((({mem}&{hex}) || ({mem} == {num})) || ({mem} == {num})) == false then skip {num} (to {hex})",
    "instructionAddress": 9948234,
    "expectedSize": 22,
    "opcode": 9
  },
  {
    "shape": "if (({mem} == {num}) || ({mem} == {num})) == false then skip {num} (to {hex})",
    "instructionAddress": 9948262,
    "expectedSize": 17,
    "opcode": 9
  },
  {
    "shape": "if ((({mem})&{hex}) & {num}) == false then skip {num} (to {hex})",
    "instructionAddress": 9996974,
    "expectedSize": 9,
    "opcode": 9
  },
  {
    "shape": "if (({mem}&{hex}) || ({mem}&{hex})) == false then skip {num} (to {hex})",
    "instructionAddress": 9998399,
    "expectedSize": 11,
    "opcode": 9
  },
  {
    "shape": "if !({mem}&{hex}) not(west castle collapsed) skip {num} (to {hex})",
    "instructionAddress": 9998517,
    "expectedSize": 6,
    "opcode": 9
  },
  {
    "shape": "if (((!({mem}&{hex})) && (({mem})&{hex})) || (({mem}&{hex}) && (({mem})&{hex}))) == false then skip {num} (to {hex})",
    "instructionAddress": 10006496,
    "expectedSize": 22,
    "opcode": 9
  },
  {
    "shape": "if {mem}&{hex} (load east castle) skip {num} (to {hex})",
    "instructionAddress": 10006660,
    "expectedSize": 7,
    "opcode": 9
  },
  {
    "shape": "if (({mem})&{hex}) == false then skip {num} (to {hex})",
    "instructionAddress": 10006817,
    "expectedSize": 6,
    "opcode": 9
  },
  {
    "shape": "if {mem}&{hex} (in animation) skip {num} (to {hex})",
    "instructionAddress": 10007346,
    "expectedSize": 7,
    "opcode": 9
  },
  {
    "shape": "if ((!({mem}&{hex})) || ({mem}&{hex})) == false then skip {num} (to {hex})",
    "instructionAddress": 10011847,
    "expectedSize": 12,
    "opcode": 9
  },
  {
    "shape": "if !({mem}&{hex}) not(load east castle) skip {num} (to {hex})",
    "instructionAddress": 10013293,
    "expectedSize": 6,
    "opcode": 9
  },
  {
    "shape": "if (({mem}&{hex}) != ({mem}&{hex})) == false then skip {num} (to {hex})",
    "instructionAddress": 10013395,
    "expectedSize": 11,
    "opcode": 9
  },
  {
    "shape": "if !({mem}&{hex}) not(talked to cecil) skip {num} (to {hex})",
    "instructionAddress": 10018831,
    "expectedSize": 6,
    "opcode": 9
  },
  {
    "shape": "if (({mem}&{hex}) == ({mem}&{hex})) == false then skip {num} (to {hex})",
    "instructionAddress": 10019032,
    "expectedSize": 11,
    "opcode": 9
  },
  {
    "shape": "if !({mem}&{hex}) not(lance) skip {num} (to {hex})",
    "instructionAddress": 10019172,
    "expectedSize": 6,
    "opcode": 9
  },
  {
    "shape": "if (!(({mem}&{hex}) || ({mem}&{hex}))) == false then skip {num} (to {hex})",
    "instructionAddress": 10019642,
    "expectedSize": 12,
    "opcode": 9
  },
  {
    "shape": "if !({mem}&{hex}) not(prof. callbeads) skip {num} (to {hex})",
    "instructionAddress": 10063128,
    "expectedSize": 6,
    "opcode": 9
  },
  {
    "shape": "if (!(({mem})&{hex})) == false then skip {num} (to {hex})",
    "instructionAddress": 10063193,
    "expectedSize": 7,
    "opcode": 9
  },
  {
    "shape": "if (({mem} == {num}) && ((({mem})&{hex}) == {num})) == false then skip {num} (to {hex})",
    "instructionAddress": 10063230,
    "expectedSize": 17,
    "opcode": 9
  },
  {
    "shape": "if {mem}&{hex} (sterling dead) skip {num} (to {hex})",
    "instructionAddress": 10069900,
    "expectedSize": 7,
    "opcode": 9
  },
  {
    "shape": "if ({mem} == -{num}) == false then skip {num} (to {hex})",
    "instructionAddress": 10076943,
    "expectedSize": 9,
    "opcode": 9
  },
  {
    "shape": "if ({mem} == {hex}) == false then skip {num} (to {hex})",
    "instructionAddress": 10077027,
    "expectedSize": 10,
    "opcode": 9
  },
  {
    "shape": "if (signed arg0 == -{num}) == false then skip {num} (to {hex})",
    "instructionAddress": 10077095,
    "expectedSize": 8,
    "opcode": 9
  },
  {
    "shape": "if (signed arg0 == {hex}) == false then skip {num} (to {hex})",
    "instructionAddress": 10077124,
    "expectedSize": 9,
    "opcode": 9
  },
  {
    "shape": "if !({mem}&{hex}) not(timberdrake dead) skip {num} (to {hex})",
    "instructionAddress": 10079770,
    "expectedSize": 6,
    "opcode": 9
  },
  {
    "shape": "if !({mem}&{hex}) not(second half of lab cutscene to be played) skip {num} (to {hex})",
    "instructionAddress": 10082773,
    "expectedSize": 6,
    "opcode": 9
  },
  {
    "shape": "if ({mem} < {num}) == false then skip {num} (to {hex})",
    "instructionAddress": 10087822,
    "expectedSize": 9,
    "opcode": 9
  },
  {
    "shape": "if !({mem}&{hex}) not(verminator dead) skip {num} (to {hex})",
    "instructionAddress": 10125895,
    "expectedSize": 6,
    "opcode": 9
  },
  {
    "shape": "if !({mem}&{hex}) not(sterling dead) skip {num} (to {hex})",
    "instructionAddress": 10128437,
    "expectedSize": 6,
    "opcode": 9
  },
  {
    "shape": "if (signed arg4 > {hex}) == false then skip {num} (to {hex})",
    "instructionAddress": 10129119,
    "expectedSize": 10,
    "opcode": 9
  },
  {
    "shape": "if ((rand & {num}) && ({mem} will die)) == false then skip {num} (to {hex})",
    "instructionAddress": 10129261,
    "expectedSize": 20,
    "opcode": 9
  },
  {
    "shape": "if ({mem} will die) == false then skip {num} (to {hex})",
    "instructionAddress": 10129315,
    "expectedSize": 14,
    "opcode": 9
  },
  {
    "shape": "if (signed arg4 < {num}) == false then skip {num} (to {hex})",
    "instructionAddress": 10129340,
    "expectedSize": 14,
    "opcode": 9
  },
  {
    "shape": "if (signed arg6 < {num}) == false then skip {num} (to {hex})",
    "instructionAddress": 10129373,
    "expectedSize": 8,
    "opcode": 9
  },
  {
    "shape": "if (signed arg0 < signed arg8) == false then skip {num} (to {hex})",
    "instructionAddress": 10129615,
    "expectedSize": 9,
    "opcode": 9
  },
  {
    "shape": "if (signed arg12 == {num}) == false then skip {num} (to {hex})",
    "instructionAddress": 10129639,
    "expectedSize": 11,
    "opcode": 9
  },
  {
    "shape": "if ((signed arg8 - signed arg0) == {num}) == false then skip {num} (to {hex})",
    "instructionAddress": 10129794,
    "expectedSize": 12,
    "opcode": 9
  },
  {
    "shape": "if {mem}&{hex} (chocobo egg) skip {num} (to {hex})",
    "instructionAddress": 10134353,
    "expectedSize": 7,
    "opcode": 9
  },
  {
    "shape": "if {mem}&{hex} skip {num} (to {hex})",
    "instructionAddress": 10136319,
    "expectedSize": 7,
    "opcode": 9
  },
  {
    "shape": "if ((({mem})&{hex}) == {num}) == false then skip {num} (to {hex})",
    "instructionAddress": 10138487,
    "expectedSize": 9,
    "opcode": 9
  },
  {
    "shape": "if {mem}&{hex} (pigrace finished) skip {num} (to {hex})",
    "instructionAddress": 10138510,
    "expectedSize": 7,
    "opcode": 9
  },
  {
    "shape": "if !({mem}&{hex}) not(ww landing (set before loading fire pit from ow)) skip {num} (to {hex})",
    "instructionAddress": 10145899,
    "expectedSize": 6,
    "opcode": 9
  },
  {
    "shape": "if !({mem}&{hex}) not(boy unavailable) skip {num} (to {hex})",
    "instructionAddress": 10146667,
    "expectedSize": 6,
    "opcode": 9
  },
  {
    "shape": "if (arg0 == {hex}) == false then skip {num} (to {hex})",
    "instructionAddress": 10146709,
    "expectedSize": 9,
    "opcode": 9
  },
  {
    "shape": "if !({mem}&{hex}) not(light in storage room) skip {num} (to {hex})",
    "instructionAddress": 10194309,
    "expectedSize": 6,
    "opcode": 9
  },
  {
    "shape": "if !({mem}&{hex}) skip {num} (to {hex})",
    "instructionAddress": 10195917,
    "expectedSize": 6,
    "opcode": 9
  },
  {
    "shape": "if !({mem}&{hex}) not(opened laser lance gourd) skip {num} (to {hex})",
    "instructionAddress": 10214559,
    "expectedSize": 6,
    "opcode": 9
  },
  {
    "shape": "if (((!({mem}&{hex})) || ({mem}&{hex})) || ({mem}&{hex})) == false then skip {num} (to {hex})",
    "instructionAddress": 10214583,
    "expectedSize": 17,
    "opcode": 9
  },
  {
    "shape": "if !({mem}&{hex}) not(in credits) skip {num} (to {hex})",
    "instructionAddress": 10214608,
    "expectedSize": 6,
    "opcode": 9
  },
  {
    "shape": "if !({mem}&{hex}) not(unknown intro/outro? flag in prof. lab) skip {num} (to {hex})",
    "instructionAddress": 10214782,
    "expectedSize": 6,
    "opcode": 9
  }
];

test('opcode shape corpus 0x09', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
