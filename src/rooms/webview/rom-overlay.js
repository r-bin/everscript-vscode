// Ownership: the ROM map view's top-bar controls and its bottom data section.
// Owns _currentLayer / _currentOverlay — which render is on screen and which
// features are baked into it. Called from detail-renderer.js.
//
// The features are baked host-side (a pixel-identical port of render_map.py),
// so every toggle costs a re-render round trip rather than a CSS class. That
// is the price of matching upstream exactly; the host caches the results.

// Which render the map image is showing: composite | layer1 | layer2.
var _currentLayer='composite';
// Play the Section 2 tile animation. On by default — a room with running
// water or a lit torch reads wrong frozen, and the frames are cheap.
var _animateOn=true;

/**
 * Feature toggles, in top-bar order. The flag characters are the contract with
 * rooms/rendering/tile-overlay.js — keep them in step with its OVERLAY_FLAGS.
 */
var OVERLAY_BUTTONS=[
  {f:'c',label:'collision',title:'Per-plane passability contours plus the solid-wall tint. The dominant plane draws solid, the others dashed, so a tunnel under a bridge reads as two crossing outlines.'},
  {f:'d',label:'drift',title:'Forced-walkable tiles (collision bit 13) — sewer pipes, volcano slides, desert drift — with an arrow per tile showing which way the floor pushes you.'},
  {f:'e',label:'elevation',title:'Tiles where crossing swaps which elevation plane you are on.'},
  {f:'p',label:'pass-thru',title:'Plane-transparent tiles (collision bit 6) — bridge and overpass tiles you walk straight through while on another plane.'},
  {f:'n',label:'gates',title:'Entity-gated tiles (collision bit 8), drawn as dashed white borders: solid for the boy, for the dog, or for everything except them.'},
  {f:'g',label:'grass',title:'Cuttable grass — a temporary barrier, so it is excluded from every plane’s contour.'},
  {f:'o',label:'rom objects',title:'Section 3 object stamps, labelled with the index SoEScriptDumper’s script_all calls OBJ n.'},
  {f:'t',label:'rom triggers',title:'Step-on (magenta) and B-trigger (yellow) boxes decoded from the ROM, labelled with their hex script id.'},
  {f:'l',label:'labels',title:'The object index and hex script id printed inside each box.'}
];

/** Every feature on — what a room shows before the user opts anything out. */
var ALL_OVERLAY_FLAGS=OVERLAY_BUTTONS.map(function(b){return b.f;}).join('');

// Baked feature flags. Everything is on by default — the view exists to show
// what is in the room, and the bar is how you narrow it down — **except
// collision**, which paints contours over every tile and is the one you turn
// on to look at, not the one you look through (§8e).
var _currentOverlay=ALL_OVERLAY_FLAGS.replace('c','');

// How collision (`c`) is drawn: 'outline' — the per-plane contours, the
// default — or 'tiles' — every tile's solid pixels filled in its level's
// colour. Not a feature flag of its own: it rides along as `k` in the
// string the host gets (romOverlayFlags), so "all" never turns it on.
var _collisionMode='outline';

/** The flag string for a render request: the features, plus how collision is drawn. */
function romOverlayFlags(){
  return _currentOverlay+(_collisionMode==='tiles'&&_currentOverlay.indexOf('c')>=0?'k':'');
}

/** Pick how collision is drawn (the Collision chip's menu, map-editor-filterbar.js). */
function collisionModeSet(mode){
  _collisionMode=mode==='tiles'?'tiles':'outline';
  if(_currentOverlay.indexOf('c')<0){
    _currentOverlay=ALL_OVERLAY_FLAGS.split('').filter(function(ch){return ch==='c'||_currentOverlay.indexOf(ch)>=0;}).join('');
    document.querySelectorAll('.rdf-ov[data-ov="c"]').forEach(function(b){b.classList.add('on');});
  }
  document.querySelectorAll('[data-collision-mode]').forEach(function(b){
    b.classList.toggle('on',b.dataset.collisionMode===_collisionMode);
  });
  if(typeof vs!=='undefined'&&vs)vs.postMessage({command:'saveUiPref',key:'collisionMode',value:_collisionMode});
  if(_romRerender)_romRerender();
  if(typeof collisionFlagsChanged==='function')collisionFlagsChanged();
}

