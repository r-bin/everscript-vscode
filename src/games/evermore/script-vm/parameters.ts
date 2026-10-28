// Ownership: what each opcode's operands are — parameters.json, estimated from how the ROM's
// scripts use them and named from the handlers (its "//" says how). Pure lookups.
//
// The printer reads it for two warnings: a `signed` read passed where the handler takes an entity
// (its low word only), and a constant outside the enum a parameter takes.

import table from './parameters.json';

export type BaseType = 'u8' | 'u16' | 's16' | 'bool' | 'entity' | 'jump' | 'script' | 'args' | 'list' | 'skip';
/** A base type, or one of parameters.json's `types` that inherits from one (`object_index` is a u8). */
export type ParameterType = BaseType | 'object_index' | 'weapon_index';

export interface Parameter {
    name: string;
    type: ParameterType;
    /** The compiler's enum its values come from (`MUSIC`); TRIGGER_ID: a trigger id. */
    enum?: string;
}

type Entry = { name: string; basis: 'usage' | 'handler'; params: Parameter[] };
const TYPES = (table as unknown as { types: Record<string, { base: BaseType }> }).types;
const BY_OPCODE = new Map<number, Entry>(
    Object.entries(table as unknown as Record<string, Entry | string>).filter(([k]) => k.startsWith('0x')).map(([k, v]) => [parseInt(k, 16), v as Entry]),
);

/** The opcode's parameters, one per operand token (spec.ts), in order; [] for an opcode it does not list. */
export function parameters(opcode: number): readonly Parameter[] {
    return BY_OPCODE.get(opcode)?.params ?? [];
}

/** The base type a parameter type inherits from (`object_index` → `u8`). */
export function baseType(type: ParameterType): BaseType {
    return (TYPES[type]?.base ?? type) as BaseType;
}

/** Operand `index` of the opcode is an entity (the handler keeps the value's low word as its address). */
export function isEntity(opcode: number, index: number): boolean {
    return parameters(opcode)[index]?.type === 'entity';
}
