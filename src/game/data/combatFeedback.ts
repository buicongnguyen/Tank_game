import type { TankSfxCue } from '../audio/BattleMusic';
import type { WeaponFeedbackStyle } from './weapons';

export interface CombatFeedbackProfile {
  fireCue: TankSfxCue;
  recoil: number;
  muzzleSize: number;
  muzzleDurationMs: number;
  impactSize: number;
  impactDurationMs: number;
  hitImpulse: number;
  cameraShake: number;
}

/**
 * Visual/audio character only. Damage, cooldown, projectile speed, and blast
 * balance remain in weapons.ts so feedback tuning cannot silently alter DPS.
 */
export const COMBAT_FEEDBACK: Record<WeaponFeedbackStyle, CombatFeedbackProfile> = {
  smallArm: {
    fireCue: 'small-arm', recoil: 3, muzzleSize: 7, muzzleDurationMs: 55,
    impactSize: 8, impactDurationMs: 150, hitImpulse: 5, cameraShake: 0,
  },
  automatic: {
    fireCue: 'automatic', recoil: 4, muzzleSize: 8, muzzleDurationMs: 48,
    impactSize: 9, impactDurationMs: 140, hitImpulse: 6, cameraShake: 0,
  },
  cannon: {
    fireCue: 'cannon', recoil: 30, muzzleSize: 18, muzzleDurationMs: 95,
    impactSize: 18, impactDurationMs: 260, hitImpulse: 24, cameraShake: 0.0022,
  },
  rocket: {
    fireCue: 'rocket', recoil: 18, muzzleSize: 15, muzzleDurationMs: 120,
    impactSize: 22, impactDurationMs: 300, hitImpulse: 22, cameraShake: 0.0018,
  },
  mortar: {
    fireCue: 'mortar', recoil: 24, muzzleSize: 20, muzzleDurationMs: 130,
    impactSize: 25, impactDurationMs: 320, hitImpulse: 28, cameraShake: 0.0024,
  },
  rail: {
    fireCue: 'rail', recoil: 38, muzzleSize: 22, muzzleDurationMs: 115,
    impactSize: 20, impactDurationMs: 280, hitImpulse: 34, cameraShake: 0.0026,
  },
  energy: {
    fireCue: 'energy', recoil: 10, muzzleSize: 17, muzzleDurationMs: 105,
    impactSize: 19, impactDurationMs: 260, hitImpulse: 12, cameraShake: 0.0012,
  },
  flame: {
    fireCue: 'flame', recoil: 2, muzzleSize: 11, muzzleDurationMs: 80,
    impactSize: 12, impactDurationMs: 210, hitImpulse: 3, cameraShake: 0,
  },
  chemical: {
    fireCue: 'mortar', recoil: 16, muzzleSize: 15, muzzleDurationMs: 120,
    impactSize: 20, impactDurationMs: 280, hitImpulse: 0, cameraShake: 0.0014,
  },
  drone: {
    fireCue: 'drone', recoil: 8, muzzleSize: 13, muzzleDurationMs: 135,
    impactSize: 24, impactDurationMs: 320, hitImpulse: 30, cameraShake: 0.0022,
  },
};
