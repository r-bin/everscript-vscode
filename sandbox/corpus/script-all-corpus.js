'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_DUMP_CANDIDATES = [
    '/Users/v/Documents/GitHub/everscript/script_all',
    '/Users/v/Documents/GitHub/SoETilesViewer/SoEScriptDumper/script_all',
];

const DEFAULT_ROM_CANDIDATES = [
    '/Users/v/Documents/GitHub/everscript/Secret of Evermore (U) [!].smc',
    '/Users/v/Documents/GitHub/SoETilesViewer/SoEScriptDumper/Secret of Evermore (U) [!].smc',
    '/Users/v/Documents/GitHub/everscript/script.smc',
];

const MAX_INFERRED_INSTRUCTION_SIZE = 0x20;

function resolveExistingPath(candidates, explicitPath) {
    const search = explicitPath ? [explicitPath] : candidates;
    for (const candidate of search) {
        if (candidate && fs.existsSync(candidate)) return candidate;
    }
    throw new Error(`Unable to resolve required corpus file from: ${search.join(', ')}`);
}

function parseInstructionLine(line) {
    const match = /^(\s*)\[(0x[0-9a-fA-F]+)\]\s+\(([0-9a-fA-F]{2})\)\s*(.*)$/.exec(line);
    if (!match) return null;
    const indent = match[1].length;
    const address = Number.parseInt(match[2], 16);
    const opcode = Number.parseInt(match[3], 16);
    const summary = (match[4] || '').trim();
    const branchMatch = /\(to\s+(0x[0-9a-fA-F]+)\)/i.exec(summary);
    return {
        indent,
        address,
        opcode,
        opcodeHex: `0x${match[3].toUpperCase()}`,
        summary,
        branchTarget: branchMatch ? Number.parseInt(branchMatch[1], 16) : null,
        raw: line,
    };
}

function snesToRomOffset(addressSnes) {
    return addressSnes & ~(0xC00000);
}

