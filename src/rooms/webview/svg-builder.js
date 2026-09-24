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
 *   .arrivals   doors leading into this room (or empty)
 *   .filtersHtml  the per-room display-toggle bar (map-editor-filterbar.js),
 *                 docked below the canvas card — inside #rg-outer, so it
 *                 travels with the canvas rather than the name/header line
 *                 above it
 *   .statusHtml   the bar under that: hovered cell, room size, draft summary,
 *                 hovered-entity label (map-editor-filterbar.js)
 * @returns {{ html: string, x1, y1, x2, y2, W, H, dispW, dispH, hasCoords, zoomState }}
 */
function buildRoomSvgSection(opts){
  var im=opts.im, entrances=opts.entrances, enemies=opts.enemies;
  var stepOn=opts.stepOn, bTrigger=opts.bTrigger, poi=opts.poi||[];
  var trigOff=opts.trigOff, stepOnNames=opts.stepOnNames, bTrigNames=opts.bTrigNames;
  var imageUri=opts.imageUri, imageDims=opts.imageDims, rh=opts.rh;
  var romSpawns=opts.romSpawns||[];
  var arrivals=opts.arrivals||[];
  var filtersHtml=opts.filtersHtml||'';
  var statusHtml=opts.statusHtml||'';

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
  // The map image's own extent, captured BEFORE entities widen the viewBox.
  // A trigger at the map edge pushes x2/y2 past the map, and the image used to
  // be stretched across the whole widened box by CSS — which drifted the grid
  // off the tile boundaries by 1-3% on 54 of the 127 rooms. The image is now
  // placed at these coordinates inside the SVG instead, so it cannot drift.
  var mapX0=x1, mapY0=y1;
  var mapW=(rh&&rh.mapWpx)?rh.mapWpx/TILE:(imageDims?imageDims.w/TILE:(x2-x1));
  var mapH=(rh&&rh.mapHpx)?rh.mapHpx/TILE:(imageDims?imageDims.h/TILE:(y2-y1));

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
    // The canvas zone centres one rounded, bordered, shadowed card in empty
    // space, per the design mock's canvasInnerStyle + canvasCardStyle. The
    // grid is no longer left-aligned and full-bleed; the floating tool pill
    // (map-editor-toolbar.js) hangs off this card's top edge and the zoom
    // chip sits inside its bottom-left corner, which is why the card — not
    // #rg-outer — is what establishes the positioning context for both.
    html+='<div class="rg-canvas-zone" id="rg-canvas-zone">';
    html+='<div class="rg-canvas-card" id="rg-canvas-card">';
    html+='<div class="rg-wrap" id="rg-wrap" style="width:'+dispW+'px;height:'+dispH+'px">';
    html+='<div id="rg-canvas" style="position:absolute;width:'+dispW+'px;height:'+dispH+'px;transform-origin:0 0;will-change:transform">';
    html+='<svg class="rg-svg" id="rg-svg" width="'+dispW+'" height="'+dispH+'" viewBox="'+x1+' '+y1+' '+W+' '+H+'">';

    // The map image lives inside the SVG, in viewBox units, so it shares one
    // coordinate system with the grid and the entity overlays. Sized from the
    // map's own extent rather than the (possibly wider) viewBox.
    html+='<image class="room-img" id="rg-img" x="'+mapX0+'" y="'+mapY0+'" width="'+mapW+'" height="'+mapH+
          '" preserveAspectRatio="none"'+(imageUri?' href="'+imageUri+'"':'')+'/>';

    // Everything from here on is annotation rather than scenery, so it is
    // collected and appended after the map layers — see the canopy comment
    // below. The map itself is the only thing allowed to cover a sprite.
    var over='';

    // Grid lines at their true spacing: 1 viewBox unit = one 8px tile, 2 units
    // = one 16px metatile. These used to coarsen to 2 or 4 units on large maps,
    // which made the "8px" grid draw every 32px and stopped it lining up with
    // the rendered map. One <path> per grid keeps the DOM small at any size.
    function gridPath(step,ox,oy){
      var d='';
      var gx0=x1-((x1%step+step)%step);
      var gy0=y1-((y1%step+step)%step);
      for(var gx=gx0;gx<=x2;gx+=step)if(gx>=x1)d+='M'+gx+' '+y1+'V'+y2;
      for(var gy=gy0;gy<=y2;gy+=step)if(gy>=y1)d+='M'+x1+' '+gy+'H'+x2;
      return d;
    }
    over+='<path class="rg-grid-fine" d="'+gridPath(1)+'" fill="none" stroke="rgba(255,255,255,0.11)" stroke-width="0.07"/>';
    over+='<path class="rg-grid-coarse" d="'+gridPath(2)+'" fill="none" stroke="rgba(160,140,80,0.42)" stroke-width="0.18"/>';

    // Step-on rects (pink)
    stepOn.forEach(function(t,i){
      var nm=stepOnNames[i]||'';
      var sv=tsvg(t,trigOff);
      var tip='step-on'+(nm?' '+escH(nm):'')+exitTip(t)+(t.label?' — '+escH(t.label):'');
      over+='<rect class="svge-step" data-idx="'+i+'" data-kind="step" data-label="'+escH(nm||exitLabel(t)||t.label||'')+' ['+t.x1+','+t.y1+':'+t.x2+','+t.y2+']" x="'+sv.sx+'" y="'+sv.sy+'" width="'+sv.sw+'" height="'+sv.sh+'" fill="rgba(255,100,180,0.18)" stroke="#ff69b4" stroke-width="0.3"><title>'+tip+'</title></rect>';
    });

    // B-trigger rects (yellow) + ingredient icons
    bTrigger.forEach(function(t,i){
      var nm=bTrigNames[i]||'';
      var sv=tsvg(t,trigOff);
      // Vanilla rooms have no trigger names, so the reward the ROM decoder
      // read out of the script is what names the icon and fills the tooltip.
      var iconName=trigIngrName(t,nm||t.label||'');
      var tip='B-trig'+(nm?' '+escH(nm):'')+lootTip(t)+exitTip(t)+(t.label?' — '+escH(t.label):'');
      var ingrEmoji=getIngrIcon(iconName);
      var blabel=escH(nm||lootLabel(t)||exitLabel(t)||t.label||'')+(ingrEmoji?' '+ingrEmoji:'')+' ['+t.x1+','+t.y1+':'+t.x2+','+t.y2+']';
      over+='<rect class="svge-btrig" data-idx="'+i+'" data-kind="btrig" data-label="'+blabel+'" x="'+sv.sx+'" y="'+sv.sy+'" width="'+sv.sw+'" height="'+sv.sh+'" fill="rgba(255,210,0,0.13)" stroke="#ffcc00" stroke-width="0.3"><title>'+(ingrEmoji?ingrEmoji+' ':'')+tip+'</title></rect>';
      if(ingrEmoji){
        var ifs=Math.max(1.5,Math.min(sv.sw,sv.sh,2.8));
        var imgHtml=ingrSvgImg(iconName,sv.sx+sv.sw/2,sv.sy+sv.sh/2,ifs*1.2);
        if(imgHtml){
          over+='<g class="svge-btrig svge-ingr">'+imgHtml+'</g>';
        }else{
          over+='<text class="svge-btrig svge-ingr" x="'+(sv.sx+sv.sw/2)+'" y="'+(sv.sy+sv.sh/2+ifs*0.4)+'" text-anchor="middle" font-size="'+ifs+'" pointer-events="none" style="user-select:none">'+ingrEmoji+'</text>';
        }
      }
    });

    // NPCs the ROM's enter script can place, in the three layers
    // svg-spawns.js sorts them into.
    //
    // Same coordinate space as a live room's add_enemy(x, y): the encoder
    // passes those arguments straight into these opcodes, so a ROM spawn and
    // a source-defined enemy plot identically.
    var spawnLayers=buildSpawnLayers(romSpawns);
    html+=spawnLayers.behind;

    // The canopy, drawn back over the characters the game draws under it —
    // and only those.
    //
    // In Mode 1 the layer order is OBJ.3 > BG1.1 > BG2.1 > OBJ.2 > BG1.0 >
    // BG2.0, and $8FC773 reads the collision word of the tile a character
    // stands on: bit 12 set gives OAM priority 3, in front of every
    // background pixel, and only without it does the priority half of the
    // map cover the character. 84% of vanilla tiles set that bit, so drawing
    // this over every sprite was wrong for most of them.
    //
    // The host renders exactly the priority-half pixels; everything else is
    // transparent, so this sits harmlessly on top of the identical pixels of
    // the base map.
    html+='<image class="svge-fg" id="rg-fg" x="'+mapX0+'" y="'+mapY0+'" width="'+mapW+'" height="'+mapH+
          '" preserveAspectRatio="none" style="display:none" pointer-events="none"/>';
    html+=spawnLayers.front;

    // The feature overlay again, cut back to the pixels the canopy covers and
    // dashed there. The map raster under the canopy already carries the solid
    // version, so together they read as "solid where the player can see the
    // wall, dashed where the foreground hides it" — the convention a tunnel
    // under a bridge already uses.
    html+='<image class="svge-canopy-ov" id="rg-canopy-ov" x="'+mapX0+'" y="'+mapY0+'" width="'+mapW+'" height="'+mapH+
          '" preserveAspectRatio="none" style="display:none" pointer-events="none"/>';

    // Annotation from here on, over every map layer.
    html+=over;
    html+=spawnLayers.marks;

    // Doors that lead into this room, gathered from every script in the ROM.
    // Drawn over the canopy: they are annotation, not scenery.
    arrivals.forEach(function(a,i){
      var dirName={north:'north',east:'east',south:'south',west:'west'}[a.direction]||'';
      var label='from '+(a.fromName||('map 0x'+a.fromMap.toString(16)))
            +(dirName?' — walking '+dirName:'');
      var tip=label+'\n'+a.kind+(a.index>=0?' #'+a.index:'')+' at '+a.unitX+','+a.unitY
            +(a.prepares&&a.prepares.length?'\n'+a.prepares.map(function(p){return p.name;}).join('\n'):'')
            +'\nclick to open that room';
      var cx=a.unitX, cy=a.unitY, r=0.62;
      html+='<g class="svge-arrival" data-goto-map="'+a.fromMap.toString(16)+'" data-idx="'+i+'" data-kind="arrival" data-label="'+escH(label)+'" style="cursor:pointer">';
      html+='<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="rgba(120,200,255,0.18)" stroke="#63c5ff" stroke-width="0.22"><title>'+escH(tip)+'</title></circle>';
      // An arrow along the direction the player is walking as they come in.
      var d={north:[0,-1],south:[0,1],east:[1,0],west:[-1,0]}[a.direction];
      if(d){
        var ax=cx+d[0]*1.35, ay=cy+d[1]*1.35;
        html+='<line x1="'+(cx+d[0]*0.7)+'" y1="'+(cy+d[1]*0.7)+'" x2="'+ax+'" y2="'+ay+'" stroke="#63c5ff" stroke-width="0.22" pointer-events="none"/>';
        var px=-d[1]*0.34, py=d[0]*0.34;
        html+='<polygon points="'+ax+','+ay+' '+(ax-d[0]*0.5+px)+','+(ay-d[1]*0.5+py)+' '+(ax-d[0]*0.5-px)+','+(ay-d[1]*0.5-py)+'" fill="#63c5ff" fill-opacity="0.9" pointer-events="none"/>';
      }
      html+='</g>';
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

    html+='</svg></div></div>';   // rg-canvas, rg-wrap
    // The zoom chip: a read-out of the current level plus the three controls
    // that change it, in the card's bottom-left corner (the mock's
    // zoomChipStyle). The ids are the ones interactions.js's setupZoomPan
    // already binds — this is chrome, not behaviour.
    html+='<div class="rg-zoom" id="rg-zoom">'
      +'<button id="rg-zout" title="Zoom out" aria-label="zoom out">−</button>'
      +'<span class="rg-zoom-level" id="rg-zoom-level" title="Zoom — 100% is one ROM pixel per '
      +'screen pixel. Ctrl/⌘ + scroll over the map to pinch.">—</span>'
      +'<button id="rg-zin" title="Zoom in" aria-label="zoom in">+</button>'
      +'<button id="rg-zfit" title="Fit the whole room in the frame">fit</button>'
      +'</div>';
    html+='</div></div>';   // rg-canvas-card, rg-canvas-zone
    // Docked under the canvas card, inside the same column: see the
    // filtersHtml/statusHtml param docs above and map-editor-canvas.css.
    html+=filtersHtml;
    html+=statusHtml;
    html+='</div>'; // rg-outer
  }else{
    html+='<div class="rg-outer rs-map"><div class="rg-canvas-zone">'
      +'<div class="rg-canvas-card" id="rg-canvas-card">';
    html+='<div class="rg-placeholder"><span>No coordinate data</span>';
    html+='<button class="rg-pick-btn" id="rg-pick-btn" data-map="'+escH(opts.mapName||'')+'">assign image…</button></div>';
    html+='</div></div>';
    html+=filtersHtml;
    html+=statusHtml;
    html+='</div>';
  }

  return{html:html,x1:x1,y1:y1,x2:x2,y2:y2,W:W,H:H,dispW:dispW,dispH:dispH,
         mapX0:mapX0,mapY0:mapY0,hasCoords:hasCoords,zoomState:zoomState};
}
