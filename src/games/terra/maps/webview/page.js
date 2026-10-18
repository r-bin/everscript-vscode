        const vscode = acquireVsCodeApi();
        const DATA = /*@@init*/0;

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