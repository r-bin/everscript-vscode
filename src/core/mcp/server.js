'use strict';
// Ownership: the MCP Streamable HTTP endpoint — `POST /mcp` on 127.0.0.1.
// Stateless: no sessions, no server-sent events; every request is answered
// with plain `application/json` (or 202 for notifications). No VS Code API.
//
// Origin and Host are checked against localhost, as the MCP spec requires,
// so a web page in a browser cannot read the endpoint (DNS rebinding).

const http = require('http');

const MAX_BODY = 1 << 20;
const LOCAL_HOSTS = ['127.0.0.1', 'localhost', '[::1]'];

const isLocal = hostPort => {
    const host = String(hostPort || '').replace(/:\d+$/, '');
    return LOCAL_HOSTS.includes(host);
};
const isLocalOrigin = origin => {
    try { return isLocal(new URL(origin).host); } catch (_) { return false; }
};

/**
 * @param {(msg: object) => Promise<object|null>} handle  protocol.js
 * @returns {http.Server} not yet listening
 */
function createMcpHttpServer(handle) {
    return http.createServer((req, res) => {
        const send = (status, body, headers = {}) => {
            res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
            res.end(body === undefined ? undefined : JSON.stringify(body));
        };
        if (!isLocal(req.headers.host) || (req.headers.origin && !isLocalOrigin(req.headers.origin))) {
            return send(403, { error: 'Only local clients may use this server' });
        }
        const path = (req.url || '').split('?')[0];
        if (path !== '/mcp') return send(404, { error: 'The MCP endpoint is /mcp' });
        if (req.method !== 'POST') return send(405, { error: 'POST JSON-RPC messages to /mcp' }, { Allow: 'POST' });

        let size = 0;
        const chunks = [];
        req.on('data', c => {
            size += c.length;
            if (size > MAX_BODY) req.destroy();
            else chunks.push(c);
        });
        req.on('end', async () => {
            let msg;
            try { msg = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (_) {
                return send(400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
            }
            const replies = (await Promise.all((Array.isArray(msg) ? msg : [msg]).map(handle))).filter(Boolean);
            if (!replies.length) return send(202);
            send(200, Array.isArray(msg) ? replies : replies[0]);
        });
    });
}

module.exports = { createMcpHttpServer };
