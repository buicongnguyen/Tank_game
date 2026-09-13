import { GameDirector } from '../core/GameDirector';
import { VirtualGamepad, type GameAction } from '../core/VirtualGamepad';
import type { HudSnapshot, SessionPhase } from '../types';

type TouchButtonAction = Extract<GameAction, 'fire' | 'special' | 'repair' | 'switchWeapon'>;

function isTouchButtonAction(value: string | undefined): value is TouchButtonAction {
  return value === 'fire' || value === 'special' || value === 'repair' || value === 'switchWeapon';
}

const STICK_DEAD_ZONE = 0.15;

const ICONS: Record<string, string> = {
  fire: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9.2h9V5.6l6.4 6.4L12 18.4v-3.6H3z"/></svg>',
  rocket: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12s-3.4 3-7.6 3H9.4L6.2 12l3.2-3h4C17.6 9 21 12 21 12z"/><path d="M8.6 5.4 11.4 9H8.9L6.1 6.6z"/><path d="M8.6 18.6 11.4 15H8.9l-2.8 2.4z"/><circle cx="16.4" cy="12" r="1.15" fill="#0b1209"/></svg>',
  swap: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.6h11V5.4L20 10l-5 4.6v-3.2H4z"/><path d="M20 15.4H9v3.2L4 14l5-4.6v3.2h11z"/></svg>',
  strike: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v5.4M7 3.6v4.2M17 3.6v4.2" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" fill="none"/><circle cx="12" cy="16" r="4.4" fill="none" stroke="currentColor" stroke-width="2.1"/><circle cx="12" cy="16" r="1.3"/></svg>',
  repair: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.8 3h4.4v6.8H21v4.4h-6.8V21H9.8v-6.8H3V9.8h6.8z"/></svg>',
};

interface StickBinding {
  kind: 'drive' | 'aim';
  zone: HTMLElement;
  shell: HTMLElement;
  knob: HTMLElement;
  release?: () => void;
}

