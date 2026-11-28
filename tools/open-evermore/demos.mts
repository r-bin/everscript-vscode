// Playable Open Evermore demo loader, overlay/recipe applier, and headless MesenCE verifier
// (docs/open-evermore/demos.md). Keeps only clean JSON recipes, scripts, and verify Lua in git;
// transforms are applied onto a freshly exploded tree in memory or under out/.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { assembleWithAsar, findAsar } from './asar-project.mts';
import type { Codec } from './codec.mts';
import { selectRelease } from './evermore/map.mts';
import { explode } from './explode.mts';
import { implode } from './implode.mts';
import type { PastEnd } from './layouts.mts';
import { findMesen, parsePngRgbStats, runMesenScript } from './mesen.mts';
import type { MesenCheck, PngRgbStats } from './mesen.mts';
import { json, readText, sha1, text, writeTree } from './tree.mts';
import type { Tree } from './tree.mts';

export const DEMOS_DIR = join(dirname(new URL(import.meta.url).pathname), 'demos');

export type DemoTransform =
    | { op: 'cloneDir'; from: string; to: string; exclude?: string[] }
    | { op: 'cloneFile'; from: string; to: string }
    | { op: 'copyFiles'; from?: string }
    | { op: 'writeText'; target: string; content: string }
    | { op: 'writeJson'; target: string; value: unknown }
    | { op: 'patchJson'; target: string; set?: Record<string, unknown>; delete?: string[] }
    | { op: 'appendEnum'; target: string; names: string[] }
    | { op: 'shiftPalette'; target: string; rgbScale: [number, number, number]; rgbBias?: [number, number, number]; skipIndex0?: boolean };

export interface ScreenshotExpect {
    name?: string;
    minNonBlackPixels?: number;
    dominantChannel?: 'red' | 'green' | 'blue';
    minPurplePixels?: number;
}

export interface DemoManifest {
    name: string;
    title: string;
    status: 'ready' | 'blocked';
    blockedReason?: string;
    release: string;
    description?: string;
    transforms: DemoTransform[];
    scene?: {
        description?: string;
        transforms: DemoTransform[];
    };
    verify?: {
        maxFrames?: number;
        screenshotExpect?: ScreenshotExpect;
    };
}

export interface DemoEntry {
    name: string;
    dir: string;
    manifest: DemoManifest;
    verifyLua: string | null;
}

export interface DemoVerifyReport {
    name: string;
    title: string;
    ok: boolean;
    warnings: string[];
    errors: string[];
    asarVerified: boolean | null;
    mesenChecks: MesenCheck[];
    baselineFailed: boolean | null;
    screenshotStats?: PngRgbStats;
    detail?: string;
}

const KNOWN_OPS = new Set([
    'cloneDir', 'cloneFile', 'copyFiles', 'writeText', 'writeJson', 'patchJson', 'appendEnum', 'shiftPalette',
]);

function validateTransforms(list: unknown, prefix: string, errors: string[]): void {
    if (!Array.isArray(list)) { errors.push(`${prefix}: expected array`); return; }
    list.forEach((op, i) => {
        if (!op || typeof op !== 'object') { errors.push(`${prefix}[${i}]: expected object`); return; }
        const r = op as Record<string, unknown>;
        if (typeof r.op !== 'string' || !KNOWN_OPS.has(r.op)) {
            errors.push(`${prefix}[${i}].op: unknown op ${JSON.stringify(r.op)}`);
            return;
        }
        if ((r.op === 'cloneDir' || r.op === 'cloneFile') && (typeof r.from !== 'string' || typeof r.to !== 'string')) {
            errors.push(`${prefix}[${i}]: ${r.op} requires string from and to`);
        } else if ((r.op === 'writeText' || r.op === 'patchJson' || r.op === 'appendEnum' || r.op === 'shiftPalette' || r.op === 'writeJson') && typeof r.target !== 'string') {
            errors.push(`${prefix}[${i}]: ${r.op} requires string target`);
        }
        if (r.op === 'writeText' && typeof r.content !== 'string') errors.push(`${prefix}[${i}]: writeText requires string content`);
        if (r.op === 'writeJson' && !('value' in r)) errors.push(`${prefix}[${i}]: writeJson requires value`);
        if (r.op === 'appendEnum' && (!Array.isArray(r.names) || r.names.some((n) => typeof n !== 'string'))) {
            errors.push(`${prefix}[${i}]: appendEnum requires string[] names`);
        }
        if (r.op === 'shiftPalette' && (!Array.isArray(r.rgbScale) || r.rgbScale.length !== 3)) {
            errors.push(`${prefix}[${i}]: shiftPalette requires [r, g, b] rgbScale`);
        }
    });
}

