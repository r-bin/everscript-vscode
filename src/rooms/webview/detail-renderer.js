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
  // ROM-decoded views. The three layer buttons pick which render the map image
  // shows (mutually exclusive); the rest toggle overlays drawn on top of it.
  if(roomVanillaIdNum(room)!=null){
    html+='<span class="rdf-sep"></span>';
    html+='<button class="rdf rdf-layer on" data-layer="composite" title="Composited map as the SNES displays it (Mode 1)">composite</button>';
    html+='<button class="rdf rdf-layer" data-layer="layer2" title="Layer 2 only — terrain (BG1)">L2 terrain</button>';
    html+='<button class="rdf rdf-layer" data-layer="layer1" title="Layer 1 only — canopy (BG2)">L1 canopy</button>';
    html+='<span class="rdf-sep"></span>';
    // These re-render the map image host-side rather than toggling CSS: the
    // visualization is a pixel-exact port of render_map.py baked into the
    // raster, not SVG shapes layered on top.
    html+='<button class="rdf rdf-ov" data-ov="c" title="Collision: per-plane contours, drift arrows, elevation changes and entity gates (the dashed white tiles), exactly as render_map.py draws them">collision</button>';
    html+='<button class="rdf rdf-ov" data-ov="o" title="ROM map object stamps (Section 3) — needs collision">rom objects</button>';
    html+='<button class="rdf rdf-ov" data-ov="g" title="Cuttable grass tiles — needs collision">grass</button>';
    html+='<span class="rdf-sep"></span>';
  }
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
  setupLayerButtons(panel,room);
  requestRoomTileOverlay(room,svgResult);
}

// Name of the room whose tile overlay was last requested. Responses for any
// other room are stale (the user moved on) and get dropped.
var _pendingTileRoom=null;
// SVG viewBox origin the host rendered against, reused when re-requesting a
// different layer for the same room.
var _pendingTileOrigin={x:0,y:0};
// Which render the map image is showing: composite | layer1 | layer2.
var _currentLayer='composite';
// Baked overlay flags: 'c' collision, 'o' objects, 'g' grass.
var _currentOverlay='';

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

function overlayCacheKey(id,layer,ov){return id+':'+layer+':'+(ov||'');}

function cacheOverlay(id,layer,ov,overlay){
  var keys=Object.keys(_overlayCache);
  if(keys.length>=_OVERLAY_CACHE_MAX)delete _overlayCache[keys[0]];
  _overlayCache[overlayCacheKey(id,layer,ov)]=overlay;
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

  // Serve a previously received overlay immediately; the origin is part of the
  // geometry, so only reuse it when the viewBox origin still matches.
  var hit=_overlayCache[overlayCacheKey(id,which,_currentOverlay)];
  if(hit&&hit.originX===_pendingTileOrigin.x&&hit.originY===_pendingTileOrigin.y){
    applyRoomTileOverlay({command:'roomTiles',mapName:room.name,roomId:id,overlay:hit});
    return;
  }

  setTileBusy(true);
  vs.postMessage({command:'requestRoomTiles',roomId:id,mapName:room.name,
                  layer:which,overlay:_currentOverlay,
                  originX:_pendingTileOrigin.x,originY:_pendingTileOrigin.y});
}

/** Wire the layer and overlay buttons to re-request the rendered map image. */
function setupLayerButtons(panel,room){
  function rerender(){
    requestRoomTileOverlay(room,{x1:_pendingTileOrigin.x,y1:_pendingTileOrigin.y},_currentLayer);
  }

  panel.querySelectorAll('.rdf-layer').forEach(function(btn){
    btn.addEventListener('click',function(){
      var layer=btn.dataset.layer;
      if(layer===_currentLayer)return;
      _currentLayer=layer;
      panel.querySelectorAll('.rdf-layer').forEach(function(b){
        b.classList.toggle('on',b.dataset.layer===layer);
      });
      rerender();
    });
  });

  panel.querySelectorAll('.rdf-ov').forEach(function(btn){
    btn.addEventListener('click',function(){
      var flag=btn.dataset.ov;
      var on=!btn.classList.contains('on');
      btn.classList.toggle('on',on);
      if(on&&_currentOverlay.indexOf(flag)<0)_currentOverlay+=flag;
      else if(!on)_currentOverlay=_currentOverlay.split(flag).join('');
      // Objects and grass only appear as part of the collision pass, so
      // enabling either implies collision rather than silently doing nothing.
      if(on&&flag!=='c'&&_currentOverlay.indexOf('c')<0){
        _currentOverlay+='c';
        var cbtn=panel.querySelector('.rdf-ov[data-ov="c"]');
        if(cbtn)cbtn.classList.add('on');
      }
      rerender();
    });
  });
}

