# docs/archive: superseded docs, kept lossless

Status: rules for the archive. The list of what is in it is [INDEX.md](INDEX.md).

Material that is finished, merged into another file, or no longer true lands here instead of being
deleted. Git history is the last backstop (cleanup D13), but the archive keeps it easy to find.

## Rules

1. **Not default context.** Nothing in `AGENTS.md`, skills, READMEs or charters links here, except
   `INDEX.md` and records such as `docs/legal-history.md`. Agents open an archived file only after
   `INDEX.md` points to it for the topic.
2. **How a file gets here.** `git mv <old> docs/archive/<yyyy-mm>/<name>.md`, then one row in
   `INDEX.md`: old path, date, project number, one-line summary, why archived, and where the live
   information went (`path#section`). The file's first line becomes
   `> Archived <date>. Live version: <path>. Reason: <reason>.` The body stays unchanged.
3. **Before archiving**, every claim of the file is in a live file or is listed as dropped with a
   reason (the `context-compressor` agent's claim ledger).
4. **Restore** = `git mv` back and a note in the index row.
5. **Checks still apply.** `check:legal`, the Markdown link check and `check:knowledge` read archived
   files too. Legal findings are fixed here as anywhere.
6. **Not for** knowledge entries, `reconstructed-c/`, generated files, or code.

Maintained by the [context-compressor](../../.agents/agents/context-compressor.md) agent.
