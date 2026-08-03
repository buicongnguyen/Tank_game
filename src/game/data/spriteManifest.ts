export interface SpriteSheetSpec {
  texture: string;
  path: string;
  frameWidth: number;
  frameHeight: number;
  frameEnd: number;
  frameRate: number;
  repeat: number;
}

export const ALL_SPRITE_SHEETS: SpriteSheetSpec[] = [];

export function animationKey(texture: string): string {
  return `anim-${texture}`;
}
