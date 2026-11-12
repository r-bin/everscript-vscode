// Ownership: the Code tab's host side: answers the webview's requests from `soe://rom/code/` only.
// No VS Code dependency, no ROM access of its own: extension.js injects `read` (a soe:// file as
// text, as vscode.workspace.fs reads it) and `open` (show a soe:// file in an editor), so this
// domain imports nothing but its own types (VFS primacy: the tab shows what agents read).
//
//   page -> codeInit                    host -> codeIndex { routines } | { error }
//   page -> codeSearch { q }            host -> codeSearch { q, hits: [{ name, why }] } | { q, error }   (index.json?q=:
//                                       knowledge text, C, WRAM touched, asm comments, what it calls)
//   page -> codeRoutine { name }        host -> codeRoutine { name, routine } | { name, error }   (routine.json)
//   page -> codeText { name, version }  host -> codeText { name, version, text } | { …, error }   (version: asm | c | pseudo;
//                                       read when the page shows it, never with the routine)
//   page -> codeLines { name }          host -> codeLines { name, lines } | { name, error }   (lines.json: the asm as data,
//                                       named, with the CDL library's facts per line; asked instead of the asm text)
//   page -> codeOpen { name, file }     opens soe://rom/code/<name>/<file> in an editor

const BASE = 'soe://rom/code/';
const VERSIONS = ['asm', 'c', 'pseudo'] as const;
type Version = typeof VERSIONS[number];

/** One row of index.json, as far as the rail needs it. */
interface IndexRow { name: string; title: string; category: string | null; confidence: string | null; us: string; addr: string | null; c: string | null; todo: string[]; match?: string[] }
/** routine.json (resources/code-view.ts), as far as the host reads it. */
interface Routine { versions: Record<Version, string | { file: string } | null> }
interface Message { command: string; name?: unknown; version?: unknown; q?: unknown; file?: unknown }
interface Deps {
    post(message: object): void;
    /** A soe:// file as text; rejects when it does not exist or no ROM is loaded. */
    read(uri: string): Promise<string>;
    /** Shows a soe:// file in an editor; absent: the page hides its open links. */
    open?(uri: string): void;
}

const handlesCodeMessage = (command: unknown): boolean => typeof command === 'string' && command.startsWith('code');

/** A routine folder name as the VFS spells it (the page never sends a path). */
const NAME = /^[A-Za-z0-9_]+$/;
const message = (err: unknown): string => String(err instanceof Error ? err.message : err);

/** The routine's file for `version`, from its routine.json (null: there is none). */
function versionFile(routine: Routine, version: Version): string | null {
    const v = routine.versions[version];
    return v === null || v === undefined ? null : typeof v === 'string' ? v : v.file;
}

async function answer(msg: Message, deps: Deps): Promise<void> {
    const name = String(msg.name ?? '');
    switch (msg.command) {
        case 'codeInit': {
            const rows = JSON.parse(await deps.read(BASE + 'index.json')) as IndexRow[];
            deps.post({
                command: 'codeIndex', canOpen: !!deps.open,
                routines: rows.map((r) => ({ name: r.name, title: r.title, category: r.category, confidence: r.confidence, us: r.us, addr: r.addr, c: !!r.c, todo: r.todo.length })),
            });
            return;
        }
        case 'codeSearch': {
            const q = String(msg.q ?? '').trim();
            const rows = q ? JSON.parse(await deps.read(BASE + 'index.json?q=' + encodeURIComponent(q))) as IndexRow[] : [];
            deps.post({ command: 'codeSearch', q, hits: rows.map((r) => ({ name: r.name, why: r.match || [] })) });
            return;
        }
        case 'codeRoutine': {
            if (!NAME.test(name)) throw new Error('No routine ' + name);
            deps.post({ command: 'codeRoutine', name, routine: JSON.parse(await deps.read(BASE + name + '/routine.json')) });
            return;
        }
        case 'codeText': {
            const version = String(msg.version) as Version;
            if (!NAME.test(name) || !VERSIONS.includes(version)) throw new Error('No ' + version + ' for ' + name);
            const file = versionFile(JSON.parse(await deps.read(BASE + name + '/routine.json')) as Routine, version);
            if (!file) throw new Error('No ' + version + ' version of ' + name);
            deps.post({ command: 'codeText', name, version, text: await deps.read(BASE + name + '/' + file) });
            return;
        }
        case 'codeLines': {
            if (!NAME.test(name)) throw new Error('No routine ' + name);
            deps.post({ command: 'codeLines', name, lines: JSON.parse(await deps.read(BASE + name + '/lines.json')) });
            return;
        }
        case 'codeOpen': {
            const file = String(msg.file ?? '');
            if (deps.open && NAME.test(name) && /^[A-Za-z0-9_.]+$/.test(file)) deps.open(BASE + name + '/' + file);
            return;
        }
    }
}

function handleCodeMessage(msg: Message, deps: Deps): Promise<void> {
    return answer(msg, deps).catch((err) => {
        const command = msg.command === 'codeInit' ? 'codeIndex' : msg.command;
        deps.post({ command, name: msg.name, version: msg.version, q: msg.q, error: message(err) });
    });
}

export { handlesCodeMessage, handleCodeMessage };
