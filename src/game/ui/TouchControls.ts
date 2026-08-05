import { GameDirector } from '../core/GameDirector';
import { VirtualGamepad, type GameAction } from '../core/VirtualGamepad';
import type { HudSnapshot, SessionPhase } from '../types';

type TouchButtonAction = Extract<GameAction, 'fire' | 'secondary' | 'special' | 'repair' | 'switchWeapon'>;

function isTouchButtonAction(value: string | undefined): value is TouchButtonAction {
  return value === 'fire' || value === 'secondary' || value === 'special' || value === 'repair' || value === 'switchWeapon';
}

export class TouchControlsOverlay {
  private readonly root: HTMLElement;
  private readonly gamepad: VirtualGamepad;
  private readonly driveZone: HTMLElement;
  private readonly driveKnob: HTMLElement;
  private readonly aimZone: HTMLElement;
  private readonly aimKnob: HTMLElement;
  private readonly specialButton: HTMLButtonElement | null;
  private readonly repairButton: HTMLButtonElement | null;
  private readonly secondaryButton: HTMLButtonElement | null;
  private readonly swapButton: HTMLButtonElement | null;
  private readonly buttonResetters: Array<() => void> = [];
  private readonly touchQuery = window.matchMedia('(hover: none), (pointer: coarse)');
  private currentPhase: SessionPhase = 'menu';

  constructor(root: HTMLElement, director: GameDirector, gamepad: VirtualGamepad) {
    this.root = root;
    this.gamepad = gamepad;
    this.root.innerHTML = `
      <div class="touch-controls tank-touch-controls">
        <div class="touch-cluster touch-cluster-left">
          <div class="touch-stick-shell tank-drive-stick" data-drive-zone data-engaged="false">
            <div class="touch-stick-ring"></div>
            <div class="touch-stick-knob" data-drive-knob></div>
            <span class="touch-stick-keys">WASD</span>
            <span class="touch-stick-label">Drive</span>
          </div>
        </div>
        <div class="touch-cluster tank-aim-cluster">
          <div class="touch-stick-shell tank-aim-stick" data-aim-zone data-engaged="false">
            <div class="touch-stick-ring"></div>
            <div class="touch-stick-knob" data-aim-knob></div>
            <span class="touch-stick-keys">Mouse</span>
            <span class="touch-stick-label">Aim</span>
          </div>
        </div>
        <div class="touch-cluster touch-cluster-right">
          <div class="touch-action-grid tank-action-grid">
            <button type="button" class="touch-button touch-button-fire" data-action="fire">
              <strong>Fire</strong>
              <span class="key-hint">Space</span>
            </button>
            <button type="button" class="touch-button" data-action="secondary">
              <strong data-weapon-label>Rocket</strong>
              <span class="key-hint">E</span>
            </button>
            <button type="button" class="touch-button touch-button-special" data-action="special">
              <strong>Strike</strong>
              <span class="key-hint">Q</span>
              <span class="action-detail" data-special-detail></span>
            </button>
            <button type="button" class="touch-button" data-action="repair">
              <strong>Repair</strong>
              <span class="key-hint">R</span>
              <span class="action-detail" data-repair-detail></span>
            </button>
            <button type="button" class="touch-button" data-action="switchWeapon" hidden data-swap-button>
              <strong>Swap</strong>
              <span class="key-hint">X</span>
              <span class="action-detail" data-swap-detail></span>
            </button>
          </div>
        </div>
      </div>
    `;

    const driveZone = this.root.querySelector<HTMLElement>('[data-drive-zone]');
    const driveKnob = this.root.querySelector<HTMLElement>('[data-drive-knob]');
    const aimZone = this.root.querySelector<HTMLElement>('[data-aim-zone]');
    const aimKnob = this.root.querySelector<HTMLElement>('[data-aim-knob]');
    if (!driveZone || !driveKnob || !aimZone || !aimKnob) {
      throw new Error('Tank touch controls failed to initialize.');
    }

    this.driveZone = driveZone;
    this.driveKnob = driveKnob;
    this.aimZone = aimZone;
    this.aimKnob = aimKnob;
    this.specialButton = this.root.querySelector<HTMLButtonElement>('button[data-action="special"]');
    this.repairButton = this.root.querySelector<HTMLButtonElement>('button[data-action="repair"]');
    this.secondaryButton = this.root.querySelector<HTMLButtonElement>('button[data-action="secondary"]');
    this.swapButton = this.root.querySelector<HTMLButtonElement>('button[data-action="switchWeapon"]');

    this.bindStick(this.driveZone, this.driveKnob, 'drive');
    this.bindStick(this.aimZone, this.aimKnob, 'aim');
    this.bindButtons();
    window.addEventListener('resize', this.syncVisibility);
    this.syncVisibility();

    director.subscribe((snapshot) => {
      this.currentPhase = snapshot.phase;
      this.applyVisibility();
    });
  }

  setHud(snapshot: HudSnapshot): void {
    const specialDetail = this.specialButton?.querySelector<HTMLElement>('[data-special-detail]');
    const repairDetail = this.repairButton?.querySelector<HTMLElement>('[data-repair-detail]');

    if (this.specialButton && specialDetail) {
      const ready = snapshot.tank.specialPercent >= 1;
      specialDetail.textContent = ready ? 'Ready' : `${Math.round(snapshot.tank.specialPercent * 100)}%`;
      this.specialButton.dataset.cooldown = ready ? 'false' : 'true';
    }

    if (this.repairButton && repairDetail) {
      repairDetail.textContent = `x${snapshot.tank.repairCharges}`;
      this.repairButton.dataset.cooldown = snapshot.tank.repairCharges > 0 ? 'false' : 'true';
    }

    const weaponLabel = this.secondaryButton?.querySelector<HTMLElement>('[data-weapon-label]');
    if (weaponLabel) {
      weaponLabel.textContent = snapshot.weapon.label;
    }
    if (this.secondaryButton) {
      this.secondaryButton.dataset.cooldown = snapshot.tank.secondaryPercent >= 1 ? 'false' : 'true';
    }

    // the swap button only earns its space once a second weapon exists
    if (this.swapButton) {
      const swapDetail = this.swapButton.querySelector<HTMLElement>('[data-swap-detail]');
      this.swapButton.hidden = snapshot.weapon.unlockedCount <= 1;
      if (swapDetail) {
        swapDetail.textContent = `x${snapshot.weapon.unlockedCount}`;
      }
    }
  }

