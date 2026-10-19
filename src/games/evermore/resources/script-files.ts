// Ownership: `soe://rom/assets/scripts/` - disassembled ROM scripts, room enter/triggers, and Everscript views.
// Pure apart from the ROM buffer it is handed.

import * as vm from '../script-vm';
import { buildRoomScriptModel, scriptModel } from '../script-model';

/** HiROM: the file offset of a bus address. */
import { hiromFileOffset as snesToRom } from '../../../platform';
import { MAX_ROOMS } from '../maps';
import { getMapName, getMapArea, getAbsScript, getNpcScript, getGlobalScript } from '../localizations';
import { hexId } from './resource-uri';
import { dir, json, text } from './nodes';
import * as MD from './script-markdown';
import { resolveSimulationFile, SIMULATION_FILES } from './simulation-files';
import { resolveOpcodes } from './opcode-files';
import { formatScript } from './localization-files';
import type { Entry } from './nodes';

type Rom = Uint8Array | null;

function resolveScripts(segments: string[], rom: Rom): ReturnType<typeof resolveRoomScripts> {
    if (segments.length > 0 && segments[0] === 'everscript') {
        return resolveScripts(segments.slice(1), rom);
    }
    if (segments.length === 0) {
        return dir([
            ['index.md', 'file'],
            ['index.json', 'file'],
            ['rooms', 'dir'],
            ['opcodes', 'dir'],
        ], () => MD.scriptsRootMarkdown());
    }

    const [head, ...rest] = segments;
    if (head === 'index.md') return text(() => MD.scriptsRootMarkdown());
    if (head === 'index.json') {
        return json(() => ({
            categories: ['rooms'],
            sampleAddresses: ['0x93c8a1', '0x9384d9'],
            roomCount: MAX_ROOMS,
        }));
    }
    if (head === 'rooms' || head === 'maps') {
        return resolveRoomScripts(rest, rom);
    }
    if (head === 'opcodes') return rom ? resolveOpcodes(rest, rom) : null;

    // Direct script lookup by address or name
    return resolveDirectScript(head, rom);
}

function resolveRoomScripts(rest: string[], rom: Rom) {
    if (rest.length === 0) {
        return dir([
            ['index.md', 'file'],
            ['index.json', 'file'],
            ...Array.from({ length: MAX_ROOMS }, (_, i): Entry => [hexId(i, 2), 'dir']),
        ], () => roomsListMarkdown());
    }
    const [roomStr, sub, leaf, ...extra] = rest;
    if (extra.length) return null;
    if (roomStr === 'index.md') return text(() => roomsListMarkdown());
    if (roomStr === 'index.json') {
        return json(() => Array.from({ length: MAX_ROOMS }, (_, i) => ({
            id: hexId(i, 2), name: getMapName(i), area: getMapArea(i),
        })));
    }

    const mapId = parseRoomId(roomStr);
    if (mapId === null || mapId >= MAX_ROOMS) return null;

    if (sub === undefined) {
        return dir([
            ['index.md', 'file'],
            ['index.json', 'file'],
            ['enter.md', 'file'],
            ['enter.evs', 'file'],
            ['enter.json', 'file'],
            ...SIMULATION_FILES.map((f): Entry => [f, 'file']),
            ['step-on', 'dir'],
            ['b-trigger', 'dir'],
        ], () => renderRoomIndexMd(rom, mapId));
    }

    if (sub === 'index.md') return text(() => renderRoomIndexMd(rom, mapId));
    if (sub === 'index.json') return json(() => rom ? buildRoomScriptModel(rom, mapId) : { mapId, error: 'no ROM' });

    if (sub === 'enter.md' || sub === 'enter.evs' || sub === 'enter.json') {
        return renderRoomEnter(rom, mapId, sub.split('.')[1]);
    }

    if (SIMULATION_FILES.includes(sub)) return resolveSimulationFile(rom, mapId, sub);

    if (sub === 'step-on') {
        return renderTriggersDir(rom, mapId, 'step-on', leaf);
    }
    if (sub === 'b-trigger') {
        return renderTriggersDir(rom, mapId, 'b-trigger', leaf);
    }

    return null;
}

function parseRoomId(str: unknown): number | null {
    const clean = String(str || '').trim().toLowerCase().replace(/^0x/, '');
    if (/^[0-9a-f]{1,2}$/.test(clean)) return parseInt(clean, 16);
    if (/^\d+$/.test(clean)) return parseInt(clean, 10);
    return null;
}

function roomsListMarkdown() {
    const rows = Array.from({ length: MAX_ROOMS }, (_, id) => {
        const hex = hexId(id, 2);
        return `| \`${hex}\` | ${getMapArea(id) || '?'} | ${getMapName(id) || '?'} | [${hex}/index.md](${hex}/index.md) |`;
    });
    return `# Room Scripts (${MAX_ROOMS})

| Room | Area | Name | Scripts |
|---|---|---|---|
${rows.join('\n')}
`;
}

function renderRoomIndexMd(rom: Rom, mapId: number): string {
    if (!rom) return `# Room ${hexId(mapId, 2)} Scripts\n\n(no ROM available)`;
    const model = buildRoomScriptModel(rom, mapId);
    return MD.roomScriptsIndexMarkdown(model, mapId, getMapName(mapId, { full: true }), getMapArea(mapId));
}

