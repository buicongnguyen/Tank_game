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
