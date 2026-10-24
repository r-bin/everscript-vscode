// Hash streams of runs that do not change (vanilla, a fixed replay) under out/compare/cache/: one line per key,
// "key crc crc ..." for every frame, so a cached reference serves any stride. About 170 KB per 8414-frame run.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { REPO } from '../c-to-rom/emu.mts';
import type { Crcs } from './diff.mts';

const DIR = join(REPO, 'out', 'compare', 'cache');

export function cacheKey(parts: Record<string, unknown>): string {
    return createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 24);
}

export function fileHash(file: string): string {
    return createHash('sha256').update(readFileSync(file)).digest('hex');
}

export function loadCache(key: string): Map<number, Crcs> | null {
    const f = join(DIR, key + '.txt');
    if (!existsSync(f)) return null;
    const m = new Map<number, Crcs>();
    for (const line of readFileSync(f, 'utf8').split('\n')) {
        if (!line) continue;
        const p = line.split(' ');
        m.set(Number(p[0]), p.slice(1).map(x => parseInt(x, 16)));
    }
    return m;
}

export function saveCache(key: string, m: Map<number, Crcs>): void {
    mkdirSync(DIR, { recursive: true });
    const lines = [...m].map(([k, c]) => k + ' ' + c.map(x => (x >>> 0).toString(16).padStart(8, '0')).join(' '));
    writeFileSync(join(DIR, key + '.txt'), lines.join('\n') + '\n');
}
