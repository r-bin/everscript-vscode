// Ownership: the party a fight starts from — the Boy's and the Dog's stats as WRAM holds them
// (records $0A26 / $0A70), the Boy's weapon and the Dog's form. A route states it (start.party).

export interface PartyStats { hp: number; atk: number; def: number; evade: number; hitRate: number; chargeSpeed: number }
export interface Party { source: string; weapon: number; dogForm: number; boy: PartyStats; dog: PartyStats }
export const PARTY_STAT_KEYS: (keyof PartyStats)[] = ['hp', 'atk', 'def', 'evade', 'hitRate', 'chargeSpeed'];
