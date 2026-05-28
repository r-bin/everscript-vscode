// Ownership: all mouse and keyboard interaction setup for the SVG map panel.
// Called from detail-renderer.js after panel.innerHTML is set.
// Requires globals: escH (utils.js), vs (shared.js), goToLine (shared.js).

/**
 * Wire up the byte-script focus highlighting and ROM-header collapse toggle.
 * Must be called after panel.innerHTML is set.
 */
function setupByteScriptFocusBinding(panel){
  function apply(){
    panel.querySelectorAll('tr.rs-current').forEach(function(row){row.classList.remove('rs-current');});
    panel.querySelectorAll('.rs-script.rs-current').forEach(function(card){card.classList.remove('rs-current');});
    if(!_currentByteScriptFocus)return;
    panel.querySelectorAll('tr[data-script-addr="'+_currentByteScriptFocus+'"]').forEach(function(row){
      row.classList.add('rs-current');
      var card=row.closest?row.closest('.rs-script'):null;
      if(card)card.classList.add('rs-current');
      if(row.scrollIntoView)row.scrollIntoView({block:'nearest'});
    });
  }
  _applyByteScriptFocus=apply;
  apply();

  // ROM header collapse toggle
  var rshToggle=panel.querySelector('#rsh-toggle');
  var rshBody=panel.querySelector('#rsh-body');
  if(rshToggle&&rshBody){
    rshToggle.addEventListener('click',function(){
      var col=rshBody.classList.toggle('rsh-collapsed');
      rshToggle.textContent='ROM Map Data '+(col?'▴':'▾');
    });
  }
}

/**
 * Set up zoom controls for the SVG canvas.
 * @param {object} p - { svg, canvas, wrap, W, H, dispW, dispH, zoomState }
 */
