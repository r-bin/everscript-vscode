// Ownership: the `soe://tags/` graph — merges generated tags (tag-generate.ts)
// with the hand-authored tags/tags.json, resolves inheritance, aliases,
// back-links and conflicts, and validates. Pure. docs/soe-tags-spec.md §5–§6.
//
// A tag id is dotted (`boy.hp`); `a.b` is the sub-tag `b` of `a`.
// Inheritance: a tag inherits the sub-tags of every ancestor (`parents`, any
// number, transitively). A sub-tag `boy.hp` also inherits from the matching
// sub-tag of each of `boy`'s ancestors (`character.hp`), so titles and
// further sub-tags flow down. A sub-tag an ancestor defines but the tag does
// not is *virtual*: it resolves, shows the inherited title, and is listed as
// "not mapped yet".

import AUTHORED from './tags/tags.json';
import { generatedTags } from './tag-generate';

/** A link or a claim of a tag. */
interface TagLink { uri: string; role?: string; source?: string; status?: string; text?: string }
/** One node of the graph. */
interface Tag {
    id: string; title: string | null; altTitles: string[]; parents: string[]; links: TagLink[]; claims: TagLink[]; see: string[];
    size: unknown; source: string | null; status: string | null; children: Set<string>; origins: Set<string>;
}
/** A definition as written in tags.json or built by tag-generate.ts. */
interface TagDefinition {
    title?: string; parents?: string[]; see?: string[]; links?: (string | TagLink)[]; claims?: (string | TagLink)[];
    size?: unknown; source?: string; status?: string; sub?: Record<string, TagDefinition>; aliases?: Record<string, string>;
}
type Sources = [string, Record<string, unknown>][];

const ID = /^[a-z0-9_]+(\.[a-z0-9_]+)*$/;
const SOE_LINK = /^soe:\/\/(rom|ram|bus|localization|localizations|tags)\/\S*$/;
const WORKSPACE_LINK = /^(?![a-z][a-z0-9+.-]*:)[^\s]+$/i;

const parentOf = (id: string): string | null => (id.includes('.') ? id.slice(0, id.lastIndexOf('.')) : null);
const lastOf = (id: string): string => id.slice(id.lastIndexOf('.') + 1);

function newTag(id: string): Tag {
    return { id, title: null, altTitles: [], parents: [], links: [], claims: [], see: [], size: null, source: null, status: null, children: new Set(), origins: new Set() };
}

function normLink(l: string | TagLink): TagLink {
    return typeof l === 'string' ? { uri: l } : { uri: l.uri, role: l.role, source: l.source, status: l.status, text: l.text };
}

class TagModel {
    _anc = new Map<string, string[]>();
    _refBy = new Map<string, string[]>();   // id → [ids whose `see` names it]
    _byUri = new Map<string, { id: string; kind: 'link' | 'claim'; entry: TagLink }[]>();   // uri → who links or claims it

    /**
     * @param tags    id → tag (real tags only)
     * @param aliases alias id → real id
     * @param errors  load problems, as text
     */
    constructor(readonly tags: Map<string, Tag>, readonly aliases: Map<string, string>, readonly errors: string[]) {
        for (const t of tags.values()) {
            for (const s of t.see) push(this._refBy, s, t.id);
            for (const l of t.links) push(this._byUri, l.uri, { id: t.id, kind: 'link', entry: l });
            for (const c of t.claims) push(this._byUri, c.uri, { id: t.id, kind: 'claim', entry: c });
        }
    }

    roots() { return [...this.tags.values()].filter(t => !parentOf(t.id)).map(t => t.id).sort(); }
    ids() { return [...this.tags.keys()].sort(); }

