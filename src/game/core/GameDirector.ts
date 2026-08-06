import { STAGES } from '../data/stages';
import {
  MAX_WEAPON_LEVEL,
  PURCHASABLE_WEAPONS,
  WEAPONS,
  weaponShopPrice,
  weaponsUnlockedAt,
  weaponUnlockedAtMission,
} from '../data/weapons';
import { CHASSIS_PRICE, cloneClassStats, nextChassis, PLAYER_CLASSES } from '../data/playerClasses';
import { SHOP_STATS, statPrice } from '../data/shop';
import type {
  DifficultyMode, MissionConfig, PlayerClassId, SessionSnapshot, ShopEntry, ShopItemId,
  TankStats, UpgradeId, UpgradeOption, WeaponId,
} from '../types';

type Listener = (snapshot: SessionSnapshot) => void;



const UPGRADE_LIBRARY: Record<UpgradeId, UpgradeOption> = {
  armor: {
    id: 'armor',
    label: 'Reactive Armor',
    description: '+110 max HP and better front armor.',
  },
  engine: {
    id: 'engine',
    label: 'Hot Engine',
    description: '+32 drive speed and faster hull response.',
  },
  reload: {
    id: 'reload',
    label: 'Auto Loader',
    description: 'Cannon reloads 16% faster.',
  },
  shells: {
    id: 'shells',
    label: 'Shaped Shells',
    description: '+22 cannon damage and wider blast.',
  },
  special: {
    id: 'special',
    label: 'Command Uplink',
    description: 'Artillery special cools down faster.',
  },
  repair: {
    id: 'repair',
    label: 'Field Repair Kit',
    description: '+1 repair charge and stronger repair pads.',
  },
};

const UPGRADE_ROTATION: UpgradeId[][] = [
  ['armor', 'reload', 'engine'],
  ['shells', 'special', 'repair'],
  ['engine', 'shells', 'armor'],
  ['reload', 'repair', 'special'],
];

function cloneStats(stats: TankStats): TankStats {
  return { ...stats };
}

function applyDifficulty(stats: TankStats, difficulty: DifficultyMode): TankStats {
  const next = cloneStats(stats);

  if (difficulty === 'easy') {
    next.maxHealth += 220;
    next.repairCharges += 1;
    next.reloadMs *= 0.9;
  }

  if (difficulty === 'hard') {
    next.maxHealth -= 130;
    next.reloadMs *= 1.08;
  }

  if (difficulty === 'extreme') {
    next.maxHealth -= 230;
    next.armor *= 0.82;
    next.reloadMs *= 1.16;
    next.repairCharges = Math.max(1, next.repairCharges - 1);
  }

  return next;
}

export class GameDirector {
  private readonly missions: MissionConfig[];
  private readonly listeners = new Set<Listener>();
  private phase: SessionSnapshot['phase'] = 'menu';
  private difficulty: DifficultyMode = 'normal';
  private currentMissionIndex = 0;
  private totalScore = 0;
  private scrap = 0;
  private runSerial = 0;
  private completedMissions = 0;
  private failureReason: string | undefined;
  private playerClass: PlayerClassId = 'medium';
  private tankStats = cloneClassStats('medium');
  private pendingUpgrades: UpgradeOption[] = this.getUpgradeOptions(0);
  private selectedWeapon: WeaponId = 'rocket';
  private credits = 0;
  private statLevels: Partial<Record<ShopItemId, number>> = {};
  private boughtWeapons: WeaponId[] = [];
  private weaponLevels: Partial<Record<WeaponId, number>> = {};

