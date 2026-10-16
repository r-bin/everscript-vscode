// Ownership: the cells a weapon can change — Secret of Mana's cuttable grass, breakable
// rocks and the like.
//
// $01:CE19 calls $01:D293 for an entity whose attack is out ($E0C2,X != 0). It probes the
// cell at the entity's position plus a reach toward its facing ($56), in layer A
// ($7F:0000 / collision $7F:B800) or B ($7F:4000 / $7F:BC00) by $E00B,X bit 7, and reads
// that cell's collision bytes 2-3 ($01:D376). When c2 is $Cn and the attack's weapon type
// $E068,X matches n ($01:D3AB), c3 is written into the cell ($01:D3F5): the cell becomes
// metatile c3. n: 0-7 that type only, 8 types 1-2, 9 types 3-4, A 5 and up, B below 3.
// Checked by running $01:D293 on the interpreter over map $81 (tests/mana/mana-rom.test.js):
// the bush $05 (c2 $C8) becomes $5F for types 1 and 2 and stays for 0, 3 and 5.
// c2 $Fn (with $E02C,X set) is another branch, not named here.

import { Rom } from './rom';
import { ManaMap } from './map';
import { collisionOf } from './collision';

export interface CuttableCell {
    layer: 'A' | 'B';
    x: number;
    y: number;
    /** The metatile now, and the one it becomes. */
    from: number;
    to: number;
    /** c2's low nibble: which weapon types change it. */
    weapons: number;
}

/** Weapon types ($E068) that change a cell with c2 = $C0 | n. */
export function weaponTypes(n: number): number[] {
    const all = [0, 1, 2, 3, 4, 5, 6, 7];
    if (n < 8) return [n];
    if (n === 8) return [1, 2];
    if (n === 9) return [3, 4];
    if (n === 10) return all.filter(t => t >= 5);
    if (n === 11) return all.filter(t => t < 3);
    return [];
}

export function cuttableCells(rom: Rom, map: ManaMap): CuttableCell[] {
    const out: CuttableCell[] = [];
    for (const layer of ['A', 'B'] as const) {
        if (layer === 'B' && !map.sizeB) continue;
        const c = collisionOf(rom, map, layer);
        for (let y = 0; y < map.h; y++) {
            for (let x = 0; x < map.w; x++) {
                const i = (y * map.w + x) * 4;
                if ((c.bytes[i + 2] & 0xF0) !== 0xC0 || (c.bytes[i + 2] & 0x0F) > 11) continue;
                const from = map.cell(layer, x, y);
                if (from < 0 || from >= 192) continue;
                out.push({ layer, x, y, from, to: c.bytes[i + 3], weapons: c.bytes[i + 2] & 0x0F });
            }
        }
    }
    return out;
}
