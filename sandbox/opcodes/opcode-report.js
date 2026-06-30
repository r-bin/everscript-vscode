'use strict';

const { FailureType, classifySummaryMismatch } = require('../parity/failure-types');
const { normalizeSummary } = require('../corpus/script-all-corpus');

function toHex(address, width = 6) {
    return `0x${(address >>> 0).toString(16).toUpperCase().padStart(width, '0')}`;
}

function buildOpcodeReport(corpus, parserApi) {
    const byOpcode = new Map();
    const unknownOpcodeContexts = [];

    for (const stat of corpus.opcodeStats) {
        byOpcode.set(stat.opcode, {
            opcode: stat.opcode,
            opcodeHex: stat.opcodeHex,
            occurrences: 0,
            observedSizes: stat.observedSizes,
            sampleAddresses: stat.sampleAddresses,
            registryPresent: Boolean(parserApi.registry[stat.opcode]),
            variableLength: stat.observedSizes.length > 1,
            eligibleSamples: 0,
            passingSamples: 0,
            failingSamples: 0,
            failures: [],
            samples: [],
        });
    }

    for (const occurrence of corpus.occurrences) {
        const entry = byOpcode.get(occurrence.opcode);
        entry.occurrences += 1;
        if (!occurrence.bytes.length) continue;
        if (entry.samples.length >= 24) continue;
        entry.eligibleSamples += 1;

        let actual = null;
        let thrown = null;
        try {
            actual = parserApi.decodeInstruction(corpus.romBuf, occurrence.address);
        } catch (error) {
            thrown = error;
        }

        const sample = {
            address: toHex(occurrence.address),
            opcodeHex: occurrence.opcodeHex,
            expectedNextAddress: occurrence.expectedNextAddress == null ? null : toHex(occurrence.expectedNextAddress),
            expectedSize: occurrence.expectedSize,
            rawBytesHex: occurrence.bytes.map((value) => value.toString(16).toUpperCase().padStart(2, '0')).join(' '),
            expectedSummary: occurrence.summary,
            actualSummary: actual ? actual.summary : null,
            actualSize: actual ? actual.size : null,
            actualNextAddress: actual ? toHex(occurrence.address + actual.size) : null,
            branchTargetExpected: occurrence.branchTarget == null ? null : toHex(occurrence.branchTarget),
            branchTargetActual: actual && actual.branchTarget != null ? toHex(actual.branchTarget) : null,
            error: thrown ? String(thrown.message || thrown) : null,
        };

        if (thrown) {
            entry.failingSamples += 1;
            entry.failures.push({
                type: FailureType.OPCODE_MISSING,
                address: sample.address,
                reason: sample.error,
            });
            entry.samples.push(sample);
            continue;
        }

        const failureType = (() => {
            if (!entry.registryPresent) return FailureType.OPCODE_MISSING;
            if (!actual) return FailureType.OPCODE_MISSING;
            if (occurrence.expectedSize != null && actual.size !== occurrence.expectedSize) return FailureType.SIZE_MISMATCH;
            if (occurrence.expectedNextAddress != null && occurrence.address + actual.size !== occurrence.expectedNextAddress) {
                const registryEntry = parserApi.registry[occurrence.opcode] || null;
                return classifySummaryMismatch(occurrence, actual, null, registryEntry);
            }
            if (occurrence.branchTarget != null && actual.branchTarget != null && occurrence.branchTarget !== actual.branchTarget) {
                return FailureType.BRANCH_TARGET_ERROR;
            }
            if (normalizeSummary(occurrence.summary) !== normalizeSummary(actual.summary)) {
                return FailureType.OPERAND_MISMATCH;
            }
            return null;
        })();

        if (failureType) {
            entry.failingSamples += 1;
            entry.failures.push({
                type: failureType,
                address: sample.address,
                expectedSummary: sample.expectedSummary,
                actualSummary: sample.actualSummary,
                expectedSize: sample.expectedSize,
                actualSize: sample.actualSize,
            });
            if (failureType === FailureType.UNKNOWN_OPCODE) {
                unknownOpcodeContexts.push({
                    opcodeHex: occurrence.opcodeHex,
                    address: sample.address,
                    expectedSummary: sample.expectedSummary,
                    actualSummary: sample.actualSummary,
                });
            }
        } else {
            entry.passingSamples += 1;
        }
        entry.samples.push(sample);
    }

    const opcodeEntries = Array.from(byOpcode.values()).sort((left, right) => left.opcode - right.opcode);
    return {
        observedOpcodes: opcodeEntries.length,
        opcodeEntries,
        variableLengthOpcodes: opcodeEntries.filter((entry) => entry.variableLength).map((entry) => ({
            opcodeHex: entry.opcodeHex,
            observedSizes: entry.observedSizes,
            occurrences: entry.occurrences,
        })),
        unknownOpcodeContexts,
    };
}

module.exports = {
    buildOpcodeReport,
};
