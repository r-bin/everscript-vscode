// The MesenCE backend: Mesen run headless from a generated Lua testrunner script.
// Mesen is the cycle-accurate reference emulator for WRAM comparisons (reference-emulators skill).
// Keys are aligned on the NMI frame counter $7E0100 when mixed with recomp or snes9x, or frame numbers.
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { FRAME_COUNTER, RNG, SYNC_AT, CROSS_NOISE } from './game.mts';
import { REGION_SIZE, type Region, type Crcs } from './diff.mts';
import { padToButtonString } from './recomp.mts';

const require = createRequire(import.meta.url);

export const MESEN_REGIONS: Region[] = ['wram', 'vram', 'cgram', 'oam'];

const DEFAULT_MESEN = '/Applications/Mesen.app/Contents/MacOS/Mesen';

/** Default Mesen executable: MESEN environment variable, or macOS app path. */
export function defaultMesenExe(): string {
    return process.env.MESEN || DEFAULT_MESEN;
}

export interface MesenJob {
    exe?: string;
    rom: string;
    /** Frames (align frame) or counter value to run to (align nmi). */
    to: number;
    align: 'frame' | 'nmi';
    regions: Region[];
    stride?: number;
    dumpAt?: number;
    mask: boolean;
    /** RNG bytes at counter SYNC_AT copied in (when target), or sampled (when reference). */
    rng?: Uint8Array | null;
    replay?: string | null;
    /** Sample as each NMI is taken; the key is the NMI's number since power-on (the recomp's SOE_COMPARE_AT=nmi). */
    atNmi?: boolean;
    /** With atNmi: each NMI's number, master clock and the address it interrupted (a probe). */
    onNmi?: (nmi: number, clock: number, pc: number) => void;
    /** WRAM offsets reported after every emulated frame through `onPeek` (a probe). */
    peek?: number[];
    onPeek?: (frame: number, key: number, clock: number, bytes: number[]) => void;
    /** Lua appended to the script (a probe; it can read `nmi_taken`), and every stdout line no backend line claims. */
    lua?: string;
    onLine?: (line: string) => void;
}

const BUTTON_BITS: [number, string][] = [
    [0x8000, 'b'],
    [0x4000, 'y'],
    [0x2000, 'select'],
    [0x1000, 'start'],
    [0x0800, 'up'],
    [0x0400, 'down'],
    [0x0200, 'left'],
    [0x0100, 'right'],
    [0x0080, 'a'],
    [0x0040, 'x'],
    [0x0020, 'l'],
    [0x0010, 'r'],
];

