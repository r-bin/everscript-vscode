import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildOpcodeSamples,
  buildOpcodeShapeDatabase,
  extractBranchTarget,
  loadScriptsAllTruth,
  type OpcodeSample,
} from './scripts-all-model.ts';
import { decodeOpcodeAtSnes, resolveSNESAddress } from '../model/rom-script-model.ts';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(moduleDir, '..');

const testsGeneratedDir = path.resolve(rootDir, 'tests', 'generated');
const opcodeCorpusDir = path.resolve(testsGeneratedDir, 'opcode-corpus');
const opcodeShapesDir = path.resolve(testsGeneratedDir, 'opcode-shapes');
const expressionCorpusDir = path.resolve(testsGeneratedDir, 'expression-corpus');
const referenceScriptsDir = path.resolve(testsGeneratedDir, 'reference-scripts');

const generatedArtifactsDir = path.resolve(rootDir, 'generated');

const BRANCH_OPCODES = new Set<number>([0x04, 0x08, 0x09, 0x29, 0xa5, 0xa6]);
const REFERENCE_SCRIPTS = new Set<number>([0x94e5fb, 0x94e795, 0x93912c]);

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function toHex(value: number, width = 2): string {
  return value.toString(16).padStart(width, '0');
}

function deterministicSample<T>(items: T[], limit: number, seed: number): T[] {
  if (items.length <= limit) {
    return [...items];
  }

  const copy = [...items];
  let state = (seed | 0) ^ 0x9e3779b9;

  for (let i = copy.length - 1; i > 0; i -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) | 0;
    const j = (state >>> 0) % (i + 1);
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }

  return copy.slice(0, limit);
}

function clearGeneratedTestFiles(dir: string): void {
  if (!fs.existsSync(dir)) {
    return;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.resolve(dir, entry.name);
    if (entry.isDirectory()) {
      clearGeneratedTestFiles(abs);
      continue;
    }
    if (entry.name.endsWith('.test.ts')) {
      fs.unlinkSync(abs);
    }
  }
}

function loadRomBytes(): Buffer {
  const romPath = path.resolve(rootDir, 'dependencies', 'rom.sfc');
  if (!fs.existsSync(romPath)) {
    throw new Error(`Missing ROM at ${romPath}`);
  }
  return fs.readFileSync(romPath);
}

type OpcodeCorpusEntry = {
  opcode: number;
  scriptStart: number;
  instructionAddress: number;
  nextInstructionAddress: number | null;
  expectedEndAddress: number;
  expectedSize: number | null;
  bytes: number[];
  text: string;
};

function toOpcodeCorpus(samples: OpcodeSample[], rom: Buffer): OpcodeCorpusEntry[] {
  const out: OpcodeCorpusEntry[] = [];

  for (const sample of samples) {
    const romOffset = resolveSNESAddress(sample.instructionAddress);
    const readLen =
      sample.expectedSize !== null && sample.expectedSize > 0
        ? sample.expectedSize
        : 1;

    const bytes: number[] = [];
    for (let i = 0; i < readLen; i += 1) {
      const idx = romOffset + i;
      if (idx < 0 || idx >= rom.length) {
        break;
      }
      bytes.push(rom[idx]);
    }

    out.push({
      opcode: sample.opcode,
      scriptStart: sample.scriptStart,
      instructionAddress: sample.instructionAddress,
      nextInstructionAddress: sample.nextInstructionAddress,
      expectedEndAddress: sample.scriptEnd,
      expectedSize: sample.expectedSize,
      bytes,
      text: sample.text,
    });
  }

  return out;
}

