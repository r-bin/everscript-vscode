// Ownership: the Scripts tab's pane scaffold. Pure; the content arrives from the
// host (`scriptsIndex`, `scriptsRoom`, ...) and is drawn by webview/scripts-*.js.

function buildScriptsTabHtml() {
    return '<div class="tab-pane scr-pane" data-tab="scripts" style="display:none">' +
        '<div class="scr-top">' +
        '<span class="scr-title">Scripts</span>' +
        '<div class="scr-seg" role="group" title="Which kind of script">' +
        '<button class="scr-seg-btn scr-on" data-scr-view="room" title="Everscript: room enter scripts, step-on and B-triggers">Everscript</button>' +
        '<button class="scr-seg-btn" data-scr-view="map" title="Maps: each room blob as the bytes the room loader reads, section by section, and what each part draws">Maps</button>' +
        '<button class="scr-seg-btn" data-scr-view="anim" title="Animation scripts: the 783 records at $C43E3A (⚗ marks alchemy effects)">Animations</button>' +
        '<button class="scr-seg-btn" data-scr-view="music" title="Music: each track\'s sequence and a silent player">Music</button>' +
        '</div>' +
        '<input class="scr-search" id="scr-search" type="text" placeholder="Filter…" autocomplete="off" spellcheck="false">' +
        '<span class="scr-tools" id="scr-tools"></span>' +
        '</div>' +
        '<div class="scr-body">' +
        '<div class="scr-rail" id="scr-rail"><div class="scr-empty">Loading…</div></div>' +
        '<div class="scr-mid" id="scr-mid"></div>' +
        '<div class="scr-side" id="scr-side"></div>' +
        '</div>' +
        '</div>';
}

export { buildScriptsTabHtml };
