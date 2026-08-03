# Tank Game

A new mobile-first tank-combat game forked from the Operation Iron Vengeance Phaser/Vite/Capacitor baseline.

This repository is intentionally separate from `rambo_game` so the original commando game can stay available as a reference. The runtime has been converted into a tank-combat campaign while preserving the web, Android, GitHub Pages, and APK release pipeline.

## Current Baseline Evaluation

What already works well:

- Phaser + TypeScript is a good fit for fast 2D arcade iteration.
- The game already has stage progression, enemy waves, bosses, scoring, difficulty selection, and a DOM HUD.
- Touch controls, safe-area CSS, and Capacitor Android packaging are already in place.
- GitHub Pages and Android APK workflows can deploy the web build and phone build from the same source.

What changed for the tank game:

- Combat now uses deliberate turret aiming, projectile travel, reload timing, recoil, explosions, and armor-facing damage.
- The campaign includes assault, defense, escort, capture, and boss missions.
- The battlefield includes destructible crates, concrete blocks, fuel barrels, mines, and repair pads.
- Mobile controls use a left drive stick, a right aim stick, and action buttons for cannon, rocket, artillery, and repair.
- Between missions, players choose upgrades for armor, engine, reload, shells, special cooldown, or repair capacity.

## Tank Game Plan

See [docs/TANK_GAME_PLAN.md](docs/TANK_GAME_PLAN.md) for the full design and implementation plan.

## Run Web Version

```bash
npm install
npm run dev
```

## Android Phone Build

```bash
npm install
npm run android:sync
npm run android:run
```

For a physical phone, enable Developer Options, enable USB debugging, connect the phone over USB, accept the RSA debugging prompt, then run `npm run android:run`.

See [docs/ANDROID_LOCAL_SETUP.md](docs/ANDROID_LOCAL_SETUP.md) for APK build, phone install, emulator, and GitHub Release download instructions.

## GitHub Deployment

- GitHub Pages deploys the browser version from `.github/workflows/deploy-pages.yml`.
- `.github/workflows/android-apk.yml` builds a debug APK on `main` and publishes a prerelease APK when an `android-v*` tag is pushed.

Create a shareable APK prerelease after pushing the repo:

```bash
git tag android-v0.1.0
git push origin android-v0.1.0
```

The prerelease asset will be named `tank-game-debug.apk`.
