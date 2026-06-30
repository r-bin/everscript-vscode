(function(){
var vs=typeof acquireVsCodeApi==='function'?acquireVsCodeApi():null;
__JS_DATA__
var hidden=new Set(['rest']);
var hideBoring=false,hideAlloc=false,emojiMode=false,groupMode=false;
var BTN_LC={ft:'temp',fs:'session',fr2:'sram',fy:'system',frest:'rest'};
var BTN_BODY={ft:'ht',fs:'hs',fr2:'hr2',fy:'hsy'};
document.body.classList.add('hrest');
var COLS=16;

function recomputeRows(){
  document.querySelectorAll('.gr').forEach(function(row){
    var isGar=row.classList.contains('gar');
    if(isGar){row.classList.toggle('hrow',hidden.has('rest'));return;}
    var lcs=(row.dataset.lcs||'').split(' ').filter(Boolean);
    var allHidden=lcs.length>0&&lcs.every(function(lc){return hidden.has(lc);});
    var isUsed=row.dataset.used==='1';
    var hasDoc=row.dataset.hasdoc==='1';
    row.classList.toggle('hrow',allHidden||(hideBoring&&!isUsed)||(hideAlloc&&!hasDoc));
  });
  document.querySelectorAll('tr.dr').forEach(function(row){
    var hasDoc=row.dataset.hasdoc==='1';
    row.classList.toggle('hrow',hideAlloc&&!hasDoc);
  });
}

document.querySelectorAll('.fb[data-cls]').forEach(function(b){
  var k=b.dataset.cls;
  if(!BTN_LC[k])return;
  b.addEventListener('click',function(){
    b.classList.toggle('on');
    var on=b.classList.contains('on');
    var lc=BTN_LC[k];
    if(on)hidden.delete(lc);else hidden.add(lc);
    if(BTN_BODY[k])document.body.classList.toggle(BTN_BODY[k],!on);
    recomputeRows();
  });
});

var restBtn=document.querySelector('.fb.frest');
if(restBtn)restBtn.addEventListener('click',function(){
  restBtn.classList.toggle('on');
  var on=restBtn.classList.contains('on');
  if(on)hidden.delete('rest');else hidden.add('rest');
  recomputeRows();
});

var boringBtn=document.getElementById('btn-boring');
if(boringBtn)boringBtn.addEventListener('click',function(){
  hideBoring=!hideBoring;
  boringBtn.classList.toggle('on',hideBoring);
  recomputeRows();
});

var allocBtn=document.getElementById('btn-alloc');
if(allocBtn)allocBtn.addEventListener('click',function(){
  hideAlloc=!hideAlloc;
  allocBtn.classList.toggle('on',hideAlloc);
  recomputeRows();
});

var emojiBtn=document.getElementById('btn-emoji');
if(emojiBtn)emojiBtn.addEventListener('click',function(){
  emojiMode=!emojiMode;
  emojiBtn.classList.toggle('on',emojiMode);
  document.body.classList.toggle('emoji',emojiMode);
});

var pinBtn=document.getElementById('btn-pin');
if(pinBtn)pinBtn.addEventListener('click',function(){
  var pinned=pinBtn.classList.toggle('on');
  if(vs)vs.postMessage({command:pinned?'pin':'unpin'});
});

var globalBtn=document.getElementById('btn-global');
if(globalBtn)globalBtn.addEventListener('click',function(){
  var on=globalBtn.classList.toggle('on');
  if(vs)vs.postMessage({command:on?'globalScope':'autoScope'});
});

var hideUnusedArgs=true;
document.body.classList.add('hideargs');
var hideArgsBtn=document.getElementById('btn-hideargs');
if(hideArgsBtn)hideArgsBtn.addEventListener('click',function(){
  hideUnusedArgs=!hideUnusedArgs;
  hideArgsBtn.classList.toggle('on',hideUnusedArgs);
  document.body.classList.toggle('hideargs',hideUnusedArgs);
});

// Group coloring toggle (default off)
var gPal=['#5599ff','#ff8833','#33cc77','#ff44bb','#ccff33','#33bbff','#ff9944','#9933ff','#ff3344','#33ffcc'];
var gColMap={},gIdx=0;
document.querySelectorAll('.cell[data-gid]').forEach(function(c){
  var gid=c.dataset.gid;
  if(gColMap[gid]===undefined)gColMap[gid]=gPal[gIdx++%gPal.length];
});
function applyGroupColors(){
  document.querySelectorAll('.cell[data-gid]').forEach(function(c){
    c.style.borderBottom=groupMode?'2px solid '+gColMap[c.dataset.gid]:'';
  });
}
var groupBtn=document.getElementById('btn-group');
if(groupBtn)groupBtn.addEventListener('click',function(){
  groupMode=!groupMode;
  groupBtn.classList.toggle('on',groupMode);
  applyGroupColors();
});

// Group join: collapse gap between adjacent cells in the same group
document.querySelectorAll('.cell[data-gid]').forEach(function(c){
  var addr=parseInt(c.dataset.addr);
  var gid=c.dataset.gid;
  var nextEl=document.querySelector('.cell[data-addr="'+(addr+1)+'"]');
  var prevEl=document.querySelector('.cell[data-addr="'+(addr-1)+'"]');
  if(nextEl&&nextEl.dataset.gid===gid)c.classList.add('grj-r');
  if(prevEl&&prevEl.dataset.gid===gid)c.classList.add('grj-l');
});

function goToLine(l){if(l<0||isNaN(l))return;if(vs)vs.postMessage({command:'goToLine',line:l});}
function bindLinks(root){
  if(!root)return;
  root.querySelectorAll('a.ll').forEach(function(a){
    a.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();var l=parseInt(a.dataset.line);if(l>=0&&!isNaN(l))goToLine(l);});
  });
}