  private readonly syncVisibility = (): void => {
    const touchLayout = this.touchQuery.matches || window.navigator.maxTouchPoints > 0 || window.innerWidth <= 1100;
    document.body.dataset.touchMode = touchLayout ? 'true' : 'false';
    this.root.dataset.active = 'true';
    this.root.dataset.mode = touchLayout ? 'touch' : 'desktop';
    this.applyVisibility();
  };

  private applyVisibility(): void {
    const visible = this.root.dataset.active === 'true' && this.currentPhase === 'playing';
    this.root.hidden = !visible;
    this.root.setAttribute('aria-hidden', String(!visible));

    if (!visible) {
      this.resetInputs();
    }
  }

  private bindStick(zone: HTMLElement, knob: HTMLElement, mode: 'drive' | 'aim'): void {
    let pointerId: number | null = null;

    const releaseStick = (event?: PointerEvent): void => {
      if (event && event.pointerId !== pointerId) {
        return;
      }

      if (event) {
        event.preventDefault();
        if (pointerId !== null && zone.hasPointerCapture(pointerId)) {
          zone.releasePointerCapture(pointerId);
        }
      }

      pointerId = null;
      if (mode === 'drive') {
        this.gamepad.setDriveAxis(0, 0);
      } else {
        this.gamepad.clearAimAxis();
      }

      zone.dataset.engaged = 'false';
      knob.style.setProperty('--stick-x', '0px');
      knob.style.setProperty('--stick-y', '0px');
    };

    const updateStick = (event: PointerEvent): void => {
      const rect = zone.getBoundingClientRect();
      const centerX = rect.left + rect.width * 0.5;
      const centerY = rect.top + rect.height * 0.5;
      const maxRadius = Math.min(rect.width, rect.height) * 0.32;
      const rawX = event.clientX - centerX;
      const rawY = event.clientY - centerY;
      const distance = Math.hypot(rawX, rawY);
      const scale = distance > maxRadius && distance > 0 ? maxRadius / distance : 1;
      const knobX = rawX * scale;
      const knobY = rawY * scale;

      knob.style.setProperty('--stick-x', `${knobX}px`);
      knob.style.setProperty('--stick-y', `${knobY}px`);

      if (mode === 'drive') {
        this.gamepad.setDriveAxis(knobX / maxRadius, knobY / maxRadius);
      } else {
        this.gamepad.setAimAxis(knobX / maxRadius, knobY / maxRadius);
      }
    };

    zone.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      pointerId = event.pointerId;
      zone.dataset.engaged = 'true';
      zone.setPointerCapture(event.pointerId);
      updateStick(event);
    });

    zone.addEventListener('pointermove', (event) => {
      if (event.pointerId !== pointerId) {
        return;
      }

      event.preventDefault();
      updateStick(event);
    });

    zone.addEventListener('pointerup', releaseStick);
    zone.addEventListener('pointercancel', releaseStick);
    zone.addEventListener('lostpointercapture', () => {
      if (pointerId !== null) {
        releaseStick();
      }
    });
    zone.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  private bindButtons(): void {
    const buttons = this.root.querySelectorAll<HTMLButtonElement>('button[data-action]');
    for (const button of buttons) {
      const action = button.dataset.action;
      if (!isTouchButtonAction(action)) {
        continue;
      }

      this.buttonResetters.push(this.bindButton(button, action));
    }
  }

  private bindButton(button: HTMLButtonElement, action: TouchButtonAction): () => void {
    let pointerId: number | null = null;

    const release = (event?: PointerEvent): void => {
      if (event && event.pointerId !== pointerId) {
        return;
      }

      if (event) {
        event.preventDefault();
        if (pointerId !== null && button.hasPointerCapture(pointerId)) {
          button.releasePointerCapture(pointerId);
        }
      }

      pointerId = null;
      button.dataset.pressed = 'false';
      this.gamepad.setAction(1, action, false);
    };

    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      pointerId = event.pointerId;
      button.dataset.pressed = 'true';
      button.setPointerCapture(event.pointerId);
      this.gamepad.setAction(1, action, true);
    });
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', () => {
      if (pointerId !== null) {
        release();
      }
    });
    button.addEventListener('click', (event) => event.preventDefault());
    button.addEventListener('contextmenu', (event) => event.preventDefault());

    return () => {
      pointerId = null;
      button.dataset.pressed = 'false';
      this.gamepad.setAction(1, action, false);
    };
  }

  private resetInputs(): void {
    this.driveZone.dataset.engaged = 'false';
    this.aimZone.dataset.engaged = 'false';
    this.driveKnob.style.setProperty('--stick-x', '0px');
    this.driveKnob.style.setProperty('--stick-y', '0px');
    this.aimKnob.style.setProperty('--stick-x', '0px');
    this.aimKnob.style.setProperty('--stick-y', '0px');
    for (const reset of this.buttonResetters) {
      reset();
    }
    this.gamepad.resetAll();
  }
}
