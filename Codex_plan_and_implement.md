# Codex Plan and Implementation Handoff

## Purpose

This document summarizes the changes made to `Tank_game` so another reviewer can understand the intent, inspect the implementation, and identify regressions or follow-up work.

The work was based on comparison with the sibling `../rambo_game` repository and on a full pass through the Tank Game controls, campaign state, shop economy, combat logic, rendering, and mobile layout.

## User Requests Addressed

1. Move the mobile movement control to the bottom-left, matching `rambo_game`.
2. Review the game code and gameplay logic for defects.
3. Investigate and improve mobile smoothness.
4. Change mobile gun aiming so tapping the battlefield points the turret in that direction.
5. Add an end-of-stage button that opens a usable shop for weapon and vehicle purchases/upgrades.
6. Reserve the lower-left area exclusively for movement and replace the mobile cannon button with a smaller right-side aim/fire stick.
7. Support a second simultaneous battlefield touch while moving so it aims and fires the cannon.
8. Make normal aim/fire use the currently selected weapon immediately after swapping, without a separate secondary button.
9. Shorten Mission 7, Relay Hold, to a mobile-friendly objective duration.
10. Rebalance destructible cover and add durable rock walls.
11. Allow a failed campaign to continue from any previously played stage.
12. Expand tank and gun silhouettes, add a suicide drone, make the Mini Tank use a burst machine gun, and rebalance campaign upgrades.
13. Sort weapons and their upgrade potential from lower to higher so the arsenal has an understandable progression.
14. Fix the desktop start screen so the campaign entry action cannot be clipped below the game frame.

## Implementation Summary

### 0. Mission pacing

- Shortened Mission 7, Relay Hold, from 105 seconds to 30 seconds of accumulated relay control time.
- The objective HUD and victory check both read the same stage duration, so the displayed countdown and completion timing remain synchronized.

### 0.1 Destructible cover durability

- Structural durability now uses direct ordnance hits rather than raw combat damage, keeping cover behavior predictable across tank classes and weapon upgrades.
- Wooden crates break from one direct tank shell.
- Sealed brick houses withstand three direct ordnance hits and release any hidden garrison when destroyed.
- Breached concrete shelters withstand four direct ordnance hits and continue to admit and protect infantry through their visible opening.
- Rock walls were added to the shared battlefield cover layout and withstand eight direct ordnance hits, twice the durability of a concrete shelter.
- Soldier small-arms rounds deal one-quarter structural damage; rockets and vehicle shells deal one full structural hit. Explosion splash is normalized into partial structural damage.

### 0.2 Failure recovery and stage selection

- The Mission Failed overlay lists every campaign stage, enables only missions the player has already reached, and marks the failed mission as the retry option.
- A prominent `Retry Current Stage` button immediately restarts the failed mission without resetting the campaign or requiring a stage selection.
- Continuing from a selected mission preserves the current unit, weapons, upgrades, credits, salvage, score, and difficulty.
- Starting a completely new campaign remains available as a separate action.
- Completed-stage progress is tracked as a furthest-reached frontier, so replaying an earlier mission cannot unlock later stages twice or remove weapons already earned farther into the campaign.

### 0.3 Tank assets, weapons, and campaign balance

Files:

- `src/game/data/progression.ts`
- `src/game/data/playerClasses.ts`
- `src/game/data/weapons.ts`
- `src/game/render/tankArt.ts`
- `src/game/scenes/BattleScene.ts`
- `src/game/core/GameDirector.ts`
- `src/game/ui/InterfaceController.ts`
- `src/style.css`

Changes:

