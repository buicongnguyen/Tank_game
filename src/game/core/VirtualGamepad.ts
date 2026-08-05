export type GameAction = 'fire' | 'secondary' | 'special' | 'repair' | 'switchWeapon' | 'up' | 'down' | 'left' | 'right';

export interface InputAxis {
  x: number;
  y: number;
}

interface ActionState {
  down: boolean;
  justPressed: boolean;
}

const ALL_ACTIONS: GameAction[] = ['fire', 'secondary', 'special', 'repair', 'switchWeapon', 'up', 'down', 'left', 'right'];

function createActionStates(): Record<GameAction, ActionState> {
  return {
    fire: { down: false, justPressed: false },
    secondary: { down: false, justPressed: false },
    special: { down: false, justPressed: false },
    repair: { down: false, justPressed: false },
    switchWeapon: { down: false, justPressed: false },
    up: { down: false, justPressed: false },
    down: { down: false, justPressed: false },
    left: { down: false, justPressed: false },
    right: { down: false, justPressed: false },
  };
}

function clampAxis(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

function normalizedAxis(x: number, y: number): InputAxis {
  const rawX = clampAxis(x);
  const rawY = clampAxis(y);
  const magnitude = Math.hypot(rawX, rawY);
  const scale = magnitude > 1 ? 1 / magnitude : 1;
  return {
    x: rawX * scale,
    y: rawY * scale,
  };
}

export class VirtualGamepad {
  private readonly actions = createActionStates();
  private driveAxis: InputAxis = { x: 0, y: 0 };
  private aimAxis: InputAxis = { x: 0, y: 0 };

  setAxis(_playerId: 1 | 2, x: number, y: number): void {
    this.setDriveAxis(x, y);
  }

  setDriveAxis(x: number, y: number): void {
    this.driveAxis = normalizedAxis(x, y);

    const threshold = 0.3;
    this.setAction(1, 'left', this.driveAxis.x <= -threshold);
    this.setAction(1, 'right', this.driveAxis.x >= threshold);
    this.setAction(1, 'up', this.driveAxis.y <= -threshold);
    this.setAction(1, 'down', this.driveAxis.y >= threshold);
  }

  setAimAxis(x: number, y: number): void {
    this.aimAxis = normalizedAxis(x, y);
  }

  clearAxis(_playerId: 1 | 2): void {
    this.setDriveAxis(0, 0);
  }

  clearAimAxis(): void {
    this.setAimAxis(0, 0);
  }

  getAxis(_playerId: 1 | 2): InputAxis {
    return this.getDriveAxis();
  }

  getDriveAxis(): InputAxis {
    return { ...this.driveAxis };
  }

  getAimAxis(): InputAxis {
    return { ...this.aimAxis };
  }

  setAction(_playerId: 1 | 2, action: GameAction, down: boolean): void {
    const state = this.actions[action];
    if (down && !state.down) {
      state.justPressed = true;
    }

    state.down = down;
  }

  isDown(_playerId: 1 | 2, action: GameAction): boolean {
    return this.actions[action].down;
  }

  consumeJustPressed(_playerId: 1 | 2, action: GameAction): boolean {
    const state = this.actions[action];
    const wasPressed = state.justPressed;
    state.justPressed = false;
    return wasPressed;
  }

  resetPlayer(_playerId: 1 | 2): void {
    this.driveAxis = { x: 0, y: 0 };
    this.aimAxis = { x: 0, y: 0 };

    for (const action of ALL_ACTIONS) {
      this.actions[action].down = false;
      this.actions[action].justPressed = false;
    }
  }

  resetAll(): void {
    this.resetPlayer(1);
  }
}
