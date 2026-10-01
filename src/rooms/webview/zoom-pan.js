// Ownership: the map's zoom and pan — the scale, the pan offset (its single
// owner, read back through `_getPan`), the zoom chip, the trackpad pinch and
// two-finger panning. Split out of interactions.js, which wires the mouse.

// One SVG viewBox unit is one 8 px ROM tile, so this is the scale at which
// the zoom chip reads 100%.
var ZOOM_ROM_PX_PER_UNIT=8;
// Fit the map to the viewport again — set by setupZoomPan for whoever changes
// the map's extent (map-editor-newroom.js resizeMapTo).
var _zoomRefit=null;

function setupZoomPan(p){
  var svg=p.svg,canvas=p.canvas,wrap=p.wrap,dispW=p.dispW,dispH=p.dispH,zoomState=p.zoomState;
  // The map's extent is read off the SVG each time, not kept: a custom map's
  // resize changes the viewBox under a zoom set up for the old one.
  function extent(){
    var vb=svg&&svg.viewBox&&svg.viewBox.baseVal;
    return vb&&vb.width?{w:vb.width,h:vb.height}:{w:p.W,h:p.H};
  }
  // Fit is the viewport as it is now — it fills the space between the bars
  // (rooms-layout.css), so its size is the layout's, not a constant.
  function view(){
    var w=wrap&&wrap.clientWidth,h=wrap&&wrap.clientHeight;
    return{w:w||dispW,h:h||dispH};
  }
  function getScale(s){
    if(s!==0)return s;
    var e=extent(),v=view();
    return Math.min(v.w/e.w,v.h/e.h,20);
  }
  function getViewportMetrics(scale){
    var s=getScale(scale||zoomState.scale);
    var e=extent();
    var pxW=Math.round(e.w*s),pxH=Math.round(e.h*s);
    var v=view(),wW=v.w,wH=v.h;
    // Slack: any edge of the map may come in as far as the viewport's middle,
    // so what sits under the tool pill, the filter bar or the zoom chip can be
    // pulled out from under them. A fitted map rests centred, as before.
    var sx=Math.round(wW/2),sy=Math.round(wH/2);
    var minX=pxW<=wW?Math.round((wW-pxW)/2)-sx:wW-pxW-sx;
    var maxX=pxW<=wW?Math.round((wW-pxW)/2)+sx:sx;
    var minY=pxH<=wH?Math.round((wH-pxH)/2)-sy:wH-pxH-sy;
    var maxY=pxH<=wH?Math.round((wH-pxH)/2)+sy:sy;
    return{pxW:pxW,pxH:pxH,wW:wW,wH:wH,minX:minX,maxX:maxX,minY:minY,maxY:maxY};
  }
  p._getScale=getScale;
  p._getViewportMetrics=getViewportMetrics;

  // Single owner for the pan offset. Callers must read it back through
  // _getPan() rather than keeping their own copy — a second copy is what made
  // every drag after the first start from a stale base and jump.
  function applyPan(px,py){p.panX=px;p.panY=py;if(canvas)canvas.style.transform='translate('+px+'px,'+py+'px)';}
  p._applyPan=applyPan;
  p._getPan=function(){return{x:p.panX||0,y:p.panY||0};};

  function applyZoom(s){
    if(!svg||!canvas)return;
    var metrics=getViewportMetrics(s);
    canvas.style.width=metrics.pxW+'px';canvas.style.height=metrics.pxH+'px';
    svg.setAttribute('width',metrics.pxW);svg.setAttribute('height',metrics.pxH);
    var cx=Math.min(metrics.maxX,Math.max(metrics.minX,p.panX||0));
    var cy=Math.min(metrics.maxY,Math.max(metrics.minY,p.panY||0));
    applyPan(cx,cy);
    // The zoom chip inside the canvas card (svg-builder.js). The scale is
    // screen px per viewBox unit and one unit is one 8 px ROM tile, so 8 is
    // 1:1 — "100%" means one ROM pixel per screen pixel, which is the only
    // reading of the number that means anything here.
    var lvl=document.getElementById('rg-zoom-level');
    if(lvl)lvl.textContent=Math.round(getScale(s)*100/ZOOM_ROM_PX_PER_UNIT)+'%';
  }

  /**
   * Zoom to `next`, keeping the map point under (cx, cy) in the wrap under the
   * cursor. Without the anchor, pinching walks the map away from whatever you
   * were looking at, which is worse than not having the gesture.
   */
  function zoomAt(next,cx,cy){
    var prev=getScale(zoomState.scale);
    next=Math.max(1,Math.min(next,60));
    if(next===prev)return;
    var pan=p._getPan();
    // Map coordinate under the cursor stays put: (c - pan) / prev === (c - pan') / next
    applyPan(cx-(cx-pan.x)*(next/prev), cy-(cy-pan.y)*(next/prev));
    zoomState.scale=next;
    applyZoom(next);
  }

  var zinBtn=document.getElementById('rg-zin');
  var zoutBtn=document.getElementById('rg-zout');
  var zfitBtn=document.getElementById('rg-zfit');
  function centre(){var m=getViewportMetrics();return{x:m.wW/2,y:m.wH/2};}
  if(zinBtn)zinBtn.addEventListener('click',function(){var c=centre();zoomAt(getScale(zoomState.scale)*1.4,c.x,c.y);});
  if(zoutBtn)zoutBtn.addEventListener('click',function(){var c=centre();zoomAt(getScale(zoomState.scale)/1.4,c.x,c.y);});
  // Fit: the whole map, centred. The pan slack would otherwise let it rest
  // wherever the last pan left it.
  function fit(){
    zoomState.scale=0;
    var m=getViewportMetrics(getScale(0));
    applyPan(Math.round((m.wW-m.pxW)/2),Math.round((m.wH-m.pxH)/2));
    applyZoom(getScale(0));
  }
  if(zfitBtn)zfitBtn.addEventListener('click',fit);

  // Trackpad pinch arrives as a wheel event with ctrlKey set (Chromium has no
  // gesture event). A plain two-finger scroll pans the map while it is bigger
  // than the view that way, and scrolls the panel once there is nothing left
  // to pan — at fit, or at the map's edge.
  if(wrap)wrap.addEventListener('wheel',function(e){
    if(!e.ctrlKey&&!e.metaKey){
      var m=getViewportMetrics(),pan=p._getPan();
      var k=e.deltaMode===1?16:1;
      var nx=Math.min(m.maxX,Math.max(m.minX,pan.x-e.deltaX*k));
      var ny=Math.min(m.maxY,Math.max(m.minY,pan.y-e.deltaY*k));
      if(nx===pan.x&&ny===pan.y)return;
      e.preventDefault();
      applyPan(nx,ny);
      return;
    }
    e.preventDefault();
    var r=wrap.getBoundingClientRect();
    // exp() keeps the gesture proportional, so a fast pinch is not 40 steps.
    zoomAt(getScale(zoomState.scale)*Math.exp(-e.deltaY*0.01),e.clientX-r.left,e.clientY-r.top);
  },{passive:false});

  _zoomRefit=fit;
  // The viewport changes size with the window and the column handles: a fit
  // map stays fit, a zoomed one keeps its scale and is clamped back in view.
  if(wrap&&typeof ResizeObserver!=='undefined'){
    if(wrap._rgResize)wrap._rgResize.disconnect();
    wrap._rgResize=new ResizeObserver(function(){if(zoomState.scale)applyZoom(zoomState.scale);else fit();});
    wrap._rgResize.observe(wrap);
  }
  fit();
}
