// tools/scrape-asm-comments.mts
// Scrapes ASM comments and reconstructed C code from documentation, centralizes
// them into src/games/evermore/localizations/data/asm-comments.json and reconstructed-c/,
// and replaces embedded snippets in markdown with VFS links (soe://rom/code/<addr>).

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DISASM_DIR = path.join(ROOT, 'docs', 'disassembly');
const RECON_DIR = path.join(ROOT, 'reconstructed-c');
const COMMENTS_JSON = path.join(ROOT, 'src', 'games', 'evermore', 'localizations', 'data', 'asm-comments.json');
const REPORT_FILE = path.join(ROOT, 'docs', 'disassembly', 'migration-report.json');

const isApply = process.argv.includes('--apply');

interface AsmEntry {
    comment?: string;
    label?: string;
}

interface RoutineInfo {
    bank: string;
    addr: string;
    fullAddr: string;
    fileOffset: string;
    name: string;
    filePath: string;
    cCode?: string;
}

function hiromFileOffset(bus: number): number {
    return bus & 0x3fffff;
}

function toHex6(num: number): string {
    return (num >>> 0).toString(16).padStart(6, '0').toUpperCase();
}

function toHex2(num: number): string {
    return (num >>> 0).toString(16).padStart(2, '0').toUpperCase();
}

function walkMdFiles(dir: string): string[] {
    let results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results = results.concat(walkMdFiles(full));
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
            results.push(full);
        }
    }
    return results;
}

