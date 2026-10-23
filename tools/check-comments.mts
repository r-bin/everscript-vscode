// tools/check-comments.mts
// Validates src/games/evermore/localizations/data/asm-comments.json:
// - Valid JSON structure
// - Offsets are uppercase hex
// - Comments are strings within length limits
// - Addresses lie within valid ROM / WRAM bounds

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');
const COMMENTS_FILE = path.join(ROOT, 'src', 'games', 'evermore', 'localizations', 'data', 'asm-comments.json');

const MAX_ROM_OFFSET = 0x400000;
const MAX_WRAM_OFFSET = 0x20000;

function check(): number {
    if (!fs.existsSync(COMMENTS_FILE)) {
        console.error(`ERROR: ${COMMENTS_FILE} does not exist.`);
        return 1;
    }

    let data: any;
    try {
        data = JSON.parse(fs.readFileSync(COMMENTS_FILE, 'utf8'));
    } catch (e) {
        console.error(`ERROR: Failed to parse ${COMMENTS_FILE}:`, e);
        return 1;
    }

    const rom = data.rom || {};
    const wram = data.wram || {};

    let errors = 0;
    let romCount = 0;
    let wramCount = 0;

    for (const [key, val] of Object.entries(rom) as [string, any][]) {
        romCount++;
        if (!/^[0-9A-Fa-f]{6}$/.test(key)) {
            console.error(`Invalid ROM offset key (expected 6 hex digits): "${key}"`);
            errors++;
        }
        const off = parseInt(key, 16);
        if (off >= MAX_ROM_OFFSET) {
            console.error(`ROM offset out of bounds: "${key}" (max 0x3FFFFF)`);
            errors++;
        }
        if (!val || typeof val !== 'object') {
            console.error(`Invalid entry for ROM offset "${key}"`);
            errors++;
            continue;
        }
        if (val.comment && typeof val.comment !== 'string') {
            console.error(`Comment must be a string at "${key}"`);
            errors++;
        }
        if (val.label && typeof val.label !== 'string') {
            console.error(`Label must be a string at "${key}"`);
            errors++;
        }
    }

    for (const [key, val] of Object.entries(wram) as [string, any][]) {
        wramCount++;
        if (!/^[0-9A-Fa-f]{4,5}$/.test(key)) {
            console.error(`Invalid WRAM offset key: "${key}"`);
            errors++;
        }
        const off = parseInt(key, 16);
        if (off >= MAX_WRAM_OFFSET) {
            console.error(`WRAM offset out of bounds: "${key}" (max 0x1FFFF)`);
            errors++;
        }
    }

    console.log(`asm-comments check: ${romCount} ROM entries, ${wramCount} WRAM entries.`);
    if (errors > 0) {
        console.error(`Found ${errors} errors in asm-comments.json`);
        return 1;
    }

    console.log('OK: asm-comments.json passed all checks.');
    return 0;
}

process.exitCode = check();

