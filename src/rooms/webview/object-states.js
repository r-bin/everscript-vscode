// Ownership: the Section 3 object list under the map, its state chips, and
// the two-way link between a list row and the object's box on the map.
// Owns _objectStates (the chosen state per object) and _hideBoringObjects.
//
// A state chip is a thumbnail of what the room actually looks like with that
// state applied — an object state is an XOR delta into the metatile grid, so
// every appearance can be rendered exactly (see src/maps/object-stamps.ts).
// Picking one re-renders the map through the host, collision included.

// Chosen state per object index. Per room: index 20 is a different object in
// a different room, so this resets on room change.
var _objectStates={};
var _objectStatesRoom=null;
// Most objects have one appearance and nothing to pick. Hiding them makes the
// handful that do something findable.
var _hideBoringObjects=false;
// Which row is highlighted on the map.
var _objectFocus=null;

function resetObjectStatesFor(roomName){
  if(_objectStatesRoom===roomName)return;
  _objectStatesRoom=roomName;
  _objectStates={};
  _objectFocus=null;
}

/** Wire form the host parses: `index:state` pairs, canonical index order. */
function objectStateSpec(){
  return Object.keys(_objectStates).map(Number).sort(function(a,b){return a-b;})
    .filter(function(i){return _objectStates[i]>0;})
    .map(function(i){return i+':'+_objectStates[i];}).join(',');
}

function changedObjectCount(){
  return Object.keys(_objectStates).filter(function(i){return _objectStates[i]>0;}).length;
}

/**
 * "Boring" = nothing to pick between: a single appearance, or several whose
 * stamp records are byte-identical so they differ only in where they sit.
 */
function isBoringObject(o){
  if(o.states.length<2)return true;
  var sigs=o.stampSigs||[];
  return sigs.length>1&&sigs.every(function(x){return x===sigs[0];});
}

function visibleObjects(objects){
  if(!_hideBoringObjects)return objects;
  return objects.filter(function(o){
    return !isBoringObject(o)||(_objectStates[o.index]||0)>0;
  });
}

/**
 * Hit rects over every object's footprint, so the box drawn into the raster
 * is clickable and can highlight its row, and a row can highlight its box.
 * The SVG shares the map image's coordinate system; a metatile is 2 units.
 */
function syncObjectMapLayer(objects){
  var svg=document.getElementById('rg-svg');
  if(!svg)return;
  var old=svg.querySelector('#rg-objlayer');
  if(old&&old.parentNode)old.parentNode.removeChild(old);
  if(!objects||!objects.length)return;

  var ns='http://www.w3.org/2000/svg';
  var g=document.createElementNS(ns,'g');
  g.setAttribute('id','rg-objlayer');
  visibleObjects(objects).forEach(function(o){
    var rect=document.createElementNS(ns,'rect');
    var changed=(_objectStates[o.index]||0)>0;
    rect.setAttribute('class','svge-romobj'+(_objectFocus===o.index?' sel':'')+(changed?' changed':''));
    rect.setAttribute('data-obj',o.index);
    rect.setAttribute('x',o.x*2);
    rect.setAttribute('y',o.y*2);
    rect.setAttribute('width',Math.max(o.w,1)*2);
    rect.setAttribute('height',Math.max(o.h,1)*2);
    var t=document.createElementNS(ns,'title');
    t.textContent='obj '+o.index+' · state '+o.current+' of '+(o.states.length-1)+
                  ' · '+o.w+'×'+o.h+' at '+o.x+','+o.y;
    rect.appendChild(t);
    g.appendChild(rect);
  });
  svg.appendChild(g);
}

/** One state's thumbnail, scaled so a 1x1 gourd and a 6x5 bridge compare. */
function stateThumbHtml(o,st){
  if(!st.preview)return '<span class="ro-noimg" title="This state’s stamp record does not parse">?</span>';
  var px=Math.max(o.w,o.h,1);
  var size=Math.max(16,Math.min(40,px*14));
  return '<img class="ro-img" src="'+st.preview+'" width="'+Math.round(size*o.w/px)+
         '" height="'+Math.round(size*o.h/px)+'" alt="">';
}

/**
 * The object list, styled like the trigger tables above it: one row per
 * object, then a thumbnail chip per state. The chip you pick is the state the
 * map renders.
 */
