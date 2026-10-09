'use strict';
// Ownership: the Markdown and JSON views of `soe://tags/` pages. Pure: takes
// the tag model and already-read live values. Every link is an absolute
// `soe://` address, so an AI reading through MCP can open it as written.

const IMAGE = /\.(png|gif)(\?.*)?$/i;

const cell = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const tagPath = id => id.split('.').join('/');

/** The page address of a tag: `soe://tags/boy/index.md` for a tag with sub-tags, else `soe://tags/boy/hp.md`. */
function pageUri(model, id, ext = 'md') {
    return model.isDir(id) ? `soe://tags/${tagPath(id)}/index.${ext}` : `soe://tags/${tagPath(id)}.${ext}`;
}

const tagLink = (model, id) => `[${id}](${pageUri(model, id)})`;

/** A live value for display: a `ram/<addr>.json` word, a flag bit, or a short `.bin` as a little-endian number. */
function formatValue(uri, bytes) {
    if (/\.json(\?|$)/.test(uri)) {
        const v = JSON.parse(Buffer.from(bytes).toString('utf8'));
        if (typeof v.set === 'boolean') return v.set ? 'set' : 'clear';
        if (typeof v.word === 'number') return `${v.word} (${v.hex})${v.valueName ? ' ' + v.valueName : ''}`;
        if (typeof v.byte === 'number') return `${v.byte}`;
        return null;
    }
    if (bytes.length > 4) return `${bytes.length} bytes`;
    let n = 0;
    for (let i = bytes.length - 1; i >= 0; i--) n = n * 256 + bytes[i];
    return `${n} ($${n.toString(16).padStart(bytes.length * 2, '0')})`;
}

/** A tag as data. `values` maps a link uri to its live value. */
function tagJson(model, id, values = new Map()) {
    const t = model.tags.get(id);
    const kids = model.children(id);
    return {
        id,
        title: model.title(id),
        altTitles: t ? t.altTitles : [],
        virtual: !t,
        page: pageUri(model, id),
        parents: t ? t.parents : [],
        inheritsFrom: model.ancestors(id),
        size: t?.size ?? undefined,
        source: t?.source ?? undefined,
        status: t?.status ?? undefined,
        links: (t ? t.links : []).map(l => ({ ...l, value: values.get(l.uri) ?? undefined })),
        claims: t ? t.claims : [],
        conflicts: model.conflicts(id),
        sub: [...kids.entries()].map(([name, k]) => ({
            name, id: k.id, title: model.title(k.id), virtual: !model.tags.has(k.id), inheritedFrom: k.from,
            value: firstValue(model, k.id, values),
        })),
        see: t ? t.see : [],
        referencedBy: model.referencedBy(id),
        origins: t ? [...t.origins] : [],
    };
}

function firstValue(model, id, values) {
    for (const l of model.tags.get(id)?.links || []) if (values.has(l.uri)) return values.get(l.uri);
    return undefined;
}

