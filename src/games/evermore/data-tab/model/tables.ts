// Ownership: the Data tab's Tables view — ROM tables read from the user's ROM:
// the decoded ones (XP per level, the sine table, the boomerang's orbit) with
// a chart, and the character records' stats. Only tables decoded into
// readable values are listed; the rest stay in soe://rom/tables/. Pure apart
// from the ROM buffer it is handed. Each address here has its knowledge entry
// (localizations/knowledge/rom/), which says how it was found.

import { snesToRom, read16, read24 } from '../../maps';
import { CHARACTER_TABLE, CHARACTER_STRIDE } from '../../maps/character-record';
import { hex } from '../../../../platform';

type Cell = string | number;
interface Series { name: string; points: [number, number][] }
interface Table {
    id: string; group: string; title: string; addr: string; note: string;
    columns: string[]; rows: Cell[][];
    /** Drawn on the right: one y-axis, x = the first column unless `xy` (a path). */
    chart?: { series: Series[]; x: string; y: string; xy?: boolean };
    vfs?: string;
}

/** Boy and dog XP needed for the next level, 3 bytes per level, read by the level at `$0A50` / `$0A9A` (knowledge rom/8c8bd0.md). */
const XP_BOY = 0x8c8bd0;
const XP_DOG = 0x8c8cfc;
const XP_BOY_COUNT = 100;   // ends with $FFFFFF: no level after 99
const XP_DOG_COUNT = 99;    // the next bytes are another table
/** 256 steps per turn, -255..+256; 320 words so cosine (+64 entries, `$808923`) never wraps. */
const SINE = 0x8088a3;
const SINE_WORDS = 320;
const COSINE = 0x808923;
/** The boomerang orbit (`$90DF44`): x = cos · 8, y = sin · 4 in 1/16 px (maps/projectiles.ts). */
const ORBIT_STEPS = 256;
const CHARACTER_COUNT = 142;

const s16 = (v: number): number => (v >= 0x8000 ? v - 0x10000 : v);
const word = (rom: Uint8Array, snes: number): number => s16(read16(rom, snesToRom(snes)));
/** The address in the soe:// file system: `bus/` links to the ROM or WRAM file. */
const vfs = (snes: number): string => 'soe://bus/' + hex(snes, 6).toLowerCase();

function xpTable(rom: Uint8Array): Table {
    const boy: number[] = [], dog: number[] = [];
    for (let i = 0; i < XP_BOY_COUNT; i++) boy.push(read24(rom, snesToRom(XP_BOY) + i * 3));
    for (let i = 0; i < XP_DOG_COUNT; i++) dog.push(read24(rom, snesToRom(XP_DOG) + i * 3));
    const last = (v: number) => v < 0xffffff;
    return {
        id: 'xp', group: 'Progression', title: 'XP per level · Boy and dog', addr: '$8C:8BD0 · $8C:8CFC',
        note: 'Total XP the next level needs, by the level byte ($0A50 Boy, $0A9A dog). The game copies the entry to $4F1D / $4FCB when the level changes. The Boy\'s table ends with $FFFFFF.',
        columns: ['level', 'Boy', 'dog'],
        rows: boy.map((b, i) => [i, last(b) ? b : '$FFFFFF (cap)', i < dog.length ? dog[i] : '—']),
        chart: { x: 'level', y: 'XP', series: [
            { name: 'Boy', points: boy.filter(last).map((v, i): [number, number] => [i, v]) },
            { name: 'dog', points: dog.map((v, i): [number, number] => [i, v]) },
        ] },
        vfs: vfs(XP_BOY),
    };
}

function sineTable(rom: Uint8Array): Table {
    const pts: [number, number][] = [];
    for (let i = 0; i < SINE_WORDS; i++) pts.push([i, word(rom, SINE + i * 2)]);
    return {
        id: 'sine', group: 'Math', title: 'Sine helper', addr: '$80:88A3',
        note: '256 steps per turn, values -255 to +256 (8.8 fixed point). 320 words: cosine reads 64 entries on ($80:8923), so it never wraps. Used by flight ($8E:B33D) and the orbiting projectiles.',
        columns: ['step', 'sine', 'cosine'],
        rows: pts.slice(0, ORBIT_STEPS).map(([i, v]) => [i, v, word(rom, COSINE + i * 2)]),
        chart: { x: 'step', y: 'value', series: [{ name: 'sine', points: pts }] },
        vfs: vfs(SINE),
    };
}

