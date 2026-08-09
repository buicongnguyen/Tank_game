import Phaser from 'phaser';
import './style.css';
import { BattleMusic } from './game/audio/BattleMusic';
import { GameDirector } from './game/core/GameDirector';
import { VirtualGamepad } from './game/core/VirtualGamepad';
import { BattleScene } from './game/scenes/BattleScene';
import { InterfaceController } from './game/ui/InterfaceController';
import { TouchControlsOverlay } from './game/ui/TouchControls';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('App root not found.');
}

app.innerHTML = `
  <div class="shell">
    <header class="masthead">
      <div>
        <span class="eyebrow">Mobile arcade tank prototype</span>
        <h1>Tank Game: Steel Front</h1>
      </div>
      <p>
        A planning fork for a staged tank-combat game: armored movement, shell impacts, battlefield objectives, and boss machines.
      </p>
    </header>
    <main class="viewport-shell">
      <div class="viewport-frame">
        <div id="game-root" class="game-root"></div>
        <div id="hud-root" class="hud-root"></div>
        <div id="overlay-root" class="overlay-root"></div>
        <div id="touch-controls-root" class="touch-controls-root" hidden></div>
      </div>
    </main>
    <section id="intel-root" class="intel-grid"></section>
  </div>
`;

const hudRoot = document.querySelector<HTMLElement>('#hud-root');
const overlayRoot = document.querySelector<HTMLElement>('#overlay-root');
const intelRoot = document.querySelector<HTMLElement>('#intel-root');
const touchControlsRoot = document.querySelector<HTMLElement>('#touch-controls-root');

if (!hudRoot || !overlayRoot || !intelRoot || !touchControlsRoot) {
  throw new Error('Interface roots are missing.');
}

const director = new GameDirector();
const virtualGamepad = new VirtualGamepad();
const battleMusic = new BattleMusic();
const performanceSettings = { enabled: true };
battleMusic.setEnabled(false);
let touchControls: TouchControlsOverlay | undefined;
const ui = new InterfaceController(
  { hudRoot, overlayRoot, intelRoot },
  director,
  {
    startMusic: () => battleMusic.start(),
    playSfx: (cue, intensity) => battleMusic.playSfx(cue, intensity),
    isPerformanceModeEnabled: () => performanceSettings.enabled,
    setPerformanceModeEnabled: (enabled) => {
      performanceSettings.enabled = enabled;
      battleMusic.setEnabled(!enabled);
      if (!enabled) {
        battleMusic.start();
      }
    },
  },
);
touchControls = new TouchControlsOverlay(touchControlsRoot, director, virtualGamepad);

const touchOptimizedRenderer = window.matchMedia('(hover: none) and (pointer: coarse)').matches
  || (navigator.maxTouchPoints > 0 && window.innerWidth <= 900);
document.body.dataset.renderProfile = touchOptimizedRenderer ? 'mobile' : 'desktop';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-root',
  backgroundColor: '#0a0f0b',
  width: 1280,
  height: 720,
  input: {
    // Movement, battlefield aim/fire, and an action/aim stick may all be held
    // at once on a phone. Phaser defaults to a single touch pointer.
    activePointers: 3,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  fps: {
    // A stable 45 Hz is smoother on phones than repeatedly missing a 60 Hz
    // budget while still keeping desktop motion at the native 60 Hz target.
    target: touchOptimizedRenderer ? 45 : 60,
    min: 30,
    smoothStep: true,
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720,
  },
  render: {
    pixelArt: false,
    antialias: !touchOptimizedRenderer,
    roundPixels: touchOptimizedRenderer,
    powerPreference: 'high-performance',
  },
  scene: [new BattleScene(director, (snapshot) => {
    ui.setHud(snapshot);
    touchControls?.setHud(snapshot);
  }, virtualGamepad, battleMusic, () => !performanceSettings.enabled)],
});
