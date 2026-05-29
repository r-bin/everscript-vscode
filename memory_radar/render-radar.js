'use strict';
// Owner: memory_radar/render-radar.js
// Orchestrates full radar webview HTML: assembles per-tab renderers,
// injects JS data blobs, and wraps in page shell.
// No VS Code dependency — all external state arrives as parameters.

const { buildMemoryTabHtml }     = require('./render-memory-tab');
const { buildDocsTabHtml, buildRngTabHtml } = require('./render-docs-tab');
const { renderRoomsTree, renderVanillaTree, buildRoomsJson, VANILLA_ROOMS } = require('./room-tree');
const radarWebview               = require('./webview');

/**
 * Build the complete radar webview HTML.
 * The last three parameters (enumByAddr, vanillaRoomDetails, byteScriptFocus)
 * are provided by the call site in extension.js; tests call with 8 args and
 * rely on the defaults.
 */
function renderRadarHtml(
    scope, refs, pools, argRefs, mapByAddr,
    roomTree = [], activeTab = 'radar', selectedMap = null,
    chars = [], scaleActive = false, ingrBaseUri = '', hitLookup = null,
    enumByAddr = new Map(), vanillaRoomDetails = {}, byteScriptFocus = ''
) {
    // ── Memory tab (grid + detail table) ───────────────────────────────────
    const { html: memoryTabHtml, cellData } = buildMemoryTabHtml(
        scope, refs, pools, argRefs, mapByAddr, enumByAddr
    );

    // ── JS data blobs ───────────────────────────────────────────────────────
    const css    = radarWebview.css;
    const jsData = 'var CELLS=' + JSON.stringify(cellData).replace(/<\/script>/gi, '<\\/script>') + ';';

    // ── Rooms tab data ──────────────────────────────────────────────────────
    const treeHtml        = renderRoomsTree(roomTree);
    const vanillaTreeHtml = renderVanillaTree();
    const roomsData =
        buildRoomsJson(roomTree, activeTab, selectedMap) +
        '\nvar INGR_BASE=' + JSON.stringify(ingrBaseUri) + ';' +
        '\nvar ACTIVE_BYTE_SCRIPT_FOCUS=' + JSON.stringify(byteScriptFocus || '') + ';' +
        '\nvar VANILLA_ROOMS_DATA=' + JSON.stringify(VANILLA_ROOMS) + ';' +
        '\nvar VANILLA_ROOM_DETAILS=' + JSON.stringify(vanillaRoomDetails).replace(/<\/script>/gi, '<\\/script>') + ';';

    // ── Scaling tab data ────────────────────────────────────────────────────
    const scalingData =
        'var SC_CHARS=' + JSON.stringify(chars) + ';' +
        'var SC_HIT_LOOKUP=' + JSON.stringify(hitLookup || {}) + ';' +
        'var SC_SCALE_ACTIVE=' + (scaleActive ? 'true' : 'false') + ';' +
        'var SC_BOY={atk1:7,def1:5,hp1:30,atkG:2,defG:1,hpG:9,hitRate1:38,hitRateG:1};' +
        'var SC_DOG={atk1:17,def1:10,hp1:36,atkG:4,defG:6,hpG:9,hitRate1:50,hitRateG:1};' +
        'var SC_SCALABLE={0:SC_BOY,1:SC_DOG};' +
        'var SC_WEAPONS=[' +
        '{id:"sw1",label:"Sword I",type:"sword",bonus:10},' +
        '{id:"sw2",label:"Sword II",type:"sword",bonus:20},' +
        '{id:"sw3",label:"Sword III",type:"sword",bonus:30},' +
        '{id:"sw4",label:"Sword IV",type:"sword",bonus:50},' +
        '{id:"ax1",label:"Axe I",type:"axe",bonus:15},' +
        '{id:"ax2",label:"Axe II",type:"axe",bonus:25},' +
        '{id:"ax3",label:"Axe III",type:"axe",bonus:35},' +
        '{id:"ax4",label:"Axe IV",type:"axe",bonus:50},' +
        '{id:"sp1",label:"Spear I",type:"spear",bonus:20},' +
        '{id:"sp2",label:"Spear II",type:"spear",bonus:30},' +
        '{id:"sp3",label:"Spear III",type:"spear",bonus:40},' +
        '{id:"sp4",label:"Spear IV",type:"spear",bonus:50}' +
        '];' +
        'var SC_SPELLS=[' +
        '{id:"acid",label:"Acid Rain",type:"alchemy",might:17,color:"#4b9f67"},' +
        '{id:"corrosion",label:"Corrosion",type:"alchemy",might:25,color:"#5ab08c"},' +
        '{id:"drain",label:"Drain",type:"alchemy",might:25,color:"#8e8bc7"},' +
        '{id:"flash",label:"Flash",type:"alchemy",might:27,color:"#d6a34a"},' +
        '{id:"hardball",label:"Hard Ball",type:"alchemy",might:21,color:"#4c86d9"},' +
        '{id:"doubledrain",label:"Double Drain",type:"alchemy",might:50,color:"#8f6bd1"},' +
        '{id:"lance",label:"Lance",type:"alchemy",might:50,color:"#46a9a1"},' +
        '{id:"crush",label:"Crush",type:"alchemy",might:62,color:"#c07845"},' +
        '{id:"fireball",label:"Fireball",type:"alchemy",might:62,color:"#db7049"},' +
        '{id:"sting",label:"Sting",type:"alchemy",might:75,color:"#d2b247"},' +
        '{id:"explosion",label:"Explosion",type:"alchemy",might:87,color:"#df5d3c"},' +
        '{id:"storm",label:"Lightning Storm",type:"alchemy",might:87,color:"#6797df"},' +
        '{id:"firepower",label:"Fire Power",type:"alchemy",might:112,color:"#e0582e"},' +
        '{id:"nitro",label:"Nitro",type:"alchemy",might:112,color:"#ef4343"}' +
        '];' +
        'var SC_COLORS={sword:"#4488ff",axe:"#ff8844",spear:"#44bb66",dog:"#cc88ff"};' +
        'var SC_TIER_OPAC=[0.18,0.32,0.50,0.75];' +
        'var SC_MAX_LEVEL=37;';

    // ── JS bundle ───────────────────────────────────────────────────────────
    const scalingJs = radarWebview.scalingJs;
    const roomsJs   = radarWebview.roomsJs;
    const docsJs    = radarWebview.docsJs;
    const routeJs   = radarWebview.routeJs;
    const rngJs     = radarWebview.rngJs;
    const js = radarWebview.buildMainJs({ jsData, roomsData, scalingData, roomsJs, scalingJs, docsJs, routeJs, rngJs });

    // ── Rooms tab HTML ──────────────────────────────────────────────────────
    const roomsTabHtml =
        '<div class="tab-pane" data-tab="rooms" style="display:none">' +
        '<div class="rm-panels">' +
        '<div class="rm-left">' +
        '<div class="rm-ph"><span>Rooms</span><div class="rm-mode">' +
        '<button class="rmm active" id="rmm-live" title="Show rooms from the active .evs file">Live</button>' +
        '<button class="rmm" id="rmm-vanilla" title="Show all vanilla rooms">Vanilla</button>' +
        '</div></div>' +
        '<div id="rm-live-tree">' + treeHtml + '</div>' +
        '<div id="rm-vanilla-tree" style="display:none">' + vanillaTreeHtml + '</div>' +
        '</div>' +
        '<div class="rm-right"><div id="room-detail" class="rm-detail-placeholder"><span>Select a room</span></div></div>' +
        '</div>' +
        '</div>';

    // ── Scaling tab HTML ────────────────────────────────────────────────────
    const scalingTabHtml =
        '<div class="tab-pane" data-tab="scaling" style="display:none">' +
        '<div class="sc-wrap">' +
        (scaleActive ? '<div class="sc-banner">\u26a0 scale_enemies active \u2014 enemy stats may differ at runtime.</div>' : '') +
        '<div class="sc-note" id="sc-note">\u2605 = scalable (level grows). Scaling uses one physical damage helper for all cases: stamina first adjusts attack, Atlas optionally subtracts 480 before damage, then the same RNG-based physical formula computes min/max/999-cap odds.</div>' +
        '<div class="sc-field" id="sc-mode-field"><span class="sc-label">Damage type</span><select class="sc-sel" id="sc-mode-sel"><option value="physical">Physical</option><option value="alchemy">Offensive Alchemy</option></select></div>' +
        '<div class="sc-field" id="sc-src-field"><span class="sc-label">Source</span><select class="sc-sel" id="sc-src-sel"></select></div>' +
        '<div class="sc-field" id="sc-src-lv-field" style="display:none"><span class="sc-label">Source level</span><select class="sc-sel" style="min-width:80px" id="sc-src-lv"><option value="0">auto</option></select></div>' +
        '<div class="sc-field"><span class="sc-label">Target</span><select class="sc-sel" id="sc-tgt-sel"></select></div>' +
        '<div class="sc-field" id="sc-tgt-lv-field" style="display:none"><span class="sc-label">Target level</span><select class="sc-sel" style="min-width:80px" id="sc-tgt-lv"><option value="0">auto</option></select></div>' +
        '<div class="sc-field" id="sc-al-spell-lv-field" style="display:none"><span class="sc-label">Spell level</span><label class="sc-slider-wrap"><input class="sc-slider" id="sc-al-spell-lv" type="range" min="0" max="9" value="0"><span class="sc-slider-num" id="sc-al-spell-lv-num">0</span></label></div>' +
        '<div class="sc-field" id="sc-al-tgt-lv-field" style="display:none"><span class="sc-label">Target level</span><label class="sc-slider-wrap"><input class="sc-slider" id="sc-al-tgt-lv" type="range" min="1" max="37" value="1"><span class="sc-slider-num" id="sc-al-tgt-lv-num">1</span></label></div>' +
        '<div class="sc-field" id="sc-charge-field"><span class="sc-label">Charge</span><div class="sc-toggle-group"><button class="sc-toggle-btn" data-chg="25">25%</button><button class="sc-toggle-btn" data-chg="50">50%</button><button class="sc-toggle-btn sc-active" data-chg="100">100%</button></div></div>' +
        '<div class="sc-field" id="sc-scale-field"><span class="sc-label">Enemy scale</span><button class="sc-toggle-btn" id="sc-scale-toggle">OFF</button></div>' +
        '<div class="sc-field" id="sc-atlas-field"><span class="sc-label">Atlas</span><button class="sc-toggle-btn" id="sc-atlas-toggle">OFF</button></div>' +
        '</div>' +
        '<div class="sc-chart-layout"><div class="sc-chart-wrap"><div id="sc-chart"></div><div class="sc-hit-chart" id="sc-hit-chart"></div></div><div class="sc-legend" id="sc-legend"></div></div>' +
        '<div id="sc-xinfo" class="sc-xinfo"></div>' +
        '<div class="sc-stats" id="sc-stats"></div>' +
        '<div class="sc-note">\u2605 = scalable (level grows). Scaling uses one physical damage helper for all cases: stamina first adjusts attack, Atlas optionally subtracts 480 before damage, then the same RNG-based physical formula computes min/max/999-cap odds.</div>' +
        '</div>' +
        '</div>';

    // ── Route tab HTML ──────────────────────────────────────────────────────
    const routeTabHtml =
        '<div class="tab-pane" data-tab="route" style="display:none">' +
        '<div class="rp-wrap">' +
        '<div class="rp-banner">Mock UI only. Physical hit expectations, route-grade spell scaling / 8-cast modeling, XP tables, and route simulation are still missing. This tab is a scaffold for the route-planner workflow.</div>' +
        '<div class="rp-grid">' +
        '<div class="rp-side">' +
        '<div class="rp-h">Add Step</div>' +
        '<div class="rp-templates">' +
        '<div class="rp-tpl"><div><div class="rp-tpl-name">Thraxx\'s Heart</div><div class="rp-tpl-sub">Alchemy 8-cast boss kill</div></div><button class="rp-btn" data-rp-add="heart8">add</button></div>' +
        '<div class="rp-tpl"><div><div class="rp-tpl-name">Skelesnail</div><div class="rp-tpl-sub">Alchemy 8-cast spell leveling</div></div><button class="rp-btn" data-rp-add="skelesnail8">add</button></div>' +
        '<div class="rp-tpl"><div><div class="rp-tpl-name">Magmar</div><div class="rp-tpl-sub">Alchemy any% Act 1 route step</div></div><button class="rp-btn" data-rp-add="magmar8">add</button></div>' +
        '<div class="rp-tpl"><div><div class="rp-tpl-name">Sterling</div><div class="rp-tpl-sub">Physical / atlas overflow example</div></div><button class="rp-btn" data-rp-add="sterlingPhys">add</button></div>' +
        '</div>' +
        '<div class="rp-link-note">Draft spec: docs/route-planner.md</div>' +
        '</div>' +
        '<div class="rp-main">' +
        '<div class="rp-toolbar"><div class="rp-h" style="margin:0">Route</div><div><button class="rp-btn" id="rp-sim-btn">simulate route</button></div></div>' +
        '<div class="rp-toolbar-note">A route is a list of enemies killed by physical or alchemy methods. Dog participation is intentionally ignored in this mock.</div>' +
        '<div id="rp-list"></div>' +
        '<div class="rp-sim"><div class="rp-h">Simulation Output</div><div id="rp-sim-out"></div></div>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '</div>';

    // ── Assemble full page ──────────────────────────────────────────────────
    return '<!doctype html><html><head><meta charset="utf-8"><style>' + css + '</style></head>' +
        '<body class="hrest">' +
        '<div class="tabs">' +
        '<button class="tab tab-active" data-tab="radar">\u26a1 Memory</button>' +
        '<button class="tab" data-tab="rooms">\ud83d\uddfa Rooms</button>' +
        '<button class="tab" data-tab="scaling">\u2694\ufe0f Scaling</button>' +
        '<button class="tab" data-tab="route">\ud83e\udded Route</button>' +
        '<button class="tab" data-tab="docs">\ud83d\udcda Docs</button>' +
        '<button class="tab" data-tab="rng">\ud83c\udfb2 RNG</button>' +
        '</div>' +
        memoryTabHtml +
        roomsTabHtml +
        scalingTabHtml +
        buildDocsTabHtml() +
        routeTabHtml +
        buildRngTabHtml() +
        '<script>' + js + '<\/script></body></html>';
}

module.exports = { renderRadarHtml };
