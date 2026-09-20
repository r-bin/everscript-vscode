// Ownership: the Section 3 object list under the map, its state chips, and the
// two-way link between a list row and the object's rectangle on the map.
// Owns _objectFocus and _hideBoringObjects.
//
// What is trustworthy here, and what is not:
//   - The object record decodes exactly: count, state count, and per state the
//     anchor (tileX, tileY) and the stamp pointer.
//   - The stamp header decodes too: `[tw][th][mask: ceil(tw*th/8) bytes]`,
//     which is where each state's extent comes from. The record length this
//     predicts matches the next record's offset for 78.6% of all stamps, and a
//     byte-exact hand decode of room 0x2c's 11 states matches every stride.
//   - The 16-bit words after the mask are NOT decoded. They are not absolute
//     metatile IDs and not baseMetatile-relative ones, and state 0 does not
//     reproduce the loaded grid, so there is no oracle to check a guess
//     against. That is why a state chip shows no thumbnail and why picking one
//     highlights rather than re-renders. See gap 1.9.

// Which object/state is highlighted, as 'obj:state'. Per room: index 4 is a
// different object in a different room.
var _objectFocus=null;
var _objectFocusRoom=null;
// Most objects have one state and never change; hiding them makes the handful
// that actually do something findable.
var _hideBoringObjects=false;

function resetObjectStatesFor(roomName){
  if(_objectFocusRoom===roomName)return;
  _objectFocusRoom=roomName;
  _objectFocus=null;
}

/**
 * "Boring" = nothing to pick between. Single-state objects (81% of all
 * objects in the vanilla ROM — sniff spots, static props), and multi-state
 * objects whose states all stamp the same bytes, differing only in where.
 */
function isBoringObject(o){
  if(o.states.length<2)return true;
  var first=o.states[0].stampSig;
  return o.states.every(function(s){return s.stampSig===first;});
}

function visibleObjects(objects){
  if(!_hideBoringObjects)return objects;
  return objects.filter(function(o){return !isBoringObject(o);});
}

function focusParts(){
  if(!_objectFocus)return null;
  var p=_objectFocus.split(':');
  return {obj:Number(p[0]),state:Number(p[1])};
}

/**
 * Invisible hit rects over every object's footprint, so the rectangle drawn
 * into the raster is clickable and can highlight its row — and so a row can
 * highlight its rectangle. Placed in the SVG, which shares the map image's
 * coordinate system (1 unit = one 8px tile, so a metatile is 2 units).
 */
function syncObjectMapLayer(objects){
  var svg=document.getElementById('rg-svg');
  if(!svg)return;
  var old=svg.querySelector('#rg-objlayer');
  if(old&&old.parentNode)old.parentNode.removeChild(old);
  if(!objects||!objects.length)return;

  var f=focusParts();
  var ns='http://www.w3.org/2000/svg';
  var g=document.createElementNS(ns,'g');
  g.setAttribute('id','rg-objlayer');

  visibleObjects(objects).forEach(function(o){
    var st=o.states[(f&&f.obj===o.index)?f.state:0]||o.states[0];
    if(!st)return;
    var on=f&&f.obj===o.index;
    var rect=document.createElementNS(ns,'rect');
    rect.setAttribute('class','svge-romobj'+(on?' sel':''));
    rect.setAttribute('data-obj',o.index);
    rect.setAttribute('x',st.x*2);
    rect.setAttribute('y',st.y*2);
    rect.setAttribute('width',Math.max(st.w,1)*2);
    rect.setAttribute('height',Math.max(st.h,1)*2);
    var title=document.createElementNS(ns,'title');
    title.textContent='obj '+o.index+' · state '+st.state+' of '+o.states.length+
                      ' · '+st.w+'×'+st.h+' at '+st.x+','+st.y;
    rect.appendChild(title);
    g.appendChild(rect);
  });
  svg.appendChild(g);
}

/**
 * The object list, styled like the trigger tables above it.
 *
 * One row per object: index, anchor, then a chip per state. Clicking a chip
 * selects that state, which highlights the object on the map; clicking the
 * rectangle on the map selects the row.
 */
