# Terranigma — WRAM memory map

Working RAM (Bank `$7E` and `$7F`) addresses identified and verified in the running Terranigma (EU) engine (`tools/terra/*.mts`).

---

## Direct Page & System State (`$7E:0000–$7E:0FFF`)

| Address | Size | Name | Purpose & Evidence |
|---|---|---|---|
| `$7E:047C` | 2 bytes | `NEXT_ROOM_ID` | Next room ID queued for entry upon transition (`tools/terra/check-change.mts`, `check-exit.mts`). |
| `$7E:047E` | 2 bytes | `CURRENT_ROOM_ID` | Current active room ID loaded in memory (`tools/terra/boot.mts`, `check-change.mts`). |
| `$7E:0480` | 2 bytes | `CURRENT_ROOM_ID_X2` | Current active room ID multiplied by 2; pointer offset for room descriptor table (`tools/terra/boot.mts`). |
| `$7E:0492` | 2 bytes | `ARRIVAL_POS_X` | Player arrival horizontal X coordinate in subpixels/pixels upon room transition (`tools/terra/check-change.mts`). |
| `$7E:0494` | 2 bytes | `ARRIVAL_POS_Y` | Player arrival vertical Y coordinate in subpixels/pixels upon room transition (`tools/terra/check-change.mts`). |
| `$7E:06C0` | table | `EVENT_FLAGS_CHESTS` | Persistent treasure chest and room event bitflags; tested as `$7E:06C0 + (flag >> 3)` (`tools/terra/check-chest.mts`, `check-exit.mts`). |
| `$7E:0710` | table | `MAP_CHANGE_FLAGS` | Map change and terrain variation trigger bitmask; tested as `$7E:0710 + (bit >> 3)` (`tools/terra/check-change.mts`). |
| `$7E:0826` | 2 bytes | `ROOM_WIDTH_SUBPIXELS` | Active room map width in subpixels (grid width = `$7E:0826 >> 4`) (`tools/terra/check-chest.mts`). |
| `$7E:095E` | 2 bytes | `PLAYER_BOX_X` | Player collision box top-left X coordinate in pixels (`tools/terra/check-exit.mts`). |
| `$7E:0960` | 2 bytes | `PLAYER_BOX_Y` | Player collision box top-left Y coordinate in pixels (`tools/terra/check-exit.mts`). |
| `$7E:0962` | 2 bytes | `PLAYER_BOX_CELL_X` | Player collision box cell X grid coordinate (`tools/terra/check-exit.mts`). |
| `$7E:0964` | 2 bytes | `PLAYER_BOX_CELL_Y` | Player collision box cell Y grid coordinate (`tools/terra/check-exit.mts`). |
| `$7E:097C` | 2 bytes | `ROOM_TRANSITION_FLAGS` | Room transition status word (bit 15 = transition requested) (`tools/terra/check-change.mts`). |

---

## Entity & Tilemap Buffers (`$7E:1000–$7E:FFFF`)

| Address | Size | Name | Purpose & Evidence |
|---|---|---|---|
| `$7E:1000` | struct | `PLAYER_CHARACTER_RECORD` | Player character record: `+0` horizontal X position, `+2` vertical Y position of bottom-centre box (`tools/terra/check-chest.mts`, `check-exit.mts`). |
| `$7E:A000` | buffer | `LAYER_0_TILEMAP` | Decompressed 16-bit metatile grid for Layer 0 (`tools/terra/check-change.mts`). |
| `$7E:E000` | buffer | `LAYER_1_TILEMAP` | Decompressed 16-bit metatile grid for Layer 1 (`tools/terra/check-change.mts`). |