/** Generate Lua script for Mesen headless runner. */
export function generateMesenLua(job: MesenJob, dumpPath: string, pads: Uint16Array | null): string {
    const isNmi = job.align === 'nmi';
    const stride = job.stride || 60;
    const target = job.dumpAt !== undefined ? job.dumpAt : job.to;
    const dumpAt = job.dumpAt !== undefined ? job.dumpAt : -1;
    const regions = job.regions;

    // Convert noise offsets to a Lua set table
    const noiseList = job.mask ? [...CROSS_NOISE] : [];
    const noiseLua = noiseList.length ? `{ ${noiseList.map(o => `[${o}] = true`).join(', ')} }` : '{}';

    // Button mapping table
    const buttonsLua = BUTTON_BITS.map(([bit, name]) => `{ ${bit}, "${name}" }`).join(', ');

    // Pad inputs array
    let padsLua = '{}';
    if (pads && pads.length > 0) {
        // Lua array of numbers (1-indexed)
        const limit = Math.min(pads.length, isNmi ? job.to * 2 + 2000 : job.to + 100);
        padsLua = `{ ${Array.from(pads.subarray(0, limit)).join(',')} }`;
    }

    // RNG hex bytes if poking
    const rngHex = job.rng ? Buffer.from(job.rng).toString('hex') : null;

    return `
local is_nmi = ${isNmi}
local stride = ${stride}
local target = ${target}
local dump_at = ${dumpAt}
local mask_noise = ${noiseLua}
local pads = ${padsLua}
local buttons = { ${buttonsLua} }
local regions = { ${regions.map(r => `"${r}"`).join(', ')} }
local peek = { ${(job.peek ?? []).join(', ')} }

local wram = emu.memType.snesWorkRam
local vram = emu.memType.snesVideoRam
local cgram = emu.memType.snesCgRam
local oam = emu.memType.snesSpriteRam

local f = 0
local frames = 0
local at_nmi = ${job.atNmi ? 'true' : 'false'}
local nmi_log = ${job.onNmi ? 'true' : 'false'}
local nmi_taken = 0
local raw_last, nmis = -1, 0
local last_key = -1
local rng_done = false

-- CRC32 IEEE 802.3 table
local crc_table = {}
for i = 0, 255 do
  local v = i
  for _ = 1, 8 do
    if (v & 1) ~= 0 then
      v = ((v >> 1) ~ 0xEDB88320) & 0xFFFFFFFF
    else
      v = (v >> 1) & 0xFFFFFFFF
    end
  end
  crc_table[i] = v
end

local function crc32_mem(mtype, size, is_wram_mask)
  local c = 0xFFFFFFFF
  for i = 0, size - 1 do
    local b = emu.read(i, mtype, false)
    if is_wram_mask and mask_noise[i] then b = 0 end
    c = (crc_table[(c ~ b) & 0xFF] ~ (c >> 8)) & 0xFFFFFFFF
  end
  return (c ~ 0xFFFFFFFF) & 0xFFFFFFFF
end

-- The testrunner's Lua has no io library: the dump goes to stdout as hex lines, 64 bytes each.
local function dump_regions()
  for _, r in ipairs(regions) do
    local mtype, size = wram, 0x20000
    if r == "vram" then mtype, size = vram, 0x10000
    elseif r == "cgram" then mtype, size = cgram, 0x200
    elseif r == "oam" then mtype, size = oam, 0x220 end
    for base = 0, size - 1, 64 do
      local parts = {}
      for i = base, math.min(base + 63, size - 1) do
        parts[#parts + 1] = string.format("%02X", emu.read(i, mtype, false))
      end
      print("X " .. table.concat(parts))
    end
  end
end

-- Inject pad inputs
emu.addEventCallback(function()
  local v = pads[frames + 1] or 0  -- by emulated frame: f stands still while NMI is off
  local inp = {}
  for _, b in ipairs(buttons) do
    if (v & b[1]) ~= 0 then inp[b[2]] = true end
  end
  emu.setInput(inp, 0)
end, emu.eventType.inputPolled)

local function sample(key)
  -- Checkpoint hash
  if (key % stride == 0 or key >= target) and dump_at < 0 then
    local out = "H " .. key
    for _, r in ipairs(regions) do
      local c = 0
      if r == "wram" then c = crc32_mem(wram, 0x20000, true)
      elseif r == "vram" then c = crc32_mem(vram, 0x10000, false)
      elseif r == "cgram" then c = crc32_mem(cgram, 0x200, false)
      elseif r == "oam" then c = crc32_mem(oam, 0x220, false) end
      out = out .. " " .. string.format("%08X", c)
    end
    print(out)
  end

  -- Dump if requested
  if dump_at >= 0 and key >= dump_at then
    dump_regions()
    print("D " .. key)
    emu.stop(0)
    return true
  end

  if key >= target then
    print("DONE " .. key)
    emu.stop(0)
    return true
  end
  return false
end

-- End of frame processing: check counter and compute checkpoints
emu.addEventCallback(function()
  -- The key is the NMI count since the reset code's 0: the attract demo zeroes $0100 when it loops,
  -- so a drop counts as a restart from 0 (the recomp glue's SOE_COMPARE key does the same).
  local raw = emu.read(0x0100, wram, false) | (emu.read(0x0101, wram, false) << 8)
  if raw_last < 0 then
    if raw == 0 then raw_last = 0 end
  elseif raw ~= raw_last then
    if raw > raw_last then nmis = nmis + raw - raw_last
    elseif raw_last > 0xFF00 then nmis = nmis + raw + 0x10000 - raw_last
    else nmis = nmis + raw end
    raw_last = raw
  end
  local cnt = raw_last < 0 and -1 or nmis
  local key = is_nmi and cnt or (f + 1)
  if #peek > 0 then
    local parts = { "P " .. frames .. " " .. cnt .. " " .. emu.getState()["masterClock"] }
    for _, a in ipairs(peek) do parts[#parts + 1] = string.format("%02x", emu.read(a, wram, false)) end
    print(table.concat(parts, " "))
  end
  frames = frames + 1

  if is_nmi then
    if key < 0 or key <= last_key then return end
  end
  last_key = key

  -- Poke RNG if target
  ${rngHex ? `
  if not rng_done and key >= ${SYNC_AT} then
    local rh = "${rngHex}"
    for i = 1, #rh, 2 do
      local b = tonumber(rh:sub(i, i + 1), 16)
      emu.write(${RNG[0]} + (i - 1) // 2, b, wram)
    end
    rng_done = true
  end
  ` : `
  if not rng_done and key >= ${SYNC_AT} then
    local rh = ""
    for a = ${RNG[0]}, ${RNG[1] - 1} do
      rh = rh .. string.format("%02X", emu.read(a, wram, false))
    end
    print("RNG " .. rh .. " " .. frames)
    rng_done = true
  end
  `}

  if not at_nmi and sample(key) then return end

  f = f + 1
end, emu.eventType.endFrame)

-- at_nmi: sample as each NMI is taken (after its frame is pushed); the key is the NMI's number since power-on.
if at_nmi then
  emu.addEventCallback(function()
    nmi_taken = nmi_taken + 1
    if nmi_log then
      local st = emu.getState()
      local sp = st["cpu.sp"]
      local pc = emu.read((sp + 2) & 0xFFFF, wram, false) | (emu.read((sp + 3) & 0xFFFF, wram, false) << 8) | (emu.read((sp + 4) & 0xFFFF, wram, false) << 16)
      print(string.format("N %d %d %06x", nmi_taken, st["masterClock"], pc))
    end
    sample(nmi_taken)
  end, emu.eventType.nmi)
end
${job.lua ?? ''}
`;
}

/** Run Mesen headless; `onCp` gets each checkpoint. Resolves with dump when dumpAt was set. */
export function runMesen(job: MesenJob, onCp: (key: number, crcs: Crcs) => void): { done: Promise<Uint8Array[] | null>; kill(): void } {
    const exe = job.exe || defaultMesenExe();
    if (!existsSync(exe)) throw new Error(`no Mesen executable at ${exe} (install Mesen or set MESEN environment variable)`);

    const dir = mkdtempSync(join(tmpdir(), 'soe-mesen-'));
    const luaPath = join(dir, 'compare.lua');
    const dumpPath = join(dir, 'dump.bin');

    let pads: Uint16Array | null = null;
    if (job.replay) {
        const { parseMovie } = require('../../dist/platform/tas/movie');
        pads = parseMovie(readFileSync(job.replay, 'utf8'), job.replay).pads;
    }

    const script = generateMesenLua(job, dumpPath, pads);
    writeFileSync(luaPath, script);

    const child = spawn(exe, ['--testrunner', job.rom, luaPath, '--snes.ramPowerOnState=AllZeros'], {
        cwd: dir,
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    let log = '';
    child.stderr?.on('data', d => { log = (log + d).slice(-4000); });
    let dump: Uint8Array[] | null = null;
    const hex: string[] = [];
    let sawDone = false;

    let rest = '';
    child.stdout?.on('data', (d: Buffer) => {
        const lines = (rest + d.toString('utf8')).split('\n');
        rest = lines.pop()!;   // a line can span two chunks
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            if (trimmed.startsWith('H ')) {
                const parts = trimmed.split(' ');
                const key = Number(parts[1]);
                const crcs = parts.slice(2).map(x => parseInt(x, 16));
                onCp(key, crcs);
            } else if (trimmed.startsWith('N ')) {
                const p = trimmed.split(' ');
                job.onNmi?.(Number(p[1]), Number(p[2]), parseInt(p[3], 16));
            } else if (trimmed.startsWith('P ')) {
                const p = trimmed.split(' ');
                job.onPeek?.(Number(p[1]), Number(p[2]), Number(p[3]), p.slice(4).map(x => parseInt(x, 16)));
            } else if (trimmed.startsWith('X ')) {
                hex.push(trimmed.slice(2));
            } else if (trimmed.startsWith('D ')) {
                sawDone = true;
                const raw = Buffer.from(hex.join(''), 'hex');
                let off = 0;
                dump = job.regions.map(r => {
                    const slice = new Uint8Array(raw.subarray(off, off + REGION_SIZE[r]));
                    off += REGION_SIZE[r];
                    return slice;
                });
            } else if (trimmed.startsWith('DONE ')) {
                sawDone = true;
            } else job.onLine?.(trimmed);
        }
    });

    const done = new Promise<Uint8Array[] | null>((resolve, reject) => {
        child.on('close', code => {
            rmSync(dir, { recursive: true, force: true });
            // Mesen testrunner can exit 255 even on emu.stop(0) (reference-emulators skill trap)
            if (code !== 0 && code !== 255 && !sawDone && !dump && child.signalCode === null) {
                reject(new Error(`Mesen exited with ${code}: ${log.trim().split('\n').slice(-3).join(' | ')}`));
            } else {
                resolve(dump);
            }
        });
    });

    return { done, kill: () => { if (child.exitCode === null) child.kill(); } };
}

/** Sample RNG from Mesen at key SYNC_AT, and the frame it was taken after (where a recomp replay pokes it in). */
export function askMesenRng(job: MesenJob): Promise<{ bytes: Uint8Array; frame: number }> {
    return new Promise((resolve, reject) => {
        const exe = job.exe || defaultMesenExe();
        if (!existsSync(exe)) return reject(new Error(`no Mesen executable at ${exe}`));
        const dir = mkdtempSync(join(tmpdir(), 'soe-mesen-rng-'));
        const luaPath = join(dir, 'rng.lua');
        const dumpPath = join(dir, 'dump.bin');

        let pads: Uint16Array | null = null;
        if (job.replay) {
            const { parseMovie } = require('../../dist/platform/tas/movie');
            pads = parseMovie(readFileSync(job.replay, 'utf8'), job.replay).pads;
        }
        const script = generateMesenLua({ ...job, to: SYNC_AT, dumpAt: undefined, rng: null, peek: [] }, dumpPath, pads);
        writeFileSync(luaPath, script);

        const child = spawn(exe, ['--testrunner', job.rom, luaPath, '--snes.ramPowerOnState=AllZeros'], {
            cwd: dir,
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        let rngBytes: Uint8Array | null = null, rngFrame = 0;
        child.stdout?.on('data', (d: Buffer) => {
            const text = d.toString('utf8');
            for (const line of text.split('\n')) {
                const trimmed = line.trim();
                if (trimmed.startsWith('RNG ')) {
                    const [hex, frame] = trimmed.slice(4).trim().split(' ');
                    rngBytes = new Uint8Array(Buffer.from(hex, 'hex'));
                    rngFrame = Number(frame);
                    child.kill();
                }
            }
        });

        child.on('exit', () => {
            rmSync(dir, { recursive: true, force: true });
            if (rngBytes) resolve({ bytes: rngBytes, frame: rngFrame });
            else reject(new Error('Mesen ended without returning RNG bytes'));
        });
    });
}

