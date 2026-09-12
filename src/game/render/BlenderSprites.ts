import Phaser from 'phaser';
import type { TankArtKind } from './tankArt';

const ATLAS = 'blender-combat';
const RADIUS_SPAN = 4.8;
export const BLENDER_ART_PATH = `${import.meta.env.BASE_URL}art/blender/`;

interface UnitVisual {
  hull: Phaser.GameObjects.Image;
  turret: Phaser.GameObjects.Image;
}

/** One atlas, reused Images, no 3D renderer or per-frame texture generation. */
export class BlenderSprites {
  private readonly units = new Map<string, UnitVisual>();
  private readonly weapons = new Map<string, Phaser.GameObjects.Image>();
  private transport?: Phaser.GameObjects.Image;
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  static preload(scene: Phaser.Scene): void {
    scene.load.atlas(ATLAS, `${BLENDER_ART_PATH}combat.png`, `${BLENDER_ART_PATH}combat.json`);
  }

  /** Hide last frame's images, including dead/off-screen/sheltered units. */
  beginFrame(): void {
    this.transport?.setVisible(false);
    for (const image of this.weapons.values()) image.setVisible(false);
    for (const visual of this.units.values()) {
      visual.hull.setVisible(false);
      visual.turret.setVisible(false);
    }
  }

  drawUnit(id: string, kind: TankArtKind, team: 'player' | 'enemy', x: number, y: number,
    radius: number, bodyAngle: number, turretAngle: number, exposed: boolean): boolean {
    // Unconverted special platforms retain their original vector silhouettes.
    if (kind === 'turret' || kind === 'convoy') return false;
    const archetype = kind === 'raider' ? 'player' : kind === 'boss' ? 'siege' : kind;
    const hullFrame = `${team}-${archetype}-hull`;
    const turretFrame = `${team}-${archetype}-turret`;
    if (!this.hasFrame(hullFrame) || !this.hasFrame(turretFrame)) return false;
    let visual = this.units.get(id);
    if (!visual) {
      visual = {
        hull: this.scene.add.image(x, y, ATLAS, hullFrame).setDepth(2.4),
        turret: this.scene.add.image(x, y, ATLAS, turretFrame).setDepth(2.5),
      };
      this.units.set(id, visual);
    }
    const size = radius * RADIUS_SPAN;
    visual.hull.setFrame(hullFrame).setPosition(x, y).setDisplaySize(size, size).setRotation(bodyAngle).setVisible(true);
    visual.turret.setFrame(turretFrame).setPosition(x, y).setDisplaySize(size, size).setRotation(turretAngle).setVisible(true);
    if (exposed) visual.turret.setTint(0xffdb86);
    else visual.turret.clearTint();
    return true;
  }

  reset(): void {
    for (const visual of this.units.values()) {
      visual.hull.destroy();
      visual.turret.destroy();
    }
    for (const image of this.weapons.values()) image.destroy();
    this.transport?.destroy();
    this.transport = undefined;
    this.units.clear();
    this.weapons.clear();
  }

  drawWeapon(id: string, kind: string, x: number, y: number, angle: number, length: number, width: number): boolean {
    const frame = `weapon-${kind}`;
    if (!this.hasFrame(frame)) return false;
    let image = this.weapons.get(id);
    if (!image) {
      image = this.scene.add.image(x, y, ATLAS, frame).setOrigin(0, .5).setDepth(2.6);
      this.weapons.set(id, image);
    }
    image.setFrame(frame).setPosition(x, y).setDisplaySize(length, width).setRotation(angle).setVisible(true);
    return true;
  }

  drawTransport(x: number, y: number): boolean {
    if (!this.hasFrame('prop-transport')) return false;
    this.transport ??= this.scene.add.image(x, y, ATLAS, 'prop-transport').setDepth(1.2);
    // The source truck points down in the top-down PNG; the convoy drives east.
    this.transport.setPosition(x, y).setDisplaySize(40, 74).setRotation(-Math.PI / 2).setVisible(true);
    return true;
  }

  private hasFrame(frame: string): boolean {
    return this.scene.textures.exists(ATLAS) && this.scene.textures.get(ATLAS).has(frame);
  }
}
