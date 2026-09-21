// Ownership: the SVG for the NPCs a room's enter script can place — the
// sprite, the tile tint that says whether it fights back, and the collision
// box. Pure: takes the spawn array, returns HTML strings.
//
// Split out of svg-builder.js because a spawn no longer belongs to one layer:
// the game draws some characters in front of the foreground and some behind
// it, so the caller needs the two groups separately to put the canopy
// between them.
//
// Uses utils.js globals: escH.

/** One SVG unit is 8 px, the size of a map tile on the Rooms grid. */
var SPAWN_PX = 8;

/** What the tooltip says about one spawn. */
function spawnTip(v, nm) {
  // Hostility is a flag, so it can be shown rather than guessed from the
  // name: bit 1 (INVINCIBLE) is set on every townsperson and on no monster.
  // A spawn that carries its own flags overrides the character's.
  var disp = v.hostile == null ? '' : (v.hostile ? 'hostile' : 'friendly')
        + (v.inactive ? ', inactive' : '')
        + ' — flags 0x' + (v.flags || 0).toString(16) + ' from the ' + v.flagsFrom;
  // Where the game puts it relative to the scenery: $8FC773 reads the
  // collision word of the tile it stands on, compares planes, and falls back
  // to bit 12 — priority 3 over everything, or 2 under the foreground.
  var DEPTH = {
    hidden: 'not drawn here — gate nibble 8',
    front: 'in front of the foreground',
    behind: 'behind the foreground',
    unknown: 'depth unknown — this tile sets no plane, so the character '
      + 'carries one the map cannot read'
  };
  var depth = v.tileWord == null ? ''
        : (DEPTH[v.depth] || '') + ' — tile 0x' + v.tileWord.toString(16);
  return nm + (v.name && v.romName ? ' (' + v.name + ')' : '')
    + (v.character != null ? '\ncharacter #' + v.character : '')
    + (disp ? '\n' + disp : '')
    + (depth ? '\n' + depth : '')
    // The Boy's own radius is 8, so he stops r+8 px away horizontally and
    // (r+8)/2 vertically.
    + (v.hitW != null ? '\nhitbox ' + (v.hitW
      ? v.hitW + '×' + v.hitH + ' px — stops the Boy ' + (v.hitW / 2 + 8) + ' px away'
      : 'none — walk through it') : '')
    + (v.spawner ? '\nspawner' + (v.quantity != null ? ' x' + v.quantity : '') : '')
    + '\nat ' + v.x + ',' + v.y + ' — candidate, depends on save state';
}

/**
 * The three layers a room's spawns contribute.
 *
 * `behind` and `front` are scenery — the character as the game draws it —
 * and the canopy goes between them. `marks` is the annotation on top: the
 * dashed collision box, and a hollow square for a spawn with no artwork.
 *
 * Drawn hollow, because these are candidates rather than contents — the
 * enter script branches on save state and every branch is walked. A solid
 * marker would claim more than is known.
 *
 * @param {Array} romSpawns spawns from the decoded enter script
 * @returns {{behind:string, front:string, marks:string}}
 */
