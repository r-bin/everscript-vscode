/**
 * emulator/cdl/wire.ts
 *
 * The CDL delta as the page sends it (webview/cdl.js cdlDrain: typed arrays as base64 text) and its
 * decoding into the library's Delta. `session` / `seq` number the page's drains so the host can say
 * which ones are on disk (cdlSaved) and a rescued one is merged once (library.ts `delivered`).
 */

type B64 = string | null | undefined;
type Chunk = { index: number; data: B64 };

/** The delta the webview drains from the core; streams are base64 text. */
interface WireDelta {
    chunks?: { index: number; cdl: B64; ext: B64 }[]; wvals?: Chunk[]; wflags?: Chunk[];
    xrefs?: B64; edges?: B64; stats?: B64; scriptXrefs?: B64; romHits?: B64; wramHits?: B64; rets?: B64; regs?: B64; bases?: B64;
    wcode?: { index: number; code: B64; state: B64 }[]; aram?: Chunk[]; bus?: Chunk[]; busSites?: B64; romCycles?: B64;
    ioVals?: Chunk[]; sramFlags?: Chunk[]; wordRanges?: { set: number; index: number; data: B64 }[]; dropped?: number;
    session?: string; seq?: number;
}

const b64ToBytes = (s: B64): Uint8Array | undefined => (s ? new Uint8Array(Buffer.from(s, 'base64')) : undefined);
/** Bytes of a stream that must be there (an empty stream when missing). */
const b64Bytes = (s: B64): Uint8Array => new Uint8Array(Buffer.from(s ?? '', 'base64'));
const b64ToWords = (s: B64): Uint32Array | undefined => {
    if (!s) return undefined;
    const buf = Buffer.from(s, 'base64');
    const out = new Uint32Array(buf.length >> 2);
    for (let i = 0; i < out.length; i++) out[i] = buf.readUInt32LE(i * 4);
    return out;
};

/** The page's delta -> the argument of CdlLibrary.applyDelta. */
function decodeDelta(d: WireDelta) {
    return {
        chunks: (d.chunks || []).map(c => ({ index: c.index, cdl: b64ToBytes(c.cdl), ext: b64ToBytes(c.ext) })),
        wvals: (d.wvals || []).map(w => ({ index: w.index, data: b64Bytes(w.data) })),
        wflags: (d.wflags || []).map(w => ({ index: w.index, data: b64Bytes(w.data) })),
        xrefs: b64ToWords(d.xrefs),
        edges: b64ToWords(d.edges),
        stats: b64ToWords(d.stats),
        scriptXrefs: b64ToWords(d.scriptXrefs),
        romHits: b64ToWords(d.romHits),
        wramHits: b64ToWords(d.wramHits),
        rets: b64ToWords(d.rets),
        regs: b64ToWords(d.regs),
        bases: b64ToWords(d.bases),
        wcode: (d.wcode || []).map(c => ({ index: c.index, code: b64Bytes(c.code), state: b64Bytes(c.state) })),
        aram: (d.aram || []).map(a => ({ index: a.index, data: b64Bytes(a.data) })),
        bus: (d.bus || []).map(a => ({ index: a.index, data: b64Bytes(a.data) })),
        busSites: b64ToWords(d.busSites),
        romCycles: b64ToWords(d.romCycles),
        ioVals: (d.ioVals || []).map(a => ({ index: a.index, data: b64Bytes(a.data) })),
        sramFlags: (d.sramFlags || []).map(a => ({ index: a.index, data: b64Bytes(a.data) })),
        wordRanges: (d.wordRanges || []).map(a => ({ set: a.set, index: a.index, data: b64Bytes(a.data) })),
    };
}

export type { WireDelta };
export { decodeDelta };
