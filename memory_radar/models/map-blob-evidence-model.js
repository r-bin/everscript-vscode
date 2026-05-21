'use strict';

const fs = require('fs');
const path = require('path');

const MAP_POINTER_TABLE_ROM = 0x1ffde7;
const RENDER_DESCRIPTOR_TABLE_SNES = 0xee0000;
const DEFAULT_RENDER_DETAIL_LIMIT = 16;
const DEFAULT_RENDER_STREAM_BYTES = 20;
const DEFAULT_RENDER_OPCODE_PREVIEW = 20;
const DEFAULT_BUFFER_COMPARISON_WORDS = 16;

const TRUSTED_MAPS = {
    0x33: {
        mapName: "Prehistoria - Strong Heart's Exterior",
        dataSnes: 0xadb50c,
        blobSize: 0x455,
        enterSourceSnes: 0x92811a,
        enterScriptSnes: 0x94e5fb,
        payloadPreludeRelStart: 0x01d,
        compressedRelStart: 0x02a,
        mirrorBufferSnes: 0x7fa000,
        tracePaths: {
            read7fc300: '/Users/v/Library/Application Support/Mesen2/Debugger/strongheart_exterior_read_7fc300_twice__breakpoint_read_bu=7FC300.txt',
            eeDecode: '/Users/v/Library/Application Support/Mesen2/Debugger/strongheart_exterior_decode_tiles_fist_call__breakpoint_bus=ee0000.txt',
        },
        subTraceDir: '/Users/v/Documents/GitHub/mesen2-mcp/traces/map_strongheart_exterior/sub-traces-by-byte',
        decoderEvidenceRelOffsets: [0x02a, 0x02b, 0x02e, 0x030, 0x032, 0x034, 0x035],
        trustedPipeline: [
            'Bytes after the trigger records are payload bytes; the first proven compressed control word begins at +0x02A.',
            'The helper at 8C988D initializes a source stream in the blob and twin output buffers at 0x7FC300 and 0x7FA000.',
            'The first pass writes identical bytes to 0x7FC300 and 0x7FA000.',
            'A later pass transforms the buffer into render macro IDs that resolve through 0xEE0000 + macro*3.',
            'The resolved far pointers lead to render script streams whose byte-level opcodes can be inspected, but their full semantics are still incomplete.',
        ],
        stageSnapshots: {
            source: 'User-provided Memory Viewer screenshots (trusted preview window)',
            firstPassBaseSnes: 0x7fc300,
            secondPassBaseSnes: 0x7fc300,
            firstPassWords: [
                0x0000, 0x0282, 0x0145, 0x0001, 0x0001, 0xFEBC, 0x0001, 0x012A,
                0x0001, 0x093D, 0x0001, 0xF58F, 0xFFF4, 0x0009, 0x0139, 0x0001,
                0x093B, 0x0001, 0xF58B, 0xFFFB, 0x0DD7, 0xFCC8, 0x0001, 0x0001,
                0xF69E, 0x0979, 0x0001, 0xFFE9, 0x0001, 0x0001, 0xFFD7, 0xFFF5,
                0xF5A3, 0x0001, 0x0A6A, 0x0001, 0x0001, 0xF58A, 0x0AA4, 0x000E,
                0xFFF8, 0x0011, 0xFFEC, 0x001C, 0xFFD8, 0x001B, 0x0006, 0xFFE9,
                0x0006, 0x0001, 0x0322, 0xFCF6, 0xFFEF, 0x0005, 0xFFF8, 0x0010,
                0x030F, 0xFCE5, 0xFFFD, 0x0011, 0xFFE4, 0xF375, 0x0001, 0x0004,
            ],
            secondPassWords: [
                0x0000, 0x0282, 0x03C7, 0x03C8, 0x03C9, 0x0285, 0x0286, 0x03B0,
                0x03B1, 0x0CEE, 0x0CEF, 0x027E, 0x0272, 0x027B, 0x03B4, 0x03B5,
                0x0CF0, 0x0CF1, 0x027C, 0x0277, 0x104E, 0x0D16, 0x0D17, 0x0D18,
                0x03B6, 0x0D2F, 0x0D30, 0x0D19, 0x0D1A, 0x0D1B, 0x0CF2, 0x0CE7,
                0x028A, 0x028B, 0x0CF5, 0x0CF6, 0x0CF7, 0x0281, 0x0D25, 0x0D33,
                0x0D2B, 0x0D3C, 0x0D28, 0x0D44, 0x0D1C, 0x0D37, 0x0D3D, 0x0D26,
                0x0D2C, 0x0D2D, 0x104F, 0x0D45, 0x0D34, 0x0D39, 0x0D31, 0x0D41,
                0x1050, 0x0D35, 0x0D32, 0x0D43, 0x0D27, 0x009C, 0x009D, 0x00A1,
                0x00A2, 0x00A3, 0x00A7, 0x00A8, 0x00A9, 0x00AA, 0x00AB, 0x00AF,
                0x00B0, 0x00B1, 0x00B2, 0x00B3, 0x00B7, 0x00B8, 0x00B9, 0x00BA,
            ],
        },
    },
};

