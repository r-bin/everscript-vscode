'use strict';

const FailureType = Object.freeze({
    OPCODE_MISSING: 'OPCODE_MISSING',
    OPERAND_MISMATCH: 'OPERAND_MISMATCH',
    SIZE_MISMATCH: 'SIZE_MISMATCH',
    PC_DESYNC: 'PC_DESYNC',
    BRANCH_TARGET_ERROR: 'BRANCH_TARGET_ERROR',
    SUBEXPR_DESYNC: 'SUBEXPR_DESYNC',
    STATE_DRIFT: 'STATE_DRIFT',
    UNKNOWN_OPCODE: 'UNKNOWN_OPCODE',
});

function classifySummaryMismatch(expected, actual, previousExpected, registryEntry) {
    if (!actual) return FailureType.OPCODE_MISSING;
    if ((actual.summary || '').startsWith('UNKNOWN OPCODE')) return FailureType.UNKNOWN_OPCODE;
    if ((expected.address >>> 0) !== (actual.addressSnes >>> 0)) {
        if (previousExpected && registryEntry && (registryEntry.operands || []).some((operand) => String(operand).includes('subexpr'))) {
            return FailureType.SUBEXPR_DESYNC;
        }
        return FailureType.PC_DESYNC;
    }
    if ((expected.opcode >>> 0) !== (actual.opcode >>> 0)) return FailureType.OPCODE_MISSING;
    if (expected.expectedSize != null && actual.size !== expected.expectedSize) return FailureType.SIZE_MISMATCH;
    if (expected.branchTarget != null && actual.branchTarget != null && expected.branchTarget !== actual.branchTarget) {
        return FailureType.BRANCH_TARGET_ERROR;
    }
    return FailureType.OPERAND_MISMATCH;
}

module.exports = {
    FailureType,
    classifySummaryMismatch,
};
