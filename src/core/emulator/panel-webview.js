'use strict';

/**
 * debugger/emulator/panel-webview.js
 *
 * Owns: the emulator webview page: webview/page.html (the skeleton), page-style/ and page/ (folders of parts), in which a
 * `//@@name` line or word is a place the parts (the other views, the game's part) are put into.
 * Single export: buildHtml(webview, coreJsUri, coreWasmUri, coreLabel, corePathDisplay, romOfferData, options) -> string
 *   options.profile  'full' or 'recorder' (webview/emulator-profile.js hides what a profile or a
 *                    ROM the game does not recognise does not get: elements marked data-needs="full" / "game")
 *   options.scripts  webview URIs of the game's page files (Evermore: its rom-game.js), emulator-profile.js,
 *                    emulator-panels.js and replays-list.js,
 *                    loaded before the inline script; options.styles  of webview/emulator-profile.css
 *                    and emulator-panels.css
 *   options.gameView the game's part of the page ({ css, tabButtonsHtml, viewsHtml, clientScript, and its
 *                    pause-menu tabs menuCss, menuTabButtonsHtml, menuPanelsHtml, and its screen layer:
 *                    overlaysScript and overlayTogglesScript, spliced where they ran before, and screenChipsHtml;
 *                    its script VM: stackScript, traceScript, scriptDebugScript, soundSourceScript, soundChipHtml },
 *                    strings; Evermore's: src/games/evermore/emulator/host.js webview()); none for
 *                    the recorder. The page calls into it only behind typeof guards.
 */

const { getCdlCss, getCdlTabButtonHtml, getCdlViewHtml, getCdlClientScript } = require('./cdl-view');
const { getCdlFloatCss, getCdlFloatHtml, getCdlFloatScript } = require('./cdl-float');
const { getCdlStripsScript } = require('./cdl-strips');
const { getFpsCss, getFpsChipHtml, getFpsClientScript } = require('./fps-meter');
const { getTasCss, getTasBadgeHtml, getTasChipHtml, getTasOverlayHtml, getTasViewHtml, getTasClientScript } = require('./tas-view');
const { getMemoryBridgeClientScript } = require('./memory-bridge-view');
const { getApuStreamClientScript } = require('./apu-stream-view');
const { getMenuCss, getMenuHtml, getMenuClientScript } = require('./menu/menu-view');
const { pageFile } = require('./page-file');

function _nonce() {
    let n = '';
    const ch = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) n += ch[Math.floor(Math.random() * ch.length)];
    return n;
}

// -----------------------------------------------------------------------------
//  HTML template
// -----------------------------------------------------------------------------

function _buildHtml(webview, coreJsUri, coreWasmUri, coreLabel, corePathDisplay, romOfferData, options) {
    const nonce = _nonce();
    const opts = options || {};
    const profile = opts.profile === 'recorder' ? 'recorder' : 'full';
    const game = Object.assign({ css: '', tabButtonsHtml: '', viewsHtml: '', clientScript: '', menuCss: '', menuTabButtonsHtml: '', menuPanelsHtml: '',
        overlaysScript: '', overlayTogglesScript: '', screenChipsHtml: '', stackScript: '', traceScript: '', scriptDebugScript: '',
        soundSourceScript: '', soundChipHtml: '' }, opts.gameView || {});
    const config = JSON.stringify({ profile }).replace(/</g, '\\u003c');
    const files = (opts.styles || []).map(u => `<link rel="stylesheet" href="${u}">`)
        .concat((opts.scripts || []).map(u => `<script src="${u}"></script>`)).join('\n  ');

    const values = {
        config, files, profile, coreJsUri, coreWasmUri, romOffer: JSON.stringify(romOfferData || null),
        game_css: game.css, game_menuCss: game.menuCss, game_tabButtonsHtml: game.tabButtonsHtml, game_viewsHtml: game.viewsHtml,
        game_screenChipsHtml: game.screenChipsHtml, game_soundChipHtml: game.soundChipHtml,
        game_clientScript: game.clientScript, game_overlaysScript: game.overlaysScript, game_overlayTogglesScript: game.overlayTogglesScript,
        game_stackScript: game.stackScript, game_traceScript: game.traceScript, game_scriptDebugScript: game.scriptDebugScript,
        game_soundSourceScript: game.soundSourceScript,
        CdlCss: getCdlCss(), CdlFloatCss: getCdlFloatCss(), TasCss: getTasCss(), FpsCss: getFpsCss(), MenuCss: getMenuCss(),
        CdlFloatHtml: getCdlFloatHtml(), TasOverlayHtml: getTasOverlayHtml(), TasBadgeHtml: getTasBadgeHtml(), TasChipHtml: getTasChipHtml(),
        FpsChipHtml: getFpsChipHtml(), CdlTabButtonHtml: getCdlTabButtonHtml(), CdlViewHtml: getCdlViewHtml(), TasViewHtml: getTasViewHtml(),
        MenuHtml: getMenuHtml({ tabButtonsHtml: game.menuTabButtonsHtml, panelsHtml: game.menuPanelsHtml }),
        CdlFloatScript: getCdlFloatScript(), CdlClientScript: getCdlClientScript(), CdlStripsScript: getCdlStripsScript(),
        TasClientScript: getTasClientScript(), MemoryBridgeClientScript: getMemoryBridgeClientScript(), ApuStreamClientScript: getApuStreamClientScript(),
        FpsClientScript: getFpsClientScript(), MenuClientScript: getMenuClientScript(),
    };
    // Module.locateFile uses the literal CORE_WASM filename constant, so webview/page.js takes the real file name.
    values.css = pageFile('page-style', values);
    values.script = pageFile('page', values);
    return pageFile('page.html', values);
}

module.exports = {
  buildHtml: _buildHtml,
};
