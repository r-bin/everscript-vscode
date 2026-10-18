// Ownership: what a Mesen2 trace shows about the tile decoder's opcode 0x93 — its size, its first
// reads and VRAM writes, the ROM bytes it spans, and the proof that it ends on a fixed counter, not
// on a length read from the stream. Pure: takes the trace text and the ROM. ./render-trace parses.
//
// The counter, from the code:
//   $8C:C9CD  LDX #$001F            the outer counter, an immediate (not stream data)
//   $8C:CA99  DEC $04 / BMI $8CCAE4 the first pass ends when $04 drops below 0 (8-bit)
//   $8C:CAF0  STA VMADDL            between the passes: VRAM address | $100 (bit 8)
//   $8C:CAF6  LDX #$001F            the counter again for the second pass
//   $8C:CAFF / $8C:CBFF  RTL        the exit, after the bit-8 test at $8C:CAE4 / $8C:CBE4
// So every 0x93 writes 2 × 32 = 64 VRAM words.

import { hiromFileOffset } from '../../../platform/snes/hirom';
import { CommandFetch, StreamRead, TraceLine, VramWrite, analyzeCommandOccurrence, parseCommandFetches, parseTraceLines } from './render-trace';

const COUNTER_INIT = 0x1f;
const PHASES = 2;
const DECS_PER_PHASE = COUNTER_INIT + 1;
const VRAM_WORDS = DECS_PER_PHASE * PHASES;

/** DEC $04 with the counter's old value and Y (the payload pointer). */
const DEC04_RE = /^(8C[0-9A-F]{4})\s+DEC \$04 \[\$000004\] = \$([0-9A-F]{2})\s+A:[0-9A-F]{4} X:[0-9A-F]{4} Y:([0-9A-F]{4})/;
/**
 * The VMADDL write between the passes, in the trace's label form (`8CCAF0 STA VMADDL = …`), unlike the
 * set-up before the fetch (`8CC88F STX $2116 [VMADDL]`).
 */
const VMADDL_TRANSIT_RE = /^(8CC[AB]F0)\s+STA VMADDL = \$[0-9A-F]+\s+A:([0-9A-F]{4})/;

export interface CounterDec { lineNumber: number; pc: number; oldValue: number; newValue: number; yReg: number }
export interface CounterPhase { decCount: number; startDecIndex: number; endDecIndex: number; incomplete?: boolean }

export interface CounterMechanics {
    dec04Events: CounterDec[];
    phaseTransitions: Array<{ lineNumber: number; pc: number; newVramAddr: number }>;
    phases: CounterPhase[];
    phaseCount: number;
    decPerPhase: number;
    totalDecs: number;
    /** The last DEC after which Y had moved on: the iteration that read the last payload byte. */
    lastYAdvanceDec: CounterDec | null;
    terminationProof: {
        kind: 'hardcoded_outer_counter';
        outerCounterInit: number;
        decCountPerPhase: number;
        phasesPerCommand: number;
        totalVramWordsPerCommand: number;
        codeRef: { counterInitPC: number; phaseCheckPC: number; phaseCounterReset: number; finalRTL_A: number; finalRTL_B: number };
    };
}

type FetchRef = Pick<CommandFetch, 'streamAddr' | 'opcode' | 'lineNumber'>;

export interface Opcode93Summary {
    streamAddr: number;
    opcode: number;
    lineStart: number;
    lineEndExclusive: number;
    headerSpan: number | null;
    payloadStart: number | null;
    inferredSize: number;
    endAddrExclusive: number;
    lastReadEnd: number;
    logicalEndExclusive: number;
    logicalSize: number;
    adjacentFetch: FetchRef | null;
    logicalNextFetch: FetchRef | null;
    firstHeaderByte: StreamRead | null;
    firstPayloadControl: StreamRead | null;
    firstPayloadWords: StreamRead[];
    firstVramWrites: VramWrite[];
    romBytes: number[];
    counterMechanics: CounterMechanics;
}