function writeScriptBoundaryTest(samples: OpcodeSample[]): void {
  const byScript = new Map<number, { startAddress: number; endAddress: number; size: number }>();

  for (const sample of samples) {
    if (!byScript.has(sample.scriptStart)) {
      byScript.set(sample.scriptStart, {
        startAddress: sample.scriptStart,
        endAddress: sample.scriptEnd,
        size: sample.scriptEnd - sample.scriptStart,
      });
    }
  }

  const payload = [...byScript.values()].sort((a, b) => a.startAddress - b.startAddress);

  const content = `import test from 'node:test';
import assert from 'node:assert/strict';

import { dumpScript } from '../../model/rom-script-model.ts';

const SCRIPT_BOUNDARIES = ${JSON.stringify(payload, null, 2)};

test('generated script boundaries from scripts_all corpus', () => {
  for (const expected of SCRIPT_BOUNDARIES) {
    const parsed = dumpScript(expected.startAddress);
    assert.ok(parsed.length > 0, 'no parsed instructions');

    const actualStart = parsed[0].snesAddress;
    const actualEnd = parsed[parsed.length - 1].snesAddress;
    const actualSize = actualEnd - actualStart;

    assert.equal(actualStart, expected.startAddress);
    assert.equal(actualEnd, expected.endAddress);
    assert.equal(actualSize, expected.size);
  }
});
`;

  fs.writeFileSync(path.resolve(testsGeneratedDir, 'script-boundaries.test.ts'), content);
}

function writeOpcodeCorpusTests(samples: OpcodeSample[]): Map<number, number> {
  const byOpcode = new Map<number, OpcodeSample[]>();

  for (const sample of samples) {
    if (sample.expectedSize === null || sample.expectedSize <= 0) {
      continue;
    }
    const arr = byOpcode.get(sample.opcode) ?? [];
    arr.push(sample);
    byOpcode.set(sample.opcode, arr);
  }

  const generatedCount = new Map<number, number>();

  for (const [opcode, opcodeSamples] of byOpcode.entries()) {
    const selected = deterministicSample(opcodeSamples, 100, opcode * 131 + 7).map((sample) => ({
      opcode: sample.opcode,
      instructionAddress: sample.instructionAddress,
      expectedSize: sample.expectedSize,
      text: sample.text,
    }));

    const content = `import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = ${JSON.stringify(selected, null, 2)};

test('opcode corpus 0x${toHex(opcode, 2)}', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
`;

    fs.writeFileSync(path.resolve(opcodeCorpusDir, `${toHex(opcode, 2)}.test.ts`), content);
    generatedCount.set(opcode, selected.length);
  }

  return generatedCount;
}

function shapeKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/0x[0-9a-f]+/gi, '{hex}')
    .replace(/\$[0-9a-f]+/gi, '{mem}')
    .replace(/\b\d+\b/g, '{num}')
    .replace(/\s+/g, ' ')
    .trim();
}

function writeOpcodeShapeTests(samples: OpcodeSample[]): Map<number, number> {
  const byOpcode = new Map<number, Map<string, OpcodeSample[]>>();

  for (const sample of samples) {
    if (sample.expectedSize === null || sample.expectedSize <= 0) {
      continue;
    }
    const opcodeMap = byOpcode.get(sample.opcode) ?? new Map<string, OpcodeSample[]>();
    const key = shapeKey(sample.text);
    const arr = opcodeMap.get(key) ?? [];
    arr.push(sample);
    opcodeMap.set(key, arr);
    byOpcode.set(sample.opcode, opcodeMap);
  }

  const shapeTestCount = new Map<number, number>();

  for (const [opcode, shapeMap] of byOpcode.entries()) {
    const representatives: Array<{ shape: string; instructionAddress: number; expectedSize: number; opcode: number }> = [];

    for (const [shape, shapeSamples] of shapeMap.entries()) {
      const picked = deterministicSample(shapeSamples, 1, shape.length + opcode)[0];
      representatives.push({
        shape,
        instructionAddress: picked.instructionAddress,
        expectedSize: picked.expectedSize as number,
        opcode: picked.opcode,
      });
    }

    representatives.sort((a, b) => a.instructionAddress - b.instructionAddress);

    const content = `import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = ${JSON.stringify(representatives, null, 2)};

test('opcode shape corpus 0x${toHex(opcode, 2)}', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
`;

    fs.writeFileSync(path.resolve(opcodeShapesDir, `${toHex(opcode, 2)}-shapes.test.ts`), content);
    shapeTestCount.set(opcode, representatives.length);
  }

  return shapeTestCount;
}

