// The game mapping file (docs/open-evermore/mapping.md): every ROM address the codecs read or rewrite, and where each
// kind may be placed, for one release of Evermore, in map/<release>.json (release = the variant id of
// src/games/evermore/descriptor.ts: us, eu, de, fr, es, es-rev2). The codecs keep how the bytes are shaped and checked;
// this file says where they are. The language builds hold the same content compiled to other banks, so a release's
// file may `extends` another and give only what differs (an entry replaces the parent's entry of the same name).
//
// One release per process: the codecs read the map when they load, so the CLI selects the release first
// (`selectRelease`) and imports the codecs after it. Reading a map before any release was selected selects `us`.
//
// Values, as the game addresses them (HiROM; the file offset is the bus address & $3FFFFF):
//   "$8C:CCF7"     one address                       file(), bus()
//   "$8C:CE6A+2"   an operand and what it adds to the table ("-3": an index counted from 1): readers()
//   "$8C"          a bank                             bank()
//   [ … ]          a list of any of these             files(), readers()
import { existsSync, readFileSync } from 'node:fs';
import type { Rule, Window } from '../codec.mts';

export const GAME = 'evermore';
export const DEFAULT_RELEASE = 'us';
const DIR = new URL('./map/', import.meta.url);
const MIB4 = 0x400000;

type Value = string | string[];
/** Where a kind may go, in the file's words; `rule()` turns it into the allocator's Rule. */
interface PlacementSpec {
    why: string;
    half?: 'upper' | 'lower';
    /** "$C4" or "$CA-$D3": the banks it must lie in (as the game addresses them). */
    banks?: string;
    /** "$92-$BF": a window, the upper halves of those banks read as one space. */
    window?: string;
    /** "first4MiB": the pointer reaches only $C0-$FF (or $80-$BF), the first 4 MB of any layout. */
    reach?: 'first4MiB';
    /** "$B678": the 16-bit address the game keeps; only the bank moves. */
    bankOffset?: string;
    noCrossBank?: boolean;
    noBankEnd?: boolean;
    noPageCross?: boolean;
    maxSize?: number;
}
interface MapFile {
    release: string;
    name: string;
    extends?: string;
    /** Evidence: where the facts of this file are written down, per kind. */
    sources?: Record<string, string>;
    addresses: Record<string, Record<string, Value>>;
    placement: Record<string, PlacementSpec>;
    /** Bytes the game reads past the end of its image: [from, length]. */
    pastEnd: [string, number][];
}

export interface GameMap { release: string; name: string; chain: string[]; addresses: Map<string, Value>; placement: Map<string, PlacementSpec>; pastEnd: [string, number][] }

let active: GameMap | undefined;
let read = false;

/** The releases that have a mapping file. */
export function releases(): string[] {
    const known = ['us', 'eu', 'de', 'fr', 'es', 'es-rev2'];
    return known.filter(r => existsSync(new URL(`${r}.json`, DIR)));
}

/** Loads map/<release>.json and the files it extends (from `dir`: tests); throws on a malformed value. */
export function loadMap(release: string, dir: URL = DIR): GameMap {
    const chain: MapFile[] = [];
    for (let r: string | undefined = release; r;) {
        const url = new URL(`${r}.json`, dir);
        if (!existsSync(url)) throw new Error(`open-evermore: no mapping file for release "${r}" (tools/open-evermore/evermore/map/${r}.json; docs/open-evermore/mapping.md says how to write one)`);
        const f = JSON.parse(readFileSync(url, 'utf8')) as MapFile;
        if (f.release !== r) throw new Error(`map/${r}.json: "release" is "${f.release}"`);
        if (chain.some(c => c.release === f.extends) || f.extends === r) throw new Error(`map/${r}.json: extends itself`);
        chain.unshift(f);
        r = f.extends;
    }
    const addresses = new Map<string, Value>(), placement = new Map<string, PlacementSpec>();
    let pastEnd: [string, number][] = [];
    for (const f of chain) {
        for (const [kind, entries] of Object.entries(f.addresses ?? {})) for (const [k, v] of Object.entries(entries)) {
            for (const one of Array.isArray(v) ? v : [v]) parse(one, `map/${f.release}.json ${kind}.${k}`);
            addresses.set(`${kind}.${k}`, v);
        }
        for (const [kind, spec] of Object.entries(f.placement ?? {})) placement.set(kind, spec);
        if (f.pastEnd) pastEnd = f.pastEnd;
    }
    const top = chain[chain.length - 1];
    return { release, name: top.name, chain: chain.map(c => c.release), addresses, placement, pastEnd };
}

/** Selects the release the codecs read; once anything was read, only the same release. Unknown → throws. */
export function selectRelease(release: string | null | undefined): GameMap {
    const r = release || DEFAULT_RELEASE;
    if (active && active.release !== r && read) throw new Error(`open-evermore: the codecs already read the map of "${active.release}"; select "${r}" before loading them`);
    if (!active || active.release !== r) active = loadMap(r);
    return active;
}