function buildObjectStatesHtml(objects){
  if(!objects||!objects.length)return '';
  var boring=objects.filter(isBoringObject).length;
  var shown=visibleObjects(objects);
  var changed=changedObjectCount();

  var h='<div class="rs rs-romobjects"><div class="rs-h">ROM objects';
  h+='<span class="rs-sub">'+objects.length+' objects · '+(objects.length-boring)+
     ' with states to pick between'+(changed?' · <b>'+changed+' changed</b>':'')+'</span>';
  if(changed)h+='<button class="rdf on" id="ro-reset" title="Put every object back to the state the room loads with">reset</button>';
  if(boring)h+='<button class="rdf ro-hide'+(_hideBoringObjects?' on':'')+
    '" id="ro-hide-boring" title="Hide objects with nothing to pick between: one appearance, or several with byte-identical stamp records. '+
    boring+' of '+objects.length+' here.">hide boring ('+boring+')</button>';
  h+='</div>';

  h+='<table class="rs-tbl ro-tbl"><thead><tr><th>Obj</th><th>Anchor</th><th>States</th></tr></thead><tbody>';
  shown.forEach(function(o){
    var sel=_objectFocus===o.index;
    var mod=(_objectStates[o.index]||0)>0;
    h+='<tr class="ro-row'+(sel?' sel-row':'')+(mod?' ro-changed':'')+'" data-obj="'+o.index+'">';
    h+='<td><code>obj '+o.index+'</code></td>';
    h+='<td class="trig-coord">'+o.x+','+o.y+' <span class="ro-dim">'+o.w+'×'+o.h+'</span></td>';
    h+='<td class="ro-chips">';
    o.states.forEach(function(st){
      var on=st.state===o.current;
      h+='<button class="ro-chip'+(on?' sel':'')+'" data-obj="'+o.index+'" data-state="'+st.state+
         '" title="State '+st.state+(st.state===0?' — what the room loads with':'')+'">';
      h+=stateThumbHtml(o,st);
      h+='<span class="ro-lbl">'+st.state+'</span></button>';
    });
    h+='</td></tr>';
  });
  h+='</tbody></table>';
  if(!shown.length)h+='<div class="rs-note-dim">Every object in this room has a single appearance.</div>';
  h+='</div>';
  return h;
}

/**
 * Wire the chips, rows, filters and map boxes.
 *
 * `rerender` re-requests the map from the host (a state change alters the
 * image); `redraw` only rebuilds this section (focus and filters do not).
 */
function setupObjectStateButtons(panel,objects,rerender,redraw){
  panel.querySelectorAll('.ro-chip').forEach(function(btn){
    btn.addEventListener('click',function(e){
      e.stopPropagation();
      var obj=Number(btn.dataset.obj);
      var st=Number(btn.dataset.state);
      _objectFocus=obj;
      if((_objectStates[obj]||0)===st)return;
      if(st===0)delete _objectStates[obj];
      else _objectStates[obj]=st;
      rerender();
    });
  });

  panel.querySelectorAll('tr.ro-row').forEach(function(row){
    row.addEventListener('click',function(){
      var idx=Number(row.dataset.obj);
      _objectFocus=(_objectFocus===idx)?null:idx;
      redraw();
    });
  });

  var reset=panel.querySelector('#ro-reset');
  if(reset)reset.addEventListener('click',function(e){
    e.stopPropagation();
    if(!changedObjectCount())return;
    _objectStates={};
    rerender();
  });

  var hide=panel.querySelector('#ro-hide-boring');
  if(hide)hide.addEventListener('click',function(e){
    e.stopPropagation();
    _hideBoringObjects=!_hideBoringObjects;
    redraw();
  });

  // Map -> list. The list can be long and sits below the map, so scroll the
  // row into view rather than just highlighting it off-screen.
  var svg=document.getElementById('rg-svg');
  if(svg)svg.querySelectorAll('.svge-romobj').forEach(function(rect){
    rect.addEventListener('click',function(e){
      e.stopPropagation();
      var idx=Number(rect.dataset.obj);
      _objectFocus=(_objectFocus===idx)?null:idx;
      redraw();
      var row=document.querySelector('tr.ro-row[data-obj="'+idx+'"]');
      if(row&&row.scrollIntoView)row.scrollIntoView({block:'nearest'});
    });
  });

  syncObjectMapLayer(objects);
}
