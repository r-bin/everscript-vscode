// Build the standalone bootable SNES ROM (.sfc) compiled ENTIRELY from C files
// using the Calypsi 65816 toolchain.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { calypsi, CALYPSI_HOME } from '../tools/c-to-rom/calypsi.mts';
import { REPO } from '../tools/c-to-rom/emu.mts';
import { extractAssets } from './extract-assets.mts';

export const C_ROM_DIR = join(REPO, 'standalone-c-rom');
export const OUT_DIR = join(REPO, 'out/standalone-c-rom');
export const OUT_SFC = join(REPO, 'out/intro-replay.sfc');

const MODEL_FLAGS = [
    '--target=snes',
    '--core=65816',
    '--code-model=large',
    '--data-model=large',
    '-O1',
    '--speed',
    '--no-cross-call',
    '--force-switch=if-else',
];

const SOURCES = [
    'main.c',
    'snes_hw.c',
    'ppu.c',
    'nmi.c',
    'intro_replay.c',
    'header.c',
    'assets.c',
];

export async function buildStandaloneRom(options: { forceExtract?: boolean } = {}): Promise<string> {
    mkdirSync(OUT_DIR, { recursive: true });
    mkdirSync(join(REPO, 'out'), { recursive: true });

    const assetsFile = join(C_ROM_DIR, 'assets.c');
    if (!existsSync(assetsFile) || options.forceExtract) {
        console.log('Extracting assets from clean ROM...');
        await extractAssets();
    }

    const cc = await calypsi('cc65816');
    const ln = await calypsi('ln65816');

    // 1. Compile all C sources to object files
    const objFiles: string[] = [];
    for (const src of SOURCES) {
        const srcPath = join(C_ROM_DIR, src);
        const objPath = join(OUT_DIR, src.replace(/\.c$/, '.o'));
        console.log(`Compiling ${src} with Calypsi cc65816...`);
        execFileSync(cc, [
            ...MODEL_FLAGS,
            '-I', C_ROM_DIR,
            srcPath,
            '-o', objPath,
        ], { stdio: ['ignore', 'inherit', 'inherit'] });
        objFiles.push(objPath);
    }

    // 2. Link using snes-HiROM-1MB.scm and clib-lc-ld-snes.a
    const linkerScript = join(C_ROM_DIR, 'snes-HiROM-1MB.scm');
    const clib = join(CALYPSI_HOME, 'lib/clib-lc-ld-snes.a');
    const elfPath = join(OUT_DIR, 'intro-replay.elf');
    const lstPath = join(OUT_DIR, 'intro-replay.lst');

    console.log('Linking with Calypsi ln65816 (1 MB HiROM + FastROM)...');
    execFileSync(ln, [
        '--target=snes',
        '--root-symbol', 'snes_header',
        '--output-format', 'intel-hex',
        '--list-file', lstPath,
        ...objFiles,
        linkerScript,
        clib,
        '-o', elfPath,
    ], { stdio: ['ignore', 'inherit', 'inherit'] });

    // 3. Convert Intel-HEX output to 1 MB .sfc image
    const hexPath = elfPath.replace(/\.elf$/, '.hex');
    const hexText = readFileSync(hexPath, 'utf8');

    const ROM_SIZE = 1024 * 1024; // 1 MB
    const rom = new Uint8Array(ROM_SIZE);

    let upper = 0;
    for (const line of hexText.split(/\r?\n/)) {
        if (!line.startsWith(':')) continue;
        const b = Buffer.from(line.slice(1), 'hex');
        const n = b[0], addr = (b[1] << 8) | b[2], type = b[3];
        if (type === 0) {
            const fullAddr = upper + addr;
            let fileOffset = 0;
            const bank = (fullAddr >> 16) & 0xFF;
            const off = fullAddr & 0xFFFF;
            if (bank >= 0xC0 && bank <= 0xCF) {
                fileOffset = ((bank & 0x3F) << 16) | off;
            } else if (bank === 0x00 && off >= 0x8000) {
                fileOffset = off;
            } else {
                continue;
            }
            for (let i = 0; i < n; i++) {
                if (fileOffset + i < ROM_SIZE) {
                    rom[fileOffset + i] = b[4 + i];
                }
            }
        } else if (type === 4) {
            upper = ((b[4] << 8) | b[5]) << 16;
        }
    }

    // Compute SNES standard checksum and complement
    let sum = 0;
    for (let i = 0; i < ROM_SIZE; i++) {
        if (i !== 0xFFDC && i !== 0xFFDD && i !== 0xFFDE && i !== 0xFFDF) {
            sum = (sum + rom[i]) & 0xFFFF;
        }
    }
    const complement = (~sum) & 0xFFFF;
    rom[0xFFDC] = complement & 0xFF;
    rom[0xFFDD] = (complement >> 8) & 0xFF;
    rom[0xFFDE] = sum & 0xFF;
    rom[0xFFDF] = (sum >> 8) & 0xFF;

    writeFileSync(OUT_SFC, rom);
    console.log(`Successfully built ${OUT_SFC} (${rom.length} bytes)!`);
    return OUT_SFC;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    await buildStandaloneRom();
}
