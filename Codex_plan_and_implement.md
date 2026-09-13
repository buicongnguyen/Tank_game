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
- Desktop uses left/center/right columns; mobile puts the center bay first over two independently scrollable racks, with a persistent deploy footer.

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

---

## Request 17: End-of-stage time and preservation bonus

### Reward rule

Every mission now starts with a three-minute **bonus clock**. This clock does not fail the mission when it reaches zero; it only determines the speed reward.

- Time bonus: `$1` for each whole second remaining from `3:00`.
- Preservation bonus: `$5` for each intact crate, concrete block, rock wall, barrel, open house, or sealed house.
- Mines, repair pads, and armory pickups are excluded. Triggering a mine or using a field utility therefore does not reduce the preservation bonus.
- Bonus money is added to credits only. Existing mission salvage continues to add to both cumulative scrap and credits.

Examples:

- Clear at `1:00` elapsed with 10 eligible objects intact: `120 × $1 + 10 × $5 = $170` bonus.
- Clear after the three-minute mark with 6 objects intact: `$0 + 6 × $5 = $30` bonus.

### Implementation

1. `BattleScene` calculates the breakdown at the instant mission completion is resolved, before the existing delayed transition to the debrief.
2. The existing `missionResolved` guard prevents repeated update ticks from paying the bonus more than once.
3. `GameDirector.completeCurrentMission` normalizes and stores the breakdown, adds its total to credits, and includes it in `SessionSnapshot` for presentation.
4. The stored breakdown is cleared when starting a campaign, deploying to another stage, failing, or retrying a stage. It remains available throughout the debrief/shop flow and on the final campaign-clear screen.
5. The live HUD shows `BONUS M:SS`, using the same three-minute clock as the final calculation.
6. The stage debrief and final victory screen show:
   - total stage bonus;
   - time remaining, rate, time reward, elapsed time, and the `3:00` limit;
   - preserved object count, rate, and object reward.

### Verification

- TypeScript and Vite production build passed.
- A local gameplay run displayed `BONUS 2:58` after approximately two seconds.
- Hull integrity, weapon controls, and the rest of the live HUD remained present.
- The browser console reported no warnings or errors.
- The bonus layout remains a compact two-column breakdown on phones to reduce vertical scrolling.

### Claude review focus

- Confirm `$1/second` and `$5/object` produce the intended shop pacing over several full campaign runs.
- Decide whether later missions should use a longer clock or a stage-specific multiplier; the current rule is intentionally consistent across all stages.
- Confirm sealed houses that must be destroyed to release a garrison create the desired tradeoff between preservation money and mission completion.

---

## Request 18: Mobile overlay fit and reduced scrolling

### Evaluation

The phone-sized browser audit used `360 × 640`, `320 × 568`, and `640 × 360` viewports. The document itself was correctly locked to the game viewport, but several overlay cards used one tall scroll surface for both information and actions.

Before this pass at `360 × 640`:

- The start content was 1,182 px tall inside a 538 px viewport: 644 px of internal overflow.
- The pause card was 1,087 px tall inside a 610 px viewport: 477 px of overflow.
- Pause/resume, retry, shop/deploy, and debrief actions could sit below long descriptive content.
- The start screen stacked five unit choices almost vertically at narrow widths.
- The smallest shop breakpoint changed the whole three-bay depot to one long column.

### Implemented fix

1. Shortened the start introduction, test-mode explanation, pause threat copy, shop introduction, debrief summary, weapon-unlock note, failure summary, and victory summary without removing gameplay-critical information.
2. Added a shared mobile overlay structure to pause, shop, debrief, failure, and victory screens:
   - content scrolls only inside a bounded, momentum-enabled region;
   - the primary action footer stays pinned and always visible;
   - overscroll is contained inside the panel;
   - a stable scrollbar gutter prevents content width from shifting when scrolling appears.
3. Changed the start unit selector to two columns on phones and tightened headings, stats, difficulty choices, performance mode, and notes. The existing fixed Start Campaign footer remains unchanged in behavior.
4. Pause now shows touch instructions on real touch devices and keyboard/mouse instructions otherwise. Long weapon descriptions and secondary armor advice are hidden on small displays while weapon names and tank stats remain visible.
5. Kept the shop's selected-unit bay across the full width, with weapons and systems in two compact columns below it. Each dense rack has its own bounded scroller, so browsing equipment does not move the depot action buttons.
6. Kept the mission-bonus breakdown in two compact columns on phones and removed only secondary explanatory lines. Values and earned totals remain visible.
7. Moved Retry Current Stage, Enter Shop/deploy, Resume Mission, and Run Again into fixed mobile footers. Campaign selection and secondary actions stay in the content region.
8. The release review changed mobile overlay height to the safe-area-adjusted grid height rather than a raw viewport calculation, preventing fixed footers from falling behind notches or home indicators. Narrow shop racks now stack their own cards in one readable column while the weapon and systems racks remain side by side.

