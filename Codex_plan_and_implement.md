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

## Implementation Summary

### 1. Mobile movement and aiming

Files:

- `src/game/ui/TouchControls.ts`
- `src/game/scenes/BattleScene.ts`
- `src/game/ui/InterfaceController.ts`
- `src/style.css`

Changes:

- Anchored the movement stick at the bottom-left with safe-area-aware offsets.
- Removed the invisible/floating right-side aim stick, which intercepted a large part of the battlefield.
- Added tap-to-aim through Phaser pointer-down and pointer-move events.
- Touching the battlefield aims but does not automatically fire.
- Desktop mouse input still supports mouse aiming and click-to-fire.
- Action-button events remain in the DOM overlay and no longer cause the turret to jump toward a button location.
- Updated the displayed mobile control instructions.

Expected mobile control layout:

- Bottom-left: movement stick.
- Bottom-right: cannon, secondary weapon, weapon swap, artillery, and repair buttons.
- Remaining battlefield: tap or drag to aim the turret.

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
- Movement stick was measured at 18 px from the left and 36 px above the bottom safe-area position in this viewport.
- No right aim-stick element remains.
- Tapping the open battlefield changes turret direction.
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

- `src/game/audio/BattleMusic.ts`
- `src/game/core/GameDirector.ts`
- `src/game/data/weapons.ts`
- `src/game/scenes/BattleScene.ts`
- `src/game/types.ts`
- `src/game/ui/InterfaceController.ts`
- `src/game/ui/TouchControls.ts`
- `src/style.css`
- `Codex_plan_and_implement.md`

These changes are currently uncommitted unless the repository state is changed after this handoff was written.

## Suggested Review Checklist for Claude

### Controls

- Confirm tap-to-aim feels correct on a real Android/iOS device, not only a responsive browser viewport.
- Confirm multi-touch permits holding the movement stick while pressing action buttons.
- Confirm tapping or dragging the battlefield does not fire unless the player presses the fire button.
- Confirm desktop mouse click-to-fire behavior remains desirable.

### Shop/economy

- Confirm stage rewards feel large enough to make at least one useful purchase after early missions.
- Review weapon and chassis prices for campaign pacing.
- Confirm the distinction between lifetime scrap and spendable credits is useful; consider removing one currency if it is redundant.
- Confirm the final mission should go directly to victory rather than offering one last shop visit.

### Weapon balance

- Review multiplicative Level 2-4 weapon scaling for late-campaign balance.
- Confirm upgraded secondary weapons should improve damage, velocity, and cooldown together.
- Confirm purchasing/upgrading a weapon should automatically equip it.

### Combat

- Review swept collision and piercing target order for edge cases when a projectile intersects cover and a tank in the same frame.
- Review tank separation near cover and world boundaries for visible jitter.
- Confirm delayed effects pause and resume as intended.

### Performance

- Profile on a physical low/mid-range phone.
- If further optimization is needed, the next major opportunity is splitting static and dynamic Phaser graphics layers or caching static cover/terrain artwork into render textures.
- The main production bundle is still approximately 354 KB gzip and triggers Vite's large-chunk warning.

## Known Limitations

- The repository does not currently provide an automated unit/integration test script in `package.json`.
- Mobile performance was smoke-tested in a responsive in-app browser, not measured on physical hardware.
- Weapon upgrades affect the selected secondary weapon system; the main cannon continues to use global vehicle damage/reload upgrades.
- Shop state is campaign-memory only and is not persisted across page reloads or application restarts.