- Added a dedicated compact Mini Tank battlefield silhouette with a short tracked hull, broad cupola, twin barrels, and sensor mast. The shop silhouette also shows its twin machine guns.
- Player weapon mounts now change shape with the selected weapon: twin machine/autocannon barrels, large launcher tube, short mortar tube, long rail/laser gun, or side-mounted drone racks.
- Mini Tank now starts with Machine Gun instead of Launcher. One trigger fires eight small bullets in a rapid burst; its base damage, reload cycle, velocity, and magazine were retuned around sustained fire.
- Added the purchasable Suicide Drone. It flies over cover, seeks the closest live enemy, and detonates with a large blast. The projectile has a distinct quad-rotor drawing and the tank displays drone racks while it is selected.
- Added `TEST_MODE` in `playerClasses.ts`. It is currently enabled, so all five units remain selectable at campaign start. Disabling it makes Soldier the only starter; other chassis remain depot purchases.
- Chassis purchases now have campaign milestones: Mini after Mission 2, Small after Mission 5, Medium after Mission 8, and Heavy after Mission 12. Prices scale with the tier.
- Upgrading chassis preserves the previous chassis basic weapon, so buying a larger tank does not remove the Mini Tank machine gun or another already acquired loadout.
- Added a 15-step progression table that raises enemy health, damage, and firing pressure while pairing each mission with a recommended upgrade and tactical reason.
- Pause, debrief, depot, and campaign-route UI now expose threat level and the recommended counter-upgrade.
- Mission rewards were increased so every successful stage funds at least one meaningful depot decision; this supports the intended upgrade loop instead of forcing several no-purchase stages.
- Ridge Bombard was reduced from 120 seconds to 45 seconds, matching the shorter mobile defense pacing established for Relay Hold.

### 0.4 Weapon potential progression

- Added one canonical potential ranking for every weapon. The base bands progress from starter equipment (tier 1), through standard and specialist weapons (tiers 2-4), to end-game systems (tier 5).
- The depot and weapon-swap sequence now use the same low-to-high ordering instead of mixing early and late weapons.
- Every weapon card displays its current potential, maximum potential, and tactical role. Each paid weapon level adds one potential point, matching the existing damage, velocity, and cooldown improvements.
- Weapon prices now follow clearer strength bands: standard weapons are affordable early, specialist weapons require mid-campaign investment, and drone/railgun/laser systems carry end-game prices.
- Tactical roles remain visible because a higher potential rating does not make a specialist weapon universally better at every range or against every target.

Base potential order:

1. Rifle — tier 1.
2. Launcher, Rocket, Shotgun, and Machine Gun — tier 2.
3. Flamer, Autocannon, Scattergun, and Mortar — tier 3.
4. Gas Bomb, Sniper, and Homing Missile — tier 4.
5. Suicide Drone, Railgun, and Laser — tier 5.

### 0.5 Combat feedback evaluation and implementation plan

Evaluation findings:

- Projectile collision, swept-hit detection, weapon silhouettes, and large explosion rendering already provide a solid mechanical base.
- Firing feedback is too generic: there is no muzzle flash, recoil barely varies, and every weapon is reduced to either the cannon or rocket sound.
- A direct hit from a zero-blast weapon creates no impact visual or sound because only blast-radius hits create an explosion.
- Shield absorption is visible only as a smaller HUD value. Armor facing, rear-hit vulnerability, and shelter mitigation are represented only by an unlabelled floating number.
- Targets receive no short hit flash or readable physical jolt, so even damaging shots can look as if they passed through.
- Reusing the full explosion effect for every bullet would be noisy and expensive on mobile, especially for machine-gun bursts.

Implementation plan:

1. Give every weapon a feedback style that describes its fire character independently from damage balance.
2. Add short-lived, capped muzzle-flash and impact-effect runtimes rendered through the existing shared Phaser graphics layers.
3. Create distinct kinetic, explosive, rail, energy, flame, chemical, and shield responses without adding bitmap downloads or per-hit DOM elements.
4. Add a brief target flash, modest velocity impulse, and clear `FRONT`, `REAR`, `COVER`, or `SHIELD` hit text so armor behavior is understandable during play.
5. Expand procedural WebAudio cues for rifles, automatic weapons, heavy cannons, mortars, railguns, energy weapons, flames, and shields.
6. Cap effect counts and camera-shake frequency, then validate desktop and mobile layouts/performance before performing a separate code and logic review.

Review findings fixed after implementation:

- Simultaneous shotgun/scattergun pellets initially repeated launch recoil and muzzle/audio feedback for every pellet. They now produce one launch event per trigger, while genuinely timed bursts still react for every round.
- Area damage initially created duplicate impact objects at the explosion center for every affected target. Splash now relies on the explosion plus the target flash/label.
- Gas-cloud pulses initially inherited cannon knockback through the generic area-damage path. Area damage now preserves its weapon feedback style, and chemical damage applies no physical impulse.
- Repeated pellet explosions could restart camera shake several times in one frame. World shake now has a short cooldown.
- Explosion, muzzle, impact, and floating-text collections all have explicit caps so sustained automatic fire cannot grow visual work without bound.

