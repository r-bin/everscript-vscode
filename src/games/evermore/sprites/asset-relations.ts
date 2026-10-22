// Ownership: relational mapping connecting Characters, Animations, Sprites and Palettes. Pure.
//
// Every character has a name and uses animations; animations consist of sprites; sprites
// are drawn with palettes. This joins them together so any viewer or VFS page can look up
// "Related" assets (e.g. all sprites and palettes used by BOY).

import { hexLower as hex } from '../../../platform/hex';
import { readAllCharacters } from './character-model';
import { buildAnimationCatalog } from './animation-catalog';
import { spriteAddresses, scriptSprites, readSpriteInfo } from '../maps/sprites';
import { paletteAddresses, paletteAt } from '../maps/character-record';
import { setDefaultIndexResolvers } from '../maps/animation-opcodes';

// Register global index resolvers so all disassemblers format sprite(#<idx>) and palette(#<idx>)
setDefaultIndexResolvers({
    spriteIndex: (rom, addr) => spriteAddresses(rom).indexOf(addr),
    paletteIndex: (rom, addr) => paletteAddresses(rom).indexOf(addr),
});

export interface RelatedCharacter {
    id: number;
    name: string;
    role?: string;
}

export interface RelatedAnimation {
    record: number;
    label: string;
    scriptHex: string;
    uri?: string;
}

export interface RelatedPalette {
    address: number;
    addrHex: string;
    index: number;
    colors?: string[];
}

export interface SpriteRelation {
    address: number;
    addrHex: string;
    index: number;
    widthPx: number;
    heightPx: number;
    chunkCount: number;
    characters: RelatedCharacter[];
    animations: RelatedAnimation[];
    palettes: RelatedPalette[];
    tags: string[];
}

export interface PaletteRelation {
    address: number;
    addrHex: string;
    index: number;
    colors: string[];
    characters: RelatedCharacter[];
    animations: RelatedAnimation[];
    sprites: Array<{ address: number; addrHex: string; index: number }>;
    tags: string[];
}

export interface AssetRelations {
    sprites: Map<number, SpriteRelation>;
    palettes: Map<number, PaletteRelation>;
    getSpriteRelation(addr: number): SpriteRelation | null;
    getPaletteRelation(addr: number): PaletteRelation | null;
}

const colourHex = ([r, g, b]: [number, number, number]): string =>
    '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');

const relationsCache = new WeakMap<Uint8Array, AssetRelations>();

