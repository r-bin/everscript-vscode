# Debugger (Experimental)

This folder contains the debugger feature: adapter/runtime plus its emulator and core subfolders.

## Core Submodules

The SNES cores are tracked as git submodules under `debugger/core/`:

- Debugger fork: `debugger/core/snes9x2005-wasm`
- Vanilla base: `debugger/core/snes9x2005-wasm-vanilla`

Clone/update commands:

```bash
git submodule update --init --recursive
git submodule update --remote --recursive
```

Submodule branch workflow for VS Code debugger work:

```bash
cd debugger/core/snes9x2005-wasm
git checkout feature/vscode-debugger-integration
```

Full integration notes (including tmp migration and architecture layout):

- `docs/snes9x_integration.md`

## Future Scope

Potential features to explore:
- Bytecode step-through and breakpoints
- Memory watchpoints and conditional halts
- Script call stack inspection
- Frame-by-frame execution control
