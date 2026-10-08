'use strict';
// Ownership: the MCP protocol for the soe:// file system — JSON-RPC 2.0
// messages in, responses out. Pure: no VS Code API, no HTTP. The two
// capabilities it serves (`read`, `list`) are handed in, so it never knows
// where the bytes come from. Read-only: resources and two tools.
//
// Spec: https://modelcontextprotocol.io/specification (2025-06-18).

const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const HEXDUMP_LIMIT = 4096;

const MIME = { md: 'text/markdown', json: 'application/json', txt: 'text/plain', png: 'image/png', bin: 'application/octet-stream', sfc: 'application/octet-stream' };

/** MIME type from the last path segment; `soe://bus/7e0adb` (no extension) reads as JSON. */
function mimeOf(uri) {
    const last = String(uri).split('?')[0].split('/').pop();
    const m = /\.([a-z0-9]+)$/i.exec(last);
    if (!m) return last ? MIME.json : 'text/markdown';
    return MIME[m[1].toLowerCase()] || 'application/octet-stream';
}
const isText = mime => mime.startsWith('text/') || mime === MIME.json;

const ENTRY_POINTS = [
    ['soe://rom/index.md', 'ROM overview', 'The cartridge as files: header, slices, assets.'],
    ['soe://rom/assets/index.md', 'ROM assets', 'Icons, items, alchemy, strings, rooms.'],
    ['soe://rom/assets/maps/index.md', 'Rooms', 'Every room with name, area and render.'],
    ['soe://ram/index.md', 'WRAM overview', 'The running game\'s 128 KB WRAM.'],
    ['soe://ram/status.json', 'Emulator status', 'closed / open / running, ROM, paused.'],
    ['soe://ram/flags.json', 'Story flags', 'Every named flag and whether it is set (live).'],
    ['soe://bus/index.md', 'SNES bus', 'Bus addresses → their WRAM or ROM file.'],
];

const TEMPLATES = [
    ['soe://ram/{addr}.json', 'WRAM value', 'Byte, word and name at a WRAM offset (hex), e.g. 0adb.'],
    ['soe://ram/{addr}.{bit}.json', 'WRAM flag', 'One flag bit, e.g. 2258.0.'],
    ['soe://ram/{addr}[{len}].bin', 'WRAM bytes', 'A WRAM slice; addr and len in hex.'],
    ['soe://bus/{addr}', 'Bus address', '24-bit SNES address (hex) → its WRAM or ROM JSON, e.g. 7e0adb, 8cd0a6.'],
    ['soe://rom/{offset}.json', 'ROM value', 'Byte/word/long and table or function name at a file offset.'],
    ['soe://rom/{offset}[{len}].bin', 'ROM bytes', 'A ROM slice by file offset.'],
    ['soe://rom/assets/strings/{index}.txt', 'In-game string', 'String by hex index (0000-0bb9).'],
    ['soe://rom/assets/maps/{id}/info.md', 'Room', 'Room summary; also header.json and render.png.'],
    ['soe://rom/assets/{kind}/{name}/info.json', 'Item', 'kind: ingredients, armor, consumables, alchemy; name e.g. wax.'],
];

const URI_ARG = {
    type: 'object',
    properties: { uri: { type: 'string', description: 'A soe:// address, e.g. soe://rom/index.md, soe://bus/7e0adb. Add ?rom=vanilla to read the configured ROM file.' } },
    required: ['uri'],
};

const TOOLS = [
    {
        name: 'soe_list',
        title: 'List a soe:// directory',
        description: 'List a directory of the Secret of Evermore virtual file system (ROM, assets, live emulator WRAM). Start at soe://rom/, soe://ram/ or soe://bus/. Every directory also has an index.md.',
        inputSchema: URI_ARG,
        annotations: { readOnlyHint: true },
    },
    {
        name: 'soe_read',
        title: 'Read a soe:// file',
        description: 'Read a file of the Secret of Evermore virtual file system. Markdown/JSON/text come back as text, PNG as an image, binary as a hex dump. soe://ram/ and soe://bus/7e… read the running emulator live.',
        inputSchema: URI_ARG,
        annotations: { readOnlyHint: true },
    },
];

