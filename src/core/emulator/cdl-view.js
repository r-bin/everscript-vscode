'use strict';

const { pageFile } = require('./page-file');

/**
 * emulator/cdl-view.js
 *
 * The emulator's CDL panel (placed by webview/emulator-panels.js: side bar, bottom bar or
 * only its pause-menu tab): record toggle (off by default), ROM
 * coverage strips (one per 64 KB, one pixel per byte), WRAM access strips
 * ($7E / $7F), Asar / WRAM export buttons and the xref lookup box (full extension),
 * the "export bundle" button (SNES CDL Recorder).
 * Only the bottom bar shows all of it. The pause-menu tab keeps the usual card: the
 * buttons become its "Recording" and "Export" rows (cdlMenuStep / cdlMenuActivate), each
 * bank is a row that can be selected but does nothing, no legend, lookup or hover half.
 * The side bar shows only the ROM strips, stretched over its height (emulator-panels.css).
 *
 * Recording state lives in the core (cdl.c). While recording and not paused,
 * one 1 s tick consumes the core's dirty chunks: it recounts their coverage
 * (feeding the floating gains, cdl-float.js), repaints them when the tab is
 * visible, and every CDL_DRAIN_TICKS ticks drains a delta to the host. Paused
 * or off, nothing runs. Not recording, the tab shows the library's last
 * flushed state (requested once, read-only). Strip painting and hover text:
 * cdl-strips.js.
 *
 * Invariant: ASCII only, and no backslashes in the client script (it is
 * embedded in a template literal, see panel-webview.js).
 */

function getCdlCss() {
  return pageFile('cdl.css');
}

function getCdlTabButtonHtml() {
  return `<button id="ss-tab-cdl" class="ss-tab" type="button">CDL (<span id="ss-cdl-count">off</span>)</button>`;
}

// index = colour id used by the client script
const LEGEND = [
  ['unreached', '#101010'], ['empty', '#2f4f4f'], ['opcode', '#ffff00'], ['operand', '#9acd32'],
  ['data', '#ffdead'], ['pointer', '#da70d6'], ['graphics (DMA)', '#ffb6c1'], ['music (APU)', '#add8e6'],
  ['M/X conflict', '#ff4040'],
  ['read', '#3d7fd9'], ['written', '#e08a2e'], ['read+written', '#b05fd6'], ['by scripts', '#4ec9b0'], ['code', '#ffffff'],
  ['HDMA table', '#ff8c00'], ['by DMA', '#8a8a8a'],
];
const WRAM_LEGEND_START = 9;
const LEGEND_HDMA = 14, LEGEND_WRAM_DMA = 15;

function getCdlViewHtml() {
  const item = ([name, color]) => `<span><i style="background:${color}"></i>${name}</span>`;
  const legend = '<b>ROM</b>' + LEGEND.slice(0, WRAM_LEGEND_START).concat([LEGEND[LEGEND_HDMA]]).map(item).join('')
    + '<b>WRAM</b>' + LEGEND.slice(WRAM_LEGEND_START, LEGEND_HDMA).concat([LEGEND[LEGEND_WRAM_DMA]]).map(item).join('');
  return `
    <div id="ss-view-cdl" class="ss-tab-view">
      <div class="ss-subbar">
        <button id="cdl-toggle" class="ss-btn" type="button" title="Record code/data coverage, calls and memory accesses (in memory; written to disk only when something changed)">start recording</button>
        <button id="cdl-flush" class="ss-btn" type="button" disabled>flush now</button>
        <button id="cdl-export-bundle" class="ss-btn" data-needs="recorder" type="button" title="Zip this ROM's recording and its replays to share (no ROM bytes)">export bundle</button>
        <button id="cdl-export-asm" class="ss-btn" data-needs="full" type="button" title="Write an Asar project (byte-exact) and open main.asm">export asar</button>
        <button id="cdl-export-wram" class="ss-btn" data-needs="full" type="button" title="Write ram.asm: every WRAM address with its accessors and enum guesses">export wram</button>
        <input id="cdl-lookup-input" class="ss-search-input" data-needs="full" type="text" spellcheck="false" placeholder="who? 7E4E57 / C0:8000" />
        <button id="cdl-lookup-btn" class="ss-btn" data-needs="full" type="button">who?</button>
        <span id="cdl-status">recording off</span>
      </div>
      <div id="cdl-legend">${legend}</div>
      <div id="cdl-body">
        <div id="cdl-banks"><div id="cdl-empty">Recording is off. Start it to map which ROM bytes run as code, which are read as data,
who calls each function and who reads or writes each WRAM address (including which script
instruction did it). Data is kept per ROM in the extension's storage and merges across
sessions, so the game does not have to be finished in one sitting.<span data-needs="full"> Click a strip to look up
that address.</span></div></div>
        <div id="cdl-side" data-needs="full">
          <div id="cdl-hover">&nbsp;</div>
          <pre id="cdl-lookup-out"></pre>
        </div>
      </div>
    </div>
  `;
}

function getCdlClientScript() {
  const colors = LEGEND.map(([, c]) => '[' + [1, 3, 5].map(i => parseInt(c.substr(i, 2), 16)).join(',') + ']').join(',');
  return pageFile('cdl.js', { colors });
}

module.exports = { getCdlCss, getCdlTabButtonHtml, getCdlViewHtml, getCdlClientScript };
