import type { WeaponId } from '../types';

export type WeaponProjectileStyle = 'rocket' | 'shell' | 'mortar' | 'rail';

export interface WeaponSpec {
  id: WeaponId;
  label: string;
  description: string;
  /** Weapon becomes available once the campaign reaches this mission index. */
  unlockAtMissionIndex: number;
  style: WeaponProjectileStyle;
  color: number;
  /** Multiplier applied to the tank's secondary cooldown stat. */
  cooldownScale: number;
  shots: number;
  /** Total angular spread across all shots, in radians. */
  spread: number;
  /** Delay between shots of a burst; 0 fires them in the same frame. */
  burstDelayMs: number;
  damageScale: number;
  speedScale: number;
  blastRadius: number;
  ttlMs: number;
  /** Extra enemies a shot can pass through before expiring. */
  pierce: number;
  /** Turn rate in radians/sec used to steer toward the nearest enemy. */
  homingStrength: number;
  /** Lobs over cover and detonates at the aim point instead of on contact. */
  arcing: boolean;
}

export const WEAPONS: Record<WeaponId, WeaponSpec> = {
  rocket: {
    id: 'rocket',
    label: 'Rocket',
    description: 'Standard guided-fin rocket with a solid blast.',
    unlockAtMissionIndex: 0,
    style: 'rocket',
    color: 0x95e7ff,
    cooldownScale: 1,
    shots: 1,
    spread: 0,
    burstDelayMs: 0,
    damageScale: 0.72,
    speedScale: 1.15,
    blastRadius: 46,
    ttlMs: 1800,
    pierce: 0,
    homingStrength: 0,
    arcing: false,
  },
  autocannon: {
    id: 'autocannon',
    label: 'Autocannon',
    description: 'Three-round burst of fast, light shells. Great against scouts.',
    unlockAtMissionIndex: 10,
    style: 'shell',
    color: 0xffe08a,
    cooldownScale: 0.42,
    shots: 3,
    spread: 0.08,
    burstDelayMs: 90,
    damageScale: 0.3,
    speedScale: 1.5,
    blastRadius: 14,
    ttlMs: 1500,
    pierce: 0,
    homingStrength: 0,
    arcing: false,
  },
  mortar: {
    id: 'mortar',
    label: 'Mortar',
    description: 'Lobs over cover and detonates at your aim point with a wide blast.',
    unlockAtMissionIndex: 11,
    style: 'mortar',
    color: 0xffc65f,
    cooldownScale: 1.25,
    shots: 1,
    spread: 0,
    burstDelayMs: 0,
    damageScale: 1.1,
    speedScale: 0.6,
    blastRadius: 132,
    ttlMs: 3000,
    pierce: 0,
    homingStrength: 0,
    arcing: true,
  },
  railgun: {
    id: 'railgun',
    label: 'Railgun',
    description: 'Hypervelocity slug that punches through a column of armor.',
    unlockAtMissionIndex: 12,
    style: 'rail',
    color: 0xb59cff,
    cooldownScale: 1.5,
    shots: 1,
    spread: 0,
    burstDelayMs: 0,
    damageScale: 1.35,
    speedScale: 2.4,
    blastRadius: 22,
    ttlMs: 1600,
    pierce: 4,
    homingStrength: 0,
    arcing: false,
  },
  scattergun: {
    id: 'scattergun',
    label: 'Scattergun',
    description: 'Short-range pellet spread that shreds anything hugging your hull.',
    unlockAtMissionIndex: 13,
    style: 'shell',
    color: 0xffb15f,
    cooldownScale: 0.75,
    shots: 6,
    spread: 0.5,
    burstDelayMs: 0,
    damageScale: 0.26,
    speedScale: 0.95,
    blastRadius: 12,
    ttlMs: 420,
    pierce: 0,
    homingStrength: 0,
    arcing: false,
  },
  homing: {
    id: 'homing',
    label: 'Homing Swarm',
    description: 'Three seeker missiles that curve onto the nearest target.',
    unlockAtMissionIndex: 14,
    style: 'rocket',
    color: 0x8ef0c0,
    cooldownScale: 1.35,
    shots: 3,
    spread: 0.7,
    burstDelayMs: 130,
    damageScale: 0.5,
    speedScale: 0.8,
    blastRadius: 44,
    ttlMs: 2600,
    pierce: 0,
    homingStrength: 3.4,
    arcing: false,
  },
};

export const WEAPON_ORDER: WeaponId[] = ['rocket', 'autocannon', 'mortar', 'railgun', 'scattergun', 'homing'];

export function weaponsUnlockedAt(missionIndex: number): WeaponId[] {
  return WEAPON_ORDER.filter((id) => WEAPONS[id].unlockAtMissionIndex <= missionIndex);
}

export function weaponUnlockedAtMission(missionIndex: number): WeaponId | undefined {
  return WEAPON_ORDER.find((id) => WEAPONS[id].unlockAtMissionIndex === missionIndex && missionIndex > 0);
}
