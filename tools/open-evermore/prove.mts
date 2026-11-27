// Prove that a layout plays like the original (G1, docs/open-evermore/README.md §5): build the original from the
// tree itself (stable layout: byte for byte the base ROM, G0) and the layout under test (--random), play the stored
// playbacks on both, compare every frame. Pointers into moved resources are translated first (play.mts), so only
// real differences remain. Takes minutes: on demand only, never in a test tier (test-discipline skill).
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join } from 'node:path';
import type { Codec, Window } from './codec.mts';
import { implode } from './implode.mts';
import { MAX_DRIFT } from './play.mts';
import type { Moved, PlayResult } from './play.mts';
import type { PastEnd } from './layouts.mts';
import type { Tree } from './tree.mts';

const require = createRequire(import.meta.url);
const { parseMovie } = require('../../dist/platform/tas/movie');
const HERE = dirname(new URL(import.meta.url).pathname);
export const DEFAULT_MOVIES = join(HERE, '../../.agents/skills/sample-playbacks/playbacks');

export interface Proof { ok: boolean; lines: string[] }

const play = (args: string[]) => new Promise<void>((resolve, reject) => {
    const p = spawn(process.execPath, [join(HERE, 'play.mts'), ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', d => { err += d; });
    p.on('exit', code => (code === 0 ? resolve() : reject(new Error(`play.mts: exit ${code}\n${err}`))));
});

/** "$7e0140 $7e0141 $7e0142 $7e0148 …" → "$7e0140-42 …", and equal runs at one stride as "$7e0140-42 ×64 every 8". */
function ranges(addrs: string[]): string {
    const n = addrs.map(a => parseInt(a.slice(1), 16));
    const runs: [number, number][] = [];
    for (const a of n) { const r = runs.at(-1); if (r && a === r[0] + r[1]) r[1]++; else runs.push([a, 1]); }
    const out: string[] = [];
    for (let i = 0; i < runs.length;) {
        let j = i + 1;
        const stride = runs[j] ? runs[j][0] - runs[i][0] : 0;
        while (runs[j] && runs[j][1] === runs[i][1] && runs[j][0] - runs[j - 1][0] === stride) j++;
        const [a, len] = runs[i];
        const one = `$${a.toString(16)}${len > 1 ? '-' + (a + len - 1).toString(16).slice(-2) : ''}`;
        out.push(j - i >= 3 ? `${one} ×${j - i} every ${stride}` : one);
        if (j - i < 3) j = i + 1;
        i = j;
    }
    return out.join(' ');
}

/** `windows`: the game's pointer forms that are positions in a window (Evermore's packed script pointers). */
export async function prove(tree: Tree, game: string, kinds: Codec[], seed: number | null, out: string, movieSpecs: string[] = [DEFAULT_MOVIES], pastEnd: PastEnd[] = [], windows: Window[] = [], strict = true): Promise<Proof> {
    const lines: string[] = [];
    const log = (s: string) => { lines.push(s); console.log(s); };
    // The original is plain HiROM at the base size: the playbacks were recorded on it.
    // With memory at vanilla's places: a tree that moved WRAM is proved against the game it was recorded on.
    const original = implode(tree, game, kinds, { layout: 'hirom', pastEnd, strict: true, vanillaMemory: true });
    // Strict by default: a longer encoding (a relative script call written as the absolute one) does the same in
    // fewer cycles, and the engine is busy most of each frame, so any cycle change leaves WRAM out of step for good
    // (docs/open-evermore/progress.md §2). Lockstep proves placement; `strict = false` shows how far that goes.
    const layout = implode(tree, game, kinds, { seed: seed ?? undefined, pastEnd, strict });
    const memory = kinds.flatMap(k => k.memoryMoves?.() ?? []);
    if (!original.image || !layout.image) return { ok: false, lines: ['implode failed; run implode for the findings'] };
    if (original.placed.some(p => p.changed)) return { ok: false, lines: ['resources changed since explode: prove compares two layouts of an unchanged tree (G1); a changed resource needs its own playback (G2)'] };

    mkdirSync(out, { recursive: true });
    const romA = join(out, 'original.sfc'), romB = join(out, `${seed === null ? 'stable' : `random-${seed}`}.sfc`), movedPath = join(out, 'moved.json');
    // An sa1 layout plays its HiROM content: our core has no SA-1; tools/sa1 proves the conversion in MesenCE.
    writeFileSync(romA, original.image); writeFileSync(romB, layout.content!);
    // One record per stretch that is contiguous in both builds and the same bytes of one resource (a resource in
    // pieces: a window, holes; a script whose commands were written longer in one build: segments).
    const stretches = (placed: typeof original.placed) => {
        const out = new Map<string, { src: number; file: number; length: number }[]>();
        for (const p of placed) for (const g of p.segments) for (const piece of p.pieces) {
            const from = Math.max(g.dst, piece.offset), to = Math.min(g.dst + g.length, piece.offset + piece.end - piece.start);
            if (from >= to) continue;
            if (!out.has(g.key)) out.set(g.key, []);
            out.get(g.key)!.push({ src: g.src + from - g.dst, file: piece.start + from - piece.offset, length: to - from });
        }
        return out;
    };
    const before = stretches(original.placed);
    const moved: Moved[] = [...stretches(layout.placed)].flatMap(([key, list]) => list.flatMap(y => (before.get(key) ?? []).flatMap(x => {
        const from = Math.max(x.src, y.src), to = Math.min(x.src + x.length, y.src + y.length);
        const a = x.file + from - x.src, b = y.file + from - y.src;
        return from < to && a !== b ? [{ key, a, b, length: to - from }] : [];
    })));
    writeFileSync(movedPath, JSON.stringify({ moved, windows, memory }));

    const sha256 = createHash('sha256').update(original.image).digest('hex');
    const files = movieSpecs.flatMap(s => statSync(s).isDirectory() ? readdirSync(s).filter(f => f.endsWith('.evsmv')).map(f => join(s, f)) : [s]);
    const movies = files.filter(f => parseMovie(readFileSync(f, 'utf8'), basename(f)).meta.romSha256 === sha256);
    if (!movies.length) return { ok: false, lines: [`no playback recorded on the original (sha256 ${sha256.slice(0, 16)}…) among ${movieSpecs.join(', ')}`] };

    if (memory.length) log(`WRAM: ${memory.length} variables moved or resized against vanilla (${memory.filter(m => m.b !== m.a).length} moved, ${memory.reduce((s, m) => s + m.length, 0)} bytes compared through the move).`);
    log(`${seed === null ? 'Stable layout' : `Seed ${seed}`}: ${new Set(moved.map(m => m.key)).size} resources moved (${layout.placed.length} items), built as ${layout.layout}${layout.layout?.startsWith('SA-1') ? ' (its HiROM content is played)' : ''}. ${movies.length} playbacks, original and layout in lockstep.`);
    let ok = true;
    await Promise.all(movies.map(async (m, i) => {
        const resultPath = join(out, `run${i}.json`);
        await play([romA, romB, m, movedPath, resultPath]);
        const r: PlayResult = JSON.parse(readFileSync(resultPath, 'utf8'));
        if (r.sync !== 'ok') { ok = false; log(`- ${basename(m)}: the original itself lost the playback (sync ${r.sync}); no proof`); return; }
        if (r.difference) {
            ok = false;
            log(`- ${basename(m)}: **differs from frame ${r.difference.frame}** and does not get back in step within ${MAX_DRIFT} frames (${r.difference.what}) ${r.difference.bytes.join(' ')}`);
            return;
        }
        const drifts = r.driftCount ? ` ${r.driftCount} drifts back in step (frame+length: ${r.drifts.map(([f, n]) => `${f}+${n}`).join(' ')}${r.driftCount > r.drifts.length ? ' …' : ''}).` : ' No drift.';
        log(`- ${basename(m)}: ${r.frames} frames in step (WRAM every frame; screen, VRAM and PC every 60).${drifts} ${r.translated} frames held pointers to moved resources, at ${ranges(r.pointerBytes) || 'none'}`);
    }));
    log(ok ? `Result: the ${seed === null ? 'stable' : 'random'} layout plays exactly like the original.` : 'Result: DIFFERENT, see above.');
    writeFileSync(join(out, 'REPORT.md'), '# Open Evermore proof\n\n' + lines.join('\n') + '\n');
    return { ok, lines };
}
