// Ownership: `soe://rom/assets/audio/` and `soe://rom/audio/` —
// music, sound effects, song descriptors, and assembled SNES SPC files. Pure. One song's
// records, SPC and page are audio-songs.ts.

import { MUSIC, SOUNDS } from '../localizations/sounds';
import { hexId, slugify } from './resource-uri';
import { dir, file, json, text } from './nodes';
import type { Entry } from './nodes';

type Rom = Uint8Array;
type Song = (typeof MUSIC)[number];
type Sound = (typeof SOUNDS)[number];
import { readSongInfo, buildSpc, songMarkdown, SONG_POINTERS_ADDR } from './audio-songs';

const SONG_COUNT_ADDR = 0x019900;

function resolveAudio(segments: string[], rom: Rom) {
    const [cat, idStr, leaf, ...extra] = segments;

    if (cat === undefined) {
        return dir([
            ['index.md', 'file'],
            ['music', 'dir'],
            ['sounds', 'dir'],
        ], () => audioIndexMarkdown(rom));
    }

    if (cat === 'index.md') return text(() => audioIndexMarkdown(rom));

    if (cat === 'music') {
        return resolveMusic(idStr, leaf, extra, rom);
    }

    if (cat === 'sounds' || cat === 'sfx') {
        return resolveSounds(idStr, leaf, extra, rom);
    }

    return null;
}

// ── music ──────────────────────────────────────────────────────────────────

function resolveMusic(idStr: string | undefined, leaf: string | undefined, extra: string[], rom: Rom) {
    if (extra.length) return null;

    if (idStr === undefined) {
        const entries: Entry[] = [
            ['index.json', 'file'],
            ...MUSIC.map((m): Entry => [hexId(m.id, 2), 'dir']),
        ];
        return dir(entries, () => musicIndexMarkdown());
    }

    if (idStr === 'index.json') {
        return json(() => MUSIC.map((m) => ({
            id: m.id,
            hex: hexId(m.id, 2),
            slug: slugify(m.name),
            name: m.name,
            spc: m.spc,
        })));
    }

    const song = parseSong(idStr);
    if (!song) return null;

    const id = song.id;
    const r24 = (o: number) => rom[o] | (rom[o + 1] << 8) | (rom[o + 2] << 16);
    const ptr = r24(SONG_POINTERS_ADDR + id * 3) & 0x3FFFFF;

    if (leaf === undefined) {
        const entries: Entry[] = [
            ['info.json', 'file'],
            ['info.md', 'file'],
            ['song.spc', 'file'],
            ['data.bin', 'file'],
        ];
        if (song.spc) {
            entries.push([slugify(song.name) + '.spc', 'file']);
        }
        return dir(entries, () => songMarkdown(song, ptr, rom));
    }

    if (leaf === 'info.json') {
        return json(() => readSongInfo(rom, id, song, ptr));
    }

    if (leaf === 'info.md') {
        return text(() => songMarkdown(song, ptr, rom));
    }

    if (leaf === 'song.spc' || (song.spc && leaf === slugify(song.name) + '.spc')) {
        return file(() => buildSpc(rom, id, song.name));
    }

    if (leaf === 'data.bin') {
        return file(() => {
            const info = readSongInfo(rom, id, song, ptr);
            return Buffer.from(info.rawBytes);
        });
    }

    return null;
}

function parseSong(ident: string) {
    if (/^[0-9a-f]{1,2}$/i.test(ident)) {
        const n = parseInt(ident, 16);
        return MUSIC.find((m) => m.id === n) || null;
    }
    const slug = slugify(ident);
    return MUSIC.find((m) => slugify(m.name) === slug) || null;
}

function musicIndexMarkdown() {
    return `# soe://rom/assets/audio/music/

${MUSIC.length} music tracks. Each has an assembled playable \`song.spc\` file and transfer details.

| ID | Name | SPC File |
|---|---|---|
${MUSIC.map((m) => `| [${hexId(m.id, 2)}](${hexId(m.id, 2)}/info.md) | ${m.name} | [spc](${hexId(m.id, 2)}/song.spc) |`).join('\n')}
`;
}

