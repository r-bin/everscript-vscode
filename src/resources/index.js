'use strict';
// Ownership: entry point of the resources domain — registers the `soe://`
// file system and its commands. The ROM and emulator access are injected
// by extension.js; this domain never requires src/emulator/.

const path = require('path');
const vscode = require('vscode');
const { SCHEME } = require('../shared/resource-uri');
const { SoeFileSystem } = require('./fs-provider');
const { checkSoeResources } = require('./check-panel');

/**
 * @param {vscode.ExtensionContext} context
 * @param {{ vanillaRom: () => Uint8Array|null, emulatorRom: () => Uint8Array|null,
 *           romFile: (path: string) => Uint8Array|null,
 *           readMemory: (bus: number, len: number) => Promise<Uint8Array>,
 *           emulatorStatus: () => Promise<object> }} deps
 */
function registerSoeResources(context, deps) {
    const fsProvider = new SoeFileSystem(deps);
    context.subscriptions.push(
        fsProvider,
        vscode.workspace.registerFileSystemProvider(SCHEME, fsProvider, { isReadonly: true, isCaseSensitive: true }),
        vscode.commands.registerCommand('everscript.checkSoeResources', checkSoeResources),
        vscode.commands.registerCommand('everscript.openSoeResource', openSoeResource),
        vscode.commands.registerCommand('everscript.openRomAsFolder', openRomAsFolder),
    );
}

async function openSoeResource(address) {
    const value = typeof address === 'string' ? address : await vscode.window.showInputBox({
        prompt: 'soe:// address to open',
        value: 'soe://rom/index.md',
        validateInput: v => /^soe:\/\/(rom|ram|bus)\//.test(v) ? null : 'Starts with soe://rom/, soe://ram/ or soe://bus/',
    });
    if (!value) return;
    const uri = vscode.Uri.parse(value);
    if (uri.path.endsWith('.md')) return vscode.commands.executeCommand('markdown.showPreview', uri);
    return vscode.commands.executeCommand('vscode.open', uri);
}

/**
 * Mount a ROM file in the Explorer as `soe://rom/?rom=<path>`. VS Code cannot
 * expand a file in place, so the ROM becomes a workspace folder of its own,
 * appended after the others (the first folder never changes: that would
 * restart every extension). Already mounted → just reveal it.
 */
async function openRomAsFolder(fileUri) {
    if (!(fileUri instanceof vscode.Uri)) {
        const picked = await vscode.window.showOpenDialog({
            canSelectMany: false, openLabel: 'Open as Folder',
            filters: { 'SNES ROM': ['smc', 'sfc'] },
        });
        fileUri = picked && picked[0];
    }
    if (!fileUri) return;
    if (fileUri.scheme !== 'file') {
        return vscode.window.showErrorMessage(`Only ROMs on disk can be opened as a folder (${fileUri.toString()})`);
    }
    const romPath = fileUri.fsPath;
    const uri = vscode.Uri.from({ scheme: SCHEME, authority: 'rom', path: '/', query: new URLSearchParams({ rom: romPath }).toString() });
    const folders = vscode.workspace.workspaceFolders || [];
    const mounted = folders.some(f => f.uri.scheme === SCHEME && new URLSearchParams(f.uri.query).get('rom') === romPath);
    if (!mounted) {
        const name = path.basename(romPath);
        if (!vscode.workspace.updateWorkspaceFolders(folders.length, 0, { uri, name })) {
            return vscode.window.showErrorMessage(`Could not add ${name} to the workspace`);
        }
    }
    await vscode.commands.executeCommand('workbench.view.explorer');
    return vscode.commands.executeCommand('revealInExplorer', uri.with({ path: '/index.md' }));
}

module.exports = { registerSoeResources };
