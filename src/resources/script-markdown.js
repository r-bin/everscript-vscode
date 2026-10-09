'use strict';
// Ownership: Markdown and Everscript text generators for decoded ROM scripts.
// Pure formatting functions only; no routing or I/O.

const { hexId } = require('../shared/resource-uri');

function fmtSnes(addr) {
    return '$' + (addr >>> 0).toString(16).toUpperCase().padStart(6, '0');
}

function scriptMarkdown(info) {
    const snes = fmtSnes(info.addressSnes);
    const title = info.title || (info.name ? `Script ${snes}: ${info.name}` : `Script ${snes}`);
    const lines = [`# ${title}`, ''];

    if (info.room) {
        lines.push(`**Room:** ${info.room.id} (${info.room.name || 'Unknown'})`);
        if (info.room.area) lines.push(`**Area:** ${info.room.area}`);
    }
    if (info.trigger) {
        const t = info.trigger;
        lines.push(`**Trigger:** ${t.kind} #${t.index}`);
        if (t.rect) lines.push(`**Box:** (${t.rect[0]}, ${t.rect[1]}) .. (${t.rect[2]}, ${t.rect[3]})`);
        if (t.scriptId !== undefined) lines.push(`**Script ID:** 0x${t.scriptId.toString(16).padStart(4, '0')}`);
    }
    if (info.room || info.trigger) lines.push('');

    lines.push('| Property | Value |');
    lines.push('|---|---|');
    lines.push(`| SNES Address | \`${snes}\` |`);
    if (info.romOffset !== null && info.romOffset !== undefined) {
        lines.push(`| ROM Offset | \`$${hexId(info.romOffset, 6)}\` |`);
    }
    lines.push(`| Instructions | ${info.instructions ? info.instructions.length : 0} |`);
    lines.push(`| Termination | ${info.terminated ? 'Terminated' : (info.stopReason || 'Unknown')} |`);
    if (info.label) {
        lines.push(`| Label | \`${escapeCell(info.label)}\` |`);
    }
    lines.push('');

    // Everscript pickups
    if (info.everscript && info.everscript.length > 0) {
        lines.push('## Everscript Pickups', '');
        lines.push('```everscript');
        for (const ev of info.everscript) {
            lines.push(ev);
        }
        lines.push('```', '');
    }

    // Transitions
    if (info.transitions && info.transitions.length > 0) {
        lines.push(`## Transitions (${info.transitions.length})`, '');
        lines.push('| Target Room | Name | Coordinates |');
        lines.push('|---|---|---|');
        for (const tr of info.transitions) {
            const mapName = tr.mapName || `Room ${tr.mapId}`;
            lines.push(`| ${tr.mapId} | ${mapName} | (${tr.x}, ${tr.y}) |`);
        }
        lines.push('');
    }

    // Spawns
    if (info.spawns && info.spawns.length > 0) {
        lines.push(`## Entity Spawns (${info.spawns.length})`, '');
        lines.push('| NPC | Name | Character | Pos (X, Y) |');
        lines.push('|---|---|---|---|');
        for (const sp of info.spawns) {
            const name = sp.romName || sp.name || `NPC ${sp.npc}`;
            lines.push(`| ${sp.npc} | ${name} | ${sp.character} | (${sp.x}, ${sp.y}) |`);
        }
        lines.push('');
    }

    // Disassembled instructions table
    if (info.instructions && info.instructions.length > 0) {
        lines.push(`## Instructions (${info.instructions.length})`, '');
        lines.push('| Address | Bytes | Instruction / Summary |');
        lines.push('|---|---|---|');
        for (const ins of info.instructions) {
            const addr = fmtSnes(ins.addressSnes || ins.address);
            const bytes = ins.bytesHex || '';
            const summary = escapeCell(ins.summary || '');
            const indent = ins.depth && ins.depth > 0 ? '&nbsp;&nbsp;'.repeat(ins.depth) : '';
            lines.push(`| \`${addr}\` | \`${bytes}\` | ${indent}${summary} |`);
        }
        lines.push('');

        lines.push('## Everscript Source', '');
        lines.push('```everscript');
        for (const ins of info.instructions) {
            const addr = fmtSnes(ins.addressSnes || ins.address);
            const indent = ins.depth && ins.depth > 0 ? '  '.repeat(ins.depth) : '';
            lines.push(`${addr}:  ${indent}${ins.summary || ''}`);
        }
        lines.push('```', '');
    }

    return lines.join('\n');
}

