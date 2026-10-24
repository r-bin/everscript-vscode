// Compare the compiled assembly of a reconstructed C routine against the initial ROM assembly.
//   node tools/c-to-rom/diff-asm.mts <routine_name_or_file> [--rom <clean rom>]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { REPO, stripHeader, hex } from './emu.mts';
import { calypsi } from './calypsi.mts';
import { walk, cdlFor, fileOffset } from './disasm.mts';
import { bindings, sourceFiles, OUT } from './build.mts';

const require = createRequire(import.meta.url);

const a = process.argv.slice(2);
const opt = (n: string) => { const i = a.indexOf('--' + n); return i < 0 ? null : a[i + 1]; };
const target = a.find(arg => !arg.startsWith('--'));

if (!target) {
    console.error('Usage: node tools/c-to-rom/diff-asm.mts <routine_name_or_c_file> [--rom <clean rom>]');
    process.exit(2);
}

const romPath: string = require('../rom').baseRomOrExit('evermore', opt('rom'));
const rom = stripHeader(new Uint8Array(readFileSync(romPath)));
const cdl = cdlFor(rom);

const files = sourceFiles();
const allBindings = bindings(files);

const binding = allBindings.find(b => b.name === target || b.file.includes(target) || hex(b.addr).toLowerCase().includes(target.toLowerCase()));
if (!binding) {
    console.error(`Routine '${target}' not found among bound C files. Available:`);
    for (const b of allBindings) console.error(`  ${b.name.padEnd(35)} ${hex(b.addr)} (${b.file})`);
    process.exit(1);
}

// 1. Initial ROM Assembly
const initialAsm = walk(rom, binding.addr, cdl);
const initialListing = initialAsm.map(l => {
    const bytesStr = l.bytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ').padEnd(10);
    return `${hex(l.pc, 6)}  ${bytesStr} ${l.text}`;
});

// 2. Compile C to Assembly with Calypsi
const cc = await calypsi('cc65816');
mkdirSync(OUT, { recursive: true });
const asmOut = join(OUT, `${binding.name}.s`);
const srcPath = join(REPO, binding.file);

execFileSync(cc, [
    '--target=snes',
    '--core=65816',
    '--code-model=large',
    '--data-model=large',
    '-O1',
    '--speed',
    '-I', join(REPO, 'reconstructed-c/include'),
    '--assembly-source', asmOut,
    srcPath,
]);

const compiledLines = readFileSync(asmOut, 'utf8').split('\n');
// Filter to the function body
const fnStart = compiledLines.findIndex(l => l.includes(`${binding.name}_bind:`) || l.includes(`${binding.name}:`));
const fnLines = fnStart >= 0 ? compiledLines.slice(fnStart, fnStart + 60) : compiledLines.slice(0, 60);

console.log('='.repeat(80));
console.log(`ROUTINE: ${binding.name} (${hex(binding.addr)}) [${binding.ret}]`);
console.log(`SOURCE:  ${binding.file}`);
console.log('='.repeat(80));

console.log('\n--- [1] INITIAL ROM ASSEMBLY ---');
console.log(`Total instructions: ${initialAsm.length}`);
for (const line of initialListing.slice(0, 35)) console.log(`  ${line}`);
if (initialListing.length > 35) console.log(`  ... (${initialListing.length - 35} more instructions)`);

console.log('\n--- [2] COMPILED C ASSEMBLY (Calypsi 65816 -O1 --speed) ---');
for (const line of fnLines.slice(0, 40)) {
    if (line.trim().startsWith(';') && !line.trim().startsWith('; Generated')) continue;
    console.log(`  ${line}`);
}
if (fnLines.length > 40) console.log(`  ...`);

console.log('='.repeat(80));
