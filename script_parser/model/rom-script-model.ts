import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type Instruction = {
  pc: number;
  snesAddress: number;
  opcode: number;
  operands: number[];
  size: number;
  label?: string;
  branchTarget?: number;
  callDepth: number;
};

export type ParseScriptResult = {
  startAddress: number;
  endAddress: number | null;
  terminated: boolean;
  endOpcode: number | null;
  instructionCount: number;
  instructions: Instruction[];
};

type DecodeInfo = {
  size: number;
  label?: string;
  branchTarget?: number;
  kind: 'normal' | 'cond-branch' | 'rcall' | 'end';
};

const OPCODE_SIZE_TABLE: Record<number, number> = {
  0x00: 1,
  // Small immediate/control ops observed in ROM script streams.
  0x01: 2,
  0x02: 3,
  0x03: 3,
  0x04: 2,
  0x05: 2,
  0x06: 2,
  0x07: 2,
  0x08: 6,
  0x09: 6,
  0x0a: 2,
  0x0b: 2,
  0x0c: 4,
  0x0d: 2,
  0x0e: 4,
  0x0f: 4,
  0x18: 4,
  0x1b: 7,
  0x20: 3,
  0x29: 4,
  0x33: 2,
  0x86: 3,
  0xa3: 2,
  0xa5: 2,
  0xa6: 2,
  0xa7: 2,
};

const CONDITIONAL_BRANCH_OPCODES = new Set<number>([0x08, 0x09]);
const RCALL_OPCODES = new Set<number>([0x0a, 0xa5, 0xa6]);

let romBytesCache: Buffer | null = null;

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

function getRomBytes(): Buffer {
  if (romBytesCache) {
    return romBytesCache;
  }

  const dependenciesDir = path.resolve(moduleDir, '..', 'dependencies');
  const candidates = ['rom.sfc', 'Secret of Evermore (U) [!].smc'];
  let romPath: string | null = null;

  for (const candidate of candidates) {
    const candidatePath = path.resolve(dependenciesDir, candidate);
    if (fs.existsSync(candidatePath)) {
      romPath = candidatePath;
      break;
    }
  }

  if (!romPath) {
    throw new Error(`Could not locate ROM file in ${dependenciesDir}`);
  }

  romBytesCache = fs.readFileSync(romPath);
  return romBytesCache;
}

export function resolveSNESAddress(addr: number): number {
  const bank = (addr >>> 16) & 0xff;
  const address = addr & 0xffff;
  return ((bank & 0x7f) * 0x8000) + (address & 0x7fff);
}

function toSigned8(value: number): number {
  return value > 0x7f ? value - 0x100 : value;
}

function toSnesAddressFromPc(pc: number, startAddr: number, startOffset: number): number {
  return startAddr + (pc - startOffset);
}

function getInstructionSize(opcode: number): number {
  return OPCODE_SIZE_TABLE[opcode] ?? 1;
}

function decodeInstruction(rom: Buffer, pc: number): DecodeInfo {
  if (pc < 0 || pc >= rom.length) {
    throw new Error(`ROM out of bounds at 0x${pc.toString(16)}`);
  }

  const opcode = rom[pc];
  const size = getInstructionSize(opcode);

  if (size <= 0 || pc + size > rom.length) {
    throw new Error(
      `Instruction desync at offset 0x${pc.toString(16)} (opcode 0x${opcode.toString(16)}, size ${size})`,
    );
  }

  if (opcode === 0x00) {
    return { size, label: 'END', kind: 'end' };
  }

  if (CONDITIONAL_BRANCH_OPCODES.has(opcode)) {
    const rel = toSigned8(rom[pc + size - 1]);
    return {
      size,
      label: `IF condition SKIP ${rel}`,
      branchTarget: pc + size + rel,
      kind: 'cond-branch',
    };
  }

  if (RCALL_OPCODES.has(opcode)) {
    const rel = toSigned8(rom[pc + 1]);
    return {
      size,
      label: `RCALL ${rel}`,
      branchTarget: pc + size + rel,
      kind: 'rcall',
    };
  }

  if (opcode === 0x20) {
    return {
      size,
      label: 'TELEPORT',
      kind: 'normal',
    };
  }

  if (opcode === 0x29) {
    return {
      size,
      label: 'CALL',
      branchTarget: rom[pc + 1] | (rom[pc + 2] << 8) | (rom[pc + 3] << 16),
      kind: 'normal',
    };
  }

  if (opcode === 0x1b) {
    return {
      size,
      label: 'WRITE_MEMORY',
      kind: 'normal',
    };
  }

  return {
    size,
    label: `OP_${opcode.toString(16).toUpperCase().padStart(2, '0')}`,
    kind: 'normal',
  };
}

