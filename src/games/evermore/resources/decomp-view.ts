// Ownership: decompiled C and pseudocode resolution for `soe://rom/<addr>.c` and
// `soe://rom/<addr>.asm?pseudocode=1` (and `soe://bus/<addr>`).
//
// Sources (in order of preference):
// 1. Reconstructed C files (reconstructed-c/<bank>/<addr>_<name>.c)
// 2. Curated clean C decompilation (docs/disassembly/ or knowledge/rom/<addr>.md)
// 3. Mechanical C lift from snesrecomp (out/recomp/project/src/gen/)
// 4. Ghidra pseudocode exports (out/ghidra/ or traces/ghidra/)

import * as fs from 'fs';
import * as path from 'path';
import { getFunction } from '../localizations/functions';
import { hiromFileOffset } from '../../../platform/snes/hirom';
import { cFunctionFor } from './code-c-index';

// dist/ mirrors src/ at the same depth, so four folders up is the repo root from either.
const REPO = path.resolve(__dirname, '..', '..', '..', '..');

/** Decompiled C for a routine, and where it came from. */
interface DecompiledC { source: string; title: string; code: string; path: string }

/** Hex formatting helper. */
const h = (v: number, d: number): string => (v >>> 0).toString(16).toUpperCase().padStart(d, '0');

/** Search reconstructed-c/<bank>/<addr>_<name>.c for a routine C file. */
function findReconstructedC(bus: number): DecompiledC | null {
    const fn = getFunction(bus) || getFunction((hiromFileOffset(bus)) | 0x800000) || getFunction((hiromFileOffset(bus)) | 0xC00000);
    const indexed = cFunctionFor(bus, fn ? fn.id : null);   // the file that defines this routine (code-c-index.ts)
    if (indexed) {
        return { source: 'reconstructed-c', title: path.basename(indexed.file, '.c'), code: fs.readFileSync(path.join(REPO, indexed.file), 'utf8').trim(), path: indexed.file };
    }
    const reconDir = path.join(REPO, 'reconstructed-c');
    if (!fs.existsSync(reconDir)) return null;

    const bank = (bus >> 16) & 0xFF;
    const hexBank = bank.toString(16).toUpperCase().padStart(2, '0');
    const hexAddr = (bus & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
    const hexFull = bus.toString(16).toUpperCase().padStart(6, '0');
    const off = hiromFileOffset(bus);
    const hexOff = off.toString(16).toUpperCase().padStart(6, '0');

    const dirsToCheck = [
        path.join(reconDir, hexBank),
        path.join(reconDir, hexBank.toLowerCase()),
        reconDir,
    ];

    for (const dir of dirsToCheck) {
        if (!fs.existsSync(dir)) continue;
        try {
            const files = fs.readdirSync(dir);
            for (const f of files) {
                if (!f.endsWith('.c')) continue;
                const base = f.replace(/\.c$/, '');
                const matchAddr = base.startsWith(hexFull) || base.startsWith(hexOff) || base.startsWith(hexAddr);
                const matchName = fn && (base.includes(fn.name) || base.endsWith(`_${fn.name}`));
                if (matchAddr || matchName) {
                    const code = fs.readFileSync(path.join(dir, f), 'utf8');
                    return {
                        source: 'reconstructed-c',
                        title: base,
                        code: code.trim(),
                        path: path.relative(REPO, path.join(dir, f)),
                    };
                }
            }
        } catch {
            // Ignored
        }
    }
    return null;
}

/** Search docs/disassembly/ for a C code block covering this routine. */
function findCuratedC(bus: number): DecompiledC | null {
    const fn = getFunction(bus) || getFunction((hiromFileOffset(bus)) | 0x800000) || getFunction((hiromFileOffset(bus)) | 0xC00000);
    const disasmDir = path.join(REPO, 'docs', 'disassembly');
    if (!fs.existsSync(disasmDir)) return null;

    const hexBus = (bus & 0xFFFF).toString(16).toUpperCase();
    const hexFull = bus.toString(16).toUpperCase();

    // Walk subdirectories under docs/disassembly/
    function walk(dir: string): string[] {
        let results: string[] = [];
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                results = results.concat(walk(full));
            } else if (entry.isFile() && entry.name.endsWith('.md')) {
                results.push(full);
            }
        }
        return results;
    }

    const mdFiles = walk(disasmDir);
    let best: DecompiledC | null = null;
    let bestScore = -1;

    for (const f of mdFiles) {
        const text = fs.readFileSync(f, 'utf8');
        // Match address in text
        if (!text.includes(hexBus) && (!fn || !text.includes(fn.name))) continue;
        // Extract C code block
        const m = /```c\n([\s\S]*?)```/.exec(text);
        if (!m) continue;

        // Score relevance: title match > early header match > casual mention
        let score = 1;
        const firstLines = text.split('\n').slice(0, 10).join('\n');
        if (firstLines.includes(hexBus)) score += 10;
        if (fn && firstLines.includes(fn.name)) score += 10;
        if (text.includes(`$${hexFull}`)) score += 5;

        if (score > bestScore) {
            bestScore = score;
            best = {
                source: 'curated',
                title: fn ? fn.name : `$${hexFull}`,
                code: m[1].trim(),
                path: path.relative(REPO, f),
            };
        }
    }
    return best;
}

