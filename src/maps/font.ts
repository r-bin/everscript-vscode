// Ownership: the 3x5 bitmap font the map overlay draws its labels with.
// Pure. Ported from everscript/tools/render_map.py (FONT_3X5, draw_string_3x5,
// draw_label_in_rect).
//
// A real font would be unreadable at this size: labels sit inside 16px
// metatiles, so glyphs have to be legible at 3x5 with a 1px drop shadow. Each
// glyph is 15 characters, row-major, '1' = ink.

/** Row-major 3x5 bitmaps, '1' = ink. Unknown characters fall back to '?'. */
const FONT_3X5: Record<string, string> = {
    '0': '111101101101111', '1': '010110010010111', '2': '111001111100111',
    '3': '111001111001111', '4': '101101111001001', '5': '111100111001111',
    '6': '111100111101111', '7': '111001010010010', '8': '111101111101111',
    '9': '111101111001111',
    A: '111101111101101', B: '110101110101110', C: '111100100100111',
    D: '110101101101110', E: '111100110100111', F: '111100110100100',
    G: '111100101101111', H: '101101111101101', I: '111010010010111',
    J: '001001001101010', K: '101110100110101', L: '100100100100111',
    M: '101111101101101', N: '111101101101101', O: '111101101101111',
    P: '111101111100100', Q: '111101101111001', R: '110101110101101',
    S: '111100111001111', T: '111010010010010', U: '101101101101111',
    V: '101101101101010', W: '101101101111101', X: '101101010101101',
    Y: '101101010010010', Z: '111001010100111',
    '?': '111001010000010', '-': '000000111000000', ':': '000010000010000',
    '.': '000000000000010', '/': '001001010100100', '\\': '100100010001001',
    '(': '010100100100010', ')': '010001001001010', '[': '110100100100110',
    ']': '011001001001011', '^': '010101000000000', '<': '001010100010001',
    '>': '100010001010100', _: '000000000000111', ' ': '000000000000000',
};

/** Pixel width of a rendered string, excluding the trailing 1px gap. */
export function textWidth3x5(text: string): number {
    return text.length * 4 - 1;
}

/** RGBA colour tuple. */
export type Rgba8 = [number, number, number, number];

const WHITE: Rgba8 = [255, 255, 255, 255];
const BLACK: Rgba8 = [0, 0, 0, 255];

/**
 * Draw `text` into an RGBA buffer with its top-left corner at (x, y).
 *
 * Writes opaque pixels rather than blending — a label that fades into the map
 * under it is not a label. The 1px shadow is what keeps light text readable
 * over light terrain; pass `null` to drop it.
 */
export function drawString3x5(
    buf: Uint8Array | Uint8ClampedArray,
    stridePx: number,
    x: number,
    y: number,
    text: string,
    color: Rgba8 = WHITE,
    shadow: Rgba8 | null = BLACK,
): void {
    let cx = x;
    for (const raw of text.toUpperCase()) {
        const glyph = FONT_3X5[raw] !== undefined ? FONT_3X5[raw] : FONT_3X5['?'];
        // Shadow first, offset by one pixel, then the ink over it.
        const passes: Array<[Rgba8, number]> = shadow ? [[shadow, 1], [color, 0]] : [[color, 0]];
        for (const [pass, nudge] of passes) {
            for (let gy = 0; gy < 5; gy++) {
                for (let gx = 0; gx < 3; gx++) {
                    if (glyph[gy * 3 + gx] !== '1') continue;
                    const sx = cx + gx + nudge;
                    const sy = y + gy + nudge;
                    if (sx < 0 || sx >= stridePx || sy < 0) continue;
                    const off = (sy * stridePx + sx) * 4;
                    if (off + 3 >= buf.length) continue;
                    buf[off] = pass[0]; buf[off + 1] = pass[1];
                    buf[off + 2] = pass[2]; buf[off + 3] = pass[3];
                }
            }
        }
        cx += 4;
    }
}

/** Which corner of the box a label hugs. */
export type LabelAnchor = 'top' | 'bottom';

/**
 * Draw a short index label just inside a corner of a bounding box, nudged so it
 * stays on-screen for boxes that start off the map edge.
 *
 * Objects anchor "bottom" and triggers "top" so the two stay readable where
 * their boxes coincide — the 3x5 font draws 'O' and '0' identically, so an
 * "O5" prefix would be ambiguous against a hex trigger id. Boxes smaller than
 * 6px in either axis get no label at all: it would not fit.
 */
export function drawLabelInRect(
    buf: Uint8Array | Uint8ClampedArray,
    stridePx: number,
    heightPx: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    text: string,
    color: Rgba8 = WHITE,
    anchor: LabelAnchor = 'top',
): void {
    if (x2 - x1 < 6 || y2 - y1 < 6) return;
    const w = textWidth3x5(text);
    const x = Math.max(2, Math.min(x1 + 3, stridePx - w - 2));
    const y = Math.max(2, Math.min(anchor === 'bottom' ? y2 - 9 : y1 + 3, heightPx - 8));
    drawString3x5(buf, stridePx, x, y, text, color);
}
