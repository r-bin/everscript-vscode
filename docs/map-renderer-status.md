# Map Renderer Status (Authoritative)

This file is the single source of truth for the Rooms map renderer research and implementation state.

## Scope
- Feature: ROM-backed map rendering in the Rooms tab.
- Inputs: room header, trigger tables, payload sections, map tile decode.
- Output: rendered map canvas with diagnostics.

## Working / In Progress / Not Working

### Working
- Header parsing and room dimensions from bytes 0..3.
- Trigger table parsing (step-on and B-trigger, 6-byte records).
- Map tile decode for declared tile families (SoETilesViewer-compatible tile decode path).
- Sentinel + tilemap decode path for maps confirmed under current signatures:
  - 0x33 Strong Heart Exterior (0x30 sentinel).
  - 0x51 Village Huts (0xC8 sentinel).
  - 0x5c Raptors parse path now also matches strict7 sentinel core with non-0x30/0xC8 lead byte (`x 00 00 00 01 00 ff`).
- Nibble decode invariant: decoded tile references are always 0..15.
- invalidRefs policy fixed: values >= tileCount are unresolved (not invalid).

### In Progress
- Identifying source of tile slots >= tileCount used by in-game rendering.
- Variant payload parsing for maps where current sentinel signatures are not found.
- Mapping opaque/compressed middle section semantics.

### Not Working
- Universal payload parse for all maps.
- Full-fidelity renderer parity for maps requiring unresolved slot sources or unknown payload variants.

## Evidence-Backed Facts
- Payload starts after header + step table + b-trigger table.
- Payload begins with tileCount and tile family list.
- For 0x33 and 0x51, known sentinels mark boundary to position-table/tilemap region.
- Additional sentinel evidence: some maps use strict7 core with a different lead byte, and some may use a short6 core (`x 00 00 01 00 ff`).
- Tilemap nibble packing is confirmed for successful parses.
- Direct tile-codec equivalence is not yet proven for map payload middle section; current evidence supports boundary/variant parsing first.

Evidence references:
- docs/map-loading.md
- docs/map-0x33-analysis.md
- tmp/map-renderer-payload-bytes.md

## Speculative / Unconfirmed Items (Clearly Marked)
- SPECULATIVE: meaning of the compressed middle section.
- SPECULATIVE: exact source of unresolved slots (shared VRAM dictionary vs other mechanism).
- SPECULATIVE: complete variant rules for maps like 0x34, 0x5c, 0x38.

## Current Cross-Map Parse Snapshot
- Parse OK (current known structure): 0x33, 0x51.
- Parse not yet explained by current sentinel model: 0x34, 0x5c, 0x38.

## Data Organization
- Heavy sample data moved to tmp/:
  - tmp/map-renderer-payload-bytes.md (raw payload byte plots and derived nibble views).
- Documentation in docs/ remains concise and evidence-first.

## Requests Needed To Reach Completion
1. Loader trace for one failing map (0x34, 0x5c, or 0x38): payload reads and destination writes through the room-load path.
2. VRAM snapshots before/after loading the same failing map.
3. Optional screenshot alignment (same map, known coordinates) to compare visible tile classes.

## Feature Completion Criteria
The map renderer feature is complete when:
- Representative map set parses using documented, evidence-backed rules.
- Renderer output matches measured references for those maps.
- Regressions are covered by tests (unit + UI + diagnostics logs).

## Tile Model Decision
- We do not currently need a separate tile model for map tile decode.
- Reason: tile decode path is already test-backed and matches the external reference implementation behavior for tile extraction.
- What still needs modeling is map payload/layout semantics, not per-tile pixel decoding.
