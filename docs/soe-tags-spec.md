# `soe://tags/`: Tagging Specification

> **Status:** Proposal, not implemented.
> **Builds on:** [`soe-filesystem-spec.md`](soe-filesystem-spec.md) (the `soe://` provider, §3a MCP access)
> **Goal:** Join everything known about one game concept (the boy, his HP, the Raptors room) under one name. Each fact links to the resource it came from, so a person or an AI can look up a concept and then follow links to the data.

---

## 1. The problem

What we know about the boy's HP is spread over six places that never reference each other:

| Where | What it says |
|---|---|
| `in/core/…/03_sprites.evs` | `enum ATTRIBUTE { HP = 0x2a, MAX_HP = 0x0f, … }`: offsets into an entity record |
| `wiki/ram/Ram-Map.md` | `0x0a35 BOY_MAX_HP`, `0x0a37 BOY_CURRENT_HP` |
| community RAM list (Data Crystals) | `7E0A35 to 7E0A36 = Boy - Stats - Max HP`, `7E4EB3 to 7E4EB4 = Boy - Current HP` |
| `wram-memory-mapping` skill | boy entity record at `$7E4E89`, pointer at `$0F3E` |
| `src/script/names.json` | address labels used by hovers and `soe://ram/<addr>.json` |
| the running emulator | the value right now, e.g. `30` |

`$7E4E89 + ATTRIBUTE.HP (0x2a) = $7E4EB3`, so the enum entry and the RAM list line describe the same thing. That link is written down nowhere. A tag records it.

The sources also disagree: the wiki has `0x0a3f = BOY_MAGIC_DEFENSE`, the RAM list has `7E0A3F = Boy - Stats - Attack`. A tag keeps both claims and their sources and marks the conflict. It does not choose one silently.

---

## 2. Addresses

```
boy.hp                              tag id: lowercase, dot-separated
soe://tags/boy/hp.md                the tag as Markdown (for people and AI)
soe://tags/boy/hp.json              the same tag as data (for panels and tools)
soe://tags/boy/index.md             the tag "boy": its facts plus links to every child tag
soe://tags/index.md                 all top-level tags
soe://tags/map/raptors.md           tag id map.raptors
```

- **Id to path:** each dot becomes a `/`. A tag that has children is a directory: its own page is `index.md` and every child is listed in it.
- **Segments:** `[a-z0-9_]+`. Hex ids are allowed as aliases (`map.5c`, see §4.3).
- **Read-only**, like the rest of `soe://`. Tag *definitions* are edited as repo files (§5), not through the provider.
- **Live parts:** a tag that has a RAM address shows its current value when an emulator runs. That makes the file `live` (§3 of the file-system spec: 250 ms cache, re-announced while watched). Without a running game the value line reads `not running`, and the rest of the file still renders.

---

## 3. What a tag holds

A tag is a set of **facts**. Each fact is one kind of link to data that already exists.

| Fact kind | Example for `boy.hp` | Points at |
|---|---|---|
| `ram` | `$7E4EB3` word, current HP | `soe://bus/7e4eb3` → `soe://ram/4eb3.json` |
| `ram` | `$7E0A37` word (stats-block copy) | `soe://ram/0a37.json` |
| `enum` | `ATTRIBUTE.HP = 0x2a` | `.evs` file + line (workspace path) |
| `derived` | `ram.boy_entity + ATTRIBUTE.HP` | the two tags it is computed from |
| `table` | stat/level-up tables, if any | `soe://rom/tables/<name>/info.json` |
| `asm` | code that reads or writes the address | `soe://rom/<offset>.json`, later `rom/banks/<bb>.asm` |
| `script` | scripts that read `<0x23e5>[0x0f]` etc. | `soe://rom/assets/scripts/<id>.evs` (Phase 2 of the file-system spec) |
| `asset` | sprite, animation, icon, map render | `soe://rom/assets/…` |
| `doc` | wiki page, skill section, `docs/*.md` | workspace or wiki path + heading |
| `claim` | "`7E0A3F` = Attack" | the source text it is copied from (§6) |
| `see` | related tag | `boy.max_hp`, `dog.hp`, `entity.attribute.hp` |

Every fact carries a `source`: the file and line, the generator, or "hand-authored". The source is how a reader finds out how far to trust the fact.

### 3.1 `soe://tags/boy/hp.md` (rendered)

