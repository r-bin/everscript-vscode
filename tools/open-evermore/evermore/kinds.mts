// Evermore's resource kinds in migration order (docs/open-evermore/progress.md §1). Each step of the progress page
// adds its codec here; whatever no kind owns stays in `_base/`.
import type { Codec } from '../codec.mts';
import { mapsCodec } from './codecs/maps.mts';
import { tileFamiliesCodec } from './codecs/tile-families.mts';

export const GAME = 'evermore';

export const KINDS: Codec[] = [mapsCodec, tileFamiliesCodec];
