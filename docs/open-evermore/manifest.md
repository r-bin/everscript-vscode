# Open Evermore: the manifest (memory map) and the header

Status: **design (2026-11-18), nothing built.** Back to [README.md](README.md). Labels as there.

Two files at the top of the tree describe the cartridge as a whole:

- `manifest.json`: **the memory map.** What kind of cartridge implode builds, how big, which address space is
  fast, which space is free, and where each kind of resource may go.
- `header.json`: **the cartridge header**, in words. Every header field that follows from the memory map is
  taken from the manifest, not repeated.

---

## 1. `manifest.json`

```jsonc
{
  "format": "open-evermore",
  "version": 1,
  "game": "evermore",
  "base": {                          // the ROM this folder was exploded from
    "release": "us-1.0",             // docs/evermore-releases.md
    "sha1": "…",                     // implode refuses a tree whose base it cannot match (§1.5)
    "explodedWith": "0.440.0"        // tool version; a newer explode may split more (README.md §9 Q4)
  },
  "memoryMap": {                     // §1.1
    "layout": "hirom",               // hirom | exhirom | sa1
    "size": "3MiB",                  // the smallest image implode writes: 3MiB (vanilla) or 4MiB; 8MiB for exhirom, sa1
    "fastRom": true,                 // §1.2
    "sram": "8KiB",
    "grow": true                     // hirom only: grow to 4 MiB, then exhirom, when the resources do not fit
  },
  "regions": [ … ],                  // §1.3
  "placement": { … },                // §1.4
  "renames": [ … ]                   // §1.6
}
```

### 1.1 Layout and size *(built, 2026-11-19)*

Implode places resources in a **content** image mapped like the base ROM (HiROM file offsets) and turns it into the
cartridge the layout names (`tools/open-evermore/layouts.mts`):

| `layout` | Image | Free beyond the base | Pointers | Built by |
|---|---|---|---|---|
| `hirom` | 3 MiB (vanilla) | — | `$80–$BF` in an upper half, `$C0–$FF` in a lower one, as vanilla | — |
| `hirom` 4 MiB ("extension") | 4 MiB | the 4th MB | the same | — |
| `exhirom` | 8 MiB | the 4th MB, and banks `$41–$7D` of the second 4 MiB (slow ROM) | `$40–$7D` there | [`tools/exhirom`](../../tools/exhirom/README.md) `convert` |
| `sa1` | 8 MiB SA-1 image of a 4 MiB HiROM content | the 4th MB except `$B8:8000–$FFFF` (the boot block) | as `hirom` | [`tools/sa1`](../../tools/sa1/README.md) `convert` |

- **Default and growth (owner, 2026-11-19).** Explode writes `hirom`, the base size, `"grow": true`. A build that
  does not fit tries 4 MiB, then `exhirom` (`grown`, info). `sa1` is never chosen for you: it changes the chip.
  `--random` starts at 4 MiB so half the resources can leave their spans.
- **Held out:** in exhirom, bank `$40` (the converter's header copy and bank-`$00` vector stubs) and `$7E–$7F` (WRAM
  on the bus). In every grown image, the span Evermore reads past its 3 MiB (`$B0:E293`+, up to 1,984 bytes,
  knowledge `row_table_low_bytes_from_bank_b0`) answers as the 3 MiB original did on our core (offset modulo 3 MiB).
