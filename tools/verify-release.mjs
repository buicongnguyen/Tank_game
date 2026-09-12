// Validate built /Tank_game/ paths locally, or set ART_RELEASE_URL for the live site.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, sep, extname } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = process.argv[2] ? require(resolve(process.argv[2])) : require('playwright');
const hash = data => createHash('sha256').update(data).digest('hex');
const dist = resolve('dist');
const atlasHash = hash(await readFile(resolve(dist, 'art/blender/combat.png')));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
let server;
let browser;
try {
  let url = process.env.ART_RELEASE_URL;
  if (!url) {
    server = createServer(async (req, res) => {
      try {
        const path = new URL(req.url, 'http://localhost').pathname;
        assert.ok(path.startsWith('/Tank_game/'));
        const file = resolve(dist, decodeURIComponent(path.slice('/Tank_game/'.length)) || 'index.html');
        assert.ok(file.startsWith(`${dist}${sep}`));
        const data = await readFile(file);
        res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise(done => server.listen(0, '127.0.0.1', done));
    url = `http://127.0.0.1:${server.address().port}/Tank_game/`;
  }
  browser = await chromium.launch({ headless: true });
  await mkdir('artifacts/blender-review', { recursive: true });
  const results = [];
  for (const mobile of [false, true]) {
    const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1366, height: 900 }, isMobile: mobile, hasTouch: mobile });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const atlasResponse = page.waitForResponse(response => response.url().endsWith('/art/blender/combat.png'));
    await page.goto(url);
    const response = await atlasResponse;
    assert.equal(response.status(), 200);
    assert.equal(hash(await response.body()), atlasHash, 'The loaded atlas must match this build');
    await page.getByRole('button', { name: 'Start Campaign', exact: true }).click();
    await page.getByRole('button', { name: 'Pause and open mission info' }).click();
    await page.getByRole('button', { name: 'Resume Mission', exact: true }).click();
    const device = mobile ? 'mobile' : 'desktop';
    await page.screenshot({ path: `artifacts/blender-review/release-${device}.png` });
    assert.deepEqual(errors, []);
    results.push({ device, atlasStatus: response.status(), atlasMatchesBuild: true, startPauseResume: true, pageErrors: errors });
    await page.close();
  }
  console.log(JSON.stringify({ url, results }, null, 2));
} finally {
  await browser?.close();
  if (server) await new Promise(done => server.close(done));
}
