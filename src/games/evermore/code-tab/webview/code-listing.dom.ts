// Ownership: the Code tab's listings as HTML, pure (text in, markup out): a routine's .asm as rows
// (address, bytes, instruction, comment) whose calls link to the routines they call and whose
// branches inside the routine jump to their line; a .c file with every known routine name linked
// and comments dimmed; an entry's Markdown body. Takes the lookups as arguments, reads no state.

/** What the listings link to: routine names, and routine names by bus address ($8x and $Cx both). */
interface Known { names: Set<string>; byAddr: Map<number, string> }

const esc = (s: unknown): string => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
const link = (name: string, text = name): string => '<a class="code-link" data-code-go="' + esc(name) + '">' + esc(text) + '</a>';

/** asm-view.ts lineText: `$808020  a9 8f 00    lda #$008F            ; note`. */
const ASM_LINE = /^\$([0-9A-F]{6}) {2}(.{12})([^;]*?)\s*(?:; (.*))?$/;
const CALL = /^(jsr|jsl|jmp|jml) \$([0-9A-F]{4}|[0-9A-F]{6})$/;
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

/** Where a call, jump or branch on line `addr` goes: its operand text and the bus address (a 4-digit call operand stays in the line's bank). */
function destination(ins: string, addr: number): { text: string; at: number; to: number } | null {
    const m = CALL.exec(ins);
    if (m) {
        const v = parseInt(m[2], 16);
        return { text: '$' + m[2], at: ins.indexOf('$'), to: m[2].length === 4 ? (addr & 0xFF0000) | v : v };
    }
    const t = TARGET.exec(ins);
    return t ? { text: t[0], at: t.index, to: parseInt(t[1], 16) } : null;
}

/** A routine's .asm as table rows; `bytes` shows each instruction's bytes. Header lines (`;`) are left out: the tab shows them. */
function asmHtml(text: string, known: Known, bytes: boolean): string {
    const rows = text.split('\n').map((l) => ASM_LINE.exec(l)).filter((m): m is RegExpExecArray => !!m);
    const here = new Set(rows.map((m) => parseInt(m[1], 16)));
    const targets = new Set<number>();
    const body = rows.map((m) => {
        const addr = parseInt(m[1], 16), ins = m[3].trim(), note = m[4] || '';
        const d = destination(ins, addr);
        const called = d && CALL.test(ins) ? known.byAddr.get(d.to) : undefined;
        let insHtml = esc(ins);
        if (called) insHtml = link(called, ins);
        else if (d && here.has(d.to) && d.to !== addr) {
            targets.add(d.to);
            insHtml = esc(ins.slice(0, d.at)) + '<a class="code-jump" data-code-line="' + d.to + '">' + esc(d.text) + '</a>' + esc(ins.slice(d.at + d.text.length));
        }
        return [addr, '<td class="code-ins">' + insHtml + '</td><td class="code-note">' + linkNames(note, known) + '</td>', m[2].trim()] as const;
    });
    return '<table class="code-asm' + (bytes ? '' : ' code-nobytes') + '">' + body.map(([addr, cells, raw]) =>
        '<tr data-code-at="' + addr + '"' + (targets.has(addr) ? ' class="code-target"' : '') + '>' +
        '<td class="code-addr">' + addr.toString(16).toUpperCase().padStart(6, '0') + '</td><td class="code-bytes">' + esc(raw) + '</td>' + cells + '</tr>').join('') +
        '</table>';
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

export type { Known };
export { asmHtml, cHtml, mdHtml, esc };
