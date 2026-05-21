
function escH(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

// Tab switching (posts tabChange so host preserves active tab across re-renders)
document.querySelectorAll('.tab').forEach(function(btn){
  btn.addEventListener('click',function(){
    document.querySelectorAll('.tab').forEach(function(b){b.classList.remove('tab-active');});
    btn.classList.add('tab-active');
    var tab=btn.dataset.tab;
    document.querySelectorAll('.tab-pane').forEach(function(p){
      p.style.display=p.dataset.tab===tab?'flex':'none';
    });
    if(vs)vs.postMessage({command:'tabChange',tab:tab});
  });
});

// Area collapse / expand
document.querySelectorAll('.rn-area-label').forEach(function(lbl){
  lbl.addEventListener('click',function(){
    var li=lbl.closest('li.rn-area');
    if(li)li.classList.toggle('collapsed');
  });
});

// Live/Vanilla mode toggle
var _vanillaMode = false;
(function(){
  var btnLive    = document.getElementById('rmm-live');
  var btnVanilla = document.getElementById('rmm-vanilla');
  var liveTree   = document.getElementById('rm-live-tree');
  var vanTree    = document.getElementById('rm-vanilla-tree');
  function setMode(vanilla){
    _vanillaMode = vanilla;
    btnLive.classList.toggle('active', !vanilla);
    btnVanilla.classList.toggle('active', vanilla);
    liveTree.style.display  = vanilla ? 'none' : '';
    vanTree.style.display   = vanilla ? ''     : 'none';
    document.getElementById('room-detail').className='rm-detail-placeholder';
    document.getElementById('room-detail').innerHTML='<span>Select a room</span>';
  }
  if(btnLive)   btnLive.addEventListener('click',   function(){ setMode(false); });
  if(btnVanilla)btnVanilla.addEventListener('click', function(){ setMode(true);  });
  // Vanilla room click → show stub detail
  document.querySelectorAll('.vn-map').forEach(function(li){
    li.addEventListener('click',function(){
      document.querySelectorAll('.rn-map.rsel,.vn-map.rsel').forEach(function(x){x.classList.remove('rsel');});
      li.classList.add('rsel');
      var vid = li.dataset.vid;
      var area='', name=li.querySelector('.rn-label')?.textContent||'';
      for(var a of VANILLA_ROOMS_DATA){for(var r of a.rooms){if(r.id===vid){area=a.area;name=r.name;}}}
      var detail = document.getElementById('room-detail');
      detail.className='';
      detail.innerHTML='<div class="rd-head"><span class="rd-name">'+name+'</span>'
        +'<span class="rd-vid">'+vid+'</span>'
        +'<span class="rd-file">vanilla</span>'
        +'</div>'
        +'<div style="padding:8px 4px;opacity:.4;font-size:10px">No live data in Vanilla mode. Static ROM data only.</div>';
    });
  });
})();

// Map click → show detail
document.querySelectorAll('.rn-map').forEach(function(li){
  li.addEventListener('click',function(){
    document.querySelectorAll('.rn-map.rsel').forEach(function(x){x.classList.remove('rsel');});
    li.classList.add('rsel');
    var mapName=li.dataset.map;
    var room=ROOMS[mapName];
    if(!room)return;
    renderRoomDetail(room);
  });
});

function renderRoomDetail(room){
  var panel=document.getElementById('room-detail');
  if(!panel)return;
  console.log('[RoomsRender] renderRoomDetail:start', {room: room && room.name});
  panel.className='';
  var c=room.content||{};
  var im=c.initMap;
  var entrances=c.entrances||[];
  var enemies=c.enemies||[];
  var objs=c.objects||[];
  var trans=c.transitions||[];
  var trig=c.triggers||{stepOn:[],bTrigger:[]};
  var stepOn=trig.stepOn||[];
  var bTrigger=trig.bTrigger||[];
  var trigNames=c.triggerNames||{stepOn:[],bTrigger:[]};
  var stepOnNames=trigNames.stepOn||[];
  var bTrigNames=trigNames.bTrigger||[];
  var poi=c.poi||[];
  // Trigger coordinate origin (from ROM meta bytes). Converts 16px-tile coords to 8px-tile SVG space.
  var trigOff=c.trigOffset||null;
  function tsvg(t){
    if(!trigOff)return{sx:t.x1,sy:t.y1,sw:Math.max(0.5,t.x2-t.x1),sh:Math.max(0.5,t.y2-t.y1)};
    return{sx:(t.x1-trigOff.offX)*2,sy:(t.y1-trigOff.offY)*2,
           sw:Math.max(1,(t.x2-t.x1)*2),sh:Math.max(1,(t.y2-t.y1)*2)};
  }
  // Ingredient icon mapping: keyword in trigger name → filename (webp in INGR_BASE)
  // Falls back to emoji when INGR_BASE is not configured.
  var INGR_MAP={wax:'Wax',vinegar:'Vinegar',oil:'Oil',mud:'Mud_Pepper',pepper:'Mud_Pepper',
    limestone:'Limestone',dry_ice:'Dry_Ice',crystal:'Crystal',clay:'Clay',brimstone:'Brimstone',
    ash:'Ash',water:'Water',root:'Root',nectar:'Nectar',petal:'Petal',honey:'Honey',
    vine:'Root',bone:'Bone',feather:'Feather',mercury:'Mercury',
    acorn:'Acorn',ethanol:'Ethanol',grease:'Grease',gunpowder:'Gunpowder',iron:'Iron',
    meteorite:'Meteorite',mushroom:'Mushroom',wax_residue:'Wax',atlas:'Atlas_Amulet'};
  var INGR_EMOJI={wax:'🕯',vinegar:'🧪',oil:'🪻',mud:'🌶',
    pepper:'🌶',limestone:'🪨',dry_ice:'🧊',crystal:'💎',
    clay:'🎺',brimstone:'🔥',ash:'⚫',water:'💧',
    root:'🌿',nectar:'🌺',petal:'🌸',bone:'🦴',feather:'🪶'};
  function getIngrKey(nm){if(!nm)return null;var low=nm.toLowerCase();for(var k in INGR_MAP){if(low.indexOf(k)!==-1)return k;}return null;}
  function getIngrIcon(nm){var k=getIngrKey(nm);return k?INGR_EMOJI[k]||'🌿':null;}
  // Returns an <image> SVG element or null for use inside SVG
  function ingrSvgImg(nm,x,y,sz){
    var k=getIngrKey(nm); if(!k)return null;
    if(!INGR_BASE)return null;
    var fn=INGR_MAP[k]+'.webp';
    return '<image href="'+INGR_BASE+fn+'" x="'+(x-sz/2).toFixed(2)+'" y="'+(y-sz/2).toFixed(2)+'" width="'+sz+'" height="'+sz+'" style="image-rendering:pixelated" pointer-events="none"/>';
  }

  var html='<div class="rd-head">';
  html+='<span class="rd-name">'+escH(room.name)+'</span>';
  if(room.vanillaId)html+='<span class="rd-vid">'+escH(room.vanillaId)+'</span>';
  html+='<span class="rd-file">'+escH(room.relPath||'')+'</span>';
  html+='<a class="ll" data-line="'+room.startLine+'" href="#">go to code</a>';
  html+='<div class="rd-filters">';
  if(entrances.length)html+='<button class="rdf on" data-hide="hide-ent" title="Toggle entrances">ent</button>';
  if(objs.length)html+='<button class="rdf on" data-hide="hide-obj" title="Toggle objects">obj</button>';
  if(stepOn.length)html+='<button class="rdf on" data-hide="hide-step" title="Toggle step-on triggers">step-on</button>';
  if(bTrigger.length)html+='<button class="rdf on" data-hide="hide-btrig" title="Toggle B-triggers">B-trig</button>';
  if(poi.length)html+='<button class="rdf on" data-hide="hide-poi" title="Toggle points of interest">POI</button>';
  var hasIngr=bTrigger.some(function(t,i){return !!getIngrIcon(bTrigNames[i]||t.label||'');});
  if(hasIngr)html+='<button class="rdf on" data-hide="hide-ingr" title="Toggle sniff spot ingredient icons">🌿</button>';
  html+='<button class="rdf" id="rg-lock-btn" title="Lock map (prevent element dragging)">🔓</button>';
  html+='</div></div>';

  var hasCoords=(im!=null)||(entrances.length>0)||(enemies.length>0)||(stepOn.length>0)||(bTrigger.length>0)||(poi.length>0);

  // Determine grid bounds in tile units (1 tile = 8 px in source image)
  var TILE=8;
  var x1=0,y1=0,x2=32,y2=32;
  if(im){x1=im.x1;y1=im.y1;x2=im.x2;y2=im.y2;}
  if(room.imageDims){
    var imgCols=Math.round(room.imageDims.w/TILE);
    var imgRows=Math.round(room.imageDims.h/TILE);
    x2=x1+imgCols; y2=y1+imgRows;
  }
  // Clamp out-of-bounds entities by expanding bounds
  entrances.concat(enemies).forEach(function(e){
    if(e.x<x1)x1=Math.floor(e.x)-1;
    if(e.y<y1)y1=Math.floor(e.y)-1;
    if(e.x+2>x2)x2=Math.ceil(e.x)+2;
    if(e.y+2>y2)y2=Math.ceil(e.y)+2;
  });
  stepOn.concat(bTrigger).forEach(function(t){
    var sv=tsvg(t);
    if(sv.sx<x1)x1=sv.sx-1; if(sv.sy<y1)y1=sv.sy-1;
    if(sv.sx+sv.sw+1>x2)x2=sv.sx+sv.sw+1; if(sv.sy+sv.sh+1>y2)y2=sv.sy+sv.sh+1;
  });
  var W=Math.max(x2-x1,8),H=Math.max(y2-y1,8);

  // Display size: keep width fixed, compute height to preserve aspect ratio
  var dispW=520;
  var dispH=room.imageDims ? Math.min(600,Math.round(dispW*room.imageDims.h/room.imageDims.w)) : Math.round(dispW*H/W);
  // Current zoom (tiles per display pixel), starts at auto-fit
  var zoomState={scale:0}; // 0 = auto
  function getScale(s){
    if(s===0)return Math.min(dispW/W,dispH/H,20);
    return s;
  }

  if(hasCoords||room.imageUri||room.name){
    html+='<div class="rg-outer" id="rg-outer">';
    html+='<div class="rg-zoom"><button id="rg-zin">+</button><button id="rg-zout">-</button><button id="rg-zfit">fit</button></div>';
    html+='<div class="rg-wrap" id="rg-wrap" style="width:'+dispW+'px;height:'+dispH+'px">';
    html+='<div id="rg-canvas" style="position:absolute;width:'+dispW+'px;height:'+dispH+'px;transform-origin:0 0;will-change:transform">';
    if(room.imageUri) html+='<img class="room-img" id="rg-img" src="'+room.imageUri+'" alt="">';
    html+='<svg class="rg-svg" id="rg-svg" width="'+dispW+'" height="'+dispH+'" viewBox="'+x1+' '+y1+' '+W+' '+H+'">';

    // 8×8-tile grid (fine grid for entrances/enemies)
    var tileStep=1;
    if(W>64||H>64)tileStep=2;
    if(W>128||H>128)tileStep=4;
    for(var gx=x1;gx<=x2;gx+=tileStep)html+='<line x1="'+gx+'" y1="'+y1+'" x2="'+gx+'" y2="'+y2+'" stroke="rgba(255,255,255,0.11)" stroke-width="0.07"/>';
    for(var gy=y1;gy<=y2;gy+=tileStep)html+='<line x1="'+x1+'" y1="'+gy+'" x2="'+x2+'" y2="'+gy+'" stroke="rgba(255,255,255,0.11)" stroke-width="0.07"/>';
    // 16×16-tile grid (coarse grid for step-on / B-trigger coordinates)
    var trigStep=tileStep*2;
    var tgx0=x1-((x1%trigStep+trigStep)%trigStep);
    var tgy0=y1-((y1%trigStep+trigStep)%trigStep);
    for(var gx=tgx0;gx<=x2;gx+=trigStep)html+='<line x1="'+gx+'" y1="'+y1+'" x2="'+gx+'" y2="'+y2+'" stroke="rgba(160,140,80,0.42)" stroke-width="0.18"/>';
    for(var gy=tgy0;gy<=y2;gy+=trigStep)html+='<line x1="'+x1+'" y1="'+gy+'" x2="'+x2+'" y2="'+gy+'" stroke="rgba(160,140,80,0.42)" stroke-width="0.18"/>';
    if((x2-tgx0)%trigStep!==0)html+='<line x1="'+x2+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="rgba(160,140,80,0.42)" stroke-width="0.18"/>';
    if((y2-tgy0)%trigStep!==0)html+='<line x1="'+x1+'" y1="'+y2+'" x2="'+x2+'" y2="'+y2+'" stroke="rgba(160,140,80,0.42)" stroke-width="0.18"/>';
    // Room border
    if(im)html+='<rect x="'+x1+'" y="'+y1+'" width="'+W+'" height="'+H+'" fill="none" stroke="rgba(50,200,100,0.3)" stroke-width="0.25" stroke-dasharray="2,1"/>';

    // Step-on rects (pink) — coords in 16px-tile space, converted via tsvg()
    stepOn.forEach(function(t,i){
      var nm=stepOnNames[i]||'';
      var sv=tsvg(t);
      var tip='step-on'+(nm?' '+escH(nm):'')+(t.label?' — '+escH(t.label):'');
      html+='<rect class="svge-step" data-idx="'+i+'" data-kind="step" data-label="'+escH(nm||t.label||'')+' ['+t.x1+','+t.y1+':'+t.x2+','+t.y2+']" x="'+sv.sx+'" y="'+sv.sy+'" width="'+sv.sw+'" height="'+sv.sh+'" fill="rgba(255,100,180,0.18)" stroke="#ff69b4" stroke-width="0.3"><title>'+tip+'</title></rect>';
    });
    // B-trigger rects (yellow) — coords in 16px-tile space, converted via tsvg()
    bTrigger.forEach(function(t,i){
      var nm=bTrigNames[i]||'';
      var sv=tsvg(t);
      var tip='B-trig'+(nm?' '+escH(nm):'')+(t.label?' — '+escH(t.label):'');
      var ingrEmoji=getIngrIcon(nm||t.label||'');
      var blabel=escH(nm||t.label||'')+(ingrEmoji?' '+ingrEmoji:'')+' ['+t.x1+','+t.y1+':'+t.x2+','+t.y2+']';
      html+='<rect class="svge-btrig" data-idx="'+i+'" data-kind="btrig" data-label="'+blabel+'" x="'+sv.sx+'" y="'+sv.sy+'" width="'+sv.sw+'" height="'+sv.sh+'" fill="rgba(255,210,0,0.13)" stroke="#ffcc00" stroke-width="0.3"><title>'+(ingrEmoji?ingrEmoji+' ':'')+tip+'</title></rect>';
      if(ingrEmoji){
        var ifs=Math.max(1.5,Math.min(sv.sw,sv.sh,2.8));
        var imgHtml=ingrSvgImg(nm||t.label||'',sv.sx+sv.sw/2,sv.sy+sv.sh/2,ifs*1.2);
        if(imgHtml){
          html+='<g class="svge-btrig svge-ingr">'+imgHtml+'</g>';
        } else {
          html+='<text class="svge-btrig svge-ingr" x="'+(sv.sx+sv.sw/2)+'" y="'+(sv.sy+sv.sh/2+ifs*0.4)+'" text-anchor="middle" font-size="'+ifs+'" pointer-events="none" style="user-select:none">'+ingrEmoji+'</text>';
        }
      }
    });
    // Lua POI markers (cyan cross)
    poi.forEach(function(p,i){
      var pr=0.6;
      html+='<line class="svge-poi hide-poi" x1="'+(p.x-pr)+'" y1="'+p.y+'" x2="'+(p.x+pr)+'" y2="'+p.y+'" stroke="#00e5ff" stroke-width="0.25"/>';
      html+='<line class="svge-poi hide-poi" x1="'+p.x+'" y1="'+(p.y-pr)+'" x2="'+p.x+'" y2="'+(p.y+pr)+'" stroke="#00e5ff" stroke-width="0.25"/>';
    });
    // Box-select overlay rect (hidden by default)
    html+='<rect id="rg-sel" x="0" y="0" width="0" height="0" fill="rgba(100,200,255,0.10)" stroke="#64c8ff" stroke-width="0.3" stroke-dasharray="1,0.5" display="none"/>';
    // Enemies (red=normal, orange=dynamic) — 1×1 tile square
    enemies.forEach(function(e,i){
      var ex=Math.round(e.x),ey=Math.round(e.y);
      var fill=e.dynamic?'#cc7700':'#cc3333';
      html+='<rect class="svge-enemy sv-ll svge-mv" data-line="'+e.line+'" data-idx="'+i+'" data-kind="enemy" data-label="'+escH(e.type)+' ('+e.x+','+e.y+')" x="'+ex+'" y="'+ey+'" width="1" height="1" fill="'+fill+'" opacity="0.85" rx="0.2"><title>'+escH(e.type)+' ('+e.x+','+e.y+')\ncmd+click</title></rect>';
    });
    // Entrances — 1-tile square with inset directional arrow
    entrances.forEach(function(en,i){
      var ex=Math.round(en.x),ey=Math.round(en.y);
      var d=en.dir?en.dir.toUpperCase():'';
      // Square background
      html+='<rect class="svge-entrance sv-ll svge-mv" data-line="'+en.line+'" data-idx="'+i+'" data-kind="entrance" data-label="'+escH(en.name)+' ('+en.x+','+en.y+') '+escH(en.dir)+'" x="'+ex+'" y="'+ey+'" width="1" height="1" fill="rgba(34,187,85,0.2)" stroke="#22bb55" stroke-width="0.2"><title>'+escH(en.name)+'\ncmd+click</title></rect>';
      // Arrow inside the tile pointing in entrance direction (center at cx,cy)
      var cx=ex+0.5,cy=ey+0.5;
      var ap='';
      if(d==='NORTH'||d==='N') ap=cx+','+(cy-0.45)+' '+(cx-0.35)+','+(cy+0.3)+' '+(cx+0.35)+','+(cy+0.3);
      else if(d==='SOUTH'||d==='S') ap=cx+','+(cy+0.45)+' '+(cx-0.35)+','+(cy-0.3)+' '+(cx+0.35)+','+(cy-0.3);
      else if(d==='EAST'||d==='E') ap=(cx+0.45)+','+cy+' '+(cx-0.3)+','+(cy-0.35)+' '+(cx-0.3)+','+(cy+0.35);
      else if(d==='WEST'||d==='W') ap=(cx-0.45)+','+cy+' '+(cx+0.3)+','+(cy-0.35)+' '+(cx+0.3)+','+(cy+0.35);
      if(ap)html+='<polygon class="svge-entrance" data-idx="'+i+'" data-kind="entrance" points="'+ap+'" fill="#22bb55" fill-opacity="0.85" pointer-events="none"/>';
    });
    html+='</svg>';
    html+='</div>'; // close rg-canvas
    html+='</div>'; // close rg-wrap
    // Hover status bar — outside the scrollable canvas
    html+='<div id="rg-tip" style="font-size:11px;color:#aaa;min-height:16px;padding:2px 4px;font-family:monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></div>';
    html+='</div>'; // close rg-outer
  } else {
    html+='<div class="rg-outer"><div class="rg-placeholder"><span>No coordinate data</span>';
    html+='<button class="rg-pick-btn" id="rg-pick-btn" data-map="'+escH(room.name)+'">assign image…</button></div></div>';
  }

  // ── Tables ──
  if(entrances.length){
    html+='<div class="rs rs-entrance"><div class="rs-h">Entrances</div>';
    html+='<table class="rs-tbl"><thead><tr><th>#</th><th>Name</th><th>Coord</th><th>Dir</th><th>Line</th></tr></thead><tbody>';
    entrances.forEach(function(e,i){
      html+='<tr data-kind="entrance" data-idx="'+i+'"><td>'+i+'</td><td><a class="ll" data-line="'+e.line+'" href="#">'+escH(e.name)+'</a></td><td>('+e.x+','+e.y+')</td><td>'+escH(e.dir)+'</td><td>'+e.line+'</td></tr>';
    });
    html+='</tbody></table></div>';
  }
  if(enemies.length){
    html+='<div class="rs rs-enemies"><div class="rs-h">Enemies</div>';
    html+='<table class="rs-tbl"><thead><tr><th>#</th><th>Type</th><th>Coord</th><th>Line</th></tr></thead><tbody>';
    enemies.forEach(function(e,i){
      html+='<tr data-kind="enemy" data-idx="'+i+'"><td>'+i+'</td><td><a class="ll" data-line="'+e.line+'" href="#">'+escH(e.type)+'</a></td><td>('+e.x+','+e.y+')</td><td>'+e.line+(e.dynamic?' <span class="badge-d">dyn</span>':'')+'</td></tr>';
    });
    html+='</tbody></table></div>';
  }
  if(objs.length){
    html+='<div class="rs rs-objects"><div class="rs-h">Objects</div>';
    html+='<table class="rs-tbl"><thead><tr><th>Index</th><th>Description</th><th>Line</th></tr></thead><tbody>';
    objs.forEach(function(o,i){
      var lineStr=o.line>=0?('<a class="ll" data-line="'+o.line+'" href="#">'+o.line+'</a>'):'&ndash;';
      html+='<tr data-kind="obj" data-idx="'+i+'"><td>object['+escH(o.index)+']</td><td>'+(o.desc?escH(o.desc):'&ndash;')+'</td><td>'+lineStr+'</td></tr>';
    });
    html+='</tbody></table></div>';
  }
  if(trans.length){
    html+='<div class="rs rs-transitions"><div class="rs-h">Transitions</div>';
    html+='<table class="rs-tbl"><thead><tr><th>Target</th><th>Via</th><th>Dir</th><th>Line</th></tr></thead><tbody>';
    trans.forEach(function(t){
      html+='<tr><td><a class="ll" data-line="'+t.line+'" href="#">'+escH(t.target)+'</a></td><td>'+escH(t.via)+'</td><td>'+escH(t.dir)+'</td><td>'+t.line+'</td></tr>';
    });
    html+='</tbody></table></div>';
  }
  if(stepOn.length){
    html+='<div class="rs rs-step"><div class="rs-h">Step-on triggers</div>';
    html+='<table class="rs-tbl"><thead><tr><th>Name</th><th>Coords</th><th>Script label</th></tr></thead><tbody>';
    stepOn.forEach(function(t,i){
      var nm=stepOnNames[i]||('#'+i);
      html+='<tr class="trig-step" data-kind="step" data-idx="'+i+'"><td><code>'+escH(nm)+'</code></td><td class="trig-coord">['+t.x1+','+t.y1+':'+t.x2+','+t.y2+']</td><td>'+(t.label?'<em>'+escH(t.label)+'</em>':'&ndash;')+'</td></tr>';
    });
    html+='</tbody></table></div>';
  }
  if(bTrigger.length){
    html+='<div class="rs rs-btrig"><div class="rs-h">B-triggers</div>';
    html+='<table class="rs-tbl"><thead><tr><th>Name</th><th>Coords</th><th>Script label</th></tr></thead><tbody>';
    bTrigger.forEach(function(t,i){
      var nm=bTrigNames[i]||('#'+i);
      html+='<tr class="trig-b" data-kind="btrig" data-idx="'+i+'"><td><code>'+escH(nm)+'</code></td><td class="trig-coord">['+t.x1+','+t.y1+':'+t.x2+','+t.y2+']</td><td>'+(t.label?'<em>'+escH(t.label)+'</em>':'&ndash;')+'</td></tr>';
    });
    html+='</tbody></table></div>';
  }

  // ── ROM Map Data section ──────────────────────────────────────────────────
  var rh=c.romHeader||null;
  if(rh){
    html+='<div class="rs rs-romhdr">';
    html+='<div class="rs-h rsh-toggle" id="rsh-toggle">ROM Map Data &#9660;</div>';
    html+='<div class="rsh-body" id="rsh-body">';
    // 13-byte header table
    html+='<div class="rsh-section-lbl">13-byte ROM header</div>';
    html+='<table class="rs-tbl rsh-tbl"><thead><tr><th>Offset</th><th>Value</th><th>Field name</th><th>WRAM / IO register</th><th>Description</th></tr></thead><tbody>';
    var HMETA=[
      {off:'0x00',val:rh.offX,       name:'trig_off_x',            wram:'7E0F86',              desc:'Trigger rect origin X (16px-tile units)',conf:'h'},
      {off:'0x01',val:rh.offY,       name:'trig_off_y',            wram:'7E0F88',              desc:'Trigger rect origin Y (16px-tile units)',conf:'h'},
      {off:'0x02',val:rh.mapW,       name:'map_w_tiles',           wram:'7E08EE → 7E08F2, 7E08F6', desc:'Map width in 16px tiles; loader derives pixel size and horizontal scroll capacity',conf:'h'},
      {off:'0x03',val:rh.mapH,       name:'map_h_tiles',           wram:'7E08F0 → 7E08F4, 7E08F8', desc:'Map height in 16px tiles; loader derives pixel size and vertical scroll capacity',conf:'h'},
      {off:'0x04',val:rh.b4,         name:'room_render_preset',    wram:'7E0F80 → TM $212C',      desc:'Main-screen layer enables; 0x17 = default (all layers), 0x16 = Oglin cave variant',conf:'m'},
      {off:'0x05',val:rh.b5,         name:'room_subscreen_preset', wram:'7E0F81 → TS $212D',      desc:'Subscreen / color-math target layers; 0x00=outdoor, 0x11=interior, 0x01=cave/special',conf:'m'},
      {off:'0x06',val:rh.b6,         name:'room_effect_family',    wram:'7E0F82 → CGADSUB $2131', desc:'Color math add/sub select; high nibble 0x9_ selects rare effect family (darkness, arena)',conf:'m'},
      {off:'0x07',val:rh.b7,         name:'room_effect_enable',    wram:'7E0F83 → CGWSEL $2130',  desc:'Color window / math master enable; always 0x02 in all known maps',conf:'m'},
      {off:'0x08',val:rh.b8,         name:'room_effect_variant',   wram:'7E241F',              desc:'Per-room modifier within effect family: 0x00=default, 0x02=parallax/jungle, 0x01=Oglin, 0x04=arena, 0x05=volcano',conf:'l'},
      {off:'0x09–0x0A',val:rh.unknownWord,name:'unknown_word',wram:'7E0F84',              desc:'16-bit field; copied verbatim; purpose not yet decoded from traces',conf:'l'},
      {off:'0x0B',val:rh.b11,        name:'unknown_b11',           wram:'—',                  desc:'Skipped by loader (INY at 90904D); no observed destination write',conf:'l'},
      {off:'0x0C',val:rh.b12,        name:'unknown_b12',           wram:'—',                  desc:'Skipped by loader (INY at 90904E); step_len follows immediately after',conf:'l'},
    ];
    HMETA.forEach(function(row){
      var cc=row.conf==='h'?'rsh-conf-h':row.conf==='m'?'rsh-conf-m':'rsh-conf-l';
      var hexVal;
      if(row.off==='0x09–0x0A') hexVal='0x'+(row.val!=null?row.val.toString(16).toUpperCase().padStart(4,'0'):'????');
      else hexVal='0x'+(row.val!=null?row.val.toString(16).toUpperCase().padStart(2,'0'):'??');
      html+='<tr class="'+cc+'"><td>'+escH(row.off)+'</td><td>'+hexVal+'</td><td><code>'+escH(row.name)+'</code></td><td>'+escH(row.wram)+'</td><td>'+escH(row.desc)+'</td></tr>';
    });
    html+='</tbody></table>';
    // Derived geometry
    html+='<div class="rsh-section-lbl">Derived geometry</div>';
    html+='<div class="rsh-derived">';
    html+='Width:&nbsp;&nbsp;<b>'+rh.mapW+'</b> tiles = <b>'+rh.mapWpx+'</b>&thinsp;px &nbsp; horizontal scroll capacity: <b>'+rh.scrollW+'</b>&thinsp;px<br>';
    html+='Height: <b>'+rh.mapH+'</b> tiles = <b>'+rh.mapHpx+'</b>&thinsp;px &nbsp; vertical scroll capacity: <b>'+rh.scrollH+'</b>&thinsp;px';
    html+='</div>';
    // Render preset
    html+='<div class="rsh-section-lbl">Render preset (bytes 4–8 signature)</div>';
    var preClass=rh.renderPreset?'rsh-preset':'rsh-preset rsh-unknown';
    html+='<span class="'+preClass+'">'+(rh.renderPreset?escH(rh.renderPreset):'unknown')+'</span>';
    html+='<span class="rsh-sig">'+escH(rh.sig)+'</span>';
    // Trigger table layout
    if(rh.stepLen!=null){
      html+='<div class="rsh-section-lbl">Trigger table layout</div>';
      html+='<div class="rsh-trig-info">';
      html+='step_len = 0x'+rh.stepLen.toString(16).padStart(4,'0').toUpperCase()+' &#8594; '+rh.stepCount+' step-on entr'+(rh.stepCount===1?'y':'ies')+' (6 bytes each)<br>';
      if(rh.bLen!=null) html+='b_len&nbsp;&nbsp;&nbsp;&nbsp;= 0x'+rh.bLen.toString(16).padStart(4,'0').toUpperCase()+' &#8594; '+rh.bCount+' B-trigger entr'+(rh.bCount===1?'y':'ies')+' (6 bytes each)<br>';
      if(rh.payloadOffset!=null) html+='payload starts at blob offset 0x'+rh.payloadOffset.toString(16).padStart(4,'0').toUpperCase();
      html+='</div>';
    }
    // Payload tile-set list
    if(rh.payloadTileCount!=null){
      html+='<div class="rsh-section-lbl">Payload opcode 0: tile families ('+rh.payloadTileCount+')</div>';
      html+='<div class="rsh-tiles">';
      (rh.payloadTileIds||[]).forEach(function(id,i){
        html+='<span class="rsh-tile" title="family #'+i+'">0x'+id.toString(16).toUpperCase().padStart(2,'0')+'</span>';
      });
      html+='</div>';
      html+='<div class="rsh-payload-note">Count byte + each family as a 16-bit word. Shared art lives in the tile family (CHR/VRAM), not in the room blob. The compressed opcode stream that follows encodes tile placement by family reference, not raw bitmaps.</div>';
    }
    
    // Decoded payload section
    var payload = c.payloadData || null;
    var rr = (payload && payload.render) ? payload.render : null;
    var rrQualityRejected = !!(rr && rr.totalRefs && rr.unresolvedRatio > 0.98);
    if (rrQualityRejected) {
      console.log('[RoomsRender] renderRoomDetail: rejecting decoded render due to high unresolved ratio', {
        room: room && room.name,
        unresolvedTiles: rr.unresolvedTiles,
        totalRefs: rr.totalRefs,
        unresolvedRatio: rr.unresolvedRatio,
      });
    }
    if (payload) {
      html += '<div class="rsh-section-lbl">Decoded payload data</div>';
      
      // Position table info
      if (payload.positionTable && payload.positionTable.length > 0) {
        html += '<div style="font-size:0.85em;margin:0.5em 0;color:#999">Position table: ' + payload.positionTable.length + ' entries → ' + payload.positionTable.map(p => '0x' + p.toString(16)).join(', ') + '</div>';
      } else {
        html += '<div style="font-size:0.85em;margin:0.5em 0;color:#999">Position table: none (direct tilemap)</div>';
      }
      
      // Tilemap grid preview (first 10 rows, first 20 tiles per row)
      html += '<div style="font-family:monospace;font-size:0.75em;background:#111;padding:0.5em;border-radius:3px;overflow-x:auto;margin:0.5em 0">';
      html += '<div style="color:#999">Tilemap preview (first 10 rows, first 20 tiles per row):</div>';
      for (let row = 0; row < Math.min(10, payload.tilemap.length); row++) {
        const rowTiles = payload.tilemap[row].slice(0, 20);
        html += rowTiles.map(t => '<span style="color:' + (t === 0 ? '#333' : '#6f6') + '">' + t.toString(16) + '</span>').join('');
        html += '<br>';
      }
      html += '</div>';
      
      // Compressed section size
      html += '<div style="font-size:0.85em;color:#999">Compressed section: ' + payload.compressedSize + ' bytes (opaque bitstream, purpose unknown)</div>';

      // ROM-rendered room pass (current known decode path: family-index tilemap pass)
      if (rr && payload.tilemap && payload.tilemap.length && !rrQualityRejected) {
        var rrH = payload.tilemap.length;
        var rrW = (payload.tilemap[0] || []).length;
        var rrPxW = rrW * 16;
        var rrPxH = rrH * 16;
        var unresolvedPct = (rr.totalRefs || 0) ? Math.round((rr.unresolvedTiles || 0) * 1000 / (rr.totalRefs || 1)) / 10 : 0;
        html += '<div class="rsh-section-lbl">Rendered room graphic (ROM decode pass)</div>';
        html += '<div class="rr-wrap">';
        html += '<div class="rr-meta">canvas: <code>' + rrPxW + 'x' + rrPxH + '</code> px, families: <code>' + (payload.tileFamilies ? payload.tileFamilies.length : 0) + '</code>, unresolved tile refs: <code>' + (rr.unresolvedTiles || 0) + '</code> / <code>' + (rr.totalRefs || 0) + '</code> (' + unresolvedPct + '%)</div>';
        html += '<div class="rr-palette"><span>palette:</span><select id="rr-palette-sel">';
        (rr.palettes || []).forEach(function(p, i) {
          html += '<option value="' + i + '"' + (i === (rr.defaultPaletteIndex || 0) ? ' selected' : '') + '>' + escH(p.name) + '</option>';
        });
        html += '</select></div>';
        html += '<div class="rr-canvas-wrap"><canvas id="rr-canvas" class="rr-canvas" width="' + rrPxW + '" height="' + rrPxH + '"></canvas></div>';
        html += '<div class="rsh-payload-note">Render trace: read tile-family IDs from payload opcode 0 → decode each family tile using the SoETilesViewer map-tile codec (tile table 0xEE0000, tileInfo-driven compressed/uncompressed decode) → walk payload tilemap row-major and blit 16x16 tile pixels to canvas.</div>';
        html += '</div>';
      }
    }

    // Guaranteed visible fallback: if no decoded render data exists, still paint a white area
    // with ROM header width/height so users can verify sizing and panel visibility.
    if (!(payload && payload.render && payload.tilemap && payload.tilemap.length && !rrQualityRejected)) {
      var fbW = (rh.mapW || 0) * 16;
      var fbH = (rh.mapH || 0) * 16;
      if (fbW > 0 && fbH > 0) {
        html += '<div class="rsh-section-lbl">Rendered room graphic (header fallback)</div>';
        html += '<div class="rr-wrap">';
        html += '<div class="rr-meta">canvas: <code>' + fbW + 'x' + fbH + '</code> px (header-derived, fallback)</div>';
        html += '<div class="rr-canvas-wrap"><canvas id="rr-canvas-fallback" class="rr-canvas" width="' + fbW + '" height="' + fbH + '"></canvas></div>';
        if (rrQualityRejected) {
          html += '<div class="rsh-payload-note">Fallback trace: decoded tilemap quality is too low for display (unresolved refs ' + (rr.unresolvedTiles || 0) + '/' + (rr.totalRefs || 0) + ', ratio ' + Math.round((rr.unresolvedRatio || 0) * 1000) / 10 + '%). This usually means payload tile placement opcodes are not fully decoded yet for this map.</div>';
        } else {
          html += '<div class="rsh-payload-note">Fallback trace: no decoded payload render available for this map in current pass; canvas dimensions are still taken from ROM header bytes 0x02/0x03.</div>';
        }
        html += '</div>';
      }
    }
    html+='</div>'; // close rsh-body
    html+='</div>'; // close rs-romhdr
  }

  panel.innerHTML=html;
  bindLinks(panel);

  // ROM header toggle
  var rshToggle=panel.querySelector('#rsh-toggle');
  var rshBody=panel.querySelector('#rsh-body');
  if(rshToggle&&rshBody){
    rshToggle.addEventListener('click',function(){
      var col=rshBody.classList.toggle('rsh-collapsed');
      rshToggle.textContent='ROM Map Data '+(col?'▴':'▾');
    });
  }

  // Render full room graphic from decoded ROM payload data.
  function drawRomRoomCanvas(){
    try {
      var rr=(c.payloadData&&c.payloadData.render)||null;
      var tm=(c.payloadData&&c.payloadData.tilemap)||null;
      var cv=panel.querySelector('#rr-canvas');
      if(!rr||!tm||!cv||!tm.length||!rr.familyTiles||!rr.palettes){
        console.log('[RoomsRender] drawRomRoomCanvas: skipped', {room: room && room.name, hasRender: !!rr, hasTilemap: !!(tm&&tm.length), hasCanvas: !!cv});
        return;
      }
      var rhLocal=c.romHeader||null;
      var mapW = (rhLocal && rhLocal.mapW) ? (rhLocal.mapW|0) : (((tm[0]||[]).length)|0);
      var mapH = (rhLocal && rhLocal.mapH) ? (rhLocal.mapH|0) : (tm.length|0);
      if(mapW<=0||mapH<=0)return;
      var w=mapW*16,h=mapH*16;
      if(cv.width!==w)cv.width=w;
      if(cv.height!==h)cv.height=h;
      var sel=panel.querySelector('#rr-palette-sel');
      var pidx=sel?parseInt(sel.value||String(rr.defaultPaletteIndex||0),10):(rr.defaultPaletteIndex||0);
      if(isNaN(pidx)||pidx<0||pidx>=rr.palettes.length)pidx=0;
      var pal=(rr.palettes[pidx]&&rr.palettes[pidx].rgba)||[];
      var ctx=cv.getContext('2d');
      if(!ctx){
        console.log('[RoomsRender] drawRomRoomCanvas: no 2D context', {room: room && room.name});
        return;
      }

      // Keep pre-render state deterministic and visible in tests/logs.
      ctx.fillStyle='#ffffff';
      ctx.fillRect(0,0,w,h);

      var img=ctx.createImageData(w,h);
      var out=img.data;
      var invalidRefs=0;
      var drawnTiles=0;
      var fallbackSubstitutions=0;
      var usedRefs={};
      var fallbackTile = rr.familyTiles[0] || null;
      var fallbackRef = 0;
      for(var ty=0;ty<mapH;ty++){
        var row=tm[ty]||[];
        for(var tx=0;tx<mapW;tx++){
          var famIdx=(row[tx]==null)?fallbackRef:(row[tx]|0);
          var usedRef=famIdx;
          var tile=null;
          if(famIdx>=0&&famIdx<rr.familyTiles.length) tile=rr.familyTiles[famIdx];
          if(!tile){
            invalidRefs++;
            tile=fallbackTile;
            usedRef=fallbackRef;
            if(tile)fallbackSubstitutions++;
          }
          if(!tile) continue;
          drawnTiles++;
          usedRefs[usedRef]=1;
          for(var py=0;py<16;py++){
            var srcBase=py*16;
            var dstBase=((ty*16+py)*w + tx*16)*4;
            for(var px=0;px<16;px++){
              var ci=tile[srcBase+px]|0;
              var col=pal[ci]||pal[0]||[0,0,0,255];
              var di=dstBase+px*4;
              out[di]=col[0]|0;
              out[di+1]=col[1]|0;
              out[di+2]=col[2]|0;
              out[di+3]=col[3]==null?255:(col[3]|0);
            }
          }
        }
      }
      ctx.putImageData(img,0,0);
      var tileRefs=mapW*mapH;
      console.log('[RoomsRender] drawRomRoomCanvas: done', {
        room: room && room.name,
        width: w,
        height: h,
        palette: pidx,
        drawnTiles: drawnTiles,
        invalidRefs: invalidRefs,
        fallbackSubstitutions: fallbackSubstitutions,
        tileRefs: tileRefs,
        renderCommandsEstimate: tileRefs,
        uniqueRefsCount: Object.keys(usedRefs).length,
        families: rr.familyTiles.length,
      });
    } catch (e) {
      console.log('[RoomsRender] drawRomRoomCanvas: exception', {room: room && room.name, error: String(e)});
    }
  }

  function drawHeaderFallbackCanvas(){
    var cv=panel.querySelector('#rr-canvas-fallback');
    if(!cv)return;
    var ctx=cv.getContext&&cv.getContext('2d');
    if(!ctx){
      console.log('[RoomsRender] drawHeaderFallbackCanvas: no 2D context', {room: room && room.name});
      return;
    }
    ctx.fillStyle='#ffffff';
    ctx.fillRect(0,0,cv.width,cv.height);
    ctx.strokeStyle='rgba(0,0,0,0.2)';
    ctx.strokeRect(0.5,0.5,Math.max(0,cv.width-1),Math.max(0,cv.height-1));
    console.log('[RoomsRender] drawHeaderFallbackCanvas: done', {room: room && room.name, width: cv.width, height: cv.height});
  }
  var rrSel=panel.querySelector('#rr-palette-sel');
  if(rrSel)rrSel.addEventListener('change',drawRomRoomCanvas);
  drawRomRoomCanvas();
  drawHeaderFallbackCanvas();

  var svg=document.getElementById('rg-svg');
  var wrap=document.getElementById('rg-wrap');
  var canvas=document.getElementById('rg-canvas');
  var img=document.getElementById('rg-img');
  var locked=false;
  var panX=0,panY=0;
  function applyPan(px,py){
    panX=px;panY=py;
    if(canvas)canvas.style.transform='translate('+panX+'px,'+panY+'px)';
  }

  // Zoom controls
  var zinBtn=document.getElementById('rg-zin');
  var zoutBtn=document.getElementById('rg-zout');
  var zfitBtn=document.getElementById('rg-zfit');
  function applyZoom(s){
    if(!svg||!canvas)return;
    var pxW=Math.round(W*s),pxH=Math.round(H*s);
    canvas.style.width=pxW+'px';
    canvas.style.height=pxH+'px';
    svg.setAttribute('width',pxW);
    svg.setAttribute('height',pxH);
    var wW=wrap?wrap.clientWidth:dispW,wH=wrap?wrap.clientHeight:dispH;
    panX=pxW<=wW?0:Math.min(0,Math.max(wW-pxW,panX));
    panY=pxH<=wH?0:Math.min(0,Math.max(wH-pxH,panY));
    applyPan(panX,panY);
  }
  if(zinBtn)zinBtn.addEventListener('click',function(){
    var cur=zoomState.scale||getScale(0);
    zoomState.scale=Math.min(cur*1.4,60);
    applyZoom(zoomState.scale);
  });
  if(zoutBtn)zoutBtn.addEventListener('click',function(){
    var cur=zoomState.scale||getScale(0);
    zoomState.scale=Math.max(cur/1.4,1);
    applyZoom(zoomState.scale);
  });
  if(zfitBtn)zfitBtn.addEventListener('click',function(){
    zoomState.scale=0;panX=0;panY=0;
    applyZoom(getScale(0));
  });
  // Apply initial auto-fit
  if(svg&&canvas) applyZoom(getScale(0));

  // ── Interaction: pan / shift-box-select / entity drag / click-select ──
  var selRect=svg?svg.querySelector('#rg-sel'):null;
  var selActive=false,selSx=0,selSy=0;
  var panActive=false,panCX=0,panCY=0,panBX=0,panBY=0;
  var dragEnt=null; // {kind,idx,line,origX,origY,ghostEl,curX,curY}
  function svgPt(e){
    if(!svg)return{x:0,y:0};
    var pt=svg.createSVGPoint();
    pt.x=e.clientX;pt.y=e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }
  function applyBoxFilter(sx,sy,ex,ey){
    var rx1=Math.min(sx,ex),rx2=Math.max(sx,ex),ry1=Math.min(sy,ey),ry2=Math.max(sy,ey);
    if(rx2-rx1<1&&ry2-ry1<1){clearBoxFilter();return;}
    panel.querySelectorAll('tr[data-kind][data-idx]').forEach(function(row){
      var kind=row.dataset.kind,idx=parseInt(row.dataset.idx);
      var ok=false;
      if(kind==='entrance'){var en=entrances[idx];if(en)ok=(en.x>=rx1&&en.x<=rx2&&en.y>=ry1&&en.y<=ry2);}
      else if(kind==='step'){var t=stepOn[idx];if(t){var sv=tsvg(t);ok=(sv.sx+sv.sw>=rx1&&sv.sx<=rx2&&sv.sy+sv.sh>=ry1&&sv.sy<=ry2);}}
      else if(kind==='btrig'){var t=bTrigger[idx];if(t){var sv=tsvg(t);ok=(sv.sx+sv.sw>=rx1&&sv.sx<=rx2&&sv.sy+sv.sh>=ry1&&sv.sy<=ry2);}}
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
  }
  function selectAt(tx,ty){
    clearSelection();
    function hi(kind,i){if(svg)svg.querySelectorAll('[data-kind="'+kind+'"][data-idx="'+i+'"]').forEach(function(el){el.classList.add('svge-sel');});panel.querySelectorAll('tr[data-kind="'+kind+'"][data-idx="'+i+'"]').forEach(function(r){r.classList.add('sel-row');r.scrollIntoView({block:'nearest'});});}
    stepOn.forEach(function(t,i){var sv=tsvg(t);if(tx>=sv.sx&&tx<sv.sx+sv.sw&&ty>=sv.sy&&ty<sv.sy+sv.sh)hi('step',i);});
    bTrigger.forEach(function(t,i){var sv=tsvg(t);if(tx>=sv.sx&&tx<sv.sx+sv.sw&&ty>=sv.sy&&ty<sv.sy+sv.sh)hi('btrig',i);});
    entrances.forEach(function(en,i){if(tx>=en.x&&tx<en.x+1&&ty>=en.y&&ty<en.y+1)hi('entrance',i);});
    enemies.forEach(function(en,i){if(tx>=en.x&&tx<en.x+1&&ty>=en.y&&ty<en.y+1)hi('enemy',i);});
  }
  if(svg){
    // Entity drag: mousedown on moveable element (entrance/enemy)
    svg.querySelectorAll('.svge-mv').forEach(function(el){
      el.addEventListener('mousedown',function(e){
        if(e.button!==0||locked)return;
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
        dragEnt={kind:kind,idx:idx,line:line,origX:ox,origY:oy,ghostEl:ghost,curX:ox,curY:oy};
        e.preventDefault();
      });
    });
    svg.addEventListener('mousedown',function(e){
      if(e.button!==0||dragEnt)return;
      if(e.metaKey||e.ctrlKey)return;
      var p=svgPt(e);
      if(e.shiftKey){
        selSx=p.x;selSy=p.y;selActive=true;
        if(selRect)selRect.setAttribute('display','');
      } else {
        panActive=true;panCX=e.clientX;panCY=e.clientY;panBX=panX;panBY=panY;
        if(wrap)wrap.classList.add('rg-panning');
      }
      e.preventDefault();
    });
    svg.addEventListener('mousemove',function(e){
      if(dragEnt){
        var p=svgPt(e);var tx=Math.floor(p.x),ty=Math.floor(p.y);
        dragEnt.curX=tx;dragEnt.curY=ty;
        dragEnt.ghostEl.setAttribute('x',tx);dragEnt.ghostEl.setAttribute('y',ty);
        return;
      }
      if(selActive){
        var p=svgPt(e);
        var rx=Math.min(selSx,p.x),ry=Math.min(selSy,p.y),rw=Math.abs(p.x-selSx),rh=Math.abs(p.y-selSy);
        if(selRect){selRect.setAttribute('x',rx);selRect.setAttribute('y',ry);selRect.setAttribute('width',rw);selRect.setAttribute('height',rh);}
        return;
      }
      if(panActive){
        var s=zoomState.scale||getScale(0);
        var pxW=Math.round(W*s),pxH=Math.round(H*s);
        var wW=wrap?wrap.clientWidth:dispW,wH=wrap?wrap.clientHeight:dispH;
        var nx=pxW<=wW?0:Math.min(0,Math.max(wW-pxW,panBX+(e.clientX-panCX)));
        var ny=pxH<=wH?0:Math.min(0,Math.max(wH-pxH,panBY+(e.clientY-panCY)));
        applyPan(nx,ny);
      }
    });
    svg.addEventListener('mouseup',function(e){
      if(dragEnt){
        var moved=(dragEnt.curX!==dragEnt.origX||dragEnt.curY!==dragEnt.origY);
        if(moved&&vs)vs.postMessage({command:'moveEntity',kind:dragEnt.kind,line:dragEnt.line,newX:dragEnt.curX,newY:dragEnt.curY});
        if(dragEnt.ghostEl&&dragEnt.ghostEl.parentNode)dragEnt.ghostEl.parentNode.removeChild(dragEnt.ghostEl);
        dragEnt=null;return;
      }
      if(selActive){selActive=false;var p=svgPt(e);applyBoxFilter(selSx,selSy,p.x,p.y);return;}
      if(panActive){panActive=false;if(wrap)wrap.classList.remove('rg-panning');}
    });
    svg.addEventListener('mouseleave',function(){
      if(panActive){panActive=false;if(wrap)wrap.classList.remove('rg-panning');}
      if(dragEnt){if(dragEnt.ghostEl&&dragEnt.ghostEl.parentNode)dragEnt.ghostEl.parentNode.removeChild(dragEnt.ghostEl);dragEnt=null;}
    });
    // Click: select element + highlight all overlapping triggers
    svg.addEventListener('click',function(e){
      if(e.shiftKey||dragEnt)return;
      var p=svgPt(e);selectAt(Math.floor(p.x),Math.floor(p.y));
    });
    svg.addEventListener('dblclick',function(){clearBoxFilter();clearSelection();});
  }

  // Hover status bar: show name of hovered SVG element
  var tipDiv=document.getElementById('rg-tip');
  if(svg&&tipDiv){
    svg.querySelectorAll('[data-kind][data-idx]').forEach(function(el){
      el.addEventListener('mouseenter',function(){tipDiv.textContent=el.dataset.label||'';});
      el.addEventListener('mouseleave',function(){tipDiv.textContent='';});
    });
  }

  // Bidirectional hover highlight: SVG ↔ table rows
  function setHi(kind,idx,on){
    // SVG elements
    if(svg){
      svg.querySelectorAll('[data-kind="'+kind+'"][data-idx="'+idx+'"]').forEach(function(el){
        el.classList.toggle('hi',on);
      });
    }
    // Table rows
    panel.querySelectorAll('tr[data-kind="'+kind+'"][data-idx="'+idx+'"]').forEach(function(row){
      row.classList.toggle('hi-row',on);
    });
  }
  // SVG elements → highlight table
  if(svg){
    svg.querySelectorAll('[data-kind][data-idx]').forEach(function(el){
      el.addEventListener('mouseenter',function(){setHi(el.dataset.kind,el.dataset.idx,true);});
      el.addEventListener('mouseleave',function(){setHi(el.dataset.kind,el.dataset.idx,false);});
    });
  }
  // Table rows → highlight SVG
  panel.querySelectorAll('tr[data-kind][data-idx]').forEach(function(row){
    row.addEventListener('mouseenter',function(){setHi(row.dataset.kind,row.dataset.idx,true);});
    row.addEventListener('mouseleave',function(){setHi(row.dataset.kind,row.dataset.idx,false);});
  });

  // Cmd/Ctrl+click on SVG code-linked elements
  if(svg){
    svg.querySelectorAll('.sv-ll').forEach(function(el){
      el.style.cursor='pointer';
      el.addEventListener('click',function(e){
        if(e.metaKey||e.ctrlKey){e.stopPropagation();goToLine(parseInt(el.dataset.line));}
      });
    });
  }
  // Entity filter buttons (only those with data-hide attribute)
  panel.querySelectorAll('.rdf[data-hide]').forEach(function(btn){
    btn.addEventListener('click',function(){
      btn.classList.toggle('on');
      panel.classList.toggle(btn.dataset.hide,!btn.classList.contains('on'));
    });
  });
  // Lock toggle
  var lockBtn=document.getElementById('rg-lock-btn');
  if(lockBtn){
    lockBtn.classList.add('on');
    lockBtn.addEventListener('click',function(){
      locked=!locked;
      lockBtn.textContent=locked?'🔒':'🔓';
      lockBtn.classList.toggle('on',!locked);
      lockBtn.title=locked?'Unlock map':'Lock map (prevent element dragging)';
      if(svg)svg.querySelectorAll('.svge-mv').forEach(function(el){el.style.cursor=locked?'default':'grab';});
    });
  }
  // Assign image button (rooms without images)
  var pickBtn=document.getElementById('rg-pick-btn');
  if(pickBtn){
    pickBtn.addEventListener('click',function(){
      if(vs)vs.postMessage({command:'pickRoomImage',mapName:pickBtn.dataset.map});
    });
  }
}
