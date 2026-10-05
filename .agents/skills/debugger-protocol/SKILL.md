---
name: debugger-protocol
description: Debug adapter protocol (DAP) implementation, breakpoint management, and mock runtime in src/debugger/.
applyTo: "src/debugger/**"
---

# Skill: Debugger Protocol

Use this skill when modifying the Debug Adapter Protocol (DAP) implementation (`src/debugger/adapter.js`),
the breakpoint tracker, or the mock execution runtime (`src/debugger/mock-runtime.js`).

---

## 1. Responsibilities

- DAP request and event routing (`initialize`, `launch`, `setBreakpoints`, `threads`, `stackTrace`, `scopes`, `variables`, `continue`, `next`, `stepIn`, `stepOut`).
- Source mapping from `.evs` function names and instructions to runtime call stacks.
- Synchronization with the embedded emulator core when live debugging is active.
