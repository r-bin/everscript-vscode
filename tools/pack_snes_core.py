#!/usr/bin/env python3
"""
pack_snes_core.py  —  Package a custom snes9x2005-wasm build into an
EmulatorJS-compatible SNES core bundle (.data, 7-zip format).

The .data bundle is a 7-zip archive containing exactly:
  snes9x_libretro.js     — the emscripten JS glue file
  snes9x_libretro.wasm   — the WebAssembly binary
  build.json             — minimum EJS version / bundle version
  core.json              — core metadata (name, extensions, save ext…)
  license.txt            — (optional) licence text

Usage
-----
  python3 tools/pack_snes_core.py \\
      --js   tmp/snes9x2005-wasm/snes9x_2005.js \\
      --wasm tmp/snes9x2005-wasm/snes9x_2005.wasm \\
      --out  tmp/custom-snes9x.data

  # Let the script auto-find the files from the default docker output:
  python3 tools/pack_snes_core.py

Options
-------
  --js    PATH     Path to snes9x_2005.js   (default: tmp/docker/snes9x_2005.js)
  --wasm  PATH     Path to snes9x_2005.wasm (default: tmp/docker/snes9x_2005.wasm)
  --out   PATH     Output .data bundle      (default: tmp/custom-snes9x.data)
  --label TEXT     Short label stored in core.json (default: snes9x-custom)
  --version TEXT   Bundle version string    (default: 0.0.1)
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

# ── defaults ──────────────────────────────────────────────────────────────────

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_JS   = REPO_ROOT / "tmp" / "docker" / "snes9x_2005.js"
DEFAULT_WASM = REPO_ROOT / "tmp" / "docker" / "snes9x_2005.wasm"
DEFAULT_OUT  = REPO_ROOT / "tmp" / "custom-snes9x.data"

BUILD_JSON = {
    "minimumEJSVersion": "4.2.2",
    "version": None,   # filled at runtime
}

CORE_JSON = {
    "name": None,      # filled at runtime
    "extensions": ["smc", "sfc", "swc", "fig", "bs", "st"],
    "makeoptions": {"buildpath": "./libretro", "makescript": "Makefile", "arguments": []},
    "options": {},
    "save": "srm",
    "license": "LICENSE",
    "repo": "https://github.com/lrusso/snes9x2005-wasm",
}

LICENSE_TEXT = (
    "snes9x  Copyright (C) 1996-2006, 2007-2010 Gary Henderson, Jerremy Koot, "
    "Simon Booth, et al.\n"
    "Emscripten port: lrusso  (https://github.com/lrusso/snes9x2005-wasm)\n"
    "Licensed under the snes9x licence — see upstream source for full text.\n"
)

# ── helpers ───────────────────────────────────────────────────────────────────

def require_7z():
    if shutil.which("7z") is None and shutil.which("7za") is None:
        sys.exit("ERROR: 7z / 7za not found on PATH. Install p7zip: brew install p7zip")
    return shutil.which("7z") or shutil.which("7za")


def pack(seven_z, files: dict, out: Path):
    """
    files  — dict of {archive_name: Path}
    Creates a 7-zip archive at `out`.
    """
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.exists():
        out.unlink()

    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        # Write all files into temp dir with their final names
        for arc_name, src in files.items():
            dest = tmp / arc_name
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dest)

        # Pack with 7z using LZMA2 at a moderate compression level
        cmd = [
            seven_z, "a",
            "-t7z",        # 7-zip container
            "-m0=lzma2",   # LZMA2 method
            "-mx=5",       # compression level 5 (fast enough)
            "-mmt=4",      # 4 threads
            str(out),
            str(tmp / "*"),
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(result.stdout)
            print(result.stderr)
            sys.exit(f"ERROR: 7z failed (exit {result.returncode})")

# ── main ──────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(
        description="Pack a snes9x2005-wasm build into an EmulatorJS .data bundle",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    ap.add_argument("--js",      type=Path, default=DEFAULT_JS)
    ap.add_argument("--wasm",    type=Path, default=DEFAULT_WASM)
    ap.add_argument("--out",     type=Path, default=DEFAULT_OUT)
    ap.add_argument("--label",   default="snes9x-custom")
    ap.add_argument("--version", default="0.0.1")
    args = ap.parse_args()

    # ── sanity checks ──────────────────────────────────────────────────────
    for name, p in [("--js", args.js), ("--wasm", args.wasm)]:
        if not p.exists():
            sys.exit(f"ERROR: {name} file not found: {p}")

    seven_z = require_7z()

    # ── build metadata files in a temp dir ────────────────────────────────
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)

        build_json_path = tmp / "build.json"
        core_json_path  = tmp / "core.json"
        license_path    = tmp / "license.txt"

        bj = dict(BUILD_JSON)
        bj["version"] = args.version
        build_json_path.write_text(json.dumps(bj, separators=(",", ":")))

        cj = dict(CORE_JSON)
        cj["name"] = args.label
        core_json_path.write_text(json.dumps(cj, separators=(",", ":")))

        license_path.write_text(LICENSE_TEXT)

        files = {
            "snes9x_libretro.js":   args.js,
            "snes9x_libretro.wasm": args.wasm,
            "build.json":           build_json_path,
            "core.json":            core_json_path,
            "license.txt":          license_path,
        }

        print(f"Packing {args.js.name} + {args.wasm.name} → {args.out}")
        print(f"  label={args.label}  version={args.version}")
        pack(seven_z, files, args.out)

    # ── verify ────────────────────────────────────────────────────────────
    if not args.out.exists():
        sys.exit("ERROR: output file was not created")

    size_kb = args.out.stat().st_size / 1024
    print(f"\nBundle created: {args.out}")
    print(f"  Size: {size_kb:.1f} KB")
    print()
    print("To use this bundle:")
    print(f'  Set everscript.snesCorePath to "{args.out}"')
    print()

    # Verify the archive is readable
    result = subprocess.run([seven_z, "l", str(args.out)], capture_output=True, text=True)
    if result.returncode != 0:
        sys.exit("ERROR: output archive verification failed")

    # Print archive contents
    for line in result.stdout.splitlines():
        if any(ext in line for ext in [".js", ".wasm", ".json", ".txt"]):
            print(" ", line.strip())


if __name__ == "__main__":
    main()
