import { GameDirector } from '../core/GameDirector';
import { WEAPONS } from '../data/weapons';
import { PLAYER_CLASSES } from '../data/playerClasses';
import type { TankSfxCue } from '../audio/BattleMusic';
import type { DifficultyMode, HudSnapshot, PlayerClassId, SessionSnapshot, ShopEntry, ShopItemId, WeaponId } from '../types';

interface InterfaceRoots {
  hudRoot: HTMLElement;
  overlayRoot: HTMLElement;
  intelRoot: HTMLElement;
}

interface InterfaceOptions {
  startMusic?: () => void;
  playSfx?: (cue: TankSfxCue, intensity?: number) => void;
}

export class InterfaceController {
  private readonly hudRoot: HTMLElement;
  private readonly overlayRoot: HTMLElement;
  private readonly intelRoot: HTMLElement;
  private readonly director: GameDirector;
  private readonly startMusic?: () => void;
  private readonly playSfx?: (cue: TankSfxCue, intensity?: number) => void;
  private hudSnapshot: HudSnapshot | null = null;
  private sessionSnapshot: SessionSnapshot;
  private lastHudSignature = '';
  private lastOverlaySignature = '';
  private lastIntelSignature = '';
  private selectedDifficulty: DifficultyMode = 'normal';
  private selectedClass: PlayerClassId = 'medium';
  private intermissionView: 'summary' | 'shop' = 'summary';

  constructor(roots: InterfaceRoots, director: GameDirector, options: InterfaceOptions = {}) {
    this.hudRoot = roots.hudRoot;
    this.overlayRoot = roots.overlayRoot;
    this.intelRoot = roots.intelRoot;
    this.director = director;
    this.startMusic = options.startMusic;
    this.playSfx = options.playSfx;
    this.sessionSnapshot = director.getSnapshot();

    // delegated so the frequently re-rendered HUD markup never needs re-binding
    this.hudRoot.addEventListener('click', (event) => {
      const trigger = (event.target as HTMLElement | null)?.closest('[data-pause]');
      if (trigger) {
        this.director.pauseGame();
      }
    });

    window.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' && event.key !== 'p' && event.key !== 'P') {
        return;
      }

