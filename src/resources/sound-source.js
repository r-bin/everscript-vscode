'use strict';
// Ownership: what the Music tab shows about who sent a sound effect: the
// sender the emulator's hook recorded (emulator/sound-source-view.js) turned
// into names, pictures and soe:// links. Pure: ROM bytes + the event in, a
// JSON-ready object out. extension.js injects it into the Music host.
//
//   event  { sfx, kind: 'anim'|'script'|'engine', entity, type, at, sprite, pal, script, caller, pitch }
//   result { who?, animation?, frame?, script?, engine?, pitch? }  (each with label, uri?, image?)

const { readAllCharacters, readCharacter, renderRawSprite } = require('../sprites');
const { renderCharacterSprite } = require('../maps/dist/characters');
const { encodePng } = require('../maps/dist/png');
const { getSoundAnimations } = require('../localizations/sounds');
const { getFunctionName } = require('../localizations/functions');
const { hexId } = require('../shared/resource-uri');

const ROM = 'soe://rom/assets/';
const BOY = 0x4E89, DOG = 0x4F37;
const hex = (v, d) => '$' + (v >>> 0).toString(16).toUpperCase().padStart(d, '0');

let _cache = null;   // { rom, byRecordPtr: Map(record low16 -> character id), ops: Map(at -> {...}), images: Map }

function cache(rom) {
    if (_cache && _cache.rom === rom) return _cache;
    const byRecordPtr = new Map();
    readAllCharacters(rom).forEach(c => { if (((c.snes >> 16) & 0xFF) === 0x8E) byRecordPtr.set(c.snes & 0xFFFF, c.id); });
    const ops = new Map();
    for (const e of getSoundAnimations()) {
        for (const a of e.animations) for (const o of a.ops || []) ops.set(o.at, { ...o, sfx: e.sfx, record: a.record, label: a.label, owners: a.owners });
    }
    _cache = { rom, byRecordPtr, ops, images: new Map() };
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

/** The character an entity is: its record pointer (+0x60) is a character record in bank $8E. */
function who(c, ev) {
    const id = ev.entity === BOY ? 0 : ev.entity === DOG ? 1 : c.byRecordPtr.get(ev.type & 0xFFFF);
    const name = ev.name || (id !== undefined ? readCharacter(c.rom, id).name : 'entity ' + hex(ev.entity, 4));
    if (id === undefined) return { label: name, entity: ev.entity };
    const tag = ev.entity === BOY ? 'soe://tags/boy.md' : ev.entity === DOG ? 'soe://tags/dog.md' : null;
    return {
        label: name, entity: ev.entity, character: id,
        uri: tag || `${ROM}characters/${hexId(id, 2)}/info.md`,
        image: characterImage(c, id),
    };
}

/** The animation whose `sound` command ran ($5D - 2 in the hook), and the frame it shows. */
function animation(c, ev, character) {
    const op = c.ops.get(ev.at);
    if (!op) return null;
    const rec = parseInt(op.record.slice(1), 16);
    let uri = null, gif = null;
    if (character !== undefined) {
        const a = readCharacter(c.rom, character).anims.find(x => x.animRec === rec);
        if (a) {
            uri = `${ROM}characters/${hexId(character, 2)}/animations/${a.key}/info.md`;
            gif = `${ROM}characters/${hexId(character, 2)}/animations/${a.key}/animation.gif`;
        } else {
            uri = `${ROM}characters/${hexId(character, 2)}/animations/index.md`;
        }
    }
    return { label: op.label || 'animation ' + op.record, record: op.record, at: hex(ev.at, 6), uri, gif, sprite: op.sprite, pitch: op.pitch };
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
        out.script = { label: 'script ' + hex(ev.script, 6), uri: `${ROM}scripts/0x${(ev.script >>> 0).toString(16)}.md` };
    } else {
        const fn = getFunctionName(ev.caller);
        out.engine = { label: (fn && !/^(func|sub)_/i.test(fn) ? fn + ' ' : '') + hex(ev.caller, 6) };
    }
    return out;
}

module.exports = { describeSoundSource };
