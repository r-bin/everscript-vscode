'use strict';
// Ownership: the Scripts tab's alchemy view — each of the 35 formulas, the
// block in bank $91 its cast runs from, and the animation records that block
// names. Pure apart from the ROM buffer it is handed.
//
// Measured from the ROM (knowledge: src/games/evermore/localizations/knowledge/rom/c45ddf.md):
//   ALCHEMY_ANIM_MAP ($C4:5DDF, 35 words) holds an even offset per formula
//   into the word table at $91:80A6, whose entries are $91 addresses: the
//   formula's block (the value the everscript enums call ALCHEMY_TYPE_*).
//   Acid Rain and Laser share one. The block is data, not 65816 code; most
//   blocks hold one or more animation record ids ($C4:xxxx, the table at
//   $C43E3A) at small even offsets. Which field of the block is which is not
//   decoded; the records are found by scanning its words, so a word that
//   happens to equal a record id would be listed too.

const { animationGroups } = require('../../../../../dist/games/evermore/maps/animation-vm');
const { disassembleScript } = require('../../../../../dist/games/evermore/maps/animation-opcodes');
const indexJson = require('../../language/data/index.json');

const ANIM_MAP = 0x045DDF;
const BLOCK_TABLE = 0x1180A6;    // $91:80A6
const BANK_91 = 0x110000;
const FORMULAS = 35;
const MAX_BLOCK = 0x80;
const EFFECT_DONE = 0x5D;

const w16 = (rom, o) => rom[o] | rom[o + 1] << 8;
const hex = (v, d) => v.toString(16).toUpperCase().padStart(d, '0');
const title = (s) => s.toLowerCase().split('_').map((p) => p[0].toUpperCase() + p.slice(1)).join(' ');

let _cache = null;   // { rom, model }

/** Records whose script signals `effect_done` (animation command 0x5D), which only bank $91 reads. */
function effectRecords(rom, groups) {
    const out = new Set();
    for (const g of groups) {
        if (disassembleScript(rom, g.scripts[0]).some((l) => l.known && (l.bytes[0] & 0x7f) === EFFECT_DONE)) out.add(g.record);
    }
    return out;
}

/**
 * { formulas: [{ index, name, offset, block, blockHex, length, bytes, records: [{ record, recHex, at, effect }] }],
 *   effects: [record] }
 */
function alchemyModel(rom) {
    if (_cache && _cache.rom === rom) return _cache.model;
    const names = (indexJson.enums.ALCHEMY_INDEX || []).map((e) => title(e.name));
    const groups = animationGroups(rom);
    const records = new Set(groups.map((g) => g.record));
    const effects = effectRecords(rom, groups);
    const offsets = [];
    for (let i = 0; i < FORMULAS; i++) offsets.push(w16(rom, ANIM_MAP + 2 * i));
    const blocks = offsets.map((o) => w16(rom, BLOCK_TABLE + o));
    const starts = [...new Set(blocks)].sort((a, b) => a - b);
    const formulas = offsets.map((offset, index) => {
        const block = blocks[index];
        const next = starts.find((s) => s > block);
        const length = Math.min(next ? next - block : MAX_BLOCK, MAX_BLOCK);
        const base = BANK_91 + block;
        const bytes = Array.from(rom.subarray(base, base + length));
        const found = [];
        for (let at = 0; at + 1 < length; at += 2) {
            const v = bytes[at] | bytes[at + 1] << 8;
            if (records.has(v)) found.push({ record: v, recHex: '$' + hex(v, 4), at, effect: effects.has(v) });
        }
        return { index, name: names[index] || 'Formula ' + index, offset, block, blockHex: '$91:' + hex(block, 4), length, bytes, records: found };
    });
    const model = { formulas, effects: [...effects].sort((a, b) => a - b) };
    _cache = { rom, model };
    return model;
}

module.exports = { alchemyModel };
