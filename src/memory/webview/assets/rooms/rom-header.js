// Ownership: ROM map header section HTML builder.
// Pure function. Returns an HTML string for the rs-romhdr section.
// Uses globals from utils.js: escH, hexNum.

var ROM_HEADER_META=[
  {off:'0x00',key:'offX',    name:'trig_off_x',            wram:'7E0F86',              desc:'Trigger rect origin X (16px-tile units)',conf:'h'},
  {off:'0x01',key:'offY',    name:'trig_off_y',            wram:'7E0F88',              desc:'Trigger rect origin Y (16px-tile units)',conf:'h'},
  {off:'0x02',key:'mapW',    name:'map_w_tiles',           wram:'7E08EE → 7E08F2, 7E08F6',desc:'Map width in 16px tiles; loader derives pixel size and horizontal scroll capacity',conf:'h'},
  {off:'0x03',key:'mapH',    name:'map_h_tiles',           wram:'7E08F0 → 7E08F4, 7E08F8',desc:'Map height in 16px tiles; loader derives pixel size and vertical scroll capacity',conf:'h'},
  {off:'0x04',key:'b4',      name:'room_render_preset',    wram:'7E0F80 → TM $212C',      desc:'Main-screen layer enables; 0x17 = default (all layers), 0x16 = Oglin cave variant',conf:'m'},
  {off:'0x05',key:'b5',      name:'room_subscreen_preset', wram:'7E0F81 → TS $212D',      desc:'Subscreen / color-math target layers; 0x00=outdoor, 0x11=interior, 0x01=cave/special',conf:'m'},
  {off:'0x06',key:'b6',      name:'room_effect_family',    wram:'7E0F82 → CGADSUB $2131', desc:'Color math add/sub select; high nibble 0x9_ selects rare effect family (darkness, arena)',conf:'m'},
  {off:'0x07',key:'b7',      name:'room_effect_enable',    wram:'7E0F83 → CGWSEL $2130',  desc:'Color window / math master enable; always 0x02 in all known maps',conf:'m'},
  {off:'0x08',key:'b8',      name:'room_effect_variant',   wram:'7E241F',              desc:'Per-room modifier within effect family: 0x00=default, 0x02=parallax/jungle, 0x01=Oglin, 0x04=arena, 0x05=volcano',conf:'l'},
  {off:'0x09–0x0A',key:'unknownWord',name:'unknown_word',  wram:'7E0F84',              desc:'16-bit field; copied verbatim; purpose not yet decoded from traces',conf:'l'},
  {off:'0x0B',key:'b11',     name:'unknown_b11',           wram:'—',                  desc:'Skipped by loader (INY at 90904D); no observed destination write',conf:'l'},
  {off:'0x0C',key:'b12',     name:'unknown_b12',           wram:'—',                  desc:'Skipped by loader (INY at 90904E); step_len follows immediately after',conf:'l'},
];

function buildRomHeaderHtml(rh){
  if(!rh)return '';
  var html='<div class="rs rs-romhdr">';
  html+='<div class="rs-h rsh-toggle" id="rsh-toggle">ROM Map Data &#9660;</div>';
  html+='<div class="rsh-body" id="rsh-body">';

  // 13-byte header table
  html+='<div class="rsh-section-lbl">13-byte ROM header</div>';
  html+='<table class="rs-tbl rsh-tbl"><thead><tr><th>Offset</th><th>Value</th><th>Field name</th><th>WRAM / IO register</th><th>Description</th></tr></thead><tbody>';
  ROM_HEADER_META.forEach(function(row){
    var cc=row.conf==='h'?'rsh-conf-h':row.conf==='m'?'rsh-conf-m':'rsh-conf-l';
    var val=rh[row.key];
    var hexVal;
    if(row.off==='0x09–0x0A') hexVal='0x'+(val!=null?val.toString(16).toUpperCase().padStart(4,'0'):'????');
    else                       hexVal='0x'+(val!=null?val.toString(16).toUpperCase().padStart(2,'0'):'??');
    html+='<tr class="'+cc+'"><td>'+escH(row.off)+'</td><td>'+hexVal+'</td><td><code>'+escH(row.name)+'</code></td><td>'+escH(row.wram)+'</td><td>'+escH(row.desc)+'</td></tr>';
  });
  html+='</tbody></table>';

  // Derived geometry
  html+='<div class="rsh-section-lbl">Derived geometry</div>';
  html+='<div class="rsh-derived">';
  html+='Width:&nbsp;&nbsp;<b>'+rh.mapW+'</b> tiles = <b>'+rh.mapWpx+'</b>&thinsp;px &nbsp; horizontal scroll capacity: <b>'+rh.scrollW+'</b>&thinsp;px<br>';
  html+='Height: <b>'+rh.mapH+'</b> tiles = <b>'+rh.mapHpx+'</b>&thinsp;px &nbsp; vertical scroll capacity: <b>'+rh.scrollH+'</b>&thinsp;px';
  html+='</div>';

  // Render preset signature
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

  html+='</div>'; // rsh-body
  html+='</div>'; // rs-romhdr
  return html;
}
