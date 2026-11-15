import * as fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const census = JSON.parse(fs.readFileSync('out/c-to-rom/census-valid-bindable.json', 'utf8'));
const vb = census.validBindable;

const cFiles: string[] = [];
function walk(dir: string) {
    for (const f of fs.readdirSync(dir)) {
        const p = join(dir, f);
        if (fs.statSync(p).isDirectory()) walk(p);
        else if (f.endsWith('.c')) cFiles.push(p);
    }
}
walk('reconstructed-c');

const boundAddrs = new Set<number>();
for (const f of cFiles) {
    const content = fs.readFileSync(f, 'utf8');
    for (const m of content.matchAll(/SOE_BIND\s*\(\s*([a-zA-Z0-9_]+)\s*,\s*0x([0-9A-Fa-f]+)\s*,\s*(RTL|RTS)\s*\)/g)) {
        boundAddrs.add(parseInt(m[2], 16));
    }
}

const unhandled = vb.filter((item: any) => !boundAddrs.has(parseInt(item.addr, 16)));
console.log(`Total unhandled candidates: ${unhandled.length}`);

const BATCH_SIZE = 24;
const allHits: { addr: string; count: number }[] = [];

for (let i = 0; i < unhandled.length; i += BATCH_SIZE) {
    const batch = unhandled.slice(i, i + BATCH_SIZE);
    const addrs = batch.map((b: any) => b.addr);
    const bIdx = Math.floor(i / BATCH_SIZE) + 1;
    const totalB = Math.ceil(unhandled.length / BATCH_SIZE);
    process.stdout.write(`Batch ${bIdx}/${totalB} (${addrs.length} addrs)... `);
    const res = spawnSync('npx', ['tsx', 'tools/c-to-rom/worker-replay02.mts', ...addrs], { encoding: 'utf8' });
    if (res.error) {
        console.error('Error running worker:', res.error);
        continue;
    }
    const lines = res.stdout.trim().split('\n');
    const jsonLine = lines[lines.length - 1];
    try {
        const hits = JSON.parse(jsonLine);
        if (hits.length > 0) {
            console.log(`HITS: ${JSON.stringify(hits)}`);
            allHits.push(...hits);
        } else {
            console.log('0 hits');
        }
    } catch {
        console.log(`Failed to parse worker output: ${res.stdout} / ${res.stderr}`);
    }
}

console.log('\n=== All Hits in Replay 02 ===');
console.log('Total hit routines:', allHits.length);
allHits.sort((a, b) => b.count - a.count);
for (const h of allHits) {
    console.log(`  $${h.addr}: ${h.count} calls`);
}
