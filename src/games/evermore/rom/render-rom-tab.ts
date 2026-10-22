// Ownership: the ROM and Bus views' pane scaffold, one sub-pane of the Memory tab
// (memory/render-radar.js puts it beside WRAM under the Bus | WRAM | ROM bar). Pure;
// the content arrives later from the host (`romMap` message) and is drawn by webview/rom-tab.js.
// Its search field (#rom-search) sits on the Memory bar, beside WRAM's, so every view has it top right.

function buildRomTabHtml() {
    return '<div class="mem-sub-pane rom-pane" data-mem="rom" style="display:none">' +
        '<div class="rom-top">' +
        '<span class="rom-title" id="rom-title">ROM</span>' +
        '<div class="rom-seg" id="rom-mode-seg" role="group" title="File offsets, or file and bus side by side">' +
        '<button class="rom-seg-btn rom-on" data-rom-mode="file">File</button>' +
        '<button class="rom-seg-btn" data-rom-mode="cmp">Compare</button>' +
        '</div>' +
        '<span class="rom-stats" id="rom-stats"></span>' +
        '<div class="rom-seg rom-ml" id="rom-layer" role="group" title="What the maps show">' +
        '<button class="rom-seg-btn rom-on" data-rom-layer="content">Content</button>' +
        '<button class="rom-seg-btn" data-rom-layer="cdl">CDL</button>' +
        '</div>' +
        '<button class="rom-btn" id="rom-refresh" title="Rebuild the map, reloading the CDL library">↻</button>' +
        '</div>' +
        '<div class="rom-body" id="rom-file-view">' +
        '<div class="rom-left"><div class="rom-hdr"><span>⬇️ lower half · $Cx:0000</span><span>⬆️ upper half · $8x:8000</span></div>' +
        '<div id="rom-strips" class="rom-strips"><div class="rom-empty">Loading the ROM map…</div></div>' +
        '<div id="rom-legend" class="rom-legend"></div></div>' +
        '<div class="rom-right" id="rom-detail"></div>' +
        '</div>' +
        '<div class="rom-busview" id="rom-bus-view" style="display:none"></div>' +
        '<div class="rom-cmpview" id="rom-cmp-view" style="display:none"></div>' +
        '</div>';
}

export { buildRomTabHtml };