    /** Real tags that `id` inherits from, nearest first, without duplicates. */
    ancestors(id: string): string[] {
        if (this._anc.has(id)) return this._anc.get(id)!;
        this._anc.set(id, []);   // guards recursion; explicit cycles are removed at load
        const out: string[] = [];
        const add = (a: string): void => { if (a !== id && !out.includes(a)) out.push(a); };
        const own = this.tags.get(id);
        const queue = own ? [...own.parents] : [];
        while (queue.length) {
            const p = queue.shift()!;
            if (out.includes(p) || p === id) continue;
            add(p);
            queue.push(...(this.tags.get(p)?.parents || []));
        }
        const parent = parentOf(id);
        if (parent) {
            for (const a of this.ancestors(parent)) {
                const twin = `${a}.${lastOf(id)}`;
                if (this.tags.has(twin)) { add(twin); this.ancestors(twin).forEach(add); }
            }
        }
        this._anc.set(id, out);
        return out;
    }

    /** `{ id, real, virtual }` for a real or virtual tag; `alias` names the target of an alias. */
    resolve(id: string): { id: string; alias?: string; real?: boolean; virtual?: boolean } | null {
        if (this.aliases.has(id)) return { id: this.aliases.get(id)!, alias: id };
        if (this.tags.has(id)) return { id, real: true };
        const parent = parentOf(id);
        if (!parent || !this.resolve(parent) || this.aliases.has(parent)) return null;
        return this.ancestors(id).length ? { id, virtual: true } : null;
    }

    title(id: string): string | null {
        const own = this.tags.get(id);
        if (own && own.title) return own.title;
        for (const a of this.ancestors(id)) if (this.tags.get(a)!.title) return this.tags.get(a)!.title;
        return null;
    }

    /** Sub-tags of `id`, own and inherited: name → { id, own, from: [the ancestors' sub-tags of that name] }. */
    children(id: string) {
        const out = new Map<string, { id: string; own: boolean; from: string[] }>();
        const own = this.tags.get(id);
        for (const c of own ? own.children : []) out.set(lastOf(c), { id: c, own: true, from: [] });
        for (const a of this.ancestors(id)) {
            for (const c of this.tags.get(a)!.children) {
                const name = lastOf(c);
                const e = out.get(name) || { id: `${id}.${name}`, own: false, from: [] };
                e.from.push(c);
                out.set(name, e);
            }
        }
        return new Map([...out.entries()].sort((x, y) => x[0].localeCompare(y[0])));
    }

    isDir(id: string): boolean { return this.children(id).size > 0; }
    referencedBy(id: string): string[] { return this._refBy.get(id) || []; }

    /** Claims that disagree with a link elsewhere, seen from `id`'s links and claims. */
    conflicts(id: string) {
        const t = this.tags.get(id);
        if (!t) return [];
        const out: { uri: string; claim: TagLink & { id: string }; link: TagLink & { id: string } }[] = [];
        for (const c of t.claims) {
            for (const o of this._byUri.get(c.uri) || []) {
                if (o.kind === 'link' && o.id !== id) out.push({ uri: c.uri, claim: { id, ...c }, link: { id: o.id, ...o.entry } });
            }
        }
        for (const l of t.links) {
            for (const o of this._byUri.get(l.uri) || []) {
                if (o.kind === 'claim' && o.id !== id) out.push({ uri: l.uri, claim: { id: o.id, ...o.entry }, link: { id, ...l } });
            }
        }
        return out;
    }

    /** Tags whose id segment, alias or title contains `word`. */
    search(word: unknown): string[] {
        const w = String(word).toLowerCase();
        if (!w) return [];
        const hits = new Set<string>();
        for (const t of this.tags.values()) {
            if (lastOf(t.id).includes(w) || (t.title || '').toLowerCase().includes(w)) hits.add(t.id);
        }
        for (const [a, target] of this.aliases) if (lastOf(a) === w) hits.add(target);
        return [...hits].sort();
    }
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
    if (!map.has(key)) map.set(key, []);
    if (!map.get(key)!.includes(value)) map.get(key)!.push(value);
}

