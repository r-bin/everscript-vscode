// Ownership: the Routes tab's simulation sub-panel — one fight or death step simulated many times
// (`routesFight`, host.ts → simulation/combat): the time it takes as a histogram with the fastest fight and
// the median marked, hits and swings, the inputs read from the ROM and the route, and what the
// model assumes. Pure HTML builders; routes-tab.dom.ts owns the state and the events.

interface Stats { min: number; p10: number; median: number; mean: number; p90: number; max: number }
interface Report {
    runs: number; unfinished: number;
    seconds: { histogram: { bins: { from: number; to: number; count: number }[]; total: number }; stats: Stats; best: number };
    hits: [number, number][]; swings: [number, number][]; knocked: number[];
}
interface Fighter {
    name: string; role: string; hp: number; atk: number; def: number; evade: number; hitRate: number; chargeSpeed: number; chance: number | null;
    swing: { ticks: number; strikeAt: number }; knockback: { ticks: number; random?: { base: number; range: number } };
}
export interface FightResult {
    error?: string; until?: 'enemy' | 'party'; party?: string; report?: Report;
    inputs?: { fighters: Fighter[]; pairs: { from: string; to: string; hit: number; min: number; max: number }[] };
}

const esc = (s: unknown): string => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
const sec = (s: number): string => s.toFixed(2) + ' s';
const pct = (x: number, total: number): string => (100 * x / Math.max(1, total)).toFixed(1) + '%';
const BAR = 'var(--vscode-charts-blue,#3794ff)';
const W = 460, H = 214, PAD = { l: 40, r: 10, t: 40, b: 28 };
/** At most this many rows; the rarer tail folds into one "n+" row. */
const MAX_ROWS = 8;

/** The time histogram, the fastest of the simulated fights and the median as labelled lines. */
function timeChart(r: Report): string {
    const bins = r.seconds.histogram.bins, total = r.seconds.histogram.total;
    const x0 = bins[0].from, x1 = bins[bins.length - 1].to;
    const ymax = Math.max(...bins.map((b) => b.count)) / total;
    const sx = (v: number) => PAD.l + (v - x0) / (x1 - x0 || 1) * (W - PAD.l - PAD.r);
    const sy = (v: number) => H - PAD.b - v / (ymax || 1) * (H - PAD.t - PAD.b);
    const bars = bins.map((b, i) => {
        if (!b.count) return '';
        const x = sx(b.from) + 1, w = Math.max(1, sx(b.to) - sx(b.from) - 2), y = sy(b.count / total);
        return '<rect class="rte-fbar" data-rte-bin="' + i + '" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + (H - PAD.b - y).toFixed(1) +
            '" rx="2" fill="' + BAR + '"><title>' + esc(b.from.toFixed(2) + '–' + b.to.toFixed(2) + ' s: ' + b.count + ' fights (' + pct(b.count, total) + ')') + '</title></rect>';
    }).join('');
    const ticks = [0, 1, 2, 3, 4].map((k) => x0 + (x1 - x0) * k / 4);
    const yt = [0, 0.5, 1].map((k) => ymax * k);
    const marker = (v: number, label: string, cls: string, anchor: string, row: number) => '<line class="rte-fmark ' + cls + '" x1="' + sx(v) + '" x2="' + sx(v) + '" y1="' + (PAD.t - 30 + row * 12) + '" y2="' + (H - PAD.b) + '"/>' +
        '<text class="rte-flabel" x="' + (sx(v) + (anchor === 'start' ? 4 : -4)) + '" y="' + (PAD.t - 22 + row * 12) + '" text-anchor="' + anchor + '">' + esc(label) + '</text>';
    const s = r.seconds;
    // The median's label goes a line lower when it would run into the fastest one's.
    const near = Math.abs(sx(s.stats.median) - sx(s.stats.min)) < 110;
    return '<svg class="rte-fchart" viewBox="0 0 ' + W + ' ' + H + '">' +
        yt.map((v) => '<line class="rte-fgrid" x1="' + PAD.l + '" x2="' + (W - PAD.r) + '" y1="' + sy(v) + '" y2="' + sy(v) + '"/><text class="rte-ftick" x="' + (PAD.l - 5) + '" y="' + (sy(v) + 3) + '" text-anchor="end">' + (100 * v).toFixed(0) + '%</text>').join('') +
        ticks.map((v) => '<text class="rte-ftick" x="' + sx(v) + '" y="' + (H - PAD.b + 14) + '" text-anchor="middle">' + v.toFixed(1) + '</text>').join('') +
        '<text class="rte-ftick" x="' + (W - PAD.r) + '" y="' + (H - 2) + '" text-anchor="end">seconds</text>' +
        bars + marker(s.stats.min, 'fastest ' + sec(s.stats.min), 'rte-fbest', 'start', 0) + marker(s.stats.median, 'median ' + sec(s.stats.median), 'rte-fmedian', sx(s.stats.median) > W * 0.6 ? 'end' : 'start', near ? 1 : 0) +
        '</svg>';
}

/** A short distribution as rows of value, bar, share. */
function countsHtml(title: string, all: [number, number][], total: number, unit: string): string {
    const rows: [number | string, number][] = all.length <= MAX_ROWS ? all : (all.slice(0, MAX_ROWS - 1) as [number | string, number][])
        .concat([[all[MAX_ROWS - 1][0] + '+', all.slice(MAX_ROWS - 1).reduce((s, r) => s + r[1], 0)]]);
    const max = Math.max(...rows.map((r) => r[1]));
    return '<div class="rte-fsec"><div class="scr-side-h">' + esc(title) + '</div><table class="rte-fcounts"><tbody>' + rows.map(([v, c]) =>
        '<tr><td>' + v + ' ' + esc(unit) + '</td><td class="rte-fcbar"><i style="width:' + (100 * c / max).toFixed(1) + '%;background:' + BAR + '"></i></td><td>' + pct(c, total) + '</td></tr>').join('') + '</tbody></table></div>';
}

