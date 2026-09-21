// Ownership: script table and entity section HTML builders for the Rooms tab.
// Pure HTML string factories. Uses globals from utils.js: escH, hexNum, normScriptAddr.

function renderScriptTable(script){
  if(!script||!script.instructions||!script.instructions.length)return '<div class="rs-note">No decoded script data.</div>';
  var out='<table class="rs-tbl"><thead><tr><th>Addr</th><th>Op</th><th>Size</th><th>Bytes</th><th>Summary</th></tr></thead><tbody>';
  script.instructions.forEach(function(row){
    var rowClasses=[];
    if(row.terminal)rowClasses.push('rs-term');
    // unsupported: nothing knows this opcode's length, so the walk ends here.
    // untraced: the length is known but the description is the reference's
    // working guess, not something anyone traced. Worth distinguishing — a
    // reader should not trust the two equally.
    if(row.unsupported)rowClasses.push('rs-err');
    else if(row.untraced)rowClasses.push('rs-guess');
    out+='<tr'+(rowClasses.length?' class="'+rowClasses.join(' ')+'"':'')+' data-script-addr="'+normScriptAddr(hexNum(row.addressSnes,6))+'"><td>'+hexNum(row.addressSnes,6)+'</td><td>'+escH(row.opcodeHex||'')+'</td><td>'+escH(String(row.size||0))+'</td><td>'+escH(row.bytesHex||'')+'</td><td>'+(row.summary?escH(row.summary):'&ndash;')+'</td></tr>';
  });
  out+='</tbody></table>';
  if(!script.terminated)out+='<div class="rs-note rs-err">Stopped: '+escH(script.stopReason||'unknown')+'</div>';
  if(script.instructions.some(function(r){return r.untraced;}))
    out+='<div class="rs-note rs-note-dim">Dimmed rows are untraced: the length is known, the description is a guess.</div>';
  return out;
}

/**
 * What a script hands over, when it is a pickup.
 *
 * Shown above the instruction table because it is the answer most readers
 * want — `MUSHROOM x1` beats twelve rows of WRITE. The Everscript form next
 * to it is the same pickup written in the language that compiles back to
 * these bytes, so it can be copied straight into a patch.
 *
 * A script can list several: a few rooms share one script between rectangles
 * and pick the reward at runtime from a room variable. Those are candidates,
 * not a sequence, and the note says so rather than implying you get all of
 * them.
 */
function renderLoot(script){
  var loot=(script&&script.loot)||[];
  if(!loot.length)return '';
  var code=script.everscript||[];
  var out='<div class="rs-loot">';
  loot.forEach(function(f,i){
    var bits=[];
    if(f.objectId!=null)bits.push('object '+hexNum(f.objectId,2));
    if(f.checkFlag)bits.push('flag '+hexNum(f.checkFlag.addr,4)+' bit '+hexNum(1<<f.checkFlag.bit,2));
    if(f.next)bits.push('next pickup +'+f.next);
    bits.push(f.kind==='sniff'?'sniff spot':'gourd/chest');
    var name=f.itemName||(f.item?hexNum(f.item.value,4):'?');
    out+='<div class="rs-loot-row" title="'+escH(bits.join('  \u00b7  '))+'">'
       + '<span class="rs-loot-item">'+escH(name)+'</span>'
       + '<span class="rs-loot-qty">\u00d7'+escH(String(f.amount))+'</span>'
       + (code[i]?'<code class="rs-loot-code">'+escH(code[i])+'</code>':'')
       + '</div>';
  });
  if(loot.length>1)
    out+='<div class="rs-note rs-note-dim">'+loot.length+' possible rewards \u2014 this script is shared and picks one at runtime.</div>';
  out+='</div>';
  return out;
}

/**
 * Where a script sends the player.
 *
 * Most triggers in the game are doors, so this is usually the whole point of
 * the script and belongs above the instruction table rather than buried in
 * it. The destination is a link: clicking it opens that room.
 *
 * The preparation before the change — fades, which edge you leave by, the
 * room state it sets — goes in the tooltip. It is context, not the answer.
 */
