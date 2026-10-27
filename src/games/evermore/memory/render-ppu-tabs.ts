// Ownership: HTML markup builders for PPU memory spaces (CGRAM, OAM, VRAM)
// sub-panes of the Memory tab (memory/render-radar.ts). Pure functions.

import { bgr555 } from '../../../platform/snes/tiles';

export interface PaletteEntry {
    bgr: number;
    hex: string;
    r5: number;
    g5: number;
    b5: number;
    r8: number;
    g8: number;
    b8: number;
}

export interface SubPalette {
    id: number;
    kind: 'bg' | 'obj';
    name: string;
    tag: string;
    colors: PaletteEntry[];
}

export interface SpriteSlot {
    id: number;
    x: number;
    y: number;
    tile: number;
    pal: number;
    priority: number;
    hFlip: boolean;
    vFlip: boolean;
    size: '8x8' | '16x16';
    name?: string;
    active: boolean;
}

function hex2(n: number): string {
    return n.toString(16).toUpperCase().padStart(2, '0');
}
function hex4(n: number): string {
    return n.toString(16).toUpperCase().padStart(4, '0');
}

function toColor(bgr: number): PaletteEntry {
    const [r8, g8, b8] = bgr555(bgr);
    const r5 = bgr & 0x1f;
    const g5 = (bgr >> 5) & 0x1f;
    const b5 = (bgr >> 10) & 0x1f;
    const hex = `#${hex2(r8)}${hex2(g8)}${hex2(b8)}`;
    return { bgr, hex, r5, g5, b5, r8, g8, b8 };
}