function boomerangTable(rom: Uint8Array): Table {
    const pts: [number, number][] = [];
    for (let a = 0; a < ORBIT_STEPS; a++) pts.push([word(rom, COSINE + a * 2) * 8 / 16, word(rom, SINE + a * 2) * 4 / 16]);
    return {
        id: 'boomerang', group: 'Projectiles', title: 'Boomerang orbit', addr: '$80:8923 · $80:88A3',
        note: 'The ellipse an orbiting projectile flies round its centre ($90:DF44): one step of the angle per tick, a whole turn in 256 ticks. x = cosine × 8, y = sine × 4, in 1/16 px, here in pixels.',
        columns: ['tick', 'x px', 'y px'],
        rows: pts.map(([x, y], i) => [i, x, y]),
        chart: { x: 'x px', y: 'y px', xy: true, series: [{ name: 'orbit', points: pts }] },
        vfs: vfs(SINE),
    };
}

/** Record fields as rom/8eb678.md lists them: [label, offset, bytes]. */
const STAT_FIELDS: [string, number, number][] = [
    ['HP', 0x0f, 2], ['attack', 0x19, 2], ['defence', 0x1b, 2], ['magic def.', 0x1d, 2], ['evade', 0x1f, 2], ['hit rate', 0x21, 2],
    ['XP', 0x23, 4], ['money', 0x27, 2], ['drop chance', 0x29, 1],
];

const FORMULA_COSTS = 0xc43874;
const FORMULA_NAMES = 0xc45d09;
const INGREDIENT_NAMES = 0xc45ff3;
const INGREDIENT_COUNT = 22;
const FORMULA_COUNT = 35;
const DOG_FORMS = 0x8f945d;
const DOG_FORM_COUNT = 4;
const DOG_FORM_STRIDE = 14;

function text(rom: Uint8Array, snes: number): string {
    let s = '';
    for (let p = snesToRom(snes); p < rom.length && rom[p] && s.length < 80; p++) {
        s += rom[p] >= 0x20 && rom[p] < 0x7f ? String.fromCharCode(rom[p]) : '·';
    }
    return s;
}
const textAt = (rom: Uint8Array, table: number, i: number): string => text(rom, 0xc40000 | read16(rom, snesToRom(table + i * 2)));

function statsTable(rom: Uint8Array, names: { id: number; name: string }[]): Table {
    const rows: Cell[][] = [];
    for (let c = 0; c < CHARACTER_COUNT; c++) {
        const at = snesToRom(CHARACTER_TABLE + c * CHARACTER_STRIDE);
        rows.push((['$' + hex(c, 2), names[c]?.name || ''] as Cell[]).concat(STAT_FIELDS.map(([, off, n]) =>
            n === 1 ? rom[at + off] : n === 4 ? read16(rom, at + off) + read16(rom, at + off + 2) * 0x10000 : read16(rom, at + off))));
    }
    return {
        id: 'stats', group: 'Characters', title: 'Character stats', addr: '$8E:B678',
        note: 'The 142 character records, 74 bytes each: the fields rom/8eb678.md names with the routine that reads each. The Boy\'s and Dog\'s rows are templates; their live stats are in WRAM ($0A26, $0A70).',
        columns: ['id', 'name'].concat(STAT_FIELDS.map((f) => f[0] + ' +$' + hex(f[1], 2))), rows, vfs: vfs(CHARACTER_TABLE),
    };
}

