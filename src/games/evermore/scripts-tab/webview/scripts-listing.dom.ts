// Ownership: the Scripts tab's enter listing, page side — which lines the chosen variant and the
// entry state run, how deep each sits in calls, what each is for (its role's tint), and the room
// picture's overlays: the camera bounds the shown lines leave, the doors that lead here, the
// sliced `arg[]` / `temp[]` cells. Pure HTML/SVG builders over the host's data (model/rooms.ts,
// script-model merged.ts); the state is _scr's (scripts-room.js). Bundled by tools/bundle-pages.mts
// as dist/webview/scripts-listing.js (global ScriptsListing).
//
// Entry state: some flags are set by the way the player came in, not by the story (a door's
// scene sets IN_ANIMATION, a fade sets CHANGE_MUSIC). They are not variants; a room loaded fresh
// has them clear, so the listing assumes 0 and greys the branch that needs them set. Each is a
// chip to flip. Read from the structured listing: an `if (NAME) {` / `if (!NAME) {` head (an
// `} else if` too) rules out its body or the rest of its chain; a later `NAME = v;` on a line that
// runs changes the assumption from there on.

interface Mark { severity: 'error' | 'warning'; message: string; find?: string; nth?: number }
interface Line {
    addressSnes: number; summary: string; raw?: string; indent: number; in: number; thread: number;
    note?: boolean; brace?: boolean; opens?: number; marks?: Mark[];
}
interface Block { id: number; parent: number; kind: 'call' | 'thread'; target: number; role: string | null }
interface Slice { area: 'local' | 'temp'; thread: number; offset: number; width: 1 | 2; kind: string; name: string; uses: number[]; reused: string | null; icons?: string[] }
interface BoundWrite { at: number; edge: 'start' | 'end'; x: number; y: number }
interface Arrival { fromMap: number; fromName: string; key: string; x: number; y: number; direction: string | null }

/** A key as the host sends its picture: an object's and an era's with the room (model/icons.ts roomKey). */
export const roomKey = (key: string, room: number): string =>
    key.startsWith('object:') ? 'object:' + room + key.slice(6) : key === 'money' || key === 'portrait:dog' ? key + '@' + room : key;

/** Keys drawn as an emoji instead of a picture (script-model icons.ts). */
const EMOJI: Record<string, string> = { camera: '📷', unknown: '❓' };

interface IconRef { key: string; find: string; tail?: string; title?: string; group?: boolean; live?: string }
/** What the running game says (host `scriptsLive`): each `live` id → the object key it names now, null when unread. */
export type Live = Record<string, string | null>;

/**
 * Where a picture goes after `find` in highlighted `html` (a `<span>` token or plain text, never
 * inside a tag or a longer name): after `tail`, else after a field (`boy.x`), and with `group`
 * after the bracket that follows (`object[x]`); -1 when the line does not print it.
 */
function placeAfter(html: string, find: string, tail: string, group: boolean, from: number): number {
    const f = esc(find), t = esc(tail);
    for (let at = html.indexOf(f, from); at >= 0; at = html.indexOf(f, at + 1)) {
        if (html.lastIndexOf('<', at) > html.lastIndexOf('>', at) || /[\w.]/.test(html[at - 1] ?? '')) continue;
        let end = at + f.length;
        if (html.startsWith('</span>', end)) end += 7;
        if (t && html.startsWith(t, end)) end += t.length;
        else if (html[end] === '.') end += /^\.\w+/.exec(html.slice(end))?.[0].length ?? 0;
        else if (/\w/.test(html[end] ?? '')) continue;
        if (group && (html[end] === '[' || html[end] === '(')) {
            let depth = 0;
            for (let i = end; i < html.length; i++) {
                if (html[i] === '<') { i = html.indexOf('>', i); if (i < 0) return -1; continue; }
                if (html[i] === '[' || html[i] === '(') depth++;
                else if ((html[i] === ']' || html[i] === ')') && --depth === 0) { end = i + 1; break; }
            }
        }
        return end;
    }
    return -1;
}

