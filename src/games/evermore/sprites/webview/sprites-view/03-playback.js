// TODO port to TS (docs/todo/port-to-ts.md)

  document.querySelectorAll('.sp-scale-btn').forEach(function(b) {
    b.addEventListener('click', function() {
      document.querySelectorAll('.sp-scale-btn').forEach(function(x) { x.classList.remove('sp-active'); });
      b.classList.add('sp-active');
      animScale = parseInt(b.dataset.scale);
      drawFrame();
    });
  });

  if (trailInput) trailInput.addEventListener('change', drawFrame);
  [chkTarget, targetDist].forEach(function(el) {
    if (el) el.addEventListener('change', loadCurrentAnimation);
  });
  if (chkWalk) chkWalk.addEventListener('change', updateFrameUI);
  [chkBody, chkHurt, chkStrike, chkOrigin, chkProj, chkWalk, chkAggro].forEach(function(chk) {
    if (chk) chk.addEventListener('change', drawFrame);
  });

  if (btnPlay) {
    btnPlay.addEventListener('click', function() {
      isPlaying = !isPlaying;
      btnPlay.textContent = isPlaying ? '⏸' : '▶';
    });
  }

  if (btnLoop) {
    btnLoop.addEventListener('click', function() {
      isLooping = !isLooping;
      btnLoop.classList.toggle('sp-active', isLooping);
    });
  }

  if (btnPrev) {
    btnPrev.addEventListener('click', function() {
      if (!currentAnimData || !currentAnimData.frames.length) return;
      currentFrameIdx = (currentFrameIdx - 1 + currentAnimData.frames.length) % currentAnimData.frames.length;
      tickCounter = 0;
      updateFrameUI();
    });
  }

  if (btnNext) {
    btnNext.addEventListener('click', function() {
      if (!currentAnimData || !currentAnimData.frames.length) return;
      currentFrameIdx = (currentFrameIdx + 1) % currentAnimData.frames.length;
      tickCounter = 0;
      updateFrameUI();
    });
  }

  if (scrubber) {
    scrubber.addEventListener('input', function() {
      currentFrameIdx = parseInt(scrubber.value);
      tickCounter = 0;
      updateFrameUI();
    });
  }

  if (speedSel) {
    speedSel.addEventListener('change', function() {
      playbackSpeed = parseFloat(speedSel.value) || 1;
    });
  }

  if (spriteAddrLink) {
    spriteAddrLink.addEventListener('click', function() {
      if (!currentAnimData || !currentAnimData.frames[currentFrameIdx]) return;
      var f = currentAnimData.frames[currentFrameIdx];
      setMode('raw');
      selectRawSprite(f.spriteAddr);
    });
  }

  // ── Animation Loop ──────────────────────────────────────────────────────────
  var raf = typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame
    : (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
      ? window.requestAnimationFrame.bind(window)
      : function(cb) { return setTimeout(cb, 16); });

  function animationLoop(timestamp) {
    raf(animationLoop);
    if (!lastRafTime) lastRafTime = timestamp;
    var delta = timestamp - lastRafTime;
    lastRafTime = timestamp;

    if (!isPlaying || !currentAnimData || !currentAnimData.frames.length) return;

    var snesTickMs = (1000 / 60) / playbackSpeed;
    tickCounter += delta / snesTickMs;

    var curFrame = currentAnimData.frames[currentFrameIdx];
    var holdTicks = curFrame && curFrame.ticks > 0 ? curFrame.ticks : 1;
    // Projectiles that outlive the cycle (a boomerang's lap) finish before it loops:
    // the last frame holds while they fly.
    if (currentFrameIdx === currentAnimData.frames.length - 1) holdTicks += flightTail;

    if (tickCounter >= holdTicks) {
      tickCounter -= holdTicks;
      if (currentFrameIdx + 1 < currentAnimData.frames.length) {
        currentFrameIdx++;
        updateFrameUI();
        return;
      } else if (isLooping) {
        // A flier still in the air loops back to where its motion started repeating.
        var from = currentAnimData.loopFrom || 0;
        currentFrameIdx = 0;
        for (var i = 0; i < frameStartTicks.length; i++) if (frameStartTicks[i] <= from) currentFrameIdx = i;
        tickCounter = from - (frameStartTicks[currentFrameIdx] || 0);
        updateFrameUI();
        return;
      }
    }
    // Walking, jumping and projectiles change between frame changes: redraw every tick.
    if (animatesBetweenFrames()) drawFrame();
  }
  raf(animationLoop);

  // ── Update Frame & Canvas Drawing ───────────────────────────────────────────
  function updateFrameUI() {
    if (!currentAnimData || !currentAnimData.frames.length) {
      // No script, or a script that draws nothing: clear what the last one left.
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (frameInfo) frameInfo.textContent = currentAnimData ? 'Draws nothing' : 'No animation';
      if (spriteAddrLink) spriteAddrLink.textContent = '—';
      renderChunks([]);
      if (script) script.highlight(null);
      return;
    }
    var cur = currentAnimData.frames[currentFrameIdx];
    if (!cur) return;

    if (scrubber) {
      scrubber.max = currentAnimData.frames.length - 1;
      scrubber.value = currentFrameIdx;
    }

    if (frameInfo) {
      var isLast = currentFrameIdx === currentAnimData.frames.length - 1;
      frameInfo.textContent = 'Frame ' + (currentFrameIdx + 1) + '/' + currentAnimData.frames.length + ' (' + cur.ticks + ' ticks' +
        (isLast && flightTail > 0 ? ', then ' + flightTail + ' of flight' : '') +
        (cur.random ? ', random ' + cur.random[0] + '–' + cur.random[1] : '') + ')' +
        (cur.spawns && cur.spawns.length ? ' · throws ' + cur.spawns.map(function(sp) { return '$' + sp.id.toString(16); }).join(', ') : '') +
        motionText(cur) + targetText(cur) + modeText(cur.mode);
    }

    if (spriteAddrLink) {
      spriteAddrLink.textContent = cur.spriteHex;
    }

    // Update Chunks table and the script lines behind this frame
    renderChunks(cur.chunks || []);
    if (script) script.highlight(cur);

    // Draw canvas
    drawFrame();
  }

  /**
   * Mode (+0x16) bits by everscript's ATTRIBUTE_FLAGS.FLAGS_7 names; bit $20 is also the
   * one the hit test refuses a target for.
   */
  var MODE_BITS = [[0x01, 'knockback'], [0x02, '$02'], [0x04, 'walking'], [0x08, 'running'], [0x10, 'attacking'], [0x20, 'casting/dodging (invulnerable)'],
    [0x4000, 'charging: contact damage'], [0x8000, 'charging: contact damage']];
  function modeText(mode) {
    if (!mode) return '';
    var names = MODE_BITS.filter(function(b) { return mode & b[0]; }).map(function(b) { return b[1]; });
    if (mode & 0x3fc0) names.push('$' + (mode & 0x3fc0).toString(16));
    return ' · mode ' + names.join(', ');
  }

  /** Spawn flags (+0x05 → entity +0x10) by everscript's FLAG_ENEMY names. */
  var SPAWN_FLAG_BITS = [[0x0001, 'inactive+invisible'], [0x0002, 'invincible'], [0x0004, 'party/bombable'], [0x0020, 'inactive'], [0x0040, 'mosquito'], [0x0400, 'phasing'], [0x1000, 'invisible+invincible+inactive']];
  function spawnFlagsText(v) {
    var names = SPAWN_FLAG_BITS.filter(function(b) { return v & b[0]; }).map(function(b) { return b[1]; });
    var rest = v & ~SPAWN_FLAG_BITS.reduce(function(m, b) { return m | b[0]; }, 0);
    if (rest) names.push('$' + rest.toString(16));
    return names.length ? names.join(', ') : 'none';
  }

  /** Which ticks of this frame reach the target, if one is on stage. */
  function targetText(frame) {
    var t = currentAnimData && currentAnimData.target;
    if (!t || !t.hits) return '';
    var hits = walkOn() ? t.hits : (t.hitsStill || t.hits);
    var start = frameStartTicks[currentFrameIdx] || 0;
    var end = start + frame.ticks + (currentFrameIdx === currentAnimData.frames.length - 1 ? flightTail : 0);
    var n = hits.melee.filter(function(k) { return k >= start && k < end; }).length +
      (hits.contact || []).filter(function(k) { return k >= start && k < end; }).length +
      hits.projectile.filter(function(p) { return p.tick >= start && p.tick < end; }).length;
    return n ? ' · hits ' + t.name + ' (' + n + ' tick' + (n === 1 ? '' : 's') + ')' : '';
  }

  /** Where the frame ends up: x/y from the start and height, when the animation moves. */
  function motionText(frame) {
    if (!currentAnimData || !currentAnimData.moves || !frame.motion || !frame.motion.length) return '';
    var m = frame.motion[frame.motion.length - 1];
    var sign = function(v) { return (v > 0 ? '+' : '') + v; };
    var peak = 0;
    frame.motion.forEach(function(p) { peak = Math.max(peak, p[2]); });
    return ' · x ' + sign(m[0]) + ' y ' + sign(m[1]) + (peak ? ' · up to ' + (peak / 16).toFixed(1) + ' px high' : '');
  }

  function renderChunks(chunks) {
    if (!chunksBody) return;
    chunksBody.innerHTML = '';
    if (chunksCount) chunksCount.textContent = '(' + chunks.length + ' chunks)';
    var pal = currentPaletteAddr();
    chunks.forEach(function(ch) {
      var tr = document.createElement('tr');
      var props = [];
      if (ch.large) props.push('16×16'); else props.push('8×8');
      if (ch.flipX) props.push('FlipX');
      if (ch.flipY) props.push('FlipY');
      props.push('Prio ' + ch.priority);
      var palBits = (ch.flags >> 1) & 7;
      if (palBits) props.push('Palette 2');
      tr.innerHTML =
        '<td></td>' +
        '<td>' + ch.blockHex + '</td>' +
        '<td>' + ch.x + ', ' + ch.y + '</td>' +
        '<td>' + ch.flagsHex + '</td>' +
        '<td>' + props.join(', ') + '</td>';
      if (window.SpritesThumbs) tr.firstChild.appendChild(window.SpritesThumbs.box({
        key: 'blk:' + ch.block + ':' + (ch.large ? 1 : 0) + ':' + (ch.flipX ? 1 : 0) + (ch.flipY ? 1 : 0) + ':' + palBits + ':' + selectedCharId + ':' + pal,
        block: ch.block, large: ch.large, flipX: ch.flipX, flipY: ch.flipY, pal: palBits, character: selectedCharId, paletteAddr: pal,
      }));
      chunksBody.appendChild(tr);
    });
  }

  function drawFrame() {
    if (!ctx || !currentAnimData || !currentAnimData.frames.length) return;
    var cur = currentAnimData.frames[currentFrameIdx];
    if (!cur) return;

    // Draw everything else even while this frame's image loads (it redraws when it
    // arrives), so a frame never shows the previous animation's sprite.
    var img = cur.png ? imageFor(cur.png) : null;

    var a = currentAnimData;
    var walk = walkOn();
    var box = sceneBoxFor(walk);

    // The canvas is the stage: a fixed surface centred on the character, its walk path, its
    // projectiles and the target. Aggro and trails draw over it and never rescale it.
    var stage = canvas.parentElement;
    var W = Math.max(200, stage ? stage.clientWidth : 320);
    var H = Math.max(200, stage ? stage.clientHeight : 320);
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;
    // The character's own sprite box sits in the middle of the stage, whatever floats over it;
    // the scale shrinks until the rest of the scene fits on both sides of it.
    var pad = 24;
    var midX = a.width / 2 - a.originX;
    var midY = a.height / 2 - a.originY;
    var halfW = Math.max(1, midX - box.minX, box.maxX - midX);
    var halfH = Math.max(1, midY - box.minY, box.maxY - midY);
    var scale = Math.min(animScale, (W / 2 - pad) / halfW, (H / 2 - pad) / halfH);
    if (scale >= 1) scale = Math.floor(scale * 2) / 2;   // half steps: whole steps waste most of the stage

    // Where the feet stood at the start, then where they are now.
    var ox = Math.floor(W / 2 - midX * scale);
    var oy = Math.floor(H / 2 - midY * scale);
    var pos = motion ? motion.positionAt(a, currentFrameIdx, tickCounter, walk) : { x: 0, y: 0, z: 0 };
    var cx = ox + pos.x * scale;
    var cy = oy + pos.y * scale;
    var lift = pos.z * scale;

    // The second sprite slot (the shadow) stays on the ground; height lifts the sprite.
    if (cur.shadowPng && a.shadow) {
      var sh = imageFor(cur.shadowPng);
      if (sh) ctx.drawImage(sh, cx - a.shadow.originX * scale, cy - a.shadow.originY * scale, a.shadow.width * scale, a.shadow.height * scale);
    }
    if (img) ctx.drawImage(img, cx - a.originX * scale, cy - lift - a.originY * scale, a.width * scale, a.height * scale);
    if (motion && cur.segments) motion.drawSegments(ctx, a, cur, tickCounter, cx, cy, lift, scale, imageFor);

    var chars = getCharacters();
    var c = chars.find(function(x) { return x.id === selectedCharId; });
    var r = c && c.hitbox ? c.hitbox.radius : 0;

    // Overlay 1: Body Hitbox (2r × r) — the ground footprint, so it stays on the ground
    if (chkBody && chkBody.checked && r > 0) {
      var bw = r * 2 * scale;
      var bh = r * scale;
      // Charging (mode & $C000): running into another body deals contact damage ($8FB52C).
      var charging = !!cur.contact;
      var contactHit = charging && motion && motion.hitAt(a, motion.nowTick(frameStartTicks, currentFrameIdx, tickCounter), walkOn()) === 'contact';
      ctx.setLineDash(charging ? [5, 2] : []);
      ctx.strokeStyle = charging ? '#ff5577' : '#00f0a0';
      ctx.lineWidth = charging ? 2 : 1.5;
      ctx.strokeRect(cx - bw / 2, cy - bh / 2, bw, bh);
      ctx.setLineDash([]);
      ctx.fillStyle = contactHit ? 'rgba(255, 51, 85, 0.5)' : charging ? 'rgba(255, 85, 119, 0.18)' : 'rgba(0, 240, 160, 0.15)';
      ctx.fillRect(cx - bw / 2, cy - bh / 2, bw, bh);
      if (charging) {
        ctx.fillStyle = '#ff8fa3';
        ctx.font = '11px sans-serif';
        ctx.fillText('contact damage', cx - bw / 2, cy - bh / 2 - 4);
      }
    }

    // Overlay 2: Hurt region — half-size r centred on the feet ($8FB63A), on the ground.
    // Height is a separate test: 30 px or more up, a ground-level attack cannot reach it.
    if (chkHurt && chkHurt.checked && r > 0) {
      var hw = r * 2 * scale;
      var outOfReach = a.reach && pos.z16 >= a.reach.above;
      // Centred on feet + (+0x42, 16 + +0x44): the hit test's own offsets ($8FB63D).
      var off = hurtOffsetNow(cur);
      var hx = cx + off[0] * scale;
      var hy = cy + (16 + off[1]) * scale;
      var shielded = !!cur.invulnerable;      // mode bit $20: the hit test skips it ($8FB61E)
      ctx.setLineDash(outOfReach ? [4, 3] : shielded ? [2, 2] : []);
      ctx.strokeStyle = outOfReach ? '#888888' : shielded ? '#b48cff' : '#ffaa00';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(hx - hw / 2, hy - hw / 2, hw, hw);
      ctx.setLineDash([]);
      if (!outOfReach && !shielded) {
        ctx.fillStyle = 'rgba(255, 170, 0, 0.10)';
        ctx.fillRect(hx - hw / 2, hy - hw / 2, hw, hw);
      } else {
        ctx.fillStyle = shielded ? '#b48cff' : '#aaaaaa';
        ctx.font = '11px sans-serif';
        ctx.fillText(shielded ? 'invulnerable' : 'out of reach', hx - hw / 2, hy + hw / 2 + 12);
      }
    }

    // Overlay 3: Strike Box, centred at (dx, dy) from the feet; red-filled harder when it lands
    var activeStrike = cur.strikeBox;      // exactly the ticks the script runs it
    if (chkStrike && chkStrike.checked && activeStrike) {
      var sw = activeStrike.width * scale;
      var shh = activeStrike.height * scale;
      var sx = cx + activeStrike.dx * scale - sw / 2;
      var sy = cy + activeStrike.dy * scale - shh / 2;   // on the ground; its height is the body's
      ctx.strokeStyle = '#ff3355';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx, sy, sw, shh);
      ctx.fillStyle = motion && motion.hitAt(a, motion.nowTick(frameStartTicks, currentFrameIdx, tickCounter), walkOn()) === 'melee'
        ? 'rgba(255, 51, 85, 0.55)' : 'rgba(255, 51, 85, 0.25)';
      ctx.fillRect(sx, sy, sw, shh);
    }

    // Aggro: |dx| < range and |dy| < range from the feet ($8FD72D) — a square, not a circle
    var range = aggroRange();
    if (range > 0) {
      var rs = range * scale;
      var inside = a.target && Math.abs(a.target.x - pos.x) < range && Math.abs(a.target.y - pos.y) < range;
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = inside ? '#c6ff8a' : 'rgba(155, 227, 143, 0.7)';
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - rs, cy - rs, rs * 2, rs * 2);
      ctx.setLineDash([]);
      if (inside) { ctx.fillStyle = 'rgba(155, 227, 143, 0.08)'; ctx.fillRect(cx - rs, cy - rs, rs * 2, rs * 2); }
      ctx.fillStyle = 'rgba(155, 227, 143, 0.9)';
      ctx.font = '11px sans-serif';
      ctx.fillText('aggro ' + range + ' px' + (inside ? ' · target inside' : ''), cx - rs + 4, cy - rs + 13);
    }

    // Fading damage of the last few ticks, when a trail length is set
    if (motion && trailTicks() > 0) motion.drawTrail(ctx, a, frameStartTicks, motion.nowTick(frameStartTicks, currentFrameIdx, tickCounter), trailTicks(), ox, oy, scale, walk);

    // The second character, drawn before projectiles so they fly over it
    if (motion && a.target) motion.drawTarget(ctx, a, motion.nowTick(frameStartTicks, currentFrameIdx, tickCounter), ox, oy, scale, imageFor, walk);

    // Overlay 4: Projectiles in flight, from where the thrower stood
    if (motion && projectilesOn()) {
      motion.drawProjectiles(ctx, a, motion.nowTick(frameStartTicks, currentFrameIdx, tickCounter), ox, oy, scale, walk, imageFor);
    }

    // Overlay 5: Origin Crosshair (+) on the ground, and a line up to the body when airborne
    if (chkOrigin && chkOrigin.checked) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy); ctx.lineTo(cx + 8, cy);
      ctx.moveTo(cx, cy - 8); ctx.lineTo(cx, cy + 8);
      if (lift > 0) { ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - lift); }
      ctx.stroke();
      if (walk && (pos.x || pos.y)) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.beginPath();
        ctx.moveTo(ox - 4, oy); ctx.lineTo(ox + 4, oy);
        ctx.moveTo(ox, oy - 4); ctx.lineTo(ox, oy + 4);
        ctx.stroke();
      }
    }
  }
