// Ownership: the Code tab's listings as HTML, pure (text in, markup out): a routine's lines.json as rows
// (address, bytes, how often it ran, instruction, comment and what it touched) whose calls link to the
// routines they call and whose branches inside the routine jump to their line; a .c file with every
// known routine name linked and comments dimmed; an entry's Markdown body. Takes the lookups as arguments, reads no state.

/** What the listings link to: routine names. */
interface Known { names: Set<string> }

const esc = (s: unknown): string => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
const link = (name: string, text = name): string => '<a class="code-link" data-code-go="' + esc(name) + '">' + esc(text) + '</a>';

/** One instruction of lines.json (resources/code-lines.ts), as far as the listing draws it. */
interface Touch { name: string; addr: string; count: number; access: string; title?: string }
interface Line {
    addr: string; bytes: string; text: string; named: string; comment?: string; call?: string;
    operand?: { addr: string; name: string; title?: string };
    cdl?: { hits: number; m8: boolean; x8: boolean; db: string[]; d: string[]; touched: Touch[]; more: number };
}
interface Lines { cdl: { ran: number; of: number } | null; lines: Line[] }

const TARGET = /\$([0-9A-F]{6})\b/;
const WORD = /[A-Za-z_][A-Za-z0-9_]*/g;

/** `text` with every known routine name in it linked. */
function linkNames(text: string, known: Known): string {
    let out = '', at = 0;
    for (const m of text.matchAll(WORD)) {
        if (!known.names.has(m[0])) continue;
        out += esc(text.slice(at, m.index)) + link(m[0]);
        at = (m.index as number) + m[0].length;
    }
    return out + esc(text.slice(at));
}

/** 11227 -> `11.2k`. */
const count = (n: number): string => (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(n >= 1e5 ? 0 : 1) + 'k' : String(n));

/** The hits cell: how often the line ran, its tooltip the widths and registers it ran with. */
function hitsCell(c: NonNullable<Line['cdl']>): string {
    const why = [c.hits ? 'ran ' + c.hits.toLocaleString('en') + ' times' : 'never ran while recorded',
        c.m8 ? 'A 8-bit' : '', c.x8 ? 'X/Y 8-bit' : '', c.db.length ? 'DB ' + c.db.join(', ') : '', c.d.length ? 'D ' + c.d.join(', ') : ''].filter(Boolean);
    return '<td class="code-hits" title="' + esc(why.join(' · ')) + '">' + (c.hits ? count(c.hits) : '·') + '</td>';
}

/** What the line touched while recorded, after its comment: `→ read Current HP · write ENTITY ×3 (+40 more)`. */
function touchedHtml(c: NonNullable<Line['cdl']>, known: Known): string {
    if (!c.touched.length) return '';
    const parts = c.touched.map((t) => '<span title="' + esc((t.title ? t.title + '\n' : '') + t.addr + (t.count > 1 ? ' … (' + t.count + ' addresses)' : '')) + '">' +
        (t.access ? esc(t.access) + ' ' : '') + linkNames(t.name, known) + (t.count > 1 ? ' ×' + t.count : '') + '</span>');
    return '<span class="code-touched">→ ' + parts.join(' · ') + (c.more ? ' (+' + c.more + ' more)' : '') + '</span>';
}

/**
 * A routine's lines (lines.json) as table rows. `names`: operands by name, how often each line ran and what it
 * touched (CDL), lines that never ran dimmed; off: the plain code with its comments. `bytes` shows each instruction's bytes.
 */