/**
 * Apply the host's decoded room render: the ROM map image, plus a collision
 * overlay drawn as real sub-tile geometry (slopes are triangles, not squares)
 * coloured per elevation plane.
 *
 * Paths are grouped by fill colour — a big room is thousands of tiles, so one
 * SVG node per tile would make pan/zoom crawl.
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
  if(typeof msg.roomId==='number')cacheOverlay(msg.roomId,ov.layer,ov.overlay||'',ov);

  // Rendered map image goes into the existing room-image layer.
  if(ov.imageUri){
    var img=document.getElementById('rg-img');
    if(!img){
      var canvas=document.getElementById('rg-canvas');
      if(canvas){
        img=document.createElement('img');
        img.className='room-img';
        img.id='rg-img';
        img.alt='';
        canvas.insertBefore(img,canvas.firstChild);
      }
    }
    if(img){img.src=ov.imageUri;img.classList.add('rg-rom-render');}
  }

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

/** Render the ROM-derived detail tables at the bottom of the room panel. */
function renderRomDataSections(ov){
  var panel=document.getElementById('room-detail');
  if(!panel)return;
  var old=panel.querySelector('.rs-romdata');
  if(old&&old.parentNode)old.parentNode.removeChild(old);

  var planeNames={0:'0 (blue)',1:'1 (red)',2:'2 (green)',3:'3 (purple)'};
  var planeSwatch={0:'rgba(0,170,255,0.6)',1:'rgba(235,25,25,0.6)',2:'rgba(0,255,170,0.6)',3:'rgba(190,90,255,0.6)'};
  var h='<div class="rs rs-romdata">';

  // Note the lack of source links explicitly. Trigger tables elsewhere in this
  // panel jump to .evs lines; these rows are decoded ROM bytes with no source
  // line to jump to, and silent inconsistency reads as a missing feature.
  h+='<div class="rs-h">ROM MAP DATA <span class="rs-sub">'+ov.widthTiles+'x'+ov.heightTiles+
     ' metatiles · '+ov.metatileCount+' unique · layer: '+escH(ov.layer)+
     ' · decoded from ROM, no source lines</span></div>';

  // Legend: the overlay colours are meaningless without a key.
  h+='<div class="rg-legend">';
  (ov.elevationPlanes||[]).forEach(function(p){
    h+='<span class="lg"><i class="sw" style="background:'+(planeSwatch[p]||planeSwatch[1])+'"></i>collision plane '+p+'</span>';
  });
  if(ov.drift&&ov.drift.length)h+='<span class="lg"><i class="sw" style="background:rgba(72,126,196,0.7)"></i>drift (floor pushes you)</span>';
  if(ov.objects&&ov.objects.length)h+='<span class="lg"><i class="sw" style="background:rgba(120,200,255,0.5);border-color:#78c8ff"></i>rom object</span>';
  if(ov.grass&&ov.grass.length)h+='<span class="lg"><i class="sw" style="background:rgba(120,220,120,0.6)"></i>cuttable grass</span>';
  h+='</div>';
  h+='<table class="rt"><tr><th>Feature</th><th>Count</th><th>Detail</th></tr>';

  h+='<tr class="rd-romdata-row"><td>collision tiles</td><td>'+ov.collisionTiles+'</td><td>'+
     'planes '+(ov.elevationPlanes||[]).map(function(p){return planeNames[p]||p;}).join(', ')+'</td></tr>';
  h+='<tr class="rd-romdata-row"><td>rom objects</td><td>'+ov.objects.length+'</td><td>'+
     ov.objects.reduce(function(a,o){return a+o.states.length;},0)+' states total</td></tr>';
  h+='<tr class="rd-romdata-row"><td>drift tiles</td><td>'+ov.drift.length+'</td><td>'+
     escH(driftSummary(ov.drift))+'</td></tr>';
  h+='<tr class="rd-romdata-row"><td>cuttable grass</td><td>'+ov.grass.length+'</td><td>'+
     (ov.grassWarnings&&ov.grassWarnings.length?escH(ov.grassWarnings.join('; ')):'table well-formed')+'</td></tr>';
  h+='<tr class="rd-romdata-row"><td>tile families</td><td>'+(ov.tileFamilies||[]).length+'</td><td>'+
     (ov.tileFamilies||[]).map(function(f){return hexNum(f,4);}).join(' ')+'</td></tr>';
  h+='<tr class="rd-romdata-row"><td>triggers</td><td>'+(ov.stepOnCount+ov.bTriggerCount)+'</td><td>'+
     ov.stepOnCount+' step-on, '+ov.bTriggerCount+' b-trigger</td></tr>';
  h+='</table>';

  if(ov.objects.length){
    h+='<div class="rs-h">ROM OBJECTS</div>';
    h+='<table class="rt"><tr><th>#</th><th>State</th><th>Pos</th><th>Size</th><th>Metatile</th></tr>';
    ov.objects.forEach(function(o){
      o.states.forEach(function(s){
        h+='<tr class="rd-romobj-row"><td>'+o.index+'</td><td>'+s.state+'/'+o.maxState+'</td><td>'+
           s.x+','+s.y+'</td><td>'+s.w+'x'+s.h+'</td><td>'+hexNum(s.metatileId,4)+'</td></tr>';
      });
    });
    h+='</table>';
  }

  h+='</div>';
  panel.insertAdjacentHTML('beforeend',h);
}

/** "12 N, 4 SE" — how many drift tiles push each way. */
function driftSummary(drift){
  if(!drift||!drift.length)return 'none';
  var counts={};
  drift.forEach(function(d){counts[d.name]=(counts[d.name]||0)+1;});
  return Object.keys(counts).sort().map(function(k){return counts[k]+' '+k;}).join(', ');
}
