// Ownership: `soe://localization/` - concentrated subjective and localized names as files.
// Pure apart from optional ROM buffer used for resolving in-game string indices.
//
//   soe://localization/index.md             categories overview
//   soe://localization/index.json           summary counts
//   soe://localization/scripts/...          NPC, ABS, and Global scripts
//   soe://localization/maps/...             127 vanilla rooms and area groupings
//   soe://localization/sounds/...           music and sound effects
//   soe://localization/tables/...           curated ROM tables
//   soe://localization/functions/...        curated ROM routines
//   soe://localization/strings/...          in-game dialog strings
//   soe://localization/knowledge/{ram,rom}/ every knowledge entry: index.md (the generated RAM / ROM map),
//                                           <addr>.md (the entry), <addr>.json (its fields)

import { VANILLA_MAPS, getMap, MUSIC, SOUNDS, getMusic, getSound, TABLES, getTable, FUNCTIONS, getFunction, NPC_SCRIPTS, ABS_SCRIPTS, GLOBAL_SCRIPTS, getNpcScript, getAbsScript, getGlobalScript, decodeRomString, resolveLocalizedName } from '../localizations';
import { hexId } from './resource-uri';
import { dir, json, text } from './nodes';
import type { Entry } from './nodes';
import * as MD from './localization-markdown';
import { entries as knowledgeEntries } from '../localizations/knowledge';
import { hex } from '../../../platform';

type Rom = Uint8Array | null | undefined;
type ScriptEntry = NonNullable<ReturnType<typeof getNpcScript>>;
type WithId = ScriptEntry & { id: number };
type WithAddress = ScriptEntry & { address: number };
type Kind = 'npc' | 'abs' | 'global';

const CATEGORIES = ['scripts', 'maps', 'sounds', 'tables', 'functions', 'strings', 'knowledge'];
const STRING_COUNT = 3002;

function resolveLocalization(segments: string[], rom: Rom) {
    const [cat, sub, leaf, ...extra] = segments;
    if (extra.length) return null;
    if (cat === undefined) return rootDir();
    if (cat === 'index.md') return text(() => MD.rootMarkdown(rootSummary()));
    if (cat === 'index.json') return json(rootSummary);
    if (cat === 'scripts') return scriptsRoute(segments.slice(1), rom);
    if (cat === 'maps') return mapsRoute(segments.slice(1), rom);
    if (cat === 'sounds') return soundsRoute(segments.slice(1));
    if (cat === 'tables') return tablesRoute(segments.slice(1));
    if (cat === 'functions') return functionsRoute(segments.slice(1));
    if (cat === 'strings') return stringsRoute(segments.slice(1), rom);
    if (cat === 'knowledge') return knowledgeRoute(segments.slice(1));
    return null;
}

// -- root ---------------------------------------------------------------------

function rootDir() {
    return dir([
        ['index.md', 'file'],
        ['index.json', 'file'],
        ...CATEGORIES.map((c): Entry => [c, 'dir']),
    ], () => MD.rootMarkdown(rootSummary()));
}

function rootSummary() {
    return {
        categories: CATEGORIES,
        counts: {
            npcScripts: allNpc().length,
            absScripts: allAbs().length,
            globalScripts: allGlobal().length,
            maps: VANILLA_MAPS.length,
            music: MUSIC.length,
            sounds: SOUNDS.length,
            tables: TABLES.length,
            functions: FUNCTIONS.length,
            strings: STRING_COUNT,
            knowledge: { ram: knowledgeEntries('ram').length, rom: knowledgeEntries('rom').length },
        },
    };
}

// -- scripts ------------------------------------------------------------------

function allNpc(): WithId[] {
    const seen = new Set<number>();
    const list: WithId[] = [];
    for (const [k, v] of NPC_SCRIPTS.entries()) {
        if (typeof k === 'number' && !seen.has(v.id!)) {
            seen.add(v.id!);
            list.push(v as WithId);
        }
    }
    return list.sort((a, b) => a.id - b.id);
}

function allAbs(): WithAddress[] {
    const seen = new Set<number>();
    const list: WithAddress[] = [];
    for (const [k, v] of ABS_SCRIPTS.entries()) {
        if (typeof k === 'number' && !seen.has(v.address!)) {
            seen.add(v.address!);
            list.push(v as WithAddress);
        }
    }
    return list.sort((a, b) => a.address - b.address);
}