function hex(value, width) {
    return (value >>> 0).toString(16).toUpperCase().padStart(width, '0');
}

function snesToRomOffset(snesAddr) {
    return (((snesAddr >>> 16) & 0x3f) * 0x10000) + (snesAddr & 0xffff);
}

function romToSnesOffset(romOffset) {
    return 0x800000 | ((((romOffset >>> 16) & 0x3f) << 16) | (romOffset & 0xffff));
}

function readU8(buf, offset) {
    if (offset < 0 || offset >= buf.length) throw new RangeError(`readU8 out of range @ 0x${hex(offset, 6)}`);
    return buf[offset];
}

function readU16LE(buf, offset) {
    return readU8(buf, offset) | (readU8(buf, offset + 1) << 8);
}

function readU24LE(buf, offset) {
    return readU8(buf, offset) | (readU8(buf, offset + 1) << 8) | (readU8(buf, offset + 2) << 16);
}

function findMapIdByBlobSnes(romBuf, blobSnes) {
    for (let mapId = 0; mapId < 0x100; mapId++) {
        const ptrAddr = MAP_POINTER_TABLE_ROM + mapId * 4;
        if (ptrAddr + 2 >= romBuf.length) break;
        if (readU24LE(romBuf, ptrAddr) === blobSnes) return mapId;
    }
    return null;
}

function loadRom(romPath) {
    return fs.readFileSync(romPath);
}

function parsePseudoCodeHeader(text) {
    const raw = String(text || '');
    if (!raw.trim()) return '';
    const firstBlock = raw.split(/\r?\n\r?\n\r?\n/)[0].trim();
    if (!firstBlock) return '';

    const out = [];
    for (const line of firstBlock.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (/^[0-9A-F]{4,6}\s{2,}/.test(trimmed)) break;
        out.push(trimmed);
    }
    return out.join(' ');
}

function loadBytePseudoCodeMap(subTraceDir, blobSize) {
    const out = new Map();
    if (!subTraceDir || !fs.existsSync(subTraceDir)) return out;

    for (let rel = 0; rel < blobSize; rel++) {
        const fullPath = path.join(subTraceDir, `byte_${String(rel).padStart(3, '0')}.txt`);
        if (!fs.existsSync(fullPath)) continue;
        out.set(rel, parsePseudoCodeHeader(fs.readFileSync(fullPath, 'utf8')));
    }
    return out;
}

function formatBytes(bytes) {
    return Array.from(bytes).map((value) => hex(value, 2)).join(' ');
}

function wordsToBytesLE(words, byteLimit) {
    const out = [];
    for (const word of words || []) {
        out.push(word & 0xff, (word >>> 8) & 0xff);
        if (byteLimit && out.length >= byteLimit) break;
    }
    return byteLimit ? out.slice(0, byteLimit) : out;
}

