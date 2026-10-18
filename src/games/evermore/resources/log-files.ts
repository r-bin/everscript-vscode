// Ownership: `soe://logs/` — Virtual file system for emulator runtime logs:
// crashes (crashes.json, crashes.md), script trace history (script-trace.log,
// script-trace.json), and ROM launches (launches.json, launches.md).
//
// All markdown and text generated in this file is strictly ASCII-only.

import { dir, json, text } from './nodes';
import type { VfsNode } from './nodes';

/** One crash report from the emulator panel (emulator-log.js). */
interface CrashLog {
    timestamp?: string; error?: string; rom?: string; frame?: number | null; mapId?: number | null;
    camX?: number | null; camY?: number | null; stack?: string;
    cpu?: { pc?: number; pb?: number; a?: number; x?: number; y?: number; sp?: number; db?: number; p?: number };
    scriptSlots?: { slot: number; state: string; loc?: number | null; entity?: number | null }[];
}
interface LaunchLog { timestamp?: string; name?: string; size?: number | null }
interface TraceLog { line?: string; tag?: string; timeStr?: string; slot?: number; entity?: string; event?: string; locHex?: string; summary?: string }
interface RuntimeLogs { crashes?: CrashLog[]; launches?: LaunchLog[]; scriptTrace?: TraceLog[] }

function resolveLogs(segments: string[], getLogs?: () => RuntimeLogs | null | undefined): VfsNode | null {
    const fetchLogs = (): RuntimeLogs => {
        if (typeof getLogs === 'function') {
            try {
                return getLogs() || {};
            } catch (_) {}
        }
        return { crashes: [], launches: [], scriptTrace: [] };
    };

    const [head] = segments;

    if (head === undefined) {
        return dir([
            ['index.md', 'file'],
            ['crashes.json', 'file'],
            ['crashes.md', 'file'],
            ['launches.json', 'file'],
            ['launches.md', 'file'],
            ['script-trace.log', 'file'],
            ['script-trace.json', 'file'],
        ], () => formatIndexMd(fetchLogs()));
    }

    if (head === 'index.md') {
        return text(() => formatIndexMd(fetchLogs()), true);
    }

    if (head === 'crashes.json') {
        return json(() => fetchLogs().crashes || [], true);
    }

    if (head === 'crashes.md') {
        return text(() => formatCrashesMd(fetchLogs().crashes || []), true);
    }

    if (head === 'launches.json') {
        return json(() => fetchLogs().launches || [], true);
    }

    if (head === 'launches.md') {
        return text(() => formatLaunchesMd(fetchLogs().launches || []), true);
    }

    if (head === 'script-trace.log') {
        return text(() => formatScriptTraceLog(fetchLogs().scriptTrace || []), true);
    }

    if (head === 'script-trace.json') {
        return json(() => fetchLogs().scriptTrace || [], true);
    }

    return null;
}

function formatIndexMd(logs: RuntimeLogs): string {
    const crashes = logs.crashes || [];
    const launches = logs.launches || [];
    const trace = logs.scriptTrace || [];

    return `# Emulator Runtime Logs

Real-time runtime activity from the embedded SNES emulator.

| Log | Format | Entries | Description |
|---|---|---|---|
| [crashes.md](crashes.md) / [crashes.json](crashes.json) | Markdown / JSON | ${crashes.length} | Emulator crash reports with CPU state, PC, and active script slots |
| [launches.md](launches.md) / [launches.json](launches.json) | Markdown / JSON | ${launches.length} | ROM launch history and test runs |
| [script-trace.log](script-trace.log) / [script-trace.json](script-trace.json) | Text / JSON | ${trace.length} | Execution trace of Everscript bytecode, triggers, and script slots |
`;
}

function formatCrashesMd(crashes: CrashLog[]): string {
    if (!crashes.length) {
        return '# Emulator Crash Log\n\nNo emulator crashes recorded.\n';
    }

    let out = '# Emulator Crash Log\n\n' + crashes.length + ' crash(es) recorded:\n\n';
    for (let i = crashes.length - 1; i >= 0; i--) {
        const c = crashes[i];
        out += `## Crash at ${c.timestamp || 'unknown'}\n\n`;
        out += `- **Error:** \`${c.error || 'Unknown error'}\`\n`;
        out += `- **ROM:** \`${c.rom || 'unknown'}\`\n`;
        if (c.frame != null) out += `- **Frame:** ${c.frame}\n`;
        if (c.mapId != null) out += `- **Map ID:** 0x${c.mapId.toString(16).toUpperCase()} (${c.mapId})\n`;
        if (c.camX != null || c.camY != null) out += `- **Camera:** X=${c.camX ?? 0}, Y=${c.camY ?? 0}\n`;

        if (c.cpu) {
            const h = (v: number | undefined, len: number): string => (typeof v === 'number' ? (v >>> 0).toString(16).toUpperCase().padStart(len, '0') : '????');
            out += `\n### SNES CPU State\n\n`;
            out += `\`\`\`\n`;
            out += `PC: $${h(c.cpu.pc, 6)} (PB: $${h(c.cpu.pb, 2)})   A: $${h(c.cpu.a, 4)}   X: $${h(c.cpu.x, 4)}   Y: $${h(c.cpu.y, 4)}\n`;
            out += `SP: $${h(c.cpu.sp, 4)}   DB: $${h(c.cpu.db, 2)}   P: $${h(c.cpu.p, 2)}\n`;
            out += `\`\`\`\n`;
        }

        if (c.scriptSlots && c.scriptSlots.length > 0) {
            out += `\n### Active Script Slots\n\n`;
            out += `| Slot | State | Loc | Entity |\n|---|---|---|---|\n`;
            for (const s of c.scriptSlots) {
                const locHex = s.loc != null ? '0x' + (s.loc >>> 0).toString(16).toUpperCase().padStart(6, '0') : '0x000000';
                out += `| ${s.slot} | ${s.state} | \`${locHex}\` | ${s.entity != null ? '0x' + (s.entity >>> 0).toString(16).toUpperCase() : '-'} |\n`;
            }
            out += '\n';
        }

        if (c.stack) {
            out += `\n### Stack Trace\n\n\`\`\`\n${c.stack}\n\`\`\`\n`;
        }
        out += '\n---\n\n';
    }
    return out;
}

function formatLaunchesMd(launches: LaunchLog[]): string {
    if (!launches.length) {
        return '# ROM Launches\n\nNo ROM launches recorded.\n';
    }

    let out = '# ROM Launches\n\n| Timestamp | ROM Name | Size |\n|---|---|---|\n';
    for (let i = launches.length - 1; i >= 0; i--) {
        const l = launches[i];
        const sizeStr = l.size != null ? `${(l.size / 1024).toFixed(1)} KB` : '-';
        out += `| ${l.timestamp || '-'} | \`${l.name || 'unknown'}\` | ${sizeStr} |\n`;
    }
    return out + '\n';
}

function formatScriptTraceLog(trace: TraceLog[]): string {
    if (!trace.length) {
        return '[No script trace entries recorded]\n';
    }

    return trace.map(entry => {
        if (entry.line) return entry.line;
        const tag = entry.tag ? ` [${entry.tag}]` : '';
        return `[${entry.timeStr || ''}] [s${entry.slot} | ${entry.entity} | ${entry.event}]${tag} ${entry.locHex}: ${entry.summary || ''}`;
    }).join('\n') + '\n';
}

export type { RuntimeLogs, CrashLog, LaunchLog, TraceLog };
export { resolveLogs, formatIndexMd, formatCrashesMd, formatLaunchesMd, formatScriptTraceLog };

