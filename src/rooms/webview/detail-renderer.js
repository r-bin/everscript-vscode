// Ownership: renderRoomDetail coordinator, and the request/response cycle for
// the host-rendered ROM map image.
// Orchestrates: the header line and the editor (SVG section, filter bar,
// status bar). Nothing is drawn under the editor any more: the trigger
// scripts live in the Trigger tab, the header in Info, and what the editor
// has no place for is parked in sandbox/room-data/ (its README says what and why).
// Then wires all interactions.
// Depends on: utils.js, svg-builder.js, interactions.js, rom-overlay.js (all
// globals — the webview JS is concatenated into one script). rom-overlay.js
// owns the top bar; this file owns _pendingTileRoom / _pendingTileOrigin and reads that bar's
// _currentLayer / _currentOverlay when building a request.

function renderRoomDetail(room){
  var panel=document.getElementById('room-detail');
  if(!panel)return;
  // rg-theme scopes the map editor's design tokens (map-editor-theme.css) —
  // #room-detail is the one node that already wraps the canvas, the docked
  // panel column and the filter bar above it, so no extra wrapper is needed.
  panel.className='rg-theme';
  // Leaving a custom map keeps its draft (map-editor-custom.js).
  if(!room.custom&&typeof customStash==='function')customStash();
  console.log('[RoomsRender] renderRoomDetail:start', {room: room && room.name});
  var c=room.content||{};
  var im=c.initMap;
  var trig=c.triggers||{enter:null,stepOn:[],bTrigger:[],meta:null};
  var entrances=c.entrances||[];
  var enemies=c.enemies||[];
  var objs=c.objects||[];
  var stepOn=trig.stepOn||[];
  var bTrigger=trig.bTrigger||[];
  var poi=c.poi||[];
  var trigNames=c.triggerNames||{stepOn:[],bTrigger:[]};
  var stepOnNames=trigNames.stepOn||[];
  var bTrigNames=trigNames.bTrigger||[];
  var trigOff=c.trigOffset||null;
  var rh=c.romHeader||null;
  var roomError=c.roomError||null;

  // ── Detail header ──────────────────────────────────────────────────────────
  var hasIngr=bTrigger.some(function(t,i){return !!itemEmoji(trigItemName(t,bTrigNames[i]||t.label||''));});
  var enterTrig=trig.enter||null;
  var hasCoordData=(im!=null)||(entrances.length>0)||(enemies.length>0)||(stepOn.length>0)||(bTrigger.length>0)||(poi.length>0);
  var html;
  // Editing a widget, the same bar is the widget's (map-editor-widget-edit.js).
  if(typeof widgetEditShowing==='function'&&widgetEditShowing(room)){
    html=widgetEditHeadHtml();
  }else{
    html='<div class="rd-head">';
    // A custom map's name is its own to change; a ROM room's is the game's.
    if(room.custom)html+='<input id="rg-map-name" class="rg-appbar-name rd-name-input" value="'+escH(room.name)
      +'" aria-label="Map name" title="The map’s name — Enter to finish"/>';
    else html+='<span class="rd-name">'+escH(room.name)+'</span>';
    if(room.vanillaId)html+='<span class="rd-vid">'+escH(room.vanillaId)+'</span>';
    html+='<span class="rd-file">'+escH(room.relPath||'')+'</span>';
    if(typeof room.startLine==='number'&&room.startLine>=0)html+='<a class="ll" data-line="'+room.startLine+'" href="#">go to code</a>';
    // The map's own actions — the ⋯ menu and the lock (map-editor-toolbar.js renderEditHeadActs).
    html+='<span class="rd-head-acts" id="rg-head-acts"></span>';
    html+='</div>';
  }

  // The per-room display toggles, and the status bar under them. The
  // *arrangement* is map-editor-filterbar.js's (Phase 7a: a segmented
  // Background|Foreground|Collision pill plus four dropdown chips, in place
  // of the ~25 flat chips this function used to emit inline); what this file
  // still owns is the answer to "which of them apply to this room", since
  // that needs the header's own data — hasCoordData, roomVanillaIdNum,
  // hasIngr — not svg-builder's.
  //
  // Both bars are docked below the canvas card rather than under the name
  // line: see buildRoomSvgSection's filtersHtml/statusHtml params.
  var filterCtx={
    romId:roomVanillaIdNum(room)!=null,
    hasMap:hasCoordData||!!room.imageUri,
    hasHeader:!!rh,
    hasScripts:!!(enterTrig||stepOn.length||bTrigger.length),
    hasTriggers:!!(stepOn.length||bTrigger.length),
    hasEntrances:entrances.length>0,
    hasObjects:objs.length>0,
    hasEnemies:enemies.length>0,
    hasPoi:poi.length>0,
    hasIngr:hasIngr,
    hasSpawns:!!(trig.enter&&trig.enter.spawns&&trig.enter.spawns.length),
    hasHitbox:!!(trig.enter&&trig.enter.spawns&&trig.enter.spawns.some(function(s){return s.hitW;})),
    hasArrivals:!!(trig.arrivals&&trig.arrivals.length),
    // A vanilla (or .evs) room opens locked, a custom map unlocked; the same
    // room redrawn keeps what its draft says (interactions.js's lock button).
    locked:roomLockedNow(room)
  };
  var filtersHtml=buildViewFilterBarHtml(filterCtx);
  var statusHtml=buildStatusBarHtml(statusRoomSize(rh,room.imageDims));

  // ── Error banner ───────────────────────────────────────────────────────────
  if(roomError&&roomError.message){
    html+='<div class="rs rs-error"><div class="rs-h">Error</div><div class="rs-note">'+escH(roomError.message)+'</div></div>';
  }

  // ── SVG section ────────────────────────────────────────────────────────────
  var svgResult=buildRoomSvgSection({
    im:im, entrances:entrances, enemies:enemies,
    stepOn:stepOn, bTrigger:bTrigger, poi:poi,
    trigOff:trigOff, stepOnNames:stepOnNames, bTrigNames:bTrigNames,
    imageUri:room.imageUri||null, imageDims:room.imageDims||null,
    filtersHtml:filtersHtml, statusHtml:statusHtml,
    rh:rh, mapName:room.name,
    romSpawns:(trig.enter&&trig.enter.spawns)||[],
    arrivals:trig.arrivals||[]
  });
  html+=svgResult.html;

  panel.innerHTML=html;
  bindLinks(panel);
  // The editor: its own draft per room, and gesture handlers that stay out
  // of the way until edit mode is on.
  _editOrigin={x:svgResult.mapX0||0,y:svgResult.mapY0||0};
  if(_mtPalette&&!mtPaletteFits(room))_mtPalette=null;
  if(room.custom)customBindDraft(room);
  else if(!editDraft()||editDraft().customKey||editDraft().roomId!==roomVanillaIdNum(room))editReset(roomVanillaIdNum(room));
  if(editDraft())editDraft().locked=filterCtx.locked;
  bindEditControls(panel,room);
  setupEditGestures();
  if(typeof setupCollisionCarve==='function')setupCollisionCarve(); // right-button carving (map-editor-collision-tab.js)
  setupEditKeys();
  // After setupEditGestures: both listen on #rg-wrap and the gesture handler
  // stops propagation mid-stroke, so this one is registered on the same node
  // (where stopPropagation cannot starve it) rather than on an ancestor.
  setupStatusBar();
  renderStatusSize();

  // Sync hide-classes to the filter buttons' initial state. Without this a
  // button rendered without .on would read as "off" while its content is still
  // visible (the click handler only toggles, it never initialises).
  panel.querySelectorAll('.rdf[data-hide]').forEach(function(btn){
    panel.classList.toggle(btn.dataset.hide,!btn.classList.contains('on'));
  });
  panel.querySelectorAll('.rdf[data-show]').forEach(function(btn){
    panel.classList.toggle(btn.dataset.show,btn.classList.contains('on'));
  });

  // ── Post-render interaction setup ──────────────────────────────────────────
  setupByteScriptFocus();

  var svg=document.getElementById('rg-svg');
  var canvas=document.getElementById('rg-canvas');
  var wrap=document.getElementById('rg-wrap');

  if(svg&&canvas&&wrap){
    var zoomState=svgResult.zoomState;
    var state={panX:0,panY:0,panActive:false,locked:filterCtx.locked,dragEnt:null,selActive:false,
               selSx:0,selSy:0,panCX:0,panCY:0,panBX:0,panBY:0};
    var zp={svg:svg,canvas:canvas,wrap:wrap,
             W:svgResult.W,H:svgResult.H,
             dispW:svgResult.dispW,dispH:svgResult.dispH,
             zoomState:zoomState,panX:state.panX,panY:state.panY};
    setupZoomPan(zp);
    // Enemies whose idle animation walked to more than one frame play it.
    startSpawnAnimation(svg);
    // zp owns the pan offset; mouse handlers read it via zp._getPan(). Do not
    // mirror it into `state` — that duplicate is what used to go stale.
    setupMouseEvents({svg:svg,panel:panel,canvas:canvas,wrap:wrap,
                      entrances:entrances,enemies:enemies,stepOn:stepOn,bTrigger:bTrigger,
                      trigOff:trigOff,zoomState:zoomState,state:state,
                      W:svgResult.W,H:svgResult.H,dispW:svgResult.dispW,dispH:svgResult.dispH,
                      // _getPan must come along: without it the drag base
                      // falls back to a always-zero local copy, so every pan
                      // snapped back to the top-left corner.
                      _getScale:zp._getScale,_getViewportMetrics:zp._getViewportMetrics,
                      _applyPan:zp._applyPan,_getPan:zp._getPan});
    setupHoverHighlights(svg,panel);
    setupClickHandlers(svg,panel,state);
  }

  // ── ROM tile overlay ───────────────────────────────────────────────────────
  // Ask the host to decode and render this room. Async and on demand: the tree
  // JSON carries no tile data, so nothing appears until this returns.
  // Object state picks are per room — index 4 is a different object elsewhere.
  // The old room's overlay is about to be thrown away with the panel HTML;
  // stop its timer first so it is not left ticking against detached nodes.
  stopRoomAnimation();
  setupLayerButtons(panel,room);
  requestRoomTileOverlay(room,svgResult);
  if(room.custom)customAfterRender(room);
  // Every map opens in the editor — there is no `edit` button. The panel was
  // just rebuilt, so a draft already on is switched on again to rebuild its
  // tool pill and dock; a locked vanilla room can be looked at, not changed.
  else if(roomVanillaIdNum(room)!=null&&editDraft()){editDraft().on=false;editToggle(room,null);}
}

