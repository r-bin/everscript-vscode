'use strict';
// Ownership: the fixed-place content of a Secret of Evermore ROM — header,
// rooms, palettes, strings, scripts, characters, animation records, icons,
// dog forms, alchemy tables — each claimed with its measured size. Pure.
// Sources: wiki/rom/Rom-Map.md §2 (the everscript wiki's ROM map).

const { decodeRoom, parseBlobLayout, objectAreaEnd, MAP_LIST_ADDR, MAX_ROOMS } = require('../../maps');
const { hex } = require('./util');

const WORLD = { Prehistoria: '🦖 Prehistoria', Antiqua: '🏛️ Antiqua', Gothica: '🏰 Gothica', Omnitopia: '🚀 Omnitopia', 'Intro / Misc': '🏡 Intro / misc' };
const worldOf = area => WORLD[area] || (area ? '❓ ' + area : '');
const SUB = { 0: 'raw', 3: 'lzss', 7: 'markov' };

/** @param base header start: $FFC0 (HiROM) or $7FC0 (LoROM) */
function headerRegions(R, base = 0xFFC0) {
    R(base - 0x10, base, '🏷️', 'Extended header', 'maker code, game code, expansion sizes');
    R(base, base + 0x20, '🏷️', 'Cartridge header', 'title, map mode, cartridge type, ROM and SRAM size');
    R(base + 0x20, base + 0x40, '🏷️', 'Interrupt vectors', 'native $FFE4..$FFEF, emulation $FFF4..$FFFF');
}

/**
 * Rooms and everything keyed by room. Returns graphic id → worlds that load it.
 * @param rooms Map<room id, {name, area}> (the Rooms tab's catalogue)
 */
function roomRegions(rom, R, rooms) {
    const worldsOfGraphic = new Map();
    let maxFamily = 0;
    for (let id = 0; id < MAX_ROOMS; id++) {
        const info = rooms.get(id) || {};
        const world = worldOf(info.area);
        let d;
        try { d = decodeRoom(rom, id); } catch (_) { continue; }
        const start = d.romPointerFile, end = objectAreaEnd(rom, parseBlobLayout(rom, start));
        const h = d.header, pb = d.payloadBlocks;
        R(start, end, '🗺️', `ROOM_${hex(id, 2)} · ${info.name || 'Room 0x' + hex(id, 2)}`,
            `${h.widthTiles}×${h.heightTiles} cells, ${d.metatileCount} metatiles, ${d.objects.length} objects, B1 ${SUB[pb.block1.subFlag] || pb.block1.subFlag}`,
            world, 1, { room: id });
        for (const f of d.tileFamilies) maxFamily = Math.max(maxFamily, f);
        for (const g of d.tilePalette) {
            if (!worldsOfGraphic.has(g)) worldsOfGraphic.set(g, new Set());
            if (world) worldsOfGraphic.get(g).add(world);
        }
    }
    R(MAP_LIST_ADDR, MAP_LIST_ADDR + MAX_ROOMS * 4, '📋', 'Room pointer table', `${MAX_ROOMS} × [ptr:24, pad:8], room id × 4`, '', 2);
    R(MAP_LIST_ADDR + MAX_ROOMS * 4, MAP_LIST_ADDR + MAX_ROOMS * 4 + 4, '📋', 'Slot `0x7F` (not a room)', 'pad `$CC`, points at `$C9:CF89`, which does not parse as a blob', '', 2);
    R(0x1CC322, 0x1CC322 + 32 * (maxFamily + 1), '🎨', 'Background palettes (tile families)', `${maxFamily + 1} × 32 bytes, \`$9C:C322 + 32·family\`; up to 7 loaded per room by \`$90:D020\``);
    return worldsOfGraphic;
}

