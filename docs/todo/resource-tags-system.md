# Resource Tags (`soe://tags/`) — Open Tasks & Ontology Roadmap

> Domain: Semantic Resource System (`src/resources/tags/`, `src/localizations/`)
> Specification: `docs/soe-tags-spec.md`
> Status key: 🟢 Foundation Shipped (v0.186.0) · 🟡 Open items

---

## 1. Current State (Shipped in v0.186.0)

- `src/resources/tags/tags.json` defines initial hierarchy: `character`, `player`, `boy`, `dog`, `enemy` with precompiled sub-tag links and source documentation.
- Loader validation checks: detecting unknown parents, inheritance cycles, and unresolved sub-tag links (`Everscript: Check soe:// Resources`).

---

## 2. Near-Term: Expanding `tags.json` Catalog

1. **Additional Claims from Data Crystals:** Integrate remaining unverified claims as flagged references.
2. **Alchemy Formula Tags:** Model formula definitions, ingredient costs, and damage scaling pointers under `formula.*`.
3. **Weapons & Equipment Tags:** Model weapon levels, charge requirements, and attack powers under `weapon.*`.
4. **Enemy Entity Slots:** Map `CHARACTER_ADDRESS.ENTITY_*` slots to active combat attributes.

---

## 3. Medium-Term: Tags Derived from `core.evs` Compiler Bundling

Instead of manually maintaining precompiled offsets in `tags.json`, bundle `core.evs` inside the compiler package so the extension statically extracts tags from the compiler version it ships with:

- **Annotations in `core.evs`:** Support `@tag`, `@tag_parent`, `@layout` on enums and struct entries in `compiler/parser.py`.
- **Layout Mapping:**
  - `ATTRIBUTE` (scope `character`, player-specific section = `player`, `_BOY`/`_DOG` bases).
  - `ATTRIBUTE_GENERAL` (scope `player`, `POINTER_BOY`/`POINTER_DOG` bases).
  - `CHARACTER_ADDRESS` (`ENTITY_*` = `enemy`).
- **Script Identifiers:** Seamlessly enable `<boy.hp>` syntax in Everscript code (see [language-tools-and-lsp.md](language-tools-and-lsp.md) §4).

---

## 4. Emulator Verifications & WRAM Ground Truth

Address conflicts to verify in live emulation:
1. **`$0A37` vs `$4EB3` (Boy HP):** Wiki labels `$0A37` as `BOY_CURRENT_HP`, while actual current HP is `$4EB3`. Watch both under live damage (`soe://ram/0a37.json`, `soe://ram/4eb3.json`).
2. **Charge Rate Width:** `ATTRIBUTE_GENERAL.CHARGE_RATE = 0x2f` gives `$0A55`. Data Crystals cites `7E0A54–7E0A55`. Verify whether it is a byte at `0x2F` or word at `0x2E`.
3. **`MAX_HP` Sync:** `ATTRIBUTE.MAX_HP = 0x0f` (`$4E98`) vs `ATTRIBUTE_GENERAL.MAX_HP = 0x0f` (`$0A35`). Confirm how engine synchronizes entity record vs stats block.
4. **Wiki Corrections in `everscript/wiki/ram/Ram-Map.md`:**
   - `$0A3F`: Wiki says `BOY_MAGIC_DEFENSE`, enum says `POINTER_BOY + ATTACK (0x19)`.
   - `$0A43`: Wiki says `BOY_MAGIC_ATTACK`, enum says `POINTER_BOY + MAGIC_DEFENSE (0x1d)`.
