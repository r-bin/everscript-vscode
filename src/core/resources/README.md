# src/core/resources — a game's ROM as files

`rom-file-system.ts`: a read-only VS Code `FileSystemProvider` for any game. The game passes its scheme
(`terra`), a ROM getter (the ROM library's path for that game) and a pure `resolve(segments, rom)` that says
what each `<scheme>://rom/...` path is: a folder and its entries, or a file and how to produce its bytes.
Produced files are cached per ROM buffer. Game-neutral: no game is named here (`core-knows-no-game`).
Used by `terra://`; `soe://` and `som://` still have their own copies of the same idea.
