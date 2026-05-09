#!/usr/bin/env python3
"""
snes9x_wram.py — macOS Snes9x WRAM reader prototype

Uses Mach VM APIs to read the WRAM buffer from a running Snes9x process.

Why not mach_vm_region_recurse?
────────────────────────────────
mach_vm_region_recurse requires VM_REGION_SUBMAP_SHORT_INFO_COUNT_64 which
equals sizeof(struct)/4 and varies between macOS versions. Getting it wrong
causes a bus error. This script uses `vmmap` subprocess instead — no struct.

Why mach_vm_read_overwrite instead of mach_vm_read?
────────────────────────────────────────────────────
mach_vm_read returns a vm_offset_t (integer) pointing into newly-allocated
memory. Accessing it via ctypes.string_at can bus-error if the address is
outside the range ctypes expects. mach_vm_read_overwrite writes into a
pre-allocated ctypes array — no pointer arithmetic needed.

Permissions:  sudo python3 tools/snes9x_wram.py --dump

Usage
─────
  sudo python3 tools/snes9x_wram.py --dump
  sudo python3 tools/snes9x_wram.py --addr 0x22d8
  sudo python3 tools/snes9x_wram.py --addr 0x22d8 --watch
  sudo python3 tools/snes9x_wram.py --wram-base 0x10f800000 --addr 0x22d8
  sudo python3 tools/snes9x_wram.py --sentinel-addr 0x0000 --sentinel-byte 0xXX

VS Code integration:
  const child = spawn('python3', ['tools/snes9x_wram.py', '--json', '--addr', '0x22d8']);
  JSON output per line: {"addr":"0x22D8","byte":3,"word":259}
"""

import ctypes
import ctypes.util
import subprocess
import sys
import re
import struct
import time
import json
import argparse

# ── Mach types ────────────────────────────────────────────────────────────────

libc_name = ctypes.util.find_library('c')
if not libc_name:
    sys.exit("Could not find libc. Are you on macOS?")
libc = ctypes.CDLL(libc_name, use_errno=True)

kern_return_t = ctypes.c_int
mach_port_t   = ctypes.c_uint
vm_address_t  = ctypes.c_uint64
vm_size_t     = ctypes.c_uint64

KERN_SUCCESS = 0
WRAM_SIZE    = 0x20000  # 128 KB

libc.mach_task_self_.restype = mach_port_t

libc.task_for_pid.restype  = kern_return_t
libc.task_for_pid.argtypes = [mach_port_t, ctypes.c_int, ctypes.POINTER(mach_port_t)]

# mach_vm_read_overwrite: reads target task memory into a caller-provided buffer.
# Avoids the ctypes pointer aliasing issue of mach_vm_read.
libc.mach_vm_read_overwrite.restype  = kern_return_t
libc.mach_vm_read_overwrite.argtypes = [
    mach_port_t, vm_address_t, vm_size_t,
    vm_address_t, ctypes.POINTER(vm_size_t),
]


# ── Helpers ───────────────────────────────────────────────────────────────────

def find_snes9x_pid() -> int:
    result = subprocess.run(['pgrep', '-i', 'snes9x'], capture_output=True, text=True)
    pids = [int(p) for p in result.stdout.strip().split() if p.isdigit()]
    if not pids:
        raise RuntimeError("Snes9x is not running (pgrep returned nothing).")
    return pids[0]


def get_task(pid: int) -> mach_port_t:
    task = mach_port_t(0)
    ret  = libc.task_for_pid(libc.mach_task_self_(), pid, ctypes.byref(task))
    if ret != KERN_SUCCESS:
        raise PermissionError(
            f"task_for_pid failed (kern_return_t={ret}).\n"
            "Run with: sudo python3 tools/snes9x_wram.py\n"
            "Or ensure Snes9x has the get-task-allow entitlement."
        )
    return task


def vm_read(task: mach_port_t, addr: int, size: int) -> bytes | None:
    """Read `size` bytes from `addr` in `task` into a local pre-allocated buffer."""
    buf      = (ctypes.c_uint8 * size)()
    out_size = vm_size_t(0)
    ret = libc.mach_vm_read_overwrite(
        task,
        vm_address_t(addr),
        vm_size_t(size),
        vm_address_t(ctypes.addressof(buf)),
        ctypes.byref(out_size),
    )
    if ret != KERN_SUCCESS or out_size.value < size:
        return None
    return bytes(buf)


def vmmap_find_candidates(pid: int) -> list[int]:
    """
    Run `vmmap -v <pid>` and return base addresses of all rw regions of
    exactly WRAM_SIZE (0x20000 = 128 KB).

    vmmap does not require task_for_pid permission for reading region info.
    However it may produce incomplete output without sudo on hardened processes.
    """
    try:
        result = subprocess.run(
            ['vmmap', '-v', str(pid)],
            capture_output=True, text=True, timeout=15,
        )
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return []

    candidates = []
    for line in result.stdout.split('\n'):
        m = re.search(r'([0-9a-f]{6,16})-([0-9a-f]{6,16})\s+\[', line, re.IGNORECASE)
        if not m:
            continue
        start = int(m.group(1), 16)
        end   = int(m.group(2), 16)
        if end - start != WRAM_SIZE:
            continue
        # Permission field is right after the bracketed size block
        perm_m = re.search(r'\]\s+(\S+)', line)
        if perm_m and re.match(r'rw', perm_m.group(1), re.IGNORECASE):
            candidates.append(start)
    return candidates