function textRegions(rom, R) {
    const KEYS = 0x11D000, COUNT = 3002;
    const r24 = o => rom[o] | rom[o + 1] << 8 | rom[o + 2] << 16;
    R(KEYS, KEYS + COUNT * 3, '📋', 'String key table', `${COUNT} × 3 bytes: \`(bank<<15)|(addr&$7FFF)\` from \`$C0:0000\`, bit 23 = compressed`);
    const byBank = new Map();
    for (let i = 0; i < COUNT; i++) {
        const v = r24(KEYS + i * 3), p = v & 0x7FFFFF;
        const k = { off: ((p >> 15) << 16) | (p & 0x7FFF), comp: !!(v & 0x800000) };
        if (!byBank.has(k.off >> 16)) byBank.set(k.off >> 16, []);
        byBank.get(k.off >> 16).push(k);
    }
    for (const ks of byBank.values()) {
        ks.sort((a, b) => a.off - b.off);
        const last = ks[ks.length - 1];
        const end = last.comp ? last.off + 1 : rom.indexOf(0, last.off) + 1;
        const n = new Set(ks.map(k => k.off)).size;
        R(ks[0].off, end, '💬', 'Strings', `${n} strings (${ks.filter(k => k.comp).length} keys compressed)${last.comp ? '; last string compressed, its end not measured' : ''}`);
    }

    const BANK = 0x128000, g = BANK + (rom[BANK] | rom[BANK + 1] << 8);
    R(BANK, BANK + 2, '📜', 'Script bank header', 'word: offset of the global script table');
    R(BANK + 0x1B, g, '📋', 'Room enter-script table', '5 bytes per room, packed pointer first; read by `$8C:CE99`', '', 2);
    let n = 0, first = Infinity;
    for (; g + n * 3 < first; n++) {
        const v = r24(g + n * 3), o = (0x928000 + (v & 0x7FFF) + ((v & 0xFF8000) << 1)) & 0x3FFFFF;
        if (o > g && o < first) first = o;
    }
    R(g, g + n * 3, '📋', 'Global script pointer table', `${n} × 3-byte packed pointers; trigger \`script\` fields are byte offsets into it`);
    // Not walked: the rest of the upper halves $92..$9B, below every measured claim.
    for (let b = 0x12; b <= 0x1B; b++) {
        R(b === 0x12 ? g + n * 3 : (b << 16) | 0x8000, (b + 1) << 16, '📜', 'Script bytecode', 'event scripts (enter, triggers, cutscenes); not walked, fills what is left', '', 0);
    }
}

function entityRegions(rom, R) {
    R(0x0EB678, 0x0EB678 + 141 * 74, '👾', 'Character table', '141 × 74-byte records: name, AI, flags, palette, radius, stats, animations');
    R(0x043C92, 0x043E3A, '📋', 'Global animation ids', '212 words → record offsets in `$C4`');
    R(0x043E3A, 0x04599A, '🎞️', 'Animation records', '4 bytes `[script:16][bank:8][flags:8]`; heads of 1, 4 or 8 facings');
    R(0x0438E6, 0x0438E6 + 15 * 36, '⚔️', 'Boy weapon table', '15 × 36 bytes: attack, walk, run, knockback per weapon');
    R(0x10D9A6, 0x10D9A6 + 21 * 24, '👾', 'Projectile records', '21 × 24 bytes; id = address in `$90`; thrown by animation opcode `0x4C`');
    R(0x108000, 0x1080CE, '📋', 'Animation VM dispatch', '103 × 2-byte handlers, `(cmd & $7F)·2`');
    const icons = [];
    for (let i = 0; i <= 0x142; i += 2) icons.push(rom[0x0E8000 + i] | rom[0x0E8001 + i] << 8);
    R(0x0E8000, 0x0E8000 + 0x144, '🎒', 'Ring-menu icon table', '162 words, one per `RING_MENU_ICON` id (step 2)');
    R(0x0E0000 | Math.min(...icons), (0x0E0000 | Math.max(...icons)) + 8, '🎒', 'Ring-menu icon entries', '8 bytes: `+2` animation record, `+4` palette, `+6` index in category');
    R(0x0F945F, 0x0F945F + 12, '📋', 'Dog form pointers', '6 words into bank `$CF`');
    for (let i = 0; i < 6; i++) {
        const at = 0x0F0000 | (rom[0x0F945F + i * 2] | rom[0x0F9460 + i * 2] << 8);
        R(at, at + 40, '🐶', `Dog form ${i}`, '10-byte header (palette at `+6`) + 15 animation records');
    }
    for (const [a, n, name, note] of [
        [0x045B9C, 9, 'Formula XP per cast', '`[10,5,4,3,2,2,1,1,1]` Lv0..8'],
        [0x045BA5, 10, 'Level multiplier', '`[2,4,7,11,15,20,26,32,39,46]` Lv0..9'],
        [0x045BF5, 70, '`ALCHEMY_TARGET`', 'target cursor flags, 35 words'],
        [0x045C3B, 70, '`ALCHEMY_LEARNED_ADDR`', 'persistence byte `$2258..$225C`, 35 words'],
        [0x045C81, 35, '`ALCHEMY_LEARNED_MASK`', 'bit in that byte'],
        [0x045DDF, 70, '`ALCHEMY_ANIM_MAP`', 'animation id per formula'],
        [0x045E6B, 70, '`ALCHEMY_POWER`', 'base power: 0 utility, 15 Defend, up to 112 Nitro'],
        [0x045F17, 32, '`CALL_BEAD_POWER`', '16 Call Bead spells'],
        [0x04601F, 140, '`ALCHEMY_COST_DATA`', '35 × `[ing1, ing2, qty1, qty2]`'],
    ]) R(a, a + n, '⚗️', name, note);
}

module.exports = { headerRegions, roomRegions, textRegions, entityRegions };
