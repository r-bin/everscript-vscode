'use strict';
// Ownership: `soe://rom/assets/audio/` and `soe://rom/audio/` —
// music, sound effects, song descriptors, and assembled SNES SPC files. Pure.

const { MUSIC, SOUNDS, getMusic, getSound, getSoundAnimations } = require('../localizations/sounds');
const { hexId, slugify } = require('./resource-uri');
const { dir, file, json, text } = require('./nodes');
const { buildMusicModel } = require('../music/model/catalog');
const { packageRecords, musicPackages, driverBlocks, isEvermoreAudio } = require('../music/model/rom-audio');
const V = require('../music/webview/music-view');

const SONG_COUNT_ADDR = 0x019900;
const SONG_POINTERS_ADDR = 0x019903;
const DRIVER_ROM_ADDR = 0x0180DC;
const DRIVER_ROM_LEN = 6112;

function upperWalk(off, len) {
    const out = [];
    while (len > 0) {
        const bankEnd = (off | 0xFFFF) + 1;
        const n = Math.min(len, bankEnd - off);
        out.push([off, off + n]);
        len -= n;
        off = bankEnd + 0x8000;
    }
    return out;
}

function take(rom, cur, n) {
    const bytes = [];
    for (const [a, b] of upperWalk(cur, n)) {
        for (let i = a; i < b; i++) bytes.push(rom[i]);
        cur = b;
    }
    if ((cur & 0xFFFF) === 0) cur += 0x8000;
    return [bytes, cur];
}

