// Ownership: grouping the maps into the areas players know them by.
//
// Each area lists the maps that make up one picture in the well-known
// fantasyanime.com map collection, so the Maps tab can show "Potos Falls" as
// the three maps it is drawn from. The ids were found by rendering every map
// and locating it in those pictures pixel for pixel (exact 16-pixel runs vote
// for an offset, then random pixels are compared); a map shared by several
// pictures belongs to the one it matched best. Maps found in no picture
// (arenas, cannon rides, credits, alternate event states) are "other".
// Only area names and map ids are kept; the pictures are not part of the repo.

export interface ManaArea {
    name: string;
    maps: number[];
}

export const AREAS: readonly ManaArea[] = [
    { name: 'Potos Falls', maps: [128, 101, 129, 130] },
    { name: 'Potos', maps: [257, 258, 342, 102, 131, 260] },
    { name: 'Path to Pandora', maps: [16] },
    { name: "Neko's", maps: [132, 153] },
    { name: 'Water Palace', maps: [136, 139, 142, 143, 135] },
    { name: "Path to Gaia's Navel", maps: [23] },
    { name: "Gaia's Navel", maps: [73, 284, 285, 27, 288, 289, 25, 152, 286] },
    { name: 'Dwarf Village', maps: [292, 294, 296, 297, 295, 293] },
    { name: 'Kippo', maps: [168] },
    { name: "Elinee's Castle", maps: [309, 310, 151, 196, 306, 305, 304, 343, 303, 308, 302, 300] },
    { name: "Undine's Cave", maps: [277, 275] },
    { name: 'Underground Palace', maps: [314, 495, 276, 291] },
    { name: 'Pandora', maps: [145, 104, 144, 170] },
    { name: 'Pandora Ruins', maps: [160, 161, 166] },
    { name: 'Scorpion Army Ship', maps: [311, 315, 316, 317] },
    { name: 'Upperland', maps: [39, 40, 41] },
    { name: 'Great Forest', maps: [49, 55, 54, 52, 106, 53] },
    { name: 'Moogle Village', maps: [58, 59] },
    { name: 'Sprite Village', maps: [60, 56, 107] },
    { name: 'Wind Palace', maps: [273, 47] },
    { name: 'Matango', maps: [336, 274] },
    { name: 'Dragon Caves', maps: [321, 307, 322, 323, 320] },
    { name: 'Todo Village', maps: [147, 228, 298] },
    { name: 'Crystal Forest', maps: [78, 83, 79, 76, 77, 81, 80] },
    { name: "Santa's House", maps: [332, 333] },
    { name: 'Tropics', maps: [197] },
    { name: 'Ice Palace', maps: [75, 364, 363, 357, 362, 355, 354, 360, 361, 359, 352] },
    { name: 'Kakkara Desert', maps: [96, 32, 33, 34, 69, 87, 88, 92, 95, 70, 94] },
    { name: 'Kakkara', maps: [259, 262, 279, 281, 299, 341, 376] },
    { name: 'Sandship', maps: [98, 99, 108, 339, 319, 270, 318, 324, 271] },
    { name: 'Fire Palace', maps: [349, 90, 347, 346, 329, 327, 328, 348, 326, 331, 241, 345, 240, 330] },
    { name: 'Southtown', maps: [114] },
    { name: 'Imperial Sewers', maps: [20] },
    { name: 'Northtown', maps: [115, 148] },
    { name: 'Northtown Ruins', maps: [408, 21, 407, 400] },
    { name: 'Imperial Castle', maps: [380, 383, 387, 391, 100, 382, 388, 379, 385, 390, 82, 378, 384, 386, 389, 377] },
    { name: 'Lighthouse', maps: [110, 112, 393, 394, 395, 396] },
    { name: 'Turtle Shell Island', maps: [22, 282, 449] },
    { name: 'Lofty Mountains', maps: [62, 150, 61] },
    { name: 'Darkness Palace', maps: [375, 374, 373, 370, 369, 367] },
    { name: 'Gold City', maps: [113] },
    { name: 'Moon Palace', maps: [351, 350, 35, 48] },
    { name: 'Tasnica', maps: [51, 121, 26, 36, 24, 149] },
    { name: 'Mandala', maps: [64] },
    { name: 'Test of Courage', maps: [18, 72] },
    { name: 'Sunken Continent', maps: [436, 434, 435, 46, 44, 45, 43, 71, 42] },
    { name: 'Light Palace', maps: [116, 111, 119] },
    { name: 'Tree Palace', maps: [237, 251, 419, 195, 431, 238] },
    { name: 'Grand Palace', maps: [417, 416, 415, 428, 414, 423, 421, 413, 412] },
    { name: 'Pure Land', maps: [229, 205, 232, 227, 230, 444, 202, 225, 204, 201, 209, 220, 203, 219, 217] },
    { name: 'Mana Fortress', maps: [245, 246, 250, 244, 248, 249] },
    { name: 'Miscellaneous', maps: [156, 157, 57, 105, 155, 158, 159, 171, 133, 180] },
];

/** The area a map is drawn in, or null. */
export function areaOf(id: number): ManaArea | null {
    return AREAS.find(a => a.maps.includes(id)) ?? null;
}

/** Ids from `ids` that no area lists, in ascending order. */
export function mapsWithoutArea(ids: readonly number[]): number[] {
    const listed = new Set(AREAS.flatMap(a => a.maps));
    return ids.filter(id => !listed.has(id)).sort((a, b) => a - b);
}
