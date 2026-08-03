import { CONTROL_SCHEMES, describeControls } from '../core/ControlScheme';
import { GameDirector } from '../core/GameDirector';
import type { DifficultyMode, HudSnapshot, SessionSnapshot } from '../types';

interface InterfaceRoots {
  hudRoot: HTMLElement;
  overlayRoot: HTMLElement;
  intelRoot: HTMLElement;
}

interface InterfaceOptions {
  startMusic?: () => void;
}

export class InterfaceController {
  private readonly hudRoot: HTMLElement;
  private readonly overlayRoot: HTMLElement;
  private readonly intelRoot: HTMLElement;
  private readonly director: GameDirector;
  private readonly startMusic?: () => void;
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
    const fallbackStage = this.getPreviewStage(this.sessionSnapshot);
    const hud = this.hudSnapshot ?? {
      phase: 'standby' as const,
      stageName: fallbackStage.codename,
      stageIndex: this.sessionSnapshot.currentStageIndex + 1,
      totalStages: this.sessionSnapshot.stages.length,
      objective: fallbackStage.objective,
      encounterLabel: 'Awaiting deployment order',
      progressText: 'Standby',
      enemyCount: {
        alive: 0,
        total: fallbackStage.encounters.reduce(
          (sum, encounter) => sum + encounter.enemies.length + encounter.enemies.filter((enemy) => enemy.kind === 'zombie').length,
          0,
        ),
      },
      totalScore: this.sessionSnapshot.totalScore,
      players: [],
    };

    this.hudRoot.dataset.phase = hud.phase;
    this.hudRoot.innerHTML = `
      <div class="hud-block hud-left">
        <div class="mission-chip">
          <span class="chip-kicker">Tank Game: Steel Front</span>
          <strong>${hud.stageName}</strong>
          <span>${hud.objective}</span>
        </div>
        <div class="player-stack">
          ${hud.players.map((player) => `
            <article class="player-card ${player.alive ? '' : 'is-down'}" style="--accent:${player.accent}">
              <div class="player-head">
                <strong>${player.label}</strong>
                <span>${player.alive ? 'Active' : 'Down'}</span>
              </div>
              <div class="meter">
                <span style="width:${Math.max(0, (player.health / player.maxHealth) * 100)}%"></span>
              </div>
              <div class="player-meta">
                <span>HP ${Math.max(0, Math.ceil(player.health))}/${player.maxHealth}</span>
                <span>Air Strike x${player.bombs}</span>
              </div>
              <div class="ammo-strip" aria-label="${player.label} ammo">
                ${(player.ammo ?? []).map((weapon) => `
                  <span class="ammo-pill ${weapon.active ? 'is-active' : ''}">
                    ${weapon.label} ${weapon.ammo}
                  </span>
                `).join('')}
              </div>
            </article>
          `).join('')}
        </div>
      </div>
      <div class="hud-block hud-right">
        <div class="status-chip">
          <span>Stage ${hud.stageIndex}/${hud.totalStages}</span>
          <strong>${hud.progressText} - Enemies ${hud.enemyCount.alive}/${hud.enemyCount.total}</strong>
          <span>Enemies left in stage</span>
          <span>${hud.encounterLabel}</span>
        </div>
        ${hud.boss ? `
          <div class="boss-chip">
            <div class="boss-top">
              <span>Boss Lock</span>
              <strong>${hud.boss.name}</strong>
            </div>
            <div class="meter boss-meter">
              <span style="width:${Math.max(0, (hud.boss.health / hud.boss.maxHealth) * 100)}%"></span>
            </div>
          </div>
        ` : ''}
        ${this.sessionSnapshot.phase === 'playing' ? `
          <button type="button" class="skip-stage-button" data-skip-stage>
            Skip Stage ${hud.stageIndex}
          </button>
        ` : ''}
        <div class="score-chip">
          <span>Total Score</span>
          <strong>${hud.totalScore.toLocaleString()}</strong>
        </div>
      </div>
    `;

