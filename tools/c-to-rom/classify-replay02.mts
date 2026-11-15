import * as fs from 'node:fs';
import { walk } from './disasm.mts';
import { stripHeader } from './emu.mts';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { baseRomOrExit } = require('../rom.js');

const romPath = baseRomOrExit('evermore');
const rom = stripHeader(new Uint8Array(fs.readFileSync(romPath)));

const logFile = process.argv[2] || 'out/c-to-rom/replay02-hits.txt';
const log = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : '';
const hitsIdx = log.indexOf('=== All Hits in Replay 02 ===');
const hitsText = log.substring(hitsIdx);
const lines = hitsText.split('\n').filter(l => l.trim().startsWith('$'));
const hitMap = new Map<number, number>();
for (const l of lines) {
    const m = l.match(/\$([0-9a-fA-F]+):\s+(\d+)\s+calls/);
    if (m) hitMap.set(parseInt(m[1], 16), parseInt(m[2], 10));
}

const leaves: any[] = [];
const callers: any[] = [];

for (const [addr, count] of hitMap.entries()) {
    try {
        const lines = walk(rom, addr, null);
        const hasCall = lines.some(l => l.text.startsWith('JSR') || l.text.startsWith('JSL'));
        let ret = 'unknown';
        if (lines.some(l => l.text.startsWith('RTL'))) ret = 'RTL';
        else if (lines.some(l => l.text.startsWith('RTS'))) ret = 'RTS';
        
        const info = {
            addr: addr.toString(16),
            count,
            insns: lines.length,
            ret
        };
        if (hasCall) callers.push(info);
        else leaves.push(info);
    } catch (e: any) {
        console.error(`Error walking $${addr.toString(16)}: ${e.message}`);
    }
}

console.log(`Classified: ${leaves.length} pure leaves, ${callers.length} callers.`);
leaves.sort((a, b) => b.count - a.count);
console.log('\nTop 25 pure leaves:');
console.table(leaves.slice(0, 25));

callers.sort((a, b) => b.count - a.count);
console.log('\nTop 25 callers:');
console.table(callers.slice(0, 25));

fs.writeFileSync('out/c-to-rom/replay02-hits.json', JSON.stringify({ leaves, callers }, null, 2));
