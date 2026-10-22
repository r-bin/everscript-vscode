// Ownership: small preview images for the Sprites tab — a character's resting pose per
// facing, and one sprite shown in every palette the game's characters use. Pure.

import { animationScript, characterPalette, paletteAt, paletteAddresses, FACING_SOUTH } from '../maps/character-record';
import { runAnimation } from '../maps/animation-vm';
import { facingScript } from '../maps/animation-table';
import { readSpriteInfo, composeSprite, decodeSpriteBlock } from '../maps/sprites';
import { encodePng } from '../maps/png';
import { composeAligned } from './frame-compose';
import { resolveCharacterSprite } from '../maps/character-animation';
import type { readCharacter } from './character-model';

type Rom = Uint8Array;
type Character = ReturnType<typeof readCharacter>;
/** A thumbnail request: a raw sprite, an animation record's resting pose, or one sprite chunk's tile. */
interface ThumbItem {
    sprite?: number; record?: number; facing?: number; character?: number; paletteAddr?: number;
    block?: number; large?: boolean; flipX?: boolean; flipY?: boolean; pal?: boolean | number;
}

/** South (8, the front view) and east (4) — the direction tables move 8 down the screen. */
const THUMB_FACINGS: Record<'s' | 'e', number> = { s: 8, e: 4 };

/**
 * The idle's resting pose: the last frame of its cycle that draws something (what the
 * character settles back into before the loop), else a segmented body's head.
 */
function restingSprite(rom: Rom, id: number, facing: number): number {
    const script = animationScript(rom, id, facing, 0x32);
    if (!script) return 0;
    const run = runAnimation(rom, script, facing);
    for (let i = run.frames.length - 1; i >= 0; i--) {
        const f = run.frames[i];
        if (f.sprite) return f.sprite;
        if (f.segments && f.segments.sprites.length) return f.segments.sprites[0];
    }
    return 0;
}

/** The palette a character is shown in: the Boy's first weapon, the Dog's first form, else its own. */
function displayPalette(rom: Rom, c: Character) {
    if ((c.id === 0 || c.id === 1) && c.weapons && c.weapons[0] && c.weapons[0].paletteAddr) return paletteAt(rom, c.weapons[0].paletteAddr);
    return characterPalette(rom, c.id);
}

/** A character's second palette (+0x0B: Harry, Vigor), or null. */
function secondPalette(rom: Rom, c: Character | null) {
    return c && c.stats && c.stats.palette2 ? paletteAt(rom, c.stats.palette2) : null;
}

/** `{ s, e }` data URIs (or null) for one character's list entry. */
function characterThumbs(rom: Rom, c: Character) {
    if (c.noVisuals) return null;
    const colours = displayPalette(rom, c);
    const colours2 = secondPalette(rom, c);
    const out: Record<string, string | null> = {};
    for (const [key, facing] of Object.entries(THUMB_FACINGS)) {
        const sprite = restingSprite(rom, c.id, facing);
        out[key] = sprite ? composeAligned(rom, [{ sprite }], colours, colours2).images[0] : null;
    }
    return out.s || out.e ? out : null;
}

const hex4 = (v: number): string => '$' + hexLower(v, 4);
import { busU16 as read16 } from '../../../platform';
import { hexLower } from '../../../platform';

/**
 * The palettes the Sprites tab palette panel shows: all unique palettes in the ROM,
 * with character owners when known.
 */
function listPalettes(characters: Character[], rom?: Rom) {
    const allPals = rom ? paletteAddresses(rom) : [];
    const byAddr = new Map<number, { owners: string[]; index: number }>();
    const add = (addr: number, who: string) => {
        if (!addr) return;
        const a = addr & 0xffff;
        if (!byAddr.has(a)) {
            const idx = allPals.indexOf(a);
            byAddr.set(a, { owners: [], index: idx >= 0 ? idx : byAddr.size });
        }
        const entry = byAddr.get(a)!;
        if (who && !entry.owners.includes(who)) entry.owners.push(who);
    };
    for (const c of characters) {
        add(c.stats.palette, c.name);
        add(c.stats.palette2, c.name + ' (2nd)');
        for (const w of c.weapons || []) add(w.paletteAddr, (c.id === 1 ? 'Dog · ' : 'Boy · ') + w.name);
    }
    for (let i = 0; i < allPals.length; i++) {
        const a = allPals[i];
        if (!byAddr.has(a)) {
            byAddr.set(a, { owners: [], index: i });
        } else {
            byAddr.get(a)!.index = i;
        }
    }
    return [...byAddr.entries()].sort((a, b) => a[1].index - b[1].index).map(([addr, val]) => ({
        addr,
        addrHex: hex4(addr),
        index: val.index,
        owners: val.owners.length ? val.owners : ['#' + val.index],
    }));
}

