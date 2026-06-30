'use strict';
// Owner: memory_radar/render-docs-tab.js
// Renders the static Docs and RNG tab HTML.
// Pure functions — no state, no imports, no VS Code dependency.
// Content: physical damage, alchemy, hit%, atlas, map loading, script, evs, plugin docs.
// RNG content: Naris, Prophet, Egg mechanics.

function buildDocsTabHtml() {
    return (
        '<div class="tab-pane" data-tab="docs" style="display:none">' +
        '<div class="doc-wrap">' +
        '<div class="doc-subnav">' +
        '<button class="doc-btn doc-btn-active" data-doc="damage">Damage</button>' +
        '<button class="doc-btn" data-doc="alchemy">Offensive Alchemy</button>' +
        '<button class="doc-btn" data-doc="hit">Hit%</button>' +
        '<button class="doc-btn" data-doc="atlas">Atlas Glitch</button>' +
        '<button class="doc-btn" data-doc="mapload">Map Loading</button>' +
        '<button class="doc-btn" data-doc="script">Script</button>' +
        '<button class="doc-btn" data-doc="evs">Everscript</button>' +
        '<button class="doc-btn" data-doc="plugin">Plugin</button>' +
        '</div>' +
        '<div class="doc-content">' +
        '<div class="doc-sec" data-doc="damage">' +
        '<h3 class="doc-h">Physical Damage</h3>' +
        '<div class="doc-fact">Formula from soestuff.lua. The 8-bit RNG seed varies each attack, producing a range of outcomes.</div>' +
        '<pre class="doc-code">w = ~((def\u00f74 - atk) - 1) &amp; 0xFFFF\nif w &lt; 1 or w \u2265 0x8000: w = 1\nseed = hi16((w+1)\u00d7rng16)\na = (seed + w) mod 65536\ndmg = ((((a \u226a 1) mod 65536) + w + carry(a)) mod 65536) \u00bb 2\nshown = min(999, dmg)</pre>' +
        '<div class="doc-sliders"><label>atk <input id="doc-atk" type="range" min="0" max="255" value="45"><span id="doc-atk-num">45</span></label>' +
        '<label>def <input id="doc-def" type="range" min="0" max="255" value="28"><span id="doc-def-num">28</span></label></div>' +
        '<div id="doc-dmg-chart"></div>' +
        '</div>' +
        '<div class="doc-sec" data-doc="alchemy" style="display:none">' +
        '<h3 class="doc-h">Offensive Alchemy</h3>' +
        '<div class="doc-fact">Grounded today: offensive alchemy uses the traced projectile path. Cast-side spell power comes from the ROM level table and hit damage multiplies that projectile power by <code>(0x40 - magic_defense) / 0x40</code>. Research notes also point at a projectile-slot <code>POWER</code> field for projectile alchemy.</div>' +
        '<pre class="doc-code">base_might = ROM16[0x45E6B + spell_id*2]\nlevel_scale = [2,4,7,11,15,20,26,32,39,46][spell_level]\nspell_power_at_level = ceil(base_might * level_scale / 4)\nspell_bonus_base = floor(base_might * level_scale / 4)\nprojectile_power = spell_power_at_level + floor(spell_bonus_base * rng16 / 65536)\nshown = floor(projectile_power * (0x40 - magic_defense) / 0x40)</pre>' +
        '<div class="doc-sliders"><label>spell <select id="doc-al-spell" class="sc-sel"></select></label>' +
        '<label>spell level <input id="doc-al-spell-lv" type="range" min="0" max="9" value="0"><span id="doc-al-spell-lv-num">0</span></label>' +
        '<label>magic_defense <input id="doc-al-mdef" type="range" min="0" max="64" value="51"><span id="doc-al-mdef-num">51</span></label></div>' +
        '<div class="doc-fact">Projectile alchemy research note: active alchemy attack slots start at <code>7E3564</code>, each slot is <code>0x76</code> bytes, and the projectile struct field at <code>+0x2A/+0x2B</code> is labeled <code>POWER</code> or damage in outside notes. Full throw+hit traces are the right place to trace how spell, level, and source stats feed that field.</div>' +
        '<div id="doc-al-chart"></div>' +
        '</div>' +
        '<div class="doc-sec" data-doc="hit" style="display:none">' +
        '<h3 class="doc-h">Hit Chance</h3>' +
        '<div class="doc-fact">Two-level ROM table lookup. The in-game <em>hit_rate</em> display value is NOT the actual chance to hit.</div>' +
        '<pre class="doc-code">off_a   = \u230a(evade + 1) / 2\u230b &amp; ~1\nev_ptr  = ROM16[$8FBAAF + off_a]\noff_b   = ((hit_rate + 1) &amp; ~3) / 2\nhit%    = ROM16[$8F0000 + off_b + ev_ptr] / 0x7FFF \u00d7 100</pre>' +
        '<div id="doc-hit-table"></div>' +
        '</div>' +
        '<div class="doc-sec" data-doc="atlas" style="display:none">' +
        '<h3 class="doc-h">Atlas Glitch \u2014 Boy Attack Underflow</h3>' +
        '<ul class="doc-bullets">' +
        '<li>This is not the Atlas Amulet item.</li>' +
        '<li>The glitch subtracts a value from the boy\'s attack; when the subtraction exceeds the current attack, the 16-bit stat underflows into the range 65056\u201365535.</li>' +
        '<li>That wrapped attack feeds the normal physical-damage routine, but atlas-underflow cases take the high-word multiply path in the RNG helper. That is why the result is usually 999, but not always 999.</li>' +
        '<li>This panel is a <b>manual post-subtraction preview</b>. It does not yet compute the subtraction from stamina or from the exact setup used in real runs.</li>' +
        '<li>The RNG slider below picks one concrete 16-bit RNG state. The bar summarizes all 65536 states for the same boy-atk / manual subtract / def inputs.</li>' +
        '</ul>' +
        '<pre class="doc-code">atk_underflow = (boy_atk - subtract) mod 65536\nw = ~((def\u00f74 - atk_underflow) - 1) &amp; 0xFFFF\nseed = hi16((w+1)\u00d7rng16)\na = (seed + w) mod 65536\ndmg = ((((a \u226a 1) mod 65536) + w + carry(a \u226a 1)) mod 65536) \u00bb 2\nshown = min(999, dmg)</pre>' +
        '<div class="doc-sliders"><label>boy atk <input id="doc-at-atk" type="range" min="0" max="255" value="81"><span id="doc-at-atk-num">81</span></label>' +
        '<label>manual subtract <input id="doc-at-sub" type="range" min="0" max="480" value="480"><span id="doc-at-sub-num">480</span></label>' +
        '<label>def <input id="doc-at-def" type="range" min="0" max="255" value="160"><span id="doc-at-def-num">160</span></label>' +
        '<label>rng16 <input id="doc-at-rng" type="range" min="0" max="65535" value="0"><span id="doc-at-rng-num">0</span></label></div>' +
        '<div id="doc-at-chart"></div>' +
        '</div>' +
        '<div class="doc-sec" data-doc="mapload" style="display:none">' +
        '<h3 class="doc-h">Map Loading</h3>' +
        '<div class="doc-fact">Current status: the exact room-payload codec is still not fully decoded. This section records the grounded loader model from room metadata, trigger-table parsing, breakpoint tracing, and truncation tests.</div>' +
        '<pre class="doc-code">map[33 / "Prehistoria - Strong Heart\'s Exterior"]\ndata     = 0xADB50C\nsize     = 0x0455 (confirmed)\nstep_len = ROM16[0xADB519] = 0x000C = 2 entries\nb_len    = ROM16[0xADB527] = 0x0000\npayload  = 0xADB529 .. 0xADB960</pre>' +
        '<ul class="doc-bullets">' +
        '<li>Each room points at one variable-size blob. For room <b>0x33</b>, the blob begins at <b>0xADB50C</b> and ends at <b>0xADB960</b> because the next room starts immediately after it.</li>' +
        '<li>The first <b>13 bytes</b> are room metadata. Only bytes <b>0</b> and <b>1</b> are currently named with confidence: they behave like <code>trig_off_x</code> and <code>trig_off_y</code>. Bytes <b>2..12</b> are still unknown header fields.</li>' +
        '<li>At offset <b>0x0D</b> the blob switches to trigger tables: <code>step_len</code>, then 6-byte step-on entries; after that comes <code>b_len</code> and the B-trigger entries.</li>' +
        '<li>For room <b>0x33</b> that means: metadata at <b>0xADB50C..0xADB518</b>, step-on table at <b>0xADB519..0xADB526</b>, B-table length at <b>0xADB527..0xADB528</b>, then the room payload from <b>0xADB529</b> onward.</li>' +
        '</ul>' +
        '<div class="doc-val"><b>Working loader model</b></div>' +
        '<ul class="doc-bullets">' +
        '<li>1. Resolve the room\'s <code>data</code> pointer from the map table and hand it to the loader.</li>' +
        '<li>2. The breakpoint at <b>0x908F80</b> (<code>LDA [$8B],Y</code>) shows the routine streaming bytes from the current room blob through the indirect pointer in <code>$8B</code>.</li>' +
        '<li>3. The loader consumes metadata and trigger-table lengths first, then continues into the remaining room payload.</li>' +
        '<li>4. Truncation tests show the payload tail controls collision and hitbox first: deleting bytes from the end removes collision before visible tiles.</li>' +
        '<li>5. Deleting more bytes erases the room from the bottom-right upward, which strongly suggests the decoded output fills later map addresses last.</li>' +
        '<li>6. When the visual payload is mostly gone, the room can still load as a walkable black square: room state and bounds remain valid even though tile and collision data are missing.</li>' +
        '</ul>' +
        '<pre class="doc-code">908F80  B7 8B          LDA [$8B],Y\n$8B = current room blob pointer\nY   = current byte offset inside that blob</pre>' +
        '<div class="doc-val"><b>How that becomes the hut picture</b></div>' +
        '<ul class="doc-bullets">' +
        '<li>The Strong Heart exterior picture is not stored as one flat bitmap. The room payload after the trigger tables is decoded into the room\'s visual and collision buffers.</li>' +
        '<li>The two step-on records only describe the doorway transitions. They do not describe the hut image itself.</li>' +
        '<li>Because the image disappears from bottom-right first when the payload tail is cut, later payload bytes correspond to later-placed tiles in the final room image.</li>' +
        '<li>The black walkable square is the same room after payload loss: enter logic and room origin still exist, but the art and collision payload are no longer complete.</li>' +
        '<li>The current 6-byte trigger-record model matches the in-repo parser notes, but the external SoE tiles viewer C++ source was not re-verified inside this workspace.</li>' +
        '<li>Still open: header bytes 2..12, the exact codec commands, whether graphics and collision are interleaved or split, and the precise buffer layout used before the picture is shown.</li>' +
        '</ul>' +
        '</div>' +
        '<div class="doc-sec" data-doc="script" style="display:none">' +
        '<h3 class="doc-h">Script Opcodes</h3>' +
        '<div class="doc-fact">SoE scripts are event-driven. Each room has up to 4 trigger types: <b>enter</b> (room load), <b>step-on</b> (tile), <b>B-button</b> (interact), <b>global</b>.</div>' +
        '<div class="doc-fact">Opcodes are 1-byte commands followed by 0\u2013N 16-bit word arguments. The Rooms tab shows decoded triggers per room.</div>' +
        '<div style="opacity:.3;margin-top:12px;font-size:10px">Full opcode reference \u2014 coming soon.</div>' +
        '</div>' +
        '<div class="doc-sec" data-doc="evs" style="display:none">' +
        '<h3 class="doc-h">Everscript</h3>' +
        '<div class="doc-fact">High-level scripting language that compiles to SoE opcodes. Supports maps, triggers, if/else, function calls, persistence flags, and inline memory references.</div>' +
        '<div class="doc-fact">Source lives in <code>in/</code>. Entry point is typically <code>in/kaizo/main.evs</code>. Compile: <code>python everscript.py &lt;input&gt;</code>.</div>' +
        '<div style="opacity:.3;margin-top:12px;font-size:10px">Language reference \u2014 coming soon.</div>' +
        '</div>' +
        '<div class="doc-sec" data-doc="plugin" style="display:none">' +
        '<h3 class="doc-h">Radar Plugin</h3>' +
        '<div class="doc-fact"><b>Memory:</b> WRAM usage map for the current function scope. Cells show lifecycle (temp / session / sram / system). Click a cell for details and source lines.</div>' +
        '<div class="doc-fact"><b>Rooms:</b> per-room trigger breakdown \u2014 entrances, step-on, B-triggers, sniff spots. Live mode shows rooms from .evs; Vanilla mode lists all 120 vanilla rooms.</div>' +
        '<div class="doc-fact"><b>Scaling:</b> physical damage calculator plus a level-0 offensive alchemy preview using spell might and enemy magic defense.</div>' +
        '<div class="doc-fact"><b>Docs:</b> this page \u2014 hard facts about game mechanics and tools.</div>' +
        '</div>' +
        '</div></div>' +
        '</div>'
    );
}

