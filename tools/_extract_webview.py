#!/usr/bin/env python3
"""
Writes src/webview/*.js module files by extracting from extension.js.
"""
import re, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_WV = os.path.join(ROOT, 'src', 'webview')

with open(os.path.join(ROOT, 'extension.js'), 'r', encoding='utf-8') as f:
    src_lines = f.readlines()

def get_literal_body(start1, end1, var_name):
    block = ''.join(src_lines[start1-1:end1])
    m = re.search(r'const\s+' + var_name + r'\s*=\s*`(.*)', block, re.DOTALL)
    if not m:
        raise ValueError(f"Could not find {var_name}")
    content = m.group(1)
    content = re.sub(r'`;\s*$', '', content.rstrip())
    return content

RANGES = {
    'css':       (2311, 2622),
    'scalingJs': (2671, 3233),
    'roomsJs':   (3234, 4046),
    'docsJs':    (4048, 4340),
    'routeJs':   (4342, 4346),
    'rngJs':     (4348, 4489),
    'js':        (4491, 4775),
}

css_body     = get_literal_body(*RANGES['css'],       'css')
scaling_body = get_literal_body(*RANGES['scalingJs'],  'scalingJs')
rooms_body   = get_literal_body(*RANGES['roomsJs'],    'roomsJs')
docs_body    = get_literal_body(*RANGES['docsJs'],     'docsJs')
route_body   = get_literal_body(*RANGES['routeJs'],    'routeJs')
rng_body     = get_literal_body(*RANGES['rngJs'],      'rngJs')
js_body      = get_literal_body(*RANGES['js'],         'js')

os.makedirs(SRC_WV, exist_ok=True)

ALCHEMY_DEFS = (
    "const {\n"
    "  alchemyEffectiveMdef,\n"
    "  alchemySpellPowerAtLevel,\n"
    "  alchemySpellBonusBaseAtLevel,\n"
    "  alchemyDamageFromPower,\n"
    "  alchemyDamageSamples,\n"
    "  alchemyRangeAtLevel,\n"
    "  alchemyMagicDefenseAtLevel,\n"
    "  alchemyTargetHpAtLevel,\n"
    "  alchemyProjectedRange,\n"
    "} = require('../../memory_radar/models/alchemy-model');\n"
    "\n"
    "const alchemyWebviewEffectiveMdef = alchemyEffectiveMdef.toString().replace(/function alchemyEffectiveMdef/, 'function effectiveMdef');\n"
    "const alchemyWebviewBonusBase = alchemySpellBonusBaseAtLevel.toString();\n"
    "const alchemyWebviewDamageFromPower = alchemyDamageFromPower.toString();\n"
    "const alchemyWebviewDamageSamples = alchemyDamageSamples\n"
    "  .toString()\n"
    "  .replace(/alchemySpellPowerAtLevel/g, 'alchemySpellPowerAtLevel')\n"
    "  .replace(/alchemySpellBonusBaseAtLevel/g, 'alchemySpellBonusBaseAtLevel')\n"
    "  .replace(/alchemyDamageFromPower/g, 'alchemyDamageFromPower');\n"
    "const alchemyWebviewRange = alchemyRangeAtLevel\n"
    "  .toString()\n"
    "  .replace(/alchemySpellPowerAtLevel/g, 'alchemySpellPowerAtLevel')\n"
    "  .replace(/alchemySpellBonusBaseAtLevel/g, 'alchemySpellBonusBaseAtLevel')\n"
    "  .replace(/alchemyDamageFromPower/g, 'alchemyDamageFromPower');\n"
    "const alchemyWebviewSpellPower = alchemySpellPowerAtLevel.toString();\n"
    "const alchemyWebviewMagicDefenseAtLevel = alchemyMagicDefenseAtLevel.toString();\n"
    "const alchemyWebviewTargetHpAtLevel = alchemyTargetHpAtLevel.toString();\n"
    "const alchemyWebviewProjectedRange = alchemyProjectedRange\n"
    "  .toString()\n"
    "  .replace(/alchemySpellPowerAtLevel/g, 'alchemySpellPowerAtLevel')\n"
    "  .replace(/alchemyRangeAtLevel/g, 'alchemyRangeAtLevel')\n"
    "  .replace(/alchemyMagicDefenseAtLevel/g, 'alchemyMagicDefenseAtLevel')\n"
    "  .replace(/alchemyRangeLevel0/g, 'alchemyRangeAtLevel');\n"
)

def write(fname, parts):
    path = os.path.join(SRC_WV, fname)
    content = ''.join(parts)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"WROTE {fname} ({len(content)} bytes)")

write('shared-css.js', [
    "'use strict';\n",
    "module.exports = `", css_body, "`;\n",
])

write('rng-tab.js', [
    "'use strict';\n",
    "module.exports = `", rng_body, "`;\n",
])

write('route-tab.js', [
    "'use strict';\n",
    "module.exports = `", route_body, "`;\n",
])

write('rooms-tab.js', [
    "'use strict';\n",
    "module.exports = `", rooms_body, "`;\n",
])

write('docs-tab.js', [
    "'use strict';\n",
    "module.exports = `", docs_body, "`;\n",
])

write('scaling-tab.js', [
    "'use strict';\n",
    ALCHEMY_DEFS,
    "\n",
    "module.exports = `", scaling_body, "`;\n",
])

write('shared-js.js', [
    "'use strict';\n",
    "// buildMainJs(jsData, roomsData, scalingData, roomsJs, scalingJs, docsJs, routeJs, rngJs) -> string\n",
    "module.exports = function buildMainJs(jsData, roomsData, scalingData, roomsJs, scalingJs, docsJs, routeJs, rngJs) {\n",
    "  return `", js_body, "`;\n",
    "};\n",
])

print("Done.")
