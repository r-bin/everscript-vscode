#!/usr/bin/env python3
"""
extract_modules.py -- Full modular extraction for extension.js
Writes src/webview/ files and patches extension.js.
Run: python3 tools/extract_modules.py [--check]
  default: write files (dry-run shows what would happen without --write)
  --check: diagnostic only, no writes
"""
import re, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

with open(os.path.join(ROOT, 'extension.js'), 'r', encoding='utf-8') as f:
    src_lines = f.readlines()

src = ''.join(src_lines)

TARGETS = [
    ('css',       r'^\s*const css\s*=\s*`'),
    ('scalingJs', r'^\s*const scalingJs\s*=\s*`'),
    ('roomsJs',   r'^\s*const roomsJs\s*=\s*`'),
    ('docsJs',    r'^\s*const docsJs\s*=\s*`'),
    ('routeJs',   r'^\s*const routeJs\s*=\s*`'),
    ('rngJs',     r'^\s*const rngJs\s*=\s*`'),
    ('js',        r'^\s*const js\s*=\s*`\(function\(\)\{'),
]

def find_matching_backtick(lines, start_line_0):
    """
    Given the 0-indexed start line (which contains the opening backtick),
    find the 0-indexed line that contains the CLOSING backtick of a template literal.
    Returns the 0-indexed line number.
    """
    # Join remaining text and find positions
    text = ''.join(lines[start_line_0:])
    # Skip to the first backtick in this text
    tick_pos = text.index('`')
    i = tick_pos + 1
    depth = 0  # We start inside the template literal
    while i < len(text):
        c = text[i]
        if c == '\\':
            i += 2  # skip escaped char
            continue
        if c == '`':
            # Closing backtick found
            # Count lines up to this position
            closing_line_0 = start_line_0 + text[:i+1].count('\n')
            return closing_line_0
        if c == '$' and i+1 < len(text) and text[i+1] == '{':
            # Enter interpolation
            depth += 1
            i += 2
            while i < len(text) and depth > 0:
                if text[i] == '{':
                    depth += 1
                elif text[i] == '}':
                    depth -= 1
                elif text[i] == '`' and depth == 0:
                    break
                i += 1
            continue
        i += 1
    return -1

results = {}
for name, pattern in TARGETS:
    for i, line in enumerate(src_lines):
        if re.match(pattern, line):
            end_i = find_matching_backtick(src_lines, i)
            # end_i is the 0-indexed line with the closing backtick
            # The full statement ends with `; on possibly the same line
            # or the next line has `;`
            results[name] = (i+1, end_i+1)  # 1-indexed
            print(f"{name:12s}: lines {i+1:5d}–{end_i+1:5d}  ({end_i-i+1} lines)")
            break
    else:
        print(f"{name:12s}: NOT FOUND")

print()
print("Summary: extension.js has", len(src_lines), "lines total")
print()
# Report what's between the blocks
sorted_results = sorted(results.items(), key=lambda x: x[1][0])
prev_end = 1
for name, (start, end) in sorted_results:
    if start > prev_end + 1:
        print(f"  gap {prev_end}–{start-1}: {start-prev_end-1} lines (between blocks)")
    print(f"  {name}: {start}–{end}")
    prev_end = end
