'use strict';
// Ownership: entry point of the resources domain — registers the `soe://`
// file system and its two commands. The ROM and emulator access are injected
// by extension.js; this domain never requires src/emulator/.

const vscode = require('vscode');
const { SCHEME } = require('../shared/resource-uri');
const { SoeFileSystem } = require('./fs-provider');
const { checkSoeResources } = require('./check-panel');

/**
 * @param {vscode.ExtensionContext} context
 * @param {{ vanillaRom: () => Uint8Array|null, emulatorRom: () => Uint8Array|null,
 *           readMemory: (bus: number, len: number) => Promise<Uint8Array> }} deps
 */
function registerSoeResources(context, deps) {
    const fsProvider = new SoeFileSystem(deps);
    context.subscriptions.push(
        fsProvider,
        vscode.workspace.registerFileSystemProvider(SCHEME, fsProvider, { isReadonly: true, isCaseSensitive: true }),
        vscode.commands.registerCommand('everscript.checkSoeResources', checkSoeResources),
        vscode.commands.registerCommand('everscript.openSoeResource', openSoeResource),
    );
}

async function openSoeResource(address) {
    const value = typeof address === 'string' ? address : await vscode.window.showInputBox({
        prompt: 'soe:// address to open',
        value: 'soe://rom/index.md',
        validateInput: v => /^soe:\/\/(rom|ram)\//.test(v) ? null : 'Starts with soe://rom/ or soe://ram/',
    });
    if (!value) return;
    const uri = vscode.Uri.parse(value);
    if (uri.path.endsWith('.md')) return vscode.commands.executeCommand('markdown.showPreview', uri);
    return vscode.commands.executeCommand('vscode.open', uri);
}

module.exports = { registerSoeResources };
