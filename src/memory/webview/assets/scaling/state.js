// Ownership: inner IIFE opener, state variable declarations, DOM refs, character select initialization.
// Must be FIRST in SCALING_JS_FILES (after alchemy-math.js which is in outer scope).
(function(){
  if(!SC_CHARS.length){
    var ce=document.getElementById('sc-chart');
    if(ce)ce.innerHTML='<div style="padding:16px;opacity:.4;font-size:11px">ROM not found — place the .smc in workspace root.</div>';
    return;
  }
  var srcId=0,srcLv=0,charge=100;
  var attackMode='physical';
  var selWid=null;
  var crosshairLv=null;
  var scaleEnemies=false,atlasMode=false;
  var alSpellLevel=0,alTargetLevel=1;

  var srcSel=document.getElementById('sc-src-sel');
  var tgtSel=document.getElementById('sc-tgt-sel');
  var modeSel=document.getElementById('sc-mode-sel');
  SC_CHARS.forEach(function(c){
    var scalable=SC_SCALABLE.hasOwnProperty(c.id);
    var label='#'+String(c.id).padStart(3,'0')+' '+c.name+(scalable?' ★':'');
    [srcSel,tgtSel].forEach(function(sel){
      var o=document.createElement('option');o.value=c.id;o.textContent=label;sel.appendChild(o);
    });
  });
  srcSel.value=0;
  tgtSel.value=SC_CHARS.some(function(c){return c.id===109;})?109:0;
  if(modeSel)modeSel.value=attackMode;

  ['sc-src-lv','sc-tgt-lv'].forEach(function(id){
    var sel=document.getElementById(id);
    for(var lv=1;lv<=SC_MAX_LEVEL;lv++){var o=document.createElement('option');o.value=lv;o.textContent='L'+lv;sel.appendChild(o);}
  });
