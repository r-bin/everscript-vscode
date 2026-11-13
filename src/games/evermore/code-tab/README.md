# code-tab/ — Code tab

The radar panel's **Code** tab: every routine with a knowledge entry (code or script), read from
`soe://rom/code/` exactly as agents read it (skill `code-vfs`). Three columns, like the Scripts tab
(the pane is also `.scr-pane`):

| Column | What |
|---|---|
| Rail | every routine by bank: category, name, `C` when it has reconstructed C, its address in this ROM. The filter matches name, title and address as you type; **Enter** runs the deep search (`index.json?q=`: knowledge text, C, the WRAM it touches, asm comments, what it calls), each hit with why in its tooltip. `with C` keeps routines with C |
| Middle | title, name, US address and this ROM's (moved / not found), confidence, instruction and comment counts; **Called by** and **Calls** as links (a call without an entry shows its address); then one version: **ASM** (`lines.json`: rows of address, bytes (`bytes`), instruction, comment; a call links to its routine, a branch inside the routine jumps to its line; **names** on (default): operands by name, and with a CDL library how often each line ran (hover: widths, DB, D), lines that never ran dimmed, what each line touched after its comment; off: the plain code), **C** (`reconstructed-c/`), **Pseudo-C** (a curated docs block or the snesrecomp lift); a version without a source is disabled. `open ↗` shows the file in an editor. **←** / Alt+← goes back |
| Right | the knowledge entry, its evidence, the WRAM it uses with names and access, record fields, I/O registers, the open work, its files |

A version's text is read when it is shown, never with the routine, and cached per routine.

| File | Role |
|---|---|
| `index.ts` | Public API: `handlesCodeMessage` / `handleCodeMessage`, `buildCodeTabHtml` |
| `host.ts` | The `code*` requests, answered from `soe://rom/code/` through the injected `read` |
| `render-code-tab.ts` | The pane scaffold |
| `webview/code-tab.dom.ts` | The page (bundle `CodeTab`, set up inside the radar's script) |
| `webview/code-listing.dom.ts` | lines.json, C and Markdown as HTML with routine links (pure) |
| `webview/code-tab.css` | What the tab adds to the Scripts tab's styles (`code-` prefix) |

Host protocol:

| Page → host | Host → page |
|---|---|
| `codeInit` | `codeIndex { routines, canOpen }` (`index.json`, slimmed) |
| `codeSearch { q }` | `codeSearch { q, hits: [{ name, why }] }` (`index.json?q=`) |
| `codeRoutine { name }` | `codeRoutine { name, routine }` (`<name>/routine.json`) |
| `codeLines { name }` | `codeLines { name, lines }` (`lines.json`: the ASM view) |
| `codeText { name, version }` | `codeText { name, version, text }` (`asm`, `c`, `pseudo`: the file `routine.json` names) |
| `codeOpen { name, file }` | — (opens `soe://rom/code/<name>/<file>`) |
