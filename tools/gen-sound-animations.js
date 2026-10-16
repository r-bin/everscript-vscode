#!/usr/bin/env node
'use strict';
// Writes src/games/evermore/localizations/data/sound-animations.json: which animations play
// which sound. Run after a change to the animation catalogue:
//   npm run build:ts && node tools/gen-sound-animations.js [rom.smc]
//
// Animation command 0x2E / 0x2F `sound n` ($90:8921 / $90:894E) doubles n
// (ASL) and reads the word at $8C:8362 + 2n, then calls $8C:82DC, which sends
// driver command $04. So n is the sound() script id 2n (the script opcode
// indexes the same table with its byte unshifted). $FFFF entries are muted.
// Keys: script id; values: { sfx: driver effect, animations: [...] }. Each
// animation lists its sound commands: { at (ROM address of the command, what the
// emulator's sound-source hook sees in $5D - 2), sprite (the frame it shows next),
// pitch? } where pitch is a variation sent just before as driver command $30
// (a pitch offset in 1/20 semitone for the next effect, $1DA7 -> $D9+2v):
//   0x40 word   a fixed offset (signed word)        -> pitch: n
//   0x3F word   -(Boy's stamina $7E4EB7 >> 2) when the word is non-zero -> pitch: 'stamina'

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const romPath = require('./rom').romOrExit('evermore', process.argv[2]);
const { animationGroups } = require('../dist/games/evermore/maps/animation-vm');
const { disassembleScript } = require('../dist/games/evermore/maps/animation-opcodes');
const { readAllCharacters, buildAnimationCatalog } = require('../src/games/evermore/sprites');

const SCRIPT_SFX = 0x0C8362;
const SOUND_OPS = [0x2E, 0x2F];
const PITCH_STAMINA = 0x3F, PITCH_FIXED = 0x40;
const SPRITE_OPS = l => /^sprite(_long)? /.test(l.text);
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

/** The sprite a script shows after line i (the frame on screen when the sound plays), else before it. */
function spriteAfter(lines, i) {
    const spriteOf = l => {
        const m = /\$([0-9a-f]{6})/i.exec(l.text);
        return m ? parseInt(m[1], 16) : 0;
    };
    for (let k = i + 1; k < lines.length; k++) if (SPRITE_OPS(lines[k])) return spriteOf(lines[k]);
    for (let k = i - 1; k >= 0; k--) if (SPRITE_OPS(lines[k])) return spriteOf(lines[k]);
    return 0;
}

function build(rom) {
    let raw = fs.readFileSync(rom);
    if (raw.length % 0x8000 === 0x200) raw = raw.subarray(0x200);
    const catalog = buildAnimationCatalog(raw, readAllCharacters(raw));
    const byRecord = new Map(catalog.map(c => [c.record, c]));
    const byScript = new Map();
    for (const g of animationGroups(raw)) {
        for (const script of g.scripts) {
            const lines = disassembleScript(raw, script);
            let pitch = null;
            lines.forEach((l, i) => {
                const op = l.bytes[0] & 0x7F;
                if (l.known && op === PITCH_FIXED) pitch = ((l.bytes[1] | l.bytes[2] << 8) << 16) >> 16;
                if (l.known && op === PITCH_STAMINA) pitch = (l.bytes[1] | l.bytes[2]) ? 'stamina' : null;
                if (!l.known || !SOUND_OPS.includes(op)) return;
                const n = l.bytes[1], sfx = raw[SCRIPT_SFX + 2 * n] | raw[SCRIPT_SFX + 2 * n + 1] << 8;
                const hit = { at: l.address, sprite: spriteAfter(lines, i), ...(pitch !== null ? { pitch } : {}) };
                pitch = null;
                if (sfx === 0xFFFF) return;
                const id = '0x' + hex(2 * n, 2).toLowerCase();
                if (!byScript.has(id)) byScript.set(id, { sfx, records: new Map() });
                const rec = byScript.get(id).records;
                if (!rec.has(g.record)) rec.set(g.record, { maybe: op === 0x2F, ops: [] });
                if (!rec.get(g.record).ops.some(o => o.at === hit.at)) rec.get(g.record).ops.push(hit);
            });
        }
    }
    const out = {};
    for (const id of [...byScript.keys()].sort()) {
        const { sfx, records } = byScript.get(id);
        out[id] = {
            sfx,
            animations: [...records].sort((a, b) => a[0] - b[0]).map(([record, r]) => {
                const e = byRecord.get(record);
                return { record: '$' + hex(record, 4), label: e ? e.label : '', ...(r.maybe ? { sometimes: true } : {}), ops: r.ops, owners: owners(e) };
            }),
        };
    }
    return out;
}

const data = build(romPath);
const file = path.join(ROOT, 'src', 'games', 'evermore', 'localizations', 'data', 'sound-animations.json');
fs.writeFileSync(file, '{\n' + Object.entries(data).map(([k, v]) => JSON.stringify(k) + ': ' + JSON.stringify(v)).join(',\n') + '\n}\n');
console.log('wrote ' + path.relative(ROOT, file) + ': ' + Object.keys(data).length + ' sounds');
