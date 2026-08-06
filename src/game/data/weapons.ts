import type { WeaponId } from '../types';

export type WeaponProjectileStyle = 'rocket' | 'shell' | 'mortar' | 'rail' | 'gas';

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
  // ---- Soldier-carried arms. Names and roles borrowed from the rambo_game
  // weapon roster (rifle / shotgun / sniper / machineGun / flame / launcher)
  // so an infantry player has a recognisable kit to buy into.
  rifle: {
    id: 'rifle',
    label: 'Rifle',
    description: 'Standard service rifle. Quick, accurate, light on damage.',
    unlockAtMissionIndex: 0,
    style: 'shell',
    color: 0xffe9a8,
    cooldownScale: 0.34,
    shots: 1,
    spread: 0.02,
    burstDelayMs: 0,
    damageScale: 0.5,
    speedScale: 1.5,
    blastRadius: 0,
    ttlMs: 1200,
    pierce: 0,
    homingStrength: 0,
    arcing: false,
  },
  shotgun: {
    id: 'shotgun',
    label: 'Shotgun',
    description: 'Five-pellet blast. Devastating up close, useless at range.',
    unlockAtMissionIndex: 99,
    style: 'shell',
    color: 0xffc27a,
    cooldownScale: 0.7,
    shots: 5,
    spread: 0.42,
    burstDelayMs: 0,
    damageScale: 0.42,
    speedScale: 1.05,
    blastRadius: 6,
    ttlMs: 380,
    pierce: 0,
    homingStrength: 0,
    arcing: false,
  },
  machineGun: {
    id: 'machineGun',
    label: 'Machine Gun',
    description: 'Long burst of suppressing fire. Melts infantry.',
    unlockAtMissionIndex: 99,
    style: 'shell',
    color: 0xfff0b0,
    cooldownScale: 0.5,
    shots: 6,
    spread: 0.14,
    burstDelayMs: 65,
    damageScale: 0.3,
    speedScale: 1.4,
    blastRadius: 0,
    ttlMs: 1300,
    pierce: 0,
    homingStrength: 0,
    arcing: false,
  },
  sniper: {
    id: 'sniper',
    label: 'Sniper',
    description: 'One heavy round that punches clean through a line of targets.',
    unlockAtMissionIndex: 99,
    style: 'rail',
    color: 0xc8e8ff,
    cooldownScale: 1.35,
    shots: 1,
    spread: 0,
    burstDelayMs: 0,
    damageScale: 1.5,
    speedScale: 2.6,
    blastRadius: 8,
    ttlMs: 1600,
    pierce: 3,
    homingStrength: 0,
    arcing: false,
  },
  flamer: {
    id: 'flamer',
    label: 'Flamer',
    description: 'Short cone of burning fuel. Shreds anything that closes in.',
    unlockAtMissionIndex: 99,
    style: 'shell',
    color: 0xff8a3c,
    cooldownScale: 0.3,
    shots: 4,
    spread: 0.55,
    burstDelayMs: 0,
    damageScale: 0.22,
    speedScale: 0.6,
    blastRadius: 14,
    ttlMs: 260,
    pierce: 1,
    homingStrength: 0,
    arcing: false,
  },
  laser: {
    id: 'laser',
    label: 'Laser',
    description: 'Continuous beam that burns straight through anything in line.',
    unlockAtMissionIndex: 99,
    style: 'rail',
    color: 0x7cf6ff,
    cooldownScale: 0.55,
    shots: 1,
    spread: 0,
    burstDelayMs: 0,
    damageScale: 0.8,
    speedScale: 3.2,
    blastRadius: 10,
    ttlMs: 900,
    pierce: 6,
    homingStrength: 0,
    arcing: false,
  },
  gasBomb: {
    id: 'gasBomb',
    label: 'Gas Bomb',
    description: 'Lobbed canister that leaves a poison cloud burning anything inside it.',
    unlockAtMissionIndex: 99,
    style: 'gas',
    color: 0x8cff6a,
    cooldownScale: 1.5,
    shots: 1,
    spread: 0,
    burstDelayMs: 0,
    damageScale: 0.45,
    speedScale: 0.55,
    blastRadius: 150,
    ttlMs: 3000,
    pierce: 0,
    homingStrength: 0,
    arcing: true,
  },
  launcher: {
    id: 'launcher',
    label: 'Launcher',
    description: 'Shoulder-fired rocket with a wide blast.',
    unlockAtMissionIndex: 0,
    style: 'rocket',
    color: 0xff7447,
    cooldownScale: 1.15,
    shots: 1,
    spread: 0,
    burstDelayMs: 0,
    damageScale: 0.95,
    speedScale: 0.9,
    blastRadius: 68,
    ttlMs: 2200,
    pierce: 0,
    homingStrength: 0,
    arcing: false,
  },
};

export const WEAPON_ORDER: WeaponId[] = [
  'rocket', 'autocannon', 'mortar', 'railgun', 'scattergun', 'homing',
  'rifle', 'launcher', 'shotgun', 'machineGun', 'sniper', 'flamer', 'laser', 'gasBomb',
];

/** Weapons that are bought in the shop rather than unlocked by progress. */
export const PURCHASABLE_WEAPONS: WeaponId[] = ['shotgun', 'machineGun', 'sniper', 'flamer', 'laser', 'gasBomb'];

export const WEAPON_PRICE: Partial<Record<WeaponId, number>> = {
  rocket: 180,
  rifle: 140,
  launcher: 200,
  autocannon: 320,
  mortar: 400,
  railgun: 560,
  scattergun: 260,
  homing: 520,
  shotgun: 220,
  machineGun: 340,
  sniper: 480,
  flamer: 300,
  laser: 640,
  gasBomb: 520,
};

export const MAX_WEAPON_LEVEL = 4;

export function weaponShopPrice(id: WeaponId, level: number): number {
  const basePrice = WEAPON_PRICE[id] ?? 240;
  return level <= 0 ? basePrice : Math.round(basePrice * (1 + level * 0.65));
}

export function weaponsUnlockedAt(missionIndex: number): WeaponId[] {
  // Mission-zero weapons are class loadouts, not shared unlocks. Including all
  // of them here gave every class the rifle, launcher, and rocket immediately.
  return WEAPON_ORDER.filter((id) => {
    const unlockIndex = WEAPONS[id].unlockAtMissionIndex;
    return unlockIndex > 0 && unlockIndex <= missionIndex;
  });
}

export function weaponUnlockedAtMission(missionIndex: number): WeaponId | undefined {
  return WEAPON_ORDER.find((id) => WEAPONS[id].unlockAtMissionIndex === missionIndex && missionIndex > 0);
}
