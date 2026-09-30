// Ownership: all mouse and keyboard interaction setup for the SVG map panel.
// Called from detail-renderer.js after panel.innerHTML is set.
// Requires globals: escH (utils.js), vs (shared.js), goToLine (shared.js).

/**
 * Highlight the script line the emulator is running (`_currentByteScriptFocus`,
 * a normalised SNES address). The lines are the Trigger tab's compact scripts
 * (map-editor-trigger-scripts.js), which carry `data-script-addr`.
 */
function setupByteScriptFocus(){
  function apply(){
    document.querySelectorAll('.rs-current').forEach(function(el){el.classList.remove('rs-current');});
    if(!_currentByteScriptFocus)return;
    document.querySelectorAll('[data-script-addr="'+_currentByteScriptFocus+'"]').forEach(function(el){
      el.classList.add('rs-current');
      if(el.scrollIntoView)el.scrollIntoView({block:'nearest'});
    });
  }
  _applyByteScriptFocus=apply;
  apply();
}

/**
 * Set up zoom controls for the SVG canvas.
 * @param {object} p - { svg, canvas, wrap, W, H, dispW, dispH, zoomState }
 */
// The pan gesture is tracked globally so it survives the pointer leaving the
// SVG. setupMouseEvents runs on every room render, so the window listeners are
// registered once and read whichever session mousedown last opened — binding
// per render leaked a listener per selected room.
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
 * Wire all mouse events: pan, box-select, entity drag, click select.
 * @param {object} p - { svg, panel, canvas, wrap, entrances, enemies, stepOn, bTrigger, zoomState, state }
 *   state = { panX, panY, panActive, locked, dragEnt, selActive, selSx, selSy, panCX, panCY, panBX, panBY }
 */