function parseRoutineHeader(text: string, relPath: string): RoutineInfo | null {
    // 1. Primary Function: `func_name` ($80:8020)
    let m = text.match(/\*\*(?:Primary Function|Function|Routine)\*\*:\s*`?([a-zA-Z0-9_]+)`?\s*\((?:\$|0x)?([0-9A-Fa-f]{2})[:_]?([0-9A-Fa-f]{4})\)/i);
    if (m) {
        const bank = m[2].toUpperCase();
        const addr = m[3].toUpperCase();
        const bus = (parseInt(bank, 16) << 16) | parseInt(addr, 16);
        return {
            bank,
            addr,
            fullAddr: bank + addr,
            fileOffset: toHex6(hiromFileOffset(bus)),
            name: m[1],
            filePath: relPath,
        };
    }

    // 2. ROM Location: Bank $80 ($80:8020 ...
    m = text.match(/\*\*ROM Location\*\*:\s*Bank\s*(?:\$|0x)?([0-9A-Fa-f]{2})\s*\((?:\$|0x)?([0-9A-Fa-f]{2})[:_]?([0-9A-Fa-f]{4})/i);
    if (m) {
        const bank = m[1].toUpperCase();
        const addr = m[3].toUpperCase();
        const bus = (parseInt(bank, 16) << 16) | parseInt(addr, 16);
        const nameMatch = text.match(/\b([a-zA-Z0-9_]+)\s*\((?:\$|0x)?[0-9A-Fa-f]{2}[:_]?[0-9A-Fa-f]{4}\)/);
        const name = nameMatch ? nameMatch[1] : path.basename(relPath, '.md').replace(/-/g, '_');
        return {
            bank,
            addr,
            fullAddr: bank + addr,
            fileOffset: toHex6(hiromFileOffset(bus)),
            name,
            filePath: relPath,
        };
    }

    // 3. Any first bus address ($80:8020 or $808020)
    m = text.match(/(?:\$|0x)([89A-Fa-f][0-9A-Fa-f])[:_]([0-9A-Fa-f]{4})/);
    if (m) {
        const bank = m[1].toUpperCase();
        const addr = m[2].toUpperCase();
        const bus = (parseInt(bank, 16) << 16) | parseInt(addr, 16);
        const name = path.basename(relPath, '.md').replace(/-/g, '_');
        return {
            bank,
            addr,
            fullAddr: bank + addr,
            fileOffset: toHex6(hiromFileOffset(bus)),
            name,
            filePath: relPath,
        };
    }

    return null;
}

const LINE_PATTERNS = [
    // $80:8020  A9 8F        LDA #$8F        ; Force Blank
    /^\s*(?:\$|0x)?([0-9A-Fa-f]{2})[:_]([0-9A-Fa-f]{4})\b(?:\s+[0-9A-Fa-f]{2}(?:\s+[0-9A-Fa-f]{2})*)*\s+([A-Za-z]{3}\b[^;]*?)(?:;\s*(.*))?$/,
    // 90A6F7  LDY $0FD2,X          ; comment
    /^\s*([0-9A-Fa-f]{2})([0-9A-Fa-f]{4})\b(?:\s+[0-9A-Fa-f]{2}(?:\s+[0-9A-Fa-f]{2})*)*\s+([A-Za-z]{3}\b[^;]*?)(?:;\s*(.*))?$/,
    // $808020: LDA #$8F ; comment
    /^\s*(?:\$|0x)?([0-9A-Fa-f]{2})([0-9A-Fa-f]{4}):\s*([A-Za-z]{3}\b[^;]*?)(?:;\s*(.*))?$/,
];

function parseAsmLines(codeBlock: string, defaultBank: string): Map<string, AsmEntry> {
    const entries = new Map<string, AsmEntry>();
    const lines = codeBlock.split('\n');

    let pendingLabel: string | null = null;

    for (const line of lines) {
        // Label line: `my_label:`
        const labelM = /^\s*([a-zA-Z0-9_]+):\s*$/.exec(line);
        if (labelM) {
            pendingLabel = labelM[1];
            continue;
        }

        // Instruction line
        let match: RegExpExecArray | null = null;
        for (const pat of LINE_PATTERNS) {
            match = pat.exec(line);
            if (match) break;
        }

        if (match) {
            const bank = match[1] || defaultBank;
            const addr = match[2];
            const bus = (parseInt(bank, 16) << 16) | parseInt(addr, 16);
            const off = toHex6(hiromFileOffset(bus));
            const comment = match[4] ? match[4].trim() : undefined;

            const existing = entries.get(off) || {};
            if (comment && (!existing.comment || !existing.comment.includes(comment))) {
                existing.comment = existing.comment ? `${existing.comment} | ${comment}` : comment;
            }
            if (pendingLabel && !existing.label) {
                existing.label = pendingLabel;
            }
            if (existing.comment || existing.label) {
                entries.set(off, existing);
            }
            pendingLabel = null;
        }
    }

    return entries;
}

function run() {
    console.log(`Starting ASM and C migration (${isApply ? 'APPLY' : 'DRY RUN'})...`);

    const mdFiles = walkMdFiles(path.join(ROOT, 'docs'));
    console.log(`Found ${mdFiles.length} markdown files in docs/`);

    const allComments: Record<string, AsmEntry> = {};
    if (fs.existsSync(COMMENTS_JSON)) {
        try {
            const existing = JSON.parse(fs.readFileSync(COMMENTS_JSON, 'utf8'));
            Object.assign(allComments, existing.rom || existing);
        } catch {}
    }

    const routines: RoutineInfo[] = [];
    const unresolvable: string[] = [];
    let extractedC = 0;
    let extractedComments = 0;
    let modifiedDocs = 0;

    for (const filePath of mdFiles) {
        const relPath = path.relative(ROOT, filePath);
        const content = fs.readFileSync(filePath, 'utf8');
        const routine = parseRoutineHeader(content, relPath);

        if (!routine) {
            unresolvable.push(relPath);
            continue;
        }

        routines.push(routine);

        // 1. Scrape comments from assembly blocks
        const asmBlockMatches = [...content.matchAll(/```(?:assembly|asm|65816)[\s\S]*?```/g)];
        let fileComments = 0;

        for (const bm of asmBlockMatches) {
            const blockCode = bm[0];
            const parsed = parseAsmLines(blockCode, routine.bank);
            for (const [off, entry] of parsed) {
                const cur = allComments[off] || {};
                if (entry.comment && (!cur.comment || !cur.comment.includes(entry.comment))) {
                    cur.comment = cur.comment ? `${cur.comment} | ${entry.comment}` : entry.comment;
                }
                if (entry.label && !cur.label) {
                    cur.label = entry.label;
                }
                allComments[off] = cur;
                fileComments++;
                extractedComments++;
            }
        }

        // 2. Extract C code block
        const cBlockMatch = /```c\n([\s\S]*?)```/.exec(content);
        if (cBlockMatch) {
            routine.cCode = cBlockMatch[1].trim();
            extractedC++;

            if (isApply) {
                const bankDir = path.join(RECON_DIR, routine.bank);
                fs.mkdirSync(bankDir, { recursive: true });
                const cFileName = `${routine.fullAddr}_${routine.name}.c`;
                const cFilePath = path.join(bankDir, cFileName);

                const cHeader = `/*
 * Routine: $${routine.fullAddr} (${routine.name})
 * Bank: $${routine.bank} (ROM Offset: $${routine.fileOffset})
 * Source: ${relPath}
 */

`;
                fs.writeFileSync(cFilePath, cHeader + routine.cCode + '\n');
            }
        }

        // 3. Update the markdown file if applying
        if (isApply && (asmBlockMatches.length > 0 || cBlockMatch)) {
            let newContent = content;

            // Replace assembly blocks with VFS link
            for (const bm of asmBlockMatches) {
                const replacement = `> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/${routine.fullAddr}](soe://rom/code/${routine.fullAddr}?asm=1&c=0)
`;
                newContent = newContent.replace(bm[0], replacement);
            }

            // Replace C block with link to reconstructed-c file & VFS
            if (cBlockMatch) {
                const cRelPath = `reconstructed-c/${routine.bank}/${routine.fullAddr}_${routine.name}.c`;
                const relToC = path.relative(path.dirname(filePath), path.join(ROOT, cRelPath));
                const replacement = `> **Reconstructed C Decompilation**:
> Source moved to [\`${cRelPath}\`](${relToC}).
> [View in VFS: soe://rom/code/${routine.fullAddr}](soe://rom/code/${routine.fullAddr}?c=1&asm=0)
`;
                newContent = newContent.replace(cBlockMatch[0], replacement);
            }

            fs.writeFileSync(filePath, newContent);
            modifiedDocs++;
        }
    }

    console.log(`Results:`);
    console.log(`- Total routines matched: ${routines.length}`);
    console.log(`- Extracted C functions: ${extractedC}`);
    console.log(`- Total comments scraped: ${extractedComments}`);
    console.log(`- Unique comment offsets in store: ${Object.keys(allComments).length}`);
    console.log(`- Unresolvable files: ${unresolvable.length}`);

    if (isApply) {
        // Save centralized comments JSON
        fs.mkdirSync(path.dirname(COMMENTS_JSON), { recursive: true });
        const jsonOut = {
            '//': 'Centralized ASM comments for Secret of Evermore routines. Compiled to mesen/labels.mlb and infused at runtime via VFS.',
            rom: allComments,
        };
        fs.writeFileSync(COMMENTS_JSON, JSON.stringify(jsonOut, null, 2) + '\n');
        console.log(`Wrote comments to ${COMMENTS_JSON}`);
        console.log(`Modified ${modifiedDocs} documentation files.`);
    }

    const report = {
        timestamp: new Date().toISOString(),
        routinesCount: routines.length,
        extractedC,
        extractedComments,
        uniqueOffsets: Object.keys(allComments).length,
        unresolvable,
        routines: routines.map(r => ({
            name: r.name,
            address: '$' + r.fullAddr,
            fileOffset: '$' + r.fileOffset,
            source: r.filePath,
            hasC: !!r.cCode,
        })),
    };

    if (isApply) {
        fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2) + '\n');
        console.log(`Wrote migration report to ${REPORT_FILE}`);
    }
}

run();
