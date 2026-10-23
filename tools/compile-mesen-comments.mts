// tools/compile-mesen-comments.mts
// Compiles centralized comments from asm-comments.json and knowledge entries
// into Mesen2 labels.mlb format:
//   <memory type>:<hex address>[-<hex end>]:<label>[:<comment>]

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');
const COMMENTS_JSON = path.join(ROOT, 'src', 'games', 'evermore', 'localizations', 'data', 'asm-comments.json');
const KNOWLEDGE_ROM = path.join(ROOT, 'src', 'games', 'evermore', 'localizations', 'knowledge', 'rom');
const KNOWLEDGE_RAM = path.join(ROOT, 'src', 'games', 'evermore', 'localizations', 'knowledge', 'ram');

const outDir = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'out', 'mesen');

const COMMENT_MAX = 240;

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

interface Note {
    off: number;
    label?: string;
    size?: number;
    comment?: string;
}

function main() {
    fs.mkdirSync(outDir, { recursive: true });

    const romNotes = new Map<number, Note>();
    const wramNotes = new Map<number, Note>();

    // 1. Read centralized comments
    if (fs.existsSync(COMMENTS_JSON)) {
        try {
            const data = JSON.parse(fs.readFileSync(COMMENTS_JSON, 'utf8'));
            for (const [k, v] of Object.entries(data.rom || {})) {
                const off = parseInt(k, 16);
                if (isNaN(off)) continue;
                const ent = v as { comment?: string; label?: string };
                romNotes.set(off, { off, label: ent.label, comment: ent.comment });
            }
            for (const [k, v] of Object.entries(data.wram || {})) {
                const addr = parseInt(k, 16);
                if (isNaN(addr)) continue;
                const ent = v as { comment?: string; label?: string };
                wramNotes.set(addr, { off: addr, label: ent.label, comment: ent.comment });
            }
        } catch (e) {
            console.error('Error reading asm-comments.json:', e);
        }
    }

    // 2. Read knowledge entries for ROM
    if (fs.existsSync(KNOWLEDGE_ROM)) {
        for (const file of fs.readdirSync(KNOWLEDGE_ROM).filter(f => f.endsWith('.md'))) {
            try {
                const text = fs.readFileSync(path.join(KNOWLEDGE_ROM, file), 'utf8');
                const head = text.split('\n---')[0];
                const addrMatch = head.match(/^addr:\s*([0-9A-Fa-f]+)/m);
                const nameMatch = head.match(/^name:\s*(.+)/m);
                const titleMatch = head.match(/^title:\s*(.+)/m);
                const bus = parseInt(addrMatch ? addrMatch[1] : path.basename(file, '.md'), 16);
                const off = bus & 0x3fffff;
                const label = nameMatch ? nameMatch[1].trim() : (titleMatch ? titleMatch[1].trim() : undefined);
                const purpose = text.slice(head.length + 4).trim().split('\n\n')[0].replace(/\s+/g, ' ');

                const old = romNotes.get(off) || { off };
                if (label && !old.label) old.label = label;
                if (purpose && !old.comment) old.comment = purpose;
                romNotes.set(off, old);
            } catch {}
        }
    }

    // 3. Read knowledge entries for WRAM
    if (fs.existsSync(KNOWLEDGE_RAM)) {
        for (const file of fs.readdirSync(KNOWLEDGE_RAM).filter(f => f.endsWith('.md'))) {
            try {
                const text = fs.readFileSync(path.join(KNOWLEDGE_RAM, file), 'utf8');
                const head = text.split('\n---')[0];
                const addrMatch = head.match(/^addr:\s*([0-9A-Fa-f]+)/m);
                const nameMatch = head.match(/^name:\s*(.+)/m);
                const sizeMatch = head.match(/^size:\s*([0-9]+)/m);
                const bus = parseInt(addrMatch ? addrMatch[1] : path.basename(file, '.md'), 16);
                const off = bus >= 0x7E0000 ? bus - 0x7E0000 : bus;
                const size = sizeMatch ? parseInt(sizeMatch[1], 10) : 1;
                const label = nameMatch ? nameMatch[1].trim() : undefined;
                const purpose = text.slice(head.length + 4).trim().split('\n\n')[0].replace(/\s+/g, ' ');

                const old = wramNotes.get(off) || { off, size };
                if (label && !old.label) old.label = label;
                if (purpose && !old.comment) old.comment = purpose;
                wramNotes.set(off, old);
            } catch {}
        }
    }

    // 4. Emit lines
    const lines: string[] = [];
    for (const off of [...romNotes.keys()].sort((a, b) => a - b)) {
        const e = romNotes.get(off)!;
        if (!e.label && !e.comment) continue;
        lines.push(line('SnesPrgRom', off, e.size || 1, e.label, e.comment));
    }
    for (const off of [...wramNotes.keys()].sort((a, b) => a - b)) {
        const e = wramNotes.get(off)!;
        if (!e.label && !e.comment) continue;
        lines.push(line('SnesWorkRam', off, e.size || 1, e.label, e.comment));
    }

    const outFile = path.join(outDir, 'labels.mlb');
    fs.writeFileSync(outFile, lines.join('\n') + '\n');
    console.log(`Compiled Mesen comments file: ${outFile}`);
    console.log(`  SnesPrgRom: ${romNotes.size} entries`);
    console.log(`  SnesWorkRam: ${wramNotes.size} entries`);
    console.log(`  Total lines: ${lines.length}`);
}

main();

