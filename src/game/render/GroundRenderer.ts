import type Phaser from 'phaser';
import type { MissionConfig } from '../types';

export type GroundTheme = 'grass' | 'sand' | 'asphalt' | 'snow' | 'ash';
const THEMES: Record<string, GroundTheme> = {
  'rocket-picket': 'sand', 'supply-run': 'sand', 'ridge-bombard': 'sand',
  'first-armor': 'asphalt', 'relay-hold': 'asphalt', 'fortress-core': 'asphalt',
  'rail-yard': 'asphalt', 'iron-sovereign': 'asphalt', 'frozen-pass': 'snow', 'ash-corridor': 'ash',
};
export const groundTheme = (mission: MissionConfig): GroundTheme => THEMES[mission.id] ?? 'grass';

/** Five small shared tiles, one reused TileSprite; no moving terrain or physics. */
export class GroundRenderer {
  private tile?: Phaser.GameObjects.TileSprite;
  private readonly scene: Phaser.Scene;
  constructor(scene: Phaser.Scene) { this.scene = scene; }

  private texture(theme: GroundTheme): string {
    const key = `ground-detail-${theme}`;
    if (this.scene.textures.exists(key)) return key;
    const texture = this.scene.textures.createCanvas(key, 160, 160)!;
    const ctx = texture.getContext();
    const pixels = ctx.createImageData(160, 160);
    for (let y = 0; y < 160; y++) for (let x = 0; x < 160; x++) {
      const hash = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
      const grain = hash - Math.floor(hash);
      const wave = theme === 'sand' ? Math.sin(y * Math.PI / 10 + Math.sin(x * Math.PI / 40)) * 5 : 0;
      const shade = 236 + grain * 18 + wave;
      const i = (y * 160 + x) * 4;
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = shade;
      pixels.data[i + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
    ctx.strokeStyle = 'rgba(20,26,18,0.075)';
    ctx.lineWidth = 1;
    if (theme === 'grass') for (let i = 0; i < 50; i++) {
      const x = i * 37 % 160, y = i * 61 % 160;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 2, y - 4); ctx.stroke();
    }
    texture.refresh();
    return key;
  }

  draw(g: Phaser.GameObjects.Graphics, mission: MissionConfig): void {
    const theme = groundTheme(mission);
    const key = this.texture(theme);
    this.tile ??= this.scene.add.tileSprite(0, 0, mission.worldWidth, mission.worldHeight, key).setOrigin(0).setDepth(-1);
    this.tile.setTexture(key).setSize(mission.worldWidth, mission.worldHeight)
      // Keep snow blue-grey so pale HUD text and green health bars stay legible.
      .setTint(theme === 'snow' ? 0x6e858f : mission.palette.ground);
    let seed = 0;
    for (const char of mission.id) seed = (Math.imul(seed, 31) + char.charCodeAt(0)) >>> 0;
    const random = (): number => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 65; i++) {
      const x = random() * mission.worldWidth, y = random() * mission.worldHeight;
      g.fillStyle(i % 2 ? 0xcbd0b1 : 0x17281e, 0.02);
      const width = 18 + random() * 65, height = 10 + random() * 30;
      const points = Array.from({ length: 9 }, (_, index) => {
        const angle = index * Math.PI * 2 / 9, radius = 0.55 + random() * 0.45;
        return { x: x + Math.cos(angle) * width * radius, y: y + Math.sin(angle) * height * radius };
      });
      g.fillPoints(points, true);
    }
    // Decorative roads only: do not imply a new obstacle, shortcut, or speed zone.
    const roadY = mission.worldHeight * 0.52;
    const asphalt = theme === 'asphalt';
    g.fillStyle(asphalt ? 0x232c2e : theme === 'snow' ? 0x6b8287 : 0x9a805a, asphalt ? 0.6 : 0.16);
    g.fillRect(0, roadY - (asphalt ? 72 : 44), mission.worldWidth, asphalt ? 144 : 88);
    for (const side of [-1, 1]) {
      g.lineStyle(asphalt ? 2 : 5, asphalt ? 0xc2bc9b : 0x23382c, asphalt ? 0.22 : 0.12);
      g.lineBetween(0, roadY + side * (asphalt ? 65 : 24), mission.worldWidth, roadY + side * (asphalt ? 65 : 24));
    }
    if (asphalt) for (let x = 0; x < mission.worldWidth; x += 100) {
      g.fillStyle(0xd3c495, 0.18); g.fillRect(x, roadY - 2, 35, 4);
    }
    if (mission.palette.water) {
      const waterY = mission.worldHeight * 0.72;
      g.fillStyle(mission.palette.water, 0.58); g.fillRect(0, waterY, mission.worldWidth, 90);
      g.lineStyle(1, 0xb6d8d0, 0.13);
      for (let x = 12; x < mission.worldWidth; x += 95) g.lineBetween(x, waterY + 20 + x % 45, x + 28, waterY + 20 + x % 45);
    }
  }

  destroy(): void { this.tile?.destroy(); this.tile = undefined; }
}
