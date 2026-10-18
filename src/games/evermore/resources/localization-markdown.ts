// Ownership: Markdown generators for `soe://localization/` directories.
// Pure formatting functions only; no routing or I/O.

import { hexId } from './resource-uri';

/** How many names each soe://localization/ directory holds. */
interface LocalizationCounts {
    counts: {
        npcScripts: number; absScripts: number; globalScripts: number; maps: number; music: number; sounds: number;
        tables: number; functions: number; strings: number; knowledge?: { ram: number; rom: number } | null;
    };
}
interface IdEntry { id: number; hex: string; name: string }
interface AddressEntry { address: number; hex: string; name: string; notes?: string }

function rootMarkdown(s: LocalizationCounts): string {
    return `# soe://localization/

Concentrated subjective and localized names for Secret of Evermore.

| Directory | Count | Content |
|---|---|---|
| [scripts/](scripts/index.md) | ${s.counts.npcScripts + s.counts.absScripts + s.counts.globalScripts} | NPC, ABS, and Global script names |
| [maps/](maps/index.md) | ${s.counts.maps} | 127 vanilla rooms and area groupings |
| [sounds/](sounds/index.md) | ${s.counts.music + s.counts.sounds} | Music tracks and sound effects |
| [tables/](tables/index.md) | ${s.counts.tables} | Curated master ROM tables |
| [functions/](functions/index.md) | ${s.counts.functions} | Curated ROM routines and entry points |
| [strings/](strings/index.md) | ${s.counts.strings} | In-game dialog strings from ROM table at \`$11D000\` |
| [knowledge/](knowledge/ram/index.md) | ${s.counts.knowledge ? s.counts.knowledge.ram + s.counts.knowledge.rom : 0} | Knowledge entries: the generated RAM and ROM maps, each entry |

[index.json](index.json)
`;
}

function scriptsMarkdown(allNpc: unknown[], allAbs: unknown[], allGlobal: unknown[]): string {
    return `# soe://localization/scripts/

| Category | Count | Sample Names |
|---|---|---|
| [npc/](npc/index.md) | ${allNpc.length} | Thraxx damage/kill, Fire Power Dude, Aquagoth |
| [abs/](abs/index.md) | ${allAbs.length} | Thraxx maggot trigger part, Thraxx damage / kill part [1] |
| [global/](global/index.md) | ${allGlobal.length} | Fade-out / stop music, Fade-in / start music |

[index.json](index.json)
`;
}

function npcMarkdown(allNpc: IdEntry[]): string {
    const lines = allNpc.map(e => `| \`${e.hex}\` | ${e.id} | ${e.name} | [${hexId(e.id, 4)}.json](${hexId(e.id, 4)}.json) |`);
    return `# NPC Scripts (${allNpc.length})

| Hex | Decimal | Name | JSON |
|---|---|---|---|
${lines.join('\n')}
`;
}

function absMarkdown(allAbs: AddressEntry[]): string {
    const lines = allAbs.map(e => `| \`${e.hex}\` | ${e.address} | ${e.name} | [${hexId(e.address, 6)}.json](${hexId(e.address, 6)}.json) |`);
    return `# ABS Scripts (${allAbs.length})

| Address | Decimal | Name | JSON |
|---|---|---|---|
${lines.join('\n')}
`;
}

function globalMarkdown(allGlobal: IdEntry[]): string {
    const lines = allGlobal.map(e => `| \`${e.hex}\` | ${e.id} | ${e.name} | [${hexId(e.id, 2)}.json](${hexId(e.id, 2)}.json) |`);
    return `# Global Scripts (${allGlobal.length})

| Hex | Decimal | Name | JSON |
|---|---|---|---|
${lines.join('\n')}
`;
}

function mapsMarkdown(vanillaMaps: (IdEntry & { area: string })[]): string {
    const rows = vanillaMaps.map(m => `| \`${m.hex}\` | ${m.area} | ${m.name} | [${hexId(m.id, 2)}.json](${hexId(m.id, 2)}.json) |`);
    return `# Vanilla Rooms (${vanillaMaps.length})

| Hex | Area | Name | JSON |
|---|---|---|---|
${rows.join('\n')}
`;
}

function soundsMarkdown(musicCount: number, soundsCount: number): string {
    return `# Sounds & Music

| Category | Count | Content |
|---|---|---|
| [music/](music/index.md) | ${musicCount} | Music tracks (EMU / SPC700) |
| [sfx/](sfx/index.md) | ${soundsCount} | Sound effects |

[index.json](index.json)
`;
}

function musicMarkdown(music: (IdEntry & { spc: string })[]): string {
    const rows = music.map(m => `| \`${m.hex}\` | ${m.name} | \`${m.spc}\` | [${hexId(m.id, 2)}.json](${hexId(m.id, 2)}.json) |`);
    return `# Music Tracks (${music.length})

| Hex | Name | SPC File | JSON |
|---|---|---|---|
${rows.join('\n')}
`;
}

function sfxMarkdown(sounds: IdEntry[]): string {
    const rows = sounds.map(s => `| \`${s.hex}\` | ${s.name} | [${hexId(s.id, 2)}.json](${hexId(s.id, 2)}.json) |`);
    return `# Sound Effects (${sounds.length})

| Hex | Name | JSON |
|---|---|---|
${rows.join('\n')}
`;
}

function tablesMarkdown(tables: AddressEntry[]): string {
    const rows = tables.map(t => `| \`${t.hex}\` | ${t.name} | ${t.notes || ''} | [${hexId(t.address, 6)}.json](${hexId(t.address, 6)}.json) |`);
    return `# Curated Tables (${tables.length})

| Address | Name | Notes | JSON |
|---|---|---|---|
${rows.join('\n')}
`;
}

function functionsMarkdown(functions: AddressEntry[]): string {
    const rows = functions.map(f => `| \`${f.hex}\` | ${f.name} | ${f.notes || ''} | [${hexId(f.address, 6)}.json](${hexId(f.address, 6)}.json) |`);
    return `# Curated Functions (${functions.length})

| Address | Name | Notes | JSON |
|---|---|---|---|
${rows.join('\n')}
`;
}

function stringsMarkdown(rom: unknown, stringCount: number): string {
    return `# In-Game Strings

${stringCount} strings in ROM key table at \`$11D000\`.
ROM status: ${rom ? 'Available' : 'Not loaded (pass ?rom=vanilla)'}.

Read \`<index>.json\` or \`<index>.txt\` with hex index e.g. \`0540.json\` or \`0540.txt\`.
`;
}

export { rootMarkdown, scriptsMarkdown, npcMarkdown, absMarkdown, globalMarkdown, mapsMarkdown, soundsMarkdown, musicMarkdown, sfxMarkdown, tablesMarkdown, functionsMarkdown, stringsMarkdown };

