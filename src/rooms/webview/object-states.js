// Ownership: the Section 3 object browser under the map — one collapsible row
// per object, its states inside. Owns _objectFocus (which state is highlighted
// on the map).
//
// What this deliberately does NOT do: show a preview of each state's tiles, or
// re-render the map with a chosen state applied. Both need the stamp payload
// the state's `metatileId` points at, and that format is not decoded — across
// all 127 vanilla rooms, 0 of 2836 states yield metatile IDs that exist in
// their room's Block 3 table (upstream's dump_room.py reads it the same way).
// See docs/map-format/map_objects.md and gap 1.9 in the port analysis.
//
// So the browser shows what is verifiable — where each object is, how many
// states it has, which is the load state — and says plainly why the rest is
// missing rather than rendering black squares and calling them previews.

// Which object/state is highlighted on the map, as 'obj:state'. Per room:
// index 4 is a different object elsewhere.
var _objectFocus=null;
var _objectFocusRoom=null;

/** Drop the highlight when moving to a different room. */
function resetObjectStatesFor(roomName){
  if(_objectFocusRoom===roomName)return;
  _objectFocusRoom=roomName;
  _objectFocus=null;
}

/**
 * Marker for the focused object state, drawn in the SVG overlay.
 *
 * Only the anchor tile is marked, not a footprint box: the width/height that
 * would size a box come from the undecoded stamp table, so a box would be
 * confidently the wrong size. The anchor comes from the object record itself,
 * which matches the ROM bytes.
 */
function syncObjectFocusMarker(objects){
  var svg=document.getElementById('rg-svg');
  if(!svg)return;
  var old=svg.querySelector('#rg-objfocus');
  if(old&&old.parentNode)old.parentNode.removeChild(old);
  if(!_objectFocus||!objects)return;

  var parts=_objectFocus.split(':');
  var obj=objects.filter(function(o){return o.index===Number(parts[0]);})[0];
  if(!obj)return;
  var st=obj.states.filter(function(s){return s.state===Number(parts[1]);})[0];
  if(!st)return;

  // Metatile units are 2 SVG units (1 unit = one 8px tile).
  var x=st.x*2, y=st.y*2;
  var g=document.createElementNS('http://www.w3.org/2000/svg','g');
  g.setAttribute('id','rg-objfocus');
  g.setAttribute('pointer-events','none');
  g.innerHTML='<rect x="'+x+'" y="'+y+'" width="2" height="2" fill="none" stroke="#ffb454" stroke-width="0.4"/>'+
              '<line x1="'+(x-3)+'" y1="'+(y+1)+'" x2="'+(x-0.6)+'" y2="'+(y+1)+'" stroke="#ffb454" stroke-width="0.35"/>'+
              '<line x1="'+(x+1)+'" y1="'+(y-3)+'" x2="'+(x+1)+'" y2="'+(y-0.6)+'" stroke="#ffb454" stroke-width="0.35"/>';
  svg.appendChild(g);
}

/**
 * The object browser: a disclosure per object, states listed inside.
 *
 * Collapsed it reads as a list of what the room contains; open it shows each
 * state's anchor and stamp pointer, with the load state marked.
 */
function buildObjectStatesHtml(objects){
  if(!objects||!objects.length)return '';
  var multi=objects.filter(function(o){return o.states.length>1;}).length;
  var decoded=objects.some(function(o){return o.states.some(function(s){return s.stampDecoded;});});

  var h='<div class="rs-h">ROM OBJECTS <span class="rs-sub">'+objects.length+' objects'+
        (multi?' · '+multi+' with more than one state':' · all single-state')+
        ' · metatile stamps written into the grid at $7F0000</span></div>';

  if(!decoded){
    // Say this once, here, rather than showing a broken preview per state.
    h+='<div class="ro-note">No state previews or state switching: the stamp table each state points at '+
       'is not decoded — its metatile IDs do not exist in this room’s Block 3 table '+
       '(true for every state in all 127 vanilla rooms, upstream’s decoder included). '+
       'Anchor position and state count below come from the object record itself and are exact. '+
       'The blue stamp boxes on the map are sized from the same undecoded table, so treat their '+
       'extent as a guess — the anchor corner is right.</div>';
  }

  h+='<div class="ro-list">';
  objects.forEach(function(o){
    var cur=o.states[0];
    var focused=_objectFocus&&Number(_objectFocus.split(':')[0])===o.index;
    h+='<details class="ro-obj'+(focused?' ro-focus':'')+'"'+(focused?' open':'')+'>';
    h+='<summary>';
    h+='<span class="ro-meta"><b>obj '+o.index+'</b>';
    h+='<span class="ro-sub">'+o.states.length+(o.states.length===1?' state':' states')+
       (cur?' · anchor '+cur.x+','+cur.y:'')+'</span></span>';
    h+='<span class="ro-cur">'+(o.states.length>1?'0. . '+(o.states.length-1):'state 0')+'</span>';
    h+='</summary>';
    h+='<table class="rt ro-tbl"><tr><th>State</th><th>Anchor</th><th>Stamp table</th><th>Extent*</th></tr>';
    o.states.forEach(function(st){
      var sel=(_objectFocus===o.index+':'+st.state)?' sel':'';
      h+='<tr class="ro-state'+sel+'" data-obj="'+o.index+'" data-state="'+st.state+
         '" title="Highlight this object on the map">';
      h+='<td>'+st.state+(st.state===0?' <span class="ro-def">default</span>':'')+'</td>';
      h+='<td>'+st.x+','+st.y+'</td>';
      h+='<td>'+hexNum(st.metatileId,4)+'</td>';
      h+='<td class="ro-guess">'+st.w+'×'+st.h+'</td>';
      h+='</tr>';
    });
    h+='</table></details>';
  });
  h+='</div>';
  return h;
}

/** Wire the state rows to highlight their object on the map. */
function setupObjectStateButtons(panel,objects){
  panel.querySelectorAll('tr.ro-state').forEach(function(row){
    row.addEventListener('click',function(){
      var key=row.dataset.obj+':'+row.dataset.state;
      _objectFocus=(_objectFocus===key)?null:key;
      panel.querySelectorAll('tr.ro-state').forEach(function(r){
        r.classList.toggle('sel',_objectFocus===r.dataset.obj+':'+r.dataset.state);
      });
      syncObjectFocusMarker(objects);
    });
  });
  syncObjectFocusMarker(objects);
}