### Verification

- `npm run build` passed TypeScript and Vite production compilation.
- `git diff --check` passed.
- At `360 × 640`, the start content now fits with zero overflow; the Start Campaign footer remains visible.
- At `360 × 640`, pause overflow fell from 477 px to 69 px; Resume Mission remains visible in a fixed footer.
- At `320 × 568`, document overflow stayed at zero. The start content had only 102 px of bounded internal overflow and the pause content 155 px, with both action footers visible.
- At `640 × 360`, document overflow stayed at zero; a landscape-specific five-column unit grid reduced start overflow from 240 px to 90 px while keeping Start Campaign visible.
- The pause panel, battlefield, HUD, and resume interaction rendered correctly after the responsive changes.

### Claude review focus

- Verify touch-device pause instructions switch from keyboard/mouse to left-stick and right-stick/tap labels on physical Android/iOS hardware.
- Exercise the largest late-campaign shop inventory on a narrow device and confirm nested weapon/system rack scrolling feels natural.
- Confirm long translated mission briefings remain understandable when the mobile pause briefing is clamped to three lines.
- Check safe-area padding and fixed footers on an iPhone with a home indicator and on a short landscape Android display.

---

## Request 19: Blender-rendered art for the 2D game (2026-09-12)

### Selected design and implementation

Adapted the original Blender-authored models from the user's `Tank_game_3D`
checkout: beveled armor, detailed tracks, engine vents, hatches, infantry,
crates, fuel drums, concrete barriers, stone walls, houses, and the transport.
The sibling repository was only read; selected GLBs were copied into this
repository so future asset builds do not depend on that checkout.

1. Created `tools/blender/render_sprites.py`, a reproducible Blender 4.5 Cycles
   pipeline using transparent orthographic renders, four CPU threads and
   16 samples. No external image libraries or Blender add-ons are needed.
2. Rendered four tank chassis variants in player and enemy palettes, plus
   rifle and rocket infantry. Hull and turret/upper-body layers are independent.
   The heavy has additional armor blocks; the Mini Tank preview has twin guns.
3. Authored six Blender weapon attachments for cannon, rapid-fire, launcher,
   long-gun, mortar, and drone-rack appearances. Swapping weapons selects the
   matching appearance, including hiding the second gun after switching away
   from a twin-gun weapon.
4. Packed 37 frames into one 1536 × 960 PNG atlas (472,998 bytes / about 462 KiB).
   The RGBA texture requires about 5.6 MiB before driver overhead. The browser
   loads no GLB files or 3D engine. Five separate 384 × 256 images serve the shop.
5. Integrated a reusable Phaser image cache in `BlenderSprites.ts`. Each frame
   updates transforms/visibility; cover images update with the existing dirty
   cover layer. Retry, stage changes, and scene shutdown destroy old images.
6. Preserved the existing projectile/collision rules, independently controlled
   gun angle, hit reactions, exposure colors, health bars, door arrows, shelter
   markers, sealed-house boards, and damage cracks. Damaged cover also darkens.
7. Added the Blender previews to the shop without increasing its phone layout
   height. Missing previews fall back to the original SVG. If the atlas fails
   to load, gameplay falls back to existing vector art.
8. Saved an editable heavy-tank render scene as `assets/blender/sprite-studio.blend`,
   the vendored source meshes, and full rebuild notes in `assets/blender/README.md`.

### Review fixes and verification

- Corrected the imported GLB quaternion/Euler rotation mode before rotating the
  models; forward now maps to +X, matching the simulation's zero-angle heading.
- Removed the source barrel and thermal sleeve from the turret layers, preventing
  duplicated guns when the game equips its weapon attachment.