/** Search out/recomp/project/src/gen/ for mechanical snesrecomp C. */
function findRecompC(bus: number): DecompiledC | null {
    const genDir = path.join(REPO, 'out', 'recomp', 'project', 'src', 'gen');
    if (!fs.existsSync(genDir)) return null;

    const bank = (bus >> 16) & 0xFF;
    const addr = bus & 0xFFFF;
    const hexAddr = h(addr, 4);

    // Possible function naming conventions in snesrecomp
    const patterns = [
        new RegExp(`(RecompReturn|void)\\s+(func_C0${hexAddr}|bank_${h(bank, 2)}_${hexAddr}|[a-zA-Z0-9_]*${hexAddr}[a-zA-Z0-9_]*)\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)(?:\\n\\}|RecompReturn|void\\s+func_)`, 'i'),
    ];

    try {
        const files = fs.readdirSync(genDir).filter(f => f.endsWith('.c'));
        for (const f of files) {
            const content = fs.readFileSync(path.join(genDir, f), 'utf8');
            for (const p of patterns) {
                const match = p.exec(content);
                if (match) {
                    const funcSignature = match[1] + ' ' + match[2] + '(CpuState *cpu)';
                    const snippet = match[0].slice(0, 1500).trimEnd();
                    return {
                        source: 'snesrecomp',
                        title: match[2],
                        code: snippet + (snippet.endsWith('}') ? '' : '\n    // ... [truncated for brevity]\n}'),
                        path: path.join('out/recomp/project/src/gen', f),
                    };
                }
            }
        }
    } catch {
        // Ignored if recomp directory is absent
    }
    return null;
}

/** Find decompiled C or pseudocode from any available source. */
function getDecompiledC(bus: number): DecompiledC | null {
    const recon = findReconstructedC(bus);
    if (recon) return recon;

    const curated = findCuratedC(bus);
    if (curated) return curated;

    const recomp = findRecompC(bus);
    if (recomp) return recomp;

    // Fallback: minimal signature from function metadata if known
    const fn = getFunction(bus);
    if (fn) {
        return {
            source: 'stub',
            title: fn.name,
            code: `// ${fn.name} ($${h(bus, 6)})\n// Confidence: ${fn.confidence || 'unverified'}\nvoid ${fn.id || fn.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}(void) {\n    // TODO: Decompilation pending\n}`,
            path: 'knowledge/rom',
        };
    }

    return null;
}

/** Render a standalone .c listing for a given bus address. */
function cListing(rom: unknown, bus: number): string {
    const decomp = getDecompiledC(bus);
    if (decomp) {
        return `// ==============================================================================\n// Decompiled C: ${decomp.title}\n// Source: ${decomp.source} (${decomp.path})\n// ==============================================================================\n\n${decomp.code}\n`;
    }
    return `// No decompiled C found for address $${h(bus, 6)}.\n// You can run decomp-curator or inspect soe://rom/${h(hiromFileOffset(bus), 6)}.asm\n`;
}

export { getDecompiledC, cListing };

