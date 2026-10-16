# Table hack — move the content tables into the extension

## 0. First step: one table at a time, does it crash?

The first build is deliberately simple:

1. Move **one** table from [extension-tables.md](extension-tables.md) to the extension.
2. Rewrite the operands that read it, and wipe the old copy with `$FF`.
3. Boot the ROM headless and replay the recorded movies. Does the game crash or diverge from
   vanilla?
4. Write the result in [extension-tables.md](extension-tables.md) (status column), then take the
   next table.

Start with the three tables already moved once in the Asar export (map table, enter scripts,
string keys), then the script pointer table, then the graphics tables. Adding entries, the
directory, the generated used/free md and the plugin resolver (§1–§7) come later. They are
written down here so the reasoning is not lost.

Status of §1–§7: **design for later, nothing built.** The decisions come from a design
interview on 2026-10-16.

Facts are marked *(repo)* with their source, *(everscript)* when read from the sibling `everscript`
repo, *(hardware)* for SNES facts, or *(to verify)*.

## 1. Banks of the extension

In HiROM the 4th MB is banks `$F0–$FF`: file `0x3n0000` = `$Fn:0000`. The upper half of each bank
(`$Fn:8000–$FFFF`) is also visible as `$Bn:8000–$FFFF`; the lower half only as `$Fn`
*(hardware)*.

| Bank | Lower half `$Fn:0000–7FFF` | Upper half `$Fn:8000–FFFF` (= `$Bn`) |
|---|---|---|
| `$F0` | **reserved**: FuSoYa 2P kernel `0000–0A16`; everscript `room_timer` (`$F00000`); first everscript text | **reserved**: first everscript scripts (`$B0:8000+`); `$80:D113` read target `E653–E6D1` |
| `$F1` | directory `0000–00FF`; rest free | **tables**, back to back (§2) |
| `$F2–$F7` | **new strings** (192 KB) | **new scripts** (192 KB), including new enter scripts |
| `$F8–$FB` | free (build 2: graphics tables) | **new rooms** |
| `$FC–$FD` | **reserved**: everscript `.evs` patches (`connect_acts` from `0x3c0000`); `auto_save` hotkey data `$FD0000` | **reserved**: everscript `.evs` patches; the plugin's room export at `$BC/$BD:8000` |
| `$FE` | **reserved**: debug menu `$FE0000` (XaserLE / everscript `debug_menu`); hooks `$FE5000` (`room_timer`, `_hook_input`, `auto_save`) | **reserved**: everscript `scale_enemies` from `$FE8000` |
| `$FF` | **reserved**: `scale_enemies` tables continue to about `$FF9000`; `fix_bridges` from `0x3f0000` | **reserved**: `fix_a4_doors` / `fix_bridges` |

Where everscript allocates *(everscript: `compiler/linker.py` `MemoryManager`)*:

- It splits every bank of a `#memory` range into text (lower half, seen as `$Cx`–`$Fx`) and script
  (upper half, seen as `$8x`–`$Bx`).
- It allocates first fit from the start of the range.
- The default range is the whole extension `0x300000..0x3fffff`, so a big compile grows from `$F0`
  into `$F1` and on.
- **Sources built for a table-hack ROM must declare `0x320000..0x37ffff`**, the new-content banks
  `$F2–$F7`, until the compiler reads the directory (§3).
- The same linker also reuses vanilla string keys and function keys through the
  `string_key(..)` / `function_key(..)` ranges. Those are writes into the tables this hack moves,
  so the compiler must learn their new addresses.

Why each kind goes where it does:

- **Tables go in an upper half.** The verified moves put them at `$F1:8000+`, read through the
  `$B1` mirror *(repo: docs/reverse-engineering/cdl-export-build-recomp.md)*. A lower half works
  only if every reader's operand uses the `$F1` form *(to verify)*. The string key table must not
  cross a 32 KB half *(repo: docs/reverse-engineering/asm-to-c-port.md §11)*.
- **Strings go in lower halves.** A key unpacks to `(bank << 16) | (p & $7FFF)` from `$C00000`, so
  strings can only sit at `$xx0000–$7FFF` *(repo: src/emulator/cdl/known-regions.js string_keys)*.
- **Scripts go in upper halves and never cross a bank.**
  - The packed pointer unpacks to bank `$92 + n` and offset `| $8000`.
  - The interpreter's program counter is 16-bit and never changes bank
    *(repo: src/script/addressing.ts; export func_CCD09C)*.
- **Rooms go in upper halves, never cross a bank, and are ≤ 32 KB each.** It is the same rule
  `writeRoomAt` enforces *(repo: docs/map-format/rom-export.md)*. The largest vanilla room is
  17,186 bytes.

## 2. The table block

All moved tables sit back to back from `$F1:8000`. Each table is exactly as long as its entries,
and whatever follows a table moves when it grows. Every build or save runs:

1. **Measure:** count the entries of each table.
2. **Lay out:** place the tables in a fixed order, keeping the string keys inside one half.
3. **Write:** write the tables, the directory, and every reader operand (§3).

