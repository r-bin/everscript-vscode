---
name: wiki-entries
description: Use when creating, editing, or auditing wiki Markdown in any Everscript project; verify factual claims across the local everscript* repositories and label claims without proof as unverified.
---

# Everscript Wiki Entries

Wiki pages explain behavior to people who may rely on the details. State technical facts only when evidence supports them; a plausible explanation is not evidence.

## Evidence workflow

1. Search all relevant local `everscript*` project repositories, not just the current checkout. Include source, tests, docs, ROM-derived data, disassembly, and runtime traces where available. Locate the repositories from the workspace or the user's local GitHub projects directory; do not assume a fixed set.
2. Prefer direct evidence: verified ROM disassembly or emulator trace, executable tests, implementation, and authoritative project data. Use prose docs as leads, then verify their claims against stronger evidence. Older notes and duplicated wiki claims are not independent confirmation.
3. Keep each fact within the scope its evidence proves. Distinguish the script VM from the animation VM and calculator evaluator; distinguish slot allocation, parent/return links, argument storage, and actual stacks.
4. Compare sources. When they disagree, state the disagreement and leave the disputed claim unresolved until evidence decides it. Do not silently choose the most plausible value.
5. For each factual claim that remains unproved after the search, add a nearby note in this exact form:

   `> **Unverified:** <specific claim or detail> has not been confirmed by the available source, disassembly, test, or trace.`

   Make the uncertainty specific. Do not add a generic page-level disclaimer when only one claim is uncertain. Do not present an unverified detail in a diagram or table as established fact.

6. Do not delete, generalize, or replace a factual claim, example, number, or interpretation solely because it is unverified. Preserve its specific content and mark it nearby with an `Unverified` note. If a claim is directly contradicted by stronger evidence, preserve the original wording as a historical claim when useful, label it `Contradicted`, and state the supported correction alongside it. Never leave contradicted material looking like current guidance.

## Writing

- Explain the established behavior in plain language, then give the evidence trail with local links or exact source identifiers/addresses.
- Prefer concise tables and diagrams when they clarify verified structure; label unknown values and boundaries explicitly.
- Correct claims contradicted by stronger evidence. Preserve the specific prior belief as a labeled historical claim rather than deleting it when it was part of the source material being edited.
- Do not invent addresses, capacities, names, opcode meanings, causal mechanisms, or runtime outcomes. If evidence is unavailable, say so with the `Unverified` note.
- Keep examples valid for the relevant Everscript compiler version. Check syntax and identifiers against that project's compiler, core library, or tests.

## Completion check

Before finishing, review every factual statement, table cell, code comment, and diagram in the edited section. Each must be supported by evidence, explicitly labeled unverified, or removed. Include relevant cross-project source links, and recheck any nearby claim affected by a correction.