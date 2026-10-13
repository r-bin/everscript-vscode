# Resource Tags (`soe://tags/`) — Open Tasks & Ontology Roadmap

> Domain: Semantic Resource System (`src/resources/tags/`, `src/localizations/`)
> Shipped specification & architecture: [`docs/soe-tags-spec.md`](../soe-tags-spec.md)
> Status key: 🟡 Open items · 🟢 Planned compiler integration

---

## 1. Active Open Tasks

### 1.1 Expanding `tags.json` Catalog
- **Status: 🟡 Open items**
- **Additional Claims from Data Crystals:** Integrate remaining unverified claims as flagged references.
- **Alchemy Formula Tags:** Model formula definitions, ingredient costs, and damage scaling pointers under `formula.*`.
- **Weapons & Equipment Tags:** Model weapon levels, charge requirements, and attack powers under `weapon.*`.
- **Enemy Entity Slots:** Map `CHARACTER_ADDRESS.ENTITY_*` slots to active combat attributes.

### 1.2 Tags Derived from `core.evs` Compiler Bundling
- **Status: 🟢 Planned compiler integration**
- Instead of manually maintaining precompiled offsets in `tags.json`, bundle `core.evs` inside the compiler package so the extension statically extracts tags from the compiler version it ships with:
  - Support `@tag`, `@tag_parent`, `@layout` on enums and struct entries in `compiler/parser.py`.
  - Layout mapping: `ATTRIBUTE`, `ATTRIBUTE_GENERAL`, `CHARACTER_ADDRESS`.
  - Seamlessly enable `<boy.hp>` syntax in Everscript code (see [language-tools-and-lsp.md](language-tools-and-lsp.md) §1.4).

### 1.3 Emulator Verifications & WRAM Ground Truth
- **Status: 🟡 Open verification items**
- **`$0A37` vs `$4EB3` (Boy HP):** Wiki labels `$0A37` as `BOY_CURRENT_HP`, while actual current HP is `$4EB3`. Watch both under live damage (`soe://ram/0a37.json`, `soe://ram/4eb3.json`).
- **Charge Rate Width:** `ATTRIBUTE_GENERAL.CHARGE_RATE = 0x2f` gives `$0A55`. Data Crystals cites `7E0A54–7E0A55`. Verify whether it is a byte at `0x2F` or word at `0x2E`.
- **`MAX_HP` Sync:** `ATTRIBUTE.MAX_HP = 0x0f` (`$4E98`) vs `ATTRIBUTE_GENERAL.MAX_HP = 0x0f` (`$0A35`). Confirm how engine synchronizes entity record vs stats block.
- **Wiki Corrections in `everscript/wiki/ram/Ram-Map.md`:**
  - `$0A3F`: Wiki says `BOY_MAGIC_DEFENSE`, enum says `POINTER_BOY + ATTACK (0x19)`.
  - `$0A43`: Wiki says `BOY_MAGIC_ATTACK`, enum says `POINTER_BOY + MAGIC_DEFENSE (0x1d)`.
