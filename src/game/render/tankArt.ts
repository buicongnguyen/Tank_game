import type { EnemyTankKind } from '../types';

export interface Point {
  x: number;
  y: number;
}

export type ChassisKind = 'tracked' | 'wheeled' | 'static';

/**
 * Silhouette data for one tank archetype, expressed in "radius units" (1.0 = tank.radius)
 * so every kind scales cleanly with its runtime collision radius. Shapes take cues from
 * modern MBT design language (sloped composite glacis, wedge turrets, low-profile
 * unmanned turrets) without tracing any specific real-world vehicle.
 */
export interface TankArt {
  hull: Point[];
  turret: Point[];
  chassis: ChassisKind;
  barrelLength: number;
  barrelWidth: number;
  /** distance of each track/wheel row from the hull centerline, in radius units */
  runnerOffset: number;
  runnerWidth: number;
  hasArmorBlocks: boolean;
  hasSensorMast: boolean;
}

export type TankArtKind = EnemyTankKind | 'player';

export const TANK_ART: Record<TankArtKind, TankArt> = {
  player: {
    hull: [
      { x: 1.02, y: 0 },
      { x: 0.78, y: -0.42 },
      { x: 0.5, y: -0.62 },
      { x: -0.75, y: -0.62 },
      { x: -0.98, y: -0.36 },
      { x: -0.98, y: 0.36 },
      { x: -0.75, y: 0.62 },
      { x: 0.5, y: 0.62 },
      { x: 0.78, y: 0.42 },
    ],
    turret: [
      { x: 0.5, y: 0 },
      { x: 0.22, y: -0.4 },
      { x: -0.38, y: -0.42 },
      { x: -0.55, y: 0 },
      { x: -0.38, y: 0.42 },
      { x: 0.22, y: 0.4 },
    ],
    chassis: 'tracked',
    barrelLength: 1.9,
    barrelWidth: 6,
    runnerOffset: 0.6,
    runnerWidth: 0.16,
    hasArmorBlocks: false,
    hasSensorMast: false,
  },
  scout: {
    hull: [
      { x: 0.95, y: 0 },
      { x: 0.7, y: -0.5 },
      { x: -0.6, y: -0.55 },
      { x: -0.9, y: -0.3 },
      { x: -0.9, y: 0.3 },
      { x: -0.6, y: 0.55 },
      { x: 0.7, y: 0.5 },
    ],
    turret: [
      { x: 0.35, y: 0 },
      { x: 0.1, y: -0.3 },
      { x: -0.32, y: -0.3 },
      { x: -0.42, y: 0 },
      { x: -0.32, y: 0.3 },
      { x: 0.1, y: 0.3 },
    ],
    chassis: 'tracked',
    barrelLength: 1.5,
    barrelWidth: 4,
    runnerOffset: 0.56,
    runnerWidth: 0.14,
    hasArmorBlocks: false,
    hasSensorMast: false,
  },
  raider: {
    hull: [
      { x: 1.0, y: 0 },
      { x: 0.6, y: -0.6 },
      { x: -0.7, y: -0.6 },
      { x: -1.0, y: -0.3 },
      { x: -1.0, y: 0.3 },
      { x: -0.7, y: 0.6 },
      { x: 0.6, y: 0.6 },
    ],
    turret: [
      { x: 0.62, y: 0 },
      { x: 0.15, y: -0.34 },
      { x: -0.5, y: -0.4 },
      { x: -0.68, y: 0 },
      { x: -0.5, y: 0.4 },
      { x: 0.15, y: 0.34 },
    ],
    chassis: 'tracked',
    barrelLength: 1.85,
    barrelWidth: 6,
    runnerOffset: 0.62,
    runnerWidth: 0.16,
    hasArmorBlocks: false,
    hasSensorMast: false,
  },
  siege: {
    hull: [
      { x: 0.9, y: 0 },
      { x: 0.7, y: -0.68 },
      { x: -0.85, y: -0.7 },
      { x: -1.05, y: -0.42 },
      { x: -1.05, y: 0.42 },
      { x: -0.85, y: 0.7 },
      { x: 0.7, y: 0.68 },
    ],
    turret: [
      { x: 0.4, y: 0 },
      { x: 0.15, y: -0.48 },
      { x: -0.55, y: -0.5 },
      { x: -0.7, y: 0 },
      { x: -0.55, y: 0.5 },
      { x: 0.15, y: 0.48 },
    ],
    chassis: 'tracked',
    barrelLength: 2.2,
    barrelWidth: 8,
    runnerOffset: 0.68,
    runnerWidth: 0.2,
    hasArmorBlocks: true,
    hasSensorMast: false,
  },
  turret: {
    hull: [
      { x: 0.8, y: -0.3 },
      { x: 0.3, y: -0.75 },
      { x: -0.3, y: -0.75 },
      { x: -0.8, y: -0.3 },
      { x: -0.8, y: 0.3 },
      { x: -0.3, y: 0.75 },
      { x: 0.3, y: 0.75 },
      { x: 0.8, y: 0.3 },
    ],
    turret: [
      { x: 0.55, y: 0 },
      { x: 0.25, y: -0.4 },
      { x: -0.4, y: -0.42 },
      { x: -0.55, y: 0 },
      { x: -0.4, y: 0.42 },
      { x: 0.25, y: 0.4 },
    ],
    chassis: 'static',
    barrelLength: 1.75,
    barrelWidth: 6,
    runnerOffset: 0,
    runnerWidth: 0,
    hasArmorBlocks: false,
    hasSensorMast: false,
  },
  convoy: {
    hull: [
      { x: 1.0, y: 0 },
      { x: 0.75, y: -0.5 },
      { x: 0.55, y: -0.55 },
      { x: -0.95, y: -0.55 },
      { x: -0.95, y: 0.55 },
      { x: 0.55, y: 0.55 },
      { x: 0.75, y: 0.5 },
    ],
    turret: [
      { x: 0.15, y: -0.18 },
      { x: -0.15, y: -0.18 },
      { x: -0.15, y: 0.18 },
      { x: 0.15, y: 0.18 },
    ],
    chassis: 'wheeled',
    barrelLength: 1.1,
    barrelWidth: 3,
    runnerOffset: 0.58,
    runnerWidth: 0.16,
    hasArmorBlocks: false,
    hasSensorMast: false,
  },
  boss: {
    hull: [
      { x: 1.05, y: 0 },
      { x: 0.85, y: -0.55 },
      { x: 0.4, y: -0.78 },
      { x: -0.8, y: -0.8 },
      { x: -1.08, y: -0.45 },
      { x: -1.08, y: 0.45 },
      { x: -0.8, y: 0.8 },
      { x: 0.4, y: 0.78 },
      { x: 0.85, y: 0.55 },
    ],
    turret: [
      { x: 0.5, y: 0 },
      { x: 0.3, y: -0.5 },
      { x: -0.15, y: -0.62 },
      { x: -0.6, y: -0.5 },
      { x: -0.72, y: 0 },
      { x: -0.6, y: 0.5 },
      { x: -0.15, y: 0.62 },
      { x: 0.3, y: 0.5 },
    ],
    chassis: 'tracked',
    barrelLength: 2.4,
    barrelWidth: 10,
    runnerOffset: 0.7,
    runnerWidth: 0.22,
    hasArmorBlocks: true,
    hasSensorMast: true,
  },
};

export function darkenColor(color: number, factor: number): number {
  const r = Math.floor(((color >> 16) & 0xff) * factor);
  const g = Math.floor(((color >> 8) & 0xff) * factor);
  const b = Math.floor((color & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}
