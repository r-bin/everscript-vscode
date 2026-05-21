'use strict';

const fs = require('fs');

const DEFAULT_TRACE_PATH = '/Users/v/Library/Application Support/Mesen2/Debugger/strongheart_exterior_decode_tiles_fist_call__breakpoint_bus=ee0000.txt';
const ROM_CANDIDATES = [
    process.env.ROM,
    '/Users/v/Documents/GitHub/SoETilesViewer/SoEScriptDumper/Secret of Evermore (U) [!].smc',
    '/Users/v/Documents/GitHub/everscript/Secret of Evermore (U) [!].smc',
].filter(Boolean);

const FETCH_RE = /^8CC8A9\s+LDA \(\$12\) \[\$([0-9A-F]{6})\] = \$([0-9A-F]{2})/;
const ACCESS_RE = /\[\$([0-9A-F]{6})\] = \$([0-9A-F]{2,4})/;
const VMADDR_RE = /^([0-9A-F]{6})\s+(STA|STX|STY|STZ)\s+\$2116 \[VMADDL\] = \$([0-9A-F]{4})/;
const VMDATA_RE = /^([0-9A-F]{6})\s+(STA|STX|STY)\s+(VMDATAL|VMDATAH) = \$([0-9A-F]{4})/;

// Proven counter parameters for opcode 0x93 — all sourced from trace evidence
// LDX #$001F at 8CC9CD is a hardcoded ROM immediate; it is NOT read from the tile stream.
// The command runs two identical passes of 32 decrements each, gated by bit 8 of the VRAM address.
const OPCODE93_OUTER_COUNTER_INIT = 0x1F;           // LDX #$001F at 8CC9CD and 8CCAF6
const OPCODE93_PHASES             = 2;              // bit-8 check at 8CCAE4 / 8CCBE4
const OPCODE93_DEC_PER_PHASE      = OPCODE93_OUTER_COUNTER_INIT + 1; // 32: 8-bit DEC from 0x1F → 0xFF
const OPCODE93_VRAM_WORDS         = OPCODE93_DEC_PER_PHASE * OPCODE93_PHASES; // 64

// Matches 65816 DEC $04 events with old value and Y register (bank 8C = ROM)
const DEC04_65816_RE = /^(8C[0-9A-F]{4})\s+DEC \$04 \[\$000004\] = \$([0-9A-F]{2})\s+A:[0-9A-F]{4} X:[0-9A-F]{4} Y:([0-9A-F]{4})/;
// Matches VMADDL writes at phase-transition PCs that use the direct label form (e.g. 8CCAF0 STA VMADDL)
// These differ from prelude writes (e.g. 8CC88F STX $2116 [VMADDL]) which are handled by VMADDR_RE
const VMADDL_TRANSIT_RE = /^(8CC[AB]F0)\s+STA VMADDL = \$[0-9A-F]+\s+A:([0-9A-F]{4})/;

function hex(value, width) {
    return (value >>> 0).toString(16).toUpperCase().padStart(width, '0');
}

function snesToRomOffset(snesAddr) {
    return (((snesAddr >>> 16) & 0x3f) * 0x10000) + (snesAddr & 0xffff);
}

function loadTrace(tracePath = DEFAULT_TRACE_PATH) {
    return fs.readFileSync(tracePath, 'utf8');
}

function loadRom(romPath) {
    const finalPath = romPath || ROM_CANDIDATES.find((candidate) => {
        try { return candidate && fs.existsSync(candidate); } catch { return false; }
    });
    if (!finalPath) return null;
    return fs.readFileSync(finalPath);
}

function parseTraceLines(traceText) {
    return String(traceText || '').split(/\r?\n/).map((text, index) => ({ lineNumber: index + 1, text }));
}

function parseCommandFetches(traceText) {
    return parseTraceLines(traceText)
        .map((line) => {
            const match = line.text.match(FETCH_RE);
            if (!match) return null;
            return {
                lineNumber: line.lineNumber,
                streamAddr: parseInt(match[1], 16),
                opcode: parseInt(match[2], 16),
                text: line.text.trim(),
            };
        })
        .filter(Boolean);
}

