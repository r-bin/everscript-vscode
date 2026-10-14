// Ownership: a room analysis as Markdown, for people and for AI clients.
// Pure — text out, nothing read.

import { key, ramHex, Sym } from './sym';
import { EmittedScript } from './everscript';
import { RoomAnalysis, FlagNode, Scenario } from './room';
import { Part } from './segments';

const hx = (v: number, d = 6): string => '$' + v.toString(16).padStart(d, '0');

export function roomReport(r: RoomAnalysis): string {
    const out: string[] = [];
    out.push(`# Room 0x${r.mapId.toString(16).padStart(2, '0')} — ${r.name}`, '');
    out.push(`Enter script ${hx(r.enterEntry)}. Simulated from an unknown save; assumptions: ` +
        (r.pins.length ? [...new Set(r.pins.map((p) => p.why ?? `${ramHex(p.addr)} = ${p.value}`))].join('; ') : 'none') + '.', '');
    if (r.capped) out.push('> The fork cap stopped the enter script early: the scenarios below are not all of them.', '');
    out.push('## Flag tree', '', ...tree(r.flags, r.scenarios, ''), '');
    r.scenarios.forEach((s, i) => out.push(...scenario(s, i), ''));
    out.push('## Triggers', '');
    for (const c of r.clusters) {
        out.push(`### ${c.kind}: ${c.title}`, '');
        for (const t of c.triggers) {
            const tr = r.triggers.find((x) => x.type === t.type && x.index === t.index)!;
            const a = tr.analysis;
            const where = `[${tr.rect.x1.toString(16)},${tr.rect.y1.toString(16)}:${tr.rect.x2.toString(16)},${tr.rect.y2.toString(16)}]`;
            const cases = a.cases.map((k) => `${k.label}${k.when.length ? ' when ' + k.when.map((w) => w.text).join(' & ') : ''}`).join('; ');
            out.push(`- ${t.type} #${t.index} ${where} ${hx(a.entry)}: ${cases || a.parts.map((p) => p.title).slice(0, 3).join(', ')}` +
                (a.always.length ? ` (needs ${a.always.map((w) => w.text).join(' & ')})` : '') +
                (a.kind !== 'loot' && a.cases.length ? a.otherwise.map((o) => `; otherwise (${o.when.map((w) => w.text).join(' & ')}): ${o.note}`).join('') : ''));
        }
        if (c.preparedBy.length) out.push(`- prepared by the enter script: ${c.preparedBy.map((p) => `object ${p.object} hidden when ${p.flag}`).join(', ')}`);
        out.push('');
    }
    return out.join('\n');
}

function tree(n: FlagNode, s: Scenario[], indent: string): string[] {
    if (!n.cond) return [`${indent}- → ${(n.scenarios ?? []).map((i) => `scenario ${i + 1}`).join(', ') || '(none)'}`];
    return [
        `${indent}- if ${n.cond.text}`, ...tree(n.then!, s, indent + '  '),
        `${indent}- else`, ...tree(n.else!, s, indent + '  '),
    ];
}

function scenario(s: Scenario, i: number): string[] {
    const out = [`## Scenario ${i + 1}: ${s.when.length ? s.when.map((w) => w.text).join(' & ') : 'always'}`, ''];
    if (s.either.length) out.push(`Holds either way: ${s.either.join(', ')}.`, '');
    out.push('**Prepare** (before the screen fades in)', '', ...parts(s.prepare, ''), '');
    out.push('**Execute**', '', ...(s.execute.length ? parts(s.execute, '') : ['- (nothing after the fade-in)']), '');
    if (s.background.length) {
        out.push('**Running alongside** (scripts the room starts; each runs at the tick the game runs it)', '');
        for (const b of s.background) {
            out.push(`- slot ${b.slot.toString(16)}: from ${b.started}${b.ended ? ` to ${b.ended}` : ', still running at the end'}`);
            out.push(...parts(b.parts, '  ').slice(0, 12));
        }
        out.push('');
    }
    const npcs = s.entities.map((e) => `| ${e.label} | ${e.x ?? '?'}, ${e.y ?? '?'} | ${e.refs.map(ramHex).join(' ') || '—'} | ${e.whenText} |`);
    if (npcs.length) out.push('| NPC | at | RAM | when |', '|---|---|---|---|', ...npcs);
    return out;
}

