// Ownership: the Data tab's Enums view — id lists the game itself defines,
// read from the user's ROM or from a knowledge entry that says how it was
// found. Nothing comes from the compiler's .evs enums: those were partly
// guessed and carry hack-specific entries. Each list says where it is read
// (`source`), so every value can be checked. Pure apart from the ROM buffer
// and the character list the host hands in.

import * as maps from '../../maps';
import { CHARACTER_TABLE, CHARACTER_STRIDE } from '../../maps/character-record';
import { getMapName, getMapArea, FUNCTION_BY_ADDRESS, MUSIC, SOUNDS } from '../../localizations';
import { entries as knowledgeEntries } from '../../localizations/knowledge';
import { hex } from '../../../../platform';
import type { CharacterInfo } from './palettes';

interface Entry { cells: string[]; vfs?: string; icon?: string; detail?: [string, string][] }
interface EnumList { id: string; group: string; title: string; source: string; columns: string[]; entries: Entry[] }

const RECORD_COUNT = 142;
/** Record +$03 (AI script) and +$30 (what touching it does), as rom/8eb678.md lists them. */
const FIELD_AI = 0x03;
const FIELD_CONTACT = 0x30;
/** `JSR ($B6AE,x)`: one word per even id; 15 handlers, the 16th word is not code. */
const CONTACT_TABLE = 0x8fb6ae;
const CONTACT_COUNT = 15;
/** Alchemy text and the cast tables in bank $C4 (knowledge rom/c45d09.md, c45f97.md, c45fc5.md). */
const FORMULA_NAMES = 0xc45d09;
const FORMULA_DESCRIPTIONS = 0xc45d51;
const FORMULA_BLOCKS = 0xc45ddf;
const FORMULA_COUNT = 35;
const CAST_BLOCKS = 0xc45f97;
const CAST_NAMES = 0xc45fc5;
const CAST_COUNT = 23;
const INGREDIENT_NAMES = CAST_NAMES + CAST_COUNT * 2;
const INGREDIENT_COUNT = 22;
/** Block offset → `$91` block address: the word at `$91:80A6 + offset`. */
const BLOCK_TABLE = 0x9180a6;
const BLOCK_BANK = 0x91;
/** WRAM character blobs the knowledge base describes. */
const WRAM_BLOBS = [0x7e0a26, 0x7e0a70, 0x7e4e89, 0x7e4f37, 0x7e3ddf];

const bus = (addr: number): string => 'soe://bus/' + hex(addr, 6).toLowerCase();
const word = (rom: Uint8Array, snes: number): number => maps.read16(rom, maps.snesToRom(snes));
const h = (v: number, d = 4): string => '$' + hex(v, d);

/** Zero-ended text in the ROM, as the menus print it (printable ASCII only). */
function text(rom: Uint8Array, snes: number): string {
    let s = '';
    for (let p = maps.snesToRom(snes); p < rom.length && rom[p] && s.length < 80; p++) s += rom[p] >= 0x20 && rom[p] < 0x7f ? String.fromCharCode(rom[p]) : '·';
    return s;
}
const textAt = (rom: Uint8Array, table: number, i: number): string => text(rom, 0xc40000 | word(rom, table + i * 2));
const blockOf = (rom: Uint8Array, offset: number): number => (BLOCK_BANK << 16) | word(rom, BLOCK_TABLE + offset);
const recordWord = (rom: Uint8Array, c: number, field: number): number => word(rom, CHARACTER_TABLE + c * CHARACTER_STRIDE + field);
const charName = (chars: CharacterInfo[], c: number): string => hex(c, 2) + ' ' + (chars[c]?.name || '');

