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

// Returns an SVG <image> element string, or null if no image base is configured.
function ingrSvgImg(nm,x,y,sz){
  var k=getIngrKey(nm);if(!k)return null;
  if(!INGR_BASE)return null;
  var fn=INGR_MAP[k]+'.webp';
  return '<image href="'+INGR_BASE+fn+'" x="'+(x-sz/2).toFixed(2)+'" y="'+(y-sz/2).toFixed(2)+'" width="'+sz+'" height="'+sz+'" style="image-rendering:pixelated" pointer-events="none"/>';
}
