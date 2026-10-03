// Ownership: where things are on the Sprites stage at a given tick — the entity's walk
// path and jump height, the projectiles it throws, and the box the canvas must hold
// to show all of it. Pure geometry plus projectile drawing; exposes window.SpritesMotion.
(function() {
  var HEIGHT_UNITS = 16;    // entity height (+0x1E) is kept in 1/16 px
  var MAX_FLIGHT_PX = 160;  // a fast bolt would otherwise want a canvas the width of a room

  /** The playback tick: start of the current frame plus the ticks into it. */
  function nowTick(frameStarts, frameIdx, tickCounter) {
    return (frameStarts[frameIdx] || 0) + tickCounter;
  }

  /**
   * The entity's position at this point of playback, in sprite pixels from where it
   * started: x and y follow its steps (only when `walk` is on), z is its height.
   */
  function positionAt(anim, frameIdx, tickCounter, walk) {
    var f = anim && anim.frames[frameIdx];
    var m = f && f.motion && f.motion.length ? f.motion[Math.min(f.motion.length - 1, Math.max(0, Math.floor(tickCounter)))] : null;
    if (!m) return { x: 0, y: 0, z: 0 };
    return { x: walk ? m[0] : 0, y: walk ? m[1] : 0, z: m[2] / HEIGHT_UNITS };
  }

  /** Where a spawn starts and where it is `age` ticks later, in sprite pixels. */
  function projectileAt(sp, age, walk) {
    var ox = (walk ? sp.ex : 0) + sp.dx;
    var oy = (walk ? sp.ey : 0) + sp.dy - sp.dz - sp.ez / HEIGHT_UNITS;
    var dist = Math.min(MAX_FLIGHT_PX, Math.hypot(sp.vx, sp.vy) * age);
    var speed = Math.hypot(sp.vx, sp.vy) || 1;
    return {
      sx: ox, sy: oy,
      x: ox + (sp.vx / speed) * dist,
      y: oy + (sp.vy / speed) * dist,
      gone: Math.hypot(sp.vx, sp.vy) * age > MAX_FLIGHT_PX,
    };
  }

  /**
   * Every point the scene reaches over the whole cycle — the sprite along its path
   * and lifted by its height, plus each projectile from spawn to the end of its
   * flight — as a box in sprite pixels around the starting feet.
   */
  function sceneBox(anim, opts) {
    var box = { minX: -anim.originX, maxX: anim.width - anim.originX, minY: -anim.originY, maxY: anim.height - anim.originY };
    var grow = function(x0, y0, x1, y1) {
      box.minX = Math.min(box.minX, x0); box.maxX = Math.max(box.maxX, x1);
      box.minY = Math.min(box.minY, y0); box.maxY = Math.max(box.maxY, y1);
    };
    anim.frames.forEach(function(f) {
      (f.motion || []).forEach(function(m) {
        var x = opts.walk ? m[0] : 0;
        var y = opts.walk ? m[1] : 0;
        var z = m[2] / HEIGHT_UNITS;
        grow(x - anim.originX, y - z - anim.originY, x + anim.width - anim.originX, y + anim.height - anim.originY);
      });
    });
    var pr = anim.projectiles;
    if (opts.projectiles && pr && pr.spawns) {
      var cycle = anim.totalTicks || 0;
      pr.spawns.forEach(function(sp) {
        var a = pr.anims[sp.idHex];
        var hw = a ? a.width : 8;
        var hh = a ? a.height : 8;
        var p = projectileAt(sp, Math.max(0, cycle - sp.tick), opts.walk);
        grow(Math.min(p.sx, p.x) - hw, Math.min(p.sy, p.y) - hh, Math.max(p.sx, p.x) + hw, Math.max(p.sy, p.y) + hh);
      });
    }
    return box;
  }

  /** The projectile animation's frame `age` ticks after it spawned (it loops). */
  function projectileFrame(anim, age) {
    var total = 0;
    anim.frames.forEach(function(f) { total += f.ticks; });
    var t = total > 0 ? age % total : 0;
    for (var i = 0; i < anim.frames.length; i++) {
      if (t < anim.frames[i].ticks) return anim.frames[i];
      t -= anim.frames[i].ticks;
    }
    return anim.frames[0];
  }

  /**
   * Draw every spawn whose tick has passed. Straight-flying routines move; the
   * others stay where they spawned. `ox, oy` is the canvas point of the starting feet.
   */
  function drawProjectiles(ctx, anim, now, ox, oy, scale, walk, imageFor) {
    var pr = anim.projectiles;
    if (!pr || !pr.spawns) return;
    pr.spawns.forEach(function(sp) {
      if (now < sp.tick) return;
      var p = projectileAt(sp, now - sp.tick, walk);
      if (p.gone) return;
      var x = ox + p.x * scale;
      var y = oy + p.y * scale;
      var a = pr.anims[sp.idHex];
      var img = a ? imageFor(projectileFrame(a, Math.floor(now - sp.tick)).png) : null;
      if (img) ctx.drawImage(img, x - a.originX * scale, y - a.originY * scale, a.width * scale, a.height * scale);
      // Spawn point; a ring stands in while the image loads.
      var sx = ox + p.sx * scale;
      var sy = oy + p.sy * scale;
      ctx.strokeStyle = '#33ccff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx, sy - 4); ctx.lineTo(sx + 4, sy); ctx.lineTo(sx, sy + 4); ctx.lineTo(sx - 4, sy); ctx.closePath();
      ctx.stroke();
      if (!img) { ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.stroke(); }
    });
  }

  var api = {
    nowTick: nowTick,
    positionAt: positionAt,
    sceneBox: sceneBox,
    drawProjectiles: drawProjectiles,
  };
  if (typeof window !== 'undefined') window.SpritesMotion = api;
})();
