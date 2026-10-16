// Ownership: shared utility functions for the Rooms tab webview.
// No DOM dependencies. No state. Imported by all other rooms/ webview modules via global scope.

function escH(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

function normScriptAddr(v){
  return String(v==null?'':v).replace(/^0x/i,'').toUpperCase();
}

// Format a number as a zero-padded hex string for display in HTML.
// Returns &ndash; for non-finite values.
function hexNum(v,w){
  if(typeof v!=='number'||!isFinite(v))return '&ndash;';
  return '0x'+(v>>>0).toString(16).toUpperCase().padStart(w,'0');
}

// Convert 16px-tile trigger coords to 8px-tile SVG space using the room's trigOffset.
// If trigOff is null, returns coords as-is (assuming they are already in SVG tile space).
function tsvg(t,trigOff){
  if(!trigOff)return{sx:t.x1,sy:t.y1,sw:Math.max(0.5,t.x2-t.x1),sh:Math.max(0.5,t.y2-t.y1)};
  return{sx:(t.x1-trigOff.offX)*2,sy:(t.y1-trigOff.offY)*2,
         sw:Math.max(1,(t.x2-t.x1)*2),sh:Math.max(1,(t.y2-t.y1)*2)};
}

// ── Item icons ────────────────────────────────────────────────────────────
// A pickup's icon is the ring menu's own, decoded from the ROM by the host
// (rooms/data/item-icons.js) and handed over as ITEM_ICONS.loot — a PNG data
// URI per LOOT_REWARD name: ingredients, consumables, armour. Money, trade
// goods and charms have no ring icon, so they get none here either.
//
// Live rooms name their triggers in the source ("sniff_wax_2"), so a keyword
// in that name says which reward it means. The emoji stand in only when no
// ROM is configured.
var ITEM_KEYWORDS={
  wax:'WAX',vinegar:'VINEGAR',oil:'OIL',mud:'MUD_PEPPER',pepper:'MUD_PEPPER',
  limestone:'LIMESTONE',dry_ice:'DRY_ICE',crystal:'CRYSTAL',clay:'CLAY',brimstone:'BRIMSTONE',
  ash:'ASH',water:'WATER',root:'ROOTS',vine:'ROOTS',bone:'BONE',feather:'FEATHER',
  acorn:'ACORNS',ethanol:'ETHANOL',grease:'GREASE',gunpowder:'GUNPOWDER',iron:'IRON',
  meteorite:'METEORITE',mushroom:'MUSHROOM',atlas:'ATLAS_MEDALLION',
  petal:'PETAL',nectar:'NECTAR',honey:'HONEY',biscuit:'BISCUIT',wings:'WINGS',
  essence:'HERBAL_ESSENCE',pixie:'PIXIE_DUST',call_bead:'CALL_BEADS'
};
var ITEM_EMOJI={
  WAX:'🕯',VINEGAR:'🧪',OIL:'🪻',MUD_PEPPER:'🌶',LIMESTONE:'🪨',DRY_ICE:'🧊',
  CRYSTAL:'💎',CLAY:'🎺',BRIMSTONE:'🔥',ASH:'⚫',WATER:'💧',ROOTS:'🌿',BONE:'🦴',
  FEATHER:'🪶',NECTAR:'🌺',PETAL:'🌸',HONEY:'🍯',WINGS:'🪽',CALL_BEADS:'🔵'
};
/** Whole reward names the emoji fallback covers without a table entry each. */
var ITEM_EMOJI_PREFIX=[['CHEST_','🛡'],['HELM_','🛡'],['GLOVE_','🛡'],['COLLAR_','🛡']];

function itemIconUris(){return (typeof ITEM_ICONS!=='undefined'&&ITEM_ICONS&&ITEM_ICONS.loot)||{};}

/** `nm` when it is itself a LOOT_REWARD name with an icon, else null. */
function itemRewardExact(nm){
  if(!nm)return null;
  var up=String(nm).toUpperCase();
  if(itemIconUris()[up]||ITEM_EMOJI[up])return up;
  for(var k in ITEM_KEYWORDS)if(ITEM_KEYWORDS[k]===up)return up;   // named, just no emoji of its own
  for(var i=0;i<ITEM_EMOJI_PREFIX.length;i++)if(up.indexOf(ITEM_EMOJI_PREFIX[i][0])===0)return up;
  return null;
}

/**
 * The LOOT_REWARD name `nm` stands for — `nm` itself when it already is one,
 * otherwise the first keyword it contains. Null when it names nothing with an
 * icon. Keywords are for names an author wrote; a decoded reward is matched
 * exactly (trigItemName), or LIMESTONE_TABLET would read as LIMESTONE.
 */
function itemReward(nm){
  var exact=itemRewardExact(nm);if(exact)return exact;
  if(!nm)return null;
  var low=String(nm).toLowerCase();
  for(var k in ITEM_KEYWORDS){if(low.indexOf(k)!==-1)return ITEM_KEYWORDS[k];}
  return null;
}

/** An emoji for what `nm` names — the label and tooltip mark, and the no-ROM icon. */
function itemEmoji(nm){
  var r=itemReward(nm);if(!r)return null;
  if(ITEM_EMOJI[r])return ITEM_EMOJI[r];
  for(var i=0;i<ITEM_EMOJI_PREFIX.length;i++)if(r.indexOf(ITEM_EMOJI_PREFIX[i][0])===0)return ITEM_EMOJI_PREFIX[i][1];
  return '🌿';
}

/**
 * The name to look a trigger's icon up by.
 *
 * Live rooms name their triggers in the source, so the name carries the item
 * ("sniff_wax_2"). Vanilla rooms have no names — but the ROM decoder reads
 * the reward straight out of the script, so the item is known either way and
 * both paths draw the same icon. The source name wins when it resolves,
 * since an author's own naming beats a derived one.
 *
 * A script can offer several rewards (a few rooms share one script and pick
 * at runtime); the first that has an icon stands for it.
 */
function trigItemName(t,nm){
  if(nm&&itemReward(nm))return nm;
  var loot=(t&&t.loot)||[];
  for(var i=0;i<loot.length;i++){
    if(itemRewardExact(loot[i].itemName))return loot[i].itemName;
  }
  return nm||'';
}

/** `WAX x1` — the short form that stands in for a nameless vanilla trigger. */
function lootLabel(t){
  var loot=(t&&t.loot)||[];
  if(!loot.length)return '';
  var f=loot[0];
  var nm=f.itemName||'';
  if(!nm)return '';
  var more=loot.length>1?' +'+(loot.length-1)+' more':'';
  return nm+(f.amount>1?' \u00d7'+f.amount:'')+more;
}

/**
 * The loot detail for a trigger's tooltip: what it gives, which object it is,
 * and which flag remembers that it was taken.
 */
function lootTip(t){
  var loot=(t&&t.loot)||[];
  if(!loot.length)return '';
  var out='';
  for(var i=0;i<loot.length;i++){
    var f=loot[i];
    var bits=[(f.itemName||'?')+(f.amount>1?' \u00d7'+f.amount:'')];
    if(f.objectId!=null)bits.push('object 0x'+f.objectId.toString(16));
    if(f.checkFlag)bits.push('flag $'+f.checkFlag.addr.toString(16)+' bit 0x'+(1<<f.checkFlag.bit).toString(16));
    if(f.next)bits.push('next pickup +'+f.next);
    out+='\n'+bits.join('  \u00b7  ');
  }
  if(loot.length>1)out+='\n('+loot.length+' possible \u2014 picked at runtime)';
  return out;
}

/** `\u2192 Gothica - Dark Forest` \u2014 where a trigger leads, for its label. */
function exitLabel(t){
  var tr=(t&&t.transitions)||[];
  if(!tr.length)return '';
  var first=tr[0];
  var name=first.mapName||('map '+first.mapId.toString(16));
  return '\u2192 '+name+(tr.length>1?' +'+(tr.length-1):'');
}

/** The destinations a trigger can lead to, and how it prepares for them. */
function exitTip(t){
  var tr=(t&&t.transitions)||[];
  var out='';
  for(var i=0;i<tr.length;i++){
    var x=tr[i];
    out+='\n\u2192 '+(x.mapName||('map 0x'+x.mapId.toString(16)))+' (0x'+x.mapId.toString(16)+')';
    if(x.prepares&&x.prepares.length)out+='\n   via '+x.prepares.map(function(p){return p.name;}).join(' \u2192 ');
  }
  return out;
}

/**
 * An SVG <image> of the ROM icon for what `nm` names, centred on (x,y), or
 * null when there is none (no ROM, or a reward without a ring icon) — the
 * caller then draws the emoji.
 *
 * The icon is 16×16 and one viewBox unit is one 8px tile, so it is drawn 2
 * units square: the size the game draws it against this map.
 */
var ITEM_ICON_UNITS=2;
function itemSvgImg(nm,x,y){
  var r=itemReward(nm);if(!r)return null;
  var uri=itemIconUris()[r];if(!uri)return null;
  var h=ITEM_ICON_UNITS/2;
  return '<image href="'+uri+'" x="'+(x-h).toFixed(2)+'" y="'+(y-h).toFixed(2)+'" width="'+ITEM_ICON_UNITS+'" height="'+ITEM_ICON_UNITS+'" style="image-rendering:pixelated" pointer-events="none"/>';
}
