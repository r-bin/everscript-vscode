# Open Evermore: validation

Status: **design (2026-11-18), nothing built.** Back to [README.md](README.md). Labels as there.

Implode validates the folder before it builds and the ROM after. Every finding has a **severity**, a **rule id**,
the **file** and, inside JSON, the **JSON pointer** of the value, so an editor can underline it.

---

## 1. Severities

| Severity | Colour | Means | Implode |
|---|---|---|---|
| **error** | red | the folder cannot become a correct ROM: a file is missing, a value is invalid, a reference does not resolve, a limit is exceeded | **writes no ROM**; exit code 1 |
| **warning** | yellow | the ROM can be built, but a value makes no sense: nothing uses a resource, a door leads nowhere, a derived field was written by hand | writes the ROM; exit code 0; `--strict` turns warnings into errors |
| **info** | grey | what the build did: ids assigned, resources moved, sizes changed, space left | report only |

**No warnings on vanilla.** A freshly exploded folder must implode with no errors and no warnings. Vanilla oddities
(unused tracks, unreachable rooms) are listed once per rule in the tool as *known in vanilla* and stay silent
for those resources. A logic rule that fires on vanilla is either wrong or needs its vanilla list.

## 2. When each check runs

| Stage | Checks | Stops at |
|---|---|---|
| **1. Read** | `manifest.json` and `header.json` parse and match their schema; every kind folder parses; names follow the name rules | the first stage with errors |
| **2. Resolve** | every reference names an existing resource of its kind; every lock entry has a resource; new names get ids | errors |
| **3. Values** | each codec's own checks (ranges, sizes, colours, characters); each kind's limits ([resources.md](resources.md)) | errors |
| **4. Logic** | the warnings of each kind (unreferenced, doors to nowhere …) | never |
| **5. Layout** | every resource fits its region and placement rule ([manifest.md](manifest.md) §1.3–§1.4); pinned resources did not grow | errors |
| **6. Build** | encode, generate tables, assemble | errors |
| **7. After** | G0 when the tree is unchanged since explode; the round trip (explode the built ROM again, compare); the header checksum | errors |

Stages 1–5 run without building anything, so `--check-only` gives editors fast feedback.

## 3. Rules

General rules; each kind adds its own in [resources.md](resources.md).

| Rule | Severity | When |
|---|---|---|
| `missing-file` | error | a file the kind requires is missing (`map.json` in a map folder, `package.bin` in a track) |
| `parse-error` | error | a file does not parse (JSON, PNG, assembly) |
| `schema` | error | a field is missing, unknown or of the wrong type |
| `bad-name` | error | a name breaks the name rules ([README.md](README.md) §4) |
| `duplicate-name` | error | two resources of one kind share a name (`code/a/x.asm` and `code/b/x.asm`) |
| `unknown-reference` | error | a reference names no resource of its kind; the report lists the closest names |
| `locked-name-missing` | error | `_ids.json` names a resource that is not there |
| `id-over-limit` | error | a new id passes the kind's limit; the report gives the limit's reason |
| `invalid-value` | error | a value outside its range (a colour channel, a size, a character the font lacks) |
| `over-budget` | error | a limit is exceeded (graphics slots, families, blob size, audio RAM) |
| `raw-changed` | error | a `raw/` file was edited ([resources.md](resources.md) §raw) |
| `pinned-grew` | error | a resource that is still read through a raw address got bigger; names the reader |
| `no-space` | error | the allocator found no place under the placement rules |
| `unsupported-layout`, `unsupported-release` | error | [manifest.md](manifest.md) §1.1, §1.5 |
| `outside-image`, `wrong-region`, `write-overlap` | error | a resource writes past the image, outside a `resources` / `header` region, or onto bytes another resource writes |
| `header-mismatch` | error | the built header says another map mode, fast ROM, SRAM size, or a ROM size smaller than the image, than `manifest.json` ([manifest.md](manifest.md) §1.2) |
| `region-gap`, `region-overlap`, `rule-loosened` | error | [manifest.md](manifest.md) §1.3–§1.4 |
| `derived-field` | warning / error | a derived header field written by hand: warning if it agrees, error if not ([manifest.md](manifest.md) §2) |
| `unknown-file` | warning | a file no kind owns, or a `raw/` file the index does not list; ignored |
| `unreferenced` | warning | nothing references the resource (kinds that the game reaches only by reference) |
| `unlocked-id` | warning | a name got an id that is not in the lock yet; `--lock` writes it |
| `duplicate-content` | warning | two resources with identical content (tiles, palettes) |
| `slow-hot` | warning | a resource measured as hot lands in slow ROM (from `exhirom` on) |
| `g0-failed` | error | the tree is unchanged since explode, yet the ROM differs; names the first differing resource |
| `round-trip` | error | exploding the built ROM does not give the folder back; names the resource (`manifest.json` is left out: explode always writes the default regions) |
| `unwritten`, `changed` | info | bytes no resource writes (filled with `$FF`); resources changed since explode, so G0 was not checked |

Built so far *(S0)*: everything in this table except `bad-name` for kinds other than raw, `unknown-reference`,
`locked-name-missing`, `id-over-limit`, `invalid-value`, `over-budget`, `pinned-grew`, `no-space`,
`unsupported-release`, `rule-loosened`, `derived-field`, `unreferenced`, `unlocked-id`, `duplicate-content`,
`slow-hot`: those come with the kinds and the allocator that need them.

## 4. The report

Every implode writes:

- the terminal: errors and warnings, one line each, `severity rule file#pointer: message`, coloured; a summary
  line per kind (count, bytes, moved, space left)
- `_build/report.json`: every finding, for tools and the editor
  (`{ severity, rule, file, pointer, message, related: [{ file, pointer }] }`)
- `_build/report.md`: the same for reading, plus the layout per bank (used, free, what moved and why), the
  generated memory map of this build

**In VS Code** (after promotion, [tool.md](tool.md) §5): `report.json` becomes diagnostics in the Problems
panel, on the file and value they name, red and yellow as above.
