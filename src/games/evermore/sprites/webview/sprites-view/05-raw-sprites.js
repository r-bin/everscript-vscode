
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

  // ── Raw Sprites Mode Handling ───────────────────────────────────────────────
  function selectRawSprite(addr) {
    selectedRawAddr = addr;
    if (listEl) {
      listEl.querySelectorAll('.sp-list-item').forEach(function(el) {
        el.classList.toggle('sp-selected', parseInt(el.dataset.addr) === addr);
      });
    }
    loadRawSprite(addr);
    if (rawSideTab === 'palettes') requestRawPaletteGrid();
  }

  function loadRawSprite(addr) {
    if (vsApi) {
      vsApi.postMessage({
        command: 'getRawSprite',
        address: addr,
        paletteAddr: rawPalette,
      });
    }
  }

  if (rawBgSel) {
    rawBgSel.addEventListener('change', function() {
      rawBg = rawBgSel.value;
      var stage = document.getElementById('sp-raw-stage');
      if (!stage) return;
      if (rawBg === 'green') stage.style.background = '#00ff00';
      else if (rawBg === 'light') stage.style.background = '#e0e0e0';
      else if (rawBg === 'none') stage.style.background = 'transparent';
      else stage.style.background = '#121212';
    });
  }

  if (rawPaletteSel) {
    rawPaletteSel.addEventListener('change', function() {
      rawPalette = parseInt(rawPaletteSel.value, 16);
      loadRawSprite(selectedRawAddr);
    });
  }

  function populateRawPalettes() {
    if (!rawPaletteSel) return;
    rawPaletteSel.innerHTML = '';
    var chars = getCharacters();
    if (!chars || !chars.length) return;
    chars.forEach(function(c) {
      if (!c) return;
      var pal = (c.stats && c.stats.palette !== undefined) ? c.stats.palette : 0;
      var opt = document.createElement('option');
      opt.value = pal.toString(16);
      opt.textContent = (c.name || '#' + c.id) + ' (' + (c.paletteAddrHex || '$0000') + ')';
      if (c.id === 0) opt.selected = true;
      rawPaletteSel.appendChild(opt);
    });
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
        renderSpeedReadout();
        if (script) {
          script.renderScript(currentAnimData, {
            character: selectedCharId, paletteAddr: currentPaletteAddr(), facing: currentAnimData ? currentAnimData.facing : selectedFacing,
            // Links in the listing: a sprite opens in the Sprites view, a projectile's animation in Animations.
            onSprite: function(addr) { setMode('raw'); selectRawSprite(addr); },
            onRecord: function(record) {
              var entry = script.findRecord(record);
              if (!entry) return;
              setMode('anims');
              selectAnimationRecord(entry);
            },
          });
          script.renderOwners(currentMode === 'anims' ? pinnedRecord : script.findRecord(requestedRecord));
        }
        // A new character or animation: the palette grid shows its frame, nothing selected.
        if (sideTab === 'palettes' && !recolourOnly) requestPaletteGrid();
        updateFrameUI();
      } else if (data.command === 'paletteGridData') {
        if (data.target === 'raw') renderRawPaletteGrid(data.grid || []);
        else renderPaletteGrid(data.grid || []);
      } else if (data.command === 'thumbsData') {
        if (window.SpritesThumbs) window.SpritesThumbs.onData(data.thumbs);
      } else if (data.command === 'rawSpriteData') {
        var s = data.sprite;
        if (!s) return;
        if (rawName) rawName.textContent = 'Raw Sprite ' + s.addrHex + ' (' + s.width + '×' + s.height + ')';
        if (rawBadge) rawBadge.textContent = s.chunkCount + ' chunks';

        // Render raw chunks
        if (rawChunksBody) {
          rawChunksBody.innerHTML = '';
          (s.chunks || []).forEach(function(ch) {
            var tr = document.createElement('tr');
            var props = [];
            if (ch.large) props.push('16×16'); else props.push('8×8');
            if (ch.flipX) props.push('FlipX');
            if (ch.flipY) props.push('FlipY');
            props.push('Prio ' + ch.priority);

            tr.innerHTML =
              '<td></td>' +
              '<td>' + ch.blockHex + '</td>' +
              '<td>' + ch.x + ', ' + ch.y + '</td>' +
              '<td>' + ch.flagsHex + '</td>' +
              '<td>' + props.join(', ') + '</td>';
            if (window.SpritesThumbs) tr.firstChild.appendChild(window.SpritesThumbs.box({
              key: 'blk:' + ch.block + ':' + (ch.large ? 1 : 0) + ':' + (ch.flipX ? 1 : 0) + (ch.flipY ? 1 : 0) + ':raw:' + rawPalette,
              block: ch.block, large: ch.large, flipX: ch.flipX, flipY: ch.flipY, paletteAddr: rawPalette,
            }));
            rawChunksBody.appendChild(tr);
          });
        }

        // Draw raw canvas
        if (rawCtx && typeof Image === 'function') {
          var img = new Image();
          img.src = s.png;
          img.onload = function() {
            var sc = 3;
            rawCanvas.width = Math.max(s.width * sc + 40, 256);
            rawCanvas.height = Math.max(s.height * sc + 40, 256);
            rawCtx.clearRect(0, 0, rawCanvas.width, rawCanvas.height);
            rawCtx.imageSmoothingEnabled = false;
            var x = Math.floor((rawCanvas.width - s.width * sc) / 2);
            var y = Math.floor((rawCanvas.height - s.height * sc) / 2);
            rawCtx.drawImage(img, x, y, s.width * sc, s.height * sc);
          };
        }
      }
    });
  }

  // ── Init on page load ───────────────────────────────────────────────────────
  try {
    populateRawPalettes();
    renderList();
    var initChars = getCharacters();
    if (initChars && initChars.length > 0) {
      selectCharacter(initChars[0].id);
    }
  } catch (err) {
    if (typeof console !== 'undefined' && console.error) {
      console.error('[Sprites] Init error:', err);
    }
  }
