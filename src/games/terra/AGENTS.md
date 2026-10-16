# src/games/terra — agent rules

Kind: **game** module (see `AI_ARCHITECTURE_GUIDE.md` §2, `docs/architecture/multi-game.md` §3).
Terranigma domain: descriptor, ROM header detection, and room table inspection.

## Owns
- `descriptor.ts`: game id (`terra`), scheme (`terra`), title matching (`TERRANIGMA`, `TENCHI-JPN`), variants (European base ROM, German, French, Spanish, Japanese).
- `rom.ts`: Terranigma ROM validation, Map Table A (1104 rooms at PC `$06959C`), Map Table B (events at PC `$06A28C`), and room pointer decoding.
- `index.ts`: Public exports for the domain.

## Dependencies
- `platform/` only (`platform/games`, `platform/roms/header`, `platform/snes/hirom`).
- Never imports Evermore (`games/evermore`) or Mana (`games/mana`), enforcing rule `games-stay-apart`.
- Facts never cross games (AGENTS.md §0.4): Terranigma facts live in `docs/terra/`.

## Invariants
- Base ROM is the English European release (`TERRANIGMA P`, SHA-1 `911239b4b21106ae4a284454d345c55554985525`).
- Unused room slots in Table A are represented by pointer `$000002`.
- Address facts are documented in `docs/terra/` with evidence from the ROM or running game.
