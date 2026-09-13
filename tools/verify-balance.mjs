// node tools/verify-balance.mjs [Playwright package directory]
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = process.argv[2] ? require(resolve(process.argv[2])) : require('playwright');
const base = process.env.ART_REVIEW_URL ?? 'http://127.0.0.1:5182';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/tools/art-review.html?campaign&controls`);
  await page.getByRole('button', { name: 'Start Campaign', exact: true }).click();
  await page.waitForFunction(() => !!window.artReview?.scene?.player);
  const data = await page.evaluate(async () => {
    const { STAGES } = await import('/src/game/data/stages.ts');
    const { PLAYER_CLASSES } = await import('/src/game/data/playerClasses.ts');
    const { withInfantrySquads } = await import('/src/game/data/infantrySquads.ts');
    const { GameDirector } = await import('/src/game/core/GameDirector.ts');
    const { SHOP_STATS } = await import('/src/game/data/shop.ts');
    const infantry = e => ['rifleman', 'rocketeer'].includes(e.kind);
    const problems = [];
    const counts = STAGES.map(mission => {
      if (new Set(mission.enemies.map(e => e.id)).size !== mission.enemies.length) problems.push(`${mission.id}: duplicate ID`);
      for (const enemy of mission.enemies.filter(infantry)) {
        if (enemy.x < 520 || enemy.x > mission.worldWidth - 40 || enemy.y < 40 || enemy.y > mission.worldHeight - 40) problems.push(`${enemy.id}: bounds`);
        if (mission.covers.some(c => Math.abs(enemy.x - c.x) < c.width / 2 + 22 && Math.abs(enemy.y - c.y) < c.height / 2 + 22)) problems.push(`${enemy.id}: cover`);
        if (mission.enemies.some(e => e.id !== enemy.id && Math.hypot(e.x - enemy.x, e.y - enemy.y) < (infantry(e) ? 48 : 72))) problems.push(`${enemy.id}: spacing`);
      }
      return { stage: mission.id, field: mission.enemies.filter(infantry).length,
        hidden: mission.covers.reduce((n, c) => n + (c.garrison?.length ?? 0), 0), armor: mission.enemies.filter(e => !infantry(e)).length };
    });
    const speeds = {};
    for (const id of ['rocketeer', 'light', 'medium', 'heavy', 'rifleman']) {
      const director = new GameDirector();
      director.startCampaign(id, 'normal');
      const stock = director.getSnapshot().tankStats.engine;
      director.completeCurrentMission({ score: 0, scrap: 10000 });
      const purchased = director.buyShopItem('engine');
      const upgraded = director.getSnapshot().tankStats.engine;
      director.failMission('Retry test');
      director.continueFromMission(0);
      const retry = director.getSnapshot().tankStats.engine;
      director.completeCurrentMission({ score: 0, scrap: 0 });
      // Unlock the next chassis through normal progression before testing it.
      for (let stage = 0; stage < 12 && director.getShopEntries().find(e => e.id === 'chassis')?.lockedReason; stage++) {
        director.advanceToNextMission();
        director.completeCurrentMission({ score: 0, scrap: 0 });
      }
      const chassisBought = director.buyShopItem('chassis');
      const next = director.getSnapshot();
      const engineDirector = new GameDirector();
      engineDirector.startCampaign(id, 'normal');
      engineDirector.completeCurrentMission({ score: 0, scrap: 10000 });
      const enginePurchases = Array.from({ length: 5 }, () => engineDirector.buyShopItem('engine'));
      const maxEngine = engineDirector.getSnapshot().tankStats.engine;
      const wallet = engineDirector.getSnapshot().credits;
      const overCapBought = engineDirector.buyShopItem('engine');
      speeds[id] = { stock, purchased, upgraded, retry, chassisBought,
        enginePurchases, maxEngine, overCapBought, overCapWalletUnchanged: engineDirector.getSnapshot().credits === wallet,
        chassisSpeedPreserved: !chassisBought || next.tankStats.engine === PLAYER_CLASSES[next.playerClass].stats.engine + 26 };
    }
    // Mixed additive/multiplicative upgrades must replay in acquisition order.
    const upgradeHistory = [];
    const applyReward = (stats, id) => {
      if (id === 'armor') { stats.maxHealth += 110; stats.armor += .12; }
      if (id === 'engine') { stats.engine += 32; stats.turnRate += .4; }
      if (id === 'reload') stats.reloadMs = Math.min(stats.reloadMs, Math.max(460, stats.reloadMs * .84));
      if (id === 'shells') { stats.shellDamage += 22; stats.shellSpeed += 35; }
      if (id === 'special') stats.specialCooldownMs = Math.min(stats.specialCooldownMs, Math.max(7600, stats.specialCooldownMs * .78));
      if (id === 'repair') { stats.repairCharges += 1; stats.maxHealth += 45; }
    };
    for (const difficulty of ['easy', 'normal', 'hard', 'extreme']) {
      const director = new GameDirector();
      director.startCampaign('rocketeer', difficulty);
      const beforeInvalidReward = director.getSnapshot();
      director.applyUpgrade('engine');
      const invalidRewardIgnored = JSON.stringify(director.getSnapshot()) === JSON.stringify(beforeInvalidReward);
      director.startCampaign('rocketeer', difficulty);
      const baseline = new GameDirector();
      baseline.startCampaign('light', difficulty);
      const expected = baseline.getSnapshot().tankStats;
      const rewards = ['engine', 'shells', 'armor', 'reload', 'reload', 'special', 'shells', 'repair'];
      const purchases = ['engine', 'damage', 'armor', 'reload', 'reload', 'shield', 'damage', 'repair'];
      const bought = [];
      let rewardsNeverSlowReload = true;
      for (let stage = 0; stage < rewards.length; stage++) {
        director.completeCurrentMission({ score: 0, scrap: 10000 });
        bought.push(director.buyShopItem(purchases[stage]));
        SHOP_STATS[purchases[stage]].apply(expected);
        const beforeReward = director.getSnapshot().tankStats.reloadMs;
        director.applyUpgrade(rewards[stage]);
        rewardsNeverSlowReload &&= director.getSnapshot().tankStats.reloadMs <= beforeReward;
        applyReward(expected, rewards[stage]);
      }
      director.completeCurrentMission({ score: 0, scrap: 0 });
      const chassisBought = director.buyShopItem('chassis');
      const actual = director.getSnapshot().tankStats;
      director.failMission('Mixed-upgrade retry');
      director.continueFromMission(8);
      const retry = director.getSnapshot().tankStats;
      director.startCampaign('rocketeer', difficulty);
      director.completeCurrentMission({ score: 0, scrap: 10000 });
      // A new campaign must clear the upgrade ledger as well as shop levels.
      for (let i = 0; i < 8; i++) { director.advanceToNextMission(); director.completeCurrentMission({ score: 0, scrap: 0 }); }
      const resetChassisBought = director.buyShopItem('chassis');
      upgradeHistory.push({ difficulty, bought, rewardsNeverSlowReload, invalidRewardIgnored, chassisBought, actual, expected, retry,
        resetChassisBought, reset: director.getSnapshot().tankStats, resetExpected: baseline.getSnapshot().tankStats });
    }
    const sample = { ...STAGES[0], enemies: [{ id: 'test-soldier', kind: 'rifleman', x: 700, y: 350 }],
      covers: [{ ...STAGES[0].covers.find(c => c.kind === 'houseSealed'), garrison: ['rifleman', 'rocketeer'] }] };
    const before = JSON.stringify(sample);
    const one = withInfantrySquads(sample);
    const two = withInfantrySquads(sample);
    return { counts, speeds, upgradeHistory, problems, immutable: before === JSON.stringify(sample), deterministic: JSON.stringify(one) === JSON.stringify(two) };
  });
  assert.deepEqual(data.problems, []);
  assert.equal(data.immutable, true);
  assert.equal(data.deterministic, true);
  assert.deepEqual(data.counts.map(c => c.field), [18, 15, 21, 15, 15, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(data.counts.map(c => c.hidden), [3, 3, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(data.counts.map(c => c.armor), [0, 0, 0, 2, 3, 6, 6, 6, 6, 4, 7, 7, 7, 7, 5]);
  for (const [id, stock] of Object.entries({ rocketeer: 143, light: 134, medium: 117.5, heavy: 89, rifleman: 300 })) {
    const s = data.speeds[id];
    assert.equal(s.stock, stock);
    assert.equal(s.purchased, true);
    assert.equal(s.upgraded, stock + 26);
    assert.equal(s.retry, s.upgraded);
    assert.equal(s.chassisBought, id !== 'heavy');
    assert.equal(s.chassisSpeedPreserved, true);
    assert.equal(s.enginePurchases.every(Boolean), true);
    assert.equal(s.maxEngine, stock + 130);
    assert.equal(s.overCapBought, false);
    assert.equal(s.overCapWalletUnchanged, true);
  }
  const simulation = await page.evaluate(() => {
    const { game, scene, director, gamepad } = window.artReview;
    game.loop.sleep();
    const garrisons = [];
    for (let i = 0; i < 3; i++) {
      const cover = scene.covers.find(c => c.kind === 'houseSealed');
      cover.health = 0;
      const before = scene.enemies.length;
      scene.releaseHouseGarrison(cover);
      const spawned = scene.enemies.slice(before);
      scene.releaseHouseGarrison(cover);
      garrisons.push({ expected: cover.garrison.length, actual: spawned.length,
        onceOnly: scene.enemies.length === before + spawned.length,
        clear: spawned.every(e => e.x >= e.radius && e.y >= e.radius && e.x <= scene.mission.worldWidth - e.radius && e.y <= scene.mission.worldHeight - e.radius
          && !scene.covers.some(c => c.solid && c.health > 0 && Math.abs(e.x - c.x) < c.width / 2 + e.radius && Math.abs(e.y - c.y) < c.height / 2 + e.radius)) });
      if (i < 2) { director.completeCurrentMission({ score: 0, scrap: 0 }); director.advanceToNextMission(); }
    }
    director.startCampaign('rifleman', 'normal');
    const footTarget = scene.enemies[0];
    Object.assign(scene.player, { x: footTarget.x, y: footTarget.y, vx: 300, vy: 0 });
    scene.updateInfantryCrush(scene.player);
    const footCannotCrush = footTarget.alive;
    // Stock heavy can still crush exposed infantry, but not through a house.
    director.startCampaign('heavy', 'normal');
    const target = scene.enemies[0];
    const shelter = scene.covers.find(c => c.kind === 'houseOpen');
    Object.assign(target, { x: shelter.x + shelter.width / 2 - 6, y: shelter.y });
    Object.assign(scene.player, { x: shelter.x + shelter.width / 2 + scene.player.radius, y: shelter.y, vx: 89, vy: 0 });
    scene.updateHouseShelters();
    const sheltered = target.shelteredBy === shelter.id;
    scene.updateInfantryCrush(scene.player);
    const shelterPreventsCrush = target.alive;
    Object.assign(target, { x: 700, y: 350, shelteredBy: undefined });
    scene.player.x = target.x;
    scene.player.y = target.y;
    scene.player.vx = 44;
    scene.updateInfantryCrush(scene.player);
    const slowTankCannotCrush = target.alive;
    scene.player.vx = director.getSnapshot().tankStats.engine;
    scene.updateInfantryCrush(scene.player);
    const heavyCrush = !target.alive;
    director.failMission('Population retry check');
    director.continueFromMission(0);
    const retryFieldCount = scene.enemies.length;
    // Sample the most populated encounter (21 field troops + 6 hidden troops).
    director.startCampaign('medium', 'normal');
    for (let i = 0; i < 2; i++) { director.completeCurrentMission({ score: 0, scrap: 0 }); director.advanceToNextMission(); }
    const house = scene.covers.find(c => c.kind === 'houseSealed');
    house.health = 0;
    scene.releaseHouseGarrison(house);
    scene.player.x = 1150;
    scene.player.y = 520;
    scene.player.health = 100000;
    for (const e of scene.enemies) e.alerted = true;
    const startingPopulation = scene.enemies.length;
    gamepad.resetAll();
    const costs = [];
    let peakProjectiles = 0;
    for (let frame = 0; frame < 600; frame++) {
      const start = performance.now();
      scene.update(frame * 16, 16);
      costs.push(performance.now() - start);
      peakProjectiles = Math.max(peakProjectiles, scene.projectiles.length);
    }
    scene.render();
    const count = scene.children.list.length;
    for (let i = 0; i < 300; i++) scene.render();
    costs.sort((a, b) => a - b);
    return { garrisons, footCannotCrush, sheltered, shelterPreventsCrush, slowTankCannotCrush, heavyCrush,
      finiteState: scene.enemies.every(e => Number.isFinite(e.x) && Number.isFinite(e.y)),
      stableRenderObjects: scene.children.list.length === count, peakProjectiles, p95CpuMs: costs[Math.floor(costs.length * .95)],
      maxCpuMs: costs.at(-1), frames: costs.length, startingPopulation, retryFieldCount };
  });
  for (const g of simulation.garrisons) {
    assert.equal(g.actual, g.expected);
    assert.equal(g.onceOnly, true);
    assert.equal(g.clear, true);
  }
  assert.equal(simulation.footCannotCrush, true, 'An on-foot Soldier must not crush enemies');
  assert.equal(simulation.sheltered, true);
  assert.equal(simulation.shelterPreventsCrush, true, 'A house must protect sheltered infantry from crushing');
  assert.equal(simulation.slowTankCannotCrush, true);
  assert.equal(simulation.heavyCrush, true);
  for (const result of data.upgradeHistory) {
    assert.equal(result.invalidRewardIgnored, true, 'Stage rewards require an intermission');
    assert.equal(result.bought.every(Boolean), true);
    assert.equal(result.rewardsNeverSlowReload, true, 'An Auto Loader reward must never slow an upgraded gun');
    assert.equal(result.chassisBought, true);
    assert.deepEqual(result.actual, result.expected, `${result.difficulty}: chassis must preserve upgrades in acquisition order`);
    assert.deepEqual(result.retry, result.actual);
    assert.equal(result.resetChassisBought, true);
    assert.deepEqual(result.reset, result.resetExpected, 'A new campaign must clear old upgrades');
  }
  assert.equal(simulation.retryFieldCount, 18, 'Retry must not multiply the squad count again');
  assert.equal(simulation.startingPopulation, 27);
  assert.equal(simulation.finiteState, true);
  assert.equal(simulation.stableRenderObjects, true);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ ...data, simulation, errors }, null, 2));
} finally {
  await browser.close();
}
