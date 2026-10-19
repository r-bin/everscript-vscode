// The emulator page's ROM readers: the host's own (maps/sprites.ts, maps/character-record.ts), bundled for
// the page as the global EvsRom (tools/bundle-pages.mts → dist/webview/evermore-rom.js, loaded through
// host.js webviewFiles()). The page draws entities outside the screen and reads their records with them,
// and draws the room's triggers with room-triggers.ts.
export { readSpriteInfo, composeSprite } from '../maps/sprites';
export { paletteAt, entityRecordWord, entityNamePointer, entityCharacter, RECORD_FIELDS, ATTACK_FIELDS } from '../maps/character-record';
export { bgr555 } from '../../../platform/snes/tiles';
export { parseRoomTriggers, calculateTriggerBox, resolveScriptIdToSnes } from './room-triggers';
