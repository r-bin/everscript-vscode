// Numbers as fixed-width hexadecimal, the one formatter for the host code (docs/cleanup.md 5.1).
// No prefix: callers add `$` (SNES addresses), `0x` (ids) or nothing.

/** Upper-case digits, padded to `digits` (the docs' and the emulator's style: `8CD0A6`). */
export function hex(value: number, digits = 2): string {
    return (value >>> 0).toString(16).toUpperCase().padStart(digits, '0');
}

/** Lower-case digits, padded to `digits` (VFS paths and the script notation: `8cd0a6`). */
export function hexLower(value: number, digits = 2): string {
    return (value >>> 0).toString(16).padStart(digits, '0');
}
