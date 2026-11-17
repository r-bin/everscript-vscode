// How busy the S-CPU is in play, frame by frame, on the original ROM in MesenCE (docs/sa1/offload.md §1).
//   npm run sa1:load -- [--rom <clean rom>] [--movies <file>...] [--max-frames 30000] [--max-movies 3] [--out out/sa1/load]
//                       [--image <built image>]
// --image plays a built image (e.g. the offload image, offload.mts) on the same inputs; the steps column then also
// counts the steps the SA-1 ran (its copy of the step jump, $21:985E).
// A field frame is: the NMI, the fixed work of per_frame_field_tick ($8E:E41E), then field_spare_time_loop ($8F:9817),
// which runs pathfinding steps (the jump at $8F:985E) until the next NMI. So the clock at which the spare-time loop
// starts, counted from the frame's NMI, is the frame's fixed load; a frame whose fixed work runs past the next NMI
// is a lag frame (the game slows down). Steps = pathfinding steps the spare time paid for.
// Writes <out>/<movie>.load (one line per field frame: frame, room, load in master clocks, lag, steps, active
// slots) and <out>/REPORT.md (no ROM bytes). Movies are the user's recordings on the base ROM, cut before the
// first event that changes a replay (W/R/L); they drift from what was played on snes9x. MesenCE movies (.mmo, e.g.
// the recomp's tools/compare/replays/) stay in sync; only power-on ones without a save state are played.
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { REPO } from './convert.mts';
import { mesenPath, runLua } from './mesen.mts';

const require = createRequire(import.meta.url);
const { parseMovie } = require('../../dist/platform/tas/movie');
const { instructionLength } = require('../../dist/platform/snes/opcodes-65816');

const FRAME = 357368;                      // NTSC master clocks per frame (1364 × 262)
const TICK = 0x8EE41E, SPARE = 0x8F9817, STEP = 0x8F985E, SPARE_END = 0x8F9861;
const SLOTS = 6, SLOT = 0x59, SLOT_FLAGS = 0x3C12, SLOT_PARENT = 0x3C14;   // field_spare_time_loop's task slots
const ROOM = 0x0ADB;
const TICK_END = 0x8EE4B4;                 // per_frame_field_tick's code after its last call (the spare-time loop)
const REPLAY_CHANGING = new Set(['W', 'R', 'L']);
const BUTTONS: [number, string][] = [[0x8000, 'b'], [0x4000, 'y'], [0x2000, 'select'], [0x1000, 'start'], [0x0800, 'up'],
    [0x0400, 'down'], [0x0200, 'left'], [0x0100, 'right'], [0x0080, 'a'], [0x0040, 'x'], [0x0020, 'l'], [0x0010, 'r']];

const argv = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
const list = (k: string) => { const i = argv.indexOf('--' + k), o: string[] = []; if (i >= 0) for (let j = i + 1; j < argv.length && !argv[j].startsWith('--'); j++) o.push(argv[j]); return o; };
const romPath: string = require('../rom').baseRomOrExit('evermore', argv.includes('--rom') ? opt('rom', '') : undefined);
const out = opt('out', join(REPO, 'out', 'sa1', 'load'));
const image = argv.includes('--image') ? resolve(opt('image', '')) : null;
const SA1_STEP = 0x21985E;
const maxFrames = Number(opt('max-frames', '30000')), maxMovies = Number(opt('max-movies', '3'));
const DEFAULT_MOVIES = join(homedir(), 'Library/Application Support/Code/User/globalStorage/rbin.everscript/tas-recordings');
const exe = mesenPath();
if (!exe) { console.error('MesenCE not found: set MESEN'); process.exit(2); }

interface Input { name: string; pads: Uint16Array; frames: number; state?: Buffer }

