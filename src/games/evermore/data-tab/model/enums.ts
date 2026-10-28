// Ownership: the Data tab's Enums view — id lists the game itself defines,
// read from the user's ROM or from a knowledge entry that says how it was
// found. Nothing comes from the compiler's .evs enums: those were partly
// guessed and carry hack-specific entries. Each list says where it is read
// (`source`), so every value can be checked. Pure apart from the ROM buffer
// and the character list the host hands in.

import * as maps from '../../maps';
import { CHARACTER_TABLE, CHARACTER_STRIDE } from '../../maps/character-record';
import { opcode } from '../../maps/animation-opcodes';
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

const AI_BEHAVIOURS_ADDR = 0x8fcbe0;
const AI_INFO: Record<number, { name: string; desc: string }> = {
    0x00: { name: 'CHASE', desc: 'Aggressive pursuit, combat reach alignment, retreat while recharging' },
    0x02: { name: 'NONE', desc: 'Passive entity; idle animation, moved solely by scripts' },
    0x04: { name: 'COMPANION_BOY', desc: 'Autonomous Boy following, breadcrumbs, AI menu settings' },
    0x06: { name: 'COMPANION_DOG', desc: 'Autonomous Dog following, sniffing, idle sitting' },
    0x08: { name: 'STATIONARY', desc: 'Stationary 4-cardinal combat turret with reach strike' },
    0x0a: { name: 'WANDER', desc: 'Friendly town NPC random walk and pause sequence' },
    0x0c: { name: 'CHASE_HOVERING', desc: 'Airborne hovering entity with sinusoidal bobbing' },
    0x0e: { name: 'STATIONARY_PLAYER', desc: 'Stationary boss turret tracking player in 8 directions' },
    0x10: { name: 'ROLL_OR_SHOOT', desc: 'Full-charge projectile launch or curl-and-roll rush' },
    0x12: { name: 'CHASE_OR_ROLL', desc: 'Pursuit with 50% probability of rolling charge attack' },
    0x14: { name: 'BOUNCE', desc: 'Continuous walking with obstacle bounce, never attacks' },
    0x16: { name: 'DRIFT_EAST', desc: 'Directional eastern drift with northward/southward bias' },
    0x18: { name: 'PURSUE_PLAYER', desc: 'Continuous pursuit when charged, retreat when uncharged' },
    0x1a: { name: 'ROLL', desc: 'Full-charge rolling assault attack' },
    0x1c: { name: 'STATIONARY_DIAGONAL', desc: 'Diagonal-facing stationary entity with strike' },
};

