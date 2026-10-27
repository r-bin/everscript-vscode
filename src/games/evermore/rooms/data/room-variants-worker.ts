// Ownership: the worker thread that simulates one room's enter script into variants
// (room-variants.ts starts it). Its own entry point: bundled on its own as
// bundle/room-variants-worker.js (tools/bundle.mts), run from dist/ when unbundled.

import { parentPort, workerData } from 'worker_threads';
import { createSimulator } from '../../simulation';
import { enemiesAt } from '../../maps';
import { buildRoomScriptModel } from '../../script-model';

const { rom, roomId } = workerData as { rom: Uint8Array; roomId: number };
try {
    // Split on the room's enemies only: townsfolk behind flags stay one room, marked "only if".
    const enemies = enemiesAt(rom, buildRoomScriptModel(rom, roomId).enter.spawns);
    const variants = createSimulator(rom).variants(roomId, { splitOn: (e) => enemies.has(e.at) });
    parentPort!.postMessage({ variants });
} catch (err) {
    parentPort!.postMessage({ error: err instanceof Error ? err.message : String(err) });
}