function findAdjacentFetch(fetches, endAddrExclusive) {
    return fetches.find((fetch) => fetch.streamAddr === endAddrExclusive) || null;
}

function findNearestHigherFetchSameBank(fetches, streamAddr) {
    const bank = streamAddr >>> 16;
    let best = null;
    for (const fetch of fetches) {
        if ((fetch.streamAddr >>> 16) !== bank) continue;
        if (fetch.streamAddr <= streamAddr) continue;
        if (!best || fetch.streamAddr < best.streamAddr) best = fetch;
    }
    return best;
}

function extractRegisterValue(lineText, registerName) {
    const match = lineText.match(new RegExp(`${registerName}:([0-9A-F]{2,4})`));
    return match ? parseInt(match[1], 16) : null;
}

function inferWriteValue(lineText, opMnemonic) {
    if (opMnemonic === 'STX') return extractRegisterValue(lineText, 'X');
    if (opMnemonic === 'STY') return extractRegisterValue(lineText, 'Y');
    if (opMnemonic === 'STZ') return 0;
    return extractRegisterValue(lineText, 'A');
}

function parseVramWrite(line) {
    const vmaddrMatch = line.text.match(VMADDR_RE);
    if (vmaddrMatch) {
        return {
            lineNumber: line.lineNumber,
            pc: parseInt(vmaddrMatch[1], 16),
            target: 'VMADDL',
            value: inferWriteValue(line.text, vmaddrMatch[2]),
            text: line.text.trim(),
        };
    }

    const vmdataMatch = line.text.match(VMDATA_RE);
    if (vmdataMatch) {
        return {
            lineNumber: line.lineNumber,
            pc: parseInt(vmdataMatch[1], 16),
            target: vmdataMatch[3],
            value: inferWriteValue(line.text, vmdataMatch[2]),
            text: line.text.trim(),
        };
    }

    return null;
}

function analyzeCommandOccurrence(lines, fetches, index) {
    const fetch = fetches[index];
    const nextFetch = index + 1 < fetches.length ? fetches[index + 1] : null;
    const endLineNumber = nextFetch ? nextFetch.lineNumber : lines.length + 1;
    const bank = fetch.streamAddr >>> 16;
    const headerSpan = fetch.opcode & 0x80 ? (fetch.opcode & 0x7f) : null;
    const payloadStart = headerSpan != null ? fetch.streamAddr + headerSpan : null;
    const reads = [];
    const vramWrites = [];
    const preludeVramWrites = [];

    for (const line of lines) {
        if (line.lineNumber < Math.max(1, fetch.lineNumber - 32) || line.lineNumber >= fetch.lineNumber) continue;
        const vramWrite = parseVramWrite(line);
        if (vramWrite) preludeVramWrites.push(vramWrite);
    }

    for (const line of lines) {
        if (line.lineNumber < fetch.lineNumber || line.lineNumber >= endLineNumber) continue;

        const addrMatch = line.text.match(ACCESS_RE);
        if (addrMatch) {
            const address = parseInt(addrMatch[1], 16);
            if ((address >>> 16) === bank && address >= fetch.streamAddr) {
                reads.push({
                    lineNumber: line.lineNumber,
                    address,
                    value: parseInt(addrMatch[2], 16),
                    widthBytes: addrMatch[2].length > 2 ? 2 : 1,
                    text: line.text.trim(),
                });
            }
        }

        const vramWrite = parseVramWrite(line);
        if (vramWrite) vramWrites.push(vramWrite);
    }

    const lastReadEnd = reads.reduce((max, entry) => Math.max(max, entry.address + entry.widthBytes - 1), fetch.streamAddr);
    const endAddrExclusive = reads.length ? lastReadEnd + 1 : fetch.streamAddr + 1;
    const adjacentFetch = findAdjacentFetch(fetches, endAddrExclusive);
    const nearestHigherFetchSameBank = findNearestHigherFetchSameBank(fetches, fetch.streamAddr);
    const logicalNextFetch = nearestHigherFetchSameBank && nearestHigherFetchSameBank.streamAddr <= endAddrExclusive
        ? nearestHigherFetchSameBank
        : null;
    const headerReads = payloadStart == null ? reads.slice() : reads.filter((entry) => entry.address < payloadStart);
    const payloadReads = payloadStart == null ? [] : reads.filter((entry) => entry.address >= payloadStart);

    return {
        fetch,
        nextFetch,
        lineStart: fetch.lineNumber,
        lineEndExclusive: endLineNumber,
        streamAddr: fetch.streamAddr,
        opcode: fetch.opcode,
        headerSpan,
        payloadStart,
        reads,
        headerReads,
        payloadReads,
        vramWrites: preludeVramWrites.concat(vramWrites),
        lastReadEnd,
        endAddrExclusive,
        inferredSize: endAddrExclusive - fetch.streamAddr,
        logicalEndExclusive: logicalNextFetch ? logicalNextFetch.streamAddr : endAddrExclusive,
        logicalSize: (logicalNextFetch ? logicalNextFetch.streamAddr : endAddrExclusive) - fetch.streamAddr,
        adjacentFetch,
        logicalNextFetch,
    };
}