  constructor(missions: MissionConfig[] = STAGES) {
    this.missions = missions;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());

    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): SessionSnapshot {
    const currentMission = this.missions[this.currentMissionIndex] ?? this.missions[0];
    const nextMission = this.currentMissionIndex + 1 < this.missions.length
      ? this.missions[this.currentMissionIndex + 1]
      : undefined;

    return {
      phase: this.phase,
      difficulty: this.difficulty,
      currentMissionIndex: this.currentMissionIndex,
      totalScore: this.totalScore,
      scrap: this.scrap,
      failureReason: this.failureReason,
      runSerial: this.runSerial,
      completedMissions: this.completedMissions,
      currentMission,
      nextMission,
      missions: this.missions,
      tankStats: cloneStats(this.tankStats),
      pendingUpgrades: [...this.pendingUpgrades],
      unlockedWeapons: this.getUnlockedWeapons(),
      selectedWeapon: this.selectedWeapon,
      weaponLevels: this.getWeaponLevelsSnapshot(),
      playerClass: this.playerClass,
      credits: this.credits,
      shop: this.getShopEntries(),
    };
  }

  /** Everything on offer between stages, priced against the current wallet. */
  getShopEntries(): ShopEntry[] {
    const entries: ShopEntry[] = [];

    const upgrade = nextChassis(this.playerClass);
    if (upgrade) {
      const price = CHASSIS_PRICE[upgrade];
      entries.push({
        id: 'chassis',
        kind: 'chassis',
        label: `Upgrade to ${PLAYER_CLASSES[upgrade].label}`,
        description: PLAYER_CLASSES[upgrade].description,
        price,
        level: PLAYER_CLASSES[this.playerClass].tier,
        maxLevel: 3,
        owned: false,
        maxed: false,
        affordable: this.credits >= price,
      });
    }

    for (const spec of Object.values(SHOP_STATS)) {
      const level = this.statLevels[spec.id] ?? 0;
      const price = statPrice(spec, level);
      entries.push({
        id: spec.id,
        kind: 'stat',
        label: spec.label,
        description: spec.description,
        price,
        level,
        maxLevel: spec.maxLevel,
        owned: level > 0,
        maxed: level >= spec.maxLevel,
        affordable: this.credits >= price && level < spec.maxLevel,
      });
    }

    const unlockedWeapons = this.getUnlockedWeapons();
    const shopWeapons = [...unlockedWeapons, ...PURCHASABLE_WEAPONS]
      .filter((id, index, all) => all.indexOf(id) === index);
    for (const weaponId of shopWeapons) {
      const owned = unlockedWeapons.includes(weaponId);
      const level = owned ? this.getWeaponLevel(weaponId) : 0;
      const price = weaponShopPrice(weaponId, level);
      entries.push({
        id: weaponId,
        kind: 'weapon',
        label: WEAPONS[weaponId].label,
        description: owned
          ? `${WEAPONS[weaponId].description} Upgrade damage, velocity, and cooldown.`
          : WEAPONS[weaponId].description,
        price,
        level,
        maxLevel: MAX_WEAPON_LEVEL,
        owned,
        maxed: level >= MAX_WEAPON_LEVEL,
        affordable: level < MAX_WEAPON_LEVEL && this.credits >= price,
      });
    }

    return entries;
  }

  /**
   * Weapon picked up from an armory box mid-mission. It joins the arsenal for
   * good and is equipped immediately so the swap is felt straight away.
   */
  grantWeapon(id: WeaponId): void {
    if (!this.boughtWeapons.includes(id)) {
      this.boughtWeapons.push(id);
    }

    this.weaponLevels[id] = Math.max(1, this.weaponLevels[id] ?? 0);
    this.selectedWeapon = id;
    this.emit();
  }

  /** A weapon the player does not own yet, for armory boxes to hand out. */
  rollFieldWeapon(): WeaponId {
    const owned = this.getUnlockedWeapons();
    const missing = PURCHASABLE_WEAPONS.filter((id) => !owned.includes(id));
    const pool = missing.length > 0 ? missing : PURCHASABLE_WEAPONS;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  addCredits(amount: number): void {
    const credits = Math.max(0, Math.round(amount));
    if (credits <= 0) {
      return;
    }

    this.credits += credits;
    this.emit();
  }

  /** Spend credits on a shop line. Returns false when it was not affordable. */
  buyShopItem(id: ShopItemId | WeaponId): boolean {
    const entry = this.getShopEntries().find((candidate) => candidate.id === id);
    if (!entry || entry.maxed || !entry.affordable) {
      return false;
    }

    this.credits -= entry.price;

    if (entry.kind === 'chassis') {
      const upgrade = nextChassis(this.playerClass);
      if (upgrade) {
        this.switchChassis(upgrade);
      }
    } else if (entry.kind === 'weapon') {
      const weaponId = id as WeaponId;
      if (!this.boughtWeapons.includes(weaponId) && !this.getUnlockedWeapons().includes(weaponId)) {
        this.boughtWeapons.push(weaponId);
      }
      this.weaponLevels[weaponId] = Math.min(MAX_WEAPON_LEVEL, entry.level + 1);
      this.selectedWeapon = weaponId;
    } else {
      const spec = SHOP_STATS[id as Exclude<ShopItemId, 'chassis'>];
      spec.apply(this.tankStats);
      this.statLevels[spec.id] = (this.statLevels[spec.id] ?? 0) + 1;
    }

    this.emit();
    return true;
  }

  /**
   * Moving to a heavier chassis rebases the stats on the new hull, then replays
   * every upgrade already bought so purchases are never lost in the swap.
   */
  private switchChassis(next: PlayerClassId): void {
    this.playerClass = next;
    this.tankStats = applyDifficulty(cloneClassStats(next), this.difficulty);
    for (const [id, level] of Object.entries(this.statLevels)) {
      const spec = SHOP_STATS[id as Exclude<ShopItemId, 'chassis'>];
      for (let i = 0; i < (level ?? 0); i += 1) {
        spec.apply(this.tankStats);
      }
    }

    const starting = PLAYER_CLASSES[next].startingWeapon;
    this.weaponLevels[starting] = Math.max(1, this.weaponLevels[starting] ?? 0);
    if (!this.getUnlockedWeapons().includes(this.selectedWeapon)) {
      this.selectedWeapon = starting;
    }
  }

  getUnlockedWeapons(): WeaponId[] {
    const progression = weaponsUnlockedAt(this.currentMissionIndex);
    const starting = PLAYER_CLASSES[this.playerClass].startingWeapon;
    const all = [starting, ...progression, ...this.boughtWeapons];
    return all.filter((id, index) => all.indexOf(id) === index);
  }

  private getWeaponLevel(id: WeaponId): number {
    return Math.max(1, this.weaponLevels[id] ?? 1);
  }

  private getWeaponLevelsSnapshot(): Partial<Record<WeaponId, number>> {
    return Object.fromEntries(
      this.getUnlockedWeapons().map((id) => [id, this.getWeaponLevel(id)]),
    ) as Partial<Record<WeaponId, number>>;
  }

  cycleWeapon(direction: 1 | -1 = 1): void {
    const unlocked = this.getUnlockedWeapons();
    if (unlocked.length <= 1) {
      return;
    }

    const current = unlocked.indexOf(this.selectedWeapon);
    const next = (current + direction + unlocked.length) % unlocked.length;
    this.selectedWeapon = unlocked[next];
    this.emit();
  }

  startCampaign(
    playerClass: PlayerClassId = this.playerClass,
    difficulty: DifficultyMode = this.difficulty,
  ): void {
    this.phase = 'playing';
    this.difficulty = difficulty;
    this.playerClass = playerClass;
    this.currentMissionIndex = 0;
    this.totalScore = 0;
    this.scrap = 0;
    this.credits = 0;
    this.statLevels = {};
    this.boughtWeapons = [];
    this.weaponLevels = { [PLAYER_CLASSES[playerClass].startingWeapon]: 1 };
    this.failureReason = undefined;
    this.completedMissions = 0;
    this.tankStats = applyDifficulty(cloneClassStats(playerClass), difficulty);
    this.pendingUpgrades = this.getUpgradeOptions(0);
    this.selectedWeapon = PLAYER_CLASSES[playerClass].startingWeapon;
    this.runSerial += 1;
    this.emit();
  }

  pauseGame(): void {
    if (this.phase !== 'playing') {
      return;
    }

    this.phase = 'paused';
    this.emit();
  }

  resumeGame(): void {
    if (this.phase !== 'paused') {
      return;
    }

    // runSerial is deliberately untouched so the scene resumes the live mission
    // instead of treating this as a fresh deployment.
    this.phase = 'playing';
    this.emit();
  }

  advanceToNextStage(): void {
    this.advanceToNextMission();
  }

  advanceToNextMission(): void {
    if (this.currentMissionIndex >= this.missions.length - 1) {
      this.phase = 'victory';
      this.emit();
      return;
    }

    this.currentMissionIndex += 1;
    this.phase = 'playing';
    this.failureReason = undefined;
    this.pendingUpgrades = this.getUpgradeOptions(this.currentMissionIndex);

    // auto-equip a weapon the moment it unlocks so the new toy is in hand
    const unlocked = weaponUnlockedAtMission(this.currentMissionIndex);
    if (unlocked) {
      this.selectedWeapon = unlocked;
      this.weaponLevels[unlocked] = Math.max(1, this.weaponLevels[unlocked] ?? 0);
    }

    this.runSerial += 1;
    this.emit();
  }

  skipToNextStage(): void {
    this.completeCurrentMission({ score: 0, scrap: 0 });
  }

  addScore(points: number): void {
    const score = Math.max(0, Math.round(points));
    if (score <= 0) {
      return;
    }

    this.totalScore += score;
    this.emit();
  }

  completeCurrentMission(reward: { score: number; scrap: number }): void {
    this.failureReason = undefined;
    this.totalScore += Math.max(0, Math.round(reward.score));
    const salvage = Math.max(0, Math.round(reward.scrap));
    this.scrap += salvage;
    this.credits += salvage;
    this.completedMissions = Math.min(this.completedMissions + 1, this.missions.length);

    if (this.currentMissionIndex >= this.missions.length - 1) {
      this.phase = 'victory';
      this.emit();
      return;
    }

    this.phase = 'intermission';
    this.pendingUpgrades = this.getUpgradeOptions(this.currentMissionIndex);
    this.emit();
  }

  applyUpgrade(id: UpgradeId): void {
    if (!this.pendingUpgrades.some((upgrade) => upgrade.id === id)) {
      return;
    }

    if (id === 'armor') {
      this.tankStats.maxHealth += 110;
      this.tankStats.armor += 0.12;
    } else if (id === 'engine') {
      this.tankStats.engine += 32;
      this.tankStats.turnRate += 0.4;
    } else if (id === 'reload') {
      this.tankStats.reloadMs = Math.max(460, this.tankStats.reloadMs * 0.84);
    } else if (id === 'shells') {
      this.tankStats.shellDamage += 22;
      this.tankStats.shellSpeed += 35;
    } else if (id === 'special') {
      this.tankStats.specialCooldownMs = Math.max(7600, this.tankStats.specialCooldownMs * 0.78);
    } else if (id === 'repair') {
      this.tankStats.repairCharges += 1;
      this.tankStats.maxHealth += 45;
    }

    this.advanceToNextMission();
  }

  failMission(reason = 'Mission failed'): void {
    this.failureReason = reason;
    this.phase = 'gameover';
    this.emit();
  }

  private getUpgradeOptions(index: number): UpgradeOption[] {
    const ids = UPGRADE_ROTATION[index % UPGRADE_ROTATION.length];
    return ids.map((id) => UPGRADE_LIBRARY[id]);
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
