import { GameDirector } from '../core/GameDirector';
import { WEAPONS } from '../data/weapons';
import type { TankSfxCue } from '../audio/BattleMusic';
import type { DifficultyMode, HudSnapshot, SessionSnapshot, UpgradeId } from '../types';

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

  constructor(roots: InterfaceRoots, director: GameDirector, options: InterfaceOptions = {}) {
    this.hudRoot = roots.hudRoot;
    this.overlayRoot = roots.overlayRoot;
    this.intelRoot = roots.intelRoot;
    this.director = director;
    this.startMusic = options.startMusic;
    this.playSfx = options.playSfx;
    this.sessionSnapshot = director.getSnapshot();

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
      tank,
      weapon: {
        id: this.sessionSnapshot.selectedWeapon,
        label: WEAPONS[this.sessionSnapshot.selectedWeapon].label,
        unlockedCount: this.sessionSnapshot.unlockedWeapons.length,
      },
    };

    this.hudRoot.dataset.phase = hud.phase;
    this.hudRoot.innerHTML = `
      <div class="hud-block hud-left tank-hud-left">
        <div class="mission-chip">
          <span class="chip-kicker">Tank Game: Steel Front</span>
          <strong>${hud.missionName}</strong>
          <span>${hud.objective}</span>
        </div>
        <article class="player-card tank-card">
          <div class="player-head">
            <strong>Main Battle Tank</strong>
            <span>${Math.max(0, Math.ceil(tank.health))}/${tank.maxHealth} HP</span>
          </div>
          <div class="meter">
            <span style="width:${Math.max(0, (tank.health / tank.maxHealth) * 100)}%"></span>
          </div>
          <div class="tank-stat-grid">
            <span>Armor ${tank.armor.toFixed(2)}x</span>
            <span>Speed ${Math.round(tank.speed)}</span>
            <span>Scrap ${hud.scrap}</span>
          </div>
        </article>
      </div>
      <div class="hud-block hud-right tank-hud-right">
        <div class="status-chip">
          <span>Mission ${hud.missionIndex}/${hud.totalMissions}</span>
          <strong>${hud.progressText}</strong>
          <span>Hostiles ${hud.enemyCount.alive}/${hud.enemyCount.total}</span>
        </div>
        ${hud.boss ? `
          <div class="boss-chip">
            <div class="boss-top">
              <span>${hud.boss.exposed ? 'Weak Point Exposed' : 'Armor Plated'}</span>
              <strong>${hud.boss.name}</strong>
            </div>
            <div class="meter boss-meter">
              <span style="width:${Math.max(0, (hud.boss.health / hud.boss.maxHealth) * 100)}%"></span>
            </div>
          </div>
        ` : ''}
        <div class="cooldown-strip">
          <span style="--fill:${Math.round(tank.reloadPercent * 100)}%">Cannon</span>
          <span style="--fill:${Math.round(tank.secondaryPercent * 100)}%">${hud.weapon.label}</span>
          <span style="--fill:${Math.round(tank.specialPercent * 100)}%">Strike</span>
          <span>Repair x${tank.repairCharges}</span>
        </div>
        ${hud.weapon.unlockedCount > 1 ? `
          <div class="status-chip weapon-chip">
            <span>Weapon ${this.sessionSnapshot.unlockedWeapons.indexOf(hud.weapon.id) + 1}/${hud.weapon.unlockedCount}</span>
            <strong>${hud.weapon.label}</strong>
            <span>Press X to swap</span>
          </div>
        ` : ''}
        <div class="score-chip">
          <span>Total Score</span>
          <strong>${hud.totalScore.toLocaleString()}</strong>
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
        this.director.startCampaign(1, this.selectedDifficulty);
      });
    }

    const upgradeButtons = this.overlayRoot.querySelectorAll<HTMLButtonElement>('button[data-upgrade]');
    for (const button of upgradeButtons) {
      button.addEventListener('click', () => {
        this.startMusic?.();
        this.playSfx?.('upgrade', 0.9);
        const id = button.dataset.upgrade as UpgradeId;
        this.director.applyUpgrade(id);
      });
    }
  }

  private asDifficultyMode(value: string | undefined): DifficultyMode {
    if (value === 'easy' || value === 'hard' || value === 'extreme') {
      return value;
    }

    return 'normal';
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

    if (snapshot.phase === 'menu') {
      return `
        <section class="overlay-card tank-overlay-card">
          <span class="overlay-kicker">Mobile Tank Prototype</span>
          <h1>Tank Game: Steel Front</h1>
          <p>
            Pilot a customizable tank through short armored missions. Drive with weight, aim the turret,
            crack destructible cover, angle your armor, and choose upgrades between fights.
          </p>
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
            Scrap: <strong>${snapshot.scrap}</strong>. Pick one upgrade before the next mission.
          </p>
          ${incomingWeapon ? `
            <p class="weapon-unlock-note">
              New weapon fitted for the next mission: <strong>${incomingWeapon.label}</strong> - ${incomingWeapon.description}
              Press <strong>X</strong> in battle to swap between weapons.
            </p>
          ` : ''}
          <div class="upgrade-grid">
            ${snapshot.pendingUpgrades.map((upgrade) => `
              <button type="button" class="upgrade-card" data-upgrade="${upgrade.id}">
                <strong>${upgrade.label}</strong>
                <span>${upgrade.description}</span>
              </button>
            `).join('')}
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
