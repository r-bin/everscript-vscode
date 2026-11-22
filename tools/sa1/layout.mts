// Where everything sits in the 8 MB SA-1 image, and how bus addresses map to file offsets (docs/sa1/port.md §2).
//
// The SA-1 shows ROM to the S-CPU in two ways (MesenCE Sa1::UpdatePrgRomMappings):
//   $C0-$FF:0000-FFFF   linear 64 KB banks, like HiROM; $C0/$D0/$E0/$F0 each show the 1 MB block named by the low
//                       3 bits of CXB/DXB/EXB/FXB ($2220-$2223)
//   $00-$3F, $80-$BF    LoROM-style: :8000-FFFF of each bank is 32 KB of a block. With bit 7 of the register clear,
//     :8000-FFFF        $00-$1F/$20-$3F/$80-$9F/$A0-$BF stay on blocks 0/1/2/3 whatever the low bits say
// Evermore runs code from $80-$AF:8000+ and reads data through $C0-$EF, so the image holds both arrangements:
//
//   block  file       bus view              holds
//   0      0x000000   $00-$1F:8000+         bank $00 only: header, vectors, vector entries (header.mts)
//   1      0x100000   $20-$3F:8000+         unused (fill; the derived-ROM marker at its end)
//   2      0x200000   $80-$9F:8000+         HiROM $80-$9F:8000-FFFF, 32 KB per bank in bank order
//   3      0x300000   $A0-$BF:8000+         HiROM $A0-$BF:8000-FFFF; the second half is the HiROM 4th MB and holds
//                                           the boot block at $B8:8000 (boot.mts)
//   4-7    0x400000   $C0-$FF               the HiROM 4 MB, linear, once boot.mts has set CXB-FXB = 4-7
//
// To move something: change BLOCK / BANK_VALUES here; everything else derives from them. Keep bit 7 of the bank
// values clear, or the LoROM views follow the registers too and both views must be the same block.
export const MB = 0x100000;
export const IMAGE_SIZE = 8 * MB;
export const BLOCK = { bankZero: 0, unused: 1, loRom80: 2, loRomA0: 3, linear: 4 } as const;
export const LINEAR = BLOCK.linear * MB;

/** CXB, DXB, EXB, FXB and the blocks they get: $C0-$FF = blocks 4-7. */
export const BANK_REGISTERS = [0x2220, 0x2221, 0x2222, 0x2223];
export const BANK_VALUES = [BLOCK.linear, BLOCK.linear + 1, BLOCK.linear + 2, BLOCK.linear + 3];
/** S-CPU BW-RAM write enable. At reset all of BW-RAM is write-protected (BWPA $FF), so saves need it. */
export const SBWE = 0x2226;

/** File offset the S-CPU reads at a LoROM-view address ($00-$3F or $80-$BF, :8000-FFFF). */
export function loRomFile(bus: number): number {
    const bank = bus >> 16, addr = bus & 0xFFFF;
    if ((bank & 0x40) || addr < 0x8000) throw new Error(`$${bus.toString(16)} is not in a LoROM view`);
    const block = ((bank & 0x80) ? 2 : 0) + ((bank & 0x20) ? 1 : 0);
    return block * MB + (bank & 0x1F) * 0x8000 + (addr - 0x8000);
}

/** File offset the S-CPU reads at any ROM address once the bank registers are set. */
export function busToFile(bus: number): number {
    const bank = bus >> 16;
    return bank >= 0xC0 ? LINEAR + ((bank - 0xC0) << 16) + (bus & 0xFFFF) : loRomFile(bus);
}

/**
 * Fills blocks 2-3 and 4-7 from `hirom(offset)`, the byte the HiROM cartridge answered at file offset 0 - 4 MB.
 * LoROM bank n:8000+o holds HiROM file n * 0x10000 + 0x8000 + o, so both views read what HiROM read.
 */
export function writeViews(image: Uint8Array, hirom: (offset: number) => number): void {
    for (let off = 0; off < 4 * MB; off++) image[LINEAR + off] = hirom(off);
    for (let bank = 0; bank < 0x40; bank++) {
        const to = loRomFile((0x80 + bank) << 16 | 0x8000);
        for (let o = 0; o < 0x8000; o++) image[to + o] = hirom(bank * 0x10000 + 0x8000 + o);
    }
}
