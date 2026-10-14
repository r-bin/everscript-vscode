'use strict';
// Ownership: server-side HTML/JSON rendering for the Rooms tab tree panel.
// Pure functions: take data structures, return HTML strings or JS variable declarations.
// No filesystem I/O, no caching.

const { radarEsc } = require('../../shared/radar-utils');

/**
 * Server-side render of the static vanilla room list grouped by act.
 * Reads VANILLA_ROOMS passed as parameter (not imported) to avoid circular deps.
 * @param {Array} vanillaRooms  The VANILLA_ROOMS catalogue array.
 * @returns {string} HTML string.
 */
function renderVanillaTree(vanillaRooms) {
    let html = '<ul class="rt">';
    for (const grp of vanillaRooms) {
        html += '<li class="rn-area"><span class="rn-area-label">' + radarEsc(grp.area) + '</span><ul class="rt">';
        for (const r of grp.rooms) {
            html += '<li class="rn-map vn-map" data-vid="' + radarEsc(r.id)
                  + '"><span class="rn-label">' + radarEsc(r.name)
                  + '</span><span class="rn-vid-tag">' + radarEsc(r.id) + '</span></li>';
        }
        html += '</ul></li>';
    }
    return html + '</ul>';
}

/**
 * Server-side render of the Rooms tab's left rail: search, the two room
 * groups, and the `+ New Map` footer.
 *
 * Phase 7b replaced the old `Live` / `Vanilla` mode toggle (two trees, one
 * visible at a time) with one scrolling list carrying both, as two
 * collapsible top-level groups — the design mock's own structure. The
 * distinction survives as the group labels and as the rows' own data
 * attributes: a live row carries `data-map` + `data-line`, a vanilla row
 * carries `data-vid`, and `rooms-rail.js` routes the click by which is
 * present. The two container ids (`rm-live-tree` / `rm-vanilla-tree`) are the
 * pre-7b ones on purpose.
 *
 * Custom rooms are expanded and Vanilla collapsed on load, which is the same
 * information the pre-7b default (`Live` mode) showed; the 127-room ROM
 * catalogue is one click — or one search term — away rather than filling the
 * rail before you have asked for it.
 *
 * @param {string} treeHtml         renderRoomsTree output (the active file's rooms).
 * @param {string} vanillaTreeHtml  renderVanillaTree output (the ROM catalogue).
 * @returns {string} HTML string.
 */
function buildRoomRailHtml(treeHtml, vanillaTreeHtml) {
    const group = (key, label, title, open, body) =>
        '<div class="rm-grp" id="rm-grp-' + key + '">'
        + '<button class="rm-grp-h" data-rail-grp="' + key + '"'
        + ' aria-expanded="' + (open ? 'true' : 'false') + '"'
        + ' aria-controls="rm-' + key + '-tree" title="' + radarEsc(title) + '">'
        + '<span class="rm-grp-chev" aria-hidden="true">' + (open ? '▾' : '▸') + '</span>'
        + radarEsc(label) + '</button>'
        + '<div class="rm-grp-body" id="rm-' + key + '-tree"' + (open ? '' : ' hidden') + '>'
        + body + '</div></div>';

    return '<div class="rm-left rm-rail rg-rail">'
        + '<div class="rm-rail-search">'
        + '<input id="rm-rail-q" class="rm-rail-q" type="search" autocomplete="off"'
        + ' spellcheck="false" placeholder="Search rooms" aria-label="Search rooms">'
        + '</div>'
        + '<div class="rm-rail-scroll" id="rm-rail-scroll">'
        + group('vanilla', 'Vanilla rooms', 'Every room in the ROM, grouped by area',
            false, vanillaTreeHtml)
        + group('live', 'Custom rooms', 'New maps you have made, and rooms declared in the active .evs file',
            true, treeHtml)
        + '<div class="rm-rail-none" id="rm-rail-none" hidden>No rooms match</div>'
        + '</div>'
        + '<div class="rm-rail-foot">'
        + '<button class="rm-rail-new" id="rm-new-map"'
        + ' title="A new, empty custom map, one SNES screen (16×14 tiles)">'
        + '+ New Map</button>'
        + '</div></div>';
}

/**
 * Server-side render of the collapsible live room tree as HTML.
 * @param {Array} nodes  Room tree nodes from buildRoomTree.
 * @returns {string} HTML string.
 */
function renderRoomsTree(nodes) {
    if (!nodes || !nodes.length) return '<div class="rm-empty">No rooms found in this file.</div>';
    let html = '<ul class="rt">';
    for (const n of nodes) {
        if (n.kind === 'area') {
            html += '<li class="rn-area"><span class="rn-area-label">' + radarEsc(n.name) + '</span>'
                  + renderRoomsTree(n.children) + '</li>';
        } else {
            const vid = n.vanillaId
                ? '<span class="rv-id">' + radarEsc(n.vanillaId) + '</span>'
                : '';
            html += '<li class="rn-map" data-map="' + radarEsc(n.name)
                  + '" data-line="' + n.startLine
                  + '"><span class="rn-map-label">' + radarEsc(n.name) + vid + '</span></li>';
        }
    }
    return html + '</ul>';
}

/**
 * Build the ROOMS JSON variable declaration for embedding in the webview.
 * Expects imagePath already converted to imageUri via setRoomImageUris.
 *
 * @param {Array}       tree         Room tree nodes.
 * @param {string}      activeTab    'radar' | 'rooms'.
 * @param {string|null} selectedMap  Currently-selected map name.
 * @returns {string} JS variable declaration string (var ROOMS=...;var ACTIVE_TAB=...;...).
 */
function buildRoomsJson(tree, activeTab, selectedMap) {
    const all = {};

    function sanitizeTriggers(triggers) {
        if (!triggers) return null;
        const cleanScript = (script) => {
            if (!script) return null;
            const { scriptLines, ...rest } = script;
            return rest;
        };
        const clean = (arr) => (arr || []).map(cleanScript);
        return {
            meta:      triggers.meta || null,
            enter:     cleanScript(triggers.enter),
            stepOn:    clean(triggers.stepOn),
            bTrigger:  clean(triggers.bTrigger),
        };
    }

    function sanitizeContent(c) {
        if (!c) return null;
        return { ...c, triggers: sanitizeTriggers(c.triggers) };
    }

    function walk(nodes) {
        for (const n of nodes) {
            if (n.kind === 'map') {
                all[n.name] = {
                    name:       n.name,
                    vanillaId:  n.vanillaId || null,
                    // Numeric ROM room id, already resolved through the MAP enum
                    // by file-scanner. `vanillaId` is a symbolic enum name for
                    // live rooms, so it cannot be parsed as an id — the ROM
                    // render/overlay path keys off this instead.
                    romRoomId:  (typeof n.romRoomId === 'number') ? n.romRoomId : null,
                    relPath:    n.relPath || '',
                    startLine:  n.startLine,
                    endLine:    n.endLine,
                    content:    sanitizeContent(n.content),
                    imageUri:   n.imageUri  || null,
                    imageDims:  n.imageDims || null,
                };
            } else if (n.children) {
                walk(n.children);
            }
        }
    }
    walk(tree);

    return 'var ROOMS=' + JSON.stringify(all).replace(/<\/script>/gi, '<\\/script>')
         + ';var ACTIVE_TAB=' + JSON.stringify(activeTab || 'radar')
         + ';var SELECTED_MAP=' + JSON.stringify(selectedMap || null) + ';';
}

module.exports = { renderVanillaTree, renderRoomsTree, buildRoomRailHtml, buildRoomsJson };
