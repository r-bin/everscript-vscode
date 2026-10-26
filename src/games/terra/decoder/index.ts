// Terranigma decoder: pure TypeScript, ROM bytes in, rooms and pictures out (docs/terra/README.md).
// Imports only platform/ (SNES hardware, ROM headers); never another game.
export * from './rom';
export { SECTION_NAMES, newTerraBus, runRoomLoader } from './loader';
export type { LoaderRun } from './loader';
export { loadRoom, contextRooms, headerRun, roomSections } from './room';
export type { TerraRoom, TerraLayer, TerraPpu, HeaderSummary } from './room';
export { renderRoom, renderMetatileSheet, roomSize, layerBg, rgbOf } from './render';
export type { Picture } from './render';
export { roomCatalog, hex3 } from './catalog';
export type { TerraCatalog, TerraRoomEntry, TerraGroup } from './catalog';
export { cellTypeRules, cellClass } from './collision';
export type { CellTypeRule, CellClass, Move, MoveRule, GroundRule } from './collision';
export { roomExits } from './exits';
export type { TerraExit, ExitTarget } from './exits';
export { roomChanges, changeCells, withChange } from './changes';
export type { MapChange, ChangeEdit } from './changes';
export { roomChests } from './chests';
export type { TerraChest } from './chests';
export { TERRA_ROUTINES, COP_COMMANDS, COP_TABLE, routineByName, routineAt } from './code';
export type { TerraRoutine, TerraCop } from './code';
export { disassembleRoutine, routineRefs, routineCallers, busText } from './disasm';
export type { AsmLine, RoutineRefs } from './disasm';
