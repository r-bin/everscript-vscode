'use strict';
// Ownership: runs the soe:// MCP server inside the extension host, so AI
// clients (Claude Code via the repo's .mcp.json) can browse the virtual file
// system, including the live emulator. Reads only through
// vscode.workspace.fs, so this domain depends on no other src/ domain.
//
// Settings: everscript.mcp.enabled (default true), everscript.mcp.port
// (default 47917). A second VS Code window finds the port taken and runs
// without a server; the first window keeps answering.

const vscode = require('vscode');
const { createMcpHandler } = require('./protocol');
const { createMcpHttpServer } = require('./server');

const KIND = { 1: 'file', 2: 'dir' };
const kindOf = type => (type & vscode.FileType.SymbolicLink ? 'link' : KIND[type & 3] || 'file');

function registerMcpServer(context) {
    const log = vscode.window.createOutputChannel('Everscript MCP');
    const handle = createMcpHandler({
        version: context.extension ? context.extension.packageJSON.version : '0',
        read: uri => vscode.workspace.fs.readFile(vscode.Uri.parse(uri)),
        list: async uri => (await vscode.workspace.fs.readDirectory(vscode.Uri.parse(uri))).map(([n, t]) => [n, kindOf(t)]),
    });
    let server = null;

    const start = () => {
        stop();
        const cfg = vscode.workspace.getConfiguration('everscript.mcp');
        if (!cfg.get('enabled', true)) return log.appendLine('soe:// MCP server disabled (everscript.mcp.enabled).');
        const port = cfg.get('port', 47917);
        const s = createMcpHttpServer(handle);
        s.on('error', err => {
            log.appendLine(err.code === 'EADDRINUSE'
                ? `Port ${port} is taken (another VS Code window?); this window runs without the MCP server.`
                : `MCP server error: ${err.message}`);
            if (server === s) server = null;
        });
        s.listen(port, '127.0.0.1', () => log.appendLine(`soe:// MCP server on http://127.0.0.1:${port}/mcp`));
        server = s;
    };
    const stop = () => {
        if (server) server.close();
        server = null;
    };

    start();
    context.subscriptions.push(log, { dispose: stop }, vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('everscript.mcp')) start();
    }));
}

module.exports = { registerMcpServer };