export function assetRelations(rom: Uint8Array): AssetRelations {
    const cached = relationsCache.get(rom);
    if (cached) return cached;

    const allSprites = spriteAddresses(rom);
    const allPalettes = paletteAddresses(rom);
    const characters = readAllCharacters(rom);
    const catalog = buildAnimationCatalog(rom, characters);

    const spritesMap = new Map<number, SpriteRelation>();
    const palettesMap = new Map<number, PaletteRelation>();

    // 1. Initialize Sprite relations
    for (let i = 0; i < allSprites.length; i++) {
        const addr = allSprites[i];
        let widthPx = 0, heightPx = 0, chunkCount = 0;
        try {
            const info = readSpriteInfo(rom, addr);
            chunkCount = info.chunks.length;
            let minX = 0, minY = 0, maxX = 1, maxY = 1;
            for (const c of info.chunks) {
                const sz = c.large ? 16 : 8;
                if (c.x < minX) minX = c.x;
                if (c.y < minY) minY = c.y;
                if (c.x + sz > maxX) maxX = c.x + sz;
                if (c.y + sz > maxY) maxY = c.y + sz;
            }
            widthPx = maxX - minX;
            heightPx = maxY - minY;
        } catch (_) {}

        spritesMap.set(addr, {
            address: addr,
            addrHex: '$' + hex(addr, 6),
            index: i,
            widthPx,
            heightPx,
            chunkCount,
            characters: [],
            animations: [],
            palettes: [],
            tags: [],
        });
    }

    // 2. Initialize Palette relations
    for (let i = 0; i < allPalettes.length; i++) {
        const addr = allPalettes[i];
        const colors = paletteAt(rom, addr).map(colourHex);
        palettesMap.set(addr, {
            address: addr,
            addrHex: '$' + hex(addr, 4),
            index: i,
            colors,
            characters: [],
            animations: [],
            sprites: [],
            tags: [],
        });
    }

    const spriteCharSets = new Map<number, Set<number>>();
    const spriteAnimSets = new Map<number, Set<number>>();
    const spritePalSets = new Map<number, Set<number>>();
    const spriteTagSets = new Map<number, Set<string>>();

    const palCharSets = new Map<number, Set<number>>();
    const palAnimSets = new Map<number, Set<number>>();
    const palSpriteSets = new Map<number, Set<number>>();
    const palTagSets = new Map<number, Set<string>>();

    // Helper: associate character with palette
    const linkCharPalette = (charId: number, palAddr: number, role: string) => {
        const pal = palettesMap.get(palAddr & 0xffff);
        if (!pal) return;
        const c = characters[charId];
        if (!c) return;
        const charSet = palCharSets.get(pal.address) || new Set<number>();
        if (!charSet.has(charId)) {
            charSet.add(charId);
            palCharSets.set(pal.address, charSet);
            pal.characters.push({ id: charId, name: c.name, role });
        }
        const tagSet = palTagSets.get(pal.address) || new Set<string>();
        const tagName = charId === 0 ? 'BOY' : charId === 1 ? 'DOG' : String(c.name || '').toUpperCase().replace(/[^A-Z0-9]/g, '_');
        if (tagName && !tagSet.has(tagName)) {
            tagSet.add(tagName);
            palTagSets.set(pal.address, tagSet);
            pal.tags.push(tagName);
        }
    };

    // 3. Connect Character palettes (primary, secondary, weapon/form)
    for (const c of characters) {
        if (c.stats.palette) linkCharPalette(c.id, c.stats.palette, 'primary palette (+0x09)');
        if (c.stats.palette2) linkCharPalette(c.id, c.stats.palette2, 'secondary palette (+0x0B)');
        for (const w of c.weapons || []) {
            if (w.paletteAddr) linkCharPalette(c.id, w.paletteAddr, (c.id === 1 ? 'Dog Form: ' : 'Weapon: ') + w.name);
        }
    }

    // 4. Connect Animations to Characters, Sprites, and Palettes
    for (const entry of catalog) {
        let animUri: string | undefined;
        for (const c of characters) {
            const a = c.anims.find((x) => x.animRec === entry.record);
            if (a) {
                const key = a.key || (a.offset ? a.offset.toString(16) : '');
                animUri = `soe://rom/assets/characters/${c.id}/animations/${key}/`;
                break;
            }
        }
        if (!animUri && entry.paletteCharacter != null) {
            animUri = `soe://rom/assets/characters/${entry.paletteCharacter}/animations/`;
        }

        const animInfo: RelatedAnimation = {
            record: entry.record,
            label: entry.label,
            scriptHex: entry.scriptHex,
            uri: animUri,
        };

        const palAddr = entry.paletteAddr & 0xffff;
        const pal = palettesMap.get(palAddr);
        if (pal) {
            const animSet = palAnimSets.get(pal.address) || new Set<number>();
            if (!animSet.has(entry.record)) {
                animSet.add(entry.record);
                palAnimSets.set(pal.address, animSet);
                pal.animations.push(animInfo);
            }
        }

        const scriptAddr = parseInt(entry.scriptHex.replace('$', ''), 16);
        if (!scriptAddr) continue;

        const sprites = scriptSprites(rom, scriptAddr);
        for (const sprAddr of sprites) {
            const spr = spritesMap.get(sprAddr);
            if (!spr) continue;

            // Connect sprite to animation
            const sprAnimSet = spriteAnimSets.get(sprAddr) || new Set<number>();
            if (!sprAnimSet.has(entry.record)) {
                sprAnimSet.add(entry.record);
                spriteAnimSets.set(sprAddr, sprAnimSet);
                spr.animations.push(animInfo);
            }

            // Connect sprite to palette
            if (pal) {
                const sprPalSet = spritePalSets.get(sprAddr) || new Set<number>();
                if (!sprPalSet.has(pal.address)) {
                    sprPalSet.add(pal.address);
                    spritePalSets.set(sprAddr, sprPalSet);
                    spr.palettes.push({ address: pal.address, addrHex: pal.addrHex, index: pal.index });
                }

                const palSprSet = palSpriteSets.get(pal.address) || new Set<number>();
                if (!palSprSet.has(sprAddr)) {
                    palSprSet.add(sprAddr);
                    palSpriteSets.set(pal.address, palSprSet);
                    pal.sprites.push({ address: sprAddr, addrHex: spr.addrHex, index: spr.index });
                }
            }

            // Connect sprite to character owners
            for (const owner of entry.owners) {
                let charId: number | null = null;
                if (owner.kind === 'character') charId = owner.id;
                else if (owner.kind === 'weapon') charId = 0;
                else if (owner.kind === 'id' && owner.paletteCharacter != null) charId = owner.paletteCharacter;

                if (charId != null && characters[charId]) {
                    const c = characters[charId];
                    const sprCharSet = spriteCharSets.get(sprAddr) || new Set<number>();
                    if (!sprCharSet.has(charId)) {
                        sprCharSet.add(charId);
                        spriteCharSets.set(sprAddr, sprCharSet);
                        spr.characters.push({ id: charId, name: c.name });
                    }

                    const tagName = charId === 0 ? 'BOY' : charId === 1 ? 'DOG' : String(c.name || '').toUpperCase().replace(/[^A-Z0-9]/g, '_');
                    const sprTagSet = spriteTagSets.get(sprAddr) || new Set<string>();
                    if (tagName && !sprTagSet.has(tagName)) {
                        sprTagSet.add(tagName);
                        spriteTagSets.set(sprAddr, sprTagSet);
                        spr.tags.push(tagName);
                    }
                }
            }
        }
    }

    const result: AssetRelations = {
        sprites: spritesMap,
        palettes: palettesMap,
        getSpriteRelation(addr: number) {
            return spritesMap.get(addr) || null;
        },
        getPaletteRelation(addr: number) {
            return palettesMap.get(addr & 0xffff) || null;
        },
    };

    relationsCache.set(rom, result);
    return result;
}

