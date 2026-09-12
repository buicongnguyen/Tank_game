// Optional browser checks: node tools/verify-blender.mjs [Playwright package directory]
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = process.argv[2] ? require(resolve(process.argv[2])) : require('playwright');
const base = process.env.ART_REVIEW_URL ?? 'http://127.0.0.1:5182';
const output = resolve('artifacts/blender-review');
await mkdir(output, { recursive: true });
const atlas = JSON.parse(await readFile('public/art/blender/combat.json', 'utf8'));
assert.equal(Object.keys(atlas.frames).length, 37);
assert.ok(atlas.meta.size.w <= 2048 && atlas.meta.size.h <= 2048);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/tools/art-review.html`);
  await page.waitForFunction(() => window.artReview?.scene?.textures?.exists('blender-combat'));
  await page.getByRole('button', { name: 'Start Campaign', exact: true }).click();
  await page.waitForFunction(() => !!window.artReview.scene.player);
  await page.evaluate(() => window.artReview.pose());
  await page.screenshot({ path: `${output}/battlefield.png` });
  const result = await page.evaluate(() => {
    const { scene, director } = window.artReview;
    const unit = scene.blenderSprites.units.get('player');
    const originalHullAngle = unit.hull.rotation;
    scene.player.turretAngle += Math.PI / 2;
    scene.render();
    const independent = unit.hull.rotation === originalHullAngle && Math.abs(unit.turret.rotation - scene.player.turretAngle) < .001;
    const initialCount = scene.children.list.length;
    for (let i = 0; i < 300; i++) scene.render();
    const stableCount = scene.children.list.length === initialCount;
    const cover = scene.covers.find(c => c.kind === 'houseOpen');
    const drawnCoverIds = [];
    for (const method of ['drawCoverCrate', 'drawCoverBarrel', 'drawCoverBuilding', 'drawCoverRockWall', 'drawCoverHouse']) {
      const original = scene[method].bind(scene);
      scene[method] = (graphics, c) => { drawnCoverIds.push(c.id); return original(graphics, c); };
    }
    scene.staticLayerDirty = true;
    scene.render();
    const restoredCover = scene.covers.every(c => drawnCoverIds.includes(c.id))
      && !scene.children.list.some(c => c.type === 'Image' && String(c.frame?.name).startsWith('prop-'));
    const soldier = scene.enemies.find(e => e.kind === 'rifleman');
    soldier.shelteredBy = cover.id;
    scene.render();
    const sheltered = !scene.blenderSprites.units.get(soldier.id).turret.visible;
    soldier.shelteredBy = undefined;
    soldier.alive = false;
    cover.health = 0;
    drawnCoverIds.length = 0;
    scene.staticLayerDirty = true;
    scene.render();
    const removed = !scene.blenderSprites.units.get(soldier.id).hull.visible
      && !drawnCoverIds.includes(cover.id);
    const oldImage = unit.hull;
    director.failMission('Art review retry');
    director.continueFromMission(0);
    scene.render();
    const reset = !oldImage.scene && scene.blenderSprites.units.get('player').hull !== oldImage;
    return { independent, stableCount, sheltered, removed, reset, restoredCover, units: scene.blenderSprites.units.size };
  });
  for (const key of ['independent', 'stableCount', 'sheltered', 'removed', 'reset', 'restoredCover']) assert.equal(result[key], true, key);
  const weaponSwitch = await page.evaluate(() => {
    const { scene, director } = window.artReview;
    director.grantWeapon('machineGun');
    scene.render();
    const guns = scene.blenderSprites.weapons;
    const twin = guns.get('player-gun').visible && guns.get('player-gun-2').visible;
    director.grantWeapon('railgun');
    scene.render();
    const single = guns.get('player-gun').frame.name === 'weapon-rail' && !guns.get('player-gun-2').visible;
    director.grantWeapon('drone');
    scene.render();
    const drone = guns.get('player-gun').frame.name === 'weapon-drone' && guns.get('player-gun-2').visible;
    return { twin, single, drone };
  });
  assert.deepEqual(weaponSwitch, { twin: true, single: true, drone: true });
  await page.evaluate(() => {
    window.artReview.director.completeCurrentMission({ score: 100, scrap: 500 });
  });
  await page.getByRole('button', { name: 'Enter Shop', exact: true }).click();
  await page.locator('.blender-unit-preview').evaluate(img => img.decode());
  await page.screenshot({ path: `${output}/shop-desktop.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${output}/shop-mobile.png` });
  const shop = await page.evaluate(() => {
    const img = document.querySelector('.blender-unit-preview');
    const actions = document.querySelector('.overlay-footer-actions').getBoundingClientRect();
    return { imageLoaded: img.naturalWidth === 384, noDocumentScroll: document.documentElement.scrollHeight <= innerHeight,
      footerVisible: actions.top >= 0 && actions.bottom <= innerHeight };
  });
  assert.deepEqual(shop, { imageLoaded: true, noDocumentScroll: true, footerVisible: true });
  // Missing atlas must retain playable vector art, not crash or show missing-texture squares.
  const fallback = await browser.newPage();
  fallback.on('pageerror', e => errors.push(e.message));
  await fallback.route('**/art/blender/combat.*', route => route.abort());
  await fallback.goto(`${base}/tools/art-review.html`);
  await fallback.waitForFunction(() => window.artReview?.scene?.sys?.isActive());
  await fallback.getByRole('button', { name: 'Start Campaign', exact: true }).click();
  assert.equal(await fallback.evaluate(() => window.artReview.scene.blenderSprites.units.size), 0);
  assert.deepEqual(errors, []);
  // A real touch viewport and the production entry point, in addition to the fixture.
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  phone.on('pageerror', e => errors.push(e.message));
  await phone.goto(base);
  await phone.getByRole('button', { name: /^Mini Tank HP/ }).click();
  await phone.getByRole('button', { name: 'Start Campaign', exact: true }).click();
  await phone.getByRole('button', { name: 'Pause and open mission info' }).waitFor();
  await phone.locator('.touch-aim-control').tap();
  await phone.waitForTimeout(800);
  await phone.screenshot({ path: `${output}/game-mobile.png` });
  assert.equal(await phone.locator('body').getAttribute('data-touch-mode'), 'true');
  await phone.getByRole('button', { name: 'Pause and open mission info' }).click();
  await phone.getByRole('button', { name: 'Resume Mission', exact: true }).click();
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ atlasFrames: 37, ...result, weaponSwitch, shop, mobile: 'passed', fallback: 'passed', browserErrors: errors }, null, 2));
} finally {
  await browser.close();
}
