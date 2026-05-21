"""
Everscript VS Code Extension — Data Generator
Extracts function signatures and enum members from the sibling everscript repo
and writes data/index.json for use by the extension hover/completion providers.

Usage:
    python3 tools/generate_data.py
(Run from the everscript-vscode repo root.)
"""

import os
import re
import json

CORE_ROOT = os.path.join(os.path.dirname(__file__), '../../everscript/in/core')
OUTPUT    = os.path.join(os.path.dirname(__file__), '../code_highlighter/data/index.json')


def parse_core(root):
    """Walk core .evs files and extract function signatures and enum members."""
    functions = {}   # name -> [sig, ...]
    enums = {}       # name -> [{name, value, comment}, ...]

    current_enum = None

    for dirpath, _dirs, files in os.walk(root):
        for fname in sorted(files):
            if not fname.endswith('.evs'):
                continue
            path = os.path.join(dirpath, fname)
            lines = open(path, encoding='utf-8', errors='replace').readlines()

            for line in lines:
                stripped = line.strip()

                # ── enum declaration ──────────────────────────────────────────
                m = re.match(r'^enum\s+(\w+)\s*\{', stripped)
                if m:
                    current_enum = m.group(1)
                    if current_enum not in enums:
                        enums[current_enum] = []
                    continue

                if stripped == '}':
                    current_enum = None
                    continue

                # ── enum member ───────────────────────────────────────────────
                if current_enum is not None:
                    # Skip blank lines, pure comments, closing braces
                    if not stripped or stripped.startswith('//'):
                        continue
                    # e.g.  NORTH = 0x26,
                    # e.g.  NORTH = 0x26,  // comment
                    m = re.match(r'^(\w+)\s*=\s*([^,/]+?)(?:,)?\s*(?://\s*(.*))?$', stripped)
                    if m:
                        enums[current_enum].append({
                            'name':    m.group(1),
                            'value':   m.group(2).strip(),
                            'comment': (m.group(3) or '').strip(),
                        })
                    continue

                # ── function declaration ──────────────────────────────────────
                m = re.match(r'^fun\s+(\w+)\s*\(([^)]*)\)', stripped)
                if m:
                    name = m.group(1)
                    params = m.group(2).strip()
                    # Strip inline trailing comment from params
                    params = re.sub(r'\s*//.*$', '', params).strip()
                    sig = f'{name}({params})'
                    functions.setdefault(name, [])
                    if sig not in functions[name]:
                        functions[name].append(sig)

    return functions, enums


# ── Native functions (from compiler/parser.py) ────────────────────────────────
NATIVE_SIGNATURES = {
    'eval':            'eval(address)',
    'goto':            'goto(label)',
    'code':            'code(...)',
    'set':             'set(address)',
    'unset':           'unset(address)',
    'call':            'call(function_address)',
    'reference':       'reference(name)',
    'deref':           'deref(reference)',
    'dead':            'dead(character)',
    'alive':           'alive(character)',
    'rand':            'rand(max)',
    'randrange':       'randrange(min, max)',
    'len':             'len(string)',
    'rnd':             'rnd(a, b)',
    'string_key':      'string_key(id)',
    'function_key':    'function_key(id)',
    'entrance':        'entrance(x, y, z, direction)',
    'soundtrack':      'soundtrack(music_id, ?)',
    'map_transition':  'map_transition(map, x, y)',
    'retained_object': 'retained_object(type:RETAINABLE_OBJECT)',
    '_calculate':      '_calculate(expression)',
    'calculate':       'calculate(expression)',
    '_address':        '_address(address)',
    '_loot':           '_loot(animation, flag, object_id, loot_reward)',
    '_loot_chest':     '_loot_chest(animation, flag, object_id?, loot_reward?)',
}


# ── Special identifiers ───────────────────────────────────────────────────────
SPECIALS = {
    'BOY':           '**BOY** — the boy character (`CHARACTER = 0x50`).',
    'DOG':           '**DOG** — the dog character (`CHARACTER = 0x51`).',
    'BOTH':          '**BOTH** — targets both boy and dog (`CHARACTER = 0x00`).',
    'NONE':          '**NONE** — no target / null character (`CHARACTER = 0x01`).',
    'ACTIVE':        '**ACTIVE** — whichever character is currently active/controlled (`CHARACTER = 0x52`).',
    'INACTIVE':      '**INACTIVE** — whichever character is not currently active (`CHARACTER = 0x53`).',
    'LAST_ENTITY':   '**LAST_ENTITY** — the most recently spawned or referenced entity (`CHARACTER = 0x2d`). Commonly used inside enemy scripts.',
    'SCRIPT_OWNER':  '**SCRIPT_OWNER** — the entity that owns the running script (`CHARACTER = 0x2e`).',
    'SCRIPT_TARGET': '**SCRIPT_TARGET** — the entity passed as the target to the running script.',
    'BOY_ENTITY':    '**BOY_ENTITY** — boy addressed as an entity (not a character slot).',
    'DOG_ENTITY':    '**DOG_ENTITY** — dog addressed as an entity.',
    'NORTH':         '**NORTH** — direction north (`DIRECTION = 0x26`).',
    'SOUTH':         '**SOUTH** — direction south (`DIRECTION = 0x21`).',
    'EAST':          '**EAST** — direction east (`DIRECTION = 0x1d`).',
    'WEST':          '**WEST** — direction west (`DIRECTION = 0x19`).',
    'UNKNOWN':       '**UNKNOWN** — unknown or unspecified direction / character (`= 0x01`).',
    'True':          '**True** — boolean true constant (`= 1`).',
    'False':         '**False** — boolean false constant (`= 0`).',
}


# ── Annotation names ──────────────────────────────────────────────────────────
ANNOTATIONS = ['install', 'inject', 'async', 'weak', 'count_limit']


def main():
    core_root = os.path.abspath(os.path.join(os.path.dirname(__file__), CORE_ROOT.replace('../', '').replace('../../everscript/', '')))
    core_root = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', '..', 'everscript', 'in', 'core'))

    print(f'Reading core from: {core_root}')
    core_functions, enums = parse_core(core_root)

    # Merge native signatures into functions (native overrides if not already present)
    for name, sig in NATIVE_SIGNATURES.items():
        core_functions.setdefault(name, [])
        if sig not in core_functions[name]:
            core_functions[name].insert(0, sig)

    native_names = list(NATIVE_SIGNATURES.keys())

    index = {
        'functions':    core_functions,
        'native':       native_names,
        'enums':        enums,
        'specials':     SPECIALS,
        'annotations':  ANNOTATIONS,
    }

    out = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', 'data', 'index.json'))
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(index, f, indent=2, ensure_ascii=False)

    print(f'Written: {out}')
    print(f'  functions: {len(core_functions)}')
    print(f'  enums:     {len(enums)}')
    print(f'  specials:  {len(SPECIALS)}')
    fn_total = sum(len(v) for v in core_functions.values())
    print(f'  total sigs: {fn_total}')


if __name__ == '__main__':
    main()
