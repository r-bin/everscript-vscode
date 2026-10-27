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
//   sx-label  a script address, $93:d231                     entity.name.label
//   sx-num    0x1f, 42                                       constant.numeric
//   sx-str    "…"                                            string.quoted.double
//   sx-com    // to the end of the line                      comment.line

const RULES: Array<[RegExp, string]> = [
    [/\/\/.*/y, 'sx-com'],
    [/"(?:[^"\\]|\\.)*"/y, 'sx-str'],
    [/<0x[0-9a-fA-F]+(?:,\s*0x[0-9a-fA-F]+)?>/y, 'sx-mem'],
    [/\$[0-9a-fA-F]{2}:[0-9a-fA-F]{4}\b/y, 'sx-label'],
    [/\$[0-9a-fA-F]{4,6}\b/y, 'sx-label'],
    [/\b(?:object|arg|arg_flag|currency)(?=\[)/y, 'sx-mem'],
    [/\bif!|\b(?:if|goto|async|call)\b(?!\()/y, 'sx-kw'],
    [/\b(?:signed|word|byte)\b(?!\()/y, 'sx-type'],
    [/\b[A-Za-z_][A-Za-z0-9_]*(?=\()/y, 'sx-fn'],
    [/\b[A-Z][A-Z0-9_?]*[A-Z0-9?]\b/y, 'sx-const'],
    [/\b0x[0-9a-fA-F]+\b|\b\d+\b/y, 'sx-num'],
];

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ESC[c]);

/** One line of the printer's notation as HTML: tokens in `sx-*` spans, the rest escaped. */
export function highlightScript(text: string): string {
    const src = String(text);
    let out = '', plain = '';
    for (let i = 0; i < src.length;) {
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
        out += esc(plain) + '<span class="' + hit[1] + '">' + esc(hit[0]) + '</span>';
        plain = '';
        i += hit[0].length;
    }
    return out + esc(plain);
}
