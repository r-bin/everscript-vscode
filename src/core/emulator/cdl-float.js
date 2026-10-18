'use strict';

/**
 * emulator/cdl-float.js
 *
 * Scrolling-combat-text for CDL coverage: when a ROM bank's coverage grows, a
 * "C4 +0.8%" number rises from the active character (entity pointer at
 * $7E0F42) and fades out; the centre of the screen when the character is off
 * screen. Gains of one tick are batched per bank; size grows with the gain.
 *
 * Invariant: ASCII only, no backslashes in the client script (template literal).
 */

function getCdlFloatCss() {
  return `
    #cdl-float-layer { position: absolute; inset: 0; pointer-events: none; z-index: 15; overflow: hidden; }
    .cdl-float {
      position: absolute; transform: translate(-50%, 0); white-space: nowrap;
      font-family: monospace; font-weight: bold; color: #ffe066;
      text-shadow: 0 0 2px #000, 1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000;
      animation: cdl-float-rise 1.8s ease-out both;
    }
    .cdl-float small { color: #fff; font-size: 0.7em; margin-right: 3px; }
    @keyframes cdl-float-rise {
      0%   { opacity: 0; transform: translate(-50%, 6px) scale(0.8); }
      12%  { opacity: 1; transform: translate(-50%, 0) scale(1.08); }
      25%  { transform: translate(-50%, -6px) scale(1); }
      100% { opacity: 0; transform: translate(-50%, -64px) scale(1); }
    }
  `;
}

function getCdlFloatHtml() {
  return `<div id="cdl-float-layer"></div>`;
}

function getCdlFloatScript() {
  return `
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
  `;
}

module.exports = { getCdlFloatCss, getCdlFloatHtml, getCdlFloatScript };
