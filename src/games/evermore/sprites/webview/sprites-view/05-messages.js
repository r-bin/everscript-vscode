// TODO port to TS (docs/todo/port-to-ts.md)

  function sceneBoxFor(walk) {
    var key = walk + ':' + projectilesOn() + ':' + !!(currentAnimData && currentAnimData.target) + ':' + aggroRange();
    if (sceneCache.data !== currentAnimData || sceneCache.key !== key) {
      var a = currentAnimData;
      sceneCache = {
        data: a, key: key,
        box: motion ? motion.sceneBox(a, { walk: walk, projectiles: projectilesOn(), target: !!a.target })
          : { minX: -a.originX, maxX: a.width - a.originX, minY: -a.originY, maxY: a.height - a.originY },
      };

    }
    return sceneCache.box;
  }

  /** A cached Image for a PNG data URI, or null while it loads (then redraws). */
  function imageFor(png) {
    var img = loadedImages[png];
    if (img) return img;
    if (typeof Image !== 'function') return null;
    img = new Image();
    img.onload = function() { loadedImages[png] = img; drawFrame(); };
    img.src = png;
    return null;
  }

  // ── Backend Message Listener ────────────────────────────────────────────────
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('message', function(event) {
      var data = event.data;
      if (!data) return;

      if (data.command === 'spriteAnimationData') {
        var prevFrame = currentFrameIdx;
        var prevTick = tickCounter;
        currentAnimData = data.animation;
        // A script that loads a palette leaves the character in it, as the game does (+0x75).
        var loaded = currentAnimData && currentAnimData.scriptPalette ? parseInt(currentAnimData.scriptPalette.slice(1), 16) : 0;
        if (loaded && !paletteOverride && loaded !== homePalette) {
          setHomePalette(loaded);
          var hc = getCharacters().find(function(x) { return x.id === selectedCharId; });
          if (hc) renderAnimGrid(hc);
        }
        showStagePalette(currentAnimData);
        currentFrameIdx = 0;
        tickCounter = 0;
        if (keepPlayback && currentAnimData && currentAnimData.frames.length) {
          currentFrameIdx = Math.min(prevFrame, currentAnimData.frames.length - 1);
          tickCounter = prevTick;
        }
        var recolourOnly = keepPlayback;
        keepPlayback = false;
        frameStartTicks = [];
        var acc = 0;
        ((currentAnimData && currentAnimData.frames) || []).forEach(function(f) { frameStartTicks.push(acc); acc += f.ticks; });
        flightTail = 0;
        var pr = currentAnimData && currentAnimData.projectiles;
        ((pr && pr.spawns) || []).forEach(function(sp) {
          flightTail = Math.max(flightTail, sp.tick + (sp.path ? sp.path.length : 0) + 1 - acc);
        });
        renderScrubTicks();
        renderSpeedReadout();
        if (script) {
          script.renderScript(currentAnimData, {
            character: selectedCharId, paletteAddr: currentPaletteAddr(), facing: currentAnimData ? currentAnimData.facing : selectedFacing,
            // Links in the listing: a sprite opens its soe:// page, a projectile's animation plays here (under All).
            onSprite: openSprite,
            onRecord: function(record) {
              var entry = script.findRecord(record);
              if (!entry) return;
              pickedRecord = entry;
              animFilter = 'all';
              var rc = getCharacters().find(function(x) { return x.id === selectedCharId; });
              if (rc) renderAnimGrid(rc);
              loadCurrentAnimation();
            },
          });
          script.renderOwners(script.findRecord(requestedRecord));
        }
        // A new character or animation: the palette grid shows its frame, nothing selected.
        if (sideTab === 'palettes' && !recolourOnly) requestPaletteGrid();
        updateFrameUI();
      } else if (data.command === 'paletteGridData') {
        renderPaletteGrid(data.grid || []);
      } else if (data.command === 'thumbsData') {
        if (window.SpritesThumbs) window.SpritesThumbs.onData(data.thumbs);
      }
    });
  }
