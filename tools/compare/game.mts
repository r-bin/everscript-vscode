// What compare needs to know about Secret of Evermore to line two backends up. Facts with evidence live in the
// knowledge entries (knowledge/ram/7e0100.md, 7e0133.md); SecretOfEvermoreRecomp docs/debugging.md tells how they were measured.

/** The NMI handler counts frames here ($7E0100, word): the key two different backends are aligned on. */
export const FRAME_COUNTER = 0x0100;
/** The reset handler seeds the RNG ($7E0133-$7E013A) from the PPU H/V counters, which no two backends share. */
export const RNG: [number, number] = [0x0133, 0x013B];
/** The counter value at which a recomp gets snes9x's RNG bytes; keys up to it are not compared. */
export const SYNC_AT = 115;

function range(a: number, b: number): number[] { const r: number[] = []; for (let i = a; i < b; i++) r.push(i); return r; }

/**
 * WRAM bytes that differ between backends for timing reasons only: DP scratch, scroll shadows mid-update, stack
 * slots. Ignored (zeroed before hashing) only in runs that mix backends; the report lists them.
 */
export const CROSS_NOISE: ReadonlySet<number> = new Set([...range(0x02, 0x0F), ...range(0x10E, 0x115), 0x1FEE, 0x1FF4]);
