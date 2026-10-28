// Ownership: the printer's notation (print.ts `text`) as HTML for the script viewers — each token
// wrapped in a `sx-*` class, everything escaped. Pure. Bundled for the radar page as
// `ScriptHighlight` (tools/bundle-pages.mts), so the Rooms and Scripts tabs colour lines alike.
//
// Classes follow the Everscript colour theme's scopes (language/themes/everscript-dark.json):
//   sx-kw     control: if, if!, goto, async, call            keyword.control
//   sx-fn     a name called with (…): spawn(, sleep(, end(   support.function
//   sx-const  NAMES_IN_CAPS: flags, enemies, directions     variable.other.enummember
//   sx-type   signed, word, byte                             storage.type
//   sx-mem    <0x2865>, <0x2834, 0x02>, object[ arg[         variable.other.address
//   sx-label  a script address, $bank:addr                   entity.name.label
//             (carries data-goto, the address as 6 hex digits: a viewer jumps to that line)
//   sx-num    0x1f, 42                                       constant.numeric
//   sx-str    "…"                                            string.quoted.double
//   sx-com    // to the end of the line                      comment.line
//
// A line's marks (print.ts `Mark`) wrap what they point at in `sx-error` / `sx-warn` (a squiggle),
// the message as its title.

const RULES: Array<[RegExp, string]> = [
    [/\/\/.*/y, 'sx-com'],
    [/"(?:[^"\\]|\\.)*"/y, 'sx-str'],
    [/<0x[0-9a-fA-F]+(?:,\s*0x[0-9a-fA-F]+)?>/y, 'sx-mem'],
    [/\$[0-9a-fA-F]{2}:[0-9a-fA-F]{4}\b/y, 'sx-label'],
    [/\$[0-9a-fA-F]{4,6}\b/y, 'sx-label'],
    [/\b(?:object|arg|arg_flag|temp|temp_flag|currency)(?=\[)/y, 'sx-mem'],
    [/\bif!|\b(?:if|goto|async|call)\b(?!\()/y, 'sx-kw'],
    [/\b(?:signed|word|byte)\b(?!\()/y, 'sx-type'],
    [/\b[A-Za-z_][A-Za-z0-9_]*(?=\()/y, 'sx-fn'],
    [/\b[A-Z][A-Z0-9_?]*[A-Z0-9?]\b/y, 'sx-const'],
    [/\b0x[0-9a-fA-F]+\b|\b\d+\b/y, 'sx-num'],
];

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ESC[c]);

/** A mark as the printer gives it: `find`'s `nth` occurrence as a word, or the whole line. */
interface Mark { severity: 'error' | 'warning'; message: string; find?: string; nth?: number }

/** Where each mark sits in `src`: [from, to, opening tag]; a mark whose text is not there is dropped. */
function spans(src: string, marks: readonly Mark[]): Array<[number, number, string]> {
    const out: Array<[number, number, string]> = [];
    for (const m of marks) {
        let from = 0, to = src.length;
        if (m.find) {
            const re = new RegExp('\\b' + m.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g');
            const hit = [...src.matchAll(re)][m.nth ?? 0];
            if (!hit) continue;
            from = hit.index!; to = from + hit[0].length;
        }
        out.push([from, to, '<span class="' + (m.severity === 'error' ? 'sx-error' : 'sx-warn') + '" title="' + esc(m.message) + '">']);
    }
    // Outer first, so a whole-line error holds a warning inside it.
    return out.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
}

/** One line of the printer's notation as HTML: tokens in `sx-*` spans, the rest escaped; `marks` as squiggles. */
export function highlightScript(text: string, marks: readonly Mark[] = []): string {
    const src = String(text);
    const marked = spans(src, marks);
    let out = '', plain = '';
    // Each mark opens at the first edge at or past its start and closes at the first at or past its
    // end (a token is never split); `open` holds the ends of the marks open now, innermost last.
    const open: number[] = [];
    let next = 0;
    const edge = (i: number): void => {
        let tags = '';
        while (open.length && open[open.length - 1] <= i) { open.pop(); tags += '</span>'; }
        for (; next < marked.length && marked[next][0] <= i; next++) {
            if (marked[next][1] <= i) continue;
            open.push(marked[next][1]);
            tags += marked[next][2];
        }
        if (!tags) return;
        out += esc(plain) + tags;
        plain = '';
    };
    for (let i = 0; i < src.length;) {
        edge(i);
        let hit: [string, string] | null = null;
        // A word continues a word: only start a token where the previous character does not join it.
        const glued = i > 0 && /[A-Za-z0-9_]/.test(src[i - 1]) && /[A-Za-z0-9_]/.test(src[i]);
        if (!glued) {
            for (const [re, cls] of RULES) {
                re.lastIndex = i;
                const m = re.exec(src);
                if (m && m[0].length) { hit = [m[0], cls]; break; }
            }
        }
        if (!hit) { plain += src[i++]; continue; }
        const go = hit[1] === 'sx-label' ? ' data-goto="' + hit[0].replace(/[$:]/g, '').toUpperCase() + '" title="Go to ' + esc(hit[0]) + '"' : '';
        out += esc(plain) + '<span class="' + hit[1] + '"' + go + '>' + esc(hit[0]) + '</span>';
        plain = '';
        i += hit[0].length;
    }
    edge(src.length);
    return out + esc(plain) + '</span>'.repeat(open.length);
}
