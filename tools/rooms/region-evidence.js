'use strict';
// The region of a room, from the game: the Dog's form is the act's, and a room's enter script
// requests it ($2443: Wolf, Greyhound, Poodle, Toaster, the plain dog at home). Rooms that request
// none keep the form they were entered with; their region is not derivable from doors alone (the
// game reuses some maps in two acts), so they are left out. Prints JSON { room: { region, how } }.
// Run: node tools/rooms/region-evidence.js
//
// Knowledge: ram/7e2443.md (the form request), rom/8f9471.md (the loader).

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const V = require(path.join(ROOT, 'src/games/evermore/script-vm'));
const M = require(path.join(ROOT, 'src/games/evermore/script-model'));

/** The Dog's form ($2443) → the act it belongs to. */
const FORM_REGION = { 0x02: 'Prehistoria', 0x04: 'Prehistoria', 0x06: 'Antiqua', 0x08: 'Gothica', 0x0a: 'Podunk', 0x0c: 'Omnitopia' };
const DOG_FORM = 0x2443;
const ROOMS = 127;

function regions(bytes) {
    const rom = new V.ScriptRom(bytes);
    const out = {};
    for (let id = 0; id < ROOMS; id++) {
        const rs = V.roomScripts(rom, id);
        const forms = new Set();
        if (rs.enter !== null) for (const p of M.paths(rom, rs.enter).paths) for (const st of p) if (st.fact.k === 'write' && st.fact.addr === DOG_FORM && st.fact.value !== null) forms.add(st.fact.value);
        const named = new Set([...forms].map((f) => FORM_REGION[f]).filter(Boolean));
        if (named.size === 1) out[id] = { region: [...named][0], how: `enter script sets the Dog's form ($2443 = ${[...forms].map((f) => '0x' + f.toString(16)).join(', ')})` };
    }
    return out;
}

if (require.main === module) {
    let bytes = new Uint8Array(fs.readFileSync(require(path.join(ROOT, 'dist/games')).romPath('evermore')));
    if (bytes.length % 1024 === 512) bytes = bytes.subarray(512);
    console.log(JSON.stringify(regions(bytes), null, 1));
}

module.exports = { regions, FORM_REGION };
