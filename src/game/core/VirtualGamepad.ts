export type GameAction =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'crouch'
  | 'jump'
  | 'fire'
  | 'special';

export interface InputAxis {
  x: number;
  y: number;
}

interface ActionState {
  down: boolean;
  justPressed: boolean;
}

interface PlayerTouchState {
  axis: InputAxis;
  actions: Record<GameAction, ActionState>;
}

const ALL_ACTIONS: GameAction[] = [
  'up',
  'down',
  'left',
  'right',
  'crouch',
  'jump',
  'fire',
  'special',
];

const PLAYER_IDS: Array<1 | 2> = [1, 2];

function createActionStates(): Record<GameAction, ActionState> {
  return {
    up: { down: false, justPressed: false },
    down: { down: false, justPressed: false },
    left: { down: false, justPressed: false },
    right: { down: false, justPressed: false },
    crouch: { down: false, justPressed: false },
    jump: { down: false, justPressed: false },
    fire: { down: false, justPressed: false },
    special: { down: false, justPressed: false },
  };
}

function createTouchState(): PlayerTouchState {
  return {
    axis: { x: 0, y: 0 },
    actions: createActionStates(),
  };
}

function clampAxis(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

export class VirtualGamepad {
  private readonly players = {
    1: createTouchState(),
    2: createTouchState(),
  } satisfies Record<1 | 2, PlayerTouchState>;

  setAxis(playerId: 1 | 2, x: number, y: number): void {
    const player = this.players[playerId];
    const rawX = clampAxis(x);
    const rawY = clampAxis(y);
    const magnitude = Math.hypot(rawX, rawY);
    const scale = magnitude > 1 ? 1 / magnitude : 1;
    const axisX = rawX * scale;
    const axisY = rawY * scale;

    player.axis.x = axisX;
    player.axis.y = axisY;

    const threshold = 0.3;
    this.setAction(playerId, 'left', axisX <= -threshold);
    this.setAction(playerId, 'right', axisX >= threshold);
    this.setAction(playerId, 'up', axisY <= -threshold);
    this.setAction(playerId, 'down', axisY >= threshold);
  }

  clearAxis(playerId: 1 | 2): void {
    this.setAxis(playerId, 0, 0);
  }

  getAxis(playerId: 1 | 2): InputAxis {
    const axis = this.players[playerId].axis;
    return { x: axis.x, y: axis.y };
  }

  setAction(playerId: 1 | 2, action: GameAction, down: boolean): void {
    const state = this.players[playerId].actions[action];
    if (down && !state.down) {
      state.justPressed = true;
    }

    state.down = down;
  }

  isDown(playerId: 1 | 2, action: GameAction): boolean {
    return this.players[playerId].actions[action].down;
  }

  consumeJustPressed(playerId: 1 | 2, action: GameAction): boolean {
    const state = this.players[playerId].actions[action];
    const wasPressed = state.justPressed;
    state.justPressed = false;
    return wasPressed;
  }

  resetPlayer(playerId: 1 | 2): void {
    const player = this.players[playerId];
    player.axis.x = 0;
    player.axis.y = 0;

    for (const action of ALL_ACTIONS) {
      player.actions[action].down = false;
      player.actions[action].justPressed = false;
    }
  }

  resetAll(): void {
    for (const playerId of PLAYER_IDS) {
      this.resetPlayer(playerId);
    }
  }
}