/** The counter loop of one 0x93 inside trace lines [lineStart, lineEndExclusive). */
export function analyzeOpcode93CounterMechanics(lines: TraceLine[], lineStart: number, lineEndExclusive: number): CounterMechanics {
    const dec04Events: CounterDec[] = [];
    const phaseTransitions: CounterMechanics['phaseTransitions'] = [];
    for (const line of lines) {
        if (line.lineNumber < lineStart || line.lineNumber >= lineEndExclusive) continue;
        const dec = line.text.match(DEC04_RE);
        if (dec) {
            const oldValue = parseInt(dec[2], 16);
            dec04Events.push({ lineNumber: line.lineNumber, pc: parseInt(dec[1], 16), oldValue, newValue: (oldValue - 1 + 0x100) & 0xff, yReg: parseInt(dec[3], 16) });
        }
        const vm = line.text.match(VMADDL_TRANSIT_RE);
        if (vm) phaseTransitions.push({ lineNumber: line.lineNumber, pc: parseInt(vm[1], 16), newVramAddr: parseInt(vm[2], 16) });
    }

    // A pass ends where $04 wraps to $FF.
    const phases: CounterPhase[] = [];
    let start = 0;
    dec04Events.forEach((evt, i) => {
        if (evt.newValue !== 0xff) return;
        phases.push({ decCount: i - start + 1, startDecIndex: start, endDecIndex: i });
        start = i + 1;
    });
    if (start < dec04Events.length) phases.push({ decCount: dec04Events.length - start, startDecIndex: start, endDecIndex: dec04Events.length - 1, incomplete: true });

    let lastYAdvanceDec: CounterDec | null = null;
    let prevY: number | null = null;
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
            outerCounterInit: COUNTER_INIT,
            decCountPerPhase: DECS_PER_PHASE,
            phasesPerCommand: PHASES,
            totalVramWordsPerCommand: VRAM_WORDS,
            codeRef: { counterInitPC: 0x8cc9cd, phaseCheckPC: 0x8ccae4, phaseCounterReset: 0x8ccaf6, finalRTL_A: 0x8ccaff, finalRTL_B: 0x8ccbff },
        },
    };
}

function romSlice(rom: ArrayLike<number> | null, startBus: number, size: number): number[] {
    if (!rom || !Number.isFinite(size) || size <= 0) return [];
    const start = hiromFileOffset(startBus);
    return Array.from(Array.prototype.slice.call(rom, start, start + size) as number[]);
}

const fetchRef = (f: CommandFetch | null): FetchRef | null => (f ? { streamAddr: f.streamAddr, opcode: f.opcode, lineNumber: f.lineNumber } : null);

/** Every 0x93 the trace ran, summarized; `rom` (optional) adds the bytes each one spans. */
export function dumpOpcode93Commands(traceText: string, rom: ArrayLike<number> | null): Opcode93Summary[] {
    const lines = parseTraceLines(traceText);
    const fetches = parseCommandFetches(traceText);
    return fetches
        .map((_, index) => analyzeCommandOccurrence(lines, fetches, index))
        .filter((command) => command.opcode === 0x93)
        .map((command) => ({
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
            adjacentFetch: fetchRef(command.adjacentFetch),
            logicalNextFetch: fetchRef(command.logicalNextFetch),
            firstHeaderByte: command.headerReads.find((entry) => entry.address === command.streamAddr + 1) || null,
            firstPayloadControl: command.payloadStart == null ? null : command.payloadReads.find((entry) => entry.address === command.payloadStart) || null,
            firstPayloadWords: command.payloadReads.filter((entry) => entry.widthBytes === 2).slice(0, 4),
            firstVramWrites: command.vramWrites.slice(0, 8),
            romBytes: romSlice(rom, command.streamAddr, command.inferredSize),
            counterMechanics: analyzeOpcode93CounterMechanics(lines, command.lineStart, command.lineEndExclusive),
        }));
}
