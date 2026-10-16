// Ownership: instructions that act on entities — the boy, the dog, NPCs and
// map objects. Movement, facing, spawning, damage, teleports.
//
// Ported case-for-case from SoEScriptDumper/list-rooms.cpp. Most of these
// take their subject as an expression rather than an id, which is why they
// cannot be sized without parsing it.

import { ramAddr, read16, u8, u16 } from './addressing';
import { Cursor, OpResult, done } from './cursor';
import { isFinalInlineValue } from './expression';
import { mapName, npcScriptName } from './names';

/** Lower-case hex of at least `width` digits, as the dumper's `%0Nx`. */
function hx(n: number, width: number): string {
    return (n >>> 0).toString(16).padStart(width, '0');
}

/** As `hx`, with the `0x` the dumper prints — and no masking to `width`. */
function h(n: number, width: number): string {
    return '0x' + hx(n, width);
}

/** 0x2e — wait for something to finish walking; five ways to name it. */
function waitForEntity(c: Cursor): OpResult {
    const type = c.u8();
    if (type === 0x8d || type === 0x88) {
        const addr = (type === 0x8d ? 0x2834 : 0x2258) + c.u16();
        return done(c, `Wait for entity from *${ramAddr(addr)} to reach destination`);
    }
    const ENTITY_ONLY: Record<number, string> = {
        0xd0: 'boy', 0xd1: 'dog', 0xd2: 'controlled char',
        0xd3: 'non-controlled char', 0xad: 'last entity ($0341)',
        0xae: 'entity attached to script?',
    };
    if (ENTITY_ONLY[type]) {
        return done(c, `Wait for ${ENTITY_ONLY[type]} (${hx(type, 2)}) to reach destination`);
    }
    if (isFinalInlineValue(type)) {
        return done(c, `Wait for character #${type & 0x0f} ?! to reach destination`);
    }
    if (type === 0x84) {
        c.u16();
        return done(c, `Wait for character #${type & 0x0f} ?! to reach destination`);
    }
    if (type === 0x92) {
        const arg = c.u8();
        return done(c, `Wait for character from sub-instr ${hx(type, 2)} ${hx(arg, 2)} to reach destination`);
    }
    // Quicksand fields index an entity table through a variable.
    if (type === 0x04 && c.peek(2) === 0x29 && (c.peek(3) === 0x08 || c.peek(3) === 0x0d) && c.peek(6) === 0x9a) {
        const off = read16(c.rom, c.addr);
        const addr = (c.peek(3) === 0x0d ? 0x2834 : 0x2258) + read16(c.rom, c.addr + 4);
        c.addr += 7;
        return done(c, `Wait for entity from *${ramAddr(addr)} +${u16(off)} to reach destination`);
    }
    c.ok = false;
    return done(c, `Wait for unknown to reach destination ${u8(type)} ...`);
}

/** 0x3f — point an entity at one of the short scripts. */
function setNpcScript(c: Cursor): OpResult {
    const type = c.u8();
    if (isFinalInlineValue(type)) {
        const slot = ((type & 0x0f) - 1) << 1;
        const val1 = c.u16();
        const val2 = c.u16();
        return done(c, `WRITE $0ea2+${slot.toString(16)}=${h(val1, 2)}, $0eac+${slot.toString(16)}=${h(val2, 2)} (unknown): ${npcScriptName(val2)}?`);
    }
    c.back();
    const entity = c.expr();
    if (!c.ok) return done(c, `UNKNOWN INSTR sub ${u8(type)}`);
    const val1 = c.u16();
    const val2 = c.u16();
    // The first word says which of the entity's script slots is being set,
    // which is also what upstream names an unnamed target after.
    const kind = val1 === 0x040 ? 'NPC Talk' : val1 === 0x100 ? 'NPC Damage'
        : val1 === 0x200 ? 'NPC Kill' : 'NPC';
    return done(c, `WRITE ${entity}+x68=${h(val1, 2)}, ${entity}+x66=${h(val2, 2)} (set script): ${npcScriptName(val2, kind)}`);
}

