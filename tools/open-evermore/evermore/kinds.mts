// Evermore's resource kinds in migration order (docs/open-evermore/progress.md §1). Explode runs them in this
// order and `raw` last; each step of the progress page adds its codec here, before `raw`.
import type { Codec } from '../codec.mts';
import { raw } from '../raw.mts';

export const GAME = 'evermore';

export const KINDS: Codec[] = [raw];
