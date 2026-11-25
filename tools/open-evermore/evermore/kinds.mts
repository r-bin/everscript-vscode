// Evermore's resource kinds in migration order (docs/open-evermore/progress.md §1). Each step of the progress page
// adds its codec here; whatever no kind owns stays in `_base/`. Implode encodes them in this order, so a kind that
// marks another's resources (maps → tiles: used, dma) comes first.
import type { Codec } from '../codec.mts';
import { mapsCodec } from './codecs/maps.mts';
import { palettesCodec } from './codecs/palettes.mts';
import { spritePalettesCodec } from './codecs/sprite-palettes.mts';
import { collisionsCodec } from './codecs/collisions.mts';
import { tilesCodec } from './codecs/tiles.mts';
import { stringsCodec } from './codecs/strings.mts';
import { scriptsCodec, WINDOW as SCRIPT_WINDOW } from './codecs/scripts.mts';
import { opcodesCodec } from './codecs/opcodes.mts';
import { entitiesCodec } from './codecs/entities.mts';
import { projectilesCodec } from './codecs/projectiles.mts';
import { animationsCodec } from './codecs/animations.mts';
import { animationModesCodec, attackProcsCodec, behavioursCodec } from './codecs/handler-tables.mts';
import { charactersCodec } from './codecs/characters.mts';
import { experienceCodec } from './codecs/experience.mts';
import { spriteBlocks16Codec, spriteBlocks8Codec } from './codecs/sprite-blocks.mts';
import { metaspritesCodec } from './codecs/metasprites.mts';
import { musicCodec, soundsCodec } from './codecs/music.mts';
import { fontsCodec, hudCodec } from './codecs/graphics.mts';
import { MENU_KINDS } from './codecs/menus.mts';
import { EQUIPMENT_KINDS } from './codecs/equipment.mts';
import { ALCHEMY_KINDS } from './codecs/alchemy.mts';
import { ITEM_KINDS } from './codecs/items.mts';
import { wramCodec } from './codecs/wram.mts';
import { textsCodec } from './codecs/texts.mts';
import { targetsCodec } from './codecs/targets.mts';
import { setFolders } from '../links.mts';

export const GAME = 'evermore';

/**
 * Bytes Evermore reads past its 3 MiB image: $80:D113 reads $B0:E293+X, X ≤ $780, 64 bytes (knowledge
 * row_table_low_bytes_from_bank_b0). A grown image answers there as the original did (layouts.mts).
 */
export const PAST_END = [{ start: 0x30E293, end: 0x30E293 + 0x780 + 0x40 }];

/** Pointer forms that are positions in a window: the packed script pointer (scripts.mts), kept by the engine in
 *  WRAM ($26-$28 when it starts a script). The proof translates them like long pointers. */
export const POINTER_WINDOWS = [SCRIPT_WINDOW];

// wram first: every later kind names WRAM through it.
// spritePalettesCodec and metaspritesCodec provide names/ids to animationsCodec and record codecs; animationsCodec must run before characters/projectiles/menus/equipment.
export const KINDS: Codec[] = [wramCodec, mapsCodec, palettesCodec, spritePalettesCodec, collisionsCodec, tilesCodec, stringsCodec, textsCodec, targetsCodec, scriptsCodec, opcodesCodec, entitiesCodec,
    animationsCodec, animationModesCodec, attackProcsCodec, behavioursCodec, projectilesCodec, charactersCodec, experienceCodec, spriteBlocks16Codec, spriteBlocks8Codec, metaspritesCodec, musicCodec, soundsCodec, fontsCodec, hudCodec, ...MENU_KINDS, ...EQUIPMENT_KINDS, ...ALCHEMY_KINDS, ...ITEM_KINDS];
// References are written as `<folder>/<name>` (links.mts): every kind's folder, once.
setFolders(KINDS);
