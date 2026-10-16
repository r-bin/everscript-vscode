# Terranigma (Tenchi Souzou) — Game Facts & Architecture

Reverse-engineering notes and verified facts for *Terranigma* (Quintet / Enix, 1995, SNES).

## 1. Cartridge & Memory Architecture

* **Cartridge Size**: 4 MB (33,554,432 bits / 4,194,304 bytes, `$000000`–`$3FFFFF`).
* **Memory Map**: HiROM, FastROM (Map Mode byte `$31`).
* **Bus Mapping**:
  * Banks `$C0`–`$FF` map the 4 MB ROM file linearly (`$000000`–`$3FFFFF`).
  * Banks `$00`–`$3F` and `$80`–`$BF` mirror the upper halves (`$8000`–`$FFFF`) of ROM banks.
  * Formula: `hiromFileOffset(bus) = bus & 0x3FFFFF`.
* **Cartridge Header Location**: PC offset `0x00FFC0` (SNES bus `$00:FFC0` / `$C0:FFC0`).

## 2. Release Variants & Regional Header Facts

Terranigma had no North American release; the English European release is the base ROM for hacking and analysis.

| Variant ID | Region | Internal Header Title | Destination Code | SHA-1 Hash (unheadered) |
|---|---|---|---|---|
| `eu` (Base ★) | Europe (English) | `TERRANIGMA P` | `$02` (PAL 50 Hz) | `911239b4b21106ae4a284454d345c55554985525` |
| `de` | Germany | `TERRANIGMA D` | `$09` (PAL 50 Hz) | `018701e5ce385e0b32e61b8f8bb2f9abf8abf8f0` |
| `de-rev1` | Germany (Rev 1) | `TERRANIGMA D` | `$09` (PAL 50 Hz) | `9a64ce79bea16d01ab71b58b11df0bcf0eedd889` |
| `fr` | France | `TERRANIGMA F` | `$06` (PAL 50 Hz) | `4f8a5771cb11757a31a026e5892b9434a3a405cb` |
| `es` | Spain | `TERRANIGMA S` | `$08` (PAL 50 Hz) | `1e1a85cf28bcb69cb34fc71f48347279d7cfea7e` |
| `jp` | Japan | `TENCHI-JPN` | `$00` (NTSC 60 Hz) | `f787672e766a43a73d9bd310fcb3c2cac024b227` |

## 3. Map & Room Data Structures (Base ROM `eu`)

### 3.1 Table A — Room / Map Pointer Table
* **Location**: PC file offset `0x06959C` (SNES bus `$0D:959C` / `$8D:959C`).
* **Format**: Array of 24-bit little-endian SNES pointers (`b0 | (b1 << 8) | (b2 << 16)`).
* **Length**: 1,104 entries (`0x0000` to `0x044F`, taking `3,312` bytes, from `0x06959C` to `0x06A28C`).
* **Pointers**: Target addresses in ROM banks (primarily bank `$9A`, e.g. `$9A:8350` for Room `0x000A` Crysta, or `$B5`, e.g. `$B5:8002` for Room `0x0004` Savescreen).
* **Unused Slot Marker**: Pointers with the value `$000002` (e.g. rooms `0x0008` and `0x0009`) indicate an unused or empty room slot.

### 3.2 Table B — Event / Sub-Script Pointer Table
* **Location**: PC file offset `0x06A28C` (SNES bus `$0D:A28C` / `$8D:A28C`).
* **Format**: 24-bit SNES pointers called by map header script opcode `Call map script from table B`.

### 3.3 Map Header Bytecode Structure
Room headers at the Table A pointer targets consist of a stream of bitflag commands:
* `0x00`: End of map header.
* `0x02`: Play SPC audio track.
* `0x04`: Call MapID 0 Script (Play SPC).
* `0x10`: Map Layer 1 / Layer 2 / Tile definitions.
* `0x20`: Tile Map / Collision data.
* `0x40`: Palette data.
