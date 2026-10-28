// Ownership: the pictures the HUD and the money windows draw — the Boy's portrait beside his HP,
// and the four currencies' icons — as RGBA, from the user's ROM. Pure. (A Dog form's portrait is
// in its form entry: sprites/dog-form-icon.ts.)
//
// Each is a one-chunk sprite record (a 16x16 block, maps/sprites.ts), named by the game's own code
// or tables, never by a number of ours:
//
//   Boy portrait   $8F:810E (the HUD setup) stores the 24-bit sprite `lda #$37AC : sta $4EF7 :
//                  lda #$CC37 : sta $4EF8`: $CC37AC, block $7AB. Its colours, $D0AD6B, are the ones
//                  the HUD draws it in (matched on the screen of the attract demo; who loads them
//                  is not found yet).
//   currencies     the animation script at $C8:00BE picks one of four sprites by the currency index
//                  (0 talons, 3 jewels, 6 gold coins, 9 credits: knowledge rom/8f8689): $CC3C56,
//                  $CC3C5D, $CC3C64, $CC3C6B (blocks $7CB-$7CE: a talon, a jewel, a coin, a card).
//                  Drawn in the Boy portrait's colours, the HUD's (likely: not seen on screen).
//
// docs/item-icons.md has the evidence.

import { busU8, busU16 } from '../../../platform/snes/hirom';
import { paletteAt } from './character-record';
import { renderSpriteAt } from './characters';

type Rgba = { width: number; height: number; data: Uint8Array };

/** The HUD setup's operands: the Boy portrait's address word and bank ($8F:810E: `lda #$37AC`, `lda #$CC37`). */
const BOY_PORTRAIT_LOW = 0x8f810f;
const BOY_PORTRAIT_BANK = 0x8f8116;
const HUD_PALETTE = 0xad6b;
/** The 24-bit sprite list the currency animation script picks from ($C8:00BE: opcode, then 4 × 3 bytes). */
const CURRENCY_SPRITES = 0xc800c1;
export const CURRENCIES = ['talons', 'jewels', 'gold coins', 'credits'];

const u24 = (rom: Uint8Array, at: number): number => busU16(rom, at) | (busU8(rom, at + 2) << 16);

/** The Boy's HUD portrait. */
export function boyPortrait(rom: Uint8Array): Rgba | null {
    const sprite = busU16(rom, BOY_PORTRAIT_LOW) | (busU8(rom, BOY_PORTRAIT_BANK) << 16);
    return renderSpriteAt(rom, sprite, paletteAt(rom, HUD_PALETTE));
}

/** Currency `n` (0 talons, 1 jewels, 2 gold coins, 3 credits: the game's index / 3). */
export function currencyIcon(rom: Uint8Array, n: number): Rgba | null {
    if (n < 0 || n >= CURRENCIES.length) return null;
    return renderSpriteAt(rom, u24(rom, CURRENCY_SPRITES + 3 * n), paletteAt(rom, HUD_PALETTE));
}
