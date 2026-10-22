// Ownership: the Scripts tab's Maps view, page side — the room blob's sections
// as bytes, fields and items (middle) and the panels the host draws for the
// selection (right). Everything that shows the same thing carries its key in
// `data-mk`: an item in the list, every byte it owns, its box on the room, a
// state picture. Hovering one lights all of them (`mapHover`); clicking
// selects it. Pure HTML builders plus the hover and the frame player; the state
// is _scr's (scripts-tab.js), the data the host's (model/map-*.ts). Bundled by
// tools/bundle-pages.mts as dist/webview/scripts-maps.js (global ScriptsMaps).

interface Field { at: number; size: number; name: string; value: string }
interface Item { key: string; label: string; ranges: [number, number][]; sub?: boolean }
interface Section { key: string; title: string; note: string; offset: number; snes: string; size: number; bytes: string; fields: Field[]; items: Item[] }
interface MapModel { id: number; idHex: string; name: string; area: string; error?: string; pointer: { entry: string; value: string }; blob: { snes: string; size: number }; sections: Section[] }
interface Box { x: number; y: number; w: number; h: number; cls: string; label: string; key: string; on?: boolean }
interface Img { uri: string; width: number; height: number; label?: string; scale?: number; key?: string; on?: boolean; boxes?: Box[]; pick?: 'cell' | 'atlas'; columns?: number }
interface PaletteSet { title: string; note: string; rows: { label: string; colors: string[] | null; key?: string; on?: boolean }[] }
interface Panel { title: string; note?: string; image?: Img; images?: Img[]; rows?: [string, string][]; frames?: { uri: string; delay: number }[]; sets?: PaletteSet[] }
interface View { key: string; error?: string; panels?: Panel[] }

/** Rows of the hex dump shown before "show all". */
const DUMP_ROWS = 8;
const TICK_MS = 1000 / 60;

const esc = (s: unknown): string => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
const hx = (v: number, d: number): string => v.toString(16).toUpperCase().padStart(d, '0');
const link = (key?: string): string => key ? ' data-scr-msel="' + esc(key) + '" data-mk="' + esc(key) + '"' : '';

/** The section a selection key belongs to: `obj:3:1` is shown under the object area, `cell:x:y` under the map. */
function sectionOf(key: string): string {
    const k = key.split(':')[0];
    return ({ obj: 'area', cell: 'block2', grass: 's4', mt: 'block3', atlas: 'block3', fam: 'families' } as Record<string, string>)[k] || k;
}

/** The keys of the items each byte belongs to, so a byte lights with its item. */
function byteKeys(s: Section): string[][] {
    const out: string[][] = Array.from({ length: s.bytes.length / 2 }, () => []);
    s.items.forEach((it) => it.ranges.forEach(([at, n]) => { for (let i = at; i < at + n && i < out.length; i++) out[i].push(it.key); }));
    return out;
}

function dumpHtml(s: Section, sel: string, all: boolean): string {
    const n = s.bytes.length / 2, rows = Math.ceil(n / 16);
    const keys = byteKeys(s);
    const lit = s.items.find((i) => i.key === sel);
    let first = lit && lit.ranges.length ? Math.floor(lit.ranges[0][0] / 16) : 0;
    const shown = all ? rows : Math.min(rows, DUMP_ROWS);
    if (all) first = 0;
    else first = Math.max(0, Math.min(first, rows - shown));
    const out: string[] = [];
    for (let r = first; r < first + shown; r++) {
        const cells: string[] = [];
        for (let i = r * 16; i < Math.min(n, r * 16 + 16); i++) {
            const on = keys[i].includes(sel);
            cells.push('<span' + (keys[i].length ? ' data-mk="' + esc(keys[i].join(' ')) + '"' : '') + (on ? ' class="scr-lit"' : '') + '>' + s.bytes.substr(i * 2, 2) + '</span>');
        }
        out.push('<div class="scr-dump-row"><span class="scr-a">+' + hx(r * 16, 4) + '</span> ' + cells.join(' ') + '</div>');
    }
    const more = rows > shown ? '<button class="scr-btn scr-dump-more" data-scr-mall="' + esc(s.key) + '">Show all ' + n + ' bytes</button>' : '';
    return '<div class="scr-dump">' + out.join('') + '</div>' + more;
}

