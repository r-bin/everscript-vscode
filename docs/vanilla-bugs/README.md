# Secret of Evermore — Known Vanilla Bugs

This directory documents verified bugs in the retail *Secret of Evermore* ROMs, derived directly from ROM disassembly, CDL traces, and hardware/emulator execution.

## Catalog

| Bug | ROM Address | Subsystem | Impact | Document |
|---|---|---|---|---|
| **Mode 7 Bank `$B0` Out-of-Bounds ROM Read** | `$80:D113` ([`row_table_low_bytes_from_bank_b0`](../../src/games/evermore/localizations/knowledge/routines/row_table_low_bytes_from_bank_b0.md)) | Mode 7 Overworld Flight (`$80:BC00`) | Sets `DB = $B0` (`PEA $B090; PLB; PLB`) and reads 32 bytes from `$B0:E293,X` (file `0x30E293+X`, past the 3 MB ROM) into `$7E:2090..$7E:20AF`. Harmless on retail hardware because `$7E:2090..$7E:20AF` is never read, but causes WRAM divergence across emulators, static recompilation, 4 MB expansions, and ExHiROM builds. | [mode7-bank-b0-oob-read.md](mode7-bank-b0-oob-read.md) |
| **5 Status Effects Eviction Overflow** | `$91:B7FA` | Alchemy / Status Slots (`+$46`) | Casting a 5th buff evicts an existing status slot, but the eviction routine runs the cleanup handler for the *new* status ID instead of the *evicted* status ID, leaving the old stat boost and outline glow permanently active. | [../5-status-effects-bug.md](../5-status-effects-bug.md) |
| **Atlas Boost Retention** | `$91:BD2D` | Combat / Status Buffs | Stat recalculation on death/revival or save does not subtract an active Atlas boost before updating base stats, inflating attack permanently. | [../patches/bugfixes-and-engine-fixes.md](../patches/bugfixes-and-engine-fixes.md) |
| **Unlimited Bazooka Ammo Underflow** | `$90:82E4` | Weapons / Bazooka | Swapping/selecting Bazooka ammo types with 0 count underflows the ammo counter to 255. | [../patches/bugfixes-and-engine-fixes.md](../patches/bugfixes-and-engine-fixes.md) |
| **Silver Sheath Passive Leak** | `$8F:8464` / `$8F:8480` | Combat / Attack Math | Attack calculation checks equipped sword level without verifying possession of the Silver Sheath charm (`$7E:2261`). | [../patches/bugfixes-and-engine-fixes.md](../patches/bugfixes-and-engine-fixes.md) |
| **Bazooka Charge Level 0** | `$8D:A521` / `$8F:8057` | Weapons / Charge Gauge | Weapon charge logic initializes the Bazooka at Level 0 rather than Level 1. | [../patches/bugfixes-and-engine-fixes.md](../patches/bugfixes-and-engine-fixes.md) |
| **Miracle Cure Confound Omission** | Spell effect table | Alchemy / Miracle Cure | Miracle Cure's status cleanup bitmask omits the Confound (reverse D-pad) status bit. | [../patches/bugfixes-and-engine-fixes.md](../patches/bugfixes-and-engine-fixes.md) |
