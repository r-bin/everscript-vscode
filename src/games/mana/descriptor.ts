// Secret of Mana as the platform sees it. Facts: docs/mana/. Nothing here comes from Evermore.
import type { GameDescriptor } from '../../platform/games';

export const mana: GameDescriptor = {
    id: 'mana',
    name: 'Secret of Mana',
    scheme: 'som',
    matchesHeader: (h) => h.title === 'Secret of MANA',
    variants: [
        { id: 'us', name: 'USA', sha1: '8133041a363e3cc68cedef40b49b6d20d03c505d', base: true },
    ],
    capabilities: { maps: 'full', 'map-editor': 'partial', knowledge: 'partial' },
    docs: 'docs/mana/',
};