/** Authentic Secret of Evermore initial / default palettes */
function createDefaultCgram(): SubPalette[] {
    const pals: SubPalette[] = [];

    // BG 0: System / HUD / Dialogue
    const bg0Words = [0x0000, 0x6739, 0x0000, 0x5c00, 0x4c55, 0x0a56, 0x04ed, 0x0044, 0x3e49, 0x0044, 0x0afd, 0x04ed, 0x0000, 0x56b5, 0x0000, 0x000e];
    pals.push({ id: 0, kind: 'bg', name: 'BG 0: System & HUD', tag: 'Text boxes, menus, screen backdrop', colors: bg0Words.map(toColor) });

    // BG 1–7: Tile Families (Evermore room tileset from $9CC322)
    const bg1Words = [0x0000, 0x0421, 0x0442, 0x0863, 0x0c84, 0x0ca5, 0x10c6, 0x14e7, 0x1908, 0x1929, 0x1d4a, 0x216b, 0x258c, 0x25ad, 0x29ce, 0x2def];
    pals.push({ id: 1, kind: 'bg', name: 'BG 1: Tile Family 0', tag: 'Terrain / Grassland floor', colors: bg1Words.map(toColor) });

    const bg2Words = [0x0000, 0x0008, 0x0013, 0x0137, 0x0178, 0x01b8, 0x01d9, 0x021a, 0x025a, 0x029b, 0x02dc, 0x0f1d, 0x1f5d, 0x2b9e, 0x3bdf, 0x47ff];
    pals.push({ id: 2, kind: 'bg', name: 'BG 2: Tile Family 1', tag: 'Cliffs / Rock walls', colors: bg2Words.map(toColor) });

    const bg3Words = [0x0000, 0x0090, 0x006e, 0x044b, 0x0829, 0x050c, 0x0804, 0x0803, 0x0801, 0x0d5c, 0x04f6, 0x639d, 0x367d, 0x03e0, 0x03e0, 0x0000];
    pals.push({ id: 3, kind: 'bg', name: 'BG 3: Tile Family 2', tag: 'Foliage / Forest canopy', colors: bg3Words.map(toColor) });

    const bg4Words = [0x0000, 0x7bff, 0x73bd, 0x677b, 0x5b19, 0x4ed7, 0x4295, 0x3a33, 0x2df1, 0x35ae, 0x2d6c, 0x252a, 0x20c8, 0x1886, 0x1044, 0x0402];
    pals.push({ id: 4, kind: 'bg', name: 'BG 4: Tile Family 3', tag: 'Water / Pathways', colors: bg4Words.map(toColor) });

    const bg5Words = [0x0000, 0x4f39, 0x36f7, 0x4e54, 0x3a10, 0x318d, 0x216c, 0x2109, 0x1cc7, 0x14a5, 0x1084, 0x0c63, 0x0842, 0x0822, 0x0421, 0x0000];
    pals.push({ id: 5, kind: 'bg', name: 'BG 5: Tile Family 4', tag: 'Dungeon / Stone structures', colors: bg5Words.map(toColor) });

    const bg6Words = [0x0000, 0x0000, 0x0421, 0x0421, 0x0422, 0x0842, 0x0843, 0x0c63, 0x1084, 0x1cc8, 0x0000, 0x1485, 0x0000, 0x0000, 0x56b5, 0x0000];
    pals.push({ id: 6, kind: 'bg', name: 'BG 6: Tile Family 5', tag: 'Shading / Accents', colors: bg6Words.map(toColor) });

    const bg7Words = [0x0000, 0x42d7, 0x4295, 0x4273, 0x3a31, 0x3252, 0x2e31, 0x2e11, 0x2df0, 0x2def, 0x25ad, 0x296b, 0x1d6a, 0x1929, 0x14e7, 0x0443];
    pals.push({ id: 7, kind: 'bg', name: 'BG 7: Tile Family 6', tag: 'Decorative Props', colors: bg7Words.map(toColor) });

    // OBJ 0–3: Dynamic / Spell slots (unallocated zeroes)
    for (let i = 0; i < 4; i++) {
        pals.push({
            id: i + 8,
            kind: 'obj',
            name: `OBJ ${i}: Dynamic Slot`,
            tag: i === 2 ? 'Spell theft slot ($90CE92)' : 'Unallocated / Free slot',
            colors: new Array(16).fill(0).map(toColor),
        });
    }

    // OBJ 4: Active Entity / NPC
    const obj4Words = [0x0000, 0x4a76, 0x3dbf, 0x35b4, 0x291e, 0x18be, 0x2513, 0x1478, 0x1d0b, 0x0c71, 0x2868, 0x0423, 0x73bf, 0x0004, 0x0000, 0x0000];
    pals.push({ id: 12, kind: 'obj', name: 'OBJ 4: Villager NPC', tag: 'Townsperson / Friendly NPC', colors: obj4Words.map(toColor) });

    // OBJ 5: Enemy / Creature
    const obj5Words = [0x0000, 0x59f8, 0x51b6, 0x4974, 0x1041, 0x3039, 0x28ac, 0x206a, 0x1848, 0x3ca9, 0x3487, 0x4566, 0x1c45, 0x1424, 0x0000, 0x0000];
    pals.push({ id: 13, kind: 'obj', name: 'OBJ 5: Active Creature', tag: 'Wild enemy / Wildlife', colors: obj5Words.map(toColor) });

    // OBJ 6: The Boy
    const obj6Words = [0x0000, 0x7fbc, 0x4edf, 0x2dba, 0x1913, 0x1489, 0x728b, 0x6586, 0x44c3, 0x025e, 0x0537, 0x0491, 0x52d8, 0x2df0, 0x1c85, 0x0000];
    pals.push({ id: 14, kind: 'obj', name: 'OBJ 6: The Boy', tag: 'Primary Hero', colors: obj6Words.map(toColor) });

    // OBJ 7: The Dog
    const obj7Words = [0x0000, 0x7fbc, 0x7eaa, 0x7923, 0x4eb6, 0x1d4d, 0x3e11, 0x212a, 0x0c86, 0x0c63, 0x4534, 0x2cf4, 0x24cd, 0x10aa, 0x1063, 0x0000];
    pals.push({ id: 15, kind: 'obj', name: 'OBJ 7: The Dog', tag: 'Companion', colors: obj7Words.map(toColor) });

    return pals;
}

