# Table hack: open tasks

> Domain: the table hack (`tools/table-hack/`): Evermore's tables moved into the 4th MB so content
> can grow.
> Shipped, with evidence: [table-hack.md](../table-hack.md), [extension-tables.md](../extension-tables.md),
> [enemies-and-palettes.md](../enemies-and-palettes.md), [adding-animations.md](../adding-animations.md).
> Status key: 🔴 blocks a use · 🟡 gap · 🟢 designed, not built · 💡 idea

## Animations

- 🔴 **Space for sprite infos in `$CA–$D3`.** A `sprite` command reaches only these banks (bank =
  command + `$A8`), and no free run is proven there. This blocks any new pose with new art. Ideas:
  - move 8×8 pixel blocks that live in `$D1–$D3` to the extension (only their 23-bit offsets in
    the moved `sprite_blocks_8` table change) and use the freed bytes;
  - check that the sprite-list walk (`walkSprites`, 5128 infos) still finds its end.
- 🟡 **Block encoder** next to `blockBytes()` (`src/maps/sprites.ts`), with a byte-identical round
  trip over all 4854 + 6265 vanilla blocks ([act0-dog-animations.md](act0-dog-animations.md) step 4).
- 🟡 **Prove that block offsets reach the extension**: that `$D90000` + a 23-bit offset is a plain
  24-bit add. Test it by moving one vanilla block's pixels to `$F2+` and comparing the screen.
- 🟡 **A real write of new animation content**: block entries appended to the moved tables, sprite
  infos, scripts in the extension, and record groups whose pointers name those scripts.
  `--add-animation` only copies vanilla groups.
- 🟡 **Art for the Act 0 Dog**: ~85 poses in its palette `$90:B54B`
  ([act0-dog-animations.md](act0-dog-animations.md)).
- 🟡 **Trace how sprite blocks reach VRAM** (on demand or a per-form preload) and the Dog form
  loader. Both are still untraced.
- 💡 The two 542-byte zero runs in `$C4` (`$09E4`, `$1666`): prove they are unread (a read breakpoint
  over a full playthrough) before using them for more records.

## Enemies and palettes

- 🟡 **Decide on the sprite palette hook.** It works, but it shifts the RNG timing
  ([enemies-and-palettes.md §5.1](../enemies-and-palettes.md)). The alternative is reusing vanilla
  palettes.
- 🟡 **Find the routine that steps the RNG while waiting for the next frame.** It explains the hook's
  drift.
- 🟡 **17 full-address operands into the character table** (`$8E:B6xx–DFxx`) in code the CDL never
  recorded, and `$90:8A2F`: confirm or rule out each one.
- 🟡 **10 byte patterns in data banks** that look like `$8E00xx` operands (left unpatched): confirm
  they are data.

## Tools that must learn the moved addresses

- 🔴 **everscript compiler**: string keys (`0x91d000`), the room and script tables it writes,
  `ENEMY` ids past 143. Today `build.js` redirects its IPS writes.
- 🟢 **The directory at `$F1:0000`** ([table-hack.md §3](../table-hack.md)) and one resolver in the
  plugin. `0x1FFDE7` is hard-coded in `maps/rom.ts`, `shared/rom-readers.js` and
  `emulator/panel-webview.js`; `src/maps` also hard-codes `$EC0000`, `$D80000` and `$C43C92`.
- 🟢 **A generated used/free md** (`LAYOUT.md`) per built ROM ([table-hack.md §5](../table-hack.md)).

## More tables

- 🟡 **Map tile graphics `$EE0000`** (6688 / ~21,800): readers `$8C:C88C`, `$90:A23D`. Needs a scan
  like the block tables'.
- 🟡 **Song packages `$819903`** (71 / 256): readers `$8C:8252`, `$8C:8257`. Also fix
  `src/rom/model/audio.js`, which calls `$81:9900` "song count" (it is the last package index).
- 💡 Alchemy (`$C45DDF` / `$9180A6`), which needs its readers traced first.

## Housekeeping

- 🟡 The script decoder records no `call` for `0xaf` / `0xb2–0xb4`, so 25 scripts went unseen.
- 🟡 `docs/map-format/rom-map.md` room sizes differ from the decoder in 109 rooms.
- 🟡 Bank plan in [table-hack.md §1](../table-hack.md) is older than the enemy and animation banks.
  Fold in `$F8` (enemies, 16×16 blocks), `$F9` (map palettes, 8×8 blocks), `$FA` (sprite
  palettes, hook) and `$F1:F000` (`animate()` ids).
