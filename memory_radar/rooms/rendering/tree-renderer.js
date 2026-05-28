'use strict';
// Ownership: server-side HTML/JSON rendering for the Rooms tab tree panel.
// Pure functions: take data structures, return HTML strings or JS variable declarations.
// No filesystem I/O, no caching.

const { radarEsc } = require('../../radar-utils');

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

module.exports = { renderVanillaTree, renderRoomsTree, buildRoomsJson };
