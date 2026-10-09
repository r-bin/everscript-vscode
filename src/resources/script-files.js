'use strict';
// Ownership: `soe://rom/assets/scripts/` - disassembled ROM scripts, room enter/triggers, and Everscript views.
// Pure apart from the ROM buffer it is handed.

const {
    decodeScript, buildRoomScriptModel, snesToRom,
    extractLoot, extractTransitions, extractSpawns, isLoot, lootToEverscript,
} = require('../script');
const { MAX_ROOMS } = require('../maps');
const {
    getMapName, getMapArea,
    getAbsScript, getNpcScript, getGlobalScript,
} = require('../localizations');
const { hexId } = require('../shared/resource-uri');
const { dir, json, text } = require('./nodes');
const MD = require('./script-markdown');

function resolveScripts(segments, rom) {
    if (segments.length > 0 && segments[0] === 'everscript') {
        return resolveScripts(segments.slice(1), rom);
    }
    if (segments.length === 0) {
        return dir([
            ['index.md', 'file'],
            ['index.json', 'file'],
            ['rooms', 'dir'],
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

    // Direct script lookup by address or name
    return resolveDirectScript(head, rom);
}

function resolveRoomScripts(rest, rom) {
    if (rest.length === 0) {
        return dir([
            ['index.md', 'file'],
            ['index.json', 'file'],
            ...Array.from({ length: MAX_ROOMS }, (_, i) => [hexId(i, 2), 'dir']),
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
            ['step-on', 'dir'],
            ['b-trigger', 'dir'],
        ], () => renderRoomIndexMd(rom, mapId));
    }

    if (sub === 'index.md') return text(() => renderRoomIndexMd(rom, mapId));
    if (sub === 'index.json') return json(() => rom ? buildRoomScriptModel(rom, mapId) : { mapId, error: 'no ROM' });

    if (sub === 'enter.md' || sub === 'enter.evs' || sub === 'enter.json') {
        return renderRoomEnter(rom, mapId, sub.split('.')[1]);
    }

    if (sub === 'step-on') {
        return renderTriggersDir(rom, mapId, 'step-on', leaf);
    }
    if (sub === 'b-trigger') {
        return renderTriggersDir(rom, mapId, 'b-trigger', leaf);
    }

    return null;
}

function parseRoomId(str) {
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

function renderRoomIndexMd(rom, mapId) {
    if (!rom) return `# Room ${hexId(mapId, 2)} Scripts\n\n(no ROM available)`;
    const model = buildRoomScriptModel(rom, mapId);
    return MD.roomScriptsIndexMarkdown(model, mapId, getMapName(mapId, { full: true }), getMapArea(mapId));
}

function renderRoomEnter(rom, mapId, ext) {
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

function renderTriggersDir(rom, mapId, kind, leaf) {
    if (!rom) return null;
    const model = buildRoomScriptModel(rom, mapId);
    const list = kind === 'step-on' ? model.stepOn : model.bTrigger;
    if (leaf === undefined) {
        return dir([
            ['index.md', 'file'],
            ...list.map((_, i) => [`${i}.md`, 'file']),
            ...list.map((_, i) => [`${i}.evs`, 'file']),
            ...list.map((_, i) => [`${i}.json`, 'file']),
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

function resolveDirectScript(name, rom) {
    const m = /^([^\.]+)\.(md|evs|json)$/i.exec(name);
    if (!m) return null;
    const ident = m[1].trim();
    const ext = m[2].toLowerCase();

    // Check named script / known IDs first (NPC, ABS, Global)
    const { formatScript } = require('./localization-files');
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
    let addr = null;
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

function decodeByAddress(rom, snesAddr) {
    const s = decodeScript(rom, snesAddr);
    const fileOff = snesToRom(snesAddr);
    const instrs = s.instructions.map(ins => {
        const off = snesToRom(ins.address);
        const raw = off < rom.length ? rom.subarray(off, Math.min(rom.length, off + ins.size)) : new Uint8Array(0);
        const bytesHex = Array.from(raw).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
        return {
            addressSnes: ins.address,
            opcode: ins.opcode,
            opcodeHex: '0x' + ins.opcode.toString(16).padStart(2, '0'),
            size: ins.size,
            bytesHex,
            summary: ins.summary,
            terminal: ins.terminal,
            depth: 0,
        };
    });
    const loot = extractLoot(s.instructions);
    const lootList = isLoot(loot) ? [loot] : [];
    const named = getAbsScript(snesAddr);
    return {
        addressSnes: snesAddr,
        romOffset: fileOff,
        name: named ? named.name : null,
        instructions: instrs,
        stopReason: s.stopReason,
        terminated: s.stopReason === 'terminated',
        label: instrs.length > 0 ? instrs[0].summary : '',
        loot: lootList,
        everscript: lootList.map(lootToEverscript).filter(Boolean),
        transitions: extractTransitions(s.instructions),
        spawns: extractSpawns(s.instructions),
    };
}

module.exports = {
    resolveScripts,
    decodeByAddress,
};