```markdown
# boy.hp: Boy current HP

**Value:** 30 (0x001e), live from soe://ram/4eb3.json
**Max:** [boy.max_hp](max_hp.md) = 30

## Memory
| Address | Size | Role | Source |
|---|---|---|---|
| [$7E4EB3](soe://bus/7e4eb3) | word | entity record: boy entity + ATTRIBUTE.HP | derived |
| [$7E0A37](soe://bus/7e0a37) | word | stats block (BOY_CURRENT_HP) | wiki/ram/Ram-Map.md |

## Derived from
- [ram.boy_entity](../ram/boy_entity.md) = $7E4E89 (pointer at $0F3E)
- [entity.attribute.hp](../entity/attribute/hp.md) = ATTRIBUTE.HP = 0x2a
  (in/core/[group] 00_general_enums/[group] 05_everscript/03_sprites.evs:848)

## Code
- (Phase 4) routines that read or write $4EB3, from the CDL / disassembly

## See also
[boy](index.md) · [boy.max_hp](max_hp.md) · [dog.hp](../dog/hp.md) · [entity.attribute](../entity/attribute/index.md)
```

### 3.2 `soe://tags/boy/index.md`

A summary of the boy: his character record and sprite (`soe://rom/assets/characters/<id>/`), the entity pointer, and links to every child tag (`hp`, `max_hp`, `attack`, `defense`, `magic_def`, `evade`, `hit`, `xp`, `level`, `charge_max`, `charge_rate`, `weapon`, `armor`, …). A reader can learn what the boy is from this page and follow links for detail.

### 3.3 `soe://tags/boy/hp.json`

The same facts as data (`{ id, title, facts: [{ kind, target, size, role, source, … }], value?, conflicts? }`), for webviews (the Memory Radar hover, Rooms panel) and for tools that do their own filtering.

---

## 4. Tag families

The tree comes from what the extension already decodes, so most tags are generated and only the links between them are written by hand.

| Root | Children | Generated from |
|---|---|---|
| `boy`, `dog` | stats, equipment, entity, sprite, animations | RAM symbols + hand-authored links |
| `entity` | `entity.attribute.<name>` for every `ATTRIBUTE` value; flags from `ATTRIBUTE_FLAGS` / `_BITS` | enum parse of `03_sprites.evs` |
| `map` | `map.<name>` per room | `localizations/maps.js` |
| `character` | `character.<name>` per record | `maps/characters.ts`, `names.json enemies` |
| `item`, `ingredient`, `alchemy` | per entry | `rom-assets.js` (same names it already serves) |
| `music`, `sound` | per track / effect | `localizations/sounds.js`, `audio-files.js` |
| `flag` | `flag.<name>` per named flag | `names.json flags` |
| `table` | per engine table | `table-files.js` |
| `script` | per named script | `localizations/data/scripts.json` |

### 4.1 Example: `map.raptors`

`soe://tags/map/raptors.md` gathers:

- room `0x5c`, "Prehistoria - Raptors": `soe://rom/assets/maps/5c/info.md`, `render.png` (shown inline), `header.json`
- its scripts: "Raptors kill", "Progress Raptors" (from `scripts.json`), and later the decompiled `.evs`
- enemies placed in the room → `character.raptor`, which leads to its sprite, animations and stats
- music → `music.raptor_attack` (`0x18`, "Raptor Attack!") → `song.spc`
- story flags the scripts set or test → `flag.…`
- neighbouring rooms → `map.<name>` (from `maps/vanilla-adjacency.ts`)
- related: `character.raptor`, `map.cave_raptors`

### 4.2 Names

Names are the lowercased display name with non-alphanumerics folded to `_` (`Prehistoria - Raptors` → room `name` `Raptors` → `raptors`). The area is a parent only when a name is ambiguous across areas. The rule is the same one `rom-assets.js` applies to item names (`mud_pepper`).

### 4.3 Ambiguity and aliases

- A hex id is always an alias: `map.5c` → `map.raptors`, served as a link (`File | SymbolicLink`), the same way `ingredients/wax/icon.png` links to `icons/<id>.png`.
- A bare word that matches several roots (`raptors` is a room, a song and a script) is served at `soe://tags/search/raptors.md` as a list of candidates, one per root.

---

## 5. Where tag definitions live

Two layers, merged when the provider builds a tag:

1. **Generated** (no file): one tag per enum value, room, character, item, song, flag, table and RAM symbol, built from the modules listed in §4. These tags stay current with the ROM and the data files automatically.
2. **Authored** (`src/resources/tags/*.json`, one file per root): the links no generator can infer. Example:

