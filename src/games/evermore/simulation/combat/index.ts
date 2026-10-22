// Ownership: public entry point of the combat simulation (simulation/combat/README.md).

export { damageTable, fightOnce, simulateFight, bestCase } from './fight';
export type { Duration, Fighter, HitChance, FightSetup, FightRun, FightReport, Histogram, Stats } from './fight';
export { hitChance, enemyFighter, boyFighter, dogFighter, fightFor } from './inputs';
export type { FightInputs, PartyMember } from './inputs';
export { PARTY_STAT_KEYS } from './party';
export type { Party, PartyStats } from './party';