/**
 * A highlighted line with its in-game icons: each after the first `find` it has not yet followed
 * (script-model icons.ts names them, the host draws them from the user's ROM). A `live` one takes
 * the object the running game names now, when it has said.
 */
export function withIcons(html: string, refs: IconRef[], icons: Record<string, string | null>, room: number, live: Live = {}): string {
    let out = html;
    const used: number[] = [];
    for (const r of refs) {
        const now = r.live ? live[r.live] : undefined;
        const key = now || roomKey(r.key, room);
        const halves = key.startsWith('split:') ? key.slice(6).split('|').map((k) => icons[roomKey(k, room)]) : null;
        const uri = halves ? null : icons[key], emoji = EMOJI[key];
        if (!uri && !emoji && !(halves && halves.every(Boolean))) continue;
        let end = -1;
        for (let from = 0; ; from = end) {
            end = placeAfter(out, r.find, r.tail ?? '', !!r.group, from);
            if (end < 0 || !used.includes(end)) break;
        }
        if (end < 0) continue;
        const obj = key.startsWith('object:');
        const [, , n, st] = key.split(':');
        const title = (now ? 'object ' + n + ', state ' + st + ': the index the running game holds now' : r.title ?? r.find) +
            (obj ? ' · soe://rom/assets/maps/' + hx(room, 2).toLowerCase() + '/objects/' + n + '/state_' + st + '.png' : '') +
            (r.live && !now ? ' · open the emulator to read it live' : '');
        const tag = halves ? '<span class="scr-icon scr-split" title="' + esc(title) + '"><img src="' + halves[0] + '" alt=""><img src="' + halves[1] + '" alt=""></span>'
            : uri ? '<img class="scr-icon' + (obj ? ' scr-icon-obj' : '') + (now ? ' scr-icon-live' : '') + '" src="' + uri + '" alt="" title="' + esc(title) + '">'
            : '<span class="scr-icon scr-emoji" title="' + esc(title) + '">' + emoji + '</span>';
        out = out.slice(0, end) + tag + out.slice(end);
        for (let i = 0; i < used.length; i++) if (used[i] > end) used[i] += tag.length;
        used.push(end);
    }
    return out;
}

/** The `live` ids among `refs`: the lines the page asks the running game about. */
export function liveIds(refs: IconRef[] | undefined, into: Record<string, true>): void {
    for (const r of refs ?? []) if (r.live) into[r.live] = true;
}

/**
 * A printed line with its decimal numbers in hex (the Hex toggle): a number of 10 or more that is
 * not part of a name, an address, a hex literal or a quoted string; the comment after `//` is left alone.
 */
export function toHex(text: string): string {
    const cut = text.indexOf(' //');
    const code = cut < 0 ? text : text.slice(0, cut);
    const out = code.split(/("(?:[^"\\]|\\.)*")/).map((part, i) => (i % 2 ? part : part.replace(/(^|[^\w.$:<])(\d+)(?![\w.])/g, (m, pre: string, n: string) => {
        const v = Number(n);
        return v < 10 ? m : pre + '0x' + v.toString(16).padStart(v > 0xff ? 4 : 2, '0');
    }))).join('');
    return cut < 0 ? out : out + text.slice(cut);
}

/** A line's marks, their `find` text turned to hex like the line. */
export function marksToHex(marks: Mark[] | undefined): Mark[] | undefined {
    return marks?.map((m) => (m.find && /^\d+$/.test(m.find) ? { ...m, find: toHex(m.find) } : m));
}

/** The trigger chips' container: the room picture once, as a CSS variable the chips crop (a data URI per chip would repeat it). */
export function chipsStyle(picture: { uri?: string } | null | undefined): string {
    return picture?.uri ? ' style="--scr-room-pic:url(&quot;' + picture.uri + '&quot;)"' : '';
}

/** Size of a chip's picture, and the most a reward is drawn at (a ring icon's own 16 px: larger it smears), in CSS pixels. */
const CHIP_PIC = 22, CHIP_LOOT = 16;

/**
 * A trigger chip's picture: the room picture around the trigger's box, the box filling it but for
 * a margin of an eighth on each side (past the room's edge it is empty), the box outlined; with
 * what it is about (`loot`, a data URI: a reward, a weapon it tests) inside the box — as large as
 * the box's inside allows, at most its own size — and centred in it. '' for the enter script.
 */
