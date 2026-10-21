// Ownership: the Terranigma Maps page — its data (the #init block and the terra://rom/ files the host reads on
// request: {command:'read', path} -> 'file'), the rail of rooms, and opening a room in the editor (editor.dom.ts).
// The page frame, rail behaviour, layout, zoom and pan are the shared editor shell's (src/core/map-editor/shell/),
// the same files the Evermore Rooms tab and the Secret of Mana Maps page run on. Bundled by tools/bundle-pages.mts
// as dist/webview/terra-maps.js. State owned here: the open room and the view prefs (vscode.setState).
import { hex, railAreas, variantsOf, type GroupData, type RoomData, type RoomEntry } from './model';
import { openEditor, type ViewState } from './editor.dom';

interface Init { error?: string; supported?: boolean; rooms?: RoomEntry[]; groups?: GroupData[]; terraBase?: string }
interface PageState { room: number | null; prefs: Record<string, unknown>; view: Partial<ViewState> }

(function () {
    const vscode = acquireVsCodeApi();
    const init: Init = JSON.parse(document.getElementById('init')?.textContent || '{}');
    const app = document.getElementById('app')!;
    const state: PageState = Object.assign({ room: null, prefs: {}, view: {} }, vscode.getState() as PageState | undefined);
    const rooms = new Map((init.rooms || []).map(r => [r.id, r]));
    const groups = init.groups || [];
    const pictures = groups.flatMap(g => g.pictures);
    const pending = new Map<string, ((data: unknown) => void)[]>();
    const files = new Map<string, unknown>();
    let editor: { close(): void } | null = null;
    let opening: number | null = null;

    const save = () => vscode.setState(state);
    const w = window as unknown as Record<string, unknown>;
    // Layout widths and collapsed sidebars are the shell's preferences; the page remembers them itself.
    w.shellPrefSaver = (key: string, value: unknown) => { state.prefs[key] = value; save(); };
    // The search finds a row by any room that shows its picture.
    w.railExtraHaystack = (li: HTMLElement) => li.dataset.hexes || '';

    /** Read a terra://rom/ JSON file through the host, once; always answers asynchronously. */
    function readJson(path: string, cb: (data: unknown) => void) {
        if (files.has(path)) { Promise.resolve().then(() => cb(files.get(path))); return; }
        const waiting = pending.get(path);
        if (waiting) { waiting.push(cb); return; }
        pending.set(path, [cb]);
        vscode.postMessage({ command: 'read', path });
    }
    window.addEventListener('message', ev => {
        const msg = ev.data || {};
        if (msg.command !== 'file') return;
        let data: unknown = null;
        try { data = msg.text ? JSON.parse(msg.text) : null; } catch { data = null; }
        files.set(msg.path, data);
        (pending.get(msg.path) || []).forEach(cb => cb(data));
        pending.delete(msg.path);
    });

    /** The rail row showing room `id` (its own row, or the row of the picture it shows). */
    function rowFor(id: number): HTMLElement | null {
        return document.querySelector<HTMLElement>('.rn-map[data-room="' + id + '"]')
            || Array.from(document.querySelectorAll<HTMLElement>('.rn-map[data-rooms]')).find(li => (li.dataset.rooms || '').split(' ').includes(String(id)))
            || null;
    }

    function select(li: HTMLElement, id?: number) {
        const room = id ?? Number(li.dataset.room);
        document.querySelectorAll('.rn-map.rsel').forEach(x => x.classList.remove('rsel'));
        li.classList.add('rsel');
        state.room = room;
        save();
        openRoom(room);
    }

    function openRoom(id: number) {
        const r = rooms.get(id);
        if (!r) return;
        opening = id;
        const panel = document.getElementById('room-detail')!;
        if (editor) { editor.close(); editor = null; }
        panel.className = 'rm-detail-placeholder';
        panel.innerHTML = '<span>Opening room $' + hex(id, 3) + '…</span>';
        readJson('rooms/' + r.hex + '.json', data => {
            if (opening !== id) return;
            if (!data) {
                panel.innerHTML = '<div class="rs rs-error"><div class="rs-h">Cannot open this room</div><div class="rs-note">The loader did not finish for it.</div></div>';
                return;
            }
            const variants = variantsOf(pictures, id);
            editor = openEditor({
                entry: { id, hex: r.hex, name: 'Room $' + hex(id, 3), variants },
                data: data as RoomData, base: init.terraBase || '', st: state.view, save,
                openRoom: (other: number) => { const li = rowFor(other); if (li) select(li, other); },
            });
        });
    }

    if (init.error) { app.innerHTML = '<div class="message">' + shellEscape(init.error) + '</div>'; return; }
    const noMap = groups.reduce((n, g) => n + g.noMap.length, 0);
    app.innerHTML = shellFrameHtml({
        railHtml: shellRailHtml({
            groups: [{ key: 'terra', label: 'Terranigma', open: true, body: shellRailTreeHtml(railAreas(groups, rooms)),
                title: 'Every room that loads a map, one row per picture (rooms that show the same map are its variants), by room id. '
                    + noMap + ' rooms load no map of their own and are not listed.' }],
            search: { placeholder: 'Search rooms (id, e.g. 00f)' }, noneText: 'No rooms match',
        }),
        placeholder: 'Select a room',
    });
    shellRailBind({ onSelect: li => select(li) });
    layoutApplyPrefs(Object.assign({}, state.prefs.layoutWidths, { layoutCollapsed: state.prefs.layoutCollapsed }));
    const first = state.room !== null ? rowFor(state.room) : null;
    if (first) {
        first.closest('li.rn-area')?.classList.remove('collapsed');
        select(first, state.room!);
    }
})();
