// Unit test for Reconstructed C vs ROM Assembly Parity and Expansion Ratio.
// Verifies each bound C routine against its original ROM assembly:
//   - Generates the clickable VFS link (`soe://rom/code/<name>/?asm=1`)
//   - Disassembles the original ROM routine and counts instructions & bytes
//   - Compiles the C routine with Calypsi (both default and --optimize if present)
//   - Verifies the ratio vs ~1.0x target and flags routines exceeding > 1.0x for optimization
import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { bindings, sourceFiles, OUT } from '../../tools/c-to-rom/build.mts';
import { walk, cdlFor } from '../../tools/c-to-rom/disasm.mts';
import { calypsi } from '../../tools/c-to-rom/calypsi.mts';
import { REPO, stripHeader, hex } from '../../tools/c-to-rom/emu.mts';

const require = createRequire(import.meta.url);
let romPath: string | null = null;
try {
    romPath = require('../../dist/games').romPath('evermore');
} catch {}
if (!romPath && existsSync(REPO)) {
    const { readdirSync } = await import('node:fs');
    const f = readdirSync(REPO).find(x => /\.(smc|sfc)$/i.test(x));
    if (f) romPath = join(REPO, f);
}

if (!romPath || !existsSync(romPath)) {
    console.log('[SKIP] c-asm-parity.test: evermore base ROM not found.');
    process.exitCode = 0;
} else {
    runTests();
}

async function runTests() {
    console.log('Reconstructed C to ROM Assembly Parity & Expansion Ratio Tests:');

    const rom = stripHeader(new Uint8Array(readFileSync(romPath!)));
    const cdl = cdlFor(rom);
    const files = sourceFiles();
    const list = bindings(files);
    const cc = await calypsi('cc65816');

    assert(list.length > 0, 'Expected at least one bound C routine');

    let totalOriginalInsns = 0;
    let totalCompiledInsns = 0;
    const overThreshold: Array<{ name: string; ratio: number; vfs: string }> = [];

    for (const b of list) {
        const fullPath = join(REPO, b.file);
        const originalAsm = walk(rom, b.addr, cdl);
        const originalBytes = originalAsm.reduce((sum, l) => sum + l.bytes.length, 0);
        const originalCount = Math.max(1, originalAsm.length);

        const content = readFileSync(fullPath, 'utf8');
        const hasOptimize = content.includes('SOE_OPTIMIZE') || content.includes('SOE_USE_ASM');

        // Compile documented C routine
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

        const compiledCount = codeLines.length;
        const ratio = compiledCount / originalCount;
        totalOriginalInsns += originalCount;
        totalCompiledInsns += compiledCount;

        let optRatioText = '';
        if (hasOptimize) {
            const optAsmOut = join(OUT, `${b.name}_opt.s`);
            execFileSync(cc, [
                '--target=snes',
                '--core=65816',
                '--code-model=large',
                '--data-model=large',
                '-O1',
                '--speed',
                '-DSOE_OPTIMIZE',
                '-DSOE_USE_ASM',
                '-I', join(REPO, 'reconstructed-c/include'),
                '--assembly-source', optAsmOut,
                fullPath,
            ]);
            const optLines = readFileSync(optAsmOut, 'utf8').split('\n');
            const optStart = optLines.findIndex(l => l.includes(`${b.name}_bind:`) || l.includes(`${b.name}:`));
            const optCodeLines = (optStart >= 0 ? optLines.slice(optStart) : optLines)
                .filter(l => {
                    const t = l.trim();
                    return t && !t.startsWith(';') && !t.startsWith('.') && !t.endsWith(':');
                });
            const optCount = optCodeLines.length;
            const optRatio = optCount / originalCount;
            optRatioText = ` | SOE_OPTIMIZE: ${optCount} (${optRatio.toFixed(1)}x)`;
        }

        const vfsLink = `soe://rom/code/${b.name}/?asm=1`;

        const status = ratio <= 1.05 ? 'PERFECT (~1.0x)' : ratio <= 2.0 ? 'ACCEPTABLE' : 'NEEDS OPTIMIZATION';
        console.log(`  [${status}] ${b.name.padEnd(32)} ROM:${originalCount} -> C:${compiledCount} (${ratio.toFixed(1)}x)${optRatioText} -> ${vfsLink}`);

        if (ratio > 1.05) {
            overThreshold.push({ name: b.name, ratio, vfs: vfsLink });
        }
    }

    const overallRatio = totalCompiledInsns / totalOriginalInsns;
    console.log(`\nTotal: ${list.length} routines, ROM: ${totalOriginalInsns} insns, C: ${totalCompiledInsns} insns (overall ${overallRatio.toFixed(1)}x)`);

    if (overThreshold.length > 0) {
        console.log(`\nNote: ${overThreshold.length} routine(s) exceed 1.0x target and are candidates for inline asm (__asm / SOE_OPTIMIZE):`);
        for (const item of overThreshold) {
            console.log(`  - ${item.name.padEnd(32)} (${item.ratio.toFixed(1)}x) : ${item.vfs}`);
        }
    }

    // Verify all bound routines exist and successfully compile
    assert(totalCompiledInsns > 0, 'Compilation failed to emit instructions');
    console.log('\n[PASS] Reconstructed C assembly parity test suite ran successfully.');
}
