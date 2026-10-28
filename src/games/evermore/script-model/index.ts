// Ownership: public API of the script model — rooms' scripts as the editor shows them (listings,
// loot, doors, spawns, arrivals) and the names behind them, built on script-vm. Pure.

export { buildRoomScriptModel, scriptModel } from './room-model';
export type { RoomScriptModel, RoomScriptMeta, RoomScript, RoomTrigger, ScriptRow, SpawnFacts, StopReason } from './room-model';
export { mergedScript, mergedEnterScript, mergedRoomScript, roleOf } from './merged';
export type { MergedScript, MergedLine, MergedBlock, Role } from './merged';
export { lootOf, lootToEverscript, LOOT_CELLS } from './loot';
export type { LootFacts, LootValue, ValueEncoding } from './loot';
export { doorsOf } from './doors';
export type { TransitionFacts } from './doors';
export { paths } from './paths';
export type { Step, Paths } from './paths';
export { buildArrivalIndex, mergeArrivals } from './arrivals';
export type { Arrival, ArrivalIndex } from './arrivals';
export {
    memoryName, flagName, valueName, scriptName, globalScriptName, mapName, lootRewardName, enemyName, identifier, printNames,
} from './names';
export type { EnemyName } from './names';
export { slicesOf } from './slices';
export type { Slice, SliceArea, SliceKind } from './slices';
