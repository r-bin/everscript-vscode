# Openify: an agent that opens other games the way Open Evermore opens Evermore

Status: **idea, draft (2026-11-27)**. Nothing built. Labels: *(repo)* = exists today; *(proposal)* = this draft;
*(owner's call)*; *(to verify)*. Related: [Open Evermore](../open-evermore/README.md),
[mapping.md](../open-evermore/mapping.md), the `snes-re` skill, [multi-game.md](../architecture/multi-game.md).

**Question (owner, 2026-11-27).** Can an agent create "Open Evermore" for other games? Point an `openify` agent at
a ROM (or several releases of one game) and it writes the config, the mapping file and the explode files. Then you
talk with it to explode more features, and loop until you are happy.

**Short answer.** Yes for the scaffolding and the loop. Mostly yes for the first few kinds. Not "the whole game
in one go". The reason it can work at all is the **hard rule**: a kind counts only when implode is byte-identical,
random layouts round-trip, and `prove` plays the same. Those three are automatic grades, so the agent can check
its own work and does not need the owner to judge whether a codec is right. The owner judges what is worth
exploding and what things are called.

---

## 1. What already carries over, what does not

| Part | Today | Game-neutral? |
|---|---|---|
| `explode.mts`, `implode.mts`, `layouts.mts`, `placement.mts`, `manifest.mts`, `tree.mts`, `links.mts`, `enum.mts` | *(repo)* | yes, by the rule "only `evermore/` names the game" (`tools/open-evermore/README.md`) |
| `codec.mts` (`Codec`, `Rule`, `Item`, `Exploded`) | *(repo)* | yes: the contract a new game's codecs fill in |
| `prove.mts` / `play.mts` | *(repo)* | the lockstep is generic; it needs that game's stored playbacks and a core that runs it *(to verify for Mana, Terranigma)* |
| `open-evermore.mts` (the CLI) | imports `./evermore/map.mts`, `./evermore/kinds.mts` directly | **no**: needs a game switch (§4 O0) |
| `evermore/kinds.mts`, `evermore/codecs/*`, `evermore/map/<release>.json`, `map-locate.mts` | ~40 codecs, ~220 addresses | **no, and must not be copied**: Evermore facts (AGENTS.md §0.4) |
| `manifest.mts` `FORMAT = 'open-evermore'` | *(repo)* | a name to generalise (`open-rom`? *(owner's call)*) |
| SNES hardware facts (header, LoROM/HiROM/ExHiROM mapping, DMA, PPU registers) | `src/platform/` | yes: the only knowledge allowed to carry over |

Evermore's codecs took about a week of sessions (hard rule set 2026-11-19, 16+ kinds by 2026-11-23), **on top of
decoders, knowledge entries, CDL recordings and playbacks that took far longer**. A new game starts without those.
That is the real cost, and the agent has to build them as it goes.

---

## 2. The agent *(proposal)*

- Persona `.agents/agents/openify.md`, skill `.agents/skills/openify/SKILL.md`. It composes existing skills rather
  than repeating them: `snes-re` (intake, truths vs leads, pipeline A–E), `games-and-roms` (identify, descriptor,
  variants), `open-evermore` (the codec contract and the gates), `cdl-recorder`, `sample-playbacks`,
  `feature-validation`, `supported-games`.
- **Input**: one or more ROM paths from the user's ROM library (never a path in the repo).
- **Output** (all ours, no ROM bytes, AGENTS.md §0.1):
  - `src/games/<game>/descriptor.ts`: the game and its releases (exists for Mana and Terranigma *(repo)*).
  - `tools/open-evermore/<game>/` *(placement: owner's call)*: `kinds.mts`, `codecs/*.mts`, `map/<release>.json`.
  - `docs/<game>/open/`: `intake.md`, `progress.md` (kind, level, evidence), `leads.md`, `worklist.md`. These are
    the agent's state; any session resumes from them (as `snes-re` does).
  - knowledge entries for every address and format it learns (AGENTS.md §0.2).
- The exploded tree itself goes to `out/open-<game>/` only.

### Levels a kind climbs

| Level | Means | Checked by |
|---|---|---|
| L0 pinned | in `_base/`, untouched | implode of an empty tree is the ROM byte for byte |
| L1 decoded | the agent can read and show it (viewer, `som://`/VFS entry) | visual check in headless Chromium for graphics and maps (`feature-validation`) |
| L2 lossless | explode → stable implode is byte-identical | G0, unit test |
| L3 movable | `--random` seeds build and round-trip; nothing reaches it by fixed address | G1, random layouts |
| L4 proven | `prove` plays the same as the original on the stored playbacks | G2, emulator tier |

A kind enters `<game>/kinds.mts` only at L4, the same bar as Evermore. Below that it stays in the progress page as
a lead or a draft codec.

---

## 3. The loop

1. **Point.** `openify <rom> [<rom>…]`. The agent identifies each ROM (header, mapping, SHA-1, release), groups the
   releases of one game, and creates the descriptor if missing.
2. **Intake.** One `snes-re` grilling round: goals, which subsystems first, which recordings exist, which outside
   sources may be read as leads. The agent asks only for decisions; facts it looks up.
3. **Scaffold (L0).** Empty `kinds.mts`, an empty `map/<release>.json`, a `manifest.json` covering the whole image
   as `_base/`. Gate: implode is byte-identical. This is trivial and proves the wiring.
4. **Survey.** The agent proposes a ranked menu of candidate kinds, each with its evidence and an estimated cost.
   Generic, SNES-level probes find candidates:
   - pointer tables (runs of 16/24-bit words into one bank, monotone or clustered), and their readers from the CDL;
   - DMA sources per destination (VRAM → graphics, CGRAM → palettes, `$2140`–`$2143` → sound driver uploads);
   - compression (a decoder routine every DMA source passes through), text (a byte histogram that fits a font);
   - script VMs (a jump table indexed by a fetched byte).
5. **Discuss.** The owner picks, renames, asks for more. "Explode the palettes", "what are these tables at …?",
   "call it `town`".
6. **Explode one kind.** Codec → L2 → L3 → L4. On a failed gate the agent shows the first diverging byte or frame
   and keeps going; it reports the level reached, never "done" below L4.
7. **Write down.** Knowledge entries, progress page, mapping file entries, in the same commit.
8. **Repeat 4–7** until the owner stops. Every pass ends in a commit (release ritual).

### Several releases of one game

The first release gets the hand-made `map/<release>.json`. For the others, generalise Evermore's `locate`
(`evermore/map-locate.mts`: find each mapped address in another release by its code shape) into a generic
"find these sites by their instruction bytes" tool; the draft must be checked against that release's code before it
becomes its map ([mapping.md](../open-evermore/mapping.md) §6). Codecs stay one per kind; only the map differs.

---

## 4. Steps *(proposal)*

| Step | What | Done when |
|---|---|---|
| **O0** | Make the CLI game-neutral: `--game` or the descriptor picks `<game>/kinds.mts` and `<game>/map.mts`; rename the format id | Evermore still G0/G1/G2-green; no `evermore` import outside `evermore/` (a check in `check:*`) |
| **O1** | Scaffold a second game by hand (Mana: it already has a descriptor, an interpreter, docs) | L0 byte-identical; the empty tree implodes |
| **O2** | One Mana kind by hand, to find where the contract leaks Evermore assumptions (bank windows, `PAST_END`, script groups) | that kind at L4, or the leaks listed |
| **O3** | Write the `openify` skill and persona from what O1–O2 cost, not before | the skill fits `check:ai-context` |
| **O4** | Run the agent on Terranigma from scratch, owner only in the discussion | scaffold + one kind at L3+ without hand edits |
| **O5** | Several releases: the generic `locate` | a second release's map drafted and checked |
| **O6** | An unsupported game *(owner's call)* | the agent adds the descriptor itself |

Do O1–O2 by hand first: an agent built before a second game exists would bake in Evermore's shape.

---

## 5. Limits and traps

- **Playbacks are the bottleneck.** L4 needs stored playbacks of that game; only the owner can record them
  (`snes-re` §1 Q3). Without them a kind stops at L3. Also which emulator is trusted per game
  (`reference-emulators`) *(to verify for Mana, Terranigma)*.
- **Hard rule vs unknown readers.** A table moved without knowing all its readers breaks the game, and G0 never
  notices. L3/L4 catch it only for what the playbacks reach. Unplayed readers need the CDL and static analysis.
- **No knowledge crosses games.** The agent may reuse the tool and the method, never "Evermore keeps strings like
  this". Every fact is re-derived from that game's code and running game (AGENTS.md §0.4).
- **Legal.** No outside tools' tables or layouts (`SoETilesViewer`/`SoEScriptDumper` rule applies to every game's
  equivalents); community maps are leads only. Nothing ROM-derived outside `out/`.
- **Names are the owner's.** The agent proposes names from evidence (what the code does); it never imports names
  from outside sources (D3/D4).
- **Visual kinds need a human-checkable render** in the core map editor or a viewer, not only byte identity.
- **Cost per pass.** Explode + implode + `prove` per kind per iteration; keep the loop on the fast tier and run
  `prove` once per kind (`test-discipline`).

---

## 6. Open questions *(owner's call)*

1. Folder: `tools/open-evermore/<game>/` next to `evermore/`, or rename the generic tool (`tools/open-rom/`)?
2. Name of the product per game: "Open Mana", "Open Terranigma", or one name?
3. Pilot: Mana (most known, interpreter, Mana→Evermore bridge) or Terranigma (fresh, a truer test of the agent)?
4. Does the agent run as one long session, or as one commit per explode pass that any session can resume?
5. Unsupported games at all, or only the three in `src/games/`?
