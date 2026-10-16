# src/core/mcp — agent rules

Kind: **core** (see `/AI_ARCHITECTURE_GUIDE.md` §2). What the folder does and how
clients connect: [README.md](README.md).

## Owns
- The localhost MCP server: `protocol.js` (JSON-RPC → MCP, pure), `server.js` (HTTP, no
  VS Code API), `index.js` (lifecycle, `workspace.fs` reads, VS Code chat registration).

## Dependencies
- Reads only through `vscode.workspace.fs.readFile/readDirectory(soe://…)`; requires
  no other `src/` domain. ROM choice (`?rom=`), `bus/` links and live reads come with it.
- No npm runtime dependency: `.vscodeignore` drops `node_modules/`, so the MCP SDK
  is not used; the protocol surface needed here is small.

## Invariants
- Read-only. Localhost only: binds 127.0.0.1, rejects non-local `Host`/`Origin` (403).
- Stateless: no `Mcp-Session-Id`, no SSE; notifications get 202.
- Settings `everscript.mcp.enabled` (default on) and `everscript.mcp.port` (default
  47917). Changing the port means updating `.mcp.json` and
  `.agents/mcp_config.json` in the same commit.
- A second VS Code window logs the taken port in the "Everscript MCP" output channel and
  runs without a server — never fail activation over it.

## Tests
- `tests/memory/mcp-server.test.js` (unit tier).