function scriptEverscript(info) {
    const snes = fmtSnes(info.addressSnes);
    const lines = [
        `// ${info.title || `Script ${snes}`}`,
        `// Address: ${snes}`,
        `// Instructions: ${info.instructions ? info.instructions.length : 0}`,
        '',
    ];

    if (info.everscript && info.everscript.length > 0) {
        lines.push('// Pickups:');
        for (const ev of info.everscript) {
            lines.push(ev);
        }
        lines.push('');
    }

    lines.push('// Bytecode disassembly:');
    if (info.instructions) {
        for (const ins of info.instructions) {
            const addr = fmtSnes(ins.addressSnes || ins.address);
            const indent = ins.depth && ins.depth > 0 ? '  '.repeat(ins.depth) : '';
            lines.push(`${addr}:  ${indent}${ins.summary || ''}`);
        }
    }
    lines.push('');
    return lines.join('\n');
}

function roomScriptsIndexMarkdown(model, mapId, roomName, roomArea) {
    const hex = hexId(mapId, 2);
    const lines = [
        `# Room ${hex} Scripts: ${roomName || 'Unknown'}`,
        '',
        `**Area:** ${roomArea || 'Unknown'}`,
        '',
        '## Enter Script',
        '',
        `- Address: \`${fmtSnes(model.enter.scriptAddressSnes)}\``,
        `- Instructions: ${model.enter.instructions.length}`,
        `- Label: \`${model.enter.label || 'None'}\``,
        `- View: [enter.md](enter.md) | [enter.evs](enter.evs) | [enter.json](enter.json)`,
        '',
    ];

    if (model.stepOn && model.stepOn.length > 0) {
        lines.push(`## Step-On Triggers (${model.stepOn.length})`, '');
        lines.push('| Index | Box (X1, Y1, X2, Y2) | Address | Label | View |');
        lines.push('|---|---|---|---|---|');
        model.stepOn.forEach((tr, i) => {
            const addr = fmtSnes(tr.scriptAddressSnes);
            const box = `(${tr.x1}, ${tr.y1}) .. (${tr.x2}, ${tr.y2})`;
            const label = escapeCell(tr.label || '');
            lines.push(`| ${i} | ${box} | \`${addr}\` | ${label} | [step-on/${i}.md](step-on/${i}.md) |`);
        });
        lines.push('');
    } else {
        lines.push('## Step-On Triggers', '', 'None', '');
    }

    if (model.bTrigger && model.bTrigger.length > 0) {
        lines.push(`## B-Triggers (${model.bTrigger.length})`, '');
        lines.push('| Index | Box (X1, Y1, X2, Y2) | Address | Label | View |');
        lines.push('|---|---|---|---|---|');
        model.bTrigger.forEach((tr, i) => {
            const addr = fmtSnes(tr.scriptAddressSnes);
            const box = `(${tr.x1}, ${tr.y1}) .. (${tr.x2}, ${tr.y2})`;
            const label = escapeCell(tr.label || '');
            lines.push(`| ${i} | ${box} | \`${addr}\` | ${label} | [b-trigger/${i}.md](b-trigger/${i}.md) |`);
        });
        lines.push('');
    } else {
        lines.push('## B-Triggers', '', 'None', '');
    }

    return lines.join('\n');
}

function scriptsRootMarkdown() {
    return `# soe://rom/assets/scripts/

Disassembled and decoded Everscript bytecode from ROM.

## Navigating Scripts

- [rooms/](rooms/index.md) - Scripts grouped by room (enter scripts, step-on triggers, B-triggers)

## Direct Script Access

Read any script by SNES bus address or file offset:
- \`0x93c8a1.md\` or \`93c8a1.md\` - Full markdown disassembly
- \`0x93c8a1.evs\` - Plain Everscript source
- \`0x93c8a1.json\` - Structured instruction data

## Room Scripts

- \`rooms/<room-id>/enter.md\` (e.g. \`rooms/38/enter.md\`)
- \`rooms/<room-id>/step-on/<index>.md\`
- \`rooms/<room-id>/b-trigger/<index>.md\`

[index.json](index.json)
`;
}

function escapeCell(text) {
    return String(text || '').replace(/\|/g, '\\|');
}

module.exports = {
    fmtSnes,
    scriptMarkdown,
    scriptEverscript,
    roomScriptsIndexMarkdown,
    scriptsRootMarkdown,
};

