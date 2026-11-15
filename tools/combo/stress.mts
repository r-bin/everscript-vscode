// Press Start at many points and check every switch (docs/combo/poc.md §5): MesenCE plays a stored playback of each
// game; after a random number of the active game's frames the run asks for a switch, as a player pressing Start
// would. Every switch must start soon after the press, end (the other game runs again), leave the frozen game's
// WRAM, VRAM, CGRAM and OAM as they were, and both playbacks must stay in step with a run without switches.
//   npm run combo:stress -- [--seed 1] [--ev-frames 20000] [--ev-min 20] [--ev-max 900] [--ma-min 20] [--ma-max 600]
//                          [--ev-movie file] [--mana-movie file] [--no-ref]
// Report: out/combo/stress/report.md. Exit code 1 when a switch failed.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { convert, REPO } from './convert.mts';
import { runLua, mesenPath } from '../sa1/mesen.mts';

const require = createRequire(import.meta.url);
const { parseMovie } = require('../../dist/platform/tas/movie');
const rom = require('../rom');

const args = process.argv.slice(2);
const opt = (name: string, def: string) => { const i = args.indexOf(`--${name}`); return i < 0 ? def : args[i + 1]; };
const num = (name: string, def: number) => Number(opt(name, String(def)));
const MOVIES = join(homedir(), 'Library/Application Support/Code/User/globalStorage/rbin.everscript/tas-recordings');
const OUT = join(REPO, 'out', 'combo', 'stress', `seed-${opt('seed', '1')}`);

const sha = (b: Uint8Array) => createHash('sha256').update(b.length % 1024 === 512 ? b.subarray(512) : b).digest('hex');
/** The shortest playback recorded on this ROM from power-on with at least `need` frames, or the one named. */
function movie(romBytes: Uint8Array, named: string, need: number): { name: string; pads: number[] } {
    const files = named ? [named] : readdirSync(MOVIES).filter(f => f.endsWith('.evsmv')).map(f => join(MOVIES, f));
    const want = sha(romBytes);
    const found = files.map(f => ({ f, m: parseMovie(readFileSync(f, 'utf8'), f) }))
        .filter(({ m }) => m.meta.romSha256 === want && m.count >= need)
        .sort((a, b) => a.m.count - b.m.count)[0];
    if (!found) throw new Error(`no playback of ${need}+ frames for ROM ${want.slice(0, 12)} in ${MOVIES}`);
    return { name: found.f, pads: Array.from(found.m.pads as Uint16Array) };
}

/** Segment lengths, alternating Evermore and Mana, from a small seeded generator (the same seed, the same run). */
function schedule(seed: number, evTotal: number, maTotal: number, ev: [number, number], ma: [number, number]): number[] {
    let s = seed >>> 0 || 1;
    const rnd = (lo: number, hi: number) => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return lo + (s % (hi - lo + 1)); };
    const out: number[] = [];
    let e = 0, m = 0;
    while (e < evTotal && m < maTotal) {
        const a = rnd(ev[0], ev[1]), b = rnd(ma[0], ma[1]);
        out.push(a, b); e += a; m += b;
    }
    return out;
}

interface Result { out: string; sigs: Map<string, string>; events: string[]; fails: string[] }

