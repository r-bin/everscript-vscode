// Ownership: the Scripts tab's Maps view, middle column — one room blob as the
// bytes the game reads, cut into the sections the room loader walks
// (maps/blob-layout.ts; docs/map-format/map_encoding.md). Each section carries
// its bytes, the fields it decodes to and the items in it (a trigger, an
// animation channel, an object, a swap record) that the right column draws
// (./map-views.ts). Pure apart from the ROM buffer it is handed.

import * as maps from '../../maps';
import { getMapName, getMapArea } from '../../localizations';
import { hex } from '../../../../platform';

/** One decoded field: where it sits in the section, its name and value. */
interface Field { at: number; size: number; name: string; value: string }
/** A selectable part of a section; `key` is what the page sends back (./map-views.ts). */
interface Item { key: string; label: string; at: number; size: number }
interface Section {
    key: string; title: string; note: string;
    /** ROM file offset and SNES bus address of the section's first byte. */
    offset: number; snes: string; size: number;
    /** The section's bytes, as hex pairs without spaces. */
    bytes: string;
    fields: Field[]; items: Item[];
}

const SUB_FLAG: Record<number, string> = { 0x00: 'raw copy', 0x03: 'LZSS', 0x07: 'Markov' };

const toSnes = (offset: number): string => '$' + hex(0xc00000 + offset, 6);
const h2 = (v: number): string => '$' + hex(v, 2);
const h4 = (v: number): string => '$' + hex(v, 4);

function section(rom: Uint8Array, key: string, title: string, note: string, start: number, end: number): Section {
    const bytes = Buffer.from(rom.subarray(start, end)).toString('hex').toUpperCase();
    return { key, title, note, offset: start, snes: toSnes(start), size: end - start, bytes, fields: [], items: [] };
}

function blockFields(b: maps.PayloadBlock, what: string): Field[] {
    return [
        { at: 0, size: 2, name: 'payload length', value: String(b.payloadLen) },
        { at: 2, size: 1, name: 'encoding', value: h2(b.subFlag) + ' ' + (SUB_FLAG[b.subFlag] || 'unknown') },
        { at: 3, size: 2, name: 'decoded size', value: b.decompSize + ' bytes · ' + what },
    ];
}

function triggerItems(room: maps.RoomData, kind: 'step' | 'b'): Item[] {
    const list = kind === 'step' ? room.triggers.stepOn : room.triggers.bTrigger;
    return list.map((t, i) => ({
        key: kind + ':' + i, at: 2 + i * 6, size: 6,
        label: (kind === 'step' ? 'S' : 'B') + i + ' (' + t.x1 + ',' + t.y1 + ')–(' + t.x2 + ',' + t.y2 + ') script ' + h4(t.scriptId),
    }));
}