/** Authentic Secret of Evermore sample 128 hardware sprite list */
function createDefaultOam(): SpriteSlot[] {
    const slots: SpriteSlot[] = [];

    // The Boy (composite of 16x16 and 8x8 chunks at center screen)
    slots.push({ id: 0, x: 120, y: 104, tile: 0x40, pal: 6, priority: 3, hFlip: false, vFlip: false, size: '16x16', name: 'Boy: Head/Hair', active: true });
    slots.push({ id: 1, x: 120, y: 120, tile: 0x42, pal: 6, priority: 3, hFlip: false, vFlip: false, size: '16x16', name: 'Boy: Torso/Vest', active: true });
    slots.push({ id: 2, x: 120, y: 136, tile: 0x44, pal: 6, priority: 3, hFlip: false, vFlip: false, size: '8x8', name: 'Boy: Left Foot', active: true });
    slots.push({ id: 3, x: 128, y: 136, tile: 0x45, pal: 6, priority: 3, hFlip: false, vFlip: false, size: '8x8', name: 'Boy: Right Foot', active: true });

    // The Dog (companion positioned beside Boy)
    slots.push({ id: 4, x: 148, y: 120, tile: 0x60, pal: 7, priority: 3, hFlip: false, vFlip: false, size: '16x16', name: 'Dog: Body', active: true });
    slots.push({ id: 5, x: 160, y: 114, tile: 0x62, pal: 7, priority: 3, hFlip: false, vFlip: false, size: '16x16', name: 'Dog: Head', active: true });
    slots.push({ id: 6, x: 148, y: 136, tile: 0x64, pal: 7, priority: 3, hFlip: false, vFlip: false, size: '8x8', name: 'Dog: Paws', active: true });

    // Villager NPC (standing nearby)
    slots.push({ id: 7, x: 184, y: 96, tile: 0x80, pal: 4, priority: 2, hFlip: false, vFlip: false, size: '16x16', name: 'NPC: Head/Hat', active: true });
    slots.push({ id: 8, x: 184, y: 112, tile: 0x82, pal: 4, priority: 2, hFlip: false, vFlip: false, size: '16x16', name: 'NPC: Dress/Gown', active: true });

    // Shadow / Particles
    slots.push({ id: 9, x: 124, y: 140, tile: 0x08, pal: 0, priority: 1, hFlip: false, vFlip: false, size: '8x8', name: 'Boy: Shadow', active: true });
    slots.push({ id: 10, x: 152, y: 140, tile: 0x08, pal: 0, priority: 1, hFlip: false, vFlip: false, size: '8x8', name: 'Dog: Shadow', active: true });

    // Slots 11–127: Unallocated / Offscreen
    for (let i = 11; i < 128; i++) {
        slots.push({ id: i, x: 0, y: 224, tile: 0x00, pal: 0, priority: 0, hFlip: false, vFlip: false, size: '8x8', active: false });
    }

    return slots;
}