- Kept all unit frames centered and untrimmed to prevent hull/turret pivot drift.
- Kept house entrance and damage annotations above the rendered roof images.
- Added cleanup of the scene's director subscription on shutdown.
- `npm run build` and `git diff --check` passed.
- `tools/verify-blender.mjs` passed: independent hull/turret angles, stable image
  counts across 300 redraws, hidden shelter occupants, hidden dead units and
  destroyed cover, destroyed old images after retry, twin/single/drone weapon
  switching, a loaded mobile shop preview with its footer visible, and playable
  vector fallback when both atlas requests are blocked.
- The normal game entry point was also tested with a 390 × 844 touch viewport:
  Mini Tank selection, aim/fire, pause, and resume passed with no page errors.
- Desktop battlefield, desktop shop, mobile shop, and mobile gameplay screenshots
  are in ignored `artifacts/blender-review/`. The development encounter lives at
  `tools/art-review.html` and is not included in the production build.

### Remaining art scope / Claude review focus

- Stationary gun platforms and enemy convoy chassis retain their vector bodies;
  projectiles, particles, and terrain remain procedural. The escorted transport
  uses the new sprite. This is a selected asset upgrade, not a conversion to 3D.
- Review visual contrast and fine details on a physical low-end Android phone.
  Browser object-reuse checks do not substitute for device GPU profiling.
- Check additional palettes, walking/tread animation frames, or unique boss
  silhouettes as future art passes. The baked lighting rotates with each sprite.
- Rebuild instructions and optional Playwright verification commands are in
  `assets/blender/README.md`.

### Release verification

- The production build was tested at `/Tank_game/`, matching the GitHub Pages
  subpath, on desktop and a 390 × 844 touch viewport.
- Both loaded the exact built atlas (SHA-256 comparison), completed start/pause/
  resume, and reported no page errors.
- `tools/verify-release.mjs` supports the same verification against the live
  deployment using `ART_RELEASE_URL`.
- Publish the committed PNG/JSON assets with the existing `main` GitHub Pages
  workflow. Blender is not needed on CI or the user's device.

---

## Request 20: Restore readable cover and adopt 3D-style controls (2026-09-12)

### Agreed plan

1. Restore the original 2D environment drawings while retaining Blender units
   and weapon attachments.
2. Use Tank_game_3D's flat translucent, matching pads and size-aware stick travel.
3. Preserve independent movement/aim, battlefield tap-to-aim/fire, and the
   movement-only lower-left region. Keep existing clickable desktop controls;
   the user has not selected the 3D game's desktop joystick-hiding policy.
4. Review input ownership and responsive layout, add regression tests, and
   validate the production build without changing combat rules or balance.

### Implemented

- Restored `drawCoverCrate`, `drawCoverBarrel`, `drawCoverBuilding`,
  `drawCoverRockWall` and `drawCoverHouse` as the normal render path. Roof seams,
  windows, wood braces, stone silhouettes, entrances and damage annotations are
  back. Removed the unused Blender cover image cache and rendering method.
- Blender tanks, infantry, weapon attachments, escort transport and shop
  previews are unchanged. Atlas/source cover frames remain available for future
  art work but are not displayed. Cover is still cached behind the dirty flag.
- Consolidated the accumulated control CSS rules. Mobile gets matching 106px
  pads on phones/short landscapes, 116px on larger layouts, 46px nubs, visible
  Drive/Aim-Fire labels, mint engagement feedback and amber firing feedback.
  Safe-area-aware bottom offsets match; compact action buttons sit between
  the sticks, stacked in portrait and in a row in short landscape.
- Desktop retains its clickable drive pad and fire/action buttons, with the
  same flat palette and readable labels/key hints. Removed the old blurred,
  gradient-heavy pads, oversized key badges, conflicting size rules and tiny
  overflowing action captions. Full selected-weapon identity remains in the
  HUD and the swap button's accessible label; its small caption shows ammo.
- Compute travel as half the pad-minus-nub diameter minus a 3px inset. Cache
  geometry once per gesture instead of measuring layout on every movement.
  A radial 15% resting dead zone preserves proportional drive speed. Aim fire
  engages above 32% and stops below 22%, avoiding threshold flicker.
- Each stick captures and tracks its own pointer. A second finger can aim/fire,
  and a third can swap weapons, without stopping the drive finger. Normal
  centre taps still fire once at the current heading.
- Cancel/lost capture no longer counts as a tap. Resize, blur, visibility loss
  and leaving gameplay release active gestures. Buttons reject a second owner
  or a non-primary mouse button. A new battlefield gesture clears the retained
  stick aim axis so it can actually take over the turret heading.

### Review and verification

