'use strict';
// Ownership: building the ROM tab's model from ROM bytes (+ optional CDL and
// wiki names). Pure; the host caches the result.
//
// Only a Secret of Evermore image gets the content catalogue; any other ROM
// still gets its header, the gap layout and CDL coverage.

const { headerRegions, roomRegions, textRegions, entityRegions } = require('./model/catalog');
const { assetRegions, graphicSpans } = require('./model/assets');
const { audioRegions } = require('./model/audio');
const { annotateOverlaps, layoutHalves } = require('./model/layout');
const { knownPoints } = require('./model/points');
const { parseWikiPoints, mergePoints } = require('./model/wiki-overlay');
const { busToFile } = require('./model/util');

function stripCopierHeader(rom) {
    return rom.length % 1024 === 512 ? rom.subarray(512) : rom;
}

function headerTitle(rom, base) {
    if (rom.length < base + 0x40) return '';
    return String.fromCharCode(...rom.subarray(base, base + 0x15)).replace(/[^\x20-\x7E]/g, '').trim();
}

/** How the cartridge maps onto the bus: HiROM or LoROM, FastROM, SRAM size (from the header). */
function busMapping(rom) {
    const score = base => {
        if (rom.length < base + 0x40) return -1;
        const mode = rom[base + 0x15], sum = rom[base + 0x1E] | rom[base + 0x1F] << 8, inv = rom[base + 0x1C] | rom[base + 0x1D] << 8;
        return ((sum ^ inv) === 0xFFFF ? 2 : 0) + ((mode & 1) === (base === 0xFFC0 ? 1 : 0) ? 1 : 0) + (/^[\x20-\x7E]+$/.test(headerTitle(rom, base)) ? 1 : 0);
    };
    const hirom = score(0xFFC0) >= score(0x7FC0);
    const base = hirom ? 0xFFC0 : 0x7FC0;
    const sramCode = rom.length > base + 0x18 ? rom[base + 0x18] : 0;
    return { hirom, fast: !!(rom[base + 0x15] & 0x10), sramBytes: sramCode && sramCode < 9 ? 1024 << sramCode : 0, headerBase: base };
}

/**
 * @param romBytes Buffer/Uint8Array (a copier header is stripped)
 * @param opts.rooms  Map<room id, {name, area}>
 * @param opts.wiki   wiki/rom/Rom-Map.md text, or ''
 * @param opts.cdl    Uint8Array CDL bytes for this ROM, or null
 */
function buildRomModel(romBytes, opts = {}) {
    const rom = new Uint8Array(stripCopierHeader(romBytes));
    const mapping = busMapping(rom);
    const title = headerTitle(rom, mapping.headerBase);
    const evermore = /SECRET OF EVERMORE/.test(title) && rom.length >= 0x300000 && rom[0xFFD5] === 0x31;
    const regions = [];
    const R = (s, e, cat, name, notes = '', area = '', prio = 1, extra = {}) =>
        regions.push({ s, e, cat, name, notes, area, prio, ...extra });
    let points = [], spriteBlocks = 0;
    const errors = [];

    headerRegions(R, mapping.headerBase);
    if (evermore) {
        const step = (label, fn) => { try { return fn(); } catch (err) { errors.push(label + ': ' + (err && err.message || err)); return null; } };
        const worlds = step('rooms', () => roomRegions(rom, R, opts.rooms || new Map())) || new Map();
        step('text', () => textRegions(rom, R));
        step('entities', () => entityRegions(rom, R));
        step('audio', () => audioRegions(rom, R));
        const graphics = step('graphics', () => graphicSpans(rom)) || [];
        spriteBlocks = (step('assets', () => assetRegions(rom, R, graphics, worlds)) || {}).spriteBlocks || 0;
        annotateOverlaps(regions, graphics);
        points = mergePoints(knownPoints(), parseWikiPoints(opts.wiki))
            .map(p => ({ s: busToFile(p.bus), cat: p.cat, name: p.name, notes: p.notes }))
            .filter(p => p.s < rom.length);
    }
    const { halves, totals } = layoutHalves(rom, regions, points, opts.cdl || null);
    return {
        title: title || '(no header)', size: rom.length, evermore, hasCdl: !!opts.cdl, mapping,
        wikiPoints: evermore ? parseWikiPoints(opts.wiki).length : 0,
        spriteBlocks, errors, totals, halves,
        codePoints: points.filter(p => p.cat === '🧠').map(p => ({ s: p.s, name: p.name })),
    };
}

module.exports = { buildRomModel, stripCopierHeader };
