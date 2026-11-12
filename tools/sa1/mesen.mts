// One headless MesenCE run (`Mesen --testrunner rom script.lua`) for the SA-1 proof: a ROM, pad input per frame, and a
// trace two ROMs can be compared by. MesenCE is the reference emulator (reference-emulators skill).
// Trace lines:
//   "<f> <crc>"            every frame: WRAM $0000-$01FF (direct page, engine counters, stack)
//   "<f> state ..."        every 60 frames and at the end: all of WRAM, VRAM, CGRAM, OAM, SRAM/BW-RAM, room ($7E0ADB),
//                          NMI counter ($7E0100)
//   "probe ..."            not compared: bus reads after frame 60 (the setup has run), each run of $80:D113 (the read past the
//                          original 3 MB, knowledge/routines/row_table_low_bytes_from_bank_b0.md), ROM bytes read
//                          or executed inside the watched ranges
// Power-on RAM is zeros (--snes.ramPowerOnState=AllZeros; Mesen randomises by default).
// Mesen keeps battery RAM per ROM file name and writes it back on exit, so each run gets a symlink of its own name:
// SRAM starts cleared, and the .srm Mesen writes for it is deleted afterwards. The owner's saves are never touched.
import { existsSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, extname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const DEFAULT_MESEN = '/Applications/Mesen.app/Contents/MacOS/Mesen';
const MESEN_HOMES = [join(homedir(), 'Library/Application Support/Mesen2'), join(homedir(), '.config/Mesen2')];
const BUTTONS: [number, string][] = [[0x8000, 'b'], [0x4000, 'y'], [0x2000, 'select'], [0x1000, 'start'], [0x0800, 'up'],
    [0x0400, 'down'], [0x0200, 'left'], [0x0100, 'right'], [0x0080, 'a'], [0x0040, 'x'], [0x0020, 'l'], [0x0010, 'r']];

export function mesenPath(): string | null {
    const p = process.env.MESEN || DEFAULT_MESEN;
    return existsSync(p) ? p : null;
}

export interface MesenRun {
    rom: string; pads: Uint16Array; frames: number; dir: string; tag: string;
    /** S-CPU bus addresses read once after the first frame. */
    probes?: number[];
    /** ROM file ranges [from, to] (inclusive); every distinct byte read or executed there is reported. */
    watch?: [number, number][];
}

function lua(r: MesenRun): string {
    const n = Math.min(r.frames, r.pads.length || r.frames);
    return `
local pads = {${Array.from(r.pads.subarray(0, n)).join(',')}}
local frames = ${r.frames}
local buttons = {${BUTTONS.map(([bit, name]) => `{${bit},"${name}"}`).join(',')}}
local t = emu.memType
local f = 0
local function crc(mem, from, to, h)
  for i = from, to do h = (h * 31 + emu.read(i, mem, false)) % 4294967291 end
  return h
end
emu.addMemoryCallback(function() print("probe d113 frame " .. f) end, emu.callbackType.exec, 0x80D113, 0x80D113)
local seen = {}
local function touched(kind) return function(addr) if not seen[addr] then seen[addr] = true; print(string.format("probe ${'%'}s %06X frame %d", kind, addr, f)) end end end
for _, w in ipairs({${(r.watch ?? []).map(([a, b]) => `{${a},${b}}`).join(',')}}) do
  emu.addMemoryCallback(touched("read"), emu.callbackType.read, w[1], w[2], emu.cpuType.snes, t.snesPrgRom)
  emu.addMemoryCallback(touched("exec"), emu.callbackType.exec, w[1], w[2], emu.cpuType.snes, t.snesPrgRom)
end
emu.addEventCallback(function()
  local v = pads[f + 1] or 0
  local input = {}
  for _, b in ipairs(buttons) do input[b[2]] = (v & b[1]) ~= 0 end
  emu.setInput(input, 0)
end, emu.eventType.inputPolled)
emu.addEventCallback(function()
  if f == 59 then
    local bus = ""
    for _, a in ipairs({${(r.probes ?? []).join(',')}}) do bus = bus .. string.format(" %06X=%02X", a, emu.read(a, t.snesMemory, false)) end
    print("probe bus" .. bus)
  end
  print(f .. " " .. crc(t.snesWorkRam, 0, 0x1FF, 7))
  if (f + 1) % 60 == 0 or f + 1 == frames then
    print(f .. " state wram=" .. crc(t.snesWorkRam, 0, 0x1FFFF, 7) .. " vram=" .. crc(t.snesVideoRam, 0, 0xFFFF, 7)
      .. " cgram=" .. crc(t.snesCgRam, 0, 0x1FF, 7) .. " oam=" .. crc(t.snesSpriteRam, 0, 0x21F, 7)
      .. " sram=" .. crc(t.snesSaveRam, 0, 0x1FFF, 7)
      .. " room=" .. emu.read(0x0ADB, t.snesWorkRam, false)
      .. " nmi=" .. (emu.read(0x0100, t.snesWorkRam, false) + 256 * emu.read(0x0101, t.snesWorkRam, false)))
  end
  f = f + 1
  if f >= frames then emu.stop(0) end
end, emu.eventType.endFrame)
`;
}

/** Runs one ROM; resolves to the trace text (also written to <dir>/<tag>.trace). */
export function runMesen(exe: string, r: MesenRun): Promise<string> {
    // Absolute paths: Mesen runs in the work folder, where a relative ROM or script path would not resolve.
    const work = mkdtempSync(join(resolve(r.dir), `${r.tag}-`));
    const link = join(work, basename(work) + extname(r.rom));
    symlinkSync(resolve(r.rom), link);
    const script = join(work, 'run.lua');
    writeFileSync(script, lua(r));
    const srm = basename(work) + '.srm';
    return new Promise((done, fail) => {
        const p = spawn(exe, ['--testrunner', link, script, '--snes.ramPowerOnState=AllZeros', '--timeout=7200'], { cwd: work, stdio: ['ignore', 'pipe', 'pipe'] });
        let out = '', err = '';
        p.stdout.on('data', d => { out += d; });
        p.stderr.on('data', d => { err += d; });
        p.on('exit', code => {
            for (const h of MESEN_HOMES) rmSync(join(h, 'Saves', srm), { force: true });
            rmSync(work, { recursive: true, force: true });
            // MesenCE may exit 255 after emu.stop(0) (reference-emulators skill): judge by the trace, not the code.
            const last = out.trimEnd().split('\n').filter(l => !l.startsWith('probe')).pop() ?? '';
            if (!last.startsWith(`${r.frames - 1} `)) return fail(new Error(`Mesen stopped early on ${r.tag} (exit ${code}): ${last || (out + err).slice(0, 300)}`));
            writeFileSync(join(r.dir, r.tag + '.trace'), out);
            done(out);
        });
    });
}
