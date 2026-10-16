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

function resolveExtConfig(rawConfig, wsRoot) {
    const raw = rawConfig || {};
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

function getRepoAutofillUpdates(rawConfig, wsRoot) {
    const raw = rawConfig || {};
    const repoPath = normalizePath(raw.repoPath);
    if (!repoPath) return {};
    const defaults = buildRepoDefaults(repoPath, wsRoot);
    const updates = {};
    if (!normalizePath(raw.inDirectory)) updates.inDirectory = defaults.inDirectory;
    if (!normalizePath(raw.patchesDirectory)) updates.patchesDirectory = defaults.patchesDirectory;
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