```json
{
  "boy.hp": {
    "title": "Boy current HP",
    "facts": [
      { "kind": "derived", "of": ["ram.boy_entity", "entity.attribute.hp"], "addr": "7e4eb3", "size": 2 },
      { "kind": "ram", "addr": "7e0a37", "size": 2, "role": "stats block", "source": "wiki/ram/Ram-Map.md" }
    ],
    "see": ["boy.max_hp", "dog.hp"]
  }
}
```

An authored entry adds to the generated tag with the same id. It never replaces it, so a regenerated fact cannot be lost through an edit.

**Back-links are computed.** If `boy.hp` lists `see: dog.hp`, then `dog.hp` shows `boy.hp` under "Referenced by". Authors write each link once.

---

## 6. Claims, sources and conflicts

Notes copied from outside sources (the Data Crystals RAM list, forum notes, comments in `.evs` files) enter as `claim` facts and keep their original text:

```json
{ "kind": "claim", "addr": "7e0a3f", "size": 2, "text": "Boy - Stats - Attack", "source": "datacrystal ram map" }
```

- When two facts give different meanings for the same address, the tag gets a **Conflicts** section that lists both claims with their sources. `boy.attack` and `boy.magic_def` would both show the `$0A3F` disagreement.
- A claim becomes `verified` once someone checks it in the emulator (for example, the value changes when attack is equipped). Verification records how it was checked and the version. The procedure is the same as the "verified engine WRAM addresses" practice already used in the emulator notes.
- `?` comments in enums (`POINTER_BEHAVIOR_CURRENT = 0x00, // ?`) become `unverified` facts. They are never left out, because an uncertain fact is still something to research.

---

## 7. AI access

No new MCP tool is needed: `soe_list` and `soe_read` already serve any `soe://` path.

- **Entry point:** `soe://tags/index.md` lists the roots and explains the id → path rule in one paragraph.
- **Exploring:** an agent reads `soe://tags/boy/index.md`, follows `hp.md`, then reads `soe://ram/4eb3.json` or the code links. Every link in a tag page is a `soe://` URI or a workspace path, so `soe_read` can open it directly.
- **Search:** `soe://tags/search/<word>.md` (§4.3) is the way in when only a word is known ("what do we know about raptors?").
- **Resources:** add `soe://tags/index.md` and the template `soe://tags/{id}.md` to the MCP server's resource list (`src/mcp/`).

---

## 8. Editor integration (later)

Uses of the same data outside `soe://`:

- **Hover** on `ATTRIBUTE.HP`, `<0x0a37>` or a room id in `.evs`: a one-line summary from the tag plus a link `soe://tags/…`.
- **Go to definition / references** across enum, RAM and script uses through tag facts.
- **Memory Radar:** hovering a WRAM cell shows its tag. Cells that no tag explains are what remains to be researched.
- **Quick pick** `Everscript: Open Tag…` over all tag ids.

---

## 9. Phases

| Phase | Scope |
|---|---|
| 1 | `soe://tags/` provider (`src/resources/tag-files.js`), generated `map.*`, `character.*`, `item.*`, `music.*`, `flag.*`, RAM-symbol tags; `index.md` per directory; `.md` + `.json` |
| 2 | enum parse → `entity.attribute.*`; `derived` facts (entity base + offset); authored `boy` / `dog` files; back-links; live values |
| 3 | claims import (the Data Crystals RAM list as one authored file) with the Conflicts section; `search/` |
| 4 | `asm` facts from CDL / disassembly, `script` facts from decompiled room scripts; hover and Memory Radar integration |

Dependency rules follow `src/resources/README.md`: tag files may use `shared/`, `maps/`, `script/` and `localizations/`, never `emulator/`. Live values come through the injected `readMemory`, the same path `ram-files.js` uses.

---

## 10. Open questions

1. **Enum source:** the `ATTRIBUTE` enum lives in the `everscript` repo (`in/core/…`). Should Phase 2 read it from `everscript.repoPath` at runtime, or from a snapshot generated into `src/`, as `names.json` is?
2. **Which HP address is canonical:** `$4EB3` (entity record) or `$0A37` (stats block)? It needs checking in the emulator whether one is a copy of the other, and which one the game writes first.
3. **Imported claims:** may the Data Crystals list be stored in the repo as-is (licence or attribution), or only as references?
4. **Tag ids as Everscript names:** should `boy.hp` also become a symbol usable in scripts (`<boy.hp>`), or stay a documentation name?