def scan_for_wram(
    task: mach_port_t,
    pid: int,
    sentinel_addr: int | None = None,
    sentinel_byte: int | None = None,
    verbose: bool = True,
) -> int | None:
    if verbose:
        print("Scanning with vmmap...", flush=True)
    candidates = vmmap_find_candidates(pid)

    if not candidates:
        if verbose:
            print("vmmap found no 128 KB rw regions. "
                  "Try sudo or supply --wram-base.", flush=True)
        return None

    if verbose:
        print(f"vmmap found {len(candidates)} candidate(s):", flush=True)

    readable = []
    for base in candidates:
        probe = vm_read(task, base, 16)
        if probe is None:
            if verbose:
                print(f"  0x{base:016x} — not readable via mach_vm_read_overwrite (skip)", flush=True)
            continue
        if verbose:
            print(f"  0x{base:016x} — readable, first 16 bytes: {probe.hex()}", flush=True)
        readable.append(base)

    if not readable:
        if verbose:
            print("No readable candidates. Ensure you ran with sudo.", flush=True)
        return None

    if sentinel_addr is not None and sentinel_byte is not None:
        for base in readable:
            buf = vm_read(task, base, WRAM_SIZE)
            if buf and buf[sentinel_addr] == sentinel_byte:
                if verbose:
                    print(f"Sentinel matched at 0x{base:016x}", flush=True)
                return base
        if verbose:
            print("No candidate matched sentinel.", flush=True)
        return None

    if len(readable) == 1:
        return readable[0]

    if verbose:
        print("Multiple candidates — use --sentinel-addr/--sentinel-byte or --wram-base.", flush=True)
    return readable[0]  # best-effort


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(
        description="Read live WRAM from a running Snes9x process (macOS).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    ap.add_argument('--addr', type=lambda x: int(x, 16), default=None,
                    help="16-bit WRAM address to read (e.g. 0x22d8)")
    ap.add_argument('--wram-base', type=lambda x: int(x, 16), default=None,
                    help="Known WRAM buffer address (skip auto-scan)")
    ap.add_argument('--sentinel-addr', type=lambda x: int(x, 16), default=None,
                    help="WRAM offset of a known byte (for disambiguation)")
    ap.add_argument('--sentinel-byte', type=lambda x: int(x, 16), default=None,
                    help="Expected value at --sentinel-addr")
    ap.add_argument('--watch', action='store_true',
                    help="Poll continuously every 0.5 s")
    ap.add_argument('--json', action='store_true',
                    help="Output JSON lines (for VS Code extension)")
    ap.add_argument('--dump', action='store_true',
                    help="Hex-dump first 256 bytes of WRAM")
    args = ap.parse_args()

    quiet = args.json

    pid = find_snes9x_pid()
    if not quiet:
        print(f"Snes9x PID: {pid}", flush=True)

    task = get_task(pid)
    if not quiet:
        print(f"Task port: {task.value}", flush=True)

    if args.wram_base is not None:
        wram_base = args.wram_base
        if not quiet:
            print(f"Using supplied WRAM base: 0x{wram_base:016x}", flush=True)
    else:
        wram_base = scan_for_wram(
            task, pid,
            sentinel_addr=args.sentinel_addr,
            sentinel_byte=args.sentinel_byte,
            verbose=not quiet,
        )
        if wram_base is None:
            msg = (
                "WRAM buffer not found automatically.\n"
                "Tip 1: Open Snes9x → View → Memory Viewer → Work RAM, note a byte value,\n"
                "       then pass --sentinel-addr 0xXXXX --sentinel-byte 0xYY\n"
                "Tip 2: Attach lldb to Snes9x, find a 128 KB anonymous rw region,\n"
                "       then pass --wram-base <addr>"
            )
            if args.json:
                print(json.dumps({"error": msg}), flush=True)
            else:
                sys.exit(msg)
            return

    if not quiet:
        print(f"WRAM base: 0x{wram_base:016x}", flush=True)

    while True:
        buf = vm_read(task, wram_base, WRAM_SIZE)
        if buf is None:
            msg = "Failed to read WRAM."
            if args.json:
                print(json.dumps({"error": msg}), flush=True)
            else:
                print(msg, flush=True)
        elif args.addr is not None:
            val8  = buf[args.addr]
            val16 = struct.unpack_from('<H', buf, args.addr)[0]
            if args.json:
                print(json.dumps({
                    "addr": f"0x{args.addr:04X}",
                    "byte": val8,
                    "word": val16,
                }), flush=True)
            else:
                print(f"  0x{args.addr:04X}: byte=0x{val8:02X} ({val8:3d})"
                      f"  word=0x{val16:04X} ({val16})", flush=True)
        elif args.dump:
            for row in range(0, 256, 16):
                hex_part = ' '.join(f'{buf[row+c]:02X}' for c in range(16))
                print(f"  {row:04X}: {hex_part}", flush=True)
        else:
            for off in range(0, WRAM_SIZE - 1, 2):
                v = struct.unpack_from('<H', buf, off)[0]
                if v:
                    print(f"  0x{off:04X} = 0x{v:04X} ({v})", flush=True)

        if not args.watch:
            break
        time.sleep(0.5)


if __name__ == '__main__':
    main()
