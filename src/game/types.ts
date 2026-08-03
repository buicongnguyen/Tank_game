export type SessionPhase = 'menu' | 'playing' | 'intermission' | 'gameover' | 'victory';
export type EnemyKind = 'rifleman' | 'rocketeer' | 'turret' | 'zombie' | 'scout' | 'bikeRaider' | 'jeepRaider' | 'tankRaider';
export type BossKind = 'gunship' | 'barge' | 'tank';
export type StageThemeId = 'emerald' | 'river' | 'blacksite';
export type WeaponKind = 'rifle' | 'shotgun' | 'flame' | 'launcher' | 'sniper' | 'explosiveArrow' | 'missile' | 'laser' | 'machineGun' | 'throwBomb' | 'poisonBomb';
export type DifficultyMode = 'easy' | 'normal' | 'hard' | 'extreme';

export interface StagePalette {
  sky: number;
  ground: number;
  shadow: number;
  accent: number;
  obstacle: number;
  water?: number;
}

export interface ObstacleConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  tint?: number;
  alpha?: number;
}

export interface EnemySpawn {
  id: string;
  kind: EnemyKind;
  x: number;
  y: number;
}

export interface EncounterConfig {
  id: string;
  label: string;
  triggerX: number;
  enemies: EnemySpawn[];
}

export interface BossConfig {
  kind: BossKind;
  name: string;
  x: number;
  y: number;
  health: number;
  speed: number;
  fireRate: number;
  bulletSpeed: number;
  summonEveryMs?: number;
}

export interface StageConfig {
  id: string;
  name: string;
  codename: string;
  theme: StageThemeId;
  objective: string;
  briefing: string;
  worldWidth: number;
  worldHeight: number;
  bossTriggerX: number;
  palette: StagePalette;
  obstacles: ObstacleConfig[];
  encounters: EncounterConfig[];
  boss: BossConfig;
  bosses?: BossConfig[];
}

export interface PlayerStatus {
  id: 1 | 2;
  label: string;
  health: number;
  maxHealth: number;
  bombs: number;
  bombCooldownMs?: number;
  alive: boolean;
  accent: string;
  weapon?: string;
  weapons?: string[];
  ammo?: Array<{
    label: string;
    ammo: string;
    active: boolean;
  }>;
}

export interface BossStatus {
  name: string;
  health: number;
  maxHealth: number;
}

export interface HudSnapshot {
  phase: 'standby' | 'live' | 'paused';
  stageName: string;
  stageIndex: number;
  totalStages: number;
  objective: string;
  encounterLabel: string;
  progressText: string;
  enemyCount: {
    alive: number;
    total: number;
  };
  totalScore: number;
  players: PlayerStatus[];
  boss?: BossStatus;
}

export interface SessionSnapshot {
  phase: SessionPhase;
  playerCount: 1 | 2;
  difficulty: DifficultyMode;
  currentStageIndex: number;
  totalScore: number;
  runSerial: number;
  completedStages: number;
  currentStage: StageConfig;
  nextStage?: StageConfig;
  stages: StageConfig[];
}