function analyzeRenderCommands(traceText) {
    const lines = parseTraceLines(traceText);
    const fetches = parseCommandFetches(traceText);
    return fetches.map((_, index) => analyzeCommandOccurrence(lines, fetches, index));
}

function analyzeOpcodeCommands(traceText, opcode) {
    return analyzeRenderCommands(traceText).filter((entry) => entry.opcode === opcode);
}

function readRomSlice(romBuf, startSnes, size) {
    if (!romBuf || !Number.isFinite(size) || size <= 0) return [];
    const startRom = snesToRomOffset(startSnes);
    return Array.from(romBuf.slice(startRom, startRom + size));
}

// analyzeOpcode93CounterMechanics
// Scans the 65816 trace window for opcode 0x93 counter-loop evidence.
// Returns structured proof that termination is purely counter-driven (hardcoded LDX #$001F),
// NOT a size field read from the tile stream.
//
// Evidence:
//   8CC9CD  LDX #$001F          — hardcoded outer counter (NOT stream data)
//   8CCA99  DEC $04 / BMI $8CCAE4 — phase 1 exit when $04 underflows 8-bit to 0xFF
//   8CCAF0  STA VMADDL          — phase transition: VRAM address |= 0x100 (bit 8 set)
//   8CCAF6  LDX #$001F          — counter reset for phase 2 (same hardcoded value)
//   8CCBFF  RTL                 — final exit (or 8CCAFF) after bit-8 check at 8CCAE4
function analyzeOpcode93CounterMechanics(lines, lineStart, lineEndExclusive) {
    const dec04Events = [];
    const phaseTransitions = [];

    for (const line of lines) {
        if (line.lineNumber < lineStart || line.lineNumber >= lineEndExclusive) continue;

        // 65816 DEC $04 with old counter value and Y payload pointer
        const decMatch = line.text.match(DEC04_65816_RE);
        if (decMatch) {
            const oldValue = parseInt(decMatch[2], 16);
            dec04Events.push({
                lineNumber: line.lineNumber,
                pc: parseInt(decMatch[1], 16),
                oldValue,
                newValue: (oldValue - 1 + 0x100) & 0xFF, // 8-bit arithmetic
                yReg: parseInt(decMatch[3], 16),
            });
        }

        // VMADDL write at phase-transition addresses using direct label form (8CCAF0, 8CCBF0)
        // These appear as "STA VMADDL = $..." in the trace (not the "STX $2116 [VMADDL]" prelude form)
        const vmMatch = line.text.match(VMADDL_TRANSIT_RE);
        if (vmMatch) {
            phaseTransitions.push({
                lineNumber: line.lineNumber,
                pc: parseInt(vmMatch[1], 16),
                newVramAddr: parseInt(vmMatch[2], 16),
            });
        }
    }

    // Identify phase boundaries: $04 underflows 8-bit (newValue = 0xFF = -1)
    const phaseEndIndices = dec04Events.reduce((acc, evt, i) => {
        if (evt.newValue === 0xFF) acc.push(i);
        return acc;
    }, []);

    const phases = [];
    let phaseStart = 0;
    for (const endIdx of phaseEndIndices) {
        phases.push({ decCount: endIdx - phaseStart + 1, startDecIndex: phaseStart, endDecIndex: endIdx });
        phaseStart = endIdx + 1;
    }
    if (phaseStart < dec04Events.length) {
        phases.push({ decCount: dec04Events.length - phaseStart, startDecIndex: phaseStart, endDecIndex: dec04Events.length - 1, incomplete: true });
    }

    // Find the last DEC event where Y changed relative to the previous event.
    // This identifies the iteration in which the last payload byte was read (INY happened before this DEC).
    // The last logically consumed payload address = (lastYAdvanceDec.yReg - 1) & 0xFFFF, in the stream bank.
    let lastYAdvanceDec = null;
    let prevY = null;
    for (const evt of dec04Events) {
        if (prevY !== null && evt.yReg !== prevY) lastYAdvanceDec = evt;
        prevY = evt.yReg;
    }

    return {
        dec04Events,
        phaseTransitions,
        phases,
        phaseCount: phases.length,
        decPerPhase: phases.length > 0 ? phases[0].decCount : dec04Events.length,
        totalDecs: dec04Events.length,
        lastYAdvanceDec,
        terminationProof: {
            kind: 'hardcoded_outer_counter',
            outerCounterInit: OPCODE93_OUTER_COUNTER_INIT,
            decCountPerPhase: OPCODE93_DEC_PER_PHASE,
            phasesPerCommand: OPCODE93_PHASES,
            totalVramWordsPerCommand: OPCODE93_VRAM_WORDS,
            codeRef: {
                counterInitPC:    0x8CC9CD, // LDX #$001F — hardcoded immediate, NOT from tile stream
                phaseCheckPC:     0x8CCAE4, // BIT #$0100 of VRAM addr → selects phase transition vs final exit
                phaseCounterReset: 0x8CCAF6, // LDX #$001F for phase 2 (same hardcoded constant)
                finalRTL_A:       0x8CCAFF, // PLB; RTL via 8CCA9B → 8CCAE4 BMI path
                finalRTL_B:       0x8CCBFF, // PLB; RTL via 8CCC0A → 8CCBE4 BMI path
            },
        },
    };
}

