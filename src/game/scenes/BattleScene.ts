import Phaser from 'phaser';
import type { BattleMusic, TankSfxCue } from '../audio/BattleMusic';
import { GameDirector } from '../core/GameDirector';
import { VirtualGamepad } from '../core/VirtualGamepad';
import { darkenColor, INFANTRY_PALETTE, TANK_ART, type TankArt, type TankArtKind } from '../render/tankArt';
import { COMBAT_FEEDBACK } from '../data/combatFeedback';
import { WEAPONS, type WeaponFeedbackStyle, type WeaponSpec } from '../data/weapons';
import { PLAYER_CLASSES } from '../data/playerClasses';
import { progressionForMission } from '../data/progression';
import type {
  BossStatus,
  CaptureZoneConfig,
  CoverConfig,
  EnemyTankKind,
  HouseDoorSide,
  HudSnapshot,
  InfantryKind,
  MissionBonusBreakdown,
  MissionConfig,
  SessionSnapshot,
  TankStats,
} from '../types';

type Team = 'player' | 'enemy';

interface TankRuntime {
  id: string;
  kind: TankArtKind;
  label: string;
  team: Team;
  x: number;
  y: number;
  vx: number;
  vy: number;
  bodyAngle: number;
  turretAngle: number;
  radius: number;
  health: number;
  maxHealth: number;
  speed: number;
  reloadMs: number;
  reloadTimer: number;
  damage: number;
  shellSpeed: number;
  score: number;
  scrap: number;
  alive: boolean;
  exposed: boolean;
  trackPhase: number;
  patrol: Array<{ x: number; y: number }>;
  patrolIndex: number;
  patrolPauseMs: number;
  /** Guards against a patrol point that ends up unreachable behind cover. */
  patrolTimeoutMs: number;
  alerted: boolean;
  idleSweep: number;
  shield: number;
  shieldMax: number;
  shelteredBy?: string;
  hitFlashMs: number;
  hitFlashMaxMs: number;
  hitFlashColor: number;
}

interface PickupRuntime {
  x: number;
  y: number;
  vx: number;
  vy: number;
  value: number;
  age: number;
  ttl: number;
}

type ProjectileKind = 'shell' | 'rocket' | 'mortar' | 'rail' | 'gas' | 'drone';

interface ProjectileRuntime {
  id: number;
  team: Team;
  kind: ProjectileKind;
  sourceKind: TankArtKind;
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  vx: number;
  vy: number;
  damage: number;
  blastRadius: number;
  radius: number;
  ttl: number;
  color: number;
  pierceRemaining: number;
  homingStrength: number;
  /** Lobs over cover and detonates at the target point instead of on contact. */
  arcing: boolean;
  targetX: number;
  targetY: number;
  hitTankIds: string[];
  feedback: WeaponFeedbackStyle;
}

interface ProjectileHitCandidate {
  enemy: TankRuntime;
  hitTime: number;
}

interface CoverRuntime {
  id: string;
  kind: CoverConfig['kind'];
  x: number;
  y: number;
  width: number;
  height: number;
  health: number;
  maxHealth: number;
  solid: boolean;
  spent: boolean;
  doorSide: HouseDoorSide;
  garrison: InfantryKind[];
  garrisonReleased: boolean;
}

interface CaptureRuntime extends CaptureZoneConfig {
  progress: number;
}

interface EscortRuntime {
  id: string;
  label: string;
  x: number;
  y: number;
  vx: number;
  health: number;
  maxHealth: number;
  exitX: number;
}

interface ExplosionSpark {
  angle: number;
  length: number;
  speed: number;
}

interface ExplosionRuntime {
  x: number;
  y: number;
  radius: number;
  age: number;
  duration: number;
  color: number;
  sparks: ExplosionSpark[];
}

interface MuzzleFlashRuntime {
  x: number;
  y: number;
  angle: number;
  age: number;
  duration: number;
  size: number;
  color: number;
  feedback: WeaponFeedbackStyle;
}

interface ImpactRuntime {
  x: number;
  y: number;
  angle: number;
  age: number;
  duration: number;
  size: number;
  color: number;
  feedback: WeaponFeedbackStyle;
  shield: boolean;
  sparkAngles: number[];
}

interface FloatingText {
  x: number;
  y: number;
  age: number;
  duration: number;
  label: Phaser.GameObjects.Text;
}

interface RenderPoint {
  x: number;
  y: number;
}

interface EnemyTemplate {
  label: string;
  health: number;
  speed: number;
  radius: number;
  reloadMs: number;
  damage: number;
  shellSpeed: number;
  score: number;
  scrap: number;
}

const ENEMY_TEMPLATES: Record<EnemyTankKind, EnemyTemplate> = {
  // Infantry. Riflemen only chip at the hull, so early stages are about learning
  // to drive and aim; rocketeers hit as hard as a tank shell and have to be
  // respected even though they die to a single hit.
  rifleman: {
    label: 'Rifleman',
    health: 42,
    speed: 92,
    radius: 14,
    reloadMs: 900,
    damage: 6,
    shellSpeed: 620,
    score: 45,
    scrap: 4,
  },
  rocketeer: {
    label: 'Rocketeer',
    health: 55,
    speed: 74,
    radius: 15,
    reloadMs: 2600,
    damage: 46,
    shellSpeed: 430,
    score: 90,
    scrap: 9,
  },
  scout: {
    label: 'Scout Tank',
    health: 95,
    speed: 150,
    radius: 24,
    reloadMs: 1650,
    damage: 24,
    shellSpeed: 520,
    score: 120,
    scrap: 12,
  },
  raider: {
    label: 'Raider Tank',
    health: 160,
    speed: 115,
    radius: 29,
    reloadMs: 1880,
    damage: 34,
    shellSpeed: 560,
    score: 190,
    scrap: 18,
  },
  siege: {
    label: 'Siege Tank',
    health: 260,
    speed: 72,
    radius: 34,
    reloadMs: 2400,
    damage: 52,
    shellSpeed: 500,
    score: 310,
    scrap: 28,
  },
  turret: {
    label: 'Gun Turret',
    health: 135,
    speed: 0,
    radius: 27,
    reloadMs: 1420,
    damage: 30,
    shellSpeed: 610,
    score: 160,
    scrap: 14,
  },
  convoy: {
    label: 'Convoy Carrier',
    health: 210,
    speed: 46,
    radius: 32,
    reloadMs: 2100,
    damage: 20,
    shellSpeed: 460,
    score: 260,
    scrap: 26,
  },
  boss: {
    label: 'Boss Tank',
    health: 1200,
    speed: 52,
    radius: 56,
    reloadMs: 980,
    damage: 62,
    shellSpeed: 620,
    score: 1200,
    scrap: 90,
  },
};

/** What each enemy kind throws at the player. */
const ENEMY_SHOTS: Record<EnemyTankKind, { style: ProjectileKind; blastRadius: number; color: number }> = {
  // a rifle round barely scratches armour and leaves no real blast
  rifleman: { style: 'shell', blastRadius: 0, color: 0xffe9a8 },
  // an infantry rocket lands about as hard as a tank shell
  rocketeer: { style: 'rocket', blastRadius: 54, color: 0xff7447 },
  scout: { style: 'shell', blastRadius: 48, color: 0xffc16d },
  raider: { style: 'shell', blastRadius: 48, color: 0xffc16d },
  siege: { style: 'shell', blastRadius: 48, color: 0xffc16d },
  turret: { style: 'shell', blastRadius: 48, color: 0xffc16d },
  convoy: { style: 'shell', blastRadius: 48, color: 0xffc16d },
  boss: { style: 'shell', blastRadius: 76, color: 0xff8a5b },
};

const DIFFICULTY_DAMAGE = {
  easy: 0.72,
  normal: 1,
  hard: 1.22,
  extreme: 1.48,
};

const DIFFICULTY_HEALTH = {
  easy: 0.82,
  normal: 1,
  hard: 1.16,
  extreme: 1.34,
};

const CONVOY_ESCAPE_COUNTDOWN_MS = 8000;
const CONVOY_WARNING_SECONDS = 12;

/** Range at which a patrolling enemy notices the player and breaks off its route. */
const ENEMY_DETECT_RANGE = 540;
/** Wider range the player must clear before an alerted enemy settles back down. */
const ENEMY_DISENGAGE_RANGE = 900;
const PATROL_ARRIVE_RADIUS = 34;
const PATROL_LEG_TIMEOUT_MS = 7000;
/** Quiet time before shields start coming back after taking a hit. */
const SHIELD_RECHARGE_DELAY_MS = 2600;
/** How close cash has to be before it starts drifting toward the player. */
const PICKUP_MAGNET_RANGE = 190;
const PICKUP_TTL_MS = 22000;
/** How long a poison cloud lingers and keeps pulsing damage. */
const GAS_CLOUD_DURATION_MS = 3600;
/** DOM HUD updates are intentionally slower than the 60 Hz simulation. */
const HUD_UPDATE_INTERVAL_MS = 100;
/** Every mission shares a three-minute speed-bonus clock; it is not a failure timer. */
const MISSION_BONUS_DURATION_MS = 3 * 60 * 1000;
const TIME_BONUS_PER_SECOND = 1;
const OBJECT_BONUS_PER_OBJECT = 5;
const PRESERVATION_BONUS_KINDS: ReadonlySet<CoverConfig['kind']> = new Set([
  'crate', 'concrete', 'rockWall', 'barrel', 'houseOpen', 'houseSealed',
]);
/** Hard caps prevent automatic weapons from growing unbounded effect arrays. */
const MAX_MUZZLE_FLASHES = 48;
const MAX_IMPACT_EFFECTS = 72;
const MAX_EXPLOSIONS = 64;
const MAX_FLOATING_TEXTS = 40;
const PLAYER_HIT_SHAKE_COOLDOWN_MS = 90;
const WORLD_SHAKE_COOLDOWN_MS = 45;
const REDUCED_MAX_MUZZLE_FLASHES = 24;
const REDUCED_MAX_IMPACT_EFFECTS = 36;
const REDUCED_MAX_EXPLOSIONS = 28;

// Rendering runs every frame, so immutable projectile silhouettes and scratch
// points avoid creating hundreds of short-lived arrays and vector objects while
// automatic weapons are active.
const MORTAR_SHELL_POINTS: ReadonlyArray<RenderPoint> = [
  { x: 13, y: 0 }, { x: 5, y: -8 }, { x: -11, y: -8 }, { x: -11, y: 8 }, { x: 5, y: 8 },
];
const RAIL_SLUG_POINTS: ReadonlyArray<RenderPoint> = [
  { x: 20, y: 0 }, { x: 8, y: -5 }, { x: -14, y: -4 }, { x: -14, y: 4 }, { x: 8, y: 5 },
];
const SHELL_POINTS: ReadonlyArray<RenderPoint> = [
  { x: 0.55, y: 0 }, { x: 0.1, y: -0.5 }, { x: -0.45, y: -0.5 },
  { x: -0.45, y: 0.5 }, { x: 0.1, y: 0.5 },
];
const BOSS_SHELL_POINTS: ReadonlyArray<RenderPoint> = [
  { x: 18, y: 0 }, { x: 4, y: -9 }, { x: -16, y: -9 }, { x: -16, y: 9 }, { x: 4, y: 9 },
];
const ROCKET_POINTS: ReadonlyArray<RenderPoint> = [
  { x: 16, y: 0 }, { x: 4, y: -6 }, { x: -10, y: -6 }, { x: -10, y: 6 }, { x: 4, y: 6 },
];
const DRONE_POINTS: ReadonlyArray<RenderPoint> = [
  { x: 13, y: 0 }, { x: 3, y: -6 }, { x: -10, y: -5 },
  { x: -13, y: 0 }, { x: -10, y: 5 }, { x: 3, y: 6 },
];
const UNIT_BOX_POINTS: ReadonlyArray<RenderPoint> = [
  { x: -1, y: -1 }, { x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 },
];
const WORLD_POINT_POOL: RenderPoint[] = Array.from({ length: 32 }, () => ({ x: 0, y: 0 }));
let worldPointPoolIndex = 0;

/** Hull speed a tank needs before it can run infantry down. */
const INFANTRY_CRUSH_SPEED = 90;
/** Range at which infantry start sidestepping an oncoming tank. */
const INFANTRY_DODGE_RANGE = 180;

