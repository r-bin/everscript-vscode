// The implode report: terminal lines and report.md (docs/open-evermore/validation.md §4). report.json is the
// Result as it is.
import type { Finding } from './findings.mts';
import type { Result } from './implode.mts';

const COLOUR: Record<Finding['severity'], string> = { error: '\x1b[31m', warning: '\x1b[33m', info: '\x1b[90m' };
const RESET = '\x1b[0m';

const line = (f: Finding): string => `${f.severity} ${f.rule} ${f.file}${f.pointer ? '#' + f.pointer : ''}: ${f.message}`;

function summary(r: Result): string {
    const n = (s: Finding['severity']) => r.findings.count(s);
    return `${n('error')} errors, ${n('warning')} warnings, ${n('info')} notes`;
}

export function terminal(dir: string, r: Result, checkOnly: boolean): string {
    const tty = process.stdout.isTTY;
    const out = r.findings.list.map(f => (tty ? COLOUR[f.severity] : '') + line(f) + (tty ? RESET : ''));
    for (const s of r.stats) out.push(`  ${s.kind.padEnd(10)} ${String(s.files).padStart(5)} files ${String(s.bytes).padStart(9)} bytes${s.changed ? '  changed' : ''}`);
    const built = r.image ? `ROM ${dir}/_build/evermore.sfc, sha1 ${r.sha1}` : checkOnly ? 'checked only, no ROM' : 'no ROM written';
    out.push(`${summary(r)}; ${built}`);
    return out.join('\n');
}

export function markdown(dir: string, r: Result): string {
    const rows = r.findings.list.map(f => `| ${f.severity} | \`${f.rule}\` | \`${f.file}${f.pointer ? '#' + f.pointer : ''}\` | ${f.message.replace(/\|/g, '\\|')} |`);
    const kinds = r.stats.map(s => `| ${s.kind} | ${s.files} | ${s.bytes} | ${s.changed ? 'yes' : 'no'} |`);
    return [
        `# Implode report`, '',
        `Tree: \`${dir}\`. ${summary(r)}. ${r.image ? `ROM: \`_build/evermore.sfc\`, sha1 \`${r.sha1}\`.` : 'No ROM written.'}`, '',
        `## Kinds`, '', '| Kind | Files | Bytes written | Changed |', '|---|---|---|---|', ...kinds, '',
        `## Findings`, '', ...(rows.length ? ['| Severity | Rule | Where | Message |', '|---|---|---|---|', ...rows] : ['None.']), '',
    ].join('\n');
}
