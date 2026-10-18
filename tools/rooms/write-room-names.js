'use strict';
// Writes src/games/evermore/localizations/data/rooms.json: every room's name in our style
// (docs/cleanup.md D4) — region › place › part — with where each part comes from.
//   region  the act, from the Dog's form the room's enter script requests (region-evidence.js),
//           else the old catalogue's area (kept, D4)
//   place   the game's own text where it names the place (the string id), else our wording
//   part    our wording for which part of the place the room is
// Run: node tools/rooms/write-room-names.js   (needs the ROM for the region evidence)

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const { regions } = require('./region-evidence');

/** Strings in the game's text that name a place (decoded by localizations/strings.js). */
const PLACE_STRINGS = {
    'Nobilia': 256, 'Bugmuck': 259, 'Quicksand Field': 261, 'Ivor Tower': 264, 'Ebon Keep': 265,
    'Nobilia Colosseum': 270, 'Omnitopia': 274, 'Junkyard': 279, 'Crustacia': 1768, 'Podunk': 421,
    "Strong Heart's hut": 614, "Fire Eyes' village": 252, "Blimp's hut": 253, "Horace's camp": 257,
};

// [room, area of the old catalogue, place, part], in the order the Rooms tab lists them, act by act
const ROOMS = [
    [0x38, 'Prehistoria', 'Jungle', 'south, where the game starts'],
    [0x33, 'Prehistoria', "Strong Heart's hut", 'outside'],
    [0x34, 'Prehistoria', "Strong Heart's hut", 'inside'],
    [0x5c, 'Prehistoria', 'Jungle', 'raptors'],
    [0x25, 'Prehistoria', "Fire Eyes' village", 'village'],
    [0x51, 'Prehistoria', "Fire Eyes' village", "huts and Blimp's hut"],
    [0x26, 'Prehistoria', 'Jungle', 'west, where Defend is'],
    [0x5b, 'Prehistoria', 'Jungle', 'east'],
    [0x59, 'Prehistoria', 'Quicksand Field', 'desert'],
    [0x67, 'Prehistoria', 'Bugmuck', 'outside'],
    [0x16, 'Prehistoria', 'Bugmuck', 'first chamber'],
    [0x17, 'Prehistoria', 'Bugmuck', 'second chamber'],
    [0x18, 'Prehistoria', 'Bugmuck', "Thraxx's chamber"],
    [0x5a, 'Prehistoria', 'Quicksand Field', 'Acid Rain giver'],
    [0x41, 'Prehistoria', 'Jungle', 'north'],
    [0x27, 'Prehistoria', 'Mammoth graveyard', 'graveyard'],
    [0x69, 'Prehistoria', 'Volcano', 'path'],
    [0x52, 'Prehistoria', 'Volcano', 'top'],
    [0x50, 'Prehistoria', 'Volcano', 'sky above'],
    [0x66, 'Prehistoria', 'Swamp', 'west'],
    [0x65, 'Prehistoria', 'Swamp', 'main'],
    [0x01, 'Prehistoria', "Blimp's hut", 'outside'],
    [0x3c, 'Prehistoria', 'Volcano', 'first chamber'],
    [0x3b, 'Prehistoria', 'Volcano', 'second chamber'],
    [0x3d, 'Prehistoria', 'Volcano', 'pipe maze'],
    [0x3e, 'Prehistoria', 'Volcano', 'pipe maze side rooms'],
    [0x3f, 'Prehistoria', 'Volcano', 'boss chamber'],
    [0x36, 'Prehistoria', 'Fire pits', 'both pits'],
    [0x53, 'Antiqua', 'Arrival in Antiqua', 'opening scene'],
    [0x6a, 'Antiqua', 'Arrival in Antiqua', 'waterfall scene'],
    [0x0a, 'Antiqua', 'Nobilia', 'market'],
    [0x08, 'Antiqua', 'Nobilia', 'square'],
    [0x09, 'Antiqua', 'Nobilia', 'square, Aegis fight'],
    [0x1e, 'Antiqua', 'Nobilia Colosseum', 'holding room'],
    [0x1d, 'Antiqua', 'Nobilia Colosseum', 'arena, Vigor fight'],
    [0x4c, 'Antiqua', 'Nobilia', 'fountain and snake statues'],
    [0x0b, 'Antiqua', 'Nobilia', 'palace grounds'],
    [0x4d, 'Antiqua', 'Nobilia', 'inside the palace, Horace scene'],
    [0x3a, 'Antiqua', 'Nobilia', 'fire pit'],
    [0x0c, 'Antiqua', 'Nobilia', 'inn'],
    [0x1c, 'Antiqua', 'Nobilia', 'north of the market'],
    [0x1b, 'Antiqua', 'Antiqua desert', 'Desert of Doom'],
    [0x6b, 'Antiqua', 'Waterfall', 'waterfall'],
    [0x05, 'Antiqua', 'Antiqua desert', "between the pyramid and the halls"],
    [0x07, 'Antiqua', 'Crustacia', 'west shore'],
    [0x4f, 'Antiqua', 'Crustacia', 'east shore'],
    [0x2e, 'Antiqua', "Blimp's cave", 'cave'],
    [0x68, 'Antiqua', 'Crustacia', 'outside'],
    [0x30, 'Antiqua', 'Crustacia', 'inside the pirate ship'],
    [0x04, 'Antiqua', 'Crustacia', 'fire pit'],
    [0x2f, 'Antiqua', "Horace's camp", 'camp'],
    [0x06, 'Antiqua', 'Pyramid', 'outside'],
    [0x64, 'Antiqua', 'Pyramid', 'cave entrance below'],
    [0x55, 'Antiqua', 'Pyramid', 'bottom level, the Dog starts'],
    [0x56, 'Antiqua', 'Pyramid', 'top level, the Boy starts'],
    [0x57, 'Antiqua', 'Pyramid', 'basement, Tiny'],
    [0x58, 'Antiqua', 'Pyramid', 'boss room, Rimsala'],
    [0x2b, 'Antiqua', 'Halls of Collosia', 'outside'],
    [0x29, 'Antiqua', 'Halls of Collosia', 'main hall'],
    [0x23, 'Antiqua', 'Halls of Collosia', 'south-west'],
    [0x24, 'Antiqua', 'Halls of Collosia', 'north-west'],
    [0x2c, 'Antiqua', 'Halls of Collosia', 'south-east'],
    [0x2d, 'Antiqua', 'Halls of Collosia', 'north-east'],
    [0x28, 'Antiqua', 'Halls of Collosia', 'collapsing bridge'],
    [0x2a, 'Antiqua', 'Halls of Collosia', 'boss room'],
    [0x4b, 'Antiqua', 'Oglin cave', 'cave'],
    [0x6d, 'Antiqua', 'Aquagoth', 'chamber'],
    [0x35, 'Antiqua', 'Caves', 'quicksand, Bugmuck and volcano caves; west alchemist cave'],
    [0x12, 'Gothica', 'Ebon Keep', 'sewers'],
    [0x13, 'Gothica', 'Ebon Keep', 'sewer exit to the forest and swamp'],
    [0x40, 'Gothica', 'Swamp', "south of Gomi's tower"],
    [0x37, 'Gothica', "Gomi's tower", 'tower'],
    [0x20, 'Gothica', 'Dark Forest', 'Timberdrake clearing'],
    [0x1f, 'Gothica', 'Dark Forest', 'doubles clearing'],
    [0x22, 'Gothica', 'Dark Forest', 'forest'],
    [0x21, 'Gothica', 'Dark Forest', 'entrance, save point'],
    [0x6c, 'Gothica', 'Ivor Tower', 'south-east, the well'],
    [0x76, 'Gothica', 'Ivor Tower', 'south gate'],
    [0x7b, 'Gothica', 'Ebon Keep and Ivor Tower', 'outside, lower half'],
    [0x7c, 'Gothica', 'Ebon Keep and Ivor Tower', 'outside, upper half'],
    [0x7d, 'Gothica', 'Ebon Keep and Ivor Tower', 'inside'],
    [0x4e, 'Gothica', 'Ivor Tower', 'west alley, market'],
    [0x62, 'Gothica', 'Ivor Tower', 'west square, trailers'],
    [0x63, 'Gothica', 'Ivor Tower', 'inside the trailers'],
    [0x19, 'Gothica', 'Chessboard', 'board'],
    [0x1a, 'Gothica', 'Chessboard', 'below the board'],
    [0x74, 'Gothica', 'Ebon Keep and Ivor Tower', 'dungeon and pipe room'],
    [0x0d, 'Gothica', 'Ebon Keep', 'stair hall behind Verminator'],
    [0x0f, 'Gothica', 'Ebon Keep', "west room (Naris)"],
    [0x11, 'Gothica', 'Ebon Keep', "queen's room"],
    [0x10, 'Gothica', 'Ebon Keep', 'stained-glass hallway'],
    [0x14, 'Gothica', 'Ebon Keep', "Tinker's room"],
    [0x39, 'Gothica', 'Ebon Keep', 'fire pit'],
    [0x0e, 'Gothica', 'Ebon Keep', 'dining room'],
    [0x5d, 'Gothica', 'Ebon Keep', 'courtyard south of Verminator'],
    [0x5e, 'Gothica', 'Ebon Keep', 'front room, Verminator'],
    [0x5f, 'Gothica', 'Ebon Keep', "side rooms by Verminator"],
    [0x60, 'Gothica', 'Ebon Keep', 'storage room'],
    [0x6e, 'Gothica', 'Ivor Tower', 'hall'],
    [0x6f, 'Gothica', 'Ivor Tower', 'dining room'],
    [0x70, 'Gothica', 'Ivor Tower', 'outside bridges and balconies'],
    [0x71, 'Gothica', 'Ivor Tower', 'east room and kitchen'],
    [0x72, 'Gothica', 'Ivor Tower', 'east upper floor'],
    [0x73, 'Gothica', 'Ivor Tower', 'Dog maze below'],
    [0x75, 'Gothica', 'Ivor Tower', 'stairwell to the dungeon'],
    [0x79, 'Gothica', 'Ivor Tower', 'sewers'],
    [0x7a, 'Gothica', 'Ivor Tower', 'sewer outlet, landing spot'],
    [0x78, 'Gothica', 'Ivor Tower', "queen's room"],
    [0x77, 'Gothica', 'Ivor Tower', 'puppet show, Mungola'],
    [0x46, 'Omnitopia', 'Omnitopia', "Professor's lab and ship"],
    [0x48, 'Omnitopia', 'Omnitopia', 'Metroplex tunnels'],
    [0x44, 'Omnitopia', 'Omnitopia', 'greenhouse'],
    [0x00, 'Omnitopia', 'Omnitopia', 'alarm room'],
    [0x43, 'Omnitopia', 'Omnitopia', 'control room'],
    [0x45, 'Omnitopia', 'Omnitopia', 'secret boss room'],
    [0x47, 'Omnitopia', 'Omnitopia', 'storage room'],
    [0x42, 'Omnitopia', 'Omnitopia', 'reactor and reactor control'],
    [0x54, 'Omnitopia', 'Omnitopia', 'shops'],
    [0x7e, 'Omnitopia', 'Omnitopia', 'jail'],
    [0x49, 'Omnitopia', 'Junkyard', 'landing spot'],
    [0x4a, 'Omnitopia', 'Omnitopia', 'final boss room'],
    [0x15, 'Podunk', 'Test room', "Brian's room"],
    [0x61, 'Podunk', 'Opening', 'over the machine'],
    [0x31, 'Podunk', 'Podunk', 'town, 1965'],
    [0x02, 'Podunk', 'Podunk', 'mansion grounds, 1965'],
    [0x32, 'Podunk', 'Podunk', 'town, 1995'],
    [0x03, 'Podunk', 'Podunk', 'mansion grounds, 1995'],
];

