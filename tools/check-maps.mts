// tools/check-maps.mts
// Validates WRAM and ROM memory maps against physical layout, syntax, typing, and tagging rules.
// - Markdown syntax: table columns, escaped pipes, balanced delimiters, valid JSON headers.
// - Order: non-decreasing addresses within each bank / contiguous file.
// - Continuity: zero gaps and zero overlaps across 128 KB WRAM ($7E:0000..$7F:FFFF).
// - Types: valid primitives, enums, structs in types.json, and array dimensions.
// - Tags: defined in tag_tree, non-empty, and non-redundant.
// - Linkage: all markdown knowledge links resolve to existing files on disk.
// - Docs parity: 1:1 byte parity between src/ and docs/ disassembly maps.
//
// Usage: node tools/check-maps.mts [--wram] [--rom]

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SRC_DATA = path.join(ROOT, 'src', 'games', 'evermore', 'localizations', 'data');
const DOCS_CORE = path.join(ROOT, 'docs', 'disassembly', 'engine-core');
const KNOWLEDGE_ROOT = path.join(ROOT, 'src', 'games', 'evermore', 'localizations');

const TYPES_PATH = path.join(SRC_DATA, 'types.json');
const WRAM_7E_PATH = path.join(SRC_DATA, 'wram-map.md');
const WRAM_7F_PATH = path.join(SRC_DATA, 'wram-map-7f.md');
const ROM_MAP_PATH = path.join(SRC_DATA, 'rom-map.md');

interface WramTypes {
    typedefs?: Record<string, { type: string; desc: string }>;
    enums?: Record<string, { size?: number } | Record<string, string>>;
    structs?: Record<string, { size: number }>;
}

let typesData: WramTypes = {};
try {
    if (fs.existsSync(TYPES_PATH)) {
        typesData = JSON.parse(fs.readFileSync(TYPES_PATH, 'utf8'));
    }
} catch (err) {
    console.error('Failed to load types.json:', err);
}

function resolveTypeSize(typeStr: string): number {
    if (!typeStr) return 0;
    const clean = typeStr.replace(/^`|`$/g, '').trim();
    const arrayMatch = clean.match(/^([A-Za-z0-9_]+)\[(\d+|0x[0-9a-fA-F]+)\]$/);
    if (arrayMatch) {
        const base = arrayMatch[1];
        const count = arrayMatch[2].startsWith('0x') ? parseInt(arrayMatch[2], 16) : parseInt(arrayMatch[2], 10);
        return resolveTypeSize(base) * count;
    }
    if (clean === 'u8' || clean === 'i8') return 1;
    if (clean === 'u16' || clean === 'i16') return 2;
    if (clean === 'u24' || clean === 'i24') return 3;
    if (clean === 'u32' || clean === 'i32') return 4;
    if (typesData.typedefs && typesData.typedefs[clean]) {
        return resolveTypeSize(typesData.typedefs[clean].type);
    }
    if (typesData.enums && typesData.enums[clean]) {
        const e = typesData.enums[clean];
        if (typeof e === 'object' && e !== null && 'size' in e) {
            return Number(e.size) || 1;
        }
        return 1;
    }
    if (typesData.structs && typesData.structs[clean]) {
        return Number(typesData.structs[clean].size) || 0;
    }
    return 0;
}

interface Issue {
    level: 'ERROR' | 'WARN';
    file: string;
    line?: number;
    message: string;
}

/** Split a markdown table row by unescaped pipe characters */
function splitRow(line: string): string[] {
    return line.split(/(?<!\\)\|/).map(s => s.trim().replace(/\\\|/g, '|'));
}

function checkDocsParity(srcFile: string, docsFile: string, issues: Issue[]): void {
    const relSrc = path.relative(ROOT, srcFile);
    const relDocs = path.relative(ROOT, docsFile);

    if (!fs.existsSync(srcFile)) {
        issues.push({ level: 'ERROR', file: relSrc, message: 'Source file does not exist' });
        return;
    }
    if (!fs.existsSync(docsFile)) {
        issues.push({ level: 'ERROR', file: relDocs, message: 'Docs mirror file does not exist' });
        return;
    }

    const srcBuf = fs.readFileSync(srcFile);
    const docsBuf = fs.readFileSync(docsFile);
    if (!srcBuf.equals(docsBuf)) {
        issues.push({
            level: 'ERROR',
            file: relSrc,
            message: `1:1 parity mismatch with docs mirror (${relDocs}). Keep them identical.`,
        });
    }
}

