'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { runOpcodeInteractionTests } = require('./parity/opcode-interactions');
const { runParserFuzzTests } = require('./parity/fuzz-generator');
const {
    FailureType,
    GOLDEN_SNAPSHOT_PATH,
    OPCODE_REPORT_PATH,
    REPORT_PATH,
    UNKNOWN_REPORT_PATH,
    buildParityReport,
} = require('../parity/report-builder');

const STRICT = process.env.PARITY_STRICT === '1';

let passed = 0;
let failed = 0;
let reportCache = null;
let reportError = null;

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

function getReport() {
    if (reportCache) return reportCache;
    if (reportError) throw reportError;
    try {
        reportCache = buildParityReport({
            dumpPath: process.env.EVERSCRIPT_SCRIPTS_ALL,
            romPath: process.env.EVERSCRIPT_ROM_PATH,
        });
        return reportCache;
    } catch (error) {
        reportError = error;
        throw error;
    }
}

function strictAssert(condition, message) {
    if (STRICT) assert.ok(condition, message);
}

function ensureReportArtifacts(report) {
    assert.ok(report, 'expected generated parity report');
    assert.ok(fs.existsSync(REPORT_PATH), 'expected aggregate parity report output');
    assert.ok(fs.existsSync(OPCODE_REPORT_PATH), 'expected opcode report output');
    assert.ok(fs.existsSync(UNKNOWN_REPORT_PATH), 'expected unknown opcode report output');
    assert.ok(fs.existsSync(GOLDEN_SNAPSHOT_PATH), 'expected parity golden snapshot');
}

console.log('parser-parity:');

test('corpus parity harness emits structured reports and golden summary', () => {
    const report = getReport();
    ensureReportArtifacts(report);
    assert.ok(report.scriptsTotal > 0, 'expected scripts from script_all');
    assert.ok(report.occurrencesTotal > 0, 'expected instruction occurrences from script_all');
    assert.ok(report.observedOpcodes > 0, 'expected observed opcodes from corpus');
    if (!report.goldenComparison.created) {
        assert.strictEqual(report.goldenComparison.matched, true, 'golden summary differs from snapshot (run with UPDATE_GOLDEN_PARITY=1 after corpus or parser changes)');
    }
});

test('failure classifier exposes size and subexpression desync categories', () => {
    const report = getReport();
    const failureClasses = report.boundaryReport.failureClasses;
    assert.ok(Object.prototype.hasOwnProperty.call(failureClasses, FailureType.SIZE_MISMATCH), 'expected SIZE_MISMATCH classification');
    assert.ok(Object.prototype.hasOwnProperty.call(failureClasses, FailureType.SUBEXPR_DESYNC), 'expected SUBEXPR_DESYNC classification');
});

for (const opcodeEntry of getReport().opcodeReport.opcodeEntries) {
    test(`opcode coverage ${opcodeEntry.opcodeHex}: observed in corpus and wired to sample bytes`, () => {
        assert.ok(opcodeEntry.occurrences > 0, `expected occurrences for ${opcodeEntry.opcodeHex}`);
        assert.ok(opcodeEntry.samples.length > 0 || opcodeEntry.eligibleSamples === 0, `expected at least one real sample for ${opcodeEntry.opcodeHex}`);
        assert.strictEqual(opcodeEntry.registryPresent, true, `missing registry entry for ${opcodeEntry.opcodeHex}`);
        strictAssert(opcodeEntry.failingSamples === 0, `strict parity failed for ${opcodeEntry.opcodeHex} with ${opcodeEntry.failingSamples} failing samples`);
    });
}

for (const scriptReport of getReport().boundaryReport.scriptReports) {
    test(`script parity ${scriptReport.startAddressHex}: full script coverage and boundary accounting`, () => {
        assert.ok(scriptReport.expectedInstructionCount > 0, `expected instructions for ${scriptReport.startAddressHex}`);
        assert.ok(scriptReport.boundaryChecks > 0, `expected boundary checks for ${scriptReport.startAddressHex}`);
        strictAssert(scriptReport.mismatchCount === 0, `strict parity mismatches in ${scriptReport.startAddressHex}: ${scriptReport.mismatchCount}`);
        strictAssert(scriptReport.boundaryFailureCount === 0, `strict boundary failures in ${scriptReport.startAddressHex}: ${scriptReport.boundaryFailureCount}`);
    });
}

test('unknown-opcode desync report captures current 0x64/0x90/0xFF investigations', () => {
    const report = getReport();
    const interesting = report.unknownOpcodeInvestigations.filter((item) => item.unknownOpcode === '0x64' || item.unknownOpcode === '0x90' || item.unknownOpcode === '0xFF');
    assert.ok(Array.isArray(report.unknownOpcodeInvestigations), 'expected unknown-opcode investigations array');
    strictAssert(interesting.length === 0, `strict mode found ${interesting.length} unknown-opcode desync investigations`);
});

runOpcodeInteractionTests(test);
runParserFuzzTests(test);

console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
