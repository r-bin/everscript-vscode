'use strict';
// Ownership: `soe://bus/` — the 24-bit SNES CPU bus as a router. It holds no
// data: each address names the canonical file under `soe://ram/` or
// `soe://rom/`, and the provider serves that file marked as a link to it.
//
//   soe://bus/7e2441          = soe://bus/7e2441.json → soe://ram/2441.json
//   soe://bus/7e2258.0.json   → soe://ram/2258.0.json
//   soe://bus/c4601f[20].bin  → soe://rom/04601f[20].bin
//   soe://bus/8cd0a6          → soe://rom/0cd0a6.json  (named function)
//
// HiROM map: $7E-$7F and the $0000-$1FFF mirror in banks $00-$3F/$80-$BF are
// WRAM; $40-$7D, $C0-$FF and the upper halves of $00-$3F/$80-$BF are ROM.
// I/O registers and SRAM are not served: some registers change when read.

const { parseAddressName, hexId } = require('../shared/resource-uri');
const { toFileOffset } = require('./rom-files');

const WRAM = 0x7E0000;

/** `{ authority, name }` of the file a bus file name stands for, or null. */
function busTarget(name) {
    const a = parseAddressName(/\.(bin|json)$/i.test(name) ? name : name + '.json');
    if (!a) return null;
    const bank = a.addr >> 16, lo = a.addr & 0xFFFF;
    const mirrored = (bank & 0x40) === 0;
    if (a.len !== null && mirrored && lo + a.len > 0x10000) return null;  // would leave the bank's mapping
    const suffix = (a.len !== null ? `[${a.len.toString(16)}]` : '') + (a.bit !== null ? '.' + a.bit : '') + '.' + a.ext;

    let ram = null;
    if (bank === 0x7E || bank === 0x7F) ram = a.addr - WRAM;
    else if (mirrored && lo < 0x2000) ram = lo;
    if (ram !== null) return { authority: 'ram', name: hexId(ram, ram > 0xFFFF ? 5 : 4) + suffix };

    if (a.bit !== null) return null;
    const off = toFileOffset(a.addr);
    if (off === null || (mirrored && lo < 0x8000)) return null;
    return { authority: 'rom', name: hexId(off, 6) + suffix };
}

function indexMarkdown() {
    return `# soe://bus/

The SNES CPU bus (24-bit addresses, hex). Nothing lives here: every address
links to its file under [soe://ram/](soe://ram/index.md) or [soe://rom/](soe://rom/index.md).
Without an extension an address reads as \`.json\`.

| Address | Links to |
|---|---|
| [7e0adb](7e0adb) | \`soe://ram/0adb.json\`: the current room |
| [7e2258.0.json](7e2258.0.json) | \`soe://ram/2258.0.json\`: one flag |
| [0f42](0f42) | \`soe://ram/0f42.json\`: low-WRAM mirror in bank $00 |
| [c4601f[20].bin](c4601f%5B20%5D.bin) | \`soe://rom/04601f[20].bin\` |
| [8cd0a6](8cd0a6) | \`soe://rom/0cd0a6.json\`: the script interpreter loop |

| Bus range | Memory |
|---|---|
| \`$7E0000-$7FFFFF\` | WRAM |
| \`$00-$3F\`, \`$80-$BF\` : \`$0000-$1FFF\` | WRAM mirror (first 8 KB) |
| \`$00-$3F\`, \`$80-$BF\` : \`$8000-$FFFF\` | ROM, upper halves |
| \`$40-$7D\`, \`$C0-$FF\` | ROM, whole banks |
| everything else | not served (I/O registers, SRAM) |
`;
}

module.exports = { busTarget, indexMarkdown };