export function chipPicture(box: { x: number; y: number; w: number; h: number } | undefined, picture: { width?: number; height?: number } | null | undefined, loot: string | null | undefined): string {
    if (!box || !picture?.width || !picture.height) return '';
    const side = Math.max(box.w, box.h) * 1.25;
    const x0 = box.x + box.w / 2 - side / 2, y0 = box.y + box.h / 2 - side / 2;
    const k = CHIP_PIC / side;
    const px = (v: number): string => v.toFixed(1) + 'px';
    const bx = (box.x - x0) * k, by = (box.y - y0) * k, bw = box.w * k, bh = box.h * k;
    // Inside the 1 px outline.
    const icon = Math.max(0, Math.min(CHIP_LOOT, Math.floor(Math.min(bw, bh) - 2)));
    return '<span class="scr-chip-pic" style="background-size:' + px(picture.width * k) + ' ' + px(picture.height * k) + ';background-position:' + px(-x0 * k) + ' ' + px(-y0 * k) + '">' +
        '<span class="scr-chip-box" style="left:' + px(bx) + ';top:' + px(by) + ';width:' + px(bw) + ';height:' + px(bh) + '"></span>' +
        (loot && icon >= 6 ? '<img class="scr-chip-loot" src="' + loot + '" alt="" style="left:' + px(bx + (bw - icon) / 2) + ';top:' + px(by + (bh - icon) / 2) + ';width:' + icon + 'px;height:' + icon + 'px">' : '') + '</span>';
}

/** Entry-state flags: clear when the room is loaded fresh, set by the way some doors bring you in. */
export const ENTRY_FLAGS = ['IN_ANIMATION', 'DOG_UNAVAILABLE', 'CHANGE_MUSIC'];

/** What each role is called in the legend. */
const ROLE_NAMES: Record<string, string> = { init: 'room setup', exit: 'exit', loot: 'pickup', sniff: 'sniff spot', cutscene: 'scene' };

const esc = (s: unknown): string => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
const hx = (v: number, d: number): string => v.toString(16).toUpperCase().padStart(d, '0');

const HEAD = /^(?:\} else )?if \((!?)(?:signed )?([A-Z_][A-Z0-9_]*)\) \{$/;
const SET = /^([A-Z_][A-Z0-9_]*) = (\d+|0x[0-9a-f]+|True|False);$/;
const isInstruction = (l: Line): boolean => !l.note && !l.brace;

/** Lines (indices) the entry-state assumption rules out. */
function assumedOff(lines: Line[], assumeIn: Record<string, boolean>): Set<number> {
    const assume = { ...assumeIn };
    const off = new Set<number>();
    for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        if (off.has(i) || !isInstruction(l)) continue;
        const set = SET.exec(l.summary);
        if (set && set[1] in assume) { assume[set[1]] = !/^(0|0x0+|False)$/.test(set[2]); continue; }
        const head = HEAD.exec(l.summary);
        if (!head || !(head[2] in assume)) continue;
        const holds = assume[head[2]] !== (head[1] === '!');
        const n = l.indent;
        let j = i + 1;
        for (; j < lines.length && lines[j].indent > n; j++) if (!holds) off.add(j);
        if (!holds) continue;
        // The condition holds: the rest of the chain (`} else …` at this indent and what it holds) never runs.
        for (; j < lines.length; j++) {
            const r = lines[j];
            if (r.indent > n || (r.indent === n && /^\} else/.test(r.summary))) off.add(j);
            else break;
        }
    }
    return off;
}

/**
 * Each line's state: '' it runs, 'off' another variant or entry state runs it, 'dead' none does.
 * `mine` / `any`: the addresses the chosen variant / some variant reaches (null before the
 * variants are in). A `} else {` line is the jump at the end of the branch above it, but reads as
 * the start of the next: it takes the state of the line after it.
 */