/**
 * Build the graph. `sources` is a list of `[origin, definitions]`, merged in
 * order: an entry adds to a tag that exists and never replaces what it holds.
 */
function buildTagModel(sources: Sources = [['generated', generatedTags()], ['tags.json', AUTHORED as Record<string, unknown>]]) {
    const tags = new Map<string, Tag>(), aliases = new Map<string, string>(), errors: string[] = [];
    const ensure = (id: string): Tag => {
        if (tags.has(id)) return tags.get(id)!;
        const t = newTag(id);
        tags.set(id, t);
        const p = parentOf(id);
        if (p) ensure(p).children.add(id);
        return t;
    };
    const add = (id: string, def: TagDefinition, origin: string): void => {
        if (!ID.test(id)) { errors.push(`${origin}: bad tag id "${id}"`); return; }
        if (!def || typeof def !== 'object') { errors.push(`${origin}: ${id} is not an object`); return; }
        const t = ensure(id);
        t.origins.add(origin);
        if (def.title) {
            if (!t.title) t.title = def.title;
            else if (t.title !== def.title && !t.altTitles.includes(def.title)) t.altTitles.push(def.title);
        }
        for (const p of def.parents || []) if (!t.parents.includes(p)) t.parents.push(p);
        for (const s of def.see || []) if (!t.see.includes(s)) t.see.push(s);
        for (const l of (def.links || []).map(normLink)) if (!t.links.some(x => x.uri === l.uri)) t.links.push(l);
        for (const c of (def.claims || []).map(normLink)) t.claims.push({ ...c, status: c.status || 'unverified' });
        if (def.size !== undefined && t.size === null) t.size = def.size;
        if (def.source !== undefined && t.source === null) t.source = def.source;
        if (def.status !== undefined && t.status === null) t.status = def.status;
        for (const [k, v] of Object.entries(def.sub || {})) add(`${id}.${k}`, v, origin);
        for (const [a, target] of Object.entries(def.aliases || {})) aliases.set(`${id}.${a}`, `${id}.${target}`);
    };
    for (const [origin, defs] of sources) {
        for (const [id, def] of Object.entries(defs)) if (id !== '//') add(id, def as TagDefinition, origin);
    }
    validate(tags, aliases, errors);
    return new TagModel(tags, aliases, errors);
}

function validate(tags: Map<string, Tag>, aliases: Map<string, string>, errors: string[]): void {
    for (const t of tags.values()) {
        t.parents = t.parents.filter(p => tags.has(p) || !errors.push(`${t.id}: unknown parent "${p}"`));
        t.see = t.see.filter(s => tags.has(s) || aliases.has(s) || !errors.push(`${t.id}: see names unknown tag "${s}"`));
        for (const l of [...t.links, ...t.claims]) {
            if (!l.uri || !(SOE_LINK.test(l.uri) || WORKSPACE_LINK.test(l.uri))) errors.push(`${t.id}: bad link "${l.uri}"`);
        }
    }
    for (const [a, target] of aliases) {
        if (tags.has(a)) errors.push(`alias ${a} hides a tag of the same id`);
        if (!tags.has(target)) errors.push(`alias ${a} names unknown tag "${target}"`);
    }
    // Explicit parent cycles: drop the edge that closes each one.
    const state = new Map<string, number>();
    const visit = (id: string): void => {
        state.set(id, 1);
        const t = tags.get(id)!;
        t.parents = t.parents.filter(p => {
            if (state.get(p) === 1) { errors.push(`${id}: inheritance cycle through "${p}"`); return false; }
            if (!state.get(p)) visit(p);
            return true;
        });
        state.set(id, 2);
    };
    for (const id of tags.keys()) if (!state.get(id)) visit(id);
}

let _default: TagModel | null = null;
/** The plugin's tag graph, built once. */
function tagModel() {
    if (!_default) _default = buildTagModel();
    return _default;
}

export type { Tag, TagLink, TagModel };
export { buildTagModel, tagModel };
