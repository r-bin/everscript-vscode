'use strict';
// Ownership: runs the soe:// MCP server inside the extension host, so AI
// clients can browse the virtual file system, including the live emulator,
// and tells VS Code's own chat (Copilot) about it. Reads only through
// vscode.workspace.fs, so this domain depends on no other src/ domain.
//
// Clients find it by config file: Claude Code `.mcp.json`, Gemini CLI
// `.gemini/settings.json`, Antigravity `.agents/mcp_config.json`. Copilot
// gets it from registerMcpServerDefinitionProvider below, which follows the
// port setting.
//
// Settings: everscript.mcp.enabled (default true), everscript.mcp.port
// (default 47917). A second VS Code window finds the port taken and runs
// without a server; the first window keeps answering.

const vscode = require('vscode');
const { createMcpHandler } = require('./protocol');
const { createMcpHttpServer } = require('./server');

const PROVIDER_ID = 'everscript-soe';   // = contributes.mcpServerDefinitionProviders[].id
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

    const copilot = registerForCopilot(context);
    start();
    context.subscriptions.push(log, { dispose: stop }, vscode.workspace.onDidChangeConfiguration(e => {
        if (!e.affectsConfiguration('everscript.mcp')) return;
        start();
        copilot.changed();
    }));
}

/**
 * VS Code's chat lists MCP servers that extensions provide (stable since
 * 1.101). Skipped on older hosts and forks without the API, which then use
 * their config files. The constructor is positional: (label, uri, headers, version).
 */
function registerForCopilot(context) {
    const lm = vscode.lm;
    if (!lm || typeof lm.registerMcpServerDefinitionProvider !== 'function' || !vscode.McpHttpServerDefinition) {
        return { changed() {} };
    }
    const emitter = new vscode.EventEmitter();
    const version = context.extension ? context.extension.packageJSON.version : undefined;
    context.subscriptions.push(emitter, lm.registerMcpServerDefinitionProvider(PROVIDER_ID, {
        onDidChangeMcpServerDefinitions: emitter.event,
        provideMcpServerDefinitions: () => {
            const cfg = vscode.workspace.getConfiguration('everscript.mcp');
            if (!cfg.get('enabled', true)) return [];
            const uri = vscode.Uri.parse(`http://127.0.0.1:${cfg.get('port', 47917)}/mcp`);
            return [new vscode.McpHttpServerDefinition('Everscript soe://', uri, {}, version)];
        },
        resolveMcpServerDefinition: server => server,
    }));
    return { changed: () => emitter.fire() };
}

module.exports = { registerMcpServer };
