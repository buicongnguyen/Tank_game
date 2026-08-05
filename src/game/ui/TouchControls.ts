import { GameDirector } from '../core/GameDirector';
import { VirtualGamepad, type GameAction } from '../core/VirtualGamepad';
import type { HudSnapshot, SessionPhase } from '../types';

type TouchButtonAction = Extract<GameAction, 'fire' | 'secondary' | 'special' | 'repair' | 'switchWeapon'>;

function isTouchButtonAction(value: string | undefined): value is TouchButtonAction {
  return value === 'fire' || value === 'secondary' || value === 'special' || value === 'repair' || value === 'switchWeapon';
}

/** Travel from the stick origin, in px, that maps to a fully deflected axis. */
const STICK_RADIUS = 58;
/** Aim deflection past which the cannon starts firing on its own. */
const AUTO_FIRE_DEADZONE = 0.25;

const ICONS: Record<string, string> = {
  fire: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9.2h9V5.6l6.4 6.4L12 18.4v-3.6H3z"/></svg>',
  rocket: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12s-3.4 3-7.6 3H9.4L6.2 12l3.2-3h4C17.6 9 21 12 21 12z"/><path d="M8.6 5.4 11.4 9H8.9L6.1 6.6z"/><path d="M8.6 18.6 11.4 15H8.9l-2.8 2.4z"/><circle cx="16.4" cy="12" r="1.15" fill="#0b1209"/></svg>',
  swap: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.6h11V5.4L20 10l-5 4.6v-3.2H4z"/><path d="M20 15.4H9v3.2L4 14l5-4.6v3.2h11z"/></svg>',
  strike: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v5.4M7 3.6v4.2M17 3.6v4.2" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" fill="none"/><circle cx="12" cy="16" r="4.4" fill="none" stroke="currentColor" stroke-width="2.1"/><circle cx="12" cy="16" r="1.3"/></svg>',
  repair: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.8 3h4.4v6.8H21v4.4h-6.8V21H9.8v-6.8H3V9.8h6.8z"/></svg>',
};

interface StickBinding {
  zone: HTMLElement;
  shell: HTMLElement;
  knob: HTMLElement;
  mode: 'drive' | 'aim';
}

export class TouchControlsOverlay {
  private readonly root: HTMLElement;
  private readonly gamepad: VirtualGamepad;
  private readonly sticks: StickBinding[] = [];
  private readonly buttonResetters: Array<() => void> = [];
  private readonly specialButton: HTMLButtonElement | null;
  private readonly repairButton: HTMLButtonElement | null;
  private readonly secondaryButton: HTMLButtonElement | null;
  private readonly swapButton: HTMLButtonElement | null;
  /**
   * Strict test: the primary pointer must actually be a finger. A touch-capable
   * laptop reports `hover: hover` / `pointer: fine`, so it stays on the desktop
   * layout - important because the touch layout claims both halves of the
   * screen for the sticks and would otherwise swallow mouse aiming.
   */
  private readonly touchQuery = window.matchMedia('(hover: none) and (pointer: coarse)');
  private readonly narrowTouchQuery = window.matchMedia('(max-width: 820px) and (pointer: coarse)');
  private currentPhase: SessionPhase = 'menu';