/** Every section of room `id`'s blob, in ROM order: { id, …, sections } or { id, error }. */
function mapSections(rom: Uint8Array, id: number) {
    let room: maps.RoomData;
    let L: maps.BlobLayout;
    let end: number;
    try {
        room = maps.decodeRoom(rom, id);
        L = maps.parseBlobLayout(rom, room.romPointerFile);
        end = maps.objectAreaEnd(rom, L);
    } catch (err) {
        return { id, error: String(err instanceof Error ? err.message : err) };
    }
    const hd = room.header;
    const blob = L.blob;
    const out: Section[] = [];

    const header = section(rom, 'header', 'Header', 'Origin, size, PPU layers and colour math, the room effect', blob, blob + 0x0d);
    header.fields = [
        { at: 0, size: 1, name: 'origin x', value: hd.originX + ' tiles (trigger boxes are offset by it)' },
        { at: 1, size: 1, name: 'origin y', value: String(hd.originY) },
        { at: 2, size: 1, name: 'width', value: hd.widthTiles + ' tiles · ' + hd.widthPixels + ' px' },
        { at: 3, size: 1, name: 'height', value: hd.heightTiles + ' tiles · ' + hd.heightPixels + ' px' },
        { at: 4, size: 1, name: 'main screen (TM, $212C)', value: h2(hd.displayTm) },
        { at: 5, size: 1, name: 'sub screen (TS, $212D)', value: h2(hd.subscreenTs) },
        { at: 6, size: 1, name: 'colour math (CGADSUB, $2131)', value: h2(hd.colorMath) },
        { at: 7, size: 1, name: 'colour window (CGWSEL, $2130)', value: h2(hd.colorWindow) },
        { at: 8, size: 1, name: 'effect variant', value: h2(hd.effectVariant) },
        { at: 9, size: 2, name: 'flags word ($0F84)', value: h4(maps.read16(rom, blob + 9)) },
        { at: 11, size: 2, name: 'not decoded', value: h4(maps.read16(rom, blob + 11)) },
    ];
    out.push(header);

    const step = section(rom, 'step', 'Step-on triggers', 'Length, then y1 x1 y2 x2 and a script id per trigger', blob + 0x0d, L.bLenOffset);
    step.items = triggerItems(room, 'step');
    out.push(step);
    const b = section(rom, 'b', 'B-triggers', 'Length, then y1 x1 y2 x2 and a script id per trigger', L.bLenOffset, L.payloadOffset);
    b.items = triggerItems(room, 'b');
    out.push(b);

    const fam = section(rom, 'families', 'Tile families', 'Count, then one palette family per background palette 1–7', L.payloadOffset, L.extrasOffset);
    fam.fields = room.tileFamilies.map((f, i) => ({ at: 1 + i * 2, size: 2, name: 'palette ' + (i + 1), value: 'family ' + h4(f) }));
    out.push(fam);
    const extras = section(rom, 'extras', 'CHR descriptors', 'Count, then 3 bytes each', L.extrasOffset, L.block1.offset);
    for (let i = 0; i < L.extraCount; i++) {
        const p = L.extrasOffset + 1 + i * 3;
        extras.fields.push({ at: 1 + i * 3, size: 3, name: 'descriptor ' + i, value: '$' + hex(maps.read24(rom, p), 6) });
    }
    out.push(extras);

    const b1 = section(rom, 'block1', 'Block 1 · graphics list', 'The 16×16 graphics the room loads, as deltas', L.block1.offset, L.section2);
    b1.fields = blockFields(L.block1, room.tilePalette.length + ' graphics');
    out.push(b1);
    const s2 = section(rom, 'anim', 'Section 2 · animated tiles', 'Count, length, then delay, frame count and offset per channel', L.section2, L.section3);
    s2.items = room.animation.map((c) => ({
        key: 'anim:' + c.index, at: 3 + c.index * 4, size: 4,
        label: 'channel ' + c.index + ' · ' + c.frames.length + ' frames · first delay ' + c.delay,
    }));
    out.push(s2);
    const s3 = section(rom, 'objects', 'Section 3 · object list', 'Count, then each object\'s offset in the object area', L.section3, L.block2.offset);
    s3.items = room.objects.map((o) => ({
        key: 'obj:' + o.objectIndex, at: 1 + o.objectIndex * 2, size: 2,
        label: 'object ' + o.objectIndex + ' → +' + h4(o.relativeOffset) + ' · ' + maps.objectStateCount(o) + ' states',
    }));
    out.push(s3);

    const b2 = section(rom, 'block2', 'Block 2 · map', 'The grid of metatile ids, Markov coded', L.block2.offset, L.section4);
    b2.fields = blockFields(L.block2, hd.widthTiles + '×' + hd.heightTiles + ' cells');
    out.push(b2);
    const s4 = section(rom, 's4', 'Section 4 · cuttable tiles', 'Length, a start counter, then a metatile swap chain per source', L.section4, L.block3.offset);
    s4.fields = [{ at: 0, size: 2, name: 'length', value: String(L.section4Len) }];
    if (L.section4Len) s4.fields.push({ at: 2, size: 1, name: 'start counter ($0FC4)', value: h2(L.fc4) });
    // Records follow the counter: steps, then words up to a $0000 (maps/cuttable-grass.ts walks them the same way).
    let p = 3;
    s4.items = room.cuttableGrass.table.records.map((r, i) => {
        const size = 1 + (2 + r.sequence.length) * 2;
        const item = { key: 'grass:' + i, at: p, size, label: 'swap ' + i + ' · ' + h4(r.source) + ' → ' + r.sequence.map(h4).join(' → ') + ' · ' + r.steps + ' steps' };
        p += size;
        return item;
    });
    out.push(s4);
    const b3 = section(rom, 'block3', 'Block 3 · metatiles', 'BG1 words, BG2 words, collision words: one of each per metatile', L.block3.offset, L.objectArea);
    b3.fields = blockFields(L.block3, room.metatileCount + ' metatiles');
    out.push(b3);

    const area = section(rom, 'area', 'Object area', 'Each object\'s states (hold, x, y, stamp) and the stamps they apply', L.objectArea, end);
    area.items = room.objects.map((o) => ({
        key: 'obj:' + o.objectIndex, at: o.relativeOffset, size: 1 + o.maxState * 5,
        label: 'object ' + o.objectIndex + ' · ' + o.states.map((s) => '(' + s.tileX + ',' + s.tileY + ') ' + s.targetWidth + '×' + s.targetHeight).join(' · '),
    }));
    out.push(area);

    return {
        id, idHex: hex(id, 2), name: getMapName(id) || '', area: getMapArea(id) || '',
        pointer: { entry: toSnes(maps.mapTableOffset(rom) + id * 4), value: '$' + hex(room.romPointerSnes, 6) },
        blob: { offset: blob, snes: toSnes(blob), size: end - blob },
        sections: out,
    };
}

export { mapSections };
export type { Section, Field, Item };
