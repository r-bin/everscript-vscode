// Which game and which variant a ROM file is (docs/architecture/multi-game.md §4):
// the header picks the game, the hash picks the variant, our builders' marker names a derived ROM.
import { createHash } from 'node:crypto';
import { readHeader, stripCopierHeader, isPal, type RomHeader } from './header';
import { listGames, baseVariant, type GameDescriptor } from '../games';

export type Match = 'known' | 'derived' | 'unknown';

export interface RomIdentity {
    /** Game id, or null when no registered game claims the header. */
    game: string | null;
    /** Variant id for known ROMs; for a derived ROM the variant it was built from. */
    variant: string | null;
    match: Match;
    /** Build kind of a derived ROM (`table-hack`, `exhirom`, ...). */
    derivedKind?: string;
    sha1: string;
    size: number;
    title: string;
    region: number | null;
    pal: boolean;
    header: RomHeader | null;
}

export function sha1Of(rom: Uint8Array): string {
    return createHash('sha1').update(rom).digest('hex');
}

function forGame(game: GameDescriptor, rom: Uint8Array, sha1: string): Pick<RomIdentity, 'variant' | 'match' | 'derivedKind'> {
    const known = game.variants.find((v) => v.sha1 === sha1);
    if (known) return { variant: known.id, match: 'known' };
    const marker = game.readDerivedMarker?.(rom);
    if (marker) {
        const from = game.variants.find((v) => v.sha1 === marker.baseSha1);
        if (from) return { variant: from.id, match: 'derived', derivedKind: marker.kind };
    }
    return { variant: null, match: 'unknown' };
}

/** Identifies a ROM file's bytes (a 512-byte copier header is skipped). */
export function identifyRom(file: Uint8Array): RomIdentity {
    const rom = stripCopierHeader(file);
    const header = readHeader(rom);
    const sha1 = sha1Of(rom);
    const base = {
        sha1, size: rom.length, header,
        title: header?.title ?? '',
        region: header?.region ?? null,
        pal: header ? isPal(header.region) : false,
    };
    // A hash match wins even over a header no game claims (e.g. a damaged header in a known dump).
    for (const game of listGames()) {
        if (game.variants.some((v) => v.sha1 === sha1)) return { ...base, game: game.id, ...forGame(game, rom, sha1) };
    }
    if (header) {
        for (const game of listGames()) {
            if (game.matchesHeader(header)) return { ...base, game: game.id, ...forGame(game, rom, sha1) };
        }
    }
    return { ...base, game: null, variant: null, match: 'unknown' };
}

/** True when the identity is the game's base variant. */
export function isBase(id: RomIdentity): boolean {
    if (!id.game || id.match !== 'known') return false;
    const game = listGames().find((g) => g.id === id.game);
    return !!game && baseVariant(game).id === id.variant;
}