function writeBranchValidationTests(samples: OpcodeSample[]): void {
  const branchCases = samples
    .filter((sample) => BRANCH_OPCODES.has(sample.opcode))
    .map((sample) => ({
      opcode: sample.opcode,
      instructionAddress: sample.instructionAddress,
      expectedBranchTarget: extractBranchTarget(sample.opcode, sample.text),
    }))
    .filter((sample) => typeof sample.expectedBranchTarget === 'number')
    .map((sample) => ({
      opcode: sample.opcode,
      instructionAddress: sample.instructionAddress,
      expectedBranchTarget: sample.expectedBranchTarget as number,
    }));

  const selected = deterministicSample(branchCases, 500, 0x5a5a5a5a);

  const content = `import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../model/rom-script-model.ts';

const BRANCH_CASES = ${JSON.stringify(selected, null, 2)};

test('generated branch validation corpus', () => {
  for (const sample of BRANCH_CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.branchTarget, sample.expectedBranchTarget);
  }
});
`;

  fs.writeFileSync(path.resolve(testsGeneratedDir, 'branch-targets.test.ts'), content);
}

type PatternDef = { name: string; matcher: RegExp };

function writeExpressionCorpusTests(samples: OpcodeSample[]): void {
  const patterns: PatternDef[] = [
    { name: 'flag-check', matcher: /\bIF\b.*\$[0-9a-f]+/i },
    { name: 'memory-compare', matcher: /\bIF\b.*==/i },
    { name: 'negated-compare', matcher: /\bIF\b.*!/i },
    { name: 'rng', matcher: /\brng\b/i },
    { name: 'sleep', matcher: /\bSLEEP\b/i },
    { name: 'bitmask', matcher: /\bIF\b.*&/i },
  ];

  for (const pattern of patterns) {
    const matches = samples
      .filter((sample) => sample.expectedSize !== null && sample.expectedSize > 0)
      .filter((sample) => pattern.matcher.test(sample.text));

    if (matches.length < 20) {
      continue;
    }

    const selected = deterministicSample(matches, Math.min(100, matches.length), pattern.name.length * 67).map((sample) => ({
      opcode: sample.opcode,
      instructionAddress: sample.instructionAddress,
      expectedBytesConsumed: sample.expectedSize,
      text: sample.text,
    }));

    const content = `import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SAMPLES = ${JSON.stringify(selected, null, 2)};

test('expression corpus: ${pattern.name}', () => {
  for (const sample of SAMPLES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.size, sample.expectedBytesConsumed);
  }
});
`;

    fs.writeFileSync(path.resolve(expressionCorpusDir, `${pattern.name}.test.ts`), content);
  }
}

function writeReferenceScriptTests(samples: OpcodeSample[]): void {
  const byScript = new Map<number, OpcodeSample[]>();

  for (const sample of samples) {
    if (!REFERENCE_SCRIPTS.has(sample.scriptStart)) {
      continue;
    }
    const arr = byScript.get(sample.scriptStart) ?? [];
    arr.push(sample);
    byScript.set(sample.scriptStart, arr);
  }

  for (const [scriptStart, scriptSamples] of byScript.entries()) {
    scriptSamples.sort((a, b) => a.instructionAddress - b.instructionAddress);

    const expected = {
      startAddress: scriptStart,
      endAddress: scriptSamples[scriptSamples.length - 1].instructionAddress,
      instructionCount: scriptSamples.length,
      opcodeSequence: scriptSamples.map((sample) => sample.opcode),
    };

    const content = `import test from 'node:test';
import assert from 'node:assert/strict';

import { dumpScript } from '../../../model/rom-script-model.ts';

const EXPECTED = ${JSON.stringify(expected, null, 2)};

test('reference script 0x${toHex(scriptStart, 6)}', () => {
  const parsed = dumpScript(EXPECTED.startAddress);

  assert.ok(parsed.length > 0, 'no parsed instructions');
  assert.equal(parsed[0].snesAddress, EXPECTED.startAddress);
  assert.equal(parsed[parsed.length - 1].snesAddress, EXPECTED.endAddress);
  assert.equal(parsed.length, EXPECTED.instructionCount);
  assert.deepEqual(parsed.map((i) => i.opcode), EXPECTED.opcodeSequence);
});
`;

    fs.writeFileSync(path.resolve(referenceScriptsDir, `${toHex(scriptStart, 6)}.test.ts`), content);
  }
}