function setupMouseEvents(p){
  var svg=p.svg,panel=p.panel,canvas=p.canvas,wrap=p.wrap;
  var entrances=p.entrances,enemies=p.enemies,stepOn=p.stepOn,bTrigger=p.bTrigger;
  var zoomState=p.zoomState;
  var state=p.state;

  function svgPt(e){
    if(!svg)return{x:0,y:0};
    var pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }
  function clearSelection(){
    if(svg)svg.querySelectorAll('.svge-sel').forEach(function(el){el.classList.remove('svge-sel');});
  }
  /** Mark whatever is under the map at (tx,ty). */
  function selectAt(tx,ty){
    clearSelection();
    function hi(kind,i){
      if(svg)svg.querySelectorAll('[data-kind="'+kind+'"][data-idx="'+i+'"]').forEach(function(el){el.classList.add('svge-sel');});
    }
    stepOn.forEach(function(t,i){var sv=tsvg(t,p.trigOff);if(tx>=sv.sx&&tx<sv.sx+sv.sw&&ty>=sv.sy&&ty<sv.sy+sv.sh)hi('step',i);});
    bTrigger.forEach(function(t,i){var sv=tsvg(t,p.trigOff);if(tx>=sv.sx&&tx<sv.sx+sv.sw&&ty>=sv.sy&&ty<sv.sy+sv.sh)hi('btrig',i);});
    entrances.forEach(function(en,i){if(tx>=en.x&&tx<en.x+1&&ty>=en.y&&ty<en.y+1)hi('entrance',i);});
    enemies.forEach(function(en,i){if(tx>=en.x&&tx<en.x+1&&ty>=en.y&&ty<en.y+1)hi('enemy',i);});
  }

  if(!svg)return;

  // Entity drag: mousedown on moveable SVG element
  svg.querySelectorAll('.svge-mv').forEach(function(el){
    el.addEventListener('mousedown',function(e){
      if(e.button!==0||state.locked)return;
      e.stopPropagation();
      var kind=el.dataset.kind,idx=parseInt(el.dataset.idx),line=parseInt(el.dataset.line);
      var ox,oy;
      if(kind==='entrance'&&entrances[idx]){ox=entrances[idx].x;oy=entrances[idx].y;}
      else if(kind==='enemy'&&enemies[idx]){ox=enemies[idx].x;oy=enemies[idx].y;}
      else return;
      var ghost=document.createElementNS('http://www.w3.org/2000/svg','rect');
      ghost.setAttribute('x',ox);ghost.setAttribute('y',oy);
      ghost.setAttribute('width',1);ghost.setAttribute('height',1);
      ghost.setAttribute('fill',kind==='entrance'?'rgba(34,187,85,0.5)':'rgba(204,51,51,0.5)');
      ghost.setAttribute('stroke',kind==='entrance'?'#22bb55':'#cc3333');
      ghost.setAttribute('stroke-width','0.15');ghost.setAttribute('stroke-dasharray','0.3,0.2');
      ghost.setAttribute('pointer-events','none');
      svg.appendChild(ghost);
      state.dragEnt={kind:kind,idx:idx,line:line,origX:ox,origY:oy,ghostEl:ghost,curX:ox,curY:oy};
      e.preventDefault();
    });
  });

  svg.addEventListener('mousedown',function(e){
    if(e.button!==0||state.dragEnt)return;
    if(e.metaKey||e.ctrlKey)return;
    {
      // Only enable pan when the canvas is larger than the viewport
      var W2=p.W,H2=p.H,dispW2=p.dispW,dispH2=p.dispH;
      var s=p._getScale?p._getScale(zoomState.scale):zoomState.scale||1;
      var pxW=Math.round(W2*s),pxH=Math.round(H2*s);
      if(pxW<=dispW2&&pxH<=dispH2)return;
      // Base the drag on the live pan offset, not a stale local copy.
      var cur=p._getPan?p._getPan():{x:state.panX||0,y:state.panY||0};
      state.panActive=true;state.panCX=e.clientX;state.panCY=e.clientY;state.panBX=cur.x;state.panBY=cur.y;
      state.panMoved=false;
      _activePan=p;_activePanState=state;_activePanWrap=wrap;
      if(wrap)wrap.classList.add('rg-panning');
    }
    e.preventDefault();
  });

  svg.addEventListener('mousemove',function(e){
    if(state.dragEnt){
      var pt=svgPt(e);var tx=Math.floor(pt.x),ty=Math.floor(pt.y);
      state.dragEnt.curX=tx;state.dragEnt.curY=ty;
      state.dragEnt.ghostEl.setAttribute('x',tx);state.dragEnt.ghostEl.setAttribute('y',ty);
      return;
    }
    // Panning itself is handled by the window-level handler, so a drag keeps
    // working past the edge of the SVG. Nothing to do here.
  });

  svg.addEventListener('mouseup',function(e){
    if(state.dragEnt){
      var moved=(state.dragEnt.curX!==state.dragEnt.origX||state.dragEnt.curY!==state.dragEnt.origY);
      if(moved&&vs)vs.postMessage({command:'moveEntity',kind:state.dragEnt.kind,line:state.dragEnt.line,newX:state.dragEnt.curX,newY:state.dragEnt.curY});
      if(state.dragEnt.ghostEl&&state.dragEnt.ghostEl.parentNode)state.dragEnt.ghostEl.parentNode.removeChild(state.dragEnt.ghostEl);
      state.dragEnt=null;return;
    }
    if(state.panActive){state.panActive=false;if(wrap)wrap.classList.remove('rg-panning');}
  });

  svg.addEventListener('mouseleave',function(){
    // Panning deliberately survives leaving the SVG — window handlers below
    // carry it on, so a fast drag past the edge doesn't cancel mid-gesture.
    if(state.dragEnt){if(state.dragEnt.ghostEl&&state.dragEnt.ghostEl.parentNode)state.dragEnt.ghostEl.parentNode.removeChild(state.dragEnt.ghostEl);state.dragEnt=null;}
  });

  ensureGlobalPanHandlers();

  svg.addEventListener('click',function(e){
    if(e.shiftKey||state.dragEnt)return;
    // A pan drag ends with a click. Selecting here would scroll the right
    // panel under a cmd-click, which yanks the map out of view the moment
    // you release a drag.
    if(state.panMoved){state.panMoved=false;return;}
    var pt=svgPt(e);
    selectAt(Math.floor(pt.x),Math.floor(pt.y));
  });
  svg.addEventListener('dblclick',clearSelection);
}