function allGlobal(): WithId[] {
    const seen = new Set<number>();
    const list: WithId[] = [];
    for (const [k, v] of GLOBAL_SCRIPTS.entries()) {
        if (typeof k === 'number' && !seen.has(v.id!)) {
            seen.add(v.id!);
            list.push(v as WithId);
        }
    }
    return list.sort((a, b) => a.id - b.id);
}

function formatScript(e: ScriptEntry | null, kind: Kind, rom: Rom) {
    if (!e) return null;
    const res: { id?: number; address?: number; hex: string; kind: Kind; name: string; romName?: string } = {
        id: e.id !== undefined ? e.id : undefined,
        address: e.address !== undefined ? e.address : undefined,
        hex: e.hex,
        kind,
        name: e.name,
    };
    if (rom && e.stringIndex !== null && e.stringIndex !== undefined) {
        res.romName = resolveLocalizedName(e, rom, 'name');
    }
    return res;
}

function findScriptEntry(name: string, getter: (key: number | string) => ScriptEntry | null): ScriptEntry | null {
    const clean = String(name || '').replace(/\.json$/i, '').trim();
    if (!clean) return null;
    return (/^[0-9a-f]+$/i.test(clean) ? getter(parseInt(clean, 16)) : null)
        || getter(clean)
        || (/^\d+$/.test(clean) ? getter(parseInt(clean, 10)) : null)
        || null;
}

function scriptsRoute(rest: string[], rom: Rom) {
    if (rest.length === 0) {
        return dir([
            ['index.md', 'file'],
            ['index.json', 'file'],
            ['npc', 'dir'],
            ['abs', 'dir'],
            ['global', 'dir'],
        ], () => MD.scriptsMarkdown(allNpc(), allAbs(), allGlobal()));
    }
    const [sub, leaf] = rest;
    if (sub === 'index.md') return text(() => MD.scriptsMarkdown(allNpc(), allAbs(), allGlobal()));
    if (sub === 'index.json') {
        return json(() => ({
            npc: allNpc().map(e => formatScript(e, 'npc', rom)),
            abs: allAbs().map(e => formatScript(e, 'abs', rom)),
            global: allGlobal().map(e => formatScript(e, 'global', rom)),
        }));
    }
    if (sub === 'npc') {
        if (leaf === undefined) {
            return dir([
                ['index.md', 'file'],
                ['index.json', 'file'],
                ...allNpc().map((e): Entry => [hexId(e.id, 4) + '.json', 'file']),
            ], () => MD.npcMarkdown(allNpc()));
        }
        if (leaf === 'index.md') return text(() => MD.npcMarkdown(allNpc()));
        if (leaf === 'index.json') return json(() => allNpc().map(e => formatScript(e, 'npc', rom)));
        const e = findScriptEntry(leaf, getNpcScript);
        return e ? json(() => formatScript(e, 'npc', rom)) : null;
    }
    if (sub === 'abs') {
        if (leaf === undefined) {
            return dir([
                ['index.md', 'file'],
                ['index.json', 'file'],
                ...allAbs().map((e): Entry => [hexId(e.address, 6) + '.json', 'file']),
            ], () => MD.absMarkdown(allAbs()));
        }
        if (leaf === 'index.md') return text(() => MD.absMarkdown(allAbs()));
        if (leaf === 'index.json') return json(() => allAbs().map(e => formatScript(e, 'abs', rom)));
        const e = findScriptEntry(leaf, getAbsScript);
        return e ? json(() => formatScript(e, 'abs', rom)) : null;
    }
    if (sub === 'global') {
        if (leaf === undefined) {
            return dir([
                ['index.md', 'file'],
                ['index.json', 'file'],
                ...allGlobal().map((e): Entry => [hexId(e.id, 2) + '.json', 'file']),
            ], () => MD.globalMarkdown(allGlobal()));
        }
        if (leaf === 'index.md') return text(() => MD.globalMarkdown(allGlobal()));
        if (leaf === 'index.json') return json(() => allGlobal().map(e => formatScript(e, 'global', rom)));
        const e = findScriptEntry(leaf, getGlobalScript);
        return e ? json(() => formatScript(e, 'global', rom)) : null;
    }
    if (leaf === undefined) {
        // Direct script lookup under scripts/<name>.json
        const npc = findScriptEntry(sub, getNpcScript);
        if (npc) return json(() => formatScript(npc, 'npc', rom));
        const abs = findScriptEntry(sub, getAbsScript);
        if (abs) return json(() => formatScript(abs, 'abs', rom));
        const glb = findScriptEntry(sub, getGlobalScript);
        if (glb) return json(() => formatScript(glb, 'global', rom));
    }
    return null;
}