function resolveAudio(segments, rom) {
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

function resolveMusic(idStr, leaf, extra, rom) {
    if (extra.length) return null;

    if (idStr === undefined) {
        const entries = [
            ['index.json', 'file'],
            ...MUSIC.map((m) => [hexId(m.id, 2), 'dir']),
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
    const r24 = (o) => rom[o] | (rom[o + 1] << 8) | (rom[o + 2] << 16);
    const ptr = r24(SONG_POINTERS_ADDR + id * 3) & 0x3FFFFF;

    if (leaf === undefined) {
        const entries = [
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

function parseSong(ident) {
    if (/^[0-9a-f]{1,2}$/i.test(ident)) {
        const n = parseInt(ident, 16);
        return MUSIC.find((m) => m.id === n) || null;
    }
    const slug = slugify(ident);
    return MUSIC.find((m) => slugify(m.name) === slug) || null;
}

function formatViableAnimations(animations) {
    if (!animations || !animations.length) return '*(none — script only)*';
    const byWho = new Map();
    for (const a of animations) {
        if (!byWho.has(a.who)) byWho.set(a.who, new Set());
        if (a.what) byWho.get(a.who).add(a.what);
    }
    const parts = [];
    for (const [who, whats] of byWho) {
        const whatList = [...whats];
        if (whatList.length === 1) parts.push(`${who} (${whatList[0]})`);
        else if (whatList.length > 1) parts.push(`${who} (${whatList.length} actions)`);
        else parts.push(who);
    }
    if (parts.length <= 3) return parts.join(', ');
    return parts.slice(0, 3).join(', ') + ` *(+${parts.length - 3} more)*`;
}

function readSongInfo(rom, songId, song, ptr) {
    const rawBytes = [];
    let cur = ptr;
    const [b, c2] = take(rom, cur, 2);
    cur = c2;
    rawBytes.push(...b);
    const count = b[0] | (b[1] << 8);

    const transfers = [];
    for (let k = 0; k < count; k++) {
        const [rec, nextCur] = take(rom, cur, 7);
        cur = nextCur;
        rawBytes.push(...rec);
        const len = rec[0] | (rec[1] << 8);
        const src = (rec[2] | (rec[3] << 8) | (rec[4] << 16)) & 0x3FFFFF;
        const dest = rec[5] | (rec[6] << 8);
        transfers.push({
            index: k,
            len,
            srcHex: '$' + hexId(src, 6),
            destHex: '$' + hexId(dest, 4),
        });
    }

    let audio = null;
    if (isEvermoreAudio(rom)) {
        const musicPk = musicPackages(rom);
        const pkgId = musicPk[songId];
        const model = buildMusicModel(rom);
        const basePkgLayout = model.packages[0] || [];
        const songPkgLayout = model.packages[pkgId] || [];
        const basePkgBytes = basePkgLayout.reduce((s, r) => s + (r[1] || 0), 0);
        const songPkgBytes = songPkgLayout.reduce((s, r) => s + (r[1] || 0), 0);

        const drv = driverBlocks(rom);
        const own = V.muOwners(drv, basePkgLayout, songPkgLayout);
        const counts = { zp: 0, driver: 0, tables: 0, base: 0, song: 0, data: 0, echo: 0, ipl: 0, free: 0 };
        for (let i = 0; i < 0x10000; i++) {
            const o = own[i];
            if (o < 0) counts.free++;
            else counts[V.MU_OWNERS[o].key]++;
        }

        const baseRecords = packageRecords(rom, 0);
        const songRecords = packageRecords(rom, pkgId);

        const getSfxAram = (sfxId, pkg) => {
            const rec = pkg === 0 ? baseRecords : songRecords;
            const targetAddr = 0x2070 + 2 * sfxId;
            const write = rec.find(r => r.dest === targetAddr);
            if (!write) return null;
            const seqPtr = write.bytes[0] | (write.bytes[1] << 8);
            const seqRec = rec.find(r => r.dest === seqPtr);
            return {
                ptr: seqPtr,
                ptrHex: '$' + hexId(seqPtr, 4),
                len: seqRec ? seqRec.bytes.length : null,
            };
        };

        const activeSounds = [];
        const unloadedSounds = [];
        for (const s of model.sfx) {
            const isBase = s.package === 0;
            const isLoaded = s.package === pkgId;
            if (isBase || isLoaded) {
                activeSounds.push({
                    id: s.id,
                    hex: '$' + hexId(s.id, 2),
                    name: s.name || `SFX $${hexId(s.id, 2)}`,
                    bank: isBase ? 'Base' : 'Loaded',
                    package: s.package,
                    scripts: s.scripts || [],
                    aram: getSfxAram(s.id, s.package),
                    animations: s.animations || [],
                });
            } else if (s.animations && s.animations.length > 0) {
                unloadedSounds.push({
                    id: s.id,
                    hex: '$' + hexId(s.id, 2),
                    name: s.name || `SFX $${hexId(s.id, 2)}`,
                    package: s.package,
                    packageName: model.music[s.package - 1]?.name || `Package $${hexId(s.package, 2)}`,
                    animations: s.animations,
                });
            }
        }

        const allSoundAnims = getSoundAnimations();
        const activeSfxSet = new Set(activeSounds.map(s => s.id));
        const viableRecords = new Set();
        const unviableRecords = new Set();
        for (const entry of allSoundAnims) {
            for (const anim of entry.animations) {
                if (activeSfxSet.has(entry.sfx)) viableRecords.add(anim.record);
                else unviableRecords.add(anim.record);
            }
        }

        audio = {
            packageId: pkgId,
            aram: {
                totalBytes: 0x10000,
                usedBytes: 0x10000 - counts.free,
                freeBytes: counts.free,
                breakdown: counts,
                basePackageBytes: basePkgBytes,
                songPackageBytes: songPkgBytes,
            },
            sounds: activeSounds,
            unloadedSoundsWithAnims: unloadedSounds,
            viableAnimationCount: viableRecords.size,
            unviableAnimationCount: unviableRecords.size,
            totalSoundAnimationsCount: viableRecords.size + unviableRecords.size,
        };
    }

    return {
        id: songId,
        hex: hexId(songId, 2),
        name: song.name,
        spc: song.spc,
        pointerHex: '$' + hexId(ptr, 6),
        transferCount: count,
        transfers,
        rawBytes,
        audio,
    };
}

function buildSpc(rom, songId, title = 'Secret of Evermore') {
    const spc = Buffer.alloc(0x10200);
    // Standard SNES SPC header (0x100 bytes)
    spc.write('SNES-SPCMUSIC:v0.10', 0, 'ascii');
    spc[0x13] = 0x1A;
    spc[0x14] = 0x1A;
    spc.writeUInt16LE(0x0700, 0x23); // PC = $0700
    spc[0x29] = 0xCF;                 // SP = $CF
    spc.write((title || 'Song').slice(0, 32), 0x2E, 'ascii');
    spc.write('Secret of Evermore', 0x4E, 'ascii');
    spc.write('Everscript VFS', 0x6E, 'ascii');

    const aram = spc.subarray(0x100, 0x10100);

    // 1. Copy Wolfgang v3 SPC700 driver to ARAM $0700
    if (DRIVER_ROM_ADDR + DRIVER_ROM_LEN <= rom.length) {
        aram.set(rom.subarray(DRIVER_ROM_ADDR, DRIVER_ROM_ADDR + DRIVER_ROM_LEN), 0x0700);
    }

    // 2. Apply transfer records
    const r24 = (o) => rom[o] | (rom[o + 1] << 8) | (rom[o + 2] << 16);
    let cur = r24(SONG_POINTERS_ADDR + songId * 3) & 0x3FFFFF;
    const [b, c2] = take(rom, cur, 2);
    cur = c2;
    const n = b[0] | (b[1] << 8);

    for (let k = 0; k < n; k++) {
        const [rec, nextCur] = take(rom, cur, 7);
        cur = nextCur;
        const len = rec[0] | (rec[1] << 8);
        const src = (rec[2] | (rec[3] << 8) | (rec[4] << 16)) & 0x3FFFFF;
        const dest = rec[5] | (rec[6] << 8);
        let destPos = dest;
        for (const [a, end] of upperWalk(src, len)) {
            for (let i = a; i < end && destPos < 0x10000; i++) {
                aram[destPos++] = rom[i];
            }
        }
    }

    return spc;
}

function songMarkdown(song, ptr, rom) {
    const info = readSongInfo(rom, song.id, song, ptr);
    const audio = info.audio;

    if (!audio) {
        return `# Song 0x${hexId(song.id, 2)}: ${song.name}

| Property | Value |
|---|---|
| ID | \`0x${hexId(song.id, 2)}\` |
| Reference SPC | ${song.spc || '*(none)*'} |
| Descriptor pointer | \`$${hexId(ptr, 6)}\` |
| Transfer records | ${info.transferCount} |

[song.spc](song.spc) | [info.json](info.json) | [data.bin](data.bin)

## Transfers
| # | Length | ROM Source | SPC Destination |
|---|---|---|---|
${info.transfers.slice(0, 50).map((t) => `| ${t.index} | ${t.len} B | \`${t.srcHex}\` | \`${t.destHex}\` |`).join('\n')}
${info.transfers.length > 50 ? `\n*(showing first 50 of ${info.transfers.length} transfers)*\n` : ''}
`;
    }

    const baseCount = audio.sounds.filter(s => s.bank === 'Base').length;
    const loadedCount = audio.sounds.filter(s => s.bank === 'Loaded').length;
    const totalUsed = audio.aram.usedBytes;
    const freeBytes = audio.aram.freeBytes;
    const b = audio.aram.breakdown;

    const sections = [];

    sections.push(`# Song 0x${hexId(song.id, 2)}: ${song.name}

| Property | Value |
|---|---|
| ID | \`0x${hexId(song.id, 2)}\` |
| Reference SPC | ${song.spc || '*(none)*'} |
| Descriptor pointer | \`$${hexId(ptr, 6)}\` |
| Transfer records | ${info.transferCount} |
| Package ID | \`0x${hexId(audio.packageId, 2)}\` (\`$${hexId(audio.packageId, 2)}\`) |
| Total ARAM Used | ${totalUsed.toLocaleString('en-US')} B (${((totalUsed / 65536) * 100).toFixed(1)}%) |
| Free ARAM | ${freeBytes.toLocaleString('en-US')} B (${((freeBytes / 65536) * 100).toFixed(1)}%) |
| Available Sounds | ${audio.sounds.length} (${baseCount} base + ${loadedCount} loaded) |
| Viable Animations | ${audio.viableAnimationCount} / ${audio.totalSoundAnimationsCount} (${((audio.viableAnimationCount / audio.totalSoundAnimationsCount) * 100).toFixed(1)}%) |

[song.spc](song.spc) | [info.json](info.json) | [data.bin](data.bin)
`);

    sections.push(`## ARAM Usage
| Region | ARAM Destination | Size | Role |
|---|---|---|---|
| Zero Page & Stack | \`$0000\`–\`$021F\` | 544 B | SPC700 direct page and stack |
| Driver Code | \`$0700\`–\`$1EDF\` | 6,112 B | Wolfgang v3 SPC700 sound driver |
| Base Sound Bank (Pkg $00) | \`$1EE0\`–\`$2351\`, \`$3AC0\`–\`$6782\` | ${audio.aram.basePackageBytes.toLocaleString('en-US')} B | Base samples (${b.base.toLocaleString('en-US')} B) + SFX sequence tables |
| Loaded Song Bank (Pkg $${hexId(audio.packageId, 2)}) | \`$1F38\`–\`$1F4B\`, \`$678E\`+ | ${audio.aram.songPackageBytes.toLocaleString('en-US')} B | Song samples (${b.song.toLocaleString('en-US')} B) + music sequence data |
| Free Space | — | ${freeBytes.toLocaleString('en-US')} B | Unallocated ARAM (${((freeBytes / 65536) * 100).toFixed(1)}% free) |
`);

    const soundRows = audio.sounds.map(s => {
        const scriptLinks = s.scripts.length
            ? s.scripts.map(id => `[\$${hexId(id, 2)}](../../sounds/${hexId(id, 2)}/info.md)`).join(', ')
            : '—';
        const aramStr = s.aram ? `\`${s.aram.ptrHex}\` (${s.aram.len !== null ? s.aram.len + ' B' : '?'})` : '—';
        return `| \`${s.hex}\` | ${s.name} | ${s.bank} | ${scriptLinks} | ${aramStr} | ${formatViableAnimations(s.animations)} |`;
    }).join('\n');

    sections.push(`## Sound Effects & Viable Animations (${audio.sounds.length})
When this track is loaded in ARAM, **${audio.sounds.length} sound effects** are active (${baseCount} base sounds + ${loadedCount} loaded sounds). Animations triggering these sounds will play correctly.

| SFX | Name | Bank | Script Opcode | ARAM Sequence | Viable Animations |
|---|---|---|---|---|---|
${soundRows}
`);

    if (audio.unloadedSoundsWithAnims.length > 0) {
        const unloadedList = audio.unloadedSoundsWithAnims.map(u =>
            `- **${u.name}** (SFX \`${u.hex}\`, requires package \`$${hexId(u.package, 2)}\` / *${u.packageName}*): ${formatViableAnimations(u.animations)}`
        ).join('\n');

        sections.push(`## Unloaded Sounds & Incompatible Animations (${audio.unviableAnimationCount})
These animations trigger sounds whose packages are not loaded by this track:
${unloadedList}
`);
    }

    sections.push(`## Transfers
| # | Length | ROM Source | SPC Destination |
|---|---|---|---|
${info.transfers.slice(0, 50).map((t) => `| ${t.index} | ${t.len} B | \`${t.srcHex}\` | \`${t.destHex}\` |`).join('\n')}
${info.transfers.length > 50 ? `\n*(showing first 50 of ${info.transfers.length} transfers)*\n` : ''}
`);

    return sections.join('\n');
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

function resolveSounds(idStr, leaf, extra, rom) {
    if (extra.length) return null;

    if (idStr === undefined) {
        const entries = [
            ['index.json', 'file'],
            ...SOUNDS.map((s) => [hexId(s.id, 2), 'dir']),
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

function parseSound(ident) {
    if (/^[0-9a-f]{1,2}$/i.test(ident)) {
        const n = parseInt(ident, 16);
        return SOUNDS.find((s) => s.id === n) || null;
    }
    const slug = slugify(ident);
    return SOUNDS.find((s) => slugify(s.name) === slug) || null;
}

function readSoundInfo(rom, sound) {
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

function soundMarkdown(sound, rom) {
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

function audioIndexMarkdown(rom) {
    const songCount = rom[SONG_COUNT_ADDR];
    return `# soe://rom/assets/audio/

Audio subsystem for Secret of Evermore:
- Wolfgang v3 SPC700 driver uploaded to SPC \`$0700\` (\`0x0180DC\`, 6,112 bytes)
- ${songCount} song descriptors at \`$81:9903\`
- [music/](music/index.md): ${MUSIC.length} music tracks with playable \`.spc\` snapshots
- [sounds/](sounds/index.md): ${SOUNDS.length} sound effects
`;
}

module.exports = { resolveAudio };

