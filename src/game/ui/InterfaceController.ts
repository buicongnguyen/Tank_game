import { GameDirector } from '../core/GameDirector';
import { WEAPONS } from '../data/weapons';
import { PLAYER_CLASSES } from '../data/playerClasses';
import type { TankSfxCue } from '../audio/BattleMusic';
import type { DifficultyMode, HudSnapshot, PlayerClassId, SessionSnapshot, ShopItemId, WeaponId } from '../types';

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
  private selectedDifficulty: DifficultyMode = 'normal';
  private selectedClass: PlayerClassId = 'medium';

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
      this.sessionSnapshot = snapshot;
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
          <span style="--fill:${Math.round(tank.reloadPercent * 100)}%">Cannon</span>
          <span style="--fill:${Math.round(tank.secondaryPercent * 100)}%">${hud.weapon.label}${hud.weapon.unlockedCount > 1 ? ` ${weaponIndex}/${hud.weapon.unlockedCount}` : ''}</span>
          <span style="--fill:${Math.round(tank.specialPercent * 100)}%">Strike</span>
        </div>
      </div>
    `;
  }

  private renderOverlay(): void {
    const snapshot = this.sessionSnapshot;
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
        this.playSfx?.('upgrade', 0.85);
        this.director.buyShopItem(button.dataset.buy as ShopItemId | WeaponId);
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
    const groups: Array<{ title: string; kind: 'chassis' | 'stat' | 'weapon' }> = [
      { title: 'Chassis', kind: 'chassis' },
      { title: 'Upgrades', kind: 'stat' },
      { title: 'Weapons', kind: 'weapon' },
    ];

    return `
      <div class="shop-panel">
        <div class="shop-head">
          <span>Field Depot</span>
          <strong class="shop-wallet">$${snapshot.credits}</strong>
        </div>
        ${groups.map((group) => {
          const entries = snapshot.shop.filter((entry) => entry.kind === group.kind);
          if (entries.length === 0) {
            return '';
          }
          return `
            <div class="shop-group">
              <h4>${group.title}</h4>
              <div class="shop-grid">
                ${entries.map((entry) => `
                  <button type="button" class="shop-card ${entry.owned ? 'is-owned' : ''}"
                          data-buy="${entry.id}" ${entry.owned || !entry.affordable ? 'disabled' : ''}>
                    <strong>${entry.label}</strong>
                    <small>${entry.description}</small>
                    <span class="shop-price">
                      ${entry.owned
                        ? (entry.maxLevel > 1 ? `MAX (${entry.level}/${entry.maxLevel})` : 'Owned')
                        : `$${entry.price}${entry.maxLevel > 1 ? ` &middot; Lv ${entry.level}/${entry.maxLevel}` : ''}`}
                    </span>
                  </button>
                `).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
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
          <li><strong>Keyboard</strong> WASD drives, mouse aims, Space fires, E fires the sidearm, X swaps it, Q calls artillery, R repairs.</li>
          <li><strong>Mobile</strong> Left stick drives, right stick aims, buttons fire cannon, sidearm, swap, artillery, and repair.</li>
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
                <li><strong>Space</strong> cannon</li>
                <li><strong>E</strong> ${WEAPONS[snapshot.selectedWeapon].label}</li>
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
      return `
        <section class="overlay-card tank-overlay-card">
          <span class="overlay-kicker">Mission Clear</span>
          <h1>${mission.codename} Complete</h1>
          <p>
            Score: <strong>${snapshot.totalScore.toLocaleString()}</strong>.
            Salvage collected: <strong>$${snapshot.credits}</strong>. Spend it at the depot, then deploy.
          </p>
          ${incomingWeapon ? `
            <p class="weapon-unlock-note">
              New weapon fitted for the next mission: <strong>${incomingWeapon.label}</strong> - ${incomingWeapon.description}
              Press <strong>X</strong> in battle to swap between weapons.
            </p>
          ` : ''}
          ${this.renderShop(snapshot)}
          <div class="overlay-actions">
            <button type="button" class="action-button primary" data-deploy>Deploy to ${nextMission?.codename ?? 'Next Mission'}</button>
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
      return `
        <section class="overlay-card tank-overlay-card">
          <span class="overlay-kicker danger">${failureReason}</span>
          <h1>Mission Failed</h1>
          <p>
            You reached ${mission.codename} with a score of
            <strong>${snapshot.totalScore.toLocaleString()}</strong>. ${this.getFailureAdvice(failureReason)}
          </p>
          ${this.renderDifficultySelector()}
          <div class="overlay-actions">
            <button type="button" class="action-button primary" data-start>Retry Campaign</button>
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
