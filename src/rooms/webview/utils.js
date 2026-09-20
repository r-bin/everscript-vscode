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

// ── Ingredient icon mapping ────────────────────────────────────────────────
// Maps keyword found in trigger name → asset filename (webp in INGR_BASE dir).
// Falls back to emoji when INGR_BASE is not configured.
var INGR_MAP={
  wax:'Wax',vinegar:'Vinegar',oil:'Oil',mud:'Mud_Pepper',pepper:'Mud_Pepper',
  limestone:'Limestone',dry_ice:'Dry_Ice',crystal:'Crystal',clay:'Clay',brimstone:'Brimstone',
  ash:'Ash',water:'Water',root:'Root',nectar:'Nectar',petal:'Petal',honey:'Honey',
  vine:'Root',bone:'Bone',feather:'Feather',mercury:'Mercury',
  acorn:'Acorn',ethanol:'Ethanol',grease:'Grease',gunpowder:'Gunpowder',iron:'Iron',
  meteorite:'Meteorite',mushroom:'Mushroom',wax_residue:'Wax',atlas:'Atlas_Amulet'
};
var INGR_EMOJI={
  wax:'🕯',vinegar:'🧪',oil:'🪻',mud:'🌶',
  pepper:'🌶',limestone:'🪨',dry_ice:'🧊',crystal:'💎',
  clay:'🎺',brimstone:'🔥',ash:'⚫',water:'💧',
  root:'🌿',nectar:'🌺',petal:'🌸',bone:'🦴',feather:'🪶'
};

function getIngrKey(nm){
  if(!nm)return null;
  var low=nm.toLowerCase();
  for(var k in INGR_MAP){if(low.indexOf(k)!==-1)return k;}
  return null;
}
function getIngrIcon(nm){var k=getIngrKey(nm);return k?INGR_EMOJI[k]||'🌿':null;}

/**
 * The name to look an ingredient icon up by for a trigger.
 *
 * Live rooms name their triggers in the source, so the name carries the item
 * ("sniff_wax_2"). Vanilla rooms have no names — but the ROM decoder reads
 * the reward straight out of the script, so the item is known either way and
 * both paths can draw the same icon. The source name wins when it resolves,
 * since an author's own naming beats a derived one.
 *
 * A script can offer several rewards (a few rooms share one script and pick
 * at runtime); the first that maps to an icon stands for it.
 */
function trigIngrName(t,nm){
  if(nm&&getIngrKey(nm))return nm;
  var loot=(t&&t.loot)||[];
  for(var i=0;i<loot.length;i++){
    if(loot[i].itemName&&getIngrKey(loot[i].itemName))return loot[i].itemName;
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

// Returns an SVG <image> element string, or null if no image base is configured.
function ingrSvgImg(nm,x,y,sz){
  var k=getIngrKey(nm);if(!k)return null;
  if(!INGR_BASE)return null;
  var fn=INGR_MAP[k]+'.webp';
  // The icon map names more ingredients than the assets folder ships. Without
  // this check a missing file draws an empty box; returning null lets the
  // caller fall back to the emoji.
  if(typeof INGR_FILES!=='undefined'&&INGR_FILES.length&&INGR_FILES.indexOf(fn)===-1)return null;
  return '<image href="'+INGR_BASE+fn+'" x="'+(x-sz/2).toFixed(2)+'" y="'+(y-sz/2).toFixed(2)+'" width="'+sz+'" height="'+sz+'" style="image-rendering:pixelated" pointer-events="none"/>';
}