function aiSelectors(rom: Uint8Array, chars: CharacterInfo[]): EnumList {
    const users = usedBy(rom, chars, FIELD_AI);
    return {
        id: 'ai', group: 'Characters', title: 'AI selector (record +$03)', columns: ['value', 'routine', 'name', 'records', 'used by'],
        entries: [...users.keys()].sort((a, b) => a - b).map((v) => {
            const ptr = word(rom, AI_BEHAVIOURS_ADDR + v);
            const info = AI_INFO[v];
            const u = users.get(v)!;
            return {
                cells: [h(v), '$8F:' + hex(ptr, 4), info?.name || 'UNKNOWN', String(u.length), u.slice(0, 3).join(', ') + (u.length > 3 ? ' …' : '')],
                detail: [['description', info?.desc || ''], ['records', u.join(', ')]],
                vfs: bus(0x8f0000 | ptr),
            };
        }),
        source: 'The values the 142 records hold at +$03, which $8F:CD17 reads to dispatch through jump table $8F:CBE0 (JMP ($CBE0,x), rom/8fcbe0.md). All 15 routines decoded.',
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

const CALL_BEAD_POWERS_ADDR = 0xc45f17;
const CALL_BEAD_SPELLS_DATA: { id: number; name: string; type: string; desc: string }[] = [
    { id: 0x00, name: 'Life Spark', type: 'Recovery', desc: 'Restores party HP and revives fallen companion' },
    { id: 0x02, name: 'Heat Wave', type: 'Fire Elemental', desc: 'Rains incendiary fire across all active enemy targets' },
    { id: 0x04, name: 'Storm', type: 'Wind / Lightning', desc: 'Electric storm shockwave sweeping all combatants' },
    { id: 0x06, name: 'Flare', type: 'Fire Burst', desc: 'High-potency focused solar thermal blast' },
    { id: 0x08, name: 'Time Warp', type: 'Temporal', desc: 'Temporal stasis: halts all enemy movement and attack timers' },
    { id: 0x0A, name: 'First Aid', type: 'Emergency Recovery', desc: 'Instantly restores critical hit points to player' },
    { id: 0x0C, name: 'Confound', type: 'Status Debuff', desc: 'Scrambles enemy navigational and targeting vectors' },
    { id: 0x0E, name: 'Regenerate', type: 'Buff', desc: 'Applies continuous periodic HP regeneration ticks' },
    { id: 0x10, name: 'Aura', type: 'Invulnerability', desc: 'Forms an impenetrable barrier absorbing all damage' },
    { id: 0x12, name: 'Shock Wave', type: 'Concussive Impact', desc: 'High-amplitude ground shockwave knocking enemies back' },
    { id: 0x14, name: 'Shield', type: 'Defensive Buff', desc: 'Doubles physical armor rating against melee strikes' },
    { id: 0x16, name: 'Plague', type: 'Status Affliction', desc: 'Infects enemy entities with virulent ongoing plague' },
    { id: 0x18, name: 'Hypnotize', type: 'Mind Control', desc: 'Induces deep sleep and suppression of hostility' },
    { id: 0x1A, name: 'Disrupt', type: 'Dispel / Arcane', desc: 'Neutralizes hostile magical barriers and dispels buffs' },
    { id: 0x1C, name: 'Restore', type: 'Complete Restoration', desc: 'Maximum restoration: resurrects companion and fills HP' },
    { id: 0x1E, name: 'Electra Bolt', type: 'Lightning Strike', desc: 'Devastating high-voltage electric discharge from above' },
];

function callBeadSpells(rom: Uint8Array): EnumList {
    const entries: Entry[] = CALL_BEAD_SPELLS_DATA.map((spell, i) => {
        const at = maps.snesToRom(CALL_BEAD_POWERS_ADDR + i * 2);
        const power = maps.read16(rom, at);
        return {
            cells: [h(spell.id, 2), spell.name, String(power), spell.type, spell.desc],
            vfs: bus(CALL_BEAD_POWERS_ADDR),
        };
    });
    return {
        id: 'call-beads-enum', group: 'Alchemy', title: 'Call Bead invocations',
        columns: ['id', 'spell invocation', 'base power', 'element / type', 'effect description'],
        entries,
        source: 'ROM $C4:5F17 (16 words power table) and script invocations ($00..$1E): summoned via Call Bead catalyst items.',
    };
}

const FORMULA_TARGETING_ADDR = 0xc45bf5;
const TARGETING_MODES_DATA: { mask: number; name: string; category: string; formulas: string }[] = [
    { mask: 0x0008, name: 'TARGET_PARTY_MEMBER', category: 'Ally / Self', formulas: 'Barrier, Defend, Force Field, Heal, Miracle Cure, Reflect, Regrowth, Speed' },
    { mask: 0x0800, name: 'TARGET_BOY_ONLY', category: 'Boy Only', formulas: 'Atlas, Call Up, One Up' },
    { mask: 0x0802, name: 'TARGET_PARTY_BOTH', category: 'Party Both', formulas: 'Escape, Super Heal' },
    { mask: 0x0a00, name: 'TARGET_PARTY_ITEM', category: 'Consumable Item', formulas: 'Petal, Nectar, Honey, Essence, Pixie Dust' },
    { mask: 0x2010, name: 'TARGET_ENEMY_ALL', category: 'Hostile / Area', formulas: 'Acid Rain, Crush, Double Drain, Drain, Explosion, Fireball, Fire Power, Flash, Hard Ball, Lance, Lightning Storm, Nitro, Slow Burn, Sting, Stop' },
    { mask: 0x0014, name: 'TARGET_DOG_DEAD', category: 'Fallen Companion', formulas: 'Revive' },
    { mask: 0x0214, name: 'TARGET_DOG_BISCUIT', category: 'Companion Treat', formulas: 'Dog Biscuit' },
    { mask: 0x2200, name: 'TARGET_ENVIRONMENT', category: 'Puzzle / World', formulas: 'Levitate' },
    { mask: 0x0240, name: 'TARGET_REVEALER', category: 'Hidden Passages', formulas: 'Revealer' },
    { mask: 0x6600, name: 'TARGET_MENU', category: 'Menu Trigger', formulas: 'Call Beads, Pouch' },
    { mask: 0x2018, name: 'TARGET_PARTY_ENEMY', category: 'Universal', formulas: 'Global area burst' },
];

function targetingModes(): EnumList {
    const entries: Entry[] = TARGETING_MODES_DATA.map((tm) => ({
        cells: [h(tm.mask, 4), tm.name, tm.category, tm.formulas],
        vfs: bus(FORMULA_TARGETING_ADDR),
    }));
    return {
        id: 'targeting-modes', group: 'Alchemy', title: 'Targeting cursor modes',
        columns: ['bitmask', 'mode name', 'target category', 'typical formulas'],
        entries,
        source: 'Table $C4:5BF5 (35 formula cursor words): reticle locking rules for party, companion, and enemy entities.',
    };
}

const ARMOR_RECORDS_ADDR = 0xc43b02;
const ARMOR_RECORDS_NUM = 40;
const ARMOR_STRIDE_BYTES = 10;

function armorEnums(rom: Uint8Array): EnumList {
    const entries: Entry[] = [];
    const ERAS = ['Prehistoric', 'Antiquity', 'Medieval', 'Omnitopia'];
    for (let i = 0; i < ARMOR_RECORDS_NUM; i++) {
        const at = maps.snesToRom(ARMOR_RECORDS_ADDR + i * ARMOR_STRIDE_BYTES);
        const pdef = maps.read16(rom, at);
        const mdef = maps.read16(rom, at + 2);
        const namePtr = 0xc40000 | maps.read16(rom, at + 4);
        const name = text(rom, namePtr);
        const icon = maps.read16(rom, at + 8);
        const slot = i < 12 ? 'Chest' : i < 24 ? 'Helmet' : i < 36 ? 'Glove' : 'Collar';
        const eraIdx = i < 36 ? Math.floor((i % 12) / 3) : (i - 36);
        const era = ERAS[eraIdx] || 'Special';
        entries.push({
            cells: [h(i, 2), name, slot, era, String(pdef), String(mdef), h(icon, 4)],
            vfs: bus(ARMOR_RECORDS_ADDR),
        });
    }
    return {
        id: 'armor-items', group: 'Equipment', title: 'Equippable armor catalog',
        columns: ['id', 'gear name', 'slot', 'era', 'p. def', 'm. def', 'ring icon'],
        entries,
        source: 'ROM $C4:3B02 (40 records × 10 bytes) read by calc_equipped_armor_defense ($8E:99D2) and ring menu status compositor.',
    };
}

const CURRENCIES_DATA = [
    { code: 0x00, name: 'Talons', era: 'Prehistoric', addr: 0x7e2309 },
    { code: 0x03, name: 'Jewels', era: 'Antiquity', addr: 0x7e230c },
    { code: 0x06, name: 'Gold Coins', era: 'Medieval', addr: 0x7e230f },
    { code: 0x09, name: 'Credits', era: 'Omnitopia', addr: 0x7e2312 },
];

function currenciesEnum(): EnumList {
    const entries: Entry[] = CURRENCIES_DATA.map((c) => ({
        cells: [h(c.code, 2), c.name, c.era, h(c.addr, 6), 'Opcode 0x7E ($8C:D5AA)'],
        vfs: bus(c.addr),
    }));
    return {
        id: 'currencies', group: 'Economy', title: 'Era currencies',
        columns: ['code', 'currency', 'era', 'wram address', 'conversion handler'],
        entries,
        source: 'WRAM $7E:2309..$7E:2314 (3 bytes per currency) and script opcode 0x7E currency converter ($8C:D5AA).',
    };
}

const CONSUMABLES_ADDR = 0xc45aa0;
const CONSUMABLES_ICONS_ADDR = 0xc45aae;
const CONSUMABLES_DATA: { name: string; hp: number; effect: string }[] = [
    { name: 'Petal', hp: 40, effect: 'Heals target party member' },
    { name: 'Nectar', hp: 120, effect: 'Heals target party member' },
    { name: 'Honey', hp: 300, effect: 'Heals target party member' },
    { name: 'Dog Biscuit', hp: 100, effect: 'Heals companion Dog HP' },
    { name: 'Wings', hp: 0, effect: 'Dungeon warp return to start' },
    { name: 'Herbal Essence', hp: 0, effect: 'Full status condition cure' },
    { name: 'Pixie Dust', hp: 0, effect: 'Resurrects fallen companion' },
    { name: 'Call Beads', hp: 0, effect: 'Alchemy summon invocation catalyst' },
];

function consumableItemsEnum(rom: Uint8Array): EnumList {
    const entries: Entry[] = CONSUMABLES_DATA.map((item, i) => {
        const hp = i < 7 ? maps.read16(rom, maps.snesToRom(CONSUMABLES_ADDR + i * 2)) : 0;
        const icon = maps.read16(rom, maps.snesToRom(CONSUMABLES_ICONS_ADDR + i * 2));
        return {
            cells: [h(i, 2), item.name, hp > 0 ? String(hp) : 'Special', h(icon, 4), item.effect],
            vfs: bus(CONSUMABLES_ADDR),
        };
    });
    return {
        id: 'consumables-enum', group: 'Items', title: 'Consumable inventory items',
        columns: ['id', 'item name', 'heal HP', 'ring icon', 'effect scope'],
        entries,
        source: 'ROM $C4:5AA0 (8 consumable recovery descriptors + 8 ring icon indices $008E..$009C).',
    };
}

const STAMINA_TIERS_DATA = [
    { tier: 0, range: '< $0200', pct: '< 50%', scale: '0.25x (÷4)', desc: 'Exhausted jab / chip damage' },
    { tier: 1, range: '$0200..$03FF', pct: '50%..99%', scale: '0.50x (÷2)', desc: 'Weak uncharged melee strike' },
    { tier: 2, range: '$0400..$07FF', pct: '100%..199%', scale: '1.00x (1x)', desc: 'Level 1 standard weapon attack' },
    { tier: 3, range: '$0800..$0BFF', pct: '200%..299%', scale: '2.00x (2x)', desc: 'Level 2 charged weapon special' },
    { tier: 4, range: '>= $0C00', pct: '300%', scale: '4.00x (4x)', desc: 'Level 3 maximum charge finisher' },
];

function staminaTiersEnum(): EnumList {
    return {
        id: 'stamina-tiers', group: 'Combat', title: 'Weapon stamina charge tiers',
        columns: ['tier', 'stamina threshold', 'gauge %', 'damage scale', 'attack description'],
        entries: STAMINA_TIERS_DATA.map((t) => ({
            cells: [String(t.tier), t.range, t.pct, t.scale, t.desc],
            vfs: bus(0x8fc02b),
        })),
        source: 'Combat stamina recharge routine $8F:CC5D and damage scaling routine $8F:C02B.',
    };
}

const CHARMS_DATA = [
    { id: 0x0100, name: 'Armor Polish', effect: 'Passively enhances physical armor defense', ram: '$7E:2262 bit 7', routine: 'Defense calculation' },
    { id: 0x0101, name: 'Chocobo Egg', effect: 'Increases maximum health point capacity curve', ram: '$7E:2261 bit 6', routine: 'HP curve swap' },
    { id: 0x0102, name: 'Insect Incense', effect: 'Deflects and blocks melee hits from insect enemies', ram: '$7E:2261 bit 7', routine: 'Contact handler $0E' },
    { id: 0x0103, name: 'Jade Disk', effect: 'Increases physical evasion against attacks', ram: '$7E:2261', routine: 'Companion stats' },
    { id: 0x0104, name: 'Jaguar Ring', effect: 'Unlocks continuous sprint / running capability', ram: '$7E:2261', routine: 'Player movement' },
    { id: 0x0105, name: 'Magic Gourd', effect: 'Increases alchemical formula damage output', ram: '$7E:2261', routine: 'Spell damage math' },
    { id: 0x0106, name: 'Moxa Stick', effect: 'Boosts HP restored by healing formula spells (+25%)', ram: '$7E:2262 bit 3', routine: 'Spell healing math' },
    { id: 0x0107, name: 'Oracle Bone', effect: 'Enhances discovery and formula acquisition', ram: '$7E:2261', routine: 'Formula discovery' },
    { id: 0x0108, name: 'Ruby Heart', effect: 'Reduces physical damage received from enemies', ram: '$7E:2261', routine: 'Damage reaction' },
    { id: 0x0109, name: 'Silver Sheath', effect: 'Increases melee strike power for swords (+25%)', ram: '$7E:2261 bit 5', routine: 'Sword attack boost' },
    { id: 0x010A, name: 'Staff of Life', effect: 'Increases companion Dog defense and protection', ram: '$7E:2261', routine: 'Companion defense' },
    { id: 0x010B, name: 'Sun Stone', effect: 'Protects party against heat, fire, and magma damage', ram: '$7E:2261 bit 2', routine: 'Environmental damage' },
    { id: 0x010C, name: 'Thug\'s Cloak', effect: 'Increases dodge rate and reduces enemy to-hit roll', ram: '$7E:2261', routine: 'Evasion calculation' },
    { id: 0x010D, name: 'Wizard\'s Coin', effect: 'Increases party magic defense by 5%', ram: '$7E:2263 bit 2', routine: 'Magic defense boost' },
];

function charmsEnum(): EnumList {
    return {
        id: 'charms-enum', group: 'Items', title: 'Rare charms & passive relics',
        columns: ['item id', 'charm name', 'passive effect', 'wram bitfield', 'evaluating routine'],
        entries: CHARMS_DATA.map((c) => ({
            cells: [h(c.id, 4), c.name, c.effect, c.ram, c.routine],
            vfs: bus(0x7e2261),
        })),
        source: 'Key inventory items $0100..$010D tracked across SRAM bitfields $7E:2261..$7E:2264 and evaluated during combat calculations.',
    };
}

const BAZOOKA_AMMO_DATA = [
    { code: 0x00, name: 'Thunder Ball', counter: '$7E:2345', descriptor: '$C4:3A96', palette: '$0086', effect: 'Standard explosive artillery shell' },
    { code: 0x02, name: 'Particle Bomb', counter: '$7E:2346', descriptor: '$C4:3ABA', palette: '$00CB', effect: 'Heavy thermal shock wave blast' },
    { code: 0x04, name: 'Cryo-Blast', counter: '$7E:2347', descriptor: '$C4:3ADE', palette: '$1E02', effect: 'Piercing cryogenic freezing blast' },
];

function bazookaAmmoEnum(): EnumList {
    return {
        id: 'bazooka-ammo-enum', group: 'Combat', title: 'Bazooka ammunition types',
        columns: ['ammo code', 'ammunition name', 'inventory counter', 'weapon descriptor', 'sprite palette', 'combat effect'],
        entries: BAZOOKA_AMMO_DATA.map((a) => ({
            cells: [h(a.code, 2), a.name, a.counter, a.descriptor, a.palette, a.effect],
            vfs: bus(0x7e2345),
        })),
        source: 'Equipped ammo selector $7E:2349, inventory counters $7E:2345..$7E:2347, and weapon descriptors at $C4:388E.',
    };
}

const COMPANION_AI_DATA = [
    { type: 'Command', code: 0, name: 'Follow', scope: '$7E:235B', desc: 'Default companion movement following Boy path' },
    { type: 'Command', code: 1, name: 'Heel', scope: '$7E:235B', desc: 'Hold current position and refrain from movement' },
    { type: 'Command', code: 2, name: 'Sniff', scope: '$7E:235B', desc: 'Forage and search perimeter for hidden alchemy ingredients' },
    { type: 'Command', code: 3, name: 'Attack', scope: '$7E:235B', desc: 'Engage nearest hostile enemy in aggressive combat' },
    { type: 'State', code: 0, name: 'Idle', scope: '$7E:3C6F', desc: 'No active command; stationary breath animation' },
    { type: 'State', code: 1, name: 'Follow', scope: '$7E:3C6F', desc: 'Breadcrumb tracking towards player position' },
    { type: 'State', code: 2, name: 'Sniffing', scope: '$7E:3C6F', desc: 'Active nose-to-ground foraging path' },
    { type: 'State', code: 3, name: 'Evading', scope: '$7E:3C6F', desc: 'Evasion routing away from incoming damage or obstacle' },
    { type: 'State', code: 4, name: 'Attacking', scope: '$7E:3C6F', desc: 'Melee charge and jaw snap combat sequence' },
    { type: 'State', code: 5, name: 'Returning', scope: '$7E:3C6F', desc: 'Returning to leash perimeter after combat' },
    { type: 'State', code: 6, name: 'Stuck', scope: '$7E:3C6F', desc: 'Obstacle collision recovery and teleport staging' },
    { type: 'Breed', code: 0, name: 'Wolfhound', scope: '$7E:2363', desc: 'Prehistoric era companion breed form' },
    { type: 'Breed', code: 1, name: 'Greyhound', scope: '$7E:2363', desc: 'Antiquity era companion breed form' },
    { type: 'Breed', code: 2, name: 'Poodle', scope: '$7E:2363', desc: 'Medieval era companion breed form' },
    { type: 'Breed', code: 3, name: 'Toaster', scope: '$7E:2363', desc: 'Omnitopia era robotic companion form' },
];

function companionAiEnum(): EnumList {
    return {
        id: 'companion-ai-states', group: 'Entities', title: 'Companion Dog AI commands & state machine',
        columns: ['category', 'code', 'identifier', 'wram variable', 'operational description'],
        entries: COMPANION_AI_DATA.map((d) => ({
            cells: [d.type, h(d.code, 2), d.name, d.scope, d.desc],
            vfs: bus(0x7e235b),
        })),
        source: 'Dog AI command parser $7E:235B, companion state machine $7E:3C6F, and era breed selector $7E:2363.',
    };
}

const PROJECTILE_ROUTINES_TABLE_ADDR = 0x90d967;
const PROJECTILE_ROUTINES_INFO = [
    { offset: 0x00, name: 'Custom Trajectory', desc: 'Script-directed custom movement path' },
    { offset: 0x02, name: 'Target Homing', desc: 'Real-time coordinate tracking towards target entity' },
    { offset: 0x04, name: 'Straight (Scaled)', desc: 'Linear velocity along facing scaled by thrower attack' },
    { offset: 0x06, name: 'Ballistic Arc', desc: 'Parabolic arc trajectory with gravity' },
    { offset: 0x08, name: 'Straight (Unscaled)', desc: 'Constant linear flight along thrower facing' },
    { offset: 0x0A, name: 'Elliptical Orbit', desc: 'Rotational flight round thrower center ($90:DF44)' },
    { offset: 0x0C, name: 'Scatter Spread', desc: 'Multi-directional radial projectile scatter' },
    { offset: 0x10, name: 'Orbital Math Table', desc: 'Trigonometric sine/cosine orbit coordinates' },
    { offset: 0x16, name: 'Direct Trajectory', desc: 'Direct fast ballistic trajectory' },
    { offset: 0x18, name: 'High-Speed Homing', desc: 'Accelerated homing intercept curve' },
];

function projectileRoutinesEnum(rom: Uint8Array): EnumList {
    const entries: Entry[] = PROJECTILE_ROUTINES_INFO.map((r) => {
        const ptr = word(rom, PROJECTILE_ROUTINES_TABLE_ADDR + r.offset);
        const fullAddr = 0x900000 | ptr;
        return {
            cells: ['+$' + hex(r.offset, 2), r.name, '$90:' + hex(ptr, 4), r.desc],
            vfs: bus(fullAddr),
        };
    });
    return {
        id: 'projectile-routines-enum', group: 'Combat', title: 'Projectile movement routines',
        columns: ['table offset', 'routine name', 'handler address', 'trajectory description'],
        entries,
        source: 'Table $90:D967 (Bank $90 jump table): dispatched by $90:DE5E via JSR ($D967,x) using archetype record +$08.',
    };
}

const PROJECTILE_BEHAVIORS_DATA = [
    { code: 0x0E, name: 'Parabolic Drop', category: 'Falling', desc: 'Z-velocity decrements by gravity each tick until floor contact' },
    { code: 0x12, name: 'Fixed Altitude Timed', category: 'Timed', desc: 'Maintains fixed Z-height while lifetime timer decrements' },
    { code: 0x1A, name: 'Thrower Plane Timed', category: 'Plane-Bound', desc: 'Fixed altitude locked to thrower character depth plane' },
    { code: 0x1E, name: 'Elliptical Orbit', category: 'Rotational', desc: 'Angular step advancement in ellipse coordinate table ($90:DF44)' },
];

function projectileBehaviorsEnum(): EnumList {
    return {
        id: 'projectile-behaviors', group: 'Combat', title: 'Projectile lifecycle behavior modes',
        columns: ['type code', 'behavior name', 'trajectory category', 'operational description'],
        entries: PROJECTILE_BEHAVIORS_DATA.map((b) => ({
            cells: ['$' + hex(b.code, 2), b.name, b.category, b.desc],
            vfs: bus(0x90d9a6),
        })),
        source: 'Field +0x0C of projectile master records ($90:D9A6), copied into entity +0x26 to dictate ballistic flight physics.',
    };
}

const FORMULA_LEARNED_ADDR = 0xc45c3b;
const FORMULA_LEARNED_MASK = 0xc45c81;

function formulaLearnedEnum(rom: Uint8Array): EnumList {
    const entries: Entry[] = [];
    for (let i = 0; i < FORMULA_COUNT; i++) {
        const wramAddr = word(rom, FORMULA_LEARNED_ADDR + i * 2);
        const mask = word(rom, FORMULA_LEARNED_MASK + i * 2);
        const name = textAt(rom, FORMULA_NAMES, i);
        const bitIdx = Math.round(Math.log2(mask));
        entries.push({
            cells: [h(i, 2), name, '$7E:' + hex(wramAddr, 4), '$' + hex(mask, 2), 'Bit ' + bitIdx],
            vfs: bus(0x7e0000 | wramAddr),
        });
    }
    return {
        id: 'formula-learned-flags', group: 'Alchemy', title: 'Formula unlocked save flags',
        columns: ['id', 'formula', 'wram byte', 'bitmask', 'bit index'],
        entries,
        source: 'ROM tables $C4:5C3B & $C4:5C81: maps each formula to its persistent SRAM bitfield in $7E:2258..$7E:225C.',
    };
}

const ANIMATION_VM_ADDR = 0x908000;
const ANIMATION_VM_COUNT = 103;

function animOpcodesEnum(rom: Uint8Array): EnumList {
    const entries: Entry[] = [];
    for (let i = 0; i < ANIMATION_VM_COUNT; i++) {
        const ptr = word(rom, ANIMATION_VM_ADDR + i * 2);
        const op = opcode(i);
        const isUnused = ptr === 0x836c;
        const mnem = op?.mnemonic || (isUnused ? '(unused)' : 'unknown');
        const kind = op?.kind || (isUnused ? 'nop' : 'plain');
        const len = op?.length || 1;
        entries.push({
            cells: [h(i, 2), '$90:' + hex(ptr, 4), mnem, kind, len + ' B'],
            vfs: bus(0x900000 | ptr),
        });
    }
    return {
        id: 'anim-opcodes', group: 'Animation', title: 'Animation VM opcodes',
        columns: ['opcode', 'routine vector', 'mnemonic', 'kind', 'width'],
        entries,
        source: 'Jump table $90:8000 (103 words, 206 bytes): vector dispatch table for animation bytecode VM interpreter $90:80CE (knowledge rom/908000.md).',
    };
}

const FORMULA_POWER_ADDR = 0xc45e6b;

function formulaPowersEnum(rom: Uint8Array, icons: (string | null)[]): EnumList {
    const entries: Entry[] = [];
    for (let i = 0; i < FORMULA_COUNT; i++) {
        const power = word(rom, FORMULA_POWER_ADDR + i * 2);
        const name = textAt(rom, FORMULA_NAMES, i);
        const mode = power === 0 ? 'Utility / Puzzle' : (power <= 25 ? 'Low Offensive / Defensive' : (power <= 62 ? 'Medium Offensive' : 'High Artillery'));
        entries.push({
            cells: [h(i, 2), name, String(power), mode],
            icon: icons[i] || undefined,
            vfs: bus(FORMULA_POWER_ADDR + i * 2),
        });
    }
    return {
        id: 'formula-powers-enum', group: 'Alchemy', title: 'Formula base power & recovery',
        columns: ['id', 'formula', 'base power', 'scaling mode'],
        entries,
        source: 'ROM table $C4:5E6B (35 words, 70 bytes): Base spell damage or healing power word for each formula, scaled by formula level multiplier ($C4:5BA5) during damage calculation $8F:C067.',
    };
}

function cameraScrollModesEnum(): EnumList {
    return {
        id: 'camera-scroll-modes', group: 'Camera', title: 'Camera viewport tracking modes ($7E:241F)',
        columns: ['mode', 'hex', 'target focus', 'description'],
        entries: [
            { cells: ['0', '$0000', 'Boy Entity', 'Smooth tracking centered on the Boy with 16px deadzone'] },
            { cells: ['1', '$0001', 'Dog Entity', 'Smooth tracking centered on the companion Dog'] },
            { cells: ['2', '$0002', 'Fixed Arena / Scripted', 'Fixed coordinate lock for boss fights and cinematic cutscenes'] },
        ],
        source: 'WRAM $7E:241F (CameraScrollMode): Viewport camera tracking routine.',
    };
}

function windowStatesEnum(): EnumList {
    return {
        id: 'window-states', group: 'Dialogue', title: 'Dialogue window lifecycle states ($7E:0377)',
        columns: ['state', 'hex', 'phase', 'description'],
        entries: [
            { cells: ['0', '$0000', 'Closed', 'Window closed and inactive; tilemap buffers clear'] },
            { cells: ['1', '$0001', 'Opening', 'Expanding border frame animation in progress'] },
            { cells: ['2', '$0002', 'Open', 'Fully open; active typewriter text blitting or joypad choice prompt'] },
            { cells: ['3', '$0003', 'Closing', 'Collapsing border frame animation in progress'] },
        ],
        source: 'WRAM $7E:0377 / $7E:03A3 (WindowState): Managed by window compositor func_CCAC8A and opcodes $2E, $44..$47.',
    };
}

function audioFadeStatesEnum(): EnumList {
    return {
        id: 'audio-fade-states', group: 'Audio', title: 'Master volume fade states ($7E:0B7B)',
        columns: ['state', 'hex', 'mode', 'description'],
        entries: [
            { cells: ['0', '$0000', 'Steady', 'Master audio volume steady at target level'] },
            { cells: ['1', '$0001', 'Fade In', 'Volume ramping up smoothly toward target $7E:0B83'] },
            { cells: ['2', '$0002', 'Fade Out', 'Volume ramping down toward silence prior to room transition'] },
        ],
        source: 'WRAM $7E:0B7B (AudioFadeState): Evaluated every frame by audio service and volume fader.',
    };
}

function roomLoadStatesEnum(): EnumList {
    return {
        id: 'room-load-states', group: 'Rooms', title: 'Room transition readiness states ($7E:22EA)',
        columns: ['state', 'hex', 'phase', 'description'],
        entries: [
            { cells: ['0', '$0000', 'Active Gameplay', 'Standard gameplay frame loop with physics and AI active'] },
            { cells: ['1', '$0001', 'Teardown', 'Screen fade-out complete; purging previous room tilemaps and entities'] },
            { cells: ['2', '$0002', 'Decompressing', 'LZSS streaming tilemap, metatile collision, and enter script blocks'] },
            { cells: ['3', '$0003', 'Ready', 'Room assets staged; scheduling enter script and initiating fade-in'] },
        ],
        source: 'WRAM $7E:22EA (RoomLoadState): Governs room transition pipeline in func_8EE4E2 (enter_room).',
    };
}

function choiceBoxStatesEnum(): EnumList {
    return {
        id: 'choice-box-states', group: 'Dialogue', title: 'Dialogue choice prompt states ($7E:0B2B)',
        columns: ['state', 'hex', 'phase', 'description'],
        entries: [
            { cells: ['0', '$0000', 'Inactive', 'No active choice prompt dialog; player input uninhibited'] },
            { cells: ['1', '$0001', 'Opening', 'Choice border frame and background tile composing'] },
            { cells: ['2', '$0002', 'Active Selection', 'Joypad polling active; cursor navigation over dialogue options'] },
            { cells: ['3', '$0003', 'Confirmed', 'Player selection committed; closing frame and executing branch'] },
        ],
        source: 'WRAM $7E:0B2B (ChoiceBoxState): Governs dialogue yes/no and choice prompt branching in func_CCB4E2.',
    };
}

function apuSeqStatusEnum(): EnumList {
    return {
        id: 'apu-seq-status', group: 'Audio', title: 'APU sequence transfer states ($7E:0E4F)',
        columns: ['status', 'hex', 'phase', 'description'],
        entries: [
            { cells: ['0', '$0000', 'Idle', 'Communication ports idle; ready to accept new command packets'] },
            { cells: ['1', '$0001', 'Streaming', 'Data block streaming underway via hardware IO ports $2140..$2143'] },
            { cells: ['2', '$0002', 'Playing', 'Sound sequence executing on SPC700 audio processor'] },
        ],
        source: 'WRAM $7E:0E4F (ApuSeqStatus): Governs music sequence streaming and APU port coordination.',
    };
}

/** Every list the view shows. `icons` are the formulas' ring-menu icons (PNG data URIs) in formula order. */
function enumsModel(rom: Uint8Array, chars: CharacterInfo[], icons: (string | null)[] = []): EnumList[] {
    return [characterBlobs(rom, chars), recordFields(), contactHandlers(rom, chars), aiSelectors(rom, chars),
        formulas(rom, icons), castIds(rom), ingredients(rom), rooms(rom),
        wramStates(), directions(), collisionTypes(),
        statusEffects(), weaponClassesEnum(), ringIconCategories(),
        musicTracks(), soundEffects(), scriptOpcodes(),
        callBeadSpells(rom), targetingModes(),
        armorEnums(rom), currenciesEnum(),
        consumableItemsEnum(rom), staminaTiersEnum(),
        charmsEnum(), bazookaAmmoEnum(),
        companionAiEnum(), projectileRoutinesEnum(rom),
        projectileBehaviorsEnum(), formulaLearnedEnum(rom),
        animOpcodesEnum(rom), formulaPowersEnum(rom, icons),
        cameraScrollModesEnum(), windowStatesEnum(),
        audioFadeStatesEnum(), roomLoadStatesEnum(),
        choiceBoxStatesEnum(), apuSeqStatusEnum()];
}

export { enumsModel };
export type { EnumList, Entry };
