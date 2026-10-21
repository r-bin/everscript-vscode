# src/games/terra — Terranigma

Rules for agents: [AGENTS.md](AGENTS.md). Facts: [docs/terra/README.md](../../../docs/terra/README.md).

| Path | What |
|---|---|
| `descriptor.ts` | game id `terra`, scheme `terra`, title match (`TERRANIGMA`, `TENCHI-JPN`), variants (European base, German, German Rev 1, French, Spanish, Japanese) |
| `decoder/` | pure TS: the room table, the game's own room loader run on the platform's 65816 interpreter, a room's layers / metatiles / palette / display registers, its picture and metatile sheets, the catalog of rooms and pictures, what each cell type does to a move, a room's exits ([README](decoder/README.md)) |
| `resources/` | the read-only `terra://` file system: rooms as pictures and JSON ([README](resources/README.md)) |
| `maps/` | the Terranigma Maps panel: every room that loads a map, on the shared editor shell ([README](maps/README.md)) |
| `extension.ts` | registers `terra://`, the panel command and the game view (Open Memory Radar with a Terranigma ROM selected) |

Checked against the running game with `node tools/terra/check-room.mts <room>` (pictures) and
`node tools/terra/check-exit.mts <room> [exit] [--flag <hex>]` (exits) (docs/terra/README.md §5).