### 0.6 Desktop campaign-entry visibility

- The five-chassis test-mode selector made the start card approximately 898 px tall while a 1280x720 desktop game frame provided only about 603 px. Because the frame intentionally hides overflow, `Start Campaign` was rendered below the visible frame.
- The menu now has a definite height derived from the game frame and two explicit rows: a configuration region and a persistent deployment footer.
- The desktop card is wider, all five units share one row, and title, description, selector, and spacing sizes are compacted. The entire setup now fits on the first visible page without internal scrolling; scrolling remains available only as a safety fallback.
- Browser checks confirmed the full first page and button are visible, and that the button starts Mission 1, at 901x600, 1024x768, 1280x720, 1366x768, 1440x900, and 1920x1080.
- Mobile regression checks passed at 844x390 and 390x844 with no horizontal overflow or console warnings/errors.

### 1. Mobile movement and aiming

Files:

- `src/game/ui/TouchControls.ts`
- `src/game/scenes/BattleScene.ts`
- `src/game/ui/InterfaceController.ts`
- `src/style.css`

Changes:

- Anchored the movement stick closer to the bottom-left with safe-area-aware offsets.
- Reserved the full lower-left control zone for movement so touches there cannot reach the battlefield aim handler.
- Added a smaller fixed right-side aim/fire stick. Dragging establishes the turret direction before firing; a centered tap fires along the current heading.
- The right stick retains its selected heading after release, preventing aim drift while the tank moves.
- Normal fire, battlefield touch-fire, and the right aim/fire stick all use the currently selected weapon.
- Removed the redundant mobile secondary-weapon fire button; the swap button now displays the active weapon and level.
- Added tap-to-aim through Phaser pointer-down and pointer-move events.
- Configured Phaser with three active touch pointers for simultaneous movement, aiming, and actions.
- A battlefield touch aims and queues one cannon shot without releasing any other held touch input.
- Desktop mouse input still supports mouse aiming and click-to-fire.
- Action-button events remain in the DOM overlay and no longer cause the turret to jump toward a button location.
- Updated the displayed mobile control instructions.

Expected mobile control layout:

- Bottom-left: movement stick.
- Bottom-right: smaller aim/fire stick plus weapon swap, artillery, and repair buttons.
- Remaining battlefield: tap to aim and fire once, or drag to adjust the turret direction.

### 2. Mobile performance improvements

Files:

- `src/game/scenes/BattleScene.ts`
- `src/style.css`

Changes:

- Reduced HUD DOM rebuilding from every simulation frame to once every 100 ms.
- Stopped redrawing the battle scene continuously while the game is in a menu, paused, intermission, game-over, or victory state.
- Culled off-screen tanks, covers, capture zones, pickups, projectiles, and explosions before issuing vector drawing commands.
- Limited terrain and exit-lane drawing to the visible camera area plus a safety margin.
- Disabled expensive `backdrop-filter` effects for mobile/coarse-pointer layouts.
- Preserved 60 Hz simulation updates while reducing DOM and graphics work.

### 3. Combat and gameplay logic fixes

File:

- `src/game/scenes/BattleScene.ts`

Changes:

- Added swept projectile collision checks between the projectile's previous and current positions.
- Fast projectiles such as railgun and sniper rounds should no longer pass through infantry, tanks, mines, or thin cover between frames.
- Piercing projectiles now process intersected targets in travel order within the same frame.
- Cover collision selects the nearest cover intersected by the projectile segment.
- Enemy rounds use swept checks against both the player and escort vehicle.
- Added collision separation for non-infantry vehicles so tanks no longer drive through each other.
- Preserved infantry crushing by excluding infantry from vehicle separation.
- Prevented destroyed mines from triggering later as invisible mines.
- Delayed burst shots, gas pulses, artillery impacts, mission completion, and mission failure callbacks are guarded by a mission generation ID.
- Phaser delayed events are paused during the game's paused phase.
- Old delayed attacks therefore cannot leak into a new mission.

### 4. Live score, credits, and class loadouts

Files:

- `src/game/core/GameDirector.ts`
- `src/game/data/weapons.ts`

Changes:

- Score and collected credits now emit updated session snapshots, so the live HUD is not permanently stale.
- Mission completion avoids an unnecessary intermediate score emission.
- Mission-zero weapons are treated as class-specific loadouts.
- Rifleman, Rocketeer, and tank classes no longer receive all three starting weapons automatically.
- The mobile weapon-swap button stays hidden until a second weapon is actually available.