function writeOpcodeShapesJson(samples: OpcodeSample[]): ReturnType<typeof buildOpcodeShapeDatabase> {
  const db = buildOpcodeShapeDatabase(samples).map((entry) => ({
    opcode: entry.opcode,
    count: entry.count,
    observedSizes: entry.observedSizes,
    samples: deterministicSample(entry.samples, 100, entry.opcode * 13),
    shapes: entry.shapes,
  }));

  fs.writeFileSync(path.resolve(generatedArtifactsDir, 'opcode-shapes.json'), `${JSON.stringify(db, null, 2)}\n`);
  return db;
}

function computeOpcodeFailStats(corpus: OpcodeCorpusEntry[]): Map<number, { failing: number; passing: number }> {
  const stats = new Map<number, { failing: number; passing: number }>();

  for (const sample of corpus) {
    if (sample.expectedSize === null || sample.expectedSize <= 0) {
      continue;
    }

    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    const ok = decoded.opcode === sample.opcode && decoded.size === sample.expectedSize;

    const existing = stats.get(sample.opcode) ?? { failing: 0, passing: 0 };
    if (ok) {
      existing.passing += 1;
    } else {
      existing.failing += 1;
    }
    stats.set(sample.opcode, existing);
  }

  return stats;
}

function writeOpcodePriorityMarkdown(
  shapeDb: ReturnType<typeof buildOpcodeShapeDatabase>,
  failStats: Map<number, { failing: number; passing: number }>,
): void {
  const rows = shapeDb
    .map((entry) => {
      const stats = failStats.get(entry.opcode) ?? { failing: 0, passing: 0 };
      const total = stats.failing + stats.passing;
      const passRate = total === 0 ? 0 : (stats.passing / total) * 100;
      return {
        opcode: entry.opcode,
        count: entry.count,
        observedSizes: entry.observedSizes,
        observedShapes: entry.shapes.length,
        failing: stats.failing,
        passing: stats.passing,
        passRate,
      };
    })
    .sort((a, b) => b.failing - a.failing || b.count - a.count || a.opcode - b.opcode);

  const lines: string[] = [];
  lines.push('# Opcode Priority');
  lines.push('');
  lines.push('| Opcode | Corpus Count | Observed Sizes | Observed Shapes | Failing Tests | Passing Tests | Pass Rate |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const row of rows) {
    const sizes = row.observedSizes.length > 0 ? row.observedSizes.join(', ') : 'none';
    lines.push(
      `| 0x${toHex(row.opcode, 2)} | ${row.count} | ${sizes} | ${row.observedShapes} | ${row.failing} | ${row.passing} | ${row.passRate.toFixed(2)}% |`,
    );
  }

  fs.writeFileSync(path.resolve(generatedArtifactsDir, 'opcode-priority.md'), `${lines.join('\n')}\n`);
}

function writeCoverageMarkdown(
  shapeDb: ReturnType<typeof buildOpcodeShapeDatabase>,
  corpusCount: Map<number, number>,
  shapeCount: Map<number, number>,
): void {
  const lines: string[] = [];
  lines.push('# Opcode Coverage');
  lines.push('');
  lines.push('Generated from dependencies/scripts_all.txt and used to build truth-based corpus tests.');
  lines.push('');
  lines.push('| Opcode | Corpus Samples | Observed Shapes | Observed Sizes | Generated Tests |');
  lines.push('|---|---|---|---|---|');

  for (const entry of shapeDb) {
    const sizes = entry.observedSizes.length > 0 ? entry.observedSizes.join(', ') : 'none';
    const generatedTests = corpusCount.get(entry.opcode) ?? 0;
    const shapeTests = shapeCount.get(entry.opcode) ?? 0;
    lines.push(
      `| 0x${toHex(entry.opcode, 2)} | ${entry.count} | ${entry.shapes.length} | ${sizes} | ${generatedTests} corpus + ${shapeTests} shape |`,
    );
  }

  fs.writeFileSync(path.resolve(generatedArtifactsDir, 'opcode-coverage.md'), `${lines.join('\n')}\n`);
}

