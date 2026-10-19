#!/usr/bin/env node
// TODO port to TS (docs/todo/port-to-ts.md)
'use strict';

/**
 * Autonomous Decompilation Loop Runner (with Parallel Subagents / Concurrency)
 *
 * Runs "continue the decompilation" repeatedly using AI agent CLIs (Claude Code, Antigravity CLI,
 * or custom runner via AI_CMD) until either:
 *   1. All targets in docs/disassembly/PROGRESS.md are completed, OR
 *   2. The API / model quota or rate limit is reached.
 *
 * Parallel Execution:
 *   Supports --concurrency <N> (or -j <N>) to partition the queue across N parallel subagent workers
 *   working on distinct routines simultaneously without merge conflicts.
 *
 * Usage:
 *   node scripts/auto-decompile.js [--runner "claude -p"] [--concurrency 3] [--max-iterations N]
 *   ./scripts/auto-decompile.sh --concurrency 3
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const PROGRESS_FILE = path.join(REPO, 'docs', 'disassembly', 'PROGRESS.md');

const QUOTA_PATTERNS = [
    /quota/i,
    /rate\s*limit/i,
    /resource_exhausted/i,
    /usage\s*limit/i,
    /insufficient\s*quota/i,
    /out\s*of\s*credits?/i,
    /credit\s*balance/i,
    /too\s*many\s*requests/i,
    /\b429\b/,
    /capacity/i,
    /overloaded/i,
];

function parseArgs(argv) {
    const opts = {
        runner: process.env.AI_CMD || null,
        concurrency: 1,
        maxIterations: 100,
        prompt: 'continue the decompilation',
        intervalSec: 5,
    };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--runner' && argv[i + 1]) opts.runner = argv[++i];
        else if ((argv[i] === '--concurrency' || argv[i] === '-j') && argv[i + 1]) opts.concurrency = Math.max(1, parseInt(argv[++i], 10));
        else if (argv[i] === '--max-iterations' && argv[i + 1]) opts.maxIterations = parseInt(argv[++i], 10);
        else if (argv[i] === '--prompt' && argv[i + 1]) opts.prompt = argv[++i];
        else if (argv[i] === '--interval' && argv[i + 1]) opts.intervalSec = parseInt(argv[++i], 10);
    }
    return opts;
}

function detectDefaultRunner() {
    const candidates = [
        { cmd: 'claude', args: ['-p'] },
        { cmd: 'agy', args: ['--prompt'] },
    ];
    for (const c of candidates) {
        const { spawnSync } = require('child_process');
        const check = spawnSync('which', [c.cmd], { encoding: 'utf8' });
        if (check.status === 0 && check.stdout.trim()) {
            return `${c.cmd} ${c.args.join(' ')}`;
        }
    }
    return null;
}

function checkProgress() {
    if (!fs.existsSync(PROGRESS_FILE)) {
        return { isComplete: false, pendingTargets: [], progressPct: 0 };
    }
    const content = fs.readFileSync(PROGRESS_FILE, 'utf8');

    // Parse progress percentage (handles markdown bolding like **1.2 %**)
    const mPct = /Clean C Decompiled Functions.*?\|\s*[*_]*(\d+(?:\.\d+)?)\s*%/i.exec(content);
    const progressPct = mPct ? parseFloat(mPct[1]) : 0;

    // Check prioritized next targets section
    const targetsSec = content.split('## 3. Prioritized Next Targets')[1] || '';
    const endSec = targetsSec.split(/## \d+\./)[0];
    const targets = [];
    const re = /\*\*Target \d+:\s*([^*]+)\*\*/g;
    let m;
    while ((m = re.exec(endSec)) !== null) {
        targets.push(m[1].trim());
    }

    const isComplete = targets.length === 0 || progressPct >= 100.0;
    return { isComplete, pendingTargets: targets, progressPct };
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function isQuotaError(output) {
    if (!output) return false;
    return QUOTA_PATTERNS.some(pat => pat.test(output));
}

