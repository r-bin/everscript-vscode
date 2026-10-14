// Ownership: what the simulation needs from outside — the ROM and the
// instruction decoder — and the address arithmetic that goes with them. Pure.
//
// The decoder is injected (src/simulation/index.js passes `require('../script')`)
// so this domain uses only its public facade: instruction *boundaries*, branch
// targets and placement facts. Meaning — values, conditions, writes — is
// computed here, from operand.ts. When the clean-room decoder of
// docs/plans/script-decoder-from-game-code.md lands, only this interface moves.

/** The subset of a decoded instruction the simulation reads. */
export interface Instruction {
    address: number;
    opcode: number;
    size: number;
    summary: string;
    terminal: boolean;
    effects: Array<{ kind: string; [k: string]: unknown }>;
}

export interface SpawnFact { npc: number; name: string | null; romName: string | null; x: number | null; y: number | null }

export interface Decoder {
    decodeInstruction(rom: Uint8Array, addr: number, stack: unknown): Instruction | null;
    OperandStack: new () => unknown;
    snesToRom(addr: number): number;
    read16(rom: Uint8Array, addr: number): number;
    read24(rom: Uint8Array, addr: number): number;
    scriptValueToSnes(v: number): number;
    globalScriptName(id: number): string;
    absScriptName(romAddr: number, fallback?: string): string;
    ramBitToStr(addr: number, bit: number): string;
    lootRewardName(item: number): string | null;
    mapName(id: number): string;
    extractSpawns(ins: Instruction[]): SpawnFact[];
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
            this.cache.set(addr, ok ? this.dec.decodeInstruction(this.rom, addr, new this.dec.OperandStack()) : null);
        }
        return this.cache.get(addr)!;
    }

    u8(addr: number): number { return this.rom[this.toFile(addr)]; }
    u16(addr: number): number { return this.u8(addr) | (this.u8(addr + 1) << 8); }

    /**
     * Where `CALL <id>` (opcode 0xa3) goes. Read from its handler at
     * $8C:D3A0: index = id*3 + word[$928008] + word[$928000], then a packed
     * pointer at $928000 + index. The `$928008` term is easy to miss — without
     * it the id lands in the sniff-spot scripts.
     */
    globalScript(id: number): number {
        const index = id * 3 + this.dec.read16(this.rom, SCRIPT_BANK + 8) + this.dec.read16(this.rom, SCRIPT_BANK);
        return this.dec.scriptValueToSnes(this.dec.read24(this.rom, SCRIPT_BANK + index));
    }

    /** A trigger's script id is a byte offset into the pointer table at word[$928000]. */
    triggerScript(id: number): number {
        return this.dec.scriptValueToSnes(this.dec.read24(this.rom, SCRIPT_BANK + this.dec.read16(this.rom, SCRIPT_BANK) + id));
    }
}
