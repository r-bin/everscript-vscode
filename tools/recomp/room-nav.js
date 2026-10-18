'use strict';

// Plan headless moves inside one room (docs/recomp/headless-exploration.md): its step-on triggers
// with their destinations and the enemy spawns, in the pixel space of the entity coordinates,
// each with headless-script lines that put the Boy (and Dog) in place.
//   node tools/recomp/room-nav.js <rom> <room id hex> [--script]
// --script prints only the script lines, one block per target, for pasting into a run.

const fs = require('fs');
const path = require('path');
const { buildRoomScriptModel } = require(path.join(__dirname, '../../dist/games/evermore/script-model/room-model.js'));

const BOY_X = '4ea3', BOY_Y = '4ea5', DOG_X = '4f51', DOG_Y = '4f53';
const le = v => [(v & 0xFF), (v >> 8) & 0xFF].map(b => b.toString(16).padStart(2, '0')).join('');
const poke = (addr, v) => `pokefor ${addr} ${le(v)} 3`;
const hx = v => '0x' + v.toString(16).padStart(2, '0');

/** Room origin in 16-px cells: the first two bytes of the room's data blob (= WRAM $7E0F86/$0F88). */
function roomOrigin(rom, dataPointerSnes) {
    const off = ((dataPointerSnes >> 16) & 0x3F) * 0x10000 + (dataPointerSnes & 0xFFFF);
    return { x: rom[off], y: rom[off + 1] };
}

/**
 * Where to stand and which way to walk so the Boy steps onto a trigger. A trigger only fires while
 * the player walks onto it, so stand 24 px outside the box and walk in for 40 frames. Wide boxes
 * are entered vertically, tall ones horizontally, always from the side facing into the room.
 */
function approach(box) {
    const cx = Math.round((box.x1 + box.x2) / 2), cy = Math.round((box.y1 + box.y2) / 2);
    if (box.x2 - box.x1 >= box.y2 - box.y1) {
        return box.y1 < 160 ? { x: cx, y: box.y2 + 24, dir: 'up' } : { x: cx, y: box.y1 - 24, dir: 'down' };
    }
    return box.x1 < 160 ? { x: box.x2 + 24, y: cy, dir: 'left' } : { x: box.x1 - 24, y: cy, dir: 'right' };
}

function plan(rom, roomId) {
    const m = buildRoomScriptModel(rom, roomId);
    if (!m) throw new Error('no room ' + hx(roomId));
    const o = roomOrigin(rom, m.dataPointerSnes);
    const triggers = m.stepOn.map((t, i) => {
        const box = { x1: (t.x1 - o.x) * 16, y1: (t.y1 - o.y) * 16, x2: (t.x2 - o.x) * 16, y2: (t.y2 - o.y) * 16 };
        const a = approach(box);
        const to = (t.transitions || [])[0];
        return {
            index: i, box, to: to ? `${hx(to.mapId)} ${to.mapName} (lands at ${to.x},${to.y})` : '(no room change found)',
            lines: [poke(BOY_X, a.x), poke(BOY_Y, a.y), `press ${a.dir} 40`, 'wait 250'],
        };
    });
    // Enemies are hit only from close by: 16 px above, facing down; the Dog beside him.
    const enemies = m.enter.spawns.filter(s => s.x != null && s.y != null).map(s => {
        const x = s.x * 8, y = s.y * 8;
        return {
            name: s.romName || s.name || '#' + s.npc, x, y, spawner: s.spawner,
            lines: [poke(BOY_X, x), poke(BOY_Y, y - 44), poke(DOG_X, x - 20), poke(DOG_Y, y - 44), 'press down 12', 'wait 60',
                poke(BOY_X, x), poke(BOY_Y, y - 16), poke(DOG_X, x - 18), poke(DOG_Y, y - 12), 'press down 1',
                'press b 3', 'wait 26'],
        };
    });
    return { room: roomId, origin: o, triggers, enemies };
}

if (require.main === module) {
    const [romPath, roomArg, flag] = process.argv.slice(2);
    if (!romPath || !roomArg) {
        console.error('usage: node tools/recomp/room-nav.js <rom> <room id hex> [--script]');
        process.exit(2);
    }
    const p = plan(fs.readFileSync(romPath), parseInt(roomArg, 16));
    if (flag === '--script') {
        for (const t of p.triggers) console.log(`# step-on ${t.index} -> ${t.to}\n${t.lines.join('\n')}\n`);
        for (const e of p.enemies) console.log(`# ${e.name} at ${e.x},${e.y} (repeat the last two lines to keep hitting)\n${e.lines.join('\n')}\n`);
    } else {
        console.log(`room ${hx(p.room)}  origin ${p.origin.x},${p.origin.y} (16-px cells)\n\nstep-on triggers (pixels):`);
        for (const t of p.triggers) console.log(`  ${t.index}: x ${t.box.x1}..${t.box.x2} y ${t.box.y1}..${t.box.y2} -> ${t.to}`);
        console.log('\nenemy spawns (pixels; every branch of the enter script, so candidates):');
        for (const e of p.enemies) console.log(`  ${e.name.padEnd(16)} ${e.x},${e.y}${e.spawner ? '  (spawner)' : ''}`);
    }
}

module.exports = { plan, approach, roomOrigin };