/** Whether this room opens locked: a custom map never, anything else yes, unless its draft says otherwise. */
function roomLockedNow(room){
  if(room.custom)return false;
  var d=editDraft();
  if(d&&!d.customKey&&d.roomId===roomVanillaIdNum(room)&&typeof d.locked==='boolean')return d.locked;
  return true;
}

// Name of the room whose tile overlay was last requested. Responses for any
// other room are stale (the user moved on) and get dropped.
var _pendingTileRoom=null;
// SVG viewBox origin the host rendered against, reused when re-requesting a
// different layer for the same room.
var _pendingTileOrigin={x:0,y:0};
// Where the map image's top-left sits in viewBox units. Distinct from
// _pendingTileOrigin: the viewBox can start left of / above the map when a
// trigger overhangs the edge, and the image must stay on the map.
var _pendingTileMapOrigin={x:0,y:0};
// _currentLayer and _currentOverlay live in rom-overlay.js, which owns the
// top bar that changes them.

/**
 * Numeric ROM room id, or null when the room is not ROM-backed.
 *
 * Prefers `romRoomId`, which the host resolves through the MAP enum. Live
 * rooms carry a symbolic enum name in `vanillaId` (e.g. SOUTH_JUNGLE), so
 * parsing that as hex yields NaN and the ROM overlay would never activate —
 * which is exactly what happened before `romRoomId` was threaded through.
 */
