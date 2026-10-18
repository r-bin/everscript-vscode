// Ownership: what the Music tab knows before any sound plays: the tracks, the
// sound effects, where every package writes in ARAM, and the driver bytes.
// Pure; ROM bytes in, a JSON-ready object out.

import { isEvermoreAudio, packageRecords, driverBlocks, musicPackages, sfxPackages, scriptIdsBySfx } from './rom-audio';
import { getMusic, getMusicName, getSound, getSoundName, getSoundAnimations } from '../../localizations/sounds';
import { hex as hex2 } from '../../../../platform';

/** Where a package writes: [dest, length] per record, in upload order. */
function packageLayout(rom: Uint8Array, id: number): [number, number][] {
    return packageRecords(rom, id).map((r): [number, number] => [r.dest, r.bytes.length]);
}

function sfxName(scripts: number[]): string {
    // Script id 0x00 is named 'None' (no sound); it also maps to a driver effect.
    for (const id of scripts) { const s = getSound(id); if (s && s.name !== 'None') return getSoundName(id); }
    return '';
}

/** Who plays driver effect `sfx` in an animation: [{ who, what, attack, record }], one per who + what. */
function sfxAnimations(sfx: number) {
    const out: { who: string; what: string; attack: boolean; record: string }[] = [], seen = new Set<string>();
    for (const e of getSoundAnimations()) {
        if (e.sfx !== sfx) continue;
        for (const a of e.animations) {
            for (const o of a.owners.length ? a.owners : [{ who: 'animation ' + a.record, what: '', attack: false }]) {
                const k = o.who + '|' + o.what;
                if (seen.has(k)) continue;
                seen.add(k);
                out.push({ who: o.who, what: o.what, attack: !!o.attack, record: a.record });
            }
        }
    }
    return out;
}

/**
 * How animations vary driver effect `sfx` (command $30 just before it: a pitch offset in
 * 1/20 semitone): { stamina: [animation], offsets: [{ n, by: [animation] }] } or null.
 */
function sfxPitch(sfx: number) {
    const stamina = new Set<string>(), offsets = new Map<number, Set<string>>();
    for (const e of getSoundAnimations()) {
        if (e.sfx !== sfx) continue;
        for (const a of e.animations) for (const o of a.ops || []) {
            const by = a.label || 'animation ' + a.record;
            if (o.pitch === 'stamina') stamina.add(by);
            else if (typeof o.pitch === 'number') {
                const set = offsets.get(o.pitch) ?? new Set<string>();
                set.add(by);
                offsets.set(o.pitch, set);
            }
        }
    }
    if (!stamina.size && !offsets.size) return null;
    return {
        stamina: [...stamina],
        offsets: [...offsets].sort((x, y) => x[0] - y[0]).map(([n, by]) => ({ n, by: [...by] })),
    };
}

/**
 * { music, sfx, packages, driver } or { error }.
 *   music[m]    { id, package, name }
 *   sfx[s]      { id, package (0 = base bank), scripts: [sound() ids], name, animations: [{ who, what, attack, record }], pitch: sfxPitch() }
 *   packages[p] [[dest, len], ...]
 *   driver      { entry, blocks: [{ dest, bytes: number[] }] }
 */
function buildMusicModel(rom: Uint8Array) {
    if (!isEvermoreAudio(rom)) return { error: 'The configured ROM does not have Secret of Evermore (U)\'s sound tables.' };
    const musicPk = musicPackages(rom);
    const sfxPk = sfxPackages(rom);
    const scripts = scriptIdsBySfx(rom);
    const drv = driverBlocks(rom);
    const packages: [number, number][][] = [];
    for (let p = 0; p <= Math.max(...musicPk, ...sfxPk); p++) packages.push(packageLayout(rom, p));
    return {
        music: musicPk.map((p, m) => ({ id: m, package: p, name: getMusic(m) ? getMusicName(m) : 'Music $' + hex2(m) })),
        sfx: sfxPk.map((p, s) => {
            const ids = scripts.get(s) || [];
            return { id: s, package: p, scripts: ids, name: sfxName(ids), animations: sfxAnimations(s), pitch: sfxPitch(s) };
        }),
        packages,
        driver: { entry: drv.entry, blocks: drv.blocks.map(b => ({ dest: b.dest, bytes: Array.from(b.bytes) })) },
    };
}

/** The bytes of one package, for the tab's engine: [{ dest, bytes: number[] }]. */
function packageData(rom: Uint8Array, id: number) {
    return packageRecords(rom, id).map(r => ({ dest: r.dest, bytes: Array.from(r.bytes) }));
}

export { buildMusicModel, packageData };
