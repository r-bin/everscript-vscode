// Ownership: `soe://rom/code/<address>?c=1&asm=1` — routine-level view
// showing reconstructed C and 65816 disassembly infused with centralized comments.

import * as fs from 'fs';
import * as path from 'path';
import { dir, text, type Entry } from './nodes';
import { asmListing } from './asm-view';
import { getDecompiledC } from './decomp-view';
import { FUNCTIONS, getFunction } from '../localizations/functions';
import { hiromFileOffset } from '../../../platform/snes/hirom';
import type { MapsDeps } from './map-files';

const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const h = (v: number, d: number): string => (v >>> 0).toString(16).toUpperCase().padStart(d, '0');

/** Convert input address string (bus or offset) to { bus, off }. */
function parseCodeAddress(raw: string): { bus: number; off: number } | null {
    const clean = raw.replace(/\.(md|c|asm)$/i, '').replace(/^\$/, '');
    const m = clean.match(/^([0-9A-Fa-f]{4,6})/);
    if (!m) return null;
    const val = parseInt(m[1], 16);

    if (val >= 0x800000 && val <= 0xFFFFFF) {
        return { bus: val, off: hiromFileOffset(val) };
    }
    if (val >= 0x400000 && val <= 0x7DFFFF) {
        return { bus: val, off: hiromFileOffset(val) };
    }
    // File offset or bank 00 address
    if (val < 0x400000) {
        const bus = (val & 0xFFFF) >= 0x8000 ? (0x800000 | val) : (0xC00000 + val);
        return { bus, off: val };
    }
    return { bus: val, off: hiromFileOffset(val) };
}

function listCodeEntries(): Entry[] {
    const entries: Entry[] = [['index.md', 'file']];
    const seen = new Set<string>();

    const reconDir = path.join(REPO, 'reconstructed-c');
    if (fs.existsSync(reconDir)) {
        try {
            for (const bank of fs.readdirSync(reconDir)) {
                const bankDir = path.join(reconDir, bank);
                if (!fs.statSync(bankDir).isDirectory()) continue;
                for (const file of fs.readdirSync(bankDir)) {
                    if (file.endsWith('.c')) {
                        const name = file.replace(/\.c$/, '.md');
                        if (!seen.has(name)) {
                            seen.add(name);
                            entries.push([name, 'file']);
                        }
                    }
                }
            }
        } catch {}
    }

    for (const f of FUNCTIONS) {
        const hex = (f.address >>> 0).toString(16).toUpperCase().padStart(6, '0');
        const name = `${hex}_${f.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.md`;
        if (!seen.has(name)) {
            seen.add(name);
            entries.push([name, 'file']);
        }
    }

    entries.sort((a, b) => a[0].localeCompare(b[0]));
    return entries;
}

function codeIndexMarkdown(): string {
    return `# soe://rom/code/

Routines with reconstructed C and annotated 65816 assembly.

### Usage
- \`soe://rom/code/<address>\` — Combined view (Reconstructed C and Commented ASM)
- \`soe://rom/code/<address>?c=1&asm=0\` — Reconstructed C only
- \`soe://rom/code/<address>?asm=1&c=0\` — Commented ASM only
- \`soe://rom/code/<address>?comments=0\` — Raw ASM without comment overlay

Examples:
- [reset_handler ($808020)](soe://rom/code/808020)
- [main_loop_entry ($808B66)](soe://rom/code/808B66)
- [script_dispatcher ($8CD0A6)](soe://rom/code/8CD0A6)
`;
}

function resolveCode(segments: string[], rom: Uint8Array, deps?: MapsDeps) {
    const [head, ...rest] = segments;

    if (head === undefined) {
        return dir(listCodeEntries(), () => codeIndexMarkdown());
    }

    if (head === 'index.md') {
        return text(() => codeIndexMarkdown());
    }

    const addrInfo = parseCodeAddress(head);
    if (!addrInfo || addrInfo.off >= rom.length) return null;

    const { bus, off } = addrInfo;
    const query = deps?.query ? new URLSearchParams(deps.query) : null;
    const hasC = query ? query.get('c') : null;
    const hasAsm = query ? query.get('asm') : null;
    const hasComments = query ? query.get('comments') : null;

    let showC = true;
    let showAsm = true;

    if (hasC !== null && hasAsm === null) {
        showC = hasC !== '0';
        showAsm = false;
    } else if (hasAsm !== null && hasC === null) {
        showAsm = hasAsm !== '0';
        showC = false;
    } else {
        if (hasC === '0') showC = false;
        if (hasAsm === '0') showAsm = false;
    }

    const withComments = hasComments !== '0';

    return text(() => {
        const fn = getFunction(bus) || getFunction(off | 0x800000) || getFunction(off | 0xC00000);
        const name = fn ? fn.name : `func_${h(bus, 6)}`;
        const hexAddr = h(bus, 6);

        let md = `# Routine: $${hexAddr} (${name})\n\n`;
        md += `[Combined View](soe://rom/code/${hexAddr}?asm=1&c=1) | [C Only](soe://rom/code/${hexAddr}?c=1&asm=0) | [ASM Only](soe://rom/code/${hexAddr}?asm=1&c=0)\n\n`;

        if (showC) {
            md += `## Reconstructed C\n\n`;
            const decomp = getDecompiledC(bus);
            if (decomp && decomp.code) {
                md += `\`\`\`c\n/* Source: ${decomp.source} (${decomp.path}) */\n${decomp.code}\n\`\`\`\n\n`;
            } else {
                md += `\`\`\`c\n// No reconstructed C found for address $${hexAddr}.\n\`\`\`\n\n`;
            }
        }

        if (showAsm) {
            md += `## 65816 Disassembly${withComments ? ' (Infused with Centralized Comments)' : ' (Raw)'}\n\n`;
            const asm = asmListing(rom, bus, { wantsC: false, comments: withComments });
            md += `\`\`\`assembly\n${asm}\n\`\`\`\n\n`;
        }

        if (!showC && !showAsm) {
            md += `*Both C and ASM views are toggled off via query parameters.*\n`;
        }

        return md;
    });
}

export { resolveCode, parseCodeAddress, listCodeEntries };
