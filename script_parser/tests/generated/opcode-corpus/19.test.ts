import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 25,
    "instructionAddress": 9752477,
    "expectedSize": 4,
    "text": "WRITE $2843 = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9822573,
    "expectedSize": 4,
    "text": "WRITE $2844 = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9822828,
    "expectedSize": 4,
    "text": "WRITE $283e = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9752485,
    "expectedSize": 4,
    "text": "WRITE $283b = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9671141,
    "expectedSize": 4,
    "text": "WRITE $285b = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9688203,
    "expectedSize": 4,
    "text": "WRITE $2867 = 0x0000"
  },
  {
    "opcode": 25,
    "instructionAddress": 10079539,
    "expectedSize": 9,
    "text": "WRITE $2834 = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 10076979,
    "expectedSize": 9,
    "text": "WRITE $2835 = 0x0077"
  },
  {
    "opcode": 25,
    "instructionAddress": 9944832,
    "expectedSize": 4,
    "text": "WRITE $283c = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9877362,
    "expectedSize": 4,
    "text": "WRITE $2851 = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9752298,
    "expectedSize": 4,
    "text": "WRITE $284f = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 10128521,
    "expectedSize": 11,
    "text": "WRITE $2835 = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9752244,
    "expectedSize": 4,
    "text": "WRITE $2853 = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9877462,
    "expectedSize": 4,
    "text": "WRITE $283f = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9819261,
    "expectedSize": 11,
    "text": "WRITE $2834 = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9814461,
    "expectedSize": 4,
    "text": "WRITE $284e = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 10128637,
    "expectedSize": 4,
    "text": "WRITE $283b = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 10076927,
    "expectedSize": 4,
    "text": "WRITE $2835 = 0xfffa"
  },
  {
    "opcode": 25,
    "instructionAddress": 9687577,
    "expectedSize": 4,
    "text": "WRITE $2867 = 0x0000"
  },
  {
    "opcode": 25,
    "instructionAddress": 9687730,
    "expectedSize": 4,
    "text": "WRITE $2867 = 0x0000"
  },
  {
    "opcode": 25,
    "instructionAddress": 9885176,
    "expectedSize": 4,
    "text": "WRITE $2841 = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 10128695,
    "expectedSize": 4,
    "text": "WRITE $2839 = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9752332,
    "expectedSize": 4,
    "text": "WRITE $2851 = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 10214754,
    "expectedSize": 11,
    "text": "WRITE $2859 = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 10079603,
    "expectedSize": 9,
    "text": "WRITE $283c = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9687823,
    "expectedSize": 4,
    "text": "WRITE $2867 = 0x0000"
  },
  {
    "opcode": 25,
    "instructionAddress": 9744927,
    "expectedSize": 4,
    "text": "WRITE $2834 = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 10006652,
    "expectedSize": 4,
    "text": "WRITE $283d = 0x0005"
  },
  {
    "opcode": 25,
    "instructionAddress": 9809964,
    "expectedSize": 9,
    "text": "WRITE $283b = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9687688,
    "expectedSize": 4,
    "text": "WRITE $286f = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9671087,
    "expectedSize": 4,
    "text": "WRITE $283d = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9688098,
    "expectedSize": 6,
    "text": "WRITE $2859 = $23e3"
  },
  {
    "opcode": 25,
    "instructionAddress": 10069746,
    "expectedSize": 4,
    "text": "WRITE $2839 = 0x0000"
  },
  {
    "opcode": 25,
    "instructionAddress": 9822852,
    "expectedSize": 4,
    "text": "WRITE $2846 = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9738829,
    "expectedSize": 4,
    "text": "WRITE $283b = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 10129049,
    "expectedSize": 4,
    "text": "WRITE $2839 = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9687781,
    "expectedSize": 4,
    "text": "WRITE $286f = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9757634,
    "expectedSize": 4,
    "text": "WRITE $2835 = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9745473,
    "expectedSize": 9,
    "text": "WRITE $2836 = $2836 - 2"
  },
  {
    "opcode": 25,
    "instructionAddress": 9747977,
    "expectedSize": 9,
    "text": "WRITE $2854 = $2854 + 1"
  },
  {
    "opcode": 25,
    "instructionAddress": 9738719,
    "expectedSize": 4,
    "text": "WRITE $283f = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9687795,
    "expectedSize": 4,
    "text": "WRITE $2871 = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9822915,
    "expectedSize": 4,
    "text": "WRITE $283c = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9742572,
    "expectedSize": 4,
    "text": "WRITE $2839 = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9810160,
    "expectedSize": 9,
    "text": "WRITE $2835 = $2835 + 1"
  },
  {
    "opcode": 25,
    "instructionAddress": 9629749,
    "expectedSize": 4,
    "text": "WRITE $2836 = 0x000e"
  },
  {
    "opcode": 25,
    "instructionAddress": 9738746,
    "expectedSize": 4,
    "text": "WRITE $2841 = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9814643,
    "expectedSize": 4,
    "text": "WRITE $2836 = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9759596,
    "expectedSize": 11,
    "text": "WRITE $2838 = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9738790,
    "expectedSize": 4,
    "text": "WRITE $2839 = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9752436,
    "expectedSize": 4,
    "text": "WRITE $2839 = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9885281,
    "expectedSize": 4,
    "text": "WRITE $2837 = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9687565,
    "expectedSize": 4,
    "text": "WRITE $287d = 0x0000"
  },
  {
    "opcode": 25,
    "instructionAddress": 9814579,
    "expectedSize": 4,
    "text": "WRITE $284c = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9822639,
    "expectedSize": 4,
    "text": "WRITE $284c = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9626098,
    "expectedSize": 4,
    "text": "WRITE $2834 = 0x0000"
  },
  {
    "opcode": 25,
    "instructionAddress": 9955450,
    "expectedSize": 4,
    "text": "WRITE $283f = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9877348,
    "expectedSize": 4,
    "text": "WRITE $284f = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9822483,
    "expectedSize": 4,
    "text": "WRITE $2842 = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9944862,
    "expectedSize": 4,
    "text": "WRITE $2840 = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9877306,
    "expectedSize": 4,
    "text": "WRITE $2847 = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9798752,
    "expectedSize": 4,
    "text": "WRITE $283b = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9745512,
    "expectedSize": 9,
    "text": "WRITE $2836 = $2836 + 2"
  },
  {
    "opcode": 25,
    "instructionAddress": 9955609,
    "expectedSize": 4,
    "text": "WRITE $284d = 0x0000"
  },
  {
    "opcode": 25,
    "instructionAddress": 9745551,
    "expectedSize": 9,
    "text": "WRITE $2836 = $2836 - 4"
  },
  {
    "opcode": 25,
    "instructionAddress": 9877278,
    "expectedSize": 4,
    "text": "WRITE $2843 = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9671039,
    "expectedSize": 4,
    "text": "WRITE $2839 = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9810169,
    "expectedSize": 9,
    "text": "WRITE $2837 = $2837 + 1"
  },
  {
    "opcode": 25,
    "instructionAddress": 9877334,
    "expectedSize": 4,
    "text": "WRITE $284d = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 10008701,
    "expectedSize": 6,
    "text": "WRITE $283a = $23ef"
  },
  {
    "opcode": 25,
    "instructionAddress": 9685164,
    "expectedSize": 9,
    "text": "WRITE $2863 = $2863 + 1"
  },
  {
    "opcode": 25,
    "instructionAddress": 9814688,
    "expectedSize": 11,
    "text": "WRITE $283c = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 10079571,
    "expectedSize": 9,
    "text": "WRITE $2838 = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9955504,
    "expectedSize": 4,
    "text": "WRITE $2843 = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9877390,
    "expectedSize": 4,
    "text": "WRITE $2855 = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9885154,
    "expectedSize": 4,
    "text": "WRITE $283d = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9687569,
    "expectedSize": 4,
    "text": "WRITE $287f = 0x0001"
  },
  {
    "opcode": 25,
    "instructionAddress": 9626289,
    "expectedSize": 4,
    "text": "WRITE $2834 = 0x0001"
  },
  {
    "opcode": 25,
    "instructionAddress": 9887733,
    "expectedSize": 4,
    "text": "WRITE $2835 = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 10192408,
    "expectedSize": 4,
    "text": "WRITE $2837 = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9955613,
    "expectedSize": 4,
    "text": "WRITE $284f = 0x0000"
  },
  {
    "opcode": 25,
    "instructionAddress": 9877440,
    "expectedSize": 4,
    "text": "WRITE $284b = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9748104,
    "expectedSize": 4,
    "text": "WRITE $284c = 0x0000"
  },
  {
    "opcode": 25,
    "instructionAddress": 9733344,
    "expectedSize": 6,
    "text": "WRITE $283b = 0x0e00"
  },
  {
    "opcode": 25,
    "instructionAddress": 9687553,
    "expectedSize": 4,
    "text": "WRITE $285d = 0x0000"
  },
  {
    "opcode": 25,
    "instructionAddress": 9877320,
    "expectedSize": 4,
    "text": "WRITE $2849 = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9747950,
    "expectedSize": 4,
    "text": "WRITE $2854 = 0x0001"
  },
  {
    "opcode": 25,
    "instructionAddress": 10195873,
    "expectedSize": 9,
    "text": "WRITE $283f = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9822618,
    "expectedSize": 4,
    "text": "WRITE $284a = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9733332,
    "expectedSize": 6,
    "text": "WRITE $2837 = 0x0e00"
  },
  {
    "opcode": 25,
    "instructionAddress": 10008683,
    "expectedSize": 6,
    "text": "WRITE $2834 = $23e9"
  },
  {
    "opcode": 25,
    "instructionAddress": 10134394,
    "expectedSize": 4,
    "text": "WRITE $2860 = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9810178,
    "expectedSize": 12,
    "text": "WRITE $284b = 3 + (3 * $2849)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9934199,
    "expectedSize": 4,
    "text": "WRITE $2837 = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9802684,
    "expectedSize": 4,
    "text": "WRITE $283c = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9810119,
    "expectedSize": 9,
    "text": "WRITE $2847 = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9687819,
    "expectedSize": 4,
    "text": "WRITE $2865 = 0x0000"
  },
  {
    "opcode": 25,
    "instructionAddress": 9885266,
    "expectedSize": 4,
    "text": "WRITE $2835 = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9757359,
    "expectedSize": 4,
    "text": "WRITE $2837 = last entity ($0341)"
  },
  {
    "opcode": 25,
    "instructionAddress": 9822654,
    "expectedSize": 4,
    "text": "WRITE $284e = last entity ($0341)"
  }
];

test('opcode corpus 0x19', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
