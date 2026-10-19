// TODO port to TS (docs/todo/port-to-ts.md)

    // Just above the entity the camera follows ($7E:0F42 points into the entity records sampled at
    // $7E:3DDF): x, and y minus the elevation; for the CDL float (cdl-float.js). Null when unknown.
    function gameCameraWorld(m, ps) {
      if (!ps.entBuf) return null;
      const ptr = m.readMemory(0x7E0F42) | (m.readMemory(0x7E0F43) << 8);
      const rel = ptr - 0x3DDF;
      if (rel < 0 || rel + 0x20 > ps.entBuf.length) return null;
      const b = ps.entBuf;
      const sx = v => (v >= 0x8000 ? v - 0x10000 : v);
      const x = sx(b[rel + 0x1A] | (b[rel + 0x1B] << 8));
      const y = sx(b[rel + 0x1C] | (b[rel + 0x1D] << 8)) - sx(b[rel + 0x1E] | (b[rel + 0x1F] << 8));
      return { x, y: y - 40 };
    }

    // A (re)started ROM: forget the room and the sprites of the last one (panel-webview.ts bootRom).
    function gameRomReset() {
      idleSprites.clear();
      idleSpritesWanted = new Set();
      cachedMapId = -1;
      cachedTriggers = null;
      cachedObjects = null;
      cachedLootables = null;
      cachedAnimTiles = null;
      roomObjectsCache.clear();
      roomLootCache.clear();
      roomAnimTilesCache.clear();
      lastRequestedMapId = -1;
      activeRoomMap = null;
      spriteCache.clear();
    }

    // Room pictures and data from the host (host.js roomMap), for the overlays, OBJECTS and LOOT.
    function gameOnRoomMap(data) {
        if (Array.isArray(data.objects)) {
          roomObjectsCache.set(data.mapId, data.objects);
          if (data.mapId === cachedMapId) cachedObjects = data.objects;
        }
        if (Array.isArray(data.lootables)) {
          roomLootCache.set(data.mapId, data.lootables);
          if (data.mapId === cachedMapId) cachedLootables = data.lootables;
        }
        if (data.itemIcons) {
          cachedItemIcons = Object.assign(cachedItemIcons || {}, data.itemIcons);
        }
        if (typeof refreshMenuDataIfOpen === 'function') refreshMenuDataIfOpen();
        if (Array.isArray(data.animTiles)) {
          roomAnimTilesCache.set(data.mapId, data.animTiles);
          if (data.mapId === cachedMapId) cachedAnimTiles = data.animTiles;
        }
        let collImg = null;
        if (data.collisionUri) {
          collImg = new Image();
          collImg.src = data.collisionUri;
          roomCollisionCache.set(data.mapId, collImg);
          if (data.mapId === cachedMapId) cachedCollisionImg = collImg;
        }
        let overImg = null;
        if (data.overlayUri) {
          overImg = new Image();
          overImg.src = data.overlayUri;
          roomOverlayCache.set(data.mapId, overImg);
          if (data.mapId === cachedMapId) cachedOverlayImg = overImg;
        }
        if (data.imageUri) {
          const mapId = data.mapId;
          const img = new Image();
          let fgImg = null;
          if (data.foregroundUri) {
            fgImg = new Image();
            fgImg.src = data.foregroundUri;
          }
          const loadedGroups = [];
          if (Array.isArray(data.animGroups)) {
            for (let i = 0; i < data.animGroups.length; i++) {
              const g = data.animGroups[i];
              const toImg = fUri => {
                const fImg = new Image();
                fImg.src = fUri;
                return fImg;
              };
              const frameImgs = (g.frames || []).map(toImg);
              const fgFrameImgs = Array.isArray(g.fgFrames) ? g.fgFrames.map(toImg) : null;
              loadedGroups.push({
                x: g.x,
                y: g.y,
                w: g.w,
                h: g.h,
                channels: Array.isArray(g.channels) ? g.channels : [],
                chanLens: Array.isArray(g.chanLens) ? g.chanLens : [],
                frames: frameImgs,
                fgFrames: fgFrameImgs,
                frameIdx: 0,
              });
            }
          }
          let layerImgs = null;
          if (data.layers) {
            layerImgs = {};
            for (const k of ['bg1Low', 'bg1High', 'bg2Low', 'bg2High']) {
              const uri = data.layers[k];
              if (!uri) continue;
              layerImgs[k] = new Image();
              layerImgs[k].src = uri;
            }
          }
          let imgLoaded = false;
          let fgLoaded = !data.foregroundUri;
          function tryActivate() {
            if (!imgLoaded || !fgLoaded) return;
            activeRoomMap = {
              mapId: mapId,
              img: img,
              foregroundImg: fgImg,
              collisionImg: collImg,
              overlayImg: overImg,
              layers: layerImgs,
              bgPalette: Array.isArray(data.bgPalette) ? data.bgPalette : null,
              animGroups: loadedGroups,
              width: data.width,
              height: data.height,
              offX: data.offX,
              offY: data.offY,
              objects: data.objects || null,
              animTiles: data.animTiles || null,
            };
            redrawExtendedLayersNow();
          }
          img.onload = function() {
            imgLoaded = true;
            tryActivate();
          };
          if (fgImg) {
            fgImg.onload = function() {
              fgLoaded = true;
              tryActivate();
            };
            fgImg.onerror = function() {
              fgLoaded = true;
              tryActivate();
            };
          }
          img.src = data.imageUri;
        }
    }
  