function setupZoomPan(p){
  var svg=p.svg,canvas=p.canvas,wrap=p.wrap,W=p.W,H=p.H,dispW=p.dispW,dispH=p.dispH,zoomState=p.zoomState;
  function getScale(s){return(s===0)?Math.min(dispW/W,dispH/H,20):s;}
  function getViewportMetrics(scale){
    var s=getScale(scale||zoomState.scale);
    var pxW=Math.round(W*s),pxH=Math.round(H*s);
    var wW=wrap?wrap.clientWidth:dispW,wH=wrap?wrap.clientHeight:dispH;
    var minX=pxW<=wW?Math.round((wW-pxW)/2):wW-pxW;
    var maxX=pxW<=wW?minX:0;
    var minY=pxH<=wH?Math.round((wH-pxH)/2):wH-pxH;
    var maxY=pxH<=wH?minY:0;
    return{pxW:pxW,pxH:pxH,wW:wW,wH:wH,minX:minX,maxX:maxX,minY:minY,maxY:maxY};
  }
  p._getScale=getScale;
  p._getViewportMetrics=getViewportMetrics;

  function applyPan(px,py){p.panX=px;p.panY=py;if(canvas)canvas.style.transform='translate('+px+'px,'+py+'px)';}
  p._applyPan=applyPan;

  function applyZoom(s){
    if(!svg||!canvas)return;
    var metrics=getViewportMetrics(s);
    canvas.style.width=metrics.pxW+'px';canvas.style.height=metrics.pxH+'px';
    svg.setAttribute('width',metrics.pxW);svg.setAttribute('height',metrics.pxH);
    var cx=Math.min(metrics.maxX,Math.max(metrics.minX,p.panX||0));
    var cy=Math.min(metrics.maxY,Math.max(metrics.minY,p.panY||0));
    applyPan(cx,cy);
  }

  var zinBtn=document.getElementById('rg-zin');
  var zoutBtn=document.getElementById('rg-zout');
  var zfitBtn=document.getElementById('rg-zfit');
  if(zinBtn)zinBtn.addEventListener('click',function(){zoomState.scale=Math.min((zoomState.scale||getScale(0))*1.4,60);applyZoom(zoomState.scale);});
  if(zoutBtn)zoutBtn.addEventListener('click',function(){zoomState.scale=Math.max((zoomState.scale||getScale(0))/1.4,1);applyZoom(zoomState.scale);});
  if(zfitBtn)zfitBtn.addEventListener('click',function(){zoomState.scale=0;applyPan(0,0);applyZoom(getScale(0));});
  applyZoom(getScale(0));
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
  var selRect=svg?svg.querySelector('#rg-sel'):null;

  function applyBoxFilter(sx,sy,ex,ey){
    var rx1=Math.min(sx,ex),rx2=Math.max(sx,ex),ry1=Math.min(sy,ey),ry2=Math.max(sy,ey);
    if(rx2-rx1<1&&ry2-ry1<1){clearBoxFilter();return;}
    panel.querySelectorAll('tr[data-kind][data-idx]').forEach(function(row){
      var kind=row.dataset.kind,idx=parseInt(row.dataset.idx),ok=false;
      if(kind==='entrance'){var en=entrances[idx];if(en)ok=(en.x>=rx1&&en.x<=rx2&&en.y>=ry1&&en.y<=ry2);}
      else if(kind==='step'){var t=stepOn[idx];if(t){var sv=tsvg(t,p.trigOff);ok=(sv.sx+sv.sw>=rx1&&sv.sx<=rx2&&sv.sy+sv.sh>=ry1&&sv.sy<=ry2);}}
      else if(kind==='btrig'){var t=bTrigger[idx];if(t){var sv=tsvg(t,p.trigOff);ok=(sv.sx+sv.sw>=rx1&&sv.sx<=rx2&&sv.sy+sv.sh>=ry1&&sv.sy<=ry2);}}
      else if(kind==='enemy'){var en=enemies[idx];if(en)ok=(en.x>=rx1&&en.x<=rx2&&en.y>=ry1&&en.y<=ry2);}
      else ok=true;
      row.classList.toggle('hrow',!ok);
    });
  }
  function clearBoxFilter(){
    panel.querySelectorAll('tr.hrow').forEach(function(r){r.classList.remove('hrow');});
    if(selRect){selRect.setAttribute('display','none');selRect.setAttribute('width','0');selRect.setAttribute('height','0');}
  }
  function clearSelection(){
    if(svg)svg.querySelectorAll('.svge-sel').forEach(function(el){el.classList.remove('svge-sel');});
    panel.querySelectorAll('tr.sel-row').forEach(function(r){r.classList.remove('sel-row');});
    panel.querySelectorAll('.rs-script.sel-script').forEach(function(card){card.classList.remove('sel-script');});
  }
  function selectAt(tx,ty){
    clearSelection();
    function hi(kind,i){
      if(svg)svg.querySelectorAll('[data-kind="'+kind+'"][data-idx="'+i+'"]').forEach(function(el){el.classList.add('svge-sel');});
      panel.querySelectorAll('tr[data-kind="'+kind+'"][data-idx="'+i+'"]').forEach(function(r){r.classList.add('sel-row');r.scrollIntoView({block:'nearest'});});
      panel.querySelectorAll('.rs-script[data-kind="'+kind+'"][data-idx="'+i+'"]').forEach(function(card){card.classList.add('sel-script');card.scrollIntoView({block:'nearest'});});
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
    var pt=svgPt(e);
    if(e.shiftKey){
      state.selSx=pt.x;state.selSy=pt.y;state.selActive=true;
      if(selRect)selRect.setAttribute('display','');
    } else {
      // Only enable pan when the canvas is larger than the viewport
      var W2=p.W,H2=p.H,dispW2=p.dispW,dispH2=p.dispH;
      var s=p._getScale?p._getScale(zoomState.scale):zoomState.scale||1;
      var pxW=Math.round(W2*s),pxH=Math.round(H2*s);
      if(pxW<=dispW2&&pxH<=dispH2)return;
      state.panActive=true;state.panCX=e.clientX;state.panCY=e.clientY;state.panBX=state.panX||0;state.panBY=state.panY||0;
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
    if(state.selActive){
      var pt=svgPt(e);
      var rx=Math.min(state.selSx,pt.x),ry=Math.min(state.selSy,pt.y),rw=Math.abs(pt.x-state.selSx),rh2=Math.abs(pt.y-state.selSy);
      if(selRect){selRect.setAttribute('x',rx);selRect.setAttribute('y',ry);selRect.setAttribute('width',rw);selRect.setAttribute('height',rh2);}
      return;
    }
    if(state.panActive&&p._applyPan&&p._getViewportMetrics){
      var metrics=p._getViewportMetrics();
      var nx=Math.min(metrics.maxX,Math.max(metrics.minX,state.panBX+(e.clientX-state.panCX)));
      var ny=Math.min(metrics.maxY,Math.max(metrics.minY,state.panBY+(e.clientY-state.panCY)));
      p._applyPan(nx,ny);
    }
  });

  svg.addEventListener('mouseup',function(e){
    if(state.dragEnt){
      var moved=(state.dragEnt.curX!==state.dragEnt.origX||state.dragEnt.curY!==state.dragEnt.origY);
      if(moved&&vs)vs.postMessage({command:'moveEntity',kind:state.dragEnt.kind,line:state.dragEnt.line,newX:state.dragEnt.curX,newY:state.dragEnt.curY});
      if(state.dragEnt.ghostEl&&state.dragEnt.ghostEl.parentNode)state.dragEnt.ghostEl.parentNode.removeChild(state.dragEnt.ghostEl);
      state.dragEnt=null;return;
    }
    if(state.selActive){state.selActive=false;var pt=svgPt(e);applyBoxFilter(state.selSx,state.selSy,pt.x,pt.y);return;}
    if(state.panActive){state.panActive=false;if(wrap)wrap.classList.remove('rg-panning');}
  });

  svg.addEventListener('mouseleave',function(){
    if(state.panActive){state.panActive=false;if(wrap)wrap.classList.remove('rg-panning');}
    if(state.dragEnt){if(state.dragEnt.ghostEl&&state.dragEnt.ghostEl.parentNode)state.dragEnt.ghostEl.parentNode.removeChild(state.dragEnt.ghostEl);state.dragEnt=null;}
  });

  svg.addEventListener('click',function(e){if(e.shiftKey||state.dragEnt)return;var pt=svgPt(e);selectAt(Math.floor(pt.x),Math.floor(pt.y));});
  svg.addEventListener('dblclick',function(){clearBoxFilter();clearSelection();});
}

/**
 * Wire hover highlights between SVG entities and table rows (bidirectional).
 */
function setupHoverHighlights(svg,panel){
  function setHi(kind,idx,on){
    if(svg)svg.querySelectorAll('[data-kind="'+kind+'"][data-idx="'+idx+'"]').forEach(function(el){el.classList.toggle('hi',on);});
    panel.querySelectorAll('tr[data-kind="'+kind+'"][data-idx="'+idx+'"]').forEach(function(row){row.classList.toggle('hi-row',on);});
    panel.querySelectorAll('.rs-script[data-kind="'+kind+'"][data-idx="'+idx+'"]').forEach(function(card){card.classList.toggle('hi-card',on);});
  }
  if(svg){
    svg.querySelectorAll('[data-kind][data-idx]').forEach(function(el){
      el.addEventListener('mouseenter',function(){setHi(el.dataset.kind,el.dataset.idx,true);});
      el.addEventListener('mouseleave',function(){setHi(el.dataset.kind,el.dataset.idx,false);});
    });
  }
  panel.querySelectorAll('tr[data-kind][data-idx]').forEach(function(row){
    row.addEventListener('mouseenter',function(){setHi(row.dataset.kind,row.dataset.idx,true);});
    row.addEventListener('mouseleave',function(){setHi(row.dataset.kind,row.dataset.idx,false);});
  });
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