| Order | Table | Vanilla | Entry | Engine limit |
|---|---|---|---|---|
| 1 | map table (from `$9FFDE7`) | 127 | 4 B | 256 ids (enter-script multiply) |
| 2 | room enter scripts (from `$92801B`) | 127 | 5 B | 256 ids |
| 3 | script pointer table (from `$928294`): trigger/NPC entries, globals at `+$1677`, new entries after the globals | 2,344 | 3 B | globals 256; byte offsets 16-bit |
| 4 | string keys (from `$91D000`) | 3,002 | 3 B | one 32 KB half (~10,900) |

The vanilla total is about 17.2 KB of the 32 KB half. The tables only spill into `$F1:0100+`, the
lower half, once that form is verified.

**Moving the script pointer table.** The readers find an entry as `$D2:8000 + header word +0`
(`$0294`). Globals add header word `+8` (`$1677`). Example, the `0xa3` handler `$8C:D3A0`:

```
adc.l $D28008 / adc.l $D28000 / tax / lda.l $D28000,x
```

The move rewrites each reader's base operand to the new address and sets the header words so the
sums still land on the entries.

The readers come from two sources:

- a static scan of all code for long operands into `$92`/`$D2`;
- the CDL.

The CDL alone has seen only `8C:CE5C` and `8C:D3A0`. Next to `8C:CE5C` the export holds an
unexecuted block that calls it (`JSL $8CCE5C`). Missed readers show up in the replay check.

## 3. The directory

The directory sits at `$F1:0000`. Our tools read it; the game never does.

- It starts with the signature `EVSX` and a version byte.
- Each table gets a record:
  - id;
  - 24-bit address;
  - entry size;
  - entry count;
  - the list of reader operand addresses that hold the table's address.
- The plugin rewrites those operands in place whenever a table moves. The Asar export is used only
  once, to create the hack.
- Without a directory, tools fall back to the vanilla addresses.
- The plugin reads the directory through one resolver. Today `0x1FFDE7` is hard-coded in three
  places: `maps/rom.ts`, `shared/rom-readers.js` and `emulator/panel-webview.js`.
- The everscript compiler (`0x91d000`) follows later, in that repo.

## 4. Adding and removing

- **Add.** A new entry goes at the end of its table. Its content goes in the bank range for its
  kind (§1). Script-table entries go after the globals:
  `[vanilla entries][globals][new entries…]`. No existing offset moves.
- **Remove.** The id stays and its entry becomes null. Decoders and the editor warn about anything
  that still points at a null id. When our decoders show no other reference to the old content,
  the md marks it free for new content of the same kind.
- **Triggers** need no ROM change. A room's step-on and B-trigger lists are length-prefixed and
  read straight from the blob. Only our decoder's 100-entry sanity cap goes; the 32 KB blob budget
  stays.
- **Never touched:**
  - the reserved banks of §1;
  - bytes with no known owner: the last ~4 KB of each script bank `$92–$9B`, 1,725 bytes of
    unreached gaps between scripts, and the export code from `0x308000`. They stay in place and
    are listed as "unknown owner".
- **Old table copies** are wiped with `$FF`.

## 5. Build, proof and output

- `tools/table-hack/`, `npm run table-hack` (with a `scripts/` wrapper), modelled on
  `tools/exhirom/`. It builds the hack from the user's clean ROM and writes:
  - `out/table-hack/soe-tables.sfc`;
  - `LAYOUT.md`, the generated used/free md;
  - `REPORT.md`;
  - optionally a BPS patch.

  Nothing of the ROM is committed.
- **`LAYOUT.md`** shows:
  - per table: entries used / engine limit (e.g. `127/256 maps`), address and bytes;
  - per bank half: the owner of each run, new content by name, free bytes, and the reserved and
    unknown-owner runs.

  It is a printout of the ROM tab's ownership model, so the md and the allocator cannot disagree.
- **Proof:**
  1. Every recorded movie replays with the same WRAM and screen as vanilla.
  2. One added entry per table works headless:
     - room `$7F` on room 15's blob with its own enter script;
     - one new string shown in game;
     - one new trigger-script entry and one new global, each called.

## 6. Decisions

- **In scope:**
  - Build 1: map table, enter scripts, script pointer table (globals included), string keys.
  - 4 MB HiROM; ExHiROM is a later, separate step.
- **Out of scope:**
  - Build 2: tiles `$EE0000` and sprite blocks `$EC0000` / `$D80000`. They need a static reader
    scan plus the replay check first.
  - Left out: palettes (no pointer table; adding one is new code), animation records (bound to
    `$C4`), alchemy (bound to `$91`, readers untraced), the character table, songs.
- **Limits:**
  - Globals stay capped at 256 (the `0xa3` / `0xb0` operand is one byte).
  - No id is ever shifted. Renumbering would need a complete census of where ids come from.

## 7. Before building

- The script decoder must record `0xaf` and `0xb2–0xb4` targets as calls. 25 scripts were missed
  without `0xaf`.
- `docs/map-format/rom-map.md` room sizes differ from the decoder in 109 rooms (mostly ±1 byte;
  room 4 by 34). Regenerate them.
