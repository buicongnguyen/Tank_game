import { STAGES } from '../data/stages';
import type { DifficultyMode, SessionSnapshot, StageConfig } from '../types';

type Listener = (snapshot: SessionSnapshot) => void;

export class GameDirector {
  private readonly stages: StageConfig[];
  private readonly listeners = new Set<Listener>();
  private phase: SessionSnapshot['phase'] = 'menu';
  private playerCount: 1 | 2 = 1;
  private difficulty: DifficultyMode = 'normal';
  private currentStageIndex = 0;
  private totalScore = 0;
  private runSerial = 0;
  private completedStages = 0;

  constructor(stages: StageConfig[] = STAGES) {
    this.stages = stages;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());

    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): SessionSnapshot {
    const currentStage = this.stages[this.currentStageIndex] ?? this.stages[0];
    const nextStage = this.currentStageIndex + 1 < this.stages.length
      ? this.stages[this.currentStageIndex + 1]
      : undefined;

    return {
      phase: this.phase,
      playerCount: this.playerCount,
      difficulty: this.difficulty,
      currentStageIndex: this.currentStageIndex,
      totalScore: this.totalScore,
      runSerial: this.runSerial,
      completedStages: this.completedStages,
      currentStage,
      nextStage,
      stages: this.stages,
    };
  }

  startCampaign(playerCount: 1 | 2, difficulty: DifficultyMode = this.difficulty): void {
    this.phase = 'playing';
    this.playerCount = playerCount;
    this.difficulty = difficulty;
    this.currentStageIndex = 0;
    this.totalScore = 0;
    this.completedStages = 0;
    this.runSerial += 1;
    this.emit();
  }

  advanceToNextStage(playerCount: 1 | 2): void {
    if (this.currentStageIndex >= this.stages.length - 1) {
      return;
    }

    this.playerCount = playerCount;
    this.currentStageIndex += 1;
    this.phase = 'playing';
    this.runSerial += 1;
    this.emit();
  }

  skipToNextStage(): void {
    if (this.currentStageIndex >= this.stages.length - 1) {
      this.currentStageIndex = 0;
    } else {
      this.currentStageIndex += 1;
    }

    this.phase = 'playing';
    this.completedStages = Math.min(this.completedStages, this.currentStageIndex);
    this.runSerial += 1;
    this.emit();
  }

  addScore(points: number): void {
    this.totalScore += points;
  }

  completeCurrentStage(): void {
    this.completedStages = Math.min(this.completedStages + 1, this.stages.length);

    if (this.currentStageIndex >= this.stages.length - 1) {
      this.phase = 'victory';
      this.emit();
      return;
    }

    this.phase = 'intermission';
    this.emit();
  }

  failMission(): void {
    this.phase = 'gameover';
    this.emit();
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
