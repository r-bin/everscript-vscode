# mcp/ — the soe:// file system over MCP

A read-only [MCP](https://modelcontextprotocol.io) server inside the extension
host, so AI clients can browse what `src/resources/` serves, including the
live emulator. Claude Code connects through the repo's `.mcp.json`:

```json
{ "mcpServers": { "everscript-soe": { "type": "http", "url": "http://127.0.0.1:47917/mcp" } } }
```

## Files

| File | Owns |
|---|---|
| `protocol.js` | JSON-RPC 2.0 → MCP: `initialize`, `ping`, `tools/*`, `resources/*`. Pure; `read`/`list` are handed in |
| `server.js` | Streamable HTTP: `POST /mcp` on 127.0.0.1, JSON replies only, Origin/Host checks. No VS Code API |
| `index.js` | starts/stops the server from settings, reads through `vscode.workspace.fs` |

## What a client gets

- **Tools:** `soe_list(uri)`, `soe_read(uri)`. A PNG comes back as an image,
  Markdown/JSON/text as text, binary as a hex dump (first 4 KB).
- **Resources:** the `index.md` entry points, `status.json`, `flags.json`; templates
  for `soe://ram/{addr}.json`, `soe://bus/{addr}`, strings, rooms, items.

## Dependency rules

- Reads only through `vscode.workspace.fs.readFile/readDirectory(soe://…)`; requires
  no other `src/` domain. ROM choice (`?rom=`), `bus/` links and live reads come with it.
- No npm runtime dependency: `.vscodeignore` drops `node_modules/`, so the MCP SDK
  is not used; the protocol surface needed here is small.

## Invariants

- Read-only. Localhost only: binds 127.0.0.1, rejects non-local `Host`/`Origin` (403).
- Stateless: no `Mcp-Session-Id`, no SSE; notifications get 202.
- Settings `everscript.mcp.enabled` (default on) and `everscript.mcp.port` (default
  47917, keep `.mcp.json` in sync). A second VS Code window logs the taken port in
  the "Everscript MCP" output channel and runs without a server.
