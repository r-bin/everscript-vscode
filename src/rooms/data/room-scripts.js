'use strict';
// Ownership: finding the ROM on disk for the Rooms tab's script view.
//
// The decoding itself lives in src/script/ and is pure — it takes a buffer.
// This is the thin layer that turns a workspace into that buffer, kept
// separate so the decoder stays testable without a filesystem.

const fs = require('fs');
const path = require('path');

const { buildRoomScriptModel, buildArrivalIndex, mergeArrivals } = require('../../script');
const {
    renderCharacterFrames, encodePng, characterDisposition, characterHitbox,
    characterPalette, characterPaletteAddress,
    decodeRoom, planesUsed, spawnDepth,
} = require('../../maps');

const ROM_NAMES = ['Secret of Evermore (U) [!].smc', 'Secret of Evermore.smc'];

function loadRom(wsRoot, romPathOverride) {
    const candidates = [];
    if (romPathOverride) candidates.push(romPathOverride);
    if (wsRoot) for (const name of ROM_NAMES) candidates.push(path.join(wsRoot, name));
    for (const filePath of candidates) {
        if (filePath && fs.existsSync(filePath)) return new Uint8Array(fs.readFileSync(filePath));
    }
    return null;
}

/**
 * Attach each spawn's idle sprite as a PNG data URI.
 *
 * Cached per character for the room: a jungle places fourteen Wimpy Flowers
 * and they are all the same picture. A character whose animation script
 * cannot be walked gets no sprite rather than a stand-in.
 */
const TICK_MS = 1000 / 60;

/**
 * Render one character facing south, as aligned frames.
 *
 * Every frame shares one box anchored on the sprite's origin, so the caller
 * can position by the origin and the frames do not jitter against each
 * other. A single frame is a still; only more than one is animation, since
 * playing one sprite as a loop would claim more than was read.
 */
function buildSprite(rom, character) {
    const r = renderCharacterFrames(rom, character);
    if (!r) return null;
    const png = (data) => 'data:image/png;base64,'
        + encodePng({ width: r.width, height: r.height, data }).toString('base64');
    const frames = r.frames.map((f) => ({
        uri: png(f.data),
        ms: Math.max(16, Math.round(f.ticks * TICK_MS)),
    }));
    return {
        uri: frames[0].uri,
        w: r.width,
        h: r.height,
        ox: r.originX,
        oy: r.originY,
        frames: frames.length > 1 ? frames : null,
    };
}

/**
 * Whether this placement fights back.
 *
 * `INVINCIBLE` (bit 1) is what separates the two: every townsperson carries
 * it and no monster does. A spawn that names its own flags decides for
 * itself — `add_enemy(FIRE_EYES, …, INACTIVE_IMORTAL)` places a character
 * with no flags of her own as a harmless one — and the rest fall back to the
 * character's default.
 */
const FLAG_INVINCIBLE = 0x0002;
const FLAG_INACTIVE = 0x0020;

function attachSprites(rom, spawns) {
    const cache = new Map();
    for (const spawn of spawns) {
        if (spawn.character === null || spawn.character === undefined) continue;
        if (!cache.has(spawn.character)) {
            let built = null;
            let disposition = null;
            let hitbox = null;
            try {
                built = buildSprite(rom, spawn.character);
                disposition = characterDisposition(rom, spawn.character);
                hitbox = characterHitbox(rom, spawn.character);
            } catch { built = null; }
            cache.set(spawn.character, { sprite: built, disposition, hitbox });
        }
        const { sprite, disposition, hitbox } = cache.get(spawn.character);
        if (hitbox) {
            // In pixels, the unit the collision test uses. One SVG unit on the
            // Rooms map is 8 of them.
            spawn.hitW = hitbox.width;
            spawn.hitH = hitbox.height;
        }
        if (disposition) {
            const flags = spawn.state === null || spawn.state === undefined
                ? disposition.flags
                : spawn.state;
            spawn.flags = flags;
            spawn.hostile = (flags & FLAG_INVINCIBLE) === 0;
            spawn.inactive = (flags & FLAG_INACTIVE) !== 0;
            spawn.flagsFrom = spawn.state === null || spawn.state === undefined ? 'character' : 'spawn';
        }
        if (!sprite) continue;
        spawn.sprite = sprite.uri;
        spawn.spriteW = sprite.w;
        spawn.spriteH = sprite.h;
        spawn.spriteOX = sprite.ox;
        spawn.spriteOY = sprite.oy;
        if (sprite.frames) spawn.spriteFrames = sprite.frames;
    }
}

