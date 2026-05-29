'use strict';

const FailureClass = Object.freeze({
    OPCODE_MISSING: 'OPCODE_MISSING',
    OPERAND_MISMATCH: 'OPERAND_MISMATCH',
    PC_DESYNC: 'PC_DESYNC',
    BRANCH_TARGET_ERROR: 'BRANCH_TARGET_ERROR',
    STATE_DRIFT: 'STATE_DRIFT',
    UNKNOWN_OPCODE: 'UNKNOWN_OPCODE',
});

function classifyMismatch(expected, actual) {
    if (!actual) return FailureClass.OPCODE_MISSING;

    if (String(actual.summary || '').includes('UNKNOWN OPCODE')) {
        return FailureClass.UNKNOWN_OPCODE;
    }

    if ((expected.address >>> 0) !== (actual.addressSnes >>> 0)) {
        return FailureClass.PC_DESYNC;
    }

    if ((expected.opcode >>> 0) !== (actual.opcode >>> 0)) {
        return FailureClass.OPCODE_MISSING;
    }

    if (expected.branchTarget != null && actual.branchTarget != null && expected.branchTarget !== actual.branchTarget) {
        return FailureClass.BRANCH_TARGET_ERROR;
    }

    if ((expected.summary || '').trim() !== (actual.summary || '').trim()) {
        return FailureClass.OPERAND_MISMATCH;
    }

    return FailureClass.STATE_DRIFT;
}

function classifyLengthMismatch(expectedLen, actualLen) {
    if (actualLen < expectedLen) return FailureClass.OPCODE_MISSING;
    if (actualLen > expectedLen) return FailureClass.STATE_DRIFT;
    return null;
}

module.exports = {
    FailureClass,
    classifyMismatch,
    classifyLengthMismatch,
};
