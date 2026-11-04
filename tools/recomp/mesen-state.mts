// A MesenCE save state for the recomp: writes its field stream, which the game loads at launch.
//
//   node tools/recomp/mesen-state.mts <movie.mmo | state.mss> <out>
//   SOE_COMPARE_MESEN_STATE=<out> ../SecretOfEvermoreRecomp/build/SecretOfEvermoreSNESRecomp
//
// The state must sit at a field's line 225, as every state MesenCE saves between frames does. It holds memory from your
// own ROM: never commit it.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { inflateState } = require('../../dist/platform/tas/mesen-movie');
const { readZip } = require('../../dist/platform/zip');

const [input, output] = process.argv.slice(2);
if (!output) { console.error('usage: mesen-state.mts <movie.mmo | state.mss> <out>'); process.exit(2); }
const file = readFileSync(input);
const state = /\.mmo$/i.test(input) ? readZip(file).find((f: { name: string }) => f.name === 'SaveState.mss')?.data : file;
if (!state) { console.error('the movie has no save state'); process.exit(1); }
writeFileSync(output, inflateState(state));
