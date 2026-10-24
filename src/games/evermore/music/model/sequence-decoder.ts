// Ownership: verified Wolfgang record forms and runtime-observed event values.

interface SequenceRecord {
    kind: 'command' | 'data' | 'event' | 'opaque';
    offset: number;
    address: number;
    bytes: number[];
    name: string;
    argument?: number;
    phraseStart?: number;
    phraseEnd?: number;
    trailing?: number[];
    value?: number;
    ticks?: number;
}

const OBSERVED_DRIVER_STATES = new Map<number, number>([
    [0x9C, 0x3C],
    [0xD3, 0x73],
]);

const OBSERVED_DURATIONS = new Map<number, number>([
    [0x0A, 10],
    [0x1E, 30],
]);

const ONE_BYTE_ARGUMENT = new Map<number, string>([
    [0xF3, 'F3 command'],
    [0xFA, 'FA command'],
]);

function decodeSequenceTrack(bytes: number[], aram: number): SequenceRecord[] {
    const records: SequenceRecord[] = [];
    let offset = 0;
    while (offset < bytes.length) {
        const opcode = bytes[offset];
        const address = aram + offset;
        if (opcode === 0xF6) {
            const length = 10;
            if (offset + length > bytes.length) {
                records.push({ kind: 'opaque', offset, address, bytes: bytes.slice(offset), name: 'Truncated F6 record' });
                break;
            }
            const raw = bytes.slice(offset, offset + length);
            const phraseStart = raw[1] | raw[2] << 8;
            const phraseEnd = raw[3] | raw[4] << 8;
            if (phraseStart < aram || phraseEnd < phraseStart || phraseEnd > aram + bytes.length) {
                records.push({ kind: 'opaque', offset, address, bytes: bytes.slice(offset), name: 'Unverified F6 form' });
                break;
            }
            records.push({
                kind: 'command', offset, address, bytes: raw, name: 'Repeat phrase',
                phraseStart,
                phraseEnd,
                trailing: raw.slice(5),
            });
            offset += length;
            continue;
        }
        const name = ONE_BYTE_ARGUMENT.get(opcode);
        if (name) {
            if (offset + 2 > bytes.length) {
                records.push({ kind: 'opaque', offset, address, bytes: bytes.slice(offset), name: 'Truncated ' + name });
                break;
            }
            records.push({ kind: 'command', offset, address, bytes: bytes.slice(offset, offset + 2), name, argument: bytes[offset + 1] });
            offset += 2;
            continue;
        }
        const driverState = OBSERVED_DRIVER_STATES.get(opcode);
        if (driverState !== undefined) {
            records.push({ kind: 'event', offset, address, bytes: [opcode], name: 'Driver state', value: driverState });
            offset++;
            continue;
        }
        const ticks = OBSERVED_DURATIONS.get(opcode);
        if (ticks !== undefined && records[records.length - 1]?.name === 'Driver state') {
            records.push({ kind: 'event', offset, address, bytes: [opcode], name: 'Track duration', ticks });
            offset++;
            continue;
        }
        records.push({ kind: 'data', offset, address, bytes: [opcode], name: 'Unclassified stream byte' });
        offset++;
    }
    return records;
}

export type { SequenceRecord };
export { decodeSequenceTrack };