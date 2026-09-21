// Ownership: renderRoomDetail coordinator, and the request/response cycle for
// the host-rendered ROM map image.
// Orchestrates: header HTML, SVG section, entity tables, ROM scripts, ROM header.
// Then wires all interactions.
// Depends on: utils.js, svg-builder.js, tables-builder.js, rom-header.js,
// interactions.js, rom-overlay.js (all globals — the webview JS is concatenated
// into one script). rom-overlay.js owns the top bar and the ROM data section;
// this file owns _pendingTileRoom / _pendingTileOrigin and reads that bar's
// _currentLayer / _currentOverlay when building a request.

function renderRoomDetail(room){
  var panel=document.getElementById('room-detail');
  if(!panel)return;
  panel.className='';
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
  var hasIngr=bTrigger.some(function(t,i){return !!getIngrIcon(trigIngrName(t,bTrigNames[i]||t.label||''));});
  var enterTrig=trig.enter||null;
  var hasCoordData=(im!=null)||(entrances.length>0)||(enemies.length>0)||(stepOn.length>0)||(bTrigger.length>0)||(poi.length>0);
  var html='<div class="rd-head">';
  html+='<span class="rd-name">'+escH(room.name)+'</span>';
  if(room.vanillaId)html+='<span class="rd-vid">'+escH(room.vanillaId)+'</span>';
  html+='<span class="rd-file">'+escH(room.relPath||'')+'</span>';
  if(typeof room.startLine==='number'&&room.startLine>=0)html+='<a class="ll" data-line="'+room.startLine+'" href="#">go to code</a>';
  html+='<div class="rd-filters">';
  if(hasCoordData||room.imageUri)html+='<button class="rdf on" data-hide="hide-map" title="Toggle map area">map</button>';
  // ROM-decoded views: layer choice plus one toggle per baked feature. Built
  // from the live state in rom-overlay.js, not from fixed defaults, so the bar
  // always agrees with what is on screen. See buildRomViewButtonsHtml.
  if(roomVanillaIdNum(room)!=null)html+=buildRomViewButtonsHtml();
  if(rh)html+='<button class="rdf on" data-hide="hide-header" title="Toggle ROM header section">header</button>';
  if(enterTrig||stepOn.length||bTrigger.length)html+='<button class="rdf on" data-hide="hide-scripts" title="Toggle decoded script tables">scripts</button>';
  if(stepOn.length||bTrigger.length)html+='<button class="rdf on" data-hide="hide-trigger" title="Toggle trigger overlays and tables">trigger</button>';
  if(entrances.length)html+='<button class="rdf on" data-hide="hide-ent" title="Toggle entrances">entrance</button>';
  if(objs.length)html+='<button class="rdf on" data-hide="hide-obj" title="Toggle objects">object</button>';
  if(enemies.length)html+='<button class="rdf on" data-hide="hide-enem" title="Toggle enemies">enemy</button>';
  if(poi.length)html+='<button class="rdf on" data-hide="hide-poi" title="Toggle points of interest">POI</button>';
  if(hasCoordData||room.imageUri)html+='<button class="rdf on" data-hide="hide-grid8" title="Toggle 8 px grid">8px</button>';
  if(stepOn.length||bTrigger.length)html+='<button class="rdf on" data-hide="hide-grid16" title="Toggle 16 px trigger grid">16px</button>';
  if(hasIngr)html+='<button class="rdf on" data-hide="hide-ingr" title="Toggle ingredient icons">🌿</button>';
  if(trig.enter&&trig.enter.spawns&&trig.enter.spawns.length)
    html+='<button class="rdf on" data-hide="hide-spawn" title="Toggle NPCs the enter script can place">npc</button>';
  html+='<button class="rdf on" id="rg-lock-btn" title="Unlock map">locked</button>';
  html+='</div></div>';

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
    rh:rh, mapName:room.name,
    romSpawns:(trig.enter&&trig.enter.spawns)||[]
  });
  html+=svgResult.html;

  // ── Entity tables ──────────────────────────────────────────────────────────
  html+=buildEntityTablesHtml(c,trigOff);

  // ── ROM scripts section ────────────────────────────────────────────────────
  html+=buildRomScriptsHtml(c,trigOff);

  // ── ROM header section ─────────────────────────────────────────────────────
  html+=buildRomHeaderHtml(rh);

  panel.innerHTML=html;
  bindLinks(panel);

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
  setupByteScriptFocusBinding(panel);

  var svg=document.getElementById('rg-svg');
  var canvas=document.getElementById('rg-canvas');
  var wrap=document.getElementById('rg-wrap');

  if(svg&&canvas&&wrap){
    var zoomState=svgResult.zoomState;
    var state={panX:0,panY:0,panActive:false,locked:true,dragEnt:null,selActive:false,
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
  resetObjectStatesFor(room.name);
  setupLayerButtons(panel,room);
  requestRoomTileOverlay(room,svgResult);
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
  return id+':'+layer+':'+(ov||'')+':'+(states||'')+':'+(_animateOn?'a':'');
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
  if(id==null||typeof vs==='undefined'||!vs||!svgResult)return;
  var which=layer||_currentLayer;
  _pendingTileRoom=room.name;
  _pendingTileOrigin={x:svgResult.x1||0,y:svgResult.y1||0};
  if(typeof svgResult.mapX0==='number')_pendingTileMapOrigin={x:svgResult.mapX0,y:svgResult.mapY0};

  // Serve a previously received overlay immediately; the origin is part of the
  // geometry, so only reuse it when the viewBox origin still matches.
  var states=objectStateSpec();
  var hit=_overlayCache[overlayCacheKey(id,which,_currentOverlay,states)];
  if(hit&&hit.originX===_pendingTileOrigin.x&&hit.originY===_pendingTileOrigin.y){
    applyRoomTileOverlay({command:'roomTiles',mapName:room.name,roomId:id,overlay:hit});
    return;
  }

  setTileBusy(true);
  vs.postMessage({command:'requestRoomTiles',roomId:id,mapName:room.name,
                  layer:which,overlay:_currentOverlay,objectStates:states,animate:_animateOn,
                  originX:_pendingTileOrigin.x,originY:_pendingTileOrigin.y});
}

/**
 * Apply the host's decoded room render: swap in the map image and rebuild the
 * ROM data section beneath it.
 *
 * The features are already baked into the image, so there is no per-tile SVG
 * to build here — which is also why this stays fast on a 86x42 room.
 */
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
  }

  // Section 2 tile animation, if the host sent frames for it.
  if(_animateOn)applyRoomAnimation(ov.animation);
  else stopRoomAnimation();

  // The collision / drift / gate / grass / object visualization is baked into
  // the rendered image by the host (a port of render_map.py, verified
  // pixel-identical), so there is nothing to draw here — the SVG layer is left
  // for the interactive entity and trigger overlays that were always there.
  renderRomDataSections(ov);
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
  if(head&&head.nextSibling)panel.insertBefore(el,head.nextSibling);
  else panel.appendChild(el);
}

function clearTileError(){
  var panel=document.getElementById('room-detail');
  if(!panel)return;
  var old=panel.querySelector('.rs-tile-error');
  if(old&&old.parentNode)old.parentNode.removeChild(old);
}
