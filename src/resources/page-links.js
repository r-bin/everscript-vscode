'use strict';
// Ownership: link targets in generated pages. Pure.
//
// VS Code's Markdown preview turns only *relative* image paths into webview
// resources; an absolute `soe://…` <img> is blocked ("Some content has been
// disabled"). So pages that link across files (tags/, ram/index.md) are served
// with every `soe://` target on the same root made relative to the page, and,
// inside a ROM opened as a folder, first moved into that mount:
//   soe://rom/x  → soe://rom/~m/rom/x      soe://ram/x → soe://rom/~m/ram/x
//   soe://tags/x → soe://rom/~m/tags/x     soe://localization/x → …/localization/x

const SOE = /soe:\/\/(rom|ram|tags|localizations?)\//g;

/** Every absolute `soe://` address in `s` moved into the ROM mounted at `mount` (JSON, link targets). */
function intoMount(s, mount) {
    return s.replace(SOE, (_, a) => `soe://rom/${mount}/${a === 'localizations' ? 'localization' : a}/`);
}

const segmentsOf = path => path.split('/').filter(Boolean);
const encode = p => p.replace(/\[/g, '%5B').replace(/\]/g, '%5D').replace(/ /g, '%20');

/**
 * Markdown link targets `](soe://…)` moved into `mount` (if any), then made
 * relative to the page at `soe://<authority><path>` when they share its root
 * (same authority, and same mount). Link text is left alone.
 */
function pageLinks(markdown, authority, path, mount = null) {
    const page = segmentsOf(path);
    const pageDir = page.slice(0, -1);
    return markdown.replace(/\]\((soe:\/\/[^)\s]+)\)/g, (whole, target) => {
        const t = mount ? intoMount(target, mount) : target;
        const m = /^soe:\/\/([^/?#]+)(\/[^?#]*)?(\?[^#]*)?$/.exec(t);
        if (!m || m[1] !== authority || m[3]) return `](${t})`;
        const segs = segmentsOf(m[2] || '/');
        if (mount && segs[0] !== mount) return `](${t})`;
        let i = 0;
        while (i < pageDir.length && i < segs.length - 1 && pageDir[i] === segs[i]) i++;
        const rel = '../'.repeat(pageDir.length - i) + segs.slice(i).join('/');
        return `](${encode(rel || './')})`;
    });
}

module.exports = { intoMount, pageLinks };
