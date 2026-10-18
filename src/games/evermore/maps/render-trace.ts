// Ownership: reading a Mesen2 trace log of the tile decoder ($8C:C8A9 fetches the next command
// byte) into the commands it ran — where each starts, what it read from the stream, what it wrote
// to VRAM, and how long it is. Pure: takes the trace text (the user's own Mesen2 log; the caller
// reads it). Opcode 0x93's counter loop is ./render-trace-93.

const FETCH_RE = /^8CC8A9\s+LDA \(\$12\) \[\$([0-9A-F]{6})\] = \$([0-9A-F]{2})/;
const ACCESS_RE = /\[\$([0-9A-F]{6})\] = \$([0-9A-F]{2,4})/;
const VMADDR_RE = /^([0-9A-F]{6})\s+(STA|STX|STY|STZ)\s+\$2116 \[VMADDL\] = \$([0-9A-F]{4})/;
const VMDATA_RE = /^([0-9A-F]{6})\s+(STA|STX|STY)\s+(VMDATAL|VMDATAH) = \$([0-9A-F]{4})/;

export interface TraceLine { lineNumber: number; text: string }

/** One command byte the decoder fetched. */
export interface CommandFetch { lineNumber: number; streamAddr: number; opcode: number; text: string }

/** A stream read inside a command (1 or 2 bytes). */
export interface StreamRead { lineNumber: number; address: number; value: number; widthBytes: number; text: string }

export interface VramWrite { lineNumber: number; pc: number; target: string; value: number | null; text: string }

/** One command as the trace shows it. */
export interface CommandOccurrence {
    fetch: CommandFetch;
    nextFetch: CommandFetch | null;
    lineStart: number;
    lineEndExclusive: number;
    streamAddr: number;
    opcode: number;
    /** Bit 7 set: the low 7 bits are the header's length. */
    headerSpan: number | null;
    payloadStart: number | null;
    reads: StreamRead[];
    headerReads: StreamRead[];
    payloadReads: StreamRead[];
    /** The VRAM writes just before the fetch (the destination set-up) and during the command. */
    vramWrites: VramWrite[];
    lastReadEnd: number;
    endAddrExclusive: number;
    /** Bytes touched, which a 16-bit read can push one past the command. */
    inferredSize: number;
    /** Ends at the next fetch in the same bank when that one starts inside what was touched. */
    logicalEndExclusive: number;
    logicalSize: number;
    adjacentFetch: CommandFetch | null;
    logicalNextFetch: CommandFetch | null;
}

export function parseTraceLines(traceText: string): TraceLine[] {
    return String(traceText || '').split(/\r?\n/).map((text, index) => ({ lineNumber: index + 1, text }));
}

export function parseCommandFetches(traceText: string): CommandFetch[] {
    const out: CommandFetch[] = [];
    for (const line of parseTraceLines(traceText)) {
        const match = line.text.match(FETCH_RE);
        if (match) out.push({ lineNumber: line.lineNumber, streamAddr: parseInt(match[1], 16), opcode: parseInt(match[2], 16), text: line.text.trim() });
    }
    return out;
}

function findNearestHigherFetchSameBank(fetches: CommandFetch[], streamAddr: number): CommandFetch | null {
    const bank = streamAddr >>> 16;
    let best: CommandFetch | null = null;
    for (const fetch of fetches) {
        if ((fetch.streamAddr >>> 16) !== bank) continue;
        if (fetch.streamAddr <= streamAddr) continue;
        if (!best || fetch.streamAddr < best.streamAddr) best = fetch;
    }
    return best;
}

function registerValue(lineText: string, register: string): number | null {
    const match = lineText.match(new RegExp(`${register}:([0-9A-F]{2,4})`));
    return match ? parseInt(match[1], 16) : null;
}

