'use strict';
// Parity harness: the TypeScript script decoder in src/script/ against
// SoEScriptDumper's own dump of the ROM.
//
// Two things are scored, and they fail differently:
//
//   Boundaries. The dump prints every instruction with its address, so
//   consecutive addresses give each instruction's true length. A decoder that
//   gets a size wrong turns every byte after it into fiction, and it does so
//   silently, so this must stay at essentially 100%.
//
//   Summaries. The rendered text, compared string for string. A mismatch here
//   is cosmetic by comparison, but it is also the only way to catch a ported
//   case that reads the right number of bytes and describes them wrongly.
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

// Floors that only move up: raise them whenever coverage improves, so a
// regression cannot hide behind a comfortable margin.
const MIN_BOUNDARY_ACCURACY = 0.9995;
const MIN_SUMMARY_ACCURACY = 0.995;
// Share of entry points the decoder walks to a clean end. The rest stop on an
// opcode SoEScriptDumper has no case for either — stopping is correct
// behaviour, not a failure.
const MIN_CLEAN_WALKS = 0.63;

// SHOW TEXT prints the decoded game string on following lines. Rendering that
// needs the text decompressor, which lives elsewhere, so these three are
// scored on boundaries only.
const TEXT_OPCODES = new Set([0x50, 0x51, 0x52]);

function skip(reason) {
    console.log(`SKIP script-parity: ${reason}`);
    process.exit(0);
}

const LINE = /^(\s*)\[0x([0-9a-f]{6})\]\s+\(([0-9a-f]{2})\)\s+(.*)$/;
// The second line of the CALL-with-arguments family, which belongs to the
// instruction above it.
const CONTINUATION = /^\s+WITH \d+ ARGS\b/;

/** Collapse the formatting differences that are not worth scoring. */
function normalise(text) {
    return text.replace(/\s+/g, ' ').trim();
}

/**
 * Pull instruction addresses and text out of the dump.
 *
 * Only lines whose printed opcode really is the byte at that address count —
 * the dump also carries listings that look like instructions. Runs break on
 * any non-instruction line and on a change of indent, which is how inlined
 * RCALL bodies are kept from being spliced into their caller.
 */
function readGroundTruth(rom, text) {
    const known = new Set();
    const entries = new Set();
    const summaries = new Map();
    const lines = text.replace(/\x1b\[[0-9;]*m/g, '').split('\n');
    let prev = null;
    let prevIndent = -1;
    let lastAddress = null;

    for (const raw of lines) {
        const m = LINE.exec(raw);
        if (!m) {
            if (lastAddress !== null && CONTINUATION.test(raw)) {
                summaries.set(lastAddress, summaries.get(lastAddress) + ' ' + normalise(raw));
                continue;
            }
            prev = null; prevIndent = -1; lastAddress = null;
            continue;
        }
        const indent = m[1].length;
        const address = parseInt(m[2], 16);
        const opcode = parseInt(m[3], 16);
        const real = rom[script.snesToRom(address)] === opcode;
        if (real) {
            known.add(address);
            // Instructions that print more than one line (two-write opcodes)
            // repeat the address; keep them all, joined as the decoder joins.
            // Instructions that print more than one line (the two-write
            // opcodes) repeat the address on consecutive lines; join those as
            // the decoder joins them. The same script is listed again under
            // every trigger that references it, so a repeat that is not
            // consecutive replaces rather than accumulates.
            const body = normalise(m[4]);
            summaries.set(address, address === lastAddress ? summaries.get(address) + ' ; ' + body : body);
            lastAddress = address;
        } else {
            lastAddress = null;
        }
        if (real && (indent !== prevIndent || prev === null)) entries.add(address);
        if (!prev || address !== prev.address) prev = { address, opcode, real };
        prevIndent = indent;
    }
    return { known, entries, summaries };
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
    const { known, entries, summaries } = readGroundTruth(rom, fs.readFileSync(DUMP, 'latin1'));
    console.log(`script-parity: ${known.size} instruction addresses, ${entries.size} entry points`);

    let emitted = 0;
    let onBoundary = 0;
    let scored = 0;
    let sameText = 0;
    let clean = 0;
    let walked = 0;
    const stoppedOn = new Map();
    const textMisses = new Map();
    const examples = new Map();

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
            if (!known.has(ins.address)) continue;
            onBoundary += 1;
            if (TEXT_OPCODES.has(ins.opcode)) continue;
            scored += 1;
            const want = summaries.get(ins.address);
            if (want === normalise(ins.summary)) { sameText += 1; continue; }
            textMisses.set(ins.opcode, (textMisses.get(ins.opcode) || 0) + 1);
            if (!examples.has(ins.opcode)) {
                examples.set(ins.opcode, { want, got: normalise(ins.summary), at: ins.address });
            }
        }
        if (res.stopReason === 'terminated') clean += 1;
        else if (res.stoppedAt !== null) {
            const op = rom[script.snesToRom(res.stoppedAt)];
            const key = `${res.stopReason} on 0x${op.toString(16).padStart(2, '0')}`;
            stoppedOn.set(key, (stoppedOn.get(key) || 0) + 1);
        }
    }

    const accuracy = emitted ? onBoundary / emitted : 0;
    const textAccuracy = scored ? sameText / scored : 0;
    const cleanRate = walked ? clean / walked : 0;
    console.log(`  instructions emitted : ${emitted}`);
    console.log(`  on a real boundary   : ${onBoundary} (${(accuracy * 100).toFixed(3)}%)`);
    console.log(`  summary matches text : ${sameText} of ${scored} (${(textAccuracy * 100).toFixed(3)}%)`);
    console.log(`  walked to a clean end: ${clean} of ${walked} (${(cleanRate * 100).toFixed(1)}%)`);

    const rank = (map) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    if (stoppedOn.size) {
        console.log('  stopped (reason x scripts):');
        for (const [key, n] of rank(stoppedOn)) console.log(`    ${key} x${n}`);
    }
    if (textMisses.size) {
        console.log('  summary differs (opcode x instructions):');
        for (const [op, n] of rank(textMisses)) console.log(`    0x${op.toString(16).padStart(2, '0')} x${n}`);
    }
    for (const [op, e] of [...examples.entries()].slice(0, 4)) {
        console.log(`    0x${op.toString(16).padStart(2, '0')} at 0x${e.at.toString(16)}\n      want: ${e.want}\n      got : ${e.got}`);
    }

    check(`boundary accuracy >= ${MIN_BOUNDARY_ACCURACY}`, accuracy >= MIN_BOUNDARY_ACCURACY, true);
    check(`summary accuracy >= ${MIN_SUMMARY_ACCURACY}`, textAccuracy >= MIN_SUMMARY_ACCURACY, true);
    check(`clean walks >= ${MIN_CLEAN_WALKS}`, cleanRate >= MIN_CLEAN_WALKS, true);

    if (failures) {
        console.error(`\nscript-parity: ${failures} failure(s)`);
        process.exit(1);
    }
    console.log('script-parity: boundaries and summaries agree with SoEScriptDumper');
}

main();
