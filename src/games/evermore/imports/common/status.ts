// Ownership: how well a converted room came out, for the Rooms tab's rail colours — red: it cannot be played as an
// Evermore room (it does not convert, or it breaks a hard ceiling), yellow: it works but is not what the source game
// shows (tiles approximated, recoloured, an animation or an effect left out) or spends more than any vanilla room. Read
// off the conversion's own counts (each bridge's `stats`); for every game a room is converted from. Pure.

import { MAX_WRAM, MAX_FAMILIES, VANILLA_MAX } from '../../maps/budget';

type Level = 'ok' | 'warn' | 'error';
type RoomStatus = { level: Level; reasons: { level: 'warn' | 'error'; text: string }[] };

/** What a status reads: the bridge's counts, the image's bytes, the families. Missing counts are 0. */
type Counts = Record<string, unknown>;

const plural = (n: number, one: string, many = one + 's') => n + ' ' + (n === 1 ? one : many);

/** Each count that makes a room differ from its source, and what to say. */
const WARNINGS: [string, (n: number) => string][] = [
    ['substitutedGraphics', (n) => plural(n, 'graphic') + ' drawn as the nearest-looking one: past Evermore\'s 256'],
    ['droppedGraphics', (n) => plural(n, 'graphic') + ' drawn empty'],
    ['recolouredTiles', (n) => plural(n, 'tile') + ' redrawn in one palette: the source mixes palettes in them'],
    ['mixedPriority', (n) => plural(n, 'tile') + ' at one priority: the source sets it per 8×8 character'],
    ['effectLayers', (n) => plural(n, 'screen-effect layer') + ' left out'],
    ['hiddenLayersShown', (n) => plural(n, 'layer') + ' shown that the room loads hidden'],
    ['unconvertedColourMath', () => 'colour math with the fixed colour not converted'],
    ['lostBackdropTint', () => 'the backdrop\'s tint over the background layer is lost'],
    ['droppedCycles', (n) => plural(n, 'colour rotation') + ' left still: two per palette at most'],
    ['unconvertedColours', (n) => plural(n, 'changing colour') + ' left still'],
    ['stillPaletteAnimations', (n) => plural(n, 'palette animation') + ' left still'],
    ['tileAnimations', (n) => plural(n, 'tile animation') + ' not converted: those tiles are still'],
    ['stillTiles', (n) => plural(n, 'moving tile') + ' left still: past the animation budget'],
    ['contextRooms', (n) => 'graphics kept from ' + plural(n, 'room') + ' loaded before it: a guess'],
];

/** The status of a room the bridge converted, from its counts. */
function conversionStatus(c: Counts): RoomStatus {
    const n = (k: string) => Number(c[k]) || 0;
    const reasons: RoomStatus['reasons'] = [];
    if (n('wramBytes') > MAX_WRAM) reasons.push({ level: 'error', text: 'grid and stamps need ' + n('wramBytes') + ' bytes: Evermore\'s WRAM window holds ' + MAX_WRAM });
    else if (n('wramBytes') > VANILLA_MAX.wram) reasons.push({ level: 'warn', text: n('wramBytes') + ' bytes of WRAM: more than any vanilla room (' + VANILLA_MAX.wram + ')' });
    if (n('families') > MAX_FAMILIES) reasons.push({ level: 'error', text: n('families') + ' families: a room loads ' + MAX_FAMILIES });
    for (const [key, text] of WARNINGS) if (n(key) > 0) reasons.push({ level: 'warn', text: text(n(key)) });
    return { level: reasons.some((r) => r.level === 'error') ? 'error' : reasons.length ? 'warn' : 'ok', reasons };
}

/** A room that did not convert at all. */
const failedStatus = (why: string): RoomStatus => ({ level: 'error', reasons: [{ level: 'error', text: 'does not convert: ' + why }] });

export type { RoomStatus, Level };
export { conversionStatus, failedStatus };