// Polygon outline: per-cell edge box-shadows so selection looks like one outline
function applyPolygonOutline(cursored){
  var cc='rgba(255,255,255,0.88)';
  cursored.forEach(function(addr){
    var el=document.querySelector('.cell[data-addr="'+addr+'"]');
    if(!el)return;
    var col=addr&(COLS-1);
    var shadows=[];
    if(el.classList.contains('crw'))shadows.push('inset 0 0 0 1px rgba(242,204,96,0.35)');
    else if(el.classList.contains('cw'))shadows.push('inset 0 0 0 1px rgba(255,123,114,0.35)');
    if(col===0||!cursored.has(addr-1))      shadows.push('inset 2px 0 0 0 '+cc);
    if(col===COLS-1||!cursored.has(addr+1)) shadows.push('inset -2px 0 0 0 '+cc);
    if(!cursored.has(addr-COLS))            shadows.push('inset 0 2px 0 0 '+cc);
    if(!cursored.has(addr+COLS))            shadows.push('inset 0 -2px 0 0 '+cc);
    el.style.boxShadow=shadows.join(',');
    el.style.zIndex='3';
  });
}

function setCursorRange(start,end){
  document.querySelectorAll('.cursor').forEach(function(x){
    x.classList.remove('cursor');x.style.boxShadow='';x.style.zIndex='';
  });
  var cursored=new Set();
  for(var a=start;a<=end;a++){
    var c=document.querySelector('.cell[data-addr="'+a+'"]');
    if(c){c.classList.add('cursor');cursored.add(a);}
  }
  applyPolygonOutline(cursored);
  var first=document.querySelector('.cell[data-addr="'+start+'"]');
  if(first){
    var lp=document.querySelector('.left-panel');
    var ph=lp?lp.querySelector('.ph'):null;
    var phH=ph?ph.getBoundingClientRect().height:0;
    var lpRect=lp?lp.getBoundingClientRect():{top:0,bottom:9999,height:9999};
    var elRect=first.getBoundingClientRect();
    var t=elRect.top-lpRect.top-phH;
    if(t<0){lp.scrollTop+=t-4;}
    else if(elRect.bottom>lpRect.bottom){lp.scrollTop+=elRect.bottom-lpRect.bottom+4;}
  }
}

function setCursor(addr){
  var d=CELLS[addr];
  setCursorRange(d?d.addrStart:addr,d?d.addrEnd:addr);
}