### 5. Stage-clear and shop navigation

Files:

- `src/game/ui/InterfaceController.ts`
- `src/style.css`

New flow after a non-final mission:

1. The mission-clear/debrief screen appears.
2. The player can select **Enter Shop** or **Deploy Without Shopping**.
3. **Enter Shop** opens a dedicated Field Depot view.
4. The shop provides **Back to Debrief** and **Deploy** actions.
5. Purchases refresh the shop while preserving the shop view.

The shop view is wider than the normal overlay, scrollable on small screens, and keeps its navigation actions visible at the bottom.

### 6. Economy and vehicle upgrades

Files:

- `src/game/core/GameDirector.ts`
- `src/game/data/shop.ts` (existing stat definitions used without structural changes)
- `src/game/types.ts`
- `src/game/ui/InterfaceController.ts`

Changes:

- Mission salvage now increases both lifetime scrap and spendable credits.
- This fixes the previous issue where the mission reward increased an unused scrap counter but did not fund the shop wallet.
- Vehicle stat upgrades remain permanent for the campaign.
- Purchased stat upgrades are replayed after a chassis change so they are not lost.
- Chassis upgrades continue through Light, Medium, and Heavy tiers where applicable.
- Shop entries now distinguish:
  - whether an item is owned;
  - whether it has reached its maximum level;
  - whether the next purchase is affordable.
- Owned but non-maxed items remain clickable for further upgrades.

### 7. Weapon purchase and upgrade system

Files:

- `src/game/data/weapons.ts`
- `src/game/core/GameDirector.ts`
- `src/game/scenes/BattleScene.ts`
- `src/game/types.ts`
- `src/game/ui/InterfaceController.ts`
- `src/game/ui/TouchControls.ts`

Changes:

- Added shop prices for starting, campaign, and purchasable weapons.
- Added four weapon levels.
- Unowned purchasable weapons begin at Level 0 and become Level 1 when bought.
- Owned/issued/unlocked weapons begin at Level 1 and can be upgraded to Level 4.
- Upgrade pricing increases with the current level.
- Each level above Level 1 applies approximately:
  - `+18%` damage multiplicatively;
  - `+5%` projectile speed multiplicatively;
  - `-10%` secondary cooldown multiplicatively.
- The selected weapon changes to a weapon when it is purchased or upgraded.
- Weapon level is included in the session and HUD snapshots.
- HUD and touch labels display the active weapon level, for example `ROCKET L2`.

### 8. Mobile Web Audio compatibility

File:

- `src/game/audio/BattleMusic.ts`

Change:

- Reads `window.AudioContext` safely before falling back to `window.webkitAudioContext`.
- This avoids a possible reference error on older WebKit mobile browsers where only the prefixed constructor exists.

## Data Model Changes

`ShopEntry` now includes:

- `owned`: the player currently owns or has purchased at least one level of the item.
- `maxed`: the item cannot be upgraded further.
- Existing `level`, `maxLevel`, `price`, and `affordable` fields remain.

`SessionSnapshot` now includes:

- `weaponLevels: Partial<Record<WeaponId, number>>`

`HudSnapshot.weapon` now includes:

- `level: number`

## Verification Performed

### Production build

Command:

```powershell
npm run build
```

Result:

- TypeScript compilation passed.
- Vite production build passed.
- The build still reports the pre-existing large-chunk warning because Phaser is bundled into the main JavaScript chunk.

### Formatting/diff validation

Command:

```powershell
git diff --check
```

Result: passed.

### Responsive browser smoke tests

Test viewport: `844 x 390` landscape.

Verified:

- Touch mode activates.
- Movement stick is visible and interactive at the bottom-left.
- Movement stick was measured at 18 px from the left and 12 px above the bottom at an 844 x 390 viewport.
- The right aim/fire stick measured 96 px, compared with the 148 px movement stick.
- Tapping the open battlefield changes turret direction and fires once.
- Tapping the empty lower-left movement zone does not change turret direction.
- Dragging the right stick changes heading before firing, and the heading remains locked after release.
- Bottom-right action controls remain available.
- Initial HUD displays the selected weapon as `ROCKET L1`.
- Browser console contained no errors or warnings during smoke tests.

### Economy and upgrade logic test

