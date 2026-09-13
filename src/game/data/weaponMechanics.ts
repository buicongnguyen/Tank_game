import type { WeaponFeedbackStyle, WeaponProjectileStyle } from './weapons';

export const FLAME = { range: 230, halfAngle: Math.PI * 35 / 180, burnMs: 2000, burnScale: 0.14, tickMs: 200 } as const;
export const PULSE_LASER = { range: 900, durationMs: 160, concretePenetrations: 1 } as const;
export const machineGunBarrels = (level: number): number => level >= 3 ? 4 : 2;
export const machineGunOffset = (index: number, level: number): number => (index % machineGunBarrels(level) - (machineGunBarrels(level) - 1) / 2) * 6;

/** Appearance follows the ammunition, never the chassis that fired it. */
export function projectileAppearance(kind: WeaponProjectileStyle, feedback: WeaponFeedbackStyle): WeaponProjectileStyle | 'bullet' {
  return kind === 'shell' && feedback === 'smallArm' ? 'bullet' : kind;
}
