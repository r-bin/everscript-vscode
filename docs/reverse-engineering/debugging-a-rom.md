# Debugging a changed ROM

How to find out whether a built ROM (an Open Evermore build, a patch, a hack) does what it should, and why not when it
does not. Learned on the 7th Dog form (v0.476.0, 2026-11-28): most of the time went into tests that could not show
the answer, not into the bug. Skills: `reference-emulators`, `sample-playbacks`, `open-evermore-modding` §Testing.

## 1. Decide what the test must show

| Question | Test |
|---|---|
| Does the change break anything that worked? (regression) | a replay on the original and the change: **01, the demo with no inputs**, first (`sample-playbacks`, `prove`) |
| Does the new thing work? (feature) | a scene built for it: boot straight into a room that shows it (§2), then look (§3) |

Both, when a change adds something and moves something. Do not reach a scene by replaying one of the owner's long
recordings: a change that costs or saves cycles (a hook, a script call made absolute, a moved table) drifts the replay
(the raptor build matched vanilla at frame 16,200 of a recording and was elsewhere by 18,000), and the recording may
never be where the feature shows (the Dog is absent in the first rooms of Act 1).

## 2. Build the scene in the same tool as the change

An Open Evermore build is edited in its tree; an everscript `.ips` assumes vanilla's layout (script pointer slots,
table addresses) and is not linked to a build that moved them. Scene recipe, all by name:

- The opening's enter script (room `podunk_opening_over_the_machine`, the intro's first code) becomes one line,
  `load_map <x>, <y>, <room>`: the game boots into that room at frame ~420.
- **Brian's room** (`podunk_test_room_brians_room`, `$15`): the empty room (black, torches), no enter script in vanilla.
  Give it one (its `scripts.json` `enter`). What worked: `set_flag <0x2261, 0x01>, 0` and `0x02`, the change's own lines
  (`write_word CHANGE_DOGGO, 14`), `call @gothica_ivor_tower_east_room_and_kitchen/door_01_sub_2`, `unfreeze_boy_and_dog`,
  `fade_in`, `end`. Which of the first lines are needed is not established: `$2261` bits 0/1 are "Dog/Boy unavailable" in
  everscript's `in/core` and barrier flags in `wram/CHARM_FLAGS.md`.
- **A real room** when the feature needs the room's content (sniff spots, enemies): its own enter script, plus what the
  skipped story would have set. The Act 1 jungle start (`prehistoria_jungle_south_where_the_game_starts`, `load_map 70,
  137`) plays the landing scene unless `$22AB` bit `$40` is set (`wram/JUNGLE_START_FLAGS_22AB.md`); with it set, add
  `unfreeze_boy_and_dog` and `fade_in` before the last `end`.

Keep the original script beside the tree (`cp … ../<tree>-<room>-enter.orig.txt`) to undo the scene later.

## 3. Look with MesenCE, not our snes9x core

Our core draws no Boy and no Dog in Brian's room after this skip, vanilla included (the reference shot
`out/open-evermore-tests/vanilla-brians-room.png` has none either); MesenCE shows both. Anything visual is checked in
MesenCE. Headless, a Lua script under `--testRunner` (file IO is off in the settings, so print the PNG as hex):

```lua
local frames = 0
local function hex(s) return (s:gsub('.', function(c) return string.format('%02x', string.byte(c)) end)) end
local w = function(a) return emu.read(a, emu.memType.snesWorkRam) + 256 * emu.read(a + 1, emu.memType.snesWorkRam) end
emu.addEventCallback(function() emu.setInput({ r = frames >= 800 and frames < 1900 }, 0) end, emu.eventType.inputPolled)
emu.addEventCallback(function()
  frames = frames + 1
  if frames % 60 == 0 then print(string.format('f%d room %x', frames, w(0x0ADB))) end
  if frames == 1000 then print('PNG ' .. hex(emu.takeScreenshot())) end
  if frames == 1900 then emu.stop(0) end
end, emu.eventType.endFrame)
```

```sh
/Applications/Mesen.app/Contents/MacOS/Mesen --testRunner shot.lua rom.sfc > out.txt   # run in the background, poll out.txt
grep '^PNG ' out.txt | cut -c5- | xxd -r -p > shot.png
```

Run it on a copy of the ROM under its own name: MesenCE keeps battery RAM per file name. Hand the ROM to the owner by
starting the app with the path (`Mesen <rom>`); `open -a` may only bring an open window forward.

## 4. Compare against a baseline before calling anything broken

Run the identical test on the same build with the vanilla value (the wolf, `CHANGE_DOGGO, 2`, in the same room). In
Brian's room the wolf does not move while R is held either: nothing to sniff. What looked like a broken raptor was the
room. What was broken (the look-around slot held a standing animation, so the Dog never wandered) showed in the
Dog's position logged while the Boy stood idle for a minute: it never changed on that build, and wandered once the slot
held a walk (vanilla's look-around walks too). In the jungle the wolf and the raptor took the same positions in every
sample.

## 5. Narrowing a crash or a black screen

1. **Sample the CPU** every 20 frames from the scene's load: PC, SP, the room id. A PC in bank `$00` and an SP running
   down is a bad jump or return; frame 420 → `$00:88A0` pointed at the form loader's first call.
2. **Revert the build's patched sites in subsets** (copy the vanilla bytes back) and run each: the subset whose revert
   brings the picture back holds the bug. 17 differing bytes, three subsets, one run each.
3. **Diff the code you generated against the original** byte by byte. The loader copy had `$FFFF` where the original
   stores to `$143E`: `_base/` holds table operands other kinds own as blanks, so code copied from it is not the game's.
   Copy nothing from `_base/` that another kind writes; rewrite operands in place instead.
4. **"Not drawn" or "drawn black"?** The OAM buffer `$7E:ABDE` (4 bytes a sprite: x, y, tile, attributes) says whether
   the sprite is there; the screen's pixel values (brighten a crop ×14) say whether it shows. Sprites in OAM but no
   pixels: colours or the emulator, not the entity.

## 6. Our snes9x core, headless, for what it is good at

`tools/open-evermore/play.mts` `boot()` loads the core in node (~10,000 fps): probes, PC sampling, WRAM reads.

- **Move a state between ROMs** whose layouts agree: `_saveState()` on the original at a frame a replay reaches, then
  `_loadState(ptr, len)` on the changed ROM; poke WRAM (`writeMemory`) and run. It reached a field scene with the Dog in
  seconds, where replaying the change drifted.
- An `.ips` that writes past a 3 MiB ROM needs it grown first: to 4 MiB as a mirror (`offset % size`, what the core shows)
  or `$FF` (what Open Evermore writes); both drew Brian's room identically.
- macOS has no `timeout`; give the tool call a timeout instead.
