// Ownership: build the SVG map grid + entity elements for a room detail panel.
// Pure function: receives entity arrays and config, returns an HTML string.
// Uses utils.js globals: escH, tsvg, getIngrKey, getIngrIcon, ingrSvgImg, INGR_BASE.

/**
 * Build the SVG map section HTML string for a room.
 *
 * @param {object} opts
 *   .im         initMap bounds (or null)
 *   .entrances  entrance array
 *   .enemies    enemy array
 *   .stepOn     step-on trigger array
 *   .bTrigger   b-trigger array
 *   .poi        Lua POI points array (or null)
 *   .trigOff    trigger offset {offX, offY} (or null)
 *   .stepOnNames  array of step-on trigger names
 *   .bTrigNames   array of b-trigger names
 *   .imageUri   webview image URI (or null)
 *   .imageDims  {w,h} image dimensions (or null)
 *   .rh         romHeader (or null)
 * @returns {{ html: string, x1, y1, x2, y2, W, H, dispW, dispH, hasCoords, zoomState }}
 */
function buildRoomSvgSection(opts){
  var im=opts.im, entrances=opts.entrances, enemies=opts.enemies;
  var stepOn=opts.stepOn, bTrigger=opts.bTrigger, poi=opts.poi||[];
  var trigOff=opts.trigOff, stepOnNames=opts.stepOnNames, bTrigNames=opts.bTrigNames;
  var imageUri=opts.imageUri, imageDims=opts.imageDims, rh=opts.rh;

  // Compute SVG viewport bounds. ROM header dimensions are authoritative.
  var TILE=8;
  var x1=im?im.x1:0, y1=im?im.y1:0, x2=im?im.x2:32, y2=im?im.y2:32;
  if(rh&&rh.mapWpx&&rh.mapHpx){
    x2=x1+Math.max(1,Math.round(rh.mapWpx/TILE));
    y2=y1+Math.max(1,Math.round(rh.mapHpx/TILE));
  }else if(imageDims){
    var imgCols=Math.round(imageDims.w/TILE);
    var imgRows=Math.round(imageDims.h/TILE);
    if(x2<imgCols)x2=imgCols;
    if(y2<imgRows)y2=imgRows;
  }
  entrances.forEach(function(en){if(en.x<x1)x1=en.x-1;if(en.y<y1)y1=en.y-1;if(en.x+2>x2)x2=en.x+2;if(en.y+2>y2)y2=en.y+2;});
  enemies.forEach(function(e){if(e.x<x1)x1=e.x-1;if(e.y<y1)y1=e.y-1;if(e.x+2>x2)x2=e.x+2;if(e.y+2>y2)y2=e.y+2;});
  stepOn.concat(bTrigger).forEach(function(t){
    var sv=tsvg(t,trigOff);
    if(sv.sx<x1)x1=sv.sx-1;if(sv.sy<y1)y1=sv.sy-1;
    if(sv.sx+sv.sw+1>x2)x2=sv.sx+sv.sw+1;if(sv.sy+sv.sh+1>y2)y2=sv.sy+sv.sh+1;
  });
  var W=Math.max(x2-x1,8),H=Math.max(y2-y1,8);

  var dispW=520;
  var aspectW=(rh&&rh.mapWpx)||((imageDims&&imageDims.w)||W);
  var aspectH=(rh&&rh.mapHpx)||((imageDims&&imageDims.h)||H);
  var dispH=Math.min(600,Math.round(dispW*aspectH/aspectW));
  var zoomState={scale:0};

  var hasCoords=(im!=null)||(entrances.length>0)||(enemies.length>0)||(stepOn.length>0)||(bTrigger.length>0)||(poi.length>0);

  var html='';
  if(hasCoords||imageUri){
    html+='<div class="rg-outer rs-map" id="rg-outer">';
    html+='<div class="rg-zoom"><button id="rg-zin">+</button><button id="rg-zout">-</button><button id="rg-zfit">fit</button></div>';
    html+='<div class="rg-wrap" id="rg-wrap" style="width:'+dispW+'px;height:'+dispH+'px">';
    html+='<div id="rg-canvas" style="position:absolute;width:'+dispW+'px;height:'+dispH+'px;transform-origin:0 0;will-change:transform">';
    if(imageUri)html+='<img class="room-img" id="rg-img" src="'+imageUri+'" alt="">';
    html+='<svg class="rg-svg" id="rg-svg" width="'+dispW+'" height="'+dispH+'" viewBox="'+x1+' '+y1+' '+W+' '+H+'">';

    // Fine grid (8px-tile)
    var tileStep=1;
    if(W>64||H>64)tileStep=2;
    if(W>128||H>128)tileStep=4;
    for(var gx=x1;gx<=x2;gx+=tileStep)html+='<line class="rg-grid-fine" x1="'+gx+'" y1="'+y1+'" x2="'+gx+'" y2="'+y2+'" stroke="rgba(255,255,255,0.11)" stroke-width="0.07"/>';
    for(var gy=y1;gy<=y2;gy+=tileStep)html+='<line class="rg-grid-fine" x1="'+x1+'" y1="'+gy+'" x2="'+x2+'" y2="'+gy+'" stroke="rgba(255,255,255,0.11)" stroke-width="0.07"/>';

    // Coarse grid (16px-tile trigger space)
    var trigStep=tileStep*2;
    var tgx0=x1-((x1%trigStep+trigStep)%trigStep);
    var tgy0=y1-((y1%trigStep+trigStep)%trigStep);
    for(var gx=tgx0;gx<=x2;gx+=trigStep)html+='<line class="rg-grid-coarse" x1="'+gx+'" y1="'+y1+'" x2="'+gx+'" y2="'+y2+'" stroke="rgba(160,140,80,0.42)" stroke-width="0.18"/>';
    for(var gy=tgy0;gy<=y2;gy+=trigStep)html+='<line class="rg-grid-coarse" x1="'+x1+'" y1="'+gy+'" x2="'+x2+'" y2="'+gy+'" stroke="rgba(160,140,80,0.42)" stroke-width="0.18"/>';
    if((x2-tgx0)%trigStep!==0)html+='<line class="rg-grid-coarse" x1="'+x2+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="rgba(160,140,80,0.42)" stroke-width="0.18"/>';
    if((y2-tgy0)%trigStep!==0)html+='<line class="rg-grid-coarse" x1="'+x1+'" y1="'+y2+'" x2="'+x2+'" y2="'+y2+'" stroke="rgba(160,140,80,0.42)" stroke-width="0.18"/>';

    // Step-on rects (pink)
    stepOn.forEach(function(t,i){
      var nm=stepOnNames[i]||'';
      var sv=tsvg(t,trigOff);
      var tip='step-on'+(nm?' '+escH(nm):'')+(t.label?' — '+escH(t.label):'');
      html+='<rect class="svge-step" data-idx="'+i+'" data-kind="step" data-label="'+escH(nm||t.label||'')+' ['+t.x1+','+t.y1+':'+t.x2+','+t.y2+']" x="'+sv.sx+'" y="'+sv.sy+'" width="'+sv.sw+'" height="'+sv.sh+'" fill="rgba(255,100,180,0.18)" stroke="#ff69b4" stroke-width="0.3"><title>'+tip+'</title></rect>';
    });

    // B-trigger rects (yellow) + ingredient icons
    bTrigger.forEach(function(t,i){
      var nm=bTrigNames[i]||'';
      var sv=tsvg(t,trigOff);
      var tip='B-trig'+(nm?' '+escH(nm):'')+(t.label?' — '+escH(t.label):'');
      var ingrEmoji=getIngrIcon(nm||t.label||'');
      var blabel=escH(nm||t.label||'')+(ingrEmoji?' '+ingrEmoji:'')+' ['+t.x1+','+t.y1+':'+t.x2+','+t.y2+']';
      html+='<rect class="svge-btrig" data-idx="'+i+'" data-kind="btrig" data-label="'+blabel+'" x="'+sv.sx+'" y="'+sv.sy+'" width="'+sv.sw+'" height="'+sv.sh+'" fill="rgba(255,210,0,0.13)" stroke="#ffcc00" stroke-width="0.3"><title>'+(ingrEmoji?ingrEmoji+' ':'')+tip+'</title></rect>';
      if(ingrEmoji){
        var ifs=Math.max(1.5,Math.min(sv.sw,sv.sh,2.8));
        var imgHtml=ingrSvgImg(nm||t.label||'',sv.sx+sv.sw/2,sv.sy+sv.sh/2,ifs*1.2);
        if(imgHtml){
          html+='<g class="svge-btrig svge-ingr">'+imgHtml+'</g>';
        }else{
          html+='<text class="svge-btrig svge-ingr" x="'+(sv.sx+sv.sw/2)+'" y="'+(sv.sy+sv.sh/2+ifs*0.4)+'" text-anchor="middle" font-size="'+ifs+'" pointer-events="none" style="user-select:none">'+ingrEmoji+'</text>';
        }
      }
    });

    // Lua POI markers (cyan cross)
    poi.forEach(function(p){
      var pr=0.6;
      html+='<line class="svge-poi hide-poi" x1="'+(p.x-pr)+'" y1="'+p.y+'" x2="'+(p.x+pr)+'" y2="'+p.y+'" stroke="#00e5ff" stroke-width="0.25"/>';
      html+='<line class="svge-poi hide-poi" x1="'+p.x+'" y1="'+(p.y-pr)+'" x2="'+p.x+'" y2="'+(p.y+pr)+'" stroke="#00e5ff" stroke-width="0.25"/>';
    });

    // Box-select overlay
    html+='<rect id="rg-sel" x="0" y="0" width="0" height="0" fill="rgba(100,200,255,0.10)" stroke="#64c8ff" stroke-width="0.3" stroke-dasharray="1,0.5" display="none"/>';

    // Enemies (red=static, orange=dynamic)
    enemies.forEach(function(e,i){
      var ex=Math.round(e.x),ey=Math.round(e.y);
      var fill=e.dynamic?'#cc7700':'#cc3333';
      html+='<rect class="svge-enemy sv-ll svge-mv" data-line="'+e.line+'" data-idx="'+i+'" data-kind="enemy" data-label="'+escH(e.type)+' ('+e.x+','+e.y+')" x="'+ex+'" y="'+ey+'" width="1" height="1" fill="'+fill+'" opacity="0.85" rx="0.2"><title>'+escH(e.type)+' ('+e.x+','+e.y+')\ncmd+click</title></rect>';
    });

    // Entrances (hollow square + directional arrow)
    entrances.forEach(function(en,i){
      var ex=Math.round(en.x),ey=Math.round(en.y);
      var d=en.dir?en.dir.toUpperCase():'';
      html+='<rect class="svge-entrance sv-ll svge-mv" data-line="'+en.line+'" data-idx="'+i+'" data-kind="entrance" data-label="'+escH(en.name)+' ('+en.x+','+en.y+') '+escH(en.dir)+'" x="'+ex+'" y="'+ey+'" width="1" height="1" fill="rgba(34,187,85,0.2)" stroke="#22bb55" stroke-width="0.2"><title>'+escH(en.name)+'\ncmd+click</title></rect>';
      var cx=ex+0.5,cy=ey+0.5,ap='';
      if(d==='NORTH'||d==='N')ap=cx+','+(cy-0.45)+' '+(cx-0.35)+','+(cy+0.3)+' '+(cx+0.35)+','+(cy+0.3);
      else if(d==='SOUTH'||d==='S')ap=cx+','+(cy+0.45)+' '+(cx-0.35)+','+(cy-0.3)+' '+(cx+0.35)+','+(cy-0.3);
      else if(d==='EAST'||d==='E')ap=(cx+0.45)+','+cy+' '+(cx-0.3)+','+(cy-0.35)+' '+(cx-0.3)+','+(cy+0.35);
      else if(d==='WEST'||d==='W')ap=(cx-0.45)+','+cy+' '+(cx+0.3)+','+(cy-0.35)+' '+(cx+0.3)+','+(cy+0.35);
      if(ap)html+='<polygon class="svge-entrance" data-idx="'+i+'" data-kind="entrance" points="'+ap+'" fill="#22bb55" fill-opacity="0.85" pointer-events="none"/>';
      else  html+='<circle class="svge-entrance" data-idx="'+i+'" data-kind="entrance" cx="'+cx+'" cy="'+cy+'" r="0.26" fill="none" stroke="#22bb55" stroke-width="0.18" pointer-events="none"/>';
    });

    html+='</svg></div></div>';
    html+='<div id="rg-tip" style="font-size:11px;color:#aaa;height:16px;padding:2px 4px;font-family:monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></div>';
    html+='</div>'; // rg-outer
  }else{
    html+='<div class="rg-outer rs-map"><div class="rg-placeholder"><span>No coordinate data</span>';
    html+='<button class="rg-pick-btn" id="rg-pick-btn" data-map="'+escH(opts.mapName||'')+'">assign image…</button></div></div>';
  }

  return{html:html,x1:x1,y1:y1,x2:x2,y2:y2,W:W,H:H,dispW:dispW,dispH:dispH,hasCoords:hasCoords,zoomState:zoomState};
}
