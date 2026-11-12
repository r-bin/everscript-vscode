// Ownership: the Code tab's pane scaffold. Pure; the routines arrive from the host
// (`codeIndex`, `codeRoutine`, `codeText`) and are drawn by webview/code-tab.dom.ts.

function buildCodeTabHtml(): string {
    return '<div class="tab-pane scr-pane code-pane" data-tab="code" style="display:none">' +
        '<div class="scr-top">' +
        '<span class="scr-title">Code</span>' +
        '<button class="scr-btn code-back" id="code-back" title="Back to the routine before (Alt+←)" disabled>←</button>' +
        '<input class="scr-search" id="code-search" type="text" placeholder="Filter name, title, $address… (Enter: deep search)" autocomplete="off" spellcheck="false">' +
        '<span class="scr-tools">' +
        '<label class="scr-check" title="Only routines with reconstructed C"><input type="checkbox" id="code-only-c"> with C</label>' +
        '<label class="scr-check" title="Show each instruction\'s bytes"><input type="checkbox" id="code-bytes"> bytes</label>' +
        '<span class="scr-dim" id="code-count"></span>' +
        '</span>' +
        '</div>' +
        '<div class="scr-body">' +
        '<div class="scr-rail" id="code-rail"><div class="scr-empty">Loading…</div></div>' +
        '<div class="scr-mid" id="code-mid"><div class="scr-empty">Pick a routine.</div></div>' +
        '<div class="scr-side" id="code-side"></div>' +
        '</div>' +
        '</div>';
}

export { buildCodeTabHtml };