export function validateDemoManifest(raw: unknown, dirName: string): string[] {
    const errors: string[] = [];
    if (!raw || typeof raw !== 'object') return ['manifest must be a JSON object'];
    const m = raw as Record<string, unknown>;
    if (m.name !== dirName) errors.push(`name ${JSON.stringify(m.name)} must match folder name ${JSON.stringify(dirName)}`);
    if (typeof m.name !== 'string' || !/^[a-z0-9_]+$/.test(m.name)) errors.push('name must be snake_case');
    if (typeof m.title !== 'string' || !m.title.trim()) errors.push('title must be a non-empty string');
    if (m.status !== 'ready' && m.status !== 'blocked') errors.push('status must be "ready" or "blocked"');
    if (m.release !== 'us') errors.push('release must be "us"');
    validateTransforms(m.transforms, 'transforms', errors);
    if (m.scene !== undefined) {
        if (!m.scene || typeof m.scene !== 'object') errors.push('scene must be an object');
        else validateTransforms((m.scene as Record<string, unknown>).transforms, 'scene.transforms', errors);
    }
    return errors;
}

export function loadDemo(name: string, root = DEMOS_DIR): DemoEntry {
    const dir = join(root, name);
    const manifestPath = join(dir, 'demo.json');
    if (!existsSync(manifestPath)) throw new Error(`Demo "${name}" not found (${manifestPath})`);
    const raw = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const errors = validateDemoManifest(raw, name);
    if (errors.length) throw new Error(`Invalid demo manifest ${manifestPath}: ${errors.join('; ')}`);
    const luaPath = join(dir, 'verify.lua');
    return {
        name,
        dir,
        manifest: raw as DemoManifest,
        verifyLua: existsSync(luaPath) ? readFileSync(luaPath, 'utf8') : null,
    };
}

export function listDemos(opts: { includeBlocked?: boolean; root?: string } = {}): DemoEntry[] {
    const root = opts.root ?? DEMOS_DIR;
    if (!existsSync(root)) return [];
    const entries = readdirSync(root)
        .filter((d) => statSync(join(root, d)).isDirectory() && existsSync(join(root, d, 'demo.json')))
        .sort()
        .map((d) => loadDemo(d, root));
    return opts.includeBlocked ? entries : entries.filter((e) => e.manifest.status === 'ready');
}

function setByPath(root: Record<string, unknown>, pathSpec: string, value: unknown): void {
    const parts = pathSpec.split('/').filter(Boolean);
    if (!parts.length) throw new Error('empty patchJson key path');
    let cur: Record<string, unknown> | unknown[] = root;
    for (let i = 0; i < parts.length - 1; i++) {
        const key = parts[i];
        const nextIsIndex = /^\d+$/.test(parts[i + 1]);
        if (Array.isArray(cur)) {
            const idx = Number(key);
            if (!cur[idx] || typeof cur[idx] !== 'object') cur[idx] = nextIsIndex ? [] : {};
            cur = cur[idx] as Record<string, unknown> | unknown[];
        } else {
            if (!cur[key] || typeof cur[key] !== 'object') cur[key] = nextIsIndex ? [] : {};
            cur = cur[key] as Record<string, unknown> | unknown[];
        }
    }
    const last = parts[parts.length - 1];
    if (Array.isArray(cur)) cur[Number(last)] = value;
    else cur[last] = value;
}

