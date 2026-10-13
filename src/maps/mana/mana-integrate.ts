// Ownership: Secret of Mana to Secret of Evermore Map Integration Pipeline.
//
// Converts a foreign Secret of Mana composite map into an Evermore Custom Map:
// 1. Composite Flattening & Grid Normalization
// 2. Stamp Generation ({layer1, layer2, collision})
// 3. Collision Translation (Bank $0B structs -> Evermore 16-bit bitfields)
// 4. Triggers & Doors -> Everscript transition scripts & bounding boxes
//
// Reference: docs/map-format/secret-of-mana-comparison-and-porting.md §3 & §4.

import { ManaRoomData, ManaTrigger } from './mana-room';

export interface IntegratedEvermoreMap {
    key: string;
    name: string;
    borrow: number; // Donor Evermore room ID (default 0x34 Strong Heart's Hut)
    w: number;
    h: number;
    saved: {
        cells: Record<string, number>;
        coll?: Record<string, number>;
        added: Array<{ layer1: number; layer2: number; collision: number }>;
        placed: any[];
        start: { x: number; y: number };
        plane: number;
    };
    everscriptSource: string;
}

/**
 * Translate a Secret of Mana Bank $0B collision byte into an Evermore 16-bit collision word.
 *
 * Evermore Collision Word Layout:
 * - Bit 15: entity-gate active
 * - Bit 13: AW (Always Walkable / conveyor / current)
 * - Bit 8..11: entity-gate type
 * - Bit 6: plane-transparent
 * - Bit 4..5: elevation plane (0..3)
 * - Bit 0..3: geometry (0: open, 1: solid, 2..15: slope angles)
 */
export function manaCollisionToEvermoreWord(colByte: number): number {
    switch (colByte) {
        // Walkable ground
        case 0x00:
        case 0x1A:
            return 0x0000;

        // Solid barrier / impassable wall
        case 0x04:
        case 0x01:
        case 0x06:
        case 0x07:
            return 0x0001;

        // Water current / stream / chute (AW bit 13 set)
        case 0x05:
            return 0x2000;

        // Stairs / ramp transition between Plane 0 and Plane 1
        case 0x11:
        case 0x12:
        case 0x13:
            return 0x0011;

        // Overhead bridges / canopy (walkable on Plane 1)
        case 0x16:
        case 0x17:
        case 0x18:
            return 0x0010;

        // Slope geometry (0x02..0x0F)
        case 0x02:
        case 0x03:
            return 0x0002;
        case 0x08:
        case 0x09:
            return 0x0003;
        case 0x0A:
        case 0x0B:
            return 0x0004;

        default:
            // Impassable by default for high unknown collision codes
            return colByte >= 0x20 ? 0x0001 : 0x0000;
    }
}

/**
 * Convert a Secret of Mana composite room into an Evermore Custom Map.
 */
export function integrateManaToEvermore(manaRoom: ManaRoomData): IntegratedEvermoreMap {
    const key = `mana_${manaRoom.id}_${Date.now()}`;
    const name = `${manaRoom.name} (Mana)`;

    // Evermore max room dimensions: 128x128
    const w = Math.min(manaRoom.mapW, 128);
    const h = Math.min(manaRoom.mapH, 128);

    // Step 2 & 4: Stamp Dictionary & Collision Word Translation
    const stampDict: Map<string, number> = new Map();
    const added: Array<{ layer1: number; layer2: number; collision: number }> = [];
    const cells: Record<string, number> = {};
    const coll: Record<string, number> = {};

    for (let cy = 0; cy < h; cy++) {
        for (let cx = 0; cx < w; cx++) {
            const cellIdx = cy * manaRoom.mapW + cx;
            const terrain = manaRoom.gridTerrain[cellIdx] || 0;
            const canopy = manaRoom.gridCanopy[cellIdx] || 0;
            const colByte = manaRoom.gridCollision[cellIdx] || 0;
            const colWord = manaCollisionToEvermoreWord(colByte);

            // Pair layer1 (canopy), layer2 (terrain), and collision
            const signature = `${canopy},${terrain},${colWord}`;
            let stampIdx = stampDict.get(signature);
            if (stampIdx === undefined) {
                stampIdx = added.length;
                stampDict.set(signature, stampIdx);
                added.push({
                    layer1: canopy,
                    layer2: terrain,
                    collision: colWord,
                });
            }
            cells[`${cx},${cy}`] = stampIdx;
            coll[`${cx},${cy}`] = colWord;
        }
    }

    // Step 5: Convert Triggers & Doors into Evermore Step-on Triggers
    const placed: any[] = [];
    const everscriptLines: string[] = [
        `// Auto-generated transition script for ${name}`,
        `// Source: Secret of Mana Composite Map #${manaRoom.id}`,
        '',
    ];

    manaRoom.triggers.forEach((trig, idx) => {
        if (trig.isDoor && trig.destMap != null) {
            const fnName = `mana_door_${trig.doorId || idx}`;
            placed.push({
                kind: 'trigger',
                triggerKind: 'step',
                uid: idx + 1,
                x: trig.destX || Math.floor(w / 2),
                y: trig.destY || Math.floor(h / 2),
                w: 2,
                h: 2,
                label: `Door to SoM Map #${trig.destMap}`,
                script: fnName,
                destMap: trig.destMap,
                destX: trig.destX,
                destY: trig.destY,
            });

            everscriptLines.push(
                `fun ${fnName}() {`,
                `    // Transition to Mana destination map #${trig.destMap} at (${trig.destX}, ${trig.destY})`,
                `    transition(0x${(trig.destMap || 0).toString(16)}, ${trig.destX || 0}, ${trig.destY || 0}, DIRECTION_DOWN);`,
                `}`,
                ''
            );
        } else if (trig.eventId != null) {
            const fnName = `mana_event_${trig.eventId}`;
            placed.push({
                kind: 'trigger',
                triggerKind: 'step',
                uid: idx + 1,
                x: Math.floor(w / 2),
                y: Math.floor(h / 2),
                w: 2,
                h: 2,
                label: `Event #0x${trig.eventId.toString(16)}`,
                script: fnName,
            });

            everscriptLines.push(
                `fun ${fnName}() {`,
                `    // Mana Event ID 0x${trig.eventId.toString(16)}`,
                `    // Placeholder logic for foreign event translation`,
                `}`,
                ''
            );
        }
    });

    const startX = Math.floor(w / 2);
    const startY = Math.floor(h / 2);

    return {
        key,
        name,
        borrow: 0x34, // Strong Heart's Hut donor room
        w,
        h,
        saved: {
            cells,
            coll,
            added,
            placed,
            start: { x: startX, y: startY },
            plane: 0,
        },
        everscriptSource: everscriptLines.join('\n'),
    };
}