function buildRngTabHtml() {
    return (
        '<div class="tab-pane" data-tab="rng" style="display:none">' +
        '<div class="rng-wrap">' +
        '<div class="rng-section">' +
        '<div class="rng-h">Naris \u2014 Super Heal</div>' +
        '<div class="rng-desc">Coin flip: the winning value is bit 0 of the game timer when the dialogue opens. 10,000-unit cooldown between attempts. Already owning Super Heal skips to the equip menu.</div>' +
        '<div class="rng-stats">' +
        '<div class="rng-stat"><div class="rng-stat-label">Chance / try</div><div class="rng-stat-val">50%</div></div>' +
        '<div class="rng-stat"><div class="rng-stat-label">Avg attempts</div><div class="rng-stat-val">2</div></div>' +
        '</div>' +
        '<div class="rng-sim-row"><button class="rng-sim-btn" id="rng-naris-btn">Simulate 10,000\xd7</button><div class="rng-sim-out" id="rng-naris-out"></div></div>' +
        '<div class="rng-hist" id="rng-naris-hist"></div>' +
        '</div>' +
        '<div class="rng-section">' +
        '<div class="rng-h">Prophet \u2014 Bronze Armor</div>' +
        '<div class="rng-desc">3-arc state machine (prophecy 0\u20135, meta 6\u20138, chaos 9+). Reach state\u00a08 (VIDEO_GAME) for Bronze Armor. State\u00a05 is a permanent tilt lock. Chaos recovers to state\u00a06 with 1/8 probability per round (or always when interaction count\u00a0>\u00a029).</div>' +
        '<table class="rng-tbl">' +
        '<thead><tr><th>#</th><th>Codename</th><th>Reach 8</th><th>Reach 5</th><th>Next states (odds)</th></tr></thead>' +
        '<tbody>' +
        '<tr class="rng-arc-proph"><td>0</td><td class="codename">DOOM</td><td>~22%</td><td>~17%</td><td>1=28/32, 6=2/32, 9+=2/32</td></tr>' +
        '<tr class="rng-arc-proph"><td>1</td><td class="codename">CATACLYSM</td><td>~24%</td><td>~19%</td><td>2=28/32, 6=2/32, 9+=2/32</td></tr>' +
        '<tr class="rng-arc-proph"><td>2</td><td class="codename">EVIL_LEADER</td><td>~27%</td><td>~22%</td><td>3=28/32, 6=2/32, 9+=2/32</td></tr>' +
        '<tr class="rng-arc-proph"><td>3</td><td class="codename">DIAMOND_EYES</td><td>~34%</td><td>25%</td><td>4=16/32, 6=9/32, 9+=7/32</td></tr>' +
        '<tr class="rng-arc-proph"><td>4</td><td class="codename">STATUE_CORE</td><td>~46%</td><td>50%</td><td>5=16/32, 6=9/32, 9+=7/32</td></tr>' +
        '<tr class="rng-arc-tilt"><td>5</td><td class="codename">I_HAVE_SPOKEN</td><td>0%</td><td>100%</td><td>locked until reset</td></tr>' +
        '<tr class="rng-st-divert rng-arc-meta"><td>6</td><td class="codename">CONTROLLED_BY_OVERLORD</td><td>~66%</td><td>~0.5%</td><td>7=26/32, 0\u20133=3/32, 9+=3/32</td></tr>' +
        '<tr class="rng-arc-meta"><td>7</td><td class="codename">SPRITES</td><td>~81%</td><td>~0.2%</td><td>8=26/32, 0\u20133=3/32, 9+=3/32</td></tr>' +
        '<tr class="rng-st-target rng-arc-meta"><td>8</td><td class="codename">VIDEO_GAME</td><td>100%</td><td>0%</td><td>\u2605 reward</td></tr>' +
        '<tr class="rng-arc-chaos"><td>9</td><td class="codename">GOAT_WARNING</td><td rowspan="11">~18%</td><td rowspan="11">~3%</td><td rowspan="11">chaos=7/8, 6=1/8</td></tr>' +
        '<tr class="rng-arc-chaos"><td>10</td><td class="codename">CHICKEN_RAISE</td></tr>' +
        '<tr class="rng-arc-chaos"><td>11</td><td class="codename">WHITE_ZONE</td></tr>' +
        '<tr class="rng-arc-chaos"><td>12</td><td class="codename">NOODLES</td></tr>' +
        '<tr class="rng-arc-chaos"><td>13</td><td class="codename">GOAT_SNEEZE</td></tr>' +
        '<tr class="rng-arc-chaos"><td>14</td><td class="codename">HOKEY_POKEY</td></tr>' +
        '<tr class="rng-arc-chaos"><td>15</td><td class="codename">FORTUNE_COOKIES</td></tr>' +
        '<tr class="rng-arc-chaos"><td>16</td><td class="codename">SECOND_GOAT_SECRET</td></tr>' +
        '<tr class="rng-arc-chaos"><td>17</td><td class="codename">PENGUINS</td></tr>' +
        '<tr class="rng-arc-chaos"><td>18</td><td class="codename">I_AM_A_FISH</td></tr>' +
        '<tr class="rng-arc-chaos"><td>19</td><td class="codename">FUSELAGE</td></tr>' +
        '</tbody></table>' +
        '<div class="rng-strat-row">' +
        '<label class="rng-pot-lbl">Profile: <select id="rng-prophet-strat" class="rng-sel">' +
        '<option value="mash">Just mash (might tilt)</option>' +
        '<option value="reset4chaos">Reset at 4 + chaos</option>' +
        '<option value="reset4" selected>Reset at 4 only</option>' +
        '<option value="metaonly">Meta arc only (6\u20138)</option>' +
        '</select></label>' +
        '<div class="rng-strat-desc" id="rng-prophet-strat-desc"></div>' +
        '</div>' +
        '<div class="rng-sim-row"><button class="rng-sim-btn" id="rng-prophet-btn">Simulate 10,000\xd7</button><div class="rng-sim-out" id="rng-prophet-out"></div></div>' +
        '<div class="rng-hist" id="rng-prophet-hist"></div>' +
        '</div>' +
        '<div class="rng-section">' +
        '<div class="rng-h">Egg \u2014 Chocobo Egg</div>' +
        '<div class="rng-desc">Hidden reward inside ceramic pots at the Nobilia market. Buying 5 pots triggers reward check at 3/8; buying 10 pots is worse at 3/16. After a triggered reward, 1/16 chance for the Chocobo Egg (otherwise jewels). Buying 1 pot never triggers a reward.</div>' +
        '<div class="rng-stats">' +
        '<div class="rng-stat"><div class="rng-stat-label">5-pot chance</div><div class="rng-stat-val">2.34%</div></div>' +
        '<div class="rng-stat"><div class="rng-stat-label">Avg (5 pots)</div><div class="rng-stat-val">~43</div></div>' +
        '<div class="rng-stat"><div class="rng-stat-label">10-pot chance</div><div class="rng-stat-val">1.17%</div></div>' +
        '<div class="rng-stat"><div class="rng-stat-label">Avg (10 pots)</div><div class="rng-stat-val">~85</div></div>' +
        '</div>' +
        '<div class="rng-sim-row">' +
        '<label class="rng-pot-lbl">Buy: <select id="rng-pot-sel" class="rng-sel"><option value="5" selected>5 pots (optimal)</option><option value="10">10 pots</option></select></label>' +
        '<button class="rng-sim-btn" id="rng-egg-btn">Simulate 10,000\xd7</button>' +
        '<div class="rng-sim-out" id="rng-egg-out"></div>' +
        '</div>' +
        '<div class="rng-hist" id="rng-egg-hist"></div>' +
        '</div>' +
        '</div>' +
        '</div>'
    );
}

module.exports = { buildDocsTabHtml, buildRngTabHtml };
