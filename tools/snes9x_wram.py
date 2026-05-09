#!/usr/bin/env python3
"""
snes9x_wram.py — macOS Snes9x WRAM reader prototype

Uses Mach VM APIs (same as Cheat Engine / scanmem) to read the WRAM buffer
from a running Snes9x 1.63 process on macOS.

SNES WRAM is 128 KB ($7E0000–$7FFFFF in the 24-bit address space).
The extension uses 16-bit addresses (e.g. 0x22d8) which map to WRAM offset
$7E:ADDR, i.e. Snes9x_WRAM_buffer[addr].

How Snes9x lays out memory
──────────────────────────
Snes9x allocates a contiguous block for WRAM.  The block size is always
exactly 0x20000 (131072) bytes.  On macOS the base address varies per run
(ASLR), so we scan the process address space using vm_region_recurse_64 and
look for a readable/writable anonymous region of exactly that size, then
verify with a known sentinel value.

Sentinel strategy
─────────────────
Read address 0x0000 from the candidate buffer and compare against a known
value you observed in the Snes9x memory viewer (View → Memory Viewer,
type Work RAM, address 0000).  Alternatively, use a distinctive byte pattern
you know is stable for your ROM (e.g. the stack at 0x01FF == 0xFF on cold
boot, or the game's own magic values).

Permissions
───────────
On macOS, task_for_pid() requires either:
  • Running with sudo, OR
  • A code-signing entitlement: com.apple.security.get-task-allow (debug build), OR
  • Disabling SIP (not recommended).
Snes9x 1.63 already ships with the get-task-allow entitlement in its debug
builds; if you use a release build you need sudo.

Usage
─────
  # Dump first 256 bytes of WRAM:
  python tools/snes9x_wram.py

  # Read specific address (byte + word):
  python tools/snes9x_wram.py --addr 0x22d8

  # Poll 0x22d8 every 0.5 s:
  python tools/snes9x_wram.py --addr 0x22d8 --watch

  # If auto-scan fails, supply the WRAM buffer base manually:
  python tools/snes9x_wram.py --wram-base 0x10f800000 --addr 0x22d8

VS Code integration plan
────────────────────────
Run this script as a child process from the VS Code extension:
  const child = spawn('python3', ['tools/snes9x_wram.py', '--json', '--addr', '0x22d8']);
The script prints JSON lines:  {"addr":"0x22d8","byte":3,"word":259}
The extension reads stdout and overlays the live value in the radar grid/popup.
"""

import ctypes
import ctypes.util
import subprocess
import sys
import struct
import time
import json
import argparse

# ── Mach types ────────────────────────────────────────────────────────────────

libc_name = ctypes.util.find_library('c')
if not libc_name:
    sys.exit("Could not find libc. Are you on macOS?")
libc = ctypes.CDLL(libc_name, use_errno=True)

kern_return_t     = ctypes.c_int
mach_port_t       = ctypes.c_uint
vm_address_t      = ctypes.c_uint64
vm_size_t         = ctypes.c_uint64
vm_offset_t       = ctypes.c_uint64
natural_t         = ctypes.c_uint
mach_msg_type_number_t = ctypes.c_uint

KERN_SUCCESS      = 0
WRAM_SIZE         = 0x20000  # 128 KB

VM_PROT_READ      = 1
VM_PROT_WRITE     = 2
VM_REGION_SUBMAP_SHORT_INFO_COUNT_64 = 9


class vm_region_submap_short_info_64(ctypes.Structure):
    _fields_ = [
        ("protection",       ctypes.c_int),
        ("max_protection",   ctypes.c_int),
        ("inheritance",      ctypes.c_uint),
        ("offset",           ctypes.c_uint64),
        ("user_tag",         ctypes.c_uint),
        ("ref_count",        ctypes.c_uint),
        ("shadow_depth",     ctypes.c_ushort),
        ("external_pager",   ctypes.c_ubyte),
        ("share_mode",       ctypes.c_ubyte),
        ("is_submap",        ctypes.c_int),
        ("behavior",         ctypes.c_int),
        ("object_id",        ctypes.c_uint),
        ("user_wired_count", ctypes.c_ushort),
    ]


# mach_task_self_
libc.mach_task_self_.restype = mach_port_t

# task_for_pid(mach_task_self(), pid, &task)
libc.task_for_pid.restype  = kern_return_t
libc.task_for_pid.argtypes = [mach_port_t, ctypes.c_int, ctypes.POINTER(mach_port_t)]

# mach_vm_read(task, address, size, &data, &data_size)
libc.mach_vm_read.restype  = kern_return_t
libc.mach_vm_read.argtypes = [
    mach_port_t, vm_address_t, vm_size_t,
    ctypes.POINTER(vm_offset_t), ctypes.POINTER(mach_msg_type_number_t),
]

# mach_vm_region_recurse(task, &addr, &size, &depth, &info, &info_count)
libc.mach_vm_region_recurse.restype  = kern_return_t
libc.mach_vm_region_recurse.argtypes = [
    mach_port_t,
    ctypes.POINTER(vm_address_t),
    ctypes.POINTER(vm_size_t),
    ctypes.POINTER(natural_t),
    ctypes.POINTER(vm_region_submap_short_info_64),
    ctypes.POINTER(mach_msg_type_number_t),
]

# mach_vm_deallocate(task, addr, size) — release memory returned by mach_vm_read
libc.mach_vm_deallocate.restype  = kern_return_t
libc.mach_vm_deallocate.argtypes = [mach_port_t, vm_address_t, vm_size_t]


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
            f"task_for_pid failed (code {ret}). "
            "Try: sudo python tools/snes9x_wram.py\n"
            "Or run Snes9x with a debug entitlement (get-task-allow)."
        )
    return task


