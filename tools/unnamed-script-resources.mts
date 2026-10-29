// tools/unnamed-script-resources.mts
// Parses all room scripts in Secret of Evermore and finds resources without a localized name/enum:
// - calls without script/global name (e.g. "call $92:de75;")
// - memory addresses without name/enum (e.g. "<0x244d> = last_entity();")
// - flags without name (e.g. "<0x226b, 0x01>")
// - animations without enum constant (e.g. "animate(dog(), 0x8004, LOOP);")
// - sounds without enum constant (e.g. "sound(170);")
// - music without enum constant (e.g. "music(60);")
//
// Usage: node tools/unnamed-script-resources.mts [romPath] [options]
// Options:
//   --category=<cat> | -c <cat>   Filter by: call, memory, flag, animation, sound, music, all (default: all)
//   --details | -d                Show full list of usage locations with code snippets
//   --markdown | -m               Output table in GitHub-Flavored Markdown
//   --json                        Output structured JSON
//   --help | -h                   Show this help

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = resolve(import.meta.dirname, '..');

const { hiromFileOffset } = require('../dist/platform');
const { ScriptRom, roomScripts, roomCount, scriptInstructions, facts, printed, tree } = require('../dist/games/evermore/script-vm');
const { printNames, mapName } = require('../dist/games/evermore/script-model');
const games = require('../dist/games');

export type ResourceCategory = 'call' | 'memory' | 'flag' | 'animation' | 'sound' | 'music';

export interface UsageSite {
    roomId: number;
    roomName: string;
    scriptType: string;
    insAddress: number;
    printedLine: string;
}

export interface UnnamedResource {
    category: ResourceCategory;
    resource: string;
    totalUses: number;
    roomCount: number;
    roomIds: number[];
    usages: UsageSite[];
}

function resolveRom(explicit?: string): string {
    if (explicit && existsSync(explicit)) return explicit;
    try {
        const fromLib = games.romPath?.('evermore') ?? games.baseRomPath?.('evermore');
        if (fromLib && existsSync(fromLib)) return fromLib;
    } catch { /* ignore */ }
    for (const f of readdirSync(ROOT)) {
        if ((f.endsWith('.smc') || f.endsWith('.sfc')) && existsSync(join(ROOT, f))) {
            return join(ROOT, f);
        }
    }
    console.error('Error: Could not locate Evermore ROM.');
    console.error('Specify path: node tools/unnamed-script-resources.mts <path-to-rom.smc>');
    process.exit(2);
}

function parseArgs(args: string[]): { romPath?: string; category: string; details: boolean; markdown: boolean; json: boolean; help: boolean } {
    let romPath: string | undefined;
    let category = 'all';
    let details = false;
    let markdown = false;
    let json = false;
    let help = false;

    for (const arg of args) {
        if (arg === '--help' || arg === '-h') help = true;
        else if (arg === '--details' || arg === '-d') details = true;
        else if (arg === '--markdown' || arg === '-m') markdown = true;
        else if (arg === '--json') json = true;
        else if (arg.startsWith('--category=')) category = arg.slice(11).toLowerCase();
        else if (arg === '-c') { /* next arg handled if needed */ }
        else if (!arg.startsWith('-') && !romPath) romPath = arg;
    }
    return { romPath, category, details, markdown, json, help };
}

