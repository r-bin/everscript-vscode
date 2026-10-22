// Ownership: the Data tab's pane scaffold. Pure; the lists arrive from the host
// (`dataIndex`) and are drawn by webview/data-tab.dom.ts.

function buildDataTabHtml(): string {
    return '<div class="tab-pane scr-pane dat-pane" data-tab="data" style="display:none">' +
        '<div class="scr-top">' +
        '<span class="scr-title">Data</span>' +
        '<div class="scr-seg" role="group" title="Which kind of data">' +
        '<button class="scr-seg-btn scr-on" data-dat-view="tables" title="ROM tables: XP per level, the sine table, the boomerang orbit, every known table">Tables</button>' +
        '<button class="scr-seg-btn" data-dat-view="enums" title="Every enum of the Everscript core library (ROM, WRAM, values) and the game\'s character and map blobs">Enums</button>' +
        '<button class="scr-seg-btn" data-dat-view="palettes" title="Sprite palettes in bank $90 and the map tile families">Palettes</button>' +
        '</div>' +
        '<input class="scr-search" id="dat-search" type="text" placeholder="Filter…" autocomplete="off" spellcheck="false">' +
        '</div>' +
        '<div class="scr-body">' +
        '<div class="scr-rail" id="dat-rail"><div class="scr-empty">Loading…</div></div>' +
        '<div class="scr-mid" id="dat-mid"></div>' +
        '<div class="scr-side" id="dat-side"></div>' +
        '</div>' +
        '</div>';
}

export { buildDataTabHtml };
