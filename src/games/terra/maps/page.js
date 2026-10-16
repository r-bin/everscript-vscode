'use strict';
// Terranigma Maps & Room Explorer HTML Page Builder.
// Renders a CSP-compliant webview with the Terranigma celestial-indigo theme,
// Table A room browser, header opcode inspector, and multi-game capability notices.

function renderTerraMapsHtml(params) {
    const { cspSource, nonce, init } = params;
    const jsonInit = JSON.stringify(init).replace(/</g, '\\u003c');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Terranigma — Maps</title>
    <style>
        :root {
            --terra-bg: var(--vscode-editor-background, #0c1017);
            --terra-fg: var(--vscode-editor-foreground, #c9d1d9);
            --terra-card-bg: var(--vscode-sideBar-background, #161b22);
            --terra-border: var(--vscode-widget-border, #30363d);
            --terra-accent: #388bfd;
            --terra-accent-rgb: 56, 139, 253;
            --terra-tag-used: #238636;
            --terra-tag-unused: #484f58;
            --terra-hover: rgba(56, 139, 253, 0.15);
            --font-mono: var(--vscode-editor-font-family, 'SF Mono', Consolas, monospace);
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            background-color: var(--terra-bg);
            color: var(--terra-fg);
            font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif);
            font-size: 13px;
            line-height: 1.5;
            display: flex;
            flex-direction: column;
            height: 100vh;
            overflow: hidden;
        }

        /* Header */
        header {
            padding: 12px 18px;
            background: linear-gradient(180deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.5) 100%);
            border-bottom: 1px solid var(--terra-border);
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            flex-shrink: 0;
        }
        .header-title-group {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .header-title {
            font-size: 16px;
            font-weight: 700;
            color: #58a6ff;
            letter-spacing: 0.5px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .badge {
            display: inline-block;
            padding: 2px 8px;
            font-size: 11px;
            font-weight: 600;
            border-radius: 12px;
            background: rgba(56, 139, 253, 0.2);
            color: #79c0ff;
            border: 1px solid rgba(56, 139, 253, 0.4);
        }
        .badge.warning {
            background: rgba(210, 153, 34, 0.2);
            color: #e3b341;
            border-color: rgba(210, 153, 34, 0.4);
        }
        .header-meta {
            font-size: 11px;
            color: #8b949e;
            display: flex;
            gap: 12px;
        }
        .header-actions {
            display: flex;
            gap: 8px;
        }
        button.btn {
            background: var(--vscode-button-secondaryBackground, #21262d);
            color: var(--vscode-button-secondaryForeground, #c9d1d9);
            border: 1px solid var(--terra-border);
            padding: 5px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.15s ease;
        }
        button.btn:hover {
            background: var(--vscode-button-secondaryHoverBackground, #30363d);
            border-color: #8b949e;
        }
        button.btn.primary {
            background: var(--vscode-button-background, #238636);
            color: var(--vscode-button-foreground, #ffffff);
            border: none;
        }
        button.btn.primary:hover {
            background: var(--vscode-button-hoverBackground, #2ea043);
        }

        /* Banner */
        .notice-banner {
            padding: 10px 18px;
            background: rgba(56, 139, 253, 0.1);
            border-bottom: 1px solid rgba(56, 139, 253, 0.25);
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 12px;
            color: #c9d1d9;
            flex-shrink: 0;
        }
        .notice-content {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .notice-icon {
            font-size: 14px;
            color: #58a6ff;
        }

        /* Controls */
        .controls-bar {
            padding: 10px 18px;
            background: var(--terra-card-bg);
            border-bottom: 1px solid var(--terra-border);
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            flex-shrink: 0;
        }
        .search-box {
            position: relative;
            flex: 1;
            max-width: 380px;
        }
        .search-input {
            width: 100%;
            background: var(--terra-bg);
            border: 1px solid var(--terra-border);
            color: var(--terra-fg);
            padding: 6px 12px;
            border-radius: 4px;
            font-size: 12px;
            outline: none;
        }
        .search-input:focus {
            border-color: var(--terra-accent);
            box-shadow: 0 0 0 1px var(--terra-accent);
        }
        .filter-chips {
            display: flex;
            gap: 6px;
        }
        .chip {
            padding: 4px 10px;
            font-size: 11px;
            border-radius: 14px;
            background: var(--terra-bg);
            border: 1px solid var(--terra-border);
            color: #8b949e;
            cursor: pointer;
            user-select: none;
            transition: all 0.15s ease;
        }
        .chip.active {
            background: rgba(56, 139, 253, 0.2);
            color: #58a6ff;
            border-color: var(--terra-accent);
            font-weight: 600;
        }

        /* Main Workspace */
        .workspace {
            display: flex;
            flex: 1;
            min-height: 0;
            overflow: hidden;
        }

        /* Table Column */
        .table-container {
            flex: 1;
            overflow-y: auto;
            min-height: 0;
            border-right: 1px solid var(--terra-border);
        }
        table.room-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
        }
        table.room-table th {
            position: sticky;
            top: 0;
            background: var(--terra-card-bg);
            padding: 8px 12px;
            text-align: left;
            font-size: 11px;
            font-weight: 600;
            color: #8b949e;
            border-bottom: 1px solid var(--terra-border);
            z-index: 10;
        }
        table.room-table td {
            padding: 7px 12px;
            border-bottom: 1px solid rgba(48, 54, 61, 0.5);
            font-family: var(--font-mono);
            white-space: nowrap;
        }
        table.room-table tr:hover td {
            background: var(--terra-hover);
            cursor: pointer;
        }
        table.room-table tr.selected td {
            background: rgba(56, 139, 253, 0.25);
            color: #ffffff;
        }
        .td-name {
            font-family: var(--vscode-font-family, sans-serif);
            font-weight: 500;
        }
        .tag {
            display: inline-block;
            padding: 1px 6px;
            font-size: 10px;
            font-weight: 600;
            border-radius: 4px;
        }
        .tag.used { background: var(--terra-tag-used); color: #fff; }
        .tag.unused { background: var(--terra-tag-unused); color: #8b949e; }

        /* Inspector Drawer */
        .inspector {
            width: 380px;
            background: var(--terra-card-bg);
            overflow-y: auto;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 16px;
            flex-shrink: 0;
        }
        .inspector-title {
            font-size: 14px;
            font-weight: 700;
            color: #58a6ff;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .section-box {
            background: var(--terra-bg);
            border: 1px solid var(--terra-border);
            border-radius: 6px;
            padding: 12px;
        }
        .section-label {
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #8b949e;
            margin-bottom: 8px;
        }
        .prop-row {
            display: flex;
            justify-content: space-between;
            padding: 4px 0;
            border-bottom: 1px solid rgba(48, 54, 61, 0.4);
            font-size: 12px;
        }
        .prop-row:last-child { border-bottom: none; }
        .prop-key { color: #8b949e; }
        .prop-val { font-family: var(--font-mono); font-weight: 600; }

        .opcode-list {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .opcode-item {
            background: rgba(30, 41, 59, 0.4);
            border: 1px solid var(--terra-border);
            border-radius: 4px;
            padding: 6px 10px;
            font-size: 11px;
        }
        .opcode-header {
            display: flex;
            justify-content: space-between;
            font-weight: 600;
            color: #79c0ff;
            margin-bottom: 2px;
        }
        .opcode-summary {
            color: #8b949e;
            font-family: var(--font-mono);
        }

        .hex-dump {
            font-family: var(--font-mono);
            font-size: 11px;
            line-height: 1.6;
            word-break: break-all;
            background: #0d1117;
            padding: 8px;
            border-radius: 4px;
            border: 1px solid var(--terra-border);
            color: #7ee787;
        }

        .empty-placeholder {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: #8b949e;
            gap: 12px;
            text-align: center;
            padding: 24px;
        }
    </style>
</head>
<body>
    <header>
        <div class="header-title-group">
            <div class="header-title">
                <span>Terranigma</span>
                <span class="badge">${escapeHtml(init.variant || 'Europe')}</span>
                <span class="badge warning">Maps: ◐ Partial</span>
            </div>
            <div class="header-meta">
                <span>Table A: <code>${init.tableAOffset}</code></span>
                <span>Table B: <code>${init.tableBOffset}</code></span>
                <span>Rooms: <strong>${init.usedCount}</strong> used / ${init.roomCount} total</span>
            </div>
        </div>
        <div class="header-actions">
            <button class="btn" id="btn-docs">Docs</button>
            <button class="btn primary" id="btn-switch-rom">Switch ROM</button>
        </div>
    </header>

    <div class="notice-banner">
        <div class="notice-content">
            <span class="notice-icon">ℹ</span>
            <span><strong>Multi-Game Capability Notice:</strong> Terranigma room pointers (Table A) and sub-script events (Table B) are decoded. Tile & collision decoding are under active research.</span>
        </div>
        <button class="btn" id="btn-read-docs" style="padding: 2px 8px; font-size: 11px;">View Docs</button>
    </div>

    <div class="controls-bar">
        <div class="search-box">
            <input type="text" id="search-input" class="search-input" placeholder="Search room ID (e.g. 000A), address, or name..." />
        </div>
        <div class="filter-chips">
            <div class="chip active" data-filter="all">All (${init.roomCount})</div>
            <div class="chip" data-filter="used">Used (${init.usedCount})</div>
            <div class="chip" data-filter="unused">Unused (${init.unusedCount})</div>
        </div>
    </div>

    <div class="workspace">
        <div class="table-container">
            <table class="room-table">
                <thead>
                    <tr>
                        <th style="width: 70px;">ID</th>
                        <th style="width: 90px;">Status</th>
                        <th style="width: 140px;">Bus Address</th>
                        <th style="width: 110px;">File Offset</th>
                        <th style="width: 160px;">Name</th>
                        <th>Header Preview</th>
                    </tr>
                </thead>
                <tbody id="rooms-body">
                </tbody>
            </table>
        </div>

        <div class="inspector" id="inspector">
            <div class="empty-placeholder" id="inspector-placeholder">
                <div>Select a room from the list to inspect its header bitstream and decoded opcodes.</div>
            </div>
            <div id="inspector-content" style="display: none; flex-direction: column; gap: 14px;">
                <div class="inspector-title">
                    <span id="insp-title">Room 0x0000</span>
                    <span id="insp-tag" class="tag used">USED</span>
                </div>

                <div class="section-box">
                    <div class="section-label">Memory Offsets</div>
                    <div class="prop-row">
                        <span class="prop-key">SNES Bus:</span>
                        <span class="prop-val" id="insp-bus">$00:0000</span>
                    </div>
                    <div class="prop-row">
                        <span class="prop-key">PC File:</span>
                        <span class="prop-val" id="insp-file">0x000000</span>
                    </div>
                    <div class="prop-row">
                        <span class="prop-key">SPC Audio Track:</span>
                        <span class="prop-val" id="insp-spc">—</span>
                    </div>
                </div>

                <div class="section-box">
                    <div class="section-label">Decoded Map Header Opcodes</div>
                    <div class="opcode-list" id="insp-opcodes"></div>
                </div>

                <div class="section-box">
                    <div class="section-label">Raw Header Bytes</div>
                    <div class="hex-dump" id="insp-raw"></div>
                </div>
            </div>
        </div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        const DATA = ${jsonInit};

        const searchInput = document.getElementById('search-input');
        const filterChips = document.querySelectorAll('.chip');
        const tbody = document.getElementById('rooms-body');
        const inspPlaceholder = document.getElementById('inspector-placeholder');
        const inspContent = document.getElementById('inspector-content');

        let currentFilter = 'all';
        let currentSearch = '';
        let selectedRoomId = null;

        document.getElementById('btn-switch-rom').addEventListener('click', () => {
            vscode.postMessage({ command: 'switchRom' });
        });
        document.getElementById('btn-docs').addEventListener('click', () => {
            vscode.postMessage({ command: 'openDocs' });
        });
        document.getElementById('btn-read-docs').addEventListener('click', () => {
            vscode.postMessage({ command: 'openDocs' });
        });

        filterChips.forEach(chip => {
            chip.addEventListener('click', () => {
                filterChips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                currentFilter = chip.dataset.filter;
                renderRows();
            });
        });

        searchInput.addEventListener('input', (e) => {
            currentSearch = e.target.value.trim().toLowerCase();
            renderRows();
        });

        function formatHexDump(bytes) {
            if (!bytes || !bytes.length) return '—';
            return bytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
        }

        function selectRoom(room) {
            selectedRoomId = room.id;
            inspPlaceholder.style.display = 'none';
            inspContent.style.display = 'flex';

            document.getElementById('insp-title').textContent = (room.name ? room.name + ' (' + room.hexId + ')' : 'Room ' + room.hexId);
            const tag = document.getElementById('insp-tag');
            tag.className = 'tag ' + (room.isUsed ? 'used' : 'unused');
            tag.textContent = room.isUsed ? 'USED' : 'UNUSED';

            document.getElementById('insp-bus').textContent = room.busHex;
            document.getElementById('insp-file').textContent = room.fileHex;
            document.getElementById('insp-spc').textContent = room.spcTrack !== null ? ('Track $' + room.spcTrack.toString(16).padStart(2, '0').toUpperCase()) : 'None';

            const opcodesList = document.getElementById('insp-opcodes');
            opcodesList.innerHTML = '';
            if (room.opcodes && room.opcodes.length) {
                room.opcodes.forEach(op => {
                    const item = document.createElement('div');
                    item.className = 'opcode-item';
                    item.innerHTML = '<div class="opcode-header"><span>' + escapeHtml(op.name) + '</span><span>$' + op.opcode.toString(16).padStart(2, '0').toUpperCase() + '</span></div>' +
                                     '<div class="opcode-summary">' + escapeHtml(op.summary) + '</div>';
                    opcodesList.appendChild(item);
                });
            } else {
                opcodesList.innerHTML = '<div style="color: #8b949e; font-size: 11px;">No header opcodes (empty or unused slot).</div>';
            }

            document.getElementById('insp-raw').textContent = formatHexDump(room.rawBytes);

            // Highlight row
            document.querySelectorAll('tr.room-row').forEach(tr => {
                tr.classList.toggle('selected', tr.dataset.id === String(room.id));
            });
        }

        function renderRows() {
            tbody.innerHTML = '';
            const rooms = DATA.rooms || [];
            const filtered = rooms.filter(r => {
                if (currentFilter === 'used' && !r.isUsed) return false;
                if (currentFilter === 'unused' && r.isUsed) return false;
                if (currentSearch) {
                    const matchesId = r.hexId.toLowerCase().includes(currentSearch);
                    const matchesBus = r.busHex.toLowerCase().includes(currentSearch);
                    const matchesName = r.name.toLowerCase().includes(currentSearch);
                    if (!matchesId && !matchesBus && !matchesName) return false;
                }
                return true;
            });

            filtered.forEach(r => {
                const tr = document.createElement('tr');
                tr.className = 'room-row' + (selectedRoomId === r.id ? ' selected' : '');
                tr.dataset.id = String(r.id);

                const opSummary = r.opcodes ? r.opcodes.map(o => o.name).join(', ') : '';

                tr.innerHTML = '<td><strong>' + r.hexId + '</strong></td>' +
                               '<td><span class="tag ' + (r.isUsed ? 'used' : 'unused') + '">' + (r.isUsed ? 'USED' : 'UNUSED') + '</span></td>' +
                               '<td>' + r.busHex + '</td>' +
                               '<td>' + r.fileHex + '</td>' +
                               '<td class="td-name">' + escapeHtml(r.name) + '</td>' +
                               '<td style="color: #8b949e; font-size: 11px; overflow: hidden; text-overflow: ellipsis;">' + escapeHtml(opSummary) + '</td>';

                tr.addEventListener('click', () => selectRoom(r));
                tbody.appendChild(tr);
            });
        }

        function escapeHtml(s) {
            return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }

        renderRows();
        if (DATA.rooms && DATA.rooms.length > 0) {
            // Default select room 0x000A (Crysta) or first used room
            const defaultRoom = DATA.rooms.find(r => r.id === 0x000A) || DATA.rooms.find(r => r.isUsed) || DATA.rooms[0];
            if (defaultRoom) selectRoom(defaultRoom);
        }
    </script>
</body>
</html>`;
}

function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = { renderTerraMapsHtml };
