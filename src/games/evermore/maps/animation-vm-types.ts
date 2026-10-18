// Ownership: what a run of an animation script returns — its frames (sprite, offsets, strike and hurt
// boxes, sounds), the projectiles it threw, how it ended. Types only; ./animation-vm runs the script.

/** One strike box, centred at (dx, dy) from the feet. */
export interface VmStrike { dx: number; dy: number; width: number; height: number }

/** A `projectile` command that ran: what it throws and where, relative to the feet. */
export interface VmSpawn {
    /** Projectile record id (`$900000 + id`, ./projectiles). */
    id: number;
    dx: number;
    dy: number;
    /** Height offset, in the same units as dx/dy (the handler stores it ×16). */
    dz: number;
    /** Ticks into its frame when it spawned. */
    at: number;
    /** Where the thrower stood (px from its start) and its height (1/16 px) at that moment. */
    ex: number;
    ey: number;
    ez: number;
}

/** One displayed frame: consecutive ticks that look the same. */
export interface VmFrame {
    /** Main sprite, or null while the script draws nothing. */
    sprite: number | null;
    /** Second sprite slot (usually the shadow). */
    sprite2: number | null;
    ticks: number;
    strikeBox: VmStrike | null;
    /** Addresses of every command that ran during this frame. */
    lines: number[];
    /** Sum of `step` operands run during the frame (quarter pixels, before `$0F36`). */
    step: number;
    /** Set when a `hold_random` chose the timer: the range of ticks it can take. */
    random?: [number, number];
    /** Projectiles thrown during this frame. */
    spawns: VmSpawn[];
    /** Position after each tick of the frame: [x px, y px, height in 1/16 px], from the start. */
    motion: Array<[number, number, number]>;
    /** Mode (+0x16) during the frame; bit `$20` means it cannot be hit. */
    mode: number;
    /**
     * A segmented body (Tar Skull, Salabog): each segment's sprite, and where every segment
     * is drawn after each tick of the frame — `ticks[t][k] = [x, y]` from the feet.
     */
    segments: { sprites: number[]; ticks: Array<Array<[number, number]>> } | null;
    /** Hurt-region offset (+0x42, +0x44) at the end of the frame. */
    hurt: [number, number];
}

export interface VmResult {
    frames: VmFrame[];
    /** True when the script came back round (`loop`, or a state already seen) or a one-shot ended on `end_check`. */
    complete: boolean;
    totalTicks: number;
    /** Where it stopped on a command of unknown width. */
    stoppedAt?: number;
    /** True when the entity moves or leaves the ground at any point. */
    moves: boolean;
    /**
     * Playback tick a loop resumes at. 0 normally; later when the entity was still in the
     * air at `loop` and the run carried on until its motion repeated (a hovering flier).
     */
    loopFrom: number;
    /**
     * The palette the script loads itself (`palette`, command 0x4b), or 0 when it keeps the
     * entity's. Placeholder effects (explosions, the Windwalker) bring their own this way.
     */
    palette: number;
}
