#!/usr/bin/env python3
"""Builds the five example rooms in building-a-room-from-scratch.md.

Each one is encoded, spliced into a scratch copy of the ROM, read back and
checked. Needs the sibling `everscript` checkout and its .venv:

    ~/Documents/GitHub/everscript/.venv/bin/python3 docs/map-format/examples-build-rooms.py
"""
import sys, os, json, tempfile
sys.path.insert(0, os.path.expanduser('~/Documents/GitHub/everscript'))
os.chdir(os.path.expanduser('~/Documents/GitHub/everscript'))
from tools.encode_room import RoomModel, build_blob, encode_block1, encode_block2, encode_block3
import tools.dump_room as dr

OUT = os.environ.get("ROOMLAB_OUT") or tempfile.mkdtemp(prefix="roomlab-")
ROM = "Secret of Evermore (U) [!].smc"
rom = open(ROM, "rb").read()
SRC = dr.dump_room(0x76, ROM)
FAMILIES = [int(x, 16) for x in SRC["tile_families"]]
PALETTE  = [int(x, 16) for x in SRC["tile_palette"]]

BLANK, GRASS, DIRT, LEAVES = 0xA800, 0x0422, 0x302C, 0x3046
OPEN, SOLID = 0x0010, 0x001F

STAMPS = {
    "grass":        (BLANK,  GRASS, OPEN),
    "grass_solid":  (BLANK,  GRASS, SOLID),
    "dirt":         (BLANK,  DIRT,  OPEN),
    "leaves":       (LEAVES, GRASS, OPEN),
}

def build(name, w, h, cells, step_on=(), b_trigger=()):
    """cells: w*h list of stamp names, reading order. Dictionary is ordered by
    first appearance, which is what the Markov grid encoder requires."""
    order, seen = [], set()
    for c in cells:
        if c not in seen:
            seen.add(c); order.append(c)
    index = {n: i for i, n in enumerate(order)}
    entries = [STAMPS[n] for n in order]
    base = w * h * 2
    grid = [base + index[c] * 8 for c in cells]

    m = RoomModel(
        header=bytes([0, 0, w, h, 23, 0, 0, 2, 0, 0, 0, 0, 0]),
        step_on=list(step_on), b_trigger=list(b_trigger),
        tile_families=FAMILIES, extras=b"",
        block1=encode_block1(PALETTE),
        section2_count=0, section2_data=b"", object_offsets=[],
        block2=encode_block2(grid, w, h, base, fc4=0),
        section4=b"",
        block3=encode_block3([e[0] for e in entries], [e[1] for e in entries], [e[2] for e in entries]),
        object_area=b"",
    )
    blob = build_blob(m)
    OFF = 0x2F0000
    p = bytearray(rom); p[OFF:OFF+len(blob)] = blob
    snes = 0x800000 | OFF; e = dr.MAP_LIST_ADDR
    p[e], p[e+1], p[e+2] = snes & 0xFF, (snes >> 8) & 0xFF, (snes >> 16) & 0xFF
    path = os.path.join(OUT, f"{name}.smc")
    open(path, "wb").write(bytes(p))
    return blob, dr.dump_room(0, path), path, order

G, Gs, S, L = "grass", "grass_solid", "dirt", "leaves"
specs = {
  "L1": (2, 2, [G]*4, (), ()),
  "L2": (2, 2, [Gs, G, Gs, G], (), ()),
  "L3": (4, 4, [G,S,G,G]*4, (), ()),
  "L4": (4, 4, [G,S,G,G] + [L,L,L,L] + [G,S,G,G]*2, (), ()),
  "L5": (4, 4, [G,S,G,G] + [L,L,L,L] + [G,S,G,G]*2,
         [dict(y1=0, x1=1, y2=4, x2=2, script_id=0x1234)], ()),
}
out = {}
for name, (w, h, cells, so, bt) in specs.items():
    blob, d, path, order = build(name, w, h, cells, so, bt)
    out[name] = dict(size=len(blob), metatiles=d["metatile_count"], order=order,
                     coll=d["collision_words"], l2=d["layer2_vram_words"],
                     l1=d["layer1_vram_words"], trig=d["triggers"], path=path)
    print(f"{name}: {len(blob):4d} bytes, {d['metatile_count']} metatiles, order={order}")
json.dump({k: {kk: vv for kk, vv in v.items()} for k, v in out.items()}, open(os.path.join(OUT, "out.json"), "w"), indent=1)
print("\nL2 collision:", out["L2"]["coll"])
print("L5 triggers :", out["L5"]["trig"])
print("\nwrote patched ROMs to", OUT)