function characterBlobs(rom: Uint8Array, chars: CharacterInfo[]): EnumList {
    const ram = knowledgeEntries('ram');
    const wram: Entry[] = WRAM_BLOBS.map((a) => ram.find((e) => e.addr === a)).filter(Boolean).map((e) => ({
        cells: ['WRAM', e!.title, h(e!.addr, 6), (e!.size || e!.end - e!.addr + 1) + ' bytes'], vfs: bus(e!.addr),
    }));
    const rec: Entry[] = [];
    for (let c = 0; c < RECORD_COUNT; c++) {
        const a = CHARACTER_TABLE + c * CHARACTER_STRIDE;
        rec.push({ cells: ['ROM', charName(chars, c), h(a, 6), CHARACTER_STRIDE + ' bytes'], vfs: bus(a), icon: chars[c]?.thumbs?.s || chars[c]?.thumbs?.e || undefined });
    }
    return {
        id: 'blobs', group: 'Characters', title: 'Character blobs', columns: ['where', 'name', 'address', 'size'], entries: wram.concat(rec),
        source: 'ROM: the 142 records at $8E:B678, 74 bytes each, named by the text their +$00 pointer names. WRAM: the Boy\'s and Dog\'s own records ($0A26, $0A70 — rewritten by the weapon and Dog-form loaders), their entities and the head of the entity list (knowledge entries). The other entity slots are not verified yet.',
    };
}

/** The character record's fields, as the knowledge entry rom/8eb678.md lists them with their readers. */
function recordFields(): EnumList {
    const e = knowledgeEntries('rom').find((x) => x.addr === CHARACTER_TABLE);
    const rows = (e?.body || '').split('\n').filter((l) => /^\| `\+\$/.test(l));
    return {
        id: 'fields', group: 'Characters', title: 'Character record fields', columns: ['field', 'read by', 'what the game does'],
        entries: rows.map((l) => ({ cells: l.split('|').slice(1, 4).map((c) => c.trim().replace(/`/g, '')) })),
        source: 'Knowledge entry rom/8eb678.md: every long-indexed read of the records, grouped by field, with the routine that reads it.',
    };
}

function usedBy(rom: Uint8Array, chars: CharacterInfo[], field: number): Map<number, string[]> {
    const out = new Map<number, string[]>();
    for (let c = 0; c < RECORD_COUNT; c++) {
        const v = recordWord(rom, c, field);
        out.set(v, (out.get(v) || []).concat(charName(chars, c)));
    }
    return out;
}

function contactHandlers(rom: Uint8Array, chars: CharacterInfo[]): EnumList {
    const users = usedBy(rom, chars, FIELD_CONTACT);
    const entries: Entry[] = [];
    for (let i = 0; i < CONTACT_COUNT; i++) {
        const id = i * 2, target = 0x8f0000 | word(rom, CONTACT_TABLE + id);
        const u = users.get(id) || [];
        entries.push({ cells: [h(id, 2), h(target, 6), FUNCTION_BY_ADDRESS.get(target)?.name || '', u.length ? u.length + ' records' : '—'], vfs: bus(target), detail: u.length ? [['records', u.join(', ')]] : undefined });
    }
    return {
        id: 'contact', group: 'Characters', title: 'Contact handler (record +$30)', columns: ['id', 'handler', 'what it does', 'used by'], entries,
        source: 'Record +$30 picks a handler from the word table $8F:B6AE (JSR ($B6AE,x), rom/8fb6ae.md): 15 handlers, ids 0–$1C. Projectiles use the same table.',
    };
}

function aiSelectors(rom: Uint8Array, chars: CharacterInfo[]): EnumList {
    const users = usedBy(rom, chars, FIELD_AI);
    return {
        id: 'ai', group: 'Characters', title: 'AI selector (record +$03)', columns: ['value', 'records', 'used by'],
        entries: [...users.keys()].sort((a, b) => a - b).map((v) => ({ cells: [h(v), String(users.get(v)!.length), users.get(v)!.slice(0, 4).join(', ') + (users.get(v)!.length > 4 ? ' …' : '')], detail: [['records', users.get(v)!.join(', ')]] })),
        source: 'The values the 142 records hold at +$03, which $8F:CD1A reads to pick the AI script. What each value does is not decoded yet.',
    };
}

