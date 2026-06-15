import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface ScriptInstructionTruth {
  address: number;
  opcode: number;
  text: string;
}

export interface ScriptTruth {
  startAddress: number;
  endAddress: number;
  size: number;
  instructions: ScriptInstructionTruth[];
}

export interface ScriptsAllTruth {
  scripts: ScriptTruth[];
}

export interface OpcodeSample {
  opcode: number;
  instructionAddress: number;
  nextInstructionAddress: number | null;
  expectedSize: number | null;
  text: string;
  scriptStart: number;
  scriptEnd: number;
}

export interface OpcodeShapeDatabaseEntry {
  opcode: number;
  count: number;
  observedSizes: number[];
  shapes: string[];
  samples: OpcodeSample[];
}

type WorkingScript = {
  startAddress: number;
  instructions: ScriptInstructionTruth[];
  endAddress: number | null;
  baseIndent: number | null;
  closed: boolean;
};

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const dependenciesDir = path.resolve(moduleDir, '..', 'dependencies');

function getScriptsAllPath(): string {
  const candidatePath = path.resolve(dependenciesDir, 'scripts_all.txt');
  if (fs.existsSync(candidatePath)) {
    return candidatePath;
  }
  throw new Error(`Could not find scripts_all.txt in ${dependenciesDir}`);
}

export function loadScriptsAllText(): string {
  return fs.readFileSync(getScriptsAllPath(), 'utf8');
}

function parseHex(text: string): number {
  const normalized = text.toLowerCase().startsWith('0x') ? text.slice(2) : text;
  return Number.parseInt(normalized, 16);
}

function toWorkingScript(startAddress: number): WorkingScript {
  return {
    startAddress,
    instructions: [],
    endAddress: null,
    baseIndent: null,
    closed: false,
  };
}

function finalizeScript(current: WorkingScript | null): ScriptTruth | null {
  if (!current || current.endAddress === null || current.instructions.length === 0) {
    return null;
  }
  return {
    startAddress: current.startAddress,
    endAddress: current.endAddress,
    size: current.endAddress - current.startAddress,
    instructions: current.instructions,
  };
}

export function parseScriptsAll(text: string): ScriptsAllTruth {
  const scripts: ScriptTruth[] = [];
  const lines = text.split(/\r?\n/);

  let current: WorkingScript | null = null;

  for (const line of lines) {
    const startMatch = line.match(/enter script at 0x[0-9a-f]+\s*=>\s*0x([0-9a-f]+)/i);
    if (startMatch) {
      const finalized = finalizeScript(current);
      if (finalized) {
        scripts.push(finalized);
      }
      current = toWorkingScript(parseHex(startMatch[1]));
      continue;
    }

    if (!current) {
      continue;
    }

    if (current.closed) {
      continue;
    }

    const instructionMatch = line.match(/^(\s*)\[0x([0-9a-f]+)\]\s+\(([0-9a-f]{2})\)\s+(.*)$/i);
    if (!instructionMatch) {
      continue;
    }

    const indent = instructionMatch[1].length;
    const address = parseHex(instructionMatch[2]);
    const opcode = parseHex(instructionMatch[3]);
    const textPart = instructionMatch[4].trim();

    if (current.baseIndent === null) {
      current.baseIndent = indent;
    }

    if (indent !== current.baseIndent) {
      continue;
    }

    current.instructions.push({
      address,
      opcode,
      text: textPart,
    });

    if (opcode === 0x00 && /END/i.test(textPart) && current.endAddress === null) {
      current.endAddress = address;
      current.closed = true;
    }
  }

  const finalized = finalizeScript(current);
  if (finalized) {
    scripts.push(finalized);
  }

  return { scripts };
}

export function loadScriptsAllTruth(): ScriptsAllTruth {
  return parseScriptsAll(loadScriptsAllText());
}

export function buildOpcodeSamples(truth: ScriptsAllTruth): OpcodeSample[] {
  const samples: OpcodeSample[] = [];

  for (const script of truth.scripts) {
    for (let i = 0; i < script.instructions.length; i += 1) {
      const current = script.instructions[i];
      const next = script.instructions[i + 1] ?? null;
      const nextInstructionAddress = next ? next.address : null;
      const expectedSize = nextInstructionAddress === null ? null : nextInstructionAddress - current.address;

      samples.push({
        opcode: current.opcode,
        instructionAddress: current.address,
        nextInstructionAddress,
        expectedSize,
        text: current.text,
        scriptStart: script.startAddress,
        scriptEnd: script.endAddress,
      });
    }
  }

  return samples;
}

function normalizeShape(text: string): string {
  return text
    .toLowerCase()
    .replace(/0x[0-9a-f]+/gi, '{hex}')
    .replace(/\$[0-9a-f]+/gi, '{mem}')
    .replace(/\b\d+\b/g, '{num}')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractBranchTarget(opcode: number, text: string): number | null {
  const toMatch = text.match(/\(to\s+0x([0-9a-f]+)\)/i);
  if (toMatch) {
    return parseHex(toMatch[1]);
  }

  if (opcode === 0x29) {
    const callMatch = text.match(/\bCALL\s+0x([0-9a-f]+)/i);
    if (callMatch) {
      return parseHex(callMatch[1]);
    }
  }

  return null;
}

export function buildOpcodeShapeDatabase(samples: OpcodeSample[]): OpcodeShapeDatabaseEntry[] {
  const byOpcode = new Map<number, OpcodeSample[]>();
  for (const sample of samples) {
    const arr = byOpcode.get(sample.opcode) ?? [];
    arr.push(sample);
    byOpcode.set(sample.opcode, arr);
  }

  const out: OpcodeShapeDatabaseEntry[] = [];
  for (const [opcode, opcodeSamples] of byOpcode.entries()) {
    const observedSizes = [...new Set(opcodeSamples.map((s) => s.expectedSize).filter((n): n is number => typeof n === 'number' && n > 0))]
      .sort((a, b) => a - b);

    const shapes = [...new Set(opcodeSamples.map((s) => normalizeShape(s.text)))].sort();

    out.push({
      opcode,
      count: opcodeSamples.length,
      observedSizes,
      shapes,
      samples: opcodeSamples,
    });
  }

  return out.sort((a, b) => a.opcode - b.opcode);
}
