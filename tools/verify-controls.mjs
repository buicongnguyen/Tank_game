// Browser regression checks: node tools/verify-controls.mjs [Playwright directory]
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = process.argv[2] ? require(resolve(process.argv[2])) : require('playwright');
const base = process.env.ART_REVIEW_URL ?? 'http://127.0.0.1:5182';
const out = 'artifacts/control-review';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
const results = [];
const sizes = [[320, 568, true], [390, 844, true], [640, 360, true], [844, 390, true], [1024, 768, true], [1366, 900, false], [640, 480, false]];
try {
  for (const [width, height, mobile] of sizes) {
    const page = await browser.newPage({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${base}/tools/art-review.html?controls`);
    await page.getByRole('button', { name: 'Start Campaign', exact: true }).click();
    await page.waitForFunction(() => !!window.artReview?.scene?.player);
    await page.evaluate(() => {
      const { scene, gamepad, director } = window.artReview;
      director.grantWeapon('machineGun');
      scene.player.health = 50000;
      window.controlTaps = 0;
      const trigger = gamepad.triggerAction.bind(gamepad);
      gamepad.triggerAction = (id, action) => {
        if (action === 'fire') { window.controlTaps++; window.tapHeading = scene.aimHeading; }
        trigger(id, action);
      };
    });
    await page.locator('[data-swap-button]').waitFor({ state: 'visible' });
    const layout = await page.evaluate(() => {
      const pad = selector => {
        const e = document.querySelector(selector), r = e.getBoundingClientRect();
        const knob = e.querySelector('.touch-stick-knob').getBoundingClientRect();
        const label = e.querySelector('.touch-stick-label');
        return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2,
          label: getComputedStyle(label).display !== 'none', radius: (r.width - knob.width) / 2 - 3 };
      };
      const buttons = [...document.querySelectorAll('.touch-button')].filter(e => e.getBoundingClientRect().width > 0).map(e => {
        const r = e.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      });
      return { drive: pad('.tank-drive-stick'), aim: pad('.tank-aim-stick'), buttons, scroll: document.documentElement.scrollWidth > innerWidth };
    });
    const inside = r => r.x >= 0 && r.y >= 0 && r.x + r.w <= width + 1 && r.y + r.h <= height + 1;
    const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    assert.ok(inside(layout.drive), 'Drive pad stays on screen');
    assert.equal(layout.scroll, false);
    assert.ok(layout.buttons.every(r => inside(r) && r.w >= 44 && r.h >= 44), 'Action targets remain reachable');
    for (const r of layout.buttons) assert.equal(overlaps(r, layout.drive), false, 'Actions do not overlap drive');
    assert.equal(layout.drive.label, true);
    if (mobile) {
      assert.equal(layout.drive.w, layout.aim.w, 'Matching mobile pad sizes');
      assert.equal(layout.drive.y, layout.aim.y, 'Matching mobile pad baseline');
      assert.equal(layout.aim.label, true);
      assert.ok(inside(layout.aim));
      for (const r of layout.buttons) assert.equal(overlaps(r, layout.aim), false, 'Actions do not overlap aim');
    } else {
      assert.equal(layout.aim.w, 0, 'Existing desktop mouse/fire controls retained');
    }
    const state = () => page.evaluate(() => ({
      drive: window.artReview.gamepad.getDriveAxis(), aim: window.artReview.gamepad.getAimAxis(),
      fire: window.artReview.gamepad.isDown(1, 'fire'), taps: window.controlTaps,
      engaged: [...document.querySelectorAll('[data-shell]')].map(e => e.dataset.engaged),
      firing: document.querySelector('.tank-aim-stick').dataset.firing,
    }));
    const assertNubInside = async selector => assert.equal(await page.locator(selector).evaluate(e => {
      const r = e.getBoundingClientRect(), n = e.querySelector('.touch-stick-knob').getBoundingClientRect();
      return Math.hypot(n.x + n.width / 2 - r.x - r.width / 2, n.y + n.height / 2 - r.y - r.height / 2) + n.width / 2 <= r.width / 2 - 2;
    }), true, 'Nub stays inside the circle even at maximum deflection');
    if (mobile) {
      const cdp = await page.context().newCDPSession(page);
      const send = async (type, points) => {
        await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
        // Chromium coalesces touchmove; let both DOM and Phaser process it.
        await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
      };
      const d = { x: layout.drive.cx, y: layout.drive.cy, id: 1 };
      const a = { x: layout.aim.cx, y: layout.aim.cy, id: 2 };
      // Resting thumb dead zone, then full diagonal movement.
      await send('touchStart', [d]);
      await send('touchMove', [{ ...d, x: d.x + 2 }]);
      assert.deepEqual((await state()).drive, { x: 0, y: 0 });
      const moving = { ...d, x: d.x + 65, y: d.y - 65 };
      await send('touchMove', [moving]);
      await send('touchStart', [moving, a]);
      const aiming = { ...a, x: a.x - 65, y: a.y - 65 };
      await send('touchMove', [moving, aiming]);
      await page.waitForFunction(() => window.artReview.gamepad.isDown(1, 'fire'));
      let s = await state();
      assert.ok(s.drive.x > .6 && s.drive.y < -.6 && s.aim.x < -.6 && s.aim.y < -.6, JSON.stringify(s));
      assert.equal(s.fire, true);
      assert.equal(s.firing, 'true');
      assert.equal(s.taps, 0, 'Pad presses do not leak onto battlefield');
      await assertNubInside('.tank-drive-stick');
      await assertNubInside('.tank-aim-stick');
      await page.screenshot({ path: `${out}/${width}x${height}-engaged.png` });
      // A third finger can swap the selected weapon without releasing either stick.
      const previousWeapon = await page.evaluate(() => window.artReview.scene.snapshot.selectedWeapon);
      const swapBox = await page.locator('[data-swap-button]').boundingBox();
      const swap = { x: swapBox.x + swapBox.width / 2, y: swapBox.y + swapBox.height / 2, id: 4 };
      await send('touchStart', [moving, aiming, swap]);
      await send('touchEnd', [swap]);
      assert.notEqual(await page.evaluate(() => window.artReview.scene.snapshot.selectedWeapon), previousWeapon);
      assert.equal((await state()).fire, true);
      assert.ok((await state()).drive.x > .6);
      // Releasing aim leaves the drive finger active.
      await send('touchEnd', [aiming]);
      s = await state();
      assert.equal(s.fire, false);
      assert.ok(s.drive.x > .6);
      // Battlefield taps must override a previously released stick heading.
      const target = { x: Math.round(width * .75), y: Math.round(height * .42), id: 3 };
      await page.evaluate(() => {
        const { scene } = window.artReview;
        scene.secondaryTimer = 0;
        scene.magazineReloadTimer = 0;
        scene.ammo = 20;
      });
      await send('touchStart', [moving, target]);
      await send('touchEnd', [target]);
      await page.waitForFunction(() => window.controlTaps === 1);
      s = await state();
      assert.deepEqual(s.aim, { x: 0, y: 0 }, 'Released stick does not override battlefield aim');
      assert.ok(s.drive.x > .6);
      assert.equal(await page.evaluate(() => Math.abs(window.artReview.scene.player.turretAngle - window.tapHeading) < .001
        && window.artReview.scene.ammo < 20), true, 'Battlefield tap changes actual turret direction and fires while driving');
      await send('touchEnd', []);
      assert.deepEqual((await state()).drive, { x: 0, y: 0 });
      // Reserved bottom-left outside the pad must not aim/fire.
      await page.touchscreen.tap(5, Math.round(height * .65));
      assert.equal((await state()).taps, 1);
      // Centre tap fires once; cancel and lost capture must not count as taps.
      await send('touchStart', [a]);
      await send('touchEnd', []);
      assert.equal((await state()).taps, 2);
      await send('touchStart', [a]);
      await send('touchCancel', []);
      assert.equal((await state()).taps, 2);
      await page.locator('.tank-aim-stick').evaluate(e => {
        e.addEventListener('pointerdown', event => { window.aimOwner = event.pointerId; }, { once: true });
      });
      await send('touchStart', [a]);
      // Apply pending capture before explicitly losing it.
      await send('touchMove', [{ ...a, x: a.x + 1 }]);
      await page.locator('.tank-aim-stick').evaluate(e => {
        // Chromium touch pointer ids need not equal CDP touch identifiers.
        e.releasePointerCapture(window.aimOwner);
      });
      await send('touchMove', [{ ...a, x: a.x + 2 }]);
      await send('touchEnd', []);
      assert.equal((await state()).taps, 2);
      // Rotation/resizing and blur release both gesture owners without firing.
      await send('touchStart', [d, a]);
      await send('touchMove', [moving, aiming]);
      await page.setViewportSize({ width: height, height: width });
      await page.waitForFunction(() => [...document.querySelectorAll('[data-shell]')].every(e => e.dataset.engaged === 'false'));
      s = await state();
      assert.deepEqual(s.drive, { x: 0, y: 0 });
      assert.equal(s.fire, false);
      assert.deepEqual(s.engaged, ['false', 'false']);
      await send('touchCancel', []);
      await page.setViewportSize({ width, height });
      await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
      await send('touchStart', [d, a]);
      await send('touchMove', [moving, aiming]);
      await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      assert.equal((await state()).fire, false);
      assert.deepEqual((await state()).drive, { x: 0, y: 0 });
      await send('touchCancel', []);
      await cdp.detach();
    } else {
      await page.mouse.move(layout.drive.cx, layout.drive.cy);
      await page.mouse.down();
      await page.mouse.move(layout.drive.cx + 90, layout.drive.cy - 90);
      assert.ok((await state()).drive.x > .6);
      await assertNubInside('.tank-drive-stick');
      await page.mouse.up();
      assert.deepEqual((await state()).drive, { x: 0, y: 0 });
      await page.locator('.desktop-fire-button').hover();
      await page.mouse.down();
      assert.equal((await state()).fire, true);
      await page.mouse.up();
      assert.equal((await state()).fire, false);
    }
    await page.screenshot({ path: `${out}/${width}x${height}-${mobile ? 'touch' : 'desktop'}.png` });
    await page.close();
    results.push({ width, height, mobile, layout: 'passed', input: 'passed' });
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ results, errors }, null, 2));
} finally {
  await browser.close();
}