function formulas(rom: Uint8Array, icons: (string | null)[]): EnumList {
    const casts = new Map<number, number>();
    for (let i = 0; i < CAST_COUNT; i++) casts.set(word(rom, CAST_BLOCKS + i * 2), i * 2);
    const entries: Entry[] = [];
    for (let i = 0; i < FORMULA_COUNT; i++) {
        const off = word(rom, FORMULA_BLOCKS + i * 2), block = blockOf(rom, off), cast = casts.get(off);
        entries.push({ cells: [String(i), textAt(rom, FORMULA_NAMES, i), h(block, 6), cast != null ? h(cast, 2) : '—'], icon: icons[i] || undefined,
            detail: [['description', textAt(rom, FORMULA_DESCRIPTIONS, i)], ['block offset', h(off, 2) + ' ($C4:5DDF)']], vfs: bus(block) });
    }
    return {
        id: 'formulas', group: 'Alchemy', title: 'Formulas', columns: ['index', 'name', '$91 block', 'cast id'], entries,
        source: 'Names: pointers at $C4:5D09 (35), descriptions at $C4:5D51; the $91 block: offset at $C4:5DDF into the table $91:80A6. The cast id is the CAST entry with the same block.',
    };
}

function castIds(rom: Uint8Array): EnumList {
    const entries: Entry[] = [];
    for (let i = 0; i < CAST_COUNT; i++) {
        const off = word(rom, CAST_BLOCKS + i * 2), block = blockOf(rom, off);
        entries.push({ cells: [h(i * 2, 2), textAt(rom, CAST_NAMES, i), h(block, 6)], vfs: bus(block) });
    }
    return {
        id: 'cast', group: 'Alchemy', title: 'CAST (spell id of opcodes $9E / $AC)', columns: ['id', 'name', '$91 block'], entries,
        source: 'The script opcodes $9E and $AC take a spell id and read $C4:5F97 (its $91 block offset) and $C4:5FC5 (its name), 23 even ids. Some are enemy-only spells with no formula. Ids past $2C read the ingredient names that follow.',
    };
}

function ingredients(rom: Uint8Array): EnumList {
    const entries: Entry[] = [];
    for (let i = 0; i < INGREDIENT_COUNT; i++) entries.push({ cells: [String(i), textAt(rom, INGREDIENT_NAMES, i)] });
    return {
        id: 'ingredients', group: 'Alchemy', title: 'Ingredient names', columns: ['index', 'name'], entries,
        source: 'The 22 name pointers right after the cast names ($C4:5FF3). Which item id each belongs to is not traced yet.',
    };
}

function rooms(rom: Uint8Array): EnumList {
    const entries: Entry[] = [];
    for (let id = 0; id < maps.MAX_ROOMS; id++) {
        const blob = maps.roomBlobOffset(rom, id), snes = 0xc00000 + blob;
        let size = '?';
        try { size = String(maps.objectAreaEnd(rom, maps.parseBlobLayout(rom, blob)) - blob); } catch { /* listed without a size */ }
        entries.push({ cells: [h(id, 2), getMapName(id) || '', getMapArea(id) || '', h(snes, 6), size], vfs: bus(snes) });
    }
    return {
        id: 'rooms', group: 'Rooms', title: 'Rooms (map pointer table)', columns: ['id', 'name (ours)', 'area (ours)', 'blob', 'bytes'], entries,
        source: 'The 127 pointers at $9F:FDE7, 4 bytes each; the size is the blob\'s walked length. Names and areas are our own descriptions.',
    };
}