function summarizeOpcode93Command(command, romBuf, lines) {
    const romBytes = readRomSlice(romBuf, command.streamAddr, command.inferredSize);
    const counterMechanics = lines
        ? analyzeOpcode93CounterMechanics(lines, command.lineStart, command.lineEndExclusive)
        : null;
    return {
        streamAddr: command.streamAddr,
        opcode: command.opcode,
        lineStart: command.lineStart,
        lineEndExclusive: command.lineEndExclusive,
        headerSpan: command.headerSpan,
        payloadStart: command.payloadStart,
        inferredSize: command.inferredSize,
        endAddrExclusive: command.endAddrExclusive,
        lastReadEnd: command.lastReadEnd,
        logicalEndExclusive: command.logicalEndExclusive,
        logicalSize: command.logicalSize,
        adjacentFetch: command.adjacentFetch ? {
            streamAddr: command.adjacentFetch.streamAddr,
            opcode: command.adjacentFetch.opcode,
            lineNumber: command.adjacentFetch.lineNumber,
        } : null,
        logicalNextFetch: command.logicalNextFetch ? {
            streamAddr: command.logicalNextFetch.streamAddr,
            opcode: command.logicalNextFetch.opcode,
            lineNumber: command.logicalNextFetch.lineNumber,
        } : null,
        firstHeaderByte: command.headerReads.find((entry) => entry.address === command.streamAddr + 1) || null,
        firstPayloadControl: command.payloadStart == null ? null : command.payloadReads.find((entry) => entry.address === command.payloadStart) || null,
        firstPayloadWords: command.payloadReads.filter((entry) => entry.widthBytes === 2).slice(0, 4),
        firstVramWrites: command.vramWrites.slice(0, 8),
        romBytes,
        counterMechanics,
    };
}

