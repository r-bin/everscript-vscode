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

    {
      name: 'no-sandbox-to-src',
      comment: 'sandbox/ contains experiments only. It must not import from src/.',
      severity: 'error',
      from: { path: '^sandbox/' },
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
      comment: 'DAP adapter must not trigger radar rendering. IPC routes through extension.js.',
      severity: 'warn',
      from: { path: '^src/debugger/(adapter|mock-runtime)\\.js' },
      to: { path: '^src/memory/' },
    },

    {
      name: 'no-memory-to-debugger-dap',
      comment: 'Memory radar has no reason to call DAP adapter functions.',
      severity: 'warn',
      from: { path: '^src/memory/' },
      to: { path: '^src/debugger/(adapter|mock-runtime)\\.js' },
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
        'sandbox/',
        'tmp/',
        'experimental/',
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