/**
 * Where the game draws each spawn relative to the scenery.
 *
 * `$8FC773` reads the collision word of the tile the character stands on —
 * entity `+0x3C`, filled from that metatile by `$8FAFE5` — and picks OAM
 * priority 3 (over the foreground) or 2 (under it) from the plane
 * comparison and bit 12. A spawn is placed in 8-pixel units and a metatile
 * is 16 px, hence `>> 1`.
 *
 * `unknown` means the tile does not set a plane, so the character's own
 * plane came in with it and the map cannot say which it is. Those are drawn
 * in front rather than hidden under the canopy, because a marker you cannot
 * find is worse than one placed on the optimistic side.
 *
 * See docs/script-format/sprite_priority.md.
 */
function attachTileDepth(rom, mapId, spawns) {
    let room;
    try { room = decodeRoom(rom, mapId); } catch { return; }
    const planes = planesUsed(room.collisionWords);
    for (const spawn of spawns) {
        if (spawn.x === null || spawn.x === undefined) continue;
        const row = room.collisionWords[spawn.y >> 1];
        if (!row) continue;
        const word = row[spawn.x >> 1];
        if (word === undefined) continue;
        spawn.tileWord = word;
        spawn.depth = spawnDepth(word, planes);
        spawn.inFront = spawn.depth !== 'behind';
        spawn.hiddenHere = spawn.depth === 'hidden';
    }
}

/**
 * What the room costs in sprite palettes.
 *
 * `$90CD80` keeps five slots for characters and reuses one whenever the
 * wanted palette is already in it, so **the cost is the number of distinct
 * palettes, not the number of enemies**. Four of the five are handed out to
 * whoever asks; the fifth is the one `$90CE92` overwrites when nothing is
 * free, which is where a palette gets stolen by the next effect that needs
 * one. See docs/script-format/palettes.md.
 */
const PALETTE_SLOTS = 4;

function paletteSummary(rom, spawns) {
    const groups = new Map();
    for (const spawn of spawns) {
        if (spawn.character === null || spawn.character === undefined) continue;
        let addr;
        try { addr = characterPaletteAddress(rom, spawn.character); } catch { continue; }
        // Zero means the character has no palette of its own; `$90CD48` skips
        // the whole allocation for it, so it costs nothing.
        if (!addr) continue;
        if (!groups.has(addr)) {
            groups.set(addr, {
                address: addr,
                colours: characterPalette(rom, spawn.character)
                    .map(([r, g, b]) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')),
                characters: [],
                count: 0,
            });
        }
        const g = groups.get(addr);
        g.count += 1;
        const name = spawn.romName || spawn.name || ('NPC ' + spawn.npc);
        if (!g.characters.some((c) => c.character === spawn.character)) {
            g.characters.push({ character: spawn.character, name });
        }
    }
    const used = [...groups.values()].sort((a, b) => b.count - a.count);
    return { slots: PALETTE_SLOTS, used, free: Math.max(0, PALETTE_SLOTS - used.length) };
}

/** Doors that lead into this room, built once per ROM and kept. */
let arrivalIndex = null;
let arrivalIndexKey = '';

function arrivalsFor(rom, mapId) {
    const key = rom.length + ':' + rom[0x100] + ':' + rom[0x20000] + ':' + rom[0x100000];
    if (arrivalIndexKey !== key) {
        arrivalIndex = buildArrivalIndex(rom);
        arrivalIndexKey = key;
    }
    return mergeArrivals(arrivalIndex.get(mapId) || []);
}

/**
 * The room's enter / step-on / B-trigger scripts, or null when there is no
 * ROM to read. A malformed room returns null rather than a partial model.
 */
function readRoomScriptModel(wsRoot, mapId, romPathOverride) {
    const rom = loadRom(wsRoot, romPathOverride);
    if (!rom) return null;
    try {
        const model = buildRoomScriptModel(rom, mapId);
        attachSprites(rom, model.enter.spawns);
        attachTileDepth(rom, mapId, model.enter.spawns);
        model.palettes = paletteSummary(rom, model.enter.spawns);
        try { model.arrivals = arrivalsFor(rom, mapId); } catch { model.arrivals = []; }
        return model;
    } catch { return null; }
}

module.exports = { readRoomScriptModel, ROM_NAMES };
