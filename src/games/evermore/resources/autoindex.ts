// Ownership: the `index.md` of a `soe://` directory that has no index of its
// own: every entry as a relative link, and `.png` files as a gallery, so a
// directory can be read in the Markdown preview like a web server's autoindex.

const GALLERY_COLUMNS = 8;

/** Markdown-safe relative link target. */
const href = (name: string): string => name.split('/').map(encodeURIComponent).join('/');

/** `address` e.g. `soe://rom/assets/icons/`; `entries` as readDirectory lists them: [name, kind]. */
function autoIndex(address: string, entries: [string, string][]): string {
    const shown = entries.filter(([name]) => name !== 'index.md');
    const images = shown.filter(([name]) => name.endsWith('.png'));
    const others = shown.filter(([name]) => !name.endsWith('.png'));
    const lines = [`# ${address}`, '', `${shown.length} entries.`, ''];
    if (others.length) {
        lines.push('| Name | Kind |', '|---|---|');
        for (const [name, kind] of others) {
            const label = kind === 'dir' ? name + '/' : name;
            lines.push(`| [${label}](${href(kind === 'dir' ? name + '/index.md' : name)}) | ${kind === 'link' ? 'link' : kind} |`);
        }
        lines.push('');
    }
    if (images.length) lines.push(...gallery(images.map(([name]) => ({ image: name, label: name, target: name }))));
    return lines.join('\n') + '\n';
}

/** A grid of images with captions. */
function gallery(items: { image: string; label: string; target: string; }[], columns = GALLERY_COLUMNS) {
    const out = ['|' + ' |'.repeat(columns), '|' + '---|'.repeat(columns)];
    for (let i = 0; i < items.length; i += columns) {
        const row = items.slice(i, i + columns)
            .map(it => `[![${it.label}](${href(it.image)})](${href(it.target)}) [${it.label}](${href(it.target)})`);
        while (row.length < columns) row.push('');
        out.push('| ' + row.join(' | ') + ' |');
    }
    out.push('');
    return out;
}

export { autoIndex, gallery, href };
