// Ownership: script table and entity section HTML builders for the Rooms tab.
// Pure HTML string factories. Uses globals from utils.js: escH, hexNum, normScriptAddr.

function renderScriptTable(script){
  if(!script||!script.instructions||!script.instructions.length)return '<div class="rs-note">No decoded script data.</div>';
  var out='<table class="rs-tbl"><thead><tr><th>Addr</th><th>Op</th><th>Size</th><th>Bytes</th><th>Summary</th></tr></thead><tbody>';
  script.instructions.forEach(function(row){
    var rowClasses=[];
    if(row.terminal)rowClasses.push('rs-term');
    if(row.summary&&row.summary.indexOf('UNKNOWN')===0)rowClasses.push('rs-err');
    out+='<tr'+(rowClasses.length?' class="'+rowClasses.join(' ')+'"':'')+' data-script-addr="'+normScriptAddr(hexNum(row.addressSnes,6))+'"><td>'+hexNum(row.addressSnes,6)+'</td><td>'+escH(row.opcodeHex||'')+'</td><td>'+escH(String(row.size||0))+'</td><td>'+escH(row.bytesHex||'')+'</td><td>'+(row.summary?escH(row.summary):'&ndash;')+'</td></tr>';
  });
  out+='</tbody></table>';
  if(!script.terminated)out+='<div class="rs-note rs-err">Stopped: '+escH(script.stopReason||'unknown')+'</div>';
  return out;
}

function renderScriptCard(title,meta,script,kind,idx){
  var cls=['rs-script'];
  if(kind)cls.push('rs-script-'+kind);
  if(script&&!script.terminated)cls.push('rs-script-error');
  var attrs='';
  if(kind)attrs+=' data-kind="'+escH(kind)+'"';
  if(idx!=null)attrs+=' data-idx="'+escH(String(idx))+'"';
  var out='<div class="'+cls.join(' ')+'"'+attrs+'><div class="rs-h">'+escH(title)+'</div>';
  if(meta)out+='<div class="rs-note">'+meta+'</div>';
  out+=renderScriptTable(script);
  out+='</div>';
  return out;
}

/**
 * Build entity tables section HTML (entrances, enemies, objects, transitions,
 * step-on triggers, B-triggers).
 */
function buildEntityTablesHtml(c,trigOff){
  var entrances=c.entrances||[];
  var enemies=c.enemies||[];
  var objs=c.objects||[];
  var trans=c.transitions||[];
  var trig=c.triggers||{enter:null,stepOn:[],bTrigger:[],meta:null};
  var stepOn=trig.stepOn||[];
  var bTrigger=trig.bTrigger||[];
  var trigNames=c.triggerNames||{stepOn:[],bTrigger:[]};
  var stepOnNames=trigNames.stepOn||[];
  var bTrigNames=trigNames.bTrigger||[];
  var html='';

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
  return html;
}

/**
 * Build ROM scripts section HTML (enter script + step-on/B-trigger decoded tables).
 */
function buildRomScriptsHtml(c,trigOff){
  var trig=c.triggers||{enter:null,stepOn:[],bTrigger:[],meta:null};
  var enterTrig=trig.enter||null;
  var stepOn=trig.stepOn||[];
  var bTrigger=trig.bTrigger||[];
  var trigMeta=trig.meta||null;
  var trigNames=c.triggerNames||{stepOn:[],bTrigger:[]};
  var stepOnNames=trigNames.stepOn||[];
  var bTrigNames=trigNames.bTrigger||[];
  if(!enterTrig&&!stepOn.length&&!bTrigger.length)return '';
  var html='<div class="rs rs-scripts"><div class="rs-h">ROM scripts</div>';
  if(trigMeta){
    html+='<table class="rs-tbl"><thead><tr><th>Enter ptr</th><th>Step len</th><th>Step count</th><th>B len</th><th>B count</th></tr></thead><tbody>';
    html+='<tr><td>'+hexNum(trigMeta.enterPointerSnes,6)+'</td><td>'+hexNum(trigMeta.stepLength,4)+'</td><td>'+escH(String(trigMeta.stepCount||0))+'</td><td>'+hexNum(trigMeta.bLength,4)+'</td><td>'+escH(String(trigMeta.bCount||0))+'</td></tr>';
    html+='</tbody></table>';
  }
  if(enterTrig){
    html+=renderScriptCard('Enter script',
      'ptr '+hexNum(enterTrig.scriptPointerSnes,6)+'  addr '+hexNum(enterTrig.scriptAddressSnes,6),
      enterTrig,'enter',0);
  }
  stepOn.forEach(function(t,i){
    var nm=stepOnNames[i]||('#'+i);
    var meta='coords ['+t.x1+','+t.y1+':'+t.x2+','+t.y2+']';
    if(typeof t.scriptId==='number')meta+='  scriptId '+hexNum(t.scriptId,4);
    meta+='  addr '+hexNum(t.scriptAddressSnes,6);
    html+=renderScriptCard('Step-on '+nm,meta,t,'step',i);
  });
  bTrigger.forEach(function(t,i){
    var nm=bTrigNames[i]||('#'+i);
    var meta='coords ['+t.x1+','+t.y1+':'+t.x2+','+t.y2+']';
    if(typeof t.scriptId==='number')meta+='  scriptId '+hexNum(t.scriptId,4);
    meta+='  addr '+hexNum(t.scriptAddressSnes,6);
    html+=renderScriptCard('B-trigger '+nm,meta,t,'btrig',i);
  });
  html+='</div>';
  return html;
}