/** 0x9e / 0xac — cast a spell at a zero-terminated list of targets. */
function castSpell(c: Cursor, instr: number): OpResult {
    const info = instr === 0xac ? ' if alive' : '';
    const entity = c.expr();
    const spell = c.expr();
    const power = c.expr();
    const targets: string[] = [];
    for (;;) {
        const t = c.ok ? c.expr() : '?';
        if (t === '0') break;                 // a literal zero ends the list
        if (t) targets.push(t);
        if (!c.ok || !t) break;
    }
    return done(c, `${entity} CASTS SPELL ${spell} POWER ${power} ON ${targets.join(', ')}${info}`);
}

/** Decode one entity opcode, or null if this module does not own it. */
export function entityOp(c: Cursor, instr: number): OpResult | null {
    switch (instr) {
        case 0x20: {
            const a = c.u8();
            const b = c.u8();
            return done(c, `Teleport both to ${hx(a, 2)} ${hx(b, 2)}`);
        }
        case 0x22: {
            const x = c.u8() << 3;
            const y = c.u8() << 3;
            // Upstream reads a word and keeps the low byte.
            const id = c.u16() & 0xff;
            const name = mapName(id);
            return done(c, `CHANGE MAP = 0x${hx(id, 2)} @ [ 0x${hx(x, 4)} | 0x${hx(y, 4)} ]${name ? `: "${name}"` : ''}`,
                { effects: [{ kind: 'changeMap', mapId: id, x, y }] });
        }

        case 0x2a:
        case 0x2b: {
            const how = instr === 0x2a ? 'script controlled' : 'player/AI controlled';
            return done(c, `Make ${c.expr()} ${how}`);
        }
        case 0x2c:
        case 0x2d: {
            const type = c.u8();
            if (type === 0x08) {
                return done(c, `UNTRACED INSTR for script caller (${u8(type)})`, { untraced: true });
            }
            // Upstream prints this in red but keeps going, so this does too.
            return done(c, `UNKNOWN INSTR, arg ${u8(type)}`);
        }
        case 0x2e:
            return waitForEntity(c);

        case 0x3c: {
            const npc = c.u16();
            const state = c.u16();
            const x = c.u8();
            const y = c.u8();
            return done(c, `Load NPC ${hx(npc, 4)}>>1 flags/state ${hx(state, 4)} at pos ${hx(x, 2)} ${hx(y, 2)}`,
                { effects: [{ kind: 'spawn', npc: npc >> 1, state, x, y, opcode: instr }] });
        }
        case 0x3d: {
            const entity = c.expr();
            const id = c.u16();
            return done(c, `WRITE ${entity}+x66=${h(id, 2)}, ${entity}+x68=0x0040 (talk script): ${npcScriptName(id, 'NPC talk')}`);
        }
        case 0x3f:
            return setNpcScript(c);

        case 0x42: {
            const entity = c.expr();
            const pos = c.u16();
            if (pos === 0x0101) return done(c, `Teleport ${entity} to 1,1 (hidden)`);
            return done(c, `Teleport ${entity} to ${hx(pos >> 8, 2)}, ${hx(pos & 0xff, 2)}`);
        }
        case 0x43:
        case 0xb9: {
            const toby = instr === 0x43 ? 'to' : 'by';
            const entity = c.expr();
            const x = c.expr();
            const y = c.expr();
            return done(c, `Teleport ${entity} ${toby} x:${x}, y:${y}`);
        }
        case 0x96: {
            const x = c.expr();
            const y = c.expr();
            return done(c, `Teleport player by ${x}, ${y} screens`);
        }

        case 0x4e:
            return done(c, `ATTACH entity ${c.expr()} TO SCRIPT`);

        case 0x5c: {
            const obj = c.expr();
            const v = c.expr();
            return done(c, `SET OBJ ${obj} STATE = val:${v} (load/unload)`);
        }
        case 0x5d: {
            const obj = c.expr();
            if (!c.ok) return done(c, `IF ...? THEN UNLOAD OBJ ${obj}`);
            const word = c.u16();
            const addr = 0x2258 + (word >> 3);
            return done(c, `IF ${ramAddr(addr)} & ${u8(1 << (word & 7))} THEN UNLOAD OBJ ${obj} (TODO: verify this)`);
        }

        case 0x6c: {
            const entity = c.expr();
            const a = c.u8();
            const b = c.u8();
            if (!c.ok) return done(c, `UNKNOWN INSTR for ${entity} ...`);
            return done(c, `UNTRACED INSTR for ${entity} with val1=${u8(a)},val2=${u8(b)}`, { untraced: true });
        }
        case 0x6e: {
            const entity = c.expr();
            if (!c.ok) return done(c, `Make ${entity} walk to ...?`);
            const x = c.u8();
            const y = c.u8();
            return done(c, `Make ${entity} walk to x=${u8(x)},y=${u8(y)}`);
        }
        case 0x6d:
        case 0x6f:
        case 0x73:
        case 0x9d: {
            const entity = c.expr();
            const x = c.expr();
            const y = c.expr();
            const toby = instr === 0x73 || instr === 0x9d ? 'to' : 'by';
            const direct = instr === 0x6f || instr === 0x73 ? ' directly' : '';
            return done(c, `Make ${entity} walk ${toby} ${x},${y}${direct}`);
        }
        case 0x70:
        case 0x71: {
            const a = c.expr();
            const b = c.expr();
            return instr === 0x70
                ? done(c, `Make ${a} face ${b} `)
                : done(c, `Make ${a} and ${b} face each other`);
        }
        case 0x74: case 0x75: case 0x76: case 0x77: {
            const dir = instr === 0x77 ? 'EAST' : instr === 0x75 ? 'SOUTH' : instr === 0x74 ? 'NORTH' : 'WEST';
            return done(c, `MAKE ${c.expr()} FACE ${dir}`);
        }
        case 0x78:
        case 0x79: {
            const entity = c.expr();
            const val = c.u16();
            const v = c.expr();
            const what = `for ${entity}, ${u16(val)} ${v} changes sprite/animation/...?`;
            if (!c.ok) return done(c, `UNKNOWN INSTR ${what}`);
            return done(c, `UNTRACED INSTR ${what}`, { untraced: true });
        }

        case 0x92: case 0x93: case 0x94: case 0x95: case 0xbb: {
            const info = instr === 0xbb ? 'SHOWING NUMBER'
                : instr === 0x94 || instr === 0x92 ? 'WITH ANIMATION' : '';
            const kind = instr < 0x94 || instr === 0xbb ? 'DAMAGE' : 'HEAL';
            const entity = c.expr();
            const v = c.expr();
            return done(c, `${kind} ${entity} FOR ${v} ${info}`.trimEnd());
        }

        case 0x98:
            return done(c, `SWITCH CHAR TO ${c.expr()}`);
        case 0x9b:
            return done(c, `DESTROY/DEALLOC ENTITY ${c.expr()}`);
        case 0x9c:
            return done(c, `DECREMENT SCRIPT COUNTER FOR ENTITY ${c.expr()} ?`);
        case 0x9e:
        case 0xac:
            return castSpell(c, instr);

        case 0xa2: {
            const npc = c.u16();
            const flags = c.u16();
            const x = c.expr();
            const y = c.expr();
            // x and y are expressions here, so there is no literal position
            // to report — only that something spawns.
            return done(c, `SPAWN NPC 0x${hx(npc, 4)}>>1, flags 0x${hx(flags, 2)}, x:${x}, y:${y}`,
                { effects: [{ kind: 'spawn', npc: npc >> 1, state: flags, x: null, y: null, opcode: instr }] });
        }
        case 0xa9: {
            const entity = c.expr();
            const bits = c.expr();
            if (!c.ok) return done(c, `UNKNOWN INSTR entity ${entity} bits ${bits}`);
            return done(c, `UNTRACED INSTR modifies entity ${entity} bits ${bits}`, { untraced: true });
        }
        case 0xba: {
            const npc = c.u8();
            const x = c.u8();
            const y = c.u8();
            return done(c, `LOAD NPC ${hx(npc, 2)} at ${hx(x, 2)} ${hx(y, 2)}`,
                { effects: [{ kind: 'spawn', npc, state: null, x, y, opcode: instr }] });
        }
        case 0xc2: {
            const a = c.u8();
            const b = c.u8();
            const d = c.u8();
            return done(c, `Add NPC ${u8(a)} spawner at ${u8(b)},${u8(d)}`,
                { effects: [{ kind: 'spawn', npc: a, state: null, x: b, y: d, opcode: instr }] });
        }

        default:
            return null;
    }
}
