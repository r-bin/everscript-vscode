'use strict';
// Ownership: the Music tab's pane scaffold. Pure; the content is drawn by
// webview/music-tab.js once the host sends the model.
//
// One screen, no page scroll: source bar, then voices | instruments | sound
// effects, then the ARAM map. Only the two lists scroll inside themselves.

function buildMusicTabHtml() {
    return '<div class="tab-pane mu-pane" data-tab="music" style="display:none">' +
        '<div class="mu-top">' +
        '<label class="mu-src-l" for="mu-source">Source</label>' +
        '<select id="mu-source" class="mu-src" title="Follow the emulator, or play a track in this tab"><option value="emu">Emulator (live)</option></select>' +
        '<button class="mu-btn" id="mu-play" disabled>▶ Play</button>' +
        '<span class="mu-status" id="mu-status">Loading…</span>' +
        '</div>' +
        '<div class="mu-main">' +
        '<section class="mu-col mu-voices-col"><div class="mu-h">Voices <span id="mu-voices-sub"></span></div><div id="mu-voices" class="mu-voices"></div></section>' +
        '<section class="mu-col mu-inst-col"><div class="mu-h">Instruments <span id="mu-inst-sub"></span></div>' +
        '<div class="mu-keys" id="mu-keys" title="Play the selected instrument at a pitch (keys A–K)"></div>' +
        '<div id="mu-inst" class="mu-list"></div></section>' +
        '<section class="mu-col mu-sfx-col"><div class="mu-h">Sound effects <span id="mu-sfx-sub"></span></div><div id="mu-sfx" class="mu-list"></div></section>' +
        '</div>' +
        '<section class="mu-aram"><div class="mu-h">ARAM <span id="mu-aram-sub"></span></div>' +
        '<div class="mu-bar" id="mu-bar"></div><div class="mu-ruler"><span>$0000</span><span>$4000</span><span>$8000</span><span>$C000</span><span>$FFFF</span></div>' +
        '<div class="mu-legend" id="mu-legend"></div></section>' +
        '</div>';
}

module.exports = { buildMusicTabHtml };