- TypeScript and Vite production build passed; only the pre-existing large
  Phaser bundle warning remains. CSS output fell from 52.88 kB to 45.08 kB.
- Art regression checks passed: all six cover types use original draw methods,
  dead/destroyed cover is omitted, sheltered soldiers are hidden, Blender hull
  and turret rotations stay independent, image counts remain stable, retry
  cleans up images, and twin/single/drone weapon appearance switching works.
- Control checks use Chromium's real touch dispatch, not only synthetic DOM
  events. Tested 320x568, 390x844, 640x360, 844x390 and 1024x768 touch layouts,
  plus 1366x900 and 640x480 mouse/keyboard layouts. Checked target bounds and
  non-overlap, visible labels, radial nub containment, two-stick operation,
  releasing aim while driving, third-finger weapon swapping, actual turret
  rotation/ammo use on battlefield tap, movement-zone isolation, centre tap,
  cancellation, lost capture, rotation and blur cleanup.
- `tools/verify-blender.mjs`, `tools/verify-controls.mjs`, and the production
  `/Tank_game/` smoke test (`tools/verify-release.mjs`) passed with no page errors.
  The production test verifies the atlas hash plus startup/pause/resume on
  desktop and touch. The test fixture remains excluded from the release build.
- Screenshots: ignored `artifacts/control-review/` and `artifacts/blender-review/`.

### Claude / device review focus

- Physically test thumb comfort and notch/home-indicator safe areas on iOS and
  Android; emulated touch checks cannot prove physical-device ergonomics.
- Existing keyboard/mouse bindings, weapon balance, map collisions, economy and
  stage logic were intentionally not redesigned.
- Implementation was verified locally on September 12. The September 13
  follow-up authorizes committing, pushing over Git SSH and publishing through
  the existing GitHub Pages workflow. Release smoke checks now compare the
  loaded JavaScript/CSS bundle hashes as well as the unchanged Blender atlas,
  so the previous deployment cannot pass as this artwork/control release.

---

## Request 21: Slower stock tanks and three-times infantry (2026-09-13)

### Scope and implementation

- Halved player tank base engine speeds: Mini Tank 286 -> 143, Small Tank
  268 -> 134, Medium Tank 235 -> 117.5, Heavy Tank 178 -> 89. The on-foot
  Soldier stays at 300; enemy armor, projectile speeds and escort speed are
  unchanged. Turn rates and input response were not reduced.
- Engine purchases still add the full +26 speed per level (five levels), and
  the existing Hot Engine stage reward still adds +32. This changes class
  baselines rather than scaling movement each frame, so upgrades remain
  effective and their shop descriptions remain accurate.
- Added `infantrySquads.ts`: each authored rifleman/rocketeer becomes a
  three-person squad at campaign initialization. Troops use deterministic
  nearby positions, with clearance from all covers, other units, map edges,
  and the player's deployment region. The bounded search runs once, not per
  frame or retry. Authored input data is not mutated.
- Tripled sealed-house garrisons too. Existing battlefield counts for missions
  1-5 are now 18, 15, 21, 15 and 15, with hidden troops 3, 3, 6, 0 and 0.
  Total infantry is 96 instead of 32. Missions 6-15 have no authored infantry
  and remain armor-only; no enemy tanks, bosses or mission objectives were
  multiplied or otherwise redesigned.
- Adjusted the infantry crushing/dodge speed threshold from 90 to 45,
  preserving that mechanic with the halved stock speeds. In particular,
  the Heavy Tank's new speed of 89 must not make crushing unreachable.

### Review and verification

- Added `tools/verify-balance.mjs` and an optional `?campaign` mode in the
  existing development-only art/control fixture.
- Verified exact stock speeds, actual engine purchases, retry preservation,
  and engine bonuses after buying each available next chassis through its
  normal progression unlock. The Heavy Tank has no next chassis.
- Validated all 15 stage configurations: exact infantry/garrison counts,
  unique IDs, no infantry starting inside cover, unit separation, safe bounds,
  deterministic layout and unchanged source data.
- Real scene checks cover all three garrison releases (no blocked positions,
  correct counts, no duplicate release), stock Heavy Tank crushing and retry
  population staying at 18 rather than tripling again.
- Follow-up code/logic review found and fixed track-crushing applying to the
  on-foot player and to sheltered enemies through house walls. Crushing and
  tank-avoidance now require a vehicle; living house shelter blocks crushing.
  Regression checks include a running Soldier, an actual house-edge shelter,
  a tank below the speed threshold, and a stock Heavy Tank above it.
