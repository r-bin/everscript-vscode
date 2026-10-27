import { pageFile } from '../page-file';
import { pageBundle } from '../../webview/page-bundle';

/**
 * emulator/menu/menu-view.ts
 *
 * Owns: the Emulator Quick Menu OSD (On-Screen Display).
 * - Fixed top positioning
 * - 6 Tabs paged with L and R:
 *     0: VIEW (Default - the paused screen undistorted, pan & zoom; room and coordinates for Evermore)
 *     1: OVERLAYS (Extended Map, Triggers, Entities, Anim Tiles, Collision, Fog, Sound FX, Zoom) - all off by default
 *     2: OBJECTS (Section 3 objects list, state 0...max, stepper alters WRAM & engine)
 *     3: LOOT (Chests, Gourds & Sniff spots, preview icon, looted toggle, safe script run)
 *     4: CHEATS
 *     5: EMULATION (Speed 1/4x..4x, Master Audio, Keep Focus, Reset, Soft Reset, Rewind)
 *     6: CONTROLS (Interactive keybinds & gamepad remapper, presets)
 * Tabs 1-4 need Secret of Evermore (data-needs="game", webview/emulator-profile.js).
 * - Non-looping stepped values (Speed: 1/4x, 1/2x, 1x, 2x, 4x; Zoom, toggles)
 * - Up/Down automatic scroll-into-view
 * - Wheel events inside menu scroll the menu instead of the map
 * - Outside clicks/drags on Lens tab pan the map
 * - Sound visualization toggle in menu with script position mapping
 * - Unified Pause / Menu toggle (Start by default, Esc always pauses)
 *
 * Strictly ASCII-only.
 */

import { getMenuSoundScript } from './menu-sound';

function getMenuCss() {
  return pageFile('menu-style');
}

// Pause-menu tabs of the panels (webview/emulator-panels.js EMU_PANEL_MENU_TAB).
const MENU_PANELS: [number, string, string][] = [
  [8, 'cdl', ''],
  [9, 'trace', 'full game'],
  [10, 'stack', 'full game'],
  [11, 'entities', 'full game'],
  [12, 'alchemy', 'full game'],
  [13, 'palettes', 'full game'],
];

// CDL's own rows (cdl-view.ts cdlMenuStep / cdlMenuActivate); below them one row per bank.
const MENU_CDL_ROWS = `
            <div class="menu-row" data-row="1" data-action="cdl-record" title="Record code/data coverage, calls and memory accesses">
              <div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> Recording</div>
              <div class="menu-row-value">
                <button class="menu-stepper-btn" data-step="-1" type="button">&lt;</button>
                <span id="menu-val-cdl-rec" class="menu-pill">OFF</span>
                <button class="menu-stepper-btn" data-step="1" type="button">&gt;</button>
              </div>
            </div>
            <div class="menu-row" data-row="2" data-action="cdl-export" title="Left / Right: what to export, B: export it">
              <div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> Export</div>
              <div class="menu-row-value">
                <button class="menu-stepper-btn" data-step="-1" type="button">&lt;</button>
                <span id="menu-val-cdl-export" class="menu-pill">-</span>
                <button class="menu-stepper-btn" data-step="1" type="button">&gt;</button>
                <span class="menu-action-pill">[B] Export</span>
              </div>
            </div>`;

// TRACE's own row (emulator-panels.js emuPanelMenuAction); Down past it scrolls the trace.
const MENU_TRACE_ROWS = `
            <div class="menu-row" data-row="1" data-action="trace-clear" title="Empty the trace">
              <div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> Clear</div>
              <div class="menu-row-value">
                <span class="menu-action-pill">[B] Clear</span>
              </div>
            </div>`;

// ENTITIES / ALCHEMY / PALETTES: what to list (games/evermore/emulator/bottom-bar-views.ts panelFilterStep / panelFilterLabel).
const MENU_FILTER_PANELS = ['entities', 'alchemy', 'palettes'];
function menuFilterRow(name: string) {
  return `
            <div class="menu-row" data-row="1" data-action="panel-filter" title="What to list (also in the bottom bar)">
              <div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> Show</div>
              <div class="menu-row-value">
                <button class="menu-stepper-btn" data-step="-1" type="button">&lt;</button>
                <span id="menu-val-filter-${name}" class="menu-pill active">All</span>
                <button class="menu-stepper-btn" data-step="1" type="button">&gt;</button>
              </div>
            </div>`;
}

