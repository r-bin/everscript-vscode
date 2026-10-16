// Ownership: the ring menu's item icons — which sprite and palette an icon id
// names, and which icon a loot reward or an alchemy formula shows. Pure.
//
// An icon is an ordinary sprite run by an ordinary animation script, so the
// pixels come from ./sprites through ./character-animation's walker. What is
// new here is the table that names them:
//
//   $CE8000 + id        a word: the icon's entry, in bank $CE
//   entry +2            an animation record — $C40000 + record, as for characters
//   entry +4            a palette address in the palette bank
//   entry +6            the item's index within its category
//
// docs/item-icons.md has how it was found and what was checked.

import { read16At, recordScript, paletteAt } from './character-record';
import { walkAnimationScript } from './character-animation';
import { renderSpriteAt } from './characters';

/**
 * One word per icon id, 162 of them. The ids are everscript's
 * `RING_MENU_ICON` (08_ring_menus.evs) and step by 2, so `TABLE + id` is the
 * word for `id` — no scaling.
 */
export const ICON_TABLE = 0xce8000;
export const ICON_ID_LAST = 0x0142;

const ENTRY_BANK = 0xce0000;
const ENTRY_RECORD = 2;
const ENTRY_PALETTE = 4;
const ENTRY_INDEX = 6;

export interface IconEntry {
    /** SNES address of the 8-byte entry. */
    entry: number;
    /** Offset of its animation record in `$C40000`. */
    record: number;
    /** Palette address, in the palette bank. */
    palette: number;
    /** The item's index within its category — what a reward id carries. */
    index: number;
}

export function iconEntry(rom: Uint8Array, id: number): IconEntry {
    const entry = ENTRY_BANK | read16At(rom, ICON_TABLE + id);
    return {
        entry,
        record: read16At(rom, entry + ENTRY_RECORD),
        palette: read16At(rom, entry + ENTRY_PALETTE),
        index: read16At(rom, entry + ENTRY_INDEX),
    };
}

/**
 * An icon as RGBA — its first frame, in its own palette.
 *
 * The 35 alchemy icons of the first set animate between two frames and have a
 * greyed variant (`0x56` swaps the palette when a formula cannot be cast); the
 * first frame, in colour, is how the menu shows one that can.
 */
export function renderItemIcon(
    rom: Uint8Array,
    id: number,
): { width: number; height: number; data: Uint8Array } | null {
    const e = iconEntry(rom, id);
    const walk = walkAnimationScript(rom, recordScript(rom, e.record));
    if (!walk.frames.length) return null;
    return renderSpriteAt(rom, walk.frames[0].sprite, paletteAt(rom, e.palette));
}

/**
 * Which ids hold which category, and how the entry's index relates to the
 * number the game uses elsewhere. The ranges are the ring menu's own layout
 * (docs/item-icons.md); within a range the entries are *not* in index order,
 * so the index is matched, never counted.
 */
interface Category { first: number; last: number; scale: number }

const INGREDIENTS: Category = { first: 0x0118, last: 0x0142, scale: 1 };
const CONSUMABLES: Category = { first: 0x008e, last: 0x009c, scale: 1 };
const ARMOUR: Category = { first: 0x00a0, last: 0x00ee, scale: 2 };
/** The 35 formulas the game ships; `0x00f8`–`0x0116` are 16 more it never grants. */
const ALCHEMY: Category = { first: 0x0048, last: 0x008c, scale: 2 };

/** Reward id high byte → category, as `LOOT_REWARD` numbers them. */
const REWARD_CATEGORIES: Record<number, Category> = {
    0x02: INGREDIENTS,
    0x04: ARMOUR,
    0x08: CONSUMABLES,
};

function findInCategory(rom: Uint8Array, cat: Category, index: number): number | null {
    for (let id = cat.first; id <= cat.last; id += 2) {
        if (iconEntry(rom, id).index === index * cat.scale) return id;
    }
    return null;
}

/**
 * The icon for a loot reward id (`0x020F` CRYSTAL, `0x0800` PETAL,
 * `0x0401` CHEST_1_1), or null for what the ring menu has no icon for —
 * money, trade goods, charms.
 */
export function lootIconId(rom: Uint8Array, reward: number): number | null {
    const cat = REWARD_CATEGORIES[reward >> 8];
    return cat ? findInCategory(rom, cat, reward & 0xff) : null;
}

/**
 * The icon for alchemy formula `n` — the bit that formula's "known" flag
 * occupies from `$2258`, alphabetical from Acid Rain (0) to Super Heal (34).
 */
export function alchemyIconId(rom: Uint8Array, formula: number): number | null {
    return findInCategory(rom, ALCHEMY, formula);
}

/** How many formulas the alchemy range holds. */
export const ALCHEMY_FORMULAS = (ALCHEMY.last - ALCHEMY.first) / 2 + 1;