- Fixed the legacy stage-reward path losing earned bonuses on a chassis swap.
  Shop purchases and stage rewards now share an ordered replay ledger, so
  additive/percentage modifiers and cooldown floors retain their original
  order. The ledger survives retries and resets on a new campaign. The current
  shop UI remains unchanged; this also preserves the older `applyUpgrade` API.
- Legacy rewards now require an intermission, preventing repeated reward calls
  from skipping missions. Their cooldown floors can no longer make an already
  faster weapon slower. Tests cover mixed rewards/purchases in all four
  difficulties, a chassis swap, retry, and new-campaign reset. All five engine
  levels add +130 total; a sixth purchase fails without charging credits.
- A 600-update sample of the largest infantry encounter (27 troops including
  the released garrison) stayed finite, with 14 peak projectiles and no render
  object growth across another 300 redraws. Measured CPU update/render-command
  p95 was about 0.5 ms on this desktop host. This excludes GPU presentation
  and is not a physical-phone FPS guarantee.
- Production build, art regression tests, seven-layout control/input tests
  and production desktop/mobile smoke tests passed with no page errors.
- The September 13 follow-up authorizes committing and pushing this reviewed
  change over Git SSH, then deploying through the existing GitHub Pages
  workflow. Release verification compares live JS/CSS and atlas hashes against
  the local production build and checks desktop/mobile start, pause and resume.
- Re-run commands: `npm run build`, then `node tools/verify-balance.mjs`,
  `node tools/verify-blender.mjs`, `node tools/verify-controls.mjs` (these three
  use the Vite review fixture on port 5182), and `node tools/verify-release.mjs`
  (starts a local production server). Each script accepts a Playwright package
  directory argument if Playwright is not installed in this repository. For
  live checks, set `ART_RELEASE_URL=https://buicongnguyen.github.io/Tank_game/`
  before running the release script.
- Physical-device difficulty, battery use and sustained frame pacing remain
  playtest follow-ups; automated desktop emulation is not a phone benchmark.

---

## Request 22: Guided-missile Air Strike (2026-09-13)

### Behavior and implementation

- Replaced the old four instant artillery explosions with six visible guided
  missiles, activated by the existing Q key or mobile Strike button. The
  selected primary weapon and its ammunition are unaffected.
- Acquisition is within 720 world units of the player. Nearest enemies are
  prioritized, followed by nearby destructible buildings/cover; the volley
  spreads across distinct targets before repeating. Sheltered soldiers cause
  their protective house to be targeted instead of the hidden soldier.
- Missiles arrive from above the player, fly over intervening objects, retain
  their target lock, follow movement, and reacquire on target death/destruction
  or entry into shelter. Reacquisition remains near the original call position
  and favors targets with fewer incoming missiles. With no remaining targets,
  a missile is removed without applying phantom damage.
- Repair pads, armory pickups, mines, barrels, destroyed objects, and the
  player's occupied shelter are not direct auto-targets. Normal nearby blast
  damage to destructible cover still applies; this is not a no-collateral mode.
- Tuning is in `src/game/data/airStrike.ts`: six missiles, 520 maximum flight
  speed, 4-second lifetime, 105 splash radius, and 0.9 times chassis shell damage
  per missile. The final approach slows to avoid circling small infantry.
  Existing special cooldowns/upgrades remain in use; an empty acquisition does
  not consume cooldown. Structural impacts count as one direct hit per missile,
  without also applying that missile's splash to the same building.
- The volley uses the existing projectile loop/rendering and capped feedback
  pools. It creates no delayed callbacks, new textures, or per-missile display
  objects. Normal guidance reads its retained target; target-list allocation
  and sorting only happen on activation or lock loss. Pause freezes flight,
  retry clears all missiles, and normal homing weapons retain their old behavior.
- Updated desktop/mobile help and accessible button text to describe guided
  Air Strike. Existing control layout and bindings remain intact.

### Review and verification

- Added `tools/verify-air-strike.mjs`, run against the development-only fixture
  on port 5182 (optional Playwright package directory argument, like the other
  verification scripts). Checks run at 1366x900 desktop and 390x844 touch sizes.
- Verified six distinct locks where possible, threat priority, moving infantry
  hit by all six missiles, overflight, retargeting, range boundaries, utilities
  excluded, shelter handling, no-target cooldown, lifetime expiry, map-edge
  launches, pause/resume, retry cleanup, and unchanged weapon/ammunition.