function isInfantry(kind: TankArtKind): boolean {
  return kind === 'rifleman' || kind === 'rocketeer';
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeAngle(angle: number): number {
  return Phaser.Math.Angle.Wrap(angle);
}

function angleDifference(a: number, b: number): number {
  return Phaser.Math.Angle.Wrap(b - a);
}

function localToWorld(x: number, y: number, angle: number, lx: number, ly: number): RenderPoint {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const point = WORLD_POINT_POOL[worldPointPoolIndex];
  worldPointPoolIndex = (worldPointPoolIndex + 1) % WORLD_POINT_POOL.length;
  point.x = x + lx * cos - ly * sin;
  point.y = y + lx * sin + ly * cos;
  return point;
}

function approachAngle(current: number, target: number, amount: number): number {
  const difference = angleDifference(current, target);
  if (Math.abs(difference) <= amount) {
    return normalizeAngle(target);
  }

  return normalizeAngle(current + Math.sign(difference) * amount);
}

function circleRectOverlap(cx: number, cy: number, radius: number, rect: CoverRuntime): boolean {
  const nearestX = clamp(cx, rect.x - rect.width * 0.5, rect.x + rect.width * 0.5);
  const nearestY = clamp(cy, rect.y - rect.height * 0.5, rect.y + rect.height * 0.5);
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy <= radius * radius;
}

function pointInsideCover(x: number, y: number, cover: CoverRuntime, inset = 0): boolean {
  return x >= cover.x - cover.width * 0.5 + inset
    && x <= cover.x + cover.width * 0.5 - inset
    && y >= cover.y - cover.height * 0.5 + inset
    && y <= cover.y + cover.height * 0.5 - inset;
}

function segmentPointHitTime(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  pointX: number,
  pointY: number,
  radius: number,
): number | null {
  const dx = endX - startX;
  const dy = endY - startY;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared > 0
    ? clamp(((pointX - startX) * dx + (pointY - startY) * dy) / lengthSquared, 0, 1)
    : 0;
  const closestX = startX + dx * t;
  const closestY = startY + dy * t;
  const distanceSquared = (pointX - closestX) ** 2 + (pointY - closestY) ** 2;
  return distanceSquared <= radius * radius ? t : null;
}

function segmentRectHitTime(projectile: ProjectileRuntime, rect: CoverRuntime): number | null {
  const halfWidth = rect.width * 0.5 + projectile.radius;
  const halfHeight = rect.height * 0.5 + projectile.radius;
  const minX = rect.x - halfWidth;
  const maxX = rect.x + halfWidth;
  const minY = rect.y - halfHeight;
  const maxY = rect.y + halfHeight;
  const dx = projectile.x - projectile.previousX;
  const dy = projectile.y - projectile.previousY;
  let entry = 0;
  let exit = 1;

  for (const [start, delta, min, max] of [
    [projectile.previousX, dx, minX, maxX],
    [projectile.previousY, dy, minY, maxY],
  ] as const) {
    if (Math.abs(delta) < 0.000001) {
      if (start < min || start > max) {
        return null;
      }
      continue;
    }

    const t1 = (min - start) / delta;
    const t2 = (max - start) / delta;
    entry = Math.max(entry, Math.min(t1, t2));
    exit = Math.min(exit, Math.max(t1, t2));
    if (entry > exit) {
      return null;
    }
  }

  return entry;
}

function coverHealth(config: CoverConfig): number {
  if (config.health) {
    return config.health;
  }

  if (config.kind === 'concrete') {
    return 4;
  }

  if (config.kind === 'rockWall') {
    return 8;
  }

  if (config.kind === 'houseOpen') {
    return 4;
  }

  if (config.kind === 'houseSealed') {
    return 3;
  }

  if (config.kind === 'barrel') {
    return 1;
  }

  if (config.kind === 'mine') {
    return 1;
  }

  if (config.kind === 'repair' || config.kind === 'armory') {
    return 9999;
  }

  return 1;
}

function enemyColor(kind: EnemyTankKind): number {
  // Infantry wear the rambo_game fatigue/bandana palette so they read as the
  // same faction those sprites came from.
  if (kind === 'rifleman') {
    return 0x2d2f38;
  }

  if (kind === 'rocketeer') {
    return 0x3b3038;
  }

  if (kind === 'scout') {
    return 0xd6b45c;
  }

  if (kind === 'raider') {
    return 0xd47c4c;
  }

  if (kind === 'siege') {
    return 0xb94738;
  }

  if (kind === 'turret') {
    return 0x8c8f94;
  }

  if (kind === 'convoy') {
    return 0xc4b78d;
  }

  return 0xff6848;
}

export class BattleScene extends Phaser.Scene {
  private readonly director: GameDirector;
  private readonly onHud: (snapshot: HudSnapshot) => void;
  private readonly gamepad: VirtualGamepad;
  private readonly audio?: BattleMusic;
  private readonly effectsEnabled: () => boolean;
  private terrainGraphics?: Phaser.GameObjects.Graphics;
  private underlayGraphics?: Phaser.GameObjects.Graphics;
  private coverGraphics?: Phaser.GameObjects.Graphics;
  private graphics?: Phaser.GameObjects.Graphics;
  /** Separate additive layer so blasts glow instead of just painting over. */
  private glow?: Phaser.GameObjects.Graphics;
  private keys?: Record<string, Phaser.Input.Keyboard.Key>;
  private snapshot?: SessionSnapshot;
  private mission?: MissionConfig;
  private player?: TankRuntime;
  private escort?: EscortRuntime;
  private enemies: TankRuntime[] = [];
  private covers: CoverRuntime[] = [];
  private captureZones: CaptureRuntime[] = [];
  private projectiles: ProjectileRuntime[] = [];
  private explosions: ExplosionRuntime[] = [];
  private muzzleFlashes: MuzzleFlashRuntime[] = [];
  private impacts: ImpactRuntime[] = [];
  private pickups: PickupRuntime[] = [];
  private pickupLabels: Phaser.GameObjects.Text[] = [];
  private shieldQuietMs = 0;
  private playerHitShakeCooldownMs = 0;
  private worldShakeCooldownMs = 0;
  private floatingTexts: FloatingText[] = [];
  private lastRunSerial = -1;
  private missionGeneration = 0;
  private hudUpdateElapsed = 0;
  private missionElapsed = 0;
  private defenseHeldMs = 0;
  private missionResolved = false;
  private projectileSerial = 1;
  private secondaryTimer = 0;
  private secondaryCooldownMax = 1;
  private ammo = 0;
  private magazineReloadTimer = 0;
  private magazineReloadMax = 1;
  private specialTimer = 0;
  private repairCharges = 0;
  private convoyEscapeCountdownMs = 0;
  private convoyWarningShown = false;
  private convoyBreachShown = false;
  private lastPointerWorld = { x: 400, y: 300 };
  /**
   * A mouse keeps hovering so it can aim at a world point, but a finger lifts
   * off. Touch aiming therefore locks a heading, otherwise the turret keeps
   * swinging to track the patch of ground that was tapped as the tank drives.
   */
  private aimMode: 'point' | 'heading' = 'point';
  private aimHeading = 0;
  private staticLayerDirty = true;
  private readonly projectileHitBuffer: ProjectileHitCandidate[] = [];
  private readonly collisionTanks: TankRuntime[] = [];
  private readonly polygonPointBuffer: RenderPoint[] = [];
  private performanceElapsed = 0;
  private performanceFrames = 0;
  private performanceLongFrames = 0;
  private performanceMaxFrame = 0;

  constructor(
    director: GameDirector,
    onHud: (snapshot: HudSnapshot) => void,
    gamepad: VirtualGamepad,
    audio?: BattleMusic,
    effectsEnabled: () => boolean = () => true,
  ) {
    super('battle-scene');
    this.director = director;
    this.onHud = onHud;
    this.gamepad = gamepad;
    this.audio = audio;
    this.effectsEnabled = effectsEnabled;
  }

  create(): void {
    this.terrainGraphics = this.add.graphics().setDepth(0);
    this.underlayGraphics = this.add.graphics().setDepth(1);
    this.coverGraphics = this.add.graphics().setDepth(2);
    this.graphics = this.add.graphics().setDepth(3);
    this.glow = this.add.graphics();
    this.glow.setBlendMode(Phaser.BlendModes.ADD);
    this.glow.setDepth(6);
    this.keys = this.input.keyboard?.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      fire: Phaser.Input.Keyboard.KeyCodes.SPACE,
      secondary: Phaser.Input.Keyboard.KeyCodes.E,
      special: Phaser.Input.Keyboard.KeyCodes.Q,
      repair: Phaser.Input.Keyboard.KeyCodes.R,
      switchWeapon: Phaser.Input.Keyboard.KeyCodes.X,
    }) as Record<string, Phaser.Input.Keyboard.Key>;

    const pointTurretAtPointer = (pointer: Phaser.Input.Pointer): void => {
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.lastPointerWorld = { x: world.x, y: world.y };

      if (pointer.wasTouch && this.player) {
        this.aimHeading = Math.atan2(world.y - this.player.y, world.x - this.player.x);
        this.aimMode = 'heading';
      } else {
        this.aimMode = 'point';
      }
    };
    this.input.on('pointermove', pointTurretAtPointer);
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointTurretAtPointer(pointer);
      if (pointer.wasTouch && this.snapshot?.phase === 'playing') {
        // Phaser receives this as a separate pointer from the DOM movement
        // stick. Queue one cannon shot without releasing either held stick.
        this.gamepad.triggerAction(1, 'fire');
      }
    });

    this.director.subscribe((snapshot) => {
      this.snapshot = snapshot;
      this.time.paused = snapshot.phase === 'paused';
      if (snapshot.phase === 'playing' && snapshot.runSerial !== this.lastRunSerial) {
        this.startMission(snapshot);
      }
      if (snapshot.phase !== 'playing') {
        this.gamepad.resetAll();
      }
    });

    if (this.snapshot?.phase === 'playing') {
      this.startMission(this.snapshot);
    }
  }

  update(_time: number, delta: number): void {
    const snapshot = this.snapshot;
    const player = this.player;
    const mission = this.mission;
    if (!snapshot || !player || !mission || snapshot.phase !== 'playing') {
      this.audio?.setEngineLoad(0);
      return;
    }

    this.updatePerformanceDiagnostics(delta);
    const dt = Math.min(delta, 40) / 1000;
    this.missionElapsed += delta;
    this.secondaryTimer = Math.max(0, this.secondaryTimer - delta);
    this.specialTimer = Math.max(0, this.specialTimer - delta);
    this.playerHitShakeCooldownMs = Math.max(0, this.playerHitShakeCooldownMs - delta);
    this.worldShakeCooldownMs = Math.max(0, this.worldShakeCooldownMs - delta);
    this.updateMagazine(snapshot.tankStats, delta);

    this.updatePlayer(player, mission, snapshot.tankStats, dt, delta);
    this.updateEscort(dt);
    this.updateEnemies(player, mission, snapshot.difficulty, dt, delta);
    this.resolveTankCollisions(mission);
    this.updateHouseShelters();
    this.updateConvoyEscapeState(mission, delta);
    this.updateProjectiles(dt);
    this.updateExplosions(delta);
    this.updateCombatFeedback(delta);
    this.updateCaptureZones(player, dt);
    this.updateRepairPads(player, snapshot.tankStats, dt);
    this.updateMines(player);
    this.updateInfantryCrush(player);
    this.updateArmoryBoxes(player);
    this.updatePickups(player, dt, delta);
    this.updateShield(player, snapshot.tankStats, dt, delta);
    this.updateMissionState(mission, delta);
    this.updateCamera(mission, player);
    this.hudUpdateElapsed += delta;
    if (this.hudUpdateElapsed >= HUD_UPDATE_INTERVAL_MS) {
      this.hudUpdateElapsed %= HUD_UPDATE_INTERVAL_MS;
      this.onHud(this.buildHudSnapshot(snapshot, mission, player));
    }
    this.render();
  }

  private startMission(snapshot: SessionSnapshot): void {
    const mission = snapshot.currentMission;
    this.missionGeneration += 1;
    this.lastRunSerial = snapshot.runSerial;
    this.mission = mission;
    this.missionElapsed = 0;
    this.hudUpdateElapsed = 0;
    this.defenseHeldMs = 0;
    this.missionResolved = false;
    this.projectiles = [];
    this.explosions = [];
    this.muzzleFlashes = [];
    this.impacts = [];
    this.pickups = [];
    this.shieldQuietMs = 0;
    this.playerHitShakeCooldownMs = 0;
    this.worldShakeCooldownMs = 0;
    this.staticLayerDirty = true;
    this.performanceElapsed = 0;
    this.performanceFrames = 0;
    this.performanceLongFrames = 0;
    this.performanceMaxFrame = 0;
    for (const text of this.floatingTexts) {
      text.label.destroy();
    }
    this.floatingTexts = [];
    this.secondaryTimer = 0;
    this.ammo = snapshot.tankStats.ammoCapacity;
    this.magazineReloadTimer = 0;
    this.magazineReloadMax = 1;
    this.specialTimer = snapshot.tankStats.specialCooldownMs * 0.35;
    this.repairCharges = snapshot.tankStats.repairCharges;
    this.convoyEscapeCountdownMs = 0;
    this.convoyWarningShown = false;
    this.convoyBreachShown = false;
    this.captureZones = (mission.captureZones ?? []).map((zone) => ({ ...zone, progress: 0 }));
    this.covers = mission.covers.map((cover) => {
      const health = coverHealth(cover);
      return {
        ...cover,
        health,
        maxHealth: health,
        solid: cover.kind !== 'mine' && cover.kind !== 'repair' && cover.kind !== 'armory',
        spent: false,
        doorSide: cover.doorSide ?? 'right',
        garrison: [...(cover.garrison ?? [])],
        garrisonReleased: cover.kind !== 'houseSealed',
      };
    });
    this.enemies = mission.enemies.map((spawn, index) => this.createEnemy(
      spawn.kind,
      spawn.id,
      spawn.x,
      spawn.y,
      snapshot.difficulty,
      snapshot.currentMissionIndex,
      spawn.patrol,
      index,
    ));

    if (mission.boss) {
      const progression = progressionForMission(snapshot.currentMissionIndex);
      const boss = this.createEnemy('boss', mission.boss.id, mission.boss.x, mission.boss.y, snapshot.difficulty, snapshot.currentMissionIndex);
      boss.label = mission.boss.name;
      boss.health = mission.boss.health * DIFFICULTY_HEALTH[snapshot.difficulty] * progression.enemyHealthScale;
      boss.maxHealth = boss.health;
      boss.reloadMs = mission.boss.fireRate;
      this.enemies.push(boss);
    }

    this.escort = mission.escort
      ? {
          id: mission.escort.id,
          label: mission.escort.label,
          x: mission.escort.x,
          y: mission.escort.y,
          vx: 0,
          health: mission.escort.health,
          maxHealth: mission.escort.health,
          exitX: mission.escort.exitX,
        }
      : undefined;

    this.player = {
      id: 'player',
      kind: PLAYER_CLASSES[snapshot.playerClass].artKind,
      label: PLAYER_CLASSES[snapshot.playerClass].label,
      team: 'player',
      x: 190,
      y: mission.worldHeight * 0.52,
      vx: 0,
      vy: 0,
      bodyAngle: 0,
      turretAngle: 0,
      radius: PLAYER_CLASSES[snapshot.playerClass].radius,
      health: snapshot.tankStats.maxHealth,
      maxHealth: snapshot.tankStats.maxHealth,
      speed: snapshot.tankStats.engine,
      reloadMs: snapshot.tankStats.reloadMs,
      reloadTimer: 0,
      damage: snapshot.tankStats.shellDamage,
      shellSpeed: snapshot.tankStats.shellSpeed,
      score: 0,
      scrap: 0,
      alive: true,
      exposed: false,
      trackPhase: 0,
      patrol: [],
      patrolIndex: 0,
      patrolPauseMs: 0,
      patrolTimeoutMs: 0,
      alerted: true,
      idleSweep: 0,
      shield: snapshot.tankStats.shieldMax,
      shieldMax: snapshot.tankStats.shieldMax,
      shelteredBy: undefined,
      hitFlashMs: 0,
      hitFlashMaxMs: 1,
      hitFlashColor: 0xffffff,
    };

    this.cameras.main.setBounds(0, 0, mission.worldWidth, mission.worldHeight);
    this.cameras.main.setBackgroundColor(mission.palette.sky);
    this.onHud(this.buildHudSnapshot(snapshot, mission, this.player));
    this.render();
  }

  private createEnemy(
    kind: EnemyTankKind,
    id: string,
    x: number,
    y: number,
    difficulty: SessionSnapshot['difficulty'],
    missionIndex = 0,
    patrol?: Array<{ x: number; y: number }>,
    seed = 0,
  ): TankRuntime {
    const template = ENEMY_TEMPLATES[kind];
    const progression = progressionForMission(missionIndex);
    const health = template.health * DIFFICULTY_HEALTH[difficulty] * progression.enemyHealthScale;
    return {
      id,
      kind,
      label: template.label,
      team: 'enemy',
      x,
      y,
      vx: kind === 'convoy' ? template.speed : 0,
      vy: 0,
      bodyAngle: kind === 'convoy' ? 0 : Math.PI,
      turretAngle: Math.PI,
      radius: template.radius,
      health,
      maxHealth: health,
      speed: template.speed,
      reloadMs: template.reloadMs * progression.enemyReloadScale,
      reloadTimer: Phaser.Math.Between(300, Math.round(template.reloadMs * progression.enemyReloadScale)),
      damage: template.damage * progression.enemyDamageScale,
      shellSpeed: template.shellSpeed,
      score: template.score,
      scrap: Math.round(template.scrap * (1 + missionIndex * 0.025)),
      alive: true,
      exposed: false,
      trackPhase: 0,
      patrol: this.buildPatrolRoute(x, y, patrol, seed),
      patrolIndex: seed % 4,
      patrolPauseMs: 0,
      patrolTimeoutMs: PATROL_LEG_TIMEOUT_MS,
      // convoys and bosses never idle; everything else starts unaware
      alerted: kind === 'convoy' || kind === 'boss',
      idleSweep: seed * 0.9,
      shield: 0,
      shieldMax: 0,
      shelteredBy: undefined,
      hitFlashMs: 0,
      hitFlashMaxMs: 1,
      hitFlashColor: 0xffffff,
    };
  }

  private buildPatrolRoute(
    x: number,
    y: number,
    patrol: Array<{ x: number; y: number }> | undefined,
    seed: number,
  ): Array<{ x: number; y: number }> {
    const mission = this.mission;
    const clampPoint = (point: { x: number; y: number }): { x: number; y: number } => ({
      x: mission ? clamp(point.x, 70, mission.worldWidth - 70) : point.x,
      y: mission ? clamp(point.y, 70, mission.worldHeight - 70) : point.y,
    });

    if (patrol && patrol.length > 0) {
      return patrol.map(clampPoint);
    }

    // No authored route: sweep a small loop around the spawn so the enemy holds
    // its sector instead of standing still.
    const radius = 92 + (seed % 3) * 38;
    const tilt = seed * 0.7;
    return [0, 1, 2, 3].map((step) => {
      const angle = tilt + (step / 4) * Math.PI * 2;
      return clampPoint({ x: x + Math.cos(angle) * radius, y: y + Math.sin(angle) * radius });
    });
  }

  private updatePlayer(player: TankRuntime, mission: MissionConfig, stats: TankStats, dt: number, delta: number): void {
    const keyboardAxis = this.getKeyboardDriveAxis();
    const virtualAxis = this.gamepad.getDriveAxis();
    const driveAxis = Math.hypot(virtualAxis.x, virtualAxis.y) > 0.08 ? virtualAxis : keyboardAxis;
    const desiredVx = driveAxis.x * stats.engine;
    const desiredVy = driveAxis.y * stats.engine;
    const response = 1 - Math.exp(-7.6 * dt);
    player.vx += (desiredVx - player.vx) * response;
    player.vy += (desiredVy - player.vy) * response;

    const speed = Math.hypot(player.vx, player.vy);
    this.audio?.setEngineLoad(clamp(speed / stats.engine, 0, 1));
    if (speed > 14) {
      player.bodyAngle = approachAngle(player.bodyAngle, Math.atan2(player.vy, player.vx), stats.turnRate * dt);
    }
    player.trackPhase += speed * dt;

    player.x = clamp(player.x + player.vx * dt, player.radius, mission.worldWidth - player.radius);
    player.y = clamp(player.y + player.vy * dt, player.radius, mission.worldHeight - player.radius);
    this.resolveTankCoverCollision(player);

    const aimAxis = this.gamepad.getAimAxis();
    if (Math.hypot(aimAxis.x, aimAxis.y) > 0.18) {
      player.turretAngle = Math.atan2(aimAxis.y, aimAxis.x);
      this.aimMode = 'heading';
      this.lastPointerWorld = {
        x: player.x + Math.cos(player.turretAngle) * 240,
        y: player.y + Math.sin(player.turretAngle) * 240,
      };
      this.aimHeading = player.turretAngle;
    } else if (this.aimMode === 'heading') {
      player.turretAngle = this.aimHeading;
      this.lastPointerWorld = {
        x: player.x + Math.cos(this.aimHeading) * 240,
        y: player.y + Math.sin(this.aimHeading) * 240,
      };
    } else {
      player.turretAngle = Math.atan2(this.lastPointerWorld.y - player.y, this.lastPointerWorld.x - player.x);
    }

    if (this.wantsSwitchWeapon()) {
      this.director.cycleWeapon();
    }

    // Normal fire always uses the currently selected weapon. The legacy E /
    // secondary input remains an alias for desktop players, but mobile no
    // longer needs a separate weapon-fire button after swapping.
    const normalFire = this.wantsFire();
    const legacySecondaryFire = this.wantsSecondary();
    if ((normalFire || legacySecondaryFire) && this.secondaryTimer <= 0 && this.magazineReloadTimer <= 0) {
      if (this.ammo <= 0) {
        this.startMagazineReload(stats);
      } else {
        const weapon = this.getSelectedWeapon();
        const weaponLevel = this.snapshot?.weaponLevels[weapon.id] ?? 1;
        const upgradeSteps = Math.max(0, weaponLevel - 1);
        this.secondaryCooldownMax = stats.secondaryCooldownMs * weapon.cooldownScale * Math.pow(0.9, upgradeSteps);
        this.secondaryTimer = this.secondaryCooldownMax;
        this.ammo -= 1;
        this.fireSelectedWeapon(player, stats, weapon);
        if (this.ammo <= 0) {
          this.startMagazineReload(stats);
        }
      }
    }

    if (this.wantsSpecial() && this.specialTimer <= 0) {
      this.specialTimer = stats.specialCooldownMs;
      this.callArtilleryStrike();
    }

    if (this.wantsRepair() && this.repairCharges > 0 && player.health < player.maxHealth) {
      this.repairCharges -= 1;
      player.health = Math.min(player.maxHealth, player.health + 170 + (stats.repairCharges - 2) * 28);
      this.addFloatingText(player.x, player.y - 58, 'Field Repair', 0xa2db7c);
      this.audio?.playSfx('repair', 0.9);
    }

    player.reloadTimer = Math.max(0, player.reloadTimer - delta);
  }

  private updateMagazine(stats: TankStats, delta: number): void {
    if (this.magazineReloadTimer <= 0) {
      this.ammo = Math.min(this.ammo, stats.ammoCapacity);
      return;
    }

    this.magazineReloadTimer = Math.max(0, this.magazineReloadTimer - delta);
    if (this.magazineReloadTimer <= 0) {
      this.ammo = stats.ammoCapacity;
      if (this.player?.alive) {
        this.addFloatingText(this.player.x, this.player.y - 46, 'MAGAZINE READY', 0x95e7ff);
      }
    }
  }

  private startMagazineReload(stats: TankStats): void {
    if (this.magazineReloadTimer > 0) {
      return;
    }

    // Magazine reload must outlast the ordinary per-shot cooldown or capacity
    // would never create a real combat tradeoff. Auto-loader upgrades reduce
    // this because they lower the shared reload stat.
    this.magazineReloadMax = Math.max(1600, stats.reloadMs * 4.2);
    this.magazineReloadTimer = this.magazineReloadMax;
    if (this.player?.alive) {
      this.addFloatingText(this.player.x, this.player.y - 46, 'AUTO LOADING', 0xf0d78b);
    }
  }

  private getKeyboardDriveAxis(): { x: number; y: number } {
    const keys = this.keys;
    if (!keys) {
      return { x: 0, y: 0 };
    }

    const x = (keys.right.isDown ? 1 : 0) - (keys.left.isDown ? 1 : 0);
    const y = (keys.down.isDown ? 1 : 0) - (keys.up.isDown ? 1 : 0);
    const magnitude = Math.hypot(x, y);
    if (magnitude <= 0) {
      return { x: 0, y: 0 };
    }

    return { x: x / magnitude, y: y / magnitude };
  }

  private wantsFire(): boolean {
    const keys = this.keys;
    const pointer = this.input.activePointer;
    const keyboardFire = Boolean(keys?.fire.isDown || (keys?.fire && Phaser.Input.Keyboard.JustDown(keys.fire)));
    const virtualFire = this.gamepad.consumeJustPressed(1, 'fire') || this.gamepad.isDown(1, 'fire');
    const mouseFire = pointer && !pointer.wasTouch && pointer.leftButtonDown();
    return Boolean(keyboardFire || mouseFire || virtualFire);
  }

  private wantsSecondary(): boolean {
    const keys = this.keys;
    return Boolean((keys?.secondary && Phaser.Input.Keyboard.JustDown(keys.secondary)) || this.gamepad.consumeJustPressed(1, 'secondary'));
  }

  private wantsSpecial(): boolean {
    const keys = this.keys;
    return Boolean((keys?.special && Phaser.Input.Keyboard.JustDown(keys.special)) || this.gamepad.consumeJustPressed(1, 'special'));
  }

  private wantsRepair(): boolean {
    const keys = this.keys;
    return Boolean((keys?.repair && Phaser.Input.Keyboard.JustDown(keys.repair)) || this.gamepad.consumeJustPressed(1, 'repair'));
  }

  private wantsSwitchWeapon(): boolean {
    const keys = this.keys;
    return Boolean((keys?.switchWeapon && Phaser.Input.Keyboard.JustDown(keys.switchWeapon)) || this.gamepad.consumeJustPressed(1, 'switchWeapon'));
  }

  private getSelectedWeapon(): WeaponSpec {
    return WEAPONS[this.snapshot?.selectedWeapon ?? 'rocket'];
  }

  private updateEnemies(player: TankRuntime, mission: MissionConfig, difficulty: SessionSnapshot['difficulty'], dt: number, delta: number): void {
    for (const enemy of this.enemies) {
      if (!enemy.alive) {
        continue;
      }

      enemy.reloadTimer = Math.max(0, enemy.reloadTimer - delta);
      const angleToPlayer = Math.atan2(player.y - enemy.y, player.x - enemy.x);
      const distanceToPlayer = Phaser.Math.Distance.Between(enemy.x, enemy.y, player.x, player.y);
      enemy.exposed = enemy.kind === 'boss' && Math.sin(this.missionElapsed / 760) > 0.42;

      // Convoys and bosses are always committed; the rest wake on proximity and
      // only stand down once the player has pulled well clear again.
      if (enemy.kind !== 'convoy' && enemy.kind !== 'boss') {
        if (!enemy.alerted && distanceToPlayer < ENEMY_DETECT_RANGE) {
          enemy.alerted = true;
        } else if (enemy.alerted && distanceToPlayer > ENEMY_DISENGAGE_RANGE) {
          enemy.alerted = false;
          enemy.patrolPauseMs = 0;
          enemy.patrolTimeoutMs = PATROL_LEG_TIMEOUT_MS;
        }
      }

      if (enemy.alerted) {
        enemy.turretAngle = approachAngle(enemy.turretAngle, angleToPlayer, 4.8 * dt);
      } else {
        // idle sweep so a patrolling turret still looks like it is searching
        enemy.idleSweep += dt;
        const sweepAngle = enemy.bodyAngle + Math.sin(enemy.idleSweep * 0.8) * 0.95;
        enemy.turretAngle = approachAngle(enemy.turretAngle, sweepAngle, 1.7 * dt);
      }

      if (enemy.kind === 'convoy') {
        const escapeLine = mission.exitX ? mission.exitX - enemy.radius : mission.worldWidth - enemy.radius;
        enemy.x = Math.min(escapeLine, enemy.x + enemy.speed * dt);
        enemy.vx = enemy.x >= escapeLine ? 0 : enemy.speed;
        enemy.bodyAngle = 0;
      } else if (enemy.kind !== 'turret') {
        if (enemy.alerted) {
          const preferred = enemy.kind === 'boss' ? 430 : 310;
          const chase = distanceToPlayer > preferred ? 1 : distanceToPlayer < preferred * 0.55 ? -0.55 : 0.15;
          const strafe = Math.sin((this.missionElapsed + enemy.x * 17) / 900) * 0.42;
          const moveAngle = angleToPlayer + strafe;
          enemy.vx = Math.cos(moveAngle) * enemy.speed * chase;
          enemy.vy = Math.sin(moveAngle) * enemy.speed * chase;
        } else {
          this.stepPatrol(enemy, delta);
        }

        // Infantry dive aside when a tank bears down on them, so crushing takes
        // a deliberate line rather than just driving forward.
        if (isInfantry(enemy.kind) && distanceToPlayer < INFANTRY_DODGE_RANGE) {
          const closing = player.vx * (enemy.x - player.x) + player.vy * (enemy.y - player.y);
          if (closing > 0 && Math.hypot(player.vx, player.vy) > INFANTRY_CRUSH_SPEED * 0.6) {
            const away = angleToPlayer + Math.PI;
            const sidestep = away + (Math.sin(enemy.x * 0.7 + enemy.y * 0.3) > 0 ? 1 : -1) * Math.PI * 0.5;
            const urgency = 1 - distanceToPlayer / INFANTRY_DODGE_RANGE;
            enemy.vx += Math.cos(sidestep) * enemy.speed * 1.9 * urgency;
            enemy.vy += Math.sin(sidestep) * enemy.speed * 1.9 * urgency;
            enemy.alerted = true;
          }
        }

        enemy.x = clamp(enemy.x + enemy.vx * dt, enemy.radius, mission.worldWidth - enemy.radius);
        enemy.y = clamp(enemy.y + enemy.vy * dt, enemy.radius, mission.worldHeight - enemy.radius);
        this.resolveTankCoverCollision(enemy);

        if (Math.hypot(enemy.vx, enemy.vy) > 8) {
          enemy.bodyAngle = approachAngle(enemy.bodyAngle, Math.atan2(enemy.vy, enemy.vx), 3.2 * dt);
        }
      }
      enemy.trackPhase += Math.hypot(enemy.vx, enemy.vy) * dt;

      const openingGraceMs = mission.kind === 'assault' ? 3600 : 2000;
      const canFire = enemy.alerted
        && this.missionElapsed > openingGraceMs
        && enemy.reloadTimer <= 0
        && distanceToPlayer < 820;
      if (canFire) {
        const shot = ENEMY_SHOTS[enemy.kind as EnemyTankKind] ?? ENEMY_SHOTS.raider;
        this.fireProjectile(
          enemy,
          'enemy',
          enemy.damage * DIFFICULTY_DAMAGE[difficulty],
          enemy.shellSpeed,
          shot.blastRadius,
          shot.color,
          shot.style,
        );
      }
    }
  }

  private resolveTankCollisions(mission: MissionConfig): void {
    if (!this.player?.alive) {
      return;
    }

    const tanks = this.collisionTanks;
    tanks.length = 0;
    tanks.push(this.player);
    for (const enemy of this.enemies) {
      if (enemy.alive) {
        tanks.push(enemy);
      }
    }
    for (let firstIndex = 0; firstIndex < tanks.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < tanks.length; secondIndex += 1) {
        const first = tanks[firstIndex];
        const second = tanks[secondIndex];
        // Infantry intentionally remain crushable and can slip between hulls.
        if (isInfantry(first.kind) || isInfantry(second.kind)) {
          continue;
        }

        const dx = second.x - first.x;
        const dy = second.y - first.y;
        const minimumDistance = first.radius + second.radius;
        const distance = Math.hypot(dx, dy);
        if (distance >= minimumDistance) {
          continue;
        }

        const normalX = distance > 0.001 ? dx / distance : firstIndex % 2 === 0 ? 1 : -1;
        const normalY = distance > 0.001 ? dy / distance : 0;
        const overlap = minimumDistance - distance;
        const firstMovable = first.kind !== 'turret';
        const secondMovable = second.kind !== 'turret';
        const movableCount = Number(firstMovable) + Number(secondMovable);
        if (movableCount === 0) {
          continue;
        }

        if (firstMovable) {
          first.x -= normalX * overlap / movableCount;
          first.y -= normalY * overlap / movableCount;
          first.vx *= 0.62;
          first.vy *= 0.62;
        }
        if (secondMovable) {
          second.x += normalX * overlap / movableCount;
          second.y += normalY * overlap / movableCount;
          second.vx *= 0.62;
          second.vy *= 0.62;
        }

        for (const tank of [first, second]) {
          tank.x = clamp(tank.x, tank.radius, mission.worldWidth - tank.radius);
          tank.y = clamp(tank.y, tank.radius, mission.worldHeight - tank.radius);
          this.resolveTankCoverCollision(tank);
        }
      }
    }
  }

  private stepPatrol(enemy: TankRuntime, delta: number): void {
    if (enemy.patrol.length === 0 || enemy.speed <= 0) {
      enemy.vx = 0;
      enemy.vy = 0;
      return;
    }

    if (enemy.patrolPauseMs > 0) {
      enemy.patrolPauseMs -= delta;
      enemy.vx *= 0.82;
      enemy.vy *= 0.82;
      return;
    }

    const point = enemy.patrol[enemy.patrolIndex % enemy.patrol.length];
    const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, point.x, point.y);
    enemy.patrolTimeoutMs -= delta;

    // Advance on arrival, or give up on a leg that cover has made unreachable.
    if (distance <= PATROL_ARRIVE_RADIUS || enemy.patrolTimeoutMs <= 0) {
      enemy.patrolIndex = (enemy.patrolIndex + 1) % enemy.patrol.length;
      enemy.patrolPauseMs = 500 + (enemy.patrolIndex % 3) * 320;
      enemy.patrolTimeoutMs = PATROL_LEG_TIMEOUT_MS;
      enemy.vx = 0;
      enemy.vy = 0;
      return;
    }

    const angle = Math.atan2(point.y - enemy.y, point.x - enemy.x);
    const cruise = enemy.speed * 0.46;
    enemy.vx = Math.cos(angle) * cruise;
    enemy.vy = Math.sin(angle) * cruise;
  }

  private updateConvoyEscapeState(mission: MissionConfig, delta: number): void {
    if (mission.kind !== 'assault' || !mission.exitX || !this.player || this.missionResolved) {
      return;
    }

    const exitX = mission.exitX;
    const convoys = this.enemies.filter((enemy) => enemy.kind === 'convoy' && enemy.alive);
    if (convoys.length === 0) {
      this.convoyEscapeCountdownMs = 0;
      return;
    }

    const nearestEscapeSeconds = Math.min(...convoys.map((enemy) => Math.max(0, (exitX - enemy.radius - enemy.x) / Math.max(1, enemy.speed))));
    if (!this.convoyWarningShown && nearestEscapeSeconds <= CONVOY_WARNING_SECONDS) {
      this.convoyWarningShown = true;
      this.addFloatingText(this.player.x, this.player.y - 92, 'Convoy nearing exit!', 0xffd27a);
      this.audio?.playSfx('artillery', 0.45);
    }

    const escapedConvoy = convoys.find((enemy) => enemy.x >= exitX - enemy.radius - 1);
    if (!escapedConvoy) {
      this.convoyEscapeCountdownMs = 0;
      this.convoyBreachShown = false;
      return;
    }

    if (this.convoyEscapeCountdownMs <= 0) {
      this.convoyEscapeCountdownMs = CONVOY_ESCAPE_COUNTDOWN_MS;
    }

    if (!this.convoyBreachShown) {
      this.convoyBreachShown = true;
      this.addFloatingText(this.player.x, this.player.y - 108, 'Stop the carrier at the exit!', 0xff845f);
      this.playSpatialSfx('mission-fail', escapedConvoy.x, escapedConvoy.y, 0.62);
    }

    this.convoyEscapeCountdownMs -= delta;
    if (this.convoyEscapeCountdownMs <= 0) {
      this.failMission('Convoy escaped');
    }
  }

  private updateEscort(dt: number): void {
    const escort = this.escort;
    const player = this.player;
    if (!escort || !player || !this.mission) {
      return;
    }

    const distance = Phaser.Math.Distance.Between(escort.x, escort.y, player.x, player.y);
    const targetSpeed = distance < 235 ? 88 : 0;
    escort.vx += (targetSpeed - escort.vx) * (1 - Math.exp(-2.8 * dt));
    escort.x = clamp(escort.x + escort.vx * dt, 60, this.mission.worldWidth - 60);
    escort.y += Math.sin(this.missionElapsed / 800) * 8 * dt;

    for (const cover of this.covers) {
      if (!cover.solid || cover.health <= 0) {
        continue;
      }

      if (!circleRectOverlap(escort.x, escort.y, 30, cover)) {
        continue;
      }

      // Steer around the obstruction instead of clamping x: pinning the truck
      // behind a slab left it oscillating on the edge forever and the mission
      // could never be completed.
      const dy = escort.y - cover.y;
      const clearance = cover.height * 0.5 + 32 - Math.abs(dy);
      escort.y = clamp(
        escort.y + Math.sign(dy || 1) * Math.max(clearance, 1),
        70,
        this.mission.worldHeight - 70,
      );
      escort.vx *= 0.6;
    }
  }

  private updateProjectiles(dt: number): void {
    for (const projectile of this.projectiles) {
      if (projectile.homingStrength > 0) {
        this.steerHomingProjectile(projectile, dt);
      }

      projectile.previousX = projectile.x;
      projectile.previousY = projectile.y;
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      projectile.ttl -= dt * 1000;

      // arcing shells fly over cover and armor, detonating only at the aim point
      if (projectile.arcing) {
        const reachedTarget = Phaser.Math.Distance.Between(projectile.x, projectile.y, projectile.targetX, projectile.targetY) <= 18;
        const overshot = (projectile.x - projectile.targetX) * projectile.vx + (projectile.y - projectile.targetY) * projectile.vy > 0;
        if (reachedTarget || overshot || projectile.ttl <= 0) {
          if (projectile.kind === 'gas') {
            this.createGasCloud(projectile.x, projectile.y, projectile.blastRadius, projectile.damage, projectile.team);
          } else {
            this.createExplosion(projectile.x, projectile.y, projectile.blastRadius, projectile.color);
            this.damageArea(
              projectile.x,
              projectile.y,
              projectile.blastRadius,
              projectile.damage,
              projectile.team,
              undefined,
              projectile.feedback,
            );
          }
          projectile.ttl = -1;
        }
        continue;
      }

      // Suicide drones fly above battlefield cover before diving into a target.
      if (projectile.kind !== 'drone' && this.handleProjectileCoverHit(projectile)) {
        projectile.ttl = -1;
        continue;
      }

      if (projectile.team === 'player') {
        let hitCount = 0;
        for (const enemy of this.enemies) {
          if (!enemy.alive || projectile.hitTankIds.includes(enemy.id)) {
            continue;
          }
          const hitTime = segmentPointHitTime(
            projectile.previousX,
            projectile.previousY,
            projectile.x,
            projectile.y,
            enemy.x,
            enemy.y,
            enemy.radius + projectile.radius,
          );
          if (hitTime === null) {
            continue;
          }

          const candidate = this.projectileHitBuffer[hitCount];
          if (candidate) {
            candidate.enemy = enemy;
            candidate.hitTime = hitTime;
          } else {
            this.projectileHitBuffer.push({ enemy, hitTime });
          }
          hitCount += 1;
        }
        this.projectileHitBuffer.length = hitCount;
        if (hitCount > 1) {
          this.projectileHitBuffer.sort((a, b) => a.hitTime - b.hitTime);
        }

        for (let hitIndex = 0; hitIndex < hitCount; hitIndex += 1) {
          const { enemy, hitTime } = this.projectileHitBuffer[hitIndex];
          if (!enemy.alive) {
            continue;
          }

          const impactProjectile = {
            ...projectile,
            x: Phaser.Math.Linear(projectile.previousX, projectile.x, hitTime),
            y: Phaser.Math.Linear(projectile.previousY, projectile.y, hitTime),
          };
          this.damageTank(enemy, projectile.damage, impactProjectile, projectile.blastRadius);
          if (projectile.pierceRemaining > 0) {
            projectile.pierceRemaining -= 1;
            projectile.hitTankIds.push(enemy.id);
          } else {
            projectile.ttl = -1;
            break;
          }
        }
      } else {
        const playerHitTime = this.player
          ? segmentPointHitTime(
              projectile.previousX,
              projectile.previousY,
              projectile.x,
              projectile.y,
              this.player.x,
              this.player.y,
              this.player.radius + projectile.radius,
            )
          : null;
        const escortHitTime = this.escort
          ? segmentPointHitTime(
              projectile.previousX,
              projectile.previousY,
              projectile.x,
              projectile.y,
              this.escort.x,
              this.escort.y,
              34 + projectile.radius,
            )
          : null;

        if (this.player && playerHitTime !== null && (escortHitTime === null || playerHitTime <= escortHitTime)) {
          const impactProjectile = {
            ...projectile,
            x: Phaser.Math.Linear(projectile.previousX, projectile.x, playerHitTime),
            y: Phaser.Math.Linear(projectile.previousY, projectile.y, playerHitTime),
          };
          this.damageTank(this.player, projectile.damage, impactProjectile, projectile.blastRadius);
          projectile.ttl = -1;
        } else if (this.escort && escortHitTime !== null) {
          const impactX = Phaser.Math.Linear(projectile.previousX, projectile.x, escortHitTime);
          const impactY = Phaser.Math.Linear(projectile.previousY, projectile.y, escortHitTime);
          this.escort.health -= projectile.damage * 0.8;
          this.createImpactEffect(impactX, impactY, projectile, false, projectile.blastRadius <= 0);
          this.createExplosion(impactX, impactY, projectile.blastRadius, projectile.color);
          projectile.ttl = -1;
          if (this.escort.health <= 0) {
            this.failMission('Escort destroyed');
          }
        }
      }
    }

    this.projectiles = this.projectiles.filter((projectile) => {
      const mission = this.mission;
      if (!mission) {
        return false;
      }

      const inBounds = projectile.x > -100 && projectile.y > -100 && projectile.x < mission.worldWidth + 100 && projectile.y < mission.worldHeight + 100;
      if (!inBounds && projectile.ttl > 0) {
        this.createExplosion(projectile.x, projectile.y, projectile.blastRadius * 0.45, projectile.color);
      }
      return projectile.ttl > 0 && inBounds;
    });
  }

  private steerHomingProjectile(projectile: ProjectileRuntime, dt: number): void {
    let target: TankRuntime | undefined;
    let nearestDistanceSquared = Infinity;
    if (projectile.team === 'player') {
      for (const enemy of this.enemies) {
        if (!enemy.alive) {
          continue;
        }
        const dx = enemy.x - projectile.x;
        const dy = enemy.y - projectile.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared < nearestDistanceSquared) {
          target = enemy;
          nearestDistanceSquared = distanceSquared;
        }
      }
    } else if (this.player?.alive) {
      target = this.player;
    }
    if (!target) {
      return;
    }

    const speed = Math.hypot(projectile.vx, projectile.vy);
    const desired = Math.atan2(target.y - projectile.y, target.x - projectile.x);
    const steered = approachAngle(Math.atan2(projectile.vy, projectile.vx), desired, projectile.homingStrength * dt);
    projectile.vx = Math.cos(steered) * speed;
    projectile.vy = Math.sin(steered) * speed;
  }

  private handleProjectileCoverHit(projectile: ProjectileRuntime): boolean {
    let nearest: { cover: CoverRuntime; hitTime: number } | undefined;
    for (const cover of this.covers) {
      if (cover.health <= 0 || cover.kind === 'repair' || cover.kind === 'armory' || cover.spent) {
        continue;
      }

      if (cover.kind === 'houseOpen' && this.projectileCanUseHouseOpening(projectile, cover)) {
        continue;
      }

      const hitTime = cover.kind === 'mine'
        ? segmentPointHitTime(
            projectile.previousX,
            projectile.previousY,
            projectile.x,
            projectile.y,
            cover.x,
            cover.y,
            32 + projectile.radius,
          )
        : segmentRectHitTime(projectile, cover);
      if (hitTime === null || (nearest && hitTime >= nearest.hitTime)) {
        continue;
      }

      nearest = { cover, hitTime };
    }

    if (!nearest) {
      return false;
    }

    const { cover, hitTime } = nearest;
    projectile.x = Phaser.Math.Linear(projectile.previousX, projectile.x, hitTime);
    projectile.y = Phaser.Math.Linear(projectile.previousY, projectile.y, hitTime);

    if (cover.kind === 'barrel' || cover.kind === 'mine') {
      cover.health = 0;
      this.destroyCover(cover, projectile.team, projectile.damage);
    } else {
      // Structural durability is measured in direct ordnance hits so chassis
      // upgrades do not make a one-shot crate or an eight-shot rock wall vary
      // wildly. Small-arms fire can still chip cover, but much more slowly.
      const structuralDamage = projectile.sourceKind === 'rifleman' && projectile.kind === 'shell' ? 0.25 : 1;
      this.damageCover(cover, structuralDamage, projectile.team);
      this.createImpactEffect(projectile.x, projectile.y, projectile, false, projectile.blastRadius <= 0);
      this.createExplosion(projectile.x, projectile.y, projectile.blastRadius * 0.55, projectile.color);
    }

    return true;
  }

  private projectileCanUseHouseOpening(projectile: ProjectileRuntime, cover: CoverRuntime): boolean {
    if (!pointInsideCover(projectile.previousX, projectile.previousY, cover)) {
      return false;
    }

    const halfWidth = cover.width * 0.5;
    const halfHeight = cover.height * 0.5;
    const doorHalfSize = Math.min(24, (cover.doorSide === 'left' || cover.doorSide === 'right' ? cover.height : cover.width) * 0.24);
    if (cover.doorSide === 'left' || cover.doorSide === 'right') {
      const edgeX = cover.x + (cover.doorSide === 'right' ? halfWidth : -halfWidth);
      const timeToEdge = (edgeX - projectile.previousX) / projectile.vx;
      const exitY = projectile.previousY + projectile.vy * timeToEdge;
      return timeToEdge >= 0 && Math.abs(exitY - cover.y) <= doorHalfSize;
    }

    const edgeY = cover.y + (cover.doorSide === 'bottom' ? halfHeight : -halfHeight);
    const timeToEdge = (edgeY - projectile.previousY) / projectile.vy;
    const exitX = projectile.previousX + projectile.vx * timeToEdge;
    return timeToEdge >= 0 && Math.abs(exitX - cover.x) <= doorHalfSize;
  }

  private damageCover(cover: CoverRuntime, damage: number, sourceTeam: Team): void {
    if (cover.health <= 0 || cover.spent || damage <= 0) {
      return;
    }

    cover.health = Math.max(0, cover.health - damage);
    this.staticLayerDirty = true;
    if (cover.health <= 0) {
      this.destroyCover(cover, sourceTeam, damage);
    }
  }

  private destroyCover(cover: CoverRuntime, sourceTeam: Team, triggeringDamage: number): void {
    if (cover.spent) {
      return;
    }

    cover.health = 0;
    cover.solid = false;
    cover.spent = true;
    this.staticLayerDirty = true;
    this.clearShelter(cover.id);

    if (cover.kind === 'barrel') {
      this.createExplosion(cover.x, cover.y, 145, 0xff9b42);
      this.dropCash(cover.x, cover.y, 12);
      this.damageArea(cover.x, cover.y, 145, triggeringDamage * 1.2, sourceTeam);
      return;
    }

    if (cover.kind === 'mine') {
      this.createExplosion(cover.x, cover.y, 118, 0xff7055);
      this.damageArea(cover.x, cover.y, 118, triggeringDamage, sourceTeam);
      return;
    }

    const isHouse = cover.kind === 'houseOpen' || cover.kind === 'houseSealed';
    if (isHouse) {
      this.createExplosion(cover.x, cover.y, Math.max(96, cover.width * 0.7), 0xff9b55);
    }
    const destroyedLabel = cover.kind === 'rockWall' ? 'Rock Wall Broken' : isHouse ? 'House Destroyed' : 'Cover Broken';
    this.addFloatingText(cover.x, cover.y - 28, destroyedLabel, 0xf0c15a);
    this.dropCash(cover.x, cover.y, cover.kind === 'concrete' || cover.kind === 'rockWall' || isHouse ? 22 : 14);

    if (cover.kind === 'houseSealed') {
      this.releaseHouseGarrison(cover);
    }
  }

  private releaseHouseGarrison(cover: CoverRuntime): void {
    if (cover.garrisonReleased) {
      return;
    }

    cover.garrisonReleased = true;
    const difficulty = this.snapshot?.difficulty;
    const mission = this.mission;
    if (!difficulty || !mission || cover.garrison.length === 0) {
      return;
    }

    const count = cover.garrison.length;
    cover.garrison.forEach((kind, index) => {
      const angle = -Math.PI * 0.5 + (index - (count - 1) * 0.5) * 0.72;
      const distance = Math.max(cover.width, cover.height) * 0.58 + 26;
      const x = clamp(cover.x + Math.cos(angle) * distance, 35, mission.worldWidth - 35);
      const y = clamp(cover.y + Math.sin(angle) * distance, 35, mission.worldHeight - 35);
      const enemy = this.createEnemy(
        kind,
        `${cover.id}-garrison-${index + 1}`,
        x,
        y,
        difficulty,
        this.snapshot?.currentMissionIndex ?? 0,
        undefined,
        this.enemies.length + index,
      );
      enemy.alerted = true;
      enemy.reloadTimer = 650 + index * 180;
      this.enemies.push(enemy);
    });

    this.addFloatingText(cover.x, cover.y - 54, `AMBUSH x${count}`, 0xff7447);
  }

  private clearShelter(coverId: string): void {
    if (this.player?.shelteredBy === coverId) {
      this.player.shelteredBy = undefined;
    }
    for (const enemy of this.enemies) {
      if (enemy.shelteredBy === coverId) {
        enemy.shelteredBy = undefined;
      }
    }
  }

  private updateExplosions(delta: number): void {
    for (const explosion of this.explosions) {
      explosion.age += delta;
    }
    this.explosions = this.explosions.filter((explosion) => explosion.age < explosion.duration);

    for (const text of this.floatingTexts) {
      text.age += delta;
      text.y -= delta * 0.025;
      text.label.setPosition(text.x, text.y);
      text.label.setAlpha(1 - clamp(text.age / text.duration, 0, 1));
    }
    this.floatingTexts = this.floatingTexts.filter((text) => {
      if (text.age < text.duration) {
        return true;
      }

      text.label.destroy();
      return false;
    });
  }

  private updateCombatFeedback(delta: number): void {
    for (const flash of this.muzzleFlashes) {
      flash.age += delta;
    }
    this.muzzleFlashes = this.muzzleFlashes.filter((flash) => flash.age < flash.duration);

    for (const impact of this.impacts) {
      impact.age += delta;
    }
    this.impacts = this.impacts.filter((impact) => impact.age < impact.duration);

    if (this.player) {
      this.player.hitFlashMs = Math.max(0, this.player.hitFlashMs - delta);
    }
    for (const enemy of this.enemies) {
      enemy.hitFlashMs = Math.max(0, enemy.hitFlashMs - delta);
    }
  }

  private updateCaptureZones(player: TankRuntime, dt: number): void {
    for (const zone of this.captureZones) {
      if (zone.progress >= 1) {
        continue;
      }

      const playerDx = player.x - zone.x;
      const playerDy = player.y - zone.y;
      const radiusSquared = zone.radius * zone.radius;
      const playerInside = playerDx * playerDx + playerDy * playerDy < radiusSquared;
      let enemyInside = false;
      for (const enemy of this.enemies) {
        const enemyDx = enemy.x - zone.x;
        const enemyDy = enemy.y - zone.y;
        if (enemy.alive && enemyDx * enemyDx + enemyDy * enemyDy < radiusSquared) {
          enemyInside = true;
          break;
        }
      }
      const previousProgress = zone.progress;
      if (playerInside && !enemyInside) {
        zone.progress = Math.min(1, zone.progress + dt * 0.22);
      } else if (enemyInside) {
        zone.progress = Math.max(0, zone.progress - dt * 0.08);
      }
      if (previousProgress < 1 && zone.progress >= 1) {
        this.playSpatialSfx('capture', zone.x, zone.y, 0.9);
      }
    }
  }

  private updateRepairPads(player: TankRuntime, stats: TankStats, dt: number): void {
    for (const pad of this.covers) {
      if (pad.kind !== 'repair' || pad.spent) {
        continue;
      }
      if (!circleRectOverlap(player.x, player.y, player.radius, pad)) {
        continue;
      }

      player.health = Math.min(player.maxHealth, player.health + (22 + stats.repairCharges * 4) * dt);
    }
  }

  /** Driving onto an armory box swaps you onto a weapon you do not have yet. */
  private updateArmoryBoxes(player: TankRuntime): void {
    for (const box of this.covers) {
      if (box.kind !== 'armory' || box.spent) {
        continue;
      }

      if (!circleRectOverlap(player.x, player.y, player.radius, box)) {
        continue;
      }

      box.spent = true;
      const weaponId = this.director.rollFieldWeapon();
      this.director.grantWeapon(weaponId);
      this.addFloatingText(box.x, box.y - 30, WEAPONS[weaponId].label, 0x95e7ff);
      this.createExplosion(box.x, box.y, 42, 0x95e7ff);
      this.audio?.playSfx('upgrade', 0.85);
    }
  }

  private updateMines(player: TankRuntime): void {
    for (const mine of this.covers) {
      if (mine.kind !== 'mine' || mine.spent || mine.health <= 0) {
        continue;
      }

      let target: TankRuntime | undefined;
      const playerDx = player.x - mine.x;
      const playerDy = player.y - mine.y;
      const playerTriggerRadius = player.radius + 24;
      if (playerDx * playerDx + playerDy * playerDy < playerTriggerRadius * playerTriggerRadius) {
        target = player;
      } else {
        for (const enemy of this.enemies) {
          if (!enemy.alive) {
            continue;
          }
          const dx = enemy.x - mine.x;
          const dy = enemy.y - mine.y;
          const triggerRadius = enemy.radius + 24;
          if (dx * dx + dy * dy < triggerRadius * triggerRadius) {
            target = enemy;
            break;
          }
        }
      }
      if (!target) {
        continue;
      }

      mine.spent = true;
      mine.health = 0;
      this.createExplosion(mine.x, mine.y, 120, 0xff704f);
      this.damageArea(mine.x, mine.y, 120, 90, target.team === 'player' ? 'enemy' : 'player');
    }
  }

  /**
   * Tracks crush infantry. Previously the tank drove straight through soldiers
   * with no interaction at all, which read as a bug. Crushing needs real speed,
   * and alerted infantry scatter out of the way (see updateEnemies), so running
   * a whole squad down is a commitment rather than a free win.
   */
  private updateInfantryCrush(player: TankRuntime): void {
    if (!player.alive) {
      return;
    }

    const speed = Math.hypot(player.vx, player.vy);
    if (speed < INFANTRY_CRUSH_SPEED) {
      return;
    }

    for (const enemy of this.enemies) {
      if (!enemy.alive || !isInfantry(enemy.kind)) {
        continue;
      }

      const distance = Phaser.Math.Distance.Between(player.x, player.y, enemy.x, enemy.y);
      if (distance > player.radius + enemy.radius * 0.7) {
        continue;
      }

      enemy.alive = false;
      this.createExplosion(enemy.x, enemy.y, enemy.radius * 1.8, 0xbb4a20);
      this.addFloatingText(enemy.x, enemy.y - 24, 'Crushed', 0xff7447);
      this.director.addScore(Math.round(enemy.score * 0.6));
      this.dropCash(enemy.x, enemy.y, Math.round(this.cashForEnemy(enemy) * 0.6));

      // shoving a body under the tracks costs a little momentum
      player.vx *= 0.86;
      player.vy *= 0.86;
    }
  }


  /**
   * Cash value of a kill. It keys off the template scrap rating, so tougher
   * targets naturally pay more: a rifleman is worth a few coins, a boss a pile.
   */
  private cashForEnemy(enemy: TankRuntime): number {
    const template = ENEMY_TEMPLATES[enemy.kind as EnemyTankKind];
    const base = template ? template.scrap : 10;
    return Math.max(3, Math.round(base * 2.2));
  }

  private dropCash(x: number, y: number, value: number): void {
    if (value <= 0) {
      return;
    }

    // split larger payouts into a few coins so a big kill visibly showers loot
    const coins = value >= 60 ? 3 : value >= 25 ? 2 : 1;
    const each = Math.max(1, Math.round(value / coins));
    for (let i = 0; i < coins; i += 1) {
      const angle = (i / coins) * Math.PI * 2 + 0.6;
      this.pickups.push({
        x, y,
        vx: Math.cos(angle) * 70,
        vy: Math.sin(angle) * 70,
        value: each,
        age: 0,
        ttl: PICKUP_TTL_MS,
      });
    }
  }

  private updatePickups(player: TankRuntime, dt: number, delta: number): void {
    for (const pickup of this.pickups) {
      pickup.age += delta;
      const distance = Phaser.Math.Distance.Between(pickup.x, pickup.y, player.x, player.y);

      if (distance < PICKUP_MAGNET_RANGE) {
        // drift toward the player so collecting does not demand pixel precision
        const pull = (1 - distance / PICKUP_MAGNET_RANGE) * 900;
        const angle = Math.atan2(player.y - pickup.y, player.x - pickup.x);
        pickup.vx += Math.cos(angle) * pull * dt;
        pickup.vy += Math.sin(angle) * pull * dt;
      }

      pickup.vx *= 0.92;
      pickup.vy *= 0.92;
      pickup.x += pickup.vx * dt;
      pickup.y += pickup.vy * dt;

      if (distance < player.radius + 16) {
        pickup.age = pickup.ttl + 1;
        this.director.addCredits(pickup.value);
        this.addFloatingText(pickup.x, pickup.y - 18, `+$${pickup.value}`, 0xffd766);
      }
    }

    this.pickups = this.pickups.filter((pickup) => pickup.age <= pickup.ttl);
  }

  private updateShield(player: TankRuntime, stats: TankStats, dt: number, delta: number): void {
    player.shieldMax = stats.shieldMax;
    this.shieldQuietMs = Math.max(0, this.shieldQuietMs - delta);
    if (this.shieldQuietMs > 0 || player.shield >= player.shieldMax) {
      player.shield = Math.min(player.shield, player.shieldMax);
      return;
    }

    player.shield = Math.min(player.shieldMax, player.shield + stats.shieldRegen * dt);
  }

  private drawPickups(graphics: Phaser.GameObjects.Graphics): void {
    for (const pickup of this.pickups) {
      if (!this.isVisible(pickup.x, pickup.y, 32)) {
        continue;
      }

      const bob = Math.sin((pickup.age + pickup.value * 90) / 260) * 3;
      const fading = pickup.age > pickup.ttl - 3000;
      const alpha = fading ? 0.35 + 0.65 * Math.abs(Math.sin(pickup.age / 120)) : 1;
      const y = pickup.y + bob;

      graphics.fillStyle(0x05070a, 0.3 * alpha);
      graphics.fillEllipse(pickup.x, pickup.y + 9, 18, 7);
      graphics.fillStyle(0x8a6a1e, alpha);
      graphics.fillCircle(pickup.x, y, 9);
      graphics.fillStyle(0xffd766, alpha);
      graphics.fillCircle(pickup.x, y, 7);
      graphics.lineStyle(1.5, 0x6b4f12, 0.85 * alpha);
      graphics.strokeCircle(pickup.x, y, 7);
      graphics.fillStyle(0x6b4f12, alpha);
      graphics.fillRect(pickup.x - 1, y - 4, 2, 8);
    }
  }

  private syncPickupLabels(): void {
    // the value text rides along as a pooled Phaser text object
    while (this.pickupLabels.length < this.pickups.length) {
      const label = this.add.text(0, 0, '', {
        color: '#ffe9a8',
        fontFamily: 'Bahnschrift, Trebuchet MS, sans-serif',
        fontSize: '12px',
        fontStyle: '700',
        stroke: '#1a1206',
        strokeThickness: 3,
      });
      label.setOrigin(0.5);
      label.setDepth(11);
      this.pickupLabels.push(label);
    }

    for (let i = 0; i < this.pickupLabels.length; i += 1) {
      const label = this.pickupLabels[i];
      const pickup = this.pickups[i];
      if (!pickup) {
        label.setVisible(false);
        continue;
      }

      label.setVisible(this.isVisible(pickup.x, pickup.y, 32));
      label.setText(`$${pickup.value}`);
      label.setPosition(pickup.x, pickup.y - 16);
    }
  }

  private updateMissionState(mission: MissionConfig, delta: number): void {
    if (this.missionResolved || !this.player) {
      return;
    }

    if (this.player.health <= 0) {
      this.failMission('Tank destroyed');
      return;
    }

    if (mission.kind === 'assault' && this.enemies.every((enemy) => !enemy.alive) && this.pendingGarrisonCount() === 0) {
      this.completeMission();
      return;
    }

    if (mission.kind === 'defense') {
      const zone = this.captureZones[0];
      const inZone = zone && Phaser.Math.Distance.Between(this.player.x, this.player.y, zone.x, zone.y) <= zone.radius;
      if (inZone) {
        this.defenseHeldMs += delta;
      }
      if (mission.durationMs && this.defenseHeldMs >= mission.durationMs) {
        this.completeMission();
        return;
      }
    }

    if (mission.kind === 'escort' && this.escort) {
      if (this.escort.health <= 0) {
        this.failMission('Escort destroyed');
        return;
      }
      if (this.escort.x >= this.escort.exitX) {
        this.completeMission();
        return;
      }
    }

    if (mission.kind === 'capture' && this.captureZones.length > 0 && this.captureZones.every((zone) => zone.progress >= 1)) {
      this.completeMission();
      return;
    }

    if (mission.kind === 'boss') {
      const bossAlive = this.enemies.some((enemy) => enemy.kind === 'boss' && enemy.alive);
      if (!bossAlive) {
        this.completeMission();
      }
    }
  }

  private completeMission(): void {
    if (this.missionResolved || !this.snapshot || !this.player) {
      return;
    }

    this.missionResolved = true;
    const aliveBonus = Math.round(Math.max(0, this.player.health) * 0.8);
    const clearBonus = 420 + this.snapshot.currentMissionIndex * 160;
    const score = clearBonus + aliveBonus;
    const bonus = this.calculateMissionBonus();
    // Every clear should fund at least one meaningful depot decision. Later
    // stages pay more because their recommended upgrades and chassis cost more.
    const scrap = 125
      + this.snapshot.currentMissionIndex * 38
      + Math.round(this.enemies.filter((enemy) => !enemy.alive).reduce((sum, enemy) => sum + enemy.scrap, 0) * 0.65);
    this.addFloatingText(this.player.x, this.player.y - 70, `Mission Clear +$${bonus.total}`, 0xa2db7c);
    this.audio?.setEngineLoad(0);
    this.audio?.playSfx('mission-clear', 0.9);
    const generation = this.missionGeneration;
    this.time.delayedCall(600, () => {
      if (generation === this.missionGeneration) {
        this.director.completeCurrentMission({ score, scrap, bonus });
      }
    });
  }

  private calculateMissionBonus(): MissionBonusBreakdown {
    const timeLimitSeconds = MISSION_BONUS_DURATION_MS / 1000;
    const elapsedSeconds = Math.max(0, Math.ceil(this.missionElapsed / 1000));
    const remainingSeconds = Math.max(0, timeLimitSeconds - elapsedSeconds);
    const remainingObjects = this.covers.reduce((count, cover) => (
      count + (PRESERVATION_BONUS_KINDS.has(cover.kind) && cover.health > 0 && !cover.spent ? 1 : 0)
    ), 0);
    const timeBonus = remainingSeconds * TIME_BONUS_PER_SECOND;
    const objectBonus = remainingObjects * OBJECT_BONUS_PER_OBJECT;

    return {
      timeLimitSeconds,
      elapsedSeconds,
      remainingSeconds,
      timeBonusRate: TIME_BONUS_PER_SECOND,
      timeBonus,
      remainingObjects,
      objectBonusRate: OBJECT_BONUS_PER_OBJECT,
      objectBonus,
      total: timeBonus + objectBonus,
    };
  }

  private failMission(reason: string): void {
    if (this.missionResolved) {
      return;
    }

    this.missionResolved = true;
    this.audio?.setEngineLoad(0);
    this.audio?.playSfx('mission-fail', 0.95);
    if (this.player) {
      this.addFloatingText(this.player.x, this.player.y - 70, reason, 0xff845f);
    }
    const generation = this.missionGeneration;
    this.time.delayedCall(900, () => {
      if (generation === this.missionGeneration) {
        this.director.failMission(reason);
      }
    });
  }

  private fireProjectile(
    source: TankRuntime,
    team: Team,
    damage: number,
    shellSpeed: number,
    blastRadius: number,
    color: number,
    kind: ProjectileKind = 'shell',
    ignoreReload = false,
    options: {
      angleOffset?: number;
      ttlMs?: number;
      pierce?: number;
      homingStrength?: number;
      arcing?: boolean;
      target?: { x: number; y: number };
      feedback?: WeaponFeedbackStyle;
      emitLaunchFeedback?: boolean;
    } = {},
  ): void {
    if (!source.alive || (!ignoreReload && source.reloadTimer > 0)) {
      return;
    }

    const angle = source.turretAngle + (options.angleOffset ?? 0);
    const muzzleDistance = source.radius + 20;
    const x = source.x + Math.cos(angle) * muzzleDistance;
    const y = source.y + Math.sin(angle) * muzzleDistance;
    const feedback = options.feedback ?? this.defaultFeedbackForShot(source, kind);
    const feedbackProfile = COMBAT_FEEDBACK[feedback];
    if (!ignoreReload) {
      source.reloadTimer = source.reloadMs;
    }
    const emitLaunchFeedback = options.emitLaunchFeedback ?? true;
    if (emitLaunchFeedback) {
      const recoil = feedbackProfile.recoil * (team === 'player' ? 1 : 0.32);
      source.vx -= Math.cos(angle) * recoil;
      source.vy -= Math.sin(angle) * recoil;
    }
    this.projectiles.push({
      id: this.projectileSerial,
      team,
      kind,
      sourceKind: source.kind,
      x,
      y,
      previousX: x,
      previousY: y,
      vx: Math.cos(angle) * shellSpeed,
      vy: Math.sin(angle) * shellSpeed,
      damage,
      blastRadius,
      radius: team === 'player' ? 10 : 8,
      ttl: options.ttlMs ?? 1800,
      color,
      pierceRemaining: options.pierce ?? 0,
      homingStrength: options.homingStrength ?? 0,
      arcing: options.arcing ?? false,
      targetX: options.target?.x ?? x,
      targetY: options.target?.y ?? y,
      hitTankIds: [],
      feedback,
    });
    this.projectileSerial += 1;
    if (emitLaunchFeedback) {
      this.createMuzzleFlash(x, y, angle, color, feedback);
      this.playSpatialSfx(feedbackProfile.fireCue, source.x, source.y, team === 'player' ? 1 : 0.42);
    }
  }

  private defaultFeedbackForShot(source: TankRuntime, kind: ProjectileKind): WeaponFeedbackStyle {
    if (source.kind === 'rifleman') {
      return 'smallArm';
    }
    if (source.kind === 'rocketeer') {
      return 'rocket';
    }
    if (kind === 'mortar') {
      return 'mortar';
    }
    if (kind === 'rail') {
      return 'rail';
    }
    if (kind === 'gas') {
      return 'chemical';
    }
    if (kind === 'drone') {
      return 'drone';
    }
    return kind === 'rocket' ? 'rocket' : 'cannon';
  }

  private fireSelectedWeapon(player: TankRuntime, stats: TankStats, weapon: WeaponSpec): void {
    const weaponLevel = this.snapshot?.weaponLevels[weapon.id] ?? 1;
    const upgradeSteps = Math.max(0, weaponLevel - 1);
    const damage = stats.shellDamage * weapon.damageScale * Math.pow(1.18, upgradeSteps);
    const speed = stats.shellSpeed * weapon.speedScale * Math.pow(1.05, upgradeSteps);
    const aim = { ...this.lastPointerWorld };
    const generation = this.missionGeneration;

    for (let index = 0; index < weapon.shots; index += 1) {
      const spreadStep = weapon.shots > 1 ? weapon.spread * (index / (weapon.shots - 1) - 0.5) : 0;
      const launch = (): void => {
        if (generation !== this.missionGeneration || this.player !== player || !player.alive || this.snapshot?.phase !== 'playing') {
          return;
        }

        this.fireProjectile(player, 'player', damage, speed, weapon.blastRadius, weapon.color, weapon.style, true, {
          angleOffset: spreadStep,
          ttlMs: weapon.ttlMs,
          pierce: weapon.pierce,
          homingStrength: weapon.homingStrength,
          arcing: weapon.arcing,
          target: aim,
          feedback: weapon.feedback,
          // A simultaneous spread is one trigger event, while a timed burst
          // should kick and flash for every round.
          emitLaunchFeedback: weapon.burstDelayMs > 0 || index === 0,
        });
      };

      if (weapon.burstDelayMs > 0 && index > 0) {
        this.time.delayedCall(weapon.burstDelayMs * index, launch);
      } else {
        launch();
      }
    }

    this.addFloatingText(player.x, player.y - 48, weapon.label, weapon.color);
  }

  private damageTank(
    target: TankRuntime,
    damage: number,
    projectile: ProjectileRuntime,
    blastRadius: number,
    fromArea = false,
  ): void {
    const incomingAngle = Math.atan2(-projectile.vy, -projectile.vx);
    const facing = Math.abs(angleDifference(target.bodyAngle, incomingAngle));
    const frontHit = facing < Math.PI * 0.34;
    const rearHit = facing > Math.PI * 0.68;
    let multiplier = 1;

    if (frontHit) {
      multiplier = target.team === 'player' ? 0.62 : 0.74;
    } else if (rearHit) {
      multiplier = 1.42;
    }

    if (target.kind === 'boss' && !target.exposed) {
      multiplier *= 0.58;
    }

    const shelter = target.shelteredBy
      ? this.covers.find((cover) => cover.id === target.shelteredBy && cover.kind === 'houseOpen' && cover.health > 0 && !cover.spent)
      : undefined;
    if (shelter && pointInsideCover(target.x, target.y, shelter, 4)) {
      multiplier *= 0.2;
    }

    const applied = damage * multiplier * (target.team === 'player' && this.snapshot ? 1 / this.snapshot.tankStats.armor : 1);

    // Shields soak first and stop regenerating for a moment after a hit, which
    // is what makes rifle fire a nuisance rather than a real threat.
    let remaining = applied;
    let absorbed = 0;
    if (target.shield > 0) {
      absorbed = Math.min(target.shield, remaining);
      target.shield -= absorbed;
      remaining -= absorbed;
      if (target.team === 'player') {
        this.shieldQuietMs = SHIELD_RECHARGE_DELAY_MS;
      }
    } else if (target.team === 'player') {
      this.shieldQuietMs = SHIELD_RECHARGE_DELAY_MS;
    }

    target.health -= remaining;
    const shieldHit = absorbed > 0;
    const profile = COMBAT_FEEDBACK[projectile.feedback];
    const hitDuration = clamp(85 + applied * 0.9, 90, 190);
    const flashWindow = Math.max(target.hitFlashMs, hitDuration);
    target.hitFlashMs = flashWindow;
    target.hitFlashMaxMs = flashWindow;
    target.hitFlashColor = shieldHit ? 0x7cf6ff : projectile.color;

    const velocity = Math.hypot(projectile.vx, projectile.vy);
    if (velocity > 0.001) {
      const shelterScale = shelter ? 0.25 : 1;
      const strengthScale = clamp(applied / Math.max(1, damage), 0.35, 1.5);
      const impulse = profile.hitImpulse * strengthScale * shelterScale;
      target.vx += projectile.vx / velocity * impulse;
      target.vy += projectile.vy / velocity * impulse;
    }

    if (!fromArea) {
      this.createImpactEffect(
        projectile.x,
        projectile.y,
        projectile,
        shieldHit,
        shieldHit || blastRadius <= 0,
      );
    }
    if (blastRadius > 0) {
      this.createExplosion(projectile.x, projectile.y, blastRadius, projectile.color);
      this.damageArea(
        projectile.x,
        projectile.y,
        blastRadius,
        damage * 0.42,
        projectile.team,
        target.id,
        projectile.feedback,
      );
    }

    const roundedApplied = Math.max(1, Math.round(applied));
    const hitLabel = shieldHit
      ? remaining > 0 ? `SHIELD BREAK ${Math.max(1, Math.round(remaining))}` : `SHIELD ${Math.max(1, Math.round(absorbed))}`
      : shelter ? `COVER ${roundedApplied}`
        : rearHit ? `REAR ${roundedApplied}`
          : frontHit ? `FRONT ${roundedApplied}`
            : `HIT ${roundedApplied}`;
    this.addFloatingText(
      target.x,
      target.y - target.radius - 18,
      hitLabel,
      shieldHit ? 0x7cf6ff : target.team === 'player' ? 0xff845f : 0xf0d78b,
    );

    if (this.effectsEnabled() && target.team === 'player' && this.playerHitShakeCooldownMs <= 0 && applied >= 3 && this.cameras.main) {
      const shake = clamp(profile.cameraShake + applied / 45000, 0.00045, 0.0048);
      this.cameras.main.shake(55, shake);
      this.playerHitShakeCooldownMs = PLAYER_HIT_SHAKE_COOLDOWN_MS;
    }

    if (target.health <= 0 && target.alive) {
      target.alive = false;
      this.createExplosion(target.x, target.y, target.radius * 2.6, target.team === 'player' ? 0xff5147 : 0xffb24a);
      if (target.team === 'enemy') {
        this.director.addScore(target.score);
        this.dropCash(target.x, target.y, this.cashForEnemy(target));
      }
    }
  }

  private damageArea(
    x: number,
    y: number,
    radius: number,
    damage: number,
    sourceTeam: Team,
    ignoreTankId?: string,
    feedback: WeaponFeedbackStyle = 'cannon',
  ): void {
    const targets = sourceTeam === 'player'
      ? this.enemies.filter((enemy) => enemy.alive)
      : this.player ? [this.player] : [];

    for (const target of targets) {
      if (target.id === ignoreTankId) {
        continue;
      }

      const distance = Phaser.Math.Distance.Between(x, y, target.x, target.y);
      if (distance > radius + target.radius) {
        continue;
      }

      const falloff = 1 - clamp(distance / (radius + target.radius), 0, 0.85);
      const fakeProjectile: ProjectileRuntime = {
        id: -1,
        team: sourceTeam,
        kind: 'shell',
        sourceKind: sourceTeam === 'player' ? 'player' : 'raider',
        x,
        y,
        previousX: x,
        previousY: y,
        vx: target.x - x,
        vy: target.y - y,
        damage: damage * falloff,
        blastRadius: radius,
        radius: 1,
        ttl: 0,
        color: 0xffaa55,
        pierceRemaining: 0,
        homingStrength: 0,
        arcing: false,
        targetX: x,
        targetY: y,
        hitTankIds: [],
        feedback,
      };
      this.damageTank(target, damage * falloff, fakeProjectile, 0, true);
    }

    if (sourceTeam === 'enemy' && this.escort) {
      const distance = Phaser.Math.Distance.Between(x, y, this.escort.x, this.escort.y);
      if (distance <= radius + 34) {
        this.escort.health -= damage * 0.45;
      }
    }

    for (const cover of this.covers) {
      if (cover.health <= 0 || cover.kind === 'repair' || cover.kind === 'armory' || cover.spent) {
        continue;
      }

      const distance = Phaser.Math.Distance.Between(x, y, cover.x, cover.y);
      if (distance <= radius + Math.max(cover.width, cover.height) * 0.5) {
        // Splash is converted from combat HP into structural-hit units. A
        // normal tank shell contributes roughly half a direct hit as splash.
        this.damageCover(cover, damage * 0.55 / 95, sourceTeam);
      }
    }
  }

  private playSpatialSfx(cue: TankSfxCue, x: number, y: number, intensity = 1): void {
    const player = this.player;
    if (!player) {
      this.audio?.playSfx(cue, intensity * 0.45);
      return;
    }

    const distance = Phaser.Math.Distance.Between(x, y, player.x, player.y);
    const falloff = clamp(1 - distance / 1500, 0.16, 1);
    this.audio?.playSfx(cue, intensity * falloff);
  }

  private createMuzzleFlash(
    x: number,
    y: number,
    angle: number,
    color: number,
    feedback: WeaponFeedbackStyle,
  ): void {
    const profile = COMBAT_FEEDBACK[feedback];
    this.muzzleFlashes.push({
      x,
      y,
      angle,
      age: 0,
      duration: profile.muzzleDurationMs,
      size: profile.muzzleSize,
      color,
      feedback,
    });
    const muzzleFlashLimit = this.effectsEnabled() ? MAX_MUZZLE_FLASHES : REDUCED_MAX_MUZZLE_FLASHES;
    if (this.muzzleFlashes.length > muzzleFlashLimit) {
      this.muzzleFlashes.splice(0, this.muzzleFlashes.length - muzzleFlashLimit);
    }
  }

  private createImpactEffect(
    x: number,
    y: number,
    projectile: ProjectileRuntime,
    shield: boolean,
    playSound: boolean,
  ): void {
    const profile = COMBAT_FEEDBACK[projectile.feedback];
    const angle = Math.atan2(projectile.vy, projectile.vx);
    const sparkCount = this.effectsEnabled() ? (profile.impactSize >= 18 ? 7 : 4) : 2;
    const sparkAngles = Array.from({ length: sparkCount }, (_, index) => (
      angle + Math.PI + (index / Math.max(1, sparkCount - 1) - 0.5) * 1.7 + (Math.random() - 0.5) * 0.32
    ));
    this.impacts.push({
      x,
      y,
      angle,
      age: 0,
      duration: shield ? Math.max(220, profile.impactDurationMs) : profile.impactDurationMs,
      size: profile.impactSize * (shield ? 1.25 : 1),
      color: shield ? 0x7cf6ff : projectile.color,
      feedback: projectile.feedback,
      shield,
      sparkAngles,
    });
    const impactLimit = this.effectsEnabled() ? MAX_IMPACT_EFFECTS : REDUCED_MAX_IMPACT_EFFECTS;
    if (this.impacts.length > impactLimit) {
      this.impacts.splice(0, this.impacts.length - impactLimit);
    }
    if (playSound) {
      this.playSpatialSfx(shield ? 'shield' : 'impact', x, y, shield ? 0.78 : 0.58);
    }
  }

  private createExplosion(x: number, y: number, radius: number, color: number): void {
    if (radius <= 0) {
      return;
    }

    const big = radius >= 100;
    const duration = clamp(240 + radius * (big ? 2.1 : 1.15), 260, 900);
    const sparkCount = this.effectsEnabled() ? (big ? 10 : 6) : (big ? 4 : 2);
    const sparks: ExplosionSpark[] = Array.from({ length: sparkCount }, (_, index) => ({
      angle: (index / sparkCount) * Math.PI * 2 + Math.random() * 0.6,
      length: radius * (0.7 + Math.random() * 0.6),
      speed: 0.8 + Math.random() * 0.5,
    }));

    this.explosions.push({
      x,
      y,
      radius,
      age: 0,
      duration,
      color,
      sparks,
    });
    const explosionLimit = this.effectsEnabled() ? MAX_EXPLOSIONS : REDUCED_MAX_EXPLOSIONS;
    if (this.explosions.length > explosionLimit) {
      this.explosions.splice(0, this.explosions.length - explosionLimit);
    }
    this.playSpatialSfx(radius >= 100 ? 'explosion' : 'impact', x, y, radius >= 100 ? 1 : 0.72);
    if (this.effectsEnabled() && this.cameras.main && this.worldShakeCooldownMs <= 0) {
      this.cameras.main.shake(big ? 130 : 80, clamp(radius / (big ? 5200 : 8000), 0.003, 0.018));
      this.worldShakeCooldownMs = WORLD_SHAKE_COOLDOWN_MS;
    }
  }

  /**
   * Lingering poison cloud, modelled on the rambo_game poison bomb: the cloud
   * hangs around and re-applies damage in pulses instead of a single blast.
   */
  private createGasCloud(x: number, y: number, radius: number, damage: number, team: Team): void {
    this.explosions.push({
      x, y, radius,
      age: 0,
      duration: GAS_CLOUD_DURATION_MS,
      color: 0x8cff6a,
      sparks: [],
    });
    const explosionLimit = this.effectsEnabled() ? MAX_EXPLOSIONS : REDUCED_MAX_EXPLOSIONS;
    if (this.explosions.length > explosionLimit) {
      this.explosions.splice(0, this.explosions.length - explosionLimit);
    }
    this.playSpatialSfx('explosion', x, y, 0.6);

    const pulses = 5;
    const generation = this.missionGeneration;
    for (let index = 0; index < pulses; index += 1) {
      this.time.delayedCall(index * (GAS_CLOUD_DURATION_MS / pulses), () => {
        if (generation === this.missionGeneration && this.snapshot?.phase === 'playing') {
          this.damageArea(x, y, radius, damage, team, undefined, 'chemical');
        }
      });
    }
  }

  private callArtilleryStrike(): void {
    const target = this.getArtilleryTarget();
    this.addFloatingText(target.x, target.y - 52, 'Artillery', 0xffd27a);
    this.audio?.playSfx('artillery', 0.85);
    const generation = this.missionGeneration;
    for (let index = 0; index < 4; index += 1) {
      this.time.delayedCall(index * 155, () => {
        if (generation !== this.missionGeneration || this.snapshot?.phase !== 'playing') {
          return;
        }

        const offsetAngle = index * Math.PI * 0.5 + 0.35;
        const radius = index === 0 ? 0 : 58;
        const x = clamp(target.x + Math.cos(offsetAngle) * radius, 60, this.mission?.worldWidth ?? target.x);
        const y = clamp(target.y + Math.sin(offsetAngle) * radius, 60, this.mission?.worldHeight ?? target.y);
        this.createExplosion(x, y, 152, 0xffc65f);
        this.damageArea(x, y, 152, (this.snapshot?.tankStats.shellDamage ?? 95) * 1.35, 'player', undefined, 'mortar');
      });
    }
  }

  private getArtilleryTarget(): { x: number; y: number } {
    const livingEnemies = this.enemies.filter((enemy) => enemy.alive);
    if (livingEnemies.length > 0 && this.player) {
      const closest = livingEnemies.reduce((best, enemy) => {
        const bestDistance = Phaser.Math.Distance.Between(this.player?.x ?? 0, this.player?.y ?? 0, best.x, best.y);
        const enemyDistance = Phaser.Math.Distance.Between(this.player?.x ?? 0, this.player?.y ?? 0, enemy.x, enemy.y);
        return enemyDistance < bestDistance ? enemy : best;
      }, livingEnemies[0]);
      return { x: closest.x, y: closest.y };
    }

    return { ...this.lastPointerWorld };
  }

  private resolveTankCoverCollision(tank: TankRuntime): void {
    for (const cover of this.covers) {
      if (!cover.solid || cover.health <= 0) {
        continue;
      }

      if (!circleRectOverlap(tank.x, tank.y, tank.radius, cover)) {
        continue;
      }

      if (cover.kind === 'houseOpen' && isInfantry(tank.kind) && this.canPassHouseOpening(tank, cover)) {
        continue;
      }

      const dx = tank.x - cover.x;
      const dy = tank.y - cover.y;
      const overlapX = cover.width * 0.5 + tank.radius - Math.abs(dx);
      const overlapY = cover.height * 0.5 + tank.radius - Math.abs(dy);

      if (overlapX < overlapY) {
        tank.x += Math.sign(dx || 1) * overlapX;
        tank.vx *= -0.18;
      } else {
        tank.y += Math.sign(dy || 1) * overlapY;
        tank.vy *= -0.18;
      }
    }
  }

  private canPassHouseOpening(tank: TankRuntime, cover: CoverRuntime): boolean {
    if (pointInsideCover(tank.x, tank.y, cover, 2)) {
      return true;
    }

    const doorHalfSize = Math.min(24, (cover.doorSide === 'left' || cover.doorSide === 'right' ? cover.height : cover.width) * 0.24);
    const halfWidth = cover.width * 0.5;
    const halfHeight = cover.height * 0.5;
    if (cover.doorSide === 'left' || cover.doorSide === 'right') {
      const edgeX = cover.x + (cover.doorSide === 'right' ? halfWidth : -halfWidth);
      return Math.abs(tank.y - cover.y) <= doorHalfSize && Math.abs(tank.x - edgeX) <= tank.radius + 8;
    }

    const edgeY = cover.y + (cover.doorSide === 'bottom' ? halfHeight : -halfHeight);
    return Math.abs(tank.x - cover.x) <= doorHalfSize && Math.abs(tank.y - edgeY) <= tank.radius + 8;
  }

  private updateHouseShelters(): void {
    const openHouses = this.covers.filter((cover) => cover.kind === 'houseOpen' && cover.health > 0 && !cover.spent);
    const occupants = [this.player, ...this.enemies].filter((tank): tank is TankRuntime => Boolean(tank?.alive));
    for (const tank of occupants) {
      if (!isInfantry(tank.kind)) {
        tank.shelteredBy = undefined;
        continue;
      }

      const shelter = openHouses.find((cover) => pointInsideCover(tank.x, tank.y, cover, 5));
      const previousShelter = tank.shelteredBy;
      tank.shelteredBy = shelter?.id;
      if (tank.team === 'player' && shelter && previousShelter !== shelter.id) {
        this.addFloatingText(tank.x, tank.y - 36, 'HOUSE COVER', 0xa2db7c);
      }
    }
  }

  private pendingGarrisonCount(): number {
    return this.covers.reduce((total, cover) => (
      total + (cover.kind === 'houseSealed' && !cover.garrisonReleased && cover.health > 0 ? cover.garrison.length : 0)
    ), 0);
  }

  private updateCamera(mission: MissionConfig, player: TankRuntime): void {
    const camera = this.cameras.main;
    camera.setScroll(
      clamp(player.x - camera.width * 0.5, 0, Math.max(0, mission.worldWidth - camera.width)),
      clamp(player.y - camera.height * 0.5, 0, Math.max(0, mission.worldHeight - camera.height)),
    );
  }

  private buildHudSnapshot(snapshot: SessionSnapshot, mission: MissionConfig, player: TankRuntime): HudSnapshot {
    const boss = this.enemies.find((enemy) => enemy.kind === 'boss');
    const pendingGarrison = this.pendingGarrisonCount();
    const enemyAlive = this.enemies.filter((enemy) => enemy.alive).length + pendingGarrison;
    const progressText = this.getProgressText(mission);
    const bossStatus: BossStatus | undefined = boss
      ? {
          name: boss.label,
          health: Math.max(0, boss.health),
          maxHealth: boss.maxHealth,
          exposed: boss.exposed,
        }
      : undefined;

    return {
      phase: 'live',
      missionName: mission.codename,
      missionIndex: snapshot.currentMissionIndex + 1,
      totalMissions: snapshot.missions.length,
      objective: mission.objective,
      progressText,
      bonusTimeRemainingSeconds: Math.max(0, Math.floor((MISSION_BONUS_DURATION_MS - this.missionElapsed) / 1000)),
      enemyCount: {
        alive: enemyAlive,
        total: this.enemies.length + pendingGarrison,
      },
      totalScore: snapshot.totalScore,
      scrap: snapshot.scrap,
      credits: snapshot.credits,
      tank: {
        health: Math.max(0, player.health),
        maxHealth: player.maxHealth,
        shield: Math.max(0, player.shield),
        shieldMax: player.shieldMax,
        armor: snapshot.tankStats.armor,
        speed: Math.hypot(player.vx, player.vy),
        reloadPercent: 1 - clamp(player.reloadTimer / player.reloadMs, 0, 1),
        secondaryPercent: this.magazineReloadTimer > 0
          ? 1 - clamp(this.magazineReloadTimer / this.magazineReloadMax, 0, 1)
          : 1 - clamp(this.secondaryTimer / this.secondaryCooldownMax, 0, 1),
        specialPercent: 1 - clamp(this.specialTimer / snapshot.tankStats.specialCooldownMs, 0, 1),
        ammo: this.ammo,
        ammoCapacity: snapshot.tankStats.ammoCapacity,
        repairCharges: this.repairCharges,
      },
      weapon: {
        id: snapshot.selectedWeapon,
        label: WEAPONS[snapshot.selectedWeapon].label,
        level: snapshot.weaponLevels[snapshot.selectedWeapon] ?? 1,
        unlockedCount: snapshot.unlockedWeapons.length,
      },
      boss: bossStatus,
    };
  }

  private getProgressText(mission: MissionConfig): string {
    if (mission.kind === 'assault') {
      const convoys = this.enemies.filter((enemy) => enemy.kind === 'convoy' && enemy.alive);
      if (this.convoyEscapeCountdownMs > 0) {
        return `Convoy escaping in ${Math.ceil(this.convoyEscapeCountdownMs / 1000)}s`;
      }

      if (convoys.length > 0 && mission.exitX) {
        const exitX = mission.exitX;
        const nearestEscapeSeconds = Math.min(...convoys.map((enemy) => Math.max(0, (exitX - enemy.radius - enemy.x) / Math.max(1, enemy.speed))));
        return `Stop convoy: ${convoys.length} carriers - ${Math.ceil(nearestEscapeSeconds)}s to exit`;
      }

      const hidden = this.pendingGarrisonCount();
      if (hidden > 0 && this.enemies.every((enemy) => !enemy.alive)) {
        return `Search sealed houses: ${hidden} hidden infantry`;
      }

      return 'Destroy remaining armor';
    }

    if (mission.kind === 'defense') {
      const remaining = Math.max(0, (mission.durationMs ?? 0) - this.defenseHeldMs);
      return `Hold relay ${Math.ceil(remaining / 1000)}s`;
    }

    if (mission.kind === 'escort' && this.escort) {
      const progress = clamp(this.escort.x / this.escort.exitX, 0, 1);
      return `Escort ${Math.round(progress * 100)}% - Truck ${Math.ceil(this.escort.health)} HP`;
    }

    if (mission.kind === 'capture') {
      const captured = this.captureZones.filter((zone) => zone.progress >= 1).length;
      return `Capture beacons ${captured}/${this.captureZones.length}`;
    }

    return 'Expose the weak point, then fire';
  }

  private updatePerformanceDiagnostics(delta: number): void {
    if (document.visibilityState === 'hidden' || delta <= 0 || delta > 1000) {
      return;
    }

    this.performanceElapsed += delta;
    this.performanceFrames += 1;
    this.performanceMaxFrame = Math.max(this.performanceMaxFrame, delta);
    if (delta > 34) {
      this.performanceLongFrames += 1;
    }

    if (this.performanceElapsed < 3000) {
      return;
    }

    let livingEnemies = 0;
    for (const enemy of this.enemies) {
      if (enemy.alive) {
        livingEnemies += 1;
      }
    }
    document.body.dataset.gameFps = String(Math.round(this.performanceFrames * 1000 / this.performanceElapsed));
    document.body.dataset.gameFrameMax = String(Math.round(this.performanceMaxFrame));
    document.body.dataset.gameLongFrames = String(this.performanceLongFrames);
    document.body.dataset.gameEntities = `${livingEnemies}/${this.projectiles.length}/${this.explosions.length}`;

    this.performanceElapsed = 0;
    this.performanceFrames = 0;
    this.performanceLongFrames = 0;
    this.performanceMaxFrame = 0;
  }

  private render(): void {
    const graphics = this.graphics;
    const terrainGraphics = this.terrainGraphics;
    const underlayGraphics = this.underlayGraphics;
    const coverGraphics = this.coverGraphics;
    if (!graphics || !terrainGraphics || !underlayGraphics || !coverGraphics) {
      return;
    }

    const mission = this.mission ?? this.snapshot?.currentMission;
    if (!mission) {
      return;
    }

    if (this.staticLayerDirty) {
      terrainGraphics.clear();
      coverGraphics.clear();
      this.drawTerrain(terrainGraphics, mission);
      this.drawCovers(coverGraphics, false);
      this.staticLayerDirty = false;
    }

    underlayGraphics.clear();
    this.drawExitLane(underlayGraphics, mission);
    this.drawCaptureZones(underlayGraphics);
    this.drawEscort(underlayGraphics);
    this.drawCovers(underlayGraphics, true);

    graphics.clear();
    this.glow?.clear();
    this.drawTanks(graphics);
    this.drawPickups(graphics);
    this.syncPickupLabels();
    this.drawMuzzleFlashes(graphics);
    this.drawProjectiles(graphics);
    this.drawImpactEffects(graphics);
    this.drawExplosions(graphics);
  }

  private isVisible(x: number, y: number, padding: number): boolean {
    const view = this.cameras.main.worldView;
    return x + padding >= view.left
      && x - padding <= view.right
      && y + padding >= view.top
      && y - padding <= view.bottom;
  }

  private drawTerrain(graphics: Phaser.GameObjects.Graphics, mission: MissionConfig): void {
    // Terrain is world-space and immutable during a mission. Drawing the whole
    // map once lets Phaser reuse the geometry while the camera moves.
    const left = 0;
    const top = 0;
    const right = mission.worldWidth;
    const bottom = mission.worldHeight;
    graphics.fillStyle(mission.palette.ground, 1);
    graphics.fillRect(left, top, right - left, bottom - top);
    graphics.fillStyle(mission.palette.shadow, 0.28);
    for (let x = Math.floor(left / 180) * 180; x <= right; x += 180) {
      graphics.fillRect(x, top, 2, bottom - top);
    }
    for (let y = Math.floor(top / 180) * 180; y <= bottom; y += 180) {
      graphics.fillRect(left, y, right - left, 2);
    }
    if (mission.palette.water) {
      const waterTop = mission.worldHeight * 0.72;
      if (waterTop + 90 >= top && waterTop <= bottom) {
        graphics.fillStyle(mission.palette.water, 0.58);
        graphics.fillRect(left, waterTop, right - left, 90);
      }
    }

  }

  private drawExitLane(graphics: Phaser.GameObjects.Graphics, mission: MissionConfig): void {
    const exitX = mission.exitX;
    const view = this.cameras.main.worldView;
    if (!exitX || exitX < view.left - 40 || exitX > view.right + 40) {
      return;
    }

    const active = this.convoyEscapeCountdownMs > 0;
    const laneHalf = 18;

    graphics.fillStyle(0xff6b4a, active ? 0.34 : 0.18);
    graphics.fillRect(exitX - laneHalf, view.top, laneHalf * 2, view.height);

    const stripeSpacing = 34;
    const scrollSpeed = active ? 16 : 42;
    const offset = (this.missionElapsed / scrollSpeed) % stripeSpacing;
    graphics.lineStyle(7, active ? 0xff8a5b : 0xffd27a, active ? 0.5 : 0.24);
    const firstStripe = Math.floor(view.top / stripeSpacing) * stripeSpacing - stripeSpacing * 2;
    for (let sy = firstStripe; sy < view.bottom + stripeSpacing * 2; sy += stripeSpacing) {
      const y = sy + offset;
      graphics.lineBetween(exitX - laneHalf, y, exitX + laneHalf, y - laneHalf * 2);
    }

    graphics.lineStyle(4, 0xffd27a, active ? 0.95 : 0.58);
    graphics.lineBetween(exitX - laneHalf, view.top, exitX - laneHalf, view.bottom);
    graphics.lineBetween(exitX + laneHalf, view.top, exitX + laneHalf, view.bottom);
  }

  private drawCaptureZones(graphics: Phaser.GameObjects.Graphics): void {
    for (const zone of this.captureZones) {
      if (!this.isVisible(zone.x, zone.y, zone.radius + 24)) {
        continue;
      }
      const captured = zone.progress >= 1;
      const color = captured ? 0xa2db7c : 0xf0c15a;
      const pulse = 0.5 + 0.5 * Math.sin(this.missionElapsed / 380);

      graphics.fillStyle(color, 0.12 + zone.progress * 0.18);
      graphics.fillCircle(zone.x, zone.y, zone.radius);
      graphics.lineStyle(3, color, 0.7);
      graphics.strokeCircle(zone.x, zone.y, zone.radius);

      graphics.lineStyle(2, color, 0.2 + pulse * 0.25);
      graphics.strokeCircle(zone.x, zone.y, zone.radius * (0.72 + pulse * 0.08));

      const spin = this.missionElapsed / (captured ? 2600 : 1400);
      const tickCount = 8;
      graphics.lineStyle(2, color, 0.55);
      for (let i = 0; i < tickCount; i += 1) {
        const angle = spin + (i / tickCount) * Math.PI * 2;
        const innerR = zone.radius - 10;
        const outerR = zone.radius + (captured ? 2 : 10);
        graphics.lineBetween(
          zone.x + Math.cos(angle) * innerR,
          zone.y + Math.sin(angle) * innerR,
          zone.x + Math.cos(angle) * outerR,
          zone.y + Math.sin(angle) * outerR,
        );
      }

      graphics.fillStyle(0xf6f2de, 0.9);
      graphics.fillRect(zone.x - 44, zone.y - zone.radius - 16, 88 * zone.progress, 6);
    }
  }

  private drawEscort(graphics: Phaser.GameObjects.Graphics): void {
    if (!this.escort || !this.isVisible(this.escort.x, this.escort.y, 60)) {
      return;
    }

    this.drawRotatedRect(graphics, this.escort.x, this.escort.y, 74, 40, 0, 0x8fd6a0, 1);
    graphics.fillStyle(0x1b241b, 1);
    graphics.fillRect(this.escort.x - 34, this.escort.y - 31, 68, 6);
    graphics.fillStyle(0xa2db7c, 1);
    graphics.fillRect(this.escort.x - 34, this.escort.y - 31, 68 * clamp(this.escort.health / this.escort.maxHealth, 0, 1), 6);
  }

  private drawCovers(graphics: Phaser.GameObjects.Graphics, interactiveOnly: boolean): void {
    for (const cover of this.covers) {
      const interactive = cover.kind === 'repair' || cover.kind === 'mine' || cover.kind === 'armory';
      if (interactive !== interactiveOnly || cover.health <= 0 || cover.spent) {
        continue;
      }
      if (interactive && !this.isVisible(cover.x, cover.y, Math.max(cover.width, cover.height) * 0.6 + 24)) {
        continue;
      }

      if (cover.kind === 'repair') {
        this.drawCoverRepairPad(graphics, cover);
        continue;
      }

      if (cover.kind === 'mine') {
        this.drawCoverMine(graphics, cover);
        continue;
      }

      if (cover.kind === 'armory') {
        this.drawCoverArmory(graphics, cover);
        continue;
      }

      if (cover.kind === 'houseOpen' || cover.kind === 'houseSealed') {
        this.drawCoverHouse(graphics, cover);
        continue;
      }

      if (cover.kind === 'concrete') {
        this.drawCoverBuilding(graphics, cover);
        continue;
      }

      if (cover.kind === 'rockWall') {
        this.drawCoverRockWall(graphics, cover);
        continue;
      }

      if (cover.kind === 'barrel') {
        this.drawCoverBarrel(graphics, cover);
        continue;
      }

      this.drawCoverCrate(graphics, cover);
    }
  }

  private drawCoverHealthBar(graphics: Phaser.GameObjects.Graphics, cover: CoverRuntime, top: number): void {
    const left = cover.x - cover.width * 0.5;
    graphics.fillStyle(0x0b0c10, 0.55);
    graphics.fillRect(left, top, cover.width, 5);
    graphics.fillStyle(0xf0d78b, 0.85);
    graphics.fillRect(left, top, cover.width * clamp(cover.health / cover.maxHealth, 0, 1), 5);
  }

  private drawCoverRepairPad(graphics: Phaser.GameObjects.Graphics, cover: CoverRuntime): void {
    const pulse = 0.5 + 0.5 * Math.sin(this.missionElapsed / 340);
    const outerRadius = cover.width * 0.62;
    graphics.fillStyle(0x4fd88b, 0.22 + pulse * 0.1);
    graphics.fillCircle(cover.x, cover.y, outerRadius);
    graphics.lineStyle(2, 0xa2db7c, 0.72);
    graphics.strokeCircle(cover.x, cover.y, outerRadius);
    graphics.lineStyle(2, 0xa2db7c, 0.35 + pulse * 0.25);
    graphics.strokeCircle(cover.x, cover.y, outerRadius * (0.7 + pulse * 0.1));

    const crossArm = outerRadius * 0.34;
    const crossThickness = Math.max(3, outerRadius * 0.16);
    graphics.fillStyle(0xdcffe9, 0.85);
    graphics.fillRect(cover.x - crossThickness * 0.5, cover.y - crossArm, crossThickness, crossArm * 2);
    graphics.fillRect(cover.x - crossArm, cover.y - crossThickness * 0.5, crossArm * 2, crossThickness);
  }

  private drawCoverMine(graphics: Phaser.GameObjects.Graphics, cover: CoverRuntime): void {
    graphics.fillStyle(0x3a1512, 0.85);
    graphics.fillCircle(cover.x, cover.y, 19);
    graphics.fillStyle(0xff704f, 0.85);
    graphics.fillCircle(cover.x, cover.y, 15);
    graphics.lineStyle(2, 0x4d1411, 1);
    graphics.strokeCircle(cover.x, cover.y, 22);

    const blink = Math.sin(this.missionElapsed / 220) > 0.4;
    graphics.fillStyle(blink ? 0xffe6a0 : 0x7a2b20, 0.95);
    graphics.fillCircle(cover.x, cover.y, 4);
  }

  private drawCoverArmory(graphics: Phaser.GameObjects.Graphics, cover: CoverRuntime): void {
    const left = cover.x - cover.width * 0.5;
    const top = cover.y - cover.height * 0.5;
    const pulse = 0.5 + 0.5 * Math.sin(this.missionElapsed / 300);

    graphics.fillStyle(0x95e7ff, 0.12 + pulse * 0.1);
    graphics.fillCircle(cover.x, cover.y, cover.width * 0.85);

    graphics.fillStyle(0x2f4a54, 0.96);
    graphics.fillRoundedRect(left, top, cover.width, cover.height, 5);
    graphics.lineStyle(2, 0x95e7ff, 0.6 + pulse * 0.35);
    graphics.strokeRoundedRect(left, top, cover.width, cover.height, 5);

    // stencilled bullet mark so it reads as an ammo crate
    const cw = cover.width, ch = cover.height;
    graphics.fillStyle(0x95e7ff, 0.9);
    graphics.fillRect(left + cw * 0.24, top + ch * 0.44, cw * 0.4, ch * 0.12);
    graphics.fillTriangle(
      left + cw * 0.64, top + ch * 0.38,
      left + cw * 0.8, top + ch * 0.5,
      left + cw * 0.64, top + ch * 0.62,
    );
    graphics.fillStyle(0xdff6ff, 0.8);
    graphics.fillRect(left + cw * 0.2, top + ch * 0.2, cw * 0.6, 3);
  }

  private drawCoverBarrel(graphics: Phaser.GameObjects.Graphics, cover: CoverRuntime): void {
    const left = cover.x - cover.width * 0.5;
    const top = cover.y - cover.height * 0.5;
    const bodyColor = 0xff8a42;
    const cornerRadius = Math.min(cover.width, cover.height) * 0.24;

    graphics.fillStyle(darkenColor(bodyColor, 0.55), 0.5);
    graphics.fillEllipse(cover.x, cover.y + cover.height * 0.42, cover.width * 0.92, cover.height * 0.28);

    graphics.fillStyle(bodyColor, 0.94);
    graphics.fillRoundedRect(left, top, cover.width, cover.height, cornerRadius);
    graphics.lineStyle(2, 0x5c2a0c, 0.65);
    graphics.strokeRoundedRect(left, top, cover.width, cover.height, cornerRadius);

    graphics.lineStyle(2.5, 0x5c2a0c, 0.55);
    graphics.lineBetween(left + 4, top + cover.height * 0.32, left + cover.width - 4, top + cover.height * 0.32);
    graphics.lineBetween(left + 4, top + cover.height * 0.68, left + cover.width - 4, top + cover.height * 0.68);

    graphics.fillStyle(0xffcf9a, 0.45);
    graphics.fillEllipse(cover.x, top + cover.height * 0.2, cover.width * 0.55, cover.height * 0.14);

    graphics.fillStyle(0xff5b2e, 0.9);
    graphics.fillCircle(cover.x, cover.y, Math.min(cover.width, cover.height) * 0.09);

    this.drawCoverHealthBar(graphics, cover, top - 8);
  }

  private drawCoverCrate(graphics: Phaser.GameObjects.Graphics, cover: CoverRuntime): void {
    const left = cover.x - cover.width * 0.5;
    const top = cover.y - cover.height * 0.5;
    const woodColor = 0x8a6a3c;

    graphics.fillStyle(woodColor, 0.94);
    graphics.fillRoundedRect(left, top, cover.width, cover.height, 4);
    graphics.lineStyle(2, 0x2c1f10, 0.6);
    graphics.strokeRoundedRect(left, top, cover.width, cover.height, 4);

    graphics.lineStyle(1.5, 0x5c4322, 0.6);
    const planks = Math.max(2, Math.round(cover.height / 22));
    for (let i = 1; i < planks; i += 1) {
      const ly = top + (cover.height / planks) * i;
      graphics.lineBetween(left + 4, ly, left + cover.width - 4, ly);
    }

    graphics.lineStyle(2, 0x3a2a14, 0.45);
    graphics.lineBetween(left, top, left + cover.width, top + cover.height);
    graphics.lineBetween(left + cover.width, top, left, top + cover.height);

    graphics.fillStyle(0x2c1f10, 0.85);
    const bracket = Math.min(10, cover.width * 0.08, cover.height * 0.16);
    for (const [cx, cy] of [
      [left, top],
      [left + cover.width - bracket, top],
      [left, top + cover.height - bracket],
      [left + cover.width - bracket, top + cover.height - bracket],
    ]) {
      graphics.fillRect(cx, cy, bracket, bracket);
    }

    graphics.fillStyle(0xd8b781, 0.3);
    graphics.fillRect(left, top, cover.width, Math.max(3, cover.height * 0.12));

    this.drawCoverHealthBar(graphics, cover, top - 8);
  }

  private drawCoverBuilding(graphics: Phaser.GameObjects.Graphics, cover: CoverRuntime): void {
    const left = cover.x - cover.width * 0.5;
    const top = cover.y - cover.height * 0.5;
    const wallColor = 0x71777f;
    const roofColor = darkenColor(wallColor, 0.62);
    const cornerRadius = Math.min(10, cover.height * 0.18);

    graphics.fillStyle(wallColor, 0.94);
    graphics.fillRoundedRect(left, top, cover.width, cover.height, cornerRadius);
    graphics.lineStyle(2, 0x0b0c10, 0.5);
    graphics.strokeRoundedRect(left, top, cover.width, cover.height, cornerRadius);

    graphics.fillStyle(roofColor, 1);
    graphics.fillRect(left - 6, top - 11, cover.width + 12, 12);
    graphics.lineStyle(2, 0x0b0c10, 0.5);
    graphics.strokeRect(left - 6, top - 11, cover.width + 12, 12);

    const slitCount = Math.max(2, Math.round(cover.width / 70));
    const slitWidth = Math.min(24, cover.width / (slitCount * 2));
    graphics.fillStyle(0x14100c, 0.85);
    for (let i = 0; i < slitCount; i += 1) {
      const t = (i + 0.5) / slitCount;
      const sx = left + cover.width * t - slitWidth * 0.5;
      graphics.fillRect(sx, top + cover.height * 0.32, slitWidth, cover.height * 0.24);
    }

    const bagCount = Math.max(3, Math.round(cover.width / 42));
    const bagWidth = (cover.width / bagCount) * 0.92;
    graphics.fillStyle(0x8c7146, 0.9);
    for (let i = 0; i < bagCount; i += 1) {
      const t = (i + 0.5) / bagCount;
      graphics.fillEllipse(left + cover.width * t, top + cover.height + 3, bagWidth, 13);
    }
    graphics.lineStyle(1.5, 0x3a2f1c, 0.5);
    for (let i = 0; i < bagCount; i += 1) {
      const t = (i + 0.5) / bagCount;
      graphics.strokeEllipse(left + cover.width * t, top + cover.height + 3, bagWidth, 13);
    }

    this.drawCoverHealthBar(graphics, cover, top - 20);
  }

  private drawCoverRockWall(graphics: Phaser.GameObjects.Graphics, cover: CoverRuntime): void {
    const left = cover.x - cover.width * 0.5;
    const top = cover.y - cover.height * 0.5;
    const stones = Math.max(4, Math.round(cover.width / 38));

    graphics.fillStyle(0x171a18, 0.36);
    graphics.fillEllipse(cover.x + 6, cover.y + cover.height * 0.38, cover.width * 1.03, cover.height * 0.46);
    for (let row = 0; row < 2; row += 1) {
      for (let index = 0; index < stones; index += 1) {
        const stagger = row === 0 ? 0 : cover.width / stones * 0.45;
        const stoneWidth = cover.width / stones * 1.08;
        const x = left + (index + 0.5) * (cover.width / stones) + stagger;
        if (x + stoneWidth * 0.5 > left + cover.width + 2) {
          continue;
        }
        const y = top + cover.height * (row === 0 ? 0.68 : 0.28);
        const tone = (index + row) % 3 === 0 ? 0x77796f : (index + row) % 3 === 1 ? 0x656960 : 0x89897c;
        graphics.fillStyle(tone, 1);
        graphics.fillEllipse(x, y, stoneWidth, cover.height * 0.56);
        graphics.lineStyle(2, 0x30342f, 0.9);
        graphics.strokeEllipse(x, y, stoneWidth, cover.height * 0.56);
        graphics.fillStyle(0xb4b2a3, 0.2);
        graphics.fillEllipse(x - stoneWidth * 0.12, y - cover.height * 0.1, stoneWidth * 0.42, cover.height * 0.16);
      }
    }

    this.drawCoverHealthBar(graphics, cover, top - 10);
  }

  private drawCoverHouse(graphics: Phaser.GameObjects.Graphics, cover: CoverRuntime): void {
    const left = cover.x - cover.width * 0.5;
    const top = cover.y - cover.height * 0.5;
    const open = cover.kind === 'houseOpen';
    // Breached houses are reinforced concrete shelters; sealed houses are
    // lighter brick buildings that may release a hidden garrison when broken.
    const wallColor = open ? 0x7b8282 : 0x985f47;
    const roofColor = open ? 0x444c50 : 0x51372e;
    const damageRatio = clamp(cover.health / cover.maxHealth, 0, 1);

    graphics.fillStyle(0x0b0c10, 0.35);
    graphics.fillRoundedRect(left + 7, top + 9, cover.width, cover.height, 8);
    graphics.fillStyle(wallColor, 1);
    graphics.fillRoundedRect(left, top, cover.width, cover.height, 7);
    graphics.lineStyle(3, 0x221b14, 0.8);
    graphics.strokeRoundedRect(left, top, cover.width, cover.height, 7);

    // Roof panels leave a central seam so the building reads clearly from the
    // top-down camera while the edge breach remains visible.
    graphics.fillStyle(roofColor, 0.96);
    graphics.fillTriangle(left + 5, top + 5, cover.x - 4, cover.y, left + 5, top + cover.height - 5);
    graphics.fillTriangle(left + cover.width - 5, top + 5, cover.x + 4, cover.y, left + cover.width - 5, top + cover.height - 5);
    graphics.lineStyle(2, 0xb39b73, 0.34);
    graphics.lineBetween(cover.x, top + 8, cover.x, top + cover.height - 8);

    const windowColor = open ? 0x18211d : 0x171411;
    graphics.fillStyle(windowColor, 0.95);
    graphics.fillRect(left + cover.width * 0.24 - 10, top + cover.height * 0.28, 20, 15);
    graphics.fillRect(left + cover.width * 0.76 - 10, top + cover.height * 0.58, 20, 15);

    if (!open) {
      graphics.lineStyle(1, 0xd3a082, 0.38);
      const courseHeight = 18;
      for (let y = top + courseHeight; y < top + cover.height; y += courseHeight) {
        graphics.lineBetween(left + 4, y, left + cover.width - 4, y);
        const row = Math.round((y - top) / courseHeight);
        for (let x = left + (row % 2 === 0 ? 22 : 10); x < left + cover.width - 5; x += 32) {
          graphics.lineBetween(x, y - courseHeight, x, y);
        }
      }
    }

    if (open) {
      const openingLength = 44;
      const openingDepth = 15;
      graphics.fillStyle(0x090b0d, 1);
      if (cover.doorSide === 'left' || cover.doorSide === 'right') {
        const openingX = cover.doorSide === 'right' ? left + cover.width - openingDepth : left;
        graphics.fillRect(openingX, cover.y - openingLength * 0.5, openingDepth, openingLength);
        const arrowX = cover.doorSide === 'right' ? left + cover.width + 10 : left - 10;
        graphics.fillStyle(0xa2db7c, 0.9);
        graphics.fillTriangle(
          arrowX + (cover.doorSide === 'right' ? -7 : 7), cover.y,
          arrowX + (cover.doorSide === 'right' ? 5 : -5), cover.y - 7,
          arrowX + (cover.doorSide === 'right' ? 5 : -5), cover.y + 7,
        );
      } else {
        const openingY = cover.doorSide === 'bottom' ? top + cover.height - openingDepth : top;
        graphics.fillRect(cover.x - openingLength * 0.5, openingY, openingLength, openingDepth);
        const arrowY = cover.doorSide === 'bottom' ? top + cover.height + 10 : top - 10;
        graphics.fillStyle(0xa2db7c, 0.9);
        graphics.fillTriangle(
          cover.x, arrowY + (cover.doorSide === 'bottom' ? -7 : 7),
          cover.x - 7, arrowY + (cover.doorSide === 'bottom' ? 5 : -5),
          cover.x + 7, arrowY + (cover.doorSide === 'bottom' ? 5 : -5),
        );
      }
    } else {
      // Crossed boards make the lack of an entrance explicit without revealing
      // whether this particular house contains a garrison.
      graphics.lineStyle(5, 0x9b7748, 0.95);
      graphics.lineBetween(left + cover.width * 0.38, top + cover.height * 0.36, left + cover.width * 0.62, top + cover.height * 0.64);
      graphics.lineBetween(left + cover.width * 0.62, top + cover.height * 0.36, left + cover.width * 0.38, top + cover.height * 0.64);
    }

    if (damageRatio < 0.7) {
      graphics.lineStyle(2, 0x17120e, 0.75);
      graphics.lineBetween(cover.x - 18, cover.y - 12, cover.x - 4, cover.y + 2);
      graphics.lineBetween(cover.x - 4, cover.y + 2, cover.x - 13, cover.y + 17);
      if (damageRatio < 0.35) {
        graphics.lineBetween(cover.x + 10, cover.y - 22, cover.x + 23, cover.y - 5);
        graphics.lineBetween(cover.x + 23, cover.y - 5, cover.x + 15, cover.y + 13);
      }
    }

    this.drawCoverHealthBar(graphics, cover, top - 11);
  }

  private drawMuzzleFlashes(graphics: Phaser.GameObjects.Graphics): void {
    const fullEffects = this.effectsEnabled();
    for (const flash of this.muzzleFlashes) {
      if (!this.isVisible(flash.x, flash.y, flash.size * 3)) {
        continue;
      }

      const progress = clamp(flash.age / flash.duration, 0, 1);
      const alpha = 1 - progress;
      const size = flash.size * (1 + progress * 0.28);
      const forward = localToWorld(flash.x, flash.y, flash.angle, size * 1.35, 0);

      graphics.lineStyle(Math.max(2, size * (fullEffects ? 0.38 : 0.24)), flash.color, 0.82 * alpha);
      graphics.lineBetween(flash.x, flash.y, forward.x, forward.y);
      graphics.fillStyle(0xffffff, 0.88 * alpha);
      graphics.fillCircle(flash.x, flash.y, Math.max(2, size * 0.3));

      if (!fullEffects) {
        continue;
      }

      const upper = localToWorld(flash.x, flash.y, flash.angle, size * 0.72, -size * 0.52);
      const lower = localToWorld(flash.x, flash.y, flash.angle, size * 0.72, size * 0.52);
      graphics.lineStyle(Math.max(1.5, size * 0.18), 0xfff2c9, 0.95 * alpha);
      graphics.lineBetween(flash.x, flash.y, upper.x, upper.y);
      graphics.lineBetween(flash.x, flash.y, lower.x, lower.y);

      if (flash.feedback === 'rocket' || flash.feedback === 'drone') {
        const exhaust = localToWorld(flash.x, flash.y, flash.angle, -size * 1.15, 0);
        graphics.lineStyle(Math.max(2, size * 0.3), 0xff9b42, 0.72 * alpha);
        graphics.lineBetween(flash.x, flash.y, exhaust.x, exhaust.y);
      } else if (flash.feedback === 'rail' || flash.feedback === 'energy') {
        const beamTip = localToWorld(flash.x, flash.y, flash.angle, size * 2.4, 0);
        graphics.lineStyle(Math.max(2, size * 0.2), flash.color, 0.7 * alpha);
        graphics.lineBetween(flash.x, flash.y, beamTip.x, beamTip.y);
        this.glow?.fillStyle(flash.color, 0.26 * alpha);
        this.glow?.fillCircle(flash.x, flash.y, size * 1.15);
      } else if (flash.feedback === 'flame') {
        for (let index = 1; index <= 3; index += 1) {
          const puff = localToWorld(flash.x, flash.y, flash.angle, size * index * 0.42, Math.sin(index * 2.4) * size * 0.22);
          graphics.fillStyle(index === 1 ? 0xfff0a0 : 0xff7138, 0.5 * alpha);
          graphics.fillCircle(puff.x, puff.y, size * (0.5 - index * 0.07));
        }
      }
    }
  }

  private drawImpactEffects(graphics: Phaser.GameObjects.Graphics): void {
    const fullEffects = this.effectsEnabled();
    for (const impact of this.impacts) {
      if (!this.isVisible(impact.x, impact.y, impact.size * 3)) {
        continue;
      }

      const progress = clamp(impact.age / impact.duration, 0, 1);
      const alpha = 1 - progress;
      const expansion = 0.55 + (1 - (1 - progress) * (1 - progress)) * 0.8;

      if (impact.shield) {
        graphics.fillStyle(impact.color, 0.16 * alpha);
        graphics.fillCircle(impact.x, impact.y, impact.size * expansion);
        graphics.lineStyle(3, impact.color, 0.85 * alpha);
        graphics.strokeCircle(impact.x, impact.y, impact.size * expansion);
        if (fullEffects) {
          graphics.lineStyle(1.5, 0xffffff, 0.6 * alpha);
          graphics.strokeCircle(impact.x, impact.y, impact.size * (0.42 + progress * 1.25));
          this.glow?.fillStyle(impact.color, 0.24 * alpha);
          this.glow?.fillCircle(impact.x, impact.y, impact.size * expansion);
        }
        continue;
      }

      graphics.fillStyle(impact.feedback === 'flame' ? 0xff7138 : impact.color, 0.28 * alpha);
      graphics.fillCircle(impact.x, impact.y, impact.size * (0.42 + progress * 0.35));
      if (impact.feedback === 'rail' || impact.feedback === 'energy') {
        graphics.lineStyle(2.5, impact.color, 0.8 * alpha);
        graphics.strokeCircle(impact.x, impact.y, impact.size * expansion);
        const crossA = localToWorld(impact.x, impact.y, impact.angle, -impact.size, 0);
        const crossB = localToWorld(impact.x, impact.y, impact.angle, impact.size, 0);
        graphics.lineBetween(crossA.x, crossA.y, crossB.x, crossB.y);
      }

      for (let index = 0; index < impact.sparkAngles.length; index += 1) {
        const angle = impact.sparkAngles[index];
        const length = impact.size * (0.8 + index * 0.13) * expansion;
        const tailLength = length * Math.max(0, progress - 0.22);
        graphics.lineStyle(index % 2 === 0 ? 2 : 1.25, index % 2 === 0 ? 0xfff0a0 : impact.color, 0.82 * alpha);
        graphics.lineBetween(
          impact.x + Math.cos(angle) * tailLength,
          impact.y + Math.sin(angle) * tailLength,
          impact.x + Math.cos(angle) * length,
          impact.y + Math.sin(angle) * length,
        );
      }
    }
  }

  private drawProjectiles(graphics: Phaser.GameObjects.Graphics): void {
    for (const projectile of this.projectiles) {
      if (!this.isVisible(projectile.x, projectile.y, Math.max(220, projectile.blastRadius))) {
        continue;
      }
      if (projectile.kind === 'gas') {
        this.drawMortarShell(graphics, projectile);
      } else if (projectile.kind === 'drone') {
        this.drawSuicideDrone(graphics, projectile);
      } else if (projectile.sourceKind === 'rifleman') {
        this.drawBullet(graphics, projectile);
      } else if (projectile.kind === 'mortar') {
        this.drawMortarShell(graphics, projectile);
      } else if (projectile.kind === 'rail') {
        this.drawRailSlug(graphics, projectile);
      } else if (projectile.kind === 'rocket') {
        this.drawRocketProjectile(graphics, projectile);
      } else if (projectile.sourceKind === 'boss') {
        this.drawBossShell(graphics, projectile);
      } else {
        this.drawShell(graphics, projectile);
      }
    }
  }

  /** Rifle round: a thin tracer, deliberately far less imposing than a shell. */
  private drawBullet(graphics: Phaser.GameObjects.Graphics, projectile: ProjectileRuntime): void {
    const angle = Math.atan2(projectile.vy, projectile.vx);
    const tail = localToWorld(projectile.x, projectile.y, angle, -26, 0);
    if (this.effectsEnabled()) {
      graphics.lineStyle(3, projectile.color, 0.28);
      graphics.lineBetween(tail.x, tail.y, projectile.x, projectile.y);
    }
    graphics.lineStyle(1.5, projectile.color, 0.9);
    graphics.lineBetween(tail.x, tail.y, projectile.x, projectile.y);
    graphics.fillStyle(0xfffdf0, 0.95);
    graphics.fillCircle(projectile.x, projectile.y, 2.4);
  }

  private drawMortarShell(graphics: Phaser.GameObjects.Graphics, projectile: ProjectileRuntime): void {
    const angle = Math.atan2(projectile.vy, projectile.vx);

    // target marker on the ground so the player can read where it will land
    graphics.lineStyle(2, projectile.color, 0.5);
    graphics.strokeCircle(projectile.targetX, projectile.targetY, projectile.blastRadius * 0.5);
    graphics.lineStyle(1.5, projectile.color, 0.32);
    graphics.strokeCircle(projectile.targetX, projectile.targetY, projectile.blastRadius);

    // shadow beneath the arc reads as height off the ground
    graphics.fillStyle(0x0b0c10, 0.3);
    graphics.fillEllipse(projectile.x, projectile.y + 16, 16, 7);

    this.drawTrail(graphics, projectile, angle, 40, 7);

    this.drawPolygon(graphics, projectile.x, projectile.y, MORTAR_SHELL_POINTS, angle, 1, projectile.color, 1, 0x4a3410, 0.7, 1.5);

    for (const side of [-1, 1]) {
      const finBase = localToWorld(projectile.x, projectile.y, angle, -11, side * 4);
      const finTip = localToWorld(projectile.x, projectile.y, angle, -18, side * 10);
      graphics.lineStyle(2, 0x4a3410, 0.85);
      graphics.lineBetween(finBase.x, finBase.y, finTip.x, finTip.y);
    }
  }

  private drawRailSlug(graphics: Phaser.GameObjects.Graphics, projectile: ProjectileRuntime): void {
    const angle = Math.atan2(projectile.vy, projectile.vx);

    // long ionized trail sells the hypervelocity
    this.drawTrail(graphics, projectile, angle, 200, 9);
    const tail = localToWorld(projectile.x, projectile.y, angle, -120, 0);
    graphics.lineStyle(2, 0xffffff, 0.5);
    graphics.lineBetween(tail.x, tail.y, projectile.x, projectile.y);

    graphics.fillStyle(projectile.color, 0.22);
    graphics.fillCircle(projectile.x, projectile.y, 14);

    this.drawPolygon(graphics, projectile.x, projectile.y, RAIL_SLUG_POINTS, angle, 1, projectile.color, 1, 0xffffff, 0.8, 1.5);

    const nose = localToWorld(projectile.x, projectile.y, angle, 12, 0);
    graphics.fillStyle(0xffffff, 0.95);
    graphics.fillCircle(nose.x, nose.y, 3.5);
  }

  private drawTrail(graphics: Phaser.GameObjects.Graphics, projectile: ProjectileRuntime, angle: number, length: number, width: number, color = projectile.color): void {
    const tail = localToWorld(projectile.x, projectile.y, angle, -length, 0);
    if (this.effectsEnabled()) {
      graphics.lineStyle(width, color, 0.18);
      graphics.lineBetween(tail.x, tail.y, projectile.x, projectile.y);
      const midTail = localToWorld(projectile.x, projectile.y, angle, -length * 0.32, 0);
      graphics.lineStyle(width * 0.5, color, 0.78);
      graphics.lineBetween(midTail.x, midTail.y, projectile.x, projectile.y);
      return;
    }
    graphics.lineStyle(Math.max(1.5, width * 0.42), color, 0.72);
    graphics.lineBetween(tail.x, tail.y, projectile.x, projectile.y);
  }

  private drawShell(graphics: Phaser.GameObjects.Graphics, projectile: ProjectileRuntime): void {
    const angle = Math.atan2(projectile.vy, projectile.vx);
    const isPlayer = projectile.team === 'player';
    const length = isPlayer ? 30 : 22;
    const width = isPlayer ? 11 : 8;

    this.drawTrail(graphics, projectile, angle, isPlayer ? 74 : 48, isPlayer ? 10 : 6);

    this.drawPolygon(graphics, projectile.x, projectile.y, SHELL_POINTS, angle, length, projectile.color, 1, 0x140f08, 0.65, 1.5, width);

    const nose = localToWorld(projectile.x, projectile.y, angle, length * 0.3, 0);
    graphics.fillStyle(0xffffff, 0.85);
    graphics.fillCircle(nose.x, nose.y, Math.max(2, width * 0.22));
  }

  private drawBossShell(graphics: Phaser.GameObjects.Graphics, projectile: ProjectileRuntime): void {
    const angle = Math.atan2(projectile.vy, projectile.vx);
    this.drawTrail(graphics, projectile, angle, 96, 14);

    graphics.fillStyle(projectile.color, 0.22);
    graphics.fillCircle(projectile.x, projectile.y, projectile.radius + 10);
    graphics.lineStyle(2, projectile.color, 0.7);
    graphics.strokeCircle(projectile.x, projectile.y, projectile.radius + 6);

    this.drawPolygon(graphics, projectile.x, projectile.y, BOSS_SHELL_POINTS, angle, 1, projectile.color, 1, 0x140f08, 0.7, 2);
    graphics.fillStyle(0xffffff, 0.9);
    graphics.fillCircle(projectile.x, projectile.y, Math.max(3, projectile.radius * 0.4));
  }

  private drawRocketProjectile(graphics: Phaser.GameObjects.Graphics, projectile: ProjectileRuntime): void {
    const angle = Math.atan2(projectile.vy, projectile.vx);
    this.drawTrail(graphics, projectile, angle, 60, 8, 0xffb15f);

    this.drawPolygon(graphics, projectile.x, projectile.y, ROCKET_POINTS, angle, 1, projectile.color, 1, 0x0c2a33, 0.7, 1.5);

    const finBack = localToWorld(projectile.x, projectile.y, angle, -10, 0);
    for (const side of [-1, 1]) {
      const finTip = localToWorld(projectile.x, projectile.y, angle, -18, side * 9);
      graphics.lineStyle(2, 0x1c3a44, 0.9);
      graphics.lineBetween(finBack.x, finBack.y, finTip.x, finTip.y);
    }

    const flameTip = localToWorld(projectile.x, projectile.y, angle, -22, 0);
    graphics.fillStyle(0xffb15f, 0.85);
    graphics.fillCircle(flameTip.x, flameTip.y, 4);
  }

  private drawSuicideDrone(graphics: Phaser.GameObjects.Graphics, projectile: ProjectileRuntime): void {
    const angle = Math.atan2(projectile.vy, projectile.vx);
    this.drawPolygon(graphics, projectile.x, projectile.y, DRONE_POINTS, angle, 1, 0x4f5b4e, 1, 0x11150f, 0.9, 1.5);

    // Cross arms and four spinning rotors keep the projectile readable as a
    // drone rather than another missile, even on a small phone display.
    for (const sideX of [-1, 1]) {
      for (const sideY of [-1, 1]) {
        const hub = localToWorld(projectile.x, projectile.y, angle, sideX * 3, sideY * 12);
        const bodyHub = localToWorld(projectile.x, projectile.y, angle, sideX * 2, sideY * 4);
        graphics.lineStyle(2, 0xaab69f, 0.9);
        graphics.lineBetween(bodyHub.x, bodyHub.y, hub.x, hub.y);
        graphics.lineStyle(1.5, projectile.color, 0.72);
        graphics.strokeEllipse(hub.x, hub.y, 14, 5);
        graphics.fillStyle(0x1b211b, 1);
        graphics.fillCircle(hub.x, hub.y, 2.5);
      }
    }

    const warhead = localToWorld(projectile.x, projectile.y, angle, 7, 0);
    graphics.fillStyle(projectile.color, 0.95);
    graphics.fillCircle(warhead.x, warhead.y, 4);
    graphics.lineStyle(2, projectile.color, 0.22);
    graphics.strokeCircle(projectile.x, projectile.y, 19 + Math.sin(this.missionElapsed / 70) * 2);
  }

  private drawTanks(graphics: Phaser.GameObjects.Graphics): void {
    if (this.player) {
      this.drawTank(graphics, this.player, 0x6fd1a8);
    }

    for (const enemy of this.enemies) {
      if (!enemy.alive || !this.isVisible(enemy.x, enemy.y, enemy.radius + 90)) {
        continue;
      }

      this.drawTank(graphics, enemy, enemyColor(enemy.kind as EnemyTankKind));
    }
  }

  private drawTank(graphics: Phaser.GameObjects.Graphics, tank: TankRuntime, color: number): void {
    const art = TANK_ART[tank.kind] ?? TANK_ART.raider;
    const r = tank.radius;
    const turretColor = darkenColor(color, 0.5);
    const runnerColor = darkenColor(color, 0.32);

    if (art.chassis === 'infantry' && tank.shelteredBy) {
      const pulse = 0.7 + Math.sin(this.missionElapsed / 220) * 0.15;
      graphics.fillStyle(color, 0.65);
      graphics.fillCircle(tank.x, tank.y, 6);
      graphics.lineStyle(2, tank.team === 'player' ? 0xa2db7c : 0xff8a68, pulse);
      graphics.strokeCircle(tank.x, tank.y, 12);
      graphics.lineBetween(tank.x - 10, tank.y - 12, tank.x, tank.y - 18);
      graphics.lineBetween(tank.x, tank.y - 18, tank.x + 10, tank.y - 12);
      this.drawTankHitReaction(graphics, tank);
      return;
    }

    if (art.chassis === 'infantry') {
      this.drawInfantry(graphics, tank, art);
      this.drawTankHitReaction(graphics, tank);
      return;
    }

    if (art.chassis !== 'static') {
      this.drawRunners(graphics, tank, art, runnerColor);
    }

    this.drawPolygon(graphics, tank.x, tank.y, art.hull, tank.bodyAngle, r, color, 1, 0x050805, 0.5, 2);

    if (art.hasArmorBlocks) {
      this.drawArmorBlocks(graphics, tank, art, darkenColor(color, 0.72));
    }

    if (art.chassis !== 'static') {
      this.drawNoseLights(graphics, tank, art);
    }

    if (tank.exposed) {
      this.drawPolygon(graphics, tank.x, tank.y, art.turret, tank.turretAngle, r * 1.28, 0xfff0a0, 0.32, 0xfff0a0, 0.5, 2);
    }

    this.drawPolygon(graphics, tank.x, tank.y, art.turret, tank.turretAngle, r, turretColor, 1, 0x050805, 0.5, 2);
    this.drawHatch(graphics, tank);

    if (art.hasSensorMast) {
      this.drawSensorMast(graphics, tank);
    }

    const equippedWeapon = tank.team === 'player' ? this.getSelectedWeapon() : undefined;
    this.drawBarrel(graphics, tank, art, equippedWeapon);

    graphics.fillStyle(0x070908, 0.75);
    graphics.fillRect(tank.x - r, tank.y - r - 18, r * 2, 5);
    graphics.fillStyle(tank.team === 'player' ? 0xa2db7c : 0xff845f, 0.95);
    graphics.fillRect(tank.x - r, tank.y - r - 18, r * 2 * clamp(tank.health / tank.maxHealth, 0, 1), 5);
    this.drawTankHitReaction(graphics, tank);
  }

  private drawTankHitReaction(graphics: Phaser.GameObjects.Graphics, tank: TankRuntime): void {
    if (tank.hitFlashMs <= 0) {
      return;
    }

    const alpha = clamp(tank.hitFlashMs / Math.max(1, tank.hitFlashMaxMs), 0, 1);
    const pulseRadius = tank.radius * (1.04 + (1 - alpha) * 0.24);
    graphics.fillStyle(tank.hitFlashColor, 0.2 * alpha);
    graphics.fillCircle(tank.x, tank.y, pulseRadius);
    graphics.lineStyle(Math.max(2, tank.radius * 0.09), tank.hitFlashColor, 0.86 * alpha);
    graphics.strokeCircle(tank.x, tank.y, pulseRadius);
  }

  /**
   * Top-down soldier: boots, torso, then helmet with a trailing bandana, and a
   * weapon held along the aim line. Legs swing with trackPhase so they read as
   * running rather than sliding.
   */
  private drawInfantry(graphics: Phaser.GameObjects.Graphics, tank: TankRuntime, art: TankArt): void {
    const r = tank.radius;
    const rocketeer = tank.kind === 'rocketeer';
    const p = INFANTRY_PALETTE;

    graphics.fillStyle(0x05070a, 0.34);
    graphics.fillEllipse(tank.x, tank.y + r * 0.34, r * 1.9, r * 1.2);

    const stride = Math.sin(tank.trackPhase * 0.22) * r * 0.42;
    for (const side of [-1, 1]) {
      const boot = localToWorld(tank.x, tank.y, tank.bodyAngle, stride * side, r * 0.46 * side);
      graphics.fillStyle(p.fatigueDark, 1);
      graphics.fillCircle(boot.x, boot.y, r * 0.26);
    }

    this.drawPolygon(graphics, tank.x, tank.y, art.hull, tank.bodyAngle, r, p.fatigue, 1, 0x05070a, 0.6, 1.5);

    // webbing across the chest
    const webA = localToWorld(tank.x, tank.y, tank.bodyAngle, r * 0.12, -r * 0.4);
    const webB = localToWorld(tank.x, tank.y, tank.bodyAngle, -r * 0.2, r * 0.42);
    graphics.lineStyle(Math.max(2, r * 0.16), p.webbing, 0.95);
    graphics.lineBetween(webA.x, webA.y, webB.x, webB.y);

    this.drawInfantryWeapon(graphics, tank, art, rocketeer);

    // helmet + bandana tail, drawn last so the soldier reads from above
    graphics.fillStyle(p.skin, 1);
    graphics.fillCircle(tank.x, tank.y, r * 0.46);
    graphics.fillStyle(rocketeer ? p.bandanaDark : p.bandana, 1);
    graphics.fillCircle(tank.x, tank.y, r * 0.34);
    const tail = localToWorld(tank.x, tank.y, tank.turretAngle, -r * 0.9, r * 0.24);
    const tailBase = localToWorld(tank.x, tank.y, tank.turretAngle, -r * 0.3, r * 0.1);
    graphics.lineStyle(Math.max(1.5, r * 0.13), p.bandana, 0.9);
    graphics.lineBetween(tailBase.x, tailBase.y, tail.x, tail.y);

    graphics.fillStyle(0x070908, 0.75);
    graphics.fillRect(tank.x - r, tank.y - r - 14, r * 2, 4);
    graphics.fillStyle(0xff845f, 0.95);
    graphics.fillRect(tank.x - r, tank.y - r - 14, r * 2 * clamp(tank.health / tank.maxHealth, 0, 1), 4);
  }

  private drawInfantryWeapon(graphics: Phaser.GameObjects.Graphics, tank: TankRuntime, art: TankArt, rocketeer: boolean): void {
    const r = tank.radius;
    const p = INFANTRY_PALETTE;
    const start = localToWorld(tank.x, tank.y, tank.turretAngle, r * 0.1, r * 0.18);
    const tip = localToWorld(tank.x, tank.y, tank.turretAngle, art.barrelLength * r, r * 0.18);

    graphics.lineStyle(art.barrelWidth + 2, 0x101216, 1);
    graphics.lineBetween(start.x, start.y, tip.x, tip.y);
    graphics.lineStyle(art.barrelWidth, p.weapon, 1);
    graphics.lineBetween(start.x, start.y, tip.x, tip.y);

    if (rocketeer) {
      // fat warhead on the launcher so the dangerous one is readable at a glance
      graphics.fillStyle(p.bandana, 1);
      graphics.fillCircle(tip.x, tip.y, r * 0.24);
      graphics.lineStyle(1.5, 0x101216, 0.8);
      graphics.strokeCircle(tip.x, tip.y, r * 0.24);
    }
  }

  private drawRunners(graphics: Phaser.GameObjects.Graphics, tank: TankRuntime, art: TankArt, color: number): void {
    const r = tank.radius;
    const length = r * 1.7;
    const cos = Math.cos(tank.bodyAngle);
    const sin = Math.sin(tank.bodyAngle);

    if (art.chassis === 'tracked') {
      const wheelHubCount = 4;
      for (const side of [-1, 1]) {
        const oy = art.runnerOffset * r * side;
        const p1 = localToWorld(tank.x, tank.y, tank.bodyAngle, -length * 0.5, oy);
        const p2 = localToWorld(tank.x, tank.y, tank.bodyAngle, length * 0.5, oy);
        graphics.lineStyle(art.runnerWidth * r * 2, color, 1);
        graphics.lineBetween(p1.x, p1.y, p2.x, p2.y);

        // road wheel hubs: fixed to the hull, do not scroll with the tread
        graphics.fillStyle(darkenColor(color, 0.6), 0.9);
        for (let i = 0; i < wheelHubCount; i += 1) {
          const t = i / (wheelHubCount - 1);
          const lx = -length * 0.42 + length * 0.84 * t;
          const hub = localToWorld(tank.x, tank.y, tank.bodyAngle, lx, oy);
          graphics.fillCircle(hub.x, hub.y, art.runnerWidth * r * 0.72);
        }

        // tread links: scroll along the track using distance travelled, giving the
        // chain the look of rolling forward instead of sliding as a static block
        const linkSpacing = Math.max(6, r * 0.22);
        const scrollOffset = ((tank.trackPhase % linkSpacing) + linkSpacing) % linkSpacing;
        graphics.lineStyle(2, 0x050805, 0.5);
        const linkCount = Math.ceil(length / linkSpacing) + 2;
        for (let i = -1; i < linkCount; i += 1) {
          const lx = -length * 0.5 - linkSpacing + i * linkSpacing + scrollOffset;
          if (lx < -length * 0.5 - 1 || lx > length * 0.5 + 1) {
            continue;
          }
          const link = localToWorld(tank.x, tank.y, tank.bodyAngle, lx, oy);
          graphics.lineBetween(
            link.x - sin * art.runnerWidth * r,
            link.y + cos * art.runnerWidth * r,
            link.x + sin * art.runnerWidth * r,
            link.y - cos * art.runnerWidth * r,
          );
        }
      }
      return;
    }

    if (art.chassis === 'wheeled') {
      const wheelCount: number = 3;
      for (const side of [-1, 1]) {
        const oy = art.runnerOffset * r * side;
        for (let i = 0; i < wheelCount; i += 1) {
          const t = wheelCount === 1 ? 0.5 : i / (wheelCount - 1);
          const lx = -length * 0.42 + length * 0.84 * t;
          const wheel = localToWorld(tank.x, tank.y, tank.bodyAngle, lx, oy);
          graphics.fillStyle(0x14100f, 1);
          graphics.fillCircle(wheel.x, wheel.y, r * 0.22);
          graphics.fillStyle(color, 1);
          graphics.fillCircle(wheel.x, wheel.y, r * 0.12);
        }
      }
    }
  }

  private drawArmorBlocks(graphics: Phaser.GameObjects.Graphics, tank: TankRuntime, art: TankArt, color: number): void {
    const r = tank.radius;
    const size = r * 0.24;
    for (const side of [-1, 1]) {
      const oy = (art.runnerOffset - 0.16) * r * side;
      for (const lxFrac of [-0.5, -0.08, 0.36]) {
        const block = localToWorld(tank.x, tank.y, tank.bodyAngle, lxFrac * r, oy);
        this.drawPolygon(graphics, block.x, block.y, UNIT_BOX_POINTS, tank.bodyAngle, size * 0.5, color, 0.92, 0x050805, 0.4, 1);
      }
    }
  }

  private drawNoseLights(graphics: Phaser.GameObjects.Graphics, tank: TankRuntime, art: TankArt): void {
    const r = tank.radius;
    const noseX = art.hull.reduce((max, point) => Math.max(max, point.x), 0);
    const left = localToWorld(tank.x, tank.y, tank.bodyAngle, noseX * r * 0.82, -r * 0.28);
    const right = localToWorld(tank.x, tank.y, tank.bodyAngle, noseX * r * 0.82, r * 0.28);
    graphics.fillStyle(0xffe9a8, 0.9);
    graphics.fillCircle(left.x, left.y, Math.max(1.5, r * 0.05));
    graphics.fillCircle(right.x, right.y, Math.max(1.5, r * 0.05));
  }

  private drawHatch(graphics: Phaser.GameObjects.Graphics, tank: TankRuntime): void {
    const r = tank.radius;
    const pos = localToWorld(tank.x, tank.y, tank.turretAngle, -r * 0.16, r * 0.15);
    graphics.fillStyle(0x11130f, 0.85);
    graphics.fillCircle(pos.x, pos.y, r * 0.1);
    graphics.lineStyle(1.5, 0x050805, 0.6);
    graphics.strokeCircle(pos.x, pos.y, r * 0.1);
  }

  private drawSensorMast(graphics: Phaser.GameObjects.Graphics, tank: TankRuntime): void {
    const r = tank.radius;
    const base = localToWorld(tank.x, tank.y, tank.turretAngle, -r * 0.5, 0);
    const tip = localToWorld(tank.x, tank.y, tank.turretAngle, -r * 0.72, -r * 0.3);
    graphics.lineStyle(3, 0x1c1f22, 1);
    graphics.lineBetween(base.x, base.y, tip.x, tip.y);
    graphics.fillStyle(0xff5b4a, 0.95);
    graphics.fillCircle(tip.x, tip.y, r * 0.09);
  }

  private drawBarrel(graphics: Phaser.GameObjects.Graphics, tank: TankRuntime, art: TankArt, weapon?: WeaponSpec): void {
    const r = tank.radius;
    const innerStart = r * 0.28;
    const rapidFire = weapon?.id === 'machineGun' || weapon?.id === 'autocannon';
    const launcher = weapon?.id === 'rocket' || weapon?.id === 'launcher' || weapon?.id === 'homing';
    const droneRack = weapon?.id === 'drone';
    const indirect = weapon?.id === 'mortar' || weapon?.id === 'gasBomb';
    const longGun = weapon?.id === 'railgun' || weapon?.id === 'laser' || weapon?.id === 'sniper';
    const length = art.barrelLength * r * (rapidFire ? 0.82 : indirect ? 0.58 : longGun ? 1.28 : 1);

    if (rapidFire) {
      for (const side of [-1, 1]) {
        const start = localToWorld(tank.x, tank.y, tank.turretAngle, innerStart, side * r * 0.13);
        const tip = localToWorld(tank.x, tank.y, tank.turretAngle, length, side * r * 0.13);
        graphics.lineStyle(5, 0x0d0f0d, 1);
        graphics.lineBetween(start.x, start.y, tip.x, tip.y);
        graphics.lineStyle(2.5, 0x626b61, 1);
        graphics.lineBetween(start.x, start.y, tip.x, tip.y);
        graphics.fillStyle(0x111411, 1);
        graphics.fillCircle(tip.x, tip.y, 3.2);
      }
      return;
    }

    if (droneRack) {
      for (const side of [-1, 1]) {
        const rack = localToWorld(tank.x, tank.y, tank.turretAngle, r * 0.12, side * r * 0.48);
        this.drawRotatedRect(graphics, rack.x, rack.y, r * 0.92, r * 0.24, tank.turretAngle, 0x596351, 1);
        const nose = localToWorld(rack.x, rack.y, tank.turretAngle, r * 0.42, 0);
        graphics.fillStyle(0xffd766, 0.95);
        graphics.fillCircle(nose.x, nose.y, Math.max(2.5, r * 0.08));
      }
      return;
    }

    const start = localToWorld(tank.x, tank.y, tank.turretAngle, innerStart, 0);
    const tip = localToWorld(tank.x, tank.y, tank.turretAngle, length, 0);

    if (launcher) {
      graphics.lineStyle(art.barrelWidth + 8, 0x11150f, 1);
      graphics.lineBetween(start.x, start.y, tip.x, tip.y);
      graphics.lineStyle(art.barrelWidth + 4, 0x596751, 1);
      graphics.lineBetween(start.x, start.y, tip.x, tip.y);
      graphics.fillStyle(0x171b16, 1);
      graphics.fillCircle(tip.x, tip.y, (art.barrelWidth + 4) * 0.7);
      return;
    }

    const barrelWidth = indirect ? art.barrelWidth + 5 : longGun ? Math.max(3, art.barrelWidth - 1) : art.barrelWidth;
    graphics.lineStyle(barrelWidth + 3, 0x0d0f0d, 1);
    graphics.lineBetween(start.x, start.y, tip.x, tip.y);
    graphics.lineStyle(barrelWidth, tank.exposed ? 0xfff0a0 : longGun ? 0x62607a : 0x2a2f2a, 1);
    graphics.lineBetween(start.x, start.y, tip.x, tip.y);

    const muzzle = localToWorld(tank.x, tank.y, tank.turretAngle, length - r * 0.12, 0);
    graphics.fillStyle(0x141614, 1);
    graphics.fillCircle(muzzle.x, muzzle.y, barrelWidth * 0.62);
  }

  private drawPolygon(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    points: ReadonlyArray<RenderPoint>,
    angle: number,
    scale: number,
    color: number,
    alpha: number,
    strokeColor: number,
    strokeAlpha: number,
    lineWidth: number,
    scaleY = scale,
  ): void {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    while (this.polygonPointBuffer.length < points.length) {
      this.polygonPointBuffer.push({ x: 0, y: 0 });
    }
    for (let index = 0; index < points.length; index += 1) {
      const point = points[index];
      const corner = this.polygonPointBuffer[index];
      const px = point.x * scale;
      const py = point.y * scaleY;
      corner.x = x + px * cos - py * sin;
      corner.y = y + px * sin + py * cos;
    }

    graphics.fillStyle(color, alpha);
    graphics.fillPoints(this.polygonPointBuffer, true, false, points.length);
    graphics.lineStyle(lineWidth, strokeColor, strokeAlpha);
    graphics.strokePoints(this.polygonPointBuffer, true, false, points.length);
  }

  private drawRotatedRect(graphics: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number, angle: number, color: number, alpha: number): void {
    const halfWidth = width * 0.5;
    const halfHeight = height * 0.5;
    this.drawPolygon(
      graphics,
      x,
      y,
      UNIT_BOX_POINTS,
      angle,
      halfWidth,
      color,
      alpha,
      0x050805,
      0.42,
      2,
      halfHeight,
    );
  }

  private drawExplosions(graphics: Phaser.GameObjects.Graphics): void {
    const fullEffects = this.effectsEnabled();
    for (const explosion of this.explosions) {
      if (!this.isVisible(explosion.x, explosion.y, explosion.radius * 1.7)) {
        continue;
      }

      const progress = clamp(explosion.age / explosion.duration, 0, 1);
      const easeOut = 1 - (1 - progress) * (1 - progress);

      if (fullEffects) {
        // drifting smoke puff: lags behind the blast and lingers longest
        const smokeProgress = clamp(progress * 1.15, 0, 1);
        graphics.fillStyle(0x3a3a38, 0.16 * (1 - smokeProgress));
        graphics.fillCircle(
          explosion.x,
          explosion.y - smokeProgress * explosion.radius * 0.3,
          explosion.radius * (0.6 + smokeProgress * 0.7),
        );
      }

      // main shockwave: fast expanding ring with fading fill
      graphics.fillStyle(explosion.color, 0.3 * (1 - progress));
      graphics.fillCircle(explosion.x, explosion.y, explosion.radius * easeOut);
      graphics.lineStyle(4, explosion.color, 0.65 * (1 - progress));
      graphics.strokeCircle(explosion.x, explosion.y, explosion.radius * easeOut);

      if (fullEffects) {
        // secondary ring lagging behind the main shockwave
        const laggingProgress = clamp(progress * 0.7, 0, 1);
        graphics.lineStyle(2.5, explosion.color, 0.4 * (1 - progress));
        graphics.strokeCircle(explosion.x, explosion.y, explosion.radius * laggingProgress * 1.3);

        // bright white-hot core, visible only in the first moments
        if (progress < 0.35) {
          const flashAlpha = 1 - progress / 0.35;
          graphics.fillStyle(0xfff2c9, 0.85 * flashAlpha);
          graphics.fillCircle(explosion.x, explosion.y, explosion.radius * 0.32 * (1 - progress * 0.5));
        }

        // additive bloom pass, the trick rambo_game uses to make blasts glow
        const glow = this.glow;
        if (glow) {
          glow.fillStyle(explosion.color, 0.34 * (1 - progress));
          glow.fillCircle(explosion.x, explosion.y, explosion.radius * easeOut * 0.8);
          if (progress < 0.4) {
            glow.fillStyle(0xffffff, 0.5 * (1 - progress / 0.4));
            glow.fillCircle(explosion.x, explosion.y, explosion.radius * 0.3);
          }
        }
      }

      // radial debris sparks shooting outward
      for (const spark of explosion.sparks) {
        const reach = clamp(progress * spark.speed, 0, 1);
        const headX = explosion.x + Math.cos(spark.angle) * spark.length * reach;
        const headY = explosion.y + Math.sin(spark.angle) * spark.length * reach;
        const tailReach = Math.max(0, reach - 0.22);
        const tailX = explosion.x + Math.cos(spark.angle) * spark.length * tailReach;
        const tailY = explosion.y + Math.sin(spark.angle) * spark.length * tailReach;
        graphics.lineStyle(2, explosion.color, 0.75 * (1 - progress));
        graphics.lineBetween(tailX, tailY, headX, headY);
      }
    }
  }

  private addFloatingText(x: number, y: number, text: string, color: number): void {
    const label = this.add.text(x, y, text, {
      color: `#${color.toString(16).padStart(6, '0')}`,
      fontFamily: 'Bahnschrift, Trebuchet MS, sans-serif',
      fontSize: '15px',
      fontStyle: '700',
      stroke: '#050805',
      strokeThickness: 3,
    });
    label.setOrigin(0.5);
    label.setDepth(12);
    this.floatingTexts.push({
      x,
      y,
      age: 0,
      duration: 760,
      label,
    });
    while (this.floatingTexts.length > MAX_FLOATING_TEXTS) {
      this.floatingTexts.shift()?.label.destroy();
    }
  }
}