// -- maps ---------------------------------------------------------------------

function formatMap(m: NonNullable<ReturnType<typeof getMap>>, rom: Rom) {
    const res: { id: number; hex: string; name: string; fullName: string; area: string; romName?: string } = { id: m.id, hex: m.hex, name: m.name, fullName: m.fullName, area: m.area };
    if (rom && m.stringIndex !== null && m.stringIndex !== undefined) {
        res.romName = resolveLocalizedName(m, rom, 'name');
    }
    return res;
}

function mapsRoute(rest: string[], rom: Rom) {
    if (rest.length === 0) {
        return dir([
            ['index.md', 'file'],
            ['index.json', 'file'],
            ...VANILLA_MAPS.map((m): Entry => [hexId(m.id, 2) + '.json', 'file']),
        ], () => MD.mapsMarkdown(VANILLA_MAPS));
    }
    const [name] = rest;
    if (name === 'index.md') return text(() => MD.mapsMarkdown(VANILLA_MAPS));
    if (name === 'index.json') return json(() => VANILLA_MAPS.map(m => formatMap(m, rom)));
    const clean = name.replace(/\.json$/i, '');
    const m = (/^[0-9a-f]+$/i.test(clean) ? getMap(parseInt(clean, 16)) : null)
        || getMap(clean)
        || (/^\d+$/.test(clean) ? getMap(parseInt(clean, 10)) : null);
    return m ? json(() => formatMap(m, rom)) : null;
}

// -- sounds -------------------------------------------------------------------

function soundsRoute(rest: string[]) {
    if (rest.length === 0) {
        return dir([
            ['index.md', 'file'],
            ['index.json', 'file'],
            ['music', 'dir'],
            ['sfx', 'dir'],
        ], () => MD.soundsMarkdown(MUSIC.length, SOUNDS.length));
    }
    const [sub, leaf] = rest;
    if (sub === 'index.md') return text(() => MD.soundsMarkdown(MUSIC.length, SOUNDS.length));
    if (sub === 'index.json') return json(() => ({ music: MUSIC, sfx: SOUNDS }));
    if (sub === 'music') {
        if (leaf === undefined) {
            return dir([
                ['index.md', 'file'],
                ['index.json', 'file'],
                ...MUSIC.map((m): Entry => [hexId(m.id, 2) + '.json', 'file']),
            ], () => MD.musicMarkdown(MUSIC));
        }
        if (leaf === 'index.md') return text(() => MD.musicMarkdown(MUSIC));
        if (leaf === 'index.json') return json(() => MUSIC);
        const clean = leaf.replace(/\.json$/i, '');
        const m = getMusic(clean) || (/^[0-9a-f]+$/i.test(clean) ? getMusic(parseInt(clean, 16)) : null);
        return m ? json(() => m) : null;
    }
    if (sub === 'sfx') {
        if (leaf === undefined) {
            return dir([
                ['index.md', 'file'],
                ['index.json', 'file'],
                ...SOUNDS.map((s): Entry => [hexId(s.id, 2) + '.json', 'file']),
            ], () => MD.sfxMarkdown(SOUNDS));
        }
        if (leaf === 'index.md') return text(() => MD.sfxMarkdown(SOUNDS));
        if (leaf === 'index.json') return json(() => SOUNDS);
        const clean = leaf.replace(/\.json$/i, '');
        const s = getSound(clean) || (/^[0-9a-f]+$/i.test(clean) ? getSound(parseInt(clean, 16)) : null);
        return s ? json(() => s) : null;
    }
    return null;
}

// -- tables & functions -------------------------------------------------------

function tablesRoute(rest: string[]) {
    if (rest.length === 0) {
        return dir([
            ['index.md', 'file'],
            ['index.json', 'file'],
            ...TABLES.map((t): Entry => [hexId(t.address, 6) + '.json', 'file']),
        ], () => MD.tablesMarkdown(TABLES));
    }
    const [name] = rest;
    if (name === 'index.md') return text(() => MD.tablesMarkdown(TABLES));
    if (name === 'index.json') return json(() => TABLES);
    const clean = name.replace(/\.json$/i, '');
    const t = getTable(clean) || (/^[0-9a-f]+$/i.test(clean) ? getTable(parseInt(clean, 16)) : null);
    return t ? json(() => t) : null;
}

