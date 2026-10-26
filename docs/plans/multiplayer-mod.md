# Evermore multiplayer mod — design draft

**Status: draft for discussion (2026-10-26). Nothing is built yet.** A co-op mod for the US
Evermore ROM. It builds on what FuSoYa's *2 Player Edition* v1.02 (`soe102`) showed works and
fixes what breaks in it. The analysis of that patch: [`soe-2player-patch-analysis.md`](../soe-2player-patch-analysis.md)
(read its corrections box first). The mod itself would live next to the hotkey hack in the
**everscript** repo (`hacks/`). This page is the plan.

Scope for the first steps: **Evermore only.** Mana/Terranigma characters, enemies as players and
netplay are later phases (§9, §10). Nothing in them may shape the early phases beyond keeping a
seam open for them.

---

## 1. What soe102 teaches

What it got right, and what we keep:

- **Drop-in / drop-out** on Start, with the AI taking over the character when its player leaves.
- **Any pad can play any character**, with a small pad number shown next to the character.
- **Hooks at the joypad read**, plus one helper that returns "the buttons of whoever owns this
  character" for the ring menu and the character handlers. Its hooks, as bus addresses (IPS
  offsets minus the `$200` header): the NMI pad read `$C0:847A` and the press-consume routine
  `$C0:8597` (`TRB $0104`; `knowledge/ram/7e0104.md`); the character handlers in `$CF:CC77`–`$CF:D0A8`
  (the companion AI's "am I controlled?" checks at `$CF:D05E`/`$CF:D0A8`, `rom/8fd0a8.md`); about
  30 call sites in the ring menu and its sub-menus (`$CC`, `$CD`, `$CE`); a little code in `$C0:C5xx`–`$C0:CExx`
  and `$D0:82CE`; 2.5 KB of new code at `$F0:0000`; and the ROM grown to 4 MB.

What broke, and why it matters for us. These come from its readme; the causes are our reading
and still need checking in the emulator:

| Symptom (readme) | Probable cause | Our rule |
|---|---|---|
| Only the camera character can leave a room or start some events | Exits, step-ons and several scripts key on the camera entity `$0F42` (`knowledge/ram/7e0f42.md`) | §6: one *protagonist*, explicit rules for the others |
| Non-camera character stuck behind an invisible exit tile after entering a room | It keeps its own position through the room load instead of being placed with the party | Place every character with the protagonist on room entry, ignore triggers for a few frames |
| Pyramid: the other character freezes on a camera switch | A script halts the non-controlled character (`+$10` bit `$20`, `rom/8cf17c.md`) | Respect the halt flag: a halted character ignores its pad |
| Desert spin: Select locked out while the dog has the camera | Same halt flag on the switch | Leaving the game always hands the camera back; never trap the protagonist role |
| Wrong player answers a question (fixed twice: space station, desert skeleton) | The game remembers the "last talker", the patch guessed it | §5: the player who triggered a dialog owns it |
| Charge flash only on the camera character; charge stalls on a switch | Charge display and input are tied to `$0F42` | Per-character charge state, checked per phase |

**Two claims in the older analysis are wrong** (checked against the vanilla CDL library on
2026-10-26): `$7E:28D0–28FF` is not free (all 48 bytes are used), and vanilla never *reads*
DP `$00E6–$00FF` (`wram.flags` = WRITE|DMA only). So soe102's state there is not a proven crash
cause; vanilla code may overwrite it, which would corrupt the patch's state, not the game's.
Our state goes into confirmed free WRAM (§8) anyway.

---

## 2. "Does not crash", defined

1. **Nobody joined = vanilla.** With only pad 1 in the game, the stored playbacks replay
   **WRAM-identical** to the vanilla ROM (`sample-playbacks` skill). Hooks on vanilla paths are
   cycle-exact, as in the hotkey hack (`rom/8cf121.md` §Cycles, `snes-asm-asar-patching` §3.4).
2. **No scripts from the NMI.** Scripts start only from the main loop through `$8C:CE5C`
   (`rom/8cf17c.md`); the NMI only reads pads.
3. **A halted character ignores its pad.** Cutscenes halt characters (`+$10` bit `$20`); scripted
   walks then always arrive, so a `wait` on them always ends.
4. **Crash watchdog in tests.** Playbacks with random pad 2–4 input mixed in (join, leave, menu
   spam), checked for: main loop heartbeat, PC never in RAM, no `BRK`/`STP`, no stuck dialog.
   This catches crashes; it can't prove the game still plays right.
5. **A trouble-spot movie set**: one short movie per soe102 symptom above, which must pass.

---

## 3. Joining, leaving, the protagonist

**Recommendation:**

| Action | Input | Why |
|---|---|---|
| Join | **Start** on a pad that is not in the game | Free in vanilla for pads 2+; same as soe102 |
| Leave | **Hold Start ~1 s** | A tap of Start stays whatever pad 1's Start does in vanilla |
| Take the camera ("be the protagonist") | **Select** | Vanilla's own switch key, so pad 1 plays exactly as before |
| Change character | At a save point, or in the join picker after leaving and rejoining | No mid-fight swapping that skips cooldowns |

Pad 1 is always in the game. Leaving hands that player's character back to the AI, and the
camera to the lowest joined pad if the leaving player had it. The join/leave check runs in the
joypad matcher's place (`rom/8cf121.md`), not in the NMI.

**More than 2 players** needs a multitap (pads 2–5 on port 2). That is SNES hardware
(`src/platform/`): two pads come from auto-read, the others from a manual serial read with IOBit
(`$4201` bit 7) toggled. **Our snes9x2005 core has no multitap support yet**, so that is a
prerequisite for testing 3+ players in the extension.

---

## 4. Choosing a character

**Recommendation: a ring picker on join.** Joining opens a small ring, drawn like the game's
own ring menus, with the characters that are free (and, with the duplicates option on, all of
them). Left/right turns it, the confirm button picks it, and the character appears next to the
protagonist with a poof. Why a ring: it is the game's own UI language, it needs no new screen,
and it pauses only as long as a ring menu would.

- Default pick (confirm at once): the AI companion, i.e. the dog in a 2-player game.
- Later phases add entries without changing the picker (§9).
- Options screen (pad 1, from the picker): *duplicates allowed*, *dog interacts like the boy*
  (§5), *camera mode* (§6).

Rejected: a title-screen lobby (no drop-in), cycling with L/R in play (too easy to hit by
accident; L/R already steer the dog, `rom/8fd0a8.md`).

---

## 5. Who may interact, who owns a dialog

- **Dog interacts like the boy: option, default off.** Off is vanilla (the dog does not talk to
  people or open chests). On lets any character talk, open chests and use B-triggers. Step-on
  triggers and exits are handled by §6, not by this option.
- **The player who triggered a dialog controls it. Yes, this makes sense**, and soe102 fixed
  two bugs by doing exactly that. Rules:
  - The triggering pad answers questions and advances text; other pads' presses are ignored
    (not consumed), so nobody skips someone else's text.
  - Dialogs no player triggered (cutscenes, timed events) belong to the protagonist.
  - Who triggered it is stored when the trigger fires, not looked up later. That fixes the
    "last talker" guess (the colosseum push-back in soe102's readme).

---

## 6. Camera

SNES fact: one screen, one scroll position. Evermore follows one entity (`$0F42`) or a fixed
point (`$242B`, `knowledge/ram/7e242b.md`) and clamps to the map edges. Mana's complaint was
the **hard leash**: players stopped at the screen edge and the camera refused to move.

**Recommendation: a soft group camera with a protagonist.**

1. The camera aims at the centre of all joined, active characters.
2. When they spread wider than the screen allows, the **protagonist wins**: the camera keeps
   them centred enough, the others may leave the screen. Nobody is ever blocked by the screen
   edge.
3. Off-screen players get an edge arrow in their pad's colour. After some seconds off-screen
   (option), or when the protagonist leaves the room, they are pulled to the protagonist.
4. **Exits and step-on events are the protagonist's.** The others standing on one does nothing,
   which is vanilla's behaviour for the AI companion. Any player can take the protagonist role
   with Select, so nobody has to wait.
5. On room entry everyone is placed with the protagonist, and triggers are ignored for a few
   frames (fixes the invisible-exit trap).

Camera modes for the options screen: *group* (above, default), *protagonist only* (soe102),
*Mana leash* (for those who want it). A cutscene's fixed point (`$242B` ≥ 0) always wins.

Open: what in the engine depends on `$0F42` besides the camera (enemy activation, off-screen
culling, step-ons). Every reader of it must be listed before the camera is changed
(`cdl-recorder` skill: `wram.flags` readers).

---

## 7. Ring menus and inventories

Vanilla has one ring menu state, and opening it pauses the game.

**Phase 1:** one ring at a time, but per player: each player has their own ring position,
last ring and target choice. The game pauses as in vanilla; a second player who presses the menu
button while a ring is open is queued and gets the ring next. The ring shows the owner's pad
number. This is about 16 bytes per player.

**Later:** rings that don't pause the game, drawn while the others keep playing. That means
new code for the whole ring (input, drawing, effects); decide after phase 1 has been played.

**Two boys with their own items.** The inventory is one global table (`$7E:22FF`,
`knowledge/ram/7e22ff.md`, plus weapons, alchemy, money), and the stats live in a per-character
block (`$0A26` boy, `$0A70` dog). Plan: **inventory banks**. The global table always holds
the bank of the player whose ring is open; we swap banks in and out when a ring opens and
closes, and when an item is used outside a ring. Pickups go to the bank of whoever picked them
up. Open: what is shared on purpose (money? key items? alchemy formulas?). Our proposal: key
items, formulas and money are shared, consumables and ingredients are not. A second boy also needs
his own stats block, levels and charge. Saving them needs SRAM room; check the free space in
the save layout first.

---

## 8. WRAM budget

Per player, roughly: pad state 6 B, character and party slot 4 B, ring state 16 B, inventory bank
~100 B, stats block `$4A` B. For 4 players that is well under 1 KB. Candidate: the
20 KB block `$7E:ADFE–FFFD` ([`unused-wram.md`](../unused-wram.md), confidence *medium*). It
must pass the guard-pattern playback test described there before the mod relies on it.

**Extra characters need entity records.** The boy and the dog have `$AE`-byte records at
`$4E89`/`$4F37`; other entities have `$8E` bytes in a pool around them (57 slots in all,
[`character-properties.md`](../entities/character-properties.md)). A third and fourth party member need records the
engine's entity pass walks (list head `$3DDF`, next link `+$5E`, `knowledge/ram/7e3ddf.md`).
Open: whether a record outside the pool works with the engine's addressing, or whether we
take pool slots (and then lower the enemy limit).

---

## 8a. Palettes and other sprite limits

**The hard limit:** the SNES has 8 sprite palettes of 15 colours. Evermore keeps slots 6 and 7
for the boy and the dog. Enemies share slots 4, 5, 0, 1 and 2: the allocator `$90:CD80` reuses a slot
already holding the same palette, then takes a free one, then steals one
([`enemies-and-palettes.md`](../enemies-and-palettes.md) §2,
[`character-properties.md`](../entities/character-properties.md) `+$09`). Slot 3 is in neither
list; what holds it is not known yet.

What that means here:

| Case | Palette cost | Plan |
|---|---|---|
| 2 players, boy + dog | none | vanilla |
| Two boys | none, they share slot 6 | Both look the same: tell them apart by the pad number above the head, not by colour |
| Enemy as a player | none if that enemy kind is already in the room, else 1 enemy slot | Fine: in the worst case the allocator steals, so an enemy shows wrong colours (looks wrong, doesn't crash) |
| Each ported character (Mana, Terranigma) | 1 slot | See below |

**Proposal for ported characters: one shared "guest" palette.** When the mod is built, the tool
fits all guest characters chosen for the build into **one** set of 15 colours (a joint
quantisation from the user's own ROMs). It takes slot 3 if that turns out to be free, otherwise
one enemy slot, permanently. Up to four players then cost at most one slot, and enemy
variety drops by at most one palette. The fallbacks are worse. One slot per guest costs the
enemies up to two slots. Recolouring each guest onto the boy's or the dog's palette makes them
look wrong. Swapping palettes mid-frame with HDMA breaks as soon as two sprites overlap
vertically, so it is ruled out.

**Before deciding**, measure in vanilla play how many enemy palettes a room actually uses at
once (the slot table `$7E:1278`). If no room uses all five, taking one costs nothing visible.

**The other sprite limits** are SNES hardware too: 128 sprites, at most 32 sprites and 34 8×8
tile slices on one line (more flicker or drop out), and the OBJ tile space in VRAM. Evermore loads
character tiles through its OBJ tile cache (`$7E:96A5`). Extra player characters add tiles and
sprites on the same lines as the party. This has to be checked in busy rooms (boss fights,
many enemies) with 4 players before phase 4 is done.

---

## 9. Characters from other games, and enemies as players

**Rule 4 of `AGENTS.md` applies in full:** nothing known about Mana or Terranigma is assumed
for Evermore. A ported character is **re-implemented on Evermore's entity record**, as the
Terranigma jump port does it (`docs/terra/jumping.md` §5: copy the shape, not the bytes). Their
code can't simply be called anyway, because WRAM layout, DB/DP and records all differ. The facts
we copy go through an explicit translation table under `src/games/evermore/imports/` (as
`imports/mana` does for rooms).

| Character | Source | Feels like their game | Follows Evermore's rules |
|---|---|---|---|
| Boy, Dog | native | — | — |
| Randi, Primm, Popoi | Mana | movement speed, attack timing, weapon swing shapes, charge levels | damage, hit, evade, stamina, alchemy (or not) through Evermore's formulas |
| Ark | Terranigma | dash, jump (`docs/terra/jumping.md`), attack chain | same |
| An enemy | Evermore | its own animations and strike | human control instead of its behaviour (`docs/entities/ai-behaviours.md`); stats from its record |

- **Legal:** the patch can't contain graphics or animation data from any game. The tool that
  builds the mod reads them from the **user's own ROMs at build time** (Mana and Terranigma
  ROMs from the ROM library, `games-and-roms` skill) and writes them into the user's local
  output ROM only.
- **Scaling:** the SNES can't scale sprites outside Mode 7. Characters keep their pixel size;
  only hit, hurt and strike boxes are fitted to Evermore's (`map-entities` skill). Measure how
  small Mana characters look next to the boy before deciding whether that is acceptable.
- **Palettes:** guests share one palette fitted at build time (§8a), so they won't look exactly
  like their own game.
- **Enemies as a dog stand-in** is the cheapest of these: the record, animations and strike are
  already Evermore's. It is the best test of "human control on a non-party record" before the
  ports start.

---

## 10. Far future: netplay

The SNES is deterministic, so netplay can be lockstep (or rollback in the emulator) with only
pad inputs sent. **Per-player cameras must then be view-only**: the game logic keeps one
logical camera (enemy activation, culling, triggers depend on it), and each client only
*renders* around its own player. This is an emulator feature (render offset per client), not a
ROM change, and it only works if §6 keeps logic and view apart from the start. That is the
one seam to keep open now.

---

## 11. Phases

| # | Phase | Done when |
|---|---|---|
| 0 | Free WRAM confirmed; `$0F42` readers listed; multitap in our core; enemy palette slots used per room measured, slot 3's owner found | Guard-pattern playbacks pass; readers and palette use documented |
| 1 | 2 players, boy + dog, join/leave, protagonist on Select, dialog owner | §2 holds; the soe102 trouble-spot movies pass |
| 2 | Group camera, room-entry placement, edge arrows | Trouble-spot movies + a full playback with a random pad 2 |
| 3 | Per-player ring state, queued rings | Ring spam in the watchdog run never sticks |
| 4 | 3–4 players (multitap), extra party records | Same, with 4 pads |
| 5 | Duplicates with inventory banks, save support | Two boys through a shop and a save/load |
| 6 | Enemies as players, then Mana/Terranigma characters | Per character: feel checked against the source game in the emulator |
| 7 | Netplay | Two clients stay in sync through a full playback |

## 12. Open questions for the owner

1. Leave on *hold Start*, or a chord?
2. Shared vs. per-player items (§7): is the proposed split right?
3. Should a non-protagonist on an exit tile *become* the protagonist (one step fewer), or stay
   ignored (vanilla-like, predictable)?
4. Phase 3 vs. non-pausing rings: is pausing on every ring acceptable with 4 players?
5. Guest characters: one shared palette (they look a little off) or one slot each (fewer
   enemy colours at once)? (§8a)
6. Target ROM for ExHiROM space: is the 4 MB expansion of the table hack the base, or a plain
   4 MB ROM like soe102?
