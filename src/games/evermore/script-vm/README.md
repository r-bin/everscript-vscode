# script-vm/ — the script decoder, from the game's interpreter

Reads Evermore's event scripts the way the interpreter at `$8C:D0A6` does: which bytes each
instruction takes and where control goes after it. Written from the handlers' code, not from
any other decoder ([docs/scripts/](../../../../docs/scripts/vm.md)
is the spec; `docs/cleanup.md` D3).

| File | Owns |
|---|---|
| `spec.ts` | the opcode table (operands, flow, our names) and the expression sub-ops |
| `address.ts` | script windows, packed pointers, `ScriptRom` (bytes, header, pointer table, global ids) |
| `expression.ts` | reading one expression; its value tree |
| `decode.ts` | one instruction: operands, size, next, target; `successors`, `callee` |
| `walk.ts` | everything reachable from entry points |
| `print.ts` | an instruction as one line (`text`), and what is wrong with it (`printed`: an error for an unnamed opcode, a warning for a `signed` read whose sign cannot change the result — tested for zero, a small constant, an entity — and for a constant its parameter's enum lacks); unnamed temp-area cells read `temp[n]`, pairs `(x, y) = (a, b)` |
| `parameters.json`, `parameters.ts` | each opcode's parameters in operand order: name, type (`u8`, `u16`, `s16`, `bool`, `entity`, the flow tokens) and enum; estimated from how the ROM's scripts use each operand, named from the handlers. `tests/script-vm/rom.test.js` checks it against the ROM |
| `highlight.ts` | `highlightScript(line, marks)`: the printer's notation as HTML, marks (`printed()`) as `sx-error` / `sx-warn` squiggles, tokens in `sx-*` classes after the Everscript theme's scopes; bundled for the radar page (`ScriptHighlight`), used by both script viewers |
| `address.ts` (`enemyCharacter`) | the character record an ENEMY id spawns, read through the spawn handler's own `lda.l` operand at `$8C:DCF4`, so a moved enemy index is followed |
| `rooms.ts` | a room's enter script and triggers; every entry the tables name |

```js
const V = require('./src/games/evermore/script-vm');
const rom = new V.ScriptRom(romBytes);
V.decodeAt(rom, 0x94e0ed);                       // { opcode, size, operands, next, target, flow }
V.walk(rom, V.allEntries(rom));                   // 64,839 instructions in the US ROM
```

Not yet: printing instructions in the compiler's spelling (cleanup 2.2), and moving the
consumers of the legacy `script/` decoder here (2.4).
