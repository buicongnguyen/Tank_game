import Phaser from 'phaser';
import { CONTROL_SCHEMES } from '../core/ControlScheme';
import { GameDirector } from '../core/GameDirector';
import { VirtualGamepad, type GameAction } from '../core/VirtualGamepad';
import {
  ALL_SPRITE_SHEETS,
  animationKey,
  getBossTextureKey,
  getEnemyTextureKey,
} from '../data/spriteManifest';
import type {
  BossConfig,
  DifficultyMode,
  EnemyKind,
  EncounterConfig,
  HudSnapshot,
  SessionSnapshot,
  StageConfig,
  StageThemeId,
  WeaponKind,
} from '../types';

interface WeaponSpec {
  kind: WeaponKind;
  label: string;
  shortLabel: string;
  tint: number;
  fireRate: number;
  bulletSpeed: number;
  damage: number;
  maxDistance: number;
  maxAmmo: number;
  pickupAmmo: number;
  ammoCost: number;
  spread: number;
  pellets: number;
  scaleX: number;
  scaleY: number;
  projectileTexture?: string;
  splashRadius?: number;
  splashDamage?: number;
  poisonRadius?: number;
  poisonDamage?: number;
  pierceCount?: number;
  beamWidth?: number;
  dropStartRatio?: number;
  tracerDistance?: number;
}

type BulletZoneEffect = 'drag' | 'boost' | 'crosswind';

interface BulletEffectZone {
  bounds: Phaser.Geom.Rectangle;
  effect: BulletZoneEffect;
  label: string;
}

type TerrainEffect = 'water' | 'high' | 'hole';
type VehicleKind = 'jeep' | 'tank' | 'motorcycle';

interface TerrainZone {
  bounds: Phaser.Geom.Rectangle;
  effect: TerrainEffect;
  label: string;
  height: number;
}

interface VehicleVisualPart {
  object: Phaser.GameObjects.Shape;
  offsetX: number;
  offsetY: number;
  rotationOffset: number;
  baseTint: number;
  brokenTint: number;
  alpha: number;
  spinSpeed?: number;
}

interface VehicleUnit {
  kind: VehicleKind;
  body: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  hpLabel: Phaser.GameObjects.Text;
  visualParts: VehicleVisualPart[];
  driver?: PlayerUnit;
  passengerAllies: AllyUnit[];
  capacity: number;
  hp: number;
  maxHp: number;
  speed: number;
  active: boolean;
  weaponShotsRemaining: number;
  nextWeaponFireAt: number;
  salvoShotsRemaining: number;
  nextSalvoFireAt: number;
  baseTint: number;
  brokenTint: number;
  ammoLabel: string;
}

const WEAPONS: Record<WeaponKind, WeaponSpec> = {
  rifle: {
    kind: 'rifle',
    label: 'Rifle',
    shortLabel: 'RFL',
    tint: 0xefb648,
    fireRate: 190,
    bulletSpeed: 390,
    damage: 32,
    maxDistance: 500,
    maxAmmo: -1,
    pickupAmmo: 0,
    ammoCost: 0,
    spread: 0,
    pellets: 1,
    scaleX: 1.8,
    scaleY: 1.25,
  },
  shotgun: {
    kind: 'shotgun',
    label: 'Shotgun',
    shortLabel: 'SHG',
    tint: 0xffd08a,
    fireRate: 500,
    bulletSpeed: 430,
    damage: 44,
    maxDistance: 760,
    maxAmmo: 72,
    pickupAmmo: 36,
    ammoCost: 1,
    spread: 0.3,
    pellets: 6,
    scaleX: 1.65,
    scaleY: 1.25,
  },
  flame: {
    kind: 'flame',
    label: 'Fire Gun',
    shortLabel: 'FIR',
    tint: 0xff6b2d,
    fireRate: 95,
    bulletSpeed: 340,
    damage: 24,
    maxDistance: 580,
    maxAmmo: 180,
    pickupAmmo: 90,
    ammoCost: 1,
    spread: 0.18,
    pellets: 5,
    scaleX: 2.5,
    scaleY: 2.15,
  },
  launcher: {
    kind: 'launcher',
    label: 'Launcher',
    shortLabel: 'LCH',
    tint: 0x9cf5f3,
    fireRate: 720,
    bulletSpeed: 360,
    damage: 135,
    maxDistance: 980,
    maxAmmo: 16,
    pickupAmmo: 8,
    ammoCost: 1,
    spread: 0,
    pellets: 1,
    scaleX: 2.35,
    scaleY: 1.65,
    splashRadius: 118,
    splashDamage: 70,
  },
  sniper: {
    kind: 'sniper',
    label: 'Sniper',
    shortLabel: 'SNP',
    tint: 0xdaf7ff,
    fireRate: 760,
    bulletSpeed: 860,
    damage: 150,
    maxDistance: 1900,
    maxAmmo: 72,
    pickupAmmo: 36,
    ammoCost: 1,
    spread: 0,
    pellets: 1,
    scaleX: 2.8,
    scaleY: 1.05,
    pierceCount: 4,
    dropStartRatio: 0.96,
    tracerDistance: 760,
  },
  explosiveArrow: {
    kind: 'explosiveArrow',
    label: 'Blast Arrow',
    shortLabel: 'ARR',
    tint: 0xb6ff70,
    fireRate: 680,
    bulletSpeed: 330,
    damage: 80,
    maxDistance: 900,
    maxAmmo: 48,
    pickupAmmo: 24,
    ammoCost: 1,
    spread: 0,
    pellets: 1,
    scaleX: 3,
    scaleY: 1.85,
    splashRadius: 170,
    splashDamage: 105,
  },
  missile: {
    kind: 'missile',
    label: 'Hand Missile',
    shortLabel: 'MSL',
    tint: 0xffb35c,
    fireRate: 860,
    bulletSpeed: 300,
    damage: 105,
    maxDistance: 960,
    maxAmmo: 12,
    pickupAmmo: 6,
    ammoCost: 1,
    spread: 0,
    pellets: 1,
    scaleX: 1.35,
    scaleY: 1.2,
    projectileTexture: 'projectile-missile',
    splashRadius: 230,
    splashDamage: 150,
  },
  laser: {
    kind: 'laser',
    label: 'Laser Gun',
    shortLabel: 'LSR',
    tint: 0x71f7ff,
    fireRate: 620,
    bulletSpeed: 0,
    damage: 130,
    maxDistance: 1180,
    maxAmmo: 40,
    pickupAmmo: 20,
    ammoCost: 1,
    spread: 0,
    pellets: 1,
    scaleX: 1,
    scaleY: 1,
    beamWidth: 30,
    pierceCount: 99,
  },
  machineGun: {
    kind: 'machineGun',
    label: 'Machine Gun',
    shortLabel: 'MG',
    tint: 0xf4f1a2,
    fireRate: 58,
    bulletSpeed: 470,
    damage: 24,
    maxDistance: 620,
    maxAmmo: 1600,
    pickupAmmo: 800,
    ammoCost: 1,
    spread: 0.06,
    pellets: 2,
    scaleX: 1.45,
    scaleY: 1.05,
  },
  throwBomb: {
    kind: 'throwBomb',
    label: 'Throw Bomb',
    shortLabel: 'BMB',
    tint: 0xffd16a,
    fireRate: 720,
    bulletSpeed: 270,
    damage: 72,
    maxDistance: 760,
    maxAmmo: 28,
    pickupAmmo: 14,
    ammoCost: 1,
    spread: 0,
    pellets: 1,
    scaleX: 2.35,
    scaleY: 1.65,
    splashRadius: 185,
    splashDamage: 118,
    dropStartRatio: 0.58,
  },
  poisonBomb: {
    kind: 'poisonBomb',
    label: 'Poison Bomb',
    shortLabel: 'PSN',
    tint: 0x8cff6a,
    fireRate: 860,
    bulletSpeed: 250,
    damage: 42,
    maxDistance: 700,
    maxAmmo: 20,
    pickupAmmo: 10,
    ammoCost: 1,
    spread: 0,
    pellets: 1,
    scaleX: 2.2,
    scaleY: 1.55,
    splashRadius: 125,
    splashDamage: 48,
    poisonRadius: 170,
    poisonDamage: 22,
    dropStartRatio: 0.52,
  },
};

const DIFFICULTY_HEALTH: Record<DifficultyMode, number> = {
  easy: 1000,
  normal: 400,
  hard: 200,
  extreme: 100,
};

interface PlayerUnit {
  id: 1 | 2;
  label: string;
  accent: string;
  tint: number;
  sprite: Phaser.Physics.Arcade.Sprite;
  health: number;
  maxHealth: number;
  bombs: number;
  alive: boolean;
  moveSpeed: number;
  walkSpeed: number;
  crawlSpeed: number;
  jumpSpeed: number;
  fireRate: number;
  bulletSpeed: number;
  damage: number;
  nextFireAt: number;
  nextSpecialAt: number;
  jumpReadyAt: number;
  jumpUntil: number;
  fireVisualUntil: number;
  contactReadyAt: number;
  aimAssistShots: number;
  rifleAimAssistEvery: number;
  weaponIndex: number;
  weapons: WeaponKind[];
  ammo: Record<WeaponKind, number>;
  vehicle?: VehicleUnit;
  aim: Phaser.Math.Vector2;
  jumpVector: Phaser.Math.Vector2;
  virtualControlId?: 1 | 2;
  controls: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    crouch: Phaser.Input.Keyboard.Key;
    jump: Phaser.Input.Keyboard.Key;
    fire: Phaser.Input.Keyboard.Key;
    special: Phaser.Input.Keyboard.Key;
  };
  keyboardAliases?: Partial<Record<keyof PlayerUnit['controls'], Phaser.Input.Keyboard.Key[]>>;
}

interface AllyUnit {
  id: string;
  sprite: Phaser.Physics.Arcade.Sprite;
  label: Phaser.GameObjects.Text;
  alive: boolean;
  nextFireAt: number;
  followOffset: Phaser.Math.Vector2;
  vehicle?: VehicleUnit;
}

interface RescueBunker {
  id: string;
  body: Phaser.GameObjects.Rectangle;
  marker: Phaser.GameObjects.Text;
  rescued: boolean;
  linkedObjects: Phaser.GameObjects.GameObject[];
}

interface EnemyUnit {
  id: string;
  kind: EnemyKind;
  theme: StageThemeId;
  sprite: Phaser.Physics.Arcade.Sprite;
  visualParts?: VehicleVisualPart[];
  health: number;
  maxHealth: number;
  alive: boolean;
  moveSpeed: number;
  fireRate: number;
  bulletSpeed: number;
  damage: number;
  nextFireAt: number;
  fireVisualUntil: number;
  contactReadyAt: number;
  encounterId: string;
  behaviorOffset: number;
}

interface BossUnit {
  config: BossConfig;
  sprite: Phaser.Physics.Arcade.Sprite;
  visualParts: VehicleVisualPart[];
  health: number;
  maxHealth: number;
  alive: boolean;
  nextFireAt: number;
  nextSummonAt: number;
  fireVisualUntil: number;
  contactReadyAt: number;
  direction: number;
}

interface EncounterState {
  config: EncounterConfig;
  triggered: boolean;
  cleared: boolean;
  remaining: number;
}

interface SpawnDoor {
  x: number;
  y: number;
  house: Phaser.GameObjects.Rectangle;
}

export class BattleScene extends Phaser.Scene {
  private readonly director: GameDirector;
  private readonly pushHud: (snapshot: HudSnapshot) => void;
  private readonly virtualGamepad: VirtualGamepad;
  private unsubscribe?: () => void;
  private loadedToken = '';
  private stage?: StageConfig;
  private players: PlayerUnit[] = [];
  private allies: AllyUnit[] = [];
  private rescueBunkers: RescueBunker[] = [];
  private enemies: EnemyUnit[] = [];
  private bosses: BossUnit[] = [];
  private boss?: BossUnit;
  private encounterStates: EncounterState[] = [];
  private encounterCount = 0;
  private activeEncounterLabel = 'Stand by for deployment';
  private allEncountersCleared = false;
  private bossSpawned = false;
  private playing = false;
  private hudTimestamp = 0;
  private playerGroup?: Phaser.Physics.Arcade.Group;
  private allyGroup?: Phaser.Physics.Arcade.Group;
  private enemyGroup?: Phaser.Physics.Arcade.Group;
  private bossGroup?: Phaser.Physics.Arcade.Group;
  private playerBullets?: Phaser.Physics.Arcade.Group;
  private enemyBullets?: Phaser.Physics.Arcade.Group;
  private weaponPickups?: Phaser.Physics.Arcade.StaticGroup;
  private healthPickups?: Phaser.Physics.Arcade.StaticGroup;
  private airStrikePickups?: Phaser.Physics.Arcade.StaticGroup;
  private supplyCrates?: Phaser.Physics.Arcade.StaticGroup;
  private rescueBunkerGroup?: Phaser.Physics.Arcade.StaticGroup;
  private vehicleGroup?: Phaser.Physics.Arcade.Group;
  private vehicles: VehicleUnit[] = [];
  private obstacleBodies: Phaser.GameObjects.Rectangle[] = [];
  private bulletTravelBounds = new Phaser.Geom.Rectangle();
  private sightLine = new Phaser.Geom.Line();
  private sightBounds = new Phaser.Geom.Rectangle();
  private nextVisionConeDrawAt = 0;
  private bulletZones: BulletEffectZone[] = [];
  private terrainZones: TerrainZone[] = [];
  private spawnDoors = new Map<string, SpawnDoor>();
  private cameraTarget?: Phaser.GameObjects.Zone;
  private baseCameraZoom = 1;
  private bannerText?: Phaser.GameObjects.Text;
  private reticleText?: Phaser.GameObjects.Text;
  private objectivePanel?: Phaser.GameObjects.Image;
  private visionGraphics?: Phaser.GameObjects.Graphics;
  private shadowSquadMode = false;

  constructor(
    director: GameDirector,
    pushHud: (snapshot: HudSnapshot) => void,
    virtualGamepad: VirtualGamepad,
  ) {
    super('battle-scene');
    this.director = director;
    this.pushHud = pushHud;
    this.virtualGamepad = virtualGamepad;
  }

  preload(): void {
    for (const sheet of ALL_SPRITE_SHEETS) {
      this.load.spritesheet(sheet.texture, sheet.path, {
        frameWidth: sheet.frameWidth,
        frameHeight: sheet.frameHeight,
      });
    }
  }

