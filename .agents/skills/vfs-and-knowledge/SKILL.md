---
name: vfs-and-knowledge
description: Guidance on using the VFS as the primary data source, linking unified knowledge across tools, IDE candy for Everscript, and proposing creative data combinations.
applyTo: "src/games/**,docs/**"
---

# VFS Primacy, Linked Knowledge & Everscript Mission

---

## 1. VFS (`soe://`, `som://`) is the Primary Data Plane

- The VFS is the single most important data source for both AI agents and the VS Code plugin.
- Expose systems as VFS endpoints as soon as they make sense, even before all UI use cases exist:
  - Query sniff spots -> table of all sniff spots with coordinates and loot.
  - Search items (e.g. "acorns") -> list of relevant scripts and drop tables.
  - Maps, entities, sprites, audio, and scripts each have their own structured VFS path.

---

## 2. Single Source of Truth & Linked Knowledge

- **Never duplicate data tables:** VFS providers, RAM maps, CDL tools, and UI tabs must all read
  from the same underlying knowledge files.
- **Link facts contextually without knowledge barriers:**
  - When WRAM address `$2834` appears in script decoders or EVS code, display its human-readable name.
  - Provide tooltips with natural language explanations: what the address represents, its size,
    common usage patterns, and related systems (e.g. enemy slot -> animation state -> commands).
  - Include deep links to relevant feature tabs (e.g. jump straight to the animation viewer).

---

## 3. The Everscript Developer Experience ("All the Candy")

The core mission is making Everscript accessible, powerful, and enjoyable for romhackers:
- **Rich syntax highlighting:** Accurate tokenization reflecting opcodes, variables, and flags.
- **Rich hover tooltips:** Hovering resources, symbols, or memory offsets displays rich metadata from the VFS.
- **Interactive debugging:** Step through scripts live in the embedded emulator (`debugger-protocol` skill).
- **Proactive diagnostics:** Real-time compiler diagnostics (red/yellow squigglies) catching invalid opcodes,
  out-of-bounds offsets, or incorrect argument counts.

---

## 4. Long-Term Vision: Understand and Extend Evermore

- **Deep understanding:** WRAM map, ROM map, script VM decompilation, static C recompilation.
- **Extensibility:** Facilitate ROM hacks via the EVS compiler, IPS patches, ExHiROM expansion,
  and SA-1 accelerator ports. Relocate fixed-size ROM structures into expansion space so they can grow.
- **Visualizations:** Transform opaque data blobs into rich interactive tools:
  - Map blobs -> Map Editor (`src/core/map-editor/`)
  - SPC blobs -> Music player (`src/games/evermore/music/`)
  - Script blobs -> Visual script model and editor
  - Tile/animation blobs -> Animation and sprite viewer
- If a visualization succeeds for Evermore, investigate porting it to Mana and other supported games.

---

## 5. Propose Creative Combinations

Whenever you spot interesting ways that disparate data sets can be combined (e.g., cross-referencing
collision maps with enemy spawn triggers and loot tables), investigate the idea and write a proposal
in `docs/todo/` or `docs/proposals/`.
