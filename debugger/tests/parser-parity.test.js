'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    decodeRoomScript,
} = require('../emulator/room-script-model');
const { loadGroundTruthDump } = require('./parity/ground-truth-parser');
const { diffInstructionStreams } = require('./parity/ir-diff');
const { FailureClass } = require('./parity/failure-classifier');
const { runOpcodeInteractionTests } = require('./parity/opcode-interactions');
const { runParserFuzzTests } = require('./parity/fuzz-generator');

const GROUND_TRUTH_PATH = process.env.EVERSCRIPT_SCRIPTS_ALL
    || '/Users/v/Documents/GitHub/SoETilesViewer/SoEScriptDumper/script_all';
const ROM_PATH = process.env.EVERSCRIPT_ROM_PATH
    || '/Users/v/Documents/GitHub/SoETilesViewer/SoEScriptDumper/Secret of Evermore (U) [!].smc';
const SNAPSHOT_PATH = path.resolve(__dirname, 'parity/snapshots/golden-parity.snapshot.json');
const REPORT_PATH = path.resolve(__dirname, '../../tmp/parser-parity-report.json');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✓ ${name}`);
        passed++;
    } catch (err) {
        console.error(`  ✗ ${name}`);
        console.error(`    ${err.message}`);
        failed++;
    }
}

function aggregateFailureClasses(scriptMismatches) {
    const counts = {
        [FailureClass.OPCODE_MISSING]: 0,
        [FailureClass.OPERAND_MISMATCH]: 0,
        [FailureClass.PC_DESYNC]: 0,
        [FailureClass.BRANCH_TARGET_ERROR]: 0,
        [FailureClass.STATE_DRIFT]: 0,
        [FailureClass.UNKNOWN_OPCODE]: 0,
    };

    for (const m of scriptMismatches) {
        for (const item of m.mismatches) {
            counts[item.failureClass] = (counts[item.failureClass] || 0) + 1;
        }
    }

    return counts;
}

function summarizeParityResult(result) {
    return {
        scriptsTotal: result.scriptsTotal,
        scriptsCompared: result.scriptsCompared,
        scriptsWithMismatches: result.scriptsWithMismatches,
        totalMismatches: result.totalMismatches,
        failureClasses: result.failureClasses,
        firstMismatches: result.scriptMismatches.slice(0, 100).map((entry) => ({
            startAddressHex: entry.startAddressHex,
            mismatchCount: entry.mismatchCount,
            mismatches: entry.mismatches.slice(0, 5),
        })),
    };
}

function runGoldenParity() {
    if (!fs.existsSync(GROUND_TRUTH_PATH)) {
        return {
            skipped: true,
            reason: `ground truth dump not found at ${GROUND_TRUTH_PATH}`,
        };
    }
    if (!fs.existsSync(ROM_PATH)) {
        return {
            skipped: true,
            reason: `ROM not found at ${ROM_PATH}`,
        };
    }

    const scripts = loadGroundTruthDump(GROUND_TRUTH_PATH);
    const rom = fs.readFileSync(ROM_PATH);
    const scriptMismatches = [];

    for (const script of scripts) {
        const parsed = decodeRoomScript(rom, script.startAddress);
        const diff = diffInstructionStreams(script.instructions, parsed.instructions);
        if (diff.mismatchCount > 0) {
            scriptMismatches.push({
                startAddress: script.startAddress,
                startAddressHex: script.startAddressHex,
                mismatchCount: diff.mismatchCount,
                mismatches: diff.mismatches,
                expectedCount: script.instructions.length,
                actualCount: parsed.instructions.length,
                stopReason: parsed.stopReason,
            });
        }
    }

    const failureClasses = aggregateFailureClasses(scriptMismatches);
    const totalMismatches = scriptMismatches.reduce((sum, item) => sum + item.mismatchCount, 0);

    const result = {
        skipped: false,
        scriptsTotal: scripts.length,
        scriptsCompared: scripts.length,
        scriptsWithMismatches: scriptMismatches.length,
        totalMismatches,
        failureClasses,
        scriptMismatches,
    };

    const report = summarizeParityResult(result);
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

    const update = process.env.UPDATE_GOLDEN === '1' || !fs.existsSync(SNAPSHOT_PATH);
    if (update) {
        fs.mkdirSync(path.dirname(SNAPSHOT_PATH), { recursive: true });
        fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(report, null, 2));
        result.snapshotUpdated = true;
        result.snapshot = report;
        return result;
    }

    const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
    result.snapshot = snapshot;
    result.snapshotMatches = JSON.stringify(snapshot) === JSON.stringify(report);
    result.current = report;

    return result;
}

console.log('parser-parity:');

test('golden parity: script_all comparison produces structured classification report', () => {
    const result = runGoldenParity();
    if (result.skipped) {
        console.log(`  - skipped golden parity (${result.reason})`);
        return;
    }

    assert.ok(result.scriptsCompared > 0, 'expected scripts to compare from script_all');
    assert.ok(fs.existsSync(REPORT_PATH), 'expected parity report output');

    if (result.snapshotUpdated) {
        console.log('  - golden snapshot created/updated');
        return;
    }

    assert.strictEqual(result.snapshotMatches, true, 'parity report differs from snapshot (run with UPDATE_GOLDEN=1 after parser changes)');
});

runOpcodeInteractionTests(test);
runParserFuzzTests(test);

console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