A Vite SSR test instantiated `GameDirector` and verified:

- Completing a mission with 2,000 salvage produced 2,000 spendable credits and 2,000 lifetime scrap.
- Rocket Level 1 to Level 2 purchase succeeded.
- Vehicle engine upgrade succeeded.
- Medium-to-Heavy chassis upgrade succeeded and replayed the engine upgrade.
- Shotgun purchase succeeded and created a Level 1 owned weapon.
- Wallet deductions matched the configured prices.

### Shop markup flow test

Verified from generated intermission markup:

- Summary screen contains `data-open-shop`.
- Summary screen does not render the shop grid.
- Shop screen contains back and deploy actions.
- Shop screen renders weapon and vehicle purchase buttons.
- Shop screen displays the current wallet.

## Files Changed in the Current Working Tree

- `src/game/core/VirtualGamepad.ts`
- `src/game/core/GameDirector.ts`
- `src/game/data/playerClasses.ts`
- `src/game/data/shop.ts`
- `src/game/data/stages.ts`
- `src/game/scenes/BattleScene.ts`
- `src/game/types.ts`
- `src/game/ui/InterfaceController.ts`
- `src/game/ui/TouchControls.ts`
- `src/main.ts`
- `src/style.css`
- `Codex_plan_and_implement.md`

These changes are currently uncommitted unless the repository state is changed after this handoff was written.

## Suggested Review Checklist for Claude

### Controls

- Confirm tap-to-aim feels correct on a real Android/iOS device, not only a responsive browser viewport.
- Confirm multi-touch permits holding the movement stick while dragging the right aim/fire stick or pressing action buttons.
- Confirm a second battlefield touch aims and fires while the movement stick remains held.
- Confirm desktop mouse click-to-fire behavior remains desirable.

### Shop/economy

- Confirm stage rewards feel large enough to make at least one useful purchase after early missions.
- Review weapon and chassis prices for campaign pacing.
- Confirm the distinction between lifetime scrap and spendable credits is useful; consider removing one currency if it is redundant.
- Confirm the final mission should go directly to victory rather than offering one last shop visit.

### Three-column depot redesign

- The shop now uses a weapons / selected-unit / systems composition.
- The left rack is a 2x2 matrix for Gun, Rocket, Main Turret (or Heavy Weapon for a soldier), and Machine Gun equipment.
- Shaped Charges appears under Main Turret so that rack has an upgrade from the first shop; late railgun/scattergun systems join it as the campaign advances.
- The center bay renders a code-native SVG silhouette for the current selected unit, current HP/shield/speed/ammo, and the next chassis purchase.
- The five unit choices now match the requested progression: Soldier, Mini Tank, Small Tank, Medium Tank, and Heavy Tank.
- The right rack places health/shield together, movement/auto-loader together, followed by bullet capacity and repair rows.
- Bullet Capacity is a functional permanent upgrade: each level adds two trigger pulls to the magazine.
- Combat now tracks magazine ammunition, displays it in the HUD, and auto-loads an empty magazine. Auto Loader upgrades also shorten magazine reload time.
- Desktop uses left/center/right columns; tablet/landscape mobile puts the center bay first over two racks; portrait mobile uses a single scrollable column with non-overlapping deploy actions.

Browser verification confirmed:

- The desktop shop displays the three requested regions and the medium-tank silhouette.
- Buying Bullet Capacity deducted $115 and changed the displayed magazine from 10 to 12.
- Buying Heavy Tank changed the center SVG and unit label, and replayed the capacity upgrade onto the heavy chassis (8 base + 2 purchased = 10).
- The five menu choices render as Soldier, Mini Tank, Small Tank, Medium Tank, and Heavy Tank.
- Responsive checks passed at 844x390 and 390x844 with no browser console errors or warnings.

### Weapon balance

- Review multiplicative Level 2-4 weapon scaling for late-campaign balance.
- Confirm upgraded secondary weapons should improve damage, velocity, and cooldown together.
- Confirm purchasing/upgrading a weapon should automatically equip it.

### Combat

- Review swept collision and piercing target order for edge cases when a projectile intersects cover and a tank in the same frame.
- Review tank separation near cover and world boundaries for visible jitter.
- Confirm delayed effects pause and resume as intended.

### Infantry houses

