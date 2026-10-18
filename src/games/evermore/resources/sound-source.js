'use strict';
// Ownership: what the Music tab shows about who sent a sound effect: the
// sender the emulator's hook recorded (emulator/sound-source-view.js) turned
// into names, pictures and soe:// links. Pure: ROM bytes + the event in, a
// JSON-ready object out. extension.js injects it into the Music host.
//
//   event  { sfx, kind: 'anim'|'script'|'engine', entity, type, at, sprite, pal, script, caller, pitch }
//   result { who?, animation?, frame?, script?, engine?, pitch? }  (each with label, uri?, image?)
//
// Pictures use context: the Boy in the weapon, the Dog in the act, whose
// palette the entity had loaded (each weapon and act has its own; the hook
// reads the entity's palette slot from $7E1278).

const { readAllCharacters, readCharacter, renderRawSprite, thumbFor } = require('../sprites');
const { animationGroups } = require('../../../../dist/games/evermore/maps/animation-table');
const { disassembleScript } = require('../../../../dist/games/evermore/maps/animation-opcodes');
const vm = require('../script-vm');
const { printNames } = require('../script-model');
const { resolveCharacters } = require('./character-files');
const { asmAroundCall, lineText } = require('./asm-view');
const { renderCharacterSprite } = require('../../../../dist/games/evermore/maps/characters');
const { encodePng } = require('../../../../dist/games/evermore/maps/png');
const { getSoundAnimations } = require('../localizations/sounds');
const { getFunctionName } = require('../localizations/functions');
const { hexId } = require('./resource-uri');
const { hex: toHex } = require('../../../../dist/platform');

const ROM = 'soe://rom/assets/';
const BOY = 0x4E89, DOG = 0x4F37;
const hex = (v, d) => '$' + toHex(v, d);

let _cache = null;   // { rom, byRecordPtr: Map(record low16 -> character id), ops: Map(at -> {...}), images: Map }

function cache(rom) {
    if (_cache && _cache.rom === rom) return _cache;
    const byRecordPtr = new Map();
    readAllCharacters(rom).forEach(c => { if (((c.snes >> 16) & 0xFF) === 0x8E) byRecordPtr.set(c.snes & 0xFFFF, c.id); });
    const ops = new Map();
    for (const e of getSoundAnimations()) {
        for (const a of e.animations) for (const o of a.ops || []) ops.set(o.at, { ...o, sfx: e.sfx, record: a.record, label: a.label, owners: a.owners });
    }
    _cache = { rom, byRecordPtr, ops, images: new Map(), groups: null };
    return _cache;
}

function dataUrl(png) { return 'data:image/png;base64,' + Buffer.from(png).toString('base64'); }

function characterImage(c, id) {
    const key = 'char:' + id;
    if (!c.images.has(key)) {
        let url = null;
        try { const s = renderCharacterSprite(c.rom, id); if (s) url = dataUrl(encodePng(s)); } catch { /* no picture */ }
        c.images.set(key, url);
    }
    return c.images.get(key);
}

function spriteImage(c, sprite, pal) {
    const key = 'spr:' + sprite + ':' + pal;
    if (!c.images.has(key)) {
        let url = null;
        try { const r = renderRawSprite(c.rom, sprite, pal || undefined); if (r) url = r.png; } catch { /* no picture */ }
        c.images.set(key, url);
    }
    return c.images.get(key);
}

/** The Boy's weapon or the Dog's act whose palette the entity has loaded (`pal`), or null. */
function form(rom, id, pal) {
    if ((id !== 0 && id !== 1) || !pal) return null;
    return (readCharacter(rom, id).weapons || []).find(w => (w.paletteAddr & 0xFFFF) === (pal & 0xFFFF)) || null;
}

function formImage(c, id, w) {
    const key = 'form:' + id + ':' + w.name;
    if (!c.images.has(key)) {
        let url = null;
        const idle = (w.anims || []).find(a => /idle/i.test(a.label)) || (w.anims || [])[0];
        try { url = idle ? thumbFor(c.rom, { record: idle.animRec, character: id, paletteAddr: w.paletteAddr }) : null; } catch { /* no picture */ }
        c.images.set(key, url);
    }
    return c.images.get(key);
}

/** The character an entity is: its record pointer (+0x60) is a character record in bank $8E. */
function who(c, ev) {
    const id = ev.entity === BOY ? 0 : ev.entity === DOG ? 1 : c.byRecordPtr.get(ev.type & 0xFFFF);
    const name = ev.name || (id !== undefined ? readCharacter(c.rom, id).name : 'entity ' + hex(ev.entity, 4));
    if (id === undefined) return { label: name, entity: ev.entity };
    const tag = ev.entity === BOY ? 'soe://tags/boy.md' : ev.entity === DOG ? 'soe://tags/dog.md' : null;
    const f = form(c.rom, id, ev.pal);
    return {
        label: name, entity: ev.entity, character: id, form: f ? f.name : null,
        uri: tag || `${ROM}characters/${hexId(id, 2)}/info.md`,
        image: (f && formImage(c, id, f)) || characterImage(c, id),
    };
}