function checkWramMap(filePath: string, defaultBank: number, issues: Issue[]): { totalBytes: number; entryCount: number } {
    const relFile = path.relative(ROOT, filePath);
    if (!fs.existsSync(filePath)) {
        issues.push({ level: 'ERROR', file: relFile, message: 'WRAM map file does not exist' });
        return { totalBytes: 0, entryCount: 0 };
    }

    const text = fs.readFileSync(filePath, 'utf8');
    const lines = text.split('\n');

    // 1. JSON block header validation
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    const allowedTags = new Set<string>();
    if (!jsonMatch) {
        issues.push({ level: 'ERROR', file: relFile, line: 1, message: 'Missing JSON header block' });
    } else {
        try {
            const header = JSON.parse(jsonMatch[1]);
            if (!header.areas || typeof header.areas !== 'object') {
                issues.push({ level: 'ERROR', file: relFile, message: 'Header JSON missing areas object' });
            }
            if (header.tag_tree && typeof header.tag_tree === 'object') {
                for (const tags of Object.values(header.tag_tree)) {
                    if (Array.isArray(tags)) {
                        for (const t of tags) allowedTags.add(String(t));
                    }
                }
            }
        } catch (e: any) {
            issues.push({ level: 'ERROR', file: relFile, message: `Invalid header JSON: ${e.message}` });
        }
    }

    const bankHex = defaultBank.toString(16).toUpperCase();
    const bankPrefix = `$${bankHex}:`;
    let expectedAddr = 0x0000;
    let entryCount = 0;
    let tableHeaderSeen = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;

        if (!line.startsWith('|')) continue;
        if (line.includes('| Address |')) {
            tableHeaderSeen = true;
            continue;
        }
        if (line.includes('|---')) continue;
        if (!line.includes(bankPrefix)) continue;

        entryCount++;

        // 2. Markdown column count validation
        const parts = splitRow(line);
        // Valid row: | Address | Identifier | Type | Tag | Summary | -> split gives 7 parts with empty ends
        if (parts.length !== 7 || parts[0] !== '' || parts[6] !== '') {
            issues.push({
                level: 'ERROR',
                file: relFile,
                line: lineNum,
                message: `Malformed table row: expected 5 data columns (got ${parts.length - 2}). Check for unescaped pipes '|'.`,
            });
            continue;
        }

        const addrStr = parts[1].replace(/[`$]/g, '');
        const identCol = parts[2];
        const typeStr = parts[3].replace(/[`]/g, '');
        const tagCol = parts[4];
        const summary = parts[5];

        // 3. Address parsing & order check
        const colonIdx = addrStr.indexOf(':');
        if (colonIdx === -1) {
            issues.push({ level: 'ERROR', file: relFile, line: lineNum, message: `Invalid address format: "${parts[1]}"` });
            continue;
        }
        const bankNum = parseInt(addrStr.slice(0, colonIdx), 16);
        const localAddr = parseInt(addrStr.slice(colonIdx + 1), 16);

        if (bankNum !== defaultBank) {
            issues.push({
                level: 'ERROR',
                file: relFile,
                line: lineNum,
                message: `Unexpected bank $${bankNum.toString(16).toUpperCase()} in $${bankHex} map`,
            });
        }

        if (localAddr < expectedAddr) {
            issues.push({
                level: 'ERROR',
                file: relFile,
                line: lineNum,
                message: `Backwards or duplicate address jump: got $${localAddr.toString(16).toUpperCase()}, expected >= $${expectedAddr.toString(16).toUpperCase()}`,
            });
        } else if (localAddr > expectedAddr) {
            issues.push({
                level: 'ERROR',
                file: relFile,
                line: lineNum,
                message: `Gap detected before address $${localAddr.toString(16).toUpperCase()}: expected contiguous address $${expectedAddr.toString(16).toUpperCase()} (${localAddr - expectedAddr} bytes missing)`,
            });
        }

        // 4. Type resolution
        const size = resolveTypeSize(typeStr);
        if (size <= 0) {
            issues.push({
                level: 'ERROR',
                file: relFile,
                line: lineNum,
                message: `Unresolvable type "${typeStr}" for entry at $${localAddr.toString(16).toUpperCase()}`,
            });
        }
        expectedAddr = localAddr + (size > 0 ? size : 1);

        // 5. Knowledge link verification
        const linkMatch = identCol.match(/\[`?([A-Za-z0-9_]+)`?\]\(([^)]+)\)/);
        if (!linkMatch) {
            issues.push({
                level: 'WARN',
                file: relFile,
                line: lineNum,
                message: `Entry identifier is not formatted as a markdown link: "${identCol}"`,
            });
        } else {
            const relLink = linkMatch[2];
            const targetPath = path.resolve(KNOWLEDGE_ROOT, relLink);
            if (!fs.existsSync(targetPath)) {
                issues.push({
                    level: 'ERROR',
                    file: relFile,
                    line: lineNum,
                    message: `Broken knowledge link: target file does not exist: "${relLink}"`,
                });
            }
        }

        // 6. Tag validation
        const tags = tagCol.split(',').map(s => s.trim()).filter(Boolean);
        if (tags.length === 0) {
            issues.push({
                level: 'ERROR',
                file: relFile,
                line: lineNum,
                message: `Entry at $${localAddr.toString(16).toUpperCase()} has no tags`,
            });
        }
        const seenTags = new Set<string>();
        for (const t of tags) {
            if (seenTags.has(t)) {
                issues.push({
                    level: 'WARN',
                    file: relFile,
                    line: lineNum,
                    message: `Duplicate tag "${t}" in entry at $${localAddr.toString(16).toUpperCase()}`,
                });
            }
            seenTags.add(t);
            if (allowedTags.size > 0 && !allowedTags.has(t)) {
                issues.push({
                    level: 'WARN',
                    file: relFile,
                    line: lineNum,
                    message: `Tag "${t}" not found in tag_tree header at $${localAddr.toString(16).toUpperCase()}`,
                });
            }
        }

        // 7. Summary quality
        if (!summary || summary.length < 10) {
            issues.push({
                level: 'WARN',
                file: relFile,
                line: lineNum,
                message: `Summary too short or missing for entry at $${localAddr.toString(16).toUpperCase()}`,
            });
        }
        const openParen = (summary.match(/\(/g) || []).length;
        const closeParen = (summary.match(/\)/g) || []).length;
        if (openParen !== closeParen) {
            issues.push({
                level: 'WARN',
                file: relFile,
                line: lineNum,
                message: `Unbalanced parentheses in summary at $${localAddr.toString(16).toUpperCase()}`,
            });
        }
    }

    if (!tableHeaderSeen) {
        issues.push({ level: 'ERROR', file: relFile, message: 'Table header not found' });
    }

    if (expectedAddr !== 0x10000) {
        issues.push({
            level: 'ERROR',
            file: relFile,
            message: `Bank coverage mismatch: expected 0x10000 bytes (65,536 B), got 0x${expectedAddr.toString(16).toUpperCase()} (${expectedAddr} B)`,
        });
    }

    return { totalBytes: expectedAddr, entryCount };
}