function sectionHtml(s: Section, sel: string, all: boolean): string {
    const on = sectionOf(sel) === s.key;
    const fields = s.fields.length ? '<table class="scr-rows scr-fields"><tbody>' + s.fields.map((f) =>
        '<tr><td class="scr-a">' + (f.size ? '+' + hx(f.at, 2) : '') + '</td><td class="scr-b">' + s.bytes.substr(f.at * 2, f.size * 2) + '</td><td>' + esc(f.name) + '</td><td class="scr-s">' + esc(f.value) + '</td></tr>').join('') + '</tbody></table>' : '';
    const items = s.items.length ? '<div class="scr-mitems">' + s.items.map((i) =>
        '<div class="scr-item' + (i.sub ? ' scr-sub-item' : '') + (i.key === sel ? ' scr-sel' : '') + '"' + link(i.key) + '><span class="scr-item-main">' + esc(i.label) + '</span></div>').join('') + '</div>' : '';
    return '<div class="scr-msec' + (on ? ' scr-on' : '') + '">' +
        '<div class="scr-msec-h" data-scr-msel="' + esc(s.key) + '"><b>' + esc(s.title) + '</b> <code>' + s.snes + '</code> <span class="scr-dim">' + s.size + ' bytes · ' + esc(s.note) + '</span></div>' +
        (on ? fields + items + (s.size ? dumpHtml(s, sel, all) : '') : '') + '</div>';
}

/** The middle column: the blob's header line and every section; the selected one open. */
function mapMidHtml(m: MapModel | null | 'pending', sel: string, all: Record<string, boolean>): string {
    if (!m || m === 'pending') return '<div class="scr-empty">Reading the room blob…</div>';
    if (m.error) return '<div class="scr-empty scr-warn">' + esc(m.error) + '</div>';
    return '<div class="scr-h">' + esc(m.name) + ' <span class="scr-dim">room $' + m.idHex + '</span></div>' +
        '<div class="scr-sub">Map table <code>' + m.pointer.entry + '</code> → <code>' + m.pointer.value + '</code> · blob <code>' + m.blob.snes + '</code>, ' +
        m.blob.size + ' bytes in ' + m.sections.length + ' sections. Click a section to open it; hover an item, a byte or a box to see what belongs together.</div>' +
        m.sections.map((s) => sectionHtml(s, sel, !!all[s.key])).join('');
}

function imgHtml(im: Img, picture: Img | null): string {
    const src = im.uri === '@room' ? picture : im;
    if (!src || !src.uri) return '<div class="scr-note">No picture.</div>';
    const scale = im.scale || 1;
    const boxes = (im.boxes || []).map((b) => '<rect class="scr-box scr-box-' + b.cls + (b.on ? ' scr-on' : '') + '"' + link(b.key) +
        ' x="' + b.x + '" y="' + b.y + '" width="' + b.w + '" height="' + b.h + '"><title>' + esc(b.label) + '</title></rect>').join('');
    const pick = im.pick ? ' data-scr-mpick="' + im.pick + '" data-w="' + im.width + '"' : '';
    const fit = scale > 1 ? 'width:' + im.width * scale + 'px' : 'width:100%';
    return '<figure class="scr-mfig' + (im.on ? ' scr-on' : '') + '"' + link(im.key) + '><div class="scr-map' + (im.pick ? ' scr-pickable' : '') + '" style="' + fit + '">' +
        '<img class="scr-px" src="' + src.uri + '" width="' + im.width + '" height="' + im.height + '" alt=""' + pick + '>' +
        (boxes ? '<svg viewBox="0 0 ' + im.width + ' ' + im.height + '" preserveAspectRatio="none">' + boxes + '</svg>' : '') + '</div>' +
        (im.label ? '<figcaption class="scr-dim">' + esc(im.label) + '</figcaption>' : '') + '</figure>';
}

function setsHtml(sets: PaletteSet[]): string {
    return sets.map((s) => '<div class="scr-mset"><div class="scr-mset-h">' + esc(s.title) + '</div><div class="scr-note">' + esc(s.note) + '</div>' +
        s.rows.map((r) => '<div class="scr-mpal' + (r.colors ? '' : ' scr-empty-slot') + (r.on ? ' scr-on' : '') + '"' + link(r.key) + '>' +
            '<span class="scr-mpal-sw">' + (r.colors ? r.colors.slice(1).map((c) => '<i style="background:' + c + '" title="' + c + '"></i>').join('') : '') + '</span>' +
            '<span class="scr-dim">' + esc(r.label) + '</span></div>').join('') + '</div>').join('');
}

