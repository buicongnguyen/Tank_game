// node tools/verify-air-strike.mjs [Playwright package directory]
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = process.argv[2] ? require(resolve(process.argv[2])) : require('playwright');
const base = process.env.ART_REVIEW_URL ?? 'http://127.0.0.1:5182';
const browser = await chromium.launch({ headless: true });
try {
  const results = [];
  for (const mobile of [false, true]) {
    const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1366, height: 900 }, isMobile: mobile, hasTouch: mobile });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/tools/art-review.html?controls`);
    await page.getByRole('button', { name: 'Start Campaign', exact: true }).click();
    await page.waitForFunction(() => !!window.artReview?.scene?.player);
    const checks = await page.evaluate(async () => {
      const { AIR_STRIKE } = await import('/src/game/data/airStrike.ts');
      const { scene, game, director, gamepad } = window.artReview;
      game.loop.sleep();
      const results = {};
      const reset = (playerClass = 'medium') => {
        director.startCampaign(playerClass, 'normal');
        gamepad.resetAll();
        scene.enemies = [];
        scene.covers = [];
        scene.staticLayerDirty = true;
        scene.player.x = 300;
        scene.player.y = 450;
        scene.specialTimer = 0;
      };
      const enemy = (id, x, y, kind = 'rifleman') => {
        const unit = scene.createEnemy(kind, id, x, y, 'normal');
        unit.health = unit.maxHealth = 5000;
        scene.enemies.push(unit);
        return unit;
      };
      const cover = (id, kind, x, y, health = 4) => {
        const building = { id, kind, x, y, width: 100, height: 80, health, maxHealth: health,
          solid: true, spent: false, doorSide: 'right', garrison: [], garrisonReleased: false };
        scene.covers.push(building);
        return building;
      };
      const pressStrike = () => {
        gamepad.triggerAction(1, 'special');
        scene.updatePlayer(scene.player, scene.mission, director.getSnapshot().tankStats, 0, 0);
      };
      const step = (frames = 260, move = () => {}) => {
        for (let frame = 0; frame < frames; frame++) {
          move(frame);
          scene.updateProjectiles(.016);
        }
      };
      reset();
      enemy('enemy-far', 850, 430);
      enemy('enemy-near', 580, 420);
      enemy('enemy-middle', 730, 300);
      cover('building-near', 'houseSealed', 610, 620);
      cover('building-middle', 'concrete', 800, 620);
      cover('building-far', 'rockWall', 970, 620, 8);
      const ammo = scene.ammo;
      const weapon = director.getSnapshot().selectedWeapon;
      pressStrike();
      const locks = scene.projectiles.map(p => p.airStrike.target.entity.id);
      results.volley = scene.projectiles.length === 6 && new Set(locks).size === 6
        && locks.slice(0, 3).every(id => id.startsWith('enemy'))
        && locks[0] === 'enemy-near';
      results.cooldownAndAmmo = scene.specialTimer === director.getSnapshot().tankStats.specialCooldownMs
        && scene.ammo === ammo && director.getSnapshot().selectedWeapon === weapon;
      pressStrike();
      results.noCooldownSpam = scene.projectiles.length === 6;
      // Keep the existing primary seeker weapon on its separate homing path.
      const { WEAPONS } = await import('/src/game/data/weapons.ts');
      scene.fireSelectedWeapon(scene.player, director.getSnapshot().tankStats, WEAPONS.homing);
      results.primaryHomingUnchanged = scene.projectiles.some(p => !p.airStrike && p.homingStrength === WEAPONS.homing.homingStrength);

      reset();
      const moving = enemy('moving-infantry', 850, 380);
      let missileHits = 0;
      const originalDamage = scene.damageTank;
      scene.damageTank = function (target, damage, projectile, ...rest) {
        if (target === moving && projectile.airStrike) missileHits++;
        return originalDamage.call(this, target, damage, projectile, ...rest);
      };
      pressStrike();
      const first = scene.projectiles[0];
      const startingAngle = Math.atan2(first.vy, first.vx);
      step(260, () => { moving.x -= 25 * .016; moving.y += 70 * .016; });
      results.movingTarget = missileHits === 6 && moving.health < 5000 && scene.projectiles.length === 0
        && Math.abs(Math.atan2(first.vy, first.vx) - startingAngle) > .05;
      scene.damageTank = originalDamage;

      reset();
      const behindWall = enemy('behind-wall', 960, 460);
      const wall = cover('intervening-wall', 'rockWall', 600, 380, 8);
      wall.height = 380;
      pressStrike();
      scene.projectiles = scene.projectiles.filter(p => p.airStrike.target.entity === behindWall).slice(0, 1);
      step();
      results.coverOverflight = behindWall.health < 5000 && wall.health === 8;

      reset();
      const lost = enemy('lost', 650, 450);
      const backup = enemy('backup', 830, 620);
      pressStrike();
      lost.alive = false;
      scene.updateProjectiles(.016);
      results.retarget = scene.projectiles.length === 6 && scene.projectiles.every(p => p.airStrike.target.entity === backup);
      backup.alive = false;
      scene.updateProjectiles(.016);
      results.noTargetsAfterLaunch = scene.projectiles.length === 0;

      const durability = [];
      for (const [kind, health] of [['crate', 1], ['houseSealed', 3], ['houseOpen', 4], ['concrete', 4], ['rockWall', 8]]) {
        reset();
        const building = cover(`durability-${kind}`, kind, 700, 450, health);
        pressStrike();
        step();
        durability.push({ kind, health: building.health, expected: Math.max(0, health - 6) });
      }
      results.buildingDurability = durability.every(test => test.health === test.expected);
      results.durability = durability;

      reset();
      for (const kind of ['repair', 'armory', 'mine', 'barrel']) cover(`utility-${kind}`, kind, 500, 450);
      cover('own-shelter', 'houseOpen', 300, 450);
      const ownEnemy = enemy('enemy-in-own-shelter', 300, 450);
      const hiding = enemy('hidden', 620, 450);
      cover('enemy-shelter', 'houseOpen', 620, 450);
      const dead = enemy('dead', 500, 350);
      dead.alive = false;
      enemy('outside-range', 300 + AIR_STRIKE.range + .01, 450);
      enemy('at-range', 300 + AIR_STRIKE.range, 450);
      // Only infantry can occupy the friendly shelter.
      scene.player.kind = 'rifleman';
      scene.updateHouseShelters();
      const eligible = scene.getAirStrikeTargets(scene.player).map(t => t.entity.id);
      results.safeSelection = hiding.shelteredBy === 'enemy-shelter' && ownEnemy.shelteredBy === 'own-shelter'
        && eligible.length === 2 && eligible.includes('enemy-shelter') && eligible.includes('at-range');
      // Reacquire the house if the tracked soldier takes shelter mid-flight.
      reset();
      const newlySheltered = enemy('entering-house', 600, 400);
      cover('new-shelter', 'houseOpen', 780, 550);
      pressStrike();
      scene.projectiles = scene.projectiles.filter(p => p.airStrike.target.entity === newlySheltered);
      newlySheltered.x = 780;
      newlySheltered.y = 550;
      scene.updateHouseShelters();
      scene.updateProjectiles(.016);
      results.shelterRetarget = scene.projectiles.every(p => p.airStrike.target.entity.id === 'new-shelter');

      reset();
      pressStrike();
      results.noTargetNoCooldown = scene.specialTimer === 0 && scene.projectiles.length === 0;
      const expiryTarget = enemy('expiry-target', 800, 450);
      pressStrike();
      for (const p of scene.projectiles) p.ttl = 1;
      scene.updateProjectiles(.016);
      results.expiry = scene.projectiles.length === 0 && expiryTarget.health === 5000;

      const edgeHits = [];
      for (const [px, py, ex, ey] of [[30, 30, 60, 90], [1250, 690, 1200, 630]]) {
        reset();
        Object.assign(scene.player, { x: px, y: py });
        const edgeEnemy = enemy('edge-enemy', ex, ey);
        pressStrike();
        const inBounds = scene.projectiles.every(p => p.x >= 0 && p.y >= 0
          && p.x <= scene.mission.worldWidth && p.y <= scene.mission.worldHeight);
        step();
        edgeHits.push(inBounds && edgeEnemy.health < 5000 && scene.projectiles.length === 0);
      }
      results.edgeLaunches = edgeHits.every(Boolean);

      reset();
      enemy('pause-target', 800, 450);
      pressStrike();
      const position = scene.projectiles.map(p => [p.x, p.y, p.ttl]);
      director.pauseGame();
      scene.update(1, 16);
      results.pause = JSON.stringify(position) === JSON.stringify(scene.projectiles.map(p => [p.x, p.y, p.ttl]));
      director.resumeGame();
      scene.update(2, 16);
      results.resume = scene.projectiles[0].ttl < position[0][2];
      director.failMission('Strike retry regression');
      director.continueFromMission(0);
      results.retryClearsMissiles = scene.projectiles.length === 0;
      // Set up a ready, safe encounter for real keyboard/touch dispatch below.
      reset('rifleman');
      scene.player.x = 300;
      scene.player.y = 450;
      enemy('input-target', 650, 400);
      scene.cameras.main.setScroll(0, 0);
      return results;
    });
    for (const [name, result] of Object.entries(checks)) {
      if (name !== 'durability') assert.equal(result, true, `${mobile ? 'mobile' : 'desktop'}: ${name}`);
    }
    if (mobile) await page.getByRole('button', { name: 'Air Strike: six guided missiles', exact: true }).tap();
    else await page.keyboard.down('q');
    const input = await page.evaluate(() => {
      const { scene, director, game, gamepad } = window.artReview;
      scene.updatePlayer(scene.player, scene.mission, director.getSnapshot().tankStats, 0, 0);
      const count = scene.projectiles.filter(p => p.airStrike).length;
      const cooldown = scene.specialTimer;
      let rocketRenders = 0;
      const originalRocket = scene.drawRocketProjectile;
      scene.drawRocketProjectile = function (...args) { rocketRenders++; originalRocket.call(this, ...args); };
      scene.onHud(scene.buildHudSnapshot(director.getSnapshot(), scene.mission, scene.player));
      scene.cameras.main.preRender();
      scene.render();
      scene.drawRocketProjectile = originalRocket;
      game.renderer.preRender();
      game.scene.render(game.renderer);
      game.renderer.postRender();
      gamepad.resetAll();
      return { count, cooldown, rocketRenders };
    });
    if (!mobile) await page.keyboard.up('q');
    assert.equal(input.count, 6);
    assert.ok(input.cooldown > 0);
    assert.equal(input.rocketRenders, 6, 'Air support renders as missiles even for the on-foot player');
    await mkdir('artifacts/air-strike-review', { recursive: true });
    await page.screenshot({ path: `artifacts/air-strike-review/${mobile ? 'mobile' : 'desktop'}.png` });
    assert.deepEqual(errors, []);
    results.push({ device: mobile ? 'mobile' : 'desktop', checks, input, errors });
    await page.close();
  }
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
