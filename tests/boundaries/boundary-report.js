'use strict';

const { FailureType, classifySummaryMismatch } = require('../parity/failure-types');
const { normalizeSummary } = require('../corpus/script-all-corpus');

function toHex(address) {
    return `0x${(address >>> 0).toString(16).toUpperCase()}`;
}

function summarizeFailureCounts(failures) {
    const counts = {
        [FailureType.OPCODE_MISSING]: 0,
        [FailureType.OPERAND_MISMATCH]: 0,
        [FailureType.SIZE_MISMATCH]: 0,
        [FailureType.PC_DESYNC]: 0,
        [FailureType.BRANCH_TARGET_ERROR]: 0,
        [FailureType.SUBEXPR_DESYNC]: 0,
        [FailureType.STATE_DRIFT]: 0,
        [FailureType.UNKNOWN_OPCODE]: 0,
    };
    for (const failure of failures) counts[failure.failureClass] += 1;
    return counts;
}

function compareScript(script, parserApi) {
    const actualInstructions = parserApi.decodeScript(script.startAddress, script.topLevelInstructions.length + 64);
    const failures = [];
    const compared = Math.max(script.topLevelInstructions.length, actualInstructions.length);

    for (let index = 0; index < compared; index += 1) {
        const expected = script.topLevelInstructions[index] || null;
        const actual = actualInstructions[index] || null;
        if (!expected || !actual) {
            failures.push({
                index,
                failureClass: FailureType.STATE_DRIFT,
                expectedAddress: expected ? toHex(expected.address) : null,
                actualAddress: actual ? toHex(actual.addressSnes) : null,
                expectedSummary: expected ? expected.summary : null,
                actualSummary: actual ? actual.summary : null,
            });
            continue;
        }

        if (expected.address !== actual.addressSnes || expected.opcode !== actual.opcode || normalizeSummary(expected.summary) !== normalizeSummary(actual.summary) || (expected.branchTarget != null && actual.branchTarget != null && expected.branchTarget !== actual.branchTarget) || (expected.expectedSize != null && expected.expectedSize !== actual.size)) {
            failures.push({
                index,
                failureClass: classifySummaryMismatch(expected, actual, script.topLevelInstructions[index - 1] || null, parserApi.registry[expected.opcode] || null),
                expectedAddress: toHex(expected.address),
                actualAddress: toHex(actual.addressSnes),
                expectedSummary: expected.summary,
                actualSummary: actual.summary,
                expectedSize: expected.expectedSize,
                actualSize: actual.size,
                expectedNextAddress: expected.expectedNextAddress == null ? null : toHex(expected.expectedNextAddress),
                actualNextAddress: toHex(actual.addressSnes + actual.size),
            });
        }
    }

    const boundaryFailures = [];
    for (const instruction of script.topLevelInstructions) {
        if (instruction.expectedNextAddress == null) continue;
        let actual = null;
        try {
            actual = parserApi.decodeInstruction(parserApi.romBuf, instruction.address);
        } catch (error) {
            boundaryFailures.push({
                address: toHex(instruction.address),
                failureClass: FailureType.OPCODE_MISSING,
                expectedSize: instruction.expectedSize,
                actualSize: null,
                reason: String(error.message || error),
            });
            continue;
        }
        const actualNextAddress = instruction.address + actual.size;
        if (actualNextAddress !== instruction.expectedNextAddress) {
            boundaryFailures.push({
                address: toHex(instruction.address),
                failureClass: actual.size !== instruction.expectedSize
                    ? FailureType.SIZE_MISMATCH
                    : classifySummaryMismatch(instruction, actual, null, parserApi.registry[instruction.opcode] || null),
                expectedSize: instruction.expectedSize,
                actualSize: actual.size,
                expectedNextAddress: toHex(instruction.expectedNextAddress),
                actualNextAddress: toHex(actualNextAddress),
                expectedSummary: instruction.summary,
                actualSummary: actual.summary,
            });
        }
    }

    return {
        startAddressHex: toHex(script.startAddress),
        label: script.label,
        expectedInstructionCount: script.topLevelInstructions.length,
        actualInstructionCount: actualInstructions.length,
        mismatchCount: failures.length,
        mismatches: failures.slice(0, 80),
        boundaryChecks: script.topLevelInstructions.filter((instruction) => instruction.expectedNextAddress != null).length,
        boundaryFailureCount: boundaryFailures.length,
        boundaryFailures: boundaryFailures.slice(0, 80),
    };
}

function buildBoundaryReport(corpus, parserApi) {
    const scriptReports = corpus.scripts.map((script) => compareScript(script, parserApi));
    const boundaryFailures = scriptReports.flatMap((report) => report.boundaryFailures);
    const parityFailures = scriptReports.flatMap((report) => report.mismatches);
    return {
        scriptsTotal: scriptReports.length,
        scriptsWithMismatches: scriptReports.filter((report) => report.mismatchCount > 0).length,
        scriptsWithBoundaryFailures: scriptReports.filter((report) => report.boundaryFailureCount > 0).length,
        totalBoundaryChecks: scriptReports.reduce((sum, report) => sum + report.boundaryChecks, 0),
        totalBoundaryFailures: boundaryFailures.length,
        totalParityFailures: parityFailures.length,
        failureClasses: summarizeFailureCounts(boundaryFailures.concat(parityFailures)),
        scriptReports,
    };
}

module.exports = {
    buildBoundaryReport,
};