/** The animation script lines around the `sound` command at `at` (from its record's scripts). */
function scriptAround(c, record, at) {
    if (!c.groups) c.groups = new Map(animationGroups(c.rom).map(g => [g.record, g]));
    const g = c.groups.get(record);
    for (const script of g ? g.scripts : []) {
        const lines = disassembleScript(c.rom, script);
        const i = lines.findIndex(l => l.address === at);
        if (i < 0) continue;
        return lines.slice(Math.max(0, i - 3), i + 3).map(l => ({ addr: hex(l.address, 6), text: readableOp(l), mark: l.address === at }));
    }
    return [];
}

/** The pitch commands by what they do (driver command $30 before the next sound). */
function readableOp(l) {
    const op = l.bytes[0] & 0x7F, w = l.bytes[1] | (l.bytes[2] << 8);
    if (op === 0x3F) return w ? 'pitch: lower by the Boy\u2019s stamina / 4' : 'pitch: unchanged';
    if (op === 0x40) { const n = (w << 16) >> 16; return 'pitch ' + (n > 0 ? '+' : '') + (n / 20).toFixed(1) + ' semitones'; }
    return l.text;
}

function gifUrl(c, character, key) {
    const k = 'gif:' + character + ':' + key;
    if (!c.images.has(k)) {
        let url = null;
        try {
            const n = resolveCharacters([hexId(character, 2), 'animations', key, 'animation.gif'], c.rom);
            const b = n && n.read();
            if (b && !(b instanceof Promise)) url = 'data:image/gif;base64,' + Buffer.from(b).toString('base64');
        } catch { /* no picture */ }
        c.images.set(k, url);
    }
    return c.images.get(k);
}

/** The animation whose `sound` command ran ($5D - 2 in the hook), and the frame it shows. */
function animation(c, ev, character) {
    const op = c.ops.get(ev.at);
    if (!op) return null;
    const rec = parseInt(op.record.slice(1), 16);
    let uri = null, gif = null, gifImage = null;
    if (character !== undefined) {
        const a = readCharacter(c.rom, character).anims.find(x => x.animRec === rec);
        if (a) {
            uri = `${ROM}characters/${hexId(character, 2)}/animations/${a.key}/info.md`;
            gif = `${ROM}characters/${hexId(character, 2)}/animations/${a.key}/animation.gif`;
            gifImage = gifUrl(c, character, a.key);
        } else {
            uri = `${ROM}characters/${hexId(character, 2)}/animations/index.md`;
        }
    }
    return {
        label: op.label || 'animation ' + op.record, record: op.record, at: hex(ev.at, 6), uri, gif, gifImage,
        sprite: op.sprite, pitch: op.pitch, lines: scriptAround(c, rec, ev.at),
    };
}

function describeSoundSource(rom, ev) {
    if (!rom || !ev) return null;
    const c = cache(rom), out = {};
    if (typeof ev.pitch === 'number' && ev.pitch) {
        out.pitch = { offset: ev.pitch, semitones: Math.round(ev.pitch / 2) / 10, label: (ev.pitch > 0 ? '+' : '') + (ev.pitch / 20).toFixed(1) + ' semitones' };
    }
    if (ev.kind === 'anim') {
        out.who = who(c, ev);
        out.animation = animation(c, ev, out.who.character);
        const sprite = ev.sprite || (out.animation && out.animation.sprite) || 0;
        if (sprite) out.frame = { label: 'frame ' + hex(sprite, 6) + (ev.sprite ? ' (on screen)' : ' (the script’s next frame)'), image: spriteImage(c, sprite, ev.pal) };
        if (out.animation && out.animation.pitch === 'stamina') {
            out.pitch = Object.assign(out.pitch || { offset: 0, label: 'unchanged' }, { why: 'animation command 0x3F: lower by the Boy’s stamina / 4', uri: 'soe://tags/boy/stamina.md' });
        } else if (out.animation && typeof out.animation.pitch === 'number') {
            const n = out.animation.pitch;
            out.pitch = Object.assign(out.pitch || { offset: n, label: (n > 0 ? '+' : '') + (n / 20).toFixed(1) + ' semitones' }, { why: 'animation command 0x40: a fixed offset' });
        }
    } else if (ev.kind === 'script') {
        let lines = [];
        try {
            const sr = new vm.ScriptRom(rom), names = printNames((bus) => bus & 0x3fffff);
            lines = vm.scriptInstructions(sr, ev.script).slice(0, 6).map((i, k) => ({ addr: hex(i.address, 6), text: vm.text(i, names), mark: k === 0 }));
        } catch { /* not a script */ }
        out.script = { label: 'script ' + hex(ev.script, 6), uri: `${ROM}scripts/0x${(ev.script >>> 0).toString(16)}.md`, lines };
    } else {
        const fn = getFunctionName(ev.caller);
        const asm = asmAroundCall(rom, ev.caller);
        out.engine = {
            label: (fn && !/^(func|sub)_/i.test(fn) ? fn + ' ' : '') + hex(ev.caller, 6),
            uri: 'soe://bus/' + (ev.caller >>> 0).toString(16) + '.asm',
            lines: asm.lines.map(l => ({ addr: hex(l.addr, 6), text: l.text + (l.name ? '   ; ' + l.name : ''), mark: !!l.mark })),
            note: asm.assumed,
        };
    }
    return out;
}

module.exports = { describeSoundSource };