function deleteByPath(root: Record<string, unknown>, pathSpec: string): void {
    const parts = pathSpec.split('/').filter(Boolean);
    if (!parts.length) return;
    let cur: Record<string, unknown> | unknown[] = root;
    for (let i = 0; i < parts.length - 1; i++) {
        const key = parts[i];
        const next = Array.isArray(cur) ? cur[Number(key)] : cur[key];
        if (!next || typeof next !== 'object') return;
        cur = next as Record<string, unknown> | unknown[];
    }
    const last = parts[parts.length - 1];
    if (Array.isArray(cur)) cur.splice(Number(last), 1);
    else delete cur[last];
}

function walkLocalFiles(dir: string, rel = ''): Array<{ rel: string; bytes: Uint8Array }> {
    const out: Array<{ rel: string; bytes: Uint8Array }> = [];
    for (const name of readdirSync(dir).sort()) {
        const full = join(dir, name);
        const nextRel = rel ? `${rel}/${name}` : name;
        if (statSync(full).isDirectory()) out.push(...walkLocalFiles(full, nextRel));
        else out.push({ rel: nextRel, bytes: new Uint8Array(readFileSync(full)) });
    }
    return out;
}

const quantize5Bit = (v: number) => Math.max(0, Math.min(248, Math.round(v / 8) * 8));

function applyOp(tree: Tree, demoDir: string, op: DemoTransform): void {
    if (op.op === 'cloneDir') {
        const prefix = op.from.endsWith('/') ? op.from : `${op.from}/`;
        const dstPrefix = op.to.endsWith('/') ? op.to : `${op.to}/`;
        const excl = new Set(op.exclude ?? []);
        let copied = 0;
        for (const [k, v] of [...tree.entries()]) {
            if (!k.startsWith(prefix)) continue;
            const rel = k.slice(prefix.length);
            if (excl.has(rel)) continue;
            tree.set(dstPrefix + rel, new Uint8Array(v));
            copied++;
        }
        if (!copied) throw new Error(`cloneDir: no files under ${op.from}`);
        return;
    }
    if (op.op === 'cloneFile') {
        const src = tree.get(op.from);
        if (!src) throw new Error(`cloneFile: missing ${op.from}`);
        tree.set(op.to, new Uint8Array(src));
        return;
    }
    if (op.op === 'copyFiles') {
        const srcDir = join(demoDir, op.from ?? 'files');
        if (!existsSync(srcDir)) throw new Error(`copyFiles: missing ${srcDir}`);
        for (const f of walkLocalFiles(srcDir)) tree.set(f.rel, f.bytes);
        return;
    }
    if (op.op === 'writeText') {
        tree.set(op.target, text(op.content));
        return;
    }
    if (op.op === 'writeJson') {
        tree.set(op.target, json(op.value));
        return;
    }
    if (op.op === 'patchJson') {
        const raw = tree.get(op.target);
        if (!raw) throw new Error(`patchJson: missing ${op.target}`);
        const doc = JSON.parse(readText(raw)) as Record<string, unknown>;
        for (const [p, v] of Object.entries(op.set ?? {})) setByPath(doc, p, v);
        for (const p of op.delete ?? []) deleteByPath(doc, p);
        tree.set(op.target, json(doc));
        return;
    }
    if (op.op === 'appendEnum') {
        const raw = tree.get(op.target);
        if (!raw) throw new Error(`appendEnum: missing ${op.target}`);
        const doc = JSON.parse(readText(raw)) as { names: Array<string | null>; [k: string]: unknown };
        for (const name of op.names) if (!doc.names.includes(name)) doc.names.push(name);
        tree.set(op.target, json(doc));
        return;
    }
    if (op.op === 'shiftPalette') {
        const raw = tree.get(op.target);
        if (!raw) throw new Error(`shiftPalette: missing ${op.target}`);
        const doc = JSON.parse(readText(raw)) as { colours: string[]; [k: string]: unknown };
        const [sr, sg, sb] = op.rgbScale;
        const [br, bg, bb] = op.rgbBias ?? [0, 0, 0];
        const skip0 = op.skipIndex0 !== false;
        doc.colours = doc.colours.map((hexStr, idx) => {
            if (skip0 && idx === 0) return hexStr;
            const r = parseInt(hexStr.slice(1, 3), 16);
            const g = parseInt(hexStr.slice(3, 5), 16);
            const b = parseInt(hexStr.slice(5, 7), 16);
            const nr = quantize5Bit(r * sr + br);
            const ng = quantize5Bit(g * sg + bg);
            const nb = quantize5Bit(b * sb + bb);
            return '#' + [nr, ng, nb].map((c) => c.toString(16).padStart(2, '0')).join('');
        });
        delete doc.maps;
        delete doc.used_by;
        tree.set(op.target, json(doc));
    }
}

