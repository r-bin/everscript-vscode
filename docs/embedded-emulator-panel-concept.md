# Everscript VS Code Debugger Architecture

## Overview

This document describes the architecture, feasibility, challenges, and implementation strategy for building a source-level debugger for Everscript scripts running inside a SNES game.

The key architectural realization is:

> We are not building a SNES debugger.
>
> We are building a debugger for a custom virtual machine (VM) that happens to run on SNES hardware.

This dramatically simplifies the problem compared to traditional emulator debugging.

---

# Core Runtime Architecture

```text
.evs source
    ↓
Everscript compiler
    ↓
Bytecode script
    ↓
Script VM running in WRAM
    ↓
SNES Emulator
```

The debugger focuses entirely on:

```text
VM state
```

instead of:

```text
65816 CPU state
```

This avoids most of the complexity associated with low-level SNES debugging.

---

# Existing Advantages

The project already has several major advantages:

- Full bytecode decoder
- Documentation of the VM stack
- Knowledge of VM execution semantics
- Deterministic bytecode mapping
- Everscript compiler
- Ability to dump vanilla scripts
- Structured runtime data in WRAM

This means:
- variable inspection is feasible
- call stacks are feasible
- symbolic debugging is feasible
- source mapping is feasible
- stepping is feasible

Most retro debugging projects fail because these runtime semantics are unknown.

---

# Debugger Goals

The intended debugger should support:

- Embedded emulator inside VS Code
- One-button compile + launch workflow
- Live WRAM inspection
- Script-aware breakpoints
- Bytecode stepping
- Source-level stepping
- Variable inspection
- Call stacks
- Watch expressions
- Conditional breakpoints
- Source ↔ bytecode synchronization
- Debugging vanilla ROM scripts
- Debugging compiled `.evs` source

---

# Proposed UI Layout

The ideal UI consists of three synchronized panels.

```text
┌─────────────────────────────┐
│ .evs Source                 │
│-----------------------------│
│ if (x == 5)                 │
│   spawnBoss()               │
└─────────────────────────────┘

┌─────────────────────────────┐
│ Everscript Bytecode         │
│-----------------------------│
│ PUSH 5                      │
│ CMP_EQ                      │
│ JZ 0x24                     │
│ CALL spawnBoss              │
└─────────────────────────────┘

┌─────────────────────────────┐
│ Emulator                    │
│-----------------------------│
│ [SNES framebuffer]          │
└─────────────────────────────┘
```

---

# Why This Architecture Is Strong

## 1. Backwards Compatibility

The debugger can operate directly on:
- vanilla ROMs
- dumped byte scripts
- modded ROMs
- compiled `.evs` source

Even without source code, users can:
- set breakpoints
- inspect bytecode
- step through scripts

This is extremely powerful.

---

## 2. Stable Runtime Semantics

Because debugging occurs at the VM level:
- breakpoints are deterministic
- stepping is deterministic
- call stacks are deterministic

This avoids the ambiguity of ASM-level debugging.

---

## 3. Natural Source Mapping

The compiler already defines:

```text
.evs command
    ↓
bytecode instructions
```

This naturally creates a source map.

One `.evs` command may map to multiple bytecode instructions, but the mapping is deterministic and known at compile time.

---

# Emulator Requirements

The debugger only requires a small subset of emulator functionality.

## Required Emulator Features

### 1. Pause / Resume

The emulator must support freezing:
- CPU
- PPU
- DMA
- timers
- audio
- input

This is essential for deterministic debugging.

---

### 2. WRAM Read Access

Required for:
- VM stack inspection
- instruction pointer tracking
- variable inspection
- current script state

---

### 3. WRAM Write Access

Required for:
- modifying variables
- breakpoint logic
- forced stepping
- runtime manipulation

---

### 4. Frame or Execution Callback

The debugger requires recurring execution hooks.

Possible options:
- per frame
- per CPU cycle
- per VM dispatch

This allows the debugger to:
- observe VM execution
- detect opcode changes
- synchronize state
- evaluate breakpoints

---

# Emulator Fork Requirements

A custom emulator fork is probably necessary eventually.

However, the required modifications are relatively small compared to a full debugger emulator.

Likely additions:
- pause/resume API
- frame stepping API
- WRAM exposure API
- execution callback hooks
- save state API
- debugger synchronization API

This is far simpler than implementing:
- ASM stepping
- symbolic CPU debugging
- full trace systems

---

# VM-Level Debugging

The debugger operates entirely on VM state.

Instead of:

```text
break when SNES PC == X
```

the debugger does:

```text
break when VM_IP == X
```

This is the core architectural simplification.

---

# VM Runtime State

The debugger likely needs access to:

| Runtime State | Purpose |
|---|---|
| VM instruction pointer | current execution |
| current script ID | source mapping |
| VM stack pointer | stack inspection |
| locals pointer | variable decoding |
| call stack | stepping |
| current opcode | bytecode decoding |
| scheduler state | multi-script debugging |

---

# VM Instrumentation Strategy

There are two major approaches.

---

# Strategy A — Passive Polling

The extension repeatedly reads:
- VM IP
- stack
- current opcode
- runtime state

Example:
- once per frame

## Advantages

- simple
- minimal ROM modification
- minimal emulator changes

## Disadvantages

- less precise stepping
- less precise breakpoints
- intermediate states may be missed

Good for:
- memory radar
- execution visualization
- lightweight debugging

---

