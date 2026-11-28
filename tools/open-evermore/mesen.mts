// Headless MesenCE runner for Open Evermore demo and ROM verification (docs/open-evermore/demos.md §3).
// Reuses the `--testrunner` + `--snes.ramPowerOnState=AllZeros` automation pattern from tools/exhirom/mesen.js,
// ignoring Mesen's OS exit code (it may exit 255 even on clean emu.stop(0)) and judging pass/fail from stdout lines.
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { decodePng } = require('../../dist/platform/png');

const DEFAULT_MESEN = '/Applications/Mesen.app/Contents/MacOS/Mesen';

export interface MesenCheck {
    name: string;
    ok: boolean;
    detail?: string;
}

export interface PngRgbStats {
    width: number;
    height: number;
    totalPixels: number;
    nonBlackPixels: number;
    meanR: number;
    meanG: number;
    meanB: number;
    purplePixels: number;
}

export interface MesenRunResult {
    ok: boolean;
    done: boolean;
    checks: MesenCheck[];
    screenshots: Map<string, Uint8Array>;
    stdout: string;
    stderr: string;
    exitCode: number | null;
    timedOut: boolean;
}

export function findMesen(override?: string): string | null {
    const candidates = [override, process.env.MESEN, DEFAULT_MESEN, 'mesen', 'Mesen'].filter((x): x is string => Boolean(x));
    for (const c of candidates) {
        if (c.includes('/')) {
            if (existsSync(c)) return c;
            continue;
        }
        for (const dir of (process.env.PATH ?? '').split(':')) {
            if (!dir) continue;
            const full = join(dir, c);
            if (existsSync(full)) return full;
        }
    }
    return null;
}

export function parseMesenStdout(stdout: string): {
    done: boolean;
    checks: MesenCheck[];
    screenshots: Map<string, Uint8Array>;
} {
    let done = false;
    const checks: MesenCheck[] = [];
    const screenshots = new Map<string, Uint8Array>();

    for (const rawLine of stdout.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line) continue;
        if (line.startsWith('OE_PASS ')) {
            try {
                const payload = JSON.parse(line.slice('OE_PASS '.length));
                checks.push({ name: String(payload.name ?? 'check'), ok: true, detail: payload.detail ? String(payload.detail) : undefined });
            } catch {
                checks.push({ name: 'parse', ok: false, detail: `Malformed OE_PASS JSON: ${line}` });
            }
        } else if (line.startsWith('OE_FAIL ')) {
            try {
                const payload = JSON.parse(line.slice('OE_FAIL '.length));
                checks.push({ name: String(payload.name ?? 'check'), ok: false, detail: payload.detail ? String(payload.detail) : undefined });
            } catch {
                checks.push({ name: 'parse', ok: false, detail: `Malformed OE_FAIL JSON: ${line}` });
            }
        } else if (line.startsWith('OE_DONE')) {
            done = true;
        } else if (line.startsWith('OE_PNGHEX ')) {
            const rest = line.slice('OE_PNGHEX '.length);
            const sp = rest.indexOf(' ');
            if (sp > 0) {
                const name = rest.slice(0, sp).trim();
                const hex = rest.slice(sp + 1).trim();
                if (name && hex.length >= 16 && hex.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(hex)) {
                    screenshots.set(name, new Uint8Array(Buffer.from(hex, 'hex')));
                }
            }
        }
    }
    return { done, checks, screenshots };
}

export function parsePngRgbStats(pngBytes: Uint8Array): PngRgbStats {
    const img: { width: number; height: number; rgba: Uint8Array } = decodePng(pngBytes);
    const totalPixels = img.width * img.height;
    let nonBlackPixels = 0;
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let purplePixels = 0;

    for (let i = 0; i < img.rgba.length; i += 4) {
        const r = img.rgba[i];
        const g = img.rgba[i + 1];
        const b = img.rgba[i + 2];
        sumR += r;
        sumG += g;
        sumB += b;
        if (r + g + b >= 24) nonBlackPixels++;
        if (r >= 40 && b >= 40 && r > g + 16 && b > g + 16) purplePixels++;
    }

    const denom = Math.max(1, totalPixels);
    return {
        width: img.width,
        height: img.height,
        totalPixels,
        nonBlackPixels,
        meanR: sumR / denom,
        meanG: sumG / denom,
        meanB: sumB / denom,
        purplePixels,
    };
}

export async function runMesenScript(opts: {
    mesen: string;
    rom: Uint8Array;
    lua: string;
    tag: string;
    outDir?: string;
    timeoutMs?: number;
}): Promise<MesenRunResult> {
    const workDir = mkdtempSync(join(tmpdir(), 'oe-mesen-'));
    const romPath = join(workDir, `${opts.tag.replace(/[^a-z0-9_-]/gi, '_')}-${randomUUID().slice(0, 8)}.sfc`);
    const luaPath = join(workDir, 'verify.lua');
    writeFileSync(romPath, opts.rom);
    writeFileSync(luaPath, opts.lua);

    try {
        const exec = await new Promise<{ stdout: string; stderr: string; code: number | null; timedOut: boolean }>((resolve) => {
            const p = spawn(opts.mesen, ['--testrunner', romPath, luaPath, '--snes.ramPowerOnState=AllZeros'], {
                cwd: workDir,
                stdio: ['ignore', 'pipe', 'pipe'],
            });
            let stdout = '';
            let stderr = '';
            let timedOut = false;
            p.stdout.on('data', (d) => { stdout += d.toString(); });
            p.stderr.on('data', (d) => { stderr += d.toString(); });
            const timer = setTimeout(() => {
                timedOut = true;
                p.kill('SIGKILL');
            }, opts.timeoutMs ?? 60_000);
            p.on('close', (code) => {
                clearTimeout(timer);
                resolve({ stdout, stderr, code, timedOut });
            });
        });

        const parsed = parseMesenStdout(exec.stdout);
        if (opts.outDir && parsed.screenshots.size > 0) {
            mkdirSync(opts.outDir, { recursive: true });
            for (const [name, png] of parsed.screenshots) {
                const safeName = name.replace(/[^a-z0-9_.-]/gi, '_');
                writeFileSync(join(opts.outDir, `${safeName}.png`), png);
            }
        }
        const ok = !exec.timedOut && parsed.done && parsed.checks.length > 0 && parsed.checks.every((c) => c.ok);
        return {
            ok,
            done: parsed.done,
            checks: parsed.checks,
            screenshots: parsed.screenshots,
            stdout: exec.stdout,
            stderr: exec.stderr,
            exitCode: exec.code,
            timedOut: exec.timedOut,
        };
    } finally {
        rmSync(workDir, { recursive: true, force: true });
    }
}
