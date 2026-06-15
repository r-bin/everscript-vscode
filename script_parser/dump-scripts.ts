import { parseScript, resolveSNESAddress } from './model/rom-script-model.ts';

const ENTRY_POINTERS = [0x94E5FB, 0x94E795, 0x93912C];

function toHex(value: number, width: number): string {
  return value.toString(16).padStart(width, '0');
}

function parsePointerArg(args: string[]): number[] {
  const values = args.filter((arg) => !arg.startsWith('--'));
  if (values.length === 0) {
    return ENTRY_POINTERS;
  }

  const pointers: number[] = [];
  for (const value of values) {
    const normalized = value.toLowerCase().startsWith('0x') ? value.slice(2) : value;
    const parsed = Number.parseInt(normalized, 16);
    if (!Number.isFinite(parsed)) {
      throw new Error(`Invalid pointer argument: ${value}`);
    }
    pointers.push(parsed);
  }
  return pointers;
}

const argv = process.argv.slice(2);
const verbose = argv.includes('--verbose');
const pointers = parsePointerArg(argv);

for (const ptr of pointers) {
  const startOffset = resolveSNESAddress(ptr);
  const result = parseScript(ptr);
  const endAddr = result.endAddress;
  const byteSize = endAddr === null ? 0 : endAddr - ptr;

  console.log(
    `Script: 0x${toHex(ptr, 6)} Terminated: ${result.terminated} End Opcode: ${
      result.endOpcode === null ? 'null' : `0x${toHex(result.endOpcode, 2)}`
    } End Address: ${endAddr === null ? 'null' : `0x${toHex(endAddr, 6)}`} Instruction Count: ${result.instructionCount}`,
  );

  if (verbose) {
    console.log(`Resolved ROM offset: 0x${toHex(startOffset, 6)}`);
    for (const instruction of result.instructions) {
      const rel = instruction.snesAddress - ptr;
      const operands = instruction.operands.map((b) => toHex(b, 2)).join(' ');
      const branch =
        typeof instruction.branchTarget === 'number'
          ? ` branchTarget=0x${toHex(instruction.branchTarget, 6)}`
          : '';
      console.log(
        `  rel=0x${toHex(rel >>> 0, 4)} abs=0x${toHex(instruction.snesAddress, 6)} pc=0x${toHex(instruction.pc, 6)} op=0x${toHex(instruction.opcode, 2)} size=${instruction.size} operands=[${operands}] depth=${instruction.callDepth}${branch}`,
      );
    }
  }
  console.log('');
}
