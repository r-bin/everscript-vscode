// TODO port to TS (docs/todo/port-to-ts.md)
// Second-emulator check for prove.js: run a ROM in Mesen2's headless test runner (`Mesen --testrunner rom script.lua`)
// with the same pad input as a movie (or none), and return a trace that two ROMs can be compared by.
// Mesen and our snes9x core do not agree frame for frame (lag frames differ), so only runs inside Mesen are compared.
// Trace: every frame the CRC of WRAM $0000-$01FF (DP, engine counters, stack); every 60 frames a hash of all WRAM,
// VRAM, CGRAM and OAM and the room id ($7E0ADB); once, a "probe" line of bus reads that differ between HiROM and ExHiROM.
// "probe d113 frame N" marks each run of $80:D113, the game's read past the original 3 MB (knowledge/rom/80d113.md);
// Mesen mirrors that area unlike the cartridge, so only runs that never reach it must match.
// Power-on RAM is forced to zeros (--snes.ramPowerOnState=AllZeros): Mesen's default randomises it.
'use strict';
const fs = require('fs'), path = require('path');
const { spawn } = require('child_process');

const DEFAULT_MESEN = '/Applications/Mesen.app/Contents/MacOS/Mesen';
// Read once after the first frame; these differ between HiROM and ExHiROM by design, so the comparison skips them.
const PROBES = ['0xC0E653', '0xB0E653', '0x400000', '0x018000', '0x008020'];
const BUTTONS = [[0x8000, 'b'], [0x4000, 'y'], [0x2000, 'select'], [0x1000, 'start'], [0x0800, 'up'], [0x0400, 'down'],
    [0x0200, 'left'], [0x0100, 'right'], [0x0080, 'a'], [0x0040, 'x'], [0x0020, 'l'], [0x0010, 'r']];

function mesenPath() {
    const p = process.env.MESEN || DEFAULT_MESEN;
    return fs.existsSync(p) ? p : null;
}

function luaScript(pads, frames) {
    const padList = Array.from(pads.subarray(0, frames), v => v.toString()).join(',');
    return `
local pads = {${padList}}
local frames = ${frames}
local buttons = {${BUTTONS.map(([bit, name]) => `{${bit},"${name}"}`).join(',')}}
local f = 0
local function crc(mem, from, to, h)
  for i = from, to do h = (h * 31 + emu.read(i, mem, false)) % 4294967291 end
  return h
end
emu.addMemoryCallback(function() print("probe d113 frame " .. f) end, emu.callbackType.exec, 0x80D113, 0x80D113)
emu.addEventCallback(function()
  local v = pads[f + 1] or 0
  local input = {}
  for _, b in ipairs(buttons) do input[b[2]] = (v & b[1]) ~= 0 end
  emu.setInput(input, 0)
end, emu.eventType.inputPolled)
emu.addEventCallback(function()
  local t = emu.memType
  if f == 0 then
    local bus = ""
    for _, a in ipairs({${PROBES.join(', ')}}) do bus = bus .. string.format(" %06X=%02X", a, emu.read(a, t.snesMemory, false)) end
    print("probe" .. bus)
  end
  print(f .. " " .. crc(t.snesWorkRam, 0, 0x1FF, 7))
  if (f + 1) % 60 == 0 or f + 1 == frames then
    print(f .. " state wram=" .. crc(t.snesWorkRam, 0, 0x1FFFF, 7) .. " vram=" .. crc(t.snesVideoRam, 0, 0xFFFF, 7)
      .. " cgram=" .. crc(t.snesCgRam, 0, 0x1FF, 7) .. " oam=" .. crc(t.snesSpriteRam, 0, 0x21F, 7)
      .. " room=" .. emu.read(0x0ADB, t.snesWorkRam, false))
  end
  f = f + 1
  if f >= frames then emu.stop(0) end
end, emu.eventType.endFrame)
`;
}

/** Run one ROM; resolves to the trace text. */
function runMesen(mesen, rom, pads, frames, workDir, tag) {
    const script = path.join(workDir, tag + '.lua');
    fs.writeFileSync(script, luaScript(pads, frames));
    return new Promise((resolve, reject) => {
        const p = spawn(mesen, ['--testrunner', rom, script, '--snes.ramPowerOnState=AllZeros'], { cwd: workDir, stdio: ['ignore', 'pipe', 'pipe'] });
        let out = '';
        p.stdout.on('data', d => { out += d; });
        const timer = setTimeout(() => p.kill('SIGKILL'), 30 * 60 * 1000);
        p.on('exit', code => {
            clearTimeout(timer);
            if (code !== 0) return reject(new Error(`Mesen exited ${code} on ${path.basename(rom)} (${tag})`));
            fs.writeFileSync(path.join(workDir, tag + '.trace'), out);
            resolve(out);
        });
    });
}

module.exports = { mesenPath, runMesen };