/** The three renders the host can bake: both layers, or one on its own. */
var ROM_LAYER_BUTTONS=[
  ['composite','composite','Composited map as the SNES displays it (Mode 1) — both layers at once'],
  ['layer2','L2 terrain','Layer 2 only — terrain (BG1)'],
  ['layer1','L1 canopy','Layer 1 only — canopy (BG2)']
];

/**
 * One button per control, rather than one pre-baked row of all of them.
 *
 * The filter bar (map-editor-filterbar.js) arranges these into the design
 * mock's six slots — a segmented pill, three dropdown chips and an overflow
 * menu — so it needs each control on its own. Every button still renders
 * from the live state here rather than from fixed defaults, so a bar rebuilt
 * on a room switch always agrees with what is on screen.
 */
function romLayerButtonHtml(key,label){
  var def=null;
  ROM_LAYER_BUTTONS.forEach(function(l){if(l[0]===key)def=l;});
  if(!def)return '';
  return '<button class="rdf rdf-layer'+(_currentLayer===key?' on':'')+'" data-layer="'+key+
         '" title="'+escH(def[2])+'">'+escH(label||def[1])+'</button>';
}

function romOverlayButtonHtml(flag,label){
  var def=null;
  OVERLAY_BUTTONS.forEach(function(b){if(b.f===flag)def=b;});
  if(!def)return '';
  return '<button class="rdf rdf-ov'+(_currentOverlay.indexOf(flag)>=0?' on':'')+'" data-ov="'+flag+
         '" title="'+escH(def.title)+'">'+escH(label||def.label)+'</button>';
}

function romAllOverlaysButtonHtml(){
  return '<button class="rdf rdf-ov-all'+(_currentOverlay===ALL_OVERLAY_FLAGS?' on':'')+
         '" title="Turn every feature overlay on, or all of them off">all</button>';
}

function romAnimateButtonHtml(){
  return '<button class="rdf'+(_animateOn?' on':'')+'" id="rg-animate" title="Play the room’s '
    +'Section 2 tile animation — water, lava, torches, fans. The frames sit on top of the '
    +'rendered map, so a collision marking on an animated tile is hidden while this is on.">animate</button>';
}

function romExportButtonHtml(){
  return '<button class="rdf on" id="rg-export" title="Save exactly what is on screen — this '
    +'layer, these overlays, these object states — as a PNG">export png</button>';
}

/**
 * Is the terrain (`bg`) or the canopy (`fg`) layer currently drawn?
 *
 * The host bakes exactly one of three renders per request, so "both layers
 * visible" is the `composite` choice rather than two independent flags. The
 * design mock's filter bar shows Background and Foreground as two
 * independently-toggleable segments, so these two derived booleans are what
 * those segments read and write — one owner (`_currentLayer`), two views of
 * it, no mirrored state. Turning both off is refused in setupLayerButtons:
 * there is no "render nothing" layer for the host to bake.
 */
function romLayerVis(which){
  return _currentLayer==='composite'||_currentLayer===(which==='bg'?'layer2':'layer1');
}

function romVisSegmentHtml(which,label,title){
  return '<button class="rdf rdf-vis'+(romLayerVis(which)?' on':'')+'" data-vis-layer="'+which+
         '" title="'+escH(title)+'">'+escH(label)+'</button>';
}

/**
 * Keep the panel's class in sync with the baked trigger boxes.
 *
 * The SVG layer draws its own trigger rects for hover, tooltips and jump-to-
 * source. When the ROM trigger boxes are baked in they cover the same tiles, so
 * the SVG ones drop their paint and stay on purely as hit targets rather than
 * double-drawing every trigger in two different colours.
 */
function syncRomTriggerClass(panel){
  if(panel)panel.classList.toggle('rom-triggers',_currentOverlay.indexOf('t')>=0);
}