// MesenCE movie: Input.txt holds one row per poll, "|<reset/power>|<12 keys>"; row r is the poll at the end of frame r.
const MMO_KEYS = [0x0080, 0x8000, 0x0040, 0x4000, 0x0020, 0x0010, 0x2000, 0x1000, 0x0800, 0x0400, 0x0200, 0x0100];   // A B X Y L R Select Start U D L R
// A movie with SaveState.mss starts from it: MesenCE loads the state at the first instruction (as the recomp's
// tools/compare does). Such movies hold memory from a ROM and stay local.
function mesenMovie(f: string): Input {
    const state = execFileSync('unzip', ['-Z1', f], { encoding: 'utf8' }).split('\n').includes('SaveState.mss')
        ? execFileSync('unzip', ['-p', f, 'SaveState.mss'], { maxBuffer: 1 << 28 }) : undefined;
    const rows = execFileSync('unzip', ['-p', f, 'Input.txt'], { encoding: 'latin1', maxBuffer: 1 << 28 }).split('\n').filter(l => l[0] === '|').map(l => l.slice(1).split('|'));
    const pads = new Uint16Array(rows.length + 1);
    rows.forEach((r, i) => { for (let k = 0; k < MMO_KEYS.length; k++) if (r[1]?.[k] && r[1][k] !== '.') pads[i + 1] |= MMO_KEYS[k]; });
    return { name: basename(f, '.mmo'), pads, frames: Math.min(pads.length, maxFrames), state };
}

function movies(sha: string): Input[] {
    const mmo = list('movies').filter(f => f.endsWith('.mmo'));
    if (mmo.length) return mmo.map(mesenMovie);
    const files = list('movies').length ? list('movies')
        : existsSync(DEFAULT_MOVIES) ? readdirSync(DEFAULT_MOVIES).filter(f => f.endsWith('.evsmv')).map(f => join(DEFAULT_MOVIES, f)) : [];
    return files.map(f => ({ f, m: parseMovie(readFileSync(f, 'utf8'), basename(f)) }))
        .filter(({ m }) => m.meta.romSha256 === sha)
        .map(({ f, m }) => {
            const cut = m.events.filter((e: { kind: string }) => REPLAY_CHANGING.has(e.kind)).map((e: { frame: number }) => e.frame);
            return { name: basename(f, '.evsmv'), pads: m.pads, frames: Math.min(m.count, maxFrames, ...cut) };
        })
        .filter(i => i.frames > 3000).sort((a, b) => b.frames - a.frames).slice(0, maxMovies);
}

/** The calls per_frame_field_tick makes (it runs with 16-bit A and X): [address of the JSL, its target]. */
function tickCalls(rom: Uint8Array): [number, number][] {
    const file = (bus: number) => bus & 0x3FFFFF;
    const calls: [number, number][] = [];
    for (let a = TICK; a < TICK_END;) {
        const op = rom[file(a)];
        if (op === 0x22) calls.push([a, rom[file(a) + 1] | rom[file(a) + 2] << 8 | rom[file(a) + 3] << 16]);
        a += instructionLength(op, false, false);
    }
    return calls;
}