function wramStates(): EnumList {
    return {
        id: 'wram-states', group: 'WRAM', title: 'WRAM state registers', columns: ['address', 'identifier', 'values', 'lifetime', 'purpose'],
        entries: [
            { cells: ['$7E:0377', 'WINDOW_0_STATE', '0=Closed, 1=Opening, 2=Open, 3=Closing', 'room', 'Primary dialogue window 0 lifecycle animation and active state'], vfs: bus(0x7e0377) },
            { cells: ['$7E:03A3', 'WINDOW_1_STATE', '0=Closed, 1=Opening, 2=Open, 3=Closing', 'room', 'Secondary dialogue window 1 lifecycle state'], vfs: bus(0x7e03a3) },
            { cells: ['$7E:0B2B', 'CHOICE_BOX_STATE', '0=Inactive, 1=Opening, 2=Active, 3=Confirmed', 'room', 'Branching dialogue choice box selection prompt state'], vfs: bus(0x7e0b2b) },
            { cells: ['$7E:0B7B', 'AUDIO_FADE_STATE', '0=Steady, 1=Fade In, 2=Fade Out', 'frame', 'Master music volume attenuation ramp state'], vfs: bus(0x7e0b7b) },
            { cells: ['$7E:0E4F', 'APU_SEQ_STATUS', '0=Idle, 1=Streaming, 2=Playing', 'frame', 'APU SPC700 music sequence transfer handshake status'], vfs: bus(0x7e0e4f) },
            { cells: ['$7E:22EA', 'ROOM_LOAD_STATE', '0=Active, 1=Teardown, 2=Decompressing, 3=Ready', 'room', 'Room transition decompression and readiness state'], vfs: bus(0x7e22ea) },
            { cells: ['$7E:235B', 'DOG_AI_COMMAND', '0=Follow, 1=Heel, 2=Sniff, 3=Attack', 'save', 'Dog companion behavioral command mode'], vfs: bus(0x7e235b) },
            { cells: ['$7E:2360', 'EQUIPPED_WEAPON_CLASS', '0=Sword, 2=Axe, 4=Spear, 6=Bazooka', 'save', 'Active weapon class selector'], vfs: bus(0x7e2360) },
            { cells: ['$7E:2363', 'DOG_FORM_INDEX', '0=Wolf, 1=Greyhound, 2=Poodle, 3=Toaster', 'save', 'Dog companion visual breed form and era'], vfs: bus(0x7e2363) },
            { cells: ['$7E:241F', 'CAMERA_SCROLL_MODE', '0=Follow Boy, 1=Follow Dog, 2=Fixed/Scripted', 'room', 'Camera viewport tracking target mode'], vfs: bus(0x7e241f) },
            { cells: ['$7E:3C6F', 'COMPANION_AI_STATE', '0=Idle, 1=Follow, 2=Sniff, 3=Evade, 4=Attack, 5=Return, 6=Stuck', 'room', 'Dog companion autonomous AI behavior state machine'], vfs: bus(0x7e3c6f) },
        ],
        source: 'WRAM discrete state machine variables and operational modes identified in the engine core, documented in docs/disassembly/engine-core/wram-enums.md and ram/ knowledge entries.',
    };
}

function directions(): EnumList {
    return {
        id: 'directions', group: 'WRAM', title: 'Facing directions (entity +$22)', columns: ['id', 'heading', 'degrees', 'vector (dx, dy)'],
        entries: [
            { cells: ['$00', 'North', '0°', '(0, -1)'], detail: [['offset', '+$22 in struct Entity']] },
            { cells: ['$02', 'Northeast', '45°', '(+1, -1)'], detail: [['offset', '+$22 in struct Entity']] },
            { cells: ['$04', 'East', '90°', '(+1, 0)'], detail: [['offset', '+$22 in struct Entity']] },
            { cells: ['$06', 'Southeast', '135°', '(+1, +1)'], detail: [['offset', '+$22 in struct Entity']] },
            { cells: ['$08', 'South', '180°', '(0, +1)'], detail: [['offset', '+$22 in struct Entity']] },
            { cells: ['$0A', 'Southwest', '225°', '(-1, +1)'], detail: [['offset', '+$22 in struct Entity']] },
            { cells: ['$0C', 'West', '270°', '(-1, 0)'], detail: [['offset', '+$22 in struct Entity']] },
            { cells: ['$0E', 'Northwest', '315°', '(-1, -1)'], detail: [['offset', '+$22 in struct Entity']] },
        ],
        source: 'The 8-way directional heading word at +$22 in every entity record ($7E:4EAB Boy, $7E:4F59 Dog), used for movement physics, sprite orientation, and projectile launch angles.',
    };
}

