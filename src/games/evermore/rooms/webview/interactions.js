// TODO port to TS (docs/todo/port-to-ts.md)
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

// The pan gesture (start, and the window handlers that carry it past the SVG's edge) is the shared
// shell's: shellPanStart / shellPanEnd in src/core/map-editor/shell/pan.js.

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
    // Only pans when the canvas is larger than the viewport.
    if(!shellPanStart(p,state,wrap,e))return;
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
    shellPanEnd(state,wrap);
  });

  svg.addEventListener('mouseleave',function(){
    // Panning deliberately survives leaving the SVG — window handlers below
    // carry it on, so a fast drag past the edge doesn't cancel mid-gesture.
    if(state.dragEnt){if(state.dragEnt.ghostEl&&state.dragEnt.ghostEl.parentNode)state.dragEnt.ghostEl.parentNode.removeChild(state.dragEnt.ghostEl);state.dragEnt=null;}
  });

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

// The map's drag state (setupClickHandlers's `state`) — `locked` stops a
// source entity being dragged; the lock button flips it.
var _mapLockState=null;

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
  // The lock is the tool pill's (map-editor-actions.js editLockToggle); this
  // render's drag state follows it through _mapLockState.
  _mapLockState=state;
  if(svg)svg.querySelectorAll('.svge-mv').forEach(function(el){el.style.cursor=state.locked?'default':'grab';});
  // Assign image button
  var pickBtn=document.getElementById('rg-pick-btn');
  if(pickBtn){
    pickBtn.addEventListener('click',function(){
      if(vs)vs.postMessage({command:'pickRoomImage',mapName:pickBtn.dataset.map});
    });
  }
}
