// TODO port to TS (docs/todo/port-to-ts.md)
'use strict';
// Terranigma Maps & Room Explorer Webview Panel.
// Follows multi-game.md §6 and §8: provides the Terranigma map view,
// Table A room browser, and multi-game capability empty-state notices.

const fs = require('fs');
const path = require('path');
const vscode = require('vscode');
const lib = require('../../../../dist/platform');
const terra = require('../../../../dist/games/terra');
const { renderTerraMapsHtml } = require('./page');

/** @type {vscode.WebviewPanel | null} */
let panel = null;

const KNOWN_ROOM_NAMES = {
    0x0000: 'Underworld Intro',
    0x0004: 'Savescreen',
    0x0008: 'Unused',
    0x0009: 'Unused',
    0x000A: 'Crysta',
};

function formatHex(n, len, prefix = '0x') {
    if (n === null || n === undefined) return '—';
    return prefix + n.toString(16).padStart(len, '0').toUpperCase();
}

function formatBusHex(bus) {
    if (bus === null || bus === undefined) return '—';
    const bank = (bus >> 16) & 0xFF;
    const addr = bus & 0xFFFF;
    return `$${bank.toString(16).padStart(2, '0').toUpperCase()}:${addr.toString(16).padStart(4, '0').toUpperCase()}`;
}

/**
 * Builds the initialization state for the Terranigma Maps page from the ROM.
 */
function buildInitData() {
    const sel = lib.selectedRom();
    const entry = (sel && sel.game === 'terra') ? sel : lib.romFor('terra');
    const romPath = entry && entry.path ? entry.path : null;

    let rom = null;
    if (romPath && fs.existsSync(romPath)) {
        try {
            rom = new Uint8Array(fs.readFileSync(romPath));
        } catch (_) {
            rom = null;
        }
    }

    const rooms = [];
    let usedCount = 0;
    let unusedCount = 0;

    for (let id = 0; id < terra.TERRA_ROOM_COUNT; id++) {
        const hexId = '0x' + id.toString(16).padStart(4, '0').toUpperCase();
        if (!rom) {
            rooms.push({
                id,
                hexId,
                name: KNOWN_ROOM_NAMES[id] || `Room ${hexId}`,
                busAddress: null,
                busHex: '—',
                fileOffset: null,
                fileHex: '—',
                isUsed: false,
                spcTrack: null,
                rawBytes: [],
                opcodes: [],
            });
            continue;
        }

        const bus = terra.readRoomBusAddress(rom, id);
        const file = terra.readRoomFileOffset(rom, id);
        const used = terra.isRoomSlotUsed(rom, id);
        const decoded = terra.decodeRoomHeader(rom, id);

        if (used) usedCount++;
        else unusedCount++;

        const defaultName = used ? (KNOWN_ROOM_NAMES[id] || `Room ${hexId}`) : 'Unused Slot';

        rooms.push({
            id,
            hexId,
            name: KNOWN_ROOM_NAMES[id] || defaultName,
            busAddress: bus,
            busHex: formatBusHex(bus),
            fileOffset: file,
            fileHex: file !== null ? formatHex(file, 6, '0x') : '—',
            isUsed: used,
            spcTrack: decoded && decoded.spcTrack !== undefined ? decoded.spcTrack : null,
            rawBytes: decoded && decoded.rawBytes ? decoded.rawBytes : [],
            opcodes: decoded && decoded.opcodes ? decoded.opcodes : [],
        });
    }

    return {
        title: 'Terranigma — Maps',
        variant: entry && entry.variant ? `Terranigma · ${entry.variant}` : 'Terranigma · eu',
        romPath,
        roomCount: terra.TERRA_ROOM_COUNT,
        usedCount: rom ? usedCount : 0,
        unusedCount: rom ? unusedCount : terra.TERRA_ROOM_COUNT,
        tableAOffset: `$0D:${(terra.TERRA_BASE_ROOM_TABLE_OFFSET & 0xFFFF).toString(16).toUpperCase()} (0x${terra.TERRA_BASE_ROOM_TABLE_OFFSET.toString(16).toUpperCase()})`,
        tableBOffset: `$0D:${(terra.TERRA_BASE_TABLE_B_OFFSET & 0xFFFF).toString(16).toUpperCase()} (0x${terra.TERRA_BASE_TABLE_B_OFFSET.toString(16).toUpperCase()})`,
        rooms,
    };
}

function handleMessage(msg) {
    if (!msg || !msg.command) return;
    if (msg.command === 'switchRom') {
        vscode.commands.executeCommand('everscript.switchRom');
    } else if (msg.command === 'openDocs') {
        const ws = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        const docsPath = ws ? path.join(ws, 'docs/terra/README.md') : null;
        if (docsPath && fs.existsSync(docsPath)) {
            vscode.commands.executeCommand('vscode.open', vscode.Uri.file(docsPath));
        } else {
            vscode.window.showInformationMessage('Terranigma facts & architecture docs: docs/terra/README.md');
        }
    }
}

/**
 * Open (or reveal) the Terranigma Maps panel.
 */
async function openTerraMaps(column = vscode.ViewColumn.Active) {
    if (panel) {
        panel.reveal(column);
        refreshTerraMaps();
        return panel;
    }

    panel = vscode.window.createWebviewPanel('everscript.terraMaps', 'Terranigma — Maps', column, {
        enableScripts: true,
        retainContextWhenHidden: true,
    });

    panel.onDidDispose(() => {
        panel = null;
    });

    panel.webview.onDidReceiveMessage(handleMessage);
    refreshTerraMaps();
    return panel;
}

/**
 * Re-renders the Terranigma Maps panel with current library/ROM state.
 */
function refreshTerraMaps() {
    if (!panel) return;
    const init = buildInitData();
    panel.webview.html = renderTerraMapsHtml({
        cspSource: panel.webview.cspSource,
        nonce: Math.random().toString(36).slice(2),
        init,
    });
}

/**
 * Closes the Terranigma Maps panel if open.
 */
function closeTerraMaps() {
    if (!panel) return;
    panel.dispose();
    panel = null;
}

/**
 * True when the Terranigma Maps panel is open.
 */
function isTerraMapsOpen() {
    return panel !== null;
}

/**
 * Returns the open panel or null.
 */
function getTerraMapsPanel() {
    return panel;
}

module.exports = {
    openTerraMaps,
    refreshTerraMaps,
    closeTerraMaps,
    isTerraMapsOpen,
    getTerraMapsPanel,
};

