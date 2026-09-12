# Blender-rendered 2D art

The game remains a top-down Phaser game. Blender runs only while authoring art;
players download PNG images, not models or a 3D engine.

After the September 12 visual review, houses, crates, barrels, concrete buildings
and rock walls use their original procedural 2D artwork again. Blender tanks,
infantry, weapons, the escorted transport and shop previews remain enabled.
The six unused cover frames and their source models are retained for art
experiments, but the game no longer creates or draws Blender cover Images.

## Art direction and source

Selected from the user's sibling `Tank_game_3D` project: its original `tank`,
`rifleman`, `rocketeer`, `crate`, `barrel`, `barricade`, `stonewall`, `house`, and
`transport` GLB models. The copies in `source/` make regeneration independent of
that checkout, which is not modified by this work. Their original authoring
scripts are `tools/blender/build_assets.py`, `build_infantry.py`,
`build_environment.py`, and `asset_detail.py` in the sibling project.

Adaptations include distinct compact, light, medium, and heavy chassis,
reactive armor on the heavy, twin guns on the Mini Tank preview, green player
and rust enemy palettes, and an orthographic top-down camera. Six weapon
attachments are authored directly in the render script. House colors separate
concrete shelters from sealed brick buildings. Door markers and damage cracks
remain dynamic in the game.

`sprite-studio.blend` is an editable example of the heavy tank, its material
setup, studio lights, and preview camera. All models and output images can be
regenerated from the script and the vendored source files.

## Rebuild

From the Tank_game root with Blender 4.5 LTS:

```powershell
& 'C:\Users\n\source\repos\3d_astra\.tools\blender-4.5.3-windows-x64\blender.exe' --background --factory-startup --python-exit-code 1 --python tools/blender/render_sprites.py
npm run build
```

Alternatively use your own Blender executable in that command. No add-ons,
Pillow, downloads, or sibling repo access are required. Rendering uses Cycles
on four CPU threads at 16 samples. `-- --sample` writes a small proof render
to the ignored `artifacts/blender-sample/` folder without replacing the atlas.

Outputs in `public/art/blender/`:

- `combat.png` and `combat.json`: one 1536 × 960 RGBA Phaser atlas, 37 frames.
- 24 independently rotatable unit layers: four tank variants plus rifle and
  rocket infantry, each in two faction palettes, each with hull and turret.
- Seven cover/transport images and six weapon attachments.
- Five `unit-*.png` images for the shop's current-unit preview.

## Integration constraints

- Unit tiles are 192 × 192 and span 4.8 collision-radius units; their rotation
  origin is the exact center. Forward is +X, matching the simulation.
- Weapons and cover are alpha-cropped with transparent padding. Weapons use
  a left-center origin and the existing barrel dimensions and aim angle.
- The map is still flat: no camera projection, collision, damage, prices,
  vehicle statistics, or projectile simulation changes.
- Images are reused per unit. Original vector cover updates only when dirty;
  off-screen/dead/sheltered units hide their images; retry and scene shutdown
  destroy previous image objects. The single atlas occupies about 5.6 MiB of
  uncompressed RGBA texture memory, before any driver overhead.
- Existing vector art is the fallback for failed atlas loads and for special
  stationary turrets and enemy convoy chassis not converted in this pass.
- Normal color-coded health, exposure, hit rings, weapon effects, and shelter
  indicators are drawn above the image layers.

## Review and verification

Start `npm run dev -- --host 127.0.0.1 --port 5182 --strictPort`, then open
`http://127.0.0.1:5182/tools/art-review.html` for the development-only encounter.
It uses the real BattleScene and InterfaceController. Review code is excluded
from the production build.

Optional automated checks use an installed Playwright package:

```powershell
node tools/verify-blender.mjs C:\Users\n\source\repos\Tank_game_3D\node_modules\playwright
```

Or run `node tools/verify-blender.mjs` if Playwright is installed in this repo.
Set `ART_REVIEW_URL` if your local server uses a different port. Screenshots go
to ignored `artifacts/blender-review/`. Checks cover aiming pivots, object reuse,
weapon changes, shelter/death/destruction, retry cleanup, missing-asset fallback,
the shop on a phone viewport, and touch controls in the normal game entry point.

`node tools/verify-controls.mjs` (with the same optional Playwright directory)
tests the matching 3D-style pads, size-aware nub travel, independent multitouch,
weapon swapping, battlefield tap-to-fire, cancellation and resize/blur cleanup
at seven phone/tablet/desktop sizes. Its fixture is `tools/art-review.html?controls`;
screenshots are saved to ignored `artifacts/control-review/`.

After `npm run build`, verify the actual production bundle at the GitHub Pages
subpath with `node tools/verify-release.mjs` (the same optional Playwright package
directory argument is supported). It starts a temporary local server and checks
desktop/mobile startup, pause/resume, page errors, and the loaded atlas hash.
Set `ART_RELEASE_URL=https://buicongnguyen.github.io/Tank_game/` to run those
checks against the deployed site instead.
