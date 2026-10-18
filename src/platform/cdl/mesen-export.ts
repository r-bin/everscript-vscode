/**
 * platform/cdl/mesen-export.ts
 *
 * Files Mesen2 reads directly (formats checked against Mesen2's source, 2026-10-12):
 *   mesen/labels.mlb  one entry per line: `<memory type>:<hex address>[-<hex end>]:<label>[:<comment>]`.
 *                     The address is an offset inside the memory type (ROM file offset for
 *                     SnesPrgRom, WRAM offset for SnesWorkRam). The label may be empty, so a
 *                     line can carry only a comment; newlines in comments are written as `\n`.
 *   mesen/rom.cdl     `CDLv2`, CRC32 of the ROM (little-endian), then one flag byte per ROM byte
 *                     (same bit layout as rom.cdl). Known asset ranges are OR-ed in as data.
 */

import * as fs from 'fs';
import * as path from 'path';
import { crc32 } from '../crc32';

const CDL_DATA = 0x02;
const COMMENT_MAX = 240;

/** A ROM entry the export collected: a label, a comment, or both, at a file offset. */
interface RomNote { off: number; label?: string; size?: number; comment?: string }
interface MesenInput {
    rom: Uint8Array; lib: { cdl: ArrayLike<number> }; outDir: string; comments: RomNote[];
    wramNames?: Map<number, { name: string; note?: string; size?: number }> | null;
    assets?: { start: number; end: number; name: string }[] | null;
}

function cleanComment(text: string | undefined): string {
    const one = String(text || '').replace(/\r?\n/g, '\\n').trim();
    return one.length > COMMENT_MAX ? one.slice(0, COMMENT_MAX - 1) + '…' : one;
}

function line(type: string, addr: number, size: number, label: string | undefined, comment: string | undefined): string {
    const a = addr.toString(16).toUpperCase().padStart(4, '0');
    const range = size > 1 ? a + '-' + (addr + size - 1).toString(16).toUpperCase().padStart(4, '0') : a;
    const c = cleanComment(comment);
    return `${type}:${range}:${label || ''}` + (c ? ':' + c : '');
}

/** `comments`: ROM entries the export collected; `wramNames`: by WRAM offset; `assets`: ROM ranges known to be data. */
function writeMesenFiles({ rom, lib, outDir, comments, wramNames, assets }: MesenInput) {
    const dir = path.join(outDir, 'mesen');
    fs.mkdirSync(dir, { recursive: true });

    // One entry per ROM offset: a label line wins, comments for the same offset are joined.
    const byOff = new Map<number, RomNote>();
    for (const c of comments) {
        const old = byOff.get(c.off);
        if (!old) { byOff.set(c.off, { ...c }); continue; }
        if (c.label && !old.label) old.label = c.label;
        if (c.comment && !String(old.comment).includes(c.comment)) old.comment = old.comment ? old.comment + '  ' + c.comment : c.comment;
    }
    for (const a of assets || []) {
        const e = byOff.get(a.start);
        const note = 'asset: ' + a.name + ' (' + (a.end - a.start) + ' bytes)';
        if (!e) byOff.set(a.start, { off: a.start, comment: note });
        else if (!String(e.comment).includes(note)) e.comment = e.comment ? e.comment + '  ' + note : note;
    }
    const out: string[] = [];
    let labels = 0, notes = 0;
    for (const off of [...byOff.keys()].sort((a, b) => a - b)) {
        const e = byOff.get(off);
        if (!e || (!e.label && !e.comment)) continue;
        out.push(line('SnesPrgRom', off, e.size || 1, e.label, e.comment));
        if (e.label) labels++; else notes++;
    }
    for (const [addr, w] of [...(wramNames || new Map())].sort((a, b) => a[0] - b[0])) {
        out.push(line('SnesWorkRam', addr, w.size || 1, w.name, w.note));
        labels++;
    }
    fs.writeFileSync(path.join(dir, 'labels.mlb'), out.join('\n') + '\n');

    const flags = new Uint8Array(lib.cdl);
    let assetBytes = 0;
    for (const a of assets || []) {
        for (let off = Math.max(0, a.start); off < Math.min(a.end, flags.length); off++) {
            if (!flags[off]) { flags[off] = CDL_DATA; assetBytes++; }
        }
    }
    const head = Buffer.alloc(9);
    head.write('CDLv2', 0, 'ascii');
    head.writeUInt32LE(crc32(rom), 5);
    fs.writeFileSync(path.join(dir, 'rom.cdl'), Buffer.concat([head, Buffer.from(flags)]));
    return { labels, comments: notes, assetBytes, file: path.join(dir, 'labels.mlb') };
}

export { writeMesenFiles };
