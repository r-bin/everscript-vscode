---
name: colour-theme
description: Use when editing the bundled colour theme (src/language/themes/everscript-dark.json) or its spec (docs/vscode-highlighter-spec.md) in everscript-vscode.
applyTo: "src/language/themes/**,docs/vscode-highlighter-spec.md"
---

# Skill: Colour Theme

Use this skill when editing the bundled colour theme
(`src/language/themes/everscript-dark.json`) or its spec
(`docs/vscode-highlighter-spec.md`).

Colours follow the P1–P9 priority system defined in
`docs/vscode-highlighter-spec.md §Color Priority Tiers`. When reassigning a scope to a
different priority, update **both** the theme JSON and the spec table — they must never
drift apart.
