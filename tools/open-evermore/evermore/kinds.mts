// Evermore's resource kinds in migration order (docs/open-evermore/progress.md §1). Each step of the progress page
// adds its codec here; whatever no kind owns stays in `_base/`. Implode encodes them in this order, so a kind that
// marks another's resources (maps → tiles: used, dma) comes first.
import type { Codec } from '../codec.mts';
import { mapsCodec } from './codecs/maps.mts';
import { tileFamiliesCodec } from './codecs/tile-families.mts';
import { tilesCodec } from './codecs/tiles.mts';

export const GAME = 'evermore';

export const KINDS: Codec[] = [mapsCodec, tileFamiliesCodec, tilesCodec];
