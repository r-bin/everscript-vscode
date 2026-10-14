// Ownership: script time — ticks, and the order of events whose time the
// script alone cannot know. Pure.
//
// One tick is one pass of the game's scheduler ($8C:CFFD, called from the
// field tick $8E:E41E right after it increments the timer $0B19). Most waits
// have an exact length in ticks (YIELD 1, SLEEP n → max(1, n−1)). The `0x2e`
// waits do not: an entity finishing its walk, a text box closed by the
// player, the camera coming to rest. Each of those is an *event* E with an
// unknown time; every time point is `event + offset` (or `start + offset`),
// and what is known about the events is a set of difference constraints
// `E_a >= E_b + w`. Deciding "has E happened by now?" is a longest-path
// question on that small graph — when the constraints do not settle it, the
// simulation forks and each side records its answer. So "the flag is set
// before Fire Eyes stops walking" becomes a recorded condition, never a guess.

/** A moment: an event (or the start, -1) plus a number of ticks. */
export interface TimePoint { base: number; off: number }

export const START: TimePoint = { base: -1, off: 0 };

export class Clock {
    now: TimePoint = START;
    /** Event names, by id. */
    readonly events: string[] = [];
    /** `x[to] >= x[from] + w`, keyed `from>to`, keeping the strongest w. Node -1 is the start. */
    private edges = new Map<string, number>();

    clone(): Clock {
        const c = new Clock();
        c.now = this.now;
        c.events.push(...this.events);
        c.edges = new Map(this.edges);
        return c;
    }

    /** A new event at least `min` ticks after `after`. */
    event(name: string, after: TimePoint, min: number): number {
        const id = this.events.length;
        this.events.push(name);
        this.add(after.base, id, min - after.off);
        return id;
    }

    later(p: TimePoint, ticks: number): TimePoint { return { base: p.base, off: p.off + ticks }; }

    /** True / false when the constraints settle `p >= q`, else null. */
    ge(p: TimePoint, q: TimePoint): boolean | null {
        const lo = this.longest(q.base, p.base);
        if (lo !== null && lo + p.off - q.off >= 0) return true;
        const back = this.longest(p.base, q.base);
        // q - p >= back + q.off - p.off ; if that is >= 1 then p < q.
        if (back !== null && back + q.off - p.off >= 1) return false;
        return null;
    }

    /** Record `p >= q` (or, with `holds` false, `p < q`). */
    assume(p: TimePoint, q: TimePoint, holds: boolean): void {
        if (holds) this.add(q.base, p.base, q.off - p.off);
        else this.add(p.base, q.base, p.off - q.off + 1);
    }

    render(p: TimePoint): string {
        const name = p.base < 0 ? '' : this.events[p.base];
        if (/^tick \d+(\.\.\d*)?$/.test(name ?? '')) {
            // A compacted moment: shift its range by the offset.
            const [a, b] = name.slice(5).split('..');
            const shift = (x: string): string => (x === '' ? '' : String(+x + p.off));
            return b === undefined ? `tick ${shift(a)}` : `tick ${shift(a)}..${shift(b)}`;
        }
        const b = p.base < 0 ? '' : `[${name}]`;
        if (!b) return `tick ${p.off}`;
        return p.off ? `${b} + ${p.off}` : b;
    }

    /**
     * What is known about the order of the given moments, and nothing else:
     * two paths that reached the same state by different orders of events
     * that are over are the same path from here on.
     */
    relevantKey(points: readonly TimePoint[]): string {
        const parts: string[] = [];
        for (let i = 0; i < points.length; i++) {
            for (let j = 0; j < points.length; j++) {
                if (i === j) continue;
                const r = this.ge(points[i], points[j]);
                parts.push(r === null ? '?' : r ? '1' : '0');
            }
        }
        // Absolute ticks matter where they are absolute (start-based); events only by their order.
        return points.map((p) => (p.base < 0 ? `t${p.off}` : `e+${p.off}`)).join(',') + '|' + parts.join('');
    }