function formulaCostsTable(rom: Uint8Array): Table {
    const rows: Cell[][] = [];
    for (let i = 0; i < FORMULA_COUNT; i++) {
        const at = snesToRom(FORMULA_COSTS + i * 6);
        const ing1 = rom[at], qty1 = rom[at + 1];
        const ing2 = rom[at + 2], qty2 = rom[at + 3];
        const flags = rom[at + 4];
        const power = rom[at + 5];
        const ing1Name = ing1 < INGREDIENT_COUNT ? textAt(rom, INGREDIENT_NAMES, ing1) : '—';
        const ing2Name = ing2 < INGREDIENT_COUNT ? textAt(rom, INGREDIENT_NAMES, ing2) : '—';
        rows.push([i, textAt(rom, FORMULA_NAMES, i), ing1Name, qty1, ing2Name, qty2, '$' + hex(flags, 2), power]);
    }
    return {
        id: 'formula-costs', group: 'Alchemy', title: 'Formula ingredient costs & power', addr: '$C4:3874',
        note: 'The 35 alchemy formula cost descriptors ($C4:3874, 6 bytes each): ingredient requirements, quantities, targeting flags, and base power/heal coefficient.',
        columns: ['id', 'formula', 'ingredient 1', 'qty 1', 'ingredient 2', 'qty 2', 'flags', 'power'],
        rows,
        chart: { x: 'formula id', y: 'power', series: [{ name: 'base power', points: rows.map((r, i) => [i, r[7] as number]) }] },
        vfs: vfs(FORMULA_COSTS),
    };
}

function dogFormsTable(rom: Uint8Array): Table {
    const FORM_NAMES = ['Wolfhound (Prehistoric)', 'Greyhound (Antiquity)', 'Poodle (Medieval)', 'Toaster Dog (Omnitopia)'];
    const rows: Cell[][] = [];
    for (let f = 0; f < DOG_FORM_COUNT; f++) {
        const at = snesToRom(DOG_FORMS + f * DOG_FORM_STRIDE);
        const atk = read16(rom, at);
        const def = read16(rom, at + 2);
        const mdef = read16(rom, at + 4);
        const scent = read16(rom, at + 6);
        rows.push([f, FORM_NAMES[f], atk, def, mdef, scent]);
    }
    return {
        id: 'dog-forms', group: 'Characters', title: 'Dog breed form attributes', addr: '$8F:945D',
        note: 'The 4 era forms of the companion Dog ($8F:945D, 14 bytes each): base physical attack, physical armor, magic defense, and scent detection radius in pixels ($7E:144D).',
        columns: ['id', 'form', 'attack', 'defence', 'magic def', 'scent radius px'],
        rows,
        vfs: vfs(DOG_FORMS),
    };
}

const WEAPON_LEVEL_TABLE = 0xc45b4a;
const WEAPON_LEVEL_COUNT = 16;

function weaponLevelsTable(rom: Uint8Array): Table {
    const rows: Cell[][] = [];
    const props = [
        'Standard uncharged strike (under 100% stamina)',
        'Full 100% stamina weapon strike',
        'Charge Level 2 strike / projectile shockwave',
        'Charge Level 3 master power strike',
        'Tier 4 Bazooka artillery shell blast',
        'Tier 5 Bazooka heavy shell blast',
        'Tier 6 Bazooka particle shell blast',
        'Tier 7 Bazooka cryo shell burst',
        'Tier 8 Bazooka high-yield explosion',
        'Tier 9 Bazooka maximum thermal discharge',
        'Tier 10 Special projectile tier',
        'Tier 11 Special projectile tier',
        'Tier 12 Master shell tier',
        'Auxiliary calibration threshold 1',
        'Auxiliary calibration threshold 2',
        'Auxiliary calibration threshold 3',
    ];
    let accum = 0;
    for (let lvl = 0; lvl < WEAPON_LEVEL_COUNT; lvl++) {
        const req = read16(rom, snesToRom(WEAPON_LEVEL_TABLE + lvl * 2));
        accum += req;
        rows.push([lvl, req, accum, props[lvl] || '—']);
    }
    return {
        id: 'weapon-levels', group: 'Progression', title: 'Weapon skill level thresholds', addr: '$C4:5B4A',
        note: 'Base experience points required to advance weapon charge tiers ($C4:5B4A, 16 words): read by $8E:AC9B and tested against active weapon XP at $7E:0AC6,x.',
        columns: ['tier', 'required xp', 'total accumulated', 'unlocked attack property'],
        rows,
        chart: { x: 'tier', y: 'required xp', series: [{ name: 'XP to next tier', points: rows.map((r) => [r[0] as number, r[1] as number]) }] },
        vfs: vfs(WEAPON_LEVEL_TABLE),
    };
}

