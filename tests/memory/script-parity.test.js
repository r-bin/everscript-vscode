'use strict';
// Parity harness: the TypeScript script decoder in src/script/ against
// SoEScriptDumper's own dump of the ROM.
//
// The dump prints every instruction with its address, so consecutive
// addresses give each instruction's true length. That makes instruction
// *boundaries* checkable exactly, which is the property that matters: a
// decoder that gets a size wrong turns every byte after it into fiction, and
// it does so silently.
//
// Skips (does not fail) when the ROM or the SoETilesViewer checkout is
// unavailable, since neither is committed to this repo.

const fs = require('fs');
const path = require('path');

const script = require('../../src/script');

const HOME = process.env.HOME || '';
const VIEWER = process.env.SOE_TILES_VIEWER ||
    path.join(HOME, 'Documents', 'GitHub', 'SoETilesViewer');
const DUMP = process.env.SOE_SCRIPT_DUMP || path.join(VIEWER, 'SoEScriptDumper', 'script_all');
const ROM = process.env.EVERSCRIPT_ROM ||
    path.join(VIEWER, 'SoEScriptDumper', 'Secret of Evermore (U) [!].smc');

// Boundary agreement we require on the scripts the decoder can walk. This is
// a floor that only moves up: raise it whenever coverage improves so a
// regression cannot hide behind a comfortable margin.
const MIN_BOUNDARY_ACCURACY = 0.9995;
// Share of entry points the decoder walks to a clean end. The remainder stop
// on an opcode whose layout is not pinned down yet (see opcodes.ts
// UNRESOLVED) — stopping is correct behaviour, not a failure.
const MIN_CLEAN_WALKS = 0.52;

function skip(reason) {
    console.log(`SKIP script-parity: ${reason}`);
    process.exit(0);
}

const LINE = /^(\s*)\[0x([0-9a-f]{6})\]\s+\(([0-9a-f]{2})\)\s+(.*)$/;

/**
 * Pull instruction addresses out of the dump.
 *
 * Only lines whose printed opcode really is the byte at that address count —
 * the dump also carries listings that look like instructions. Runs break on
 * any non-instruction line and on a change of indent, which is how inlined
 * RCALL bodies are kept from being spliced into their caller.
 */
function readGroundTruth(rom, text) {
    const known = new Set();
    const entries = new Set();
    const lines = text.replace(/\x1b\[[0-9;]*m/g, '').split('\n');
    let prev = null;
    let prevIndent = -1;

    for (const raw of lines) {
        const m = LINE.exec(raw);
        if (!m) { prev = null; prevIndent = -1; continue; }
        const indent = m[1].length;
        const address = parseInt(m[2], 16);
        const opcode = parseInt(m[3], 16);
        const real = rom[script.snesToRom(address)] === opcode;
        if (real) known.add(address);
        if (real && (indent !== prevIndent || prev === null)) entries.add(address);
        if (!prev || address !== prev.address) prev = { address, opcode, real };
        prevIndent = indent;
    }
    return { known, entries };
}

let failures = 0;
function check(label, actual, expected) {
    if (actual !== expected) {
        failures += 1;
        console.error(`  FAIL ${label}\n    got: ${actual}\n    want: ${expected}`);
    }
}

function main() {
    if (!fs.existsSync(ROM)) skip(`ROM not found at ${ROM}`);
    if (!fs.existsSync(DUMP)) skip(`script_all not found at ${DUMP}`);

    const rom = new Uint8Array(fs.readFileSync(ROM));
    const { known, entries } = readGroundTruth(rom, fs.readFileSync(DUMP, 'latin1'));
    console.log(`script-parity: ${known.size} instruction addresses, ${entries.size} entry points`);

    let emitted = 0;
    let onBoundary = 0;
    let clean = 0;
    let walked = 0;
    const stoppedOn = new Map();

    for (const entry of entries) {
        let res;
        try { res = script.decodeScript(rom, entry); } catch (err) {
            failures += 1;
            console.error(`  FAIL 0x${entry.toString(16)} threw: ${err.message}`);
            continue;
        }
        walked += 1;
        for (const ins of res.instructions) {
            emitted += 1;
            // Every instruction we emit must sit where the dumper says an
            // instruction sits. A miss means a previous size was wrong.
            if (known.has(ins.address)) onBoundary += 1;
        }
        if (res.stopReason === 'terminated') clean += 1;
        else if (res.stoppedAt !== null) {
            const op = rom[script.snesToRom(res.stoppedAt)];
            stoppedOn.set(op, (stoppedOn.get(op) || 0) + 1);
        }
    }

    const accuracy = emitted ? onBoundary / emitted : 0;
    const cleanRate = walked ? clean / walked : 0;
    console.log(`  instructions emitted : ${emitted}`);
    console.log(`  on a real boundary   : ${onBoundary} (${(accuracy * 100).toFixed(3)}%)`);
    console.log(`  walked to a clean end: ${clean} of ${walked} (${(cleanRate * 100).toFixed(1)}%)`);

    const top = [...stoppedOn.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    if (top.length) {
        console.log('  stopped on (opcode x scripts):');
        for (const [op, n] of top) {
            console.log(`    0x${op.toString(16).padStart(2, '0')} x${n} — ${script.unresolvedNote(op)}`);
        }
    }

    check(`boundary accuracy >= ${MIN_BOUNDARY_ACCURACY}`, accuracy >= MIN_BOUNDARY_ACCURACY, true);
    check(`clean walks >= ${MIN_CLEAN_WALKS}`, cleanRate >= MIN_CLEAN_WALKS, true);

    if (failures) {
        console.error(`\nscript-parity: ${failures} failure(s)`);
        process.exit(1);
    }
    console.log('script-parity: instruction boundaries agree with SoEScriptDumper');
}

main();
