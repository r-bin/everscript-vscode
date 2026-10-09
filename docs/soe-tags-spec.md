# `soe://tags/`: Tagging Specification

> **Status:** Proposal, not implemented.
> **Builds on:** [`soe-filesystem-spec.md`](soe-filesystem-spec.md) (the `soe://` provider, §3a MCP access)
> **Goal:** Join everything known about one game concept (the boy, his HP, the Raptors room) under one name. Each fact links to the resource it came from, so a person or an AI can look up a concept and then follow links to the data.

---

## 1. The problem

What we know about the boy's HP is spread over six places that never reference each other:

| Where | What it says |
|---|---|
| `in/core/…/03_sprites.evs` | `enum ATTRIBUTE { HP = 0x2a, … _BOY = 0x4E89 }`: offsets into every entity record. `enum ATTRIBUTE_GENERAL { MAX_HP = 0x0f, ATTACK = 0x19, …, POINTER_BOY = 0x0a26 }`: offsets into the player stats block |
| `in/core/…/02_ram.evs` | `BOY_CURRENT_HP = <0x4EB3>`, `BOY_LEVEL = <0x0A50>` |
| `wiki/ram/Ram-Map.md` | `0x0a35 BOY_MAX_HP`, `0x0a37 BOY_CURRENT_HP` |
| community RAM list (Data Crystals) | `7E0A35 to 7E0A36 = Boy - Stats - Max HP`, `7E4EB3 to 7E4EB4 = Boy - Current HP`. An **unverified reference** (§6) |
| `wram-memory-mapping` skill | boy entity record at `$7E4E89`, pointer at `$0F3E` |
| `src/script/names.json` | address labels used by hovers and `soe://ram/<addr>.json` |
| the running emulator | the value right now, e.g. `30` |

The enums already explain the addresses; the link is just never written down:

| Address | = base + offset | Agrees with |
|---|---|---|
| `$4EB3` current HP | `ATTRIBUTE._BOY (0x4E89)` + `ATTRIBUTE.HP (0x2a)` | `02_ram.evs BOY_CURRENT_HP`, Data Crystals |
| `$4F1D` XP required | `_BOY` + `ATTRIBUTE.TOTAL_XP_REQUIRED (0x94)` | `02_ram.evs BOY_XP_REQUIRED` |
| `$0A35` max HP | `ATTRIBUTE_GENERAL.POINTER_BOY (0x0a26)` + `MAX_HP (0x0f)` | wiki, Data Crystals |
| `$0A3F` attack | `POINTER_BOY` + `ATTACK (0x19)` | Data Crystals. **Wiki says magic defense: wrong** |
| `$0A43` magic defense | `POINTER_BOY` + `MAGIC_DEFENSE (0x1d)` | Data Crystals. **Wiki says magic attack: wrong** |
| `$0A50` level | `POINTER_BOY` + `LEVEL (0x2a)` | all |
| `$0A7F` dog max HP | `POINTER_DOG (0x0a70)` + `MAX_HP` | wiki |

Tags make these sums explicit (§5), so conflicts like the wiki's `$0A3F` row show up on their own (§6). The wiki's `0x0a37 BOY_CURRENT_HP` fits no enum (`0x0a26 + 0x11` is not an `ATTRIBUTE_GENERAL` entry). It stays an unverified claim until it is checked in the emulator.

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
| `enum` | `ATTRIBUTE.HP = 0x2a` | `.evs` file + line (workspace path) |
| `derived` | `ATTRIBUTE._BOY + ATTRIBUTE.HP` = `$4EB3` | the base and offset entries it is computed from (§5.1) |
| `table` | stat/level-up tables, if any | `soe://rom/tables/<name>/info.json` |
| `asm` | code that reads or writes the address | `soe://rom/<offset>.json`, later `rom/banks/<bb>.asm` |
| `script` | scripts that read `<0x23e5>[0x0f]` etc. | `soe://rom/assets/scripts/<id>.evs` (Phase 2 of the file-system spec) |
| `asset` | sprite, animation, icon, map render | `soe://rom/assets/…` |
| `doc` | wiki page, skill section, `docs/*.md` | workspace or wiki path + heading |
| `claim` | "`7E0A37` = BOY_CURRENT_HP" (wiki) | the source text it is copied from (§6) |
| `see` | related tag | `boy.max_hp`, `dog.hp`, `character.hp` |

Every fact carries a `source`: the file and line, the generator, or "hand-authored". The source is how a reader finds out how far to trust the fact.

### 3.1 `soe://tags/boy/hp.md` (rendered)