function buildObjectStatesHtml(objects){
  if(!objects||!objects.length)return '';
  var boring=objects.filter(isBoringObject).length;
  var shown=visibleObjects(objects);
  var f=focusParts();

  var h='<div class="rs rs-romobjects"><div class="rs-h">ROM objects';
  h+='<span class="rs-sub">'+objects.length+' objects · '+
     (objects.length-boring)+' with states to pick between</span>';
  if(boring)h+='<button class="rdf ro-hide'+(_hideBoringObjects?' on':'')+
    '" id="ro-hide-boring" title="Hide objects with nothing to pick between: one state, or several states that stamp identical bytes. '+
    boring+' of '+objects.length+' here.">hide boring ('+boring+')</button>';
  h+='</div>';

  h+='<table class="rs-tbl ro-tbl"><thead><tr><th>Obj</th><th>Anchor</th><th>Extent</th><th>States</th></tr></thead><tbody>';
  shown.forEach(function(o){
    var sel=f&&f.obj===o.index;
    var st=o.states[sel?f.state:0]||o.states[0];
    h+='<tr class="ro-row'+(sel?' sel-row':'')+'" data-obj="'+o.index+'">';
    h+='<td><code>obj '+o.index+'</code></td>';
    h+='<td class="trig-coord">'+(st?st.x+','+st.y:'–')+'</td>';
    h+='<td class="trig-coord">'+(st?st.w+'×'+st.h:'–')+'</td>';
    h+='<td class="ro-chips">';
    o.states.forEach(function(s){
      var on=sel?(f.state===s.state):(s.state===0);
      h+='<button class="ro-chip'+(on?' sel':'')+'" data-obj="'+o.index+'" data-state="'+s.state+
         '" title="State '+s.state+(s.state===0?' (load state)':'')+' — '+s.w+'×'+s.h+
         ' metatiles at '+s.x+','+s.y+', stamp table '+hexNum(s.metatileId,4)+'">'+s.state+'</button>';
    });
    h+='</td></tr>';
  });
  h+='</tbody></table>';

  if(!shown.length)h+='<div class="rs-note-dim">All '+objects.length+' objects in this room are single-state.</div>';
  h+='<div class="ro-note">State chips highlight, they do not re-render: the stamp table a state points at '+
     'is only half decoded. Its header (extent and tile mask) is solid, so the rectangles are the right size '+
     'and in the right place — the metatile words inside it are not, so there is nothing trustworthy to '+
     'draw as a preview or to paint onto the map. See gap 1.9 in the port analysis.</div>';
  h+='</div>';
  return h;
}

/** Wire the chips, the rows, the hide toggle, and the map rectangles. */
function setupObjectStateButtons(panel,objects,rerender){
  function select(objIdx,state){
    var key=objIdx+':'+state;
    _objectFocus=(_objectFocus===key)?null:key;
    rerender();
  }

  panel.querySelectorAll('.ro-chip').forEach(function(btn){
    btn.addEventListener('click',function(e){
      e.stopPropagation();
      select(Number(btn.dataset.obj),Number(btn.dataset.state));
    });
  });
  panel.querySelectorAll('tr.ro-row').forEach(function(row){
    row.addEventListener('click',function(){
      var f=focusParts();
      select(Number(row.dataset.obj),(f&&f.obj===Number(row.dataset.obj))?f.state:0);
    });
  });

  var hide=panel.querySelector('#ro-hide-boring');
  if(hide)hide.addEventListener('click',function(){
    _hideBoringObjects=!_hideBoringObjects;
    rerender();
  });

  // Map -> list. Selecting from the map scrolls the row into view, since the
  // object list can be long and the map is above it.
  var svg=document.getElementById('rg-svg');
  if(svg)svg.querySelectorAll('.svge-romobj').forEach(function(rect){
    rect.addEventListener('click',function(e){
      e.stopPropagation();
      var idx=Number(rect.dataset.obj);
      var f=focusParts();
      select(idx,(f&&f.obj===idx)?f.state:0);
      var row=document.querySelector('tr.ro-row[data-obj="'+idx+'"]');
      if(row&&row.scrollIntoView)row.scrollIntoView({block:'nearest'});
    });
  });

  syncObjectMapLayer(objects);
}
