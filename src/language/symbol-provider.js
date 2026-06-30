'use strict';
// Owner: code_highlighter/symbol-provider.js
// Provides document outline symbols for .evs files.
// Pure — no state, no imports beyond VS Code API.

const vscode = require('vscode');

const SYMBOL_RULES = [
    { re: /^fun\s+(\w+)\s*\(([^)]*)\)/,  kind: vscode.SymbolKind.Function },
    { re: /^map\s+(\w+)\s*\(/,            kind: vscode.SymbolKind.Module   },
    { re: /^area\s+(\w+)\s*\(/,           kind: vscode.SymbolKind.Module   },
    { re: /^group\s+(\w+)\s*\(/,          kind: vscode.SymbolKind.Package  },
    { re: /^enum\s+(\w+)\s*\{/,           kind: vscode.SymbolKind.Enum     },
    { re: /^val\s+(\w+)\s*=/,             kind: vscode.SymbolKind.Constant },
];

function provideDocumentSymbols(document) {
    const symbols = [];
    for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i);
        const text = line.text.trimStart();
        for (const { re, kind } of SYMBOL_RULES) {
            const m = re.exec(text);
            if (!m) continue;
            const name   = m[1];
            const detail = m[2] !== undefined ? `(${m[2]})` : '';
            symbols.push(new vscode.DocumentSymbol(name, detail, kind, line.range, line.range));
            break;
        }
    }
    return symbols;
}

module.exports = { provideDocumentSymbols };
