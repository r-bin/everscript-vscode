// Play the combo POC in MesenCE and prove the switch on screen (docs/combo/poc.md §5): Evermore runs a stored
// playback, Start goes to Mana (cold boot), Mana runs its playback to its first map, Start goes back to Evermore
// (resumed), and back to Mana again. Screenshots and a report go to out/combo/demo/.
//   npm run combo:demo -- [--ev-movie file] [--mana-movie file] [--ev-at 4200] [--mana-at 10050] [--then 600]
// The playbacks press Start for the games themselves, so the run sets the combo's test byte ($00:301E, bit 0:
// Start goes to the game) and asks for each switch with bit 1, on the frame a player would press Start.
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
const MOVIES = join(homedir(), 'Library/Application Support/Code/User/globalStorage/rbin.everscript/tas-recordings');
const OUT = join(REPO, 'out', 'combo', 'demo');
const evAt = Number(opt('ev-at', '4200')), manaAt = Number(opt('mana-at', '10050')), then = Number(opt('then', '600'));

const sha = (b: Uint8Array) => createHash('sha256').update(b.length % 1024 === 512 ? b.subarray(512) : b).digest('hex');
/** The longest playback recorded on this ROM from power-on, or the one named. */
function movie(romBytes: Uint8Array, named: string, need: number): { name: string; pads: number[] } {
    const files = named ? [named] : readdirSync(MOVIES).filter(f => f.endsWith('.evsmv')).map(f => join(MOVIES, f));
    const want = sha(romBytes);
    const found = files.map(f => ({ f, m: parseMovie(readFileSync(f, 'utf8'), f) }))
        .filter(({ m }) => m.meta.romSha256 === want && m.count >= need)
        .sort((a, b) => a.m.count - b.m.count)[0];
    if (!found) throw new Error(`no playback of ${need}+ frames for ROM ${want.slice(0, 12)} in ${MOVIES}`);
    return { name: found.f, pads: Array.from(found.m.pads as Uint16Array) };
}

const evBytes = new Uint8Array(readFileSync(rom.baseRomOrExit('evermore')));
const manaBytes = new Uint8Array(readFileSync(rom.romOrExit('mana')));
const ev = movie(evBytes, opt('ev-movie', ''), evAt + then);
const mana = movie(manaBytes, opt('mana-movie', ''), manaAt + then);
mkdirSync(OUT, { recursive: true });
const { image, report } = convert(evBytes, manaBytes, join(OUT, 'build'));
const romPath = join(OUT, 'combo-demo.sfc');
writeFileSync(romPath, image);
const L = report.labels;

// The plan, per game, in that game's own frames (its playback index):
//   Evermore 0 .. evAt, switch; Mana 0 .. manaAt, switch; Evermore evAt .. evAt+then, switch; Mana manaAt .. +then.
const script = `
local evPads = {${ev.pads.slice(0, evAt + then).join(',')}}
local maPads = {${mana.pads.slice(0, manaAt + then).join(',')}}
local names = {[0x8000]="b",[0x4000]="y",[0x2000]="select",[0x1000]="start",[0x0800]="up",[0x0400]="down",[0x0200]="left",[0x0100]="right",[0x0080]="a",[0x0040]="x",[0x0020]="l",[0x0010]="r"}
local bus, wram = emu.memType.snesMemory, emu.memType.snesWorkRam
local f, cursor, switching, step, since = 0, {0, 0}, false, 1, 0
local stops = {${evAt}, ${manaAt}, ${evAt + then}, ${manaAt + then}}
local function active() return emu.read(0x3010, bus, false) + 1 end
local function shot(tag)
  local png = emu.takeScreenshot(); local t = {}
  for i = 1, #png do t[#t+1] = string.format("%02X", string.byte(png, i)) end
  print("SHOT " .. tag .. " " .. table.concat(t))
end
local function rooms() return string.format("evermore room $%02X, mana map $%02X", emu.read(0x0ADB, wram, false), emu.read(0x00DC, wram, false)) end
emu.addMemoryCallback(function() switching = true; print(string.format("EVENT f=%d switch from %s, %s", f, active() == 1 and "evermore" or "mana", rooms())) end, emu.callbackType.exec, ${L.combo_switch}, ${L.combo_switch})
emu.addMemoryCallback(function() if switching then switching = false; since = 0; print(string.format("EVENT f=%d resumed %s", f, active() == 1 and "evermore" or "mana")) end end, emu.callbackType.exec, ${L.pad_filter_pass}, ${L.pad_filter_pass})
emu.addMemoryCallback(function() switching = false; since = 0; print(string.format("EVENT f=%d mana cold boot", f)) end, emu.callbackType.exec, 0x008004, 0x008004)
emu.addEventCallback(function()
  local g = active(); local pads = g == 1 and evPads or maPads
  local v = switching and 0 or (pads[cursor[g] + 1] or 0)
  local input = {} for bit, nm in pairs(names) do input[nm] = (v & bit) ~= 0 end
  emu.setInput(input, 0)
end, emu.eventType.inputPolled)
emu.addEventCallback(function()
  f = f + 1
  if not switching and emu.read(0x301E, bus, false) ~= 3 then emu.write(0x301E, 1, bus) end
  if not switching then
    local g = active()
    cursor[g] = cursor[g] + 1; since = since + 1
    if since == 60 and step > 1 then shot(string.format("%d-%s-resumed", step, g == 1 and "evermore" or "mana")) end
    if step <= 4 and g == 2 - step % 2 and cursor[g] == stops[step] then
      shot(string.format("%d-%s-before-switch", step, g == 1 and "evermore" or "mana"))
      print(string.format("EVENT f=%d %s frame %d: Start, %s", f, g == 1 and "evermore" or "mana", cursor[g], rooms()))
      step = step + 1
      if step <= 4 then emu.write(0x301E, 3, bus) else emu.stop(0) end
    end
  end
  if f > ${evAt + manaAt + 2 * then + 3000} then print("EVENT timeout"); emu.stop(0) end
end, emu.eventType.endFrame)
`;

const exe = mesenPath();
if (!exe) throw new Error('MesenCE not found (set MESEN)');
const r = await runLua(exe, romPath, script, OUT, 'demo');
const events: string[] = [];
for (const line of r.out.split('\n')) {
    if (line.startsWith('SHOT ')) { const [, tag, h] = line.split(' '); writeFileSync(join(OUT, `${tag}.png`), Buffer.from(h, 'hex')); events.push(`shot ${tag}.png`); }
    else if (line.startsWith('EVENT ')) events.push(line.slice(6));
}
const text = ['# Combo POC demo (MesenCE)', '', `Evermore playback: ${ev.name.split('/').pop()}`, `Mana playback: ${mana.name.split('/').pop()}`, '', ...events.map(e => `- ${e}`), ''].join('\n');
writeFileSync(join(OUT, 'report.md'), text);
console.log(text);
