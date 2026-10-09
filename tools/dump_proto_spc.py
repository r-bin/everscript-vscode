"""
Secret of Evermore prototype (chip 1) — SPC dumper.

Rebuilds the songs the prototype chip changes (and fully contains) as playable .spc + .wav, by
converting each prototype song package to the retail sound driver's layout. Background, checks
and results: docs/soe-prototype-chip1.md §6.5.

Usage (from the repo root):
    python3 tools/dump_proto_spc.py --proto "<chip 1>.sfc" --rom "<retail (U)>.smc" --out-dir out/proto_spc
    python3 tools/dump_proto_spc.py ... --verify      # also run the two control checks

Needs the sibling everscript repo (tools/dump_spc.py: driver emulation, SPC writer, libgme render)
and libgme for .wav output (brew install game-music-emu).

How a song is converted (each step is checked by --verify):
  - Package descriptors: the prototype's start at $8A:E220 (69 songs), retail's at $8A:A7BE (71).
  - Records are paired with their retail twins by length, re-anchored on instrument evidence.
  - Off-chip records (most samples) come from the retail twin; on-chip ones from the prototype.
  - Pointer records are recomputed: 2-byte = next record's address, 4-byte directory entry =
    next + 3 (loop offset kept from retail). They go to the retail twin's table slot, because the
    prototype driver (chip 0, missing) has its tables elsewhere: songs $2E5E vs $2EB8,
    instruments $2126 vs $2124.
  - Sequence pointers (header track pointers, `F6 lo hi`) are remapped record by record; instrument
    ids (`F5 xx`) and sample numbers (byte 2 of an instrument record) are renumbered.
"""

import argparse
import array
import difflib
import math
import os
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DUMP_SPC_DIR = os.path.join(HERE, "../../everscript/tools")

CHIP = (0x080000, 0x100000)          # file range of prototype chip 1 (banks $08-$0F)
PROTO_PACKAGES, PROTO_COUNT = 0x0AE220, 69
RETAIL_COUNT = 71
ECHO_START = 0xD400                  # echo buffer: song data must end below it
INST_TABLE_RETAIL, INST_TABLE_PROTO = 0x2124, 0x2126   # instrument pointer tables, 2 B per id
SONG_TABLE = (0x2E00, 0x3000)        # sequence pointer table region (both drivers)
DIR_BASE = 0x1F00                    # sample directory, 4 B per sample number (both drivers)

# (prototype package, retail package, name). Only songs whose changed records are all on chip 1.
SONGS = [
    (0x2D, 0x2F, "Fields of Gothica"),
    (0x39, 0x3B, "Freak Show!!!"),
    (0x3A, 0x3C, "Item Fanfare"),
    (0x3D, 0x3F, "Dark Greenhouse"),
    (0x40, 0x42, "Collapse of Ivor Tower"),
]
# Prototype songs with the retail record layout: converting them must sound like retail.
CONTROLS = [(0x0F, 0x11), (0x10, 0x12), (0x1D, 0x1F), (0x30, 0x32)]


