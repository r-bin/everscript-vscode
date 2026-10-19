// TODO port to TS (docs/todo/port-to-ts.md)

    // -- CDL coverage floating text ----------------------------------------------
    const CDL_FLOAT_MAX = 6;          // banks shown per tick; the rest wait for the next one
    const CDL_FLOAT_MIN_PCT = 0.01;   // smaller gains accumulate until they reach this
    const cdlFloatPending = new Map(); // bank label -> accumulated percent

    function cdlFloatAnchor() {
      const layer = document.getElementById('cdl-float-layer');
      const layout = lastLayout;
      if (!layer || !layout) return null;
      const center = { x: layout.emuX + layout.emuW / 2, y: layout.emuY + layout.emuH / 2 };
      const m = getModule();
      const ps = lastSampledPreState;
      // Where the game's camera follows (Evermore: overlays-view.js gameCameraWorld), in world pixels.
      const at = m && ps && typeof gameCameraWorld === 'function' ? gameCameraWorld(m, ps) : null;
      if (!at) return center;
      const px = layout.emuX + (at.x - layout.camX) * layout.scaleSnes;
      const py = layout.emuY + (at.y - layout.camY) * layout.scaleSnes;
      const inside = px >= layout.emuX && px <= layout.emuX + layout.emuW && py >= layout.emuY && py <= layout.emuY + layout.emuH;
      return inside ? { x: px, y: py } : center;
    }

    /** Called once per tick with { label: percentGained } for the banks that grew. */
    function cdlFloatGains(gains) {
      if (!emuGameRom || typeof gameCameraWorld !== 'function') return;   // the anchor is the game's camera entity
      for (const label in gains) cdlFloatPending.set(label, (cdlFloatPending.get(label) || 0) + gains[label]);
      const ready = [...cdlFloatPending].filter(e => e[1] >= CDL_FLOAT_MIN_PCT).sort((a, b) => b[1] - a[1]).slice(0, CDL_FLOAT_MAX);
      if (!ready.length) return;
      const layer = document.getElementById('cdl-float-layer');
      const anchor = cdlFloatAnchor();
      if (!layer || !anchor) return;
      // one column above the character, biggest gain lowest, each line a beat later
      let y = anchor.y;
      ready.forEach((entry, i) => {
        const label = entry[0], pct = entry[1];
        cdlFloatPending.delete(label);
        const el = document.createElement('div');
        el.className = 'cdl-float';
        const size = 13 + Math.min(13, Math.sqrt(pct) * 6);
        el.style.fontSize = size.toFixed(1) + 'px';
        el.style.left = (anchor.x + (i % 2 ? 6 : -6)) + 'px';
        el.style.top = y.toFixed(0) + 'px';
        y -= size + 3;
        el.style.animationDelay = (i * 0.15).toFixed(2) + 's';
        el.innerHTML = '<small>' + label + '</small>+' + (pct < 0.1 ? pct.toFixed(2) : pct.toFixed(1)) + '%';
        el.addEventListener('animationend', () => el.remove());
        layer.appendChild(el);
      });
    }
  