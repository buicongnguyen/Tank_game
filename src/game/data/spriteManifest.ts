import type { BossKind, EnemyKind, StageThemeId } from '../types';

export interface SpriteSheetSpec {
  texture: string;
  path: string;
  frameWidth: number;
  frameHeight: number;
  frameEnd: number;
  frameRate: number;
  repeat: number;
}

export const STAGE_THEMES: StageThemeId[] = ['emerald', 'river', 'blacksite'];

export const PLAYER_SHEETS: SpriteSheetSpec[] = [
  { texture: 'player-idle', path: 'assets/sprites/player/commando_idle.png', frameWidth: 64, frameHeight: 64, frameEnd: 3, frameRate: 5, repeat: -1 },
  { texture: 'player-walk', path: 'assets/sprites/player/commando_walk.png', frameWidth: 64, frameHeight: 64, frameEnd: 3, frameRate: 8, repeat: -1 },
  { texture: 'player-run', path: 'assets/sprites/player/commando_run.png', frameWidth: 64, frameHeight: 64, frameEnd: 5, frameRate: 11, repeat: -1 },
  { texture: 'player-crawl', path: 'assets/sprites/player/commando_crawl.png', frameWidth: 64, frameHeight: 64, frameEnd: 3, frameRate: 7, repeat: -1 },
  { texture: 'player-kneel', path: 'assets/sprites/player/commando_kneel.png', frameWidth: 64, frameHeight: 64, frameEnd: 3, frameRate: 5, repeat: -1 },
  { texture: 'player-jump', path: 'assets/sprites/player/commando_jump.png', frameWidth: 64, frameHeight: 64, frameEnd: 3, frameRate: 10, repeat: -1 },
  { texture: 'player-fire', path: 'assets/sprites/player/commando_fire.png', frameWidth: 64, frameHeight: 64, frameEnd: 3, frameRate: 14, repeat: -1 },
];

const ENEMY_FRAME_END = 3;
const TURRET_STAND_END = 1;

export const ENEMY_SHEETS: SpriteSheetSpec[] = STAGE_THEMES.flatMap((theme) => [
  { texture: `enemy-${theme}-rifleman-stand`, path: `assets/sprites/enemies/${theme}_rifleman_stand.png`, frameWidth: 48, frameHeight: 48, frameEnd: ENEMY_FRAME_END, frameRate: 5, repeat: -1 },
  { texture: `enemy-${theme}-rifleman-fire`, path: `assets/sprites/enemies/${theme}_rifleman_fire.png`, frameWidth: 48, frameHeight: 48, frameEnd: ENEMY_FRAME_END, frameRate: 10, repeat: -1 },
  { texture: `enemy-${theme}-rocketeer-stand`, path: `assets/sprites/enemies/${theme}_rocketeer_stand.png`, frameWidth: 48, frameHeight: 48, frameEnd: ENEMY_FRAME_END, frameRate: 5, repeat: -1 },
  { texture: `enemy-${theme}-rocketeer-fire`, path: `assets/sprites/enemies/${theme}_rocketeer_fire.png`, frameWidth: 48, frameHeight: 48, frameEnd: ENEMY_FRAME_END, frameRate: 9, repeat: -1 },
  { texture: `enemy-${theme}-turret-stand`, path: `assets/sprites/enemies/${theme}_turret_stand.png`, frameWidth: 48, frameHeight: 48, frameEnd: TURRET_STAND_END, frameRate: 3, repeat: -1 },
  { texture: `enemy-${theme}-turret-fire`, path: `assets/sprites/enemies/${theme}_turret_fire.png`, frameWidth: 48, frameHeight: 48, frameEnd: ENEMY_FRAME_END, frameRate: 8, repeat: -1 },
]);

export const BOSS_SHEETS: SpriteSheetSpec[] = [
  { texture: 'boss-gunship-fire', path: 'assets/sprites/bosses/gunship_fire.png', frameWidth: 128, frameHeight: 96, frameEnd: 5, frameRate: 10, repeat: -1 },
  { texture: 'boss-barge-fire', path: 'assets/sprites/bosses/barge_fire.png', frameWidth: 128, frameHeight: 96, frameEnd: 5, frameRate: 9, repeat: -1 },
  { texture: 'boss-tank-fire', path: 'assets/sprites/bosses/tank_fire.png', frameWidth: 128, frameHeight: 96, frameEnd: 5, frameRate: 10, repeat: -1 },
];

export const ALL_SPRITE_SHEETS: SpriteSheetSpec[] = [
  ...PLAYER_SHEETS,
  ...ENEMY_SHEETS,
  ...BOSS_SHEETS,
];

export function animationKey(texture: string): string {
  return `anim-${texture}`;
}

export function getStageThemeById(stageId: string): StageThemeId {
  switch (stageId) {
    case 'emerald-killbox':
      return 'emerald';
    case 'river-run':
      return 'river';
    case 'blacksite-siege':
      return 'blacksite';
    default:
      return 'emerald';
  }
}

export function getEnemyTextureKey(theme: StageThemeId, kind: EnemyKind, action: 'stand' | 'fire'): string {
  const textureKind = kind === 'zombie' || kind === 'scout' || kind === 'bikeRaider' || kind === 'jeepRaider' || kind === 'tankRaider'
    ? 'rifleman'
    : kind;
  return `enemy-${theme}-${textureKind}-${action}`;
}

export function getBossTextureKey(kind: BossKind): string {
  return `boss-${kind}-fire`;
}
