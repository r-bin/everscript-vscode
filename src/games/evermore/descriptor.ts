// Secret of Evermore as the platform sees it. Variant hashes and regions: docs/evermore-releases.md §1.
import type { GameDescriptor } from '../../platform/games';
import { readDerivedMarker } from './derived';

export const evermore: GameDescriptor = {
    id: 'evermore',
    name: 'Secret of Evermore',
    scheme: 'soe',
    matchesHeader: (h) => h.title === 'SECRET OF EVERMORE',
    variants: [
        { id: 'us', name: 'USA', sha1: '79e7738630fff5699217ef58ecc421bc8fcbcd89', base: true },
        { id: 'eu', name: 'Europe', sha1: 'ae17166919fdfdf26cc5771f83cfd19eaf71806c' },
        { id: 'de', name: 'Germany', sha1: '5e5c2082526690d05f962c3ffbd7e080c681bfa4' },
        { id: 'fr', name: 'France', sha1: '8a430c9d6a3dcef974252fe8d946a0d619bb1a61' },
        { id: 'es', name: 'Spain (Rev 1)', sha1: '4363ce4b19e76261f9325ac9a0cce27d97490df2' },
        { id: 'es-rev2', name: 'Spain (Rev 2)', sha1: 'c29fe997740bd9b54a07fba7b2b5442a49245aac' },
    ],
    capabilities: {
        maps: 'full', 'map-editor': 'full', scripts: 'full', sprites: 'full', music: 'full',
        'memory-names': 'full', 'emulator-panels': 'full', language: 'full', knowledge: 'full',
    },
    readDerivedMarker,
    docs: 'docs/',
};
