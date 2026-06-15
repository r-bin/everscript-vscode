export type ScriptBoundaryTruth = {
  start: number;
  end: number;
  sourceNote: string;
};

export const SCRIPT_BOUNDARIES: ScriptBoundaryTruth[] = [
  {
    start: 0x94E5FB,
    end: 0x94E636,
    sourceNote: 'Prehistoria - Strong Heart\'s Exterior enter script',
  },
  {
    start: 0x94E795,
    end: 0x94E7E0,
    sourceNote: 'Prehistoria - Strong Heart\'s Hut enter script',
  },
  {
    start: 0x93912C,
    end: 0x939223,
    sourceNote: 'Prehistoria - Raptors enter script',
  },
];

export const OPCODE_TRUTH = {
  end00: {
    address: 0x94E636,
    opcode: 0x00,
    size: 1,
    operands: [],
    labelContains: 'END',
  },
  if08: {
    address: 0x94E5FF,
    opcode: 0x08,
    size: 6,
    branchTarget: 0x94E60D,
    labelContains: '$22eb&0x20',
  },
  ifNot09: {
    address: 0x9384D9,
    opcode: 0x09,
    size: 6,
    branchTarget: 0x9384FC,
    labelContains: '!($22f1&0x40)',
  },
  writeMemory1b: {
    address: 0x94E611,
    opcode: 0x1B,
    size: 7,
    labelContains: 'WRITE',
  },
  teleport20: {
    address: 0x94E605,
    opcode: 0x20,
    size: 3,
    operands: [0x1D, 0x15],
    labelContains: 'Teleport both to 1d 15',
  },
  call29: {
    address: 0x94E62D,
    opcode: 0x29,
    size: 4,
    branchTarget: 0x92DE75,
    labelContains: 'CALL 0x92de75',
  },
  rcallA5: {
    address: 0x9384FA,
    opcode: 0xA5,
    size: 2,
    branchTarget: 0x9384A7,
    labelContains: 'RCALL -83',
  },
} as const;
