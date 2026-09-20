// Ownership: renderRoomDetail coordinator.
// Orchestrates: header HTML, SVG section, entity tables, ROM scripts, ROM header.
// Then wires all interactions.
// Depends on: utils.js, svg-builder.js, tables-builder.js, rom-header.js, interactions.js (all globals).

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
  var hasIngr=bTrigger.some(function(t,i){return !!getIngrIcon(bTrigNames[i]||t.label||'');});
  var enterTrig=trig.enter||null;
  var hasCoordData=(im!=null)||(entrances.length>0)||(enemies.length>0)||(stepOn.length>0)||(bTrigger.length>0)||(poi.length>0);
  var html='<div class="rd-head">';
  html+='<span class="rd-name">'+escH(room.name)+'</span>';
  if(room.vanillaId)html+='<span class="rd-vid">'+escH(room.vanillaId)+'</span>';
  html+='<span class="rd-file">'+escH(room.relPath||'')+'</span>';
  if(typeof room.startLine==='number'&&room.startLine>=0)html+='<a class="ll" data-line="'+room.startLine+'" href="#">go to code</a>';
  html+='<div class="rd-filters">';
  if(hasCoordData||room.imageUri)html+='<button class="rdf on" data-hide="hide-map" title="Toggle map area">map</button>';
  if(roomVanillaIdNum(room)!=null)html+='<button class="rdf on" data-hide="hide-tiles" title="Toggle decoded ROM collision overlay">tiles</button>';
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
    rh:rh, mapName:room.name
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
    // Sync panX/panY back into state after setup
    state.panX=zp.panX||0;state.panY=zp.panY||0;
    setupMouseEvents({svg:svg,panel:panel,canvas:canvas,wrap:wrap,
                      entrances:entrances,enemies:enemies,stepOn:stepOn,bTrigger:bTrigger,
                      trigOff:trigOff,zoomState:zoomState,state:state,
                      W:svgResult.W,H:svgResult.H,dispW:svgResult.dispW,dispH:svgResult.dispH,
                      _getScale:zp._getScale,_getViewportMetrics:zp._getViewportMetrics,_applyPan:zp._applyPan});
    setupHoverHighlights(svg,panel);
    setupClickHandlers(svg,panel,state);
  }

  // ── ROM tile overlay ───────────────────────────────────────────────────────
  // Ask the host to decode this room's collision grid. Async and on demand:
  // the tree JSON carries no tile data, so nothing renders until this returns.
  requestRoomTileOverlay(room,svgResult);
}

// Name of the room whose tile overlay was last requested. Responses for any
// other room are stale (the user moved on) and get dropped.
var _pendingTileRoom=null;

/** Vanilla room id as a number, or null when the room is not ROM-backed. */
function roomVanillaIdNum(room){
  var raw=room&&room.vanillaId;
  if(raw==null)return null;
  var n=(typeof raw==='number')?raw:parseInt(String(raw).replace(/^0x/i,''),16);
  return (isFinite(n)&&n>=0&&n<=0x7e)?n:null;
}

/** Post a tile-overlay request to the extension host for the rendered room. */
function requestRoomTileOverlay(room,svgResult){
  var id=roomVanillaIdNum(room);
  if(id==null||typeof vs==='undefined'||!vs||!svgResult)return;
  _pendingTileRoom=room.name;
  vs.postMessage({command:'requestRoomTiles',roomId:id,mapName:room.name,
                  originX:svgResult.x1||0,originY:svgResult.y1||0});
}

/**
 * Inject decoded collision paths beneath the entity overlays.
 * One <path> per visual class — a big room is thousands of tiles, so per-tile
 * elements would make pan/zoom crawl.
 */
function applyRoomTileOverlay(msg){
  if(!msg||msg.mapName!==_pendingTileRoom)return;
  var svg=document.getElementById('rg-svg');
  if(!svg)return;

  var old=document.getElementById('rg-tiles');
  if(old&&old.parentNode)old.parentNode.removeChild(old);
  if(msg.error||!msg.overlay||!msg.overlay.layers)return;

  var NS='http://www.w3.org/2000/svg';
  var g=document.createElementNS(NS,'g');
  g.setAttribute('id','rg-tiles');
  g.setAttribute('class','rg-tiles');
  msg.overlay.layers.forEach(function(layer){
    var p=document.createElementNS(NS,'path');
    p.setAttribute('d',layer.d);
    p.setAttribute('fill',layer.fill);
    p.setAttribute('class','rg-tile-'+layer.key);
    g.appendChild(p);
  });
  // First child = painted underneath the grid lines and entity boxes.
  svg.insertBefore(g,svg.firstChild);
}
