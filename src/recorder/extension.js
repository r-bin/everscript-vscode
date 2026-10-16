'use strict';

/**
 * recorder/extension.js
 *
 * Activation entry of the SNES CDL Recorder, the second VS Code extension built
 * from this repository (manifest: recorder/package.json, build: npm run build:recorder).
 * It is the emulator panel in its 'recorder' profile: the CDL and REPLAYS tabs,
 * no debugger, no editors, no other commands. Its storage (CDL library, replays,
 * settings) is its own; what it records reaches Everscript as a recording bundle.
 */

const vscode = require('vscode');
const panel = require('../emulator/panel');
const { exportRecordingBundle } = require('../emulator/bundle-commands');

function activate(context) {
    const tool = { name: 'snes-cdl-recorder', version: context.extension ? context.extension.packageJSON.version : '' };
    const exportBundle = () => exportRecordingBundle(context, tool).catch(err =>
        vscode.window.showErrorMessage('Export failed: ' + err.message));
    panel.configureEmulator({ profile: 'recorder', title: 'SNES CDL Recorder', onExportBundle: exportBundle, reopenLastRom: true });

    context.subscriptions.push(
        vscode.commands.registerCommand('cdlRecorder.openEmulator', () => panel.openEmulatorPanel(context)),
        vscode.commands.registerCommand('cdlRecorder.openRom', async () => {
            const uris = await vscode.window.showOpenDialog({
                canSelectMany: false,
                openLabel: 'Load ROM',
                filters: { 'SNES ROM': ['smc', 'sfc', 'fig', 'bin'] },
            });
            if (uris && uris.length) panel.runRomFile(context, uris[0].fsPath);
        }),
        vscode.commands.registerCommand('cdlRecorder.exportBundle', exportBundle),
        vscode.commands.registerCommand('cdlRecorder.openDataFolder', () => {
            const { storage } = panel.recordingFolders(context);
            require('fs').mkdirSync(storage, { recursive: true });
            vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(storage));
        }),
    );
}

function deactivate() {}

module.exports = { activate, deactivate };
