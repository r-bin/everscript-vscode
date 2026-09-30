// Parked from src/rooms/webview/tables-builder.js (v0.90.0) — see README.md.
// The Rooms tab drew this under the map: the room's sprite-palette budget.
// Input: `room.content.triggers.palettes` from the host (still computed there).
// Globals it expected from the webview bundle: escH.

/**
 * What the room costs in sprite palettes.
 *
 * The game keeps five palette slots for characters ($90CD80) and reuses one
 * whenever the palette it wants is already loaded — so the cost is the number
 * of *distinct* palettes, not the number of enemies. Four are handed out
 * freely; the fifth is the one an effect steals when nothing is free, which
 * is where an enemy's colours get swapped mid-fight.
 */
/**
 * Sprite palettes as a row of slots, so the budget reads without counting.
 *
 * `$90CD80` reuses a slot whenever the wanted palette is already in one, so
 * the cost is the number of *distinct* palettes. Four are handed out freely;
 * the fifth and beyond land in the slot `$90CE92` steals, which is what makes
 * an enemy's colours change after an alchemy effect. Drawing the free slots
 * as empty boxes is the point of the row — it shows the headroom, not just
 * the usage. See docs/script-format/palettes.md.
 */
function buildPaletteHtml(pal){
  if(!pal||!pal.used||!pal.used.length)return '';
  var over=Math.max(0,pal.used.length-pal.slots);
  var html='<div class="rs rs-pal-sec"><div class="rs-h">Sprite palettes '
    +'<span class="rs-note" style="font-weight:400;opacity:.6">'
    +pal.used.length+' of '+pal.slots+' slots'+buildPaletteBar(pal,over)+' — '
    +(over>0?(over+' past the safe slots; '+(over===1?'that palette is':'those palettes are')
              +' in the one alchemy steals')
      :pal.free>0?('room for '+pal.free+' more distinct palette'+(pal.free===1?'':'s'))
      :'full; the next distinct palette lands in the slot alchemy steals')
    +'</span></div><div class="rs-pal">';
  pal.used.forEach(function(p,i){
    var sw='<span class="rs-pal-sw">';
    // Colour 0 is transparent, so it says nothing about how a sprite looks.
    for(var c=1;c<p.colours.length;c++)sw+='<i style="background:'+p.colours[c]+'"></i>';
    sw+='</span>';
    var who=p.characters.map(function(ch){return ch.name;}).join(', ');
    var stolen=i>=pal.slots;
    html+='<span class="rs-pal-slot'+(stolen?' over':'')+'" title="'
      +escH('$90'+p.address.toString(16)+' — '+who+' — '+p.count+' placed'
            +(stolen?' — beyond slot '+pal.slots+', shares the stolen slot':''))+'">'
      +sw+'<span>'+escH(who)+'</span></span>';
  });
  for(var f=0;f<pal.free;f++){
    html+='<span class="rs-pal-slot free" title="A distinct palette can still be added here">free</span>';
  }
  html+='</div></div>';
  return html;
}

/** Four pips, one per safe slot, plus one red pip per palette beyond them. */
function buildPaletteBar(pal,over){
  var bar='<span class="rs-pal-bar">';
  for(var i=0;i<pal.slots;i++)bar+='<i class="'+(i<pal.used.length?'on':'')+'"></i>';
  for(var o=0;o<over;o++)bar+='<i class="over"></i>';
  return bar+'</span>';
}