function checkRomMap(filePath: string, issues: Issue[]): { entryCount: number; totalBytes: number } {
    const relFile = path.relative(ROOT, filePath);
    if (!fs.existsSync(filePath)) {
        issues.push({ level: 'ERROR', file: relFile, message: 'ROM map file does not exist' });
        return { entryCount: 0, totalBytes: 0 };
    }

    const text = fs.readFileSync(filePath, 'utf8');
    const lines = text.split('\n');

    let entryCount = 0;
    let totalBytes = 0;
    let currentBank = -1;
    let expectedAddr = -1;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;

        if (line.startsWith('## Bank $')) {
            const m = line.match(/## Bank \$([0-9A-Fa-f]{2})/);
            if (m) {
                currentBank = parseInt(m[1], 16);
                expectedAddr = -1;
            }
            continue;
        }

        if (!line.startsWith('|')) continue;
        if (line.includes('| Address |') || line.includes('|---')) continue;

        const parts = splitRow(line);
        // ROM format: | Address | Identifier | Type | Size | Tag | Summary | -> 8 parts
        if (parts.length !== 8 || parts[0] !== '' || parts[7] !== '') {
            issues.push({
                level: 'ERROR',
                file: relFile,
                line: lineNum,
                message: `Malformed ROM table row: expected 6 data columns (got ${parts.length - 2})`,
            });
            continue;
        }

        entryCount++;

        const addrStr = parts[1].replace(/[`$]/g, '');
        const identCol = parts[2];
        const sizeStr = parts[4].replace(/[`B,\s]/g, '');

        const colonIdx = addrStr.indexOf(':');
        if (colonIdx === -1) {
            issues.push({ level: 'ERROR', file: relFile, line: lineNum, message: `Invalid ROM address format: "${parts[1]}"` });
            continue;
        }
        const bank = parseInt(addrStr.slice(0, colonIdx), 16);
        const offset = parseInt(addrStr.slice(colonIdx + 1), 16);
        const size = parseInt(sizeStr, 10);

        if (isNaN(size) || size <= 0) {
            issues.push({ level: 'ERROR', file: relFile, line: lineNum, message: `Invalid ROM size: "${parts[4]}"` });
        } else {
            totalBytes += size;
        }

        const bankHex = bank.toString(16).toUpperCase().padStart(2, '0');

        // Continuity check: no gaps and no overlaps within bank
        if (expectedAddr !== -1) {
            if (offset < expectedAddr) {
                issues.push({
                    level: 'ERROR',
                    file: relFile,
                    line: lineNum,
                    message: `ROM entry overlap in Bank $${bankHex}: starts at $${offset.toString(16).toUpperCase()}, expected >= $${expectedAddr.toString(16).toUpperCase()} (${expectedAddr - offset} bytes overlap with previous entry)`,
                });
            } else if (offset > expectedAddr) {
                issues.push({
                    level: 'ERROR',
                    file: relFile,
                    line: lineNum,
                    message: `ROM entry gap in Bank $${bankHex}: starts at $${offset.toString(16).toUpperCase()}, expected contiguous address $${expectedAddr.toString(16).toUpperCase()} (${offset - expectedAddr} bytes gap)`,
                });
            }
        }
        expectedAddr = offset + (size > 0 ? size : 1);

        // Link validation
        const linkMatch = identCol.match(/\[`?([A-Za-z0-9_]+)`?\]\(([^)]+)\)/);
        if (!linkMatch) {
            issues.push({
                level: 'WARN',
                file: relFile,
                line: lineNum,
                message: `Entry identifier is not formatted as a markdown link: "${identCol}"`,
            });
        } else {
            const relLink = linkMatch[2];
            const targetPath = path.resolve(KNOWLEDGE_ROOT, relLink);
            if (!fs.existsSync(targetPath)) {
                issues.push({
                    level: 'ERROR',
                    file: relFile,
                    line: lineNum,
                    message: `Broken ROM knowledge link: "${relLink}"`,
                });
            }
        }
    }

    return { entryCount, totalBytes };
}