export function liveness(lines: Line[], mine: Record<number, 1> | null, any: Record<number, 1>, assume: Record<string, boolean> | null): string[] {
    const off = assume ? assumedOff(lines, assume) : new Set<number>();
    const out = lines.map((l, i) => {
        if (!isInstruction(l)) return '';
        if (mine && !mine[l.addressSnes]) return any[l.addressSnes] ? 'off' : 'dead';
        return off.has(i) ? 'off' : '';
    });
    for (let i = lines.length - 1; i >= 0; i--) {
        if (!isInstruction(lines[i]) || !/^\} else/.test(lines[i].summary)) continue;
        const next = lines.findIndex((l, j) => j > i && isInstruction(l));
        if (next > 0) out[i] = out[next];
    }
    return out;
}

/** The fold arrow's width (scripts-tab.css .scr-fold): a called body's text starts where its call's `call` does. */
const STEP = 12;
const INDENT = 14, LEFT = 8;

/** The calls a line sits in, innermost first, up to the thread it runs in. */
function callsAround(line: Line, blocks: Block[]): number[] {
    const out: number[] = [];
    for (let b = line.in; b >= 0 && blocks[b].kind === 'call'; b = blocks[b].parent) out.push(b);
    return out;
}

/**
 * Each line's layout in px: `text` where its text starts, `bars` one per call it sits in, each at
 * its call line's column (where the fold arrow is). A bar stays put while the body's own ifs
 * indent the text behind it. `indentOf`: the structured or the flat indent.
 */
export function callLayout(lines: Line[], blocks: Block[], indentOf: (l: Line) => number): Array<{ text: number; bars: number[] }> {
    const column = new Map<number, number>();
    return lines.map((l) => {
        const calls = callsAround(l, blocks);
        const text = LEFT + indentOf(l) * INDENT + calls.length * STEP;
        if (l.opens != null && blocks[l.opens].kind === 'call') column.set(l.opens, text);
        return { text, bars: calls.map((b) => column.get(b) ?? LEFT).reverse() };
    });
}

/** The cell style for a layout: its padding and a bar (3 px, the call colour) per call. */
export function layoutStyle(c: { text: number; bars: number[] }): string {
    if (!c.bars.length) return 'padding-left:' + c.text + 'px';
    return 'padding-left:' + c.text + 'px;background-image:' + c.bars.map(() => 'linear-gradient(var(--sx-kw),var(--sx-kw))').join(',') +
        ';background-size:' + c.bars.map(() => '3px 100%').join(',') + ';background-position:' + c.bars.map((x) => x + 'px 0').join(',') + ';background-repeat:no-repeat';
}

/** What a line is for: its innermost block with a role, else the script's own (`top`: the enter script's is the room's setup). */
export function roleAt(line: Line, blocks: Block[], top: string): string {
    for (let b = line.in; b >= 0; b = blocks[b].parent) if (blocks[b].role) return blocks[b].role!;
    return top;
}

/** The entry-state chips: each flag's assumed value, click to flip. */
export function entryHtml(assume: Record<string, boolean>): string {
    return '<div class="scr-chips-row"><span class="scr-chips-h" title="Set by the way the player came in, not by the story: clear when the room is loaded fresh">Entry state</span>' +
        ENTRY_FLAGS.map((f) => '<button class="scr-chip' + (assume[f] ? ' scr-on' : '') + '" data-scr-assume="' + f + '" title="Click to assume it ' + (assume[f] ? 'clear' : 'set') + '">' +
            esc(f) + ' = ' + (assume[f] ? 1 : 0) + '</button>').join('') + '</div>';
}

/** The role legend for the map's header. */
export function rolesLegend(): string {
    return Object.keys(ROLE_NAMES).map((r) => '<i class="scr-key scr-role-' + r + '"></i> ' + ROLE_NAMES[r]).join(' ');
}

/**
 * The camera bounds (knowledge ram/7e23e9) as an SVG overlay: the room outside them greyed, their
 * edge outlined. Every room load sets them to the whole map; the writes on `live` lines apply in
 * listing order.
 */
