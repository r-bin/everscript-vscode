// Ownership: terra://rom/code/ — the routines we have read, by name, with the code read from the ROM at run time.
// Pure (no `vscode`): ROM bytes and path segments in, a node out.
//
//   code/index.md, index.json      every documented routine (address, title, confidence, doc) and the COP commands
//   code/<name>/info.md            what it does, where it is documented, what it calls, who calls it, WRAM, COP commands
//   code/<name>/<name>.asm         its listing, disassembled from this ROM (COP arguments decoded)

import * as terra from '../decoder';
import type { RomNode } from '../../../core/resources/rom-file-system';

const buf = (s: string): Buffer => Buffer.from(s, 'utf8');
const file = (read: () => Buffer): RomNode => ({ kind: 'file', read });
const hex = (v: number, w: number) => v.toString(16).toUpperCase().padStart(w, '0');

/** The node at `segments` below terra://rom/code/, or null. */
export function resolveCode(segments: string[], rom: Uint8Array): RomNode | null {
    const [name, leaf, ...rest] = segments;
    if (rest.length) return null;
    if (name === undefined) return { kind: 'dir', entries: [['index.md', 'file'], ['index.json', 'file'], ...terra.TERRA_ROUTINES.map(r => [r.name, 'dir'] as [string, 'dir'])] };
    if (name === 'index.md' && leaf === undefined) return file(() => buf(codeIndex()));
    if (name === 'index.json' && leaf === undefined) {
        return file(() => buf(JSON.stringify({ copTable: terra.COP_TABLE, cops: terra.COP_COMMANDS, routines: terra.TERRA_ROUTINES }, null, 2) + '\n'));
    }
    const r = terra.routineByName(name);
    if (!r) return null;
    if (leaf === undefined) return { kind: 'dir', entries: [['info.md', 'file'], [r.name + '.asm', 'file']] };
    if (leaf === 'info.md') return file(() => buf(info(rom, r)));
    if (leaf === r.name + '.asm') return file(() => buf(asm(rom, r)));
    return null;
}

function codeIndex(): string {
    const cops = terra.COP_COMMANDS.map(c => `| \`$${hex(c.n, 2)}\` | ${c.args} | ${terra.busText(c.handler)} | ${c.what} |`);
    const rows = terra.TERRA_ROUTINES.map(r => `| [${r.name}](${r.name}/info.md) | ${terra.busText(r.addr)} | ${r.title} | ${r.confidence} |`);
    return '# Terranigma: routines by name\n\nThe routines we have read, with the code taken from this ROM. Facts and evidence: '
        + 'docs/terra/README.md §7, docs/terra/jumping.md. Data: [index.json](index.json).\n\n'
        + `## COP commands\n\nCharacter scripts are 65816 code with \`COP n\` commands; \`n\` indexes the word table at ${terra.busText(terra.COP_TABLE)} `
        + '(bank $80), and the bytes after it are the command\'s arguments. Only these are decoded:\n\n'
        + '| n | argument bytes | handler | what |\n|---|---|---|---|\n' + cops.join('\n')
        + '\n\n## Routines\n\n| name | address | what | confidence |\n|---|---|---|---|\n' + rows.join('\n') + '\n';
}

function info(rom: Uint8Array, r: terra.TerraRoutine): string {
    const refs = terra.routineRefs(rom, r), callers = terra.routineCallers(rom, r.name);
    const list = (xs: string[]) => xs.length ? xs.join(', ') : '—';
    const lines = [
        `# ${r.name}`, '', `**${r.title}** — ${terra.busText(r.addr)}–${terra.busText(r.addr + r.len - 1)} (${r.kind === 'data' ? 'data' : 'code'}, ${r.confidence})`, '',
        r.what, '', `Documented in \`docs/terra/${r.doc}\` (the repository). Listing: [${r.name}.asm](${r.name}.asm).`, '',
    ];
    if (r.kind !== 'data') {
        lines.push('| | |', '|---|---|',
            `| calls | ${list(refs.calls.map(n => `[${n}](../${n}/info.md)`))} |`,
            `| other targets | ${list(refs.targets.map(terra.busText))} |`,
            `| called by (documented routines) | ${list(callers.map(n => `[${n}](../${n}/info.md)`))} |`,
            `| WRAM | ${list(refs.wram.map(a => '`$' + hex(a >> 16, 2) + ':' + hex(a & 0xFFFF, 4) + '`'))} |`,
            `| record fields (X = the record) | ${list(refs.fields.map(f => '`' + f + '`'))} |`,
            `| COP commands | ${list(refs.cops.map(n => '`$' + hex(n, 2) + '`'))} |`, '');
    }
    return lines.join('\n');
}

function asm(rom: Uint8Array, r: terra.TerraRoutine): string {
    const head = `; ${r.name} — ${r.title}\n; ${terra.busText(r.addr)}–${terra.busText(r.addr + r.len - 1)}, read from this ROM; docs/terra/${r.doc}\n`;
    return head + terra.disassembleRoutine(rom, r).map(l => {
        const bytes = l.bytes.map(b => hex(b, 2)).join(' ').padEnd(18);
        return `${terra.busText(l.addr)}  ${bytes}  ${l.text.padEnd(24)}${l.note ? ' ; ' + l.note : ''}`.trimEnd();
    }).join('\n') + '\n';
}