const slug = (s) => s.toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function main() {
    let bytes = new Uint8Array(fs.readFileSync(require(path.join(ROOT, 'dist/games')).romPath('evermore')));
    if (bytes.length % 1024 === 512) bytes = bytes.subarray(512);
    const found = regions(bytes);
    const out = ROOMS.map(([id, area, place, part]) => {
        const r = found[id];
        const region = r ? r.region : area;
        return {
            id, region, place, part,
            path: [region, place, part].map(slug).join('/'),
            evidence: {
                region: r ? r.how : 'kept from the old catalogue (D4): its enter script requests no Dog form',
                place: PLACE_STRINGS[place] !== undefined ? `game text, string ${PLACE_STRINGS[place]}` : 'our wording',
                part: 'our wording',
            },
        };
    });
    if (out.length !== 127 || new Set(out.map((r) => r.id)).size !== 127) throw new Error('every room once');
    const file = path.join(ROOT, 'src/games/evermore/localizations/data/rooms.json');
    fs.writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
    const moved = out.filter((r) => r.region !== ROOMS.find((x) => x[0] === r.id)[1]);
    console.log(`${out.length} rooms; regions from the Dog's form: ${Object.keys(found).length}; differing from the catalogue: ${moved.map((r) => '$' + r.id.toString(16) + ' ' + r.region).join(', ') || 'none'}`);
}

main();