function normalizePositiveInt(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function parseStepOnEntries(romBuf, dataRom, stepLen) {
    const entries = [];
    const stepStartRom = dataRom + 0x0f;
    const count = stepLen / 6;
    for (let index = 0; index < count; index++) {
        const off = stepStartRom + index * 6;
        entries.push({
            index,
            romOffset: off,
            snesOffset: romToSnesOffset(off),
            y1: readU8(romBuf, off + 0),
            x1: readU8(romBuf, off + 1),
            y2: readU8(romBuf, off + 2),
            x2: readU8(romBuf, off + 3),
            scriptId: readU16LE(romBuf, off + 4),
            bytes: Array.from(romBuf.slice(off, off + 6)),
        });
    }
    return entries;
}

function parseBTriggerEntries(romBuf, bStartRom, bLen) {
    const entries = [];
    const count = bLen / 6;
    for (let index = 0; index < count; index++) {
        const off = bStartRom + index * 6;
        entries.push({
            index,
            romOffset: off,
            snesOffset: romToSnesOffset(off),
            bytes: Array.from(romBuf.slice(off, off + 6)),
        });
    }
    return entries;
}

function meaningForByte(rel, structure) {
    const stepTableRelStart = 0x0f;
    const stepTableRelEnd = stepTableRelStart + structure.stepOn.lengthBytes;
    const bLenRelStart = stepTableRelEnd;
    const bTableRelStart = bLenRelStart + 2;
    const bTableRelEnd = bTableRelStart + structure.bTriggers.lengthBytes;
    const payloadPreludeRelStart = structure.payloadRelStart;
    const compressedRelStart = structure.compressedRelStart;

    if (rel === 0x00) return { section: 'header', meaning: 'trigger grid origin X' };
    if (rel === 0x01) return { section: 'header', meaning: 'trigger grid origin Y' };
    if (rel === 0x02) return { section: 'header', meaning: 'map width in 16px tiles' };
    if (rel === 0x03) return { section: 'header', meaning: 'map height in 16px tiles' };
    if (rel === 0x04) return { section: 'header', meaning: 'display config byte 1' };
    if (rel === 0x05) return { section: 'header', meaning: 'display config byte 2' };
    if (rel === 0x06) return { section: 'header', meaning: 'display config byte 3' };
    if (rel === 0x07) return { section: 'header', meaning: 'display config byte 4' };
    if (rel === 0x08) return { section: 'header', meaning: 'unknown setup byte' };
    if (rel === 0x09 || rel === 0x0a) return { section: 'header', meaning: 'unknown 16-bit field (low/high)' };
    if (rel === 0x0b || rel === 0x0c) return { section: 'header', meaning: 'unknown trailing header bytes' };
    if (rel === 0x0d || rel === 0x0e) return { section: 'header', meaning: 'step-on table byte length (u16 LE)' };

    if (rel >= stepTableRelStart && rel < stepTableRelEnd) {
        const entryIndex = Math.floor((rel - stepTableRelStart) / 6);
        const fieldIndex = (rel - stepTableRelStart) % 6;
        const fieldNames = ['y1', 'x1', 'y2', 'x2', 'scriptId lo', 'scriptId hi'];
        return { section: 'step-on', meaning: `step-on[${entryIndex}] ${fieldNames[fieldIndex]}` };
    }

    if (rel === bLenRelStart || rel === bLenRelStart + 1) {
        return { section: 'header', meaning: 'B-trigger table byte length (u16 LE)' };
    }

    if (rel >= bTableRelStart && rel < bTableRelEnd) {
        const entryIndex = Math.floor((rel - bTableRelStart) / 6);
        const fieldIndex = (rel - bTableRelStart) % 6;
        return { section: 'b-trigger', meaning: `b-trigger[${entryIndex}] byte[${fieldIndex}]` };
    }

    if (rel >= payloadPreludeRelStart && rel < compressedRelStart) {
        return { section: 'payload', meaning: 'payload preface byte before first proven compressed control word' };
    }

    if (rel >= compressedRelStart) {
        return { section: 'payload', meaning: 'compressed stream / decoder byte' };
    }

    return { section: 'payload', meaning: 'opaque payload byte' };
}

function buildByteDetails(blob, structure, notes) {
    const out = [];
    for (let rel = 0; rel < blob.length; rel++) {
        const tagged = meaningForByte(rel, structure);
        out.push({
            relOffset: rel,
            romOffset: structure.dataRom + rel,
            snesOffset: structure.dataSnes + rel,
            value: blob[rel],
            section: tagged.section,
            meaning: tagged.meaning,
            pseudoCode: notes.get(rel) || '',
        });
    }
    return out;
}

function extractStageRange(parsed, startRel, endRelInclusive, label, explanation) {
    const bytes = parsed.blob.slice(startRel, endRelInclusive + 1);
    return {
        label,
        startRel,
        endRel: endRelInclusive,
        startSnes: parsed.dataSnes + startRel,
        endSnes: parsed.dataSnes + endRelInclusive,
        bytes: Array.from(bytes),
        explanation,
    };
}

function parseRenderOpcodePreview(streamBytes, previewLength = DEFAULT_RENDER_OPCODE_PREVIEW) {
    const out = [];
    const limit = Math.min(streamBytes.length, previewLength);
    for (let index = 0; index < limit; index++) {
        const opcode = streamBytes[index];
        out.push({
            index,
            opcode,
            className: opcode & 0x80 ? 'high-bit command' : 'low-bit opcode/literal',
            parameter: opcode & 0x80 ? (opcode & 0x7f) : null,
            nextByte: index + 1 < streamBytes.length ? streamBytes[index + 1] : null,
            nextWord: index + 2 < streamBytes.length ? (streamBytes[index + 1] | (streamBytes[index + 2] << 8)) : null,
        });
    }
    return out;
}

function resolveRenderMacro(romBuf, macroId, byteLimit = DEFAULT_RENDER_STREAM_BYTES) {
    const previewBytes = normalizePositiveInt(byteLimit, DEFAULT_RENDER_STREAM_BYTES);
    const tableSnes = RENDER_DESCRIPTOR_TABLE_SNES + macroId * 3;
    const tableRom = snesToRomOffset(tableSnes);
    if (tableRom + 2 >= romBuf.length) return null;

    const targetSnes = readU24LE(romBuf, tableRom);
    const targetRom = snesToRomOffset(targetSnes);
    if (targetRom < 0 || targetRom >= romBuf.length) return null;

    const streamBytes = Array.from(romBuf.slice(targetRom, Math.min(romBuf.length, targetRom + previewBytes)));
    return {
        macroId,
        tableSnes,
        tableRom,
        targetSnes,
        targetRom,
        streamBytes,
        opcodes: parseRenderOpcodePreview(streamBytes, previewBytes),
    };
}

function buildRenderMacroSummary(romBuf, secondPassWords, byteLimit = DEFAULT_RENDER_STREAM_BYTES) {
    const unique = [];
    const seen = new Set();
    for (const word of secondPassWords) {
        if (!word || seen.has(word)) continue;
        seen.add(word);
        unique.push(word);
    }
    return unique.map((macroId) => resolveRenderMacro(romBuf, macroId, byteLimit)).filter(Boolean);
}

function extractTraceReadsForTarget(traceText, targetSnes) {
    const lines = String(traceText || '').split(/\r?\n/);
    const targetHex = hex(targetSnes, 6);
    const targetPage = targetSnes >>> 8;
    const out = [];
    let seenTarget = false;

    for (const line of lines) {
        const match = line.match(/\[\$([0-9A-F]{6})\]\s*=\s*\$([0-9A-F]{2,4})/i);
        if (!match) continue;

        const address = parseInt(match[1], 16);
        if (!seenTarget) {
            if (match[1].toUpperCase() !== targetHex) continue;
            seenTarget = true;
        }

        if ((address >>> 8) !== targetPage || address < targetSnes || address >= targetSnes + 0x80) {
            continue;
        }

        out.push({
            address,
            value: parseInt(match[2], 16),
            widthBytes: match[2].length > 2 ? 2 : 1,
            line: line.trim(),
        });
    }

    return out;
}

function inferRenderCommandFromTraceText(traceText, targetSnes) {
    const accessedReads = extractTraceReadsForTarget(traceText, targetSnes);
    if (!accessedReads.length) return null;

    const commandByte = accessedReads[0].value & 0xff;
    const relativeOffset = commandByte & 0x7f;
    const lineDataStartSnes = targetSnes + relativeOffset;

    return {
        targetSnes,
        commandByte,
        opcodeClass: commandByte & 0x80 ? 'high-bit command' : 'low-bit opcode/literal',
        relativeOffset,
        lineDataStartSnes,
        directDataRead: accessedReads.find((entry) => entry.address === lineDataStartSnes) || null,
        firstWordRead: accessedReads.find((entry) => entry.address === lineDataStartSnes + 1 && entry.widthBytes === 2) || null,
        accessedReads,
        inferredStartSnes: targetSnes,
        inferredEndSnes: null,
        boundaryConclusion: 'Trace proves the command start byte and payload start offset, but not the final line end yet.',
    };
}

function inferRenderCommandFromTraceFile(tracePath, targetSnes) {
    if (!tracePath || !fs.existsSync(tracePath)) return null;
    return inferRenderCommandFromTraceText(fs.readFileSync(tracePath, 'utf8'), targetSnes);
}

function buildStageData(romBuf, parsed) {
    const trusted = parsed.trusted;
    const stages = [];
    const renderStreamBytes = normalizePositiveInt(parsed.renderStreamBytes, DEFAULT_RENDER_STREAM_BYTES);

    stages.push(extractStageRange(
        parsed,
        parsed.payloadRelStart,
        parsed.compressedRelStart - 1,
        'payload preface',
        'Bytes between the fixed trigger header and the first proven compressed control word. Their exact semantics are still unresolved.'
    ));

    stages.push(extractStageRange(
        parsed,
        parsed.compressedRelStart,
        parsed.compressedRelStart + 4,
        'compressed stream envelope',
        'Byte notes show this region initializes the compressed substream, computes a source pointer, seeds a count, and calls helper 8C988D.'
    ));

    if (trusted && trusted.decoderEvidenceRelOffsets && trusted.decoderEvidenceRelOffsets.length) {
        stages.push({
            label: 'decoder evidence bytes',
            explanation: 'These bytes have explicit MCP pseudo-code notes for the first decompression/helper stage.',
            byteRefs: trusted.decoderEvidenceRelOffsets.map((rel) => parsed.byteDetails[rel]).filter(Boolean),
        });
    }

    if (trusted && trusted.stageSnapshots) {
        const first = trusted.stageSnapshots.firstPassWords;
        const second = trusted.stageSnapshots.secondPassWords;
        const comparisons = [];
        const totalComparisonWords = Math.max(first.length, second.length);
        const comparisonWordLimit = Math.min(totalComparisonWords, normalizePositiveInt(parsed.bufferComparisonWords, DEFAULT_BUFFER_COMPARISON_WORDS));
        for (let index = 0; index < comparisonWordLimit; index++) {
            comparisons.push({
                index,
                firstPass: index < first.length ? first[index] : null,
                secondPass: index < second.length ? second[index] : null,
            });
        }
        stages.push({
            label: 'buffer transformation preview',
            explanation: `Trusted preview window from ${trusted.stageSnapshots.source}. Buffer A is 0x${hex(trusted.stageSnapshots.firstPassBaseSnes, 6)} before the delta pass and 0x${hex(trusted.stageSnapshots.secondPassBaseSnes, 6)} after it. The helper also mirrors bytes into 0x${hex(trusted.mirrorBufferSnes, 6)}.`,
            comparisons,
            totalComparisonWords,
        });

        const exactPrefixBytes = wordsToBytesLE(first, 8);
        stages.push({
            label: 'first pass exact prefix check',
            explanation: 'The first 8 bytes of vram1 are already trace-proven by byte_048..byte_055 and match the trusted buffer snapshot exactly.',
            prefixRows: [
                ['source bytes', `+0x02E..+0x043`, formatBytes(parsed.blob.slice(0x02e, 0x044)), 'substream/control bytes consumed by the first helper iterations'],
                ['vram1 exact prefix', `0x${hex(trusted.stageSnapshots.firstPassBaseSnes, 6)}..0x${hex(trusted.stageSnapshots.firstPassBaseSnes + 7, 6)}`, formatBytes(exactPrefixBytes), 'exact trace-backed match'],
            ],
        });
    }

    const renderMacros = trusted && trusted.stageSnapshots
        ? buildRenderMacroSummary(romBuf, trusted.stageSnapshots.secondPassWords, renderStreamBytes)
        : [];

    stages.push({
        label: 'render macro resolution',
        explanation: 'Preview macros from the post-delta buffer resolve through 0xEE0000 + macro*3 to far render streams.',
        renderMacros,
    });

    return stages;
}

function parseTrustedMapBlob(romBuf, opts) {
    const dataSnes = opts.dataSnes >>> 0;
    const blobSize = opts.blobSize >>> 0;
    const dataRom = snesToRomOffset(dataSnes);
    const blobEndRom = dataRom + blobSize;
    const mapId = opts.mapId != null ? opts.mapId : findMapIdByBlobSnes(romBuf, dataSnes);
    const trusted = mapId != null ? (TRUSTED_MAPS[mapId] || null) : null;
    const blob = romBuf.slice(dataRom, blobEndRom);

    const stepLen = readU16LE(romBuf, dataRom + 0x0d);
    const stepEntries = parseStepOnEntries(romBuf, dataRom, stepLen);
    const bLenOffsetRom = dataRom + 0x0f + stepLen;
    const bLen = readU16LE(romBuf, bLenOffsetRom);
    const bStartRom = bLenOffsetRom + 2;
    const bEntries = parseBTriggerEntries(romBuf, bStartRom, bLen);
    const payloadStartRom = bStartRom + bLen;
    const payloadStartSnes = romToSnesOffset(payloadStartRom);
    const payloadRelStart = payloadStartRom - dataRom;
    const compressedRelStart = trusted && trusted.compressedRelStart != null ? trusted.compressedRelStart : payloadRelStart;

    const subTraceDir = opts.subTraceDir || (trusted ? trusted.subTraceDir : null);
    const notes = loadBytePseudoCodeMap(subTraceDir, blobSize);

    const structure = {
        mapId,
        mapName: trusted ? trusted.mapName : null,
        dataSnes,
        dataRom,
        blobSize,
        blobEndRom,
        payloadStartRom,
        payloadStartSnes,
        payloadRelStart,
        compressedRelStart,
        renderStreamBytes: normalizePositiveInt(opts.renderStreamBytes, DEFAULT_RENDER_STREAM_BYTES),
        bufferComparisonWords: normalizePositiveInt(opts.bufferComparisonWords, DEFAULT_BUFFER_COMPARISON_WORDS),
        header: {
            triggerOffsetX: readU8(romBuf, dataRom + 0x00),
            triggerOffsetY: readU8(romBuf, dataRom + 0x01),
            mapWidthTiles: readU8(romBuf, dataRom + 0x02),
            mapHeightTiles: readU8(romBuf, dataRom + 0x03),
            configBytes: Array.from(romBuf.slice(dataRom + 0x04, dataRom + 0x09)),
            unknownWord0x09: readU16LE(romBuf, dataRom + 0x09),
            unknownWord0x0B: readU16LE(romBuf, dataRom + 0x0b),
        },
        stepOn: {
            lengthBytes: stepLen,
            count: stepEntries.length,
            entries: stepEntries,
        },
        bTriggers: {
            lengthBytes: bLen,
            count: bEntries.length,
            entries: bEntries,
        },
        trusted: trusted ? {
            enterSourceSnes: trusted.enterSourceSnes,
            enterScriptSnes: trusted.enterScriptSnes,
            trustedPipeline: trusted.trustedPipeline.slice(),
            tracePaths: { ...trusted.tracePaths },
            subTraceDir: trusted.subTraceDir,
            mirrorBufferSnes: trusted.mirrorBufferSnes,
            decoderEvidenceRelOffsets: trusted.decoderEvidenceRelOffsets.slice(),
            stageSnapshots: {
                ...trusted.stageSnapshots,
                firstPassWords: trusted.stageSnapshots.firstPassWords.slice(),
                secondPassWords: trusted.stageSnapshots.secondPassWords.slice(),
            },
        } : null,
    };

    const parsed = {
        ...structure,
        blob,
        bytePseudoCode: notes,
    };

    parsed.byteDetails = buildByteDetails(blob, parsed, notes);
    parsed.stages = buildStageData(romBuf, parsed);
    return parsed;
}

function renderTable(headers, rows) {
    const widths = headers.map((header, index) => {
        let width = header.length;
        for (const row of rows) width = Math.max(width, String(row[index] == null ? '' : row[index]).length);
        return width;
    });

    const out = [];
    out.push(headers.map((header, index) => header.padEnd(widths[index])).join(' | '));
    out.push(widths.map((width) => '-'.repeat(width)).join('-|-'));
    for (const row of rows) {
        out.push(row.map((value, index) => String(value == null ? '' : value).padEnd(widths[index])).join(' | '));
    }
    return out.join('\n');
}

function renderByteRows(rows) {
    return rows.map((row) => `${row.label}  ${row.raw}\n  -> ${row.meaning}`).join('\n');
}

function summarizeNote(note, maxLen = 160) {
    const text = String(note || '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    if (text.length <= maxLen) return text;
    return text.slice(0, Math.max(0, maxLen - 3)).trimEnd() + '...';
}

function formatTrustedMapBlobReport(parsed, opts = {}) {
    const renderDetailLimit = opts.renderDetailLimit || DEFAULT_RENDER_DETAIL_LIMIT;
    const lines = [];

    lines.push(`# map ${parsed.mapId != null ? '0x' + hex(parsed.mapId, 2) : '(unknown)'}${parsed.mapName ? ` - ${parsed.mapName}` : ''}`);
    lines.push('');
    lines.push(`data_snes = 0x${hex(parsed.dataSnes, 6)}`);
    lines.push(`data_rom  = 0x${hex(parsed.dataRom, 6)}`);
    lines.push(`blob_size = 0x${hex(parsed.blobSize, 3)} (${parsed.blobSize} bytes)`);
    lines.push(`payload_start = 0x${hex(parsed.payloadStartSnes, 6)} (after fixed header + trigger tables)`);
    lines.push(`first_proven_compressed_word = +0x${hex(parsed.compressedRelStart, 3)} @ 0x${hex(parsed.dataSnes + parsed.compressedRelStart, 6)}`);
    if (parsed.trusted) {
        lines.push(`enter_script_source = 0x${hex(parsed.trusted.enterSourceSnes, 6)} (trusted external metadata)`);
        lines.push(`enter_script = 0x${hex(parsed.trusted.enterScriptSnes, 6)} (trusted external metadata)`);
    }
    lines.push('');

    lines.push('## Blob summary');
    lines.push(renderByteRows([
        { label: '+0x000..+0x00C', raw: formatBytes(parsed.blob.slice(0x000, 0x00d)), meaning: 'fixed room header' },
        { label: '+0x00D..+0x00E', raw: formatBytes(parsed.blob.slice(0x00d, 0x00f)), meaning: 'step-on byte count (u16 LE)' },
        { label: `+0x00F..+0x${hex(0x00f + parsed.stepOn.lengthBytes - 1, 3)}`, raw: formatBytes(parsed.blob.slice(0x00f, 0x00f + parsed.stepOn.lengthBytes)), meaning: 'step-on records (6 bytes each)' },
        { label: `+0x${hex(0x00f + parsed.stepOn.lengthBytes, 3)}..+0x${hex(0x010 + parsed.stepOn.lengthBytes, 3)}`, raw: formatBytes(parsed.blob.slice(0x00f + parsed.stepOn.lengthBytes, 0x011 + parsed.stepOn.lengthBytes)), meaning: 'B-trigger byte count (u16 LE)' },
        { label: `+0x${hex(parsed.payloadRelStart, 3)}..+0x${hex(parsed.compressedRelStart - 1, 3)}`, raw: formatBytes(parsed.blob.slice(parsed.payloadRelStart, parsed.compressedRelStart)), meaning: 'payload preface before the first proven compressed control word' },
        { label: `+0x${hex(parsed.compressedRelStart, 3)}..end`, raw: formatBytes(parsed.blob.slice(parsed.compressedRelStart)), meaning: 'bytes from the first proven compressed control word to end of blob; exact compressed boundary is still unresolved' },
    ]));
    lines.push('');

    lines.push('## Step-on triggers');
    lines.push(`step_len = 0x${hex(parsed.stepOn.lengthBytes, 4)} (${parsed.stepOn.count} entries)`);
    for (const entry of parsed.stepOn.entries) {
        lines.push(`step_on[${entry.index}] = script 0x${hex(entry.scriptId, 4)} { y1=0x${hex(entry.y1, 2)}, x1=0x${hex(entry.x1, 2)}, y2=0x${hex(entry.y2, 2)}, x2=0x${hex(entry.x2, 2)} }`);
    }
    lines.push('');

    if (parsed.bTriggers.count || parsed.bTriggers.lengthBytes) {
        lines.push('## B triggers');
        lines.push(`b_len = 0x${hex(parsed.bTriggers.lengthBytes, 4)} (${parsed.bTriggers.count} entries)`);
        lines.push('');
    }

    lines.push('## Decryption stages');
    for (const stage of parsed.stages) {
        lines.push(`### ${stage.label}`);
        lines.push(stage.explanation);
        if (stage.bytes) {
            lines.push(renderByteRows([
                {
                    label: `+0x${hex(stage.startRel, 3)}..+0x${hex(stage.endRel, 3)} @ 0x${hex(stage.startSnes, 6)}..0x${hex(stage.endSnes, 6)}`,
                    raw: formatBytes(stage.bytes),
                    meaning: stage.explanation,
                },
            ]));
        }
        if (stage.byteRefs) {
            lines.push(renderTable(
                ['Rel', 'Val', 'Meaning', 'Trace / pseudo'],
                stage.byteRefs.map((detail) => [
                    `+0x${hex(detail.relOffset, 3)}`,
                    `0x${hex(detail.value, 2)}`,
                    detail.meaning,
                    summarizeNote(detail.pseudoCode),
                ])
            ));
        }
        if (stage.prefixRows) {
            lines.push(renderByteRows(stage.prefixRows.map((row) => ({
                label: `${row[0]} ${row[1]}`,
                raw: row[2],
                meaning: row[3],
            }))));
        }
        if (stage.comparisons) {
            lines.push(renderTable(
                ['Word idx', '0x7FC300 pass 1', '0x7FC300 pass 2'],
                stage.comparisons.map((row) => [
                    `0x${hex(row.index * 2, 3)}`,
                    row.firstPass == null ? '' : `0x${hex(row.firstPass, 4)}`,
                    row.secondPass == null ? '' : `0x${hex(row.secondPass, 4)}`,
                ])
            ));
            if (stage.totalComparisonWords > stage.comparisons.length) {
                lines.push(`(showing first ${stage.comparisons.length} of ${stage.totalComparisonWords} words)`);
            }
        }
        if (stage.renderMacros) {
            lines.push(renderTable(
                ['Macro', 'EE table', 'Target', 'First bytes'],
                stage.renderMacros.map((macro) => [
                    `0x${hex(macro.macroId, 4)}`,
                    `0x${hex(macro.tableSnes, 6)}`,
                    `0x${hex(macro.targetSnes, 6)}`,
                    formatBytes(macro.streamBytes.slice(0, parsed.renderStreamBytes)),
                ])
            ));

            const detailed = stage.renderMacros.slice(0, renderDetailLimit);
            lines.push('');
            lines.push(`Detailed opcode preview (first ${detailed.length} resolved macros, fixed ${parsed.renderStreamBytes}-byte preview; no trusted stop byte inferred yet):`);
            for (const macro of detailed) {
                lines.push(`- macro 0x${hex(macro.macroId, 4)} -> 0x${hex(macro.targetSnes, 6)} (rom 0x${hex(macro.targetRom, 6)})`);
                lines.push(`  raw: ${formatBytes(macro.streamBytes)}`);
                for (const opcode of macro.opcodes) {
                    const extra = opcode.parameter == null ? '' : ` param=0x${hex(opcode.parameter, 2)}`;
                    const nextByte = opcode.nextByte == null ? '--' : hex(opcode.nextByte, 2);
                    const nextWord = opcode.nextWord == null ? '----' : hex(opcode.nextWord, 4);
                    lines.push(`  [${hex(opcode.index, 2)}] 0x${hex(opcode.opcode, 2)}  ${opcode.className}${extra}  next=0x${nextByte}  word=0x${nextWord}`);
                }
            }
        }
        lines.push('');
    }

    lines.push('## Evidence paths');
    if (parsed.trusted) {
        lines.push(`trace(read 7FC300) = ${parsed.trusted.tracePaths.read7fc300}`);
        lines.push(`trace(EE decode) = ${parsed.trusted.tracePaths.eeDecode}`);
        lines.push(`byte notes dir = ${parsed.trusted.subTraceDir}`);
        lines.push('- checkpoint: post-delta buffer resolves into EE:xxxx render macros');
        for (const item of parsed.trusted.trustedPipeline) lines.push(`- ${item}`);
    }
    lines.push('');

    return lines.join('\n');
}

module.exports = {
    TRUSTED_MAPS,
    DEFAULT_RENDER_DETAIL_LIMIT,
    hex,
    snesToRomOffset,
    romToSnesOffset,
    loadRom,
    findMapIdByBlobSnes,
    parsePseudoCodeHeader,
    loadBytePseudoCodeMap,
    parseRenderOpcodePreview,
    resolveRenderMacro,
    buildRenderMacroSummary,
    inferRenderCommandFromTraceText,
    inferRenderCommandFromTraceFile,
    parseTrustedMapBlob,
    formatTrustedMapBlobReport,
};
