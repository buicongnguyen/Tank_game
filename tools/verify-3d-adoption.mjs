// Run with Vite on port 5182. Optional argument: a local Playwright package directory.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = process.argv[2] ? require(resolve(process.argv[2])) : require('playwright');
const base = process.env.ART_REVIEW_URL ?? 'http://127.0.0.1:5182';
const output = 'artifacts/3d-adoption-review';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const mobile of [false, true]) {
    const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1366, height: 900 }, isMobile: mobile, hasTouch: mobile });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/tools/art-review.html?controls&effects`);
    await page.getByRole('button', { name: 'Start Campaign', exact: true }).click();
    await page.waitForFunction(() => !!window.artReview?.scene?.player);
    const results = await page.evaluate(async () => {
      const { WEAPONS } = await import('/src/game/data/weapons.ts');
      const { STAGES } = await import('/src/game/data/stages.ts');
      const { SurfaceEffects, coverMaterial } = await import('/src/game/render/SurfaceEffects.ts');
      const { groundTheme } = await import('/src/game/render/GroundRenderer.ts');
      const { machineGunOffset } = await import('/src/game/data/weaponMechanics.ts');
      const { scene, game, director, gamepad, reviewEffects } = window.artReview;
      game.loop.sleep();
      const results = {};
      const check = (name, condition) => { if (!condition) throw new Error(name); results[name] = true; };
      const reset = (chassis = 'medium') => {
        director.startCampaign(chassis, 'normal'); gamepad.resetAll();
        scene.enemies = []; scene.covers = []; scene.staticLayerDirty = true;
        scene.player.x = 200; scene.player.y = 300; scene.player.turretAngle = 0;
        scene.lastPointerWorld = { x: 1000, y: 300 };
      };
      const enemy = (id, x, y = 300, kind = 'rifleman') => {
        const unit = scene.createEnemy(kind, id, x, y, 'normal');
        unit.health = unit.maxHealth = 5000; unit.shield = 0; unit.bodyAngle = Math.PI / 2;
        scene.enemies.push(unit); return unit;
      };
      const cover = (id, kind, x, y = 300, health = 4) => {
        const wall = { id, kind, x, y, width: 80, height: 100, health, maxHealth: health,
          solid: true, spent: false, doorSide: 'right', garrison: [], garrisonReleased: false };
        scene.covers.push(wall); return wall;
      };
      const fire = id => { director.grantWeapon(id); scene.fireSelectedWeapon(scene.player, director.getSnapshot().tankStats, WEAPONS[id]); };
      const flush = () => {
        scene.cameras.main.setZoom(1).setScroll(0, 0); scene.cameras.main.preRender();
        scene.onHud(scene.buildHudSnapshot(director.getSnapshot(), scene.mission, scene.player));
        scene.render(); game.renderer.preRender(); game.scene.render(game.renderer); game.renderer.postRender();
      };
      // Check actual renderer dispatch for both chassis, not only metadata.
      for (const chassis of ['rifleman', 'rocketeer']) {
        reset(chassis);
        const methods = ['drawBullet', 'drawShell', 'drawRocketProjectile', 'drawRailSlug', 'drawMortarShell', 'drawSuicideDrone'];
        const originals = methods.map(name => scene[name]);
        let calls = [];
        methods.forEach(name => { scene[name] = () => calls.push(name); });
        for (const [id, expected] of [['rifle', 'drawBullet'], ['machineGun', 'drawBullet'], ['autocannon', 'drawShell'], ['rocket', 'drawRocketProjectile'], ['launcher', 'drawRocketProjectile'], ['sniper', 'drawRailSlug'], ['mortar', 'drawMortarShell'], ['gasBomb', 'drawMortarShell'], ['drone', 'drawSuicideDrone'], ['shotgun', undefined]]) {
          const spec = WEAPONS[id]; scene.projectiles = []; calls = [];
          scene.fireProjectile(scene.player, 'player', 20, 500, spec.blastRadius, spec.color, spec.style, true, { feedback: spec.feedback });
          scene.drawProjectiles(scene.graphics);
          check(`${chassis}-${id}-appearance`, expected ? calls.length === 1 && calls[0] === expected : calls.length === 0 && scene.projectiles[0].kind === 'pellet');
        }
        methods.forEach((name, index) => { scene[name] = originals[index]; });
      }
      // Delayed callbacks are captured and replayed, preserving the real launch closure.
      for (const level of [1, 2, 3, 4]) {
        reset('rocketeer'); director.weaponLevels.machineGun = level; director.grantWeapon('machineGun');
        const pending = [], offsets = [];
        const delayed = scene.time.delayedCall, launch = scene.fireProjectile;
        scene.time.delayedCall = (delay, callback) => { pending.push({ delay, callback }); };
        scene.fireProjectile = function (...args) { offsets.push(args[8].lateralOffset); return launch.apply(this, args); };
        fire('machineGun'); pending.forEach(timer => timer.callback());
        scene.time.delayedCall = delayed; scene.fireProjectile = launch;
        check(`mg-level-${level}-burst`, scene.projectiles.length === 8 && pending.length === 7 && pending[6].delay === 294
          && offsets.every((value, index) => value === machineGunOffset(index, level)) && new Set(offsets).size === (level >= 3 ? 4 : 2));
        scene.render();
        check(`mg-level-${level}-barrels`, [...scene.blenderSprites.weapons].filter(([key, sprite]) => key.startsWith('player-gun') && sprite.visible).length === (level >= 3 ? 4 : 2));
        director.grantWeapon('railgun'); scene.render();
        check(`mg-level-${level}-switch`, [...scene.blenderSprites.weapons].filter(([key, sprite]) => key.startsWith('player-gun') && sprite.visible).length === 1);
      }
      reset('rocketeer');
      const pending = [], delayed = scene.time.delayedCall;
      scene.time.delayedCall = (_delay, callback) => { pending.push(callback); };
      fire('machineGun'); reset('rocketeer'); pending.forEach(callback => callback()); scene.time.delayedCall = delayed;
      check('old-burst-cancelled', scene.projectiles.length === 0);

      // Small rounds chip cover; autocannon shells and soldier rockets retain ordnance strength.
      for (const [id, expected] of [['rifle', .25], ['machineGun', .25], ['shotgun', .25], ['autocannon', 1], ['launcher', 1]]) {
        reset('rifleman'); const wall = cover('strength', 'concrete', 450); const spec = WEAPONS[id];
        scene.fireProjectile(scene.player, 'player', 20, 500, 0, spec.color, spec.style, true, { feedback: spec.feedback });
        const p = scene.projectiles[0]; p.previousX = 300; p.previousY = 300; p.x = 600; p.y = 300;
        scene.handleProjectileCoverHit(p);
        check(`${id}-structure-strength`, wall.health === 4 - expected);
      }
      reset();
      const first = enemy('before', 300), behind = enemy('behind-first', 600), blocked = enemy('behind-second', 900);
      const firstWall = cover('first', 'concrete', 440), secondWall = cover('second', 'concrete', 760);
      fire('laser');
      check('laser-one-concrete', first.health < 5000 && behind.health < 5000 && blocked.health === 5000 && firstWall.health === 4 && secondWall.health === 4 && scene.beams[0].endX === 720);
      for (const kind of ['crate', 'rockWall', 'houseOpen', 'houseSealed']) {
        reset(); const wall = cover('stop', kind, 440, 300, 1), unit = enemy('blocked', 800);
        fire('laser'); check(`laser-stops-${kind}`, wall.spent && unit.health === 5000 && scene.beams[0].endX === 400);
      }
      reset(); for (let i = 0; i < 9; i++) enemy(`row-${i}`, 300 + i * 80);
      fire('laser'); check('laser-enemy-pierce-limit', scene.enemies.filter(unit => unit.health < 5000).length === 7);
      reset(); scene.player.x = 1200; fire('laser');
      check('laser-map-boundary', scene.beams[0].endX === scene.mission.worldWidth);
      reset(); enemy('input', 400); director.grantWeapon('laser'); const ammo = scene.ammo;
      gamepad.triggerAction(1, 'fire'); scene.updatePlayer(scene.player, scene.mission, director.getSnapshot().tankStats, 0, 0);
      check('laser-primary-ammo', scene.beams.length === 1 && scene.ammo === ammo - 1 && scene.projectiles.length === 0);
      director.pauseGame(); scene.update(0, 1000); check('laser-pause', scene.beams[0].age === 0);
      director.resumeGame(); scene.updateCombatFeedback(161); check('laser-expiry', scene.beams.length === 0);

      reset();
      const near = enemy('near', 300), outside = enemy('outside', 300, 420), far = enemy('far', 440);
      fire('flamer');
      check('flame-cone-range', near.health < 5000 && outside.health === 5000 && far.health === 5000 && scene.burns.size === 1 && scene.projectiles.length === 0);
      const velocity = [near.vx, near.vy], labels = scene.floatingTexts.length, initialBurn = scene.burns.get(near).dps;
      const remainingHealth = near.health;
      for (let i = 0; i < 125; i++) scene.updateBurns(16);
      check('flame-two-second-burn', Math.abs(remainingHealth - near.health - initialBurn * 2) < .00001 && scene.burns.size === 0);
      check('burn-no-impulse-label-spam', near.vx === velocity[0] && near.vy === velocity[1] && scene.floatingTexts.length === labels);
      fire('flamer'); scene.updateBurns(1000); fire('flamer');
      check('burn-refresh-not-stack', scene.burns.size === 1 && scene.burns.get(near).remainingMs === 2000 && scene.burns.get(near).dps === initialBurn);
      reset(); const shielded = enemy('shielded', 400), shield = cover('shield', 'rockWall', 320, 300, 8);
      fire('flamer'); check('flame-cover-occlusion', shielded.health === 5000 && shield.health < 8 && shield.health > 7 && scene.burns.size === 0 && scene.flames[0].rays[4].length === 80);
      reset('rifleman'); const house = cover('shelter', 'houseOpen', 200); const outsideHouse = enemy('outside-door', 340);
      fire('flamer'); check('flame-safe-doorway', outsideHouse.health < 5000 && house.health === 4 && !scene.burns.has(house));
      scene.player.turretAngle = Math.PI; fire('flamer'); check('flame-house-wall-stops', house.health < 4 && scene.flames[1].rays[4].length === 0);
      reset(); const wood = cover('wood', 'crate', 340); fire('flamer');
      check('wood-can-burn', scene.burns.has(wood));
      const healthByMode = [];
      for (const high of [false, true]) for (const step of [16, 40, 100, 500]) {
        reset(); reviewEffects.enabled = high; const unit = enemy('burn-rate', 300); fire('flamer');
        for (let elapsed = 0; elapsed < 2000; elapsed += step) scene.updateBurns(step);
        healthByMode.push(unit.health);
      }
      check('burn-quality-and-frame-independent', healthByMode.every(health => Math.abs(health - healthByMode[0]) < .00001));
      reset(); enemy('pause-burn', 300); fire('flamer'); scene.surfaceEffects.impact(500, 300, 'wood', true);
      director.pauseGame(); scene.update(0, 1000);
      check('burn-and-surface-pause', [...scene.burns.values()][0].remainingMs === 2000 && scene.surfaceEffects.marks[0].age === 0);
      director.resumeGame(); scene.update(0, 100);
      check('burn-hitch-duration', [...scene.burns.values()][0].remainingMs === 1900);
      reset(); fire('laser'); fire('flamer'); scene.surfaceEffects.impact(500, 300, 'fuel', true);
      director.failMission('Reset test'); director.continueFromMission(0);
      check('retry-clears-new-effects', !scene.beams.length && !scene.flames.length && !scene.burns.size && !scene.surfaceEffects.marks.length && !scene.surfaceEffects.particles.length);

      check('material-mapping', coverMaterial('crate') === 'wood' && coverMaterial('rockWall') === 'stone' && coverMaterial('houseOpen') === 'stone' && coverMaterial('barrel') === 'fuel');
      for (const low of [false, true]) {
        const fx = new SurfaceEffects(); fx.low = low;
        for (let i = 0; i < 500; i++) fx.impact(300, 300, ['wood', 'stone', 'metal', 'fuel'][i % 4], true, 30, 0, i % 4 === 2);
        fx.update(.1, low);
        check(`surface-caps-${low}`, fx.particles.length <= (low ? 56 : 160) && fx.marks.length === (low ? 12 : 32) && fx.fires.length === (low ? 2 : 6));
        fx.update(20, low); check(`surface-expiry-${low}`, !fx.particles.length && !fx.marks.length && !fx.fires.length);
        fx.impact(300, 300, 'stone', true); check(`stone-dust-no-fire-${low}`, fx.particles.some(p => p.kind === 'dust') && !fx.fires.length);
        fx.clear(); fx.impact(300, 300, 'wood', true); check(`wood-chips-${low}`, fx.particles.some(p => p.kind === 'chip') && fx.fires.length === 1);
      }
      reset(); const tank = enemy('wreck', 400, 300, 'scout'); tank.health = 1;
      scene.damageTank(tank, 1000, scene.specialProjectile(scene.player, 1000, 'cannon', 400, 300), 0);
      check('tank-wreck-integration', !tank.alive && scene.surfaceEffects.marks.some(mark => mark.wreck));
      const box = cover('destroy-once', 'crate', 600); scene.damageCover(box, 100, 'player');
      const marks = scene.surfaceEffects.marks.length; scene.destroyCover(box, 'player', 100);
      check('cover-destruction-once', marks === scene.surfaceEffects.marks.length);

      reset(); scene.render(); const tile = scene.groundRenderer.tile;
      const stagesBefore = JSON.stringify(STAGES), themes = new Set();
      for (const mission of STAGES) { themes.add(groundTheme(mission)); scene.terrainGraphics.clear(); scene.groundRenderer.draw(scene.terrainGraphics, mission); }
      check('ground-five-cached-themes', themes.size === 5 && game.textures.getTextureKeys().filter(key => key.startsWith('ground-detail-')).length === 5 && scene.groundRenderer.tile === tile);
      check('ground-no-mission-mutation', stagesBefore === JSON.stringify(STAGES));
      scene.terrainGraphics.clear(); scene.groundRenderer.draw(scene.terrainGraphics, STAGES[0]); const groundCommands = JSON.stringify(scene.terrainGraphics.commandBuffer);
      scene.terrainGraphics.clear(); scene.groundRenderer.draw(scene.terrainGraphics, STAGES[0]);
      check('ground-deterministic', groundCommands === JSON.stringify(scene.terrainGraphics.commandBuffer));
      reset(); scene.render(); let redraws = 0; const drawTerrain = scene.drawTerrain;
      scene.drawTerrain = function (...args) { redraws++; return drawTerrain.apply(this, args); };
      const staticWall = cover('static-test', 'concrete', 600); scene.damageCover(staticWall, 1, 'player'); scene.render();
      scene.drawTerrain = drawTerrain; check('cover-hit-no-terrain-redraw', redraws === 0);
      reviewEffects.enabled = true;
      for (let i = 0; i < 27; i++) enemy(`stress-${i}`, 380 + i % 9 * 80, 200 + Math.floor(i / 9) * 100);
      scene.render(); const children = scene.children.list.length, samples = [];
      for (let frame = 0; frame < 600; frame++) {
        const start = performance.now();
        scene.surfaceEffects.impact(400 + frame % 300, 340, ['wood', 'stone', 'metal', 'fuel'][frame % 4], frame % 3 === 0);
        scene.surfaceEffects.exhaust(300, 300, 0); scene.surfaceEffects.update(.016, false);
        if (frame % 20 === 0) fire('flamer');
        scene.updateBurns(16); scene.updateCombatFeedback(16); scene.updateExplosions(16); scene.render();
        samples.push(performance.now() - start);
      }
      // Per-hit labels use the existing capped pool. Cosmetic systems add none.
      check('stress-bounded-effects', scene.surfaceEffects.particles.length <= 160 && scene.surfaceEffects.marks.length <= 32 && scene.surfaceEffects.fires.length <= 6 && scene.flames.length <= 6 && scene.burns.size <= 27);
      scene.updateCombatFeedback(5000); scene.updateExplosions(5000); scene.render(); const settled = scene.children.list.length;
      for (let i = 0; i < 300; i++) scene.render();
      check('render-no-object-growth', scene.children.list.length === settled && settled <= children + 20);
      samples.sort((a, b) => a - b); results.cpuP95Ms = samples[Math.floor(samples.length * .95)];
      results.cpuMaxMs = samples.at(-1);

      window.adoptionPose = (kind, low) => {
        reset('rocketeer'); reviewEffects.enabled = !low;
        const unit = enemy('pose-unit', 350, 300, 'scout'); unit.health = unit.maxHealth = 160;
        cover('pose-brick', 'houseSealed', 670, 420, 3); cover('pose-rock', 'rockWall', 710, 560, 8);
        cover('pose-wood', 'crate', 470, 560, 1); cover('pose-house', 'houseOpen', 930, 560, 4);
        if (kind === 'laser') {
          cover('pose-concrete', 'concrete', 510, 300); enemy('pose-behind', 650, 300, 'scout'); fire('laser');
        } else if (kind === 'flame') { fire('flamer'); scene.updateCombatFeedback(70); }
        else {
          unit.health = 1; scene.damageTank(unit, 1000, scene.specialProjectile(scene.player, 1000, 'cannon', unit.x, unit.y), 0);
          scene.surfaceEffects.impact(490, 350, 'wood', true, 35); scene.surfaceEffects.impact(650, 300, 'stone', true, 45);
          scene.surfaceEffects.impact(830, 300, 'fuel', true, 25); scene.surfaceEffects.update(.35, low);
          scene.updateExplosions(350); scene.updateCombatFeedback(350);
        }
        flush();
      };
      window.adoptionTheme = id => {
        window.adoptionPose('aftermath', false);
        const stage = STAGES.find(stage => stage.id === id);
        scene.mission = { ...scene.mission, id, palette: stage.palette };
        scene.terrainLayerDirty = true; flush();
      };
      return results;
    });
    for (const kind of ['flame', 'laser', 'aftermath']) {
      await page.evaluate(kind => window.adoptionPose(kind, false), kind);
      await page.screenshot({ path: `${output}/${mobile ? 'mobile' : 'desktop'}-${kind}.png` });
    }
    await page.evaluate(() => window.adoptionPose('flame', true));
    await page.screenshot({ path: `${output}/${mobile ? 'mobile' : 'desktop'}-reduced.png` });
    if (!mobile) for (const id of ['rocket-picket', 'first-armor', 'frozen-pass', 'ash-corridor']) {
      await page.evaluate(id => window.adoptionTheme(id), id);
      await page.screenshot({ path: `${output}/ground-${id}.png` });
    }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ mobile, checks: Object.keys(results).length - 2, ...results, browserErrors: errors }, null, 2));
    await page.close();
  }
} finally { await browser.close(); }