// ── sounds ─────────────────────────────────────────────────────────────────

function resolveSounds(idStr: string | undefined, leaf: string | undefined, extra: string[], rom: Rom) {
    if (extra.length) return null;

    if (idStr === undefined) {
        const entries: Entry[] = [
            ['index.json', 'file'],
            ...SOUNDS.map((s): Entry => [hexId(s.id, 2), 'dir']),
        ];
        return dir(entries, () => soundsIndexMarkdown());
    }

    if (idStr === 'index.json') {
        return json(() => SOUNDS.map((s) => ({
            id: s.id,
            hex: hexId(s.id, 2),
            slug: slugify(s.name),
            name: s.name,
        })));
    }

    const sound = parseSound(idStr);
    if (!sound) return null;

    if (leaf === undefined) {
        return dir([
            ['info.json', 'file'],
            ['info.md', 'file'],
        ], () => soundMarkdown(sound, rom));
    }

    if (leaf === 'info.json') {
        return json(() => readSoundInfo(rom, sound));
    }

    if (leaf === 'info.md') {
        return text(() => soundMarkdown(sound, rom));
    }

    return null;
}

function parseSound(ident: string) {
    if (/^[0-9a-f]{1,2}$/i.test(ident)) {
        const n = parseInt(ident, 16);
        return SOUNDS.find((s) => s.id === n) || null;
    }
    const slug = slugify(ident);
    return SOUNDS.find((s) => slugify(s.name) === slug) || null;
}

function readSoundInfo(rom: Rom, sound: Sound) {
    const SFX_TABLE = 0x0C8362;
    const sfxWord = sound.id * 2 < 112 * 2 && SFX_TABLE + sound.id * 2 + 1 < rom.length
        ? rom[SFX_TABLE + sound.id * 2] | (rom[SFX_TABLE + sound.id * 2 + 1] << 8)
        : null;

    return {
        id: sound.id,
        hex: hexId(sound.id, 2),
        name: sound.name,
        opcode: '0x30 (sound)',
        translationTableHex: '$0C:8362',
        translatedWord: sfxWord !== null ? '$' + hexId(sfxWord, 4) : null,
    };
}

function soundMarkdown(sound: Sound, rom: Rom) {
    const info = readSoundInfo(rom, sound);
    return `# SFX 0x${hexId(sound.id, 2)}: ${sound.name}

| Property | Value |
|---|---|
| ID | \`0x${hexId(sound.id, 2)}\` |
| Name | ${sound.name} |
| Opcode | \`0x30\` (\`sound\`) / animation \`0x2E\` |
| Translated word | \`${info.translatedWord || '—'}\` |
`;
}

function soundsIndexMarkdown() {
    return `# soe://rom/assets/audio/sounds/

${SOUNDS.length} sound effects mapped in opcode \`0x30\` (\`sound\`) and the table at \`$8C:8362\`.

| ID | Name |
|---|---|
${SOUNDS.map((s) => `| [${hexId(s.id, 2)}](${hexId(s.id, 2)}/info.md) | ${s.name} |`).join('\n')}
`;
}

function audioIndexMarkdown(rom: Rom) {
    const songCount = rom[SONG_COUNT_ADDR];
    return `# soe://rom/assets/audio/

Audio subsystem for Secret of Evermore:
- Wolfgang v3 SPC700 driver uploaded to SPC \`$0700\` (\`0x0180DC\`, 6,112 bytes)
- ${songCount} song descriptors at \`$81:9903\`
- [music/](music/index.md): ${MUSIC.length} music tracks with playable \`.spc\` snapshots
- [sounds/](sounds/index.md): ${SOUNDS.length} sound effects
`;
}

export { resolveAudio };

