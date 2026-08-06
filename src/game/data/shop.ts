import type { ShopItemId, TankStats } from '../types';

export interface ShopStatSpec {
  id: ShopItemId;
  label: string;
  description: string;
  basePrice: number;
  /** Each purchase costs basePrice * priceGrowth^level. */
  priceGrowth: number;
  maxLevel: number;
  apply: (stats: TankStats) => void;
}

export const SHOP_STATS: Record<Exclude<ShopItemId, 'chassis'>, ShopStatSpec> = {
  armor: {
    id: 'armor',
    label: 'Composite Armor',
    description: '+90 max hull and thicker plating.',
    basePrice: 110,
    priceGrowth: 1.55,
    maxLevel: 6,
    apply: (stats) => {
      stats.maxHealth += 90;
      stats.armor += 0.1;
    },
  },
  shield: {
    id: 'shield',
    label: 'Energy Shield',
    description: '+55 shield capacity and faster recharge.',
    basePrice: 130,
    priceGrowth: 1.6,
    maxLevel: 6,
    apply: (stats) => {
      stats.shieldMax += 55;
      stats.shieldRegen += 3.5;
    },
  },
  engine: {
    id: 'engine',
    label: 'Tuned Engine',
    description: '+26 speed and sharper turning.',
    basePrice: 95,
    priceGrowth: 1.5,
    maxLevel: 5,
    apply: (stats) => {
      stats.engine += 26;
      stats.turnRate += 0.4;
    },
  },
  reload: {
    id: 'reload',
    label: 'Auto Loader',
    description: 'Main gun reloads 14% faster.',
    basePrice: 120,
    priceGrowth: 1.6,
    maxLevel: 5,
    apply: (stats) => {
      stats.reloadMs = Math.max(180, stats.reloadMs * 0.86);
      stats.secondaryCooldownMs = Math.max(700, stats.secondaryCooldownMs * 0.92);
    },
  },
  damage: {
    id: 'damage',
    label: 'Shaped Charges',
    description: '+18% shell damage and faster muzzle velocity.',
    basePrice: 140,
    priceGrowth: 1.62,
    maxLevel: 6,
    apply: (stats) => {
      stats.shellDamage = Math.round(stats.shellDamage * 1.18);
      stats.shellSpeed += 30;
    },
  },
  repair: {
    id: 'repair',
    label: 'Repair Kit',
    description: '+1 field repair charge.',
    basePrice: 100,
    priceGrowth: 1.7,
    maxLevel: 4,
    apply: (stats) => {
      stats.repairCharges += 1;
    },
  },
};

export function statPrice(spec: ShopStatSpec, level: number): number {
  return Math.round(spec.basePrice * Math.pow(spec.priceGrowth, level));
}