const FORMULA_XP_TABLE = 0xc45b9c;
const FORMULA_LEVEL_MULT = 0xc45ba5;
const BOY_WEAPONS = 0xc438e6;
const WEAPON_NAMES = [
    'Bone Crusher', 'Gladiator Sword', 'Crusader Sword', 'Sword 4',
    'Spider\'s Claw', 'Bronze Axe', 'Knight Basher', 'Axe 4',
    'Horn Spear', 'Bronze Spear', 'Lance', 'Spear 4',
    'Bazooka (Thunder Ball)', 'Bazooka (Particle Bomb)', 'Bazooka (Cryo-Blast)',
];

function alchemyGrowthTable(rom: Uint8Array): Table {
    const rows: Cell[][] = [];
    const ptsMult: [number, number][] = [];
    const ptsXp: [number, number][] = [];
    for (let lvl = 0; lvl <= 9; lvl++) {
        const atXp = snesToRom(FORMULA_XP_TABLE + lvl);
        const atMult = snesToRom(FORMULA_LEVEL_MULT + lvl);
        const xpPerCast = lvl < 9 ? rom[atXp] : 0;
        const mult = rom[atMult];
        const castsNeeded = lvl < 9 ? Math.ceil(100 / xpPerCast) : 0;
        rows.push([
            'Level ' + lvl,
            lvl < 9 ? xpPerCast : '— (Cap)',
            lvl < 9 ? castsNeeded : '—',
            mult + '×',
        ]);
        ptsMult.push([lvl, mult]);
        if (lvl < 9) ptsXp.push([lvl, xpPerCast]);
    }
    return {
        id: 'alchemy-growth', group: 'Alchemy', title: 'Formula experience & power scaling', addr: '$C4:5B9C · $C4:5BA5',
        note: 'Formula experience gain per cast ($C4:5B9C, 9 bytes) and damage/healing power multiplier ($C4:5BA5, 10 bytes) across levels 0..9: evaluated by $91:CD44 on every successful cast.',
        columns: ['level', 'xp per cast', 'casts to next level', 'power multiplier'],
        rows,
        chart: { x: 'level', y: 'multiplier', series: [
            { name: 'power multiplier', points: ptsMult },
            { name: 'xp per cast', points: ptsXp },
        ] },
        vfs: vfs(FORMULA_XP_TABLE),
    };
}

function boyWeaponsTable(rom: Uint8Array): Table {
    const rows: Cell[][] = [];
    const pts: [number, number][] = [];
    for (let i = 0; i < WEAPON_NAMES.length; i++) {
        const at = snesToRom(BOY_WEAPONS + i * 36);
        const attack = read16(rom, at);
        const knockback = rom[at + 2];
        const classId = Math.floor(i / 4) * 2;
        const className = classId === 0 ? 'Sword' : classId === 2 ? 'Axe' : classId === 4 ? 'Spear' : 'Bazooka';
        rows.push([i, WEAPON_NAMES[i], className, attack, knockback]);
        pts.push([i, attack]);
    }
    return {
        id: 'weapons', group: 'Combat', title: 'Boy weapon base attributes', addr: '$C4:38E6',
        note: 'Base melee attributes for all 15 weapons ($C4:38E6, 36 bytes each): base physical attack power and knockback distance, loaded upon equipping.',
        columns: ['id', 'weapon', 'class', 'base attack', 'knockback'],
        rows,
        chart: { x: 'weapon id', y: 'attack', series: [{ name: 'base attack', points: pts }] },
        vfs: vfs(BOY_WEAPONS),
    };
}

const CALL_BEADS_TABLE = 0xc45f17;
const CALL_BEADS_COUNT = 16;
const CALL_BEAD_NAMES = [
    'Life Spark', 'Heat Wave', 'Storm', 'Flare',
    'Time Warp', 'First Aid', 'Confound', 'Regenerate',
    'Aura', 'Shock Wave', 'Shield', 'Plague',
    'Hypnotize', 'Disrupt', 'Restore', 'Electra Bolt',
];
const FONT_WIDTHS_TABLE = 0xc40c02;
const ANIMATE_RECORDS_TABLE = 0xc43c92;
const ANIMATE_RECORDS_COUNT = 212;
const PROJECTILE_RECORDS_TABLE = 0x90d9a6;
const PROJECTILE_RECORDS_COUNT = 21;
const PROJECTILE_RECORD_STRIDE = 24;
const FORMULA_TARGET_TABLE = 0xc45bf5;

