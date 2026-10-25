// Ownership: reading game controllers for the emulator page as one SNES pad. Bundled for the page by
// tools/bundle-pages.mts as `EmuPad` (spliced into the menu script, menu/menu-view.ts); pure, so the tests
// run it on synthetic pads.
//
// Any controller the browser sees counts, not just pad 0: Windows often lists a virtual or idle pad
// first (Steam Input, DS4Windows, vJoy), and a pad that is not in the "standard" mapping (most
// DirectInput pads, USB SNES replicas) puts its buttons anywhere and its D-pad on the stick axes or on
// one hat-switch axis. So a binding is a button index (a number, as saved before), an axis direction
// ('a<axis>+' / 'a<axis>-') or a hat direction ('h<axis>up' ...), and the cross is also read from the
// left stick and from any hat, always. getGamepads() can throw (a permissions policy): then no pad.

/** What the page reads of a Gamepad (navigator.getGamepads()). */
export interface PadLike {
    readonly id: string;
    readonly index: number;
    readonly mapping: string;
    readonly connected: boolean;
    readonly buttons: ReadonlyArray<{ readonly pressed: boolean; readonly value: number } | null | undefined>;
    readonly axes: ReadonlyArray<number>;
}

/** A binding: a button index, 'a<i>+' / 'a<i>-' (axis past half way), 'h<i>up' / down / left / right (hat). */
export type PadBind = number | string;

const AXIS_ON = 0.5;
/** A hat axis rests outside -1..1 (about 1.29); a stick or trigger never does. */
const HAT_REST = 1.05;
/** A hat's eight positions from -1 in steps of 2/7, clockwise from up. */
const HAT_DIRS: ReadonlyArray<ReadonlyArray<'up' | 'down' | 'left' | 'right'>> = [
    ['up'], ['up', 'right'], ['right'], ['down', 'right'], ['down'], ['down', 'left'], ['left'], ['up', 'left'],
];

/** Axes seen resting like a hat, per pad id: `${id}#${axis}`. Kept by the page between polls. */
export type HatMemory = Set<string>;

/** The connected pads; none when the browser has no Gamepad API or refuses it. */
export function connectedPads(nav: { getGamepads?: () => ArrayLike<PadLike | null> } | undefined): PadLike[] {
    let list: ArrayLike<PadLike | null> | null = null;
    try { list = nav && typeof nav.getGamepads === 'function' ? nav.getGamepads() : null; } catch { list = null; }
    const out: PadLike[] = [];
    if (!list) return out;
    for (let i = 0; i < list.length; i++) {
        const p = list[i];
        if (p && p.connected !== false) out.push(p);
    }
    return out;
}

function hatDirs(v: number) {
    if (!(v >= -1.05 && v <= 1.05)) return [];
    return HAT_DIRS[Math.round((v + 1) * 3.5) & 7];
}

/** Every control held on one pad, as bindings (button indices, axis and hat directions). */
export function padControls(pad: PadLike, hats: HatMemory): PadBind[] {
    const out: PadBind[] = [];
    pad.buttons.forEach((b, i) => { if (b && b.pressed) out.push(i); });
    pad.axes.forEach((v, i) => {
        const key = pad.id + '#' + i;
        if (Math.abs(v) > HAT_REST) hats.add(key);
        if (hats.has(key)) { for (const d of hatDirs(v)) out.push('h' + i + d); return; }
        if (v < -AXIS_ON) out.push('a' + i + '-'); else if (v > AXIS_ON) out.push('a' + i + '+');
    });
    return out;
}

/** SNES button name -> its bit in the joypad word (menu/01-default-key-map.js SNES_BIT_MASKS). */
export type BitMasks = Readonly<Record<string, number>>;

/** The cross from the left stick and from every hat, bound or not. */
function crossBits(controls: ReadonlyArray<PadBind>, masks: BitMasks) {
    let bits = 0;
    for (const c of controls) {
        if (typeof c !== 'string') continue;
        if (c === 'a1-' || /^h\d+up$/.test(c)) bits |= masks.Up;
        else if (c === 'a1+' || /^h\d+down$/.test(c)) bits |= masks.Down;
        else if (c === 'a0-' || /^h\d+left$/.test(c)) bits |= masks.Left;
        else if (c === 'a0+' || /^h\d+right$/.test(c)) bits |= masks.Right;
    }
    return bits;
}

/**
 * The SNES joypad word of every connected pad together: each SNES button whose binding is held on any
 * pad, plus (with `cross`) the cross from the left stick and any hat. The emulator actions (Rewind,
 * Speed) are read the same way with their own masks and no cross.
 */
export function padBits(pads: ReadonlyArray<PadLike>, map: Readonly<Record<string, PadBind>>, masks: BitMasks, hats: HatMemory, cross = true) {
    let bits = 0;
    for (const pad of pads) {
        const held = padControls(pad, hats);
        for (const name of Object.keys(masks)) {
            const bind = map[name];
            if (bind !== undefined && held.indexOf(bind) >= 0) bits |= masks[name];
        }
        if (cross) bits |= crossBits(held, masks);
    }
    return bits;
}

/** The first control newly held on any pad since `before` (a set of `${pad index}:${bind}` keys, updated). */
export function newControl(pads: ReadonlyArray<PadLike>, hats: HatMemory, before: Set<string>): PadBind | null {
    let hit: PadBind | null = null;
    const now = new Set<string>();
    for (const pad of pads) {
        for (const c of padControls(pad, hats)) {
            const key = pad.index + ':' + c;
            now.add(key);
            if (hit === null && !before.has(key)) hit = c;
        }
    }
    before.clear();
    now.forEach((k) => before.add(k));
    return hit;
}

const STANDARD_NAMES = ['Bottom', 'Right', 'Left', 'Top', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'L3', 'R3', 'D-Up', 'D-Down', 'D-Left', 'D-Right', 'Home'];

/** A binding as the CONTROLS tab shows it; standard pads get the face names, others the raw number. */
export function formatBind(bind: PadBind | undefined, standard: boolean): string {
    if (typeof bind === 'number') return (standard && STANDARD_NAMES[bind]) || 'Btn ' + bind;
    if (typeof bind !== 'string') return 'None';
    let m = /^a(\d+)([+-])$/.exec(bind);
    if (m) return 'Axis ' + m[1] + m[2];
    m = /^h(\d+)(up|down|left|right)$/.exec(bind);
    if (m) return 'Hat ' + m[2][0].toUpperCase() + m[2].slice(1);
    return 'None';
}

/** A saved binding that is still a valid one. */
export function isBind(v: unknown): v is PadBind {
    return (typeof v === 'number' && Number.isInteger(v) && v >= 0) || (typeof v === 'string' && /^(a\d+[+-]|h\d+(up|down|left|right))$/.test(v));
}

/** The banner text: the pads in use, or how to wake one (browsers show a pad only after a button press). */
export function describePads(pads: ReadonlyArray<PadLike>): string {
    if (!pads.length) return 'Input: Keyboard (no gamepad yet: press a button on it)';
    const names = pads.map((p) => (p.id || 'Gamepad').replace(/\s*\(.*$/, '').slice(0, 28) + (p.mapping === 'standard' ? '' : ' (raw)'));
    return 'Input: Keyboard & ' + names.join(', ');
}