export function dumpScript(startAddr: number): Instruction[] {
  const rom = getRomBytes();
  const instructions: Instruction[] = [];

  const startOffset = resolveSNESAddress(startAddr);
  let pc = startOffset;
  const callStack: number[] = [];
  const maxSteps = 250000;

  for (let step = 0; step < maxSteps; step += 1) {
    const decoded = decodeInstruction(rom, pc);
    const opcode = rom[pc];
    const operands: number[] = [];
    for (let i = 1; i < decoded.size; i += 1) {
      operands.push(rom[pc + i]);
    }

    const instruction: Instruction = {
      pc,
      snesAddress: toSnesAddressFromPc(pc, startAddr, startOffset),
      opcode,
      operands,
      size: decoded.size,
      label: decoded.label,
      branchTarget: decoded.branchTarget,
      callDepth: callStack.length,
    };
    instructions.push(instruction);

    if (decoded.kind === 'end') {
      if (callStack.length > 0) {
        pc = callStack.pop() as number;
        continue;
      }
      return instructions;
    }

    if (decoded.kind === 'rcall') {
      if (typeof decoded.branchTarget !== 'number') {
        throw new Error(`RCALL missing branch target at offset 0x${pc.toString(16)}`);
      }
      callStack.push(pc + decoded.size);
      pc = decoded.branchTarget;
      continue;
    }

    // Keep decode stable by staying on the linear path; branch target is recorded for dump output.
    pc += decoded.size;
  }

  throw new Error(
    `Script 0x${startAddr.toString(16)} exceeded max instruction count (${maxSteps}) without END opcode 0x00`,
  );
}

export function parseScript(startAddr: number): ParseScriptResult {
  try {
    const instructions = dumpScript(startAddr);
    const tail = instructions[instructions.length - 1] ?? null;

    return {
      startAddress: startAddr,
      endAddress: tail ? tail.snesAddress : null,
      terminated: tail ? tail.opcode === 0x00 : false,
      endOpcode: tail ? tail.opcode : null,
      instructionCount: instructions.length,
      instructions,
    };
  } catch {
    return {
      startAddress: startAddr,
      endAddress: null,
      terminated: false,
      endOpcode: null,
      instructionCount: 0,
      instructions: [],
    };
  }
}

export function decodeOpcodeAtSnes(snesAddress: number): Instruction {
  const rom = getRomBytes();
  const pc = resolveSNESAddress(snesAddress);
  const decoded = decodeInstruction(rom, pc);
  const operands: number[] = [];

  for (let i = 1; i < decoded.size; i += 1) {
    operands.push(rom[pc + i]);
  }

  return {
    pc,
    snesAddress,
    opcode: rom[pc],
    operands,
    size: decoded.size,
    label: decoded.label,
    branchTarget: decoded.branchTarget,
    callDepth: 0,
  };
}

function formatHex(value: number, width = 2): string {
  return value.toString(16).padStart(width, '0');
}

export function formatInstructionLine(instruction: Instruction): string {
  const indent = '  '.repeat(instruction.callDepth);
  const opcodeHex = formatHex(instruction.opcode, 2);
  const operandText = instruction.operands.map((n) => formatHex(n, 2)).join(' ');
  const label = instruction.label ?? 'OP';
  const targetText =
    typeof instruction.branchTarget === 'number'
      ? ` (to 0x${formatHex(instruction.branchTarget, 6)})`
      : '';
  const operandSuffix = operandText.length > 0 ? ` ${operandText}` : '';

  return `${indent}[0x${formatHex(instruction.pc, 6)}] (${opcodeHex}) ${label}${targetText}${operandSuffix}`;
}

export function prettyPrintScript(startAddr: number): string {
  const instructions = dumpScript(startAddr);
  return instructions.map((line) => formatInstructionLine(line)).join('\n');
}
