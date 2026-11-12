# ExHiROM

Everything about running Secret of Evermore from an ExHiROM (up to 8 MB) cartridge layout
instead of its original 3 MB HiROM.

| Page | What it answers |
|---|---|
| [port.md](port.md) | Why ExHiROM, the bus map, header/vectors, the mirror audit, what was built and how it was proven |
| [layout-options.md](layout-options.md) | Stay HiROM vs ExHiROM vs SA‑1: Evermore's ROM map, which are mutually exclusive, effort, benefits, the staged plan CDL → recomp → ExHiROM → SA‑1 |
| [../sa1/port.md](../sa1/port.md) | The SA-1 port: one 8 MB image holding both the LoROM and the linear view, the cycle-exact boot, the MesenCE proof, next steps |
| [../sa1/uses.md](../sa1/uses.md) | 50 uses for the SA-1 CPU, BW-RAM and mapper, each scored for effort and benefit, with a suggested order |
| [combo-rom.md](combo-rom.md) | A second game next to Evermore: where it can go, why LoROM partners fit and HiROM partners must move, candidate games, SMZ3-shaped architecture |

Code: `tools/exhirom/` (`npm run exhirom`). Addresses found on the
way are knowledge entries: `src/games/evermore/localizations/knowledge/routines/CPU_VECTORS.md`, `80823a.md`, `80d113.md`.
Today's HiROM layout: `.agents/skills/memory-map/SKILL.md`.
