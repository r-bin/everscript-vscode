// Evermore's resource kinds in migration order (docs/open-evermore/progress.md §1). Each step of the progress page
// adds its codec here; whatever no kind owns stays in `_base/`. Implode encodes them in this order, so a kind that
// marks another's resources (maps → tiles: used, dma) comes first.
import type { Codec } from '../codec.mts';
import { mapsCodec } from './codecs/maps.mts';
import { tileFamiliesCodec } from './codecs/tile-families.mts';
import { tilesCodec } from './codecs/tiles.mts';
import { stringsCodec } from './codecs/strings.mts';

export const GAME = 'evermore';

/**
 * Bytes Evermore reads past its 3 MiB image: $80:D113 reads $B0:E293+X, X ≤ $780, 64 bytes (knowledge
 * row_table_low_bytes_from_bank_b0). A grown image answers there as the original did (layouts.mts).
 */
export const PAST_END = [{ start: 0x30E293, end: 0x30E293 + 0x780 + 0x40 }];

export const KINDS: Codec[] = [mapsCodec, tileFamiliesCodec, tilesCodec, stringsCodec];