function lua(i: Input, calls: [number, number][]): string {
    return `
local pads = {${Array.from(i.pads.subarray(0, i.frames)).join(',')}}
local frames = ${i.frames}
local buttons = {${BUTTONS.map(([bit, name]) => `{${bit},"${name}"}`).join(',')}}
local w = emu.memType.snesWorkRam
${i.state ? `do
  local state = ("${i.state.toString('hex')}"):gsub("%x%x", function(c) return string.char(tonumber(c, 16)) end)
  local id
  id = emu.addMemoryCallback(function()
    emu.removeMemoryCallback(id, emu.callbackType.exec, 0, 0xFFFFFF)
    if not emu.loadSavestate(state) then print("the movie's save state did not load"); emu.stop(1) end
  end, emu.callbackType.exec, 0, 0xFFFFFF)
end` : ''}
local f, nmiN, nmiClk, tickN, tickClk, load, lag, steps = 0, 0, 0, -1, 0, 0, 0, 0
local calls = {${calls.map(([a]) => a).join(',')}}
-- One mark per call: a skipped call's return address can be the next call's address.
local cur, all, slow, mark = {}, {}, {}, {}
for k = 1, #calls do cur[k], all[k], slow[k] = 0, 0, 0 end
for k, a in ipairs(calls) do
  emu.addMemoryCallback(function() mark[k] = emu.getState()["masterClock"] end, emu.callbackType.exec, a, a)
  emu.addMemoryCallback(function()
    if mark[k] then cur[k] = cur[k] + (emu.getState()["masterClock"] - mark[k]) % 4294967296; mark[k] = nil end
  end, emu.callbackType.exec, a + 4, a + 4)
end
local function rd16(a) return emu.read(a, w, false) + 256 * emu.read(a + 1, w, false) end
emu.addEventCallback(function() nmiN = nmiN + 1; nmiClk = emu.getState()["masterClock"] end, emu.eventType.nmi)
emu.addMemoryCallback(function()
  tickN = nmiN; tickClk = nmiClk
  for k = 1, #calls do cur[k] = 0 end
end, emu.callbackType.exec, ${TICK}, ${TICK})
emu.addMemoryCallback(function()
  if tickN < 0 then return end
  load = (emu.getState()["masterClock"] - tickClk) % 4294967296   -- masterClock comes as 32 bits
  lag = (nmiN ~= tickN) and 1 or 0
  steps = 0
  if load < ${2 * FRAME} then
    for k = 1, #calls do
      all[k] = all[k] + cur[k]
      if lag == 1 then slow[k] = slow[k] + cur[k] end
    end
  end
end, emu.callbackType.exec, ${SPARE}, ${SPARE})
emu.addMemoryCallback(function() steps = steps + 1 end, emu.callbackType.exec, ${STEP}, ${STEP})
${image ? `emu.addMemoryCallback(function() steps = steps + 1 end, emu.callbackType.exec, ${SA1_STEP}, ${SA1_STEP}, emu.cpuType.sa1, emu.memType.sa1Memory)` : ''}
emu.addMemoryCallback(function()
  if tickN < 0 then return end
  local slots = 0
  for s = 0, ${SLOTS - 1} do
    local x = s * ${SLOT}
    if rd16(${SLOT_PARENT} + x) ~= 0 and (rd16(${SLOT_FLAGS} + x) & 0x0200) == 0 then slots = slots + 1 end
  end
  print(string.format("L %d %d %d %d %d %d", f, emu.read(${ROOM}, w, false), load, lag, steps, slots))
  tickN = -1
end, emu.callbackType.exec, ${SPARE_END}, ${SPARE_END})
emu.addEventCallback(function()
  local v = pads[f + 1] or 0
  local input = {}
  for _, b in ipairs(buttons) do input[b[2]] = (v & b[1]) ~= 0 end
  emu.setInput(input, 0)
end, emu.eventType.inputPolled)
emu.addEventCallback(function()
  f = f + 1
  if f >= frames then
    for k = 1, #calls do print(string.format("A %d %d %d", k - 1, all[k], slow[k])) end
    print("END " .. f); emu.stop(0)
  end
end, emu.eventType.endFrame)
`;
}

interface Row { f: number; room: number; load: number; lag: number; steps: number; slots: number }

const pct = (a: number, b: number) => b ? (100 * a / b).toFixed(1) + ' %' : '–';
const quant = (v: number[], q: number) => { const s = [...v].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0; };

const names = new Map<number, string>();
try {
    for (const fn of JSON.parse(readFileSync(join(REPO, 'out/recomp/asar/functions.json'), 'utf8'))) for (const e of fn.entries) names.set(parseInt(e.slice(1), 16), fn.name);
} catch { /* names are optional: out/recomp/asar is generated (npm run recomp) */ }
const label = (bus: number) => `\`$${(bus >> 16).toString(16).toUpperCase()}:${(bus & 0xFFFF).toString(16).toUpperCase().padStart(4, '0')}\`${names.has(bus) ? ' ' + names.get(bus) : ''}`;

