#!/usr/bin/env node
'use strict';

const fs = require('fs');
const {
    DEFAULT_TRACE_PATH,
    loadTrace,
    loadRom,
    dumpOpcode93Commands,
    formatOpcode93Dump,
} = require('../memory_radar/models/render-script-model');

function usage() {
    console.log('Usage:');
    console.log('  node tools/render-script-dump-93.js [tracePath] [romPath]');
    console.log('  ROM=/path/to/rom.smc node tools/render-script-dump-93.js [tracePath]');
    console.log('');
    console.log(`Default trace: ${DEFAULT_TRACE_PATH}`);
}

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) {
    usage();
    process.exit(0);
}

const tracePath = argv[0] || DEFAULT_TRACE_PATH;
if (!tracePath || !fs.existsSync(tracePath)) {
    console.error('Trace not found. Pass a valid trace path.');
    process.exit(1);
}

const traceText = loadTrace(tracePath);
const romBuf = loadRom(argv[1]);
const commands = dumpOpcode93Commands(traceText, romBuf);
process.stdout.write(formatOpcode93Dump(commands));
if (commands.length && !formatOpcode93Dump(commands).endsWith('\n')) process.stdout.write('\n');