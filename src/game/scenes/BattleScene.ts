import Phaser from 'phaser';
import type { BattleMusic, TankSfxCue } from '../audio/BattleMusic';
import { GameDirector } from '../core/GameDirector';
import { VirtualGamepad } from '../core/VirtualGamepad';
import type {
  BossStatus,
  CaptureZoneConfig,
  CoverConfig,
  EnemyTankKind,
  HudSnapshot,
  MissionConfig,
  SessionSnapshot,
  TankStats,
} from '../types';

type Team = 'player' | 'enemy';

interface TankRuntime {
  id: string;
  kind: EnemyTankKind | 'player';
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
}

interface ProjectileRuntime {
  id: number;
  team: Team;
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

interface ExplosionRuntime {
  x: number;
  y: number;
  radius: number;
  age: number;
  duration: number;
  color: number;
}

interface FloatingText {
  x: number;
  y: number;
  age: number;
  duration: number;
  label: Phaser.GameObjects.Text;
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeAngle(angle: number): number {
  return Phaser.Math.Angle.Wrap(angle);
}

function angleDifference(a: number, b: number): number {
  return Phaser.Math.Angle.Wrap(b - a);
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
  return Phaser.Math.Distance.Between(cx, cy, nearestX, nearestY) <= radius;
}

function rectContainsPoint(rect: CoverRuntime, x: number, y: number): boolean {
  return Math.abs(x - rect.x) <= rect.width * 0.5 && Math.abs(y - rect.y) <= rect.height * 0.5;
}

function coverHealth(config: CoverConfig): number {
  if (config.health) {
    return config.health;
  }

  if (config.kind === 'concrete') {
    return 280;
  }

  if (config.kind === 'barrel') {
    return 70;
  }

  if (config.kind === 'mine') {
    return 1;
  }

  if (config.kind === 'repair') {
    return 9999;
  }

  return 120;
}

function enemyColor(kind: EnemyTankKind): number {
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
  private graphics?: Phaser.GameObjects.Graphics;
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
  private floatingTexts: FloatingText[] = [];
  private lastRunSerial = -1;
  private missionElapsed = 0;
  private defenseHeldMs = 0;
  private missionResolved = false;
  private projectileSerial = 1;
  private secondaryTimer = 0;
  private specialTimer = 0;
  private repairCharges = 0;
  private convoyEscapeCountdownMs = 0;
  private convoyWarningShown = false;
  private convoyBreachShown = false;
  private lastPointerWorld = { x: 400, y: 300 };

  constructor(
    director: GameDirector,
    onHud: (snapshot: HudSnapshot) => void,
    gamepad: VirtualGamepad,
    audio?: BattleMusic,
  ) {
    super('battle-scene');
    this.director = director;
    this.onHud = onHud;
    this.gamepad = gamepad;
    this.audio = audio;
  }

  create(): void {
    this.graphics = this.add.graphics();
    this.keys = this.input.keyboard?.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      fire: Phaser.Input.Keyboard.KeyCodes.SPACE,
      secondary: Phaser.Input.Keyboard.KeyCodes.E,
      special: Phaser.Input.Keyboard.KeyCodes.Q,
      repair: Phaser.Input.Keyboard.KeyCodes.R,
    }) as Record<string, Phaser.Input.Keyboard.Key>;

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.lastPointerWorld = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    });

    this.director.subscribe((snapshot) => {
      this.snapshot = snapshot;
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
      this.render();
      return;
    }

    const dt = Math.min(delta, 40) / 1000;
    this.missionElapsed += delta;
    this.secondaryTimer = Math.max(0, this.secondaryTimer - delta);
    this.specialTimer = Math.max(0, this.specialTimer - delta);

    this.updatePlayer(player, mission, snapshot.tankStats, dt, delta);
    this.updateEscort(dt);
    this.updateEnemies(player, mission, snapshot.difficulty, dt, delta);
    this.updateConvoyEscapeState(mission, delta);
    this.updateProjectiles(dt);
    this.updateExplosions(delta);
    this.updateCaptureZones(player, dt);
    this.updateRepairPads(player, snapshot.tankStats, dt);
    this.updateMines(player);
    this.updateMissionState(mission, delta);
    this.updateCamera(mission, player);
    this.onHud(this.buildHudSnapshot(snapshot, mission, player));
    this.render();
  }

  private startMission(snapshot: SessionSnapshot): void {
    const mission = snapshot.currentMission;
    this.lastRunSerial = snapshot.runSerial;
    this.mission = mission;
    this.missionElapsed = 0;
    this.defenseHeldMs = 0;
    this.missionResolved = false;
    this.projectiles = [];
    this.explosions = [];
    for (const text of this.floatingTexts) {
      text.label.destroy();
    }
    this.floatingTexts = [];
    this.secondaryTimer = 0;
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
        solid: cover.kind !== 'mine' && cover.kind !== 'repair',
        spent: false,
      };
    });
    this.enemies = mission.enemies.map((spawn) => this.createEnemy(spawn.kind, spawn.id, spawn.x, spawn.y, snapshot.difficulty));

    if (mission.boss) {
      const boss = this.createEnemy('boss', mission.boss.id, mission.boss.x, mission.boss.y, snapshot.difficulty);
      boss.label = mission.boss.name;
      boss.health = mission.boss.health * DIFFICULTY_HEALTH[snapshot.difficulty];
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
      kind: 'player',
      label: 'Steel Front',
      team: 'player',
      x: 190,
      y: mission.worldHeight * 0.52,
      vx: 0,
      vy: 0,
      bodyAngle: 0,
      turretAngle: 0,
      radius: 30,
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
    };

    this.cameras.main.setBounds(0, 0, mission.worldWidth, mission.worldHeight);
    this.cameras.main.setBackgroundColor(mission.palette.sky);
    this.onHud(this.buildHudSnapshot(snapshot, mission, this.player));
    this.render();
  }

  private createEnemy(kind: EnemyTankKind, id: string, x: number, y: number, difficulty: SessionSnapshot['difficulty']): TankRuntime {
    const template = ENEMY_TEMPLATES[kind];
    const health = template.health * DIFFICULTY_HEALTH[difficulty];
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
      reloadMs: template.reloadMs,
      reloadTimer: Phaser.Math.Between(300, template.reloadMs),
      damage: template.damage,
      shellSpeed: template.shellSpeed,
      score: template.score,
      scrap: template.scrap,
      alive: true,
      exposed: false,
    };
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

    player.x = clamp(player.x + player.vx * dt, player.radius, mission.worldWidth - player.radius);
    player.y = clamp(player.y + player.vy * dt, player.radius, mission.worldHeight - player.radius);
    this.resolveTankCoverCollision(player);

    const aimAxis = this.gamepad.getAimAxis();
    if (Math.hypot(aimAxis.x, aimAxis.y) > 0.18) {
      player.turretAngle = Math.atan2(aimAxis.y, aimAxis.x);
      this.lastPointerWorld = {
        x: player.x + Math.cos(player.turretAngle) * 240,
        y: player.y + Math.sin(player.turretAngle) * 240,
      };
    } else {
      const pointer = this.input.activePointer;
      const virtualActionHeld = this.gamepad.isDown(1, 'fire')
        || this.gamepad.isDown(1, 'secondary')
        || this.gamepad.isDown(1, 'special')
        || this.gamepad.isDown(1, 'repair');
      if (pointer && !virtualActionHeld) {
        this.lastPointerWorld = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      }
      player.turretAngle = Math.atan2(this.lastPointerWorld.y - player.y, this.lastPointerWorld.x - player.x);
    }

    if (this.wantsFire()) {
      this.fireProjectile(player, 'player', stats.shellDamage, stats.shellSpeed, 64, 0xf8d46d);
    }

    if (this.wantsSecondary() && this.secondaryTimer <= 0) {
      this.secondaryTimer = stats.secondaryCooldownMs;
      this.fireProjectile(player, 'player', stats.shellDamage * 0.72, stats.shellSpeed * 1.15, 46, 0x95e7ff, true);
      this.addFloatingText(player.x, player.y - 48, 'Rocket', 0x95e7ff);
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
    return Boolean(keyboardFire || pointer?.leftButtonDown() || virtualFire);
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

  private updateEnemies(player: TankRuntime, mission: MissionConfig, difficulty: SessionSnapshot['difficulty'], dt: number, delta: number): void {
    for (const enemy of this.enemies) {
      if (!enemy.alive) {
        continue;
      }

      enemy.reloadTimer = Math.max(0, enemy.reloadTimer - delta);
      const angleToPlayer = Math.atan2(player.y - enemy.y, player.x - enemy.x);
      enemy.turretAngle = approachAngle(enemy.turretAngle, angleToPlayer, 4.8 * dt);
      enemy.exposed = enemy.kind === 'boss' && Math.sin(this.missionElapsed / 760) > 0.42;

      if (enemy.kind === 'convoy') {
        const escapeLine = mission.exitX ? mission.exitX - enemy.radius : mission.worldWidth - enemy.radius;
        enemy.x = Math.min(escapeLine, enemy.x + enemy.speed * dt);
        enemy.vx = enemy.x >= escapeLine ? 0 : enemy.speed;
        enemy.bodyAngle = 0;
      } else if (enemy.kind !== 'turret') {
        const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, player.x, player.y);
        const preferred = enemy.kind === 'boss' ? 430 : 310;
        const chase = distance > preferred ? 1 : distance < preferred * 0.55 ? -0.55 : 0.15;
        const strafe = Math.sin((this.missionElapsed + enemy.x * 17) / 900) * 0.42;
        const moveAngle = angleToPlayer + strafe;
        enemy.vx = Math.cos(moveAngle) * enemy.speed * chase;
        enemy.vy = Math.sin(moveAngle) * enemy.speed * chase;
        enemy.x = clamp(enemy.x + enemy.vx * dt, enemy.radius, mission.worldWidth - enemy.radius);
        enemy.y = clamp(enemy.y + enemy.vy * dt, enemy.radius, mission.worldHeight - enemy.radius);
        this.resolveTankCoverCollision(enemy);

        if (Math.hypot(enemy.vx, enemy.vy) > 8) {
          enemy.bodyAngle = approachAngle(enemy.bodyAngle, Math.atan2(enemy.vy, enemy.vx), 3.2 * dt);
        }
      }

      const openingGraceMs = mission.kind === 'assault' ? 3600 : 2000;
      const canFire = this.missionElapsed > openingGraceMs
        && enemy.reloadTimer <= 0
        && Phaser.Math.Distance.Between(enemy.x, enemy.y, player.x, player.y) < 820;
      if (canFire) {
        enemy.reloadTimer = enemy.reloadMs;
        this.fireProjectile(
          enemy,
          'enemy',
          enemy.damage * DIFFICULTY_DAMAGE[difficulty],
          enemy.shellSpeed,
          enemy.kind === 'boss' ? 76 : 48,
          enemy.kind === 'boss' ? 0xff8a5b : 0xffc16d,
        );
      }
    }
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

      if (circleRectOverlap(escort.x, escort.y, 30, cover)) {
        escort.x = Math.min(escort.x, cover.x - cover.width * 0.5 - 32);
        escort.vx *= 0.2;
      }
    }
  }

  private updateProjectiles(dt: number): void {
    for (const projectile of this.projectiles) {
      projectile.previousX = projectile.x;
      projectile.previousY = projectile.y;
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      projectile.ttl -= dt * 1000;

      if (this.handleProjectileCoverHit(projectile)) {
        projectile.ttl = -1;
        continue;
      }

      if (projectile.team === 'player') {
        const target = this.enemies.find((enemy) => enemy.alive && Phaser.Math.Distance.Between(projectile.x, projectile.y, enemy.x, enemy.y) <= enemy.radius + projectile.radius);
        if (target) {
          this.damageTank(target, projectile.damage, projectile, projectile.blastRadius);
          projectile.ttl = -1;
        }
      } else if (this.player && Phaser.Math.Distance.Between(projectile.x, projectile.y, this.player.x, this.player.y) <= this.player.radius + projectile.radius) {
        this.damageTank(this.player, projectile.damage, projectile, projectile.blastRadius);
        projectile.ttl = -1;
      } else if (this.escort && Phaser.Math.Distance.Between(projectile.x, projectile.y, this.escort.x, this.escort.y) <= 34 + projectile.radius) {
        this.escort.health -= projectile.damage * 0.8;
        this.createExplosion(projectile.x, projectile.y, projectile.blastRadius, projectile.color);
        projectile.ttl = -1;
        if (this.escort.health <= 0) {
          this.failMission('Escort destroyed');
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

  private handleProjectileCoverHit(projectile: ProjectileRuntime): boolean {
    for (const cover of this.covers) {
      if (cover.health <= 0 || cover.kind === 'repair' || cover.spent) {
        continue;
      }

      const hit = cover.kind === 'mine'
        ? Phaser.Math.Distance.Between(projectile.x, projectile.y, cover.x, cover.y) < 32
        : rectContainsPoint(cover, projectile.x, projectile.y);
      if (!hit) {
        continue;
      }

      if (cover.kind === 'barrel') {
        cover.health = 0;
        cover.spent = true;
        this.createExplosion(cover.x, cover.y, 145, 0xff9b42);
        this.damageArea(cover.x, cover.y, 145, projectile.damage * 1.2, projectile.team);
      } else if (cover.kind === 'mine') {
        cover.health = 0;
        cover.spent = true;
        this.createExplosion(cover.x, cover.y, 118, 0xff7055);
        this.damageArea(cover.x, cover.y, 118, projectile.damage, projectile.team);
      } else {
        cover.health -= projectile.damage;
        this.createExplosion(projectile.x, projectile.y, projectile.blastRadius * 0.55, projectile.color);
        if (cover.health <= 0) {
          this.addFloatingText(cover.x, cover.y - 28, 'Cover Broken', 0xf0c15a);
        }
      }

      return true;
    }

    return false;
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

  private updateCaptureZones(player: TankRuntime, dt: number): void {
    for (const zone of this.captureZones) {
      if (zone.progress >= 1) {
        continue;
      }

      const playerInside = Phaser.Math.Distance.Between(player.x, player.y, zone.x, zone.y) < zone.radius;
      const enemyInside = this.enemies.some((enemy) => enemy.alive && Phaser.Math.Distance.Between(enemy.x, enemy.y, zone.x, zone.y) < zone.radius);
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
    const repairPads = this.covers.filter((cover) => cover.kind === 'repair' && !cover.spent);
    for (const pad of repairPads) {
      if (!circleRectOverlap(player.x, player.y, player.radius, pad)) {
        continue;
      }

      player.health = Math.min(player.maxHealth, player.health + (22 + stats.repairCharges * 4) * dt);
    }
  }

  private updateMines(player: TankRuntime): void {
    const targets = [player, ...this.enemies.filter((enemy) => enemy.alive)];
    for (const mine of this.covers) {
      if (mine.kind !== 'mine' || mine.spent) {
        continue;
      }

      const target = targets.find((tank) => Phaser.Math.Distance.Between(tank.x, tank.y, mine.x, mine.y) < tank.radius + 24);
      if (!target) {
        continue;
      }

      mine.spent = true;
      mine.health = 0;
      this.createExplosion(mine.x, mine.y, 120, 0xff704f);
      this.damageArea(mine.x, mine.y, 120, 90, target.team === 'player' ? 'enemy' : 'player');
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

    if (mission.kind === 'assault' && this.enemies.every((enemy) => !enemy.alive)) {
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
    const scrap = 35 + this.snapshot.currentMissionIndex * 12 + Math.round(this.enemies.filter((enemy) => !enemy.alive).reduce((sum, enemy) => sum + enemy.scrap, 0) * 0.45);
    this.addFloatingText(this.player.x, this.player.y - 70, 'Mission Clear', 0xa2db7c);
    this.audio?.setEngineLoad(0);
    this.audio?.playSfx('mission-clear', 0.9);
    this.time.delayedCall(600, () => {
      this.director.completeCurrentMission({ score, scrap });
    });
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
    this.time.delayedCall(900, () => this.director.failMission(reason));
  }

  private fireProjectile(source: TankRuntime, team: Team, damage: number, shellSpeed: number, blastRadius: number, color: number, ignoreReload = false): void {
    if (!source.alive || (!ignoreReload && source.reloadTimer > 0)) {
      return;
    }

    const muzzleDistance = source.radius + 20;
    const x = source.x + Math.cos(source.turretAngle) * muzzleDistance;
    const y = source.y + Math.sin(source.turretAngle) * muzzleDistance;
    if (!ignoreReload) {
      source.reloadTimer = source.reloadMs;
    }
    source.vx -= Math.cos(source.turretAngle) * (team === 'player' ? 34 : 9);
    source.vy -= Math.sin(source.turretAngle) * (team === 'player' ? 34 : 9);
    this.projectiles.push({
      id: this.projectileSerial,
      team,
      x,
      y,
      previousX: x,
      previousY: y,
      vx: Math.cos(source.turretAngle) * shellSpeed,
      vy: Math.sin(source.turretAngle) * shellSpeed,
      damage,
      blastRadius,
      radius: team === 'player' ? 10 : 8,
      ttl: 1800,
      color,
    });
    this.projectileSerial += 1;
    this.playSpatialSfx(ignoreReload ? 'rocket' : 'cannon', source.x, source.y, team === 'player' ? 1 : 0.42);
  }

  private damageTank(target: TankRuntime, damage: number, projectile: ProjectileRuntime, blastRadius: number): void {
    const incomingAngle = Math.atan2(-projectile.vy, -projectile.vx);
    const facing = Math.abs(angleDifference(target.bodyAngle, incomingAngle));
    let multiplier = 1;

    if (facing < Math.PI * 0.34) {
      multiplier = target.team === 'player' ? 0.62 : 0.74;
    } else if (facing > Math.PI * 0.68) {
      multiplier = 1.42;
    }

    if (target.kind === 'boss' && !target.exposed) {
      multiplier *= 0.58;
    }

    const applied = damage * multiplier * (target.team === 'player' && this.snapshot ? 1 / this.snapshot.tankStats.armor : 1);
    target.health -= applied;
    if (blastRadius > 0) {
      this.createExplosion(projectile.x, projectile.y, blastRadius, projectile.color);
      this.damageArea(projectile.x, projectile.y, blastRadius, damage * 0.42, projectile.team, target.id);
    }
    this.addFloatingText(target.x, target.y - target.radius - 18, `${Math.round(applied)}`, target.team === 'player' ? 0xff845f : 0xf0d78b);

    if (target.health <= 0 && target.alive) {
      target.alive = false;
      this.createExplosion(target.x, target.y, target.radius * 2.6, target.team === 'player' ? 0xff5147 : 0xffb24a);
      if (target.team === 'enemy') {
        this.director.addScore(target.score);
      }
    }
  }

  private damageArea(x: number, y: number, radius: number, damage: number, sourceTeam: Team, ignoreTankId?: string): void {
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
      };
      this.damageTank(target, damage * falloff, fakeProjectile, 0);
    }

    if (sourceTeam === 'enemy' && this.escort) {
      const distance = Phaser.Math.Distance.Between(x, y, this.escort.x, this.escort.y);
      if (distance <= radius + 34) {
        this.escort.health -= damage * 0.45;
      }
    }

    for (const cover of this.covers) {
      if (cover.health <= 0 || cover.kind === 'repair') {
        continue;
      }

      const distance = Phaser.Math.Distance.Between(x, y, cover.x, cover.y);
      if (distance <= radius + Math.max(cover.width, cover.height) * 0.5) {
        cover.health -= damage * 0.55;
        if (cover.health <= 0 && cover.kind === 'barrel' && !cover.spent) {
          cover.spent = true;
          this.createExplosion(cover.x, cover.y, 132, 0xff9b42);
        }
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

  private createExplosion(x: number, y: number, radius: number, color: number): void {
    if (radius <= 0) {
      return;
    }

    this.explosions.push({
      x,
      y,
      radius,
      age: 0,
      duration: 360,
      color,
    });
    this.playSpatialSfx(radius >= 100 ? 'explosion' : 'impact', x, y, radius >= 100 ? 1 : 0.72);
    if (this.cameras.main) {
      this.cameras.main.shake(80, clamp(radius / 8000, 0.003, 0.014));
    }
  }

  private callArtilleryStrike(): void {
    const target = this.getArtilleryTarget();
    this.addFloatingText(target.x, target.y - 52, 'Artillery', 0xffd27a);
    this.audio?.playSfx('artillery', 0.85);
    for (let index = 0; index < 4; index += 1) {
      this.time.delayedCall(index * 155, () => {
        const offsetAngle = index * Math.PI * 0.5 + 0.35;
        const radius = index === 0 ? 0 : 58;
        const x = clamp(target.x + Math.cos(offsetAngle) * radius, 60, this.mission?.worldWidth ?? target.x);
        const y = clamp(target.y + Math.sin(offsetAngle) * radius, 60, this.mission?.worldHeight ?? target.y);
        this.createExplosion(x, y, 152, 0xffc65f);
        this.damageArea(x, y, 152, (this.snapshot?.tankStats.shellDamage ?? 95) * 1.35, 'player');
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

  private updateCamera(mission: MissionConfig, player: TankRuntime): void {
    const camera = this.cameras.main;
    camera.setScroll(
      clamp(player.x - camera.width * 0.5, 0, Math.max(0, mission.worldWidth - camera.width)),
      clamp(player.y - camera.height * 0.5, 0, Math.max(0, mission.worldHeight - camera.height)),
    );
  }

  private buildHudSnapshot(snapshot: SessionSnapshot, mission: MissionConfig, player: TankRuntime): HudSnapshot {
    const boss = this.enemies.find((enemy) => enemy.kind === 'boss');
    const enemyAlive = this.enemies.filter((enemy) => enemy.alive).length;
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
      enemyCount: {
        alive: enemyAlive,
        total: this.enemies.length,
      },
      totalScore: snapshot.totalScore,
      scrap: snapshot.scrap,
      tank: {
        health: Math.max(0, player.health),
        maxHealth: player.maxHealth,
        armor: snapshot.tankStats.armor,
        speed: Math.hypot(player.vx, player.vy),
        reloadPercent: 1 - clamp(player.reloadTimer / player.reloadMs, 0, 1),
        secondaryPercent: 1 - clamp(this.secondaryTimer / snapshot.tankStats.secondaryCooldownMs, 0, 1),
        specialPercent: 1 - clamp(this.specialTimer / snapshot.tankStats.specialCooldownMs, 0, 1),
        repairCharges: this.repairCharges,
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

  private render(): void {
    const graphics = this.graphics;
    if (!graphics) {
      return;
    }

    graphics.clear();
    const mission = this.mission ?? this.snapshot?.currentMission;
    if (!mission) {
      return;
    }

    this.drawTerrain(graphics, mission);
    this.drawCaptureZones(graphics);
    this.drawEscort(graphics);
    this.drawCovers(graphics);
    this.drawTanks(graphics);
    this.drawProjectiles(graphics);
    this.drawExplosions(graphics);
  }

  private drawTerrain(graphics: Phaser.GameObjects.Graphics, mission: MissionConfig): void {
    graphics.fillStyle(mission.palette.ground, 1);
    graphics.fillRect(0, 0, mission.worldWidth, mission.worldHeight);
    graphics.fillStyle(mission.palette.shadow, 0.28);
    for (let x = 0; x < mission.worldWidth; x += 180) {
      graphics.fillRect(x, 0, 2, mission.worldHeight);
    }
    for (let y = 0; y < mission.worldHeight; y += 180) {
      graphics.fillRect(0, y, mission.worldWidth, 2);
    }
    if (mission.palette.water) {
      graphics.fillStyle(mission.palette.water, 0.58);
      graphics.fillRect(0, mission.worldHeight * 0.72, mission.worldWidth, 90);
    }

    if (mission.kind === 'assault' && mission.exitX) {
      graphics.fillStyle(0xff6b4a, this.convoyEscapeCountdownMs > 0 ? 0.34 : 0.18);
      graphics.fillRect(mission.exitX - 18, 0, 36, mission.worldHeight);
      graphics.lineStyle(4, 0xffd27a, this.convoyEscapeCountdownMs > 0 ? 0.95 : 0.58);
      graphics.lineBetween(mission.exitX - 18, 0, mission.exitX - 18, mission.worldHeight);
      graphics.lineBetween(mission.exitX + 18, 0, mission.exitX + 18, mission.worldHeight);
    }
  }

  private drawCaptureZones(graphics: Phaser.GameObjects.Graphics): void {
    for (const zone of this.captureZones) {
      graphics.lineStyle(3, zone.progress >= 1 ? 0xa2db7c : 0xf0c15a, 0.7);
      graphics.fillStyle(zone.progress >= 1 ? 0xa2db7c : 0xf0c15a, 0.12 + zone.progress * 0.18);
      graphics.fillCircle(zone.x, zone.y, zone.radius);
      graphics.strokeCircle(zone.x, zone.y, zone.radius);
      graphics.fillStyle(0xf6f2de, 0.9);
      graphics.fillRect(zone.x - 44, zone.y - zone.radius - 16, 88 * zone.progress, 6);
    }
  }

  private drawEscort(graphics: Phaser.GameObjects.Graphics): void {
    if (!this.escort) {
      return;
    }

    this.drawRotatedRect(graphics, this.escort.x, this.escort.y, 74, 40, 0, 0x8fd6a0, 1);
    graphics.fillStyle(0x1b241b, 1);
    graphics.fillRect(this.escort.x - 34, this.escort.y - 31, 68, 6);
    graphics.fillStyle(0xa2db7c, 1);
    graphics.fillRect(this.escort.x - 34, this.escort.y - 31, 68 * clamp(this.escort.health / this.escort.maxHealth, 0, 1), 6);
  }

  private drawCovers(graphics: Phaser.GameObjects.Graphics): void {
    for (const cover of this.covers) {
      if (cover.health <= 0 || cover.spent) {
        continue;
      }

      if (cover.kind === 'repair') {
        graphics.fillStyle(0x4fd88b, 0.28);
        graphics.fillCircle(cover.x, cover.y, cover.width * 0.62);
        graphics.lineStyle(2, 0xa2db7c, 0.72);
        graphics.strokeCircle(cover.x, cover.y, cover.width * 0.62);
        continue;
      }

      if (cover.kind === 'mine') {
        graphics.fillStyle(0xff704f, 0.8);
        graphics.fillCircle(cover.x, cover.y, 17);
        graphics.lineStyle(2, 0x4d1411, 1);
        graphics.strokeCircle(cover.x, cover.y, 22);
        continue;
      }

      const color = cover.kind === 'concrete' ? 0x71777f : cover.kind === 'barrel' ? 0xff8a42 : 0x896a3c;
      graphics.fillStyle(color, 0.92);
      graphics.fillRect(cover.x - cover.width * 0.5, cover.y - cover.height * 0.5, cover.width, cover.height);
      graphics.lineStyle(2, 0x0b0c10, 0.45);
      graphics.strokeRect(cover.x - cover.width * 0.5, cover.y - cover.height * 0.5, cover.width, cover.height);
      graphics.fillStyle(0x0b0c10, 0.55);
      graphics.fillRect(cover.x - cover.width * 0.5, cover.y - cover.height * 0.5 - 8, cover.width, 5);
      graphics.fillStyle(0xf0d78b, 0.85);
      graphics.fillRect(cover.x - cover.width * 0.5, cover.y - cover.height * 0.5 - 8, cover.width * clamp(cover.health / cover.maxHealth, 0, 1), 5);
    }
  }

  private drawProjectiles(graphics: Phaser.GameObjects.Graphics): void {
    for (const projectile of this.projectiles) {
      const speed = Math.max(1, Math.hypot(projectile.vx, projectile.vy));
      const ux = projectile.vx / speed;
      const uy = projectile.vy / speed;
      const trailLength = projectile.team === 'player' ? 86 : 56;
      const tailX = projectile.x - ux * trailLength;
      const tailY = projectile.y - uy * trailLength;
      const shellRadius = projectile.team === 'player' ? projectile.radius + 4 : projectile.radius + 2;

      graphics.lineStyle(projectile.team === 'player' ? 12 : 8, projectile.color, 0.18);
      graphics.lineBetween(tailX, tailY, projectile.x, projectile.y);
      graphics.lineStyle(projectile.team === 'player' ? 6 : 4, projectile.color, 0.82);
      graphics.lineBetween(tailX + ux * trailLength * 0.28, tailY + uy * trailLength * 0.28, projectile.x, projectile.y);
      graphics.fillStyle(0xffffff, 0.78);
      graphics.fillCircle(projectile.x, projectile.y, Math.max(3, shellRadius * 0.42));
      graphics.lineStyle(2, 0x140f08, 0.62);
      graphics.strokeCircle(projectile.x, projectile.y, shellRadius);
      graphics.fillStyle(projectile.color, 1);
      graphics.fillCircle(projectile.x, projectile.y, shellRadius);
    }
  }

  private drawTanks(graphics: Phaser.GameObjects.Graphics): void {
    if (this.player) {
      this.drawTank(graphics, this.player, 0x6fd1a8);
    }

    for (const enemy of this.enemies) {
      if (!enemy.alive) {
        continue;
      }

      this.drawTank(graphics, enemy, enemy.kind === 'player' ? 0x6fd1a8 : enemyColor(enemy.kind));
    }
  }

  private drawTank(graphics: Phaser.GameObjects.Graphics, tank: TankRuntime, color: number): void {
    const width = tank.radius * (tank.kind === 'boss' ? 2.4 : 2);
    const height = tank.radius * (tank.kind === 'boss' ? 1.7 : 1.45);
    this.drawRotatedRect(graphics, tank.x, tank.y, width, height, tank.bodyAngle, color, 1);
    this.drawRotatedRect(graphics, tank.x, tank.y, tank.radius * 0.9, tank.radius * 0.72, tank.turretAngle, 0x2f342f, 1);
    graphics.lineStyle(tank.kind === 'boss' ? 9 : 6, tank.exposed ? 0xfff0a0 : 0x20251f, 1);
    graphics.lineBetween(
      tank.x + Math.cos(tank.turretAngle) * tank.radius * 0.28,
      tank.y + Math.sin(tank.turretAngle) * tank.radius * 0.28,
      tank.x + Math.cos(tank.turretAngle) * tank.radius * 1.8,
      tank.y + Math.sin(tank.turretAngle) * tank.radius * 1.8,
    );
    graphics.fillStyle(0x070908, 0.75);
    graphics.fillRect(tank.x - tank.radius, tank.y - tank.radius - 18, tank.radius * 2, 5);
    graphics.fillStyle(tank.team === 'player' ? 0xa2db7c : 0xff845f, 0.95);
    graphics.fillRect(tank.x - tank.radius, tank.y - tank.radius - 18, tank.radius * 2 * clamp(tank.health / tank.maxHealth, 0, 1), 5);
  }

  private drawRotatedRect(graphics: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number, angle: number, color: number, alpha: number): void {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const halfWidth = width * 0.5;
    const halfHeight = height * 0.5;
    const corners = [
      { x: -halfWidth, y: -halfHeight },
      { x: halfWidth, y: -halfHeight },
      { x: halfWidth, y: halfHeight },
      { x: -halfWidth, y: halfHeight },
    ].map((corner) => new Phaser.Math.Vector2(x + corner.x * cos - corner.y * sin, y + corner.x * sin + corner.y * cos));

    graphics.fillStyle(color, alpha);
    graphics.fillPoints(corners, true);
    graphics.lineStyle(2, 0x050805, 0.42);
    graphics.strokePoints(corners, true);
  }

  private drawExplosions(graphics: Phaser.GameObjects.Graphics): void {
    for (const explosion of this.explosions) {
      const progress = clamp(explosion.age / explosion.duration, 0, 1);
      graphics.fillStyle(explosion.color, 0.28 * (1 - progress));
      graphics.fillCircle(explosion.x, explosion.y, explosion.radius * progress);
      graphics.lineStyle(4, explosion.color, 0.62 * (1 - progress));
      graphics.strokeCircle(explosion.x, explosion.y, explosion.radius * progress);
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
  }
}