function tagMarkdown(model, id, values = new Map(), live = null) {
    const j = tagJson(model, id, values);
    const out = [`# ${id}${j.title ? ': ' + j.title : ''}`, ''];
    if (j.altTitles.length) out.push(`Also called: ${j.altTitles.join(' · ')}`, '');
    if (j.virtual) out.push(`**Not mapped yet.** Inherited from ${model.ancestors(id).map(a => tagLink(model, a)).join(', ')}; no links for this tag.`, '');
    else if (j.inheritsFrom.length) out.push(`Inherits from: ${j.inheritsFrom.map(a => tagLink(model, a)).join(' · ')}`, '');
    const facts = [
        j.size ? `**Size:** ${j.size} byte${j.size === 1 ? '' : 's'}` : null,
        j.status ? `**Status:** ${j.status}` : null,
        j.source ? `**Source:** ${j.source}` : null,
        live ? `**Live values:** ${live}` : null,
    ].filter(Boolean);
    if (facts.length) out.push(facts.join(' · '), '');

    if (j.links.length) {
        out.push('## Links', '', '| Resource | Role | Value | Source |', '|---|---|---|---|');
        for (const l of j.links) {
            out.push(`| [${cell(l.uri)}](${l.uri}) | ${cell(l.role)}${l.status ? ` (${l.status})` : ''} | ${cell(l.value ?? '')} | ${cell(l.source)} |`);
        }
        out.push('');
        const images = j.links.filter(l => IMAGE.test(l.uri));
        for (const l of images) out.push(`![${cell(l.role || id)}](${l.uri})`, '');
    }
    if (j.conflicts.length) {
        out.push('## Conflicts', '', '| Address | Claim | Mapped as |', '|---|---|---|');
        for (const c of j.conflicts) {
            out.push(`| [${cell(c.uri)}](${c.uri}) | ${cell(c.claim.text)} (${cell(c.claim.source)}, on ${tagLink(model, c.claim.id)}) | ${tagLink(model, c.link.id)} (${cell(c.link.source || c.link.role || 'tags.json')}) |`);
        }
        out.push('');
    }
    if (j.claims.length) {
        out.push('## Unverified claims', '');
        for (const c of j.claims) out.push(`- [${c.uri}](${c.uri}): "${c.text}" (${c.source || 'no source'}, ${c.status})`);
        out.push('');
    }
    if (j.sub.length) {
        out.push(`## Sub-tags (${j.sub.length})`, '', '| Tag | Title | Value | From |', '|---|---|---|---|');
        for (const s of j.sub) {
            const from = s.inheritedFrom.length ? s.inheritedFrom.map(a => tagLink(model, a)).join(', ') : 'own';
            out.push(`| [${s.name}](${pageUri(model, s.id)}) | ${cell(s.title)} | ${s.virtual ? '*not mapped yet*' : cell(s.value ?? '')} | ${from} |`);
        }
        out.push('');
    }
    if (j.see.length) out.push('## See also', '', j.see.map(s => tagLink(model, model.resolve(s)?.id || s)).join(' · '), '');
    if (j.referencedBy.length) out.push('## Referenced by', '', j.referencedBy.map(s => tagLink(model, s)).join(' · '), '');
    const parent = id.includes('.') ? id.slice(0, id.lastIndexOf('.')) : null;
    out.push('---', '', `Up: ${parent ? tagLink(model, parent) : '[soe://tags/](soe://tags/index.md)'} · [as JSON](${pageUri(model, id, 'json')})`, '');
    return out.join('\n');
}

function rootMarkdown(model) {
    const out = [
        '# soe://tags/', '',
        'Everything known about one game concept under one name. A tag is a set of links to',
        '`soe://` resources (WRAM addresses, ROM assets, tables) plus inherited vocabulary.', '',
        '- **Ids are dotted:** `boy.hp` is at [soe://tags/boy/hp.md](soe://tags/boy/hp.md); a tag with',
        '  sub-tags is a directory with `index.md` (and `index.json`).',
        '- **Inheritance:** `boy` → `player` → `character`. A tag lists every sub-tag of its ancestors;',
        '  the ones it has no links for read "not mapped yet".',
        '- **Search:** `soe://tags/search/<word>.md`, e.g. [raptor](soe://tags/search/raptor.md).',
        '- **Aliases:** hex ids name the same tag: [map/5c.md](soe://tags/map/5c.md) → `map.raptors`.',
        '- **Health:** [check.json](soe://tags/check.json) lists load errors and broken links.', '',
        '| Tag | Title | Sub-tags |', '|---|---|---|',
    ];
    for (const id of model.roots()) out.push(`| ${tagLink(model, id)} | ${cell(model.title(id))} | ${model.children(id).size} |`);
    out.push('');
    return out.join('\n');
}

function searchMarkdown(model, word) {
    const hits = model.search(word);
    const out = [`# Tags matching "${word}" (${hits.length})`, ''];
    if (!hits.length) out.push('No tag id or title contains this word. See [soe://tags/](soe://tags/index.md).', '');
    else {
        out.push('| Tag | Title |', '|---|---|');
        for (const id of hits) out.push(`| ${tagLink(model, id)} | ${cell(model.title(id))} |`);
        out.push('');
    }
    return out.join('\n');
}

module.exports = { pageUri, tagPath, formatValue, tagJson, tagMarkdown, rootMarkdown, searchMarkdown };