def vm_read(task: mach_port_t, addr: int, size: int) -> bytes | None:
    data_ptr  = vm_offset_t(0)
    data_size = mach_msg_type_number_t(0)
    ret = libc.mach_vm_read(task, vm_address_t(addr), vm_size_t(size),
                             ctypes.byref(data_ptr), ctypes.byref(data_size))
    if ret != KERN_SUCCESS or data_size.value < size:
        return None
    raw = bytes(ctypes.string_at(data_ptr.value, data_size.value))
    libc.mach_vm_deallocate(libc.mach_task_self_(), data_ptr, vm_size_t(data_size.value))
    return raw


def scan_for_wram(task: mach_port_t, sentinel_addr: int | None = None,
                  sentinel_byte: int | None = None) -> int | None:
    """
    Walk the process address space looking for a readable+writable anonymous
    region of exactly WRAM_SIZE (0x20000) bytes.

    If sentinel_addr and sentinel_byte are supplied, the candidate buffer
    is verified: buffer[sentinel_addr] must equal sentinel_byte.

    Returns the base address of the WRAM buffer in Snes9x's address space,
    or None if not found.
    """
    addr  = vm_address_t(0)
    size  = vm_size_t(0)
    depth = natural_t(1024)
    info  = vm_region_submap_short_info_64()
    count = mach_msg_type_number_t(VM_REGION_SUBMAP_SHORT_INFO_COUNT_64)

    candidates = []

    while True:
        ret = libc.mach_vm_region_recurse(
            task,
            ctypes.byref(addr), ctypes.byref(size), ctypes.byref(depth),
            ctypes.byref(info), ctypes.byref(count),
        )
        if ret != KERN_SUCCESS:
            break

        if (not info.is_submap and
                size.value == WRAM_SIZE and
                (info.protection & (VM_PROT_READ | VM_PROT_WRITE)) == (VM_PROT_READ | VM_PROT_WRITE)):
            candidates.append(addr.value)

        addr.value += size.value

    if not candidates:
        return None

    if sentinel_addr is not None and sentinel_byte is not None:
        for base in candidates:
            buf = vm_read(task, base, WRAM_SIZE)
            if buf and buf[sentinel_addr] == sentinel_byte:
                return base
        return None

    # No sentinel — return first candidate (may need manual verification)
    if len(candidates) == 1:
        return candidates[0]

    print(f"Found {len(candidates)} candidate WRAM regions: "
          + ', '.join(f'0x{c:016x}' for c in candidates))
    print("Use --sentinel-addr and --sentinel-byte to disambiguate, "
          "or --wram-base to specify directly.")
    return candidates[0]  # best-effort


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(
        description="Read live WRAM values from a running Snes9x process (macOS).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__.split("Usage")[1].split("VS Code")[0].strip(),
    )
    ap.add_argument('--addr', type=lambda x: int(x, 16), default=None,
                    help="16-bit WRAM address to read (e.g. 0x22d8)")
    ap.add_argument('--wram-base', type=lambda x: int(x, 16), default=None,
                    help="Known WRAM buffer address in Snes9x process memory")
    ap.add_argument('--sentinel-addr', type=lambda x: int(x, 16), default=None,
                    help="WRAM offset of a known byte (for auto-scan verification)")
    ap.add_argument('--sentinel-byte', type=lambda x: int(x, 16), default=None,
                    help="Expected value at --sentinel-addr")
    ap.add_argument('--watch', action='store_true',
                    help="Poll continuously every 0.5 s")
    ap.add_argument('--json', action='store_true',
                    help="Output JSON lines (for VS Code extension integration)")
    ap.add_argument('--dump', action='store_true',
                    help="Hex-dump the first 256 bytes of WRAM")
    args = ap.parse_args()

    pid = find_snes9x_pid()
    if not args.json:
        print(f"Snes9x PID: {pid}", flush=True)

    task = get_task(pid)
    if not args.json:
        print(f"Task port: {task.value}", flush=True)

    if args.wram_base is not None:
        wram_base = args.wram_base
    else:
        if not args.json:
            print("Scanning address space for WRAM buffer…", flush=True)
        wram_base = scan_for_wram(task, args.sentinel_addr, args.sentinel_byte)
        if wram_base is None:
            sys.exit(
                "WRAM buffer not found automatically.\n"
                "Tip: open Snes9x → Memory Viewer → Work RAM, note a byte value at a\n"
                "known address, then pass --sentinel-addr 0xXXXX --sentinel-byte 0xYY\n"
                "or use --wram-base <addr> with the address from a debugger."
            )

    if not args.json:
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
                    "byte": val8, "word": val16,
                }), flush=True)
            else:
                print(f"  0x{args.addr:04X}: byte=0x{val8:02X} ({val8:3d})  "
                      f"word=0x{val16:04X} ({val16})", flush=True)
        elif args.dump:
            for row in range(0, 256, 16):
                hex_part = ' '.join(f'{buf[row+c]:02X}' for c in range(16))
                print(f"  {row:04X}: {hex_part}", flush=True)
        else:
            # Compact: print all non-zero 16-bit words in WRAM
            for off in range(0, WRAM_SIZE - 1, 2):
                v = struct.unpack_from('<H', buf, off)[0]
                if v:
                    print(f"  0x{off:04X} = 0x{v:04X} ({v})", flush=True)

        if not args.watch:
            break
        time.sleep(0.5)


if __name__ == '__main__':
    main()
