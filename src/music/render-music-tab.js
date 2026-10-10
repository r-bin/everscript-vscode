'use strict';
// Ownership: the Music tab's pane scaffold. Pure; the content is drawn by
// webview/music-tab.js once the host sends the model.
//
// One screen, no page scroll: source bar, then the timeline (or voices |
// instruments) beside the sound-effects sidebar, then the ARAM map. Only the
// lists scroll inside themselves.

function buildMusicTabHtml() {
    return '<div class="tab-pane mu-pane" data-tab="music" style="display:none">' +
        '<div class="mu-top">' +
        '<label class="mu-src-l" for="mu-source">Source</label>' +
        '<select id="mu-source" class="mu-src" title="Follow the emulator, or play a track in this tab"><option value="emu">Emulator (live)</option></select>' +
        '<button class="mu-btn" id="mu-play" disabled>▶ Play</button>' +
        '<button class="mu-btn mu-view-toggle" id="mu-view-toggle" title="Switch between Timeline and Inspector view">☷ Timeline View</button>' +
        '<span class="mu-status" id="mu-status">Loading…</span>' +
        '<button class="mu-btn mu-sfx-toggle" id="mu-sfx-toggle" title="Show or hide the sound effects">♦ Sound effects</button>' +
        '</div>' +
        '<div class="mu-main mu-view-timeline" id="mu-main">' +
        '<div class="mu-view-area">' +
        // Inspector: voices and instruments. The sound effects are the sidebar in both views.
        '<div class="mu-inspect-view" id="mu-inspect-view">' +
        '<section class="mu-col mu-voices-col"><div class="mu-h">Voices <span id="mu-voices-sub"></span></div><div id="mu-voices" class="mu-voices"></div></section>' +
        '<section class="mu-col mu-inst-col"><div class="mu-h">Instruments <span id="mu-inst-sub"></span></div>' +
        '<div class="mu-keys" id="mu-keys" title="Play the selected instrument at a pitch (keys A–K)"></div>' +
        '<div id="mu-inst" class="mu-list"></div></section>' +
        '</div>' +
        '<div class="mu-timeline-view" id="mu-timeline-view">' +
        '<div class="mu-tl-channels" id="mu-tl-channels"></div>' +
        '<div class="mu-tl-viewport" id="mu-tl-viewport"><canvas id="mu-tl-canvas" class="mu-tl-canvas"></canvas></div>' +
        '</div>' +
        '</div>' +
        '<aside class="mu-sfx-sidebar" id="mu-sfx-sidebar">' +
        '<div class="mu-sb-resize" id="mu-sb-resize" title="Drag to resize"></div>' +
        '<div class="mu-sfx-sb-head">' +
        '<div class="mu-sfx-sb-title"><span>Sound effects</span><span id="mu-sfx-sb-count"></span>' +
        '<button class="mu-sb-close" id="mu-sb-close" title="Hide the sound effects">×</button></div>' +
        '<div class="mu-sfx-filters">' +
        '<button class="mu-filter-btn mu-active" data-sfx-filter="all">All</button>' +
        '<button class="mu-filter-btn" data-sfx-filter="recent" title="What the game sent, newest first">Recent</button>' +
        '<button class="mu-filter-btn" data-sfx-filter="attack" title="Played by an attack animation">⚔ Atk</button>' +
        '<button class="mu-filter-btn" data-sfx-filter="loaded" title="Come with the loaded package">Loaded</button>' +
        '<button class="mu-filter-btn" data-sfx-filter="base" title="Base bank: every room">Base</button>' +
        '</div>' +
        '</div>' +
        '<div class="mu-sfx-scroll" id="mu-sfx-scroll"></div>' +
        '</aside>' +
        '</div>' +
        '<section class="mu-aram"><div class="mu-h">ARAM <span id="mu-aram-sub"></span></div>' +
        '<div class="mu-bar" id="mu-bar"></div><div class="mu-ruler"><span>$0000</span><span>$4000</span><span>$8000</span><span>$C000</span><span>$FFFF</span></div>' +
        '<div class="mu-legend" id="mu-legend"></div></section>' +
        '</div>';
}

module.exports = { buildMusicTabHtml };
