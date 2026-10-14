'use strict';

const path = require('path');

function normalizePath(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function buildRepoDefaults(repoPath, wsRoot) {
    const normalizedRepo = normalizePath(repoPath);
    const base = normalizedRepo || normalizePath(wsRoot);
    if (!base) {
        return {
            repoPath: normalizedRepo,
            inDirectory: '',
            patchesDirectory: '',
            romPath: '',
            compilerPath: '',
            pythonPath: '',
        };
    }
    return {
        repoPath: normalizedRepo,
        inDirectory: path.join(base, 'in'),
        patchesDirectory: path.join(base, 'patches'),
        romPath: path.join(base, 'Secret of Evermore (U) [!].smc'),
        compilerPath: path.join(base, 'everscript.py'),
        pythonPath: path.join(base, '.venv', 'bin', 'python3'),
    };
}

function resolveExtConfig(rawConfig, wsRoot) {
    const raw = rawConfig || {};
    const defaults = buildRepoDefaults(raw.repoPath, wsRoot);
    const legacyPatchesPath = normalizePath(raw.patchesPath);
    return {
        repoPath: normalizePath(raw.repoPath),
        inDirectory: normalizePath(raw.inDirectory) || defaults.inDirectory,
        patchesDirectory: normalizePath(raw.patchesDirectory) || legacyPatchesPath || defaults.patchesDirectory,
        patchesPath: legacyPatchesPath,
        romPath: normalizePath(raw.romPath) || defaults.romPath,
        compilerPath: normalizePath(raw.compilerPath) || defaults.compilerPath,
        pythonPath: normalizePath(raw.pythonPath) || defaults.pythonPath,
        snesCorePath: normalizePath(raw.snesCorePath),
    };
}

function getRepoAutofillUpdates(rawConfig, wsRoot) {
    const raw = rawConfig || {};
    const repoPath = normalizePath(raw.repoPath);
    if (!repoPath) return {};
    const defaults = buildRepoDefaults(repoPath, wsRoot);
    const updates = {};
    if (!normalizePath(raw.inDirectory)) updates.inDirectory = defaults.inDirectory;
    if (!normalizePath(raw.patchesDirectory) && !normalizePath(raw.patchesPath)) updates.patchesDirectory = defaults.patchesDirectory;
    if (!normalizePath(raw.romPath)) updates.romPath = defaults.romPath;
    if (!normalizePath(raw.compilerPath)) updates.compilerPath = defaults.compilerPath;
    if (!normalizePath(raw.pythonPath)) updates.pythonPath = defaults.pythonPath;
    return updates;
}

module.exports = {
    normalizePath,
    buildRepoDefaults,
    resolveExtConfig,
    getRepoAutofillUpdates,
};