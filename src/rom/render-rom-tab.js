'use strict';
// Ownership: the ROM tab's pane scaffold. Pure; the content arrives later from
// the host (`romMap` message) and is drawn by webview/rom-tab.js.

function buildRomTabHtml() {
    return '<div class="tab-pane rom-pane" data-tab="rom" style="display:none">' +
        '<div class="rom-top">' +
        '<span class="rom-title" id="rom-title">ROM</span>' +
        '<span class="rom-stats" id="rom-stats"></span>' +
        '<div class="rom-seg" id="rom-layer" role="group" title="What the strips show">' +
        '<button class="rom-seg-btn rom-on" data-rom-layer="content">Content</button>' +
        '<button class="rom-seg-btn" data-rom-layer="cdl">CDL</button>' +
        '</div>' +
        '<input class="rom-search" id="rom-search" type="text" placeholder="Search address, room, table…" autocomplete="off" spellcheck="false">' +
        '<button class="rom-btn" id="rom-refresh" title="Rebuild the map, reloading the CDL library">↻</button>' +
        '</div>' +
        '<div class="rom-body">' +
        '<div class="rom-left"><div class="rom-hdr"><span>⬇️ lower half · $Cx:0000</span><span>⬆️ upper half · $8x:8000</span></div>' +
        '<div id="rom-strips" class="rom-strips"><div class="rom-empty">Loading the ROM map…</div></div>' +
        '<div id="rom-legend" class="rom-legend"></div></div>' +
        '<div class="rom-right" id="rom-detail"></div>' +
        '</div>' +
        '</div>';
}

module.exports = { buildRomTabHtml };