function callBeadsTable(rom: Uint8Array): Table {
    const rows: Cell[][] = [];
    const pts: [number, number][] = [];
    for (let i = 0; i < CALL_BEADS_COUNT; i++) {
        const at = snesToRom(CALL_BEADS_TABLE + i * 2);
        const power = read16(rom, at);
        rows.push([i, CALL_BEAD_NAMES[i] || ('Call Bead ' + i), power]);
        pts.push([i, power]);
    }
    return {
        id: 'call-beads', group: 'Alchemy', title: 'Call Bead spell powers', addr: '$C4:5F17',
        note: 'Base spell damage and recovery coefficients for all 16 Call Bead spells ($C4:5F17, 16 words).',
        columns: ['id', 'spell invocation', 'base power'],
        rows,
        chart: { x: 'spell id', y: 'power', series: [{ name: 'power', points: pts }] },
        vfs: vfs(CALL_BEADS_TABLE),
    };
}

function fontWidthsTable(rom: Uint8Array): Table {
    const rows: Cell[][] = [];
    const pts: [number, number][] = [];
    for (let c = 32; c <= 126; c++) {
        const width = rom[snesToRom(FONT_WIDTHS_TABLE + c)];
        rows.push(['$' + hex(c, 2), String.fromCharCode(c), width]);
        pts.push([c, width]);
    }
    return {
        id: 'font-widths', group: 'UI', title: 'Dialogue proportional font character widths', addr: '$C4:0C02',
        note: 'Proportional pixel widths for printable ASCII characters 0x20..0x7E ($C4:0C02, 128 bytes): read by dialogue text streamer $8C:A753 to advance window cursor X coordinates.',
        columns: ['code', 'glyph', 'width px'],
        rows,
        chart: { x: 'ascii code', y: 'width', series: [{ name: 'width px', points: pts }] },
        vfs: vfs(FONT_WIDTHS_TABLE),
    };
}

function animateRecordsTable(rom: Uint8Array): Table {
    const rows: Cell[][] = [];
    const pts: [number, number][] = [];
    for (let i = 0; i < ANIMATE_RECORDS_COUNT; i++) {
        const at = snesToRom(ANIMATE_RECORDS_TABLE + i * 2);
        const offset = read16(rom, at);
        rows.push([i, '$' + hex(offset, 4), '$C4:' + hex(offset, 4)]);
        pts.push([i, offset]);
    }
    return {
        id: 'animate-records', group: 'Animation', title: 'Animation record pointers (animate ID 0..211)', addr: '$C4:3C92',
        note: 'Global animate() id -> animation record (212 words, right before the record table at $C4:3E3A): maps script animate(entity, mode, id) parameter to 16-bit offset in bank $C4.',
        columns: ['id', 'record offset', 'full address'],
        rows,
        chart: { x: 'animate id', y: 'record offset', series: [{ name: 'offset', points: pts }] },
        vfs: vfs(ANIMATE_RECORDS_TABLE),
    };
}

function projectilesTable(rom: Uint8Array): Table {
    const rows: Cell[][] = [];
    const pts: [number, number][] = [];
    for (let i = 0; i < PROJECTILE_RECORDS_COUNT; i++) {
        const at = snesToRom(PROJECTILE_RECORDS_TABLE + i * PROJECTILE_RECORD_STRIDE);
        const anim = read16(rom, at);
        const palette = read16(rom, at + 2);
        const routine = read16(rom, at + 8);
        const behaviour = read16(rom, at + 0x0c);
        const speed = read16(rom, at + 0x0e);
        const power = read16(rom, at + 0x16);
        rows.push([i, '$' + hex(anim, 4), '$' + hex(palette, 4), routine, '$' + hex(behaviour, 2), speed, power]);
        pts.push([i, speed]);
    }
    return {
        id: 'projectiles', group: 'Projectiles', title: 'Projectile master records', addr: '$90:D9A6',
        note: 'The 21 projectile records ($90:D9A6, 24 bytes each, bank $90): spawned by script opcode $4C (projectile). Details animation record, palette, movement routine, behavior, and speed.',
        columns: ['id', 'anim record', 'palette', 'routine', 'behaviour', 'speed (1/16 px)', 'power'],
        rows,
        chart: { x: 'projectile id', y: 'speed', series: [{ name: 'speed', points: pts }] },
        vfs: vfs(PROJECTILE_RECORDS_TABLE),
    };
}