function collisionTypes(): EnumList {
    return {
        id: 'collision', group: 'Maps', title: 'Tile collision physics', columns: ['id', 'name', 'physics behavior'],
        entries: [
            { cells: ['$0', 'Passable', 'Standard traversable ground'] },
            { cells: ['$1', 'Impassable Wall', 'Solid barrier blocking all actor movement'] },
            { cells: ['$2', 'Deep Water', 'Impassable water body; blocks non-flying actors'] },
            { cells: ['$3', 'Pitfall', 'Drop hazard triggering fall damage and room respawn'] },
            { cells: ['$4', 'Conveyor North', 'Continuous physics translation pushing actor north'] },
            { cells: ['$5', 'Conveyor South', 'Continuous physics translation pushing actor south'] },
            { cells: ['$6', 'Slope Northwest', '45° diagonal barrier: solid top-left half'] },
            { cells: ['$7', 'Slope Northeast', '45° diagonal barrier: solid top-right half'] },
            { cells: ['$8', 'Slope Southwest', '45° diagonal barrier: solid bottom-left half'] },
            { cells: ['$9', 'Slope Southeast', '45° diagonal barrier: solid bottom-right half'] },
            { cells: ['$A', 'Shallow Water', 'Traversable wading liquid; halves actor movement speed'] },
            { cells: ['$B', 'Ledge Jump South', 'One-way elevation drop southward'] },
            { cells: ['$C', 'Ledge Jump North', 'One-way elevation drop northward'] },
            { cells: ['$D', 'Cuttable Grass', 'Interactive grass foliage cleared by melee attacks'] },
            { cells: ['$E', 'Breakable Barrier', 'Solid obstacle destructible via Axe or Bazooka'] },
            { cells: ['$F', 'Warp Doorway', 'Step-on room transition gateway'] },
        ],
        source: 'The 16 metatile collision physics types evaluated by func_90A420 (tile_collision_probe) and slope physics, documented in docs/disassembly/maps/tile-collision.md.',
    };
}

function statusEffects(): EnumList {
    return {
        id: 'status-effects', group: 'Combat', title: 'Status effect afflictions', columns: ['id', 'name', 'color flash', 'behavior & tick effect'],
        entries: [
            { cells: ['$00', 'Normal', 'None', 'Standard healthy condition; no penalties'] },
            { cells: ['$01', 'Poison', 'Green', 'Periodic health damage ticks every 60 frames (~1 sec)'] },
            { cells: ['$02', 'Confounded', 'Pink', 'Inverts player D-pad directional movement inputs'] },
            { cells: ['$03', 'Defense Down', 'Blue', 'Halves physical armor defense rating'] },
            { cells: ['$04', 'Attack Down', 'Orange', 'Halves physical weapon attack power'] },
            { cells: ['$05', 'Corrosion', 'Yellow', 'Rapid armor degradation and continuous acid tick damage'] },
            { cells: ['$06', 'Plague', 'Purple', 'Severe health drain and continuous stat debuff'] },
            { cells: ['$07', 'Barrier / Shield', 'White', 'Temporary invulnerability barrier absorbing hits'] },
        ],
        source: 'Combat status engine at $91:B632 and WRAM registers $7E:0A35 (Boy) and $7E:0A7F (Dog), documented in docs/disassembly/combat/status-effects.md.',
    };
}

function weaponClassesEnum(): EnumList {
    return {
        id: 'weapon-classes', group: 'Combat', title: 'Weapon classes & animations', columns: ['class id', 'name', 'weapon count', 'special mechanics'],
        entries: [
            { cells: ['$00', 'Swords', '3 weapons', 'Rapid slashing; short charge delay; Bone Crusher, Gladiator, Crusader'] },
            { cells: ['$02', 'Axes', '3 weapons', 'Heavy sweeping arc; clears vegetation and barriers; Spider Claw, Bronze Axe, Knight Basher'] },
            { cells: ['$04', 'Spears', '3 weapons', 'Long-range forward thrust; penetrates front lines; Horn Spear, Bronze Spear, Lance'] },
            { cells: ['$06', 'Bazooka', 'Consumes shells', 'Ranged heavy artillery; fires Thunder Ball, Particle Bomb, or Cryo-Blast'] },
        ],
        source: 'Equipped weapon class register $7E:2360 evaluated by ring menu equipment routines ($8E:9299) and combat attack animation routines.',
    };
}

