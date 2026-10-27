// Ownership: Everscript: Build and Run — compile the active .evs with the everscript compiler, then
// load the output ROM into the emulator. Also the debugger's build step ({ inputPath, run: false }).
// Injected by extension.js: getExtConfig (compiler and paths), openEmulatorPanel, romPathFor (the ROM library),
// invalidateRoomCaches (the Rooms tab's caches after the ROM changed).

import * as vscode from 'vscode';
import * as nodePath from 'path';
import * as nodeFs from 'fs';
import * as nodeOs from 'os';
import * as cp from 'child_process';
import * as romReaders from '../rom-readers';
import { missingRomText } from '../../../platform/roms/library';

interface BuildConfig { repoPath?: string | null; patchesDir?: string | null; compilerPath?: string | null; pythonPath?: string | null }
interface BuildDeps {
    getExtConfig(): BuildConfig;
    openEmulatorPanel(context: vscode.ExtensionContext, rom: { dataUrl: string; name: string; filePath: string; kind: string } | undefined, channel: vscode.OutputChannel): void;
    romPathFor(game: string): string | null;
    invalidateRoomCaches(): void;
}

function registerBuildAndRun(context: vscode.ExtensionContext, { getExtConfig, openEmulatorPanel, romPathFor, invalidateRoomCaches }: BuildDeps) {
// ── Build-and-Run ────────────────────────────────────────────────────────
// Options (the debugger's launch): { inputPath, run: false } builds without
// loading the ROM. Resolves to { ok, outputRom }. Menus pass a Uri instead.
context.subscriptions.push(
    vscode.commands.registerCommand('everscript.buildAndRun', async (options?: { inputPath?: string; run?: boolean }) => {
        const opts = options && typeof options.inputPath === 'string' ? options : {};
        const editor = vscode.window.activeTextEditor;
        const inputFile = opts.inputPath
            || (editor && editor.document.languageId === 'everscript' ? editor.document.uri.fsPath : '');
        if (!inputFile) {
            vscode.window.showWarningMessage('Everscript: no .evs file is active.');
            return { ok: false };
        }

        const cfg       = vscode.workspace.getConfiguration('everscript');
        const extCfg    = getExtConfig();

        // ── 1. Resolve compiler and project root ───────────────────────
        let repoPath    = extCfg.repoPath || '';
        let patchesPath = extCfg.patchesDir || '';
        let romPath     = romPathFor('evermore') || ''; // the Evermore ROM of the ROM library
        let compilerBin = extCfg.compilerPath || ''; // manual override
        let projectRoot = repoPath;
        let useScript   = false;

        // Prefer everscript.py in the repo root (Python-based compiler).
        if (repoPath && nodeFs.existsSync(nodePath.join(repoPath, 'everscript.py'))) {
            useScript = true;
            if (!compilerBin) compilerBin = nodePath.join(repoPath, 'everscript.py');
        }

        if (!compilerBin) {
            // Auto-detect by walking up from the active .evs file.
            let dir = nodePath.dirname(inputFile);
            for (let depth = 0; depth < 8 && !compilerBin; depth++) {
                const pyCandidate = nodePath.join(dir, 'everscript.py');
                if (nodeFs.existsSync(pyCandidate)) {
                    useScript   = true;
                    compilerBin = pyCandidate;
                    if (!projectRoot) projectRoot = dir;
                    break;
                }
                for (const bin of ['everscript_mac', 'everscript', 'everscript.exe']) {
                    const candidate = nodePath.join(dir, 'dist', bin);
                    if (nodeFs.existsSync(candidate)) {
                        compilerBin = candidate;
                        if (!projectRoot) projectRoot = dir;
                        break;
                    }
                }
                const parent = nodePath.dirname(dir);
                if (parent === dir) break;
                dir = parent;
            }
        }

        if (!compilerBin) {
            vscode.window.showErrorMessage(
                'Everscript: compiler not found. Open the Emulator panel \u2192 Settings tab and set the repo path.'
            );
            return { ok: false };
        }

        if (!projectRoot) {
            projectRoot = useScript
                ? nodePath.dirname(compilerBin)
                : nodePath.dirname(nodePath.dirname(compilerBin)); // parent of dist/
        }

        // ── 2. Resolve ROM ─────────────────────────────────────────────
        let romName = '';
        if (romPath) {
            romName = nodePath.basename(romPath);
        } else {
            try {
                const files = nodeFs.readdirSync(projectRoot);
                const found = files.find((f: string) => /\.(smc|sfc)$/i.test(f));
                if (found) romName = found;
            } catch (_) {}
        }

        if (!romName) {
            vscode.window.showErrorMessage(
                'Everscript: ' + missingRomText('evermore')
            );
            return { ok: false };
        }

        // ── 3. Resolve patches folder ──────────────────────────────────
        let patchesArg = patchesPath;
        if (!patchesArg && projectRoot) {
            const defaultPatches = nodePath.join(projectRoot, 'patches');
            if (nodeFs.existsSync(defaultPatches)) patchesArg = defaultPatches;
        }

        // ── 4. Build spawn args ────────────────────────────────────────
        const inputEvs  = inputFile;
        const outputRom = nodePath.join(projectRoot, 'out', romName);

        // Detect Python: prefer project venv so packages like 'injector' are available
        let pythonBin = extCfg.pythonPath || '';
        if (!pythonBin && projectRoot) {
            for (const rel of ['.venv/bin/python3', '.venv/bin/python', 'venv/bin/python3', 'venv/bin/python']) {
                const c = nodePath.join(projectRoot, rel);
                if (nodeFs.existsSync(c)) { pythonBin = c; break; }
            }
        }
        if (!pythonBin) pythonBin = 'python3';

        // Use relative paths (matches: python everscript.py --rom ... --patches ./patches in/...)
        const _sep = nodePath.sep;
        const inputArg = inputEvs.startsWith(projectRoot + _sep)
            ? nodePath.relative(projectRoot, inputEvs)
            : inputEvs;
        const patchesArgRel = patchesArg && patchesArg.startsWith(projectRoot)
            ? nodePath.relative(projectRoot, patchesArg)
            : patchesArg;

        let spawnBin: string, spawnArgs: string[];
        if (useScript) {
            spawnBin  = pythonBin;
            spawnArgs = [compilerBin, '--rom', romName];
            if (patchesArgRel) spawnArgs.push('--patches', patchesArgRel);
            spawnArgs.push(inputArg);
        } else {
            spawnBin  = compilerBin;
            spawnArgs = ['--rom', romName, inputArg];
        }

        function buildSpawnEnv() {
            const env = { ...process.env };
            const pathKey = Object.keys(env).find((key) => key.toUpperCase() === 'PATH') || 'PATH';
            const pathEntries: string[] = [];
            const seen = new Set();
            function addPathEntry(entry: string | undefined) {
                if (!entry || seen.has(entry)) return;
                seen.add(entry);
                pathEntries.push(entry);
            }

            if (projectRoot) {
                for (const rel of ['.venv/bin', 'venv/bin']) {
                    const candidate = nodePath.join(projectRoot, rel);
                    if (nodeFs.existsSync(candidate)) addPathEntry(candidate);
                }
            }
            if (pythonBin) addPathEntry(nodePath.dirname(pythonBin));

            const shellBin = env.SHELL || '/bin/zsh';
            try {
                const shellResult = cp.spawnSync(shellBin, ['-lic', 'printf %s "$PATH"'], {
                    cwd: projectRoot,
                    encoding: 'utf8',
                    env,
                    timeout: 5000,
                });
                if (shellResult.status === 0 && shellResult.stdout) {
                    for (const entry of shellResult.stdout.split(nodePath.delimiter)) addPathEntry(entry);
                }
            } catch (_) {}

            for (const entry of String(env[pathKey] || '').split(nodePath.delimiter)) addPathEntry(entry);
            for (const entry of [
                '/opt/homebrew/bin',
                '/usr/local/bin',
                '/usr/bin',
                '/bin',
                nodePath.join(nodeOs.homedir(), 'Documents', 'GitHub', 'asar', 'asar', 'bin'),
                nodePath.join(nodeOs.homedir(), 'GitHub', 'asar', 'asar', 'bin'),
            ]) {
                if (nodeFs.existsSync(entry)) addPathEntry(entry);
            }

            env[pathKey] = pathEntries.join(nodePath.delimiter);
            return env;
        }

        const channel = vscode.window.createOutputChannel('Everscript Build');
        channel.clear();
        channel.show(true);
        channel.appendLine(`[Everscript] Compiling: ${nodePath.basename(inputEvs)}`);
        channel.appendLine(`[Everscript] CWD:       ${projectRoot}`);
        function _qArg(a: string) { return /[ ()\[\]\\!'"<>]/.test(a) ? '"' + a.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"' : a; }
        channel.appendLine(`[Everscript] Command:   ${[spawnBin, ...spawnArgs.map(_qArg)].join(' ')}`);
        channel.appendLine('');

        const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        statusItem.text = '$(sync~spin) Everscript: building...';
        statusItem.show();

        const exitCode = await new Promise<number | null>(resolve => {
            const proc = cp.spawn(spawnBin, spawnArgs, { cwd: projectRoot, shell: false, env: buildSpawnEnv() });
            proc.stdout.on('data', (d: Buffer) => channel.append(d.toString()));
            proc.stderr.on('data', (d: Buffer) => channel.append(d.toString()));
            proc.on('close', (code: number | null) => resolve(code));
            proc.on('error', (err: Error) => {
                channel.appendLine('[Everscript] Error: ' + err.message);
                resolve(1);
            });
        });

        statusItem.dispose();

        if (exitCode !== 0) {
            vscode.window.showErrorMessage(
                'Everscript build failed (exit ' + exitCode + '). See Output > Everscript Build.'
            );
            return { ok: false };
        }

        // The ROM just changed. The render cache keys on a ROM fingerprint
        // so it would recover on its own, but drop it explicitly too —
        // a stale map render is worse than a slow one.
        romReaders.invalidateRomBuffer();
        invalidateRoomCaches();

        channel.appendLine('[Everscript] Build succeeded.');

        // ── 5. Load output ROM into the emulator ───────────────────────
        let romData: Buffer;
        try {
            romData = nodeFs.readFileSync(outputRom);
        } catch (e) {
            channel.appendLine(`[Everscript] Output ROM not found: ${outputRom}`);
            const why = e instanceof Error ? e.message : String(e);
            channel.appendLine(`[Everscript] Error: ${why}`);
            vscode.window.showErrorMessage('Everscript: build succeeded but output ROM not found: ' + why);
            openEmulatorPanel(context, undefined, channel);
            return { ok: false };
        }
        channel.appendLine(`[Everscript] Output ROM:  ${outputRom}`);
        channel.appendLine(`[Everscript] ROM size:    ${(romData.length / 1024 / 1024).toFixed(2)} MB`);
        if (opts.run === false) return { ok: true, outputRom };
        const dataUrl = 'data:application/octet-stream;base64,' + romData.toString('base64');
        openEmulatorPanel(context, { dataUrl, name: nodePath.basename(outputRom), filePath: outputRom, kind: 'build' }, channel);
        return { ok: true, outputRom };
    }),
);
}

export { registerBuildAndRun };
