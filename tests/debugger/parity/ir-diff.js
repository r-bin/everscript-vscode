'use strict';

const { classifyMismatch, classifyLengthMismatch } = require('./failure-classifier');
const { parseBranchTarget } = require('./ground-truth-parser');

function toParserIr(instruction) {
    return {
        addressSnes: instruction.addressSnes >>> 0,
        opcode: instruction.opcode >>> 0,
        summary: instruction.summary || '',
        branchTarget: parseBranchTarget(instruction.summary || ''),
    };
}

function diffInstructionStreams(expected, actual) {
    const mismatches = [];
    const maxLen = Math.max(expected.length, actual.length);

    for (let i = 0; i < maxLen; i++) {
        const exp = expected[i] || null;
        const act = actual[i] ? toParserIr(actual[i]) : null;

        if (!exp || !act) {
            const failureClass = classifyLengthMismatch(expected.length, actual.length);
            if (failureClass) {
                mismatches.push({
                    index: i,
                    failureClass,
                    expected: exp,
                    actual: act,
                    reason: !exp ? 'actual-extra-instruction' : 'actual-missing-instruction',
                });
            }
            continue;
        }

        if (exp.address === act.addressSnes && exp.opcode === act.opcode && exp.summary === act.summary) {
            continue;
        }

        mismatches.push({
            index: i,
            failureClass: classifyMismatch(exp, act),
            expected: exp,
            actual: act,
            reason: 'instruction-mismatch',
        });
    }

    return {
        mismatchCount: mismatches.length,
        mismatches,
    };
}

module.exports = {
    diffInstructionStreams,
};
