#!/usr/bin/env node
/**
 * tools/ghidra/gen-seeds.mts
 *
 * Generates the Ghidra / REA seed TSV file from the CDL library export:
 *   address<TAB>function|code|label[<TAB>name]
 *
 * Execution address rule (HiROM):
 *   off & 0x8000 ? 0x800000 + off : 0xC00000 + off
 *
 * Outputs:
 *   traces/rea/soe-seeds.tsv          (used by REA via REA_GHIDRA_SEED_FILE)
 *   traces/rea/soe-context.tsv        (M/X width context per recorded opcode head)
 *   out/recomp/asar/ghidra/seeds.tsv   (alongside the Asar export)
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO = path.resolve(__dirname, '..', '..');

interface FunctionRecord {
    name: string;
    romOffset: number;
    size?: number;
    bus?: number;
}

interface ExportJson {
    labels?: [string, number][];
}

function hexAddr(n: number, pad = 6): string {
    return '0x' + n.toString(16).toUpperCase().padStart(pad, '0');
}

function executionAddress(off: number): number {
    return (off & 0x8000) ? 0x800000 + off : 0xC00000 + off;
}

export async function generateSeeds(options: {
    asarDir?: string;
    outTsv?: string;
    outContextTsv?: string;
    outAsarTsv?: string;
} = {}) {
    const asarDir = options.asarDir || path.join(REPO, 'out', 'recomp', 'asar');
    const outTsv = options.outTsv || path.join(REPO, 'traces', 'rea', 'soe-seeds.tsv');
    const outContextTsv = options.outContextTsv || path.join(REPO, 'traces', 'rea', 'soe-context.tsv');
    const outAsarTsv = options.outAsarTsv || path.join(asarDir, 'ghidra', 'seeds.tsv');

    const funcsPath = path.join(asarDir, 'functions.json');
    const exportPath = path.join(asarDir, 'export.json');
    const cdlPath = path.join(asarDir, 'rom.cdl');

    if (!fs.existsSync(funcsPath)) {
        throw new Error(`Missing ${funcsPath}. Run npm run recomp first to produce the Asar/CDL export.`);
    }

    const funcs: FunctionRecord[] = JSON.parse(fs.readFileSync(funcsPath, 'utf8'));
    const exp: ExportJson = fs.existsSync(exportPath) ? JSON.parse(fs.readFileSync(exportPath, 'utf8')) : {};
    const cdlBuf = fs.existsSync(cdlPath) ? fs.readFileSync(cdlPath) : null;

    // Load knowledge entries for RAM if available
    let ramEntries: { addr: number; name: string }[] = [];
    try {
        const { entries } = await import(path.join(REPO, 'dist', 'games', 'evermore', 'localizations', 'knowledge.js'));
        ramEntries = entries('ram').map((e: any) => ({ addr: e.addr, name: e.title || e.name }));
    } catch {
        // Fallback if dist/ not built yet
    }

    const rows: { addr: number; kind: 'function' | 'code' | 'label'; name: string }[] = [];
    const seenAddrs = new Set<number>();

    // 1. Function rows from functions.json
    for (const f of funcs) {
        const execAddr = executionAddress(f.romOffset);
        if (seenAddrs.has(execAddr)) continue;
        seenAddrs.add(execAddr);
        let name = f.name;
        if (/^func_[0-9A-F]+$/i.test(name)) {
            name = `func_${execAddr.toString(16).toUpperCase()}`;
        }
        rows.push({
            addr: execAddr,
            kind: 'function',
            name,
        });
    }

    // 2. Labels and code targets from export.json
    if (exp.labels) {
        for (const [name, off] of exp.labels) {
            const execAddr = executionAddress(off);
            if (seenAddrs.has(execAddr)) continue;

            if (name.startsWith('loc_')) {
                seenAddrs.add(execAddr);
                rows.push({
                    addr: execAddr,
                    kind: 'code',
                    name: `loc_${execAddr.toString(16).toUpperCase()}`,
                });
            } else if (name.startsWith('tbl_') || name.startsWith('data_') || name.startsWith('gfx_') || name.startsWith('ptrs_')) {
                // Table / data / graphics asset
                seenAddrs.add(execAddr);
                rows.push({
                    addr: execAddr,
                    kind: 'label',
                    name,
                });
            } else if (!name.startsWith('func_') && !name.startsWith('seg_')) {
                // Named routine or asset
                seenAddrs.add(execAddr);
                rows.push({
                    addr: execAddr,
                    kind: 'label',
                    name,
                });
            }
        }
    }

    // 3. WRAM labels
    for (const r of ramEntries) {
        const wramAddr = 0x7E0000 + (r.addr & 0xFFFF);
        if (seenAddrs.has(wramAddr)) continue;
        seenAddrs.add(wramAddr);
        rows.push({
            addr: wramAddr,
            kind: 'label',
            name: r.name.replace(/[^a-zA-Z0-9_]/g, '_'),
        });
    }

    // Sort by address
    rows.sort((a, b) => a.addr - b.addr);

    // Format TSV lines (REA constraint: code seeds take no name)
    const tsvLines = rows.map(r => {
        if (r.kind === 'code') return `${hexAddr(r.addr)}\tcode`;
        return r.name ? `${hexAddr(r.addr)}\t${r.kind}\t${r.name}` : `${hexAddr(r.addr)}\t${r.kind}`;
    });

    // Ensure output directories exist
    fs.mkdirSync(path.dirname(outTsv), { recursive: true });
    fs.writeFileSync(outTsv, tsvLines.join('\n') + '\n', 'utf8');

    fs.mkdirSync(path.dirname(outAsarTsv), { recursive: true });
    fs.writeFileSync(outAsarTsv, tsvLines.join('\n') + '\n', 'utf8');

    // 4. Width context from rom.cdl (Bit 0x20: ACC8, Bit 0x10: IDX8)
    let contextCount = 0;
    if (cdlBuf) {
        const contextLines: string[] = [];
        for (let off = 0; off < cdlBuf.length; off++) {
            const b = cdlBuf[off];
            // If marked as CODE (bit 0x01) or SUB (0x08)
            if (b & 0x09) {
                const execAddr = executionAddress(off);
                const mWidth = (b & 0x20) ? 8 : 16;
                const xWidth = (b & 0x10) ? 8 : 16;
                contextLines.push(`${hexAddr(execAddr)}\t${mWidth}\t${xWidth}`);
            }
        }
        if (contextLines.length > 0) {
            fs.mkdirSync(path.dirname(outContextTsv), { recursive: true });
            fs.writeFileSync(outContextTsv, contextLines.join('\n') + '\n', 'utf8');
            contextCount = contextLines.length;
        }
    }

    return {
        totalRows: rows.length,
        functions: funcs.length,
        codeTargets: rows.filter(r => r.kind === 'code').length,
        labels: rows.filter(r => r.kind === 'label').length,
        contextCount,
        outTsv,
        outContextTsv,
        outAsarTsv,
    };
}

// CLI entrypoint
if (process.argv[1] === __filename) {
    const result = await generateSeeds();
    console.log(`Generated Ghidra/REA seeds:`);
    console.log(`  Functions:   ${result.functions}`);
    console.log(`  Code targets:${result.codeTargets}`);
    console.log(`  Labels:      ${result.labels}`);
    console.log(`  Total seeds: ${result.totalRows}`);
    console.log(`  Context rows:${result.contextCount}`);
    console.log(`  Output:      ${result.outTsv}`);
    console.log(`  Asar mirror: ${result.outAsarTsv}`);
    console.log(`  Context TSV: ${result.outContextTsv}`);
}
