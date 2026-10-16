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

    // ── GAME-NEUTRAL LAYERS (docs/architecture/multi-game.md §2) ───────────
    {
      name: 'platform-knows-no-game',
      comment: 'platform/ is SNES facts and machinery only: it imports neither core/ nor any game.',
      severity: 'error',
      from: { path: '^src/platform/' },
      to: { path: '^(src/(core|games)/|dist/(core|games)/)' },
    },
    {
      name: 'platform-stands-alone',
      comment: 'platform/ imports only itself (and node built-ins): SNES facts, the CDL engine, the ROM library.',
      severity: 'error',
      from: { path: '^src/platform/' },
      to: { path: '^src/(?!platform/)' },
    },
    {
      name: 'core-knows-no-game',
      comment: 'core/ is game-neutral: it imports platform/ only. Games register through registerGame().',
      severity: 'error',
      from: { path: '^src/core/' },
      to: { path: '^(src/games/|dist/games/)' },
    },
    {
      name: 'games-stay-apart',
      comment: 'A game never imports another game (the only bridge is games/<game>/imports/<other>/).',
      severity: 'error',
      from: { path: '^src/games/([^/]+)/', pathNot: '^src/games/[^/]+/imports/' },
      to: { path: '^src/games/', pathNot: ['^src/games/$1/', '^src/games/index\\.ts$'] },
    },

    // ── DOMAIN ISOLATION RULES (warn) ──────────────────────────────────────

    {
      name: 'no-language-to-debugger',
      comment: 'Language features must not depend on the debugger.',
      severity: 'warn',
      from: { path: '^src/games/evermore/language/' },
      to: { path: '^src/games/evermore/debugger/' },
    },

    {
      name: 'no-rom-to-emulator',
      comment: 'The ROM tab takes CDL data as plain arrays injected by extension.js, never the emulator itself.',
      severity: 'warn',
      from: { path: '^src/games/evermore/rom/' },
      to: { path: '^src/emulator/' },
    },

    {
      name: 'no-music-to-emulator',
      comment: 'The Music tab gets the emulator sound-chip stream injected by extension.js, never the emulator itself.',
      severity: 'warn',
      from: { path: '^src/games/evermore/music/' },
      to: { path: '^src/emulator/' },
    },

    {
      name: 'scripts-tab-no-features',
      comment: 'The Scripts tab gets the animation renderer (sprites) and the silent music player (music) injected by extension.js; it imports libraries only.',
      severity: 'error',
      from: { path: '^src/games/evermore/scripts-tab/' },
      to: { path: '^src/(rooms|emulator|memory|docs|mcp)/|^src/games/evermore/(sprites|music|rom|scaling|debugger|resources)/' },
    },

    {
      name: 'no-resources-to-emulator',
      comment: 'The soe:// file system gets the emulator ROM and memory reads injected by extension.js.',
      severity: 'warn',
      from: { path: '^src/games/evermore/resources/' },
      to: { path: '^src/emulator/' },
    },

    // ── Secret of Mana stays apart from Evermore (src/games/mana/*/AGENTS.md) ─────────

    {
      name: 'mana-decoder-is-alone',
      comment: 'games/mana/decoder is a pure Secret of Mana library: no Evermore code; SNES facts from platform/snes only.',
      severity: 'error',
      from: { path: '^src/games/mana/decoder/' },
      to: { path: '^(src|dist)/(?!games/mana/decoder/|platform/snes/)' },
    },

    {
      name: 'mana-resources-only-mana',
      comment: 'The som:// file system uses the Mana decoder and nothing Evermore.',
      severity: 'error',
      from: { path: '^src/games/mana/resources/' },
      to: { path: '^src/(?!games/mana/(resources|decoder)/)' },
    },

    {
      name: 'mana-maps-reads-som-only',
      comment: 'The Mana Maps panel reads Mana data through som:// only.',
      severity: 'error',
      from: { path: '^src/games/mana/maps/' },
      to: { path: '^src/(?!games/mana/maps/)' },
    },

    {
      name: 'no-evermore-to-mana',
      comment: 'Evermore domains never use Mana code; only extension.js wires the two side by side, and games/index.ts lists the game.',
      severity: 'error',
      from: { path: '^src/', pathNot: '^src/games/mana/|^src/games/evermore/imports/mana/|^src/games/index\\.ts$|^src/extension\\.js$' },
      to: { path: '^src/games/(mana/|evermore/imports/mana/)' },
    },

    {
      name: 'mana-import-bridges-libraries',
      comment: 'The one converter between the games (games/evermore/imports/mana): the Mana decoder, the Evermore maps library and shared helpers, nothing else.',
      severity: 'error',
      from: { path: '^src/games/evermore/imports/mana/' },
      to: { path: '^src/(?!games/evermore/imports/mana/|games/mana/decoder/|games/evermore/maps/|games/evermore/rom-readers\.js$|shared/)' },
    },

    {
      name: 'map-editor-core-is-game-neutral',
      comment: 'The shared map-editor core (history, sessions, grid strokes, tool strip) knows no game: it imports nothing from src/ outside itself.',
      severity: 'error',
      from: { path: '^src/core/map-editor/core/' },
      to: { path: '^src/(?!core/map-editor/core/)' },
    },

    {
      name: 'map-editor-shell-is-game-neutral',
      comment: 'The shared editor shell (frame, rail, layout, zoom/pan, pill, status bar, dock) knows no game: it imports nothing from src/ outside itself.',
      severity: 'error',
      from: { path: '^src/core/map-editor/shell/' },
      to: { path: '^src/(?!core/map-editor/shell/)' },
    },

    {
      name: 'simulation-is-a-library',
      comment: 'src/games/evermore/simulation is pure: it may use the script decoder facade and nothing else in src/.',
      severity: 'error',
      from: { path: '^src/games/evermore/simulation/' },
      to: { path: '^src/(?!games/evermore/(simulation|script)/)' },
    },

    {
      name: 'no-mcp-to-domains',
      comment: 'The MCP server reads soe:// through vscode.workspace.fs only.',
      severity: 'warn',
      from: { path: '^src/core/mcp/' },
      to: { path: '^src/(?!core/mcp/)' },
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
      from: { path: '^src/games/evermore/language/' },
      to: { path: '^src/emulator/' },
    },

    {
      name: 'no-language-to-memory-ui',
      comment: 'Language providers may use shared/radar-utils but not memory rendering.',
      severity: 'warn',
      from: { path: '^src/games/evermore/language/' },
      to: { path: '^src/memory/(render-|webview/)' },
    },

    {
      name: 'no-debugger-to-memory',
      comment: 'The debugger must not trigger radar rendering. IPC routes through extension.js.',
      severity: 'warn',
      from: { path: '^src/games/evermore/debugger/' },
      to: { path: '^src/memory/' },
    },

    {
      name: 'no-memory-to-debugger-dap',
      comment: 'Memory radar has no reason to call the debugger.',
      severity: 'warn',
      from: { path: '^src/memory/' },
      to: { path: '^src/games/evermore/debugger/' },
    },

    {
      name: 'no-sibling-tabs',
      comment: 'Rooms and scaling are sibling tab domains — no direct coupling.',
      severity: 'warn',
      from: { path: '^src/rooms/' },
      to: { path: '^src/games/evermore/scaling/' },
    },

    {
      name: 'no-scaling-to-rooms',
      comment: 'Scaling tab must not depend on rooms tab.',
      severity: 'warn',
      from: { path: '^src/games/evermore/scaling/' },
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
      from: { path: '^src/games/evermore/maps/' },
      to: { path: '^vscode$' },
    },

    {
      name: 'no-maps-to-memory-ui',
      comment: 'ROM analysis models must not import memory tab rendering code.',
      severity: 'warn',
      from: { path: '^src/games/evermore/maps/' },
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
        'tmp/',
      ],
    },
    moduleSystems: ['cjs', 'es6'],
    tsPreCompilationDeps: false,  // type-only imports are not runtime edges
    enhancedResolveOptions: { extensions: ['.js', '.ts', '.json'] },
    combinedDependencies: false,
    reporterOptions: {
      dot: {
        collapsePattern: 'node_modules/[^/]+',
      },
      archi: {
        collapsePattern: '^(node_modules|src/emulator/webview|src/memory/webview|src/rooms/webview|src/games/evermore/scaling/webview)/[^/]+',
      },
    },
  },
};