    const skipButton = this.hudRoot.querySelector<HTMLButtonElement>('button[data-skip-stage]');
    skipButton?.addEventListener('click', () => {
      this.startMusic?.();
      this.director.skipToNextStage();
    });
  }

  private renderOverlay(): void {
    const snapshot = this.sessionSnapshot;
    const stage = this.getPreviewStage(snapshot);
    const overlay = this.getOverlayMarkup(snapshot, stage);
    this.overlayRoot.innerHTML = overlay;

    const difficultyButtons = this.overlayRoot.querySelectorAll<HTMLButtonElement>('button[data-difficulty]');
    for (const button of difficultyButtons) {
      const difficulty = this.asDifficultyMode(button.dataset.difficulty);
      button.classList.toggle('is-selected', difficulty === this.selectedDifficulty);
      button.addEventListener('click', () => {
        this.selectedDifficulty = difficulty;
        this.renderOverlay();
      });
    }

    const buttons = this.overlayRoot.querySelectorAll<HTMLButtonElement>('button[data-players]');
    for (const button of buttons) {
      button.addEventListener('click', () => {
        this.startMusic?.();
        const players = Number(button.dataset.players) === 2 ? 2 : 1;
        if (snapshot.phase === 'intermission') {
          this.director.advanceToNextStage(players);
          return;
        }

        this.director.startCampaign(players, this.selectedDifficulty);
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
    const modes: Array<{ id: DifficultyMode; label: string; hp: number }> = [
      { id: 'easy', label: 'Easy', hp: 1000 },
      { id: 'normal', label: 'Normal', hp: 400 },
      { id: 'hard', label: 'Hard', hp: 200 },
      { id: 'extreme', label: 'Extreme', hp: 100 },
    ];

    return `
      <div class="difficulty-panel" aria-label="Difficulty">
        <span>Choose Difficulty</span>
        <div class="difficulty-grid">
          ${modes.map((mode) => `
            <button type="button" class="difficulty-button" data-difficulty="${mode.id}">
              <strong>${mode.label}</strong>
              <small>${mode.hp} HP</small>
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
        <span class="intel-kicker">Build Plan</span>
        <h3>Prototype Roadmap</h3>
        <p>Phaser runtime, local co-op controls, three stages, enemy waves, boss fights, and a DOM-first HUD.</p>
      </article>
      <article class="intel-card">
        <span class="intel-kicker">Controls</span>
        <h3>Local Squad Inputs</h3>
        <ul>
          <li><strong>${CONTROL_SCHEMES[1].callsign}</strong> ${describeControls(CONTROL_SCHEMES[1])}</li>
          <li><strong>${CONTROL_SCHEMES[2].callsign}</strong> ${describeControls(CONTROL_SCHEMES[2])}</li>
          <li><strong>Mobile</strong> Drag the left stick to move, then use the right buttons to fire, jump/roll, change gun, and call an air-strike bomb.</li>
          <li><strong>Air Strike</strong> The old Barrage button is the emergency bomb: it damages enemies in a wide circle and restocks after clearing zones.</li>
        </ul>
      </article>
      <article class="intel-card">
        <span class="intel-kicker">Genre DNA</span>
        <h3>Reference Mix</h3>
        <ul>
          <li><a href="https://en.wikipedia.org/wiki/Contra_%28video_game%29" target="_blank" rel="noreferrer">Contra</a> for simultaneous two-player stage pressure.</li>
          <li><a href="https://en.wikipedia.org/wiki/Ikari_Warriors" target="_blank" rel="noreferrer">Ikari Warriors</a> and <a href="https://en.wikipedia.org/wiki/Mercs" target="_blank" rel="noreferrer">Mercs</a> for military top-down assault flow.</li>
          <li><a href="https://www.snk-corp.co.jp/us/games/acaneogeo/metalslug/" target="_blank" rel="noreferrer">Metal Slug</a> for boss presentation and readable chaos.</li>
        </ul>
      </article>
      <article class="intel-card">
        <span class="intel-kicker">Mission Ladder</span>
        <h3>Stage Route</h3>
        <ol>
          ${snapshot.stages.map((mission, index) => `
            <li class="${index === snapshot.currentStageIndex ? 'is-current' : ''}">
              <strong>${mission.codename}</strong>
              <span>${mission.objective}</span>
            </li>
          `).join('')}
        </ol>
      </article>
    `;
  }

  private getPreviewStage(snapshot: SessionSnapshot): SessionSnapshot['currentStage'] {
    if (snapshot.phase === 'intermission' && snapshot.nextStage) {
      return snapshot.nextStage;
    }

    return snapshot.currentStage;
  }

  private getOverlayMarkup(snapshot: SessionSnapshot, stage: SessionSnapshot['currentStage']): string {
    if (snapshot.phase === 'playing') {
      return '';
    }

    if (snapshot.phase === 'menu') {
      return `
        <section class="overlay-card">
          <span class="overlay-kicker">Mobile Tank Prototype</span>
          <h1>Tank Game: Steel Front</h1>
          <p>
            This fork keeps the deployed Phaser baseline while the next milestone shifts the fantasy to armored movement, turret aim, shell impacts, destructible cover, and short mobile missions.
          </p>
          ${this.renderDifficultySelector()}
          <div class="overlay-actions">
            <button type="button" class="action-button primary" data-players="1">Start Solo</button>
            <button type="button" class="action-button" data-players="2">Start Shadow Squad</button>
          </div>
          <div class="overlay-notes">
            <span>Next up: ${stage.codename}</span>
            <span>${stage.briefing}</span>
            <span>Battle music starts after Start. On mobile, make sure silent mode is off.</span>
          </div>
        </section>
      `;
    }

    if (snapshot.phase === 'intermission') {
      return `
        <section class="overlay-card">
          <span class="overlay-kicker">Stage Clear</span>
          <h1>${snapshot.currentStage.codename} Secure</h1>
          <p>
            Score: <strong>${snapshot.totalScore.toLocaleString()}</strong>.
            Reconfigure the squad for the next insertion.
          </p>
          <div class="overlay-notes">
            <span>Next Stage: ${stage.codename}</span>
            <span>${stage.briefing}</span>
            <span>Music continues after Continue. Turn up the device volume if it is quiet.</span>
          </div>
          <div class="overlay-actions">
            <button type="button" class="action-button primary" data-players="1">Continue Solo</button>
            <button type="button" class="action-button" data-players="2">Continue Shadow Squad</button>
          </div>
        </section>
      `;
    }

    if (snapshot.phase === 'gameover') {
      return `
        <section class="overlay-card">
          <span class="overlay-kicker danger">Mission Failed</span>
          <h1>Squad Wiped</h1>
          <p>
            You reached ${snapshot.currentStage.codename} with a score of
            <strong>${snapshot.totalScore.toLocaleString()}</strong>.
            Restart the campaign and hit the route cleaner.
          </p>
          ${this.renderDifficultySelector()}
          <div class="overlay-actions">
            <button type="button" class="action-button primary" data-players="1">Retry Solo</button>
            <button type="button" class="action-button" data-players="2">Retry Shadow Squad</button>
          </div>
        </section>
      `;
    }

    return `
      <section class="overlay-card">
        <span class="overlay-kicker success">Campaign Clear</span>
        <h1>All Blacksites Neutralized</h1>
        <p>
          Final score: <strong>${snapshot.totalScore.toLocaleString()}</strong>.
          The prototype route is complete. Run it again solo or with a second commando.
        </p>
        ${this.renderDifficultySelector()}
        <div class="overlay-actions">
          <button type="button" class="action-button primary" data-players="1">Run Solo Again</button>
          <button type="button" class="action-button" data-players="2">Run Shadow Squad Again</button>
        </div>
      </section>
    `;
  }
}