/** One MesenCE run: `segs` = frames of the active game before each switch (none: Evermore only, never switching). */
async function run(romPath: string, evPads: number[], maPads: number[], segs: number[], tag: string, L: Record<string, number>): Promise<Result> {
    const script = `
local evPads = {${evPads.join(',')}}
local maPads = {${maPads.join(',')}}
local segs = {${segs.join(',')}}
local TRACE = ${args.includes('--trace') ? 'true' : 'false'}
local names = {[0x8000]="b",[0x4000]="y",[0x2000]="select",[0x1000]="start",[0x0800]="up",[0x0400]="down",[0x0200]="left",[0x0100]="right",[0x0080]="a",[0x0040]="x",[0x0020]="l",[0x0010]="r"}
local t = emu.memType
local bus, wram = t.snesMemory, t.snesWorkRam
local f, cursor, seg, left = 0, {0, 0}, 1, segs[1] or -1
local mode, since, from = "run", 0, 0
local before = 0
local function active() return emu.read(0x3010, bus, false) + 1 end
local function gname(g) return g == 1 and "evermore" or "mana" end
local function blocks(mem, size, step)
  local r = {}
  for b = 0, size // step - 1 do
    local h = 7
    for i = b * step, b * step + step - 1 do h = (h * 31 + emu.read(i, mem, false)) % 4294967291 end
    r[b] = h
  end
  return r
end
local function raw(mem, size) local r = {} for i = 0, size - 1 do r[i] = emu.read(i, mem, false) end return r end
-- WRAM byte ranges that differ (at most 16, merged across gaps of 4 bytes)
local function ranges(a, b)
  local out, from, last = {}, nil, nil
  for i = 0, 0x1FFFF do
    if a[i] ~= b[i] then
      if from and i - last <= 4 then last = i else
        if from then out[#out+1] = string.format("%05X-%05X", from, last) end
        from, last = i, i
      end
    end
  end
  if from then out[#out+1] = string.format("%05X-%05X", from, last) end
  if #out > 16 then local n = #out; out = {table.unpack(out, 1, 16)}; out[17] = "+" .. (n - 16) end
  return table.concat(out, " ")
end
local function snap() return { raw = raw(wram, 0x20000), w = blocks(wram, 0x20000, 0x400), v = blocks(t.snesVideoRam, 0x10000, 0x400), c = blocks(t.snesCgRam, 0x200, 0x200), o = blocks(t.snesSpriteRam, 0x220, 0x220) } end
local function diff(a, b)
  local s = ""
  for k, n in pairs({w = 128, v = 64, c = 1, o = 1}) do
    local d = {}
    for i = 0, n - 1 do if a[k][i] ~= b[k][i] then d[#d+1] = string.format("%X", i) end end
    if #d > 0 then s = s .. " " .. k .. ":" .. table.concat(d, ",") end
  end
  return s
end
local function sig(g)
  if g == 1 then
    return string.format("%02X %04X %04X", emu.read(0x0ADB, wram, false), emu.readWord(0x4EBD, wram, false), emu.readWord(0x4EBF, wram, false))
  end
  return string.format("%04X %04X %04X", emu.readWord(0x00DC, wram, false), emu.readWord(0xE002, wram, false), emu.readWord(0xE004, wram, false))
end
local stopped = false
local spcWatch = 0
local function fail(msg, fatal)
  if stopped then return end
  print(string.format("FAIL f=%d %s", f, msg))
  if fatal then
    stopped = true
    for k, v in pairs(emu.getState()) do if type(v) ~= "table" then print("STATE " .. k .. "=" .. tostring(v)) end end
    emu.stop(1)
  end
end
local function pc() local st = emu.getState(); return (st["cpu.k"] or 0) * 65536 + (st["cpu.pc"] or 0) end
local frozen, check, truth, frozenNext = {}, {}, {}, false
-- the interrupt registers as MesenCE has them (the game cannot read them back)
local function ints()
  local st = emu.getState(); local r = "internalRegisters."
  local h, v = st[r .. "enableHorizontalIrq"], st[r .. "enableVerticalIrq"]
  return { nmi = st[r .. "enableNmi"], h = h, v = v, ht = st[r .. "horizontalTimer"], vt = st[r .. "verticalTimer"] }
end
local function sameInts(a, b)
  if a.nmi ~= b.nmi or a.h ~= b.h or a.v ~= b.v then return false end
  if a.v and a.vt ~= b.vt then return false end
  if a.h and math.abs(a.ht - b.ht) > 24 then return false end
  return true
end
local function showInts(a) return string.format("nmi=%s h=%s v=%s H=%d V=%d", tostring(a.nmi), tostring(a.h), tostring(a.v), a.ht, a.vt) end
emu.addMemoryCallback(function()
  if mode == "switching" then return end
  local g = active()
  print(string.format("EVENT f=%d switch from %s at its frame %d, %d frames after the press", f, gname(g), cursor[g], f - from))
  if TRACE and g == 2 then print(string.format("MAIPC f=%d mana NMI stopped it at %02X%04X, safe=%d, pc of the switch call %06X", f, emu.read(0x3060, bus, false), emu.readWord(0x305E, bus, false), emu.read(0x305C, bus, false), emu.readWord(emu.getState()["cpu.sp"] + 1, bus, false) + 65536 * emu.read(emu.getState()["cpu.sp"] + 3, bus, false))) end
  if TRACE and g == 1 then print(string.format("SND f=%d evermore bank $0E4B=%04X track $0E4D=%04X vol $9A=%04X", f, emu.readWord(0x0E4B, wram, false), emu.readWord(0x0E4D, wram, false), emu.readWord(0x009A, wram, false))) end
  if mode ~= "pending" then fail("switch without a press") end
  mode, since = "switching", 0
  before = g
  if g == 2 then spcWatch = 800 end
  truth[g] = ints()
  if frozen[3 - g] then check[3 - g] = true end
  frozenNext = true
end, emu.callbackType.exec, ${L.combo_switch}, ${L.combo_switch})
emu.addMemoryCallback(function()
  if frozenNext then frozenNext = false; frozen[before] = snap() end
end, emu.callbackType.exec, ${L.mem_all}, ${L.mem_all})
local function resumed(cold)
  local g = active()
  if g == 1 then spcWatch = 400 end
  print(string.format("EVENT f=%d %s %s after %d frames", f, cold and "cold boot of" or "resumed", gname(g), since))
  local t = truth[before]
  print(string.format("INTS %s measured $4200=%02X H=%d V=%d hits=%d nmis=%d; MesenCE %s", gname(before), emu.read(0x3040 + 8 * (before - 1), bus, false),
    emu.readWord(0x3054, bus, false), emu.readWord(0x3056, bus, false), emu.readWord(0x3052, bus, false), emu.read(0x3050, bus, false), showInts(t)))
  if g == before then fail("came back into the same game") end
  if check[g] then
    local now = snap()
    print(string.format("MEM f=%d %s%s wram %s", f, gname(g), diff(frozen[g], now), ranges(frozen[g].raw, now.raw))); check[g] = nil
    local nowInts = ints()
    if not sameInts(truth[g], nowInts) then fail(string.format("interrupts of %s not as frozen: %s, now %s", gname(g), showInts(truth[g]), showInts(nowInts))) end
  end
  mode = "run"
  seg = seg + 1; left = segs[seg] or -1
end
emu.addMemoryCallback(function() if mode == "switching" then resumed(false) end end, emu.callbackType.exec, ${L.combo_back}, ${L.combo_back})
emu.addMemoryCallback(function() if mode == "switching" then resumed(true) end end, emu.callbackType.exec, 0x008004, 0x008004)
emu.addMemoryCallback(function() fail(string.format("crash: COP/BRK/ABORT vector, %s", gname(active())), true) end, emu.callbackType.exec, 0x00FFEC, 0x00FFEC)
if TRACE then
  emu.addMemoryCallback(function(a, v) print(string.format("ESA f=%d $1EE1=%02X spc.pc=%04X game %s", f, v, emu.getState()["spc.pc"], gname(active()))) end, emu.callbackType.write, 0x1EE1, 0x1EE1, emu.cpuType.spc, emu.memType.spcRam)
  local function spc(tag)
    local st = emu.getState()
    print(string.format("SPC f=%d %s spc.pc=%04X out=%02X %02X %02X %02X in=%02X %02X %02X %02X", f, tag, st["spc.pc"],
      st["spc.outputReg[0]"], st["spc.outputReg[1]"], st["spc.outputReg[2]"], st["spc.outputReg[3]"],
      st["spc.cpuRegs[0]"], st["spc.cpuRegs[1]"], st["spc.cpuRegs[2]"], st["spc.cpuRegs[3]"]))
  end
  for _, a in ipairs({0x8C8000, 0x8C801F, 0x8C810E, 0x8C805B, 0x8C81D4}) do emu.addMemoryCallback(function() print(string.format("CMD f=%d exec %06X", f, a)) end, emu.callbackType.exec, a, a) end
  for _, l in ipairs({${['combo_switch', 'ev_to_ipl', 'ma_to_ipl', 'spc_silence', 'wait_ipl', 'mem_all', 'combo_back', 'resume_evermore', 'resume_mana'].map(n => `{${L[n]},"${n}"}`).join(',')}}) do
    emu.addMemoryCallback(function() spc(l[2]) end, emu.callbackType.exec, l[1], l[1])
  end
  emu.addMemoryCallback(function()
    local st = emu.getState()
    if active() == 1 then print(string.format("CMD f=%d evermore A=%04X Y=%04X from %02X%04X", f, st["cpu.a"], st["cpu.y"], emu.read(st["cpu.sp"] + 3, bus, false) , emu.readWord(st["cpu.sp"] + 1, bus, false))) end
  end, emu.callbackType.exec, 0x8C81FD, 0x8C81FD)
  local lastw = {}
  emu.addMemoryCallback(function(a, v)
    local k = string.format("%06X=%02X", pc(), v)
    if lastw[a] ~= k then lastw[a] = k; print(string.format("W f=%d %s %X %s", f, gname(active()), a, k)) end
  end, emu.callbackType.write, 0x4200, 0x4200)
end
emu.addEventCallback(function()
  local g = active(); local pads = g == 1 and evPads or maPads
  local v = mode == "switching" and 0 or (pads[cursor[g] + 1] or 0)
  local input = {} for bit, nm in pairs(names) do input[nm] = (v & bit) ~= 0 end
  emu.setInput(input, 0)
end, emu.eventType.inputPolled)
emu.addEventCallback(function()
  if stopped then return end
  f = f + 1
  if TRACE and spcWatch > 0 then
    spcWatch = spcWatch - 1
    local st = emu.getState()
    print(string.format("SPCF f=%d spc.pc=%04X out=%02X %02X %02X %02X in=%02X %02X %02X %02X 9F=%02X", f, st["spc.pc"], st["spc.outputReg[0]"], st["spc.outputReg[1]"], st["spc.outputReg[2]"], st["spc.outputReg[3]"], st["spc.cpuRegs[0]"], st["spc.cpuRegs[1]"], st["spc.cpuRegs[2]"], st["spc.cpuRegs[3]"], emu.read(0x9F, wram, false)))
  end
  if mode ~= "switching" then
    local g = active()
    if emu.read(0x301E, bus, false) & 2 == 0 then emu.write(0x301E, 1, bus) end
    cursor[g] = cursor[g] + 1
    if cursor[g] % 10 == 0 then print(string.format("S %d %d %s", g, cursor[g], sig(g))) end
    if cursor[g] >= (g == 1 and #evPads or #maPads) then print("EVENT end of playback"); emu.stop(0) end
    if mode == "run" and left > 0 then
      left = left - 1
      if left == 0 then mode, from = "pending", f; emu.write(0x301E, 3, bus) end
    elseif mode == "pending" and f - from > 600 then fail(string.format("no switch 600 frames after the press, %s frame %d, pc %06X", gname(g), cursor[g], pc()), true) end
  else
    since = since + 1
    if since > 900 then fail(string.format("switch from %s not done after 900 frames, pc %06X", gname(before), pc()), true) end
  end
end, emu.eventType.endFrame)
`;
    const exe = mesenPath();
    if (!exe) throw new Error('MesenCE not found (set MESEN)');
    const r = await runLua(exe, romPath, script, OUT, tag);
    writeFileSync(join(OUT, `${tag}.log`), r.out);
    const sigs = new Map<string, string>(), events: string[] = [], fails: string[] = [];
    for (const line of r.out.split('\n')) {
        if (line.startsWith('S ')) { const [, g, c, ...s] = line.split(' '); sigs.set(`${g} ${c}`, s.join(' ')); }
        else if (/^(EVENT|MEM|INTS|SPC|SPCF|SND|MAIPC|ESA) /.test(line)) events.push(line);
        else if (line.startsWith('FAIL ')) { events.push(line); fails.push(line.slice(5)); }
    }
    if (r.code !== 0 && fails.length === 0) fails.push(`MesenCE exit ${r.code}: ${r.err.slice(-400)}`);
    return { out: r.out, sigs, events, fails };
}

