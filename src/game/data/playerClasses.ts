import type { PlayerClassId, TankStats, WeaponId } from '../types';
import type { TankArtKind } from '../render/tankArt';

export interface PlayerClassSpec {
  id: PlayerClassId;
  label: string;
  description: string;
  /** Which silhouette to draw the player with. */
  artKind: TankArtKind;
  infantry: boolean;
  radius: number;
  stats: TankStats;
  startingWeapon: WeaponId;
  /** Chassis rank; the shop can only ever move you up this ladder. */
  tier: number;
}

export const PLAYER_CLASSES: Record<PlayerClassId, PlayerClassSpec> = {
  rifleman: {
    id: 'rifleman',
    label: 'Rifleman',
    description: 'On foot with a rifle. Fragile but quick, with a fast-firing gun and a strong shield.',
    artKind: 'rifleman',
    infantry: true,
    radius: 16,
    startingWeapon: 'rifle',
    tier: 0,
    stats: {
      maxHealth: 190,
      shieldMax: 120,
      shieldRegen: 13,
      armor: 0.8,
      engine: 300,
      turnRate: 9.5,
      reloadMs: 300,
      shellDamage: 26,
      shellSpeed: 900,
      secondaryCooldownMs: 2600,
      specialCooldownMs: 15000,
      repairCharges: 2,
    },
  },
  rocketeer: {
    id: 'rocketeer',
    label: 'Rocketeer',
    description: 'On foot with a launcher. Slow, heavy shots that hit like armour, but a long reload.',
    artKind: 'rocketeer',
    infantry: true,
    radius: 17,
    startingWeapon: 'launcher',
    tier: 0,
    stats: {
      maxHealth: 210,
      shieldMax: 110,
      shieldRegen: 11,
      armor: 0.85,
      engine: 275,
      turnRate: 8.6,
      reloadMs: 1250,
      shellDamage: 82,
      shellSpeed: 620,
      secondaryCooldownMs: 3000,
      specialCooldownMs: 15000,
      repairCharges: 2,
    },
  },
  light: {
    id: 'light',
    label: 'Light Tank',
    description: 'Thin armour, high speed. Rewards constant movement and flanking.',
    artKind: 'scout',
    infantry: false,
    radius: 25,
    startingWeapon: 'rocket',
    tier: 1,
    stats: {
      maxHealth: 380,
      shieldMax: 60,
      shieldRegen: 6,
      armor: 0.92,
      engine: 268,
      turnRate: 6.8,
      reloadMs: 720,
      shellDamage: 74,
      shellSpeed: 820,
      secondaryCooldownMs: 2200,
      specialCooldownMs: 13500,
      repairCharges: 2,
    },
  },
  medium: {
    id: 'medium',
    label: 'Medium Tank',
    description: 'The balanced main battle tank. Good armour, good gun, no glaring weakness.',
    artKind: 'player',
    infantry: false,
    radius: 30,
    startingWeapon: 'rocket',
    tier: 2,
    stats: {
      maxHealth: 520,
      shieldMax: 80,
      shieldRegen: 7,
      armor: 1,
      engine: 235,
      turnRate: 5.8,
      reloadMs: 880,
      shellDamage: 95,
      shellSpeed: 760,
      secondaryCooldownMs: 2400,
      specialCooldownMs: 13500,
      repairCharges: 2,
    },
  },
  heavy: {
    id: 'heavy',
    label: 'Heavy Tank',
    description: 'Thick armour and a huge gun, but slow to move and slow to reload.',
    artKind: 'siege',
    infantry: false,
    radius: 36,
    startingWeapon: 'rocket',
    tier: 3,
    stats: {
      maxHealth: 780,
      shieldMax: 110,
      shieldRegen: 8,
      armor: 1.28,
      engine: 178,
      turnRate: 4.4,
      reloadMs: 1180,
      shellDamage: 138,
      shellSpeed: 700,
      secondaryCooldownMs: 2800,
      specialCooldownMs: 12500,
      repairCharges: 3,
    },
  },
};

/** Chassis you can buy your way up to, cheapest first. */
export const CHASSIS_LADDER: PlayerClassId[] = ['light', 'medium', 'heavy'];

export const CHASSIS_PRICE: Record<PlayerClassId, number> = {
  rifleman: 0,
  rocketeer: 0,
  light: 260,
  medium: 620,
  heavy: 1250,
};

export function cloneClassStats(id: PlayerClassId): TankStats {
  return { ...PLAYER_CLASSES[id].stats };
}

/** The next chassis a player of this class can buy, if any. */
export function nextChassis(id: PlayerClassId): PlayerClassId | undefined {
  const tier = PLAYER_CLASSES[id].tier;
  return CHASSIS_LADDER.find((candidate) => PLAYER_CLASSES[candidate].tier > tier);
}