function roomVanillaIdNum(room){
  if(!room)return null;
  var n=room.romRoomId;
  if(typeof n!=='number'||!isFinite(n)){
    var raw=room.vanillaId;
    if(raw==null)return null;
    n=(typeof raw==='number')?raw:parseInt(String(raw).replace(/^0x/i,''),16);
  }
  return (isFinite(n)&&n>=0&&n<=0x7e)?n:null;
}

// Overlay responses already received, keyed roomId:layer. Flipping between
// layers is a common interaction and each response carries a base64 PNG of up
// to several hundred KB, so a hit here skips the whole IPC round trip.
var _overlayCache={};
var _OVERLAY_CACHE_MAX=16;

function overlayCacheKey(id,layer,ov,states){
  var hdr=typeof infoRenderHeader==='function'?infoRenderHeader(id):null;
  return id+':'+layer+':'+(ov||'')+':'+(states||'')+':'+(roomAnimateOn()?'a':'')+(hdr?':'+JSON.stringify(hdr):'');
}

function cacheOverlay(id,layer,ov,states,overlay){
  var keys=Object.keys(_overlayCache);
  if(keys.length>=_OVERLAY_CACHE_MAX)delete _overlayCache[keys[0]];
  _overlayCache[overlayCacheKey(id,layer,ov,states)]=overlay;
}

/** Show or clear the map-area busy state. */
function setTileBusy(busy){
  var outer=document.getElementById('rg-outer');
  if(outer)outer.classList.toggle('rg-busy',!!busy);
}

/** Post a tile-overlay request to the extension host for the rendered room. */
function requestRoomTileOverlay(room,svgResult,layer){
  var id=roomVanillaIdNum(room);
  // A custom map's id is only where its graphics come from; rendering that
  // room would put the donor's picture under the new map.
  if(room&&room.custom)return;
  if(id==null||typeof vs==='undefined'||!vs||!svgResult)return;
  var which=layer||_currentLayer;
  _pendingTileRoom=room.name;
  _pendingTileOrigin={x:svgResult.x1||0,y:svgResult.y1||0};
  if(typeof svgResult.mapX0==='number')_pendingTileMapOrigin={x:svgResult.mapX0,y:svgResult.mapY0};

  // Serve a previously received overlay immediately; the origin is part of the
  // geometry, so only reuse it when the viewBox origin still matches.
  var states='';
  var hit=_overlayCache[overlayCacheKey(id,which,romOverlayFlags(),states)];
  if(hit&&hit.originX===_pendingTileOrigin.x&&hit.originY===_pendingTileOrigin.y){
    applyRoomTileOverlay({command:'roomTiles',mapName:room.name,roomId:id,overlay:hit});
    return;
  }

  setTileBusy(true);
  vs.postMessage({command:'requestRoomTiles',roomId:id,mapName:room.name,
                  layer:which,overlay:romOverlayFlags(),objectStates:states,animate:roomAnimateOn(),
                  originX:_pendingTileOrigin.x,originY:_pendingTileOrigin.y,
                  header:typeof infoRenderHeader==='function'?infoRenderHeader(id):null});
}