- `houseOpen` is durable cover with an authored breach on its left, right, top, or bottom edge.
- Only riflemen and rocketeers can cross that breach; tanks and other vehicles still collide with the full building.
- Infantry whose center is inside an intact open house gain 80% damage reduction against blast/area damage. Direct incoming shots collide with the house first.
- An occupant can fire outward when its shot is aligned with the breach. A shot aimed into a wall damages the house normally.
- `houseSealed` has no entrance and may define a hidden rifleman/rocketeer garrison.
- Destroying a sealed house creates and alerts its garrison, displays an ambush message, and keeps their spawn clear of the collapsing structure.
- Pending garrisons count in the HUD and block assault completion, preventing a stage from ending before the hidden soldiers emerge.
- The first three missions now contain one open shelter and one sealed garrison house, with the first mission briefing teaching the mechanic.
- The cover review also fixed armory pickup crates incorrectly absorbing projectiles despite being non-solid walk-over items.

Browser verification confirmed:

- Open and sealed houses render distinctly; the breached side has a dark opening plus a green entry arrow.
- Mission 1 reports `7/7` hostiles (six deployed riflemen plus one hidden garrison soldier).
- The open house absorbs incoming rounds and remains intact under sustained rifle fire after its health was tuned to 480.
- No browser console errors or warnings were produced during the infantry/house smoke test.

Claude review focus:

- Confirm the authored doorway width feels forgiving on a physical touch device.
- Confirm 80% blast reduction and 480/360 open/sealed house health fit campaign balance.
- Consider adding houses to later missions after the first-three-stage mechanic rollout is playtested.

### Performance

- Profile on a physical low/mid-range phone.
- If further optimization is needed, the next major opportunity is splitting static and dynamic Phaser graphics layers or caching static cover/terrain artwork into render textures.
- The main production bundle is still approximately 354 KB gzip and triggers Vite's large-chunk warning.

## Known Limitations

- The repository does not currently provide an automated unit/integration test script in `package.json`.
- Mobile performance was smoke-tested in a responsive in-app browser, not measured on physical hardware.
- All normal fire inputs use the selected weapon. Vehicle damage/reload stats are still the shared base values applied before per-weapon scaling.
- Shop state is campaign-memory only and is not persisted across page reloads or application restarts.

---

## Request 15: Freeze / Performance Optimization

### Problem statement

Long firefights could become uneven or appear to freeze, particularly on mobile hardware. The review did not find an infinite loop; it found several costs that compounded over time:

- The full terrain, every destructible structure, all actors, and every effect were cleared and rebuilt as Phaser vector geometry on every frame.
- The complete HUD DOM tree was replaced every 100 ms even when only a number or bar width changed.
- Rapid weapons allocated filtered, mapped, and sorted collision arrays for every active projectile on every frame.
- Short Web Audio effects created oscillator/source, filter, and gain nodes without explicitly disconnecting the completed graph.
- Engine sound added four new AudioParam automation targets every render frame.
- Touch devices were asking for the same antialiased 60 Hz rendering profile as desktop machines.

### Detailed implementation plan

#### Phase A - bound long-session audio work

1. Throttle engine synthesis changes to at most one update every 80 ms unless the load changes materially or the engine must become idle immediately.
2. Cancel the pending automation tail before scheduling a replacement target.
3. Attach one-shot `ended` cleanup to every temporary music/SFX source and disconnect its source, filter, and gain nodes.
4. Leave the two continuous engine oscillators connected because they are intentionally mission-long reusable nodes.

Acceptance criteria:

- Automatic fire and repeated explosions do not leave completed temporary nodes connected.
- Engine pitch/load remains responsive without receiving 180-240 automation events per second.
- Music and all combat cues remain audible.

#### Phase A2 - default-on performance mode

1. Add one clearly labelled `Performance mode` checkbox to the starting screen and pause panel.
2. Enable it by default for every fresh page load.
3. While enabled, do not create/start the Web Audio context and reject music, engine, and SFX work at the audio boundary.
4. Guard both player-hit and explosion camera-shake calls with the same live setting.
5. Apply changes immediately: enabling the mode suspends existing audio; disabling it resumes/starts audio and allows future camera shake.
6. Keep this preference separate from difficulty, campaign progression, and gameplay balance.

Acceptance criteria:

- The checkbox is checked and reports `Performance mode on` on first load.
- Starting a campaign in the default state produces no audio or camera shake.
- Turning the checkbox off from the menu or pause panel enables audio without restarting the campaign.
- Turning it back on suspends audio and prevents subsequent shake effects.