/** Wire the layer, feature and export buttons for the ROM map view. */
function setupLayerButtons(panel,room){
  function rerender(){
    syncRomTriggerClass(panel);
    requestRoomTileOverlay(room,{x1:_pendingTileOrigin.x,y1:_pendingTileOrigin.y},_currentLayer);
  }
  _romRerender=rerender;
  var exportBtn=panel.querySelector('#rg-export');
  if(exportBtn)exportBtn.addEventListener('click',function(){
    var id=roomVanillaIdNum(room);
    if(id==null||typeof vs==='undefined'||!vs)return;
    // The host re-renders from the same inputs rather than decoding the data
    // URI already on screen: a data URI large enough for a 2048x1120 room is
    // not something to round-trip through postMessage a second time.
    vs.postMessage({command:'exportRoomPng',roomId:id,mapName:room.name,
                    layer:_currentLayer,overlay:romOverlayFlags(),
                    objectStates:objectStateSpec()});
  });
  function syncOverlayButtons(){
    panel.querySelectorAll('.rdf-ov').forEach(function(b){
      b.classList.toggle('on',_currentOverlay.indexOf(b.dataset.ov)>=0);
    });
    var all=panel.querySelector('.rdf-ov-all');
    if(all)all.classList.toggle('on',_currentOverlay===ALL_OVERLAY_FLAGS);
  }

  // One sync for both views of `_currentLayer`: the three-way radio (in the
  // filter bar's overflow menu) and the two Background/Foreground segments
  // (its primary row). Either control can change it, so both are redrawn
  // from it rather than each tracking its own idea of what is on.
  function syncLayerButtons(){
    panel.querySelectorAll('.rdf-layer').forEach(function(b){
      b.classList.toggle('on',b.dataset.layer===_currentLayer);
    });
    panel.querySelectorAll('.rdf-vis').forEach(function(b){
      b.classList.toggle('on',romLayerVis(b.dataset.visLayer));
    });
  }

  panel.querySelectorAll('.rdf-layer').forEach(function(btn){
    btn.addEventListener('click',function(){
      if(btn.dataset.layer===_currentLayer)return;
      _currentLayer=btn.dataset.layer;
      syncLayerButtons();
      rerender();
    });
  });

  // The Background/Foreground segments: two booleans over the one layer
  // choice — see romLayerVis. Both off has no render, so it is refused
  // rather than silently doing nothing to the state.
  panel.querySelectorAll('.rdf-vis').forEach(function(btn){
    btn.addEventListener('click',function(){
      var bg=romLayerVis('bg'),fg=romLayerVis('fg');
      if(btn.dataset.visLayer==='bg')bg=!bg;else fg=!fg;
      if(!bg&&!fg)return;
      _currentLayer=(bg&&fg)?'composite':(bg?'layer2':'layer1');
      syncLayerButtons();
      rerender();
    });
  });

  panel.querySelectorAll('.rdf-ov').forEach(function(btn){
    btn.addEventListener('click',function(){
      var flag=btn.dataset.ov;
      // Rebuild from the canonical order so the flag string — and therefore
      // the host's render cache key — does not depend on click order.
      var want=_currentOverlay.indexOf(flag)<0;
      _currentOverlay=ALL_OVERLAY_FLAGS.split('').filter(function(ch){
        return ch===flag?want:_currentOverlay.indexOf(ch)>=0;
      }).join('');
      syncOverlayButtons();
      rerender();
      if(typeof collisionFlagsChanged==='function')collisionFlagsChanged();
    });
  });

  var animBtn=panel.querySelector('#rg-animate');
  if(animBtn)animBtn.addEventListener('click',function(){
    _animateOn=!_animateOn;
    animBtn.classList.toggle('on',_animateOn);
    if(!_animateOn)stopRoomAnimation();
    rerender();
  });

  var allBtn=panel.querySelector('.rdf-ov-all');
  if(allBtn)allBtn.addEventListener('click',function(){
    _currentOverlay=(_currentOverlay===ALL_OVERLAY_FLAGS)?'':ALL_OVERLAY_FLAGS;
    syncOverlayButtons();
    rerender();
    if(typeof collisionFlagsChanged==='function')collisionFlagsChanged();
  });

  syncRomTriggerClass(panel);
}

/** `rgb()` string for a legend swatch. */
function rgbCss(c){return 'rgb('+c[0]+','+c[1]+','+c[2]+')';}

// Last payload from the host. Object focus and the "hide boring" toggle only
// change how this is presented, so they redraw from here instead of asking the
// host to render the room again.
var _lastRomData=null;