/** Execute a single subagent worker asynchronously with output streaming and quota detection. */
function executeSubagent(runnerStr, prompt, workerId, targetName) {
    return new Promise((resolve) => {
        const parts = runnerStr.split(' ');
        const bin = parts[0];
        const baseArgs = parts.slice(1);
        const fullArgs = [...baseArgs, prompt];

        console.log(`[Worker ${workerId}] Started -> Target: ${targetName}`);
        const start = Date.now();

        const child = spawn(bin, fullArgs, {
            cwd: REPO,
            env: process.env,
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        let output = '';
        child.stdout.on('data', (d) => { output += d.toString(); });
        child.stderr.on('data', (d) => { output += d.toString(); });

        child.on('close', (status) => {
            const elapsed = ((Date.now() - start) / 1000).toFixed(1);
            const isQuota = isQuotaError(output);
            if (status === 0) {
                console.log(`[Worker ${workerId}] ✅ Finished in ${elapsed}s (Target: ${targetName})`);
            } else if (isQuota) {
                console.log(`[Worker ${workerId}] ⚠️ Quota / rate limit hit in ${elapsed}s!`);
            } else {
                console.log(`[Worker ${workerId}] ❌ Exited with status ${status} in ${elapsed}s`);
            }
            resolve({ workerId, targetName, status, output, isQuota });
        });
    });
}

async function main() {
    const opts = parseArgs(process.argv.slice(2));
    let runnerStr = opts.runner || detectDefaultRunner();

    console.log('================================================================');
    console.log('Secret of Evermore — Parallel Autonomous Decompilation Loop');
    console.log(`Concurrency: ${opts.concurrency} worker subagent(s)`);
    console.log('================================================================');

    if (!runnerStr) {
        console.warn('Notice: No AI CLI runner (e.g. claude or agy) auto-detected in PATH.');
        console.warn('You can specify a custom runner with --runner "<command>", or run inside');
        console.warn('the chat interface using the slash command:');
        console.warn('  /goal continue the decompilation untill the quota is up or the project was completed\n');
        console.log('Checking current project state in docs/disassembly/PROGRESS.md...\n');
    } else {
        console.log(`Runner: ${runnerStr}`);
    }

    let iteration = 0;

    while (iteration < opts.maxIterations) {
        iteration++;
        const state = checkProgress();

        console.log(`\n--- Iteration ${iteration} [Current C Decomp: ${state.progressPct}%] ---`);

        if (state.isComplete) {
            console.log('🎉 Project completed! All prioritized targets in PROGRESS.md have been decompiled.');
            break;
        }

        console.log(`Pending Targets in Queue (${state.pendingTargets.length}):`);
        state.pendingTargets.slice(0, 5).forEach((t, i) => console.log(`  ${i + 1}. ${t}`));
        if (state.pendingTargets.length > 5) {
            console.log(`  ... and ${state.pendingTargets.length - 5} more`);
        }

        if (!runnerStr) {
            console.log('\nReady for next step. Set AI_CMD="<runner>" or run with --runner to automate.');
            break;
        }

        // Partition targets across workers
        const batchSize = Math.min(opts.concurrency, state.pendingTargets.length);
        const batchTargets = state.pendingTargets.slice(0, batchSize);

        console.log(`\nLaunching ${batchSize} subagent worker(s) in parallel...`);

        const promises = batchTargets.map((target, idx) => {
            const workerPrompt = `continue the decompilation on target: ${target}. Follow .agents/agents/decomp-curator.md rules: inspect assembly, cross-reference recomp C and Ghidra notes, decompile into clean C in docs/disassembly/, create knowledge entries in knowledge/rom/, and update PROGRESS.md.`;
            return executeSubagent(runnerStr, workerPrompt, idx + 1, target);
        });

        const results = await Promise.all(promises);

        const quotaHit = results.find(r => r.isQuota);
        if (quotaHit) {
            console.log('\n⚠️  Model / API quota or rate limit reached on one or more workers!');
            console.log('The parallel loop has paused cleanly. Progress and documentation');
            console.log('have been preserved in docs/disassembly/PROGRESS.md.');
            console.log('You can resume anytime once quota resets.');
            break;
        }

        const postState = checkProgress();
        console.log(`\nPost-batch C Decomp Progress: ${postState.progressPct}%`);

        if (postState.isComplete) {
            console.log('🎉 All targets completed!');
            break;
        }

        console.log(`Cooling down for ${opts.intervalSec}s before next batch...`);
        await sleep(opts.intervalSec * 1000);
    }

    console.log('\n================================================================');
    console.log('Parallel decompilation loop session ended.');
    console.log('See docs/disassembly/PROGRESS.md for up-to-date census.');
    console.log('================================================================');
}

if (require.main === module) {
    main().catch(err => {
        console.error(err);
        process.exit(1);
    });
}

module.exports = { checkProgress, isQuotaError, parseArgs };
