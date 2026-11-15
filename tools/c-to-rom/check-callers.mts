import * as fs from 'node:fs';
import { stripHeader } from './emu.mts';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { baseRomOrExit } = require('../rom.js');

const romPath = baseRomOrExit('evermore');
const rom = stripHeader(new Uint8Array(fs.readFileSync(romPath)));

const hits = JSON.parse(fs.readFileSync('out/c-to-rom/replay02-hits.json', 'utf8'));
const all = [...hits.leaves, ...hits.callers];

function findDirectCallers(addrHex: string) {
    const addr = parseInt(addrHex, 16);
    const bank = addr >> 16;
    const off = addr & 0xFFFF;
    const jslMatches: number[] = [];
    const jsrMatches: number[] = [];

    // Search for JSL (0x22, off_lo, off_hi, bank) across entire ROM
    for (let i = 0; i < rom.length - 3; i++) {
        if (rom[i] === 0x22 && rom[i+1] === (off & 0xFF) && rom[i+2] === ((off >> 8) & 0xFF) && ((rom[i+3] & 0x7F) === (bank & 0x7F))) {
            jslMatches.push(i);
        }
    }

    // Search for JSR (0x20, off_lo, off_hi) in the same bank
    const bankFileStart = (bank & 0x3F) << 16;
    const bankFileEnd = Math.min(rom.length, bankFileStart + 0x10000);
    for (let i = bankFileStart; i < bankFileEnd - 2; i++) {
        if (rom[i] === 0x20 && rom[i+1] === (off & 0xFF) && rom[i+2] === ((off >> 8) & 0xFF)) {
            jsrMatches.push(i);
        }
    }

    // Search for 24-bit pointer
    let ptr24 = 0;
    for (let i = 0; i < rom.length - 2; i++) {
        if (rom[i] === (off & 0xFF) && rom[i+1] === ((off >> 8) & 0xFF) && ((rom[i+2] & 0x7F) === (bank & 0x7F))) {
            ptr24++;
        }
    }

    return { jsl: jslMatches.length, jsr: jsrMatches.length, ptr24 };
}

const directRoutines: any[] = [];
const tableRoutines: any[] = [];
const internalLabels: any[] = [];

for (const item of all) {
    const c = findDirectCallers(item.addr);
    if (c.jsl > 0 || c.jsr > 0) {
        directRoutines.push({ ...item, jsl: c.jsl, jsr: c.jsr });
    } else if (c.ptr24 > 0) {
        tableRoutines.push({ ...item, ptr24: c.ptr24 });
    } else {
        internalLabels.push(item);
    }
}

console.log(`Of ${all.length} candidates:`);
console.log(`  ${directRoutines.length} direct call targets (JSL/JSR)`);
console.log(`  ${tableRoutines.length} 24-bit function pointer table targets`);
console.log(`  ${internalLabels.length} internal branch targets / labels`);

const bindableTotal = directRoutines.length + tableRoutines.length;
console.log(`\n=> Total actual discrete routines: ${bindableTotal}`);

const discrete = [...directRoutines, ...tableRoutines];
discrete.sort((a, b) => b.count - a.count);
console.log('\nTop 30 discrete routines:');
console.table(discrete.slice(0, 30));

fs.writeFileSync('out/c-to-rom/replay02-discrete-routines.json', JSON.stringify({ directRoutines, tableRoutines, discrete }, null, 2));
