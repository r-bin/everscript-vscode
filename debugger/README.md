# Debugger (Experimental)

This folder contains the extension-side debugger adapter/runtime and the tracked emulator-core fork used for debugger-facing integration work.

## Core Submodule

The SNES core fork is tracked as a git submodule:

- Path: `debugger/core/snes9x`
- Remote: `https://github.com/r-bin/snes9x2005-wasm.git`

Clone/update commands:

```bash
git submodule update --init --recursive
git submodule update --remote --recursive
```

Submodule branch workflow for VS Code debugger work:

```bash
cd debugger/core/snes9x
git checkout -b vscode-debugger-integration
```

Full integration notes (including tmp migration and architecture layout):

- `docs/snes9x_integration.md`

## Future Scope

Potential features to explore:
- Bytecode step-through and breakpoints
- Memory watchpoints and conditional halts
- Script call stack inspection
- Frame-by-frame execution control