function normalizeSummary(summary) {
    return String(summary || '')
        .replace(/0x([0-9a-f]+)/gi, (_, hex) => `0x${hex.toUpperCase()}`)
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function finalizeGroupedOccurrences(occurrences, romBuf) {
    for (let index = 0; index < occurrences.length; index += 1) {
        const current = occurrences[index];
        const next = occurrences[index + 1] || null;
        const rawNextAddress = next && next.address > current.address ? next.address : null;
        const inferredSize = rawNextAddress != null ? rawNextAddress - current.address : null;
        const useInferredSize = inferredSize != null && inferredSize > 0 && inferredSize <= MAX_INFERRED_INSTRUCTION_SIZE;
        current.expectedNextAddress = useInferredSize ? rawNextAddress : null;
        current.expectedSize = useInferredSize ? inferredSize : null;
        current.summary = current.summaryLines.join(' || ');
        current.summaryNormalized = normalizeSummary(current.summary);
        if (useInferredSize) {
            const romOffset = snesToRomOffset(current.address);
            current.romOffset = romOffset;
            current.bytes = Array.from(romBuf.slice(romOffset, romOffset + current.expectedSize));
        } else {
            current.romOffset = rawNextAddress != null ? snesToRomOffset(current.address) : null;
            current.bytes = [];
        }
    }
    return occurrences;
}

function groupInstructionRecords(records, scriptLabel, romBuf) {
    const groupsByIndent = new Map();
    for (const record of records) {
        if (!groupsByIndent.has(record.indent)) groupsByIndent.set(record.indent, []);
        const groups = groupsByIndent.get(record.indent);
        const previous = groups[groups.length - 1];
        if (previous && previous.address === record.address && previous.opcode === record.opcode) {
            previous.summaryLines.push(record.summary);
            if (previous.branchTarget == null && record.branchTarget != null) previous.branchTarget = record.branchTarget;
            previous.rawLines.push(record.raw);
            continue;
        }
        groups.push({
            scriptLabel,
            indent: record.indent,
            address: record.address,
            opcode: record.opcode,
            opcodeHex: record.opcodeHex,
            summaryLines: [record.summary],
            rawLines: [record.raw],
            branchTarget: record.branchTarget,
        });
    }
    const indents = Array.from(groupsByIndent.keys()).sort((left, right) => left - right);
    const allOccurrences = [];
    for (const indent of indents) {
        const finalized = finalizeGroupedOccurrences(groupsByIndent.get(indent), romBuf);
        for (const occurrence of finalized) allOccurrences.push(occurrence);
    }
    const rootIndent = indents[0] == null ? null : indents[0];
    return {
        rootIndent,
        topLevel: rootIndent == null ? [] : groupsByIndent.get(rootIndent),
        allOccurrences,
    };
}

function parseScriptStart(line) {
    const match = /=>\s*(0x[0-9a-fA-F]+)/.exec(line);
    if (!match) return null;
    return Number.parseInt(match[1], 16);
}

function parseScriptAll(content, romBuf) {
    const lines = content.split(/\r?\n/);
    const scripts = [];
    let current = null;

    function flushCurrent() {
        if (!current) return;
        const grouped = groupInstructionRecords(current.records, current.label, romBuf);
        scripts.push({
            startAddress: current.startAddress,
            startAddressHex: `0x${current.startAddress.toString(16).toUpperCase()}`,
            label: current.label,
            headerLine: current.headerLine,
            topLevelInstructions: grouped.topLevel,
            allOccurrences: grouped.allOccurrences,
        });
        current = null;
    }

    for (const line of lines) {
        const scriptStart = parseScriptStart(line);
        if (scriptStart != null) {
            flushCurrent();
            current = {
                startAddress: scriptStart,
                label: line.trim(),
                headerLine: line,
                records: [],
            };
            continue;
        }
        if (!current) continue;
        const record = parseInstructionLine(line);
        if (record) current.records.push(record);
    }
    flushCurrent();
    return scripts;
}

function buildOpcodeStats(occurrences) {
    const stats = new Map();
    for (const occurrence of occurrences) {
        if (!stats.has(occurrence.opcode)) {
            stats.set(occurrence.opcode, {
                opcode: occurrence.opcode,
                opcodeHex: occurrence.opcodeHex,
                occurrences: 0,
                sizes: new Set(),
                sampleAddresses: [],
            });
        }
        const entry = stats.get(occurrence.opcode);
        entry.occurrences += 1;
        if (occurrence.expectedSize != null) entry.sizes.add(occurrence.expectedSize);
        if (entry.sampleAddresses.length < 8) entry.sampleAddresses.push(occurrence.address);
    }
    return Array.from(stats.values())
        .map((entry) => ({
            opcode: entry.opcode,
            opcodeHex: entry.opcodeHex,
            occurrences: entry.occurrences,
            observedSizes: Array.from(entry.sizes).sort((left, right) => left - right),
            sampleAddresses: entry.sampleAddresses.map((address) => `0x${address.toString(16).toUpperCase()}`),
        }))
        .sort((left, right) => left.opcode - right.opcode);
}

function loadCorpus(options = {}) {
    const dumpPath = resolveExistingPath(DEFAULT_DUMP_CANDIDATES, options.dumpPath);
    const romPath = resolveExistingPath(DEFAULT_ROM_CANDIDATES, options.romPath);
    const dumpContent = fs.readFileSync(dumpPath, 'utf8');
    const romBuf = fs.readFileSync(romPath);
    const scripts = parseScriptAll(dumpContent, romBuf);
    const occurrences = scripts.flatMap((script) => script.allOccurrences);
    const opcodeStats = buildOpcodeStats(occurrences);
    return {
        dumpPath,
        romPath,
        romBuf,
        scripts,
        occurrences,
        opcodeStats,
        generatedAt: new Date().toISOString(),
    };
}

module.exports = {
    DEFAULT_DUMP_CANDIDATES,
    DEFAULT_ROM_CANDIDATES,
    loadCorpus,
    normalizeSummary,
    parseInstructionLine,
    parseScriptAll,
    resolveExistingPath,
    snesToRomOffset,
};