#### Phase B - make the HUD incremental

1. Build the live HUD structure once per structural variant: shield/no shield and boss/no boss.
2. Cache every live HUD element by a `data-hud` key.
3. Update text, CSS fill variables, widths, and boss state only when a field changes.
4. Cache the three mobile action-caption nodes instead of querying the touch-control subtree on every HUD tick.
5. Keep the existing 100 ms information cadence so cooldowns still look responsive.

Acceptance criteria:

- The HUD root is not replaced during normal gameplay.
- Pause control delegation still works after a structural HUD rebuild.
- Health, shield, ammunition, cooldowns, weapon, score, and boss exposure remain current.

#### Phase C - cache static battlefield geometry

1. Split Phaser graphics into four ordered layers:
   - depth 0: cached terrain;
   - depth 1: dynamic objective underlay, escort, and interactive pickups/pads/mines;
   - depth 2: cached destructible buildings and cover;
   - depth 3: tanks, cash, projectiles, impacts, and explosions.
2. Draw the full world-space terrain once when a mission begins.
3. Redraw structural cover only when it takes damage or is destroyed.
4. Keep pulsing repair pads, mines, and armory boxes on the dynamic underlay.
5. Preserve additive explosion glow at depth 6 and text overlays at their existing higher depths.

Acceptance criteria:

- Camera travel never reveals an undrawn part of the map.
- Cover health/destroyed state updates on the next frame.
- Layer order still reads as objectives/escort, cover, actors, effects.
- Terrain and structural cover no longer generate new vector command lists every frame.

#### Phase D - reduce hot-loop allocation and mobile GPU load

1. Reuse the tank collision list instead of allocating a new player/enemy array each frame.
2. Reuse a projectile hit buffer and populate it in one pass instead of chained `filter/map/filter/sort` calls.
3. Find homing targets in a single squared-distance pass without arrays or repeated square roots.
4. Use squared-distance and direct loops for circle/cover, capture-zone, repair-pad, and mine checks.
5. Use a mobile renderer profile: 45 Hz target, 30 Hz minimum, no antialiasing, rounded pixels, and high-performance GPU preference. Desktop retains a 60 Hz antialiased profile.

Acceptance criteria:

- Swept projectile collision and piercing order are unchanged.
- Multi-hit rail/projectile behavior still processes nearest impacts first.
- Desktop quality is unchanged.
- Touch hardware receives the lower-cost render profile from startup.

#### Phase E - lightweight diagnostics and regression verification

1. Aggregate frame count, maximum frame time, long frames over 34 ms, and active enemy/projectile/explosion counts in three-second windows.
2. Publish the sample through body data attributes (`data-game-fps`, `data-game-frame-max`, `data-game-long-frames`, `data-game-entities`) so a browser/device test can read it without a visible debug overlay.
3. Ignore hidden-tab and suspension-sized deltas so background throttling does not pollute the sample.
4. Run TypeScript/Vite production build, diff checks, desktop gameplay, mobile gameplay, HUD mutation, projectile, audio, pause, and mission-start regression checks.

### Implementation status

All phases above, including the default-on performance-mode control, were implemented in the current performance pass. The final verification and deployment results are recorded in the latest Codex handoff response and Git history.

### Performance-pass verification

- `npm run build` passed TypeScript and Vite production compilation.
- `git diff --check` passed.
- The start page still fits the complete menu and fixed Start Campaign footer at the tested 1267-pixel-wide browser viewport after adding the new setting.
- Performance mode appeared checked on first load and reported `Performance mode on`.
- Unchecking it rebuilt the label as `Performance mode off`; the same live control appeared in the pause panel and the mission resumed successfully.
- Incremental HUD values continued to report health, shield, ammunition, active weapon, cooldowns, score, and hostiles.
- Cached terrain, open/sealed houses, barrels, crates, tank art, pickups, and touch controls rendered in the correct visible order.
- A sustained four-window Machine Gun test produced no sampled frames above 34 ms. The four samples reported maximum frame intervals of 32, 23, 23, and 25 ms; active projectile counts rose and returned to zero normally.
- A separate full-effects sample with performance mode disabled reported 58 FPS, an 18 ms maximum frame interval, and zero sampled frames above 34 ms.
- The browser was an emulated/coarse-pointer environment. Physical Android profiling remains the final device-specific check.

