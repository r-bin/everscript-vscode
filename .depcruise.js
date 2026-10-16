/** @type {import('dependency-cruiser').IConfiguration} */
/**
 * Dependency-Cruiser Configuration — Everscript VS Code Extension
 *
 * All rules start as 'warn' (informational, not blocking) unless marked error.
 * Rules graduate to 'error' as domain boundaries become stable.
 *
 * Run: npx depcruise --config .depcruise.js src/
 * HTML report: npx depcruise --config .depcruise.js --output-type html src/ > deps.html
 */
module.exports = {
  forbidden: [

    // ── CURRENTLY ENFORCED (error) ─────────────────────────────────────────

    {
      name: 'no-circular',
      comment: 'Circular dependencies cause unpredictable initialization order in CJS.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },

    {
      name: 'no-script-to-src',
      comment: 'script_parser/ is a fully isolated domain. It must never import from src/.',
      severity: 'error',
      from: { path: '^script_parser/' },
      to: { path: '^src/' },
    },

    // ── DOMAIN ISOLATION RULES (warn) ──────────────────────────────────────

    {
      name: 'no-src-to-script-internals',
      comment: 'Extension must not depend on parser internals.',
      severity: 'warn',
      from: { path: '^src/' },
      to: { path: '^script_parser/(src|model)/' },
    },

    {
      name: 'no-language-to-debugger',
      comment: 'Language features must not depend on the debugger.',
      severity: 'warn',
      from: { path: '^src/language/' },
      to: { path: '^src/debugger/' },
    },

    {
      name: 'no-rom-to-emulator',
      comment: 'The ROM tab takes CDL data as plain arrays injected by extension.js, never the emulator itself.',
      severity: 'warn',
      from: { path: '^src/rom/' },
      to: { path: '^src/emulator/' },
    },

    {
      name: 'no-music-to-emulator',
      comment: 'The Music tab gets the emulator sound-chip stream injected by extension.js, never the emulator itself.',
      severity: 'warn',
      from: { path: '^src/music/' },
      to: { path: '^src/emulator/' },
    },

    {
      name: 'scripts-tab-no-features',
      comment: 'The Scripts tab gets the animation renderer (sprites) and the silent music player (music) injected by extension.js; it imports libraries only.',
      severity: 'error',
      from: { path: '^src/scripts-tab/' },
      to: { path: '^src/(sprites|music|rooms|emulator|memory|rom|scaling|docs|debugger|resources|mcp)/' },
    },

    {
      name: 'no-resources-to-emulator',
      comment: 'The soe:// file system gets the emulator ROM and memory reads injected by extension.js.',
      severity: 'warn',
      from: { path: '^src/resources/' },
      to: { path: '^src/emulator/' },
    },

    // ── Secret of Mana stays apart from Evermore (src/mana*/AGENTS.md) ─────────

    {
      name: 'mana-is-alone',
      comment: 'src/mana is a pure Secret of Mana library: no Evermore (or any other src/) code.',
      severity: 'error',
      from: { path: '^src/mana/' },
      to: { path: '^src/(?!mana/)' },
    },

    {
      name: 'mana-resources-only-mana',
      comment: 'The som:// file system uses the Mana library and nothing Evermore.',
      severity: 'error',
      from: { path: '^src/mana-resources/' },
      to: { path: '^src/(?!mana-resources/|mana/)' },
    },

    {
      name: 'map-editor-core-is-game-neutral',
      comment: 'The shared map-editor core (history, sessions, grid strokes, tool strip) knows no game: it imports nothing from src/ outside itself.',
      severity: 'error',
      from: { path: '^src/shared/webview/map-editor-core/' },
      to: { path: '^src/(?!shared/webview/map-editor-core/)' },
    },

    {
      name: 'map-editor-shell-is-game-neutral',
      comment: 'The shared editor shell (frame, rail, layout, zoom/pan, pill, status bar, dock) knows no game: it imports nothing from src/ outside itself.',
      severity: 'error',
      from: { path: '^src/shared/webview/map-editor-shell/' },
      to: { path: '^src/(?!shared/webview/map-editor-shell/)' },
    },

    {
      name: 'mana-maps-reads-som-only',
      comment: 'The Mana Maps panel reads Mana data through som:// only.',
      severity: 'error',
      from: { path: '^src/mana-maps/' },
      to: { path: '^src/(?!mana-maps/)' },
    },

    {
      name: 'no-evermore-to-mana',
      comment: 'Evermore domains never use Mana code; only extension.js wires the two side by side.',
      severity: 'error',
      from: { path: '^src/', pathNot: '^src/(mana|mana-resources|mana-maps|mana-to-evermore)/|^src/extension\\.js$' },
      to: { path: '^src/(mana|mana-resources|mana-maps|mana-to-evermore)/' },
    },

    {
      name: 'mana-to-evermore-bridges-libraries',
      comment: 'The one converter between the games: the Mana library, the Evermore maps library and shared helpers, nothing else.',
      severity: 'error',
      from: { path: '^src/mana-to-evermore/' },
      to: { path: '^src/(?!mana-to-evermore/|mana/|maps/|shared/)' },
    },

    {
      name: 'simulation-is-a-library',
      comment: 'src/simulation is pure: it may use the script decoder facade and nothing else in src/.',
      severity: 'error',
      from: { path: '^src/simulation/' },
      to: { path: '^src/(?!simulation/|script/)' },
    },

    {
      name: 'no-mcp-to-domains',
      comment: 'The MCP server reads soe:// through vscode.workspace.fs only.',
      severity: 'warn',
      from: { path: '^src/mcp/' },
      to: { path: '^src/(?!mcp/)' },
    },

    {
      name: 'recorder-is-the-emulator',
      comment: 'The SNES CDL Recorder (src/recorder) is the emulator panel in its recorder profile; it ships only what it requires (tools/recorder/package-files.js), so it builds on nothing else.',
      severity: 'warn',
      from: { path: '^src/recorder/' },
      to: { path: '^src/(?!recorder/|emulator/)' },
    },

    {
      name: 'nothing-imports-the-recorder',
      comment: 'src/recorder is an activation entry, like src/extension.js.',
      severity: 'warn',
      from: { path: '^src/(?!recorder/)' },
      to: { path: '^src/recorder/' },
    },

    {
      name: 'no-language-to-emulator',
      comment: 'Language features must not depend on the emulator.',
      severity: 'warn',
      from: { path: '^src/language/' },
      to: { path: '^src/emulator/' },
    },

    {
      name: 'no-language-to-memory-ui',
      comment: 'Language providers may use shared/radar-utils but not memory rendering.',
      severity: 'warn',
      from: { path: '^src/language/' },
      to: { path: '^src/memory/(render-|webview/)' },
    },

    {
      name: 'no-debugger-to-memory',
      comment: 'The debugger must not trigger radar rendering. IPC routes through extension.js.',
      severity: 'warn',
      from: { path: '^src/debugger/' },
      to: { path: '^src/memory/' },
    },

    {
      name: 'no-memory-to-debugger-dap',
      comment: 'Memory radar has no reason to call the debugger.',
      severity: 'warn',
      from: { path: '^src/memory/' },
      to: { path: '^src/debugger/' },
    },

    {
      name: 'no-sibling-tabs',
      comment: 'Rooms and scaling are sibling tab domains — no direct coupling.',
      severity: 'warn',
      from: { path: '^src/rooms/' },
      to: { path: '^src/scaling/' },
    },

    {
      name: 'no-scaling-to-rooms',
      comment: 'Scaling tab must not depend on rooms tab.',
      severity: 'warn',
      from: { path: '^src/scaling/' },
      to: { path: '^src/rooms/' },
    },

    {
      name: 'no-shared-to-vscode',
      comment: 'Shared utilities must be importable in any Node.js environment.',
      severity: 'warn',
      from: { path: '^src/shared/' },
      to: { path: '^vscode$' },
    },

    {
      name: 'no-maps-to-vscode',
      comment: 'ROM analysis models are pure and must not depend on VS Code.',
      severity: 'warn',
      from: { path: '^src/maps/' },
      to: { path: '^vscode$' },
    },

    {
      name: 'no-maps-to-memory-ui',
      comment: 'ROM analysis models must not import memory tab rendering code.',
      severity: 'warn',
      from: { path: '^src/maps/' },
      to: { path: '^src/memory/(render-|webview/)' },
    },

  ],


  // ── MODULE OPTIONS ──────────────────────────────────────────────────────────

  options: {
    doNotFollow: {
      path: [
        'node_modules',
        'src/emulator/core/',
        '\\.bak$',
      ],
    },
    exclude: {
      path: [
        '\\.test\\.js$',
        'script_parser/dependencies/',
        'tmp/',
      ],
    },
    moduleSystems: ['cjs'],
    combinedDependencies: false,
    reporterOptions: {
      dot: {
        collapsePattern: 'node_modules/[^/]+',
      },
      archi: {
        collapsePattern: '^(node_modules|src/emulator/webview|src/memory/webview|src/rooms/webview|src/scaling/webview)/[^/]+',
      },
    },
  },
};