/** Time per call of per_frame_field_tick, over play frames and over slowdown frames, as a share of a frame. */
function attribute(rows: Row[], text: string, calls: [number, number][]): string[] {
    const play = rows.filter(r => r.load < 2 * FRAME).length, slowN = rows.filter(r => r.lag && r.load < 2 * FRAME).length;
    const acc = text.split('\n').filter(l => l.startsWith('A ')).map(l => l.split(' ').map(Number)).map(([, k, all, slow]) => ({ target: calls[k][1], all, slow }));
    const merged = new Map<number, { all: number; slow: number }>();
    for (const a of acc) { const m = merged.get(a.target) ?? { all: 0, slow: 0 }; m.all += a.all; m.slow += a.slow; merged.set(a.target, m); }
    const lines = ['| Call in per_frame_field_tick | All play frames (mean, share of a frame) | Slowdown frames (mean) |', '|---|---|---|'];
    for (const [t, m] of [...merged].sort((a, b) => b[1].slow - a[1].slow || b[1].all - a[1].all)) {
        if (m.all / play / FRAME < 0.002) continue;
        lines.push(`| ${label(t)} | ${pct(m.all / play, FRAME)} | ${pct(slowN ? m.slow / slowN : 0, FRAME)} |`);
    }
    return [...lines, ''];
}

function summarize(name: string, rows: Row[]): string[] {
    // A lag frame whose fixed work took two frames or more is a load (room enter, menus), not slowdown.
    const slow = (r: Row) => r.lag && r.load < 2 * FRAME;
    const lags = rows.filter(slow).length, loadsN = rows.filter(r => r.lag && !slow(r)).length;
    const play = rows.filter(r => r.load < 2 * FRAME).map(r => r.load / FRAME);
    const byRoom = new Map<number, Row[]>();
    for (const r of rows) (byRoom.get(r.room) ?? byRoom.set(r.room, []).get(r.room)!).push(r);
    const lines = [`### ${name}`, '', `${rows.length} field frames; slowdown frames ${lags} (${pct(lags, rows.length)}), loads ${loadsN}; fixed load (loads left out) median ${pct(quant(play, 0.5), 1)}, 95th ${pct(quant(play, 0.95), 1)}, 99th ${pct(quant(play, 0.99), 1)} of a frame; pathfinding steps per frame median ${quant(rows.map(r => r.steps), 0.5)}, max ${Math.max(...rows.map(r => r.steps))}.`, '',
        '| Room | Frames | Slowdown frames | Fixed load median | 95th | 99th | Steps/frame median | Active slots max |', '|---|---|---|---|---|---|---|---|'];
    for (const [room, rs] of [...byRoom].sort((a, b) => b[1].length - a[1].length).slice(0, 14)) {
        const l = rs.filter(r => r.load < 2 * FRAME).map(r => r.load / FRAME);
        lines.push(`| \`$${room.toString(16).padStart(2, '0')}\` | ${rs.length} | ${rs.filter(slow).length} | ${pct(quant(l, 0.5), 1)} | ${pct(quant(l, 0.95), 1)} | ${pct(quant(l, 0.99), 1)} | ${quant(rs.map(r => r.steps), 0.5)} | ${Math.max(...rs.map(r => r.slots))} |`);
    }
    return [...lines, ''];
}

mkdirSync(out, { recursive: true });
const sha = createHash('sha256').update(readFileSync(romPath)).digest('hex');
const inputs = movies(sha);
const calls = tickCalls(readFileSync(romPath));
if (!inputs.length) { console.error('no movie recorded on the base ROM'); process.exit(2); }
const report = [`# S-CPU load in play (MesenCE, ${image ? basename(image) : 'original ROM'})`, '', `Generated by \`npm run sa1:load\`. Load = master clocks from the frame's NMI to the spare-time loop, as a share of ${FRAME}.`, ''];
await Promise.all(inputs.map(async i => {
    const { out: text } = await runLua(exe, image ?? romPath, lua(i, calls), out, 'load');
    if (!text.includes('END ')) throw new Error(`MesenCE stopped early on ${i.name}: ${text.slice(-300)}`);
    writeFileSync(join(out, i.name + '.load'), text);
    const rows = text.split('\n').filter(l => l.startsWith('L ')).map(l => { const [, f, room, load, lag, steps, slots] = l.split(' ').map(Number); return { f, room, load, lag, steps, slots }; });
    report.push(...summarize(`${i.name} (${i.frames} frames)`, rows), ...attribute(rows, text, calls));
    console.log(`${i.name}: ${rows.length} field frames, ${rows.filter(r => r.lag && r.load < 2 * FRAME).length} slowdown`);
}));
writeFileSync(join(out, 'REPORT.md'), report.join('\n'));
console.log(`report: ${join(out, 'REPORT.md')}`);