export function applyDemo(tree: Tree, demo: DemoEntry, opts: { noScene?: boolean } = {}): Tree {
    const out: Tree = new Map();
    for (const [k, v] of tree) out.set(k, new Uint8Array(v));
    for (const op of demo.manifest.transforms) applyOp(out, demo.dir, op);
    if (!opts.noScene && demo.manifest.scene) {
        for (const op of demo.manifest.scene.transforms) applyOp(out, demo.dir, op);
    }
    return out;
}

export function applyDemos(tree: Tree, demos: DemoEntry[], opts: { noScene?: boolean } = {}): Tree {
    let cur = new Map<string, Uint8Array>();
    for (const [k, v] of tree) cur.set(k, new Uint8Array(v));
    for (const demo of demos) cur = applyDemo(cur, demo, opts);
    return cur;
}

export interface VerifyDemoOptions {
    demo: DemoEntry;
    baseRom: Uint8Array;
    baseTree?: Tree;
    game: string;
    kinds: Codec[];
    pastEnd: PastEnd[];
    randomSeed?: number;
    checkAsar?: boolean;
    asarBin?: string;
    mesenBin?: string;
    checkBaseline?: boolean;
    outDir?: string;
}

function checkScreenshot(stats: PngRgbStats, spec: ScreenshotExpect): string | null {
    if (spec.minNonBlackPixels !== undefined && stats.nonBlackPixels < spec.minNonBlackPixels) {
        return `nonBlackPixels ${stats.nonBlackPixels} < ${spec.minNonBlackPixels}`;
    }
    if (spec.minPurplePixels !== undefined && stats.purplePixels < spec.minPurplePixels) {
        return `purplePixels ${stats.purplePixels} < ${spec.minPurplePixels}`;
    }
    if (spec.dominantChannel === 'blue' && !(stats.meanB > stats.meanR && stats.meanB > stats.meanG)) {
        return `blue not dominant (R=${stats.meanR.toFixed(1)}, G=${stats.meanG.toFixed(1)}, B=${stats.meanB.toFixed(1)})`;
    }
    if (spec.dominantChannel === 'red' && !(stats.meanR > stats.meanG && stats.meanR > stats.meanB)) {
        return `red not dominant (R=${stats.meanR.toFixed(1)}, G=${stats.meanG.toFixed(1)}, B=${stats.meanB.toFixed(1)})`;
    }
    if (spec.dominantChannel === 'green' && !(stats.meanG > stats.meanR && stats.meanG > stats.meanB)) {
        return `green not dominant (R=${stats.meanR.toFixed(1)}, G=${stats.meanG.toFixed(1)}, B=${stats.meanB.toFixed(1)})`;
    }
    return null;
}