- Checked isolated building durability: crates take one hit, brick houses three,
  concrete/open houses four, rock walls eight (two hits remain after a full
  six-missile volley). Real keyboard Q and touch-button dispatch each launch six
  missiles; even the on-foot Soldier renders air support as rockets, not bullets.
- `npm run build`, the Air Strike, balance, artwork, seven-layout controls, and
  local production desktop/mobile smoke checks all passed with no page errors.
  The existing Phaser bundle-size warning remains. Screenshots were inspected
  under ignored `artifacts/air-strike-review/`.
- Implemented locally. This request did not include another commit/push/deploy;
  publication remains pending. Physical-phone playtesting remains recommended.

---

## Request 23: Adopt selected 3D combat and ground mechanisms (2026-09-13)

### Agreed scope and implementation plan

The follow-up "implement like your recommended suggestion" approves the selected
ideas from the sibling `Tank_game_3D` project, adapted to this Phaser 2D game:

1. Make ammunition recognizable independently of the player's chassis.
2. Add material-specific destruction, short-lived debris/wrecks, and exhaust.
3. Replace the ground grid with cached terrain detail and decorative roads.
4. Give the existing Flamer, Laser, and Machine Gun their distinct mechanisms.
5. Review damage, obstruction, upgrades, pause/retry cleanup and mobile budgets;
   run new regression checks alongside the existing input/art/balance suites.

Reference mechanisms were inspected in the 3D project's `src/three/effects.ts`,
`flamethrower.ts`, `special-weapons.ts`, and `frontier-surfaces.ts`. No Three.js
runtime, 3D environment sprites, new dependency, or remote art was added. The
sibling repository was read only. Original 2D cover artwork, Blender tanks and
weapons, slower chassis speeds, infantry counts, and controls are preserved.
The previous local guided Air Strike work from Request 22 is also preserved.

### Implemented changes and tuning

- `src/game/data/weapons.ts` now explicitly identifies rifle/MG bullets and
  shotgun/scattergun pellets. Soldier rockets, rail shots and mortars no longer
  incorrectly render as rifle rounds. Autocannon rounds remain light shells.
  Structural chip damage follows ammunition: bullets/pellets apply 0.25 hits,
  ordinary shells/rockets apply one. A tank-mounted MG no longer destroys a
  crate with just one small bullet. Autocannon shell durability is unchanged.
- `src/game/data/weaponMechanics.ts` centralizes the new tuning. The Machine Gun
  alternates two firing positions at levels 1–2 and four at levels 3–4. Its
  Blender/vector barrels match those offsets, with unused barrels hidden on
  weapon swaps. It still fires eight rounds at 42 ms intervals, not sixteen or
  thirty-two; existing ammunition, damage/cooldown upgrades and retry guards
  continue to apply.
- Flamer is now a 230-world-unit, 70-degree cone with distance falloff and
  cover occlusion. One trigger applies 0.65 times upgraded shell damage, falling
  to 45% at maximum range; replaces four tiny projectiles at 0.22 each. Living
  enemies and combustible cover receive a two-second burn at 0.14 times
  upgraded shell damage per second, with the same distance factor. Existing
  armor, shields, and shelter protection still apply. Fire chips structures at
  one quarter of damage/95; stone can be chipped but does not keep burning.
  Repeated exposure refreshes a single burn, retaining the stronger DPS rather
  than stacking. Gameplay damage does not depend on visual particle counts.
- Burn damage accumulates in 200 ms intervals and integrates the final partial
  interval. Duration uses the same elapsed clock as cooldowns, including slow
  frames; pausing freezes it. Status ticks do not repeatedly push enemies or
  create damage-label spam. Shooting through one's own shelter doorway does
  not damage that shelter; firing into its wall is blocked. Flame geometry is
  evaluated before destruction, so a just-destroyed blocker does not let the
  same trigger also hit the enemy behind it.
- Laser is an instant 900-unit pulse, drawn for 160 ms. Hits are sorted along
  the ray before damage is applied: up to seven enemies, through exactly one
  concrete slab without damaging it, stopping at the second concrete slab or
  any other destructible cover. Non-concrete blocking cover receives one hit.
  The beam stops at map edges. It uses the selected weapon's normal trigger,
  ammo/cooldown, damage upgrades, recoil and energy sound, not the Strike input.