```markdown
# boy.hp: Boy current HP

**Value:** 30 (0x001e), live from soe://ram/4eb3.json
**Max:** [boy.max_hp](max_hp.md) = 30

## Memory
| Address | Size | Role | Source |
|---|---|---|---|
| [$7E4EB3](soe://bus/7e4eb3) | word | entity record: _BOY + ATTRIBUTE.HP | derived; 02_ram.evs BOY_CURRENT_HP |

## Derived from
- ATTRIBUTE._BOY = 0x4E89, tagged boy (03_sprites.evs:937)
- [character.hp](../character/hp.md): ATTRIBUTE.HP = 0x2a, inherited from character
  (in/core/[group] 00_general_enums/[group] 05_everscript/03_sprites.evs:848)

## Unverified claims
- $7E0A37 = BOY_CURRENT_HP (wiki/ram/Ram-Map.md): fits no enum; see docs/todo/soe-tags.md

## Code
- (Phase 4) routines that read or write $4EB3, from the CDL / disassembly

## See also
[boy](index.md) · [boy.max_hp](max_hp.md) · [dog.hp](../dog/hp.md) · [character](../character/index.md)
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
| `character`, `player`, `boy`, `dog`, `enemy` | the tag tree of §5.2: attributes, stats, equipment, sprite, animations | `@tag` in the `.evs` enums, RAM symbols |
| `enemy.<name>` | one per character record (`enemy.raptor`): sprite, animations, stats | `maps/characters.ts`, `names.json enemies` |
| `map` | `map.<name>` per room | `localizations/maps.js` |
| `item`, `ingredient`, `alchemy` | per entry | `rom-assets.js` (same names it already serves) |
| `music`, `sound` | per track / effect | `localizations/sounds.js`, `audio-files.js` |
| `flag` | `flag.<name>` per named flag | `names.json flags` |
| `table` | per engine table | `table-files.js` |
| `script` | per named script | `localizations/data/scripts.json` |

### 4.1 Example: `map.raptors`

`soe://tags/map/raptors.md` gathers:

- room `0x5c`, "Prehistoria - Raptors": `soe://rom/assets/maps/5c/info.md`, `render.png` (shown inline), `header.json`
- its scripts: "Raptors kill", "Progress Raptors" (from `scripts.json`), and later the decompiled `.evs`
- enemies placed in the room → `enemy.raptor`, which leads to its sprite, animations and stats
- music → `music.raptor_attack` (`0x18`, "Raptor Attack!") → `song.spc`
- story flags the scripts set or test → `flag.…`
- neighbouring rooms → `map.<name>` (from `maps/vanilla-adjacency.ts`)
- related: `enemy.raptor`, `map.cave_raptors`

### 4.2 Names

Names are the lowercased display name with non-alphanumerics folded to `_` (`Prehistoria - Raptors` → room `name` `Raptors` → `raptors`). The area is a parent only when a name is ambiguous across areas. The rule is the same one `rom-assets.js` applies to item names (`mud_pepper`).

### 4.3 Ambiguity and aliases

- A hex id is always an alias: `map.5c` → `map.raptors`, served as a link (`File | SymbolicLink`), the same way `ingredients/wax/icon.png` links to `icons/<id>.png`.
- A bare word that matches several roots (`raptors` is a room, a song and a script) is served at `soe://tags/search/raptors.md` as a list of candidates, one per root.

---

## 5. Where tag definitions live

### 5.1 In the Everscript sources: `@tag`

Most knowledge lives in the `everscript` repo's `.evs` enums, so tags are declared there, next to the value they describe, with an annotation like `@install` / `@inject`:

```
@tag("character")                         // every entity record has this layout
@tag_parent("player", "character")        // tag tree, declared once (§5.2)
@tag_parent("boy", "player")
@tag_parent("dog", "player")
@tag_parent("enemy", "character")
enum ATTRIBUTE {
    @tag("hp") HP = 0x2a,
    @tag("max_hp") MAX_HP = 0x0f,
    @tag("x") X = 0x1a,
    …
    // BOY/DOG SPECIFIC
    @tag("player", "xp_required") TOTAL_XP_REQUIRED = 0x94,
    @tag("player", "boost_attack") BOOST_ATTACK = 0xa0,
    …
    @tag("boy") @layout(ATTRIBUTE) _BOY = 0x4E89,     // a base: boy.* = _BOY + entry
    @tag("dog") @layout(ATTRIBUTE) _DOG = 0x4F37,
}

@tag("player")                            // the stats block only players have
enum ATTRIBUTE_GENERAL {
    @tag("max_hp") MAX_HP = 0x0f,
    @tag("attack") ATTACK = 0x19,
    …
    @tag("boy") @layout(ATTRIBUTE_GENERAL) POINTER_BOY = 0x0a26,
    @tag("dog") @layout(ATTRIBUTE_GENERAL) POINTER_DOG = 0x0a70,
}
```