function asmHtml(data: Lines, known: Known, opts: { bytes: boolean; names: boolean }): string {
    const at = (l: Line): string => l.addr.slice(1);
    const here = new Set(data.lines.map(at));
    /** The line a branch on `l` goes to inside the routine (branch operands are never named). */
    const jump = (l: Line): RegExpExecArray | null => { const t = l.call ? null : TARGET.exec(l.text); return t && here.has(t[1]) && t[1] !== at(l) ? t : null; };
    const targets = new Set(data.lines.map((l) => jump(l)?.[1]).filter(Boolean));
    const cdl = opts.names && !!data.cdl;
    const rows = data.lines.map((l) => {
        const ins = opts.names ? l.named : l.text, t = jump(l);
        let insHtml = esc(ins);
        if (l.call && known.names.has(l.call)) insHtml = link(l.call, ins);
        else if (t) insHtml = esc(ins.slice(0, t.index)) + '<a class="code-jump" data-code-line="' + t[1] + '">' + esc(t[0]) + '</a>' + esc(ins.slice(t.index + t[0].length));
        else if (opts.names && l.operand) {
            const i = ins.indexOf(l.operand.name);
            insHtml = esc(ins.slice(0, i)) + '<span class="code-name" title="' + esc(l.operand.addr + (l.operand.title ? ' — ' + l.operand.title : '')) + '">' +
                linkNames(l.operand.name, known) + '</span>' + esc(ins.slice(i + l.operand.name.length));
        }
        const note = opts.names ? l.comment || '' : l.comment || l.call || '';
        const cls = [targets.has(at(l)) ? 'code-target' : '', cdl && l.cdl && !l.cdl.hits ? 'code-cold' : ''].filter(Boolean).join(' ');
        return '<tr data-code-at="' + at(l) + '"' + (cls ? ' class="' + cls + '"' : '') + '>' +
            '<td class="code-addr">' + at(l) + '</td><td class="code-bytes">' + esc(l.bytes) + '</td>' +
            (cdl ? (l.cdl ? hitsCell(l.cdl) : '<td class="code-hits"></td>') : '') +
            '<td class="code-ins">' + insHtml + '</td><td class="code-note">' + linkNames(note, known) +
            (cdl && l.cdl ? (note ? ' ' : '') + touchedHtml(l.cdl, known) : '') + '</td></tr>';
    });
    return '<table class="code-asm' + (opts.bytes ? '' : ' code-nobytes') + '">' + rows.join('') + '</table>';
}

/** A .c file: names linked, comments dimmed (`//` and `/* … *\/`, one scan over the lines). */
function cHtml(text: string, known: Known): string {
    let inBlock = false;
    const lines = text.replace(/\n$/, '').split('\n').map((line) => {
        let out = '', rest = line;
        while (rest) {
            if (inBlock) {
                const end = rest.indexOf('*/');
                const part = end < 0 ? rest : rest.slice(0, end + 2);
                out += '<span class="code-cmt">' + esc(part) + '</span>';
                rest = end < 0 ? '' : rest.slice(end + 2);
                inBlock = end < 0;
                continue;
            }
            const line_ = rest.indexOf('//'), block = rest.indexOf('/*');
            const at = [line_, block].filter((i) => i >= 0).sort((a, b) => a - b)[0];
            if (at === undefined) { out += linkNames(rest, known); break; }
            out += linkNames(rest.slice(0, at), known);
            if (at === line_) { out += '<span class="code-cmt">' + esc(rest.slice(at)) + '</span>'; break; }
            rest = rest.slice(at);
            inBlock = true;
        }
        return out;
    });
    return '<pre class="code-c">' + lines.join('\n') + '</pre>';
}

/** A knowledge entry's Markdown body, small: paragraphs, `- ` lists, `code`, links (a soe://rom/code/<name>/ link opens that routine). */
function mdHtml(text: string, known: Known): string {
    const inline = (s: string): string => esc(s)
        .replace(/`([^`]+)`/g, (_, c: string) => '<code>' + c + '</code>')
        .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (all, label: string, href: string) => {
            const m = /^soe:\/\/rom\/code\/([A-Za-z0-9_]+)/.exec(href);
            return m && known.names.has(m[1]) ? '<a class="code-link" data-code-go="' + m[1] + '">' + label + '</a>' : label;
        });
    return text.split(/\n{2,}/).filter((b) => b.trim()).map((block) => {
        const lines = block.split('\n');
        if (lines.every((l) => /^\s*[-*] /.test(l))) return '<ul>' + lines.map((l) => '<li>' + inline(l.replace(/^\s*[-*] /, '')) + '</li>').join('') + '</ul>';
        const h = /^(#{1,6}) (.*)$/.exec(lines[0]);
        if (h && lines.length === 1) return '<div class="code-md-h">' + inline(h[2]) + '</div>';
        return '<p>' + lines.map(inline).join(' ') + '</p>';
    }).join('');
}

export type { Known, Lines };
export { asmHtml, cHtml, mdHtml, esc };
