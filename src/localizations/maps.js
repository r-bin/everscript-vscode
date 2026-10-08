'use strict';
// Ownership: map / room IDs to subjective map names, areas, and optional string indices.
// Source: SoETilesViewer (SoEScriptDumper/data.h) + everscript wiki room catalogue.

const { resolveLocalizedName } = require('./strings');

/**
 * All 127 vanilla rooms in Secret of Evermore.
 * Each entry has:
 *  - id: integer room ID (0..126)
 *  - hex: hex string '0x..'
 *  - area: world area ('Prehistoria', 'Antiqua', 'Gothica', 'Omnitopia', 'Intro / Misc')
 *  - name: room name without area prefix
 *  - fullName: full descriptive room name as in TilesViewer
 *  - stringIndex: optional in-game string index if named in game dialog
 */
const VANILLA_MAPS = [
    // Prehistoria
    { id: 0x38, hex: '0x38', area: 'Prehistoria', name: 'South jungle / Start', fullName: 'Prehistoria - South jungle / Start', stringIndex: null },
    { id: 0x33, hex: '0x33', area: 'Prehistoria', name: "Strong Heart's Exterior", fullName: "Prehistoria - Strong Heart's Exterior", stringIndex: null },
    { id: 0x34, hex: '0x34', area: 'Prehistoria', name: "Strong Heart's Hut", fullName: "Prehistoria - Strong Heart's Hut", stringIndex: null },
    { id: 0x5c, hex: '0x5c', area: 'Prehistoria', name: 'Raptors', fullName: 'Prehistoria - Raptors', stringIndex: null },
    { id: 0x25, hex: '0x25', area: 'Prehistoria', name: "Fire Eyes' Village", fullName: "Prehistoria - Fire Eyes' Village", stringIndex: null },
    { id: 0x51, hex: '0x51', area: 'Prehistoria', name: "Village Huts and Blimp's Hut", fullName: "Prehistoria - Village Huts and Blimp's Hut", stringIndex: null },
    { id: 0x26, hex: '0x26', area: 'Prehistoria', name: 'West area with Defend', fullName: 'Prehistoria - West area with Defend', stringIndex: null },
    { id: 0x5b, hex: '0x5b', area: 'Prehistoria', name: 'East jungle', fullName: 'Prehistoria - East jungle', stringIndex: null },
    { id: 0x59, hex: '0x59', area: 'Prehistoria', name: 'Quick sand desert', fullName: 'Prehistoria - Quick sand desert', stringIndex: null },
    { id: 0x67, hex: '0x67', area: 'Prehistoria', name: 'Bugmuck exterior', fullName: 'Prehistoria - Bugmuck exterior', stringIndex: null },
    { id: 0x16, hex: '0x16', area: 'Prehistoria', name: 'BBM', fullName: 'Prehistoria - BBM', stringIndex: null },
    { id: 0x17, hex: '0x17', area: 'Prehistoria', name: 'Bug room 2', fullName: 'Prehistoria - Bug room 2', stringIndex: null },
    { id: 0x18, hex: '0x18', area: 'Prehistoria', name: "Thraxx' room", fullName: "Prehistoria - Thraxx' room", stringIndex: null },
    { id: 0x5a, hex: '0x5a', area: 'Prehistoria', name: 'Acid rain guy', fullName: 'Prehistoria - Acid rain guy', stringIndex: null },
    { id: 0x41, hex: '0x41', area: 'Prehistoria', name: 'North jungle', fullName: 'Prehistoria - North jungle', stringIndex: null },
    { id: 0x27, hex: '0x27', area: 'Prehistoria', name: 'Mammoth Graveyard', fullName: 'Prehistoria - Mammoth Graveyard', stringIndex: null },
    { id: 0x69, hex: '0x69', area: 'Prehistoria', name: 'Volcano path', fullName: 'Prehistoria - Volcano path', stringIndex: null },
    { id: 0x52, hex: '0x52', area: 'Prehistoria', name: 'Top of Volcano', fullName: 'Prehistoria - Top of Volcano', stringIndex: null },
    { id: 0x50, hex: '0x50', area: 'Prehistoria', name: 'Sky above Volcano', fullName: 'Prehistoria - Sky above Volcano', stringIndex: null },
    { id: 0x66, hex: '0x66', area: 'Prehistoria', name: 'West of swamp', fullName: 'Prehistoria - West of swamp', stringIndex: null },
    { id: 0x65, hex: '0x65', area: 'Prehistoria', name: 'Swamp (main area)', fullName: 'Prehistoria - Swamp (main area)', stringIndex: null },
    { id: 0x01, hex: '0x01', area: 'Prehistoria', name: "Exterior of Blimp's Hut", fullName: "Prehistoria - Exterior of Blimp's Hut", stringIndex: null },
    { id: 0x3c, hex: '0x3c', area: 'Prehistoria', name: 'Volcano Room 1', fullName: 'Prehistoria - Volcano Room 1', stringIndex: null },
    { id: 0x3b, hex: '0x3b', area: 'Prehistoria', name: 'Volcano Room 2', fullName: 'Prehistoria - Volcano Room 2', stringIndex: null },
    { id: 0x3d, hex: '0x3d', area: 'Prehistoria', name: 'Pipe maze', fullName: 'Prehistoria - Pipe maze', stringIndex: null },
    { id: 0x3e, hex: '0x3e', area: 'Prehistoria', name: 'Side rooms of pipe maze', fullName: 'Prehistoria - Side rooms of pipe maze', stringIndex: null },
    { id: 0x3f, hex: '0x3f', area: 'Prehistoria', name: 'Volcano Boss Room', fullName: 'Prehistoria - Volcano Boss Room', stringIndex: null },
    { id: 0x36, hex: '0x36', area: 'Prehistoria', name: 'Both fire pits (one room)', fullName: 'Prehistoria - Both fire pits (one room)', stringIndex: null },

    // Antiqua
    { id: 0x53, hex: '0x53', area: 'Antiqua', name: 'Act2 Start Cutscene', fullName: 'Antiqua - Act2 Start Cutscene', stringIndex: null },
    { id: 0x6a, hex: '0x6a', area: 'Antiqua', name: 'Act2 Start Cutscene - waterfall', fullName: 'Antiqua - Act2 Start Cutscene - waterfall', stringIndex: null },
    { id: 0x0a, hex: '0x0a', area: 'Antiqua', name: 'Nobilia, Market', fullName: 'Antiqua - Nobilia, Market', stringIndex: null },
    { id: 0x08, hex: '0x08', area: 'Antiqua', name: 'Nobilia, Square', fullName: 'Antiqua - Nobilia, Square', stringIndex: null },
    { id: 0x09, hex: '0x09', area: 'Antiqua', name: 'Nobilia, Square during Aegis fight', fullName: 'Antiqua - Nobilia, Square during Aegis fight', stringIndex: null },
    { id: 0x1e, hex: '0x1e', area: 'Antiqua', name: 'Nobilia, Arena Holding Room', fullName: 'Antiqua - Nobilia, Arena Holding Room', stringIndex: null },
    { id: 0x1d, hex: '0x1d', area: 'Antiqua', name: 'Nobilia, Arena (Vigor Fight)', fullName: 'Antiqua - Nobilia, Arena (Vigor Fight)', stringIndex: null },
    { id: 0x4c, hex: '0x4c', area: 'Antiqua', name: 'Nobilia, Fountain and snake statues', fullName: 'Antiqua - Nobilia, Fountain and snake statues', stringIndex: null },
    { id: 0x0b, hex: '0x0b', area: 'Antiqua', name: 'Nobilia, Palace grounds', fullName: 'Antiqua - Nobilia, Palace grounds', stringIndex: null },
    { id: 0x4d, hex: '0x4d', area: 'Antiqua', name: 'Nobilia, Inside palace (Horace cutscene)', fullName: 'Antiqua - Nobilia, Inside palace (Horace cutscene)', stringIndex: null },
    { id: 0x3a, hex: '0x3a', area: 'Antiqua', name: 'Nobilia, Fire pit', fullName: 'Antiqua - Nobilia, Fire pit', stringIndex: null },
    { id: 0x0c, hex: '0x0c', area: 'Antiqua', name: 'Nobilia, Inn', fullName: 'Antiqua - Nobilia, Inn', stringIndex: null },
    { id: 0x1c, hex: '0x1c', area: 'Antiqua', name: 'Nobilia, North of Market', fullName: 'Antiqua - Nobilia, North of Market', stringIndex: null },
    { id: 0x1b, hex: '0x1b', area: 'Antiqua', name: 'Desert of Doom', fullName: 'Antiqua - Desert of Doom', stringIndex: null },
    { id: 0x6b, hex: '0x6b', area: 'Antiqua', name: 'Waterfall', fullName: 'Antiqua - Waterfall', stringIndex: null },
    { id: 0x05, hex: '0x05', area: 'Antiqua', name: "Between 'mids and halls", fullName: "Antiqua - Between 'mids and halls", stringIndex: null },
    { id: 0x07, hex: '0x07', area: 'Antiqua', name: 'West of Crustacia', fullName: 'Antiqua - West of Crustacia', stringIndex: null },
    { id: 0x4f, hex: '0x4f', area: 'Antiqua', name: 'East of Crustacia', fullName: 'Antiqua - East of Crustacia', stringIndex: null },
    { id: 0x2e, hex: '0x2e', area: 'Antiqua', name: "Blimp's Cave", fullName: "Antiqua - Blimp's Cave", stringIndex: null },
    { id: 0x68, hex: '0x68', area: 'Antiqua', name: 'Crustacia exterior', fullName: 'Antiqua - Crustacia exterior', stringIndex: null },
    { id: 0x30, hex: '0x30', area: 'Antiqua', name: 'Crustacia inside pirate ship', fullName: 'Antiqua - Crustacia inside pirate ship', stringIndex: null },
    { id: 0x04, hex: '0x04', area: 'Antiqua', name: 'Crustacia fire pit', fullName: 'Antiqua - Crustacia fire pit', stringIndex: null },
    { id: 0x2f, hex: '0x2f', area: 'Antiqua', name: "Horace's camp", fullName: "Antiqua - Horace's camp", stringIndex: null },
    { id: 0x06, hex: '0x06', area: 'Antiqua', name: "Outside of 'mids", fullName: "Antiqua - Outside of 'mids", stringIndex: null },
    { id: 0x64, hex: '0x64', area: 'Antiqua', name: "Cave entrance under 'mids", fullName: "Antiqua - Cave entrance under 'mids", stringIndex: null },
    { id: 0x55, hex: '0x55', area: 'Antiqua', name: "'mids bottom level (Dog start)", fullName: "Antiqua - 'mids bottom level (Dog start)", stringIndex: null },
    { id: 0x56, hex: '0x56', area: 'Antiqua', name: "'mids top level (Boy start)", fullName: "Antiqua - 'mids top level (Boy start)", stringIndex: null },
    { id: 0x57, hex: '0x57', area: 'Antiqua', name: "'mids basement level (Tiny)", fullName: "Antiqua - 'mids basement level (Tiny)", stringIndex: null },
    { id: 0x58, hex: '0x58', area: 'Antiqua', name: "'mids boss room (Rimsala)", fullName: "Antiqua - 'mids boss room (Rimsala)", stringIndex: null },
    { id: 0x2b, hex: '0x2b', area: 'Antiqua', name: 'Outside of halls', fullName: 'Antiqua - Outside of halls', stringIndex: null },
    { id: 0x29, hex: '0x29', area: 'Antiqua', name: 'Halls main room', fullName: 'Antiqua - Halls main room', stringIndex: null },
    { id: 0x23, hex: '0x23', area: 'Antiqua', name: 'Halls SW', fullName: 'Antiqua - Halls SW', stringIndex: null },
    { id: 0x24, hex: '0x24', area: 'Antiqua', name: 'Halls NW', fullName: 'Antiqua - Halls NW', stringIndex: null },
    { id: 0x2c, hex: '0x2c', area: 'Antiqua', name: 'Halls SE', fullName: 'Antiqua - Halls SE', stringIndex: null },
    { id: 0x2d, hex: '0x2d', area: 'Antiqua', name: 'Halls NE', fullName: 'Antiqua - Halls NE', stringIndex: null },
    { id: 0x28, hex: '0x28', area: 'Antiqua', name: 'Halls Collapsing Bridge', fullName: 'Antiqua - Halls Collapsing Bridge', stringIndex: null },
    { id: 0x2a, hex: '0x2a', area: 'Antiqua', name: 'Halls Boss Room', fullName: 'Antiqua - Halls Boss Room', stringIndex: null },
    { id: 0x4b, hex: '0x4b', area: 'Antiqua', name: 'Oglin cave', fullName: 'Antiqua - Oglin cave', stringIndex: null },
    { id: 0x6d, hex: '0x6d', area: 'Antiqua', name: 'Aquagoth Room', fullName: 'Antiqua - Aquagoth Room', stringIndex: null },
    { id: 0x35, hex: '0x35', area: 'Antiqua', name: 'Quicksand/Bugmuck/Volcano caves + West Alchemy Cave', fullName: 'Act1 Quicksand, Bugmuck and Volcano caves + Act2 West Alchemy Cave', stringIndex: null },

    // Gothica
    { id: 0x12, hex: '0x12', area: 'Gothica', name: 'Ebon Keep sewers', fullName: 'Gothica - Ebon Keep sewers', stringIndex: null },
    { id: 0x13, hex: '0x13', area: 'Gothica', name: 'Between Ebon Keep sewers, Dark Forest and Swamp', fullName: 'Gothica - Between Ebon Keep sewers, Dark Forest and Swamp', stringIndex: null },
    { id: 0x40, hex: '0x40', area: 'Gothica', name: "Swamp south of Gomi's Tower", fullName: "Gothica - Swamp south of Gomi's Tower", stringIndex: null },
    { id: 0x37, hex: '0x37', area: 'Gothica', name: "Gomi's Tower", fullName: "Gothica - Gomi's Tower", stringIndex: null },
    { id: 0x20, hex: '0x20', area: 'Gothica', name: 'Timberdrake room in forest', fullName: 'Gothica - Timberdrake room in forest', stringIndex: null },
    { id: 0x1f, hex: '0x1f', area: 'Gothica', name: 'Doubles room in forest', fullName: 'Gothica - Doubles room in forest', stringIndex: null },
    { id: 0x22, hex: '0x22', area: 'Gothica', name: 'Dark Forest', fullName: 'Gothica - Dark Forest', stringIndex: null },
    { id: 0x21, hex: '0x21', area: 'Gothica', name: 'Dark Forest entrance (save point)', fullName: 'Gothica - Dark Forest entrance (save point)', stringIndex: null },
    { id: 0x6c, hex: '0x6c', area: 'Gothica', name: 'SE of Ivor Tower (Well)', fullName: 'Gothica - SE of Ivor Tower (Well)', stringIndex: null },
    { id: 0x76, hex: '0x76', area: 'Gothica', name: 'South of Ivor Tower (Gate)', fullName: 'Gothica - South of Ivor Tower (Gate)', stringIndex: null },
    { id: 0x7b, hex: '0x7b', area: 'Gothica', name: 'Ebon Keep and Ivor Tower Exterior Bottom Half', fullName: 'Gothica - Ebon Keep and Ivor Tower Exterior Bottom Half', stringIndex: null },
    { id: 0x7c, hex: '0x7c', area: 'Gothica', name: 'Ebon Keep and Ivor Tower Exterior Top Half', fullName: 'Gothica - Ebon Keep and Ivor Tower Exterior Top Half', stringIndex: null },
    { id: 0x7d, hex: '0x7d', area: 'Gothica', name: 'Ebon Keep and Ivor Tower Interior', fullName: 'Gothica - Ebon Keep and Ivor Tower Interior', stringIndex: null },
    { id: 0x4e, hex: '0x4e', area: 'Gothica', name: 'Ivor Tower, west alley (market)', fullName: 'Gothica - Ivor Tower, west alley (market)', stringIndex: null },
    { id: 0x62, hex: '0x62', area: 'Gothica', name: 'Ivor Tower, west square (trailers)', fullName: 'Gothica - Ivor Tower, west square (trailers)', stringIndex: null },
    { id: 0x63, hex: '0x63', area: 'Gothica', name: 'Ivor Tower, inside trailers', fullName: 'Gothica - Ivor Tower, inside trailers', stringIndex: null },
    { id: 0x19, hex: '0x19', area: 'Gothica', name: 'Chessboard', fullName: 'Gothica - Chessboard', stringIndex: null },
    { id: 0x1a, hex: '0x1a', area: 'Gothica', name: 'Below chessboard', fullName: 'Gothica - Below chessboard', stringIndex: null },
    { id: 0x74, hex: '0x74', area: 'Gothica', name: 'Ebon Keep and Ivor Tower dungeon + pipe room', fullName: 'Gothica - Ebon Keep and Ivory Tower dungeon + pipe room', stringIndex: null },
    { id: 0x0d, hex: '0x0d', area: 'Gothica', name: 'Ebon Keep Hall (Stairs, behind Verm)', fullName: 'Gothica - Ebon Keep Hall (Stairs, behind Verm)', stringIndex: null },
    { id: 0x0f, hex: '0x0f', area: 'Gothica', name: 'Ebon Keep West Room (Naris)', fullName: 'Gothica - Ebon Keep West Room (Naris)', stringIndex: null },
    { id: 0x11, hex: '0x11', area: 'Gothica', name: "Ebon Keep Queen's Room", fullName: "Gothica - Ebon Keep Queen's Room", stringIndex: null },
    { id: 0x10, hex: '0x10', area: 'Gothica', name: 'Ebon Keep Stained Glass Hallway', fullName: 'Gothica - Ebon Keep Stained Glass Hallway', stringIndex: null },
    { id: 0x14, hex: '0x14', area: 'Gothica', name: "Ebon Keep Tinker's Room", fullName: "Gothica - Ebon Keep Tinker's Room", stringIndex: null },
    { id: 0x39, hex: '0x39', area: 'Gothica', name: 'Ebon Keep Fire pit', fullName: 'Gothica - Ebon Keep Fire pit', stringIndex: null },
    { id: 0x0e, hex: '0x0e', area: 'Gothica', name: 'Ebon Keep Dining Room', fullName: 'Gothica - Ebon Keep Dining Room', stringIndex: null },
    { id: 0x5d, hex: '0x5d', area: 'Gothica', name: 'Ebon Keep Courtyard (South of Verm)', fullName: 'Gothica - Ebon Keep Courtyard (South of Verm)', stringIndex: null },
    { id: 0x5e, hex: '0x5e', area: 'Gothica', name: 'Ebon Keep Front Room (Verm)', fullName: 'Gothica - Ebon Keep Front Room (Verm)', stringIndex: null },
    { id: 0x5f, hex: '0x5f', area: 'Gothica', name: 'Ebon Keep Verm side rooms', fullName: 'Gothica - Ebon Keep Verm side rooms', stringIndex: null },
    { id: 0x60, hex: '0x60', area: 'Gothica', name: 'Ebon Keep Storage Room', fullName: 'Gothica - Ebon Keep Storage Room', stringIndex: null },
    { id: 0x6e, hex: '0x6e', area: 'Gothica', name: 'Ivor Tower Hall', fullName: 'Gothica - Ivor Tower Hall', stringIndex: null },
    { id: 0x6f, hex: '0x6f', area: 'Gothica', name: 'Ivor Tower Dining Room', fullName: 'Gothica - Ivor Tower Dining Room', stringIndex: null },
    { id: 0x70, hex: '0x70', area: 'Gothica', name: 'Ivor Tower Exterior Bridges and Balconies', fullName: 'Gothica - Ivor Tower Exterior Bridges and Balconies', stringIndex: null },
    { id: 0x71, hex: '0x71', area: 'Gothica', name: 'Ivor Tower East Room + Kitchen', fullName: 'Gothica - Ivor Tower East Room + Kitchen', stringIndex: null },
    { id: 0x72, hex: '0x72', area: 'Gothica', name: 'Ivor Tower East Upper Floor', fullName: 'Gothica - Ivor Tower East Upper Floor', stringIndex: null },
    { id: 0x73, hex: '0x73', area: 'Gothica', name: 'Ivor Tower Dog Maze Underground', fullName: 'Gothica - Ivor Tower Dog Maze Underground', stringIndex: null },
    { id: 0x75, hex: '0x75', area: 'Gothica', name: 'Ivor Tower Stairwell to dungeon', fullName: 'Gothica - Ivor Tower Stariwell to dungeon', stringIndex: null },
    { id: 0x79, hex: '0x79', area: 'Gothica', name: 'Ivor Tower Sewers', fullName: 'Gothica - Ivor Tower Sewers', stringIndex: null },
    { id: 0x7a, hex: '0x7a', area: 'Gothica', name: 'Ivor Tower Sewers Exterior (landing spot)', fullName: 'Gothica - Ivor Tower Sewers Exterior (landing spot)', stringIndex: null },
    { id: 0x78, hex: '0x78', area: 'Gothica', name: "Ivor Tower Queen's Room", fullName: "Gothica - Ivor Tower Queen's Room", stringIndex: null },
    { id: 0x77, hex: '0x77', area: 'Gothica', name: 'Ivor Tower Puppet Show / Mungola', fullName: 'Gothica - Ivor Tower Puppet Show / Mungola', stringIndex: null },

    // Omnitopia
    { id: 0x46, hex: '0x46', area: 'Omnitopia', name: "Professor's lab and ship area", fullName: "Omnitopia - Professor's lab and ship area, (also?) Intro", stringIndex: null },
    { id: 0x48, hex: '0x48', area: 'Omnitopia', name: 'Metroplex tunnels (rimsalas, spheres)', fullName: 'Omnitopia - Metroplex tunnels (rimsalas, spheres)', stringIndex: null },
    { id: 0x44, hex: '0x44', area: 'Omnitopia', name: 'Greenhouse', fullName: 'Omnitopia - Greenhouse (dark or both?)', stringIndex: null },
    { id: 0x00, hex: '0x00', area: 'Omnitopia', name: 'Alarm room', fullName: 'Omnitopia - Alarm room', stringIndex: null },
    { id: 0x43, hex: '0x43', area: 'Omnitopia', name: 'Control room', fullName: 'Omnitopia - Control room', stringIndex: null },
    { id: 0x45, hex: '0x45', area: 'Omnitopia', name: 'Secret boss room', fullName: 'Omnitopia - Secret boss room', stringIndex: null },
    { id: 0x47, hex: '0x47', area: 'Omnitopia', name: 'Storage room', fullName: 'Omnitopia - Storage room', stringIndex: null },
    { id: 0x42, hex: '0x42', area: 'Omnitopia', name: 'Reactor room and Reactor control', fullName: 'Omnitopia - Reactor room and Reactor control', stringIndex: null },
    { id: 0x54, hex: '0x54', area: 'Omnitopia', name: 'Shops', fullName: 'Omnitopia - Shops', stringIndex: null },
    { id: 0x7e, hex: '0x7e', area: 'Omnitopia', name: 'Jail', fullName: 'Omnitopia - Jail', stringIndex: null },
    { id: 0x49, hex: '0x49', area: 'Omnitopia', name: 'Junkyard (Landing spot)', fullName: 'Omnitopia - Junkyard (Landing spot)', stringIndex: null },
    { id: 0x4a, hex: '0x4a', area: 'Omnitopia', name: 'Final Boss Room', fullName: 'Omnitopia - Final Boss Room', stringIndex: null },

    // Intro / Misc
    { id: 0x15, hex: '0x15', area: 'Intro / Misc', name: "Brian's Room (Test Room)", fullName: "Intro / Misc - Brian's Room (Test Room)", stringIndex: null },
    { id: 0x61, hex: '0x61', area: 'Intro / Misc', name: 'Opening - Scrolling over Machine', fullName: 'Opening - Scrolling over Machine', stringIndex: null },
    { id: 0x31, hex: '0x31', area: 'Intro / Misc', name: 'Intro - Podunk 1965', fullName: 'Intro - Podunk 1965', stringIndex: null },
    { id: 0x02, hex: '0x02', area: 'Intro / Misc', name: 'Intro - Mansion Exterior 1965', fullName: 'Intro - Mansion Exterior 1965', stringIndex: null },
    { id: 0x32, hex: '0x32', area: 'Intro / Misc', name: 'Intro - Podunk 1995', fullName: 'Intro - Podunk 1995', stringIndex: null },
    { id: 0x03, hex: '0x03', area: 'Intro / Misc', name: 'Intro - Mansion Exterior 1995', fullName: 'Intro - Mansion Exterior 1995', stringIndex: null },
];