class Builder:
    def __init__(self, dump_spc, proto, retail):
        self.ds, self.P, self.F = dump_spc, proto, retail
        image = bytearray(len(retail))                  # chip 1 at its file offset, for walks
        image[CHIP[0]:CHIP[1]] = proto
        self.proto_pk = self._walk(image, PROTO_PACKAGES, PROTO_COUNT)
        self.retail_pk = [self._walk(retail, self._r24(dump_spc.PACKAGE_POINTERS + 3 * i), 1)[0]
                          for i in range(RETAIL_COUNT)]

    # -- ROM access --------------------------------------------------------------------------

    def _r24(self, o):
        return (self.F[o] | self.F[o + 1] << 8 | self.F[o + 2] << 16) & 0x3FFFFF

    def _walk(self, rom, start, count):
        """[[(len, src, dest)]] per package; descriptors are read through bank upper halves."""
        pk, cur = [], start
        for _ in range(count):
            head, cur = self.ds.read_upper(rom, cur, 2)
            recs = []
            for _ in range(head[0] | head[1] << 8):
                r, cur = self.ds.read_upper(rom, cur, 7)
                recs.append((r[0] | r[1] << 8, (r[2] | r[3] << 8 | r[4] << 16) & 0x3FFFFF, r[5] | r[6] << 8))
            pk.append(recs)
        return pk

    def proto_read(self, src, n):
        """Bytes from the prototype chip, or None when any of them lie off-chip."""
        out = bytearray()
        while n:
            if not CHIP[0] <= src < CHIP[1]:
                return None
            k = min(n, ((src | 0xFFFF) + 1) - src)
            out += self.P[src - CHIP[0]:src - CHIP[0] + k]
            src, n = src + k, n - k
            if (src & 0xFFFF) == 0:
                src += 0x8000
        return bytes(out)

    def retail_read(self, src, n):
        return bytes(self.ds.read_upper(self.F, src, n)[0])

    # -- pairing -----------------------------------------------------------------------------

    @staticmethod
    def _align(a, b):
        tw = {}
        for tag, a1, a2, b1, b2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
            if tag == "equal":
                tw.update(zip(range(a1, a2), range(b1, b2)))
        return tw

    @staticmethod
    def _inst_id(dest, base):
        return (dest - base) // 2 if base <= dest < base + 0x200 else None

    def twins(self, pi, fi):
        """{prototype record: retail record}. Equal-length instrument runs are ambiguous, so where an
        on-chip track and its twin show `F5 x` -> `F5 y`, those ids anchor a second alignment."""
        p, f = self.proto_pk[pi], self.retail_pk[fi]
        tw0 = self._align([r[0] for r in p], [r[0] for r in f])
        evidence = {}
        for k, j in tw0.items():
            if p[k][0] <= 4 or p[k][0] != f[j][0]:
                continue
            pb = self.proto_read(p[k][1], p[k][0])
            if pb is None:
                continue
            rb = self.retail_read(f[j][1], f[j][0])
            for i in range(len(pb) - 1):
                if pb[i] == 0xF5 and rb[i] == 0xF5:
                    evidence[pb[i + 1]] = rb[i + 1]
        if not evidence:
            return tw0
        wanted = set(evidence.values())
        pkeys, fkeys = [], []
        for length, _, d in p:
            x = self._inst_id(d, INST_TABLE_PROTO) if length == 2 else None
            pkeys.append((length, "I", evidence[x]) if x in evidence else (length,))
        for length, _, d in f:
            y = self._inst_id(d, INST_TABLE_RETAIL) if length == 2 else None
            fkeys.append((length, "I", y) if y in wanted else (length,))
        tw = self._align(pkeys, fkeys)
        used = set(tw.values())
        for k, j in tw0.items():            # keep plain twins the anchored pass left open
            if k not in tw and j not in used and p[k][0] == f[j][0]:
                tw[k], _ = j, used.add(j)
        return tw

    def id_maps(self, pi, fi):
        """prototype -> retail instrument ids and sample numbers, from the song's and base's twins."""
        inst, srcn = {}, {}
        for a, b in ((0, 0), (pi, fi)):
            p, f = self.proto_pk[a], self.retail_pk[b]
            for k, j in self.twins(a, b).items():
                length, pd, rd = p[k][0], p[k][2], f[j][2]
                if length == 2 and INST_TABLE_RETAIL <= rd < INST_TABLE_RETAIL + 0x200:
                    inst[(pd - INST_TABLE_PROTO) // 2] = (rd - INST_TABLE_RETAIL) // 2
                elif length == 4 and DIR_BASE <= rd < DIR_BASE + 0x400:
                    srcn[(pd - DIR_BASE) // 4] = (rd - DIR_BASE) // 4
        return inst, srcn

    # -- conversion --------------------------------------------------------------------------

    def convert(self, pi, fi):
        """Prototype package pi as [(dest, bytes)] for the retail driver, plus notes."""
        p, f = self.proto_pk[pi], self.retail_pk[fi]
        twin = self.twins(pi, fi)
        rtwin = {j: k for k, j in twin.items()}
        is_ptr = [r[0] in (2, 4) and k + 1 < len(p) for k, r in enumerate(p)]
        cursor = min(r[2] for k, r in enumerate(p) if not is_ptr[k])
        new_dest = {}
        for k, (length, _, _) in enumerate(p):
            if not is_ptr[k]:
                new_dest[k], cursor = cursor, cursor + length
        if cursor > ECHO_START:
            raise ValueError("song data ends at $%04X, inside the echo buffer" % cursor)
        seq_ptr = next((k for k in range(len(p)) if is_ptr[k] and k in twin
                        and SONG_TABLE[0] <= f[twin[k]][2] < SONG_TABLE[1]), None)
        header = seq_ptr + 1 if seq_ptr is not None else len(p) + 1
        inst_map, srcn_map = self.id_maps(pi, fi)
        instrument_recs = {k + 1 for k in range(len(p)) if is_ptr[k] and p[k][0] == 2 and k in twin
                           and INST_TABLE_RETAIL <= f[twin[k]][2] < INST_TABLE_RETAIL + 0x200}
        notes, unmapped = [], [0]

        def remap(value, from_retail):
            rows = f if from_retail else p
            for j, (length, _, d) in enumerate(rows):
                if length > 4 and d <= value < d + length:
                    k = rtwin.get(j) if from_retail else (j if not is_ptr[j] else None)
                    if k is not None:
                        return new_dest[k] + value - d
                    break
            unmapped[0] += 1
            return value

        def relocate(data, k, from_retail):
            data = bytearray(data)
            if k == header:                                 # count, then count track pointers
                for t in range(data[0]):
                    v = data[1 + 2 * t] | data[2 + 2 * t] << 8
                    struct.pack_into("<H", data, 1 + 2 * t, remap(v, from_retail))
                return bytes(data)
            seq_lo = (f[twin[header]][2] if header in twin else 0) if from_retail else p[header][2]
            i = 0
            while i < len(data) - 2:                        # F6 lo hi: absolute sequence address
                v = data[i + 1] | data[i + 2] << 8
                if data[i] == 0xF6 and seq_lo <= v < ECHO_START:
                    struct.pack_into("<H", data, i + 1, remap(v, from_retail))
                    i += 3
                else:
                    i += 1
            return bytes(data)

        out = []
        for k, (length, src, _) in enumerate(p):
            if is_ptr[k]:
                if k not in twin:
                    raise ValueError("pointer record %d has no retail twin" % k)
                slot, target = f[twin[k]][2], new_dest[k + 1]
                if length == 2:
                    out.append((slot, struct.pack("<H", target)))
                else:
                    fb = self.retail_read(f[twin[k]][1], 4)
                    loop = (fb[2] | fb[3] << 8) - (fb[0] | fb[1] << 8)
                    if loop > p[k + 1][0] - 3:
                        notes.append("loop of a resized sample reset to its start")
                        loop = 0
                    out.append((slot, struct.pack("<HH", target + 3, target + 3 + loop)))
                continue
            data = self.proto_read(src, length)
            from_retail = data is None
            if from_retail:
                if k not in twin:
                    raise ValueError("record %d is off-chip and has no retail twin" % k)
                data = self.retail_read(f[twin[k]][1], length)
            if k >= header:
                data = relocate(data, k, from_retail)
            if not from_retail:
                data = bytearray(data)
                if k in instrument_recs and len(data) >= 3 and data[2] in srcn_map:
                    data[2] = srcn_map[data[2]]
                i = 0 if k > header else len(data)          # tracks only
                while i < len(data) - 1:                    # F5 xx: select instrument
                    if data[i] == 0xF5 and data[i + 1] in inst_map:
                        data[i + 1] = inst_map[data[i + 1]]
                        i += 2
                    else:
                        i += 1
                data = bytes(data)
            out.append((new_dest[k], data))
        if unmapped[0]:
            notes.append("%d sequence pointers left unmapped" % unmapped[0])
        notes.append("data $%04X-$%04X" % (min(new_dest.values()), cursor))
        return out, notes

    def rebuild_retail(self, fi):
        """Retail package fi rebuilt with the pointer rules alone; must equal the original."""
        f = self.retail_pk[fi]
        out = []
        for k, (length, src, dest) in enumerate(f):
            nxt = f[k + 1] if k + 1 < len(f) else None
            if length == 2 and nxt:
                out.append((dest, struct.pack("<H", nxt[2])))
            elif length == 4 and nxt:
                fb = self.retail_read(src, 4)
                loop = (fb[2] | fb[3] << 8) - (fb[0] | fb[1] << 8)
                out.append((dest, struct.pack("<HH", nxt[2] + 3, nxt[2] + 3 + loop)))
            else:
                out.append((dest, self.retail_read(src, length)))
        return out

    # -- SPC ---------------------------------------------------------------------------------

    def spc(self, fi, records, base, title):
        ds = self.ds
        music = next(m for m in range(0x46) if self.F[ds.MUSIC_PACKAGE + m] == fi)
        original = ds.package_records
        swap = {0: base, fi: records} if records is not None else {}
        ds.package_records = lambda rom, package: swap.get(package) or original(rom, package)
        try:
            return ds.dump_track(self.F, music, None, None, title)
        finally:
            ds.package_records = original


def envelope_correlation(ds, gme, spc_a, spc_b, seconds=30):
    """Correlation of 100 ms loudness envelopes of two renders."""
    def env(spc):
        pcm = array.array("h", ds.render(gme, spc, seconds, 0))
        w = ds.SAMPLE_RATE * 2 // 10
        return [math.sqrt(sum(x * x for x in pcm[i:i + w:8]) / (w / 8)) for i in range(0, len(pcm), w)]
    a, b = env(spc_a), env(spc_b)
    ma, mb = sum(a) / len(a), sum(b) / len(b)
    sa = math.sqrt(sum((x - ma) ** 2 for x in a))
    sb = math.sqrt(sum((x - mb) ** 2 for x in b))
    return sum((x - ma) * (y - mb) for x, y in zip(a, b)) / (sa * sb) if sa and sb else 0.0


def main():
    ap = argparse.ArgumentParser(description="Secret of Evermore prototype chip 1 SPC dumper")
    ap.add_argument("--proto", required=True, help="prototype chip 1 dump (512 KB)")
    ap.add_argument("--rom", required=True, help="retail Secret of Evermore (U) ROM")
    ap.add_argument("--out-dir", default="out/proto_spc", help="output directory")
    ap.add_argument("--dump-spc-dir", default=DEFAULT_DUMP_SPC_DIR, help="folder holding dump_spc.py")
    ap.add_argument("--duration", type=int, default=150, help="WAV length in seconds, fade included")
    ap.add_argument("--fade", type=int, default=8, help="WAV fade-out in seconds")
    ap.add_argument("--no-wav", action="store_true", help="write .spc only")
    ap.add_argument("--retail", action="store_true", help="also write the retail versions to compare")
    ap.add_argument("--verify", action="store_true", help="run the control checks first")
    args = ap.parse_args()

    sys.path.insert(0, os.path.abspath(args.dump_spc_dir))
    import dump_spc as ds  # noqa: E402  (sibling repo)

    proto = open(args.proto, "rb").read()
    retail = open(args.rom, "rb").read()
    if len(retail) % 0x8000 == 0x200:
        retail = retail[0x200:]
    if len(proto) != CHIP[1] - CHIP[0]:
        sys.exit("expected a 512 KB chip dump, got %d bytes" % len(proto))
    b = Builder(ds, proto, retail)
    base, base_notes = b.convert(0, 0)
    gme = None if args.no_wav and not args.verify else ds.load_gme()

    if args.verify:
        for fi in (0, 0x11, 0x32):
            ok = [bytes(x[1]) for x in b.rebuild_retail(fi)] == [bytes(x[1]) for x in ds.package_records(retail, fi)]
            print("rule check  retail package $%02X rebuilt from the pointer rules: %s" % (fi, "identical" if ok else "DIFFERENT"))
        if gme:
            for pi, fi in CONTROLS:
                recs, _ = b.convert(pi, fi)
                c = envelope_correlation(ds, gme, b.spc(fi, recs, base, "p"), b.spc(fi, None, None, "r"))
                print("control     prototype $%02X converted vs retail $%02X: envelope correlation %.2f" % (pi, fi, c))

    os.makedirs(args.out_dir, exist_ok=True)
    for pi, fi, name in SONGS:
        records, notes = b.convert(pi, fi)
        stem = "%02X %s (prototype)" % (fi, name.replace("!", ""))
        versions = [(stem, b.spc(fi, records, base, name + " (proto)"))]
        if args.retail:
            versions.append((stem.replace("(prototype)", "(retail)"), b.spc(fi, None, None, name)))
        for out_stem, spc in versions:
            with open(os.path.join(args.out_dir, out_stem + ".spc"), "wb") as fh:
                fh.write(spc)
            if gme and not args.no_wav:
                pcm = ds.render(gme, spc, args.duration, args.fade)
                ds.write_wav(os.path.join(args.out_dir, out_stem + ".wav"), pcm)
        print("wrote %-42s %s" % (stem, "; ".join(notes)))


if __name__ == "__main__":
    main()