/** First playback frame of game g where the switching run's state is not the reference's (±3 frames allowed). */
function firstDrift(ref: Map<string, string>, got: Map<string, string>, g: number): number | null {
    for (const [k, v] of got) {
        const [gg, c] = k.split(' ').map(Number);
        if (gg !== g) continue;
        const near = [0, -10, 10].map(d => ref.get(`${g} ${c + d}`));
        if (near.every(x => x === undefined)) continue;
        if (!near.includes(v)) return c;
    }
    return null;
}

const evBytes = new Uint8Array(readFileSync(rom.baseRomOrExit('evermore')));
const manaBytes = new Uint8Array(readFileSync(rom.romOrExit('mana')));
const evFrames = num('ev-frames', 20000);
const ev = movie(evBytes, opt('ev-movie', ''), evFrames);
const mana = movie(manaBytes, opt('mana-movie', ''), 10000);
mkdirSync(OUT, { recursive: true });
const { image, report } = convert(evBytes, manaBytes, join(OUT, 'build'));
const romPath = join(OUT, 'combo-stress.sfc');
writeFileSync(romPath, image);
const L = report.labels;
const evPads = ev.pads.slice(0, evFrames), maPads = mana.pads;
const segs = schedule(num('seed', 1), evFrames, maPads.length, [num('ev-min', 20), num('ev-max', 900)], [num('ma-min', 20), num('ma-max', 600)]);