function writeCurrentStateMarkdown(
  scriptsCount: number,
  opcodeSampleCount: number,
  shapeDb: ReturnType<typeof buildOpcodeShapeDatabase>,
  failStats: Map<number, { failing: number; passing: number }>,
): void {
  const testFiles: string[] = [];

  function collectTests(dir: string): void {
    if (!fs.existsSync(dir)) {
      return;
    }
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.resolve(dir, entry.name);
      if (entry.isDirectory()) {
        collectTests(abs);
        continue;
      }
      if (entry.name.endsWith('.test.ts')) {
        testFiles.push(path.relative(rootDir, abs));
      }
    }
  }

  collectTests(path.resolve(rootDir, 'tests'));
  testFiles.sort();

  const existingTests = testFiles.filter((p) => !p.startsWith('tests/generated/'));
  const generatedTests = testFiles.filter((p) => p.startsWith('tests/generated/'));

  const parserFiles = [
    'model/rom-script-model.ts',
    'dump-scripts.ts',
    'src/scripts-all-model.ts',
    'src/generate-truth-tests.ts',
  ];

  const ranked = [...shapeDb]
    .map((entry) => {
      const stat = failStats.get(entry.opcode) ?? { failing: 0, passing: 0 };
      return { opcode: entry.opcode, failing: stat.failing, passing: stat.passing, count: entry.count };
    })
    .sort((a, b) => b.failing - a.failing)
    .slice(0, 12);

  const lines: string[] = [];
  lines.push('# Current State');
  lines.push('');
  lines.push('## Existing Tests');
  lines.push('');
  lines.push(`- Count: ${existingTests.length}`);
  for (const t of existingTests.slice(0, 30)) {
    lines.push(`- ${t}`);
  }
  if (existingTests.length > 30) {
    lines.push(`- ... (${existingTests.length - 30} more)`);
  }

  lines.push('');
  lines.push('## Generated Tests');
  lines.push('');
  lines.push(`- Count: ${generatedTests.length}`);
  lines.push(`- Scripts in truth model: ${scriptsCount}`);
  lines.push(`- Opcode samples in corpus: ${opcodeSampleCount}`);
  lines.push(`- Unique opcodes observed: ${shapeDb.length}`);
  for (const t of generatedTests.slice(0, 40)) {
    lines.push(`- ${t}`);
  }
  if (generatedTests.length > 40) {
    lines.push(`- ... (${generatedTests.length - 40} more)`);
  }

  lines.push('');
  lines.push('## Opcode Coverage');
  lines.push('');
  lines.push('- See generated/opcode-coverage.md');
  lines.push('- See generated/opcode-shapes.json');

  lines.push('');
  lines.push('## Parser Files');
  lines.push('');
  for (const p of parserFiles) {
    lines.push(`- ${p}`);
  }

  lines.push('');
  lines.push('## Known Failures');
  lines.push('');
  for (const row of ranked) {
    lines.push(`- opcode 0x${toHex(row.opcode, 2)}: failing=${row.failing}, passing=${row.passing}, corpus=${row.count}`);
  }

  lines.push('');
  lines.push('## Known Assumptions');
  lines.push('');
  lines.push('- scripts_all instruction extraction uses first top-level indent for each enter script block.');
  lines.push('- script end is first top-level opcode 0x00 line in each enter script block.');
  lines.push('- branch targets are parsed from text patterns like `(to 0x...)` and `CALL 0x...`.');
  lines.push('- LoROM address mapping is used for ROM byte extraction.');

  lines.push('');
  lines.push('## Classification');
  lines.push('');
  lines.push('### Truth-derived');
  lines.push('- Script start addresses from `enter script at ... => 0x...` in scripts_all.');
  lines.push('- Instruction opcode/address/text from scripts_all top-level lines.');
  lines.push('- Expected size from adjacent instruction addresses in scripts_all.');
  lines.push('- Branch targets from scripts_all instruction text.');

  lines.push('');
  lines.push('### Parser-derived');
  lines.push('- `decodeOpcodeAtSnes` decoded opcode and size for pass/fail scoring.');
  lines.push('- `dumpScript` execution output for boundary/reference checks.');

  lines.push('');
  lines.push('### Assumption-derived');
  lines.push('- Shape grouping via normalized text templates.');
  lines.push('- Expression pattern buckets based on regex categories.');
  lines.push('- First top-level END interpreted as script terminator.');

  lines.push('');
  lines.push('## TODO');
  lines.push('');
  lines.push('- Freeze implementation changes to src/rom-script-model.ts, src/opcodes/*, src/expressions/* for opcode phase.');
  lines.push('- Use generated/opcode-priority.md to select one opcode for next implementation iteration.');
  lines.push('- Produce generated/opcode-XX-investigation.md before any opcode change.');

  fs.writeFileSync(path.resolve(generatedArtifactsDir, 'current-state.md'), `${lines.join('\n')}\n`);
}