export function boundsSvg(width: number, height: number, writes: BoundWrite[], live: Record<number, 1>): string {
    let x1 = 0, y1 = 0, x2 = width, y2 = height;
    const used: BoundWrite[] = [];
    for (const w of writes) {
        if (!live[w.at]) continue;
        if (w.edge === 'start') { x1 = w.x; y1 = w.y; } else { x2 = w.x; y2 = w.y; }
        used.push(w);
    }
    const title = used.length ? 'Camera bounds: (' + x1 + ', ' + y1 + ') – (' + x2 + ', ' + y2 + '), set at ' + used.map((w) => '$' + hx(w.at, 6)).join(', ')
        : 'Camera bounds: the whole map (every room load sets them so)';
    return '<path class="scr-bounds-out" fill-rule="evenodd" d="M0 0H' + width + 'V' + height + 'H0Z M' + x1 + ' ' + y1 + 'H' + x2 + 'V' + y2 + 'H' + x1 + 'Z"/>' +
        '<rect class="scr-bounds" x="' + x1 + '" y="' + y1 + '" width="' + Math.max(0, x2 - x1) + '" height="' + Math.max(0, y2 - y1) + '"><title>' + esc(title) + '</title></rect>';
}

/** The doors that lead here, as markers where the player lands: click one to open the script that sends you. */
export function arrivalsSvg(arrivals: Arrival[]): string {
    return arrivals.map((a) => '<circle class="scr-arrival" cx="' + a.x + '" cy="' + a.y + '" r="5" data-scr-arrive="' + a.fromMap + '|' + esc(a.key) + '">' +
        '<title>' + esc('Arrive from ' + a.fromName + ' (' + a.key + ')' + (a.direction ? ', walking ' + a.direction : '')) + '</title></circle>').join('');
}

export function arrivalsHtml(arrivals: Arrival[]): string {
    if (!arrivals.length) return '<div class="scr-note">No door in the ROM leads here.</div>';
    return '<div class="scr-side-h">Arrivals <span class="scr-dim">doors that lead here</span></div><div class="scr-arrivals">' + arrivals.map((a) =>
        '<button class="scr-chip scr-role-exit" data-scr-arrive="' + a.fromMap + '|' + esc(a.key) + '" title="Open the script that sends you here">' +
        esc(a.fromName) + ' <span class="scr-dim">' + esc(a.key) + ' → (' + a.x + ', ' + a.y + ')</span></button>').join('') + '</div>';
}

/** The sliced cells: each thread's `arg[]`, then the room's `temp[]`. */
export function slicesHtml(slices: Slice[], blocks: Block[], icons: Record<string, string | null>, room = -1): string {
    if (!slices.length) return '';
    const where = (s: Slice): string => s.area === 'temp' ? 'temp (room)' : s.thread < 0 ? 'arg (enter thread)' : 'arg (thread $' + hx(blocks[s.thread].target, 6) + ')';
    let last = '';
    const rows = slices.map((s) => {
        const w = where(s), head = w !== last ? '<tr class="scr-slice-h"><td colspan="4">' + esc(w) + '</td></tr>' : '';
        last = w;
        return head + '<tr' + (s.reused ? ' class="scr-slice-reused" title="' + esc('Reused: ' + s.reused) + '"' : '') + '><td>' + (s.area === 'temp' ? 'temp' : 'arg') + '[' + s.offset + ']</td>' +
            '<td>' + (s.width === 1 ? 'byte' : 'word') + '</td><td>' + esc(s.name) + (s.reused ? ' ⚠' : '') +
            (s.icons ?? []).map((key) => roomKey(key, room)).map((k) => icons[k] ? '<img class="scr-icon" src="' + icons[k] + '" alt="" title="given to it in the listing">'
                : EMOJI[k] ? '<span class="scr-icon scr-emoji" title="given to it in the listing">' + EMOJI[k] + '</span>' : '').join('') + '</td><td class="scr-dim">' + s.uses.length + ' use' + (s.uses.length > 1 ? 's' : '') + '</td></tr>';
    }).join('');
    return '<div class="scr-side-h">Locals <span class="scr-dim">arg[] and temp[] cut by how the listing uses them</span></div><table class="scr-slices"><tbody>' + rows + '</tbody></table>';
}
