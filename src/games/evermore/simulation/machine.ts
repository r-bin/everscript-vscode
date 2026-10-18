// Ownership: what the simulation needs from outside — the ROM and the
// instruction decoder — and the address arithmetic that goes with them. Pure.
//
// The decoder is injected (`decoder.ts` binds script-vm and script-model) so this domain reads
// instruction *boundaries*, control flow and placement facts through one interface. Meaning —
// values, conditions, writes — is computed here, from operand.ts.

/** What an instruction does that the simulation acts on without reading its operands itself. */
export type Effect =
    /** A branch or jump target. */
    | { kind: 'branch'; target: number }
    /** A call or a thread start by pointer or table offset, resolved. */
    | { kind: 'call'; target: number }
    | { kind: 'callGlobal'; id: number }
    /** A map change: x and y in pixels. */
    | { kind: 'changeMap'; mapId: number; x: number; y: number }
    | { kind: 'spawn'; npc: number }
    | { kind: 'playMusic'; track: number }
    /** An operand reads the random number generator. */
    | { kind: 'random' };

/** The subset of a decoded instruction the simulation reads. */
export interface Instruction {
    address: number;
    opcode: number;
    size: number;
    /** For reading: the instruction in the compiler's notation. */
    summary: string;
    terminal: boolean;
    effects: Effect[];
}

export interface SpawnFact { npc: number; name: string | null; romName: string | null; x: number | null; y: number | null }

export interface Decoder {
    /** Null where there is no script code the game can run. */
    decodeInstruction(rom: Uint8Array, addr: number): Instruction | null;
    snesToRom(addr: number): number;
    /** A packed script pointer as a bus address. */
    unpack(packed: number): number;
    /** Names; '' (or null) when there is none. */
    globalScriptName(id: number): string;
    scriptName(fileOffset: number): string;
    flagName(addr: number, bit: number): string;
    lootRewardName(item: number): string | null;
    mapName(id: number): string;
    spawn(ins: Instruction): SpawnFact | null;
    /** The room's enter script and trigger tables. */
    buildRoomScriptModel(rom: Uint8Array, mapId: number): import('./room').RoomTables;
}

/** Start of the script bank: its header words locate the pointer tables. */
const SCRIPT_BANK = 0x928000;

export class Machine {
    private cache = new Map<number, Instruction | null>();
    /**
     * Instructions whose operands, as operand.ts reads them, do not end where
     * the decoder says the instruction ends. Must stay empty; the parity test
     * walks the whole ROM to keep it that way.
     */
    readonly layoutErrors = new Map<number, { opcode: number; ours: number; decoder: number }>();

    constructor(readonly rom: Uint8Array, readonly dec: Decoder) {}

    toFile = (snes: number): number => this.dec.snesToRom(snes);

    instruction(addr: number): Instruction | null {
        if (!this.cache.has(addr)) {
            const ok = this.dec.snesToRom(addr) < this.rom.length;
            this.cache.set(addr, ok ? this.dec.decodeInstruction(this.rom, addr) : null);
        }
        return this.cache.get(addr)!;
    }

    u8(addr: number): number { return this.rom[this.toFile(addr)]; }
    u16(addr: number): number { return this.u8(addr) | (this.u8(addr + 1) << 8); }
    u24(addr: number): number { return this.u16(addr) | (this.u8(addr + 2) << 16); }

    /**
     * Where `CALL <id>` (opcode 0xa3) goes. Read from its handler at
     * $8C:D3A0: index = id*3 + word[$928008] + word[$928000], then a packed
     * pointer at $928000 + index. The `$928008` term is easy to miss — without
     * it the id lands in the sniff-spot scripts.
     */
    globalScript(id: number): number {
        const index = id * 3 + this.u16(SCRIPT_BANK + 8) + this.u16(SCRIPT_BANK);
        return this.dec.unpack(this.u24(SCRIPT_BANK + index));
    }

    /** A trigger's script id is a byte offset into the pointer table at word[$928000]. */
    triggerScript(id: number): number {
        return this.dec.unpack(this.u24(SCRIPT_BANK + this.u16(SCRIPT_BANK) + id));
    }
}
