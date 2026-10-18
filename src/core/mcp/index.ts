// Ownership: runs the soe:// MCP server inside the extension host, so AI
// clients can browse the virtual file system, including the live emulator,
// and tells VS Code's own chat (Copilot) about it. Reads only through
// vscode.workspace.fs, so this domain depends on no other src/ domain.
//
// Clients find it by config file: Claude Code `.mcp.json`, Gemini CLI
// Antigravity `.agents/mcp_config.json`. Copilot
// gets it from registerMcpServerDefinitionProvider below, which follows the
// port setting.
//
// Settings: everscript.mcp.enabled (default true), everscript.mcp.port
// (default 47917). A second VS Code window finds the port taken and runs
// without a server; the first window keeps answering.

import * as vscode from 'vscode';
import { createMcpHandler } from './protocol';
import { createMcpHttpServer } from './server';

const PROVIDER_ID = 'everscript-soe';   // = contributes.mcpServerDefinitionProviders[].id
const KIND: Record<number, 'file' | 'dir'> = { 1: 'file', 2: 'dir' };
const kindOf = (type: number): 'file' | 'dir' | 'link' => (type & vscode.FileType.SymbolicLink ? 'link' : KIND[type & 3] || 'file');

/** The slice of the VS Code MCP provider API used here (newer than the bundled typings). */
interface McpApi {
    lm?: { registerMcpServerDefinitionProvider?: (id: string, provider: object) => vscode.Disposable };
    McpHttpServerDefinition?: new (label: string, uri: vscode.Uri, headers: object, version: string | undefined) => object;
}

function registerMcpServer(context: vscode.ExtensionContext) {
    const log = vscode.window.createOutputChannel('Everscript MCP');
    const handle = createMcpHandler({
        version: context.extension ? context.extension.packageJSON.version : '0',
        read: async uri => vscode.workspace.fs.readFile(vscode.Uri.parse(uri)),
        list: async uri => (await vscode.workspace.fs.readDirectory(vscode.Uri.parse(uri))).map(([n, t]) => [n, kindOf(t)]),
    });
    let server: ReturnType<typeof createMcpHttpServer> | null = null;

    const start = () => {
        stop();
        const cfg = vscode.workspace.getConfiguration('everscript.mcp');
        if (!cfg.get('enabled', true)) return log.appendLine('soe:// MCP server disabled (everscript.mcp.enabled).');
        const port = cfg.get('port', 47917);
        const s = createMcpHttpServer(handle);
        s.on('error', (err: NodeJS.ErrnoException) => {
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
function registerForCopilot(context: vscode.ExtensionContext) {
    const api = vscode as unknown as McpApi;
    const lm = api.lm;
    const Definition = api.McpHttpServerDefinition;
    if (!lm || typeof lm.registerMcpServerDefinitionProvider !== 'function' || !Definition) {
        return { changed() {} };
    }
    const emitter = new vscode.EventEmitter<void>();
    const version = context.extension ? context.extension.packageJSON.version : undefined;
    context.subscriptions.push(emitter, lm.registerMcpServerDefinitionProvider(PROVIDER_ID, {
        onDidChangeMcpServerDefinitions: emitter.event,
        provideMcpServerDefinitions: () => {
            const cfg = vscode.workspace.getConfiguration('everscript.mcp');
            if (!cfg.get('enabled', true)) return [];
            const uri = vscode.Uri.parse(`http://127.0.0.1:${cfg.get('port', 47917)}/mcp`);
            return [new Definition('Everscript soe://', uri, {}, version)];
        },
        resolveMcpServerDefinition: (server: object) => server,
    }));
    return { changed: () => emitter.fire() };
}

export { registerMcpServer };
