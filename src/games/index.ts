// The one list of games (docs/architecture/multi-game.md §3). Removing a game: delete its folder and its line.
import { registerGame } from '../platform/games';
import { romFor, baseRom } from '../platform/roms/library';
import { evermore } from './evermore/descriptor';
import { mana } from './mana/descriptor';

let registered = false;

export function registerGames(): void {
    if (registered) return;
    registered = true;
    registerGame(evermore);
    registerGame(mana);
}

/**
 * Path of the ROM a game's scheme means right now (selected, else base), or null.
 * For tests and node tools, which have no other way to find a ROM.
 */
export function romPath(gameId: string, rom?: string): string | null {
    registerGames();
    return romFor(gameId, rom)?.path ?? null;
}

/** Path of the game's base ROM (the one builders start from), or null. */
export function baseRomPath(gameId: string): string | null {
    registerGames();
    return baseRom(gameId)?.path ?? null;
}
