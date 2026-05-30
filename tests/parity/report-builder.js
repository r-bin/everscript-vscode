'use strict';

const fs = require('fs');
const path = require('path');

const { loadCorpus } = require('../corpus/script-all-corpus');
const { buildOpcodeReport } = require('../opcodes/opcode-report');
const { buildBoundaryReport } = require('../boundaries/boundary-report');
const { FailureType } = require('./failure-types');
const { decodeInstructionAt, decodeRoomScript, OPCODE_REGISTRY } = require('../../debugger/emulator/room-script-model');

const TMP_DIR = path.resolve(__dirname, '../../tmp');
const SNAPSHOT_DIR = path.resolve(__dirname, './snapshots');
const REPORT_PATH = path.join(TMP_DIR, 'parser-parity-report.json');
const OPCODE_REPORT_PATH = path.join(TMP_DIR, 'parser-opcode-report.json');
const UNKNOWN_REPORT_PATH = path.join(TMP_DIR, 'parser-unknown-opcode-report.json');
const GOLDEN_SNAPSHOT_PATH = path.join(SNAPSHOT_DIR, 'parser-parity-golden.snapshot.json');

function ensureDir(targetPath) {
    fs.mkdirSync(targetPath, { recursive: true });
}

function decodeInstruction(romBuf, addressSnes) {
    return decodeInstructionAt(romBuf, addressSnes, 0);
}

function decodeScript(romBuf, startAddress) {
    return decodeRoomScript(romBuf, startAddress).instructions;
}

function pickUnknownOpcodeInvestigations(boundaryReport) {
    const investigations = [];
    const interestingOpcodes = new Set([0x64, 0x90, 0xFF]);
    for (const report of boundaryReport.scriptReports) {
        const mismatches = report.mismatches || [];
        for (let index = 0; index < mismatches.length; index += 1) {
            const mismatch = mismatches[index];
            if (!mismatch.actualSummary || !mismatch.actualSummary.startsWith('UNKNOWN OPCODE')) continue;
            const opcodeMatch = /UNKNOWN OPCODE\s+(0x[0-9A-F]+)/i.exec(mismatch.actualSummary);
            const unknownOpcode = opcodeMatch ? Number.parseInt(opcodeMatch[1], 16) : null;
            if (unknownOpcode == null || !interestingOpcodes.has(unknownOpcode)) continue;
            const previous = mismatches[index - 1] || null;
            investigations.push({
                script: report.startAddressHex,
                unknownOpcode: `0x${unknownOpcode.toString(16).toUpperCase()}`,
                expectedAddress: mismatch.expectedAddress,
                actualAddress: mismatch.actualAddress,
                previousExpectedAddress: previous ? previous.expectedAddress : null,
                previousActualAddress: previous ? previous.actualAddress : null,
                previousInstructionLength: previous ? previous.actualSize : null,
                previousFailureClass: previous ? previous.failureClass : null,
                expectedSummary: mismatch.expectedSummary,
                actualSummary: mismatch.actualSummary,
            });
        }
    }
    return investigations;
}

function createParserApi(corpus) {
    return {
        romBuf: corpus.romBuf,
        registry: OPCODE_REGISTRY,
        decodeInstruction,
        decodeScript: (startAddress) => decodeScript(corpus.romBuf, startAddress),
    };
}

function buildGoldenSummary(corpus, opcodeReport, boundaryReport, unknownOpcodeInvestigations) {
    return {
        scriptsTotal: corpus.scripts.length,
        occurrencesTotal: corpus.occurrences.length,
        observedOpcodes: opcodeReport.observedOpcodes,
        variableLengthOpcodes: opcodeReport.variableLengthOpcodes,
        boundaryChecks: boundaryReport.totalBoundaryChecks,
        failureClasses: boundaryReport.failureClasses,
        unknownOpcodeInvestigations,
    };
}

function writeJson(filePath, value) {
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function compareWithGolden(summary) {
    ensureDir(SNAPSHOT_DIR);
    if (!fs.existsSync(GOLDEN_SNAPSHOT_PATH) || process.env.UPDATE_GOLDEN_PARITY === '1') {
        writeJson(GOLDEN_SNAPSHOT_PATH, summary);
        return { matched: true, created: true };
    }
    const existing = JSON.parse(fs.readFileSync(GOLDEN_SNAPSHOT_PATH, 'utf8'));
    return {
        matched: JSON.stringify(existing) === JSON.stringify(summary),
        created: false,
        existing,
    };
}

function buildParityReport(options = {}) {
    ensureDir(TMP_DIR);
    const corpus = loadCorpus(options);
    const parserApi = createParserApi(corpus);
    const opcodeReport = buildOpcodeReport(corpus, parserApi);
    const boundaryReport = buildBoundaryReport(corpus, parserApi);
    const unknownOpcodeInvestigations = pickUnknownOpcodeInvestigations(boundaryReport);
    const goldenSummary = buildGoldenSummary(corpus, opcodeReport, boundaryReport, unknownOpcodeInvestigations);
    const goldenComparison = compareWithGolden(goldenSummary);

    const report = {
        generatedAt: corpus.generatedAt,
        dumpPath: corpus.dumpPath,
        romPath: corpus.romPath,
        scriptsTotal: corpus.scripts.length,
        occurrencesTotal: corpus.occurrences.length,
        observedOpcodes: opcodeReport.observedOpcodes,
        opcodeReport,
        boundaryReport,
        unknownOpcodeInvestigations,
        goldenComparison,
    };

    writeJson(REPORT_PATH, report);
    writeJson(OPCODE_REPORT_PATH, opcodeReport);
    writeJson(UNKNOWN_REPORT_PATH, unknownOpcodeInvestigations);

    return report;
}

module.exports = {
    FailureType,
    GOLDEN_SNAPSHOT_PATH,
    OPCODE_REPORT_PATH,
    REPORT_PATH,
    UNKNOWN_REPORT_PATH,
    buildParityReport,
};
