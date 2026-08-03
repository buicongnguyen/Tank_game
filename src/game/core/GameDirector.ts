import { STAGES } from '../data/stages';
import type { DifficultyMode, MissionConfig, SessionSnapshot, TankStats, UpgradeId, UpgradeOption } from '../types';

type Listener = (snapshot: SessionSnapshot) => void;

const BASE_STATS: TankStats = {
  maxHealth: 520,
  armor: 1,
  engine: 235,
  turnRate: 5.8,
  reloadMs: 880,
  shellDamage: 95,
  shellSpeed: 760,
  secondaryCooldownMs: 2400,
  specialCooldownMs: 13500,
  repairCharges: 2,
};

const UPGRADE_LIBRARY: Record<UpgradeId, UpgradeOption> = {
  armor: {
    id: 'armor',
    label: 'Reactive Armor',
    description: '+110 max HP and better front armor.',
  },
  engine: {
    id: 'engine',
    label: 'Hot Engine',
    description: '+32 drive speed and faster hull response.',
  },
  reload: {
    id: 'reload',
    label: 'Auto Loader',
    description: 'Cannon reloads 16% faster.',
  },
  shells: {
    id: 'shells',
    label: 'Shaped Shells',
    description: '+22 cannon damage and wider blast.',
  },
  special: {
    id: 'special',
    label: 'Command Uplink',
    description: 'Artillery special cools down faster.',
  },
  repair: {
    id: 'repair',
    label: 'Field Repair Kit',
    description: '+1 repair charge and stronger repair pads.',
  },
};

const UPGRADE_ROTATION: UpgradeId[][] = [
  ['armor', 'reload', 'engine'],
  ['shells', 'special', 'repair'],
  ['engine', 'shells', 'armor'],
  ['reload', 'repair', 'special'],
];

function cloneStats(stats: TankStats): TankStats {
  return { ...stats };
}

function applyDifficulty(stats: TankStats, difficulty: DifficultyMode): TankStats {
  const next = cloneStats(stats);

  if (difficulty === 'easy') {
    next.maxHealth += 220;
    next.repairCharges += 1;
    next.reloadMs *= 0.9;
  }

  if (difficulty === 'hard') {
    next.maxHealth -= 130;
    next.reloadMs *= 1.08;
  }

  if (difficulty === 'extreme') {
    next.maxHealth -= 230;
    next.armor *= 0.82;
    next.reloadMs *= 1.16;
    next.repairCharges = Math.max(1, next.repairCharges - 1);
  }

  return next;
}

export class GameDirector {
  private readonly missions: MissionConfig[];
  private readonly listeners = new Set<Listener>();
  private phase: SessionSnapshot['phase'] = 'menu';
  private difficulty: DifficultyMode = 'normal';
  private currentMissionIndex = 0;
  private totalScore = 0;
  private scrap = 0;
  private runSerial = 0;
  private completedMissions = 0;
  private failureReason: string | undefined;
  private tankStats = cloneStats(BASE_STATS);
  private pendingUpgrades: UpgradeOption[] = this.getUpgradeOptions(0);

  constructor(missions: MissionConfig[] = STAGES) {
    this.missions = missions;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());

    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): SessionSnapshot {
    const currentMission = this.missions[this.currentMissionIndex] ?? this.missions[0];
    const nextMission = this.currentMissionIndex + 1 < this.missions.length
      ? this.missions[this.currentMissionIndex + 1]
      : undefined;

    return {
      phase: this.phase,
      difficulty: this.difficulty,
      currentMissionIndex: this.currentMissionIndex,
      totalScore: this.totalScore,
      scrap: this.scrap,
      failureReason: this.failureReason,
      runSerial: this.runSerial,
      completedMissions: this.completedMissions,
      currentMission,
      nextMission,
      missions: this.missions,
      tankStats: cloneStats(this.tankStats),
      pendingUpgrades: [...this.pendingUpgrades],
    };
  }

  startCampaign(_playerCount: 1 | 2 = 1, difficulty: DifficultyMode = this.difficulty): void {
    this.phase = 'playing';
    this.difficulty = difficulty;
    this.currentMissionIndex = 0;
    this.totalScore = 0;
    this.scrap = 0;
    this.failureReason = undefined;
    this.completedMissions = 0;
    this.tankStats = applyDifficulty(BASE_STATS, difficulty);
    this.pendingUpgrades = this.getUpgradeOptions(0);
    this.runSerial += 1;
    this.emit();
  }

  advanceToNextStage(): void {
    this.advanceToNextMission();
  }

  advanceToNextMission(): void {
    if (this.currentMissionIndex >= this.missions.length - 1) {
      this.phase = 'victory';
      this.emit();
      return;
    }

    this.currentMissionIndex += 1;
    this.phase = 'playing';
    this.failureReason = undefined;
    this.pendingUpgrades = this.getUpgradeOptions(this.currentMissionIndex);
    this.runSerial += 1;
    this.emit();
  }

  skipToNextStage(): void {
    this.completeCurrentMission({ score: 0, scrap: 0 });
  }

  addScore(points: number): void {
    this.totalScore += Math.max(0, Math.round(points));
  }

  completeCurrentMission(reward: { score: number; scrap: number }): void {
    this.failureReason = undefined;
    this.addScore(reward.score);
    this.scrap += Math.max(0, Math.round(reward.scrap));
    this.completedMissions = Math.min(this.completedMissions + 1, this.missions.length);

    if (this.currentMissionIndex >= this.missions.length - 1) {
      this.phase = 'victory';
      this.emit();
      return;
    }

    this.phase = 'intermission';
    this.pendingUpgrades = this.getUpgradeOptions(this.currentMissionIndex);
    this.emit();
  }

  applyUpgrade(id: UpgradeId): void {
    if (!this.pendingUpgrades.some((upgrade) => upgrade.id === id)) {
      return;
    }

    if (id === 'armor') {
      this.tankStats.maxHealth += 110;
      this.tankStats.armor += 0.12;
    } else if (id === 'engine') {
      this.tankStats.engine += 32;
      this.tankStats.turnRate += 0.4;
    } else if (id === 'reload') {
      this.tankStats.reloadMs = Math.max(460, this.tankStats.reloadMs * 0.84);
    } else if (id === 'shells') {
      this.tankStats.shellDamage += 22;
      this.tankStats.shellSpeed += 35;
    } else if (id === 'special') {
      this.tankStats.specialCooldownMs = Math.max(7600, this.tankStats.specialCooldownMs * 0.78);
    } else if (id === 'repair') {
      this.tankStats.repairCharges += 1;
      this.tankStats.maxHealth += 45;
    }

    this.advanceToNextMission();
  }

  failMission(reason = 'Mission failed'): void {
    this.failureReason = reason;
    this.phase = 'gameover';
    this.emit();
  }

  private getUpgradeOptions(index: number): UpgradeOption[] {
    const ids = UPGRADE_ROTATION[index % UPGRADE_ROTATION.length];
    return ids.map((id) => UPGRADE_LIBRARY[id]);
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