export function buildCgramTabHtml(): string {
    const pals = createDefaultCgram();
    let bgHtml = '';
    let objHtml = '';

    for (const p of pals) {
        let swatches = '';
        for (let i = 0; i < p.colors.length; i++) {
            const c = p.colors[i];
            const isTrans = i === 0;
            const cls = 'cgram-swatch' + (isTrans ? ' cgram-trans' : '');
            const style = isTrans ? '' : `background-color: ${c.hex};`;
            const title = `${p.name} #${i} · BGR $${hex4(c.bgr)} · ${c.hex} (R:${c.r5} G:${c.g5} B:${c.b5})`;
            swatches += `<div class="${cls}" style="${style}" title="${title}" data-bgr="${c.bgr}" data-hex="${c.hex}" data-pal="${p.name}" data-idx="${p.id * 16 + i}" data-r5="${c.r5}" data-g5="${c.g5}" data-b5="${c.b5}" data-r8="${c.r8}" data-g8="${c.g8}" data-b8="${c.b8}" data-offset="$${hex4((p.id * 16 + i) * 2)}"></div>`;
        }

        const row = `<div class="cgram-row">` +
            `<div class="cgram-row-lbl" title="${p.name}: ${p.tag}">${p.name}</div>` +
            `<div class="cgram-swatches">${swatches}</div>` +
            `</div>`;

        if (p.kind === 'bg') bgHtml += row;
        else objHtml += row;
    }

    return '<div class="mem-sub-pane ppu-pane cgram-pane" data-mem="cgram" style="display:none">' +
        '<div class="ppu-top">' +
        '<span class="ppu-title">CGRAM (Color Generator RAM)</span>' +
        '<div class="ppu-stats"><b>512</b> bytes · <b>256</b> colors · 16 palettes × 16 colors (15-bit BGR555)</div>' +
        '<div class="ppu-seg" role="group">' +
        '<button class="ppu-seg-btn ppu-on" data-cgram-filter="all">All (16)</button>' +
        '<button class="ppu-seg-btn" data-cgram-filter="bg">BG (0–7)</button>' +
        '<button class="ppu-seg-btn" data-cgram-filter="obj">Sprites (0–7)</button>' +
        '</div>' +
        '</div>' +
        '<div class="ppu-body cgram-body">' +
        '<div class="cgram-left">' +
        '<div class="cgram-section" data-sec="bg">' +
        '<div class="cgram-sec-title">Background Palettes (0–7) · Room Tile Families & HUD</div>' +
        bgHtml +
        '</div>' +
        '<div class="cgram-section" data-sec="obj">' +
        '<div class="cgram-sec-title">Sprite Palettes (0–7) · Characters, Companion, & Enemies</div>' +
        objHtml +
        '</div>' +
        '</div>' +
        '<div class="cgram-right">' +
        '<div class="ppu-card cgram-inspector">' +
        '<div class="cgram-preview-box">' +
        '<div class="cgram-swatch-large" id="cgram-insp-swatch" style="background-color: #673900"></div>' +
        '<div>' +
        '<div class="cgram-insp-name" id="cgram-insp-name">BG 0: System & HUD #1</div>' +
        '<div class="cgram-insp-tag" id="cgram-insp-tag">Hover or click any color swatch</div>' +
        '</div>' +
        '</div>' +
        '<div class="ppu-meta-grid">' +
        '<div class="ppu-meta-row"><span class="k">Color Index:</span><span class="v" id="cgram-insp-idx">#1 (CGRAM $002)</span></div>' +
        '<div class="ppu-meta-row"><span class="k">BGR555 Word:</span><code class="v" id="cgram-insp-bgr">$6739</code></div>' +
        '<div class="ppu-meta-row"><span class="k">RGB888 Hex:</span><code class="v" id="cgram-insp-hex">#CED399</code></div>' +
        '<div class="ppu-meta-row"><span class="k">5-bit RGB:</span><span class="v" id="cgram-insp-rgb5">R:25 G:25 B:12</span></div>' +
        '<div class="ppu-meta-row"><span class="k">8-bit RGB:</span><span class="v" id="cgram-insp-rgb8">rgb(206, 211, 153)</span></div>' +
        '<div class="ppu-meta-row"><span class="k">Byte Offset:</span><code class="v" id="cgram-insp-offset">$0002</code></div>' +
        '</div>' +
        '<div class="cgram-note-box">' +
        '<b>Hardware & Engine Facts:</b><br>' +
        '• Color 0 of each sub-palette acts as transparency for sprites & overlay tiles.<br>' +
        '• Color 0 of BG 0 ($000) is the global screen backdrop.<br>' +
        '• BG 1–7 are populated from Tile Families ($9CC322) via DMA $8085FA.<br>' +
        '• Slots OBJ 6 & 7 are dedicated to the Boy and Dog ($90CD80).' +
        '</div>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '</div>';
}

