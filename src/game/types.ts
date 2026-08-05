export type SessionPhase = 'menu' | 'playing' | 'intermission' | 'gameover' | 'victory';
export type DifficultyMode = 'easy' | 'normal' | 'hard' | 'extreme';
export type MissionKind = 'assault' | 'defense' | 'escort' | 'capture' | 'boss';
export type EnemyTankKind = 'scout' | 'raider' | 'siege' | 'turret' | 'convoy' | 'boss';
export type CoverKind = 'crate' | 'concrete' | 'barrel' | 'mine' | 'repair';
export type UpgradeId = 'armor' | 'engine' | 'reload' | 'shells' | 'special' | 'repair';
export type WeaponId = 'rocket' | 'autocannon' | 'mortar' | 'railgun' | 'scattergun' | 'homing';

export interface StagePalette {
  sky: number;
  ground: number;
  shadow: number;
  accent: number;
  obstacle: number;
  water?: number;
}

export interface CoverConfig {
  id: string;
  kind: CoverKind;
  x: number;
  y: number;
  width: number;
  height: number;
  health?: number;
}

export interface EnemySpawn {
  id: string;
  kind: EnemyTankKind;
  x: number;
  y: number;
  patrol?: Array<{ x: number; y: number }>;
}

export interface CaptureZoneConfig {
  id: string;
  label: string;
  x: number;
  y: number;
  radius: number;
}

export interface EscortConfig {
  id: string;
  label: string;
  x: number;
  y: number;
  exitX: number;
  health: number;
}

export interface BossConfig {
  id: string;
  kind: 'boss';
  name: string;
  x: number;
  y: number;
  health: number;
  fireRate: number;
}

export interface MissionConfig {
  id: string;
  name: string;
  codename: string;
  kind: MissionKind;
  objective: string;
  briefing: string;
  worldWidth: number;
  worldHeight: number;
  durationMs?: number;
  exitX?: number;
  palette: StagePalette;
  covers: CoverConfig[];
  enemies: EnemySpawn[];
  captureZones?: CaptureZoneConfig[];
  escort?: EscortConfig;
  boss?: BossConfig;
}

export interface TankStats {
  maxHealth: number;
  armor: number;
  engine: number;
  turnRate: number;
  reloadMs: number;
  shellDamage: number;
  shellSpeed: number;
  secondaryCooldownMs: number;
  specialCooldownMs: number;
  repairCharges: number;
}

export interface UpgradeOption {
  id: UpgradeId;
  label: string;
  description: string;
}

export interface TankHudStatus {
  health: number;
  maxHealth: number;
  armor: number;
  speed: number;
  reloadPercent: number;
  secondaryPercent: number;
  specialPercent: number;
  repairCharges: number;
}

export interface BossStatus {
  name: string;
  health: number;
  maxHealth: number;
  exposed: boolean;
}

export interface HudSnapshot {
  phase: 'standby' | 'live' | 'paused';
  missionName: string;
  missionIndex: number;
  totalMissions: number;
  objective: string;
  progressText: string;
  enemyCount: {
    alive: number;
    total: number;
  };
  totalScore: number;
  scrap: number;
  tank: TankHudStatus;
  weapon: {
    id: WeaponId;
    label: string;
    unlockedCount: number;
  };
  boss?: BossStatus;
}

export interface SessionSnapshot {
  phase: SessionPhase;
  difficulty: DifficultyMode;
  currentMissionIndex: number;
  totalScore: number;
  scrap: number;
  failureReason?: string;
  runSerial: number;
  completedMissions: number;
  currentMission: MissionConfig;
  nextMission?: MissionConfig;
  missions: MissionConfig[];
  tankStats: TankStats;
  pendingUpgrades: UpgradeOption[];
  unlockedWeapons: WeaponId[];
  selectedWeapon: WeaponId;
}
