// Ownership: where things are on the Sprites stage at a given tick — the entity's walk
// path and jump height, the projectiles it throws and their hit boxes, the target
// character and its hurt region, and the box the canvas must hold to show all of it.
// Pure geometry plus drawing those pieces; exposes window.SpritesMotion.
(function() {
  var HEIGHT_UNITS = 16;    // heights (entity +0x1E, projectile +0x18) are kept in 1/16 px
  var HIT_SIZE = 16;        // the box a projectile hit-tests with every tick ($90DED5)

  /** The playback tick: start of the current frame plus the ticks into it. */
  function nowTick(frameStarts, frameIdx, tickCounter) {
    return (frameStarts[frameIdx] || 0) + tickCounter;
  }

  /**
   * The entity's position at this point of playback, in sprite pixels from where it
   * started: x and y follow its steps (only when `walk` is on); z is its height in
   * pixels and z16 the same in the engine's 1/16 px.
   */
  function positionAt(anim, frameIdx, tickCounter, walk) {
    var f = anim && anim.frames[frameIdx];
    var m = f && f.motion && f.motion.length ? f.motion[Math.min(f.motion.length - 1, Math.max(0, Math.floor(tickCounter)))] : null;
    if (!m) return { x: 0, y: 0, z: 0, z16: 0 };
    return { x: walk ? m[0] : 0, y: walk ? m[1] : 0, z: m[2] / HEIGHT_UNITS, z16: m[2] };
  }

  /**
   * A projectile `age` ticks after it spawned: its ground point and height, or null
   * once it has landed or run out. Unmodelled routines stay where they spawned.
   */
  function projectileAt(sp, age, walk) {
    var shiftX = walk ? 0 : -sp.ex;
    var shiftY = walk ? 0 : -sp.ey;
    var p;
    if (!sp.path || !sp.path.length) {
      if (sp.model !== 'unknown') return null;
      p = sp.start;
    } else {
      var i = Math.floor(age) - 1;
      // A projectile consumed on hit ends there — where depends on whether the thrower walks.
      var end = walk ? (sp.cutWalk || sp.path.length) : (sp.cutStill || sp.path.length);
      if (i >= end) return null;
      p = i < 0 ? sp.start : sp.path[i];
    }
    return { x: p[0] + shiftX, y: p[1] + shiftY, z: p[2] / HEIGHT_UNITS };
  }

  /** Is `tick` one the target is hit on? Returns 'melee', the projectile id, or null. */
  function hitAt(anim, tick, walk) {
    var h = anim.target && (walk === false ? anim.target.hitsStill : anim.target.hits);
    if (!h) return null;
    var t = Math.floor(tick);
    if (h.melee.indexOf(t) >= 0) return 'melee';
    if (h.contact && h.contact.indexOf(t) >= 0) return 'contact';
    for (var i = 0; i < h.projectile.length; i++) if (h.projectile[i].tick === t) return h.projectile[i].idHex;
    return null;
  }

  /**
   * Every point the scene reaches over the whole cycle — the sprite along its path and
   * lifted by its height, each projectile along its flight, and the target — as a box
   * in sprite pixels around the starting feet.
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
    var sprites = anim.segmentSprites || {};
    anim.frames.forEach(function(f) {
      if (!f.segments) return;
      f.segments.ticks.forEach(function(tick) {
        tick.forEach(function(p, k) {
          var spr = sprites[f.segments.sprites[k]];
          if (spr) grow(p[0] - spr.originX, p[1] - spr.originY, p[0] + spr.width - spr.originX, p[1] + spr.height - spr.originY);
        });
      });
    });
    var pr = anim.projectiles;
    if (opts.projectiles && pr && pr.spawns) {
      pr.spawns.forEach(function(sp) {
        var a = pr.anims[sp.idHex];
        var hw = Math.max(a ? a.width : 8, HIT_SIZE);
        var hh = Math.max(a ? a.height : 8, HIT_SIZE);
        var pts = [sp.start].concat(sp.path || []);
        pts.forEach(function(p) {
          var x = p[0] - (opts.walk ? 0 : sp.ex);
          var y = p[1] - (opts.walk ? 0 : sp.ey);
          grow(x - hw, y - p[2] / HEIGHT_UNITS - hh, x + hw, y + hh);
        });
      });
    }
    var t = anim.target;
    if (opts.target && t) {
      var r = Math.max(t.radius, 4);
      grow(t.x - Math.max(t.originX, r), t.y - Math.max(t.originY, r), t.x + Math.max(t.width - t.originX, r), t.y + Math.max(t.height - t.originY, r));
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

  function diamond(ctx, x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath();
    ctx.stroke();
  }

  /**
   * Every projectile alive at `now`: its sprite lifted by its height, and on the ground
   * below it the 16×16 box it hit-tests with on every tick it lives — red on a tick it
   * reaches the target. `ox, oy` is the canvas point of the starting feet.
   */
  function drawProjectiles(ctx, anim, now, ox, oy, scale, walk, imageFor) {
    var pr = anim.projectiles;
    if (!pr || !pr.spawns) return;
    var hit = hitAt(anim, now, walk);
    pr.spawns.forEach(function(sp) {
      if (now < sp.tick) return;
      var age = now - sp.tick;
      var p = projectileAt(sp, age, walk);
      if (!p) return;
      var x = ox + p.x * scale;
      var y = oy + p.y * scale;
      var lift = p.z * scale;
      var hs = HIT_SIZE * scale;
      var hitting = hit === sp.idHex;
      if (sp.path && sp.path.length) {
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = hitting ? '#ff3355' : '#33ccff';
        ctx.lineWidth = 1;
        ctx.strokeRect(x - hs / 2, y - hs / 2, hs, hs);
        ctx.setLineDash([]);
        if (hitting) { ctx.fillStyle = 'rgba(255, 51, 85, 0.30)'; ctx.fillRect(x - hs / 2, y - hs / 2, hs, hs); }
        if (lift > 0) {
          ctx.strokeStyle = 'rgba(51, 204, 255, 0.45)';
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - lift); ctx.stroke();
        }
      }
      var a = pr.anims[sp.idHex];
      var img = a ? imageFor(projectileFrame(a, Math.floor(age)).png) : null;
      if (img) ctx.drawImage(img, x - a.originX * scale, y - lift - a.originY * scale, a.width * scale, a.height * scale);
      else { ctx.strokeStyle = '#33ccff'; ctx.beginPath(); ctx.arc(x, y - lift, 3, 0, Math.PI * 2); ctx.stroke(); }
      // Where it was thrown from.
      var s = projectileAt(sp, 0, walk);
      ctx.strokeStyle = '#33ccff';
      diamond(ctx, ox + s.x * scale, oy + (s.y - s.z) * scale, 4);
    });
  }

  /**
   * The second character: its standing sprite, and its hurt region — half-size
   * `radius` centred on its feet, as the hit test at $8FB63A measures it — filled red
   * on every tick something reaches it.
   */
  function drawTarget(ctx, anim, now, ox, oy, scale, imageFor, walk) {
    var t = anim.target;
    if (!t) return;
    var x = ox + t.x * scale;
    var y = oy + t.y * scale;
    var img = t.png ? imageFor(t.png) : null;
    if (img) {
      ctx.globalAlpha = 0.85;
      ctx.drawImage(img, x - t.originX * scale, y - t.originY * scale, t.width * scale, t.height * scale);
      ctx.globalAlpha = 1;
    }
    var r = t.radius * scale;
    var hit = hitAt(anim, now, walk);
    ctx.strokeStyle = hit ? '#ff3355' : '#ffaa00';
    ctx.lineWidth = hit ? 2 : 1.5;
    ctx.strokeRect(x - r, y - r, r * 2, r * 2);
    ctx.fillStyle = hit ? 'rgba(255, 51, 85, 0.35)' : 'rgba(255, 170, 0, 0.10)';
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  /**
   * A segmented body (Tar Skull, Salabog): every segment where the easing put it on this
   * tick. Drawn last-to-first so segment 0, the head, is on top — the list order the
   * game's draw routine ($8FC86C) walks, and OAM puts earlier sprites in front.
   */
  function drawSegments(ctx, anim, frame, tickCounter, cx, cy, lift, scale, imageFor) {
    var segs = frame.segments;
    var sprites = anim.segmentSprites || {};
    if (!segs || !segs.ticks.length) return;
    var pos = segs.ticks[Math.min(segs.ticks.length - 1, Math.max(0, Math.floor(tickCounter)))];
    for (var k = pos.length - 1; k >= 0; k--) {
      var spr = sprites[segs.sprites[k]];
      var img = spr ? imageFor(spr.png) : null;
      if (!img) continue;
      ctx.drawImage(img, cx + pos[k][0] * scale - spr.originX * scale, cy - lift + pos[k][1] * scale - spr.originY * scale, spr.width * scale, spr.height * scale);
    }
  }

  /** The strike box (if any) on a given playback tick, with where the attacker stood. */
  function strikeOnTick(anim, frameStarts, tick, walk) {
    for (var i = anim.frames.length - 1; i >= 0; i--) {
      if (frameStarts[i] <= tick) {
        var f = anim.frames[i];
        var k = tick - frameStarts[i];
        if (!f.strikeBox || k >= f.ticks) return null;
        var m = f.motion && f.motion[k];
        return { box: f.strikeBox, x: walk && m ? m[0] : 0, y: walk && m ? m[1] : 0 };
      }
    }
    return null;
  }

  /**
   * The damage of the last `n` ticks, fading out: each tick's strike box, and each
   * projectile's 16×16 hit box where it was. `ox, oy` is the starting feet on canvas.
   */
  function drawTrail(ctx, anim, frameStarts, now, n, ox, oy, scale, walk) {
    if (!n) return;
    var t0 = Math.floor(now);
    for (var k = n; k >= 1; k--) {
      var t = t0 - k;
      if (t < 0) continue;
      var alpha = 1 - k / (n + 1);
      var st = strikeOnTick(anim, frameStarts, t, walk);
      if (st) {
        var w = st.box.width * scale;
        var h = st.box.height * scale;
        ctx.strokeStyle = 'rgba(255, 51, 85, ' + (0.8 * alpha) + ')';
        ctx.lineWidth = 1;
        ctx.strokeRect(ox + (st.x + st.box.dx) * scale - w / 2, oy + (st.y + st.box.dy) * scale - h / 2, w, h);
      }
      var pr = anim.projectiles;
      if (pr && pr.spawns) {
        pr.spawns.forEach(function(sp) {
          if (t < sp.tick || !sp.path || !sp.path.length) return;
          var p = projectileAt(sp, t - sp.tick, walk);
          if (!p) return;
          var hs = HIT_SIZE * scale;
          ctx.strokeStyle = 'rgba(51, 204, 255, ' + (0.7 * alpha) + ')';
          ctx.strokeRect(ox + p.x * scale - hs / 2, oy + p.y * scale - hs / 2, hs, hs);
        });
      }
    }
  }

  var api = {
    HEIGHT_UNITS: HEIGHT_UNITS,
    nowTick: nowTick,
    positionAt: positionAt,
    hitAt: hitAt,
    sceneBox: sceneBox,
    drawProjectiles: drawProjectiles,
    drawTarget: drawTarget,
    drawSegments: drawSegments,
    drawTrail: drawTrail,
  };
  if (typeof window !== 'undefined') window.SpritesMotion = api;
})();
