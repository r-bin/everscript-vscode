// Terranigma as the platform sees it. Facts: docs/terra/.
import type { GameDescriptor } from '../../platform/games';

export const terra: GameDescriptor = {
    id: 'terra',
    name: 'Terranigma',
    scheme: 'terra',
    matchesHeader: (h) => h.title.startsWith('TERRANIGMA') || h.title === 'TENCHI-JPN',
    variants: [
        { id: 'eu', name: 'Europe', sha1: '911239b4b21106ae4a284454d345c55554985525', base: true },
        { id: 'de', name: 'Germany', sha1: '018701e5ce385e0b32e61b8f8bb2f9abf8abf8f0' },
        { id: 'de-rev1', name: 'Germany (Rev 1)', sha1: '9a64ce79bea16d01ab71b58b11df0bcf0eedd889' },
        { id: 'fr', name: 'France', sha1: '4f8a5771cb11757a31a026e5892b9434a3a405cb' },
        { id: 'es', name: 'Spain', sha1: '1e1a85cf28bcb69cb34fc71f48347279d7cfea7e' },
        { id: 'jp', name: 'Japan', sha1: 'f787672e766a43a73d9bd310fcb3c2cac024b227' },
    ],
    capabilities: { maps: 'partial', knowledge: 'partial' },
    docs: 'docs/terra/',
};

