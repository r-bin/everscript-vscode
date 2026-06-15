import test from 'node:test';
import assert from 'node:assert/strict';

import { dumpScript } from '../../model/rom-script-model.ts';

const SCRIPT_BOUNDARIES = [
  {
    "startAddress": 9601024,
    "endAddress": 9685233,
    "size": 84209
  },
  {
    "startAddress": 9625802,
    "endAddress": 9626540,
    "size": 738
  },
  {
    "startAddress": 9626674,
    "endAddress": 9627038,
    "size": 364
  },
  {
    "startAddress": 9627039,
    "endAddress": 9627208,
    "size": 169
  },
  {
    "startAddress": 9629004,
    "endAddress": 9629022,
    "size": 18
  },
  {
    "startAddress": 9629448,
    "endAddress": 9629787,
    "size": 339
  },
  {
    "startAddress": 9667801,
    "endAddress": 9668290,
    "size": 489
  },
  {
    "startAddress": 9670956,
    "endAddress": 9671203,
    "size": 247
  },
  {
    "startAddress": 9671999,
    "endAddress": 9672304,
    "size": 305
  },
  {
    "startAddress": 9678007,
    "endAddress": 9678041,
    "size": 34
  },
  {
    "startAddress": 9678598,
    "endAddress": 9678691,
    "size": 93
  },
  {
    "startAddress": 9679276,
    "endAddress": 9679585,
    "size": 309
  },
  {
    "startAddress": 9680842,
    "endAddress": 9681342,
    "size": 500
  },
  {
    "startAddress": 9683650,
    "endAddress": 9684038,
    "size": 388
  },
  {
    "startAddress": 9684448,
    "endAddress": 9684653,
    "size": 205
  },
  {
    "startAddress": 9687553,
    "endAddress": 9688235,
    "size": 682
  },
  {
    "startAddress": 9691159,
    "endAddress": 9691393,
    "size": 234
  },
  {
    "startAddress": 9694489,
    "endAddress": 9694501,
    "size": 12
  },
  {
    "startAddress": 9733205,
    "endAddress": 9733374,
    "size": 169
  },
  {
    "startAddress": 9733793,
    "endAddress": 9733876,
    "size": 83
  },
  {
    "startAddress": 9734311,
    "endAddress": 9734565,
    "size": 254
  },
  {
    "startAddress": 9736170,
    "endAddress": 9736929,
    "size": 759
  },
  {
    "startAddress": 9738646,
    "endAddress": 9739160,
    "size": 514
  },
  {
    "startAddress": 9740193,
    "endAddress": 9740784,
    "size": 591
  },
  {
    "startAddress": 9742242,
    "endAddress": 9742771,
    "size": 529
  },
  {
    "startAddress": 9743589,
    "endAddress": 9743691,
    "size": 102
  },
  {
    "startAddress": 9744808,
    "endAddress": 9745597,
    "size": 789
  },
  {
    "startAddress": 9747836,
    "endAddress": 9748112,
    "size": 276
  },
  {
    "startAddress": 9752059,
    "endAddress": 9752666,
    "size": 607
  },
  {
    "startAddress": 9757166,
    "endAddress": 9757896,
    "size": 730
  },
  {
    "startAddress": 9758077,
    "endAddress": 9758182,
    "size": 105
  },
  {
    "startAddress": 9758203,
    "endAddress": 9758262,
    "size": 59
  },
  {
    "startAddress": 9758613,
    "endAddress": 9758688,
    "size": 75
  },
  {
    "startAddress": 9758886,
    "endAddress": 9758942,
    "size": 56
  },
  {
    "startAddress": 9759509,
    "endAddress": 9759653,
    "size": 144
  },
  {
    "startAddress": 9798723,
    "endAddress": 9798964,
    "size": 241
  },
  {
    "startAddress": 9802603,
    "endAddress": 9802956,
    "size": 353
  },
  {
    "startAddress": 9804296,
    "endAddress": 9804620,
    "size": 324
  },
  {
    "startAddress": 9808067,
    "endAddress": 9808618,
    "size": 551
  },
  {
    "startAddress": 9809907,
    "endAddress": 9810239,
    "size": 332
  },
  {
    "startAddress": 9810729,
    "endAddress": 9810910,
    "size": 181
  },
  {
    "startAddress": 9812671,
    "endAddress": 9812967,
    "size": 296
  },
  {
    "startAddress": 9814388,
    "endAddress": 9814871,
    "size": 483
  },
  {
    "startAddress": 9816691,
    "endAddress": 9816985,
    "size": 294
  },
  {
    "startAddress": 9818026,
    "endAddress": 9818129,
    "size": 103
  },
  {
    "startAddress": 9819170,
    "endAddress": 9819366,
    "size": 196
  },
  {
    "startAddress": 9819900,
    "endAddress": 9819969,
    "size": 69
  },
  {
    "startAddress": 9822352,
    "endAddress": 9823013,
    "size": 661
  },
  {
    "startAddress": 9823494,
    "endAddress": 9823717,
    "size": 223
  },
  {
    "startAddress": 9824537,
    "endAddress": 9824681,
    "size": 144
  },
  {
    "startAddress": 9877040,
    "endAddress": 9877773,
    "size": 733
  },
  {
    "startAddress": 9878744,
    "endAddress": 9878962,
    "size": 218
  },
  {
    "startAddress": 9880571,
    "endAddress": 9880583,
    "size": 12
  },
  {
    "startAddress": 9883368,
    "endAddress": 9883761,
    "size": 393
  },
  {
    "startAddress": 9885128,
    "endAddress": 9885315,
    "size": 187
  },
  {
    "startAddress": 9887589,
    "endAddress": 9887880,
    "size": 291
  },
  {
    "startAddress": 9930184,
    "endAddress": 9930196,
    "size": 12
  },
  {
    "startAddress": 9932340,
    "endAddress": 9932427,
    "size": 87
  },
  {
    "startAddress": 9932900,
    "endAddress": 9933038,
    "size": 138
  },
  {
    "startAddress": 9934039,
    "endAddress": 9934294,
    "size": 255
  },
  {
    "startAddress": 9935499,
    "endAddress": 9935752,
    "size": 253
  },
  {
    "startAddress": 9936108,
    "endAddress": 9936198,
    "size": 90
  },
  {
    "startAddress": 9937587,
    "endAddress": 9937868,
    "size": 281
  },
  {
    "startAddress": 9938931,
    "endAddress": 9939001,
    "size": 70
  },
  {
    "startAddress": 9940666,
    "endAddress": 9940849,
    "size": 183
  },
  {
    "startAddress": 9944744,
    "endAddress": 9944903,
    "size": 159
  },
  {
    "startAddress": 9945356,
    "endAddress": 9945620,
    "size": 264
  },
  {
    "startAddress": 9946435,
    "endAddress": 9946871,
    "size": 436
  },
  {
    "startAddress": 9948003,
    "endAddress": 9948516,
    "size": 513
  },
  {
    "startAddress": 9951272,
    "endAddress": 9951743,
    "size": 471
  },
  {
    "startAddress": 9952608,
    "endAddress": 9952710,
    "size": 102
  },
  {
    "startAddress": 9952842,
    "endAddress": 9953043,
    "size": 201
  },
  {
    "startAddress": 9955382,
    "endAddress": 9955692,
    "size": 310
  },
  {
    "startAddress": 9996538,
    "endAddress": 9997143,
    "size": 605
  },
  {
    "startAddress": 9998399,
    "endAddress": 9998688,
    "size": 289
  },
  {
    "startAddress": 9999597,
    "endAddress": 9999770,
    "size": 173
  },
  {
    "startAddress": 10001540,
    "endAddress": 10001620,
    "size": 80
  },
  {
    "startAddress": 10003255,
    "endAddress": 10003360,
    "size": 105
  },
  {
    "startAddress": 10006496,
    "endAddress": 10006859,
    "size": 363
  },
  {
    "startAddress": 10006898,
    "endAddress": 10006961,
    "size": 63
  },
  {
    "startAddress": 10007346,
    "endAddress": 10007607,
    "size": 261
  },
  {
    "startAddress": 10008599,
    "endAddress": 10008773,
    "size": 174
  },
  {
    "startAddress": 10009415,
    "endAddress": 10009712,
    "size": 297
  },
  {
    "startAddress": 10011639,
    "endAddress": 10012141,
    "size": 502
  },
  {
    "startAddress": 10013089,
    "endAddress": 10013538,
    "size": 449
  },
  {
    "startAddress": 10018416,
    "endAddress": 10019656,
    "size": 1240
  },
  {
    "startAddress": 10020879,
    "endAddress": 10020954,
    "size": 75
  },
  {
    "startAddress": 10021028,
    "endAddress": 10021079,
    "size": 51
  },
  {
    "startAddress": 10022792,
    "endAddress": 10022908,
    "size": 116
  },
  {
    "startAddress": 10060577,
    "endAddress": 10060629,
    "size": 52
  },
  {
    "startAddress": 10062949,
    "endAddress": 10063254,
    "size": 305
  },
  {
    "startAddress": 10063922,
    "endAddress": 10064301,
    "size": 379
  },
  {
    "startAddress": 10064400,
    "endAddress": 10064441,
    "size": 41
  },
  {
    "startAddress": 10064756,
    "endAddress": 10064806,
    "size": 50
  },
  {
    "startAddress": 10069701,
    "endAddress": 10069949,
    "size": 248
  },
  {
    "startAddress": 10070010,
    "endAddress": 10070112,
    "size": 102
  },
  {
    "startAddress": 10076874,
    "endAddress": 10077140,
    "size": 266
  },
  {
    "startAddress": 10079451,
    "endAddress": 10079635,
    "size": 184
  },
  {
    "startAddress": 10079708,
    "endAddress": 10079799,
    "size": 91
  },
  {
    "startAddress": 10082478,
    "endAddress": 10082782,
    "size": 304
  },
  {
    "startAddress": 10083204,
    "endAddress": 10083391,
    "size": 187
  },
  {
    "startAddress": 10087696,
    "endAddress": 10087855,
    "size": 159
  },
  {
    "startAddress": 10087966,
    "endAddress": 10088203,
    "size": 237
  },
  {
    "startAddress": 10125728,
    "endAddress": 10125913,
    "size": 185
  },
  {
    "startAddress": 10125958,
    "endAddress": 10126196,
    "size": 238
  },
  {
    "startAddress": 10126297,
    "endAddress": 10126407,
    "size": 110
  },
  {
    "startAddress": 10128383,
    "endAddress": 10130137,
    "size": 1754
  },
  {
    "startAddress": 10134204,
    "endAddress": 10134610,
    "size": 406
  },
  {
    "startAddress": 10136296,
    "endAddress": 10136412,
    "size": 116
  },
  {
    "startAddress": 10138442,
    "endAddress": 10138529,
    "size": 87
  },
  {
    "startAddress": 10140349,
    "endAddress": 10140443,
    "size": 94
  },
  {
    "startAddress": 10140770,
    "endAddress": 10140980,
    "size": 210
  },
  {
    "startAddress": 10142596,
    "endAddress": 10142774,
    "size": 178
  },
  {
    "startAddress": 10145694,
    "endAddress": 10146061,
    "size": 367
  },
  {
    "startAddress": 10146657,
    "endAddress": 10146777,
    "size": 120
  },
  {
    "startAddress": 10146783,
    "endAddress": 10146854,
    "size": 71
  },
  {
    "startAddress": 10190848,
    "endAddress": 10191137,
    "size": 289
  },
  {
    "startAddress": 10192321,
    "endAddress": 10192669,
    "size": 348
  },
  {
    "startAddress": 10193115,
    "endAddress": 10193229,
    "size": 114
  },
  {
    "startAddress": 10194150,
    "endAddress": 10194328,
    "size": 178
  },
  {
    "startAddress": 10194869,
    "endAddress": 10194943,
    "size": 74
  },
  {
    "startAddress": 10195681,
    "endAddress": 10195927,
    "size": 246
  },
  {
    "startAddress": 10198835,
    "endAddress": 10198946,
    "size": 111
  },
  {
    "startAddress": 10205509,
    "endAddress": 10205728,
    "size": 219
  },
  {
    "startAddress": 10205729,
    "endAddress": 10205804,
    "size": 75
  },
  {
    "startAddress": 10214508,
    "endAddress": 10214845,
    "size": 337
  },
  {
    "startAddress": 10216097,
    "endAddress": 10216297,
    "size": 200
  }
];

test('generated script boundaries from scripts_all corpus', () => {
  for (const expected of SCRIPT_BOUNDARIES) {
    const parsed = dumpScript(expected.startAddress);
    assert.ok(parsed.length > 0, 'no parsed instructions');

    const actualStart = parsed[0].snesAddress;
    const actualEnd = parsed[parsed.length - 1].snesAddress;
    const actualSize = actualEnd - actualStart;

    assert.equal(actualStart, expected.startAddress);
    assert.equal(actualEnd, expected.endAddress);
    assert.equal(actualSize, expected.size);
  }
});