function renderTransitions(script){
  var tr=(script&&script.transitions)||[];
  if(!tr.length)return '';
  var out='<div class="rs-exit">';
  tr.forEach(function(t){
    var bits=[];
    if(t.writes&&t.writes.length)
      bits.push(t.writes.map(function(w){return w.name+' = '+hexNum(w.value,4);}).join(', '));
    if(t.prepares&&t.prepares.length)
      bits.push(t.prepares.map(function(p){return p.name;}).join(' \u2192 '));
    if(t.music!=null)bits.push('music '+hexNum(t.music,2));
    bits.push('lands at '+hexNum(t.x,4)+', '+hexNum(t.y,4));
    var label=t.mapName||('map '+hexNum(t.mapId,2));
    out+='<div class="rs-exit-row" title="'+escH(bits.join('\n'))+'">'
       + '<span class="rs-exit-arrow">\u2192</span>'
       + '<a href="#" class="rs-exit-to" data-goto-map="'+hexNum(t.mapId,2)+'">'+escH(label)+'</a>'
       + '<span class="rs-exit-id">'+hexNum(t.mapId,2)+'</span>'
       + '</div>';
  });
  out+='</div>';
  return out;
}

/**
 * NPCs a script can place.
 *
 * Labelled candidates on purpose: a room's enter script branches on save
 * state, the same room is reused with different enemies as the story moves
 * on, and the decoder walks every branch. Saying "this room contains these"
 * would be a claim nothing here supports.
 *
 * Positions are in the same space as a live room's `add_enemy(x, y)`, so
 * they plot on the map alongside source-defined enemies.
 */
function renderSpawns(script){
  var sp=(script&&script.spawns)||[];
  if(!sp.length)return '';
  var out='<div class="rs-spawn"><div class="rs-note rs-note-dim">'
        + sp.length+' NPC placement'+(sp.length===1?'':'s')
        + ' reachable from this script \u2014 candidates, not contents: the branch taken depends on save state.</div>';
  out+='<table class="rs-tbl"><thead><tr><th>Enemy</th><th>Name</th><th>#</th><th>Pos</th><th>Op</th></tr></thead><tbody>';
  sp.forEach(function(v,i){
    out+='<tr data-kind="spawn" data-idx="'+i+'"><td>'+escH(v.name||('index '+v.npc))+'</td>'
       + '<td>'+escH(v.romName||'')+(v.spawner?' <span class="rs-loot-qty">spawner'+(v.quantity!=null?' \u00d7'+v.quantity:'')+'</span>':'')+'</td>'
       + '<td>'+(v.character==null?'&ndash;':escH(String(v.character)))+'</td>'
       + '<td>'+(v.x==null?'computed':escH(v.x+', '+v.y))+'</td>'
       + '<td>'+hexNum(v.opcode,2)+'</td></tr>';
  });
  out+='</tbody></table></div>';
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
  out+=renderLoot(script);
  out+=renderTransitions(script);
  out+=renderSpawns(script);
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

/**
 * What the room costs in sprite palettes.
 *
 * The game keeps five palette slots for characters ($90CD80) and reuses one
 * whenever the palette it wants is already loaded — so the cost is the number
 * of *distinct* palettes, not the number of enemies. Four are handed out
 * freely; the fifth is the one an effect steals when nothing is free, which
 * is where an enemy's colours get swapped mid-fight.
 */
function buildPaletteHtml(pal){
  if(!pal||!pal.used||!pal.used.length)return '';
  var html='<div class="rs rs-pal-sec"><div class="rs-h">Sprite palettes '
    +'<span class="rs-note" style="font-weight:400;opacity:.6">'
    +pal.used.length+' of '+pal.slots+' slots — '
    +(pal.free>0?('room for '+pal.free+' more palette'+(pal.free===1?'':'s'))
                :'full; another distinct palette shares the slot effects take')
    +'</span></div><div class="rs-pal">';
  pal.used.forEach(function(p){
    var sw='<span class="rs-pal-sw">';
    // Colour 0 is transparent, so it says nothing about how a sprite looks.
    for(var i=1;i<p.colours.length;i++)sw+='<i style="background:'+p.colours[i]+'"></i>';
    sw+='</span>';
    var who=p.characters.map(function(c){return c.name;}).join(', ');
    html+='<span class="rs-pal-e" title="'+escH('$90'+p.address.toString(16)+' — '+who+' — '+p.count+' placed')+'">'
      +sw+'<span>'+escH(who)+'</span></span>';
  });
  html+='</div></div>';
  return html;
}