export function buildOamTabHtml(): string {
    const sprites = createDefaultOam();
    let rowsHtml = '';
    let screenBoxes = '';

    for (const s of sprites) {
        const cls = 'oam-tr' + (s.active ? ' oam-active' : ' oam-offscreen');
        const palColor = s.pal === 6 ? '#50c8ff' : s.pal === 7 ? '#ff9955' : s.pal === 4 ? '#88e077' : '#aaaaaa';
        const pip = `<span class="oam-pal-pip" style="background-color:${palColor}"></span>`;
        const posText = `${s.x}, ${s.y}` + (s.y >= 224 ? ' (off)' : '');

        rowsHtml += `<tr class="${cls}" data-slot="${s.id}" data-x="${s.x}" data-y="${s.y}" data-name="${s.name || ''}">` +
            `<td>#${s.id}</td>` +
            `<td>${posText}</td>` +
            `<td>${s.size}</td>` +
            `<td><code>$${hex2(s.tile)}</code></td>` +
            `<td>${pip}OBJ ${s.pal}</td>` +
            `<td>${s.priority}</td>` +
            `<td>${s.hFlip ? 'H' : '-'}${s.vFlip ? 'V' : '-'}</td>` +
            `</tr>`;

        if (s.active && s.y < 224) {
            const w = s.size === '16x16' ? 16 : 8;
            const h = s.size === '16x16' ? 16 : 8;
            screenBoxes += `<div class="oam-sprite-box" data-slot="${s.id}" style="left:${s.x}px;top:${s.y}px;width:${w}px;height:${h}px;" title="#${s.id}: ${s.name} (${s.size} at ${s.x},${s.y})">${s.id}</div>`;
        }
    }

    return '<div class="mem-sub-pane ppu-pane oam-pane" data-mem="oam" style="display:none">' +
        '<div class="ppu-top">' +
        '<span class="ppu-title">OAM (Object Attribute Memory)</span>' +
        '<div class="ppu-stats"><b>544</b> bytes · <b>128</b> hardware sprites · 512B low + 32B high table</div>' +
        '<div class="ppu-seg" role="group">' +
        '<button class="ppu-seg-btn ppu-on" data-oam-filter="active">Active (On-Screen)</button>' +
        '<button class="ppu-seg-btn" data-oam-filter="all">All (128)</button>' +
        '</div>' +
        '<div class="ppu-seg" role="group">' +
        '<button class="ppu-seg-btn ppu-on" data-oam-zoom="1">1x</button>' +
        '<button class="ppu-seg-btn" data-oam-zoom="2">1.5x</button>' +
        '</div>' +
        '</div>' +
        '<div class="ppu-body oam-body">' +
        '<div class="oam-left">' +
        '<div class="oam-screen-wrapper">' +
        '<div class="oam-screen-hdr">SNES SCREEN VIEWPORT (256 × 224)</div>' +
        '<div class="oam-screen-viewport" id="oam-viewport">' +
        screenBoxes +
        '</div>' +
        '</div>' +
        '</div>' +
        '<div class="oam-right">' +
        '<div class="oam-table-wrapper">' +
        '<table class="ppu-table oam-table">' +
        '<thead>' +
        '<tr>' +
        '<th>Slot</th><th>Pos (X,Y)</th><th>Size</th><th>Tile</th><th>Palette</th><th>Prio</th><th>Flip</th>' +
        '</tr>' +
        '</thead>' +
        '<tbody id="oam-tbody">' +
        rowsHtml +
        '</tbody>' +
        '</table>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '</div>';
}