function panelHtml(p: Panel, picture: Img | null): string {
    const parts = ['<div class="scr-side-h">' + esc(p.title) + '</div>'];
    if (p.note) parts.push('<div class="scr-note">' + esc(p.note) + '</div>');
    if (p.frames && p.frames.length) {
        parts.push('<div class="scr-stage"><img class="scr-px" data-scr-frames="' + esc(JSON.stringify(p.frames.map((f) => f.delay))) + '" src="' + p.frames[0].uri + '" style="height:96px" alt=""></div>' +
            '<div class="scr-mframes">' + p.frames.map((f, i) => '<img class="scr-px" data-scr-frame="' + i + '" src="' + f.uri + '" title="frame ' + i + ' · ' + f.delay + ' ticks" alt="">').join('') + '</div>');
    }
    if (p.image) parts.push(imgHtml(p.image, picture));
    if (p.images) parts.push('<div class="scr-mgallery">' + p.images.map((im) => imgHtml(im, picture)).join('') + '</div>');
    if (p.sets) parts.push(setsHtml(p.sets));
    if (p.rows) parts.push('<table class="scr-rows scr-fields"><tbody>' + p.rows.map((r) => '<tr><td>' + esc(r[0]) + '</td><td class="scr-s">' + esc(r[1]) + '</td></tr>').join('') + '</tbody></table>');
    return '<div class="scr-mpanel">' + parts.join('') + '</div>';
}

/** The right column for the selection's view. */
function mapSideHtml(v: View | null | 'pending', picture: Img | null): string {
    if (!v || v === 'pending') return '<div class="scr-empty">Drawing…</div>';
    if (v.error) return '<div class="scr-empty scr-warn">' + esc(v.error) + '</div>';
    return (v.panels || []).map((p) => panelHtml(p, picture)).join('');
}

/** The selection key a click on a pickable picture means: `cell:x:y` on the map, `atlas:x:y` on the metatile sheet. */
function mapPickKey(img: HTMLImageElement, e: MouseEvent): string | null {
    const kind = img.dataset.scrMpick;
    if (!kind) return null;
    const r = img.getBoundingClientRect();
    const k = Number(img.dataset.w) / r.width;
    return kind + ':' + Math.floor((e.clientX - r.left) * k / 16) + ':' + Math.floor((e.clientY - r.top) * k / 16);
}

/** Lights everything that carries the hovered element's key (an object's hover also lights its steps' bytes); `null` clears. */
function mapHover(target: Element | null, root: HTMLElement): void {
    root.querySelectorAll('.scr-hot').forEach((n) => n.classList.remove('scr-hot'));
    const el = target && target.closest ? target.closest<HTMLElement>('[data-mk]') : null;
    if (!el || !root.contains(el)) return;
    const key = (el.dataset.mk || '').split(' ')[0];
    if (!key) return;
    root.querySelectorAll<HTMLElement>('[data-mk]').forEach((n) => {
        if ((n.dataset.mk || '').split(' ').some((k) => k === key || k.startsWith(key + ':'))) n.classList.add('scr-hot');
    });
}

let _timer = 0;
/** Plays the frames shown in `root`, each for its delay in ticks. */
function startFrames(root: HTMLElement): void {
    stopFrames();
    const img = root.querySelector<HTMLImageElement>('[data-scr-frames]');
    if (!img) return;
    const delays: number[] = JSON.parse(img.dataset.scrFrames || '[]');
    const srcs = Array.from(root.querySelectorAll<HTMLImageElement>('[data-scr-frame]')).map((f) => f.src);
    let i = 0;
    const step = () => {
        if (!img.isConnected) return;
        img.src = srcs[i];
        root.querySelectorAll('[data-scr-frame]').forEach((f, k) => f.classList.toggle('scr-on', k === i));
        _timer = window.setTimeout(step, Math.max(1, delays[i]) * TICK_MS);
        i = (i + 1) % srcs.length;
    };
    step();
}
function stopFrames(): void { window.clearTimeout(_timer); _timer = 0; }

export { mapMidHtml, mapSideHtml, mapPickKey, mapHover, sectionOf, startFrames, stopFrames };
