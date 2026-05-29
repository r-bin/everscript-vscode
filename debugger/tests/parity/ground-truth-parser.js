'use strict';

const fs = require('fs');

function parseHex(value) {
    if (!value) return NaN;
    return Number.parseInt(String(value).replace(/^0x/i, ''), 16);
}

function parseBranchTarget(summary) {
    if (!summary) return null;
    const match = String(summary).match(/\(to\s+0x([0-9a-fA-F]{6})\)/);
    if (!match) return null;
    return Number.parseInt(match[1], 16);
}

function parseInstructionLine(line) {
    const match = line.match(/^(\s*)\[0x([0-9a-fA-F]{6})\]\s+\(([0-9a-fA-F]{2})\)\s+(.*)$/);
    if (!match) return null;
    const indent = match[1].length;
    const address = Number.parseInt(match[2], 16);
    const opcode = Number.parseInt(match[3], 16);
    const summary = match[4].trim();
    return {
        indent,
        address,
        opcode,
        opcodeHex: `0x${match[3].toUpperCase()}`,
        summary,
        branchTarget: parseBranchTarget(summary),
        raw: line,
    };
}

function parseScriptsAll(content) {
    const lines = String(content).split(/\r?\n/);
    const scripts = [];
    let current = null;

    for (const line of lines) {
        const header = line.match(/=>\s*0x([0-9a-fA-F]{6})\b/);
        if (header) {
            if (current && current.instructions.length) scripts.push(current);
            current = {
                startAddress: Number.parseInt(header[1], 16),
                startAddressHex: `0x${header[1].toUpperCase()}`,
                headerLine: line,
                baseIndent: null,
                instructions: [],
            };
            continue;
        }

        if (!current) continue;

        const instr = parseInstructionLine(line);
        if (!instr) continue;

        if (current.baseIndent == null) current.baseIndent = instr.indent;

        // Ignore nested RCALL-rendered scripts for top-level parity blocks.
        if (instr.indent !== current.baseIndent) continue;

        current.instructions.push(instr);
    }

    if (current && current.instructions.length) scripts.push(current);
    return scripts;
}

function loadGroundTruthDump(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    return parseScriptsAll(content);
}

module.exports = {
    parseHex,
    parseBranchTarget,
    parseInstructionLine,
    parseScriptsAll,
    loadGroundTruthDump,
};
