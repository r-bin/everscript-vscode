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

function headerTitle(rom) {
    if (rom.length < 0x10000) return '';
    return String.fromCharCode(...rom.subarray(0xFFC0, 0xFFD5)).replace(/[^\x20-\x7E]/g, '').trim();
}

/**
 * @param romBytes Buffer/Uint8Array (a copier header is stripped)
 * @param opts.rooms  Map<room id, {name, area}>
 * @param opts.wiki   wiki/rom/Rom-Map.md text, or ''
 * @param opts.cdl    Uint8Array CDL bytes for this ROM, or null
 */
function buildRomModel(romBytes, opts = {}) {
    const rom = new Uint8Array(stripCopierHeader(romBytes));
    const title = headerTitle(rom);
    const evermore = /SECRET OF EVERMORE/.test(title) && rom.length >= 0x300000 && rom[0xFFD5] === 0x31;
    const regions = [];
    const R = (s, e, cat, name, notes = '', area = '', prio = 1, extra = {}) =>
        regions.push({ s, e, cat, name, notes, area, prio, ...extra });
    let points = [], spriteBlocks = 0;
    const errors = [];

    headerRegions(R);
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
        title: title || '(no header)', size: rom.length, evermore, hasCdl: !!opts.cdl,
        wikiPoints: evermore ? parseWikiPoints(opts.wiki).length : 0,
        spriteBlocks, errors, totals, halves,
        codePoints: points.filter(p => p.cat === '🧠').map(p => ({ s: p.s, name: p.name })),
    };
}

module.exports = { buildRomModel, stripCopierHeader };
