// TODO port to TS (docs/todo/port-to-ts.md)
// Ownership: dragging the map to pan it — the gesture's start, and the window-level handlers that carry
// it past the edge of the SVG. The pan offset itself is zoom-pan.js's (`p._applyPan` / `p._getPan`).
// Game-neutral: the Evermore Rooms tab and the Secret of Mana editor call shellPanStart from their own
// mousedown. Plain browser script: globals.
//
// The gesture is tracked globally so it survives the pointer leaving the SVG. The editor's mouse setup
// runs on every map render, so the window listeners are registered once and read whichever session
// shellPanStart last opened — binding per render leaked a listener per selected map.

var _activePan=null,_activePanState=null,_activePanWrap=null,_globalPanBound=false;
// How far the pointer may travel before a drag stops counting as a click.
var PAN_CLICK_SLOP=3;

function ensureGlobalPanHandlers(){
  if(_globalPanBound)return;
  if(typeof window==='undefined'||!window.addEventListener)return;
  _globalPanBound=true;

  window.addEventListener('mousemove',function(e){
    var st=_activePanState,p=_activePan;
    if(!st||!st.panActive||!p||!p._applyPan||!p._getViewportMetrics)return;
    var dx=e.clientX-st.panCX,dy=e.clientY-st.panCY;
    if(Math.abs(dx)>PAN_CLICK_SLOP||Math.abs(dy)>PAN_CLICK_SLOP)st.panMoved=true;
    var m=p._getViewportMetrics();
    p._applyPan(
      Math.min(m.maxX,Math.max(m.minX,st.panBX+dx)),
      Math.min(m.maxY,Math.max(m.minY,st.panBY+dy))
    );
  });

  window.addEventListener('mouseup',function(){
    var st=_activePanState;
    if(st&&st.panActive){
      st.panActive=false;
      if(_activePanWrap)_activePanWrap.classList.remove('rg-panning');
    }
  });
}

/**
 * Start a pan at mouse event `e`, if the map is bigger than its viewport. `p` is the object setupZoomPan
 * filled in, `state` the page's drag state ({panActive, panMoved, panCX, panCY, panBX, panBY}), `wrap`
 * the viewport. Returns true when a pan began (the caller then prevents the default).
 */
function shellPanStart(p,state,wrap,e){
  var m=p._getViewportMetrics?p._getViewportMetrics():null;
  if(m&&m.pxW<=m.wW&&m.pxH<=m.wH)return false;
  // Base the drag on the live pan offset, not a stale local copy.
  var cur=p._getPan?p._getPan():{x:state.panX||0,y:state.panY||0};
  state.panActive=true;state.panCX=e.clientX;state.panCY=e.clientY;state.panBX=cur.x;state.panBY=cur.y;
  state.panMoved=false;
  _activePan=p;_activePanState=state;_activePanWrap=wrap;
  if(wrap)wrap.classList.add('rg-panning');
  ensureGlobalPanHandlers();
  return true;
}

/** End a pan (the SVG's own mouseup). */
function shellPanEnd(state,wrap){
  if(state.panActive){state.panActive=false;if(wrap)wrap.classList.remove('rg-panning');}
}