/** `parts`: the game's tabs 1-4 ({ tabButtonsHtml, panelsHtml }, Evermore: games/evermore/emulator/menu-tabs.ts). */
function getMenuHtml(parts: { tabButtonsHtml?: string; panelsHtml?: string } = {}) {
  return `
    <div id="emulator-menu" class="hidden">
      <div id="menu-card">
        <div id="menu-header">
          <button id="menu-l-btn" class="menu-shoulder-btn" type="button" title="Previous Tab (L)">&lt; L</button>
          <div id="menu-tabs">
            <button id="menu-tab-btn-0" class="menu-tab-btn active" type="button" data-tab="0">VIEW</button>
${parts.tabButtonsHtml || ''}
            <button id="menu-tab-btn-7" class="menu-tab-btn" type="button" data-tab="7">REPLAYS</button>
            <button id="menu-tab-btn-8" class="menu-tab-btn" type="button" data-tab="8">CDL</button>
            <button id="menu-tab-btn-9" class="menu-tab-btn" data-needs="full game" type="button" data-tab="9">TRACE</button>
            <button id="menu-tab-btn-10" class="menu-tab-btn" data-needs="full game" type="button" data-tab="10">STACK</button>
            <button id="menu-tab-btn-11" class="menu-tab-btn" data-needs="full game" type="button" data-tab="11">ENTITIES</button>
            <button id="menu-tab-btn-12" class="menu-tab-btn" data-needs="full game" type="button" data-tab="12">ALCHEMY</button>
            <button id="menu-tab-btn-13" class="menu-tab-btn" data-needs="full game" type="button" data-tab="13">PALETTES</button>
            <button id="menu-tab-btn-5" class="menu-tab-btn" type="button" data-tab="5">EMULATION</button>
            <button id="menu-tab-btn-6" class="menu-tab-btn" type="button" data-tab="6">CONTROLS</button>
          </div>
          <button id="menu-r-btn" class="menu-shoulder-btn" type="button" title="Next Tab (R)">R &gt;</button>
          <button id="menu-close-btn" type="button" title="Resume Game (A / Esc)">[X]</button>
        </div>

        <div id="menu-body">
          <!-- Tab 0: VIEW -->
          <div id="menu-panel-0" class="menu-tab-panel active">
            <div class="menu-lens-panel">
              <div class="menu-lens-header" data-needs="game">
                <div class="menu-lens-room" id="menu-lens-room-title">View (Undistorted Room View)</div>
                <div class="menu-lens-coords" id="menu-lens-coords">Cam: (0, 0) | Player: (0, 0)</div>
              </div>
              <div class="menu-row selected" data-row="0" data-action="step-zoom-lens">
                <div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> Zoom / Scale</div>
                <div class="menu-row-value">
                  <button class="menu-stepper-btn" data-step="-1" type="button">&lt;</button>
                  <span id="menu-val-lens-zoom" class="menu-pill">Fit</span>
                  <button class="menu-stepper-btn" data-step="1" type="button">&gt;</button>
                </div>
              </div>
              <div class="menu-row" data-row="1" data-action="action-reset-pan" data-needs="game">
                <div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> Center on Player / Reset Pan</div>
                <div class="menu-row-value">
                  <span class="menu-action-pill">[B] Center</span>
                </div>
              </div>
              <div class="menu-lens-hint-box">
                <div class="menu-lens-hint-title">Navigation:</div>
                <div>&bull; Drag map canvas or use D-Pad / Arrows to pan</div>
                <div>&bull; Mouse wheel to zoom in / out</div>
                <div>&bull; [L] / [R] to switch menus &middot; Esc / Start to resume</div>
              </div>
            </div>
          </div>

${parts.panelsHtml || ''}
                    <!-- Tab 7: REPLAYS (the REPLAYS view is moved in, emulator-panels.js; its rows: webview/replays-list.js) -->
          <div id="menu-panel-7" class="menu-tab-panel menu-panel-host">
            <div id="emu-slot-tas" class="emu-panel-slot"></div>
          </div>

          <!-- Tabs 8-13: the panels, each with where it is shown while playing -->
          ${MENU_PANELS.map(([tab, name, needs]) => `
          <div id="menu-panel-${tab}" class="menu-tab-panel menu-panel-host"${needs ? ` data-needs="${needs}"` : ''}>
            <div class="menu-row" data-row="0" data-action="step-place" title="Where this panel is shown while the game runs">
              <div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> Show while playing</div>
              <div class="menu-row-value">
                <button class="menu-stepper-btn" data-step="-1" type="button">&lt;</button>
                <span id="menu-val-place-${name}" class="menu-pill">Hidden</span>
                <button class="menu-stepper-btn" data-step="1" type="button">&gt;</button>
              </div>
            </div>
            ${name === 'cdl' ? MENU_CDL_ROWS : name === 'trace' ? MENU_TRACE_ROWS : MENU_FILTER_PANELS.includes(name) ? menuFilterRow(name) : ''}
            <div id="emu-slot-${name}" class="emu-panel-slot"></div>
          </div>`).join('')}

          <!-- Tab 5: EMULATION -->
          <div id="menu-panel-5" class="menu-tab-panel">
            <div class="menu-row" data-row="0" data-action="step-speed">
              <div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> Emulation Speed</div>
              <div class="menu-row-value">
                <button class="menu-stepper-btn" data-step="-1" type="button">&lt;</button>
                <span id="menu-val-speed" class="menu-pill">1x</span>
                <button class="menu-stepper-btn" data-step="1" type="button">&gt;</button>
              </div>
            </div>
            <div class="menu-row" data-row="1" data-action="toggle-audio-mute">
              <div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> Master Audio</div>
              <div class="menu-row-value">
                <button class="menu-stepper-btn" data-step="-1" type="button">&lt;</button>
                <span id="menu-val-sound" class="menu-pill active">Normal</span>
                <button class="menu-stepper-btn" data-step="1" type="button">&gt;</button>
              </div>
            </div>
            <div class="menu-row" data-row="2" data-action="toggle-keep-focus" title="Tab and debugger stops leave the focus on the emulator">
              <div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> Keep Focus</div>
              <div class="menu-row-value">
                <button class="menu-stepper-btn" data-step="-1" type="button">&lt;</button>
                <span id="menu-val-focus" class="menu-pill">OFF</span>
                <button class="menu-stepper-btn" data-step="1" type="button">&gt;</button>
              </div>
            </div>
            <div class="menu-row" data-row="3" data-action="toggle-start-menu" title="Start button on keyboard or gamepad opens the menu (same as Esc)">
              <div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> Start button opens menu</div>
              <div class="menu-row-value">
                <button class="menu-stepper-btn" data-step="-1" type="button">&lt;</button>
                <span id="menu-val-start-menu" class="menu-pill">OFF</span>
                <button class="menu-stepper-btn" data-step="1" type="button">&gt;</button>
              </div>
            </div>
            <div class="menu-row" data-row="4" data-action="toggle-game-features" title="Game-specific inspector tabs, overlays, and features (Overlays, Objects, Loot, Cheats, Stack, Trace, Entities)">
              <div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> Game specific features</div>
              <div class="menu-row-value">
                <button class="menu-stepper-btn" data-step="-1" type="button">&lt;</button>
                <span id="menu-val-game-features" class="menu-pill">OFF</span>
                <button class="menu-stepper-btn" data-step="1" type="button">&gt;</button>
              </div>
            </div>
            <div class="menu-row" data-row="5" data-action="toggle-click-walk" title="Right-click on the screen walks the player there (an injected script: it changes the game, and a replay records it)">
              <div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> Right-click walks there</div>
              <div class="menu-row-value">
                <button class="menu-stepper-btn" data-step="-1" type="button">&lt;</button>
                <span id="menu-val-click-walk" class="menu-pill">OFF</span>
                <button class="menu-stepper-btn" data-step="1" type="button">&gt;</button>
              </div>
            </div>
            <div class="menu-row" data-row="6" data-action="action-reset-rom">
              <div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> Reset / Power-Cycle ROM</div>
              <div class="menu-row-value">
                <span class="menu-action-pill">[B] Reset</span>
              </div>
            </div>
            <div class="menu-row" data-row="7" data-action="action-soft-reset">
              <div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> Soft Reset (keeps RAM and save)</div>
              <div class="menu-row-value">
                <span class="menu-action-pill">[B] Reset</span>
              </div>
            </div>
            <div class="menu-row" data-row="8" data-action="action-rewind" title="Back to the previous rewind point: one every 5 s of play, the last 2 minutes; B again goes further back. Recorded, so a replay rewinds too. Key: Backspace">
              <div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> Rewind (Backspace)</div>
              <div class="menu-row-value">
                <span class="menu-action-pill">[B] Rewind</span>
              </div>
            </div>
          </div>

          <!-- Tab 6: CONTROLS -->
          <div id="menu-panel-6" class="menu-tab-panel">
            <div class="menu-device-banner">
              <span id="menu-device-name">Input: Keyboard &amp; Gamepad (both active)</span>
              <span id="menu-device-status" class="menu-device-status">Active</span>
            </div>
            <div class="menu-row" data-row="0" data-action="step-bindpage" title="Which device's buttons are edited below; both work at the same time">
              <div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> Bindings For</div>
              <div class="menu-row-value">
                <button class="menu-stepper-btn" data-step="-1" type="button">&lt;</button>
                <span id="menu-val-bindpage" class="menu-pill active">Keyboard</span>
                <button class="menu-stepper-btn" data-step="1" type="button">&gt;</button>
              </div>
            </div>
            <div id="menu-bind-list" class="menu-keybind-list"></div>
            <div class="menu-preset-row">
              <button id="menu-preset-arrows" class="menu-preset-btn" type="button">Default Arrows</button>
              <button id="menu-preset-wasd" class="menu-preset-btn" type="button">WASD</button>
              <button id="menu-preset-reset" class="menu-preset-btn" type="button">Reset</button>
            </div>
          </div>
        </div>

        <div id="menu-footer">
          <div class="menu-footer-hint">
            <span>[L]/[R]: Tabs</span>
            <span>Up/Down: Select</span>
            <span>Left/Right: Change</span>
            <span>[B]: Action</span>
          </div>
          <div>[A] / Esc: Back</div>
        </div>
      </div>
    </div>
  `;
}

function getMenuClientScript() {
  return pageFile('menu', { sound: getMenuSoundScript(), gamepad: pageBundle('emulator-gamepad') });
}

export { getMenuCss, getMenuHtml, getMenuClientScript };
