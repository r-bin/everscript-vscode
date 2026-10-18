---
name: test-discipline
description: Rules for test execution time, test tiering (fast unit tests vs on-demand long tests), avoiding redundant emulator replays, and strict timeout discipline to respect developer time.
applyTo: "tests/**,tools/test.mts"
---

# Test Discipline & Execution Time

Respect developer time. Fast feedback loops keep development productive; slow, unconstrained, or
flaky tests destroy momentum.

---

## 1. Test Tiers & Execution Frequency

Tests are organized into strict tiers (`tests/tiers.json`, run via `tools/test.mts`):

| Tier | Script | Target Time | When to Run |
|---|---|---|---|
| `unit` | `npm test` | ~7 s | **Every change.** No ROM, no browser, no native compilation. |
| `rom` | `npm run test:rom` | ~80 s | On demand when touching ROM decoding or game mechanics. |
| `dom` | `npm run test:dom` | ~45 s | On demand when changing webview layouts or DOM scripts. |
| `emulator` | `npm run test:emulator` | ~20 s | On demand when changing emulator cores or DAP protocol. |
| `all` | `npm run test:all` | ~3 min | Pre-release or major refactor verification only. |

**Rule:** Never run slow tiers during routine iterations. Run only the targeted test or `unit`.

---

## 2. Eliminate Redundant Replays

- **Do not replay the same emulator file 100 times.** One solid replay test that exercises the code
  path provides high confidence; repeating it 100 times adds execution cost without value.
- When testing edge cases, prefer isolated headless CPU harness execution (`cpu65816.ts`) over
  full-system emulator replays whenever possible.

---

## 3. Strict Timeouts Everywhere

- Every asynchronous test, network/IPC call, and emulator wait loop **must** specify an explicit timeout.
- Never allow a test or CLI script to hang indefinitely. If an emulator state or webview event is
  not reached within the expected window (e.g. 5–10s), fail fast with a descriptive error.
- Tests that take variable or prolonged execution times must be placed in on-demand tiers or
  marked in `manual` with an explicit reason.