- `src/game/render/SurfaceEffects.ts` adds wood chips, stone dust/rubble, metal
  sparks/wrecks, fuel fire/smoke, and rocket exhaust. Destruction marks expire
  after 10 seconds (wrecks: 14); cosmetic fires expire after 1.8–3 seconds.
  Debris and wrecks do not become new obstacles or deal hidden area damage.
  Wood/fuel fires are cosmetic unless the actual Flamer applied a burn status.
  Original explosion rings and hit feedback are retained.
- Effects use pooled data records and existing Graphics layers, with hard
  high/reduced budgets: 160/56 particles, 32/12 ground marks, 6/2 cosmetic fires.
  Laser and flame visuals are capped at 8 and 6, respectively. Draw calls are
  culled for offscreen particles/marks/cones; no per-particle GameObjects,
  display textures, delayed callbacks, or physics bodies are created. Reduced
  effects trims the pools and simplifies flames while preserving damage cues.
- `src/game/render/GroundRenderer.ts` caches five 160x160 texture tiles: grass,
  sand, asphalt, snow, and ash. Mission palette tint, seeded irregular patches,
  decorative tracks/road markings and static water ripples provide variation.
  One TileSprite is reused across missions. Roads/water detail introduce no
  collision, speed penalties, new routes, or mission-data mutations. Terrain
  now has its own dirty flag: damage to cover rebuilds cover art, not terrain.
- Retry/new campaign clears all new combat records and status maps. The
  development-only art fixture can opt into full effects with `?effects`;
  production does not expose fixture controls or test globals.

### Review, verification and handoff

- Added `tools/verify-3d-adoption.mjs`: 77 checks each at 1366x900 desktop and
  390x844 touch sizes. Covers actual projectile draw dispatch on Soldier/Mini,
  all four MG levels and barrel hiding, burst cancellation, ammunition-specific
  structural damage, laser blockers/piercing/normal-fire ammo/map limits,
  cone angle/range/occlusion, doorway safety, burn refresh/expiry/pause, equal
  damage at 16/40/100/500 ms steps and both visual settings, retry cleanup,
  destruction idempotence, material effects, pool expiry/caps, deterministic
  terrain, five-texture/one-TileSprite reuse, and unchanged mission configs.
- Review caught and fixed autocannon shell misclassification, own-doorway
  flame damage, out-of-map laser geometry, and burn duration stretching during
  slow frames. Special weapons retain the normal alive/phase guards and recoil.
- A 600-update cosmetic/flame stress check with 27 enemies stayed within all
  budgets. Another 300 redraws created no display-object growth. CPU p95 for
  effect update/render-command work was approximately 0.2–0.4 ms on this host;
  this excludes GPU presentation and is not a physical-phone FPS guarantee.
- Production build and new adoption, Air Strike, balance, Blender artwork,
  seven-layout controls and local production desktop/mobile smoke suites were
  run. No browser page errors; the pre-existing Phaser bundle-size warning
  remains. Desktop/mobile full/reduced screenshots were inspected under the
  ignored `artifacts/3d-adoption-review/` directory. The art tests also verify
  missing-atlas fallback, unchanged cover drawings, shop and retry behavior.
- Re-run: start Vite at `127.0.0.1:5182`, then run
  `node tools/verify-3d-adoption.mjs` and the existing review scripts listed
  above. Each accepts an optional local Playwright package directory argument.
  Run `npm run build` before `node tools/verify-release.mjs` for the production
  smoke test; it starts its own local server without publishing anything.
- Implemented locally, not committed/pushed/deployed by this follow-up.
  Physical-device sustained frame pacing and the new flame/laser balance
  should be playtested before treating desktop emulation as mobile sign-off.

### Release follow-up (2026-09-13)

- The user explicitly approved committing, pushing and deploying Requests 22
  and 23 together. This supersedes their implementation-only publication scope.
- Release through `main` on `git@github.com:buicongnguyen/Tank_game.git`, using
  the existing `Deploy To GitHub Pages` workflow. No generated screenshots,
  `dist` output, dependency folders, or sibling-repository files are committed.
- Preflight: rebuild and run the local production smoke check. After the Pages
  workflow completes, compare the live JS/CSS and Blender atlas hashes against
  that production build and test desktop/mobile start, pause and resume.
  Report the resulting commit and live-verification outcome in the release
  response; physical-phone performance remains a separate playtest follow-up.