/**
 * Apply the host's decoded room render: swap in the map image and rebuild the
 * ROM data section beneath it.
 *
 * The features are already baked into the image, so there is no per-tile SVG
 * to build here — which is also why this stays fast on a 86x42 room.
 */
/**
 * Point one of the map's extra <image> layers at a render, or hide it.
 *
 * Every layer the host renders covers the same pixels as the map, so they
 * all take the map's position and size — only the href differs.
 */
function placeMapLayer(id,uri,ov){
  var el=document.getElementById(id);
  if(!el)return;
  if(!uri){el.style.display='none';return;}
  el.setAttribute('href',uri);
  el.setAttribute('width',ov.imageWidth/8);
  el.setAttribute('height',ov.imageHeight/8);
  el.setAttribute('x',_pendingTileMapOrigin.x);
  el.setAttribute('y',_pendingTileMapOrigin.y);
  el.style.display='';
}

function applyRoomTileOverlay(msg){
  if(!msg||msg.mapName!==_pendingTileRoom)return;
  setTileBusy(false);
  var svg=document.getElementById('rg-svg');
  if(!svg)return;

  var old=document.getElementById('rg-tiles');
  if(old&&old.parentNode)old.parentNode.removeChild(old);

  if(msg.error){showTileError(msg.error);return;}
  if(!msg.overlay)return;
  clearTileError();
  var ov=msg.overlay;
  if(typeof msg.roomId==='number')cacheOverlay(msg.roomId,ov.layer,ov.overlay||'',ov.objectStates||'',ov);

  // Swap the render into the SVG's <image>, and resize it to the raster's real
  // extent in viewBox units (1 unit = one 8px tile). Sizing it here rather
  // than letting CSS stretch it to the canvas is what keeps the grid aligned:
  // the viewBox is wider than the map whenever a trigger sits at the edge.
  if(ov.imageUri){
    var img=document.getElementById('rg-img');
    if(img){
      img.setAttribute('href',ov.imageUri);
      img.setAttribute('width',ov.imageWidth/8);
      img.setAttribute('height',ov.imageHeight/8);
      img.setAttribute('x',_pendingTileMapOrigin.x);
      img.setAttribute('y',_pendingTileMapOrigin.y);
      img.classList.add('rg-rom-render');
    }
    // Two more layers of the same render, each already sized and positioned
    // like the map: the canopy (the pixels that go over a character, which
    // sits between the two spawn groups) and the feature overlay redrawn on
    // the canopy (which sits above everything).
    placeMapLayer('rg-fg',ov.foregroundUri,ov);
    placeMapLayer('rg-canopy-ov',ov.canopyOverlayUri,ov);
  }

  // Section 2 tile animation, if the host sent frames for it.
  if(roomAnimateOn())applyRoomAnimation(ov.animation);
  else stopRoomAnimation();

  // The collision / drift / gate / grass / object visualization is baked into
  // the rendered image by the host (a port of render_map.py, verified
  // pixel-identical), so there is nothing to draw here — the SVG layer is left
  // for the interactive entity and trigger overlays that were always there.
}

/**
 * Surface a render/decode failure in the panel itself.
 *
 * Previously these only reached the devtools console, so a user whose ROM was
 * missing or unreadable just saw no map and no reason why.
 */
function showTileError(message){
  var panel=document.getElementById('room-detail');
  if(!panel)return;
  clearTileError();
  var head=panel.querySelector('.rd-head');
  var el=document.createElement('div');
  el.className='rs rs-error rs-tile-error';
  el.innerHTML='<div class="rs-h">Map render unavailable</div><div class="rs-note">'+escH(message)+'</div>';
  // The name line may sit inside the map column (map-editor-ui.js editDock).
  if(head&&head.parentNode)head.parentNode.insertBefore(el,head.nextSibling);
  else panel.appendChild(el);
}

function clearTileError(){
  var panel=document.getElementById('room-detail');
  if(!panel)return;
  var old=panel.querySelector('.rs-tile-error');
  if(old&&old.parentNode)old.parentNode.removeChild(old);
}