const MAP_BY_ID = new Map();
for (const m of VANILLA_MAPS) {
    MAP_BY_ID.set(m.id, m);
    MAP_BY_ID.set(m.hex.toLowerCase(), m);
}

/**
 * Catalogue grouped by area, identical to vanilla-data.js structure.
 */
const AREAS = ['Prehistoria', 'Antiqua', 'Gothica', 'Omnitopia', 'Intro / Misc'];
const VANILLA_ROOMS = AREAS.map(area => ({
    area,
    rooms: VANILLA_MAPS.filter(m => m.area === area).map(m => ({ id: m.hex, name: m.name })),
}));

/**
 * Retrieve a map record by id (integer e.g. 0x38 or string '0x38' or 56).
 */
function getMap(id) {
    if (typeof id === 'string') {
        const parsed = id.startsWith('0x') || id.startsWith('0X') ? parseInt(id, 16) : parseInt(id, 10);
        return MAP_BY_ID.get(id.toLowerCase()) || MAP_BY_ID.get(parsed) || null;
    }
    return MAP_BY_ID.get(id) || null;
}

/**
 * Get map name with optional full name (area prefix) or in-game ROM string resolution.
 * @param {number|string} id
 * @param {{full?: boolean, rom?: Uint8Array|Buffer}} [options]
 */
function getMapName(id, options = {}) {
    const map = getMap(id);
    if (!map) {
        if (options.fallback !== undefined) return options.fallback;
        return typeof id === 'number' ? `Room 0x${id.toString(16).padStart(2, '0')}` : `Room ${id}`;
    }
    const prop = options.full ? 'fullName' : 'name';
    return resolveLocalizedName(map, options.rom, prop);
}

/**
 * Get the area name for a map ID.
 */
function getMapArea(id) {
    const map = getMap(id);
    return map ? map.area : '';
}

module.exports = {
    VANILLA_MAPS,
    VANILLA_ROOMS,
    MAP_BY_ID,
    getMap,
    getMapName,
    getMapArea,
};
