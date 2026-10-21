// The globals the Terranigma Maps page calls: the shared editor shell (src/core/map-editor/shell/), the map
// view chips (src/core/map-editor/view/view-chips.js) and the VS Code webview API. They are plain scripts the
// page loads before its own bundle (page.ts SCRIPTS); these are their signatures as the page uses them.

interface ShellZoomPan {
    svg: SVGSVGElement; canvas: HTMLElement; wrap: HTMLElement; W: number; H: number; dispW: number; dispH: number;
    zoomState: { scale: number }; panX: number; panY: number;
}
interface ShellPan { panX: number; panY: number; panActive: boolean; panMoved: boolean; panCX: number; panCY: number; panBX: number; panBY: number }

declare function acquireVsCodeApi(): { postMessage(msg: unknown): void; getState(): unknown; setState(s: unknown): void };

declare function shellEscape(s: unknown): string;
declare function shellFrameHtml(o: { railHtml: string; placeholder?: string }): string;
declare function shellRailHtml(o: { groups: { key: string; label: string; title?: string; open?: boolean; body: string }[]; search?: { placeholder?: string }; noneText?: string }): string;
declare function shellRailTreeHtml(areas: { area: string; rooms: { name: string; tag: string; attrs?: Record<string, string | number> }[] }[]): string;
declare function shellRailBind(o: { onSelect: (li: HTMLElement) => void }): void;
declare function shellHeadHtml(o: { name?: string; tags?: { cls: string; text: string }[] }): string;
declare function shellCanvasParts(o: { dispW: number; dispH: number; viewBox: string; filtersHtml?: string; statusHtml?: string; zoomTitle?: string }): { open: string; close: string };
declare function shellStatusbarHtml(o: { width?: number; height?: number; cellTitle?: string; sizeTitle?: string }): string;
declare function shellToolButtonHtml(o: { key: string; icon: string; tip: string; label: string; on?: boolean }): string;
declare function shellActButtonHtml(o: { act: string; icon: string; tip: string; label: string; disabled?: boolean }): string;
declare function shellPillHtml(groups: string[][], tailHtml?: string): string;
declare function shellSideBarHtml(o: { id?: string; cls?: string; label: string; items: { text: string; attr?: Record<string, string | number>; on?: boolean; tip?: string; color: string }[] }): string;
declare function shellTabStripHtml(tabs: { value: string; label: string; on?: boolean }[], attr?: string): string;
declare function shellPanelHtml(key: string, title: string, body: string, note?: string, open?: boolean): string;
declare function shellSidebarTogglesHtml(rail: boolean, dock: boolean): string;
declare function shellDockMount(outer: HTMLElement): { dock: HTMLElement; panels: HTMLElement; created: boolean };
declare function shellStatusBind(describe: (e: MouseEvent) => string | null): void;
declare function shellPanStart(p: ShellZoomPan, state: ShellPan, wrap: HTMLElement, e: MouseEvent): boolean;
declare function statusPad2(n: number): string;
declare const SHELL_TOOL_ICONS: Record<string, string>;

declare function setupZoomPan(p: ShellZoomPan): void;
declare function layoutApplyPrefs(saved: unknown): void;
declare function layoutApplyCollapsed(): void;
declare function layoutUpdateCompact(): void;
declare function isRailVisible(): boolean;
declare function isDockVisible(): boolean;
declare function isCompactMode(): boolean;
declare function editToggleRail(): void;
declare function editToggleDock(): void;
declare const _layoutCollapsed: { rail: boolean; dock: boolean };
declare let shellPrefSaver: ((key: string, value: unknown) => void) | null;
// eslint-disable-next-line no-var
declare var railExtraHaystack: ((li: HTMLElement) => string) | undefined;
/** The shell's layout calls this whenever the rail or dock is shown or hidden (the name line's toggles). */
// eslint-disable-next-line no-var
declare var renderEditHeadActs: (() => void) | undefined;

declare function mapViewChipHtml(c: { label: string; on?: boolean; attrs?: Record<string, string>; cls?: string; title?: string }): string;
declare function mapViewSegHtml(parts: string[]): string;
