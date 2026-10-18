// Ownership: the extension's paths (everscript.* settings) with defaults from the everscript repo or the workspace.

import * as path from 'path';

/** The settings as VS Code gives them: any may be missing or not a string. */
interface RawConfig {
    repoPath?: unknown;
    inDirectory?: unknown;
    patchesDirectory?: unknown;
    compilerPath?: unknown;
    pythonPath?: unknown;
    snesCorePath?: unknown;
}

interface RepoPaths { inDirectory: string; patchesDirectory: string; compilerPath: string; pythonPath: string }

function normalizePath(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function buildRepoDefaults(repoPath: unknown, wsRoot: unknown): RepoPaths & { repoPath: string } {
    const normalizedRepo = normalizePath(repoPath);
    const base = normalizedRepo || normalizePath(wsRoot);
    if (!base) {
        return {
            repoPath: normalizedRepo,
            inDirectory: '',
            patchesDirectory: '',
            compilerPath: '',
            pythonPath: '',
        };
    }
    return {
        repoPath: normalizedRepo,
        inDirectory: path.join(base, 'in'),
        patchesDirectory: path.join(base, 'patches'),
        compilerPath: path.join(base, 'everscript.py'),
        pythonPath: path.join(base, '.venv', 'bin', 'python3'),
    };
}

function resolveExtConfig(rawConfig: RawConfig | null | undefined, wsRoot: string | null | undefined) {
    const raw: RawConfig = rawConfig || {};
    const defaults = buildRepoDefaults(raw.repoPath, wsRoot);
    return {
        repoPath: normalizePath(raw.repoPath),
        inDirectory: normalizePath(raw.inDirectory) || defaults.inDirectory,
        patchesDirectory: normalizePath(raw.patchesDirectory) || defaults.patchesDirectory,
        compilerPath: normalizePath(raw.compilerPath) || defaults.compilerPath,
        pythonPath: normalizePath(raw.pythonPath) || defaults.pythonPath,
        snesCorePath: normalizePath(raw.snesCorePath),
    };
}

function getRepoAutofillUpdates(rawConfig: RawConfig | null | undefined, wsRoot: string | null | undefined): Partial<RepoPaths> {
    const raw: RawConfig = rawConfig || {};
    const repoPath = normalizePath(raw.repoPath);
    if (!repoPath) return {};
    const defaults = buildRepoDefaults(repoPath, wsRoot);
    const updates: Partial<RepoPaths> = {};
    if (!normalizePath(raw.inDirectory)) updates.inDirectory = defaults.inDirectory;
    if (!normalizePath(raw.patchesDirectory)) updates.patchesDirectory = defaults.patchesDirectory;
    if (!normalizePath(raw.compilerPath)) updates.compilerPath = defaults.compilerPath;
    if (!normalizePath(raw.pythonPath)) updates.pythonPath = defaults.pythonPath;
    return updates;
}

export type { RawConfig };
export { normalizePath, buildRepoDefaults, resolveExtConfig, getRepoAutofillUpdates };