  constructor(root: HTMLElement, director: GameDirector, gamepad: VirtualGamepad) {
    this.root = root;
    this.gamepad = gamepad;
    this.root.innerHTML = `
      <div class="touch-controls tank-touch-controls">
        <div class="touch-zone touch-zone-drive" data-zone="drive">
          <div class="touch-stick-shell tank-drive-stick" data-shell data-engaged="false">
            <div class="touch-stick-ring"></div>
            <div class="touch-stick-knob" data-knob></div>
            <span class="touch-stick-keys">WASD</span>
            <span class="touch-stick-label">Drive</span>
          </div>
        </div>
        <div class="touch-zone touch-zone-aim" data-zone="aim">
          <div class="touch-stick-shell tank-aim-stick" data-shell data-engaged="false">
            <div class="touch-stick-ring"></div>
            <div class="touch-stick-knob" data-knob></div>
            <span class="touch-stick-keys">Mouse</span>
            <span class="touch-stick-label">Aim &amp; Fire</span>
          </div>
          <span class="touch-zone-hint">Drag here to aim and fire</span>
        </div>
        <div class="touch-actions">
          <div class="touch-action-mini">
            <button type="button" class="touch-button touch-button-mini" data-action="secondary" aria-label="Secondary weapon">
              ${ICONS.rocket}
              <span class="key-hint">E</span>
              <span class="action-caption" data-weapon-label>Rocket</span>
            </button>
            <button type="button" class="touch-button touch-button-mini" data-action="switchWeapon" data-swap-button hidden aria-label="Swap weapon">
              ${ICONS.swap}
              <span class="key-hint">X</span>
              <span class="action-caption" data-swap-detail></span>
            </button>
            <button type="button" class="touch-button touch-button-mini touch-button-special" data-action="special" aria-label="Artillery strike">
              ${ICONS.strike}
              <span class="key-hint">Q</span>
              <span class="action-caption" data-special-detail></span>
            </button>
            <button type="button" class="touch-button touch-button-mini touch-button-repair" data-action="repair" aria-label="Field repair">
              ${ICONS.repair}
              <span class="key-hint">R</span>
              <span class="action-caption" data-repair-detail></span>
            </button>
          </div>
          <button type="button" class="touch-button touch-button-fire" data-action="fire" aria-label="Fire cannon">
            ${ICONS.fire}
            <span class="key-hint">Space</span>
          </button>
        </div>
      </div>
    `;

    for (const mode of ['drive', 'aim'] as const) {
      const zone = this.root.querySelector<HTMLElement>(`[data-zone="${mode}"]`);
      const shell = zone?.querySelector<HTMLElement>('[data-shell]');
      const knob = zone?.querySelector<HTMLElement>('[data-knob]');
      if (!zone || !shell || !knob) {
        throw new Error('Tank touch controls failed to initialize.');
      }

      const binding: StickBinding = { zone, shell, knob, mode };
      this.sticks.push(binding);
      this.bindStick(binding);
    }

    this.specialButton = this.root.querySelector<HTMLButtonElement>('button[data-action="special"]');
    this.repairButton = this.root.querySelector<HTMLButtonElement>('button[data-action="repair"]');
    this.secondaryButton = this.root.querySelector<HTMLButtonElement>('button[data-action="secondary"]');
    this.swapButton = this.root.querySelector<HTMLButtonElement>('button[data-action="switchWeapon"]');

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
        swapDetail.textContent = `${snapshot.weapon.unlockedCount} wpn`;
      }
    }
  }

  private readonly syncVisibility = (): void => {
    const touchLayout = this.touchQuery.matches || this.narrowTouchQuery.matches;
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

  /**
   * Sticks are dynamic: the ring is drawn wherever the thumb lands inside its
   * half of the screen rather than sitting in a fixed corner. That keeps aiming
   * comfortable across hand sizes and grips, which a small fixed pad did not.
   */
  private bindStick(binding: StickBinding): void {
    const { zone, shell, knob, mode } = binding;
    let pointerId: number | null = null;
    let originX = 0;
    let originY = 0;

    const placeShell = (x: number, y: number): void => {
      shell.style.setProperty('--origin-x', `${x}px`);
      shell.style.setProperty('--origin-y', `${y}px`);
    };

    const applyAxis = (nx: number, ny: number): void => {
      if (mode === 'drive') {
        this.gamepad.setDriveAxis(nx, ny);
        return;
      }

      this.gamepad.setAimAxis(nx, ny);
      // Twin-stick convention: pushing the aim stick shoots, so the player does
      // not have to hold a separate fire button with the same thumb.
      this.gamepad.setAction(1, 'fire', Math.hypot(nx, ny) > AUTO_FIRE_DEADZONE);
    };

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
        this.gamepad.setAction(1, 'fire', false);
      }

      shell.dataset.engaged = 'false';
      knob.style.setProperty('--stick-x', '0px');
      knob.style.setProperty('--stick-y', '0px');
    };

    const updateStick = (event: PointerEvent): void => {
      const rect = zone.getBoundingClientRect();
      const rawX = event.clientX - rect.left - originX;
      const rawY = event.clientY - rect.top - originY;
      const distance = Math.hypot(rawX, rawY);
      const scale = distance > STICK_RADIUS && distance > 0 ? STICK_RADIUS / distance : 1;
      const knobX = rawX * scale;
      const knobY = rawY * scale;

      knob.style.setProperty('--stick-x', `${knobX}px`);
      knob.style.setProperty('--stick-y', `${knobY}px`);
      applyAxis(knobX / STICK_RADIUS, knobY / STICK_RADIUS);
    };

    zone.addEventListener('pointerdown', (event) => {
      if (pointerId !== null) {
        return;
      }

      event.preventDefault();
      pointerId = event.pointerId;
      const rect = zone.getBoundingClientRect();
      originX = event.clientX - rect.left;
      originY = event.clientY - rect.top;
      placeShell(originX, originY);
      shell.dataset.engaged = 'true';
      try {
        zone.setPointerCapture(event.pointerId);
      } catch {
        // capture is a nicety; the window-level listeners below still release us
      }
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
      event.stopPropagation();
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
    for (const { shell, knob } of this.sticks) {
      shell.dataset.engaged = 'false';
      knob.style.setProperty('--stick-x', '0px');
      knob.style.setProperty('--stick-y', '0px');
    }
    for (const reset of this.buttonResetters) {
      reset();
    }
    this.gamepad.resetAll();
  }
}