function renderRoomEnter(rom: Rom, mapId: number, ext: string) {
    if (!rom) return text(() => '(no ROM available)');
    const model = buildRoomScriptModel(rom, mapId);
    const info = {
        title: `Room ${hexId(mapId, 2)}: Enter Script (${MD.fmtSnes(model.enter.scriptAddressSnes)})`,
        addressSnes: model.enter.scriptAddressSnes,
        romOffset: snesToRom(model.enter.scriptAddressSnes),
        room: { id: hexId(mapId, 2), name: getMapName(mapId, { full: true }), area: getMapArea(mapId) },
        instructions: model.enter.instructions,
        stopReason: model.enter.stopReason,
        terminated: model.enter.terminated,
        label: model.enter.label,
        loot: model.enter.loot,
        everscript: model.enter.everscript,
        transitions: model.enter.transitions,
        spawns: model.enter.spawns,
    };
    if (ext === 'md') return text(() => MD.scriptMarkdown(info));
    if (ext === 'evs') return text(() => MD.scriptEverscript(info));
    if (ext === 'json') return json(() => info);
    return null;
}

function renderTriggersDir(rom: Rom, mapId: number, kind: 'step-on' | 'b-trigger', leaf?: string) {
    if (!rom) return null;
    const model = buildRoomScriptModel(rom, mapId);
    const list = kind === 'step-on' ? model.stepOn : model.bTrigger;
    if (leaf === undefined) {
        return dir([
            ['index.md', 'file'],
            ...list.map((_, i): Entry => [`${i}.md`, 'file']),
            ...list.map((_, i): Entry => [`${i}.evs`, 'file']),
            ...list.map((_, i): Entry => [`${i}.json`, 'file']),
        ]);
    }
    const m = /^(\d+)\.(md|evs|json)$/i.exec(leaf);
    if (!m) return null;
    const idx = parseInt(m[1], 10);
    const ext = m[2].toLowerCase();
    if (idx < 0 || idx >= list.length) return null;
    const tr = list[idx];
    const kindName = kind === 'step-on' ? 'Step-on Trigger' : 'B-Trigger';
    const info = {
        title: `Room ${hexId(mapId, 2)}: ${kindName} #${idx} (${MD.fmtSnes(tr.scriptAddressSnes)})`,
        addressSnes: tr.scriptAddressSnes,
        romOffset: snesToRom(tr.scriptAddressSnes),
        room: { id: hexId(mapId, 2), name: getMapName(mapId, { full: true }), area: getMapArea(mapId) },
        trigger: { kind: kindName, index: idx, rect: [tr.x1, tr.y1, tr.x2, tr.y2], scriptId: tr.scriptId },
        instructions: tr.instructions,
        stopReason: tr.stopReason,
        terminated: tr.terminated,
        label: tr.label,
        loot: tr.loot,
        everscript: tr.everscript,
        transitions: tr.transitions,
        spawns: tr.spawns,
    };
    if (ext === 'md') return text(() => MD.scriptMarkdown(info));
    if (ext === 'evs') return text(() => MD.scriptEverscript(info));
    if (ext === 'json') return json(() => info);
    return null;
}

function resolveDirectScript(name: string, rom: Rom) {
    const m = /^([^\.]+)\.(md|evs|json)$/i.exec(name);
    if (!m) return null;
    const ident = m[1].trim();
    const ext = m[2].toLowerCase();

    // Check named script / known IDs first (NPC, ABS, Global)
    const cleanAddr = ident.replace(/^(\$|0x)/i, '');
    const num = /^[0-9a-f]+$/i.test(cleanAddr) ? parseInt(cleanAddr, 16) : null;

    const npc = (num !== null ? getNpcScript(num) : null) || getNpcScript(ident);
    if (npc) {
        if (ext === 'json') return json(() => formatScript(npc, 'npc', rom));
        if (rom && npc.address) {
            const info = decodeByAddress(rom, npc.address);
            info.name = npc.name;
            if (ext === 'md') return text(() => MD.scriptMarkdown(info));
            if (ext === 'evs') return text(() => MD.scriptEverscript(info));
        }
    }

    const abs = (num !== null ? getAbsScript(num) : null) || getAbsScript(ident);
    if (abs) {
        if (ext === 'json') {
            return json(() => {
                const f = formatScript(abs, 'abs', rom);
                if (rom && abs.address) {
                    const dec = decodeByAddress(rom, abs.address);
                    return { ...f, ...dec, name: abs.name };
                }
                return f;
            });
        }
        if (rom && abs.address) {
            const info = decodeByAddress(rom, abs.address);
            info.name = abs.name;
            if (ext === 'md') return text(() => MD.scriptMarkdown(info));
            if (ext === 'evs') return text(() => MD.scriptEverscript(info));
        }
    }

    // Check if ident is a 24-bit SNES script address (e.g. 0x93c8a1, 93c8a1)
    let addr: number | null = null;
    if (num !== null) {
        if (num >= 0x800000) {
            addr = num;
        } else if (num >= 0x8000 && num < 0x400000) {
            addr = 0xc00000 + num;
        }
    }

    if (addr !== null && rom) {
        const info = decodeByAddress(rom, addr);
        if (ext === 'md') return text(() => MD.scriptMarkdown(info));
        if (ext === 'evs') return text(() => MD.scriptEverscript(info));
        if (ext === 'json') return json(() => info);
    }

    return null;
}

/** One script by its bus address: the listing in the compiler's notation, loot, doors, spawns. */
function decodeByAddress(rom: Uint8Array, snesAddr: number) {
    const s = scriptModel(new vm.ScriptRom(rom), snesAddr);
    const named = getAbsScript(snesAddr);
    return {
        addressSnes: snesAddr,
        romOffset: snesToRom(snesAddr),
        name: named ? named.name : null,
        instructions: s.instructions,
        stopReason: s.stopReason,
        terminated: s.terminated,
        label: s.label,
        loot: s.loot,
        everscript: s.everscript,
        transitions: s.transitions,
        spawns: s.spawns,
    };
}

export { resolveScripts, decodeByAddress };
