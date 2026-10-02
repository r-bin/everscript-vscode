'use strict';
// Ownership: the catalogue of every animation in the ROM for the Sprites tab — each
// record of the table at $C43E3A, who uses it, and which palette to draw it in. Pure.
//
// Four things point at records (docs/script-format/animation_script.md): a character's
//   fields +0x32..+0x46, the Boy's weapon table, the global id table at $C43C92 that
//   `animate(entity, mode, id)` reads for ids below 0x8000, and the projectile records
//   ($900000 + id) that animation command 0x4c throws.

const indexJson = require('../language/data/index.json');
const { animationGroups, animationIdRecord, ANIMATION_ID_COUNT } = require('../maps/dist/animation-vm');
const { disassembleScript } = require('../maps/dist/animation-opcodes');
const { projectileRecord } = require('../maps/dist/projectiles');

const PROJECTILE_OP = 0x4c;

/** Enum groups whose values are global animation ids, and who they belong to. */
const ID_ENUMS = ['ANIMATION_BOY', 'ANIMATION_DOG', 'ANIMATION_ENEMY', 'ANIMATION_PLACEHOLDER', 'ANIMATION_ALL'];
const BOY = 0;
const DOG = 1;

const hex = (v, d) => v.toString(16).padStart(d, '0');

/** Global id → the enum names that spell it, e.g. 0xae → ['ANIMATION_ENEMY.MAGMAR_ENTER']. */
function idNames() {
    const out = new Map();
    const enums = indexJson.enums || {};
    for (const group of ID_ENUMS) {
        for (const item of enums[group] || []) {
            const v = String(item.value || '');
            if (!v.startsWith('0x')) continue;
            const id = parseInt(v, 16);
            if (id >= 0x8000) continue;           // a character-relative field, not a global id
            if (!out.has(id)) out.set(id, []);
            out.get(id).push({ group, name: item.name });
        }
    }
    return out;
}

/** The character whose palette suits an id's enum name: Boy, Dog, or a name-prefix match. */
function paletteOwnerForNames(names, characters) {
    for (const n of names) {
        if (n.group === 'ANIMATION_BOY') return BOY;
        if (n.group === 'ANIMATION_DOG') return DOG;
        const match = characters.find((c) => {
            const upper = String(c.name || '').toUpperCase().replace(/[^A-Z0-9]/g, '_');
            return upper.length > 2 && (n.name === upper || n.name.startsWith(upper + '_'));
        });
        if (match) return match.id;
    }
    return null;
}

/**
 * Every animation in the ROM, in record order.
 * `characters` is readAllCharacters()'s output, which already carries each field's record.
 */
function buildAnimationCatalog(rom, characters) {
    const owners = new Map();
    const add = (record, owner) => {
        if (!record) return;
        if (!owners.has(record)) owners.set(record, []);
        owners.get(record).push(owner);
    };

    for (const c of characters) {
        for (const a of c.anims || []) {
            if (a.category === 'standard') add(a.animRec, { kind: 'character', id: c.id, name: c.name, label: a.label });
        }
        for (const w of c.weapons || []) {
            for (const a of w.anims || []) add(a.animRec, { kind: 'weapon', id: c.id, name: w.name, label: a.label, paletteAddr: w.paletteAddr || 0 });
        }
    }

    const names = idNames();
    for (let id = 0; id < ANIMATION_ID_COUNT * 2; id += 2) {
        const idLabels = names.get(id) || [];
        add(animationIdRecord(rom, id), {
            kind: 'id',
            id,
            idHex: '0x' + hex(id, 4),
            names: idLabels.map((n) => n.name),
            paletteCharacter: paletteOwnerForNames(idLabels, characters),
        });
    }

    const groups = animationGroups(rom);
    // A weapon animation is drawn in that weapon's palette, unless a character owns it outright.
    const weaponPaletteOf = (record) => {
        const list = owners.get(record) || [];
        if (list.some((o) => o.kind === 'character')) return 0;
        const w = list.find((o) => o.kind === 'weapon');
        return w ? w.paletteAddr : 0;
    };
    const paletteOf = (record) => {
        const list = owners.get(record) || [];
        const firstChar = list.find((o) => o.kind === 'character' || o.kind === 'weapon');
        const named = list.find((o) => o.kind === 'id' && o.paletteCharacter !== null);
        return firstChar ? firstChar.id : named ? named.paletteCharacter : null;
    };

    // Projectiles: a record thrown by another animation belongs to its thrower,
    // and takes the projectile's own palette or, when that is 0, the thrower's.
    const thrown = new Map();
    for (const g of groups) {
        const ids = new Set();
        for (const script of g.scripts) {
            for (const l of disassembleScript(rom, script)) {
                if ((l.bytes[0] & 0x7f) === PROJECTILE_OP && l.known) ids.add(l.bytes[1] | (l.bytes[2] << 8));
            }
        }
        for (const id of ids) {
            const p = projectileRecord(rom, id);
            if (!p.animRecord) continue;
            add(p.animRecord, { kind: 'projectile', id, idHex: '$' + hex(id, 4), thrower: '$' + hex(g.record, 4) });
            if (!thrown.has(p.animRecord)) {
                thrown.set(p.animRecord, { paletteAddr: p.palette || weaponPaletteOf(g.record), paletteCharacter: paletteOf(g.record) });
            }
        }
    }

    return groups.map((g) => {
        const list = owners.get(g.record) || [];
        const t = thrown.get(g.record);
        const own = paletteOf(g.record);
        const paletteCharacter = own !== null ? own : t && t.paletteCharacter !== null ? t.paletteCharacter : BOY;
        return {
            record: g.record,
            recHex: '$' + hex(g.record, 4),
            flags: g.flags,
            facingCount: g.facings.length,
            scriptHex: '$' + hex(g.scripts[0], 6),
            owners: list,
            label: catalogLabel(list),
            paletteCharacter,
            paletteAddr: own === null && t ? t.paletteAddr : weaponPaletteOf(g.record),
        };
    });
}

/** A short human label: the first owner that names it. */
function catalogLabel(list) {
    for (const o of list) {
        if (o.kind === 'character') return `${o.name} · ${o.label}`;
        if (o.kind === 'weapon') return `${o.name} · ${o.label}`;
    }
    for (const o of list) {
        if (o.kind === 'id' && o.names.length) return o.names[0];
    }
    const thrown = list.find((o) => o.kind === 'projectile');
    if (thrown) return `projectile ${thrown.idHex}`;
    const id = list.find((o) => o.kind === 'id');
    return id ? `id ${id.idHex}` : 'no known owner';
}

module.exports = {
    buildAnimationCatalog,
};