function writeTruthsMarkdown(corpus: OpcodeCorpusEntry[]): void {
  const byScript = new Map<number, { end: number; count: number }>();

  for (const sample of corpus) {
    const existing = byScript.get(sample.scriptStart);
    if (!existing) {
      byScript.set(sample.scriptStart, { end: sample.expectedEndAddress, count: 1 });
    } else {
      existing.count += 1;
    }
  }

  const rows = [...byScript.entries()]
    .map(([start, meta]) => ({ start, end: meta.end, count: meta.count, size: meta.end - start }))
    .sort((a, b) => a.start - b.start)
    .slice(0, 120);

  const lines: string[] = [];
  lines.push('# Truths');
  lines.push('');
  lines.push('Generated strictly from dependencies/scripts_all.txt and dependencies/rom.sfc.');
  lines.push('');
  lines.push('| Script Start | Script End | Size | Instructions |');
  lines.push('|---|---|---|---|');
  for (const row of rows) {
    lines.push(`| 0x${toHex(row.start, 6)} | 0x${toHex(row.end, 6)} | ${row.size} | ${row.count} |`);
  }

  fs.writeFileSync(path.resolve(generatedArtifactsDir, 'truths.md'), `${lines.join('\n')}\n`);
}

function main(): void {
  ensureDir(testsGeneratedDir);
  ensureDir(opcodeCorpusDir);
  ensureDir(opcodeShapesDir);
  ensureDir(expressionCorpusDir);
  ensureDir(referenceScriptsDir);
  ensureDir(generatedArtifactsDir);

  clearGeneratedTestFiles(testsGeneratedDir);

  const truth = loadScriptsAllTruth();
  const samples = buildOpcodeSamples(truth);
  const rom = loadRomBytes();
  const corpus = toOpcodeCorpus(samples, rom);

  fs.writeFileSync(path.resolve(generatedArtifactsDir, 'opcode-corpus.json'), `${JSON.stringify(corpus, null, 2)}\n`);

  writeScriptBoundaryTest(samples);
  const corpusCount = writeOpcodeCorpusTests(samples);
  const shapeCount = writeOpcodeShapeTests(samples);
  writeBranchValidationTests(samples);
  writeExpressionCorpusTests(samples);
  writeReferenceScriptTests(samples);

  const shapeDb = writeOpcodeShapesJson(samples);
  const failStats = computeOpcodeFailStats(corpus);

  writeCoverageMarkdown(shapeDb, corpusCount, shapeCount);
  writeOpcodePriorityMarkdown(shapeDb, failStats);
  writeCurrentStateMarkdown(truth.scripts.length, samples.length, shapeDb, failStats);
  writeTruthsMarkdown(corpus);

  process.stdout.write(
    `Generated corpus: scripts=${truth.scripts.length}, opcodeSamples=${samples.length}, opcodes=${shapeDb.length}.\n`,
  );
}

main();