function functionsRoute(rest: string[]) {
    if (rest.length === 0) {
        return dir([
            ['index.md', 'file'],
            ['index.json', 'file'],
            ...FUNCTIONS.map((f): Entry => [hexId(f.address, 6) + '.json', 'file']),
        ], () => MD.functionsMarkdown(FUNCTIONS));
    }
    const [name] = rest;
    if (name === 'index.md') return text(() => MD.functionsMarkdown(FUNCTIONS));
    if (name === 'index.json') return json(() => FUNCTIONS);
    const clean = name.replace(/\.json$/i, '');
    const f = getFunction(clean) || (/^[0-9a-f]+$/i.test(clean) ? getFunction(parseInt(clean, 16)) : null);
    return f ? json(() => f) : null;
}

// -- knowledge ----------------------------------------------------------------

const hex6 = (n: number): string => hex(n, 6);
const cell = (s: unknown): string => String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\s+/g, ' ');

/** The RAM or ROM map, generated from the entries (one row each, in address order). */
function knowledgeMapMarkdown(space: 'ram' | 'rom'): string {
    const list = knowledgeEntries(space);
    const rows = list.map(e => `| [$${hex6(e.addr)}](${hex6(e.addr).toLowerCase()}.md) | ${e.end > e.addr ? `$${hex6(e.end)}` : ''} | ${cell(e.kind)} | ${cell(e.title)} | ${cell(e.confidence)} |`);
    return [`# ${space.toUpperCase()} map: what is known`, '',
        `${list.length} knowledge entries (src/games/evermore/localizations/knowledge/${space}/). Generated; edit the entries.`, '',
        '| Address | End | Kind | What | Confidence |', '|---|---|---|---|---|', ...rows, ''].join('\n');
}

function knowledgeRoute(rest: string[]) {
    const [space, name, ...more] = rest;
    if (more.length) return null;
    if (space === undefined) return dir([['ram', 'dir'], ['rom', 'dir']], () => '# Knowledge entries\n\n- [RAM](ram/index.md)\n- [ROM](rom/index.md)\n');
    if (space !== 'ram' && space !== 'rom') return null;
    const list = knowledgeEntries(space);
    if (name === undefined) {
        return dir([['index.md', 'file'], ...list.flatMap((e): Entry[] => [[hex6(e.addr).toLowerCase() + '.md', 'file'], [hex6(e.addr).toLowerCase() + '.json', 'file']])],
            () => knowledgeMapMarkdown(space));
    }
    if (name === 'index.md') return text(() => knowledgeMapMarkdown(space));
    const m = /^([0-9a-f]{1,6})\.(md|json)$/i.exec(name);
    if (!m) return null;
    const addr = parseInt(m[1], 16);
    const e = list.find(x => x.addr === addr) || list.find(x => (x.addr & 0xFFFF) === addr);
    if (!e) return null;
    if (m[2].toLowerCase() === 'json') return json(() => ({ ...e, body: undefined }));
    return text(() => `# $${hex6(e.addr)}: ${e.title}\n\n${e.body}\n`);
}

// -- strings ------------------------------------------------------------------

function stringsRoute(rest: string[], rom: Rom) {
    if (rest.length === 0) {
        return dir([
            ['index.md', 'file'],
            ['index.json', 'file'],
        ], () => MD.stringsMarkdown(rom, STRING_COUNT));
    }
    const [name] = rest;
    if (name === 'index.md') return text(() => MD.stringsMarkdown(rom, STRING_COUNT));
    if (name === 'index.json') {
        return json(() => ({
            count: STRING_COUNT,
            tableAddress: '$11D000',
            romLoaded: !!rom,
        }));
    }
    const m = /^([0-9a-f]{1,4})\.(json|txt)$/i.exec(name);
    if (!m) return null;
    const idx = parseInt(m[1], 16);
    if (idx < 0 || idx >= STRING_COUNT) return null;
    const str = rom ? decodeRomString(rom, idx) : null;
    if (m[2].toLowerCase() === 'txt') {
        return text(() => str !== null ? str : '(no ROM available)');
    }
    return json(() => ({
        index: idx,
        hex: '0x' + idx.toString(16).padStart(4, '0'),
        text: str,
    }));
}

export { resolveLocalization, formatScript };

