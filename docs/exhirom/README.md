# ExHiROM

Everything about running Secret of Evermore from an ExHiROM (up to 8 MB) cartridge layout
instead of its original 3 MB HiROM.

| Page | What it answers |
|---|---|
| [port.md](port.md) | Why ExHiROM, the bus map, header/vectors, the mirror audit, what was built and how it was proven |
| [layout-options.md](layout-options.md) | Stay HiROM vs ExHiROM vs SA‑1: Evermore's ROM map, which are mutually exclusive, effort, benefits, the staged plan CDL → recomp → ExHiROM → SA‑1 |
| [combo-rom.md](combo-rom.md) | A second game next to Evermore: where it can go, why LoROM partners fit and HiROM partners must move, candidate games, SMZ3-shaped architecture |

Code: `tools/exhirom/` (`npm run exhirom`, `scripts/build-exhirom.sh`). Addresses found on the
way are knowledge entries: `src/games/evermore/localizations/knowledge/rom/00ffe0.md`, `80823a.md`, `80d113.md`.
Today's HiROM layout: `.agents/skills/snes-memory-mapping/SKILL.md`.
