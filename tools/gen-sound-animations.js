#!/usr/bin/env node
'use strict';
// Writes src/localizations/data/sound-animations.json: which animations play
// which sound. Run after a change to the animation catalogue:
//   npm run build:maps && node tools/gen-sound-animations.js [rom.smc]
//
// Animation command 0x2E / 0x2F `sound n` ($90:8921 / $90:894E) doubles n
// (ASL) and reads the word at $8C:8362 + 2n, then calls $8C:82DC, which sends
// driver command $04. So n is the sound() script id 2n (the script opcode
// indexes the same table with its byte unshifted). $FFFF entries are muted.
// Keys: script id; values: { sfx: driver effect, animations: [...] }.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const romPath = process.argv[2] || path.join(ROOT, 'script_parser', 'dependencies', 'Secret of Evermore (U) [!].smc');
const { animationGroups } = require('../src/maps/dist/animation-vm');
const { disassembleScript } = require('../src/maps/dist/animation-opcodes');
const { readAllCharacters, buildAnimationCatalog } = require('../src/sprites');

const SCRIPT_SFX = 0x0C8362;
const SOUND_OPS = [0x2E, 0x2F];
const hex = (v, d) => v.toString(16).toUpperCase().padStart(d, '0');

/** Who plays a record, as short { who, what, character? } entries. */
function owners(entry) {
    const out = [];
    for (const o of entry ? entry.owners : []) {
        if (o.kind === 'character') out.push({ who: o.name, what: o.label, character: o.id, attack: /attack/i.test(o.label) });
        else if (o.kind === 'weapon') out.push({ who: o.name, what: o.label, character: o.id, attack: /attack/i.test(o.label) });
        else if (o.kind === 'id' && o.names.length) out.push({ who: 'animate()', what: o.names.join(' / ') });
        else if (o.kind === 'projectile') out.push({ who: 'projectile ' + o.idHex, what: 'thrown by ' + o.thrower });
    }
    const seen = new Set();
    return out.filter(o => { const k = o.who + '|' + o.what; return !seen.has(k) && seen.add(k); });
}

function build(rom) {
    let raw = fs.readFileSync(rom);
    if (raw.length % 0x8000 === 0x200) raw = raw.subarray(0x200);
    const catalog = buildAnimationCatalog(raw, readAllCharacters(raw));
    const byRecord = new Map(catalog.map(c => [c.record, c]));
    const byScript = new Map();
    for (const g of animationGroups(raw)) {
        for (const script of g.scripts) {
            for (const l of disassembleScript(raw, script)) {
                if (!l.known || !SOUND_OPS.includes(l.bytes[0] & 0x7F)) continue;
                const n = l.bytes[1], sfx = raw[SCRIPT_SFX + 2 * n] | raw[SCRIPT_SFX + 2 * n + 1] << 8;
                if (sfx === 0xFFFF) continue;
                const id = '0x' + hex(2 * n, 2).toLowerCase();
                if (!byScript.has(id)) byScript.set(id, { sfx, records: new Map() });
                byScript.get(id).records.set(g.record, (l.bytes[0] & 0x7F) === 0x2F);
            }
        }
    }
    const out = {};
    for (const id of [...byScript.keys()].sort()) {
        const { sfx, records } = byScript.get(id);
        out[id] = {
            sfx,
            animations: [...records].sort((a, b) => a[0] - b[0]).map(([record, maybe]) => {
                const e = byRecord.get(record);
                return { record: '$' + hex(record, 4), label: e ? e.label : '', ...(maybe ? { sometimes: true } : {}), owners: owners(e) };
            }),
        };
    }
    return out;
}

const data = build(romPath);
const file = path.join(ROOT, 'src', 'localizations', 'data', 'sound-animations.json');
fs.writeFileSync(file, '{\n' + Object.entries(data).map(([k, v]) => JSON.stringify(k) + ': ' + JSON.stringify(v)).join(',\n') + '\n}\n');
console.log('wrote ' + path.relative(ROOT, file) + ': ' + Object.keys(data).length + ' sounds');