function inputsHtml(i: NonNullable<FightResult['inputs']>): string {
    const dur = (d: Fighter['knockback']) => d.random ? (d.ticks + d.random.base) + '–' + (d.ticks + d.random.base + d.random.range - 1) : String(d.ticks);
    const rows = i.fighters.map((f) => '<tr><td>' + esc(f.name) + ' <span class="scr-dim">' + esc(f.role) + '</span></td><td>' + f.hp + '</td><td>' + f.atk + '</td><td>' + f.def + '</td><td>' + f.evade + '</td><td>' + f.hitRate +
        '</td><td>' + f.chargeSpeed + '</td><td>' + f.swing.ticks + ' (' + f.swing.strikeAt + ')</td><td>' + dur(f.knockback) + '</td><td>' + (f.chance === null ? 'when full' : f.chance + '/256') + '</td></tr>').join('');
    const pairs = i.pairs.map((p) => '<tr><td>' + esc(p.from) + ' → ' + esc(p.to) + '</td><td>' + (100 * p.hit).toFixed(1) + '%</td><td>' + p.min + '–' + p.max + '</td></tr>').join('');
    return '<div class="rte-fsec"><div class="scr-side-h">Inputs</div><table class="rte-ftable"><thead><tr><th></th><th>HP</th><th>atk</th><th>def</th><th>eva</th><th>hit</th><th title="Charge a tick, to $400">chg</th><th title="Ticks (strike frame starts at)">swing</th><th title="Ticks">knockback</th><th title="Engage roll per idle tick when full">engage</th></tr></thead><tbody>' + rows + '</tbody></table>' +
        '<table class="rte-ftable"><thead><tr><th>swing</th><th>hit chance</th><th>damage</th></tr></thead><tbody>' + pairs + '</tbody></table></div>';
}

const ASSUMED = [
    'Everyone starts in reach with a full charge; nobody walks (positions and reach are not simulated).',
    'The Boy swings the moment his charge is full; the Dog and the enemy roll to engage every idle tick once full (5/256 for the flower, so its idle is random).',
    'One tick is one frame, 1/60 s. Damage counts on the target\'s next tick.',
    'Random numbers are uniform draws, not the game\'s own generator.',
    'Checked in the game for a Wimpy Flower killing the Boy (tools/routes/fight-in-game.mts, 80 deaths): median 16.5 s, 10–90% 9.8–27.2 s, 4 or 5 hits, 154 frames between attacks on average — the model gives 15.9 s, 9.7–25.6 s, 154 ticks. Other fights are not checked yet.',
];

/** The whole panel for one simulated step. */
export function fightPanelHtml(title: string, res: FightResult | 'pending' | undefined): string {
    const head = '<div class="rte-fhead"><b>' + esc(title) + '</b><button class="scr-btn" data-rte-sim="0" title="Back to the map">Map ↩</button></div>';
    if (!res || res === 'pending') return head + '<div class="scr-empty">Simulating 10,000 fights…</div>';
    if (res.error || !res.report || !res.inputs) return head + '<div class="scr-empty">' + esc(res.error || 'No result') + '</div>';
    const r = res.report, s = r.seconds.stats, done = r.runs - r.unfinished;
    const kill = res.until === 'enemy';
    const tiles = '<div class="rte-ftiles"><div><span>median</span><b>' + sec(s.median) + '</b></div><div><span>10–90%</span><b>' + s.p10.toFixed(2) + '–' + sec(s.p90) + '</b></div>' +
        '<div><span>fastest of ' + done.toLocaleString('en-US') + '</span><b>' + sec(s.min) + '</b></div><div><span>mean</span><b>' + sec(s.mean) + '</b></div></div>';
    // The floor the rules allow (every roll at its best at once): only worth a note when the runs never came near it.
    const floor = r.seconds.best < s.min - 0.05 ? '<div class="scr-note">The rules allow ' + sec(r.seconds.best) + ' only if every roll comes out best at once; ' +
        'not one of ' + done.toLocaleString('en-US') + ' fights did.</div>' : '';
    const knocked = kill ? '<div class="scr-note">' + res.inputs.fighters.filter((f) => f.role === 'attacks').map((f, k) => esc(f.name) + ' knocked back in ' + (100 * (r.knocked[k] || 0)).toFixed(1) + '% of fights').join(' · ') + '</div>' : '';
    return head + '<div class="rte-fbody">' + tiles + floor + '<div class="scr-side-h">' + (kill ? 'Time to kill' : 'Time until it dies') + ' · ' + done + ' fights</div>' + timeChart(r) + knocked +
        '<div class="rte-fcols">' + countsHtml(kill ? 'Hits to kill' : 'Hits taken', r.hits, done, 'hits') + countsHtml(kill ? 'Swings (Boy + Dog)' : 'Enemy attacks, misses included', r.swings, done, 'swings') + '</div>' +
        inputsHtml(res.inputs) +
        '<div class="rte-fsec"><div class="scr-side-h">Assumed</div><ul class="rte-list">' + ASSUMED.concat(res.party ? ['Party: ' + res.party] : []).map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul></div></div>';
}