export function parseUnnamedResources(bytes: Uint8Array): Map<string, UnnamedResource> {
    const rom = new ScriptRom(bytes);
    const names = printNames(hiromFileOffset);
    const count = roomCount(rom);
    const resources = new Map<string, UnnamedResource>();

    function addUsage(category: ResourceCategory, resource: string, usage: UsageSite): void {
        const key = `${category}:${resource}`;
        let entry = resources.get(key);
        if (!entry) {
            entry = { category, resource, totalUses: 0, roomCount: 0, roomIds: [], usages: [] };
            resources.set(key, entry);
        }
        entry.totalUses++;
        if (!entry.roomIds.includes(usage.roomId)) {
            entry.roomIds.push(usage.roomId);
            entry.roomCount = entry.roomIds.length;
        }
        entry.usages.push(usage);
    }

    for (let r = 0; r < count; r++) {
        const rs = roomScripts(rom, r);
        const roomTitle = mapName(r) || `Room ${r}`;
        const scriptEntries: Array<{ scriptType: string; entry: number }> = [];

        if (rs.enter !== null) {
            scriptEntries.push({ scriptType: 'enter', entry: rs.enter });
        }
        rs.triggers.forEach((t: { kind: string; id: number; script: number; x1: number; y1: number; x2: number; y2: number }, idx: number) => {
            scriptEntries.push({
                scriptType: `${t.kind} #${idx} (id 0x${t.id.toString(16)}, [${t.x1},${t.y1}]-[${t.x2},${t.y2}])`,
                entry: t.script,
            });
        });

        // Deduplicate script entry points per room while preserving script types
        const entryGroups = new Map<number, string[]>();
        for (const se of scriptEntries) {
            const list = entryGroups.get(se.entry) ?? [];
            list.push(se.scriptType);
            entryGroups.set(se.entry, list);
        }

        for (const [entry, scriptTypes] of entryGroups.entries()) {
            const label = scriptTypes.join(', ');
            let instructions: any[] = [];
            try {
                instructions = scriptInstructions(rom, entry);
            } catch {
                continue;
            }

            for (const ins of instructions) {
                const f = facts(ins);
                const printedRes = printed(ins, names);
                const txt = printedRes.text;
                const site: UsageSite = {
                    roomId: r,
                    roomName: roomTitle,
                    scriptType: label,
                    insAddress: ins.address,
                    printedLine: txt,
                };

                // 1. Calls: "call $92:de75;", "call_id(0x..)", "call_trigger(0x..)"
                if (f.k === 'call') {
                    if (f.global !== null) {
                        const hasName = names.global?.(f.global) || (f.target !== null && names.script?.(f.target));
                        if (!hasName) {
                            addUsage('call', `call_id(0x${f.global.toString(16).padStart(2, '0')})`, site);
                        }
                    } else if (f.trigger !== null) {
                        const hasName = f.target !== null && names.script?.(f.target);
                        if (!hasName) {
                            addUsage('call', `call_trigger(0x${f.trigger.toString(16).padStart(4, '0')})`, site);
                        }
                    } else if (f.target !== null) {
                        const hasName = names.script?.(f.target);
                        if (!hasName) {
                            const bank = (f.target >>> 16).toString(16).padStart(2, '0');
                            const addr = (f.target & 0xffff).toString(16).padStart(4, '0');
                            addUsage('call', `call $${bank}:${addr}`, site);
                        }
                    }
                }

                // 2. Sound: "sound(170);"
                if (f.k === 'sound') {
                    const soundName = names.constant?.('SOUND', f.index);
                    if (!soundName) {
                        addUsage('sound', `sound(${f.index})`, site);
                    }
                }

                // 3. Music: "music(60);"
                if (f.k === 'music') {
                    const musicName = names.constant?.('MUSIC', f.index);
                    if (!musicName) {
                        addUsage('music', `music(${f.index})`, site);
                    }
                }

                // 4. Animation: "animate(dog(), 0x8004, LOOP);"
                if (ins.opcode === 0x78 || ins.opcode === 0x79) {
                    const o = ins.operands;
                    const animId = o[1] && 'value' in o[1] ? o[1].value : 0;
                    const e = o[0].k === 'E' ? tree(o[0].expr) : null;
                    const who = e && e.k === 'value' ? e.term.spec.name : '';
                    const enumTypes = who === 'boy' ? ['ANIMATION_BOY'] : who === 'dog' ? ['ANIMATION_DOG'] : ['ANIMATION_PLACEHOLDER', 'ANIMATION_ENEMY', 'ANIMATION_ALL'];
                    const animName = enumTypes.map((t) => names.constant?.(t, animId)).find(Boolean);
                    if (!animName) {
                        addUsage('animation', `0x${animId.toString(16).padStart(4, '0')}`, site);
                    }
                }

                // 5. Memory: "<0x244d> = last_entity();" and Flags: "<0x226b, 0x01>"
                if (f.k === 'write' && f.area !== 'local') {
                    if (!names.memory?.(f.addr) && (f.addr < 0x2834 || f.addr >= 0x2834 + 200)) {
                        addUsage('memory', `<0x${f.addr.toString(16).padStart(4, '0')}>`, site);
                    }
                }
                if (f.k === 'flag' && f.area !== 'local') {
                    if (!names.flag?.(f.addr, f.mask) && (f.addr < 0x2834 || f.addr >= 0x2834 + 200)) {
                        addUsage('flag', `<0x${f.addr.toString(16).padStart(4, '0')}, 0x${f.mask.toString(16).padStart(2, '0')}>`, site);
                    }
                }
                if (ins.opcode === 0x5D) {
                    const val = ins.operands[1]?.value ?? 0;
                    const addr = 0x2258 + (val >> 3);
                    const mask = 1 << (val & 7);
                    if (!names.flag?.(addr, mask)) {
                        addUsage('flag', `<0x${addr.toString(16).padStart(4, '0')}, 0x${mask.toString(16).padStart(2, '0')}>`, site);
                    }
                }

                // Check expressions for memory/flag reads
                for (const op of ins.operands) {
                    const exprs = op.k === 'E' ? [op.expr] : op.k === 'A' ? op.args : op.k === 'Z' ? op.list : [];
                    for (const ex of exprs) {
                        for (const t of ex.terms) {
                            if (t.spec.kind === 'read' && t.spec.area !== 'local') {
                                const base = t.spec.area === 'save' ? 0x2258 : 0x2834;
                                const addr = base + (t.value ?? 0);
                                if (!names.memory?.(addr) && (addr < 0x2834 || addr >= 0x2834 + 200)) {
                                    addUsage('memory', `<0x${addr.toString(16).padStart(4, '0')}>`, site);
                                }
                            } else if (t.spec.kind === 'flag' && t.spec.area !== 'local') {
                                const base = t.spec.area === 'save' ? 0x2258 : 0x2834;
                                const val = t.value ?? 0;
                                const addr = base + (val >> 3);
                                const mask = 1 << (val & 7);
                                if (!names.flag?.(addr, mask) && (addr < 0x2834 || addr >= 0x2834 + 200)) {
                                    addUsage('flag', `<0x${addr.toString(16).padStart(4, '0')}, 0x${mask.toString(16).padStart(2, '0')}>`, site);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    return resources;
}

function formatRoomSample(roomIds: number[], usages: UsageSite[]): string {
    const samples: string[] = [];
    const seenRooms = new Set<number>();
    for (const u of usages) {
        if (!seenRooms.has(u.roomId)) {
            seenRooms.add(u.roomId);
            const shortName = u.roomName.split('›').pop()?.trim() || `Room ${u.roomId}`;
            samples.push(`R${u.roomId} (${shortName})`);
            if (samples.length >= 3) break;
        }
    }
    const remaining = roomIds.length - samples.length;
    return samples.join(', ') + (remaining > 0 ? ` +${remaining} more` : '');
}

function printHelp(): void {
    console.log(`
Unnamed Script Resources Extractor
Parses all room scripts to find calls, memory addresses, flags, animations, sounds,
and music lacking localized names or enum constants.

Usage: node tools/unnamed-script-resources.mts [romPath] [options]

Options:
  --category=<cat>, -c <cat>  Filter by category (call, memory, flag, animation, sound, music, all)
  --details, -d               Print full usage locations and code snippet for each resource
  --markdown, -m              Output as GitHub-Flavored Markdown table
  --json                      Output as JSON
  --help, -h                  Show this help text
`);
}

function main(): void {
    const { romPath, category, details, markdown, json, help } = parseArgs(process.argv.slice(2));
    if (help) {
        printHelp();
        return;
    }

    const romFile = resolveRom(romPath);
    let bytes = new Uint8Array(readFileSync(romFile));
    if (bytes.length % 1024 === 512) bytes = bytes.subarray(512);

    const allResources = parseUnnamedResources(bytes);

    // Filter by category if specified
    const filtered = [...allResources.values()].filter((r) => category === 'all' || r.category === category);
    filtered.sort((a, b) => b.totalUses - a.totalUses || a.resource.localeCompare(b.resource));

    if (json) {
        console.log(JSON.stringify(filtered, null, 2));
        return;
    }

    if (markdown) {
        console.log('| Category | Resource | Uses | Rooms | Where Used | Sample Code |');
        console.log('|:---------|:---------|-----:|------:|:-----------|:------------|');
        for (const item of filtered) {
            const where = formatRoomSample(item.roomIds, item.usages);
            const sampleCode = '`' + item.usages[0].printedLine.replace(/`/g, '\\`').replace(/\|/g, '\\|') + '`';
            console.log(`| ${item.category} | \`${item.resource}\` | ${item.totalUses} | ${item.roomCount} | ${where} | ${sampleCode} |`);
        }
        return;
    }

    // Console table formatting
    console.log(`\nUnnamed Script Resources in Evermore Room Scripts (ROM: ${romFile})\n`);
    const pad = (s: string, len: number, right = false): string => right ? s.padStart(len) : s.padEnd(len);

    console.log(`${pad('Category', 11)} ${pad('Resource', 24)} ${pad('Uses', 6, true)} ${pad('Rooms', 7, true)}  ${pad('Where Used', 42)}  ${'Sample Instruction'}`);
    console.log(`${'-'.repeat(11)} ${'-'.repeat(24)} ${'-'.repeat(6)} ${'-'.repeat(7)}  ${'-'.repeat(42)}  ${'-'.repeat(30)}`);

    for (const item of filtered) {
        const cat = pad(item.category, 11);
        const res = pad(item.resource, 24);
        const uses = pad(String(item.totalUses), 6, true);
        const rooms = pad(String(item.roomCount), 7, true);
        const where = pad(formatRoomSample(item.roomIds, item.usages), 42);
        const sample = item.usages[0]?.printedLine ?? '';
        console.log(`${cat} ${res} ${uses} ${rooms}  ${where}  ${sample}`);

        if (details) {
            for (const u of item.usages) {
                const hexAddr = '$' + (u.insAddress >>> 16).toString(16).padStart(2, '0') + ':' + (u.insAddress & 0xffff).toString(16).padStart(4, '0');
                console.log(`    ↳ R${u.roomId} (${u.roomName}) [${u.scriptType}] at ${hexAddr}: ${u.printedLine}`);
            }
            console.log('');
        }
    }

    // Summary counts
    const summary = new Map<string, { resources: number; uses: number }>();
    for (const item of filtered) {
        const s = summary.get(item.category) ?? { resources: 0, uses: 0 };
        s.resources++;
        s.uses += item.totalUses;
        summary.set(item.category, s);
    }

    console.log('\n--- Summary ---');
    for (const [cat, s] of summary.entries()) {
        console.log(`  ${pad(cat + ':', 12)} ${pad(String(s.resources), 5, true)} distinct resources, ${pad(String(s.uses), 6, true)} total occurrences`);
    }
    console.log(`  Total:       ${pad(String(filtered.length), 5, true)} distinct resources across all categories\n`);
}

if (process.argv[1]?.endsWith('unnamed-script-resources.mts')) {
    main();
}