# Strategy B — VM Dispatch Hooking

This is likely the ideal long-term architecture.

The VM dispatcher is instrumented.

Example:

```asm
MainVMDispatch:
    JSR DebugHook
    JMP (OpcodeTable,X)
```

Now every opcode execution passes through debugger logic.

This enables:
- precise stepping
- accurate breakpoints
- call tracking
- execution synchronization

---

# Recommended Hybrid Architecture

## Emulator Responsibilities

The emulator should provide:
- rendering
- input
- pause/resume
- frame stepping
- save states
- WRAM access

---

## VM Responsibilities

The VM layer should provide:
- breakpoint evaluation
- opcode stepping
- variable inspection
- call stack generation
- source mapping
- execution tracking

---

## VS Code Responsibilities

VS Code handles:
- UI
- editor integration
- breakpoint UI
- watches
- call stack panels
- DAP integration

---

# Breakpoint System

## Source Breakpoints

Example:

```text
boss.evs:144
```

Maps to:

```text
script 0x12 opcode 0x44
```

---

## Bytecode Breakpoints

Example:

```text
script 0x12 offset 0x44
```

Works even without source files.

---

## Conditional Breakpoints

Example:

```text
break if bossHP < 100
```

Evaluated using WRAM state.

---

# Stepping Semantics

Because the debugger operates on VM execution, stepping becomes well-defined.

## Step Into

Execute one VM opcode.

---

## Step Over

Run until:

```text
current_stack_depth <= previous_stack_depth
```

---

## Step Out

Run until:

```text
current_stack_depth < previous_stack_depth
```

These semantics closely resemble modern language debuggers.

---

# Variable Inspection

Because the VM stack and runtime structures are documented, the debugger can display:

```text
Locals
  x = 5
  target = NPC_12

Globals
  currentMap = 3
  bossPhase = 2
```

This is a major advantage compared to traditional ROM hacking tools.

---

# Multi-Layer Mapping System

The debugger effectively operates on three layers:

```text
.evs source
    ↓
Everscript bytecode
    ↓
VM runtime state
```

This layered approach enables:
- source highlighting
- bytecode highlighting
- runtime inspection
- backwards compatibility

---

# Compatibility With Vanilla ROMs

One of the strongest features of this architecture is that the debugger does not require source code.

The debugger can still:
- decode bytecode
- step execution
- inspect variables
- analyze VM state
- debug triggers

This makes the debugger useful even for reverse engineering.

---

# Suggested Implementation Roadmap

# Phase 1 — Embedded Emulator

Features:
- launch emulator
- compile ROM
- auto-load ROM
- pause/reset

---

# Phase 2 — Live Memory Radar

Features:
- WRAM inspection
- symbolic labels
- live updates
- value highlighting

---

# Phase 3 — VM Inspector

Features:
- current opcode
- current script
- VM stack
- locals/globals
- call stack

---

# Phase 4 — Bytecode Viewer

Features:
- live execution highlighting
- breakpoint support
- stepping support

---

# Phase 5 — Bytecode Breakpoints

Features:
- pause on opcode
- conditional breakpoints
- execution control

---

# Phase 6 — Source Mapping

Features:
- `.evs` ↔ bytecode mapping
- source highlighting
- source breakpoints

---

# Phase 7 — Full VS Code Debugger

Features:
- Debug Adapter Protocol (DAP)
- VARIABLES panel
- WATCH panel
- CALL STACK panel
- STEP INTO / OVER / OUT
- breakpoint integration

---

# Major Remaining Unknowns

## 1. VM Scheduling

Can multiple scripts execute simultaneously?

If yes:
- debugger may require thread/task visualization

---

## 2. Yield Semantics

Does the VM:
- yield every frame?
- suspend on waits?
- execute continuously?

This affects stepping behavior.

---

## 3. Stack Frame Structure

Questions:
- Are call frames explicit?
- Are locals stack-based?
- Are frames nested?

This affects:
- variable inspection
- stepping
- call stacks

---

## 4. Runtime Script Mutation

Can scripts:
- modify scripts
- generate bytecode dynamically?

If yes:
- source mapping becomes harder

---

# Future Possibilities

## Time-Travel Debugging

Because:
- emulator save states exist
- VM state is compact

The debugger could eventually support:
- rewind
- reverse stepping
- execution history

This would be extremely powerful for ROM hacking.

---

# Final Assessment

This project is absolutely feasible.

The critical reason is:

> The runtime semantics of the VM are already understood.

That is usually the hardest problem in retro debugging.

This is no longer:
- a low-level SNES debugger problem

It is now:
- a structured VM debugger problem

which is dramatically more manageable.

---

# Overall Feasibility Estimate

| Feature | Difficulty |
|---|---|
| Embedded emulator | Easy |
| Compile + launch workflow | Easy |
| Live WRAM viewer | Medium |
| VM inspector | Medium |
| Bytecode stepping | Medium |
| Bytecode breakpoints | Medium |
| Source mapping | Hard |
| Full DAP debugger | Hard |
| Time-travel debugging | Very Hard |

---

# Recommended Architectural Direction

The ideal architecture is:

```text
Everscript
    ↓
Bytecode VM
    ↓
VM Debug Layer
    ↓
SNES Emulator
```

NOT:

```text
Everscript
    ↓
Raw 65816 ASM
    ↓
CPU-Level Debugging
```

The VM architecture is the key reason this project is realistically achievable.
