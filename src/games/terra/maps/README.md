# Terranigma — Maps & Room Explorer Panel

Interactive panel for browsing Terranigma's 1,104 rooms, SNES bus pointers, PC file offsets, and map header bitstream opcodes.

## Features
- **Table A Browser**: Complete catalogue of all 1,104 room entries in the European base ROM (and regional variants).
- **Header Opcode Decoder**: Real-time parsing of map header bitstream commands:
  - `0x00`: End of map header.
  - `0x02`: Play SPC audio track.
  - `0x04`: Call MapID 0 sequence.
  - `0x10`: Map layers / tile definitions.
  - `0x20`: Tile map / collision data.
  - `0x40`: Palette data.
- **Search & Filter**: Filter by used rooms vs unused slots (`$000002`), search by room ID (e.g. `000A`), bus address, or name.
- **Multi-Game UX Compliant**: Displays capability empty-states with direct links to `docs/terra/` for features still under reverse engineering.