const runs = [run(romPath, evPads, maPads, segs, 'switching', L)];
if (!args.includes('--no-ref')) runs.push(run(romPath, evPads, maPads, [], 'ref-evermore', L), run(romPath, evPads, maPads, [segs[0]], 'ref-mana', L));
const [sw, refEv, refMa] = await Promise.all(runs);
const fails = [...sw.fails];
const lines = ['# Combo stress run (MesenCE)', '', `Evermore playback: ${ev.name.split('/').pop()}`, `Mana playback: ${mana.name.split('/').pop()}`,
    `Seed ${opt('seed', '1')}, ${segs.length} switches planned`, ''];
if (refEv && refMa) {
    for (const [g, ref, name] of [[1, refEv, 'Evermore'], [2, refMa, 'Mana']] as const) {
        const d = firstDrift(ref.sigs, sw.sigs, g);
        lines.push(`- ${name}: ${d === null ? 'in step with the run without switches' : `leaves the run without switches at its frame ${d}`}`);
        // not a failure: a recorded playback assumes exact frame timing, which every switch shifts
    }
}
const switches = sw.events.filter(e => e.includes(' switch from ')).length;
const mem = sw.events.filter(e => e.startsWith('MEM ') && e.split(' ').length > 3);
lines.push(`- ${switches} switches done; ${mem.length} resumes with memory differences`, `- ${fails.length ? `**${fails.length} failures**` : 'no failures'}`, '', '## Events', '', ...sw.events.map(e => `    ${e}`), '');
writeFileSync(join(OUT, 'report.md'), lines.join('\n'));
console.log(lines.slice(0, 12).join('\n'));
for (const fl of fails) console.log(`FAIL ${fl}`);
process.exit(fails.length ? 1 : 0);