export class TouchControlsOverlay {
  private readonly root: HTMLElement;
  private readonly gamepad: VirtualGamepad;
  private readonly sticks: StickBinding[] = [];
  private readonly buttonResetters: Array<() => void> = [];
  private readonly specialButton: HTMLButtonElement | null;
  private readonly repairButton: HTMLButtonElement | null;
  private readonly swapButton: HTMLButtonElement | null;
  private readonly specialDetail: HTMLElement | null;
  private readonly repairDetail: HTMLElement | null;
  private readonly swapDetail: HTMLElement | null;
  /**
   * Strict test: the primary pointer must actually be a finger. A touch-capable
   * laptop reports `hover: hover` / `pointer: fine`, so it stays on the desktop
   * layout, keeping the movement-only lower-left zone from swallowing mouse aim.
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
          <div class="touch-stick-shell tank-drive-stick" data-shell data-engaged="false" aria-label="Drive joystick">
            <div class="touch-stick-knob" data-knob></div>
            <span class="touch-stick-keys">WASD</span>
            <span class="touch-stick-label">Drive</span>
          </div>
        </div>
        <div class="touch-actions">
          <div class="touch-action-mini">
            <button type="button" class="touch-button touch-button-mini" data-action="switchWeapon" data-swap-button hidden aria-label="Swap weapon">
              ${ICONS.swap}
              <span class="touch-action-label">Swap</span>
              <span class="key-hint">X</span>
              <span class="action-caption" data-swap-detail></span>
            </button>
            <button type="button" class="touch-button touch-button-mini touch-button-special" data-action="special" aria-label="Air Strike: six guided missiles">
              ${ICONS.strike}
              <span class="touch-action-label">Strike</span>
              <span class="key-hint">Q</span>
              <span class="action-caption" data-special-detail></span>
            </button>
            <button type="button" class="touch-button touch-button-mini touch-button-repair" data-action="repair" aria-label="Field repair">
              ${ICONS.repair}
              <span class="touch-action-label">Repair</span>
              <span class="key-hint">R</span>
              <span class="action-caption" data-repair-detail></span>
            </button>
          </div>
          <div class="touch-aim-control" data-zone="aim" aria-label="Aim and fire cannon">
            <div class="touch-stick-shell tank-aim-stick" data-shell data-engaged="false">
              <div class="touch-stick-knob" data-knob></div>
              <span class="touch-stick-label">Aim / Fire</span>
            </div>
          </div>
          <button type="button" class="touch-button touch-button-fire desktop-fire-button" data-action="fire" aria-label="Fire cannon">
            ${ICONS.fire}
            <span class="touch-action-label">Fire</span>
            <span class="key-hint">Space</span>
          </button>
        </div>
      </div>
    `;

    const stickDefinitions: Array<{ selector: string; kind: StickBinding['kind'] }> = [
      { selector: '[data-zone="drive"]', kind: 'drive' },
      { selector: '[data-zone="aim"]', kind: 'aim' },
    ];
    for (const definition of stickDefinitions) {
      const zone = this.root.querySelector<HTMLElement>(definition.selector);
      const shell = zone?.querySelector<HTMLElement>('[data-shell]');
      const knob = zone?.querySelector<HTMLElement>('[data-knob]');
      if (!zone || !shell || !knob) {
        throw new Error(`Tank ${definition.kind} controls failed to initialize.`);
      }

      const binding: StickBinding = {
        kind: definition.kind,
        zone,
        shell,
        knob,
      };
      this.sticks.push(binding);
      this.bindStick(binding);
    }

    this.specialButton = this.root.querySelector<HTMLButtonElement>('button[data-action="special"]');
    this.repairButton = this.root.querySelector<HTMLButtonElement>('button[data-action="repair"]');
    this.swapButton = this.root.querySelector<HTMLButtonElement>('button[data-action="switchWeapon"]');
    this.specialDetail = this.specialButton?.querySelector<HTMLElement>('[data-special-detail]') ?? null;
    this.repairDetail = this.repairButton?.querySelector<HTMLElement>('[data-repair-detail]') ?? null;
    this.swapDetail = this.swapButton?.querySelector<HTMLElement>('[data-swap-detail]') ?? null;

    this.bindButtons();
    window.addEventListener('resize', this.syncVisibility);
    window.addEventListener('blur', () => this.resetInputs());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.resetInputs();
    });
    this.syncVisibility();

    director.subscribe((snapshot) => {
      this.currentPhase = snapshot.phase;
      this.applyVisibility();
    });
  }

  setHud(snapshot: HudSnapshot): void {
    if (this.specialButton && this.specialDetail) {
      const ready = snapshot.tank.specialPercent >= 1;
      this.specialDetail.textContent = ready ? 'Ready' : `${Math.round(snapshot.tank.specialPercent * 100)}%`;
      this.specialButton.dataset.cooldown = ready ? 'false' : 'true';
    }

    if (this.repairButton && this.repairDetail) {
      this.repairDetail.textContent = `x${snapshot.tank.repairCharges}`;
      this.repairButton.dataset.cooldown = snapshot.tank.repairCharges > 0 ? 'false' : 'true';
    }

    // the swap button only earns its space once a second weapon exists
    if (this.swapButton) {
      this.swapButton.hidden = snapshot.weapon.unlockedCount <= 1;
      this.swapButton.setAttribute('aria-label', `Swap weapon. Active: ${snapshot.weapon.label} level ${snapshot.weapon.level}`);
      if (this.swapDetail) {
        this.swapDetail.textContent = `${snapshot.tank.ammo}/${snapshot.tank.ammoCapacity}`;
      }
    }
  }

  private readonly syncVisibility = (): void => {
    // Geometry is cached per gesture; rotation/resizing must release its owner.
    this.resetInputs();
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

  /** Independent pointer owners let both anchored sticks work simultaneously. */
  private bindStick(binding: StickBinding): void {
    const { kind, zone, shell, knob } = binding;
    let pointerId: number | null = null;
    let originX = 0;
    let originY = 0;
    let radius = 1;
    let firing = false;
    let aimDeflected = false;
    let lastAimX = 0;
    let lastAimY = 0;

    const placeShell = (x: number, y: number): void => {
      shell.style.setProperty('--origin-x', `${x}px`);
      shell.style.setProperty('--origin-y', `${y}px`);
    };

    const updateStick = (event: PointerEvent): void => {
      const rawX = event.clientX - originX;
      const rawY = event.clientY - originY;
      const distance = Math.hypot(rawX, rawY);
      const scale = distance > radius && distance > 0 ? radius / distance : 1;
      const knobX = rawX * scale;
      const knobY = rawY * scale;

      knob.style.setProperty('--stick-x', `${knobX}px`);
      knob.style.setProperty('--stick-y', `${knobY}px`);
      if (kind === 'drive') {
        const strength = Math.max(0, (Math.min(1, distance / radius) - STICK_DEAD_ZONE) / (1 - STICK_DEAD_ZONE));
        this.gamepad.setDriveAxis(rawX / (distance || 1) * strength, rawY / (distance || 1) * strength);
      } else {
        const aimX = knobX / radius;
        const aimY = knobY / radius;
        const amount = Math.hypot(aimX, aimY);
        if (amount > STICK_DEAD_ZONE) {
          aimDeflected = true;
          lastAimX = aimX / amount;
          lastAimY = aimY / amount;
          this.gamepad.setAimAxis(lastAimX, lastAimY);
        }
        // A little hysteresis prevents firing flicker near the dead zone.
        firing = amount > (firing ? 0.22 : 0.32);
        this.gamepad.setAction(1, 'fire', firing);
        shell.dataset.firing = String(firing);
      }
    };

    // Move/up are tracked on the window rather than the zone. On the desktop
    // layout the zone is click-through so the mouse can still reach the canvas,
    // which means a drag that leaves the small pad would otherwise stop being
    // delivered and the stick would appear to die mid-drag.
    const onWindowMove = (event: PointerEvent): void => {
      if (event.pointerId !== pointerId) {
        return;
      }

      event.preventDefault();
      updateStick(event);
    };

    const onWindowUp = (event: PointerEvent): void => {
      if (event.pointerId !== pointerId) {
        return;
      }

      releaseStick(event.type === 'pointerup');
    };

    const releaseStick = (allowTap = false): void => {
      if (pointerId === null) return;
      const fireOnTap = allowTap && kind === 'aim' && !aimDeflected;
      window.removeEventListener('pointermove', onWindowMove);
      window.removeEventListener('pointerup', onWindowUp);
      window.removeEventListener('pointercancel', onWindowUp);

      const releasedPointer = pointerId;
      pointerId = null;
      if (shell.hasPointerCapture(releasedPointer)) shell.releasePointerCapture(releasedPointer);
      if (kind === 'drive') {
        this.gamepad.setDriveAxis(0, 0);
      } else {
        this.gamepad.setAction(1, 'fire', false);
        if (allowTap && aimDeflected) {
          // Keep the final non-zero heading even when the finger springs back
          // through the centre during release.
          this.gamepad.setAimAxis(lastAimX, lastAimY);
        } else if (!allowTap) {
          this.gamepad.clearAimAxis();
        }
        if (fireOnTap) {
          // A centred tap means "fire at the current heading" without
          // disturbing any other finger that is holding an input.
          this.gamepad.triggerAction(1, 'fire');
        }
      }
      aimDeflected = false;
      firing = false;

      shell.dataset.engaged = 'false';
      shell.dataset.firing = 'false';
      delete shell.dataset.floating;
      knob.style.setProperty('--stick-x', '0px');
      knob.style.setProperty('--stick-y', '0px');
    };

    binding.release = releaseStick;

    const startStick = (event: PointerEvent, floating: boolean): void => {
      if (pointerId !== null || this.root.hidden || event.button !== 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      pointerId = event.pointerId;
      if (floating) {
        const rect = zone.getBoundingClientRect();
        placeShell(event.clientX - rect.left, event.clientY - rect.top);
        shell.dataset.floating = 'true';
      }
      const shellRect = shell.getBoundingClientRect();
      const knobRect = knob.getBoundingClientRect();
      originX = shellRect.left + shellRect.width / 2;
      originY = shellRect.top + shellRect.height / 2;
      // Match Tank_game_3D: keep the entire nub inside the responsive pad.
      // Read layout once on press, not on every pointermove.
      radius = Math.max(1, Math.min(shellRect.width - knobRect.width, shellRect.height - knobRect.height) / 2 - 3);
      shell.dataset.engaged = 'true';
      shell.setPointerCapture(pointerId);

      window.addEventListener('pointermove', onWindowMove, { passive: false });
      window.addEventListener('pointerup', onWindowUp);
      window.addEventListener('pointercancel', onWindowUp);
      updateStick(event);
    };

    // Match rambo_game on mobile: movement has a predictable bottom-left home.
    // Touches elsewhere pass through to Phaser's tap-to-aim handler.
    shell.addEventListener('pointerdown', (event) => {
      startStick(event, false);
    });
    shell.addEventListener('contextmenu', (event) => event.preventDefault());
    shell.addEventListener('lostpointercapture', (event) => {
      if (event.pointerId === pointerId) releaseStick();
    });

    if (kind === 'drive') {
      // Own the whole lower-left area so its touches cannot reach Phaser's
      // battlefield tap-to-aim handler.
      zone.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      zone.addEventListener('contextmenu', (event) => event.preventDefault());
    }

    // Desktop layout with a touchscreen: the zone is click-through so the mouse
    // reaches the canvas, but a finger should still get the floating stick.
    window.addEventListener('pointerdown', (event) => {
      if (kind !== 'drive' || pointerId !== null || this.root.hidden || this.root.dataset.mode === 'touch') {
        return;
      }

      if (event.pointerType === 'mouse') {
        return;
      }

      // event.target is not always an Element (a window-dispatched event is not),
      // so narrow before reaching for closest()
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('.touch-button') || target?.closest('.touch-stick-shell')) {
        return;
      }

      const rect = zone.getBoundingClientRect();
      const inside = event.clientX >= rect.left && event.clientX <= rect.right
        && event.clientY >= rect.top && event.clientY <= rect.bottom;
      if (inside) {
        startStick(event, true);
      }
    }, { passive: false });
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
      if (pointerId !== null || this.root.hidden || event.button !== 0) return;
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
      const releasedPointer = pointerId;
      pointerId = null;
      if (releasedPointer !== null && button.hasPointerCapture(releasedPointer)) button.releasePointerCapture(releasedPointer);
      button.dataset.pressed = 'false';
      this.gamepad.setAction(1, action, false);
    };
  }

  private resetInputs(): void {
    for (const binding of this.sticks) {
      binding.release?.();
      binding.shell.dataset.engaged = 'false';
      binding.knob.style.setProperty('--stick-x', '0px');
      binding.knob.style.setProperty('--stick-y', '0px');
    }
    for (const reset of this.buttonResetters) {
      reset();
    }
    this.gamepad.resetAll();
  }
}
