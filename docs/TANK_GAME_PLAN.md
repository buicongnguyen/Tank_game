# Tank Game Plan

## Goal

Turn the Operation Iron Vengeance baseline into a more focused mobile arcade tank game. The target experience is a short-session top-down tank campaign that feels good on Android first, while still running as a web game on GitHub Pages.

Working title: **Tank Game: Steel Front**.

## Design Evaluation Of The Current Game

The current game is a strong prototype foundation because it already solves the hard wrapper problems: Phaser rendering, responsive layout, mobile touch controls, staged missions, bosses, scoring, audio startup after user input, and Capacitor Android packaging. It is useful as a technical and deployment reference.

The fun ceiling is limited by three things:

1. The player fantasy is broad. A commando shooter can do many things, but the moment-to-moment decisions are mostly move, fire, survive.
2. Combat is not tactical enough yet. Auto-targeting reduces friction, but it also reduces the satisfaction of lining up shots, using cover, and outplaying enemies.
3. Stages need more memorable shape. Enemy waves and bosses work, but tanks benefit from terrain, shell angles, ambush lanes, and visible objectives.

The tank version should become more interesting by giving players clear tactical verbs: drive, angle armor, aim the turret, fire high-impact shells, break cover, retreat to repair, and choose upgrades.

## Core Pitch

A compact top-down tank action game where the player pilots a customizable tank through hostile battlefields, destroys armored convoys, captures forward bases, and defeats oversized war machines.

Each mission should last 2-4 minutes on phone. The player should feel powerful, but not careless: positioning, reload timing, armor facing, and terrain choices should matter.

## Player Verbs

- Drive with weight: acceleration, braking, turn radius, and optional tread skid.
- Aim turret independently from tank movement.
- Fire cannon shells with reload timing and travel time.
- Use a secondary weapon: machine gun, rockets, mines, or flamethrower.
- Trigger a special ability: smoke screen, repair pulse, artillery strike, or overdrive.
- Collect scrap and choose upgrades between missions.

## Main Fun Changes

1. **Shell Physics**
   - Cannon shells travel visibly, collide with cover, and explode with splash damage.
   - Some shells ricochet from armored enemies or hard walls at shallow angles.
   - Heavy shots should feel chunky: recoil, flash, trail, impact, and pause/shake.

2. **Armor And Positioning**
   - Tanks take less damage from the front and more from the rear.
   - Enemies try to flank or force the player out of cover.
   - Bosses expose weak points during attack recovery windows.

3. **Destructible Battlefields**
   - Wooden cover breaks quickly.
   - Concrete blocks absorb several shells.
   - Fuel barrels explode.
   - Bridges, gates, barricades, mud, mines, and repair pads shape the route.

4. **Mission Variety**
   - Assault: destroy enemy armor and push to extraction.
   - Defense: hold a radio tower while waves attack.
   - Escort: protect a supply truck through ambush points.
   - Capture: control three zones while artillery fires.
   - Boss: defeat a rail cannon, fortress tank, or missile carrier.

5. **Upgrade Loop**
   - Earn scrap from kills, objectives, and clean clears.
   - Pick one upgrade after each mission: armor, reload speed, engine, shell type, special cooldown, or repair capacity.
   - Keep upgrades simple and visible so phone players understand them fast.

## Mobile Control Plan

- Left virtual stick: tank movement.
- Right aim pad or drag zone: turret direction.
- Fire button: cannon.
- Small secondary button: machine gun or rockets.
- Special button: smoke, repair, artillery, or overdrive.
- Optional auto-aim assist for accessibility, but manual aim should be the default fun path.

The HUD should prioritize health, reload, special charge, objective, and upgrade pickup prompts. Avoid showing too much mission text during combat.

## Implementation Phases

### Phase 1: Fork Foundation

- Keep Vite, Phaser, TypeScript, Capacitor, GitHub Pages, and Android APK workflow.
- Rename app metadata, package id, docs, and deployment artifact names.
- Keep the copied game code as a reference baseline.

### Phase 2: Tank Movement Prototype

- Replace player infantry movement with tank body movement.
- Add separate turret rotation.
- Add cannon fire with reload and recoil.
- Keep one test arena and a few stationary targets.

### Phase 3: Combat Systems

- Add projectile travel, explosions, hit reactions, armor facings, and cover collision.
- Add enemy tanks with simple pursuit, strafing, retreat, and firing behavior.
- Add destructible battlefield props.

### Phase 4: Mission Structure

- Convert the current stage data into tank mission definitions.
- Add objective types: assault, defense, escort, capture, boss.
- Add mission start/clear/fail screens tailored to the tank theme.

### Phase 5: Upgrades And Replay

- Add scrap rewards.
- Add three-choice upgrade selection between missions.
- Add a simple garage screen showing tank stats.
- Add difficulty tuning for short Android sessions.

### Phase 6: Polish And Release

- Replace inherited commando sprites with tank sprites and battlefield props.
- Add sound effects for engine, cannon, shell impact, explosion, reload, and upgrade pickup.
- Add phone QA pass: portrait/landscape, safe areas, app resume, audio, frame rate, install flow.
- Publish web version through GitHub Pages and debug APK through GitHub Releases.

## First Playable Milestone

The first fun milestone should be a single arena mission:

- Player tank drives with weight.
- Turret aims independently.
- Cannon shells hit destructible cover and enemy tanks.
- One objective: destroy the convoy before it exits.
- One reward screen: choose armor, reload, or engine upgrade.
- Android debug APK builds from GitHub Actions.

This is the smallest version that proves the new game is actually a tank game rather than only a renamed commando game.