/** One sprite coloured with each palette — composed once, recoloured per palette. */
function renderInPalettes(
    rom: Rom,
    sprite: number,
    palettes: { addr: number; addrHex: string; index?: number; owners: string[] }[],
    defaultAddrs?: Set<number>
) {
    if (!sprite) return [];
    const c = composeSprite(rom, readSpriteInfo(rom, sprite));
    if (!c.width || !c.height) return [];
    const allPals = paletteAddresses(rom);
    return palettes.map((p) => {
        const idx = p.index != null ? p.index : allPals.indexOf(p.addr & 0xffff);
        const colours = paletteAt(rom, p.addr);
        const data = new Uint8Array(c.width * c.height * 4);
        for (let i = 0; i < c.pixels.length; i++) {
            const v = c.pixels[i];
            if (v <= 0) continue;
            const [r, g, b] = colours[v];
            data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = 255;
        }
        const png = 'data:image/png;base64,' + encodePng({ width: c.width, height: c.height, data }).toString('base64');
        return {
            addr: p.addr,
            addrHex: p.addrHex,
            index: idx >= 0 ? idx : 0,
            owners: p.owners,
            png,
            isDefault: defaultAddrs ? defaultAddrs.has(p.addr & 0xffff) : false,
        };
    });
}

/** Roughly how much a sprite covers: its chunks, 16×16 ones counting four times. */
function spriteArea(rom: Rom, sprite: number): number {
    try {
        return readSpriteInfo(rom, sprite).chunks.reduce((n, ch) => n + (ch.large ? 4 : 1), 0);
    } catch (e) { return 0; }
}

/**
 * The resting sprite of whatever a record plays at a facing: the last drawn frame (else a
 * head segment), unless that is a fading wisp — under half the fullest frame, as when a
 * spell effect dissipates — then the fullest frame.
 */
function recordRestingSprite(rom: Rom, record: number, facing: number): number {
    const script = facingScript(rom, record, facing);
    if (!script) return 0;
    const run = runAnimation(rom, script, facing);
    let last = 0;
    for (let i = run.frames.length - 1; i >= 0 && !last; i--) {
        const f = run.frames[i];
        if (f.sprite) last = f.sprite;
        else if (f.segments && f.segments.sprites.length) return f.segments.sprites[0];
    }
    if (!last) return 0;
    let best = last;
    let bestArea = spriteArea(rom, last);
    const lastArea = bestArea;
    for (const f of run.frames) {
        if (!f.sprite) continue;
        const a = spriteArea(rom, f.sprite);
        if (a > bestArea) { best = f.sprite; bestArea = a; }
    }
    return lastArea * 2 < bestArea ? best : last;
}

/**
 * One list thumbnail, rendered on demand: `{ sprite }` a raw sprite, or `{ record, facing }`
 * an animation's resting pose; coloured by `paletteAddr`, else `character`'s own palette.
 * Returns a data URI, or null when there is nothing to draw.
 */
function thumbFor(rom: Rom, item: ThumbItem): string | null {
    if (Number.isInteger(item.block)) return blockThumb(rom, item);
    let sprite = item.sprite || (item.record ? recordRestingSprite(rom, item.record, item.facing ?? FACING_SOUTH) : 0);
    // An animation that sets no sprite (the shared knock-back) keeps the character's standing one.
    if (!sprite && item.record && item.character !== undefined) sprite = resolveCharacterSprite(rom, item.character, item.facing ?? FACING_SOUTH) || 0;
    if (!sprite) return null;
    const colours = item.paletteAddr ? paletteAt(rom, item.paletteAddr) : characterPalette(rom, item.character || 0);
    const pal2 = item.character !== undefined ? read16(rom, 0x8eb678 + item.character * 74 + 0x0b) : 0;
    const c = composeAligned(rom, [{ sprite }], colours, pal2 ? paletteAt(rom, pal2) : null);
    return c.width > 1 || c.height > 1 ? c.images[0] : null;
}

/**
 * One sprite chunk's tile: block `item.block` from the 8×8 or 16×16 pool, flipped like the
 * chunk, coloured with the character's own palette or — when its OAM palette bits are 1 —
 * its second one.
 */
function blockThumb(rom: Rom, item: ThumbItem): string {
    const b = decodeSpriteBlock(rom, item.block!, !!item.large);
    const own = item.paletteAddr ? paletteAt(rom, item.paletteAddr) : characterPalette(rom, item.character || 0);
    const pal2 = item.pal && item.character !== undefined ? read16(rom, 0x8eb678 + item.character * 74 + 0x0b) : 0;
    const colours = pal2 ? paletteAt(rom, pal2) : own;
    const data = new Uint8Array(b.size * b.size * 4);
    for (let y = 0; y < b.size; y++) {
        for (let x = 0; x < b.size; x++) {
            const v = b.pixels[(item.flipY ? b.size - 1 - y : y) * b.size + (item.flipX ? b.size - 1 - x : x)];
            if (!v) continue;
            const o = (y * b.size + x) * 4;
            const [r, g, bl] = colours[v];
            data[o] = r; data[o + 1] = g; data[o + 2] = bl; data[o + 3] = 255;
        }
    }
    return 'data:image/png;base64,' + encodePng({ width: b.size, height: b.size, data }).toString('base64');
}

export { characterThumbs, listPalettes, renderInPalettes, thumbFor, THUMB_FACINGS };