    /**
     * The same knowledge restricted to `points` (now and the pending wakes):
     * events nothing waits for any more are dropped, their consequences kept
     * as direct bounds. Returns the new clock and where each point now lives.
     */
    project(points: readonly TimePoint[], symbolicNow = false): { clock: Clock; points: TimePoint[] } {
        const out = new Clock();
        const ids = new Map<number, number>();
        // A symbolic `now` becomes a node of its own: only its bounds matter, not
        // how far it sits from an event that is over.
        const nowNode = points[0].base >= 0 || symbolicNow ? 0 : null;
        if (nowNode !== null) {
            // Named by what is known of it: a range of ticks since the start.
            const n0 = points[0];
            const lo = this.longest(-1, n0.base), back = this.longest(n0.base, -1);
            const from = lo === null ? null : lo + n0.off, to = back === null ? null : n0.off - back;
            out.events.push(from === null ? 'some tick' : to !== null && to === from ? `tick ${from}` : `tick ${from}..${to ?? ''}`);
        }
        for (const p of points.slice(1)) {
            if (p.base < 0 || ids.has(p.base)) continue;
            ids.set(p.base, out.events.length);
            out.events.push(this.events[p.base]);
        }
        const n = points[0];
        // Distance helpers in the old clock, with NOW standing for n.base + n.off.
        type Node = { id: number | 'now' };
        const dist = (a: Node, b: Node): number | null => {
            const ab = a.id === 'now' ? n.base : a.id, bb = b.id === 'now' ? n.base : b.id;
            const d = this.longest(ab, bb);
            if (d === null) return null;
            return d + (b.id === 'now' ? n.off : 0) - (a.id === 'now' ? n.off : 0);
        };
        const nodes: Array<[Node, number]> = [[{ id: -1 }, -1], ...[...ids.entries()].map(([old, nw]) => [{ id: old }, nw] as [Node, number])];
        if (nowNode !== null) nodes.push([{ id: 'now' }, nowNode]);
        for (const [a, an] of nodes) for (const [b, bn] of nodes) {
            if (an === bn) continue;
            const d = dist(a, b);
            if (d !== null) out.add(an, bn, d);
        }
        const moved = points.map((p, i) => i === 0 && nowNode !== null ? { base: nowNode, off: 0 }
            : { base: p.base < 0 ? -1 : ids.get(p.base)!, off: p.off });
        out.now = moved[0];
        return { clock: out, points: moved };
    }

    /** What both clocks know (same event layout, from `project`): the weaker bound of each pair. */
    join(o: Clock, shared = Infinity): Clock {
        const out = new Clock();
        out.now = this.now;
        out.events.push(...this.events);
        for (const [k, w] of this.edges) {
            const [a, b] = k.split('>').map(Number);
            // Nodes past `shared` are this side's own (visual threads it keeps): its bounds stand.
            if (a >= shared || b >= shared) { out.edges.set(k, w); continue; }
            const v = o.edges.get(k);
            if (v !== undefined) out.edges.set(k, Math.min(w, v));
        }
        return out;
    }

    /** The order-free shape of the points, for merge keys. */
    shape(points: readonly TimePoint[]): string {
        return points.map((p) => (p.base < 0 ? `t${p.off}` : `e${p.base}+${p.off}`)).join(',');
    }

    /** Stable text of what is known, for merge keys. */
    key(): string {
        return `${this.now.base}+${this.now.off}|` + [...this.edges.entries()].sort().map(([k, w]) => `${k}:${w}`).join(',');
    }

    private add(from: number, to: number, w: number): void {
        if (from === to) return;
        const k = `${from}>${to}`;
        const old = this.edges.get(k);
        if (old === undefined || w > old) this.edges.set(k, w);
    }

    /** Longest path from → to (the tightest lower bound of x[to] - x[from]), or null if none. */
    private longest(from: number, to: number): number | null {
        if (from === to) return 0;
        const dist = new Map<number, number>([[from, 0]]);
        const n = this.events.length + 1;
        for (let i = 0; i < n; i++) {
            let changed = false;
            for (const [k, w] of this.edges) {
                const [a, b] = k.split('>').map(Number);
                const da = dist.get(a);
                if (da === undefined) continue;
                if (!dist.has(b) || da + w > dist.get(b)!) { dist.set(b, da + w); changed = true; }
            }
            if (!changed) break;
        }
        return dist.has(to) ? dist.get(to)! : null;
    }
}
