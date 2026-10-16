// Ownership: reading Secret of Mana ROM bytes by SNES bus address.
//
// Secret of Mana is a 2 MB HiROM cartridge (no copier header). Banks $C0-$FF
// map the ROM file linearly, so bus $CC:E270 is file offset $0CE270. The game
// often stores a bank byte without the $C0 bits and ORs them in before use;
// masking with $3FFFFF covers both forms.

export type Rom = Uint8Array;

import { hiromFileOffset, busU8, busU16, busU24 } from '../../../platform/snes/hirom';

/** File offset of a HiROM bus address ($C0-$FF banks or their $00-$3F upper-half mirrors). */
export const offset = hiromFileOffset;
export const u8 = busU8;
export const u16 = busU16;
export const u24 = busU24;

/** Internal title at $C0:FFC0 (21 bytes), e.g. "Secret of MANA". */
export function romTitle(rom: Rom): string {
    let s = '';
    for (let i = 0; i < 21; i++) s += String.fromCharCode(rom[0xFFC0 + i] ?? 0x20);
    return s.trim();
}

/** True for a Secret of Mana ROM image (by its internal title). */
export function isManaRom(rom: Rom | null | undefined): boolean {
    return !!rom && rom.length >= 0x200000 && /^secret of mana$/i.test(romTitle(rom));
}