function buildSpawnLayers(romSpawns) {
  var out = { behind: '', front: '', marks: '' };
  (romSpawns || []).forEach(function (v, i) {
    if (v.x == null || v.y == null) return;
    var nm = v.romName || v.name || ('NPC ' + v.npc);
    var tip = escH(spawnTip(v, nm));
    var id = ' data-idx="' + i + '" data-kind="spawn"';
    var at = ' (' + v.x + ',' + v.y + ')';
    // A spawn the engine refuses to draw at all still has to be findable, so
    // it keeps its marker and is only dimmed.
    var body = '';

    // The tile it stands on, tinted by the hostility flag, so a room reads at
    // a glance.
    //
    // The tint is scenery — it belongs under the sprite, on the ground — but
    // the outline is the marker that says "an enemy is on this tile", and a
    // marker that the canopy can swallow is no marker. So the fill goes in
    // the sprite's own layer and the outline goes on top with the other
    // annotation.
    if (v.hostile != null) {
      var hc = v.hostile ? '#ff5555' : '#4fc3f7';
      var tile = ' x="' + (v.x - 0.5) + '" y="' + (v.y - 0.5) + '" width="1" height="1" rx="0.2"';
      body += '<rect class="svge-spawn svge-spawn-tile"' + id + ' data-label="' + escH(nm) + at + '"'
        + tile + ' fill="' + hc + '" fill-opacity="' + (v.inactive ? 0.10 : 0.20) + '" stroke="none">'
        + '<title>' + tip + '</title></rect>';
      out.marks += '<rect class="svge-spawn svge-spawn-tile"' + id + ' data-label="' + escH(nm) + at + '"'
        + tile + ' fill="none" stroke="' + hc + '" stroke-opacity="0.9" stroke-width="0.15"'
        + ' stroke-dasharray="' + (v.inactive ? '0.4,0.3' : 'none') + '">'
        + '<title>' + tip + '</title></rect>';
    }

    if (v.sprite) {
      // The game's own artwork, placed by the sprite's own origin, which sits
      // at its feet. Centring it instead drops an enemy about a tile low.
      //
      // The origin lands on the spawn coordinate exactly: a trace of room
      // 0x38 has its entities at pixel 8*x for every one of them — the two
      // Mosquitoes the script places at x=17 are at $0088 = 136. So there is
      // no half-tile to add; doing that put every sprite 4 px down and right.
      var sw = (v.spriteW || 16) / SPAWN_PX, sh = (v.spriteH || 16) / SPAWN_PX;
      var ox = (v.spriteOX != null ? v.spriteOX : (v.spriteW || 16) / 2) / SPAWN_PX;
      var oy = (v.spriteOY != null ? v.spriteOY : (v.spriteH || 16) / 2) / SPAWN_PX;
      var fr = (v.spriteFrames && v.spriteFrames.length > 1)
        ? ' data-frames="' + escH(JSON.stringify(v.spriteFrames)) + '"' : '';
      body += '<image class="svge-spawn' + (v.hiddenHere ? ' svge-spawn-unseen' : '') + '"' + id + fr
        + ' data-label="' + escH(nm) + at + '" href="' + v.sprite + '"'
        + ' x="' + (v.x - ox) + '" y="' + (v.y - oy) + '" width="' + sw + '" height="' + sh + '"'
        + ' style="image-rendering:pixelated" preserveAspectRatio="none">'
        + '<title>' + tip + '</title></image>';
    } else if (v.hostile == null) {
      // No character record either — nothing but a position to show.
      out.marks += '<rect class="svge-spawn"' + id + ' data-label="' + escH(nm) + at + '"'
        + ' x="' + (v.x - 0.5) + '" y="' + (v.y - 0.5) + '" width="1" height="1" fill="none"'
        + ' stroke="#e3b341" stroke-width="0.25" rx="0.3"><title>' + tip + '</title></rect>';
    }

    // The body other entities bump into: character record +0x0D as a radius,
    // giving a box 2r wide and r tall centred on the spawn point. The
    // vertical axis counts double in the game's own test ($8FB4C5 ASL), which
    // is why it is half as tall as it is wide.
    if (v.hitW) {
      var hw = v.hitW / SPAWN_PX / 2, hh = v.hitH / SPAWN_PX / 2;
      out.marks += '<rect class="svge-spawn svge-hitbox"' + id
        + ' data-label="' + escH(nm) + ' hitbox ' + v.hitW + '×' + v.hitH + 'px"'
        + ' x="' + (v.x - hw) + '" y="' + (v.y - hh) + '" width="' + (hw * 2) + '" height="' + (hh * 2) + '"'
        + ' fill="none" stroke="#ffffff" stroke-opacity="0.5" stroke-width="0.12"'
        + ' stroke-dasharray="0.35,0.3"><title>' + tip + '</title></rect>';
    }

    // Only a spawn the engine really does draw under the foreground goes
    // under the canopy; everything else, including the ones whose plane the
    // map cannot say, stays visible.
    if (v.inFront || v.tileWord == null) out.front += body; else out.behind += body;
  });
  return out;
}
