// Development-only fixture: exercises the real scene and UI, never shipped by Vite.
import Phaser from 'phaser';
import '../src/style.css';
import { GameDirector } from '../src/game/core/GameDirector';
import { VirtualGamepad } from '../src/game/core/VirtualGamepad';
import { BattleScene } from '../src/game/scenes/BattleScene';
import { InterfaceController } from '../src/game/ui/InterfaceController';
import { STAGES } from '../src/game/data/stages';

document.querySelector('#app').innerHTML = `
  <div class="shell"><header class="masthead"><h1>Steel Front · Blender sprite review</h1></header>
  <main class="viewport-shell"><div class="viewport-frame"><div id="game-root" class="game-root"></div>
  <div id="hud-root" class="hud-root"></div><div id="overlay-root" class="overlay-root"></div></div></main>
  <section id="intel-root" class="intel-grid"></section></div>`;
const mission = {
  ...STAGES[0], worldWidth: 1280, worldHeight: 720,
  enemies: ['scout', 'raider', 'siege', 'boss', 'rifleman', 'rocketeer'].map((kind, i) => ({
    id: `review-${kind}`, kind, x: 340 + (i % 3) * 220, y: 230 + Math.floor(i / 3) * 190,
  })),
  covers: ['crate', 'barrel', 'concrete', 'rockWall', 'houseOpen', 'houseSealed'].map((kind, i) => ({
    id: `review-${kind}`, kind, x: 130 + i * 195, y: 590,
    width: kind === 'barrel' ? 44 : kind === 'crate' ? 58 : 122,
    height: kind === 'barrel' ? 44 : kind === 'crate' ? 58 : kind.includes('house') ? 100 : 48,
    doorSide: 'right', garrison: [],
  })),
};
const director = new GameDirector([mission, STAGES[1]]);
const gamepad = new VirtualGamepad();
const ui = new InterfaceController({
  hudRoot: document.querySelector('#hud-root'), overlayRoot: document.querySelector('#overlay-root'),
  intelRoot: document.querySelector('#intel-root'),
}, director);
const scene = new BattleScene(director, snapshot => ui.setHud(snapshot), gamepad, undefined, () => false);
const game = new Phaser.Game({
  type: Phaser.AUTO, parent: 'game-root', width: 1280, height: 720,
  backgroundColor: '#0a0f0b', scene: [scene],
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  audio: { noAudio: true },
});
window.artReview = {
  game, scene, director,
  pose() {
    game.loop.sleep();
    scene.player.x = 145;
    scene.player.y = 270;
    scene.player.bodyAngle = -.2;
    scene.player.turretAngle = -.45;
    for (const [i, enemy] of scene.enemies.entries()) {
      enemy.bodyAngle = i % 2 ? .3 : -.2;
      enemy.turretAngle = -.35 + i * .25;
    }
    scene.cameras.main.setZoom(1).setScroll(0, 0);
    scene.cameras.main.preRender();
    scene.render();
    game.renderer.preRender();
    game.scene.render(game.renderer);
    game.renderer.postRender();
  },
};