function selectDetailRow(addr){
  document.querySelectorAll('tr.sel').forEach(function(r){r.classList.remove('sel');});
  // Find the row whose entry range covers addr with the highest entry-start (most specific)
  var best=null,bestEs=-1;
  document.querySelectorAll('tr.dr').forEach(function(row){
    var es=parseInt(row.dataset.es),ee=parseInt(row.dataset.ee);
    if(!isNaN(es)&&!isNaN(ee)&&es<=addr&&addr<=ee&&es>bestEs){bestEs=es;best=row;}
  });
  if(!best)best=document.getElementById('dr-'+addr);
  if(!best)return;
  var entryStart=parseInt(best.dataset.es||best.dataset.addr);
  document.querySelectorAll('tr.dr[data-es="'+entryStart+'"]').forEach(function(r){r.classList.add('sel');});
  var firstRow=document.getElementById('dr-'+entryStart)||best;
  var panel=document.querySelector('.right-panel');
  if(!panel)return;
  var thead=panel.querySelector('thead');
  var headerH=thead?thead.getBoundingClientRect().height:0;
  var panelRect=panel.getBoundingClientRect();
  var rowRect=firstRow.getBoundingClientRect();
  var availH=panelRect.height-headerH;
  var targetTop=rowRect.top-panelRect.top-headerH;
  if(targetTop<0){
    panel.scrollTop+=targetTop-4;
  }else if(rowRect.bottom>panelRect.bottom){
    if(rowRect.height<=availH){panel.scrollTop+=rowRect.bottom-panelRect.bottom+4;}
    else{panel.scrollTop+=targetTop-4;}
  }
}

// Grid cell: click → cursor + scroll right; hover → highlight group
document.querySelectorAll('.cell').forEach(function(c){
  var addr=parseInt(c.dataset.addr);
  c.addEventListener('click',function(){
    setCursor(addr);
    selectDetailRow(addr);
  });
  c.addEventListener('mouseover',function(){
    var d=CELLS[addr];
    if(!d||d.addrStart===undefined)return;
    var start=d.addrStart,end=d.addrEnd;
    if(start===end)return;
    for(var a=start;a<=end;a++){
      if(a===addr)continue;
      var nb=document.querySelector('.cell[data-addr="'+a+'"]');
      if(nb)nb.classList.add('chi');
    }
  });
  c.addEventListener('mouseout',function(){
    document.querySelectorAll('.chi').forEach(function(x){x.classList.remove('chi');});
  });
});

// Detail row: click → cursor + scroll left
document.querySelectorAll('tr.dr').forEach(function(row){
  row.addEventListener('click',function(e){
    if(e.target.classList.contains('ll'))return;
    var es=parseInt(row.dataset.es||row.dataset.addr);
    var ee=parseInt(row.dataset.ee||row.dataset.addr);
    setCursorRange(es,ee);
    // Scroll the detail panel to THIS row (for bit-field sub-rows)
    var partIdx=row.dataset.part?parseInt(row.dataset.part):-1;
    if(partIdx>=0){
      document.querySelectorAll('tr.sel').forEach(function(r){r.classList.remove('sel');});
      row.classList.add('sel');
      var panel=document.querySelector('.right-panel');
      if(panel){
        var thead=panel.querySelector('thead');
        var headerH=thead?thead.getBoundingClientRect().height:0;
        var panelRect=panel.getBoundingClientRect();
        var rowRect=row.getBoundingClientRect();
        var availH=panelRect.height-headerH;
        var targetTop=rowRect.top-panelRect.top-headerH;
        if(targetTop<0){panel.scrollTop+=targetTop-4;}
        else if(rowRect.bottom>panelRect.bottom){
          if(rowRect.height<=availH){panel.scrollTop+=rowRect.bottom-panelRect.bottom+4;}
          else{panel.scrollTop+=targetTop-4;}
        }
      }
    }else{
      selectDetailRow(es);
    }
  });
});

bindLinks(document.querySelector('.dt-wrap'));
recomputeRows();
__ROOMS_DATA__
__SCALING_DATA__
__ROOMS_JS__
__SCALING_JS__
__DOCS_JS__
__ROUTE_JS__
__RNG_JS__
// Init active tab and selected map highlight
(function(){
  var t=ACTIVE_TAB||'radar';
  document.querySelectorAll('.tab').forEach(function(b){b.classList.remove('tab-active');});
  var at=document.querySelector('.tab[data-tab="'+t+'"]');
  if(at)at.classList.add('tab-active');
  document.querySelectorAll('.tab-pane').forEach(function(p){
    p.style.display=p.dataset.tab===t?'flex':'none';
  });
  if(SELECTED_MAP){
    var li=document.querySelector('.rn-map[data-map="'+SELECTED_MAP+'"]');
    if(li){
      li.classList.add('rsel');
      var room=ROOMS[SELECTED_MAP];
      if(room)renderRoomDetail(room);
    }
  }
})();
})();