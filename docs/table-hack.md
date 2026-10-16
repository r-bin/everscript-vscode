# Table hack — where things live in the extension (proposal)

Status: **proposal, nothing built.** The idea: move only the *tables* that index Evermore's content
into the 4 MB extension (file `0x300000–0x3FFFFF`), leave all content (rooms, scripts, strings)
where it is, and put new content in the extension. Then a 128th room, a new string or a new
script is one more table entry plus a blob in free space.

Facts are marked *(repo)* with their source or *(to verify)*.

## 1. Banks of the extension

In HiROM the 4th MB is banks `$F0–$FF`: file `0x3n0000` = `$Fn:0000`. The upper half of each bank
(`$Fn:8000–$FFFF`) is also visible as `$Bn:8000–$FFFF`; the lower half is visible only as `$Fn`
*(hardware)*.

| Bank | Lower half `$Fn:0000–7FFF` | Upper half `$Fn:8000–FFFF` (= `$Bn`) |
|---|---|---|
| `$F0` | **reserved**: FuSoYa 2P kernel `0000–0A16`; everscript linker strings | **reserved**: everscript extension code (`0x308000+`); `$80:D113` read target `E653–E6D1` |
| `$F1` | directory `0000–00FF`; rest free | **tables**, back to back (§2) |
| `$F2–$F7` | **new strings** (192 KB) | **new scripts** (192 KB), including new enter scripts |
| `$F8–$FB` | free (build 2: graphics tables) | **new rooms** |
| `$FC–$FD` | free; `$FD:0000` *to verify* (see §4) | **new rooms**; `$BC`/`$BD` are the room export's slots |
| `$FE` | **reserved**: XaserLE debug menu `0000–05FF` | **reserved**: everscript `debug_menu`, `scale_enemies` |
| `$FF` | **reserved** (everscript hook, see §4) | **reserved**: everscript `hotkeys`, `_hook_input` |

Why each kind goes where it does:

- **Tables in an upper half.** The verified moves put them at `$F1:8000+`, read through the
  `$B1` mirror *(repo: docs/reverse-engineering/cdl-export-build-recomp.md §moves)*. A lower half
  works only if every reader's operand uses the `$F1` form *(to verify)*. The string key table
  must not cross a 32 KB half *(repo: asm-to-c-port.md §11)*.
- **Strings in lower halves.** A key unpacks to `(bank << 16) | (p & $7FFF)` from `$C00000`, so
  strings can only sit at `$xx0000–$7FFF` *(repo: src/emulator/cdl/known-regions.js string_keys)*.
- **Scripts in upper halves, not crossing a bank.** The packed pointer unpacks to bank `$92 + n`
  and offset `| $8000`. The interpreter's program counter is 16-bit and never changes bank
  *(repo: src/script/addressing.ts; export func_CCD09C)*.
- **Rooms in upper halves, not crossing a bank, ≤ 32 KB.** The same rule `writeRoomAt` enforces
  *(repo: docs/map-format/rom-export.md)*. Largest vanilla room: 17,186 bytes.
- Strings and scripts share banks `$F2–$F7` (lower/upper), so one bank holds both halves of new
  text and code.

## 2. The table block

All moved tables sit back to back from `$F1:8000`. Each table is exactly as long as its entries;
whatever follows it moves when it grows. Building or saving is:

1. **Measure.** Count each table's entries.
2. **Lay out.** Place the tables in fixed order, honouring the string-key half rule.
3. **Write.** Write the tables, the directory and every reader operand (§3).

| Order | Table | Vanilla | Entry | Engine limit |
|---|---|---|---|---|
| 1 | map table (from `$9FFDE7`) | 127 | 4 B | 256 ids (enter-script multiply) |
| 2 | room enter scripts (from `$92801B`) | 127 | 5 B | 256 ids |
| 3 | script pointer table (from `$928294`): trigger/NPC entries, globals at `+$1677`, new entries after the globals | 2,344 | 3 B | globals 256; byte offsets 16-bit |
| 4 | string keys (from `$91D000`) | 3,002 | 3 B | one 32 KB half (~10,900) |

Vanilla total: about 17.2 KB of the 32 KB half. The tables spill into `$F1:0100+` (lower half)
only once that form is verified.

## 3. The directory

`$F1:0000`, read by our tools only; the game never reads it.

- Signature `EVSX`, version byte.
- Per table: id, 24-bit address, entry size, entry count, and the list of reader operand
  addresses that hold the table's address. The writer rewrites those operands whenever the table
  moves. Without a directory, tools use the vanilla addresses.

## 4. Conflicts to resolve before building

- `docs/patches/README.md` says Everscript uses `$FD0000` / `$FE5000`. `docs/map-format/rom-export.md`
  says `$B0` / `$BE` / `$BF`. Until it is checked in the everscript repo, `$FD` lower and all of
  `$FE` / `$FF` stay reserved.
- The everscript linker's "strings at `$B0:0000`" is really `$F0:0000–7FFF`, because `$B0:0000` is
  not ROM. That is the same half as the 2P kernel.
- The export's code area from `0x308000` has no measured size; all of `$F0` upper stays reserved.

## 5. What the generated md shows

Per table: entries used / engine limit (e.g. `127/256 maps`), address, bytes. Per bank half:
owner of each run, new content by name, free bytes, and the reserved and unknown-owner runs
(script-bank tails, unreached script gaps).
