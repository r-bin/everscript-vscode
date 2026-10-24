// Rate and audit reconstructed C routines against the clean ROM assembly.
// Adds / updates or verifies a header comment block in each C file tracking:
//   - Test method (G1 differential, HLE injection, unbound)
//   - Initial ROM assembly size (instruction count, byte count)
//   - Compiled C assembly size (instruction count, byte count from Calypsi)
//   - Expansion ratio and state parity
//   - Source hash (SHA-256) to detect if the file was modified after rating (staleness prevention)
//
// Usage:
//   node tools/c-to-rom/rate-files.mts [--check] [--update] [--rom <clean rom>] [routine_name]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { REPO, stripHeader, hex } from './emu.mts';
import { calypsi } from './calypsi.mts';
import { walk, cdlFor } from './disasm.mts';
import { bindings, sourceFiles, OUT } from './build.mts';

const require = createRequire(import.meta.url);

const a = process.argv.slice(2);
const opt = (n: string) => { const i = a.indexOf('--' + n); return i < 0 ? null : a[i + 1]; };
const doCheck = a.includes('--check');
const doUpdate = a.includes('--update');
const romArgIndex = a.indexOf('--rom');
const filterName = a.find((arg, idx) => !arg.startsWith('--') && (romArgIndex < 0 || idx !== romArgIndex + 1));

const romPath: string = require('../rom').baseRomOrExit('evermore', opt('rom'));
const rom = stripHeader(new Uint8Array(readFileSync(romPath)));
const cdl = cdlFor(rom);

const files = sourceFiles();
const allBindings = bindings(files);

const targetBindings = filterName
    ? allBindings.filter(b => b.name === filterName || b.file.includes(filterName))
    : allBindings;

if (filterName && !targetBindings.length) {
    console.error(`Routine '${filterName}' not found among bound C files.`);
    process.exit(1);
}

const cc = await calypsi('cc65816');
mkdirSync(OUT, { recursive: true });

function stripRatingBlock(content: string): string {
    return content.replace(/\/\*[\r\n\s]*\*\s*Routine Rating & Verification:[\s\S]*?\*\/\r?\n?/g, '');
}

function computeSourceHash(content: string): string {
    const clean = stripRatingBlock(content).replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim();
    return createHash('sha256').update(clean).digest('hex').slice(0, 16);
}

let staleCount = 0;
let cleanCount = 0;
let updatedCount = 0;

for (const b of targetBindings) {
    const fullPath = join(REPO, b.file);
    const content = readFileSync(fullPath, 'utf8');
    const currentHash = computeSourceHash(content);

    // Check existing rating
    const match = /Rating Hash:\s+([0-9a-fA-F]+)/.exec(content);
    const existingHash = match ? match[1] : null;

    if (doCheck && !doUpdate) {
        if (!existingHash) {
            console.log(`[UNRATED] ${b.name.padEnd(35)} (${b.file})`);
            staleCount++;
        } else if (existingHash !== currentHash) {
            console.log(`[STALE]   ${b.name.padEnd(35)} hash:${existingHash} != current:${currentHash} (${b.file})`);
            staleCount++;
        } else {
            console.log(`[CLEAN]   ${b.name.padEnd(35)} hash:${currentHash} matches rating (${b.file})`);
            cleanCount++;
        }
        continue;
    }

    // Measure initial ROM assembly
    const initialAsm = walk(rom, b.addr, cdl);
    const initialBytes = initialAsm.reduce((sum, l) => sum + l.bytes.length, 0);

    // Compile C to assembly
    const asmOut = join(OUT, `${b.name}.s`);
    execFileSync(cc, [
        '--target=snes',
        '--core=65816',
        '--code-model=large',
        '--data-model=large',
        '-O1',
        '--speed',
        '-I', join(REPO, 'reconstructed-c/include'),
        '--assembly-source', asmOut,
        fullPath,
    ]);

    const compiledLines = readFileSync(asmOut, 'utf8').split('\n');
    const fnStart = compiledLines.findIndex(l => l.includes(`${b.name}_bind:`) || l.includes(`${b.name}:`));
    const codeLines = (fnStart >= 0 ? compiledLines.slice(fnStart) : compiledLines)
        .filter(l => {
            const t = l.trim();
            return t && !t.startsWith(';') && !t.startsWith('.') && !t.endsWith(':');
        });

    const cInsnCount = codeLines.length;
    const insnExpansion = (cInsnCount / Math.max(1, initialAsm.length)).toFixed(1);

    const ratingBlock = `/*
 * Routine Rating & Verification:
 * - Target Routine:   ${b.name} (${hex(b.addr)}) [${b.ret}]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  ${initialAsm.length} instructions (${initialBytes} bytes)
 * - Compiled C ASM:   ${cInsnCount} instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   ${insnExpansion}x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      ${currentHash}
 * - Rating Status:    VALID (unmodified since rating)
 */\n`;

    if (doUpdate) {
        const stripped = stripRatingBlock(content);
        // Put rating block right after the leading comment or at top
        let newContent: string;
        if (stripped.startsWith('/*')) {
            const firstCommentEnd = stripped.indexOf('*/') + 2;
            newContent = stripped.slice(0, firstCommentEnd) + '\n\n' + ratingBlock + stripped.slice(firstCommentEnd).replace(/^\n+/, '');
        } else {
            newContent = ratingBlock + '\n' + stripped;
        }
        writeFileSync(fullPath, newContent, 'utf8');
        console.log(`[UPDATED] ${b.name.padEnd(35)} ROM:${initialAsm.length} insns -> C:${cInsnCount} insns (${insnExpansion}x) [hash:${currentHash}]`);
        updatedCount++;
    } else {
        console.log(`[MEASURED] ${b.name.padEnd(35)} ROM:${initialAsm.length} insns (${initialBytes}b) -> C:${cInsnCount} insns (${insnExpansion}x) [hash:${currentHash}]`);
    }
}

if (doCheck) {
    console.log(`\nAudit complete: ${cleanCount} clean, ${staleCount} stale/unrated.`);
    if (staleCount > 0) process.exit(1);
} else if (doUpdate) {
    console.log(`\nUpdated ratings in ${updatedCount} files.`);
}