      if (this.sessionSnapshot.phase === 'playing') {
        this.director.pauseGame();
      } else if (this.sessionSnapshot.phase === 'paused') {
        this.director.resumeGame();
      }
    });

    this.director.subscribe((snapshot) => {
      const previousPhase = this.sessionSnapshot.phase;
      this.sessionSnapshot = snapshot;
      if (snapshot.phase !== 'intermission' || previousPhase !== 'intermission') {
        this.intermissionView = 'summary';
      }
      this.renderOverlay();
      this.renderIntel();
      this.renderHud();
    });
  }

  setHud(snapshot: HudSnapshot): void {
    const signature = JSON.stringify(snapshot);
    if (signature === this.lastHudSignature) {
      return;
    }

    this.lastHudSignature = signature;
    this.hudSnapshot = snapshot;
    this.renderHud();
  }

  private renderHud(): void {
    const mission = this.sessionSnapshot.currentMission;
    const tank = this.hudSnapshot?.tank ?? {
      health: this.sessionSnapshot.tankStats.maxHealth,
      maxHealth: this.sessionSnapshot.tankStats.maxHealth,
      shield: this.sessionSnapshot.tankStats.shieldMax,
      shieldMax: this.sessionSnapshot.tankStats.shieldMax,
      armor: this.sessionSnapshot.tankStats.armor,
      speed: 0,
      reloadPercent: 1,
      secondaryPercent: 1,
      specialPercent: 1,
      ammo: this.sessionSnapshot.tankStats.ammoCapacity,
      ammoCapacity: this.sessionSnapshot.tankStats.ammoCapacity,
      repairCharges: this.sessionSnapshot.tankStats.repairCharges,
    };
    const hud: HudSnapshot = this.hudSnapshot ?? {
      phase: 'standby',
      missionName: mission.codename,
      missionIndex: this.sessionSnapshot.currentMissionIndex + 1,
      totalMissions: this.sessionSnapshot.missions.length,
      objective: mission.objective,
      progressText: 'Awaiting deployment order',
      enemyCount: { alive: 0, total: mission.enemies.length + (mission.boss ? 1 : 0) },
      totalScore: this.sessionSnapshot.totalScore,
      scrap: this.sessionSnapshot.scrap,
      credits: this.sessionSnapshot.credits,
      tank,
      weapon: {
        id: this.sessionSnapshot.selectedWeapon,
        label: WEAPONS[this.sessionSnapshot.selectedWeapon].label,
        level: this.sessionSnapshot.weaponLevels[this.sessionSnapshot.selectedWeapon] ?? 1,
        unlockedCount: this.sessionSnapshot.unlockedWeapons.length,
      },
    };

    const healthPercent = Math.max(0, (tank.health / tank.maxHealth) * 100);
    const weaponIndex = this.sessionSnapshot.unlockedWeapons.indexOf(hud.weapon.id) + 1;

    // drive the HUD's own data-phase off the session so pausing hides it behind
    // the pause panel instead of leaving a stale "live" HUD on screen
    const sessionPhase = this.sessionSnapshot.phase;
    this.hudRoot.dataset.phase = sessionPhase === 'paused'
      ? 'paused'
      : sessionPhase === 'playing' ? 'live' : 'standby';
    this.hudRoot.innerHTML = `
      <div class="hud-block hud-left tank-hud-left">
        <div class="hud-bar hud-bar-health" role="img" aria-label="Hull integrity">
          <span class="hud-bar-fill" style="width:${healthPercent}%"></span>
          <span class="hud-bar-text">${Math.max(0, Math.ceil(tank.health))}/${tank.maxHealth}</span>
        </div>
        ${tank.shieldMax > 0 ? `
          <div class="hud-bar hud-bar-shield" role="img" aria-label="Shield">
            <span class="hud-bar-fill" style="width:${Math.max(0, (tank.shield / tank.shieldMax) * 100)}%"></span>
            <span class="hud-bar-text">SHD ${Math.max(0, Math.ceil(tank.shield))}</span>
          </div>
        ` : ''}
        <div class="hud-micro">
          <span>ARM ${tank.armor.toFixed(2)}x</span>
          <span>SPD ${Math.round(tank.speed)}</span>
          <span class="hud-credits">$${hud.credits}</span>
          <span>AMMO ${tank.ammo}/${tank.ammoCapacity}</span>
          <span>RPR x${tank.repairCharges}</span>
        </div>
        ${hud.boss ? `
          <div class="hud-bar hud-bar-boss ${hud.boss.exposed ? 'is-exposed' : ''}">
            <span class="hud-bar-fill" style="width:${Math.max(0, (hud.boss.health / hud.boss.maxHealth) * 100)}%"></span>
            <span class="hud-bar-text">${hud.boss.name}${hud.boss.exposed ? ' - Weak Point' : ''}</span>
          </div>
        ` : ''}
      </div>
      <div class="hud-block hud-top tank-hud-top">
        <button type="button" class="hud-settings-button" data-pause aria-label="Pause and open mission info">
          <span aria-hidden="true">II</span>
        </button>
      </div>
      <div class="hud-block hud-right tank-hud-right">
        <div class="hud-micro hud-micro-right">
          <span>M ${hud.missionIndex}/${hud.totalMissions}</span>
          <span>HOSTILES ${hud.enemyCount.alive}/${hud.enemyCount.total}</span>
          <span>${hud.totalScore.toLocaleString()}</span>
        </div>
        <div class="hud-progress-line">${hud.progressText}</div>
        <div class="cooldown-strip cooldown-strip-slim">
          <span style="--fill:${Math.round(tank.secondaryPercent * 100)}%">${hud.weapon.label} L${hud.weapon.level}${hud.weapon.unlockedCount > 1 ? ` ${weaponIndex}/${hud.weapon.unlockedCount}` : ''}</span>
          <span style="--fill:${Math.round(tank.specialPercent * 100)}%">Strike</span>
        </div>
      </div>
    `;
  }

  private renderOverlay(): void {
    const snapshot = this.sessionSnapshot;

    // addScore/addCredits emit on every kill and every coin, so without this
    // guard a firefight rebuilt the whole overlay dozens of times a second.
    // While playing the overlay renders nothing, so live wallet/score churn must
    // not count as a change - otherwise every coin rebuilds an empty overlay.
    const live = snapshot.phase === 'playing';
    const signature = JSON.stringify({
      phase: snapshot.phase,
      mission: snapshot.currentMissionIndex,
      credits: live ? 0 : snapshot.credits,
      score: live ? 0 : snapshot.totalScore,
      failure: snapshot.failureReason,
      view: this.intermissionView,
      cls: this.selectedClass,
      difficulty: this.selectedDifficulty,
      completed: snapshot.completedMissions,
      weapon: snapshot.selectedWeapon,
      shop: live ? '' : snapshot.shop.map((entry) => `${entry.id}:${entry.level}:${entry.owned}:${entry.affordable}`),
    });
    if (signature === this.lastOverlaySignature) {
      return;
    }

    this.lastOverlaySignature = signature;
    this.overlayRoot.innerHTML = this.getOverlayMarkup(snapshot);

    const difficultyButtons = this.overlayRoot.querySelectorAll<HTMLButtonElement>('button[data-difficulty]');
    for (const button of difficultyButtons) {
      const difficulty = this.asDifficultyMode(button.dataset.difficulty);
      button.classList.toggle('is-selected', difficulty === this.selectedDifficulty);
      button.addEventListener('click', () => {
        this.selectedDifficulty = difficulty;
        this.renderOverlay();
      });
    }

    const startButtons = this.overlayRoot.querySelectorAll<HTMLButtonElement>('button[data-start]');
    for (const button of startButtons) {
      button.addEventListener('click', () => {
        this.startMusic?.();
        this.playSfx?.('deploy', 0.9);
        this.director.startCampaign(this.selectedClass, this.selectedDifficulty);
      });
    }

    const classButtons = this.overlayRoot.querySelectorAll<HTMLButtonElement>('button[data-class]');
    for (const button of classButtons) {
      button.addEventListener('click', () => {
        this.selectedClass = button.dataset.class as PlayerClassId;
        this.renderOverlay();
      });
    }

    const buyButtons = this.overlayRoot.querySelectorAll<HTMLButtonElement>('button[data-buy]');
    for (const button of buyButtons) {
      button.addEventListener('click', () => {
        if (this.director.buyShopItem(button.dataset.buy as ShopItemId | WeaponId)) {
          this.playSfx?.('upgrade', 0.85);
        }
      });
    }

    const openShopButtons = this.overlayRoot.querySelectorAll<HTMLButtonElement>('button[data-open-shop]');
    for (const button of openShopButtons) {
      button.addEventListener('click', () => {
        this.intermissionView = 'shop';
        this.renderOverlay();
      });
    }

    const closeShopButtons = this.overlayRoot.querySelectorAll<HTMLButtonElement>('button[data-close-shop]');
    for (const button of closeShopButtons) {
      button.addEventListener('click', () => {
        this.intermissionView = 'summary';
        this.renderOverlay();
      });
    }

    const deployButtons = this.overlayRoot.querySelectorAll<HTMLButtonElement>('button[data-deploy]');
    for (const button of deployButtons) {
      button.addEventListener('click', () => {
        this.startMusic?.();
        this.playSfx?.('deploy', 0.9);
        this.director.advanceToNextMission();
      });
    }

    const resumeButtons = this.overlayRoot.querySelectorAll<HTMLButtonElement>('button[data-resume]');
    for (const button of resumeButtons) {
      button.addEventListener('click', () => this.director.resumeGame());
    }

    const continueButtons = this.overlayRoot.querySelectorAll<HTMLButtonElement>('button[data-continue-mission]');
    for (const button of continueButtons) {
      button.addEventListener('click', () => {
        const missionIndex = Number(button.dataset.continueMission);
        this.startMusic?.();
        this.playSfx?.('deploy', 0.9);
        this.director.continueFromMission(missionIndex);
      });
    }
  }

  private asDifficultyMode(value: string | undefined): DifficultyMode {
    if (value === 'easy' || value === 'hard' || value === 'extreme') {
      return value;
    }

    return 'normal';
  }

  private renderClassSelector(): string {
    const order: PlayerClassId[] = ['rifleman', 'rocketeer', 'light', 'medium', 'heavy'];
    return `
      <div class="class-panel" aria-label="Choose your unit">
        <span>Choose Your Unit</span>
        <div class="class-grid">
          ${order.map((id) => {
            const spec = PLAYER_CLASSES[id];
            return `
              <button type="button" class="class-card ${id === this.selectedClass ? 'is-selected' : ''}" data-class="${id}">
                <strong>${spec.label}</strong>
                <small>${spec.description}</small>
                <span class="class-stats">
                  HP ${spec.stats.maxHealth} &middot; SHD ${spec.stats.shieldMax} &middot; SPD ${spec.stats.engine}
                </span>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  private renderShop(snapshot: SessionSnapshot): string {
    const statEntries = snapshot.shop.filter((entry) => entry.kind === 'stat');
    const chassisEntry = snapshot.shop.find((entry) => entry.kind === 'chassis');
    const unit = PLAYER_CLASSES[snapshot.playerClass];
    const weaponGroups: Array<{ title: string; subtitle: string; ids: Array<ShopItemId | WeaponId> }> = [
      { title: 'Gun', subtitle: 'Rifles and precision arms', ids: ['rifle', 'shotgun', 'sniper', 'laser'] },
      { title: 'Rocket', subtitle: 'Launchers and explosives', ids: ['rocket', 'launcher', 'mortar', 'homing', 'gasBomb'] },
      {
        title: unit.infantry ? 'Heavy Weapon' : 'Main Turret',
        subtitle: unit.infantry ? 'Portable high-impact weapons' : 'Tank cannon systems',
        ids: ['damage', 'railgun', 'scattergun'],
      },
      { title: 'Machine Gun', subtitle: 'Rapid and close-range fire', ids: ['machineGun', 'autocannon', 'flamer'] },
    ];
    const statRows: ShopItemId[][] = [
      ['armor', 'shield'],
      ['engine', 'reload'],
      ['capacity'],
      ['repair'],
    ];

    return `
      <div class="shop-panel">
        <div class="shop-head">
          <span>Field Depot Loadout</span>
          <strong class="shop-wallet">$${snapshot.credits}</strong>
        </div>
        <div class="shop-loadout">
          <section class="shop-column shop-weapons" aria-label="Weapon upgrades">
            <div class="shop-column-heading">
              <span>Left Rack</span>
              <strong>Weapons</strong>
            </div>
            <div class="shop-weapon-matrix">
              ${weaponGroups.map((group) => {
                const entries = snapshot.shop.filter((entry) => group.ids.some((id) => id === entry.id));
                return `
                  <div class="shop-weapon-group">
                    <div class="shop-group-title">
                      <strong>${group.title}</strong>
                      <small>${group.subtitle}</small>
                    </div>
                    <div class="shop-stack">
                      ${entries.length > 0
                        ? entries.map((entry) => this.renderShopButton(entry, true)).join('')
                        : '<span class="shop-empty">Locked by campaign progress</span>'}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </section>

          <section class="shop-unit-bay" aria-label="Current selected unit">
            <span class="shop-unit-kicker">Current Selected Unit</span>
            <div class="shop-unit-visual" data-unit="${snapshot.playerClass}">
              ${this.renderUnitSilhouette(snapshot.playerClass)}
            </div>
            <div class="shop-unit-name">
              <strong>${unit.label}</strong>
              <span>${unit.infantry ? 'Soldier platform' : `Tank chassis · Tier ${unit.tier}`}</span>
            </div>
            <div class="shop-unit-stats">
              <span><b>${snapshot.tankStats.maxHealth}</b> HP</span>
              <span><b>${snapshot.tankStats.shieldMax}</b> Shield</span>
              <span><b>${Math.round(snapshot.tankStats.engine)}</b> Speed</span>
              <span><b>${snapshot.tankStats.ammoCapacity}</b> Ammo</span>
            </div>
            <div class="shop-chassis-slot">
              ${chassisEntry
                ? this.renderShopButton(chassisEntry)
                : '<div class="shop-max-chassis"><strong>Maximum Chassis</strong><small>Heavy platform fully fitted</small></div>'}
            </div>
          </section>

          <section class="shop-column shop-systems" aria-label="Vehicle and soldier upgrades">
            <div class="shop-column-heading">
              <span>Right Rack</span>
              <strong>Systems</strong>
            </div>
            <div class="shop-system-rows">
              ${statRows.map((ids) => `
                <div class="shop-system-row ${ids.length === 1 ? 'is-single' : ''}">
                  ${ids.map((id) => {
                    const entry = statEntries.find((candidate) => candidate.id === id);
                    return entry ? this.renderShopButton(entry, true, this.getShopStatValue(id, snapshot)) : '';
                  }).join('')}
                </div>
              `).join('')}
            </div>
          </section>
        </div>
      </div>
    `;
  }

  private renderShopButton(entry: ShopEntry, compact = false, currentValue?: string): string {
    return `
      <button type="button" class="shop-card ${compact ? 'is-compact' : ''} ${entry.owned ? 'is-owned' : ''} ${entry.maxed ? 'is-maxed' : ''}"
              data-buy="${entry.id}" ${entry.maxed || !entry.affordable ? 'disabled' : ''}>
        <span class="shop-card-topline">
          <strong>${entry.label}</strong>
          <em>Lv ${entry.level}/${entry.maxLevel}</em>
        </span>
        ${currentValue ? `<span class="shop-current-value">${currentValue}</span>` : ''}
        <small>${entry.description}</small>
        <span class="shop-price">
          ${entry.maxed
            ? 'MAXIMUM'
            : `$${entry.price} &middot; ${entry.owned || entry.kind === 'chassis' ? 'Upgrade' : 'Buy'}`}
        </span>
      </button>
    `;
  }

  private getShopStatValue(id: ShopItemId, snapshot: SessionSnapshot): string {
    const stats = snapshot.tankStats;
    if (id === 'armor') {
      return `${stats.maxHealth} HP · ${stats.armor.toFixed(2)}x armor`;
    }
    if (id === 'shield') {
      return `${stats.shieldMax} shield · +${stats.shieldRegen.toFixed(1)}/s`;
    }
    if (id === 'engine') {
      return `${Math.round(stats.engine)} movement speed`;
    }
    if (id === 'reload') {
      return `${(stats.reloadMs / 1000).toFixed(2)}s auto-load cycle`;
    }
    if (id === 'damage') {
      return `${stats.shellDamage} power · ${Math.round(stats.shellSpeed)} velocity`;
    }
    if (id === 'capacity') {
      return `${stats.ammoCapacity} trigger pulls`;
    }
    if (id === 'repair') {
      return `${stats.repairCharges} field charges`;
    }
    return '';
  }

  private renderUnitSilhouette(playerClass: PlayerClassId): string {
    if (PLAYER_CLASSES[playerClass].infantry) {
      const launcher = playerClass === 'rocketeer';
      return `
        <svg viewBox="0 0 240 190" role="img" aria-label="${PLAYER_CLASSES[playerClass].label} silhouette">
          <ellipse class="unit-shadow" cx="120" cy="166" rx="53" ry="12" />
          <circle class="unit-accent" cx="120" cy="48" r="22" />
          <path class="unit-body" d="M92 73 Q120 61 148 73 L158 124 Q145 143 120 144 Q95 143 82 124 Z" />
          <path class="unit-limb" d="M98 137 L82 168 L101 168 L120 143 L139 168 L158 168 L142 137 Z" />
          <path class="unit-limb" d="M88 84 L55 121 L68 132 L104 103 M151 83 L175 110 L164 124 L137 101" />
          ${launcher
            ? '<rect class="unit-weapon" x="133" y="76" width="78" height="19" rx="7" /><rect class="unit-detail" x="180" y="70" width="20" height="31" rx="4" />'
            : '<rect class="unit-weapon" x="126" y="99" width="82" height="10" rx="3" /><rect class="unit-detail" x="145" y="107" width="18" height="22" rx="3" />'}
          <path class="unit-highlight" d="M103 77 Q120 70 137 77" />
        </svg>
      `;
    }

    const isMini = playerClass === 'rocketeer';
    const isLight = playerClass === 'light';
    const isHeavy = playerClass === 'heavy';
    const hullLeft = isMini ? 56 : isLight ? 46 : isHeavy ? 25 : 34;
    const hullRight = isMini ? 184 : isLight ? 194 : isHeavy ? 215 : 206;
    const trackHeight = isMini ? 21 : isLight ? 25 : isHeavy ? 38 : 31;
    const turretWidth = isMini ? 64 : isLight ? 76 : isHeavy ? 118 : 96;
    const barrelWidth = isMini ? 48 : isHeavy ? 72 : 62;
    return `
      <svg viewBox="0 0 240 190" role="img" aria-label="${PLAYER_CLASSES[playerClass].label} silhouette">
        <ellipse class="unit-shadow" cx="120" cy="159" rx="102" ry="15" />
        <rect class="unit-track" x="${hullLeft - 7}" y="${132 - trackHeight / 2}" width="${hullRight - hullLeft + 14}" height="${trackHeight}" rx="${trackHeight / 2}" />
        <path class="unit-body" d="M${hullLeft} 121 L${hullLeft + 25} 92 L${hullRight - 32} 88 L${hullRight} 119 L${hullRight - 18} 143 L${hullLeft + 16} 143 Z" />
        <rect class="unit-detail" x="${hullLeft + 11}" y="127" width="${hullRight - hullLeft - 22}" height="7" rx="3" />
        <path class="unit-accent" d="M${120 - turretWidth / 2} 91 L${120 - turretWidth * 0.34} 65 L${120 + turretWidth * 0.35} 62 L${120 + turretWidth / 2} 89 L${120 + turretWidth * 0.36} 108 L${120 - turretWidth * 0.4} 108 Z" />
        <rect class="unit-weapon" x="${120 + turretWidth * 0.3}" y="76" width="${barrelWidth}" height="${isHeavy ? 13 : 9}" rx="4" />
        ${isHeavy ? '<rect class="unit-armor" x="48" y="99" width="28" height="25" rx="4" /><rect class="unit-armor" x="164" y="95" width="31" height="27" rx="4" />' : ''}
        <circle class="unit-highlight" cx="120" cy="80" r="8" />
      </svg>
    `;
  }

  private renderDifficultySelector(): string {
    const modes: Array<{ id: DifficultyMode; label: string; note: string }> = [
      { id: 'easy', label: 'Easy', note: 'More armor' },
      { id: 'normal', label: 'Normal', note: 'Balanced' },
      { id: 'hard', label: 'Hard', note: 'Less HP' },
      { id: 'extreme', label: 'Extreme', note: 'Sharp hits' },
    ];

    return `
      <div class="difficulty-panel" aria-label="Difficulty">
        <span>Choose Difficulty</span>
        <div class="difficulty-grid">
          ${modes.map((mode) => `
            <button type="button" class="difficulty-button" data-difficulty="${mode.id}">
              <strong>${mode.label}</strong>
              <small>${mode.note}</small>
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  private renderIntel(): void {
    const snapshot = this.sessionSnapshot;

    // The intel grid lists every mission and weapon; it only changes when the
    // campaign moves on, never because the score ticked.
    const signature = `${snapshot.currentMissionIndex}|${snapshot.missions.length}|${snapshot.unlockedWeapons.join(',')}`;
    if (signature === this.lastIntelSignature) {
      return;
    }

    this.lastIntelSignature = signature;
    this.intelRoot.innerHTML = `
      <article class="intel-card">
        <span class="intel-kicker">Tank Loop</span>
        <h3>Drive, Angle, Fire</h3>
        <p>Move with weight, aim the turret separately, break cover with cannon shells, and use armor facing to survive.</p>
      </article>
      <article class="intel-card">
        <span class="intel-kicker">Controls</span>
        <h3>Battle Tank Inputs</h3>
        <ul>
          <li><strong>Keyboard</strong> WASD drives, mouse aims, Space or E fires the selected weapon, X swaps it, Q calls artillery, R repairs.</li>
          <li><strong>Mobile</strong> Left stick drives. Swap chooses the active weapon; battlefield touch or the smaller right aim/fire stick immediately uses it. Artillery and repair remain separate.</li>
          <li><strong>Armor</strong> Face threats with the hull. Rear hits hurt much more than front hits.</li>
        </ul>
      </article>
      <article class="intel-card">
        <span class="intel-kicker">Objectives</span>
        <h3>Mission Variety</h3>
        <ul>
          <li>Assault, defense, escort, capture, and boss missions are all represented in the campaign.</li>
          <li>Repair pads, mines, fuel barrels, concrete, and crates make the battlefield matter.</li>
        </ul>
      </article>
      <article class="intel-card">
        <span class="intel-kicker">Arsenal</span>
        <h3>Weapons Unlock As You Advance</h3>
        <ul>
          ${snapshot.missions.map((mission, index) => {
            const weapon = Object.values(WEAPONS).find((entry) => entry.unlockAtMissionIndex === index);
            if (!weapon || index === 0) {
              return '';
            }
            const owned = index <= snapshot.currentMissionIndex;
            return `<li class="${owned ? 'is-current' : ''}"><strong>${weapon.label}</strong> - ${weapon.description} <em>(${mission.codename})</em></li>`;
          }).join('')}
          <li><strong>Rocket</strong> - ${WEAPONS.rocket.description} <em>(issued at deployment)</em></li>
        </ul>
      </article>
      <article class="intel-card">
        <span class="intel-kicker">Campaign</span>
        <h3>Mission Route</h3>
        <ol>
          ${snapshot.missions.map((mission, index) => `
            <li class="${index === snapshot.currentMissionIndex ? 'is-current' : ''}">
              <strong>${mission.codename}</strong>
              <span>${mission.objective}</span>
            </li>
          `).join('')}
        </ol>
      </article>
    `;
  }

  private getOverlayMarkup(snapshot: SessionSnapshot): string {
    if (snapshot.phase === 'playing') {
      return '';
    }

    const mission = snapshot.currentMission;
    const nextMission = snapshot.nextMission;

    if (snapshot.phase === 'paused') {
      return `
        <section class="overlay-card tank-overlay-card pause-card">
          <span class="overlay-kicker">Paused - Mission ${snapshot.currentMissionIndex + 1}/${snapshot.missions.length}</span>
          <h1>${mission.codename}</h1>
          <div class="pause-grid">
            <div class="pause-panel">
              <h3>Objective</h3>
              <p>${mission.objective}</p>
              <p>${mission.briefing}</p>
            </div>
            <div class="pause-panel">
              <h3>Controls</h3>
              <ul class="pause-list">
                <li><strong>WASD</strong> drive</li>
                <li><strong>Mouse</strong> aim turret</li>
                <li><strong>Space / E</strong> fire ${WEAPONS[snapshot.selectedWeapon].label}</li>
                <li><strong>X</strong> swap weapon</li>
                <li><strong>Q</strong> artillery strike</li>
                <li><strong>R</strong> field repair</li>
                <li><strong>Esc / P</strong> pause</li>
              </ul>
            </div>
            <div class="pause-panel">
              <h3>Arsenal (${snapshot.unlockedWeapons.length})</h3>
              <ul class="pause-list">
                ${snapshot.unlockedWeapons.map((id) => `
                  <li class="${id === snapshot.selectedWeapon ? 'is-current' : ''}">
                    <strong>${WEAPONS[id].label}</strong> ${WEAPONS[id].description}
                  </li>
                `).join('')}
              </ul>
            </div>
            <div class="pause-panel">
              <h3>Tank</h3>
              <ul class="pause-list">
                <li><strong>Hull</strong> ${snapshot.tankStats.maxHealth} HP</li>
                <li><strong>Armor</strong> ${snapshot.tankStats.armor.toFixed(2)}x</li>
                <li><strong>Engine</strong> ${Math.round(snapshot.tankStats.engine)}</li>
                <li><strong>Score</strong> ${snapshot.totalScore.toLocaleString()}</li>
                <li><strong>Scrap</strong> ${snapshot.scrap}</li>
              </ul>
              <p>Angle your hull at threats - rear hits hurt far more than front hits.</p>
            </div>
          </div>
          <div class="overlay-actions">
            <button type="button" class="action-button primary" data-resume>Resume Mission</button>
          </div>
        </section>
      `;
    }

    if (snapshot.phase === 'menu') {
      return `
        <section class="overlay-card tank-overlay-card">
          <span class="overlay-kicker">Mobile Tank Prototype</span>
          <h1>Tank Game: Steel Front</h1>
          <p>
            Pilot a customizable tank through short armored missions. Drive with weight, aim the turret,
            crack destructible cover, angle your armor, and choose upgrades between fights.
          </p>
          ${this.renderClassSelector()}
          ${this.renderDifficultySelector()}
          <div class="overlay-actions">
            <button type="button" class="action-button primary" data-start>Start Campaign</button>
          </div>
          <div class="overlay-notes">
            <span>First mission: ${mission.codename}</span>
            <span>${mission.briefing}</span>
          </div>
        </section>
      `;
    }

    if (snapshot.phase === 'intermission') {
      const incomingWeapon = Object.values(WEAPONS).find(
        (weapon) => weapon.unlockAtMissionIndex === snapshot.currentMissionIndex + 1,
      );

      if (this.intermissionView === 'shop') {
        return `
          <section class="overlay-card tank-overlay-card shop-overlay-card">
            <span class="overlay-kicker">Between Missions</span>
            <h1>Field Depot</h1>
            <p>Fit the selected unit in the center bay: weapons on the left, chassis in the middle, and combat systems on the right.</p>
            ${this.renderShop(snapshot)}
            <div class="overlay-actions shop-actions">
              <button type="button" class="action-button" data-close-shop>Back to Debrief</button>
              <button type="button" class="action-button primary" data-deploy>Deploy to ${nextMission?.codename ?? 'Next Mission'}</button>
            </div>
          </section>
        `;
      }

      return `
        <section class="overlay-card tank-overlay-card">
          <span class="overlay-kicker">Mission Clear</span>
          <h1>${mission.codename} Complete</h1>
          <p>
            Score: <strong>${snapshot.totalScore.toLocaleString()}</strong>.
            Available credits: <strong>$${snapshot.credits}</strong>. Enter the depot to buy or upgrade equipment.
          </p>
          ${incomingWeapon ? `
            <p class="weapon-unlock-note">
              New weapon fitted for the next mission: <strong>${incomingWeapon.label}</strong> - ${incomingWeapon.description}
              Press <strong>X</strong> in battle to swap between weapons.
            </p>
          ` : ''}
          <div class="overlay-actions">
            <button type="button" class="action-button primary" data-open-shop>Enter Shop</button>
            <button type="button" class="action-button" data-deploy>Deploy Without Shopping</button>
          </div>
          <div class="overlay-notes">
            <span>Next: ${nextMission?.codename ?? 'Final Debrief'}</span>
            <span>${nextMission?.briefing ?? 'All enemy armor has been destroyed.'}</span>
          </div>
        </section>
      `;
    }

    if (snapshot.phase === 'gameover') {
      const failureReason = snapshot.failureReason ?? 'Mission failed';
      const highestPlayedIndex = Math.min(
        snapshot.missions.length - 1,
        Math.max(snapshot.currentMissionIndex, snapshot.completedMissions),
      );
      return `
        <section class="overlay-card tank-overlay-card failure-overlay-card">
          <span class="overlay-kicker danger">${failureReason}</span>
          <h1>Mission Failed</h1>
          <p>
            You reached ${mission.codename} with a score of
            <strong>${snapshot.totalScore.toLocaleString()}</strong>. ${this.getFailureAdvice(failureReason)}
          </p>
          <div class="mission-retry-panel" aria-label="Choose a previously played mission">
            <div class="mission-retry-heading">
              <span>Continue Campaign</span>
              <small>Your unit, weapons, upgrades, credits, and score are preserved.</small>
            </div>
            <div class="mission-retry-grid">
              ${snapshot.missions.map((playedMission, index) => {
                const unlocked = index <= highestPlayedIndex;
                const current = index === snapshot.currentMissionIndex;
                return `
                  <button
                    type="button"
                    class="mission-retry-button ${current ? 'is-current' : ''}"
                    ${unlocked ? `data-continue-mission="${index}"` : 'disabled'}
                    aria-label="${unlocked ? `${current ? 'Retry' : 'Continue from'} mission ${index + 1}: ${playedMission.codename}` : `Mission ${index + 1} locked`}"
                  >
                    <span>${unlocked ? `Mission ${index + 1}` : `Locked ${index + 1}`}</span>
                    <strong>${unlocked ? playedMission.codename : 'Not Reached'}</strong>
                    <small>${current ? 'Retry failed stage' : unlocked ? 'Previously played' : 'Complete earlier stages'}</small>
                  </button>
                `;
              }).join('')}
            </div>
          </div>
          ${this.renderDifficultySelector()}
          <div class="overlay-actions">
            <button type="button" class="action-button" data-start>Start New Campaign</button>
          </div>
        </section>
      `;
    }

    return `
      <section class="overlay-card tank-overlay-card">
        <span class="overlay-kicker success">Campaign Clear</span>
        <h1>Steel Front Secured</h1>
        <p>
          Final score: <strong>${snapshot.totalScore.toLocaleString()}</strong>.
          The full prototype route is complete: assault, defense, escort, capture, boss, upgrades, and Android packaging.
        </p>
        ${this.renderDifficultySelector()}
        <div class="overlay-actions">
          <button type="button" class="action-button primary" data-start>Run Again</button>
        </div>
      </section>
    `;
  }

  private getFailureAdvice(reason: string): string {
    if (reason.toLowerCase().includes('convoy')) {
      return 'Convoy carriers must be stopped before the escape warning expires. Chase the beige carriers first and use rockets or artillery when they are near the exit road.';
    }

    if (reason.toLowerCase().includes('escort')) {
      return 'Stay close enough to keep the truck moving, but block incoming fire with your hull and clear ambush tanks early.';
    }

    return 'Face threats with your front armor, use cover between reloads, and save artillery for clustered armor.';
  }
}