function ringIconCategories(): EnumList {
    return {
        id: 'ring-icons', group: 'UI', title: 'Ring menu icon ranges ($CE:8000)', columns: ['id range', 'category', 'count', 'description'],
        entries: [
            { cells: ['$0000–$0026', 'UI labels & reticles', '20', 'Spinning orb, dog marker, numeric digits, STAT/ACT/EDIT/EQUIP/LEVEL labels'] },
            { cells: ['$0028–$0046', 'Weapons', '16', 'Swords, axes, spears, and bazookas across all tiers'] },
            { cells: ['$0048–$008C', 'Alchemy formulas (animated)', '35', 'Primary 35 alchemy formula icons with 2-frame active rotation'] },
            { cells: ['$008E–$009C', 'Consumables', '8', 'Petal, nectar, honey, biscuit, wings, essence, pixie dust, call bead'] },
            { cells: ['$009E', 'Container', '1', 'Pouch'] },
            { cells: ['$00A0–$00EE', 'Armour & gear', '40', 'Vests/chests (12), helms (12), gloves (12), collars (4)'] },
            { cells: ['$00F0–$00F6', 'Portraits', '4', 'Fire Eyes, Horace, Queen, Professor'] },
            { cells: ['$00F8–$0116', 'Alchemy formulas (secondary)', '16', 'Extended / auxiliary spell icons'] },
            { cells: ['$0118–$0142', 'Ingredients', '22', 'The 22 catalytic ingredients in alphabetical order (Ash … Wax, Acorn)'] },
        ],
        source: 'The 162-word table at $CE:8000 naming the 8-byte descriptors for ring menu item icons, decoded in maps/item-icons.ts and docs/item-icons.md.',
    };
}

function musicTracks(): EnumList {
    return {
        id: 'music', group: 'Audio', title: 'Music tracks (opcode $33)', columns: ['id', 'track name', 'spc rip'],
        entries: MUSIC.map((m) => ({ cells: [h(m.id, 2), m.name, m.spc || '—'] })),
        source: 'Master music sequence tracks triggered by script opcode $33 and $CC:8442, matching the reference EMU rips.',
    };
}

function soundEffects(): EnumList {
    return {
        id: 'sounds', group: 'Audio', title: 'Sound effects (opcodes $30..$32)', columns: ['id', 'sound effect name'],
        entries: SOUNDS.map((s) => ({ cells: [h(s.id, 2), s.name] })),
        source: 'The 54 master sound effects mapped to opcodes $30..$32 and the audio arbitration queue at $8C:82DC.',
    };
}

function scriptOpcodes(): EnumList {
    const ops = knowledgeEntries('opcodes');
    return {
        id: 'opcodes', group: 'Scripts', title: 'Script VM opcodes ($00..$FF)', columns: ['opcode', 'everscript command', 'description'],
        entries: ops.map((o) => ({
            cells: [h(o.addr, 2), ([] as string[]).concat(o.meta.everscript as string[] || []).join(', ') || '—', o.title],
            vfs: 'soe://rom/assets/scripts/opcodes/' + hex(o.addr, 2).toLowerCase() + '.md',
        })),
        source: 'The 256 script VM bytecode instructions executed by func_CCD7D1 ($8C:D7E1), documented in opcodes/ and soe://rom/assets/scripts/opcodes/.',
    };
}

/** Every list the view shows. `icons` are the formulas' ring-menu icons (PNG data URIs) in formula order. */
function enumsModel(rom: Uint8Array, chars: CharacterInfo[], icons: (string | null)[] = []): EnumList[] {
    return [characterBlobs(rom, chars), recordFields(), contactHandlers(rom, chars), aiSelectors(rom, chars),
        formulas(rom, icons), castIds(rom), ingredients(rom), rooms(rom),
        wramStates(), directions(), collisionTypes(),
        statusEffects(), weaponClassesEnum(), ringIconCategories(),
        musicTracks(), soundEffects(), scriptOpcodes()];
}

export { enumsModel };
export type { EnumList, Entry };