/** `00000000  a9 00 …  |..|` lines for at most HEXDUMP_LIMIT bytes. */
function hexdump(bytes) {
    const shown = bytes.subarray(0, HEXDUMP_LIMIT);
    const lines = [];
    for (let i = 0; i < shown.length; i += 16) {
        const row = shown.subarray(i, i + 16);
        const hex = Array.from(row, b => b.toString(16).padStart(2, '0')).join(' ').padEnd(47);
        const ascii = Array.from(row, b => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.')).join('');
        lines.push(`${i.toString(16).padStart(8, '0')}  ${hex}  |${ascii}|`);
    }
    if (bytes.length > shown.length) {
        lines.push(`… ${bytes.length - shown.length} more bytes. Read a slice instead, e.g. <addr>[<len>].bin.`);
    }
    return `${bytes.length} bytes\n` + lines.join('\n');
}

/**
 * @param {{ read: (uri: string) => Promise<Uint8Array>,
 *           list: (uri: string) => Promise<Array<[string, 'file'|'dir'|'link']>>,
 *           version: string }} fsApi
 */
function createMcpHandler(fsApi) {
    const checkUri = uri => {
        if (typeof uri !== 'string' || !/^soe:\/\/(rom|ram|bus)(\/|$)/.test(uri)) {
            throw rpcError(-32602, 'uri must start with soe://rom/, soe://ram/ or soe://bus/');
        }
        return uri;
    };

    async function readContent(uri) {
        const bytes = await fsApi.read(uri);
        const mimeType = mimeOf(uri);
        return { bytes, mimeType };
    }

    async function callTool(name, args) {
        const uri = checkUri(args && args.uri);
        try {
            if (name === 'soe_list') {
                const entries = await fsApi.list(uri);
                const base = uri.endsWith('/') ? uri : uri + '/';
                const text = entries.map(([n, kind]) => `${base}${n}${kind === 'dir' ? '/' : ''}${kind === 'link' ? '  (link)' : ''}`).join('\n');
                return { content: [{ type: 'text', text: `${entries.length} entries\n${text}` }] };
            }
            const { bytes, mimeType } = await readContent(uri);
            if (mimeType === 'image/png') {
                return { content: [{ type: 'image', data: Buffer.from(bytes).toString('base64'), mimeType }] };
            }
            const text = isText(mimeType) ? Buffer.from(bytes).toString('utf8') : hexdump(bytes);
            return { content: [{ type: 'text', text }] };
        } catch (err) {
            return { content: [{ type: 'text', text: `${uri}: ${err && err.message || err}` }], isError: true };
        }
    }

    const methods = {
        initialize: params => ({
            protocolVersion: PROTOCOL_VERSIONS.includes(params && params.protocolVersion) ? params.protocolVersion : PROTOCOL_VERSIONS[0],
            capabilities: { resources: {}, tools: {} },
            serverInfo: { name: 'everscript-soe', title: 'Everscript soe://', version: fsApi.version },
            instructions: 'Read-only access to Secret of Evermore: the ROM (soe://rom/), decoded assets (soe://rom/assets/), the running emulator\'s WRAM (soe://ram/) and SNES bus addresses (soe://bus/). Numbers in paths are hex without $. Start with soe_read soe://rom/index.md or soe://ram/index.md.',
        }),
        ping: () => ({}),
        'tools/list': () => ({ tools: TOOLS }),
        'tools/call': params => {
            if (!params || !TOOLS.some(t => t.name === params.name)) throw rpcError(-32602, `Unknown tool: ${params && params.name}`);
            return callTool(params.name, params.arguments);
        },
        'resources/list': () => ({
            resources: ENTRY_POINTS.map(([uri, title, description]) => ({ uri, name: title, title, description, mimeType: mimeOf(uri) })),
        }),
        'resources/templates/list': () => ({
            resourceTemplates: TEMPLATES.map(([uriTemplate, title, description]) => ({ uriTemplate, name: title, title, description })),
        }),
        'resources/read': async params => {
            const uri = checkUri(params && params.uri);
            let content;
            try { content = await readContent(uri); } catch (err) { throw rpcError(-32002, `${uri}: ${err && err.message || err}`); }
            const { bytes, mimeType } = content;
            return {
                contents: [isText(mimeType)
                    ? { uri, mimeType, text: Buffer.from(bytes).toString('utf8') }
                    : { uri, mimeType, blob: Buffer.from(bytes).toString('base64') }],
            };
        },
    };

    /** One JSON-RPC message in; its response, or null for a notification. */
    return async function handle(msg) {
        if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
            if (msg && msg.jsonrpc === '2.0' && ('result' in msg || 'error' in msg)) return null;  // a client response
            return { jsonrpc: '2.0', id: msg && msg.id !== undefined ? msg.id : null, error: { code: -32600, message: 'Invalid request' } };
        }
        const isNotification = msg.id === undefined;
        if (isNotification) return null;
        const fn = methods[msg.method];
        if (!fn) return { jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: `Method not found: ${msg.method}` } };
        try {
            return { jsonrpc: '2.0', id: msg.id, result: await fn(msg.params) };
        } catch (err) {
            const error = err && err.rpc ? err.rpc : { code: -32603, message: String(err && err.message || err) };
            return { jsonrpc: '2.0', id: msg.id, error };
        }
    };
}

function rpcError(code, message) {
    return Object.assign(new Error(message), { rpc: { code, message } });
}

module.exports = { createMcpHandler, mimeOf, hexdump };