/** Wire hover highlights on the SVG entities, and their label in the status bar. */
function setupHoverHighlights(svg,panel){
  function setHi(kind,idx,on){
    if(svg)svg.querySelectorAll('[data-kind="'+kind+'"][data-idx="'+idx+'"]').forEach(function(el){el.classList.toggle('hi',on);});
  }
  if(svg){
    svg.querySelectorAll('[data-kind][data-idx]').forEach(function(el){
      el.addEventListener('mouseenter',function(){setHi(el.dataset.kind,el.dataset.idx,true);});
      el.addEventListener('mouseleave',function(){setHi(el.dataset.kind,el.dataset.idx,false);});
    });
  }
  // Hover status bar
  var tipDiv=document.getElementById('rg-tip');
  if(svg&&tipDiv){
    svg.querySelectorAll('[data-kind][data-idx]').forEach(function(el){
      el.addEventListener('mouseenter',function(){tipDiv.textContent=el.dataset.label||'';});
      el.addEventListener('mouseleave',function(){tipDiv.textContent='';});
    });
  }
}

/**
 * Wire entity filter buttons, lock button, assign-image button, and cmd+click line links.
 */
function setupClickHandlers(svg,panel,state){
  // Cmd/Ctrl+click on code-linked SVG elements
  if(svg){
    svg.querySelectorAll('.sv-ll').forEach(function(el){
      el.style.cursor='pointer';
      el.addEventListener('click',function(e){
        if(e.metaKey||e.ctrlKey){e.stopPropagation();goToLine(parseInt(el.dataset.line));}
      });
    });
  }
  // Inverted filters: button ON applies the class (vs data-hide, where OFF
  // applies it). Used where the default is the absence of the class.
  panel.querySelectorAll('.rdf[data-show]').forEach(function(btn){
    btn.addEventListener('click',function(){
      btn.classList.toggle('on');
      panel.classList.toggle(btn.dataset.show,btn.classList.contains('on'));
    });
  });

  // Entity filter buttons
  panel.querySelectorAll('.rdf[data-hide]').forEach(function(btn){
    btn.addEventListener('click',function(){
      btn.classList.toggle('on');
      panel.classList.toggle(btn.dataset.hide,!btn.classList.contains('on'));
    });
  });
  // Lock toggle
  var lockBtn=document.getElementById('rg-lock-btn');
  if(lockBtn){
    if(svg)svg.querySelectorAll('.svge-mv').forEach(function(el){el.style.cursor='default';});
    lockBtn.addEventListener('click',function(){
      state.locked=!state.locked;
      lockBtn.textContent=state.locked?'locked':'unlocked';
      lockBtn.classList.toggle('on',state.locked);
      lockBtn.title=state.locked?'Unlock map':'Lock map';
      // The editor's lock too (editLocked): unlocked, a vanilla room's draft can change.
      var ld=typeof editDraft==='function'?editDraft():null;
      if(ld){ld.locked=state.locked;editNote(state.locked?'locked — look, pick and copy; nothing changes'
        :'unlocked — edits go into this map’s draft');renderEditChrome();}
      if(svg)svg.querySelectorAll('.svge-mv').forEach(function(el){el.style.cursor=state.locked?'default':'grab';});
    });
  }
  // Assign image button
  var pickBtn=document.getElementById('rg-pick-btn');
  if(pickBtn){
    pickBtn.addEventListener('click',function(){
      if(vs)vs.postMessage({command:'pickRoomImage',mapName:pickBtn.dataset.map});
    });
  }
}