/** The active map (selects `us` when none is). */
export function gameMap(): GameMap {
    read = true;
    return active ?? (active = loadMap(DEFAULT_RELEASE));
}

interface Parsed { bus: number; add?: number; bank?: boolean }
function parse(v: string, where: string): Parsed {
    let m = /^\$([0-9A-F]{2}):([0-9A-F]{4})([+-]\d+)?$/.exec(v);
    if (m) return { bus: parseInt(m[1] + m[2], 16), add: m[3] === undefined ? undefined : Number(m[3]) };
    m = /^\$([0-9A-F]{2})$/.exec(v);
    if (m) return { bus: parseInt(m[1], 16), bank: true };
    throw new Error(`${where}: "${v}" is no address ("$BB:AAAA", "$BB:AAAA+n" or "$BB")`);
}

function value(path: string): Value {
    const v = gameMap().addresses.get(path);
    if (v === undefined) throw new Error(`open-evermore: map/${gameMap().release}.json has no address "${path}"`);
    return v;
}
function one(path: string): Parsed {
    const v = value(path);
    if (Array.isArray(v)) throw new Error(`map: "${path}" is a list`);
    return parse(v, path);
}
function list(path: string): Parsed[] {
    const v = value(path);
    return (Array.isArray(v) ? v : [v]).map(x => parse(x, path));
}
const fileOfBus = (bus: number) => bus & 0x3FFFFF;

/** The file offset of an address. */
export const file = (path: string): number => { const p = one(path); if (p.bank) throw new Error(`map: "${path}" is a bank`); return fileOfBus(p.bus); };
/** The bus address, exactly as written (the form the game's own pointers use). */
export const bus = (path: string): number => one(path).bus;
/** The 16-bit address in its bank. */
export const offset = (path: string): number => one(path).bus & 0xFFFF;
/** A bank, as the game addresses it ("$8C" → 0x8C; an address gives its bank). */
export const bank = (path: string): number => { const p = one(path); return p.bank ? p.bus : p.bus >> 16; };
/** The file offsets of a list. */
export const files = (path: string): number[] => list(path).map(p => fileOfBus(p.bus));
/** A list of `lda.l` operands, each with what its reader adds to the table. */
export const readers = (path: string): { at: number; add: number }[] => list(path).map(p => ({ at: fileOfBus(p.bus), add: p.add ?? 0 }));

/** "$C4" / "$CA-$D3" → the file banks, end exclusive. */
function bankRange(s: string, where: string): { from: number; to: number } {
    const m = /^\$([0-9A-F]{2})(?:-\$([0-9A-F]{2}))?$/.exec(s);
    if (!m) throw new Error(`${where}: "${s}" is no bank range ("$C4" or "$CA-$D3")`);
    const from = parseInt(m[1], 16) & 0x3F, to = (parseInt(m[2] ?? m[1], 16) & 0x3F) + 1;
    return { from, to };
}

/** The window a kind's placement names (scripts, music). */
export function window(kind: string): Window {
    const spec = placementOf(kind);
    if (!spec.window) throw new Error(`map: placement "${kind}" has no window`);
    return bankRange(spec.window, `placement ${kind}`);
}

function placementOf(kind: string): PlacementSpec {
    const spec = gameMap().placement.get(kind);
    if (!spec) throw new Error(`open-evermore: map/${gameMap().release}.json has no placement "${kind}"`);
    return spec;
}

/** The allocator's rule for a kind (or a named form of it, `music/upper`). */
export function rule(kind: string): Rule {
    const s = placementOf(kind), r: Rule = {};
    if (s.half === 'upper') r.upperHalf = true;
    if (s.half === 'lower') r.lowerHalf = true;
    if (s.banks) { const b = bankRange(s.banks, `placement ${kind}`); r.above = b.from << 16; r.below = b.to << 16; }
    if (s.reach === 'first4MiB') r.below = Math.min(r.below ?? MIB4, MIB4);
    if (s.bankOffset) r.bankOffset = parseInt(s.bankOffset.slice(1), 16);
    if (s.window) r.window = window(kind);
    if (s.noCrossBank) r.noCrossBank = true;
    if (s.noBankEnd) r.noBankEnd = true;
    if (s.noPageCross) r.noPageCross = true;
    if (s.maxSize !== undefined) r.maxSize = s.maxSize;
    return r;
}

/** Bytes the game reads past its image, as file spans. */
export const pastEnd = (): { start: number; end: number }[] => gameMap().pastEnd.map(([at, n]) => { const s = fileOfBus(parse(at, 'pastEnd').bus); return { start: s, end: s + n }; });

/** Every address path of the active map (for the test that each is used). */
export const addressPaths = (): string[] => [...gameMap().addresses.keys()];