  create(data?: { token?: string }): void {
    this.loadedToken = data?.token ?? '';
    this.ensureEffectTextures();
    this.createAnimations();
    this.attachDirector();
    this.scale.off(Phaser.Scale.Events.RESIZE, this.applyResponsiveCamera, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.applyResponsiveCamera, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.applyResponsiveCamera, this);
    });

    const snapshot = this.director.getSnapshot();
    if (snapshot.phase === 'playing') {
      this.setupStage(snapshot);
      return;
    }

    this.setupStandby(snapshot);
  }

  update(time: number, delta: number): void {
    if (!this.playing || !this.stage) {
      return;
    }

    this.updatePlayers(time);
    this.updateAllies(time);
    this.updateVehicles();
    this.updateEnemies(time);
    this.drawEnemyVisionCones(time);
    this.updateBoss(time);
    this.updateCameraAnchor();
    this.keepActorsInsideVisiblePlayfield();
    this.checkEncounterTriggers();
    this.updateBullets(this.playerBullets, time, delta);
    this.updateBullets(this.enemyBullets, time, delta);

    if (time - this.hudTimestamp > 120) {
      this.hudTimestamp = time;
      this.emitHud('live');
    }
  }

  private attachDirector(): void {
    if (this.unsubscribe) {
      return;
    }

    this.unsubscribe = this.director.subscribe((snapshot) => {
      const nextToken = snapshot.phase === 'playing' ? String(snapshot.runSerial) : '';
      if (snapshot.phase === 'playing' && nextToken !== this.loadedToken) {
        this.scene.restart({ token: nextToken });
        return;
      }

      this.emitHud(snapshot.phase === 'playing' ? 'live' : 'paused');
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribe?.();
      this.unsubscribe = undefined;
    });
  }

  private ensureEffectTextures(): void {
    if (!this.textures.exists('bullet-shell')) {
      const g = this.add.graphics();
      g.fillStyle(0xffffff, 1);
      g.fillRoundedRect(0, 0, 12, 6, 3);
      g.generateTexture('bullet-shell', 12, 6);
      g.clear();
      g.fillStyle(0xfff2c4, 1);
      g.fillTriangle(26, 8, 16, 2, 16, 14);
      g.fillStyle(0xdce5df, 1);
      g.fillRoundedRect(4, 4, 15, 8, 4);
      g.fillStyle(0xff845f, 1);
      g.fillTriangle(4, 4, 0, 0, 0, 8);
      g.fillTriangle(4, 12, 0, 16, 0, 8);
      g.fillStyle(0x323b37, 1);
      g.fillRect(11, 6, 7, 4);
      g.generateTexture('projectile-missile', 28, 16);
      g.clear();
      g.fillStyle(0xffffff, 1);
      g.fillCircle(10, 10, 10);
      g.generateTexture('blast-circle', 20, 20);
      g.clear();
      g.fillStyle(0x071109, 0.88);
      g.fillRoundedRect(0, 0, 720, 132, 18);
      g.lineStyle(3, 0xefb648, 0.42);
      g.strokeRoundedRect(4, 4, 712, 124, 16);
      g.fillStyle(0xefb648, 0.12);
      for (let x = -80; x < 760; x += 46) {
        g.fillRect(x, 0, 14, 132);
      }
      g.generateTexture('objective-plaque', 720, 132);
      g.destroy();
    }
  }

  private createAnimations(): void {
    for (const sheet of ALL_SPRITE_SHEETS) {
      const key = animationKey(sheet.texture);
      if (this.anims.exists(key)) {
        continue;
      }

      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers(sheet.texture, { start: 0, end: sheet.frameEnd }),
        frameRate: sheet.frameRate,
        repeat: sheet.repeat,
      });
    }
  }

  private setupStandby(snapshot: SessionSnapshot): void {
    this.virtualGamepad.resetAll();
    const previewStage = this.getPreviewStage(snapshot);
    this.cameras.main.setBackgroundColor(previewStage.palette.sky);
    this.cameras.main.setBounds(0, 0, previewStage.worldWidth, previewStage.worldHeight);
    this.applyResponsiveCamera();
    this.drawBackdrop(previewStage, true);
    this.bannerText = this.add.text(64, 72, previewStage.codename, {
      fontFamily: 'Impact, Haettenschweiler, sans-serif',
      fontSize: '30px',
      color: '#f3e6bf',
      letterSpacing: 2,
    }).setScrollFactor(0).setDepth(30);

    this.reticleText = this.add.text(64, 112, previewStage.briefing, {
      fontFamily: 'Bahnschrift, Trebuchet MS, sans-serif',
      fontSize: '16px',
      color: '#d6d9cb',
      wordWrap: { width: 440 },
    }).setScrollFactor(0).setDepth(30);

    const previewSprite = this.add.sprite(250, previewStage.worldHeight * 0.58, 'player-run', 0);
    previewSprite.setScale(1.2);
    previewSprite.play(animationKey('player-run'));
    previewSprite.setRotation(0.08);
    previewSprite.setDepth(10);

    const previewBoss = this.add.sprite(520, previewStage.worldHeight * 0.4, getBossTextureKey(previewStage.boss.kind), 0);
    previewBoss.setDepth(10);
    previewBoss.setFrame(0);
    previewBoss.setScale(0.92);

    this.emitHud('standby');
  }

  private setupStage(snapshot: SessionSnapshot): void {
    this.playing = false;
    this.virtualGamepad.resetAll();
    this.stage = snapshot.currentStage;
    this.shadowSquadMode = snapshot.playerCount === 2;
    this.players = [];
    this.allies = [];
    this.rescueBunkers = [];
    this.enemies = [];
    this.bosses = [];
    this.vehicles = [];
    this.boss = undefined;
    this.encounterStates = this.stage.encounters.map((config) => ({
      config,
      triggered: false,
      cleared: false,
      remaining: 0,
    }));
    this.encounterCount = 0;
    this.activeEncounterLabel = 'Advance to the next kill zone';
    this.allEncountersCleared = false;
    this.bossSpawned = false;
    this.hudTimestamp = 0;
    this.nextVisionConeDrawAt = 0;
    this.spawnDoors.clear();

    this.children.removeAll();
    this.bannerText = undefined;
    this.reticleText = undefined;
    this.objectivePanel = undefined;
    this.visionGraphics = undefined;
    this.physics.world.colliders.destroy();
    this.physics.resume();
    this.physics.world.setBounds(0, 0, this.stage.worldWidth, this.stage.worldHeight);
    this.cameras.main.setBounds(0, 0, this.stage.worldWidth, this.stage.worldHeight);
    this.applyResponsiveCamera();
    this.cameras.main.setBackgroundColor(this.stage.palette.sky);
    this.drawBackdrop(this.stage, false);

    this.playerGroup = this.physics.add.group();
    this.allyGroup = this.physics.add.group();
    this.enemyGroup = this.physics.add.group();
    this.bossGroup = this.physics.add.group();
    this.playerBullets = this.physics.add.group();
    this.enemyBullets = this.physics.add.group();
    this.weaponPickups = this.physics.add.staticGroup();
    this.healthPickups = this.physics.add.staticGroup();
    this.airStrikePickups = this.physics.add.staticGroup();
    this.supplyCrates = this.physics.add.staticGroup();
    this.rescueBunkerGroup = this.physics.add.staticGroup();
    this.vehicleGroup = this.physics.add.group();
    this.obstacleBodies = [];
    this.bulletTravelBounds.setTo(-80, -80, this.stage.worldWidth + 160, this.stage.worldHeight + 160);
    this.bulletZones = [];
    this.terrainZones = [];
    this.cameraTarget = this.add.zone(140, this.stage.worldHeight * 0.5, 4, 4);
    this.cameras.main.startFollow(this.cameraTarget, true, 0.08, 0.08);
    this.cameras.main.setDeadzone(140, 120);

    this.createTerrainZones(this.stage);
    this.createBulletEffectZones(this.stage);
    this.createObstacles(this.stage);
    this.createStageBoundaryWalls(this.stage);
    this.createBattlefieldCover(this.stage);
    this.createSupplyCrates(this.stage);
    this.createWeaponPickups(this.stage);
    this.createHealthPickups(this.stage);
    this.createAirStrikePickups(this.stage);
    this.createVehicles(this.stage);
    this.createRescueBunkers(this.stage);
    this.visionGraphics = this.add.graphics();
    this.visionGraphics.setDepth(3);
    this.createPlayers(this.shadowSquadMode ? 1 : snapshot.playerCount, snapshot.difficulty);
    this.setupColliders();
    this.createOverlayText();

    this.showBanner(this.shadowSquadMode ? `${this.stage.codename} shadow rescue` : `${this.stage.codename} deployed`, '#f3e6bf');
    this.playing = true;
    this.emitHud('live');
  }

  private drawBackdrop(stage: StageConfig, standby: boolean): void {
    const background = this.add.graphics();
    const drawHeight = Math.max(stage.worldHeight, this.getVisibleWorldHeight());
    background.setDepth(-40);
    background.fillStyle(stage.palette.ground, 1);
    background.fillRect(0, 0, stage.worldWidth, drawHeight);

    background.fillStyle(stage.palette.shadow, 0.26);
    for (let index = 0; index < 20; index += 1) {
      const width = 90 + (index % 4) * 50;
      const height = 90 + (index % 5) * 24;
      const x = 100 + index * 135;
      const y = 100 + (index % 6) * 120;
      background.fillEllipse(x, y, width, height);
    }

    background.fillStyle(stage.palette.accent, 0.08);
    for (let index = 0; index < 18; index += 1) {
      background.fillRect(index * 170, 0, 8, drawHeight);
    }

    if (stage.palette.water) {
      background.fillStyle(stage.palette.water, 0.82);
      background.fillRect(stage.worldWidth * 0.33, 0, stage.worldWidth * 0.16, drawHeight);
      background.fillStyle(0xffffff, 0.06);
      for (let index = 0; index < 18; index += 1) {
        background.fillRect(stage.worldWidth * 0.33, 40 + index * 52, stage.worldWidth * 0.16, 14);
      }
    }

    if (standby) {
      background.fillStyle(0x000000, 0.18);
      background.fillRect(0, 0, stage.worldWidth, drawHeight);
    }
  }

  private createObstacles(stage: StageConfig): void {
    for (const obstacle of stage.obstacles) {
      const rect = this.add.rectangle(
        obstacle.x,
        obstacle.y,
        obstacle.width,
        obstacle.height,
        obstacle.tint ?? stage.palette.obstacle,
        obstacle.alpha ?? 0.95,
      );
      rect.setStrokeStyle(2, stage.palette.accent, 0.24);
      rect.setDepth(4);
      rect.setData('vehiclePassableObstacle', true);
      this.registerObstacle(rect);
    }
  }

  private createStageBoundaryWalls(stage: StageConfig): void {
    const thickness = 28;
    const walls = [
      { x: stage.worldWidth * 0.5, y: thickness * 0.5, width: stage.worldWidth, height: thickness, label: 'TOP WALL' },
      { x: stage.worldWidth * 0.5, y: stage.worldHeight - thickness * 0.5, width: stage.worldWidth, height: thickness, label: 'BOTTOM WALL' },
      { x: thickness * 0.5, y: stage.worldHeight * 0.5, width: thickness, height: stage.worldHeight, label: 'LEFT WALL' },
      { x: stage.worldWidth - thickness * 0.5, y: stage.worldHeight * 0.5, width: thickness, height: stage.worldHeight, label: 'RIGHT WALL' },
    ];

    for (const wall of walls) {
      const rect = this.add.rectangle(wall.x, wall.y, wall.width, wall.height, 0x2c3527, 0.96);
      rect.setDepth(8);
      rect.setStrokeStyle(2, 0xf2d277, 0.58);
      this.registerObstacle(rect);
    }

    this.add.text(stage.worldWidth * 0.5, stage.worldHeight - thickness - 10, 'WALL - END OF PLAY AREA', {
      fontFamily: 'Impact, Haettenschweiler, sans-serif',
      fontSize: '24px',
      color: '#fff2c4',
      stroke: '#09100b',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(9).setAlpha(0.76);
  }

  private createTerrainZones(stage: StageConfig): void {
    const waterTint = stage.palette.water ?? 0x1f5867;
    const zones: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
      effect: TerrainEffect;
      label: string;
      level: number;
      tint: number;
      alpha: number;
    }> = [
      {
        x: Math.floor(stage.worldWidth * 0.24),
        y: Math.floor(stage.worldHeight * 0.72),
        width: 340,
        height: 150,
        effect: 'water',
        label: 'SLOW',
        level: -1,
        tint: waterTint,
        alpha: 0.32,
      },
      {
        x: Math.floor(stage.worldWidth * 0.54),
        y: Math.floor(stage.worldHeight * 0.62),
        width: 330,
        height: 180,
        effect: 'high',
        label: 'HIGH +2',
        level: 2,
        tint: 0xb8873a,
        alpha: 0.25,
      },
      {
        x: Math.floor(stage.worldWidth * 0.78),
        y: Math.floor(stage.worldHeight * 0.34),
        width: 360,
        height: 170,
        effect: 'high',
        label: 'RIDGE +3',
        level: 3,
        tint: 0xd3a54b,
        alpha: 0.28,
      },
    ];

    if (stage.id.includes('river')) {
      zones.push(
        {
          x: Math.floor(stage.worldWidth * 0.38),
          y: Math.floor(stage.worldHeight * 0.33),
          width: 440,
          height: 120,
          effect: 'water',
          label: 'RIVER',
          level: -1,
          tint: waterTint,
          alpha: 0.3,
        },
        {
          x: Math.floor(stage.worldWidth * 0.68),
          y: Math.floor(stage.worldHeight * 0.78),
          width: 520,
          height: 135,
          effect: 'water',
          label: 'SLOW',
          level: -1,
          tint: waterTint,
          alpha: 0.34,
        },
      );
    }

    if (stage.id.includes('dust') || stage.id.includes('mesa')) {
      zones.push(
        {
          x: Math.floor(stage.worldWidth * 0.36),
          y: Math.floor(stage.worldHeight * 0.28),
          width: 370,
          height: 150,
          effect: 'high',
          label: 'MESA +2',
          level: 2,
          tint: 0xd29a4a,
          alpha: 0.28,
        },
        {
          x: Math.floor(stage.worldWidth * 0.62),
          y: Math.floor(stage.worldHeight * 0.43),
          width: 420,
          height: 150,
          effect: 'high',
          label: 'HIGH +3',
          level: 3,
          tint: 0xe0b15f,
          alpha: 0.29,
        },
      );
    }

    if (stage.id.includes('underground') || stage.id.includes('catacombs') || stage.id.includes('burrow')) {
      zones.push(
        {
          x: Math.floor(stage.worldWidth * 0.34),
          y: Math.floor(stage.worldHeight * 0.38),
          width: 210,
          height: 150,
          effect: 'hole',
          label: 'HOLE',
          level: -2,
          tint: 0x080907,
          alpha: 0.48,
        },
        {
          x: Math.floor(stage.worldWidth * 0.58),
          y: Math.floor(stage.worldHeight * 0.76),
          width: 250,
          height: 165,
          effect: 'hole',
          label: 'SINK',
          level: -2,
          tint: 0x090a08,
          alpha: 0.5,
        },
        {
          x: Math.floor(stage.worldWidth * 0.82),
          y: Math.floor(stage.worldHeight * 0.42),
          width: 220,
          height: 150,
          effect: 'hole',
          label: 'HOLE',
          level: -2,
          tint: 0x090a08,
          alpha: 0.46,
        },
      );
    }

    for (const zone of zones) {
      const bounds = new Phaser.Geom.Rectangle(
        zone.x - zone.width * 0.5,
        zone.y - zone.height * 0.5,
        zone.width,
        zone.height,
      );
      this.terrainZones.push({
        bounds,
        effect: zone.effect,
        label: zone.label,
        height: zone.level,
      });

      const panel = this.add.rectangle(zone.x, zone.y, zone.width, zone.height, zone.tint, zone.alpha);
      panel.setDepth(-12);
      panel.setStrokeStyle(3, zone.tint, 0.72);

      if (zone.effect === 'high') {
        panel.setAngle(-2);
        for (let index = 0; index < 4; index += 1) {
          this.add.rectangle(
            zone.x - zone.width * 0.35 + index * (zone.width * 0.22),
            zone.y + zone.height * 0.28,
            zone.width * 0.22,
            5,
            0x3c2814,
            0.32,
          ).setDepth(-11).setAngle(-2);
        }
      }

      if (zone.effect === 'water') {
        for (let index = 0; index < 5; index += 1) {
          this.add.rectangle(
            bounds.x + 36 + index * 62,
            zone.y + Math.sin(index) * 18,
            48,
            5,
            0xb9f7ff,
            0.26,
          ).setDepth(-11);
        }
      }

      if (zone.effect === 'hole') {
        panel.setAngle(Phaser.Math.Between(-3, 3));
        for (let index = 0; index < 4; index += 1) {
          this.add.circle(
            zone.x + Phaser.Math.Between(-Math.floor(zone.width * 0.32), Math.floor(zone.width * 0.32)),
            zone.y + Phaser.Math.Between(-Math.floor(zone.height * 0.28), Math.floor(zone.height * 0.28)),
            Phaser.Math.Between(10, 22),
            0x000000,
            0.3,
          ).setDepth(-11);
        }
      }

      this.add.text(zone.x, zone.y, zone.label, {
        fontFamily: 'Impact, Haettenschweiler, sans-serif',
        fontSize: zone.effect === 'water' ? '34px' : '30px',
        color: '#fff2c4',
        stroke: '#061008',
        strokeThickness: 5,
      }).setOrigin(0.5).setDepth(-10).setAlpha(0.88);
    }
  }

  private createBulletEffectZones(stage: StageConfig): void {
    const zones: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
      effect: BulletZoneEffect;
      label: string;
      tint: number;
    }> = [
      {
        x: Math.floor(stage.worldWidth * 0.29),
        y: Math.floor(stage.worldHeight * 0.5),
        width: 260,
        height: 300,
        effect: 'drag',
        label: 'DROP',
        tint: 0x2e8cff,
      },
      {
        x: Math.floor(stage.worldWidth * 0.48),
        y: Math.floor(stage.worldHeight * 0.34),
        width: 300,
        height: 240,
        effect: 'crosswind',
        label: 'WIND',
        tint: 0x93f1a5,
      },
      {
        x: Math.floor(stage.worldWidth * 0.69),
        y: Math.floor(stage.worldHeight * 0.58),
        width: 320,
        height: 280,
        effect: 'boost',
        label: 'BOOST',
        tint: 0xf4d35e,
      },
    ];

    for (const zone of zones) {
      const bounds = new Phaser.Geom.Rectangle(
        zone.x - zone.width * 0.5,
        zone.y - zone.height * 0.5,
        zone.width,
        zone.height,
      );
      this.bulletZones.push({
        bounds,
        effect: zone.effect,
        label: zone.label,
      });

      const panel = this.add.rectangle(zone.x, zone.y, zone.width, zone.height, zone.tint, 0.09);
      panel.setDepth(-6);
      panel.setStrokeStyle(3, zone.tint, 0.58);

      this.add.text(zone.x, zone.y, zone.label, {
        fontFamily: 'Impact, Haettenschweiler, sans-serif',
        fontSize: '30px',
        color: '#fff2c4',
        stroke: '#061008',
        strokeThickness: 5,
      }).setOrigin(0.5).setDepth(-5).setAlpha(0.84);
    }
  }

  private createBattlefieldCover(stage: StageConfig): void {
    for (const encounter of stage.encounters) {
      encounter.enemies.forEach((spawn, index) => {
        const doorSide = index % 2 === 0 ? -1 : 1;
        const bunker = spawn.kind === 'turret' || index % 4 === 3;
        const width = bunker ? 76 : 50;
        const height = bunker ? 34 : 34;
        const housePosition = this.findOpenCoverSpot(
          spawn.x + doorSide * Phaser.Math.Between(42, 74),
          Phaser.Math.Clamp(spawn.y + Phaser.Math.Between(-28, 28), 90, stage.worldHeight - 90),
          width,
          height,
          stage,
          12,
        );

        if (!housePosition) {
          return;
        }

        const house = this.createBlocker(
          housePosition.x,
          housePosition.y,
          width,
          height,
          bunker ? 0x777f86 : 0x5c4327,
          bunker ? 0.96 : 0.9,
          bunker ? 'BUNKER' : 'HUT',
        );
        const doorX = housePosition.x - doorSide * (width * 0.52);
        this.spawnDoors.set(spawn.id, {
          x: doorX,
          y: housePosition.y,
          house,
        });
      });
    }

    const treeCount = stage.theme === 'blacksite' ? 10 : 18;
    for (let index = 0; index < treeCount; index += 1) {
      const x = 220 + index * 135 + (index % 3) * 34;
      if (x > stage.bossTriggerX - 120) {
        continue;
      }

      const y = index % 2 === 0
        ? 120 + (index % 5) * 118
        : stage.worldHeight - 120 - (index % 5) * 110;
      const treePosition = this.findOpenCoverSpot(x, Phaser.Math.Clamp(y, 80, stage.worldHeight - 80), 62, 72, stage, 16);
      if (treePosition) {
        this.createTreeCover(treePosition.x, treePosition.y, stage);
      }
    }

    for (let index = 0; index < 8; index += 1) {
      const x = 520 + index * 285;
      const y = index % 2 === 0 ? stage.worldHeight * 0.28 : stage.worldHeight * 0.74;
      const width = index % 3 === 0 ? 116 : 86;
      const height = index % 3 === 0 ? 26 : 34;
      const concretePosition = this.findOpenCoverSpot(x, y, width, height, stage, 18);
      if (concretePosition) {
        this.createBlocker(concretePosition.x, concretePosition.y, width, height, 0x6f777b, 0.98, index % 2 === 0 ? 'COVER' : undefined);
      }
    }
  }

  private createSupplyCrates(stage: StageConfig): void {
    const stageNumber = this.getStageNumber(stage);
    const crates = [
      { x: Math.floor(stage.worldWidth * 0.22), y: stage.worldHeight * 0.5 - 214 + stageNumber * 7 },
      { x: Math.floor(stage.worldWidth * 0.46), y: stage.worldHeight * 0.5 + 196 - stageNumber * 9 },
      { x: Math.floor(stage.worldWidth * 0.72), y: stage.worldHeight * 0.5 - 206 + (stageNumber % 4) * 18 },
    ];

    for (const [index, crate] of crates.entries()) {
      const position = this.findOpenCoverSpot(crate.x, crate.y, 46, 34, stage, 16) ?? crate;
      this.createBreakableSupplyCrate(position.x, position.y, stage, index);
    }
  }

  private createBreakableSupplyCrate(x: number, y: number, stage: StageConfig, index: number): void {
    const crate = this.add.rectangle(x, y, 46, 34, 0x8a623c, 0.96);
    crate.setDepth(8);
    crate.setStrokeStyle(2, 0xffe6a8, 0.42);
    crate.setData('stageId', stage.id);
    crate.setData('crateIndex', index);
    this.physics.add.existing(crate, true);
    this.supplyCrates?.add(crate);

    const trimTint = index % 2 === 0 ? 0x4a3320 : 0x5d4026;
    const strapA = this.add.rectangle(x, y, 7, 34, trimTint, 0.8).setDepth(9);
    const strapB = this.add.rectangle(x, y, 46, 5, 0xf0cb77, 0.42).setDepth(9);
    const shine = this.add.rectangle(x - 12, y - 9, 18, 4, 0xffefbd, 0.22).setDepth(9).setAngle(-8);
    const stamp = this.add.text(x + 10, y + 4, '?', {
      fontFamily: 'Impact, Haettenschweiler, sans-serif',
      fontSize: '19px',
      color: '#21140b',
      stroke: '#ffe6a8',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(10);
    crate.setData('linkedObjects', [strapA, strapB, shine, stamp]);
  }

  private findOpenCoverSpot(
    x: number,
    y: number,
    width: number,
    height: number,
    stage: StageConfig,
    padding: number,
  ): { x: number; y: number } | undefined {
    const offsets = [
      [0, 0],
      [0, -92],
      [0, 92],
      [-104, 0],
      [104, 0],
      [-86, -72],
      [86, 72],
      [86, -72],
      [-86, 72],
    ] as const;

    for (const [offsetX, offsetY] of offsets) {
      const candidateX = Phaser.Math.Clamp(x + offsetX, width * 0.5 + 24, stage.worldWidth - width * 0.5 - 24);
      const candidateY = Phaser.Math.Clamp(y + offsetY, height * 0.5 + 40, stage.worldHeight - height * 0.5 - 40);
      if (this.canPlaceRect(candidateX, candidateY, width, height, padding)) {
        return { x: candidateX, y: candidateY };
      }
    }

    return undefined;
  }

  private canPlaceRect(x: number, y: number, width: number, height: number, padding = 12): boolean {
    const candidate = new Phaser.Geom.Rectangle(
      x - width * 0.5 - padding,
      y - height * 0.5 - padding,
      width + padding * 2,
      height + padding * 2,
    );

    return this.obstacleBodies.every((obstacle) => !Phaser.Geom.Rectangle.Overlaps(candidate, obstacle.getBounds()));
  }

  private createBlocker(
    x: number,
    y: number,
    width: number,
    height: number,
    tint: number,
    alpha: number,
    label?: string,
  ): Phaser.GameObjects.Rectangle {
    const rimPadding = 8;
    const blockerWidth = width + rimPadding * 2;
    const blockerHeight = height + rimPadding * 2;
    const rect = this.add.rectangle(x, y, blockerWidth, blockerHeight, tint, alpha);
    rect.setDepth(5);
    const isConcrete = tint === 0x6f777b || tint === 0x777f86;
    const darkEdge = isConcrete ? 0x242b2f : 0x2a1b10;
    const lightEdge = isConcrete ? 0xb8c2c6 : 0xd1a56a;
    rect.setStrokeStyle(5, darkEdge, 0.62);
    const destructible = label === 'HUT' || label === 'BUNKER';
    rect.setData('destructibleObstacle', destructible);
    rect.setData('coverHp', label === 'BUNKER' ? 70 : 30);
    rect.setData('coverLabel', label ?? (isConcrete ? 'CONCRETE' : 'COVER'));
    this.registerObstacle(rect);

    const linkedObjects: Phaser.GameObjects.GameObject[] = [];
    const shadow = this.add.rectangle(x + 6, y + 7, blockerWidth * 0.98, blockerHeight * 0.88, 0x000000, 0.18).setDepth(4);
    linkedObjects.push(shadow);
    const topBevel = this.add.rectangle(x, y - blockerHeight * 0.5 + 4, Math.max(8, blockerWidth - 8), 7, lightEdge, 0.42);
    topBevel.setDepth(6);
    const leftBevel = this.add.rectangle(x - blockerWidth * 0.5 + 4, y, 7, Math.max(8, blockerHeight - 8), lightEdge, 0.22);
    leftBevel.setDepth(6);
    const bottomLip = this.add.rectangle(x, y + blockerHeight * 0.5 - 4, Math.max(8, blockerWidth - 8), 7, darkEdge, 0.42);
    bottomLip.setDepth(6);
    const rightLip = this.add.rectangle(x + blockerWidth * 0.5 - 4, y, 7, Math.max(8, blockerHeight - 8), darkEdge, 0.34);
    rightLip.setDepth(6);
    linkedObjects.push(topBevel, leftBevel, bottomLip, rightLip);
    const faceHighlight = this.add.rectangle(x, y, Math.max(8, width - 18), Math.max(8, height - 18), 0xffffff, isConcrete ? 0.035 : 0.045).setDepth(5);
    const brightScuff = this.add.rectangle(x - width * 0.18, y - height * 0.18, width * 0.46, Math.max(4, height * 0.16), 0xffffff, 0.08)
      .setDepth(6)
      .setAngle(-3);
    const darkScuff = this.add.rectangle(x + width * 0.22, y + height * 0.18, width * 0.38, Math.max(4, height * 0.13), 0x10130f, 0.14)
      .setDepth(6)
      .setAngle(4);
    linkedObjects.push(faceHighlight, brightScuff, darkScuff);
    const crackTint = tint === 0x6f777b || tint === 0x777f86 ? 0x30363a : 0x372615;
    for (let index = 0; index < 3; index += 1) {
      const crack = this.add.rectangle(
        x + Phaser.Math.Between(-Math.floor(width * 0.32), Math.floor(width * 0.32)),
        y + Phaser.Math.Between(-Math.floor(height * 0.28), Math.floor(height * 0.28)),
        Phaser.Math.Between(14, Math.max(16, Math.floor(width * 0.32))),
        3,
        crackTint,
        0.3,
      ).setDepth(6).setAngle(Phaser.Math.Between(-28, 28));
      linkedObjects.push(crack);
    }

    if (label) {
      const labelObject = this.add.text(x, y - 5, label, {
        fontFamily: 'Bahnschrift, Trebuchet MS, sans-serif',
        fontSize: '9px',
        color: '#efe4c3',
      }).setOrigin(0.5).setDepth(6).setAlpha(0.62);
      linkedObjects.push(labelObject);
    }

    rect.setData('linkedObjects', linkedObjects);
    return rect;
  }

  private createTreeCover(x: number, y: number, stage: StageConfig): void {
    this.add.ellipse(x + 6, y + 18, 76, 46, 0x071009, 0.22).setDepth(4);
    const trunk = this.add.rectangle(x, y + 10, 34, 66, 0x4c321e, 0.48);
    trunk.setDepth(5);
    trunk.setStrokeStyle(2, 0x2b1b11, 0.5);
    this.registerObstacle(trunk);

    const canopyTint = stage.theme === 'river' ? 0x2d6d42 : 0x2f7b35;
    for (const [offsetX, offsetY, radius, alpha] of [[0, -24, 38, 0.82], [-27, -9, 27, 0.76], [27, -8, 28, 0.78], [-10, 12, 28, 0.72], [15, 12, 30, 0.72]] as const) {
      this.add.circle(x + offsetX, y + offsetY, radius, canopyTint, 0.78)
        .setDepth(6)
        .setStrokeStyle(2, 0x153f1d, 0.4);
      this.add.circle(x + offsetX - radius * 0.18, y + offsetY - radius * 0.22, radius * 0.34, 0x68a75c, alpha * 0.35)
        .setDepth(7);
    }
    this.add.rectangle(x - 9, y + 7, 5, 54, 0x735236, 0.48).setDepth(6).setAngle(-5);
    this.add.rectangle(x + 12, y + 12, 4, 48, 0x2a190f, 0.36).setDepth(6).setAngle(7);
    this.add.rectangle(x - 18, y + 43, 30, 5, 0x3a2415, 0.42).setDepth(6).setAngle(-16);
    this.add.rectangle(x + 20, y + 44, 28, 5, 0x3a2415, 0.38).setDepth(6).setAngle(18);
  }

  private createWeaponPickups(stage: StageConfig): void {
    const stageNumber = this.getStageNumber(stage);
    const yJitter = ((stageNumber % 3) - 1) * 34;
    const xJitter = (stageNumber % 2 === 0 ? 1 : -1) * 38;
    const pickups: Array<{ kind: WeaponKind; x: number; y: number }> = [
      { kind: 'shotgun', x: 390 + xJitter, y: stage.worldHeight * 0.5 + yJitter },
      { kind: 'flame', x: Math.floor(stage.worldWidth * 0.4) - xJitter, y: stage.worldHeight * 0.5 - 128 - yJitter },
      { kind: 'machineGun', x: Math.floor(stage.worldWidth * 0.45) + xJitter, y: stage.worldHeight * 0.5 + 96 + yJitter },
      { kind: 'throwBomb', x: Math.floor(stage.worldWidth * 0.49) - xJitter, y: stage.worldHeight * 0.5 - 18 - yJitter },
      { kind: 'sniper', x: Math.floor(stage.worldWidth * 0.53) + xJitter, y: stage.worldHeight * 0.5 + 130 - yJitter },
      { kind: 'poisonBomb', x: Math.floor(stage.worldWidth * 0.57) - xJitter, y: stage.worldHeight * 0.5 - 178 + yJitter },
      { kind: 'explosiveArrow', x: Math.floor(stage.worldWidth * 0.61) + xJitter, y: stage.worldHeight * 0.5 - 120 - yJitter },
      { kind: 'missile', x: Math.floor(stage.worldWidth * 0.65) - xJitter, y: stage.worldHeight * 0.5 - 42 + yJitter },
      { kind: 'launcher', x: Math.floor(stage.worldWidth * 0.69) + xJitter, y: stage.worldHeight * 0.5 + 122 - yJitter },
      { kind: 'laser', x: Math.floor(stage.worldWidth * 0.76) - xJitter, y: stage.worldHeight * 0.5 - 126 + yJitter },
    ];

    for (const pickup of pickups) {
      const position = this.findOpenCoverSpot(pickup.x, pickup.y, 52, 34, stage, 12) ?? pickup;
      this.createWeaponPickupCrate(pickup.kind, position.x, position.y, stage.id);
    }
  }

  private createWeaponPickupCrate(kind: WeaponKind, x: number, y: number, stageId: string): void {
    const spec = WEAPONS[kind];
    const crate = this.add.rectangle(x, y, 58, 40, spec.tint, 0.92);
    crate.setDepth(9);
    crate.setStrokeStyle(3, 0xffffff, 0.38);
    crate.setData('weaponKind', kind);
    crate.setData('respawnX', x);
    crate.setData('respawnY', y);
    crate.setData('stageId', stageId);
    this.physics.add.existing(crate, true);
    this.weaponPickups?.add(crate);

    const shadow = this.add.rectangle(x + 3, y + 4, 52, 30, 0x000000, 0.18).setDepth(8);
    const lid = this.add.rectangle(x, y - 12, 52, 8, 0xffffff, 0.2).setDepth(10);
    const leftStrap = this.add.rectangle(x - 19, y, 5, 34, 0x15150f, 0.32).setDepth(10);
    const rightStrap = this.add.rectangle(x + 19, y, 5, 34, 0x15150f, 0.32).setDepth(10);
    const cornerA = this.add.rectangle(x - 20, y - 13, 10, 5, 0xfff6cf, 0.5).setDepth(10);
    const cornerB = this.add.rectangle(x + 20, y + 13, 10, 5, 0x0b0f0c, 0.28).setDepth(10);
    const iconBack = this.add.rectangle(x, y, 30, 25, 0xfff2c4, 0.86).setDepth(10);
    iconBack.setStrokeStyle(1, 0x11180f, 0.35);
    const label = this.add.text(x, y - 1, this.getWeaponIcon(kind), {
      fontFamily: 'Impact, Haettenschweiler, sans-serif',
      fontSize: '27px',
      color: '#09100b',
      stroke: '#fff6c8',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(11);
    crate.setData('labelObject', label);
    crate.setData('linkedObjects', [shadow, lid, leftStrap, rightStrap, cornerA, cornerB, iconBack, label]);
  }

  private getWeaponIcon(kind: WeaponKind): string {
    const icons: Record<WeaponKind, string> = {
      rifle: 'R',
      shotgun: 'S',
      flame: 'F',
      launcher: 'L',
      sniper: 'N',
      explosiveArrow: 'A',
      missile: 'M!',
      laser: 'Z',
      machineGun: 'M',
      throwBomb: 'B',
      poisonBomb: 'P',
    };

    return icons[kind];
  }

  private createHealthPickups(stage: StageConfig): void {
    const stageNumber = this.getStageNumber(stage);
    const offset = (stageNumber - 3) * 18;
    const pickups = [
      { x: Math.floor(stage.worldWidth * (0.32 + (stageNumber % 3) * 0.025)), y: stage.worldHeight * 0.5 - 160 + offset },
      { x: Math.floor(stage.worldWidth * (0.7 + (stageNumber % 2) * 0.035)), y: stage.worldHeight * 0.5 + 150 - offset },
    ];

    for (const pickup of pickups) {
      const position = this.findOpenCoverSpot(pickup.x, pickup.y, 44, 44, stage, 12) ?? pickup;
      this.createHealthPickupBox(position.x, position.y, 35);
    }
  }

  private createHealthPickupBox(x: number, y: number, healAmount: number): void {
    const box = this.add.rectangle(x, y, 44, 44, 0xf5efe2, 0.96);
    box.setDepth(9);
    box.setStrokeStyle(3, 0xb01818, 0.86);
    box.setData('healAmount', healAmount);
    this.physics.add.existing(box, true);
    this.healthPickups?.add(box);

    const shadow = this.add.rectangle(x + 3, y + 4, 36, 34, 0x000000, 0.12).setDepth(8);
    const lid = this.add.rectangle(x, y - 14, 34, 5, 0xffffff, 0.32).setDepth(10);
    const crossH = this.add.rectangle(x, y, 30, 9, 0xd51f1f, 1).setDepth(10);
    const crossV = this.add.rectangle(x, y, 9, 30, 0xd51f1f, 1).setDepth(10);
    const latch = this.add.rectangle(x + 16, y + 14, 8, 5, 0x921313, 0.86).setDepth(10);
    box.setData('linkedObjects', [shadow, lid, crossH, crossV, latch]);
  }

  private createAirStrikePickups(stage: StageConfig): void {
    const stageNumber = this.getStageNumber(stage);
    const yJitter = ((stageNumber % 4) - 1.5) * 28;
    const pickups = [
      { x: Math.floor(stage.worldWidth * 0.36), y: stage.worldHeight * 0.5 + 202 + yJitter },
      { x: Math.floor(stage.worldWidth * 0.73), y: stage.worldHeight * 0.5 - 192 - yJitter },
    ];

    for (const pickup of pickups) {
      const position = this.findOpenCoverSpot(pickup.x, pickup.y, 54, 42, stage, 16) ?? pickup;
      this.createAirStrikeCallBox(position.x, position.y, 2);
    }
  }

  private createAirStrikeCallBox(x: number, y: number, bombCount: number): void {
    const box = this.add.rectangle(x, y, 56, 42, 0x78d8ff, 0.94);
    box.setDepth(9);
    box.setStrokeStyle(3, 0xffffff, 0.54);
    box.setData('bombCount', bombCount);
    this.physics.add.existing(box, true);
    this.airStrikePickups?.add(box);

    const shadow = this.add.rectangle(x + 3, y + 4, 50, 30, 0x000000, 0.16).setDepth(8);
    const antenna = this.add.rectangle(x + 17, y - 18, 5, 18, 0xe9fbff, 0.88).setDepth(10).setAngle(-18);
    const signalA = this.add.circle(x + 21, y - 27, 5, 0xe9fbff, 0.24).setDepth(10);
    const signalB = this.add.circle(x + 21, y - 27, 11, 0xe9fbff, 0.16).setDepth(10);
    const screen = this.add.rectangle(x, y, 35, 24, 0x0b3344, 0.86).setDepth(10);
    screen.setStrokeStyle(2, 0xe9fbff, 0.54);
    const label = this.add.text(x, y - 1, 'AIR', {
      fontFamily: 'Impact, Haettenschweiler, sans-serif',
      fontSize: '22px',
      color: '#e9fbff',
      stroke: '#09202a',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(11);
    box.setData('linkedObjects', [shadow, antenna, signalA, signalB, screen, label]);
  }

  private createRescueBunkers(stage: StageConfig): void {
    if (!this.shadowSquadMode) {
      return;
    }

    const stageNumber = this.getStageNumber(stage);
    const bunkerSeeds = [
      { x: Math.floor(stage.worldWidth * 0.24), y: stage.worldHeight * 0.5 - 250 + stageNumber * 5 },
      { x: Math.floor(stage.worldWidth * 0.48), y: stage.worldHeight * 0.5 + 230 - stageNumber * 6 },
      { x: Math.floor(stage.worldWidth * 0.68), y: stage.worldHeight * 0.5 - 225 + (stageNumber % 3) * 20 },
      { x: Math.floor(stage.worldWidth * 0.82), y: stage.worldHeight * 0.5 + 205 - (stageNumber % 4) * 18 },
    ];

    for (const [index, seed] of bunkerSeeds.entries()) {
      const position = this.findOpenCoverSpot(seed.x, seed.y, 78, 50, stage, 18) ?? seed;
      this.createRescueBunker(`rescue-${stage.id}-${index}`, position.x, position.y);
    }
  }

  private createRescueBunker(id: string, x: number, y: number): void {
    const body = this.add.rectangle(x, y, 78, 50, 0x3f4547, 0.94);
    body.setDepth(8);
    body.setStrokeStyle(3, 0x9ed8ff, 0.46);
    body.setData('rescueBunkerId', id);
    body.setData('destructibleObstacle', true);
    body.setData('coverHp', 120);
    body.setData('coverLabel', 'RESCUE');
    this.physics.add.existing(body, true);
    this.rescueBunkerGroup?.add(body);
    this.obstacleBodies.push(body);

    const roof = this.add.rectangle(x, y - 21, 86, 10, 0x263034, 0.92).setDepth(9);
    const door = this.add.rectangle(x - 23, y + 6, 18, 28, 0x10181a, 0.92).setDepth(9);
    const light = this.add.circle(x + 26, y - 4, 8, 0x9ed8ff, 0.82).setDepth(10);
    const barsA = this.add.rectangle(x - 23, y + 6, 3, 26, 0x9aa8a8, 0.9).setDepth(10);
    const barsB = this.add.rectangle(x - 23, y + 6, 18, 3, 0x9aa8a8, 0.9).setDepth(10);
    const marker = this.add.text(x, y + 34, 'RESCUE', {
      fontFamily: 'Impact, Haettenschweiler, sans-serif',
      fontSize: '16px',
      color: '#dff7ff',
      stroke: '#102027',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(11);
    body.setData('linkedObjects', [roof, door, light, barsA, barsB, marker]);

    this.rescueBunkers.push({
      id,
      body,
      marker,
      rescued: false,
      linkedObjects: [roof, door, light, barsA, barsB],
    });
  }

  private createVehicles(stage: StageConfig): void {
    const stageNumber = this.getStageNumber(stage);
    const vehicles: Array<{ kind: VehicleKind; x: number; y: number }> = [
      { kind: 'jeep', x: Math.floor(stage.worldWidth * 0.16), y: stage.worldHeight * 0.5 + 92 },
      { kind: 'motorcycle', x: Math.floor(stage.worldWidth * 0.3), y: stage.worldHeight * 0.5 - 150 + stageNumber * 10 },
      { kind: 'tank', x: Math.floor(stage.worldWidth * 0.63), y: stage.worldHeight * 0.5 + 210 },
      { kind: 'jeep', x: Math.floor(stage.worldWidth * 0.78), y: stage.worldHeight * 0.5 - 170 },
      { kind: 'tank', x: Math.floor(stage.worldWidth * 0.86), y: stage.worldHeight * 0.5 + 150 },
      { kind: 'motorcycle', x: Math.floor(stage.worldWidth * 0.91), y: stage.worldHeight * 0.5 - 48 - stageNumber * 8 },
    ];

    for (const config of vehicles) {
      const spec = this.getVehicleSpec(config.kind);
      const position = this.findOpenCoverSpot(config.x, config.y, spec.width, spec.height, stage, 18) ?? config;
      const body = this.add.rectangle(position.x, position.y, spec.width, spec.height, spec.tint, 0.96);
      body.setDepth(10);
      body.setStrokeStyle(3, 0xf4e5b6, 0.42);
      body.setAlpha(0.2);
      this.physics.add.existing(body);
      const physicsBody = body.body as Phaser.Physics.Arcade.Body;
      physicsBody.setSize(spec.width, spec.height);
      physicsBody.setDrag(700, 700);
      physicsBody.setCollideWorldBounds(true);
      this.vehicleGroup?.add(body);

      const label = this.add.text(position.x, position.y - 4, spec.label, {
        fontFamily: 'Impact, Haettenschweiler, sans-serif',
        fontSize: config.kind === 'jeep' ? '21px' : '24px',
        color: '#fff2c4',
        stroke: '#11180f',
        strokeThickness: 4,
      }).setOrigin(0.5).setDepth(11);
      const hpLabel = this.add.text(position.x, position.y + spec.height * 0.5 + 10, `${spec.hp}/${spec.hp}`, {
        fontFamily: 'Bahnschrift, Trebuchet MS, sans-serif',
        fontSize: '13px',
        color: '#fff2c4',
        stroke: '#11180f',
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(11);

      const vehicle: VehicleUnit = {
        kind: config.kind,
        body,
        label,
        hpLabel,
        visualParts: [],
        passengerAllies: [],
        capacity: spec.capacity,
        hp: spec.hp,
        maxHp: spec.hp,
        speed: spec.speed,
        active: true,
        weaponShotsRemaining: spec.weaponShots,
        nextWeaponFireAt: 0,
        salvoShotsRemaining: 0,
        nextSalvoFireAt: 0,
        baseTint: spec.tint,
        brokenTint: spec.brokenTint,
        ammoLabel: spec.ammoLabel,
      };
      vehicle.visualParts = this.createVehicleVisualParts(vehicle, spec.tint, spec.brokenTint);
      this.syncVehicleVisuals(vehicle);
      body.setData('vehicle', vehicle);
      this.vehicles.push(vehicle);
    }
  }

  private createVehicleVisualParts(vehicle: VehicleUnit, baseTint: number, brokenTint: number): VehicleVisualPart[] {
    const parts: VehicleVisualPart[] = [];
    const addRect = (
      offsetX: number,
      offsetY: number,
      width: number,
      height: number,
      tint: number,
      alpha = 1,
      rotationOffset = 0,
      depth = 11,
      brokenPartTint = brokenTint,
    ): Phaser.GameObjects.Rectangle => {
      const rect = this.add.rectangle(vehicle.body.x, vehicle.body.y, width, height, tint, alpha);
      rect.setDepth(depth);
      rect.setStrokeStyle(1, 0xf7e7b4, 0.18);
      parts.push({ object: rect, offsetX, offsetY, rotationOffset, baseTint: tint, brokenTint: brokenPartTint, alpha });
      return rect;
    };
    const addCircle = (
      offsetX: number,
      offsetY: number,
      radius: number,
      tint: number,
      alpha = 1,
      depth = 11,
      brokenPartTint = brokenTint,
    ): Phaser.GameObjects.Arc => {
      const circle = this.add.circle(vehicle.body.x, vehicle.body.y, radius, tint, alpha);
      circle.setDepth(depth);
      circle.setStrokeStyle(2, 0x11140f, 0.55);
      parts.push({ object: circle, offsetX, offsetY, rotationOffset: 0, baseTint: tint, brokenTint: brokenPartTint, alpha });
      return circle;
    };

    if (vehicle.kind === 'motorcycle') {
      addCircle(-23, 0, 9, 0x171a16, 1, 10);
      addCircle(24, 0, 9, 0x171a16, 1, 10);
      addRect(0, 0, 42, 6, 0x2a2d25, 0.96, 0, 11);
      addRect(-5, -4, 20, 8, baseTint, 1, -0.08, 12);
      addRect(10, 4, 18, 5, 0xc9b28a, 0.86, 0.12, 12);
      addRect(27, -6, 16, 4, 0x34382f, 0.95, 0.32, 12);
      addRect(-22, 0, 12, 3, 0xd9d0a1, 0.75, 0.18, 12);
      addRect(30, 0, 10, 3, 0xf5e3a4, 0.78, 0, 12);
      return parts;
    }

    if (vehicle.kind === 'jeep') {
      addRect(0, 0, 72, 38, 0x2b321f, 0.98, 0, 10);
      addRect(10, 0, 42, 30, baseTint, 1, 0, 11);
      addRect(27, 0, 25, 24, 0x4d5a32, 1, 0, 12);
      addRect(-13, -2, 25, 24, 0x22291d, 0.96, 0, 12);
      addRect(-14, -8, 18, 8, 0x93bfd0, 0.72, 0, 13);
      addRect(-14, 8, 18, 8, 0x93bfd0, 0.56, 0, 13);
      addRect(39, 0, 10, 28, 0x191d14, 0.96, 0, 12);
      addRect(48, 0, 18, 5, 0xded08f, 0.92, 0, 13);
      addRect(4, -23, 17, 8, 0x171a13, 1, 0, 12);
      addRect(4, 23, 17, 8, 0x171a13, 1, 0, 12);
      addRect(-28, -23, 17, 8, 0x171a13, 1, 0, 12);
      addRect(-28, 23, 17, 8, 0x171a13, 1, 0, 12);
      addRect(24, -15, 16, 3, 0xe7dd9c, 0.42, -0.18, 13);
      addRect(24, 15, 16, 3, 0xe7dd9c, 0.42, 0.18, 13);
      return parts;
    }

    addRect(0, -25, 88, 12, 0x171a16, 1, 0, 10);
    addRect(0, 25, 88, 12, 0x171a16, 1, 0, 10);
    for (let tread = -32; tread <= 32; tread += 16) {
      addRect(tread, -25, 8, 12, 0x4b4f46, 0.92, 0, 11);
      addRect(tread, 25, 8, 12, 0x4b4f46, 0.92, 0, 11);
    }
    addRect(-5, 0, 74, 42, baseTint, 1, 0, 12);
    addRect(-18, 0, 28, 32, 0x69737c, 0.96, 0, 13);
    addCircle(12, 0, 17, 0x424a4f, 1, 14);
    addRect(42, 0, 52, 8, 0x343a3d, 1, 0, 15);
    addRect(68, 0, 13, 12, 0x252b2e, 1, 0, 15);
    addRect(-34, -12, 15, 7, 0xb5b891, 0.38, -0.15, 14);
    addRect(-34, 12, 15, 7, 0xb5b891, 0.32, 0.15, 14);
    addCircle(-5, 0, 7, 0x9ba2a2, 0.68, 15);
    return parts;
  }

  private createEnemyMountVisualParts(enemy: EnemyUnit): VehicleVisualPart[] {
    const mount = this.getEnemyMountKind(enemy.kind);
    if (!mount) {
      return [];
    }

    const parts: VehicleVisualPart[] = [];
    const baseTint = mount === 'tank' ? 0x715b42 : mount === 'jeep' ? 0x6b4d30 : 0x8a3d2d;
    const brokenTint = 0x241d18;
    const addRect = (offsetX: number, offsetY: number, width: number, height: number, tint: number, alpha = 1, rotationOffset = 0, depth = 10): void => {
      const rect = this.add.rectangle(enemy.sprite.x, enemy.sprite.y, width, height, tint, alpha);
      rect.setDepth(depth);
      rect.setStrokeStyle(1, 0xffdba5, 0.18);
      parts.push({ object: rect, offsetX, offsetY, rotationOffset, baseTint: tint, brokenTint, alpha });
    };
    const addCircle = (offsetX: number, offsetY: number, radius: number, tint: number, alpha = 1, depth = 10): void => {
      const circle = this.add.circle(enemy.sprite.x, enemy.sprite.y, radius, tint, alpha);
      circle.setDepth(depth);
      circle.setStrokeStyle(2, 0x11140f, 0.48);
      parts.push({ object: circle, offsetX, offsetY, rotationOffset: 0, baseTint: tint, brokenTint, alpha });
    };

    if (mount === 'motorcycle') {
      addCircle(-20, 3, 8, 0x171513, 1, 9);
      addCircle(21, 3, 8, 0x171513, 1, 9);
      addRect(0, 2, 38, 6, 0x2a221c, 0.96, 0, 10);
      addRect(-3, -4, 19, 8, baseTint, 1, -0.1, 11);
      addRect(12, 3, 15, 5, 0xc79a66, 0.78, 0.16, 11);
      addRect(25, -5, 13, 4, 0x302b24, 0.92, 0.26, 11);
      addRect(27, 1, 8, 3, 0xffd38a, 0.72, 0, 11);
    } else if (mount === 'jeep') {
      addRect(0, 0, 68, 35, 0x2c251c, 0.98, 0, 9);
      addRect(8, 0, 39, 27, baseTint, 1, 0, 10);
      addRect(-15, -2, 22, 21, 0x241c16, 0.94, 0, 11);
      addRect(-15, -8, 15, 7, 0x774d33, 0.72, 0, 12);
      addRect(37, 0, 16, 5, 0xffbd74, 0.82, 0, 12);
      addRect(6, -21, 16, 8, 0x15130f, 1, 0, 10);
      addRect(6, 21, 16, 8, 0x15130f, 1, 0, 10);
      addRect(-25, -21, 16, 8, 0x15130f, 1, 0, 10);
      addRect(-25, 21, 16, 8, 0x15130f, 1, 0, 10);
    } else {
      addRect(0, -23, 84, 11, 0x171513, 1, 0, 9);
      addRect(0, 23, 84, 11, 0x171513, 1, 0, 9);
      for (let tread = -30; tread <= 30; tread += 15) {
        addRect(tread, -23, 7, 11, 0x4c4338, 0.92, 0, 10);
        addRect(tread, 23, 7, 11, 0x4c4338, 0.92, 0, 10);
      }
      addRect(-4, 0, 70, 38, baseTint, 1, 0, 11);
      addCircle(10, 0, 15, 0x4a3d32, 1, 12);
      addRect(39, 0, 48, 7, 0x302a23, 1, 0, 13);
      addRect(65, 0, 12, 10, 0x211d19, 1, 0, 13);
    }

    this.syncVisualParts(enemy.sprite.x, enemy.sprite.y, enemy.sprite.rotation, parts);
    return parts;
  }

  private getEnemyMountKind(kind: EnemyKind): VehicleKind | undefined {
    if (kind === 'bikeRaider') {
      return 'motorcycle';
    }
    if (kind === 'jeepRaider') {
      return 'jeep';
    }
    if (kind === 'tankRaider') {
      return 'tank';
    }
    return undefined;
  }

  private isMountedEnemy(kind: EnemyKind): boolean {
    return this.getEnemyMountKind(kind) !== undefined;
  }

  private getStageNumber(stage: StageConfig): number {
    const match = stage.name.match(/\d+/);
    return match ? Number(match[0]) : 1;
  }

  private getVehicleSpec(kind: VehicleKind): {
    width: number;
    height: number;
    tint: number;
    brokenTint: number;
    hp: number;
    speed: number;
    label: string;
    weaponShots: number;
    ammoLabel: string;
    capacity: number;
  } {
    if (kind === 'motorcycle') {
      return { width: 62, height: 28, tint: 0x7a3e28, brokenTint: 0x2d211b, hp: 2, speed: 360, label: 'BIKE', weaponShots: 0, ammoLabel: 'FAST', capacity: 2 };
    }

    if (kind === 'jeep') {
      return { width: 74, height: 42, tint: 0x596334, brokenTint: 0x2d2a25, hp: 5, speed: 300, label: 'JEEP', weaponShots: 20, ammoLabel: 'SG', capacity: 6 };
    }

    return { width: 92, height: 54, tint: 0x53606a, brokenTint: 0x2d2a25, hp: 18, speed: 230, label: 'TANK', weaponShots: 5, ammoLabel: 'MSL', capacity: 8 };
  }

  private createPlayers(playerCount: 1 | 2, difficulty: DifficultyMode): void {
    const startingHealth = DIFFICULTY_HEALTH[difficulty] ?? DIFFICULTY_HEALTH.normal;
    for (let index = 0; index < playerCount; index += 1) {
      const playerId = (index + 1) as 1 | 2;
      const scheme = CONTROL_SCHEMES[playerId];
      const yOffset = playerCount === 2 ? (index === 0 ? -52 : 52) : 0;
      const sprite = this.physics.add.sprite(140, (this.stage?.worldHeight ?? 0) * 0.5 + yOffset, 'player-idle', 0);
      sprite.setDepth(12);
      sprite.setDrag(900, 900);
      sprite.setCollideWorldBounds(true);
      sprite.setData('actorKind', 'player');
      sprite.play(animationKey('player-idle'));
      this.configureBody(sprite, 20, 16);

      const player: PlayerUnit = {
        id: playerId,
        label: scheme.callsign,
        accent: scheme.accent,
        tint: scheme.tint,
        sprite,
        health: startingHealth,
        maxHealth: startingHealth,
        bombs: 3,
        alive: true,
        moveSpeed: 220,
        walkSpeed: 150,
        crawlSpeed: 92,
        jumpSpeed: 320,
        fireRate: 170,
        bulletSpeed: 420,
        damage: 55,
        nextFireAt: 0,
        nextSpecialAt: 0,
        jumpReadyAt: 0,
        jumpUntil: 0,
        fireVisualUntil: 0,
        contactReadyAt: 0,
        aimAssistShots: 0,
        rifleAimAssistEvery: 2,
        weaponIndex: 0,
        weapons: ['rifle'],
        ammo: {
          rifle: -1,
          shotgun: 0,
          flame: 0,
          launcher: 0,
          sniper: 0,
          explosiveArrow: 0,
          missile: 0,
          laser: 0,
          machineGun: 0,
          throwBomb: 0,
          poisonBomb: 0,
        },
        aim: new Phaser.Math.Vector2(1, 0),
        jumpVector: new Phaser.Math.Vector2(1, 0),
        virtualControlId: playerId === 1 ? 1 : undefined,
        controls: {
          up: this.input.keyboard!.addKey(scheme.keys.up),
          down: this.input.keyboard!.addKey(scheme.keys.down),
          left: this.input.keyboard!.addKey(scheme.keys.left),
          right: this.input.keyboard!.addKey(scheme.keys.right),
          crouch: this.input.keyboard!.addKey(scheme.keys.crouch),
          jump: this.input.keyboard!.addKey(scheme.keys.jump),
          fire: this.input.keyboard!.addKey(scheme.keys.fire),
          special: this.input.keyboard!.addKey(scheme.keys.special),
        },
        keyboardAliases: playerId === 1 && playerCount === 1
          ? {
            up: [this.input.keyboard!.addKey('UP')],
            down: [this.input.keyboard!.addKey('DOWN')],
            left: [this.input.keyboard!.addKey('LEFT')],
            right: [this.input.keyboard!.addKey('RIGHT')],
            fire: [this.input.keyboard!.addKey('SPACE')],
          }
          : undefined,
      };

      sprite.setData('actor', player);
      this.players.push(player);
      this.playerGroup?.add(sprite);
    }
  }

  private configureBody(sprite: Phaser.Physics.Arcade.Sprite, width: number, height: number): void {
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setSize(width, height);
    body.setOffset((sprite.width - width) * 0.5, (sprite.height - height) * 0.5);
  }

  private registerObstacle(rect: Phaser.GameObjects.Rectangle): void {
    this.physics.add.existing(rect, true);
    const body = rect.body as Phaser.Physics.Arcade.StaticBody | undefined;
    body?.updateFromGameObject();
    this.obstacleBodies.push(rect);
  }

  private setupColliders(): void {
    for (const obstacle of this.obstacleBodies) {
      this.physics.add.collider(
        this.playerGroup!,
        obstacle,
        undefined,
        (playerObject) => this.shouldPlayerCollideWithObstacle(playerObject as Phaser.GameObjects.GameObject, obstacle),
      );
      this.physics.add.collider(this.allyGroup!, obstacle);
      this.physics.add.collider(this.enemyGroup!, obstacle);
      this.physics.add.collider(this.bossGroup!, obstacle);
      this.physics.add.collider(
        this.vehicleGroup!,
        obstacle,
        undefined,
        (vehicleObject) => this.shouldVehicleCollideWithObstacle(vehicleObject as Phaser.GameObjects.GameObject, obstacle),
      );
      this.physics.add.collider(this.playerBullets!, obstacle, (bullet) => {
        this.handleObstacleBulletHit(bullet as Phaser.GameObjects.GameObject, obstacle);
      });
      this.physics.add.collider(this.enemyBullets!, obstacle, (bullet) => {
        this.handleObstacleBulletHit(bullet as Phaser.GameObjects.GameObject, obstacle);
      });
    }

    this.physics.add.overlap(this.playerBullets!, this.enemyGroup!, (bullet, enemy) => {
      this.handleEnemyHit(bullet as Phaser.GameObjects.GameObject, enemy as Phaser.GameObjects.GameObject);
    });
    this.physics.add.overlap(this.playerBullets!, this.bossGroup!, (bullet, boss) => {
      this.handleBossHit(bullet as Phaser.GameObjects.GameObject, boss as Phaser.GameObjects.GameObject);
    });
    this.physics.add.collider(this.playerBullets!, this.supplyCrates!, (bullet, crate) => {
      this.handleSupplyCrateHit(bullet as Phaser.GameObjects.GameObject, crate as Phaser.GameObjects.GameObject);
    });
    this.physics.add.overlap(this.enemyBullets!, this.playerGroup!, (bullet, player) => {
      this.handlePlayerHit(bullet as Phaser.GameObjects.GameObject, player as Phaser.GameObjects.GameObject);
    });
    this.physics.add.overlap(
      this.enemyBullets!,
      this.vehicleGroup!,
      (bullet, vehicle) => {
        this.handleVehicleHit(bullet as Phaser.GameObjects.GameObject, vehicle as Phaser.GameObjects.GameObject);
      },
      (_bullet, vehicle) => this.isVehicleOccupied(vehicle as Phaser.GameObjects.GameObject),
    );
    this.physics.add.overlap(this.playerGroup!, this.enemyGroup!, (player, enemy) => {
      this.handleEnemyContact(player as Phaser.GameObjects.GameObject, enemy as Phaser.GameObjects.GameObject);
    });
    this.physics.add.overlap(this.playerGroup!, this.bossGroup!, (player, boss) => {
      this.handleBossContact(player as Phaser.GameObjects.GameObject, boss as Phaser.GameObjects.GameObject);
    });
    this.physics.add.overlap(this.playerGroup!, this.weaponPickups!, (player, pickup) => {
      this.handleWeaponPickup(player as Phaser.GameObjects.GameObject, pickup as Phaser.GameObjects.GameObject);
    });
    this.physics.add.overlap(this.playerGroup!, this.healthPickups!, (player, pickup) => {
      this.handleHealthPickup(player as Phaser.GameObjects.GameObject, pickup as Phaser.GameObjects.GameObject);
    });
    this.physics.add.overlap(this.playerGroup!, this.airStrikePickups!, (player, pickup) => {
      this.handleAirStrikePickup(player as Phaser.GameObjects.GameObject, pickup as Phaser.GameObjects.GameObject);
    });
    this.physics.add.overlap(this.playerGroup!, this.vehicleGroup!, (player, vehicle) => {
      this.handleVehicleEntry(player as Phaser.GameObjects.GameObject, vehicle as Phaser.GameObjects.GameObject);
    });
    this.physics.add.overlap(this.playerGroup!, this.rescueBunkerGroup!, (player, bunker) => {
      this.handleRescueBunker(player as Phaser.GameObjects.GameObject, bunker as Phaser.GameObjects.GameObject);
    });
    this.physics.add.overlap(this.vehicleGroup!, this.enemyGroup!, (vehicle, enemy) => {
      this.handleVehicleEnemyContact(vehicle as Phaser.GameObjects.GameObject, enemy as Phaser.GameObjects.GameObject);
    });
  }

  private shouldPlayerCollideWithObstacle(
    playerObject: Phaser.GameObjects.GameObject,
    obstacle: Phaser.GameObjects.Rectangle,
  ): boolean {
    const player = playerObject.getData('actor') as PlayerUnit | undefined;
    if (!player?.alive || !this.isSoftCoverObstacle(obstacle)) {
      return true;
    }

    if (this.time.now < player.jumpUntil) {
      this.destroyDestructibleObstacle(obstacle, String(obstacle.getData('coverLabel') ?? 'COVER'), false);
      this.createHitSpark(player.sprite.x, player.sprite.y, player.tint, 'VAULT');
      return false;
    }

    return true;
  }

  private shouldVehicleCollideWithObstacle(
    vehicleObject: Phaser.GameObjects.GameObject,
    obstacle: Phaser.GameObjects.Rectangle,
  ): boolean {
    const vehicle = vehicleObject.getData('vehicle') as VehicleUnit | undefined;
    if (!vehicle?.active) {
      return true;
    }

    const canHeavyVehiclePushThrough = vehicle.kind === 'tank' || vehicle.kind === 'jeep';
    if (canHeavyVehiclePushThrough && Boolean(obstacle.getData('vehiclePassableObstacle'))) {
      return false;
    }

    if (!this.isSoftCoverObstacle(obstacle)) {
      return true;
    }

    if (canHeavyVehiclePushThrough) {
      this.destroyDestructibleObstacle(obstacle, String(obstacle.getData('coverLabel') ?? 'COVER'), false);
      this.createHitSpark(vehicle.body.x, vehicle.body.y, 0xffd166, 'CRUSH');
      return false;
    }

    return true;
  }

  private isSoftCoverObstacle(obstacle: Phaser.GameObjects.Rectangle): boolean {
    if (!obstacle.active || !Boolean(obstacle.getData('destructibleObstacle'))) {
      return false;
    }

    const label = String(obstacle.getData('coverLabel') ?? '');
    return label === 'HUT' || label === 'BUNKER';
  }

  private createOverlayText(): void {
    this.objectivePanel = this.add.image(0, 0, 'objective-plaque')
      .setScrollFactor(0)
      .setDepth(59)
      .setAlpha(0);

    this.bannerText = this.add.text(36, 28, '', {
      fontFamily: 'Impact, Haettenschweiler, sans-serif',
      fontSize: '40px',
      color: '#f4e8c3',
      letterSpacing: 2,
      align: 'center',
    }).setScrollFactor(0).setDepth(60).setOrigin(0.5);
    this.bannerText.setAlpha(0);

    this.reticleText = this.add.text(36, 72, '', {
      fontFamily: 'Bahnschrift, Trebuchet MS, sans-serif',
      fontSize: '19px',
      color: '#f3e6bf',
      wordWrap: { width: 520 },
      align: 'center',
    }).setScrollFactor(0).setDepth(60).setOrigin(0.5);
    this.reticleText.setAlpha(0);
    this.layoutOverlayText();

    this.scale.off(Phaser.Scale.Events.RESIZE, this.layoutOverlayText, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layoutOverlayText, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layoutOverlayText, this);
    });
  }

  private layoutOverlayText(): void {
    if (!this.bannerText?.active || !this.reticleText?.active) {
      return;
    }

    const compact = this.scale.width <= 900;
    const x = this.scale.width * 0.5;
    const panelY = compact ? 116 : 100;
    const bannerY = compact ? panelY - 26 : panelY - 30;
    const reticleY = compact ? panelY + 22 : panelY + 24;
    const wrapWidth = compact
      ? Math.max(240, Math.min(this.scale.width - 28, 560))
      : 620;

    this.objectivePanel?.setPosition(x, panelY);
    if (this.objectivePanel) {
      this.objectivePanel.displayWidth = Math.min(this.scale.width - 28, compact ? 560 : 720);
      this.objectivePanel.displayHeight = compact ? 118 : 132;
    }

    this.bannerText.setPosition(x, bannerY);
    this.bannerText.setScale(compact ? 0.7 : 1);
    this.bannerText.setWordWrapWidth(wrapWidth);

    this.reticleText.setPosition(x, reticleY);
    this.reticleText.setScale(compact ? 0.84 : 1);
    this.reticleText.setWordWrapWidth(wrapWidth);
  }

  private applyResponsiveCamera(): void {
    const width = Math.max(1, this.scale.width);
    const height = Math.max(1, this.scale.height);
    const stage = this.stage ?? this.director.getSnapshot().currentStage;
    const portrait = height > width;
    const targetWidth = portrait ? 1000 : 1100;
    const minZoom = portrait ? 0.44 : 0.72;
    const fitStageHeightZoom = portrait
      ? Phaser.Math.Clamp(height / Math.max(1, stage.worldHeight - 16), minZoom, 1)
      : minZoom;
    const responsiveZoom = width > 960 && height > 620
      ? 1
      : Phaser.Math.Clamp(width / targetWidth, minZoom, 1);
    const zoom = portrait
      ? Math.max(responsiveZoom, fitStageHeightZoom)
      : responsiveZoom;

    this.cameras.main.setZoom(zoom);
    this.baseCameraZoom = zoom;
    this.cameras.main.setBounds(
      0,
      0,
      stage.worldWidth,
      stage.worldHeight,
    );
    this.layoutOverlayText();
  }

  private getVisibleWorldHeight(zoom = this.cameras.main.zoom): number {
    return Math.max(1, this.scale.height) / Math.max(0.1, zoom);
  }

  private updatePlayers(time: number): void {
    for (const player of this.players) {
      if (!player.alive) {
        player.sprite.setVelocity(0, 0);
        player.sprite.setScale(1);
        continue;
      }

      if (player.vehicle?.active) {
        this.updateVehicleDriver(player, time);
        continue;
      }

      const movement = this.getMovementInput(player);
      const wantsFire = this.isActionDown(player, 'fire');
      const isJumping = time < player.jumpUntil;
      const terrain = this.getTerrainAt(player.sprite.x, player.sprite.y);

      if (movement.lengthSq() > 0) {
        movement.normalize();
        if (!isJumping) {
          player.aim.copy(movement);
        }
      }

      if (this.wasActionPressed(player, 'jump') && time >= player.jumpReadyAt) {
        const jumpVector = movement.lengthSq() > 0
          ? movement.clone()
          : this.getEmergencyRollVector(player);
        if (jumpVector.lengthSq() === 0) {
          jumpVector.set(1, 0);
        }
        jumpVector.normalize();
        player.jumpVector.copy(jumpVector);
        player.jumpUntil = time + 430;
        player.jumpReadyAt = time + 760;
        player.aim.copy(jumpVector);
      }

      if (this.wasActionPressed(player, 'crouch')) {
        this.switchWeapon(player);
      }

      const nowJumping = time < player.jumpUntil;
      let animation = animationKey('player-idle');
      let speed = player.moveSpeed;

      if (nowJumping) {
        const remaining = Math.max(0, player.jumpUntil - time) / 430;
        const jumpSpeed = player.jumpSpeed * 1.55 * (0.55 + remaining * 0.45);
        player.sprite.setVelocity(player.jumpVector.x * jumpSpeed, player.jumpVector.y * jumpSpeed);
        player.sprite.setScale(1.12);
        animation = animationKey('player-jump');
      } else {
        player.sprite.setScale(1);
        if (movement.lengthSq() > 0) {
          speed = wantsFire ? player.walkSpeed : player.moveSpeed;
          if (terrain?.effect === 'water') {
            speed *= 0.58;
          } else if (terrain?.effect === 'hole') {
            speed *= 0.46;
          } else if (terrain?.effect === 'high') {
            speed *= 0.94;
          }
          player.sprite.setVelocity(movement.x * speed, movement.y * speed);
          animation = wantsFire ? animationKey('player-walk') : animationKey('player-run');
        } else {
          player.sprite.setVelocity(0, 0);
          animation = time < player.fireVisualUntil ? animationKey('player-fire') : animationKey('player-idle');
        }
      }

      if (wantsFire && time >= player.nextFireAt) {
        this.firePlayerWeapon(player, time);
      }

      if (this.wasActionPressed(player, 'special') && time >= player.nextSpecialAt && player.bombs > 0) {
        this.activateBarrage(player, time);
      }

      player.sprite.setRotation(player.aim.angle());
      this.playLoop(player.sprite, animation);
    }
  }

  private updateAllies(time: number): void {
    const leader = this.players.find((player) => player.alive);
    if (!leader) {
      return;
    }

    for (const [index, ally] of this.allies.entries()) {
      if (!ally.alive) {
        continue;
      }

      if (ally.vehicle?.active) {
        const vehicle = ally.vehicle;
        const seatAngle = vehicle.body.rotation + Math.PI * 0.5;
        const seatOffset = (index % Math.max(1, vehicle.capacity - 1)) - (vehicle.capacity - 2) * 0.5;
        ally.sprite.setPosition(
          vehicle.body.x + Math.cos(seatAngle) * seatOffset * 8,
          vehicle.body.y + Math.sin(seatAngle) * seatOffset * 8,
        );
        ally.sprite.setVelocity(0, 0);
        ally.sprite.setRotation(vehicle.body.rotation);
        ally.sprite.setAlpha(0.28);
        ally.label.setVisible(false);
        continue;
      }

      ally.sprite.setAlpha(0.9);
      ally.label.setVisible(true);
      const targetX = leader.sprite.x - leader.aim.x * (54 + index * 18) + ally.followOffset.x;
      const targetY = leader.sprite.y - leader.aim.y * (54 + index * 18) + ally.followOffset.y;
      const direction = new Phaser.Math.Vector2(targetX - ally.sprite.x, targetY - ally.sprite.y);
      const distance = direction.length();
      if (distance > 18) {
        direction.normalize();
        const speed = distance > 180 ? 235 : 175;
        ally.sprite.setVelocity(direction.x * speed, direction.y * speed);
        ally.sprite.setRotation(direction.angle());
        this.playLoop(ally.sprite, animationKey('player-run'));
      } else {
        ally.sprite.setVelocity(0, 0);
        this.playLoop(ally.sprite, animationKey('player-idle'));
      }

      ally.label.setPosition(ally.sprite.x, ally.sprite.y - 28);
      this.fireAllyRifleAtVisibleEnemy(ally, time);
    }
  }

  private fireAllyRifleAtVisibleEnemy(ally: AllyUnit, time: number): void {
    if (time < ally.nextFireAt) {
      return;
    }

    const target = this.findClosestVisibleEnemy(ally.sprite.x, ally.sprite.y, 470);
    if (!target) {
      return;
    }

    const direction = new Phaser.Math.Vector2(target.x - ally.sprite.x, target.y - ally.sprite.y).normalize();
    ally.sprite.setRotation(direction.angle());
    ally.nextFireAt = time + Phaser.Math.Between(520, 760);
    const muzzle = this.findClearBulletStart(ally.sprite.x + direction.x * 20, ally.sprite.y + direction.y * 20, direction);
    this.createMuzzleFlash(muzzle.x, muzzle.y, direction, 0xaee8ff);
    this.firePlayerBullet(muzzle.x, muzzle.y, direction, 385, 22, 0xaee8ff, 480, 1.35, 0.95);
    this.playLoop(ally.sprite, animationKey('player-fire'));
  }

  private findClosestVisibleEnemy(x: number, y: number, maxDistance: number): { x: number; y: number } | undefined {
    let bestTarget: { x: number; y: number } | undefined;
    let bestDistance = maxDistance;

    const consider = (targetX: number, targetY: number): void => {
      const distance = Phaser.Math.Distance.Between(x, y, targetX, targetY);
      if (distance >= bestDistance || !this.hasLineOfSight(x, y, targetX, targetY)) {
        return;
      }

      bestDistance = distance;
      bestTarget = { x: targetX, y: targetY };
    };

    for (const enemy of this.enemies) {
      if (enemy.alive) {
        consider(enemy.sprite.x, enemy.sprite.y);
      }
    }

    for (const boss of this.bosses) {
      if (boss.alive) {
        consider(boss.sprite.x, boss.sprite.y);
      }
    }

    return bestTarget;
  }

  private updateVehicleDriver(player: PlayerUnit, time: number): void {
    const vehicle = player.vehicle;
    if (!vehicle?.active) {
      player.vehicle = undefined;
      return;
    }

    const movement = this.getMovementInput(player);
    const vehicleBody = vehicle.body.body as Phaser.Physics.Arcade.Body;
    if (movement.lengthSq() > 0) {
      movement.normalize();
      vehicleBody.setVelocity(movement.x * vehicle.speed, movement.y * vehicle.speed);
      vehicle.body.setRotation(movement.angle());
      player.aim.copy(movement);
    } else {
      vehicleBody.setVelocity(0, 0);
      player.aim.copy(this.getVehicleForward(vehicle));
    }

    player.sprite.setPosition(vehicle.body.x, vehicle.body.y);
    player.sprite.setVelocity(0, 0);
    player.sprite.setAlpha(0.46);
    player.sprite.setDepth(12);
    player.sprite.setRotation(player.aim.angle());
    this.playLoop(player.sprite, time < player.fireVisualUntil ? animationKey('player-fire') : animationKey('player-idle'));

    if (this.wasActionPressed(player, 'jump')) {
      this.exitVehicle(player, true);
      player.jumpReadyAt = time + 500;
      return;
    }

    if (this.wasActionPressed(player, 'crouch')) {
      this.switchWeapon(player);
    }

    if (vehicle.kind === 'jeep') {
      this.updateJeepAutoShotgun(player, vehicle, time);
      if (this.isActionDown(player, 'fire') && time >= player.nextFireAt) {
        player.aim.copy(this.getVehicleForward(vehicle));
        this.firePlayerWeapon(player, time);
      }
    } else if (vehicle.kind === 'tank') {
      this.updateTankMissileSalvo(player, vehicle, time);
      const firePressed = this.wasActionPressed(player, 'fire');
      if (firePressed) {
        this.startTankMissileSalvo(player, vehicle, time);
      }
      if (this.isActionDown(player, 'fire') && time >= player.nextFireAt) {
        player.aim.copy(this.getVehicleForward(vehicle));
        this.firePlayerWeapon(player, time);
      }
    } else if (this.isActionDown(player, 'fire') && time >= player.nextFireAt) {
      player.aim.copy(this.getVehicleForward(vehicle));
      this.firePlayerWeapon(player, time);
    }

    if (this.wasActionPressed(player, 'special') && time >= player.nextSpecialAt && player.bombs > 0) {
      this.activateBarrage(player, time);
    }
  }

  private getEmergencyRollVector(player: PlayerUnit): Phaser.Math.Vector2 {
    const aim = player.aim.lengthSq() > 0
      ? player.aim.clone().normalize()
      : new Phaser.Math.Vector2(1, 0);
    const side = Math.random() < 0.5 ? -1 : 1;
    return new Phaser.Math.Vector2(-aim.y * side, aim.x * side).normalize();
  }

  private updateJeepAutoShotgun(player: PlayerUnit, vehicle: VehicleUnit, time: number): void {
    if (vehicle.weaponShotsRemaining <= 0 || time < vehicle.nextWeaponFireAt) {
      return;
    }

    const direction = this.getVehicleForward(vehicle);
    this.fireVehicleShotgun(vehicle, direction, player.tint);
    vehicle.weaponShotsRemaining -= 1;
    vehicle.nextWeaponFireAt = time + 500;
    player.fireVisualUntil = time + 170;
  }

  private startTankMissileSalvo(player: PlayerUnit, vehicle: VehicleUnit, time: number): void {
    if (vehicle.weaponShotsRemaining <= 0) {
      this.showBanner('Tank missiles empty.', player.accent);
      return;
    }

    if (vehicle.salvoShotsRemaining > 0 || time < vehicle.nextWeaponFireAt) {
      return;
    }

    vehicle.salvoShotsRemaining = Math.min(5, vehicle.weaponShotsRemaining);
    vehicle.nextSalvoFireAt = time;
    vehicle.nextWeaponFireAt = time + 1800;
  }

  private updateTankMissileSalvo(player: PlayerUnit, vehicle: VehicleUnit, time: number): void {
    if (vehicle.salvoShotsRemaining <= 0 || time < vehicle.nextSalvoFireAt) {
      return;
    }

    const direction = this.getVehicleForward(vehicle);
    const wobble = Phaser.Math.FloatBetween(-0.05, 0.05);
    this.fireVehicleMissile(vehicle, direction.rotate(wobble), player.tint);
    vehicle.salvoShotsRemaining -= 1;
    vehicle.weaponShotsRemaining -= 1;
    vehicle.nextSalvoFireAt = time + 220;
    player.fireVisualUntil = time + 220;
  }

  private updateVehicles(): void {
    for (const vehicle of this.vehicles) {
      if (!vehicle.active) {
        continue;
      }

      this.syncVehicleVisuals(vehicle);
      vehicle.label.setPosition(vehicle.body.x, vehicle.body.y - 4);
      vehicle.label.setRotation(vehicle.body.rotation);
      vehicle.hpLabel.setPosition(vehicle.body.x, vehicle.body.y + vehicle.body.height * 0.5 + 10);
      const ammoLabel = vehicle.weaponShotsRemaining > 0
        ? `${vehicle.ammoLabel} ${Math.max(0, vehicle.weaponShotsRemaining)}`
        : vehicle.ammoLabel;
      const teamCount = (vehicle.driver ? 1 : 0) + vehicle.passengerAllies.length;
      const teamLabel = teamCount > 0 ? ` TEAM ${teamCount}/${vehicle.capacity}` : ` CAP ${vehicle.capacity}`;
      vehicle.hpLabel.setText(`${Math.max(0, vehicle.hp)}/${vehicle.maxHp}  ${ammoLabel}${teamLabel}`);

      if (!vehicle.driver) {
        (vehicle.body.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      }
    }
  }

  private syncVehicleVisuals(vehicle: VehicleUnit): void {
    this.syncVisualParts(vehicle.body.x, vehicle.body.y, vehicle.body.rotation, vehicle.visualParts);
  }

  private syncBossVisuals(boss: BossUnit, time = this.time.now): void {
    this.syncVisualParts(boss.sprite.x, boss.sprite.y, boss.sprite.rotation, boss.visualParts, time);
  }

  private syncEnemyVisuals(enemy: EnemyUnit): void {
    if (!enemy.visualParts) {
      return;
    }
    this.syncVisualParts(enemy.sprite.x, enemy.sprite.y, enemy.sprite.rotation, enemy.visualParts);
  }

  private syncVisualParts(x: number, y: number, angle: number, parts: VehicleVisualPart[], time = this.time.now): void {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    for (const part of parts) {
      const partX = x + part.offsetX * cos - part.offsetY * sin;
      const partY = y + part.offsetX * sin + part.offsetY * cos;
      part.object.setPosition(partX, partY);
      part.object.setRotation(angle + part.rotationOffset + (part.spinSpeed ?? 0) * time);
    }
  }

  private setVehicleVisualTint(vehicle: VehicleUnit, mode: 'base' | 'hit' | 'broken'): void {
    this.setVisualPartsTint(vehicle.visualParts, mode);
  }

  private setEnemyVisualTint(enemy: EnemyUnit, mode: 'base' | 'hit' | 'broken'): void {
    if (enemy.visualParts) {
      this.setVisualPartsTint(enemy.visualParts, mode);
    }
  }

  private setBossVisualTint(boss: BossUnit, mode: 'base' | 'hit' | 'broken'): void {
    this.setVisualPartsTint(boss.visualParts, mode);
  }

  private setVisualPartsTint(parts: VehicleVisualPart[], mode: 'base' | 'hit' | 'broken'): void {
    for (const part of parts) {
      if (mode === 'hit') {
        part.object.setFillStyle(0xf0d36b, Math.min(1, part.alpha + 0.08));
      } else if (mode === 'broken') {
        part.object.setFillStyle(part.brokenTint, Math.max(0.34, part.alpha * 0.76));
      } else {
        part.object.setFillStyle(part.baseTint, part.alpha);
      }
    }
  }

  private getVehicleForward(vehicle: VehicleUnit): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(1, 0).setToPolar(vehicle.body.rotation, 1).normalize();
  }

  private getVehicleMuzzle(vehicle: VehicleUnit, direction: Phaser.Math.Vector2, distance: number): { x: number; y: number } {
    return this.findClearBulletStart(
      vehicle.body.x + direction.x * distance,
      vehicle.body.y + direction.y * distance,
      direction,
    );
  }

  private fireVehicleShotgun(vehicle: VehicleUnit, direction: Phaser.Math.Vector2, accentTint: number): void {
    const tint = 0xffd08a;
    const start = this.getVehicleMuzzle(vehicle, direction, vehicle.body.width * 0.5 + 18);
    this.createMuzzleFlash(start.x, start.y, direction, accentTint || tint);

    for (let pellet = 0; pellet < 5; pellet += 1) {
      const offset = Phaser.Math.Linear(-0.22, 0.22, pellet / 4) + Phaser.Math.FloatBetween(-0.035, 0.035);
      this.firePlayerBullet(
        start.x,
        start.y,
        direction.clone().rotate(offset),
        410,
        36,
        tint,
        620,
        1.65,
        1.18,
        undefined,
        undefined,
        undefined,
        undefined,
        1,
        0.72,
        260,
      );
    }
  }

  private fireVehicleMissile(vehicle: VehicleUnit, direction: Phaser.Math.Vector2, accentTint: number): void {
    const tint = 0xffb35c;
    const start = this.getVehicleMuzzle(vehicle, direction, vehicle.body.width * 0.5 + 22);
    this.createMuzzleFlash(start.x, start.y, direction, accentTint || tint);
    this.firePlayerBullet(
      start.x,
      start.y,
      direction,
      320,
      115,
      tint,
      980,
      2.85,
      1.8,
      235,
      150,
      undefined,
      undefined,
      1,
      0.84,
      420,
    );
  }

  private exitVehicle(player: PlayerUnit, safeExit: boolean): void {
    const vehicle = player.vehicle;
    if (!vehicle) {
      return;
    }

    vehicle.driver = undefined;
    player.vehicle = undefined;
    player.sprite.setAlpha(1);
    const offset = safeExit ? 42 : 22;
    const exitX = Phaser.Math.Clamp(vehicle.body.x - Math.cos(vehicle.body.rotation) * offset, 24, (this.stage?.worldWidth ?? 2600) - 24);
    const exitY = Phaser.Math.Clamp(vehicle.body.y - Math.sin(vehicle.body.rotation) * offset, 24, (this.stage?.worldHeight ?? 920) - 24);
    player.sprite.setPosition(exitX, exitY);
    (player.sprite.body as Phaser.Physics.Arcade.Body).reset(exitX, exitY);
    this.unloadVehicleAllies(vehicle);
    this.showBanner(`${player.label} exited ${vehicle.kind.toUpperCase()}`, player.accent);
  }

  private boardNearbyAllies(vehicle: VehicleUnit): number {
    const availableSeats = Math.max(0, vehicle.capacity - 1 - vehicle.passengerAllies.length);
    if (availableSeats <= 0) {
      return 0;
    }

    const candidates = this.allies
      .filter((ally) => ally.alive && !ally.vehicle)
      .map((ally) => ({
        ally,
        distance: Phaser.Math.Distance.Between(vehicle.body.x, vehicle.body.y, ally.sprite.x, ally.sprite.y),
      }))
      .filter((entry) => entry.distance <= 260)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, availableSeats);

    for (const { ally } of candidates) {
      ally.vehicle = vehicle;
      vehicle.passengerAllies.push(ally);
      ally.sprite.setAlpha(0.28);
      ally.label.setVisible(false);
      (ally.sprite.body as Phaser.Physics.Arcade.Body).enable = false;
    }

    return candidates.length;
  }

  private unloadVehicleAllies(vehicle: VehicleUnit): void {
    const passengers = [...vehicle.passengerAllies];
    vehicle.passengerAllies = [];

    passengers.forEach((ally, index) => {
      ally.vehicle = undefined;
      const angle = vehicle.body.rotation + Math.PI + (index - passengers.length * 0.5) * 0.24;
      const exitX = Phaser.Math.Clamp(vehicle.body.x + Math.cos(angle) * 48, 28, (this.stage?.worldWidth ?? 2600) - 28);
      const exitY = Phaser.Math.Clamp(vehicle.body.y + Math.sin(angle) * 48, 28, (this.stage?.worldHeight ?? 920) - 28);
      ally.sprite.setPosition(exitX, exitY);
      ally.sprite.setAlpha(0.9);
      ally.label.setVisible(true);
      const body = ally.sprite.body as Phaser.Physics.Arcade.Body;
      body.enable = true;
      body.reset(exitX, exitY);
    });
  }

  private getMovementInput(player: PlayerUnit): Phaser.Math.Vector2 {
    const axis = player.virtualControlId ? this.virtualGamepad.getAxis(player.virtualControlId) : { x: 0, y: 0 };
    const keyboardX = (this.isKeyboardControlDown(player, 'left') ? -1 : 0) + (this.isKeyboardControlDown(player, 'right') ? 1 : 0);
    const keyboardY = (this.isKeyboardControlDown(player, 'up') ? -1 : 0) + (this.isKeyboardControlDown(player, 'down') ? 1 : 0);
    const movement = new Phaser.Math.Vector2(
      Phaser.Math.Clamp(axis.x + keyboardX, -1, 1),
      Phaser.Math.Clamp(axis.y + keyboardY, -1, 1),
    );

    if (movement.lengthSq() > 1) {
      movement.normalize();
    }

    return movement;
  }

  private isActionDown(player: PlayerUnit, action: Extract<GameAction, 'fire'>): boolean {
    const touchActive = player.virtualControlId ? this.virtualGamepad.isDown(player.virtualControlId, action) : false;
    return this.isKeyboardControlDown(player, action) || touchActive;
  }

  private wasActionPressed(player: PlayerUnit, action: Extract<GameAction, 'crouch' | 'jump' | 'special' | 'fire'>): boolean {
    const keyPressed = this.wasKeyboardControlPressed(player, action);
    const touchPressed = player.virtualControlId
      ? this.virtualGamepad.consumeJustPressed(player.virtualControlId, action)
      : false;
    return keyPressed || touchPressed;
  }

  private isKeyboardControlDown(player: PlayerUnit, action: keyof PlayerUnit['controls']): boolean {
    return player.controls[action].isDown || (player.keyboardAliases?.[action]?.some((key) => key.isDown) ?? false);
  }

  private wasKeyboardControlPressed(player: PlayerUnit, action: keyof PlayerUnit['controls']): boolean {
    return Phaser.Input.Keyboard.JustDown(player.controls[action])
      || (player.keyboardAliases?.[action]?.some((key) => Phaser.Input.Keyboard.JustDown(key)) ?? false);
  }

  private updateEnemies(time: number): void {
    for (const enemy of this.enemies) {
      if (!enemy.alive) {
        continue;
      }

      const target = this.closestLivingPlayer(enemy.sprite.x, enemy.sprite.y);
      if (!target) {
        enemy.sprite.setVelocity(0, 0);
        continue;
      }

      const direction = new Phaser.Math.Vector2(target.sprite.x - enemy.sprite.x, target.sprite.y - enemy.sprite.y);
      const distance = direction.length();
      direction.normalize();
      enemy.sprite.setRotation(direction.angle());
      this.syncEnemyVisuals(enemy);
      const hasSight = this.hasLineOfSight(enemy.sprite.x, enemy.sprite.y, target.sprite.x, target.sprite.y);

      if (!hasSight) {
        enemy.sprite.setVelocity(0, 0);
        this.syncEnemyVisuals(enemy);
        this.playLoop(enemy.sprite, animationKey(getEnemyTextureKey(enemy.theme, enemy.kind, 'stand')));
        continue;
      }

      if (enemy.kind === 'zombie') {
        enemy.sprite.setVelocity(direction.x * enemy.moveSpeed, direction.y * enemy.moveSpeed);
        if (distance <= 34 && time >= enemy.contactReadyAt) {
          enemy.contactReadyAt = time + 760;
          this.createHitSpark(target.sprite.x, target.sprite.y, 0x9cff8a, '-bite');
          this.damagePlayer(target, enemy.damage);
        }
      } else if (enemy.kind === 'scout') {
        const desiredRange = 260;
        const advance = distance > desiredRange ? 0.86 : distance < desiredRange * 0.55 ? -0.42 : 0;
        const strafe = Math.sin(time / 360 + enemy.behaviorOffset) * 0.62;
        const side = new Phaser.Math.Vector2(-direction.y, direction.x).scale(strafe);
        const move = direction.clone().scale(advance).add(side);
        if (move.lengthSq() > 0) {
          move.normalize();
          enemy.sprite.setVelocity(move.x * enemy.moveSpeed, move.y * enemy.moveSpeed);
        } else {
          enemy.sprite.setVelocity(0, 0);
        }
      } else if (enemy.kind === 'turret') {
        enemy.sprite.setVelocity(0, 0);
      } else if (this.isMountedEnemy(enemy.kind)) {
        const desiredRange = enemy.kind === 'tankRaider' ? 420 : enemy.kind === 'jeepRaider' ? 320 : 245;
        const advance = distance > desiredRange ? 0.78 : distance < desiredRange * 0.58 ? -0.32 : 0;
        const strafe = Math.sin(time / (enemy.kind === 'bikeRaider' ? 340 : 520) + enemy.behaviorOffset) * (enemy.kind === 'tankRaider' ? 0.16 : 0.36);
        const side = new Phaser.Math.Vector2(-direction.y, direction.x).scale(strafe);
        const move = direction.clone().scale(advance).add(side);
        if (move.lengthSq() > 0) {
          move.normalize();
          enemy.sprite.setVelocity(move.x * enemy.moveSpeed, move.y * enemy.moveSpeed);
        } else {
          enemy.sprite.setVelocity(0, 0);
        }
      } else {
        const desiredRange = enemy.kind === 'rocketeer' ? 280 : 190;
        const advance = distance > desiredRange ? 0.72 : distance < desiredRange * 0.45 ? -0.25 : 0;
        const strafe = Math.sin(time / 520 + enemy.behaviorOffset) * 0.28;
        const side = new Phaser.Math.Vector2(-direction.y, direction.x).scale(strafe);
        const move = direction.clone().scale(advance).add(side);
        if (move.lengthSq() > 0) {
          move.normalize();
          enemy.sprite.setVelocity(move.x * enemy.moveSpeed, move.y * enemy.moveSpeed);
        } else {
          enemy.sprite.setVelocity(0, 0);
        }
      }

      this.syncEnemyVisuals(enemy);

      const fireRange = enemy.kind === 'tankRaider' ? 560 : enemy.kind === 'jeepRaider' ? 430 : enemy.kind === 'bikeRaider' ? 330 : enemy.kind === 'rocketeer' ? 470 : enemy.kind === 'scout' ? 430 : 360;
      if (enemy.kind !== 'zombie' && distance <= fireRange && time >= enemy.nextFireAt) {
        if (enemy.kind === 'scout') {
          this.fireEnemyPoisonDart(enemy, direction);
        } else {
          const spread = enemy.kind === 'tankRaider' ? 0.09 : enemy.kind === 'jeepRaider' ? 0.08 : enemy.kind === 'bikeRaider' ? 0.1 : enemy.kind === 'rocketeer' ? 0.12 : 0.05;
          this.fireEnemyBullet(
            enemy.sprite.x + direction.x * 14,
            enemy.sprite.y + direction.y * 14,
            direction.clone().rotate(Phaser.Math.FloatBetween(-spread, spread)),
            enemy.bulletSpeed,
            enemy.damage,
            enemy.kind === 'tankRaider' ? 0xffb35c : enemy.kind === 'jeepRaider' ? 0xffd08a : enemy.kind === 'bikeRaider' ? 0xff8a5c : enemy.kind === 'rocketeer' ? 0xff9359 : 0xff5b4a,
          );
        }
        enemy.nextFireAt = time + enemy.fireRate;
        enemy.fireVisualUntil = time + 200;
      }

      const action = enemy.kind !== 'zombie' && time < enemy.fireVisualUntil ? 'fire' : 'stand';
      this.playLoop(enemy.sprite, animationKey(getEnemyTextureKey(enemy.theme, enemy.kind, action)));
    }
  }

  private updateBoss(time: number): void {
    if (!this.stage) {
      return;
    }

    for (const boss of this.bosses) {
      if (boss.alive) {
        this.updateSingleBoss(boss, time);
      }
    }
  }

  private updateSingleBoss(boss: BossUnit, time: number): void {
    const stage = this.stage;
    if (!stage) {
      return;
    }

    const sprite = boss.sprite;
    const target = this.closestLivingPlayer(sprite.x, sprite.y);
    if (!target) {
      sprite.setVelocity(0, 0);
      this.syncBossVisuals(boss, time);
      return;
    }

    const angle = Phaser.Math.Angle.Between(sprite.x, sprite.y, target.sprite.x, target.sprite.y);
    sprite.setRotation(angle);
    const healthRatio = boss.health / boss.maxHealth;
    const phaseBoost = healthRatio < 0.45 ? 1.22 : 1;

    if (boss.config.kind === 'gunship') {
      if (sprite.x < stage.worldWidth - 470) {
        boss.direction = 1;
      } else if (sprite.x > stage.worldWidth - 120) {
        boss.direction = -1;
      }

      const desiredY = 220 + Math.sin(time / 450) * 90;
      sprite.setVelocity(boss.config.speed * boss.direction * phaseBoost, Phaser.Math.Clamp((desiredY - sprite.y) * 2.2, -140, 140));
    } else if (boss.config.kind === 'barge') {
      if (sprite.y < 180) {
        boss.direction = 1;
      } else if (sprite.y > stage.worldHeight - 180) {
        boss.direction = -1;
      }

      const sway = Math.sin(time / 360 + boss.config.x * 0.01) * 44;
      sprite.setVelocity(Phaser.Math.Clamp((stage.worldWidth - 290 - sprite.x) * 0.2 + sway, -78, 78), boss.config.speed * boss.direction * phaseBoost);
    } else {
      if (sprite.x < stage.worldWidth - 520) {
        boss.direction = 1;
      } else if (sprite.x > stage.worldWidth - 120) {
        boss.direction = -1;
      }

      sprite.setVelocity(boss.config.speed * boss.direction * phaseBoost, Math.sin(time / 420 + boss.config.y * 0.01) * (healthRatio < 0.45 ? 86 : 60));
    }

    if (time >= boss.nextFireAt) {
      this.fireBossPattern(boss, angle);
      boss.nextFireAt = time + boss.config.fireRate * (healthRatio < 0.45 ? 0.72 : 1);
      boss.fireVisualUntil = time + 360;
    }

    if (boss.config.summonEveryMs && time >= boss.nextSummonAt) {
      this.summonBossSupport(boss);
      boss.nextSummonAt = time + boss.config.summonEveryMs;
    }

    if (time < boss.fireVisualUntil) {
      this.playLoop(sprite, animationKey(getBossTextureKey(boss.config.kind)));
    } else {
      this.stopAtFirstFrame(sprite);
    }

    this.syncBossVisuals(boss, time);
  }

  private drawEnemyVisionCones(time: number): void {
    if (!this.visionGraphics) {
      return;
    }

    if (time < this.nextVisionConeDrawAt) {
      return;
    }

    this.nextVisionConeDrawAt = time + 100;
    this.visionGraphics.clear();
    for (const enemy of this.enemies) {
      if (!enemy.alive || !enemy.sprite.active) {
        continue;
      }

      const range = enemy.kind === 'zombie' ? 210 : enemy.kind === 'tankRaider' ? 560 : enemy.kind === 'jeepRaider' ? 430 : enemy.kind === 'bikeRaider' ? 330 : enemy.kind === 'scout' ? 430 : enemy.kind === 'rocketeer' ? 470 : enemy.kind === 'turret' ? 420 : 360;
      const halfAngle = enemy.kind === 'zombie' ? 0.62 : enemy.kind === 'tankRaider' ? 0.34 : enemy.kind === 'jeepRaider' ? 0.4 : enemy.kind === 'bikeRaider' ? 0.46 : enemy.kind === 'scout' ? 0.52 : enemy.kind === 'turret' ? 0.3 : 0.42;
      const angle = enemy.sprite.rotation;
      const leftX = enemy.sprite.x + Math.cos(angle - halfAngle) * range;
      const leftY = enemy.sprite.y + Math.sin(angle - halfAngle) * range;
      const rightX = enemy.sprite.x + Math.cos(angle + halfAngle) * range;
      const rightY = enemy.sprite.y + Math.sin(angle + halfAngle) * range;
      const seesPlayer = this.players.some((player) => (
        player.alive
        && Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, player.sprite.x, player.sprite.y) <= range
        && this.hasLineOfSight(enemy.sprite.x, enemy.sprite.y, player.sprite.x, player.sprite.y)
        && Math.abs(Phaser.Math.Angle.Wrap(Phaser.Math.Angle.Between(enemy.sprite.x, enemy.sprite.y, player.sprite.x, player.sprite.y) - angle)) <= halfAngle
      ));

      this.visionGraphics.fillStyle(seesPlayer ? 0xff6b4a : 0xffd166, seesPlayer ? 0.18 : 0.11);
      this.visionGraphics.lineStyle(1, seesPlayer ? 0xff8a5c : 0xffd166, seesPlayer ? 0.22 : 0.14);
      this.visionGraphics.beginPath();
      this.visionGraphics.moveTo(enemy.sprite.x, enemy.sprite.y);
      this.visionGraphics.lineTo(leftX, leftY);
      this.visionGraphics.lineTo(rightX, rightY);
      this.visionGraphics.closePath();
      this.visionGraphics.fillPath();
      this.visionGraphics.strokePath();
    }
  }

  private updateCameraAnchor(): void {
    if (!this.cameraTarget) {
      return;
    }

    const living = this.players.filter((player) => player.alive);
    if (living.length === 0) {
      return;
    }

    const total = living.reduce(
      (sum, player) => ({ x: sum.x + player.sprite.x, y: sum.y + player.sprite.y }),
      { x: 0, y: 0 },
    );

    const focusX = total.x / living.length;
    const focusY = total.y / living.length;
    const highGroundPlayer = living.find((player) => this.isPlayerUsingHighGround(player));
    if (highGroundPlayer) {
      const ahead = highGroundPlayer.aim.lengthSq() > 0
        ? highGroundPlayer.aim.clone().normalize()
        : new Phaser.Math.Vector2(1, 0);
      const height = this.getTerrainAt(highGroundPlayer.sprite.x, highGroundPlayer.sprite.y)?.height ?? 2;
      this.cameraTarget.setPosition(focusX + ahead.x * (150 + height * 44), focusY + ahead.y * (70 + height * 18));
      this.setCameraZoomForViewRange(height);
      return;
    }

    this.cameraTarget.setPosition(focusX, focusY);
    this.setCameraZoomForViewRange(0);
  }

  private keepActorsInsideVisiblePlayfield(): void {
    if (!this.stage) {
      return;
    }

    const view = this.cameras.main.worldView;
    const inset = 30;
    const minX = Math.max(inset, view.x + inset);
    const maxX = Math.min(this.stage.worldWidth - inset, view.right - inset);
    const minY = Math.max(inset, view.y + inset);
    const maxY = Math.min(this.stage.worldHeight - inset, view.bottom - inset);

    if (minX >= maxX || minY >= maxY) {
      return;
    }

    for (const player of this.players) {
      if (!player.alive) {
        continue;
      }

      const vehicle = player.vehicle?.active ? player.vehicle : undefined;
      if (vehicle?.driver === player) {
        this.clampBodyToVisiblePlayfield(vehicle.body, minX, maxX, minY, maxY);
        player.sprite.setPosition(vehicle.body.x, vehicle.body.y);
        (player.sprite.body as Phaser.Physics.Arcade.Body).reset(vehicle.body.x, vehicle.body.y);
        continue;
      }

      this.clampBodyToVisiblePlayfield(player.sprite, minX, maxX, minY, maxY);
    }
  }

  private clampBodyToVisiblePlayfield(
    object: Phaser.GameObjects.Components.Transform & {
      body: unknown;
    },
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
  ): void {
    const clampedX = Phaser.Math.Clamp(object.x, minX, maxX);
    const clampedY = Phaser.Math.Clamp(object.y, minY, maxY);
    const changedX = clampedX !== object.x;
    const changedY = clampedY !== object.y;
    if (!changedX && !changedY) {
      return;
    }

    const body = object.body as Phaser.Physics.Arcade.Body | undefined;
    body?.reset(clampedX, clampedY);
    if (changedX) {
      body?.setVelocityX(0);
    }
    if (changedY) {
      body?.setVelocityY(0);
    }
    object.setPosition(clampedX, clampedY);
  }

  private isPlayerUsingHighGround(player: PlayerUnit): boolean {
    const terrain = this.getTerrainAt(player.sprite.x, player.sprite.y);
    if (terrain?.effect === 'high') {
      return true;
    }

    if (this.time.now >= player.jumpUntil) {
      return false;
    }

    const landingX = player.sprite.x + player.jumpVector.x * 42;
    const landingY = player.sprite.y + player.jumpVector.y * 42;
    return this.getTerrainAt(landingX, landingY)?.effect === 'high';
  }

  private setCameraZoomForViewRange(height: number): void {
    const minPlayableZoom = this.getMinimumPlayableZoom();
    const targetZoom = height > 0
      ? Math.max(minPlayableZoom, this.baseCameraZoom - (height >= 3 ? 0.17 : 0.12))
      : this.baseCameraZoom;
    this.cameras.main.setZoom(Phaser.Math.Linear(this.cameras.main.zoom, targetZoom, 0.08));
  }

  private getMinimumPlayableZoom(): number {
    const stage = this.stage ?? this.director.getSnapshot().currentStage;
    const height = Math.max(1, this.scale.height);
    return Math.min(1, Math.max(0.42, height / Math.max(1, stage.worldHeight - 16)));
  }

  private checkEncounterTriggers(): void {
    if (!this.stage) {
      return;
    }

    const leadX = this.players
      .filter((player) => player.alive)
      .reduce((max, player) => Math.max(max, player.sprite.x), 0);

    const nextEncounter = this.encounterStates.find((state) => !state.triggered);
    if (nextEncounter && leadX >= nextEncounter.config.triggerX) {
      this.triggerEncounter(nextEncounter);
    }

    for (const state of this.encounterStates) {
      if (!state.triggered || state.cleared || state.remaining > 0) {
        continue;
      }

      state.cleared = true;
      this.encounterCount += 1;
      this.activeEncounterLabel = `${state.config.label} secure`;
      for (const player of this.players) {
        if (player.alive) {
          player.bombs = Math.min(player.bombs + 1, 5);
        }
      }
      this.showBanner('Zone clear. Air Strike restocked.', '#f1d486');
    }

    this.allEncountersCleared = this.encounterStates.every((state) => state.cleared);
    if (this.allEncountersCleared && !this.bossSpawned) {
      this.activeEncounterLabel = 'Advance to the boss zone';
    }

    if (this.allEncountersCleared && !this.bossSpawned && leadX >= this.stage.bossTriggerX) {
      this.spawnBoss();
    }
  }

  private triggerEncounter(state: EncounterState): void {
    state.triggered = true;
    state.remaining = this.getEncounterEnemyTotal(state.config);
    this.activeEncounterLabel = state.config.label;
    this.showBanner(state.config.label, '#f3d088');

    state.config.enemies.forEach((spawn, index) => {
      const door = this.spawnDoors.get(spawn.id);
      this.time.delayedCall(index * 360, () => {
        this.spawnEnemy(spawn.kind, spawn.id, door?.x ?? spawn.x, door?.y ?? spawn.y, state.config.id, spawn.x, spawn.y);
        if (spawn.kind === 'zombie') {
          const duplicateOffset = index % 2 === 0 ? -42 : 42;
          this.time.delayedCall(180, () => {
            this.spawnEnemy(
              'zombie',
              `${spawn.id}-extra`,
              door?.x ?? spawn.x + duplicateOffset,
              door?.y ?? spawn.y,
              state.config.id,
              Phaser.Math.Clamp(spawn.x + duplicateOffset, 48, (this.stage?.worldWidth ?? 2600) - 48),
              Phaser.Math.Clamp(spawn.y + (index % 3 - 1) * 34, 60, (this.stage?.worldHeight ?? 920) - 60),
            );
          });
        }
      });
      if (door) {
        this.flashSpawnDoor(door);
      }
    });
  }

  private getEncounterEnemyTotal(encounter: EncounterConfig): number {
    const zombies = encounter.enemies.filter((enemy) => enemy.kind === 'zombie').length;
    return encounter.enemies.length + zombies;
  }

  private flashSpawnDoor(door: SpawnDoor): void {
    this.tweens.add({
      targets: door.house,
      alpha: 0.55,
      duration: 120,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeInOut',
    });
  }

  private spawnEnemy(
    kind: EnemyKind,
    id: string,
    x: number,
    y: number,
    encounterId: string,
    targetX = x,
    targetY = y,
  ): void {
    if (!this.playing && encounterId !== 'boss-support') {
      return;
    }
    const theme = this.stage?.theme ?? 'emerald';
    const sprite = this.physics.add.sprite(x, y, getEnemyTextureKey(theme, kind, 'stand'), 0);
    sprite.setDepth(kind === 'turret' ? 8 : 11);
    sprite.setCollideWorldBounds(true);
    if (kind === 'zombie') {
      sprite.setScale(0.84);
      sprite.setTint(0x9bdc73);
    } else if (kind === 'scout') {
      sprite.setScale(0.72);
      sprite.setTint(0x93ffcb);
    } else if (this.isMountedEnemy(kind)) {
      sprite.setScale(kind === 'tankRaider' ? 0.64 : 0.7);
      sprite.setTint(kind === 'tankRaider' ? 0xffc17d : kind === 'jeepRaider' ? 0xff9f5c : 0xff795c);
      sprite.setDepth(14);
    }
    this.configureBody(
      sprite,
      kind === 'tankRaider' ? 76 : kind === 'jeepRaider' ? 58 : kind === 'bikeRaider' ? 42 : kind === 'turret' ? 20 : kind === 'zombie' || kind === 'scout' ? 13 : 16,
      kind === 'tankRaider' ? 42 : kind === 'jeepRaider' ? 32 : kind === 'bikeRaider' ? 24 : 14,
    );

    const enemy: EnemyUnit = {
      id,
      kind,
      theme,
      sprite,
      health: kind === 'tankRaider' ? 560 : kind === 'jeepRaider' ? 260 : kind === 'bikeRaider' ? 80 : kind === 'scout' ? 24 : kind === 'zombie' ? 28 : kind === 'turret' ? 130 : kind === 'rocketeer' ? 85 : 50,
      maxHealth: kind === 'tankRaider' ? 560 : kind === 'jeepRaider' ? 260 : kind === 'bikeRaider' ? 80 : kind === 'scout' ? 24 : kind === 'zombie' ? 28 : kind === 'turret' ? 130 : kind === 'rocketeer' ? 85 : 50,
      alive: true,
      moveSpeed: kind === 'bikeRaider' ? 128 : kind === 'jeepRaider' ? 94 : kind === 'tankRaider' ? 54 : kind === 'scout' ? 96 : kind === 'zombie' ? 96 : kind === 'rocketeer' ? 48 : kind === 'turret' ? 0 : 62,
      fireRate: kind === 'tankRaider' ? 1420 : kind === 'jeepRaider' ? 980 : kind === 'bikeRaider' ? 1180 : kind === 'scout' ? 1520 : kind === 'rocketeer' ? 1400 : kind === 'turret' ? 1050 : 900,
      bulletSpeed: kind === 'tankRaider' ? 300 : kind === 'jeepRaider' ? 340 : kind === 'bikeRaider' ? 310 : kind === 'scout' ? 280 : kind === 'rocketeer' ? 265 : kind === 'turret' ? 340 : 300,
      damage: kind === 'tankRaider' ? 22 : kind === 'jeepRaider' ? 14 : kind === 'bikeRaider' ? 10 : kind === 'scout' ? 14 : kind === 'zombie' ? 8 : kind === 'rocketeer' ? 18 : kind === 'turret' ? 12 : 10,
      nextFireAt: this.time.now + Phaser.Math.Between(250, 850),
      fireVisualUntil: 0,
      contactReadyAt: 0,
      encounterId,
      behaviorOffset: Phaser.Math.FloatBetween(0, Math.PI * 2),
    };
    enemy.visualParts = this.createEnemyMountVisualParts(enemy);

    sprite.setData('actorKind', 'enemy');
    sprite.setData('actor', enemy);
    sprite.play(animationKey(getEnemyTextureKey(theme, kind, 'stand')));
    this.enemies.push(enemy);
    this.enemyGroup?.add(sprite);

    if (targetX !== x || targetY !== y) {
      sprite.setAlpha(0.35);
      const body = sprite.body as Phaser.Physics.Arcade.Body;
      body.enable = false;
      this.tweens.add({
        targets: sprite,
        x: targetX,
        y: targetY,
        alpha: 1,
        duration: 520,
        ease: 'Sine.easeOut',
        onComplete: () => {
          if (sprite.active) {
            const activeBody = sprite.body as Phaser.Physics.Arcade.Body;
            activeBody.enable = true;
            activeBody.reset(sprite.x, sprite.y);
          }
        },
      });
    }
  }

  private spawnBoss(): void {
    if (!this.stage) {
      return;
    }

    const configs = this.stage.bosses?.length ? this.stage.bosses : [this.stage.boss];
    configs.forEach((config, index) => this.spawnSingleBoss(config, index));
    this.boss = this.bosses.find((boss) => boss.alive);
    this.bossSpawned = true;
    const names = configs.map((config) => config.name).join(' + ');
    this.activeEncounterLabel = `Boss inbound: ${names}`;
    this.showBanner(`Boss lock: ${names}`, '#ffab7b');
  }

  private spawnSingleBoss(config: BossConfig, index: number): void {
    const sprite = this.physics.add.sprite(config.x, config.y, getBossTextureKey(config.kind), 0);
    sprite.setDepth(13);
    sprite.setCollideWorldBounds(true);
    this.configureBody(sprite, 72, 40);
    sprite.setFrame(0);
    sprite.setAlpha(0.18);
    sprite.setTint(config.kind === 'gunship' ? 0xb8e8ff : config.kind === 'barge' ? 0xffd694 : 0xf0d36b);

    const boss: BossUnit = {
      config,
      sprite,
      visualParts: [],
      health: config.health,
      maxHealth: config.health,
      alive: true,
      nextFireAt: this.time.now + 600,
      nextSummonAt: this.time.now + (config.summonEveryMs ?? 999999),
      fireVisualUntil: 0,
      contactReadyAt: 0,
      direction: index % 2 === 0 ? -1 : 1,
    };

    boss.visualParts = this.createBossVisualParts(boss);
    this.syncBossVisuals(boss);

    sprite.setData('actorKind', 'boss');
    sprite.setData('actor', boss);
    this.bossGroup?.add(sprite);
    this.bosses.push(boss);
  }

  private createBossVisualParts(boss: BossUnit): VehicleVisualPart[] {
    const parts: VehicleVisualPart[] = [];
    const addShape = (
      object: Phaser.GameObjects.Shape,
      offsetX: number,
      offsetY: number,
      rotationOffset: number,
      baseTint: number,
      brokenTint: number,
      alpha: number,
      spinSpeed = 0,
    ): void => {
      object.setDepth(15);
      object.setFillStyle(baseTint, alpha);
      parts.push({ object, offsetX, offsetY, rotationOffset, baseTint, brokenTint, alpha, spinSpeed });
    };
    const addRect = (
      offsetX: number,
      offsetY: number,
      width: number,
      height: number,
      baseTint: number,
      alpha = 0.92,
      rotationOffset = 0,
      spinSpeed = 0,
    ): void => addShape(this.add.rectangle(0, 0, width, height), offsetX, offsetY, rotationOffset, baseTint, 0x2a2624, alpha, spinSpeed);
    const addEllipse = (
      offsetX: number,
      offsetY: number,
      width: number,
      height: number,
      baseTint: number,
      alpha = 0.92,
      rotationOffset = 0,
      spinSpeed = 0,
    ): void => addShape(this.add.ellipse(0, 0, width, height), offsetX, offsetY, rotationOffset, baseTint, 0x2a2624, alpha, spinSpeed);
    const addTriangle = (
      offsetX: number,
      offsetY: number,
      width: number,
      height: number,
      baseTint: number,
      alpha = 0.92,
      rotationOffset = 0,
    ): void => addShape(this.add.triangle(0, 0, width * 0.5, 0, 0, height, width, height), offsetX, offsetY, rotationOffset, baseTint, 0x2a2624, alpha);

    if (boss.config.kind === 'gunship') {
      addEllipse(0, 8, 138, 36, 0x000000, 0.18);
      addEllipse(0, 0, 112, 42, 0x4f6e74, 0.94);
      addEllipse(18, -1, 72, 32, 0x89b8c0, 0.9);
      addRect(-58, 0, 86, 12, 0x43585e, 0.9);
      addEllipse(-101, 0, 28, 22, 0x5b777d, 0.9);
      addRect(6, -5, 168, 8, 0xbff8ff, 0.62, 0, 0.018);
      addRect(6, -5, 8, 148, 0xbff8ff, 0.48, 0, 0.018);
      addRect(35, -25, 34, 12, 0x263138, 0.96);
      addRect(35, 25, 34, 12, 0x263138, 0.96);
      addRect(74, 0, 32, 8, 0xffd46a, 0.96);
      addRect(92, 0, 30, 5, 0x161b1e, 0.96);
      addEllipse(48, -1, 26, 18, 0xeaffff, 0.52);
    } else if (boss.config.kind === 'barge') {
      addEllipse(-6, 12, 132, 34, 0x000000, 0.16);
      addTriangle(52, -32, 78, 64, 0xd2dee3, 0.94, Math.PI * 0.5);
      addRect(-8, 0, 128, 28, 0x7b8990, 0.96);
      addTriangle(-16, -62, 112, 78, 0x50616b, 0.9, 0.08);
      addTriangle(-16, 62, 112, 78, 0x50616b, 0.9, Math.PI - 0.08);
      addRect(6, 0, 82, 12, 0xdcecf0, 0.64);
      addEllipse(-62, -13, 34, 20, 0xff8d4e, 0.76);
      addEllipse(-62, 13, 34, 20, 0xff8d4e, 0.76);
      addRect(58, -17, 26, 7, 0xffd66e, 0.95);
      addRect(58, 17, 26, 7, 0xffd66e, 0.95);
      addEllipse(32, 0, 30, 18, 0xaee8ff, 0.58);
    } else {
      addEllipse(0, 24, 132, 42, 0x000000, 0.18);
      addRect(-4, 20, 110, 34, 0x41525a, 0.96);
      addRect(18, -18, 70, 58, 0x6f7d7f, 0.96);
      addRect(32, -58, 42, 28, 0x4e5d62, 0.96);
      addEllipse(44, -60, 15, 12, 0xffd46a, 0.92);
      addRect(8, -6, 34, 52, 0x2e393e, 0.84);
      addRect(70, -20, 78, 13, 0x1c2428, 0.96);
      addRect(108, -20, 38, 8, 0xffb35c, 0.96);
      addRect(58, 34, 46, 16, 0x2b353a, 0.94);
      addRect(-30, 34, 46, 16, 0x2b353a, 0.94);
      addRect(-50, -10, 34, 62, 0x4a575c, 0.9, 0.12);
      addRect(76, 16, 38, 16, 0x4a575c, 0.9, -0.08);
      addRect(-22, 49, 34, 14, 0xffd46a, 0.72);
      addRect(62, 49, 34, 14, 0xffd46a, 0.72);
    }

    return parts;
  }

  private firePlayerWeapon(player: PlayerUnit, time: number): void {
    let direction = player.aim.clone();

    if (direction.lengthSq() === 0) {
      direction.set(1, 0);
    }

    direction.normalize();
    const weapon = this.getCurrentWeapon(player);
    if (!this.consumeWeaponAmmo(player, weapon, time)) {
      return;
    }

    direction = this.applyWeaponAimAssist(player, weapon, direction);
    direction = this.keepShotInsideStage(player.sprite.x, player.sprite.y, direction);
    player.aim.copy(direction);
    player.fireVisualUntil = time + 180;
    const muzzle = this.findClearBulletStart(
      player.sprite.x + direction.x * 26,
      player.sprite.y + direction.y * 26,
      direction,
    );
    const startX = muzzle.x;
    const startY = muzzle.y;
    this.createMuzzleFlash(startX, startY, direction, weapon.tint);

    if (weapon.kind === 'laser') {
      this.fireLaserBeam(startX, startY, direction, weapon);
      player.nextFireAt = time + weapon.fireRate;
      return;
    }

    const pelletCount = weapon.pellets;
    for (let pellet = 0; pellet < pelletCount; pellet += 1) {
      const offset = pelletCount === 1
        ? 0
        : Phaser.Math.Linear(-weapon.spread, weapon.spread, pellet / (pelletCount - 1));
      const pelletDirection = direction.clone().rotate(offset + Phaser.Math.FloatBetween(-weapon.spread * 0.15, weapon.spread * 0.15));
      this.firePlayerBullet(
        startX,
        startY,
        pelletDirection,
        weapon.bulletSpeed,
        weapon.damage,
        weapon.tint,
        weapon.maxDistance,
        weapon.scaleX,
        weapon.scaleY,
        weapon.splashRadius,
        weapon.splashDamage,
        weapon.poisonRadius,
        weapon.poisonDamage,
        weapon.pierceCount,
        weapon.dropStartRatio,
        weapon.tracerDistance,
        weapon.projectileTexture,
      );
    }
    player.nextFireAt = time + weapon.fireRate;
  }

  private applyWeaponAimAssist(
    player: PlayerUnit,
    weapon: WeaponSpec,
    direction: Phaser.Math.Vector2,
  ): Phaser.Math.Vector2 {
    const baseDirection = direction.clone().normalize();
    let shouldAssist = false;
    const isRhythmAssistWeapon = weapon.kind === 'rifle' || weapon.kind === 'machineGun';

    if (weapon.kind === 'sniper') {
      shouldAssist = true;
    } else if (isRhythmAssistWeapon) {
      player.aimAssistShots += 1;
      if (player.aimAssistShots >= 2) {
        shouldAssist = true;
        player.aimAssistShots = 0;
        player.rifleAimAssistEvery = 2;
      }
    } else if (weapon.pellets === 1) {
      shouldAssist = true;
    }

    if (!shouldAssist) {
      return baseDirection;
    }

    const target = this.findAimAssistTarget(player.sprite.x, player.sprite.y, baseDirection, weapon);
    if (!target) {
      return baseDirection;
    }

    return new Phaser.Math.Vector2(target.x - player.sprite.x, target.y - player.sprite.y).normalize();
  }

  private findAimAssistTarget(
    x: number,
    y: number,
    direction: Phaser.Math.Vector2,
    weapon: WeaponSpec,
  ): { x: number; y: number } | undefined {
    const aimAngle = direction.angle();
    let bestTarget: { x: number; y: number } | undefined;
    let bestScore = Number.POSITIVE_INFINITY;

    const considerTarget = (targetX: number, targetY: number, radius: number): void => {
      const distance = Phaser.Math.Distance.Between(x, y, targetX, targetY);
      if (distance > weapon.maxDistance + radius || distance < 10) {
        return;
      }

      if (!this.hasLineOfSight(x, y, targetX, targetY)) {
        return;
      }

      const angle = Phaser.Math.Angle.Between(x, y, targetX, targetY);
      const angleDiff = Math.abs(Phaser.Math.Angle.Wrap(angle - aimAngle));
      const threshold = this.getDistanceScaledAimAssistThreshold(weapon, distance, radius);
      if (angleDiff > threshold) {
        return;
      }

      const score = distance + (angleDiff / Math.max(threshold, 0.001)) * 80;
      if (score < bestScore) {
        bestScore = score;
        bestTarget = { x: targetX, y: targetY };
      }
    };

    for (const enemy of this.enemies) {
      if (enemy.alive) {
        considerTarget(enemy.sprite.x, enemy.sprite.y, 28);
      }
    }

    for (const boss of this.bosses) {
      if (boss.alive) {
        considerTarget(boss.sprite.x, boss.sprite.y, 64);
      }
    }

    return bestTarget;
  }

  private getDistanceScaledAimAssistThreshold(
    weapon: WeaponSpec,
    distance: number,
    targetRadius: number,
  ): number {
    const effectiveDistance = Math.max(0, distance - targetRadius);
    const closeLimit = weapon.kind === 'sniper' ? 280 : 250;
    const mediumLimit = weapon.kind === 'sniper' ? 760 : 620;

    if (weapon.kind === 'sniper') {
      if (effectiveDistance <= closeLimit) {
        return Phaser.Math.DegToRad(38);
      }
      if (effectiveDistance <= mediumLimit) {
        return Phaser.Math.DegToRad(22);
      }
      return Phaser.Math.DegToRad(12);
    }

    // Single-shot weapons still need aim forgiveness for stepped input, but less than the sniper.
    if (effectiveDistance <= closeLimit) {
      return Phaser.Math.DegToRad(30);
    }
    if (effectiveDistance <= mediumLimit) {
      return Phaser.Math.DegToRad(16);
    }
    return Phaser.Math.DegToRad(8);
  }

  private findClearBulletStart(x: number, y: number, direction: Phaser.Math.Vector2): { x: number; y: number } {
    const stage = this.stage ?? this.director.getSnapshot().currentStage;
    const inset = 14;
    for (let step = 0; step < 8; step += 1) {
      const candidateX = Phaser.Math.Clamp(x + direction.x * step * 14, inset, stage.worldWidth - inset);
      const candidateY = Phaser.Math.Clamp(y + direction.y * step * 14, inset, stage.worldHeight - inset);
      const blocked = this.obstacleBodies.some((obstacle) => {
        const bounds = obstacle.getBounds();
        Phaser.Geom.Rectangle.Inflate(bounds, 8, 8);
        return bounds.contains(candidateX, candidateY);
      });

      if (!blocked) {
        return { x: candidateX, y: candidateY };
      }
    }

    return {
      x: Phaser.Math.Clamp(x, inset, stage.worldWidth - inset),
      y: Phaser.Math.Clamp(y, inset, stage.worldHeight - inset),
    };
  }

  private keepShotInsideStage(
    x: number,
    y: number,
    direction: Phaser.Math.Vector2,
  ): Phaser.Math.Vector2 {
    const stage = this.stage ?? this.director.getSnapshot().currentStage;
    const safe = direction.clone();
    const edgePadding = 46;

    if (y > stage.worldHeight - edgePadding && safe.y > 0.18) {
      safe.y = 0;
    } else if (y < edgePadding && safe.y < -0.18) {
      safe.y = 0;
    }

    if (x > stage.worldWidth - edgePadding && safe.x > 0.18) {
      safe.x = 0;
    } else if (x < edgePadding && safe.x < -0.18) {
      safe.x = 0;
    }

    if (safe.lengthSq() < 0.01) {
      safe.set(x > stage.worldWidth * 0.5 ? -1 : 1, 0);
    }

    return safe.normalize();
  }

  private getCurrentWeapon(player: PlayerUnit): WeaponSpec {
    return WEAPONS[player.weapons[player.weaponIndex] ?? 'rifle'];
  }

  private getAmmoLabel(player: PlayerUnit, weaponKind: WeaponKind): string {
    const weapon = WEAPONS[weaponKind];
    if (weapon.maxAmmo < 0) {
      return 'inf';
    }

    return String(Math.max(0, player.ammo[weaponKind] ?? 0));
  }

  private consumeWeaponAmmo(player: PlayerUnit, weapon: WeaponSpec, time: number): boolean {
    if (weapon.maxAmmo < 0 || weapon.ammoCost <= 0) {
      return true;
    }

    const available = player.ammo[weapon.kind] ?? 0;
    if (available >= weapon.ammoCost) {
      player.ammo[weapon.kind] = available - weapon.ammoCost;
      if (player.ammo[weapon.kind] < weapon.ammoCost) {
        this.switchToPreviousAvailableWeapon(player, weapon);
      }
      return true;
    }

    player.nextFireAt = time + 340;
    this.switchToPreviousAvailableWeapon(player, weapon);
    this.emitHud('live');
    return false;
  }

  private switchToPreviousAvailableWeapon(player: PlayerUnit, exhaustedWeapon: WeaponSpec): void {
    const currentIndex = Math.max(0, player.weapons.indexOf(exhaustedWeapon.kind));
    for (let index = currentIndex - 1; index >= 0; index -= 1) {
      const candidate = WEAPONS[player.weapons[index]];
      if (candidate.maxAmmo < 0 || (player.ammo[candidate.kind] ?? 0) >= Math.max(1, candidate.ammoCost)) {
        player.weaponIndex = index;
        this.showBanner(`${exhaustedWeapon.label} empty. Switching to ${candidate.label}.`, player.accent);
        this.emitHud('live');
        return;
      }
    }

    player.weaponIndex = Math.max(0, player.weapons.indexOf('rifle'));
    this.showBanner(`${exhaustedWeapon.label} empty. Switching to Rifle.`, player.accent);
    this.emitHud('live');
  }

  private switchWeapon(player: PlayerUnit): void {
    if (player.weapons.length <= 1) {
      this.showBanner('Find weapon crates to unlock more guns.', player.accent);
      return;
    }

    for (let step = 1; step <= player.weapons.length; step += 1) {
      const nextIndex = (player.weaponIndex + step) % player.weapons.length;
      const nextWeapon = WEAPONS[player.weapons[nextIndex]];
      if (nextWeapon.maxAmmo < 0 || (player.ammo[nextWeapon.kind] ?? 0) > 0) {
        player.weaponIndex = nextIndex;
        break;
      }
    }
    this.showBanner(`${player.label} switched to ${this.getCurrentWeapon(player).label}`, player.accent);
    this.emitHud('live');
  }

  private activateBarrage(player: PlayerUnit, time: number): void {
    player.bombs -= 1;
    player.nextSpecialAt = time + 2600;
    const radius = 220;

    const blast = this.add.image(player.sprite.x, player.sprite.y, 'blast-circle');
    blast.setTint(player.tint);
    blast.setAlpha(0.34);
    blast.setDepth(18);
    blast.setScale(0.1);
    blast.setBlendMode(Phaser.BlendModes.ADD);

    const rangeRing = this.add.circle(player.sprite.x, player.sprite.y, radius, player.tint, 0.12);
    rangeRing.setDepth(17);
    rangeRing.setStrokeStyle(5, 0xfff2c4, 0.82);
    rangeRing.setBlendMode(Phaser.BlendModes.ADD);

    const warningRing = this.add.circle(player.sprite.x, player.sprite.y, radius * 0.72, 0xfff2c4, 0);
    warningRing.setDepth(18);
    warningRing.setStrokeStyle(3, player.tint, 0.9);
    warningRing.setBlendMode(Phaser.BlendModes.ADD);

    const label = this.add.text(player.sprite.x, player.sprite.y - radius - 18, 'BOMB AREA', {
      fontFamily: 'Impact, Haettenschweiler, sans-serif',
      fontSize: '24px',
      color: '#fff2c4',
      stroke: '#3b170b',
      strokeThickness: 5,
      letterSpacing: 2,
    }).setOrigin(0.5).setDepth(21);

    this.tweens.add({
      targets: blast,
      scale: radius / 10,
      alpha: 0,
      duration: 420,
      onComplete: () => blast.destroy(),
    });

    this.tweens.add({
      targets: [rangeRing, warningRing],
      scale: 1.08,
      alpha: 0,
      duration: 1150,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        rangeRing.destroy();
        warningRing.destroy();
      },
    });

    this.tweens.add({
      targets: label,
      y: label.y - 22,
      alpha: 0,
      duration: 1000,
      ease: 'Quad.easeOut',
      onComplete: () => label.destroy(),
    });

    for (let puffIndex = 0; puffIndex < 14; puffIndex += 1) {
      const angle = (Math.PI * 2 * puffIndex) / 14;
      const distance = radius * Phaser.Math.FloatBetween(0.35, 0.96);
      const puff = this.add.image(
        player.sprite.x + Math.cos(angle) * distance,
        player.sprite.y + Math.sin(angle) * distance,
        'blast-circle',
      );
      puff.setTint(0xb8b09a);
      puff.setAlpha(0.18);
      puff.setDepth(16);
      puff.setScale(Phaser.Math.FloatBetween(1.4, 2.6));
      this.tweens.add({
        targets: puff,
        scale: puff.scaleX * 1.7,
        alpha: 0,
        duration: 1200 + puffIndex * 26,
        ease: 'Sine.easeOut',
        onComplete: () => puff.destroy(),
      });
    }

    this.cameras.main.shake(120, 0.005);
    for (const enemy of this.enemies) {
      if (enemy.alive && Phaser.Math.Distance.Between(player.sprite.x, player.sprite.y, enemy.sprite.x, enemy.sprite.y) < radius) {
        this.damageEnemy(enemy, 70);
      }
    }

    for (const boss of this.bosses) {
      if (boss.alive && Phaser.Math.Distance.Between(player.sprite.x, player.sprite.y, boss.sprite.x, boss.sprite.y) < radius + 40) {
        this.damageBoss(boss, 60);
      }
    }
  }

  private firePlayerBullet(
    x: number,
    y: number,
    direction: Phaser.Math.Vector2,
    speed: number,
    damage: number,
    tint: number,
    maxDistance: number,
    scaleX: number,
    scaleY: number,
    splashRadius?: number,
    splashDamage?: number,
    poisonRadius?: number,
    poisonDamage?: number,
    pierceCount?: number,
    dropStartRatio?: number,
    tracerDistance?: number,
    projectileTexture = 'bullet-shell',
  ): void {
    const bullet = this.physics.add.image(x, y, projectileTexture);
    bullet.setTint(tint);
    bullet.setDepth(16);
    bullet.setScale(scaleX, scaleY);
    bullet.setBlendMode(Phaser.BlendModes.ADD);
    bullet.setData('baseScaleX', bullet.scaleX);
    bullet.setData('baseScaleY', bullet.scaleY);
    bullet.setData('baseTint', tint);
    this.configureBulletBody(bullet, direction, speed, maxDistance, dropStartRatio);
    bullet.setRotation(direction.angle());
    bullet.setData('damage', damage);
    bullet.setData('splashRadius', splashRadius ?? 0);
    bullet.setData('splashDamage', splashDamage ?? 0);
    bullet.setData('poisonRadius', poisonRadius ?? 0);
    bullet.setData('poisonDamage', poisonDamage ?? 0);
    bullet.setData('splashTint', tint);
    bullet.setData('pierceRemaining', pierceCount ?? 1);
    bullet.setData('hitTargets', []);
    bullet.setData('expiry', this.time.now + (pierceCount && pierceCount > 1 ? 4200 : 2600));
    this.playerBullets?.add(bullet);
    this.createBulletTracer(x, y, direction, tint, tracerDistance ?? Math.min(340, maxDistance * 0.46), 520);
  }

  private fireLaserBeam(
    x: number,
    y: number,
    direction: Phaser.Math.Vector2,
    weapon: WeaponSpec,
  ): void {
    const endX = x + direction.x * weapon.maxDistance;
    const endY = y + direction.y * weapon.maxDistance;
    const beam = this.add.rectangle(
      x + direction.x * weapon.maxDistance * 0.5,
      y + direction.y * weapon.maxDistance * 0.5,
      weapon.maxDistance,
      weapon.beamWidth ?? 24,
      weapon.tint,
      0.62,
    );
    beam.setDepth(17);
    beam.setOrigin(0.5);
    beam.setRotation(direction.angle());
    beam.setBlendMode(Phaser.BlendModes.ADD);

    const core = this.add.rectangle(
      x + direction.x * weapon.maxDistance * 0.5,
      y + direction.y * weapon.maxDistance * 0.5,
      weapon.maxDistance,
      Math.max(6, (weapon.beamWidth ?? 24) * 0.32),
      0xffffff,
      0.78,
    );
    core.setDepth(18);
    core.setOrigin(0.5);
    core.setRotation(direction.angle());
    core.setBlendMode(Phaser.BlendModes.ADD);

    this.tweens.add({
      targets: [beam, core],
      alpha: 0,
      duration: 170,
      ease: 'Quad.easeOut',
      onComplete: () => {
        beam.destroy();
        core.destroy();
      },
    });

    this.damageActorsAlongBeam(x, y, endX, endY, weapon);
  }

  private damageActorsAlongBeam(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    weapon: WeaponSpec,
  ): void {
    const beamWidth = weapon.beamWidth ?? 24;

    for (const enemy of this.enemies) {
      if (!enemy.alive) {
        continue;
      }

      const distance = this.distanceToLineSegment(enemy.sprite.x, enemy.sprite.y, startX, startY, endX, endY);
      if (distance <= beamWidth * 0.5 + 14) {
        this.createHitSpark(enemy.sprite.x, enemy.sprite.y, weapon.tint, `-${weapon.damage}`);
        this.damageEnemy(enemy, weapon.damage);
      }
    }

    for (const boss of this.bosses) {
      if (!boss.alive) {
        continue;
      }

      const distance = this.distanceToLineSegment(boss.sprite.x, boss.sprite.y, startX, startY, endX, endY);
      if (distance <= beamWidth * 0.5 + 42) {
        this.createHitSpark(boss.sprite.x, boss.sprite.y, weapon.tint, `-${weapon.damage}`);
        this.damageBoss(boss, weapon.damage);
      }
    }
  }

  private createMuzzleFlash(
    x: number,
    y: number,
    direction: Phaser.Math.Vector2,
    tint: number,
  ): void {
    const flash = this.add.circle(x + direction.x * 8, y + direction.y * 8, 10, tint, 0.72);
    flash.setDepth(18);
    flash.setBlendMode(Phaser.BlendModes.ADD);

    this.tweens.add({
      targets: flash,
      scale: 1.9,
      alpha: 0,
      duration: 90,
      ease: 'Quad.easeOut',
      onComplete: () => flash.destroy(),
    });
  }

  private createBulletTracer(
    x: number,
    y: number,
    direction: Phaser.Math.Vector2,
    tint: number,
    distance: number,
    duration: number,
  ): void {
    const tracer = this.add.rectangle(
      x - direction.x * 8,
      y - direction.y * 8,
      28,
      5,
      tint,
      0.55,
    );
    tracer.setDepth(15);
    tracer.setRotation(direction.angle());
    tracer.setBlendMode(Phaser.BlendModes.ADD);

    this.tweens.add({
      targets: tracer,
      x: x + direction.x * distance,
      y: y + direction.y * distance,
      alpha: 0,
      duration,
      ease: 'Quad.easeOut',
      onComplete: () => tracer.destroy(),
    });
  }

  private fireEnemyBullet(
    x: number,
    y: number,
    direction: Phaser.Math.Vector2,
    speed: number,
    damage: number,
    tint: number,
  ): void {
    const bullet = this.physics.add.image(x, y, 'bullet-shell');
    bullet.setTint(tint);
    bullet.setDepth(15);
    bullet.setScale(1.45, 1.15);
    bullet.setBlendMode(Phaser.BlendModes.ADD);
    bullet.setData('baseScaleX', bullet.scaleX);
    bullet.setData('baseScaleY', bullet.scaleY);
    bullet.setData('baseTint', tint);
    this.configureBulletBody(bullet, direction, speed, 720);
    bullet.setRotation(direction.angle());
    bullet.setData('damage', damage);
    bullet.setData('expiry', this.time.now + 2200);
    this.enemyBullets?.add(bullet);
    this.createMuzzleFlash(x, y, direction, tint);
    this.createBulletTracer(x, y, direction, tint, 180, 360);
  }

  private fireEnemyPoisonDart(enemy: EnemyUnit, direction: Phaser.Math.Vector2): void {
    const tint = 0x8cff6a;
    const startX = enemy.sprite.x + direction.x * 14;
    const startY = enemy.sprite.y + direction.y * 14;
    const dartDirection = direction.clone().rotate(Phaser.Math.FloatBetween(-0.08, 0.08));
    const bullet = this.physics.add.image(startX, startY, 'bullet-shell');
    bullet.setTint(tint);
    bullet.setDepth(15);
    bullet.setScale(1.08, 0.82);
    bullet.setBlendMode(Phaser.BlendModes.ADD);
    bullet.setData('baseScaleX', bullet.scaleX);
    bullet.setData('baseScaleY', bullet.scaleY);
    bullet.setData('baseTint', tint);
    this.configureBulletBody(bullet, dartDirection, enemy.bulletSpeed, 680, 0.88);
    bullet.setRotation(dartDirection.angle());
    bullet.setData('damage', enemy.damage);
    bullet.setData('poison', true);
    bullet.setData('expiry', this.time.now + 2300);
    this.enemyBullets?.add(bullet);
    this.createMuzzleFlash(startX, startY, dartDirection, tint);
    this.createBulletTracer(startX, startY, dartDirection, tint, 120, 300);
  }

  private configureBulletBody(
    bullet: Phaser.Physics.Arcade.Image,
    direction: Phaser.Math.Vector2,
    speed: number,
    maxDistance: number,
    dropStartRatio = 0.78,
  ): void {
    const body = bullet.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setSize(10, 5);
    body.setOffset((bullet.width - 10) * 0.5, (bullet.height - 5) * 0.5);
    body.setVelocity(0, 0);
    bullet.setData('originX', bullet.x);
    bullet.setData('originY', bullet.y);
    bullet.setData('velocityX', direction.x * speed);
    bullet.setData('velocityY', direction.y * speed);
    bullet.setData('maxDistance', maxDistance);
    bullet.setData('baseMaxDistance', maxDistance);
    bullet.setData('baseDropStartRatio', dropStartRatio);
    bullet.setData('dropStartDistance', maxDistance * dropStartRatio);
  }

  private fireBossPattern(boss: BossUnit, baseAngle: number): void {
    const lowHealth = boss.health / boss.maxHealth < 0.45;
    if (boss.config.kind === 'gunship') {
      const offsets = lowHealth ? [-0.42, -0.28, -0.14, 0, 0.14, 0.28, 0.42] : [-0.3, -0.15, 0, 0.15, 0.3];
      for (const offset of offsets) {
        this.fireEnemyBullet(
          boss.sprite.x + Math.cos(baseAngle) * 30,
          boss.sprite.y + Math.sin(baseAngle) * 30,
          new Phaser.Math.Vector2(1, 0).setToPolar(baseAngle + offset, 1),
          boss.config.bulletSpeed,
          12,
          0xff8a6f,
        );
      }
      return;
    }

    if (boss.config.kind === 'barge') {
      const shots = lowHealth ? 8 : 6;
      for (let step = 0; step < shots; step += 1) {
        const angle = baseAngle - 0.42 + step * (0.84 / Math.max(1, shots - 1));
        this.fireEnemyBullet(
          boss.sprite.x + Math.cos(angle) * 28,
          boss.sprite.y + Math.sin(angle) * 28,
          new Phaser.Math.Vector2(1, 0).setToPolar(angle, 1),
          boss.config.bulletSpeed,
          14,
          0x9cf5f3,
        );
      }
      return;
    }

    const tankOffsets = lowHealth ? [-0.32, -0.16, 0, 0.16, 0.32] : [-0.18, 0, 0.18];
    for (const offset of tankOffsets) {
      const angle = baseAngle + offset;
      this.fireEnemyBullet(
        boss.sprite.x + Math.cos(angle) * 34,
        boss.sprite.y + Math.sin(angle) * 34,
        new Phaser.Math.Vector2(1, 0).setToPolar(angle, 1),
        boss.config.bulletSpeed,
        18,
        0xff8457,
      );
    }
  }

  private summonBossSupport(boss: BossUnit): void {
    if (!this.stage) {
      return;
    }

    if (boss.config.kind === 'gunship') {
      this.spawnEnemy('rifleman', `support-${this.time.now}-a`, this.stage.worldWidth - 340, 520, 'boss-support');
      this.spawnEnemy('rifleman', `support-${this.time.now}-b`, this.stage.worldWidth - 280, 620, 'boss-support');
      this.showBanner('Gunship dropping reinforcements', '#ffb188');
      return;
    }

    if (boss.config.kind === 'barge') {
      this.spawnEnemy('rocketeer', `support-${this.time.now}-a`, this.stage.worldWidth - 340, 260, 'boss-support');
      this.spawnEnemy('rifleman', `support-${this.time.now}-b`, this.stage.worldWidth - 290, 720, 'boss-support');
      this.showBanner('River armor dispatching support', '#a4faf8');
      return;
    }

    this.spawnEnemy('rifleman', `support-${this.time.now}-a`, this.stage.worldWidth - 430, 240, 'boss-support');
    this.spawnEnemy('rifleman', `support-${this.time.now}-b`, this.stage.worldWidth - 430, 720, 'boss-support');
    this.spawnEnemy('rocketeer', `support-${this.time.now}-c`, this.stage.worldWidth - 350, 470, 'boss-support');
    this.showBanner('Command tank calling elite guard', '#ff9c75');
  }

  private handleEnemyHit(bulletObject: Phaser.GameObjects.GameObject, enemyObject: Phaser.GameObjects.GameObject): void {
    const bullet = bulletObject as Phaser.Physics.Arcade.Image;
    const enemy = enemyObject.getData('actor') as EnemyUnit | undefined;
    if (!enemy || !enemy.alive || !bullet.active) {
      return;
    }

    const hitTargets = (bullet.getData('hitTargets') as string[] | undefined) ?? [];
    if (hitTargets.includes(enemy.id)) {
      return;
    }

    hitTargets.push(enemy.id);
    bullet.setData('hitTargets', hitTargets);

    const damage = Number(bullet.getData('damage') ?? 15);
    const impactX = enemy.sprite.x;
    const impactY = enemy.sprite.y;
    this.createHitSpark(impactX, impactY, 0xfff0aa, `-${damage}`);
    this.damageEnemy(enemy, damage);

    const splashRadius = Number(bullet.getData('splashRadius') ?? 0);
    const pierceRemaining = Number(bullet.getData('pierceRemaining') ?? 1);
    if (splashRadius <= 0 && pierceRemaining > 1) {
      bullet.setData('pierceRemaining', pierceRemaining - 1);
      return;
    }

    this.resolvePlayerBulletImpact(bullet, impactX, impactY);
  }

  private handleBossHit(bulletObject: Phaser.GameObjects.GameObject, bossObject: Phaser.GameObjects.GameObject): void {
    const bullet = bulletObject as Phaser.Physics.Arcade.Image;
    const boss = bossObject.getData('actor') as BossUnit | undefined;
    if (!boss || !boss.alive || !bullet.active) {
      return;
    }

    const damage = Number(bullet.getData('damage') ?? 18);
    const impactX = boss.sprite.x;
    const impactY = boss.sprite.y;
    this.createHitSpark(impactX, impactY, 0xff8457, `-${damage}`);
    this.damageBoss(boss, damage);
    this.resolvePlayerBulletImpact(bullet, impactX, impactY);
  }

  private handlePlayerHit(bulletObject: Phaser.GameObjects.GameObject, playerObject: Phaser.GameObjects.GameObject): void {
    const bullet = bulletObject as Phaser.Physics.Arcade.Image;
    const player = playerObject.getData('actor') as PlayerUnit | undefined;
    if (!player || !player.alive || !bullet.active) {
      return;
    }

    if (player.vehicle?.active) {
      this.damageVehicle(player.vehicle, 1);
      this.dropBullet(bullet);
      return;
    }

    const damage = Number(bullet.getData('damage') ?? 10);
    const poison = Boolean(bullet.getData('poison'));
    this.createHitSpark(player.sprite.x, player.sprite.y, poison ? 0x8cff6a : 0xff5b4a, poison ? '-poison' : undefined);
    this.dropBullet(bullet);
    this.damagePlayer(player, damage);
    if (poison && player.alive) {
      this.time.delayedCall(420, () => {
        if (player.alive) {
          this.createHitSpark(player.sprite.x, player.sprite.y, 0x8cff6a, '-tox');
          this.damagePlayer(player, 4);
        }
      });
    }
  }

  private handleObstacleBulletHit(
    bulletObject: Phaser.GameObjects.GameObject,
    obstacleObject: Phaser.GameObjects.GameObject,
  ): void {
    const bullet = bulletObject as Phaser.Physics.Arcade.Image;
    const obstacle = obstacleObject as Phaser.GameObjects.Rectangle;
    if (!bullet.active || !obstacle.active) {
      return;
    }

    const destructible = Boolean(obstacle.getData('destructibleObstacle'));
    if (!destructible) {
      this.destroyBulletObject(bullet);
      return;
    }

    const damage = Math.max(8, Number(bullet.getData('damage') ?? 20));
    const nextHp = Number(obstacle.getData('coverHp') ?? 0) - damage;
    const label = String(obstacle.getData('coverLabel') ?? 'COVER');
    this.resolvePlayerBulletImpact(bullet, bullet.x, bullet.y);

    if (nextHp > 0) {
      obstacle.setData('coverHp', nextHp);
      obstacle.setAlpha(Phaser.Math.Clamp(0.44 + nextHp / 180, 0.44, 0.96));
      this.createHitSpark(obstacle.x, obstacle.y, 0xffd166, `${label} ${Math.ceil(nextHp)}`);
      return;
    }

    this.destroyDestructibleObstacle(obstacle, label);
  }

  private destroyDestructibleObstacle(obstacle: Phaser.GameObjects.Rectangle, label: string, revealReward = true): void {
    this.obstacleBodies = this.obstacleBodies.filter((entry) => entry !== obstacle);
    this.physics.world.disable(obstacle);
    obstacle.setData('destroyedObstacle', true);
    this.createHitSpark(obstacle.x, obstacle.y, 0xfff0aa, `${label} OPEN`);
    if (revealReward) {
      this.revealDestroyedCoverReward(obstacle, label);
    }

    const linkedObjects = obstacle.getData('linkedObjects') as Phaser.GameObjects.GameObject[] | undefined;
    const targets = [obstacle, ...(linkedObjects ?? [])].filter((object) => object.active);
    this.tweens.add({
      targets,
      alpha: 0,
      duration: 360,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        for (const target of targets) {
          target.destroy();
        }
      },
    });
  }

  private revealDestroyedCoverReward(obstacle: Phaser.GameObjects.Rectangle, label: string): void {
    if (label !== 'HUT' && label !== 'BUNKER') {
      return;
    }

    const stage = this.stage ?? this.director.getSnapshot().currentStage;
    const rewardSeed = Math.floor((obstacle.x + obstacle.y + this.getStageNumber(stage) * 31) / 97);
    if (rewardSeed % 3 === 0) {
      this.createHealthPickupBox(obstacle.x, obstacle.y, label === 'BUNKER' ? 50 : 35);
      return;
    }

    if (rewardSeed % 3 === 1) {
      const reward = this.getSupplyCrateWeapon(stage, rewardSeed);
      this.createWeaponPickupCrate(reward, obstacle.x, obstacle.y, stage.id);
      return;
    }

    this.createAirStrikeCallBox(obstacle.x, obstacle.y, 1);
  }

  private handleSupplyCrateHit(bulletObject: Phaser.GameObjects.GameObject, crateObject: Phaser.GameObjects.GameObject): void {
    const bullet = bulletObject as Phaser.Physics.Arcade.Image;
    const crate = crateObject as Phaser.GameObjects.Rectangle;
    if (!crate.active || !bullet.active) {
      return;
    }

    const x = crate.x;
    const y = crate.y;
    const stage = this.stage ?? this.director.getSnapshot().currentStage;
    const crateIndex = Number(crate.getData('crateIndex') ?? 0);
    const linkedObjects = crate.getData('linkedObjects') as Phaser.GameObjects.GameObject[] | undefined;
    linkedObjects?.forEach((object) => object.destroy());
    crate.destroy();
    this.resolvePlayerBulletImpact(bullet, x, y);
    this.createHitSpark(x, y, 0xffe6a8, 'SUPPLY');

    if ((this.getStageNumber(stage) + crateIndex) % 3 === 0) {
      this.createHealthPickupBox(x, y, 45);
      this.showBanner('Supply box opened: health pack', '#f4e6d5');
      return;
    }

    if ((this.getStageNumber(stage) + crateIndex) % 4 === 0) {
      this.createAirStrikeCallBox(x, y, 2);
      this.showBanner('Supply box opened: air strike call', '#d7f6ff');
      return;
    }

    const reward = this.getSupplyCrateWeapon(stage, crateIndex);
    this.createWeaponPickupCrate(reward, x, y, stage.id);
    this.showBanner(`Supply box opened: ${WEAPONS[reward].label}`, '#f4e6d5');
  }

  private getSupplyCrateWeapon(stage: StageConfig, crateIndex: number): WeaponKind {
    const rewards: WeaponKind[] = ['machineGun', 'shotgun', 'flame', 'sniper', 'missile', 'explosiveArrow', 'poisonBomb'];
    return rewards[(this.getStageNumber(stage) + crateIndex) % rewards.length];
  }

  private handleWeaponPickup(playerObject: Phaser.GameObjects.GameObject, pickupObject: Phaser.GameObjects.GameObject): void {
    const player = playerObject.getData('actor') as PlayerUnit | undefined;
    const pickup = pickupObject as Phaser.GameObjects.Rectangle;
    const weaponKind = pickup.getData('weaponKind') as WeaponKind | undefined;
    if (!player || !player.alive || !weaponKind) {
      return;
    }

    const weapon = WEAPONS[weaponKind];
    if (!player.weapons.includes(weaponKind)) {
      player.weapons.push(weaponKind);
    }

    player.ammo[weaponKind] = weapon.maxAmmo < 0
      ? -1
      : Math.min(weapon.maxAmmo, (player.ammo[weaponKind] ?? 0) + weapon.pickupAmmo);
    player.weaponIndex = player.weapons.indexOf(weaponKind);
    const respawnX = Number(pickup.getData('respawnX') ?? pickup.x);
    const respawnY = Number(pickup.getData('respawnY') ?? pickup.y);
    const stageId = String(pickup.getData('stageId') ?? this.stage?.id ?? '');
    const linkedObjects = pickup.getData('linkedObjects') as Phaser.GameObjects.GameObject[] | undefined;
    linkedObjects?.forEach((object) => object.destroy());
    pickup.destroy();
    this.scheduleWeaponPickupRespawn(weaponKind, respawnX, respawnY, stageId);

    this.showBanner(`${player.label} collected ${weapon.label} ammo ${this.getAmmoLabel(player, weaponKind)}`, player.accent);
    this.emitHud('live');
  }

  private scheduleWeaponPickupRespawn(kind: WeaponKind, x: number, y: number, stageId: string): void {
    this.time.delayedCall(120000, () => {
      if (!this.playing || this.stage?.id !== stageId) {
        return;
      }

      this.createWeaponPickupCrate(kind, x, y, stageId);
      this.showBanner(`${WEAPONS[kind].label} ammo crate restocked`, '#f3e6bf');
    });
  }

  private handleHealthPickup(playerObject: Phaser.GameObjects.GameObject, pickupObject: Phaser.GameObjects.GameObject): void {
    const player = playerObject.getData('actor') as PlayerUnit | undefined;
    const pickup = pickupObject as Phaser.GameObjects.Rectangle;
    if (!player || !player.alive || player.health >= player.maxHealth) {
      return;
    }

    const healAmount = Number(pickup.getData('healAmount') ?? 25);
    player.health = Math.min(player.maxHealth, player.health + healAmount);
    const linkedObjects = pickup.getData('linkedObjects') as Phaser.GameObjects.GameObject[] | undefined;
    linkedObjects?.forEach((object) => object.destroy());
    pickup.destroy();
    this.showBanner(`${player.label} healed +${healAmount}`, player.accent);
    this.emitHud('live');
  }

  private handleAirStrikePickup(playerObject: Phaser.GameObjects.GameObject, pickupObject: Phaser.GameObjects.GameObject): void {
    const player = playerObject.getData('actor') as PlayerUnit | undefined;
    const pickup = pickupObject as Phaser.GameObjects.Rectangle;
    if (!player || !player.alive || !pickup.active) {
      return;
    }

    const bombCount = Number(pickup.getData('bombCount') ?? 1);
    player.bombs = Math.min(12, player.bombs + bombCount);
    const linkedObjects = pickup.getData('linkedObjects') as Phaser.GameObjects.GameObject[] | undefined;
    linkedObjects?.forEach((object) => object.destroy());
    pickup.destroy();
    this.showBanner(`${player.label} collected Air Strike Call +${bombCount}`, player.accent);
    this.emitHud('live');
  }

  private handleRescueBunker(playerObject: Phaser.GameObjects.GameObject, bunkerObject: Phaser.GameObjects.GameObject): void {
    const player = playerObject.getData('actor') as PlayerUnit | undefined;
    const bunkerId = String(bunkerObject.getData('rescueBunkerId') ?? '');
    const bunker = this.rescueBunkers.find((entry) => entry.id === bunkerId);
    if (!this.shadowSquadMode || !player?.alive || !bunker || bunker.rescued || !bunker.body.active) {
      return;
    }

    bunker.rescued = true;
    bunker.body.setFillStyle(0x273f36, 0.82);
    bunker.marker.setText('FREE');
    bunker.marker.setColor('#aef7c7');
    bunker.linkedObjects.forEach((object) => {
      (object as unknown as Phaser.GameObjects.Components.Alpha).setAlpha(0.42);
    });
    this.spawnRescuedAlly(bunker.body.x + 44, bunker.body.y, player);
    this.showBanner('Captured soldier rescued. Shadow rifle joined.', player.accent);
    this.emitHud('live');
  }

  private spawnRescuedAlly(x: number, y: number, leader: PlayerUnit): void {
    const id = `ally-${this.allies.length + 1}`;
    const sprite = this.physics.add.sprite(x, y, 'player-idle', 0);
    sprite.setDepth(11);
    sprite.setTint(0x9ed8ff);
    sprite.setAlpha(0.9);
    sprite.setDrag(760, 760);
    sprite.setCollideWorldBounds(true);
    this.configureBody(sprite, 18, 14);
    sprite.play(animationKey('player-idle'));
    this.allyGroup?.add(sprite);

    const label = this.add.text(x, y - 28, `S${this.allies.length + 1}`, {
      fontFamily: 'Impact, Haettenschweiler, sans-serif',
      fontSize: '14px',
      color: '#dff7ff',
      stroke: '#102027',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(12);

    const ally: AllyUnit = {
      id,
      sprite,
      label,
      alive: true,
      nextFireAt: this.time.now + Phaser.Math.Between(220, 620),
      followOffset: new Phaser.Math.Vector2(
        Phaser.Math.Between(-38, 38),
        Phaser.Math.Between(-48, 48),
      ),
    };

    sprite.setData('actorKind', 'ally');
    sprite.setData('actor', ally);
    this.allies.push(ally);
    sprite.setRotation(leader.aim.angle());
  }

  private handleVehicleEntry(playerObject: Phaser.GameObjects.GameObject, vehicleObject: Phaser.GameObjects.GameObject): void {
    const player = playerObject.getData('actor') as PlayerUnit | undefined;
    const vehicle = vehicleObject.getData('vehicle') as VehicleUnit | undefined;
    if (!player || !player.alive || !vehicle?.active || vehicle.driver || player.vehicle) {
      return;
    }

    player.vehicle = vehicle;
    vehicle.driver = player;
    player.sprite.setAlpha(0.46);
    player.sprite.setPosition(vehicle.body.x, vehicle.body.y);
    const boarded = this.boardNearbyAllies(vehicle);
    const teamText = boarded > 0 ? ` ${boarded} rescued soldier${boarded === 1 ? '' : 's'} boarded.` : '';
    this.showBanner(`${player.label} entered ${vehicle.kind.toUpperCase()}.${teamText} Jump exits.`, player.accent);
  }

  private handleVehicleHit(bulletObject: Phaser.GameObjects.GameObject, vehicleObject: Phaser.GameObjects.GameObject): void {
    const bullet = bulletObject as Phaser.Physics.Arcade.Image;
    const vehicle = vehicleObject.getData('vehicle') as VehicleUnit | undefined;
    if (!vehicle?.active || !vehicle.driver || !bullet.active) {
      return;
    }

    this.damageVehicle(vehicle, 1);
    this.dropBullet(bullet);
  }

  private isVehicleOccupied(vehicleObject: Phaser.GameObjects.GameObject): boolean {
    const vehicle = vehicleObject.getData('vehicle') as VehicleUnit | undefined;
    return Boolean(vehicle?.active && vehicle.driver);
  }

  private handleVehicleEnemyContact(vehicleObject: Phaser.GameObjects.GameObject, enemyObject: Phaser.GameObjects.GameObject): void {
    const vehicle = vehicleObject.getData('vehicle') as VehicleUnit | undefined;
    const enemy = enemyObject.getData('actor') as EnemyUnit | undefined;
    if (!vehicle?.active || !vehicle.driver || !enemy?.alive) {
      return;
    }

    this.createHitSpark(enemy.sprite.x, enemy.sprite.y, 0xf4e5a1, '-999');
    this.damageEnemy(enemy, 999);
  }

  private damageVehicle(vehicle: VehicleUnit, amount: number): void {
    if (!vehicle.active) {
      return;
    }

    vehicle.hp -= amount;
    vehicle.body.setFillStyle(0xf0d36b, 0.96);
    this.setVehicleVisualTint(vehicle, 'hit');
    this.time.delayedCall(75, () => {
      if (vehicle.active) {
        vehicle.body.setFillStyle(vehicle.baseTint, 0.2);
        this.setVehicleVisualTint(vehicle, 'base');
      }
    });

    if (vehicle.hp > 0) {
      return;
    }

    vehicle.active = false;
    const driver = vehicle.driver;
    if (driver) {
      this.exitVehicle(driver, false);
    } else {
      this.unloadVehicleAllies(vehicle);
    }
    vehicle.driver = undefined;
    vehicle.passengerAllies = [];
    (vehicle.body.body as Phaser.Physics.Arcade.Body).enable = false;
    vehicle.body.setFillStyle(vehicle.brokenTint, 0.74);
    this.setVehicleVisualTint(vehicle, 'broken');
    vehicle.label.setText('BROKEN');
    vehicle.hpLabel.setText('0');
    this.createExplosion(vehicle.body.x, vehicle.body.y, vehicle.kind === 'tank' ? 95 : vehicle.kind === 'jeep' ? 70 : 48, vehicle.kind === 'tank' ? 55 : vehicle.kind === 'jeep' ? 35 : 20, 0xff8a4a);
  }

  private handleEnemyContact(playerObject: Phaser.GameObjects.GameObject, enemyObject: Phaser.GameObjects.GameObject): void {
    const player = playerObject.getData('actor') as PlayerUnit | undefined;
    const enemy = enemyObject.getData('actor') as EnemyUnit | undefined;
    if (!player || !enemy || !player.alive || !enemy.alive) {
      return;
    }

    if (player.vehicle?.active) {
      return;
    }

    if (this.time.now < player.contactReadyAt || this.time.now < enemy.contactReadyAt) {
      return;
    }

    player.contactReadyAt = this.time.now + 520;
    enemy.contactReadyAt = this.time.now + 520;
    this.damagePlayer(player, enemy.kind === 'rocketeer' ? 12 : 8);
  }

  private handleBossContact(playerObject: Phaser.GameObjects.GameObject, bossObject: Phaser.GameObjects.GameObject): void {
    const player = playerObject.getData('actor') as PlayerUnit | undefined;
    const boss = bossObject.getData('actor') as BossUnit | undefined;
    if (!player || !boss || !player.alive || !boss.alive) {
      return;
    }

    if (this.time.now < player.contactReadyAt || this.time.now < boss.contactReadyAt) {
      return;
    }

    player.contactReadyAt = this.time.now + 550;
    boss.contactReadyAt = this.time.now + 550;
    this.damagePlayer(player, 16);
  }

  private damageEnemy(enemy: EnemyUnit, amount: number): void {
    enemy.health -= amount;
    this.flashSprite(enemy.sprite);
    this.setEnemyVisualTint(enemy, 'hit');
    this.time.delayedCall(75, () => {
      if (enemy.alive) {
        this.setEnemyVisualTint(enemy, 'base');
      }
    });

    if (enemy.health > 0) {
      return;
    }

    enemy.alive = false;
    enemy.sprite.disableBody(false, false);
    enemy.sprite.setVelocity(0, 0);
    enemy.sprite.setDepth(9);
    this.setEnemyVisualTint(enemy, 'broken');
    enemy.visualParts?.forEach((part) => {
      this.tweens.killTweensOf(part.object);
      this.tweens.add({
        targets: part.object,
        alpha: 0,
        duration: 440,
        ease: 'Quad.easeOut',
        onComplete: () => part.object.destroy(),
      });
    });
    this.tweens.killTweensOf(enemy.sprite);
    this.tweens.add({
      targets: enemy.sprite,
      alpha: 0,
      scale: 0.72,
      angle: enemy.sprite.angle + 18,
      duration: 420,
      ease: 'Quad.easeOut',
      onComplete: () => enemy.sprite.destroy(),
    });
    this.director.addScore(enemy.kind === 'tankRaider' ? 360 : enemy.kind === 'jeepRaider' ? 240 : enemy.kind === 'bikeRaider' ? 150 : enemy.kind === 'zombie' ? 45 : enemy.kind === 'turret' ? 180 : enemy.kind === 'rocketeer' ? 140 : 100);

    const encounter = this.encounterStates.find((state) => state.config.id === enemy.encounterId);
    if (encounter) {
      encounter.remaining = Math.max(0, encounter.remaining - 1);
    }

    this.emitHud('live');
  }

  private damageBoss(boss: BossUnit, amount: number): void {
    boss.health -= amount;
    this.flashSprite(boss.sprite);
    this.setBossVisualTint(boss, 'hit');
    this.time.delayedCall(75, () => {
      if (boss.alive) {
        this.setBossVisualTint(boss, 'base');
      }
    });

    if (boss.health > 0) {
      return;
    }

    boss.alive = false;
    this.setBossVisualTint(boss, 'broken');
    boss.visualParts.forEach((part) => part.object.destroy());
    boss.sprite.destroy();
    this.director.addScore(1000);
    this.activeEncounterLabel = `${boss.config.name} destroyed`;
    this.boss = this.bosses.find((candidate) => candidate.alive);
    if (this.boss) {
      this.showBanner(`${boss.config.name} down. ${this.boss.config.name} remains.`, '#f5e4a1');
      this.emitHud('live');
      return;
    }

    this.playing = false;
    this.showBanner('Bosses down. Stage clear.', '#f5e4a1');
    this.cameras.main.shake(240, 0.008);
    this.physics.pause();

    this.time.delayedCall(1100, () => {
      this.director.completeCurrentStage();
      this.emitHud('paused');
    });
  }

  private damagePlayer(player: PlayerUnit, amount: number): void {
    player.health -= amount;
    this.flashSprite(player.sprite);
    this.cameras.main.shake(90, 0.003);

    if (player.health > 0) {
      return;
    }

    player.alive = false;
    player.health = 0;
    player.sprite.disableBody(true, true);
    this.showBanner(`${player.label} is down`, player.accent);

    if (this.players.some((squadMate) => squadMate.alive)) {
      return;
    }

    this.playing = false;
    this.activeEncounterLabel = 'Mission failed';
    this.physics.pause();
    this.time.delayedCall(900, () => {
      this.director.failMission();
      this.emitHud('paused');
    });
  }

  private flashSprite(sprite: Phaser.Physics.Arcade.Sprite): void {
    sprite.setTintFill(0xffffff);
    this.time.delayedCall(75, () => {
      if (sprite.active) {
        sprite.clearTint();
      }
    });
  }

  private showBanner(text: string, color: string): void {
    if (!this.bannerText) {
      return;
    }

    this.bannerText.setText(text);
    this.bannerText.setColor(color);
    this.bannerText.setAlpha(1);
    this.reticleText?.setText(this.stage?.briefing ?? '');
    this.reticleText?.setAlpha(0.96);
    this.objectivePanel?.setAlpha(0.82);
    const targets = [this.bannerText, this.reticleText, this.objectivePanel]
      .filter((target): target is Phaser.GameObjects.Text | Phaser.GameObjects.Image => Boolean(target));
    for (const target of targets) {
      this.tweens.killTweensOf(target);
    }

    this.tweens.add({
      targets,
      alpha: 0,
      duration: 1600,
      ease: 'Cubic.easeOut',
      delay: 1200,
    });
  }

  private closestLivingPlayer(x: number, y: number): PlayerUnit | undefined {
    let best: PlayerUnit | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const player of this.players) {
      if (!player.alive) {
        continue;
      }

      const distance = Phaser.Math.Distance.Squared(x, y, player.sprite.x, player.sprite.y);
      if (distance < bestDistance) {
        best = player;
        bestDistance = distance;
      }
    }

    return best;
  }

  private hasLineOfSight(fromX: number, fromY: number, toX: number, toY: number): boolean {
    this.sightLine.setTo(fromX, fromY, toX, toY);

    for (const obstacle of this.obstacleBodies) {
      const bounds = obstacle.getBounds();
      this.sightBounds.setTo(bounds.x - 3, bounds.y - 3, bounds.width + 6, bounds.height + 6);
      if (this.sightBounds.contains(fromX, fromY)) {
        continue;
      }

      if (Phaser.Geom.Intersects.LineToRectangle(this.sightLine, this.sightBounds)) {
        return false;
      }
    }

    return true;
  }

  private distanceToLineSegment(
    pointX: number,
    pointY: number,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
  ): number {
    const dx = endX - startX;
    const dy = endY - startY;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq === 0) {
      return Phaser.Math.Distance.Between(pointX, pointY, startX, startY);
    }

    const t = Phaser.Math.Clamp(((pointX - startX) * dx + (pointY - startY) * dy) / lengthSq, 0, 1);
    const projectionX = startX + t * dx;
    const projectionY = startY + t * dy;
    return Phaser.Math.Distance.Between(pointX, pointY, projectionX, projectionY);
  }

  private destroyBulletObject(bulletObject: Phaser.GameObjects.GameObject): void {
    const bullet = bulletObject as Phaser.Physics.Arcade.Image;
    if (bullet.active) {
      this.resolvePlayerBulletImpact(bullet, bullet.x, bullet.y);
    }
  }

  private updateBullets(group: Phaser.Physics.Arcade.Group | undefined, time: number, delta: number): void {
    if (!group) {
      return;
    }

    const travelBounds = this.getBulletTravelBounds();
    for (const child of group.getChildren()) {
      const bullet = child as Phaser.Physics.Arcade.Image;
      if (!bullet.active) {
        continue;
      }

      const expiry = Number(bullet.getData('expiry') ?? 0);
      const velocityX = Number(bullet.getData('velocityX') ?? 0);
      const velocityY = Number(bullet.getData('velocityY') ?? 0);
      const originX = Number(bullet.getData('originX') ?? bullet.x);
      const originY = Number(bullet.getData('originY') ?? bullet.y);
      const baseMaxDistance = Number(bullet.getData('baseMaxDistance') ?? bullet.getData('maxDistance') ?? 700);
      let maxDistance = Number(bullet.getData('maxDistance') ?? baseMaxDistance);
      const dropStartDistance = Number(bullet.getData('dropStartDistance') ?? maxDistance * 0.78);
      const seconds = Math.min(delta, 50) / 1000;
      const zone = this.getBulletEffectZoneAt(bullet.x, bullet.y);
      const zoneVelocity = this.applyBulletZoneVelocity(bullet, velocityX, velocityY, seconds, zone);
      if (zone?.effect === 'boost') {
        const boostedDistance = baseMaxDistance * 1.28;
        maxDistance = Math.max(maxDistance, boostedDistance);
        bullet.setData('maxDistance', maxDistance);
        bullet.setData('dropStartDistance', maxDistance * Number(bullet.getData('baseDropStartRatio') ?? 0.78));
      }

      const nextX = bullet.x + zoneVelocity.x * seconds;
      const nextY = bullet.y + zoneVelocity.y * seconds;

      bullet.setPosition(nextX, nextY);
      (bullet.body as Phaser.Physics.Arcade.Body).reset(nextX, nextY);

      const traveled = Phaser.Math.Distance.Between(originX, originY, nextX, nextY);
      if (traveled > dropStartDistance) {
        const dropProgress = Phaser.Math.Clamp(
          (traveled - dropStartDistance) / Math.max(1, maxDistance - dropStartDistance),
          0,
          1,
        );
        bullet.setAlpha(1 - dropProgress * 0.85);
        bullet.setScale(
          Number(bullet.getData('baseScaleX') ?? bullet.scaleX) * (1 - dropProgress * 0.45),
          Number(bullet.getData('baseScaleY') ?? bullet.scaleY) * (1 - dropProgress * 0.65),
        );
        bullet.y += dropProgress * 0.9;
        (bullet.body as Phaser.Physics.Arcade.Body).reset(bullet.x, bullet.y);
      }

      if (group === this.enemyBullets && this.tryHitVehicleWithEnemyBullet(bullet)) {
        continue;
      }

      if (
        time > expiry
        || traveled >= maxDistance
        || !Phaser.Geom.Rectangle.Overlaps(travelBounds, bullet.getBounds())
      ) {
        this.resolvePlayerBulletImpact(bullet, bullet.x, bullet.y);
      }
    }
  }

  private tryHitVehicleWithEnemyBullet(bullet: Phaser.Physics.Arcade.Image): boolean {
    const bulletBounds = bullet.getBounds();
    for (const vehicle of this.vehicles) {
      if (!vehicle.active || !vehicle.driver || !(vehicle.body.body as Phaser.Physics.Arcade.Body | undefined)?.enable) {
        continue;
      }

      if (!Phaser.Geom.Rectangle.Overlaps(bulletBounds, vehicle.body.getBounds())) {
        continue;
      }

      this.damageVehicle(vehicle, 1);
      this.dropBullet(bullet);
      return true;
    }

    return false;
  }

  private getBulletTravelBounds(): Phaser.Geom.Rectangle {
    return this.bulletTravelBounds;
  }

  private getBulletEffectZoneAt(x: number, y: number): BulletEffectZone | undefined {
    return this.bulletZones.find((zone) => zone.bounds.contains(x, y));
  }

  private getTerrainAt(x: number, y: number): TerrainZone | undefined {
    return this.terrainZones.find((zone) => zone.bounds.contains(x, y));
  }

  private applyBulletZoneVelocity(
    bullet: Phaser.Physics.Arcade.Image,
    velocityX: number,
    velocityY: number,
    seconds: number,
    zone: BulletEffectZone | undefined,
  ): { x: number; y: number } {
    if (!zone) {
      bullet.setTint(Number(bullet.getData('baseTint') ?? 0xffffff));
      return { x: velocityX, y: velocityY };
    }

    if (zone.effect === 'drag') {
      bullet.setTint(0x93c9ff);
      return {
        x: velocityX * 0.56,
        y: velocityY * 0.56 + 34,
      };
    }

    if (zone.effect === 'crosswind') {
      const drift = Math.sin(this.time.now / 220) * 85;
      bullet.setTint(0x9ff5b5);
      return {
        x: velocityX + -velocityY * 0.08 + drift * seconds * 8,
        y: velocityY + velocityX * 0.08,
      };
    }

    bullet.setTint(0xfff0a6);
    return {
      x: velocityX * 1.18,
      y: velocityY * 1.18,
    };
  }

  private resolvePlayerBulletImpact(bullet: Phaser.Physics.Arcade.Image, x: number, y: number): void {
    if (!bullet.active) {
      return;
    }

    const splashRadius = Number(bullet.getData('splashRadius') ?? 0);
    const splashDamage = Number(bullet.getData('splashDamage') ?? 0);
    const splashTint = Number(bullet.getData('splashTint') ?? 0xfff0aa);
    if (splashRadius > 0 && splashDamage > 0) {
      this.createExplosion(x, y, splashRadius, splashDamage, splashTint);
    }

    const poisonRadius = Number(bullet.getData('poisonRadius') ?? 0);
    const poisonDamage = Number(bullet.getData('poisonDamage') ?? 0);
    if (poisonRadius > 0 && poisonDamage > 0) {
      this.createPoisonCloud(x, y, poisonRadius, poisonDamage, splashTint);
    }

    this.dropBullet(bullet);
  }

  private createExplosion(x: number, y: number, radius: number, damage: number, tint: number): void {
    const blast = this.add.image(x, y, 'blast-circle');
    blast.setTint(tint);
    blast.setAlpha(0.48);
    blast.setDepth(18);
    blast.setScale(0.12);
    blast.setBlendMode(Phaser.BlendModes.ADD);

    this.tweens.add({
      targets: blast,
      scale: radius / 10,
      alpha: 0,
      duration: 280,
      ease: 'Quad.easeOut',
      onComplete: () => blast.destroy(),
    });

    for (const enemy of this.enemies) {
      if (!enemy.alive) {
        continue;
      }

      const distance = Phaser.Math.Distance.Between(x, y, enemy.sprite.x, enemy.sprite.y);
      if (distance <= radius) {
        const falloff = Phaser.Math.Clamp(1 - distance / Math.max(radius, 1), 0.35, 1);
        this.createHitSpark(enemy.sprite.x, enemy.sprite.y, tint, `-${Math.ceil(damage * falloff)}`);
        this.damageEnemy(enemy, Math.ceil(damage * falloff));
      }
    }

    for (const boss of this.bosses) {
      if (!boss.alive) {
        continue;
      }

      const distance = Phaser.Math.Distance.Between(x, y, boss.sprite.x, boss.sprite.y);
      if (distance <= radius) {
        const falloff = Phaser.Math.Clamp(1 - distance / Math.max(radius, 1), 0.25, 1);
        this.createHitSpark(boss.sprite.x, boss.sprite.y, tint, `-${Math.ceil(damage * falloff)}`);
        this.damageBoss(boss, Math.ceil(damage * falloff));
      }
    }
  }

  private createPoisonCloud(x: number, y: number, radius: number, damage: number, tint: number): void {
    const cloud = this.add.image(x, y, 'blast-circle');
    cloud.setTint(tint);
    cloud.setAlpha(0.34);
    cloud.setDepth(15);
    cloud.setScale(radius / 16);
    cloud.setBlendMode(Phaser.BlendModes.ADD);

    this.tweens.add({
      targets: cloud,
      alpha: 0,
      scale: radius / 8,
      duration: 2200,
      ease: 'Sine.easeOut',
      onComplete: () => cloud.destroy(),
    });

    for (let pulse = 0; pulse < 4; pulse += 1) {
      this.time.delayedCall(pulse * 430, () => {
        for (const enemy of this.enemies) {
          if (enemy.alive && Phaser.Math.Distance.Between(x, y, enemy.sprite.x, enemy.sprite.y) <= radius) {
            this.createHitSpark(enemy.sprite.x, enemy.sprite.y, tint, `-${damage}`);
            this.damageEnemy(enemy, damage);
          }
        }

        for (const boss of this.bosses) {
          if (boss.alive && Phaser.Math.Distance.Between(x, y, boss.sprite.x, boss.sprite.y) <= radius + 36) {
            this.createHitSpark(boss.sprite.x, boss.sprite.y, tint, `-${Math.ceil(damage * 0.7)}`);
            this.damageBoss(boss, Math.ceil(damage * 0.7));
          }
        }
      });
    }
  }

  private dropBullet(bullet: Phaser.Physics.Arcade.Image): void {
    if (!bullet.active) {
      return;
    }

    const puff = this.add.image(bullet.x, bullet.y + 4, 'blast-circle');
    puff.setDepth(14);
    puff.setTint(0xead8a2);
    puff.setAlpha(0.22);
    puff.setScale(0.08);
    this.tweens.add({
      targets: puff,
      alpha: 0,
      scale: 0.34,
      duration: 160,
      ease: 'Quad.easeOut',
      onComplete: () => puff.destroy(),
    });

    bullet.destroy();
  }

  private createHitSpark(x: number, y: number, tint: number, label?: string): void {
    const spark = this.add.image(x, y, 'blast-circle');
    spark.setDepth(19);
    spark.setTint(tint);
    spark.setAlpha(0.58);
    spark.setScale(0.11);
    spark.setBlendMode(Phaser.BlendModes.ADD);

    this.tweens.add({
      targets: spark,
      alpha: 0,
      scale: 0.82,
      duration: 180,
      ease: 'Quad.easeOut',
      onComplete: () => spark.destroy(),
    });

    if (!label) {
      return;
    }

    const text = this.add.text(x, y - 18, label, {
      fontFamily: 'Bahnschrift, Trebuchet MS, sans-serif',
      fontSize: '12px',
      color: '#fff2c4',
      stroke: '#24170a',
      strokeThickness: 3,
    });
    text.setOrigin(0.5);
    text.setDepth(20);

    this.tweens.add({
      targets: text,
      y: y - 38,
      alpha: 0,
      duration: 360,
      ease: 'Quad.easeOut',
      onComplete: () => text.destroy(),
    });
  }

  private emitHud(phase: HudSnapshot['phase']): void {
    const snapshot = this.director.getSnapshot();
    const stage = this.stage ?? this.getPreviewStage(snapshot);
    const clearedEncounters = this.encounterStates.filter((state) => state.cleared).length;
    const totalEncounters = this.encounterStates.length || stage.encounters.length;
    const totalStageEnemies = stage.encounters.reduce((sum, encounter) => sum + this.getEncounterEnemyTotal(encounter), 0);
    const defeatedEnemies = this.encounterStates.reduce((sum, state) => {
      if (!state.triggered) {
        return sum;
      }
      return sum + Math.max(0, this.getEncounterEnemyTotal(state.config) - state.remaining);
    }, 0);
    const remainingEnemies = Math.max(0, totalStageEnemies - defeatedEnemies);
    const progressText = this.bossSpawned
      ? this.bosses.some((boss) => boss.alive)
        ? 'Boss engaged'
        : 'Stage complete'
      : `${clearedEncounters}/${totalEncounters} kill zones cleared`;
    const livingBosses = this.bosses.filter((boss) => boss.alive);
    const bossHealth = livingBosses.reduce((sum, boss) => sum + boss.health, 0);
    const bossMaxHealth = livingBosses.reduce((sum, boss) => sum + boss.maxHealth, 0);

    this.pushHud({
      phase,
      stageName: stage.codename,
      stageIndex: snapshot.currentStageIndex + 1,
      totalStages: snapshot.stages.length,
      objective: stage.objective,
      encounterLabel: this.activeEncounterLabel,
      progressText,
      enemyCount: {
        alive: remainingEnemies,
        total: totalStageEnemies,
      },
      totalScore: snapshot.totalScore,
      players: this.players.map((player) => ({
        id: player.id,
        label: player.label,
        health: player.health,
        maxHealth: player.maxHealth,
        bombs: player.bombs,
        bombCooldownMs: Math.max(0, Math.ceil(player.nextSpecialAt - this.time.now)),
        alive: player.alive,
        accent: player.accent,
        weapon: this.getCurrentWeapon(player).label,
        weapons: player.weapons.map((weapon) => WEAPONS[weapon].label),
        ammo: player.weapons.map((weaponKind) => ({
          label: WEAPONS[weaponKind].shortLabel,
          ammo: this.getAmmoLabel(player, weaponKind),
          active: WEAPONS[weaponKind].kind === this.getCurrentWeapon(player).kind,
        })),
      })),
      boss: livingBosses.length > 0
        ? {
            name: livingBosses.map((boss) => boss.config.name).join(' + '),
            health: bossHealth,
            maxHealth: bossMaxHealth,
          }
        : undefined,
    });
  }

  private getPreviewStage(snapshot: SessionSnapshot): StageConfig {
    if (snapshot.phase === 'intermission' && snapshot.nextStage) {
      return snapshot.nextStage;
    }

    return snapshot.currentStage;
  }

  private playLoop(sprite: Phaser.Physics.Arcade.Sprite, key: string): void {
    if (sprite.anims.currentAnim?.key === key && sprite.anims.isPlaying) {
      return;
    }

    sprite.play(key, true);
  }

  private stopAtFirstFrame(sprite: Phaser.Physics.Arcade.Sprite): void {
    if (sprite.anims.isPlaying) {
      sprite.anims.stop();
    }
    sprite.setFrame(0);
  }
}