/** Render the ROM-derived summary, legend and tables below the map. */
function renderRomDataSections(ov){
  _lastRomData=ov;
  var panel=document.getElementById('room-detail');
  if(!panel)return;
  var old=panel.querySelector('.rs-romdata');
  if(old&&old.parentNode)old.parentNode.removeChild(old);

  var h='<div class="rs rs-romdata">';

  // Summary strip — the header banner render_map.py bakes above the PNG, as
  // HTML so it stays legible at any zoom and does not offset the map image.
  h+='<div class="rg-summary">';
  (ov.summary||[]).forEach(function(s){
    h+='<span class="sm"><b>'+escH(s[0])+'</b>'+escH(s[1])+'</span>';
  });
  h+='</div>';

  // Note the lack of source links explicitly. Trigger tables elsewhere in this
  // panel jump to .evs lines; these rows are decoded ROM bytes with no source
  // line to jump to, and silent inconsistency reads as a missing feature.
  h+='<div class="rs-h">ROM MAP DATA <span class="rs-sub">'+ov.widthTiles+'x'+ov.heightTiles+
     ' metatiles · '+ov.metatileCount+' unique · layer: '+escH(ov.layer)+
     ' · decoded from ROM, no source lines</span></div>';

  // Legend — the banner render_map.py prints under the map. Entries whose
  // feature is toggled off grey out rather than vanishing, so the key stays
  // stable while you flip things on and off.
  h+='<div class="rg-legend">';
  (ov.legend||[]).forEach(function(l){
    var off=(ov.overlay||'').indexOf(l.flag)<0;
    h+='<span class="lg'+(off?' lg-off':'')+'"><i class="sw" style="background:'+rgbCss(l.color)+
       '"></i>'+escH(l.label.toLowerCase())+'</span>';
  });
  h+='</div>';

  h+='<table class="rt"><tr><th>Feature</th><th>Count</th><th>Detail</th></tr>';
  var planeNames={0:'0 (blue)',1:'1 (red)',2:'2 (green)',3:'3 (purple)'};
  var planes=(ov.elevationPlanes||[]).map(function(p){
    return (planeNames[p]||p)+(p===ov.mainPlane?' — dominant':'');
  }).join(', ');
  h+=romRow('collision tiles',ov.collisionTiles,'planes '+planes);
  h+=romRow('rom objects',ov.objects.length,
            ov.objects.reduce(function(a,o){return a+o.states.length;},0)+' states total');
  h+=romRow('drift tiles',ov.drift.length,driftSummary(ov.drift));
  h+=romRow('entity gates',(ov.gates||[]).reduce(function(a,g){return a+g.count;},0),
            (ov.gates||[]).length?ov.gates.map(function(g){
              return g.count+' blocking '+g.blocks;
            }).join(', '):'none');
  h+=romRow('plane-transparent',ov.transparentTiles||0,'walk through while on another plane');
  h+=romRow('elevation changes',ov.elevationChangeTiles||0,'crossing swaps your plane');
  h+=romRow('cuttable grass',ov.grass.length,
            ov.grassWarnings&&ov.grassWarnings.length?ov.grassWarnings.join('; '):'table well-formed');
  h+=romRow('tile families',(ov.tileFamilies||[]).length,
            (ov.tileFamilies||[]).map(function(f){return hexNum(f,4);}).join(' '));
  h+=romRow('triggers',ov.stepOnCount+ov.bTriggerCount,
            ov.stepOnCount+' step-on, '+ov.bTriggerCount+' b-trigger');
  h+='</table>';

  h+=buildObjectStatesHtml(ov.objects);

  h+='</div>';
  panel.insertAdjacentHTML('beforeend',h);
  // A state change alters the rendered map, so it goes back to the host;
  // focus and filters only change this section, so they redraw locally.
  setupObjectStateButtons(panel,ov.objects,
    function(){if(_romRerender)_romRerender();},
    function(){if(_lastRomData)renderRomDataSections(_lastRomData);});
}

// Set by setupLayerButtons: the object chips are rebuilt with the data
// section on every response, so they ask for a re-render through here rather
// than each capturing the room.
var _romRerender=null;

function romRow(name,count,detail){
  return '<tr class="rd-romdata-row"><td>'+escH(name)+'</td><td>'+count+'</td><td>'+escH(String(detail))+'</td></tr>';
}

/** "12 N, 4 SE" — how many drift tiles push each way. */
function driftSummary(drift){
  if(!drift||!drift.length)return 'none';
  var counts={};
  drift.forEach(function(d){counts[d.name]=(counts[d.name]||0)+1;});
  return Object.keys(counts).sort().map(function(k){return counts[k]+' '+k;}).join(', ');
}
