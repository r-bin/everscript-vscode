// Escaping text for HTML the host builds (docs/cleanup.md 5.1): one owner for the replace chain.
// Callers keep their own coercion of null and non-strings.

const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

/** `&`, `<`, `>` and `"` as entities: safe in text and in double-quoted attributes. */
export function escapeHtml(text: string): string {
    return text.replace(/[&<>"]/g, (c) => ENTITIES[c] ?? c);
}