export function buildVramTabHtml(): string {
    // Generate sample 8x8 pattern tiles (64 tiles)
    let tilesHtml = '';
    for (let i = 0; i < 64; i++) {
        const addr = 0x2000 + i * 32;
        tilesHtml += `<div class="vram-tile-cell" data-tile="${i}" data-addr="$${hex4(addr)}" title="Tile #${i} · VRAM $${hex4(addr)} (4bpp)">` +
            `<svg class="vram-tile-canvas" viewBox="0 0 8 8">` +
            // A simple decorative 8x8 pixel checker/diagonal pattern
            `<rect x="0" y="0" width="8" height="8" fill="#18181c"/>` +
            `<rect x="${(i % 4) * 2}" y="${Math.floor(i / 16) * 2}" width="4" height="4" fill="#388bfd" opacity="0.6"/>` +
            `<circle cx="4" cy="4" r="${1 + (i % 3)}" fill="#e0a33d" opacity="0.7"/>` +
            `</svg>` +
            `</div>`;
    }

    return '<div class="mem-sub-pane ppu-pane vram-pane" data-mem="vram" style="display:none">' +
        '<div class="ppu-top">' +
        '<span class="ppu-title">VRAM (Video RAM)</span>' +
        '<div class="ppu-stats"><b>64</b> KB (32,768 words) · Mode 1 Planar 4bpp · PPU $2118/$2119</div>' +
        '<div class="ppu-seg" role="group">' +
        '<button class="ppu-seg-btn ppu-on" data-vram-view="chr">CHR Tiles (Patterns)</button>' +
        '<button class="ppu-seg-btn" data-vram-view="layout">Memory Map</button>' +
        '</div>' +
        '<div style="margin-left:auto;display:flex;align-items:center;gap:6px;font-size:11px;">' +
        '<span style="color:var(--ppu-dim);">Preview Palette:</span>' +
        '<select class="ppu-select" id="vram-pal-select">' +
        '<option value="bg1">BG 1: Tile Family 0</option>' +
        '<option value="bg2">BG 2: Tile Family 1</option>' +
        '<option value="bg3">BG 3: Tile Family 2</option>' +
        '<option value="obj6">OBJ 6: The Boy</option>' +
        '<option value="obj7">OBJ 7: The Dog</option>' +
        '</select>' +
        '</div>' +
        '</div>' +
        '<div class="ppu-body vram-body">' +
        '<div class="vram-subview" id="vram-subview-chr">' +
        '<div class="vram-chr-grid">' +
        tilesHtml +
        '</div>' +
        '<div class="ppu-card">' +
        '<div class="ppu-title">Selected Tile Properties</div>' +
        '<div class="ppu-meta-grid">' +
        '<div class="ppu-meta-row"><span class="k">Format:</span><span class="v">SNES 4bpp Planar (32 bytes per 8×8 tile)</span></div>' +
        '<div class="ppu-meta-row"><span class="k">Character Range:</span><code class="v">$0000 – $7FFF (2,048 possible 8×8 tiles)</code></div>' +
        '<div class="ppu-meta-row"><span class="k">Tilemap Reference:</span><span class="v">16-bit word: Tile ID (bits 0–9), Palette (10–12), Priority (13), Flips (14–15)</span></div>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '<div class="vram-subview" id="vram-subview-layout" style="display:none">' +
        '<div class="vram-map-blocks">' +
        '<div class="vram-block">' +
        '<div class="vram-block-info"><span class="vram-block-title">BG1 Screen Base & Tilemap (Canopy Layer)</span><span class="vram-block-desc">32×32 screen grid words · 2 bytes per cell</span></div>' +
        '<code class="vram-block-addr">$0000 – $07FF (2 KB)</code>' +
        '</div>' +
        '<div class="vram-block">' +
        '<div class="vram-block-info"><span class="vram-block-title">BG2 Screen Base & Tilemap (Terrain Layer)</span><span class="vram-block-desc">32×32 screen grid words · 2 bytes per cell</span></div>' +
        '<code class="vram-block-addr">$0800 – $0FFF (2 KB)</code>' +
        '</div>' +
        '<div class="vram-block">' +
        '<div class="vram-block-info"><span class="vram-block-title">BG3 Screen Base (Text Windows & Dialog)</span><span class="vram-block-desc">Menu and message window tilemap words</span></div>' +
        '<code class="vram-block-addr">$1000 – $17FF (2 KB)</code>' +
        '</div>' +
        '<div class="vram-block">' +
        '<div class="vram-block-info"><span class="vram-block-title">BG1 & BG2 Character Data (Terrain Patterns)</span><span class="vram-block-desc">4bpp planar tiles loaded from Tile Families</span></div>' +
        '<code class="vram-block-addr">$2000 – $3FFF (8 KB)</code>' +
        '</div>' +
        '<div class="vram-block">' +
        '<div class="vram-block-info"><span class="vram-block-title">BG Canopy Character Data (Canopy Patterns)</span><span class="vram-block-desc">4bpp planar tiles for upper tree & roof layers</span></div>' +
        '<code class="vram-block-addr">$4000 – $5FFF (8 KB)</code>' +
        '</div>' +
        '<div class="vram-block">' +
        '<div class="vram-block-info"><span class="vram-block-title">OBJ Character Data (Sprite Patterns)</span><span class="vram-block-desc">4bpp planar tiles for Player, Companion & NPCs</span></div>' +
        '<code class="vram-block-addr">$6000 – $7FFF (8 KB)</code>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '</div>';
}