| Annotation | On | Means |
|---|---|---|
| `@tag("a", "b", …)` | enum | every entry belongs to these tags (the enum's *scope*) |
| `@tag("a", …)` | entry | the entry is the tag `<scope>.a`; a tag that is a node in the tree (`"player"`) narrows the entry's scope instead |
| `@tag_parent("child", "parent")` | enum | one edge of the tag tree |
| `@layout(ENUM)` | entry | the entry's value is a base address, and `ENUM`'s entries are offsets from it |

**How `boy.hp` comes out:** `_BOY` is tagged `boy` with layout `ATTRIBUTE`. `ATTRIBUTE.HP` is `character.hp`, and `boy` is a `character` by the tree, so `boy.hp` gets a `derived` fact `$4E89 + 0x2a = $4EB3`, with both enum lines as its source. `enemy` is also a `character`, so it gets `hp` too, but it never gets `xp_required`, because that entry is narrowed to `player`. This is the inheritance the enum already has in its comments ("BOY/DOG SPECIFIC").

Two inheritance paths give the boy two `max_hp` facts: the entity record (`$4E98`) and the stats block (`$0A35`). Both are listed, each with its role. Neither one is dropped.

### 5.2 The tag tree

```
character            ATTRIBUTE (entity record)
├── player           ATTRIBUTE_GENERAL (stats block), ATTRIBUTE player-only entries
│   ├── boy          _BOY, POINTER_BOY, 02_ram.evs BOY_*
│   └── dog          _DOG, POINTER_DOG, DOG_*
└── enemy            CHARACTER_ADDRESS.ENTITY_* slots, ENEMY enum, names.json enemies
```

A tag inherits every child tag of its ancestors. `soe://tags/boy/index.md` therefore lists `hp`, `attack`, `xp_required`, …, and says where each one is inherited from ("from player", "from character").

### 5.3 How the extension reads them

`tools/generate_data.py` already parses the core enums into `src/language/data/index.json` (hovers, completion). It also collects `@tag`, `@tag_parent` and `@layout`, together with each entry's file and line, so the tags ship with the extension and work without the `everscript` repo checked out. When the repo is open in the workspace, the live workspace index (`src/language/workspace-index.js`) can replace the snapshot, as it already does for declarations.

### 5.4 Generated and authored tags

Merged into the same tree:

1. **Generated** (no annotation needed): one tag per room, character, item, song, flag, table and RAM symbol, built from the modules listed in §4.
2. **Authored** (`src/resources/tags/*.json`, one file per root): links that belong in neither the ROM nor an enum, such as external claims (§6) or `see` links between unrelated tags.

An authored entry adds facts to the tag with the same id. It never replaces one, so a regenerated fact cannot be lost through an edit.

**Back-links are computed.** If `boy.hp` lists `see: dog.hp`, then `dog.hp` shows `boy.hp` under "Referenced by". Authors write each link once.

---

## 6. Claims, sources and conflicts

Notes copied from outside sources (the Data Crystals RAM list, the wiki, forum notes) enter as `claim` facts and keep their original text:

```json
{ "kind": "claim", "addr": "7e0a3f", "size": 2, "text": "Boy - Stats - Attack", "source": "datacrystal ram map", "status": "unverified" }
```

- **External lists are unverified references.** The Data Crystals RAM list is a pointer for research, never an authority: its lines are claims with `status: "unverified"`, linked by address and stored as references, not copied in bulk. A claim is only shown on a tag whose address it matches.
- When facts give different meanings for the same address, the tag gets a **Conflicts** section that lists each one with its source. An enum-derived fact outranks a claim in the summary line. The claim stays listed, so the `$0A3F` row of §1 shows "attack (enum, Data Crystals)" against "magic defense (wiki)".
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
| 2 | `@tag` / `@tag_parent` / `@layout` in the `everscript` compiler and in `generate_data.py`; the tag tree; `derived` facts (base + offset); back-links; live values |
| 3 | claims (wiki, Data Crystals references) with the Conflicts section; `search/` |
| 4 | `asm` facts from CDL / disassembly, `script` facts from decompiled room scripts; hover and Memory Radar integration |

Dependency rules follow `src/resources/README.md`: tag files may use `shared/`, `maps/`, `script/` and `localizations/`, never `emulator/`. Live values come through the injected `readMemory`, the same path `ram-files.js` uses.

---

## 10. Open questions and follow-ups

Decided:
- **Enum source:** tags are declared in the `everscript` sources (§5.1) and shipped as a snapshot in `index.json` (§5.3).
- **Canonical current HP:** `$4EB3` (`_BOY + ATTRIBUTE.HP`, and `02_ram.evs` agrees). The wiki's `$0A37` is an unverified claim.
- **Data Crystals:** an unverified reference (§6).

Still open: [`todo/soe-tags.md`](todo/soe-tags.md). Tag ids as names inside scripts (`<boy.hp>`): [`todo/tag-names-in-scripts.md`](todo/tag-names-in-scripts.md).