/** What a store wrote: the register it stores, or 0 for STZ. */
function writeValue(lineText: string, mnemonic: string): number | null {
    if (mnemonic === 'STX') return registerValue(lineText, 'X');
    if (mnemonic === 'STY') return registerValue(lineText, 'Y');
    if (mnemonic === 'STZ') return 0;
    return registerValue(lineText, 'A');
}

function parseVramWrite(line: TraceLine): VramWrite | null {
    const addr = line.text.match(VMADDR_RE);
    if (addr) return { lineNumber: line.lineNumber, pc: parseInt(addr[1], 16), target: 'VMADDL', value: writeValue(line.text, addr[2]), text: line.text.trim() };
    const data = line.text.match(VMDATA_RE);
    if (data) return { lineNumber: line.lineNumber, pc: parseInt(data[1], 16), target: data[3], value: writeValue(line.text, data[2]), text: line.text.trim() };
    return null;
}

/** Index of the first line with lineNumber >= n (lines are in file order). */
function firstLineAtOrAfter(lines: TraceLine[], n: number): number {
    let lo = 0, hi = lines.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (lines[mid].lineNumber < n) lo = mid + 1; else hi = mid;
    }
    return lo;
}

export function analyzeCommandOccurrence(lines: TraceLine[], fetches: CommandFetch[], index: number): CommandOccurrence {
    const fetch = fetches[index];
    const nextFetch = index + 1 < fetches.length ? fetches[index + 1] : null;
    const endLineNumber = nextFetch ? nextFetch.lineNumber : lines.length + 1;
    const bank = fetch.streamAddr >>> 16;
    const headerSpan = fetch.opcode & 0x80 ? (fetch.opcode & 0x7f) : null;
    const payloadStart = headerSpan != null ? fetch.streamAddr + headerSpan : null;
    const reads: StreamRead[] = [];
    const vramWrites: VramWrite[] = [];
    const preludeVramWrites: VramWrite[] = [];

    for (let i = firstLineAtOrAfter(lines, Math.max(1, fetch.lineNumber - 32)); i < lines.length && lines[i].lineNumber < fetch.lineNumber; i++) {
        const write = parseVramWrite(lines[i]);
        if (write) preludeVramWrites.push(write);
    }

    for (let i = firstLineAtOrAfter(lines, fetch.lineNumber); i < lines.length && lines[i].lineNumber < endLineNumber; i++) {
        const line = lines[i];
        const access = line.text.match(ACCESS_RE);
        if (access) {
            const address = parseInt(access[1], 16);
            if ((address >>> 16) === bank && address >= fetch.streamAddr) {
                reads.push({ lineNumber: line.lineNumber, address, value: parseInt(access[2], 16), widthBytes: access[2].length > 2 ? 2 : 1, text: line.text.trim() });
            }
        }
        const write = parseVramWrite(line);
        if (write) vramWrites.push(write);
    }

    const lastReadEnd = reads.reduce((max, entry) => Math.max(max, entry.address + entry.widthBytes - 1), fetch.streamAddr);
    const endAddrExclusive = reads.length ? lastReadEnd + 1 : fetch.streamAddr + 1;
    const adjacentFetch = fetches.find((f) => f.streamAddr === endAddrExclusive) || null;
    const higher = findNearestHigherFetchSameBank(fetches, fetch.streamAddr);
    const logicalNextFetch = higher && higher.streamAddr <= endAddrExclusive ? higher : null;
    const logicalEndExclusive = logicalNextFetch ? logicalNextFetch.streamAddr : endAddrExclusive;

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
        headerReads: payloadStart == null ? reads.slice() : reads.filter((entry) => entry.address < payloadStart),
        payloadReads: payloadStart == null ? [] : reads.filter((entry) => entry.address >= payloadStart),
        vramWrites: preludeVramWrites.concat(vramWrites),
        lastReadEnd,
        endAddrExclusive,
        inferredSize: endAddrExclusive - fetch.streamAddr,
        logicalEndExclusive,
        logicalSize: logicalEndExclusive - fetch.streamAddr,
        adjacentFetch,
        logicalNextFetch,
    };
}