function formulaTargetsTable(rom: Uint8Array): Table {
    const rows: Cell[][] = [];
    const pts: [number, number][] = [];
    const TARGET_DESC: Record<number, string> = {
        0x0008: 'Party member (Boy / Dog)',
        0x0800: 'Boy only',
        0x0802: 'Party (Both Boy & Dog)',
        0x0a00: 'Party item target',
        0x2010: 'All enemies',
        0x0014: 'Dog (Revive)',
        0x0214: 'Dog (Biscuit)',
        0x2200: 'Environmental (Levitate)',
        0x0240: 'Hidden bridge (Revealer)',
        0x6600: 'Menu invocation',
        0x2018: 'Party + All enemies',
    };
    for (let i = 0; i < FORMULA_COUNT; i++) {
        const at = snesToRom(FORMULA_TARGET_TABLE + i * 2);
        const target = read16(rom, at);
        const formulaName = textAt(rom, FORMULA_NAMES, i);
        const desc = TARGET_DESC[target] || ('Flags $' + hex(target, 4));
        rows.push([i, formulaName, '$' + hex(target, 4), desc]);
        pts.push([i, target]);
    }
    return {
        id: 'formula-targets', group: 'Alchemy', title: 'Formula targeting cursor bitfields', addr: '$C4:5BF5',
        note: 'Target cursor bitfield for each of the 35 formulas ($C4:5BF5, 35 words): determines whether targeting reticle locks onto Boy, Dog, party, or enemy entities.',
        columns: ['id', 'formula', 'cursor flags', 'targeting scope'],
        rows,
        chart: { x: 'formula id', y: 'flags', series: [{ name: 'target flags', points: pts }] },
        vfs: vfs(FORMULA_TARGET_TABLE),
    };
}

const ARMOR_RECORDS_TABLE = 0xc43b02;
const ARMOR_RECORDS_COUNT = 40;
const ARMOR_RECORD_STRIDE = 10;

function armorTable(rom: Uint8Array): Table {
    const rows: Cell[][] = [];
    const pts: [number, number][] = [];
    for (let i = 0; i < ARMOR_RECORDS_COUNT; i++) {
        const at = snesToRom(ARMOR_RECORDS_TABLE + i * ARMOR_RECORD_STRIDE);
        const pdef = read16(rom, at);
        const mdef = read16(rom, at + 2);
        const namePtr = 0xc40000 | read16(rom, at + 4);
        const name = text(rom, namePtr);
        const icon = read16(rom, at + 8);
        const category = i < 12 ? 'Chest Armor' : i < 24 ? 'Helmet' : i < 36 ? 'Armband / Glove' : 'Dog Collar';
        rows.push([i, name, category, pdef, mdef, '$' + hex(icon, 4)]);
        pts.push([i, pdef]);
    }
    return {
        id: 'armor', group: 'Equipment', title: 'Armor & collar defense attributes', addr: '$C4:3B02',
        note: 'The 40 equippable defense armor records ($C4:3B02, 10 bytes each): physical defense, magic defense, name pointer, and ring icon selector ($00A0..$00EE). Read by defense calculator $8E:99D2.',
        columns: ['id', 'name', 'category', 'p. defense', 'm. defense', 'icon id'],
        rows,
        chart: { x: 'armor id', y: 'p. defense', series: [{ name: 'physical defense', points: pts }] },
        vfs: vfs(ARMOR_RECORDS_TABLE),
    };
}

const ENEMY_INDEX_TABLE = 0x8eb55a;
const ENEMY_INDEX_COUNT = 143;