export async function verifyDemo(opts: VerifyDemoOptions): Promise<DemoVerifyReport> {
    const { demo, baseRom, game, kinds, pastEnd } = opts;
    const baseTree = opts.baseTree ?? explode(baseRom, { release: demo.manifest.release, sha1: sha1(baseRom), explodedWith: 'demo-verify' }, game, kinds);
    const applied = applyDemo(baseTree, demo, { noScene: false });
    const built = implode(applied, game, kinds, {
        seed: opts.randomSeed,
        pastEnd,
        emitAsar: !!opts.checkAsar,
    });

    const errors = built.findings.list.filter((f) => f.severity === 'error').map((f) => `${f.rule} ${f.file}: ${f.message}`);
    const warnings = built.findings.list.filter((f) => f.severity === 'warning').map((f) => `${f.rule} ${f.file}: ${f.message}`);
    if (errors.length || !built.image) {
        return {
            name: demo.name, title: demo.manifest.title, ok: false, warnings, errors,
            asarVerified: null, mesenChecks: [], baselineFailed: null, detail: 'implode failed',
        };
    }

    let asarVerified: boolean | null = null;
    if (opts.checkAsar) {
        const bin = findAsar(opts.asarBin);
        if (bin && built.asar) {
            const tmp = mkdtempSync(join(tmpdir(), 'oe-demo-asar-'));
            try {
                writeTree(tmp, new Map([...applied].filter(([p]) => p.startsWith('code/'))));
                const asarDir = join(tmp, '_build', 'asar');
                writeTree(asarDir, built.asar);
                const res = assembleWithAsar(asarDir, join(tmp, '_build', 'out.sfc'), bin);
                const expected = built.layout?.startsWith('HiROM') ? built.image : built.content!;
                asarVerified = res.ok && sha1(res.image!) === sha1(expected);
                if (!asarVerified) errors.push(res.ok ? 'asar SHA-1 mismatch' : `asar failed: ${res.error}`);
            } finally {
                rmSync(tmp, { recursive: true, force: true });
            }
        }
    }

    if (!demo.verifyLua) {
        return {
            name: demo.name, title: demo.manifest.title, ok: errors.length === 0, warnings, errors,
            asarVerified, mesenChecks: [], baselineFailed: null, detail: 'no verify.lua',
        };
    }

    const mesen = findMesen(opts.mesenBin);
    if (!mesen) {
        return {
            name: demo.name, title: demo.manifest.title, ok: false, warnings,
            errors: [...errors, 'Mesen executable not found'],
            asarVerified, mesenChecks: [], baselineFailed: null,
        };
    }

    const run = await runMesenScript({ mesen, rom: built.image, lua: demo.verifyLua, tag: demo.name, outDir: opts.outDir });
    const checks = [...run.checks];
    let screenshotStats: PngRgbStats | undefined;

    if (run.screenshots.size > 0) {
        const spec = demo.manifest.verify?.screenshotExpect;
        const shotName = spec?.name ?? demo.name;
        const png = run.screenshots.get(shotName) ?? [...run.screenshots.values()][0];
        if (png) {
            screenshotStats = parsePngRgbStats(png);
            if (spec) {
                const err = checkScreenshot(screenshotStats, spec);
                checks.push({ name: 'screenshot_rgb', ok: !err, detail: err ?? `nonBlack=${screenshotStats.nonBlackPixels} rgb=(${screenshotStats.meanR.toFixed(1)},${screenshotStats.meanG.toFixed(1)},${screenshotStats.meanB.toFixed(1)})` });
            }
        }
    } else if (demo.manifest.verify?.screenshotExpect) {
        checks.push({ name: 'screenshot_present', ok: false, detail: 'no OE_PNGHEX screenshot emitted' });
    }

    if (!run.done || run.timedOut) {
        errors.push(run.timedOut ? 'Mesen timed out' : 'Mesen script did not emit OE_DONE');
    }
    for (const c of checks) if (!c.ok) errors.push(`mesen check "${c.name}" failed: ${c.detail ?? 'no detail'}`);

    let baselineFailed: boolean | null = null;
    if (opts.checkBaseline !== false) {
        const baseRun = await runMesenScript({ mesen, rom: baseRom, lua: demo.verifyLua, tag: `${demo.name}-baseline` });
        baselineFailed = !baseRun.ok;
        if (!baselineFailed) {
            errors.push('baseline negative check passed on unmodified ROM (assertions are vacuous)');
        }
    }

    return {
        name: demo.name,
        title: demo.manifest.title,
        ok: errors.length === 0,
        warnings,
        errors,
        asarVerified,
        mesenChecks: checks,
        baselineFailed,
        screenshotStats,
    };
}

export async function loadRuntime(release: string | null | undefined) {
    selectRelease(release);
    const { GAME, KINDS, PAST_END } = await import('./evermore/kinds.mts');
    return { GAME, KINDS, PAST_END };
}