function run(): number {
    const args = process.argv.slice(2);
    const checkWramOnly = args.includes('--wram');
    const checkRomOnly = args.includes('--rom');
    const checkAll = !checkWramOnly && !checkRomOnly;

    console.log('--- Checking Memory Maps ---');
    const issues: Issue[] = [];

    let res7e = { totalBytes: 0, entryCount: 0 };
    let res7f = { totalBytes: 0, entryCount: 0 };
    let resRom = { totalBytes: 0, entryCount: 0 };

    if (checkAll || checkWramOnly) {
        // 1. Docs parity for WRAM
        checkDocsParity(WRAM_7E_PATH, path.join(DOCS_CORE, 'wram-map.md'), issues);
        checkDocsParity(WRAM_7F_PATH, path.join(DOCS_CORE, 'wram-map-7f.md'), issues);

        // 2. Check Bank $7E WRAM
        res7e = checkWramMap(WRAM_7E_PATH, 0x7E, issues);

        // 3. Check Bank $7F WRAM
        res7f = checkWramMap(WRAM_7F_PATH, 0x7F, issues);
    }

    if (checkAll || checkRomOnly) {
        // 4. Docs parity for ROM
        checkDocsParity(ROM_MAP_PATH, path.join(DOCS_CORE, 'rom-map.md'), issues);

        // 5. Check ROM Map
        resRom = checkRomMap(ROM_MAP_PATH, issues);
    }

    // Print summary results
    const errors = issues.filter(i => i.level === 'ERROR');
    const warnings = issues.filter(i => i.level === 'WARN');

    console.log(`\nResults:`);
    if (checkAll || checkWramOnly) {
        console.log(`  WRAM Bank $7E: ${res7e.entryCount} entries, ${res7e.totalBytes} bytes (contiguous 64 KB)`);
        console.log(`  WRAM Bank $7F: ${res7f.entryCount} entries, ${res7f.totalBytes} bytes (contiguous 64 KB)`);
        console.log(`  Total WRAM:    ${res7e.entryCount + res7f.entryCount} entries, ${res7e.totalBytes + res7f.totalBytes} bytes (contiguous 128 KB)`);
    }
    if (checkAll || checkRomOnly) {
        console.log(`  ROM Map:       ${resRom.entryCount} entries, ${resRom.totalBytes} documented bytes`);
    }

    console.log(`\nValidation: ${errors.length} errors, ${warnings.length} warnings`);

    for (const issue of issues) {
        const prefix = issue.level === 'ERROR' ? '❌ ERROR' : '⚠️ WARN';
        const loc = issue.line ? `:${issue.line}` : '';
        console.log(`  ${prefix} [${issue.file}${loc}] ${issue.message}`);
    }

    if (errors.length === 0) {
        console.log('\n✔ Memory map validation succeeded with ZERO errors!');
        return 0;
    } else {
        console.error(`\n✖ Memory map validation failed with ${errors.length} errors.`);
        return 1;
    }
}

process.exit(run());
