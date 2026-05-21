#!/usr/bin/env python3
"""
Patches extension.js: replaces each large inline webview template literal
with a require() call to the corresponding src/webview/ module.

Run once, then verify with: node -e "require('./extension.js')"
"""
import re, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ext_path = os.path.join(ROOT, 'extension.js')

with open(ext_path, 'r', encoding='utf-8') as f:
    src = f.read()

def locate_var(src, var_name):
    """Returns (start_char, end_char) of `const VAR = `...`;` block.
    Handles nested template literals via a simple backtick/depth stack.
    Closing `;` (possibly preceded by whitespace/newline) marks the end.
    """
    m = re.search(r'\n    const ' + re.escape(var_name) + r'\s*= `', src)
    if not m:
        raise ValueError(f"Could not find start of const {var_name}")
    start = m.start() + 1  # after the leading newline

    # Track nesting: outer ` opens depth=1.
    # Inside a ${...} interpolation, a ` opens depth+1.
    open_pos = src.index('`', m.end() - 1)
    depth = 1
    in_expr = 0   # brace depth inside ${...}
    i = open_pos + 1
    while i < len(src) and depth > 0:
        ch = src[i]
        if ch == '\\':
            i += 2
            continue
        if in_expr > 0:
            if ch == '{':
                in_expr += 1
            elif ch == '}':
                in_expr -= 1
            elif ch == '`':
                depth += 1  # nested template literal opens
            i += 1
            continue
        if ch == '`':
            depth -= 1
        elif ch == '$' and i + 1 < len(src) and src[i+1] == '{':
            in_expr = 1
            i += 2
            continue
        i += 1
    # i is now just past the closing backtick
    # skip optional whitespace then expect `;`
    j = i
    while j < len(src) and src[j] in ' \t':
        j += 1
    if j >= len(src) or src[j] != ';':
        raise ValueError(f"Expected ; after closing backtick for {var_name}, got {src[j:j+5]!r}")
    end = j + 1  # include the ;
    return start, end

# ── Locate each block ─────────────────────────────────────────────────────────

blocks = ['css', 'scalingJs', 'roomsJs', 'docsJs', 'routeJs', 'rngJs']
positions = {}
for v in blocks:
    s, e = locate_var(src, v)
    print(f"  {v}: chars {s}-{e} ({e-s} bytes), starts: {src[s:s+40]!r}")
    positions[v] = (s, e)

# ── Also locate `const js = ` (the big shared IIFE) ─────────────────────────

m = re.search(r'\n    const js\s*= `', src)
if not m:
    raise ValueError("Could not find 'const js = `'")
js_start = m.start() + 1
open_pos = src.index('`', m.end() - 1)
depth = 1
in_expr = 0
i = open_pos + 1
while i < len(src) and depth > 0:
    ch = src[i]
    if ch == '\\':
        i += 2
        continue
    if in_expr > 0:
        if ch == '{':
            in_expr += 1
        elif ch == '}':
            in_expr -= 1
        elif ch == '`':
            depth += 1
        i += 1
        continue
    if ch == '`':
        depth -= 1
    elif ch == '$' and i + 1 < len(src) and src[i+1] == '{':
        in_expr = 1
        i += 2
        continue
    i += 1
j = i
while j < len(src) and src[j] in ' \t':
    j += 1
if j >= len(src) or src[j] != ';':
    raise ValueError(f"Expected ; after closing backtick for js, got {src[j:j+5]!r}")
js_end = j + 1
print(f"  js: chars {js_start}-{js_end} ({js_end-js_start} bytes), starts: {src[js_start:js_start+40]!r}")
positions['js'] = (js_start, js_end)

# ── Build replacement map ─────────────────────────────────────────────────────

replacements = {
    'css':       "    const css = require('./src/webview/shared-css');",
    'scalingJs': "    const scalingJs = require('./src/webview/scaling-tab');",
    'roomsJs':   "    const roomsJs = require('./src/webview/rooms-tab');",
    'docsJs':    "    const docsJs = require('./src/webview/docs-tab');",
    'routeJs':   "    const routeJs = require('./src/webview/route-tab');",
    'rngJs':     "    const rngJs = require('./src/webview/rng-tab');",
    'js':        "    const buildMainJs = require('./src/webview/shared-js');\n    const js = buildMainJs(jsData, roomsData, scalingData, roomsJs, scalingJs, docsJs, routeJs, rngJs);",
}

# ── Apply replacements from end → start so char positions stay valid ──────────

order = sorted(positions.keys(), key=lambda v: -positions[v][0])
out = src
for v in order:
    s, e = positions[v]
    out = out[:s] + replacements[v] + out[e:]
    delta = len(replacements[v]) - (e - s)
    print(f"  Replaced {v}: {e-s} -> {len(replacements[v])} bytes (delta {delta:+})")

# ── Also remove the dead alchemyWebview* defs at the top (lines 9-31) ─────────

DEAD_BLOCK = re.compile(
    r"\n"
    r"const alchemyWebviewEffectiveMdef = .*?\.replace\([^)]+\);\n"
    r"const alchemyWebviewBonusBase = .*?;\n"
    r"const alchemyWebviewDamageFromPower = .*?;\n"
    r"const alchemyWebviewDamageSamples = alchemyDamageSamples\n.*?;\n"
    r"const alchemyWebviewRange = alchemyRangeAtLevel\n.*?;\n"
    r"const alchemyWebviewSpellPower = .*?;\n"
    r"const alchemyWebviewMagicDefenseAtLevel = .*?;\n"
    r"const alchemyWebviewTargetHpAtLevel = .*?;\n"
    r"const alchemyWebviewProjectedRange = alchemyProjectedRange\n.*?;\n",
    re.DOTALL
)
m2 = DEAD_BLOCK.search(out)
if m2:
    print(f"  Removing dead alchemyWebview* block ({m2.end()-m2.start()} bytes)")
    out = out[:m2.start()] + '\n' + out[m2.end():]
else:
    print("  WARNING: alchemyWebview* block not found (already removed?)")

# ── Also remove now-unused alchemy imports from extension.js top ──────────────

# Remove the alchemy destructure require (only used for alchemyWebview* defs)
ALCHEMY_REQ = re.compile(
    r"\nconst \{ alchemyEffectiveMdef,.*?\} = require\('./alchemy-model'\);\n",
    re.DOTALL
)
m3 = ALCHEMY_REQ.search(out)
if m3:
    print(f"  Removing alchemy-model require ({m3.end()-m3.start()} bytes)")
    out = out[:m3.start()] + '\n' + out[m3.end():]
else:
    print("  WARNING: alchemy-model require not found (already removed?)")

# ── Write output ──────────────────────────────────────────────────────────────

with open(ext_path, 'w', encoding='utf-8') as f:
    f.write(out)

orig_lines = src.count('\n')
new_lines = out.count('\n')
print(f"\nDone. {orig_lines} -> {new_lines} lines (saved {orig_lines-new_lines})")