function enemyIndexTable(rom: Uint8Array, names: { id: number; name: string }[]): Table {
    const rows: Cell[][] = [];
    const pts: [number, number][] = [];
    for (let i = 0; i < ENEMY_INDEX_COUNT; i++) {
        const at = snesToRom(ENEMY_INDEX_TABLE + i * 2);
        const addr = read16(rom, at);
        const isWram = addr < 0x2000;
        const recId = isWram ? (addr === 0x0a26 ? 'Boy (WRAM)' : 'Dog (WRAM)') : Math.round((addr - 0xb678) / CHARACTER_STRIDE);
        const addrStr = isWram ? ('$7E:' + hex(addr, 4)) : ('$8E:' + hex(addr, 4));
        const name = isWram ? (addr === 0x0a26 ? 'Boy' : 'Dog') : (names.find((n) => n.id === recId)?.name || ('Record ' + recId));
        rows.push([i, addrStr, recId, name]);
        pts.push([i, typeof recId === 'number' ? recId : 0]);
    }
    return {
        id: 'enemy-index', group: 'Entities', title: 'Enemy spawn archetype index (ENEMY ID 0..142)', addr: '$8E:B55A',
        note: 'Table $8E:B55A (143 words): maps the ENEMY id operand of script spawn opcodes ($BA, $3C, $A2, $C2) to the character record pointer ($7E:0A26/$7E:0A70 for player entities, $8E:B678 for enemy records).',
        columns: ['enemy id', 'record address', 'record id', 'character name'],
        rows,
        chart: { x: 'enemy id', y: 'record id', series: [{ name: 'character record', points: pts }] },
        vfs: vfs(ENEMY_INDEX_TABLE),
    };
}

const CONSUMABLES_TABLE = 0xc45aa0;
const CONSUMABLES_ICONS = 0xc45aae;
const CONSUMABLES_INFO = [
    { name: 'Petal', effect: 'Heals target party member' },
    { name: 'Nectar', effect: 'Heals target party member' },
    { name: 'Honey', effect: 'Heals target party member' },
    { name: 'Dog Biscuit', effect: 'Heals companion Dog HP' },
    { name: 'Wings', effect: 'Dungeon escape / return to start' },
    { name: 'Herbal Essence', effect: 'Cures all negative status effects' },
    { name: 'Pixie Dust', effect: 'Resurrects fallen companion Dog' },
    { name: 'Call Beads', effect: 'Alchemy summon invocation catalyst' },
];

function consumablesTable(rom: Uint8Array): Table {
    const rows: Cell[][] = [];
    const pts: [number, number][] = [];
    for (let i = 0; i < CONSUMABLES_INFO.length; i++) {
        const hp = i < 7 ? read16(rom, snesToRom(CONSUMABLES_TABLE + i * 2)) : 0;
        const icon = read16(rom, snesToRom(CONSUMABLES_ICONS + i * 2));
        const info = CONSUMABLES_INFO[i];
        rows.push([i, info.name, hp > 0 ? hp : 'Special', info.effect, '$' + hex(icon, 4)]);
        pts.push([i, hp]);
    }
    return {
        id: 'consumables', group: 'Items', title: 'Consumable item recovery power & attributes', addr: '$C4:5AA0',
        note: 'The 8 consumable recovery item records ($C4:5AA0, words): base HP recovery values and ring icon selector ($008E..$009C).',
        columns: ['id', 'item name', 'heal HP', 'effect scope', 'ring icon'],
        rows,
        chart: { x: 'item id', y: 'heal HP', series: [{ name: 'HP restored', points: pts }] },
        vfs: vfs(CONSUMABLES_TABLE),
    };
}

/** Every table the view lists: only the ones decoded into readable values. */
function tablesModel(rom: Uint8Array, names: { id: number; name: string }[]): Table[] {
    return [
        xpTable(rom), statsTable(rom, names), sineTable(rom), boomerangTable(rom),
        formulaCostsTable(rom), dogFormsTable(rom), weaponLevelsTable(rom),
        alchemyGrowthTable(rom), boyWeaponsTable(rom),
        callBeadsTable(rom), fontWidthsTable(rom),
        animateRecordsTable(rom), projectilesTable(rom), formulaTargetsTable(rom),
        armorTable(rom),
        enemyIndexTable(rom, names), consumablesTable(rom),
    ];
}

export { tablesModel };
export type { Table };
