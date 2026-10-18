'use strict';

/**
 * core/emulator/core-path.js
 *
 * Owns: which snes9x core the panel loads (the everscript.snesCorePath setting, the bundled debugger
 * core, the bundled vanilla core).
 */

const vscode = require('vscode');
const path   = require('path');
const fs     = require('fs');

const CORE_SUBDIR        = path.join('src', 'core', 'emulator', 'core', 'snes9x2005-wasm-vanilla');
const CUSTOM_CORE_SUBDIR = path.join('src', 'core', 'emulator', 'core', 'snes9x2005-wasm');
const CORE_JS     = 'snes9x_2005.js';
const CORE_WASM   = 'snes9x_2005.wasm';
const LEGACY_CUSTOM_CORE_DIRS = [
  path.join('debugger', 'core', 'snes9x2005-wasm'),
  path.join('debugger', 'core', 'snes9x'),
  path.join('src', 'emulator', 'core', 'snes9x2005-wasm'),
  path.join('src', 'emulator', 'core', 'snes9x'),   // before v0.271.0 the emulator was src/emulator
];

/** A missing core under a pre-v0.6.0 folder of any checkout (or of this install) -> the bundled custom core. */
function remapLegacyCorePath(rawPath, extensionPath) {
  const normalized = path.normalize(rawPath);
  if (fs.existsSync(normalized)) return rawPath;
  for (const legacyDir of LEGACY_CUSTOM_CORE_DIRS) {
    const legacySuffix = path.sep + path.normalize(path.join(legacyDir, CORE_JS));
    if (!normalized.endsWith(legacySuffix)) continue;
    const migrated = path.join(extensionPath, 'src', 'core', 'emulator', 'core', 'snes9x2005-wasm', CORE_JS);
    if (fs.existsSync(migrated)) return migrated;
  }
  return rawPath;
}

/**
 * Resolve the snes9x core to use.
 * everscript.snesCorePath (if set) must point to a snes9x2005-wasm .js file.
 * Otherwise - and whenever the configured one is missing or unusable - the
 * bundled src/core/emulator/core/snes9x2005-wasm-vanilla/snes9x_2005.js is used.
 * Returns { path, wasmPath, label, source?, warning? }.
 *
 * A bad setting used to return no core at all, which left the panel blank
 * with only an output-channel line to say why. The setting is typically a
 * leftover `debugger/core/...` path from before the src/ refactor, pointing
 * into a checkout rather than the extension, so the legacy remap cannot
 * catch it. Falling back keeps the emulator working and still says so.
 */
function resolveCore(extensionPath) {
    const bundled = bundledCore(extensionPath);
    const raw = vscode.workspace.getConfiguration('everscript').get('snesCorePath', '').trim();
    if (!raw) return bundled;
    const custom = customCore(raw, extensionPath);
    if (custom.path) return custom;
    if (!bundled.path) return { ...bundled, warning: custom.warning + '; ' + bundled.warning };
    return { ...bundled, warning: custom.warning + ' - using the bundled core instead' };
}

function customCore(raw, extensionPath) {
    const configured = path.isAbsolute(raw) ? raw : path.resolve(raw);
    const resolved = remapLegacyCorePath(configured, extensionPath);
    if (!fs.existsSync(resolved))
        return { path: '', wasmPath: '', label: '', warning: `snesCorePath "${raw}" does not exist` };
    if (!resolved.toLowerCase().endsWith('.js'))
        return { path: '', wasmPath: '', label: '', warning: `snesCorePath must point to a snes9x2005-wasm .js build, got "${path.extname(resolved)}"` };
    const wasmPath = path.join(path.dirname(resolved), CORE_WASM);
    if (!fs.existsSync(wasmPath))
        return { path: '', wasmPath: '', label: '', warning: `Custom core JS found but WASM missing: ${wasmPath}` };
    return { path: resolved, wasmPath, label: path.basename(resolved), source: 'custom' };
}

function bundledCore(extensionPath) {
    const customJs   = path.join(extensionPath, CUSTOM_CORE_SUBDIR, CORE_JS);
    const customWasm = path.join(extensionPath, CUSTOM_CORE_SUBDIR, CORE_WASM);
    if (fs.existsSync(customJs) && fs.existsSync(customWasm)) {
      return { path: customJs, wasmPath: customWasm, label: CORE_JS + ' (debugger core)', source: 'custom-bundled' };
    }
    const jsPath   = path.join(extensionPath, CORE_SUBDIR, CORE_JS);
    const wasmPath = path.join(extensionPath, CORE_SUBDIR, CORE_WASM);
    if (!fs.existsSync(jsPath)) {
      return { path: '', wasmPath: '', label: '', warning: `Bundled core JS missing: ${jsPath}` };
    }
    if (!fs.existsSync(wasmPath)) {
      return { path: '', wasmPath: '', label: '', warning: `Bundled core WASM missing: ${wasmPath}` };
    }
    return { path: jsPath, wasmPath, label: CORE_JS + ' (bundled)', source: 'bundled' };
}


module.exports = { resolveCore, CORE_SUBDIR };