function dumpOpcode93Commands(traceText, romBuf) {
    const lines = parseTraceLines(traceText);
    const fetches = parseCommandFetches(traceText);
    return fetches
        .map((_, index) => analyzeCommandOccurrence(lines, fetches, index))
        .filter((command) => command.opcode === 0x93)
        .map((command) => summarizeOpcode93Command(command, romBuf, lines));
}

function formatBytes(bytes) {
    return bytes.map((value) => hex(value, 2)).join(' ');
}

function formatOpcode93Dump(commands) {
    const lines = [];
    lines.push('# opcode 0x93 commands observed in trace');
    lines.push(`count = ${commands.length}`);
    lines.push('');

    commands.forEach((command, index) => {
        lines.push(`## command ${index}`);
        lines.push(`start = 0x${hex(command.streamAddr, 6)} @ trace line ${command.lineStart}`);
        lines.push(`logical_size = 0x${hex(command.logicalSize, 2)} (${command.logicalSize} bytes)`);
        lines.push(`touched_size = 0x${hex(command.inferredSize, 2)} (${command.inferredSize} bytes)`);
        lines.push(`header_span = 0x${hex(command.headerSpan || 0, 2)} ; payload_start = 0x${hex(command.payloadStart || 0, 6)}`);
        lines.push(`last_read = 0x${hex(command.lastReadEnd, 6)} ; touched_end_exclusive = 0x${hex(command.endAddrExclusive, 6)}`);
        lines.push(command.logicalNextFetch
            ? `logical_next_fetch = 0x${hex(command.logicalNextFetch.streamAddr, 6)} opcode=0x${hex(command.logicalNextFetch.opcode, 2)} (trace line ${command.logicalNextFetch.lineNumber})`
            : 'logical_next_fetch = (not observed)');

        if (command.firstHeaderByte) lines.push(`first_header_byte = 0x${hex(command.firstHeaderByte.value, 2)} @ 0x${hex(command.firstHeaderByte.address, 6)}`);
        if (command.firstPayloadControl) lines.push(`first_payload_control = 0x${hex(command.firstPayloadControl.value, command.firstPayloadControl.widthBytes * 2)} @ 0x${hex(command.firstPayloadControl.address, 6)}`);
        if (command.firstPayloadWords.length) {
            lines.push(`first_payload_words = ${command.firstPayloadWords.map((entry) => `0x${hex(entry.address, 6)}:0x${hex(entry.value, 4)}`).join(', ')}`);
        }
        if (command.firstVramWrites.length) {
            lines.push(`first_vram_writes = ${command.firstVramWrites.map((entry) => `${entry.target}=0x${hex(entry.value, 4)}`).join(', ')}`);
        }
        if (command.romBytes.length) lines.push(`bytes = ${formatBytes(command.romBytes)}`);
        lines.push('');
    });

    return lines.join('\n');
}

module.exports = {
    DEFAULT_TRACE_PATH,
    ROM_CANDIDATES,
    hex,
    snesToRomOffset,
    loadTrace,
    loadRom,
    parseCommandFetches,
    parseTraceLines,
    analyzeRenderCommands,
    analyzeOpcodeCommands,
    analyzeOpcode93CounterMechanics,
    summarizeOpcode93Command,
    dumpOpcode93Commands,
    formatOpcode93Dump,
};