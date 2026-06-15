import test from 'node:test';
import assert from 'node:assert/strict';

import { dumpScript } from '../model/rom-script-model.ts';
import { SCRIPT_BOUNDARIES } from './ground-truth.ts';

test('script boundaries match scripts_all ground truth', () => {
  for (const truth of SCRIPT_BOUNDARIES) {
    const parsed = dumpScript(truth.start);
    assert.ok(parsed.length > 0, `no instructions decoded for ${truth.sourceNote}`);

    const parsedStart = parsed[0].snesAddress;
    const parsedEnd = parsed[parsed.length - 1].snesAddress;
    const parsedSize = parsedEnd - parsedStart;
    const expectedSize = truth.end - truth.start;

    assert.equal(parsedStart, truth.start, `start mismatch for ${truth.sourceNote}`);
    assert.equal(parsedEnd, truth.end, `end mismatch for ${truth.sourceNote}`);
    assert.equal(parsedSize, expectedSize, `size mismatch for ${truth.sourceNote}`);

    assert.equal(
      parsed[0].opcode,
      0x18,
      `first opcode mismatch for ${truth.sourceNote}; scripts_all shows (18) WRITE CHANGE DOGGO`,
    );
  }
});
