'use strict';
// Ownership: `soe://tags/` — the tag graph (tag-model.js) as files.
// docs/soe-tags-spec.md. Reads other `soe://` files only through the injected
// `read(uri)` / `exists(uri)`, which fs-provider.js wires to itself.
//
//   soe://tags/index.md, index.json      roots, every id, aliases
//   soe://tags/check.json                load errors, broken links      (live)
//   soe://tags/<a>/<b>.md, .json         the tag a.b; live when it links WRAM
//   soe://tags/<a>/index.md, index.json  a tag with sub-tags (own + inherited)
//   soe://tags/<a>.md                    → <a>/index.md (link, unlisted)
//   soe://tags/map/5c.md                 alias → map/raptors.md (link, unlisted)
//   soe://tags/search/<word>.md, .json   tags whose id or title contains <word>

const { tagModel } = require('./tag-model');
const { pageUri, formatValue, tagJson, tagMarkdown, rootMarkdown, searchMarkdown } = require('./tag-markdown');
const { dir, link, json, text } = require('./nodes');

const LIVE_LINK = /^soe:\/\/(ram|bus\/7[ef])/i;
const MAX_LIVE_READS = 64;

/**
 * @param {string[]} segments
 * @param {{ read: (uri: string) => Promise<Uint8Array>, exists: (uri: string) => boolean|null, model?: object }} ctx
 */
function resolveTags(segments, ctx) {
    const model = ctx.model || tagModel();
    const [head, leaf, ...extra] = segments;
    if (head === undefined) {
        return dir([['index.json', 'file'], ['check.json', 'file'], ['search', 'dir'], ...entriesOf(model, model.roots())],
            () => rootMarkdown(model));
    }
    if (segments.length === 1) {
        if (head === 'index.md') return text(() => rootMarkdown(model));
        if (head === 'index.json') return json(() => indexJson(model));
        if (head === 'check.json') return json(() => check(model, ctx), true);
    }
    if (head === 'search') {
        if (leaf === undefined) return dir([], () => searchMarkdown(model, ''));
        const m = /^(.+)\.(md|json)$/.exec(leaf);
        if (!m || extra.length) return null;
        const word = m[1].toLowerCase();
        return m[2] === 'md' ? text(() => searchMarkdown(model, word))
            : json(() => model.search(word).map(id => ({ id, title: model.title(id), page: pageUri(model, id) })));
    }

    const prefix = segments.slice(0, -1).join('.');
    const last = segments[segments.length - 1];
    if (prefix && !model.resolve(prefix)?.id) return null;
    if (prefix && model.resolve(prefix).alias) return null;
    if (last === 'index.md' || last === 'index.json') {
        if (!model.isDir(prefix)) return null;
        return page(model, ctx, prefix, last.endsWith('.md') ? 'md' : 'json');
    }
    const m = /^(.+)\.(md|json)$/.exec(last);
    const id = (prefix ? prefix + '.' : '') + (m ? m[1] : last);
    const r = model.resolve(id);
    if (!r) return null;
    if (!m) return model.isDir(r.id) && !r.alias ? dir(entriesOf(model, [...model.children(r.id).values()].map(k => k.id)).concat([['index.json', 'file']]), null) : null;
    const node = page(model, ctx, r.id, m[2]);
    if (r.alias || model.isDir(r.id)) return link(node, pageUri(model, r.id, m[2]));
    return node;
}

/** Directory entries for these tag ids: a sub-directory for a tag with sub-tags, else `<name>.md` and `<name>.json`. */
function entriesOf(model, ids) {
    const out = [];
    for (const id of ids) {
        const name = id.slice(id.lastIndexOf('.') + 1);
        if (model.isDir(id)) out.push([name, 'dir']);
        else out.push([name + '.md', 'file'], [name + '.json', 'file']);
    }
    return out;
}

function liveLinks(model, id) {
    const uris = [];
    const take = l => { if (LIVE_LINK.test(l.uri) && !uris.includes(l.uri)) uris.push(l.uri); };
    (model.tags.get(id)?.links || []).forEach(take);
    for (const k of model.children(id).values()) {
        const first = (model.tags.get(k.id)?.links || []).find(l => LIVE_LINK.test(l.uri));
        if (first) take(first);
    }
    return uris.length <= MAX_LIVE_READS ? uris : [];
}

function page(model, ctx, id, ext) {
    const uris = liveLinks(model, id);
    const produce = async () => {
        const { values, live } = await readValues(ctx, uris);
        return ext === 'md' ? tagMarkdown(model, id, values, live) : { ...tagJson(model, id, values), live: live || undefined };
    };
    return ext === 'md' ? text(produce, uris.length > 0) : json(produce, uris.length > 0);
}

async function readValues(ctx, uris) {
    const values = new Map();
    if (!uris.length) return { values, live: null };
    let firstError = null;
    await Promise.all(uris.map(async uri => {
        try {
            const v = formatValue(uri, await ctx.read(uri));
            if (v !== null) values.set(uri, v);
        } catch (err) {
            firstError = firstError || err;
        }
    }));
    if (values.size) return { values, live: null };
    const why = firstError && firstError.message ? firstError.message : 'no game running';
    return { values, live: `unavailable (${why.replace(/^.*?: /, '')}); start a game in the Everscript emulator` };
}

function indexJson(model) {
    return {
        roots: model.roots(),
        tags: model.ids().map(id => ({ id, title: model.title(id) || undefined, page: pageUri(model, id) })),
        aliases: Object.fromEntries(model.aliases),
    };
}

/** Load errors plus every link checked against the file system: broken, ok, or unchecked (no ROM). */
function check(model, ctx) {
    const broken = [], unchecked = [];
    let ok = 0;
    for (const t of model.tags.values()) {
        for (const l of [...t.links, ...t.claims]) {
            if (!l.uri.startsWith('soe://')) continue;
            const e = ctx.exists(l.uri);
            if (e === true) ok++;
            else if (e === false) broken.push({ tag: t.id, uri: l.uri });
            else unchecked.push({ tag: t.id, uri: l.uri });
        }
    }
    return {
        ok: model.errors.length === 0 && broken.length === 0,
        tags: model.tags.size,
        aliases: model.aliases.size,
        errors: model.errors,
        links: { ok, broken, unchecked: unchecked.length, uncheckedSample: unchecked.slice(0, 10) },
    };
}

module.exports = { resolveTags };
