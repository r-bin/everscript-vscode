// The `raw` kind: every byte no other kind owns yet, one file per unclaimed stretch inside a 64 KiB bank,
// named by its bus address (docs/open-evermore/resources.md §raw). Raw bytes are not for editing: a changed file
// is an error, since nothing knows what its bytes mean. Game-neutral (HiROM addressing only).
import type { Codec, ExplodeContext, ImplodeContext, Span, Write } from './codec.mts';
import { busOf, fileOf, formatAddr, parseAddr } from './manifest.mts';
import { json, NAME_RE, readText, sha1 } from './tree.mts';
import type { Tree } from './tree.mts';

const DIR = 'raw', INDEX = 'raw/_raw.json';
const BANK = 0x10000;

interface RawRegion { name: string; at: string; length: string; file: string; sha1: string; why: string }

/** Unclaimed ranges of [0, size), cut at bank boundaries. */
export function unclaimed(size: number, claimed: Span[]): Span[] {
    const sorted = [...claimed].sort((a, b) => a.start - b.start);
    const free: Span[] = [];
    let pos = 0;
    for (const c of [...sorted, { start: size, end: size }]) {
        for (let s = pos; s < c.start; s = (s & ~(BANK - 1)) + BANK) free.push({ start: s, end: Math.min(c.start, (s & ~(BANK - 1)) + BANK) });
        pos = Math.max(pos, c.end);
    }
    return free;
}

const nameOf = (start: number): string => {
    const bus = busOf(start);
    return (bus & 0xFFFF) === 0 ? 'bank_' + (bus >> 16).toString(16) : 'raw_' + bus.toString(16);
};

export const raw: Codec = {
    kind: 'raw', version: 1, path: DIR,

    explode({ rom, claimed }: ExplodeContext) {
        const files: Tree = new Map();
        const regions: RawRegion[] = [];
        const spans = unclaimed(rom.length, claimed);
        for (const s of spans) {
            const name = nameOf(s.start), bytes = rom.slice(s.start, s.end);
            files.set(`${DIR}/${name}.bin`, bytes);
            regions.push({ name, at: formatAddr(busOf(s.start)), length: '0x' + (s.end - s.start).toString(16), file: name + '.bin', sha1: sha1(bytes), why: 'not yet exploded' });
        }
        files.set(INDEX, json({ regions }));
        return { files, claims: spans };
    },

    implode({ tree, findings }: ImplodeContext) {
        const writes: Write[] = [];
        const index = tree.get(INDEX);
        if (!index) { findings.error('missing-file', INDEX, '', 'the raw index is missing'); return { writes: [], changed: true }; }
        let regions: RawRegion[];
        try { regions = JSON.parse(readText(index)).regions; }
        catch (e) { findings.error('parse-error', INDEX, '', (e as Error).message); return { writes: [], changed: true }; }
        if (!Array.isArray(regions)) { findings.error('schema', INDEX, '/regions', 'missing'); return { writes: [], changed: true }; }

        const seen = new Set<string>(), listed = new Set<string>([INDEX]);
        regions.forEach((r, i) => {
            const at = parseAddr(r.at), length = Number(r.length), path = `${DIR}/${r.file}`;
            listed.add(path);
            if (!NAME_RE.test(r.name ?? '')) findings.error('bad-name', INDEX, `/regions/${i}/name`, `"${r.name}" is not snake_case`);
            if (seen.has(r.name)) findings.error('duplicate-name', INDEX, `/regions/${i}/name`, `"${r.name}" twice`);
            seen.add(r.name);
            if (at === null || !Number.isInteger(length) || length <= 0) return findings.error('schema', INDEX, `/regions/${i}`, 'at "$BBAAAA" and a length');
            const bytes = tree.get(path);
            if (!bytes) return findings.error('missing-file', path, '', `listed in ${INDEX} as region "${r.name}"`);
            if (bytes.length !== length || sha1(bytes) !== r.sha1) return findings.error('raw-changed', path, '', 'raw bytes were edited; move the resource into its kind to change it');
            writes.push({ at: fileOf(at), bytes, file: path });
        });
        for (const path of tree.keys()) {
            if (path.startsWith(DIR + '/') && !listed.has(path)) findings.warning('unknown-file', path, '', `not listed in ${INDEX}; ignored`);
        }
        return { writes, changed: false };
    },
};
