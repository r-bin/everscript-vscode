# Integrating Snes9x2005-WASM Fork into Debugger Core

This document describes how to integrate the fork  
https://github.com/r-bin/snes9x2005-wasm  
into the ROM hacking debugger project, migrate temporary modifications, and prepare a VSCode debugger integration layer.

---

# 1. Goals of this integration

We want to:

- Embed the Snes9x2005 WASM fork into `/debugger/core`
- Move experimental modifications from `/tmp` into a stable structure
- Preserve upstream sync ability
- Create a dedicated branch for VSCode debugger integration
- Reapply or reconstruct previous experimental modifications (if available)

---

# 2. Add the fork as a tracked dependency

## Option A (recommended): git subtree

```bash
git subtree add \
  --prefix=debugger/core/snes9x \
  https://github.com/r-bin/snes9x2005-wasm.git \
  master --squash
```

This gives:
- full source embedded in repo
- no submodule complexity
- easy CI builds

---

## Option B: git submodule (alternative)

```bash
git submodule add \
  https://github.com/r-bin/snes9x2005-wasm.git \
  debugger/core/snes9x
```

Then:

```bash
git submodule update --init --recursive
```

---

# 3. Move existing temporary modifications

Assume current experimental work lives in:

```
/tmp/
```

We want to migrate it into:

```
/debugger/core/snes9x-mods/
```

## Step 1: create target structure

```bash
mkdir -p debugger/core/snes9x-mods
```

## Step 2: move code

```bash
git mv tmp/* debugger/core/snes9x-mods/
```

If `tmp/` is not tracked:

```bash
mv tmp/* debugger/core/snes9x-mods/
git add debugger/core/snes9x-mods
git rm -r tmp
```

---

## Step 3: separate "core fork" vs "mod layer"

After migration, structure should be:

```
debugger/core/snes9x/          # upstream WASM core
debugger/core/snes9x-mods/     # your instrumentation / patches
```

Recommended rule:
- NEVER modify upstream directly unless required
- Prefer hooks / overlays in `snes9x-mods`

---

# 4. Create VSCode debugger integration branch

We create a feature branch dedicated to debugging tooling:

```bash
git checkout -b feature/vscode-debugger-integration
```

This branch will contain:

- Debug adapter protocol (DAP) glue
- Emulator breakpoints
- Memory inspection bridge
- CPU/PPU stepping hooks
- Trace logging integration

---

# 5. Hooking debugger instrumentation into Snes9x

Inside:

```
debugger/core/snes9x/
```

We introduce minimal, non-invasive hooks:

### Example hook points:

- CPU instruction dispatch
- Memory read/write
- Frame advance
- Interrupt handling

### Recommended pattern:

```c
if (debugger_enabled) {
    debugger_on_cpu_step(cpu_state);
}
```

OR via function pointers:

```c
extern void (*debug_cpu_step)(CPUState* state);
```

This keeps upstream mergeable.

---

# 6. Reapplying previous modifications from `/tmp`

## Important limitation

There is no reliable way to automatically reconstruct prior changes unless:

- git history exists in `/tmp`
- patch files exist
- or AI logs explicitly describe modifications

---

## If patch files exist

```bash
git apply tmp/*.patch
```

---

## If only code snapshots exist

```bash
diff -ru debugger/core/snes9x tmp/ > tmp_changes.diff
less tmp_changes.diff
git apply --reject --whitespace=fix tmp_changes.diff
```

---

## If AI logs describe changes

Reconstruct as a patch layer:

```
debugger/core/snes9x-mods/patches/
```

---

# 7. Build integration layout

```
debugger/
  core/
    snes9x/
    snes9x-mods/
  vscode/
    debug-adapter/
    extension/
  runtime/
    bridge/
```

---

# 8. Recommended architecture for debugger control

- CPU step control
- Memory inspection
- Execution tracing
- Breakpoints (PC + memory)
