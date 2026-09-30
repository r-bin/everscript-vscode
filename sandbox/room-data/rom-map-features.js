// Parked from src/rooms/webview/rom-overlay.js (v0.90.0) — see README.md.
// The "ROM MAP DATA" section under the map: the summary strip, the overlay
// legend and the per-feature count table. Input: the host's `roomTiles`
// overlay reply (rendering/tile-overlay.js buildRoomTileOverlay).
// Globals expected: escH, hexNum. It also drew the object-state browser
// (object-states.js), which the Object tab replaced — that call is dropped.

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


  h+='</div>';
  panel.insertAdjacentHTML('beforeend',h);
}


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
