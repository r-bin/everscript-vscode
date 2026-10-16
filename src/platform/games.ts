// The game registry: what core/ and platform/ know about a game (docs/architecture/multi-game.md §3).
// Games register themselves through registerGame(); nothing here names a game.
import type { RomHeader } from './roms/header';

export interface Variant {
    /** Short id used in URIs and the UI: `us`, `eu`, `de`, `es-rev2`, ... */
    id: string;
    name: string;
    /** SHA-1 of the unheadered file. */
    sha1: string;
    /** The one variant people hack; address facts are written for it. Exactly one per game. */
    base?: boolean;
}

/** What a game offers; drives the ROM panel's feature table and the empty states. */
export type Capability =
    | 'maps' | 'map-editor' | 'scripts' | 'sprites' | 'music' | 'memory-names'
    | 'emulator-panels' | 'language' | 'knowledge';

export type Support = 'full' | 'partial';

/** A ROM our own builders made from a base variant (the marker is the game's business). */
export interface DerivedMarker {
    baseSha1: string;
    kind: string;
}

export interface GameDescriptor {
    id: string;
    name: string;
    /** URI scheme of the game's read-only file system (`soe`, `som`). */
    scheme: string;
    /** True when this header belongs to the game (title, map mode). */
    matchesHeader(header: RomHeader): boolean;
    variants: Variant[];
    capabilities: Partial<Record<Capability, Support>>;
    /** Reads our builders' marker from a ROM of this game, if it has one. */
    readDerivedMarker?(rom: Uint8Array): DerivedMarker | null;
    /** Where the game's facts are written down (repo-relative). */
    docs: string;
}

const games: GameDescriptor[] = [];

export function registerGame(game: GameDescriptor): void {
    if (games.some((g) => g.id === game.id)) return;
    if (game.variants.filter((v) => v.base).length !== 1) throw new Error(`${game.id}: exactly one base variant`);
    games.push(game);
}

export function listGames(): readonly GameDescriptor[] {
    return games;
}

export function gameById(id: string): GameDescriptor | undefined {
    return games.find((g) => g.id === id);
}

export function gameByScheme(scheme: string): GameDescriptor | undefined {
    return games.find((g) => g.scheme === scheme);
}

export function baseVariant(game: GameDescriptor): Variant {
    return game.variants.find((v) => v.base)!;
}