- **Headers.** `hirom` raises the ROM size byte if a grown image needs it (Evermore's already declares 4 MiB); the
  converters write their own. The manifest's `fastRom` and `sram` are checked against the HiROM content's header.
- **Reading back.** The round trip explodes the cartridge (`exhirom`: room and tile pointers into `$40–$7D` are
  followed by `romFileOffset`, `src/games/evermore/maps/rom.ts`) or, for `sa1`, its HiROM content.
- **Proven?** `hirom` 3 and 4 MiB: yes (progress.md). `exhirom` and `sa1` build and round-trip; on the playbacks
  they leave step for good (exhirom from frame 473: the slow ROM makes loads longer; sa1's content, like hirom
  seed 7, at a lag frame). Screens match the original's 0–3 frames apart for 88 % of frames: a timing proof is open.

### 1.2 Fast ROM: what the manifest decides and what it does not

The hardware decides which addresses can be fast: only banks `$80–$FF`, and only after MEMSEL (`$420D`) bit 0
is set *(hardware; [../split-and-link/extending.md](../split-and-link/extending.md) §3.1)*. Evermore's reset
routine sets it *(repo: [../disassembly/engine-core/boot-reset.md](../disassembly/engine-core/boot-reset.md))*,
and its header declares it (map mode `$31`, bit 4 *(repo: `soe://rom/header.json`)*).

`"fastRom": true` therefore means three things, and implode checks all three:

1. the header's map mode gets bit 4 (`header.json` does not repeat it, §2)
2. the reset code still writes `$420D` = 1 (a code check, once code is exploded; until then it sits in `_base/`)
3. the **fast space** is every bank in `$80–$FF` of the layout: all of it under `hirom`, and only the first
   4 MiB under `exhirom` (`$40–$7D` are slow)

What the manifest *does* decide is **who gets the fast space**: the placement policy of §1.4. Under `hirom` all
space is fast, so the policy matters only once the layout grows.

### 1.3 Regions

The regions are the memory map proper: every address range of the image, what it is for and whether implode
may use it.

```jsonc
"regions": [
  { "name": "vanilla",      "from": "$C00000", "to": "$EFFFFF", "use": "resources" },
  { "name": "header",       "from": "$C0FFB0", "to": "$C0FFFF", "use": "header" },
  { "name": "fourth_mb",    "from": "$F00000", "to": "$FFFFFF", "use": "free",
    "reserved": [ { "from": "$F00000", "to": "$F0FFFF", "why": "everscript hacks (table-hack.md §1)" },
                  { "from": "$FC0000", "to": "$FFFFFF", "why": "everscript hacks (table-hack.md §1)" } ] }
]
```

| `use` | Meaning |
|---|---|
| `resources` | resources sit here at their vanilla addresses; space they give up becomes free |
| `header` | only the header (§2) |
| `free` | the allocator may place resources here, outside `reserved` |
| `reserved` | nothing from the tree goes here; the reason is required |

- Explode writes the regions from the facts the repo has: the ROM size, the header, and the bank plan of the
  4th MB ([../table-hack.md](../table-hack.md) §1). The addresses above are examples of the form; the real
  list comes from that bank plan, not from this page.
- The regions describe the **base image** (3 MiB): they never overlap and cover it exactly (`region-gap`,
  `region-overlap` are errors). Space beyond it comes from the layout (§1.1), not from regions.
- **One allocator.** The everscript compiler, the table hack and the hacks in `$FC–$FF` each claim space today
  ([../split-and-link/README.md](../split-and-link/README.md) §4.7). Each claim must appear here as `reserved`,
  until implode takes its place.

### 1.4 Placement

Which kind may go where. The facts behind each rule come from code and docs
([../table-hack.md](../table-hack.md) §1, [../split-and-link/extending.md](../split-and-link/extending.md) §4–§5),
not from the manifest; the manifest only lets a build choose among allowed options.

```jsonc
"placement": {
  "default":   { "speed": "fast" },
  "maps":      { "half": "upper", "noCrossBank": true, "maxSize": "32KiB" },
  "strings":   { "half": "lower" },
  "scripts":   { "half": "upper", "noCrossBank": true },
  "animations":{ "bank": "$C4" },
  "music":     { "speed": "any" }          // packages are copied to audio RAM once per load: slow ROM is fine
}
```

| Field | Values |
|---|---|
| `speed` | `fast` (only the fast space of §1.2), `any`, or `heat` (decided per resource by the measured heat classes of [extending.md](../split-and-link/extending.md) §4.2) |
| `half` | `lower` / `upper` / `any`: the 32 KiB half of a bank |
| `noCrossBank`, `maxSize` | the engine reads it with 16-bit pointers inside one bank, or into a buffer of that size |
| `bank` | bound to one bank (the engine keeps the bank fixed) |

A manifest may tighten a rule (`"speed": "fast"` for music) but never loosen one the engine requires
(`rule-loosened` is an error naming the rule's source).
The engine's rules live in the game mapping file (`evermore/map/<release>.json` `placement`, [mapping.md](mapping.md)); the manifest only tightens them.

### 1.5 Which ROM the tree belongs to

- The tree carries everything it needs (`_base/`); the base sha1 is what G0 compares against.
- The base must be US 1.0 for now (`unsupported-release`).

### 1.6 Renames

Each `rename` (planned) appends `{ "kind", "from", "to" }`. Exploding again replays the list, so the user's names
survive a fresh explode ([README.md](README.md) §9 Q4).

---

## 2. `header.json`

The SNES header of a HiROM cartridge sits at `$C0:FFC0`, file offset `0xFFC0` *(hardware)*. In the folder it is
plain JSON, with derived fields left out:

```jsonc
{
  "title": "SECRET OF EVERMORE",     // 21 characters, padded with spaces
  "region": 1,                       // hardware code: 1 = North America
  "developer": 51,                   // 51 ($33) = the extended header is used
  "version": 0,
  "vectors": {                       // by routine name, from code/ (addresses in _base/ until code is exploded)
    "native":    { "nmi": "nmi_handler", "irq": "irq_handler" },
    "emulation": { "reset": "reset_handler" }
  }
}
```

| Field | In `header.json`? | Where implode takes it from |
|---|---|---|
| title, region, developer, version | yes | the file |
| vectors | yes, by name | `code/` labels; every vector must resolve (`unknown-reference`) |
| map mode (`$31`) | **no** | `manifest.memoryMap`: layout (HiROM → low nibble 1) + `fastRom` (bit 4) |
| ROM size byte | **no** | `memoryMap.size`, rounded up to the power of two the header encodes (the vanilla header says 4 MiB for a 3 MiB image *(repo: `soe://rom/header.json`)*; the rounding rule must reproduce that, *(to verify)* against the hardware definition) |
| SRAM size byte, cartridge type | **no** | `memoryMap.sram` |
| checksum, complement | **no** | computed over the built image, last |
| the remaining vector slots | yes, when the game fills them | by name, as above *(to verify which are used)* |

- A derived field written into `header.json` anyway is a warning (`derived-field`) when it agrees, and an error
  when it contradicts the manifest. The manifest wins in both cases.
- The `soe://rom/header.json` *(repo)* has the same field names; when the header kind is exploded, both read
  the same decoder (README.md §6).
