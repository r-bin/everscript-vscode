'use strict';
// Ownership: entry point of the resources domain — registers the `soe://`
// file system and its commands. The ROM and emulator access are injected
// by extension.js; this domain never requires src/emulator/.

const path = require('path');
const vscode = require('vscode');
const { SCHEME, parseSoeParts, mountSegment } = require('../shared/resource-uri');
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
    // `.md` opens in the built-in Markdown preview: package.json associates
    // `soe:/**/*.md` with it (preview extensions that resolve images as
    // file: paths, e.g. Markdown Preview Enhanced, cannot load soe: images).
    return vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(value));
}

/**
 * Mount a ROM file in the Explorer as `soe://rom/~<mount>/`. VS Code cannot
 * expand a file in place, so the ROM becomes a workspace folder of its own,
 * appended after the others (the first folder never changes: that would
 * restart every extension). The ROM is named in the path, not `?rom=`: the
 * webview resource check compares a root's query with a request's (which it
 * strips), so a root with a query lets the Markdown preview load no image.
 * Already mounted → just reveal it; an older `?rom=` mount is replaced.
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
    const name = path.basename(romPath);
    const uri = vscode.Uri.from({ scheme: SCHEME, authority: 'rom', path: `/${mountSegment(romPath)}/` });
    const folders = vscode.workspace.workspaceFolders || [];
    const sameRom = f => f.uri.scheme === SCHEME && f.uri.authority === 'rom'
        && parseSoeParts(f.uri.authority, f.uri.path, f.uri.query).rom === romPath;
    const at = folders.findIndex(sameRom);
    if (at < 0 || folders[at].uri.toString() !== uri.toString()) {
        const ok = at < 0
            ? vscode.workspace.updateWorkspaceFolders(folders.length, 0, { uri, name })
            : vscode.workspace.updateWorkspaceFolders(at, 1, { uri, name });
        if (!ok) return vscode.window.showErrorMessage(`Could not add ${name} to the workspace`);
    }
    await vscode.commands.executeCommand('workbench.view.explorer');
    return vscode.commands.executeCommand('revealInExplorer', vscode.Uri.joinPath(uri, 'index.md'));
}

module.exports = { registerSoeResources };
