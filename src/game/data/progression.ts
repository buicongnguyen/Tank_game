export interface MissionProgressionSpec {
  threatLevel: number;
  enemyHealthScale: number;
  enemyDamageScale: number;
  enemyReloadScale: number;
  recommendedUpgrade: string;
  reason: string;
}

/**
 * Each mission introduces a pressure that the preceding depot visit can answer.
 * The multipliers stay modest because enemy composition and objective pressure
 * also rise; together they keep purchased systems relevant throughout the run.
 */
export const MISSION_PROGRESSION: MissionProgressionSpec[] = [
  { threatLevel: 1, enemyHealthScale: 1, enemyDamageScale: 1, enemyReloadScale: 1, recommendedUpgrade: 'Starter loadout', reason: 'Learn movement, aiming, and cover.' },
  { threatLevel: 2, enemyHealthScale: 1.04, enemyDamageScale: 1.03, enemyReloadScale: 0.99, recommendedUpgrade: 'Composite Armor', reason: 'Survive the first rocket teams.' },
  { threatLevel: 3, enemyHealthScale: 1.08, enemyDamageScale: 1.06, enemyReloadScale: 0.98, recommendedUpgrade: 'Auto Loader', reason: 'Clear mixed infantry before they surround you.' },
  { threatLevel: 4, enemyHealthScale: 1.13, enemyDamageScale: 1.09, enemyReloadScale: 0.97, recommendedUpgrade: 'Shaped Charges', reason: 'Punch through the first enemy tanks.' },
  { threatLevel: 5, enemyHealthScale: 1.18, enemyDamageScale: 1.13, enemyReloadScale: 0.95, recommendedUpgrade: 'Chassis or Shield', reason: 'Combined arms punish a fragile starter hull.' },
  { threatLevel: 6, enemyHealthScale: 1.24, enemyDamageScale: 1.17, enemyReloadScale: 0.94, recommendedUpgrade: 'Tuned Engine', reason: 'Catch convoy carriers before they escape.' },
  { threatLevel: 7, enemyHealthScale: 1.3, enemyDamageScale: 1.21, enemyReloadScale: 0.93, recommendedUpgrade: 'Energy Shield', reason: 'Absorb sustained fire while holding the relay.' },
  { threatLevel: 8, enemyHealthScale: 1.36, enemyDamageScale: 1.25, enemyReloadScale: 0.92, recommendedUpgrade: 'Repair Kit', reason: 'Keep yourself and the escort route alive.' },
  { threatLevel: 9, enemyHealthScale: 1.42, enemyDamageScale: 1.29, enemyReloadScale: 0.91, recommendedUpgrade: 'Bullet Capacity', reason: 'Capture multiple zones without a dry magazine.' },
  { threatLevel: 10, enemyHealthScale: 1.49, enemyDamageScale: 1.33, enemyReloadScale: 0.9, recommendedUpgrade: 'Suicide Drone', reason: 'Seek the fortress boss around hard cover.' },
  { threatLevel: 11, enemyHealthScale: 1.56, enemyDamageScale: 1.37, enemyReloadScale: 0.89, recommendedUpgrade: 'Autocannon', reason: 'Burst down the fast winter column.' },
  { threatLevel: 12, enemyHealthScale: 1.63, enemyDamageScale: 1.41, enemyReloadScale: 0.88, recommendedUpgrade: 'Mortar', reason: 'Lob fire over the ridge defenses.' },
  { threatLevel: 13, enemyHealthScale: 1.7, enemyDamageScale: 1.45, enemyReloadScale: 0.87, recommendedUpgrade: 'Railgun', reason: 'Pierce targets lined up in rail lanes.' },
  { threatLevel: 14, enemyHealthScale: 1.78, enemyDamageScale: 1.49, enemyReloadScale: 0.86, recommendedUpgrade: 'Scattergun', reason: 'Stop close-range attackers around the hauler.' },
  { threatLevel: 15, enemyHealthScale: 1.86, enemyDamageScale: 1.54, enemyReloadScale: 0.85, recommendedUpgrade: 'Homing Swarm', reason: 'Curve fire around the Sovereign guard.' },
];

export function progressionForMission(index: number): MissionProgressionSpec {
  return MISSION_PROGRESSION[Math.max(0, Math.min(index, MISSION_PROGRESSION.length - 1))];
}