### Claude review focus

- Profile `data-game-fps`, `data-game-frame-max`, and `data-game-long-frames` on a physical mid-range Android device during sustained Machine Gun and explosion activity.
- Confirm 45 Hz feels preferable to an unstable 60 Hz on that hardware; the target is isolated in `src/main.ts` if tuning is needed.
- Inspect the static cover layer after every structure type takes damage, especially barrels, concrete, houses, and rock walls.
- Confirm Web Audio cues remain complete on Safari/iOS after their source graphs disconnect on `ended`.
- Confirm the default-on performance mode matches player expectations; audio and shake can be restored together from the menu or pause screen.
- Consider Phaser texture atlases for tank/cover art only if physical-device profiling still shows rendering as the dominant cost after this pass.

---

## Request 16: Health-bar jitter and projectile-load follow-up

### Evaluation

The follow-up comparison separated idle play, sustained Mini Tank machine-gun fire, and the same fire with audio/camera shake restored. The desktop/coarse-pointer browser did not reproduce a suspension-sized frame: every sample reported zero frames above the existing 34 ms long-frame threshold. Audio and shake therefore were not the primary cause in this environment.

The review did confirm two sources that become much more expensive on mobile:

- Health, shield, boss, and cooldown fills animated CSS `width`. The HUD refreshes every 100 ms while the old transition lasted 120 ms, so a regenerating shield or cooldown could continuously restart layout and paint work and look as if the bar were shaking.
- Every rendered tank and shaped projectile mapped its silhouette into a new array of `Phaser.Math.Vector2` objects every frame. Additional temporary arrays and world-point objects were created for shells, rockets, drones, exposed turrets, armor blocks, trails, and hit effects. Automatic fire amplified this garbage-collection pressure.
- Performance mode suppressed sound and camera shake but previously drew the same maximum number of visual effects as full-effects mode.

### Implemented fix

1. Health, shield, boss, and cooldown fills now keep a stable full-size box and animate `transform: scaleX(...)` from the left edge. The bar transition is 90 ms, shorter than the 100 ms HUD cadence, so transitions no longer overlap. DOM writes remain change-guarded.
2. Polygon rendering now reuses one expandable point buffer. Phaser copies the point coordinates into its numeric Graphics command buffer synchronously, so the same scratch objects can safely serve the next shape.
3. Projectile silhouettes and the unit box are immutable module constants. Shells use separate horizontal and vertical scales, eliminating their per-frame shape arrays. Exposed-turret and armor-block rendering also reuse the source art/constants.
4. Local-to-world render calculations use a 32-point ring scratch pool. Render callers consume coordinates synchronously and retain at most a few points at once, removing the repeated `{x, y}` allocation without changing geometry.
5. Default-on performance mode now also:
   - caps muzzle flashes at 24, impacts at 36, and explosions at 28;
   - creates two impact sparks and two/four explosion sparks;
   - uses one projectile trail pass;
   - omits secondary muzzle rays, shield bloom, explosion smoke, secondary rings, hot cores, and additive bloom.
6. Full-effects mode keeps the original visual counts and layered effects. The toggle description now states that combat particles are reduced in addition to audio and camera shake being disabled.

### Verification

- `npm run build` passed TypeScript and Vite production compilation.
- In the live DOM, health reported `--scale: 1` and the weapon cooldown reported `--fill-scale: 1`; neither uses inline width mutation.
- A 64-input sustained Machine Gun run in performance mode reported 53 FPS, a 23 ms maximum sampled frame interval, zero long frames, and seven active projectiles at the sample point.
- A separate full-effects regression run reported 50 FPS, a 30 ms maximum interval, zero long frames, and eight active projectiles.
- The start menu, battlefield, tanks, structures, mobile controls, HUD, performance toggle, pause, resume, weapon fire, and both effect profiles rendered and remained interactive in the in-app browser.

### Remaining device check

The browser result confirms the hot paths are bounded and functionally correct, but it is not a substitute for a physical low/mid-range Android trace. Claude should profile sustained Machine Gun fire plus clustered explosions on a real device and compare `data-game-frame-max` / `data-game-long-frames` with performance mode on and off. If long frames persist, the next high-value step is replacing frequently rebuilt Phaser Graphics actor art with cached textures; the HUD should not be rebuilt or slowed further unless device evidence specifically points back to DOM work.