function parts(ps: Part[], indent: string): string[] {
    const out: string[] = [];
    for (const p of ps) {
        if (p.kind === 'if') {
            const then = p.then ?? [], other = p.else ?? [];
            if (!then.length) { out.push(`${indent}- if not ${key(p.cond!)}:`, ...parts(other, indent + '  ')); continue; }
            out.push(`${indent}- if ${key(p.cond!)}:`, ...parts(then, indent + '  '));
            if (other.length) out.push(`${indent}  else:`, ...parts(other, indent + '  '));
            continue;
        }
        out.push(`${indent}- ${p.kind}: ${p.title}`);
    }
    return out;
}

/**
 * The neutral form, as data: what happens under which condition, for the
 * enter script's scenarios and every trigger. No traces, no symbolic trees —
 * conditions as text and keys, parts as titles.
 */
export function roomSummary(r: RoomAnalysis): unknown {
    const cond = (w: { cond: Sym; value: boolean; text: string }) => ({ key: key(w.cond), value: w.value, text: w.text });
    const part = (p: Part): unknown => p.kind === 'if'
        ? { kind: 'if', cond: key(p.cond!), then: (p.then ?? []).map(part), else: (p.else ?? []).map(part) }
        : { kind: p.kind, title: p.title, at: hx(p.at) };
    return {
        mapId: r.mapId, name: r.name, enter: hx(r.enterEntry), capped: r.capped,
        assumptions: r.pins.map((p) => ({ addr: ramHex(p.addr), bit: p.bit ?? null, value: p.value, why: p.why ?? null })),
        scenarios: r.scenarios.map((s, i) => ({
            id: i + 1, when: s.when.map(cond), eitherWay: s.either,
            prepare: s.prepare.map(part), execute: s.execute.map(part),
            npcs: s.entities.map((e) => ({ label: e.label, npc: e.npc, x: e.x, y: e.y, ram: e.refs.map(ramHex), when: e.whenText })),
        })),
        triggers: r.triggers.map((t) => ({
            type: t.type, index: t.index, rect: t.rect, entry: hx(t.analysis.entry), kind: t.analysis.kind,
            detail: t.analysis.detail, capped: t.analysis.capped, needs: t.analysis.always.map(cond),
            cases: t.analysis.cases.map((c) => ({ label: c.label, when: c.when.map(cond), mapId: c.mapId,
                loot: c.loot && { item: c.loot.itemName, slot: c.loot.slot === null ? null : ramHex(c.loot.slot), object: c.loot.object } })),
        })),
        clusters: r.clusters,
    };
}

/** Every script of the room as Everscript that compiles to the same bytes, headed by what it does. */
export function roomEverscript(r: RoomAnalysis, emit: (entry: number, name: string) => EmittedScript): string {
    const out = [`// Room 0x${r.mapId.toString(16).padStart(2, '0')} — ${r.name}.`,
        '// Each function compiles to the bytes the ROM holds (structured where the flow allows, raw code() otherwise).', ''];
    const one = (entry: number, name: string, head: string[]): void => {
        try {
            out.push(...head.map((h) => `// ${h}`), emit(entry, name).everscript);
        } catch (e) {
            out.push(`// ${name} at ${hx(entry)}: not decompiled (${(e as Error).message})`, '');
        }
    };
    one(r.enterEntry, `room_${r.mapId.toString(16).padStart(2, '0')}_enter`,
        [`enter script: ${r.scenarios.length} scenarios (see simulation.md)`]);
    for (const t of r.triggers) {
        const a = t.analysis;
        const head = [`${t.type} #${t.index} [${t.rect.x1.toString(16)},${t.rect.y1.toString(16)}:${t.rect.x2.toString(16)},${t.rect.y2.toString(16)}] — ${a.kind}`,
            ...a.cases.map((c) => `  ${c.label}${c.when.length ? ' when ' + c.when.map((w) => w.text).join(' & ') : ''}`)];
        one(a.entry, `room_${r.mapId.toString(16).padStart(2, '0')}_${t.type === 'step-on' ? 'step' : 'b'}_${t.index}`, head);
    }
    return out.join('\n');
}
