// Ownership: the Routes tab's pane scaffold. Pure; the routes arrive from the host
// (`routesIndex`) and are drawn by webview/routes-tab.dom.ts.

function buildRoutesTabHtml(): string {
    return '<div class="tab-pane scr-pane rte-pane" data-tab="routes" style="display:none">' +
        '<div class="scr-top">' +
        '<span class="scr-title">Routes</span>' +
        '<span class="scr-dim rte-top-note">A route played from a fresh game: each step runs its trigger\'s script against one WRAM. ← → step through it.</span>' +
        '<input class="scr-search" id="rte-search" type="text" placeholder="Filter steps…" autocomplete="off" spellcheck="false">' +
        '</div>' +
        '<div class="scr-body">' +
        '<div class="scr-rail" id="rte-rail"><div class="scr-empty">Loading…</div></div>' +
        '<div class="scr-mid" id="rte-mid"></div>' +
        '<div class="scr-side" id="rte-side"></div>' +
        '</div>' +
        '</div>';
}

export { buildRoutesTabHtml };
