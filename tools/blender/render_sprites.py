"""Bake the sibling game's Blender models into a reusable 2D combat atlas.

blender --background --factory-startup --python tools/blender/render_sprites.py
All inputs are vendored locally; this never writes to Tank_game_3D.
"""
import bpy
import json
import math
import struct
import sys
import zlib
from pathlib import Path

import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'assets/blender/source'
OUT = ROOT / ('artifacts/blender-sample' if '--sample' in sys.argv else 'public/art/blender')
OUT.mkdir(parents=True, exist_ok=True)
SIZE = 192
SPAN = 4.8  # radius units, shared with BlenderSprites.ts; origin stays centered
FRAMES = {}
PIXELS = []
REPORT = []


def linear(value):
    value = int(value, 16) / 255
    return value / 12.92 if value <= .04045 else ((value + .055) / 1.055) ** 2.4


def recolor(name, code):
    for material in bpy.data.materials:
        if material.name.split('.')[0] != name:
            continue
        color = tuple(linear(code[i:i + 2]) for i in (0, 2, 4)) + (1,)
        material.diffuse_color = color
        material.use_nodes = True
        bsdf = material.node_tree.nodes.get('Principled BSDF')
        if bsdf:
            bsdf.inputs['Base Color'].default_value = color
            bsdf.inputs['Roughness'].default_value = .62


def load(name):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if name:
        bpy.ops.import_scene.gltf(filepath=str(SOURCE / f'{name}.glb'))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 16
    scene.cycles.use_denoising = True
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = 4
    scene.render.resolution_x = SIZE
    scene.render.resolution_y = SIZE
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.view_settings.view_transform = 'Standard'
    world = bpy.data.worlds.new('Studio')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (.45, .52, .62, 1)
    world.node_tree.nodes['Background'].inputs[1].default_value = .5
    scene.world = world
    bpy.ops.object.camera_add(location=(0, 0, 14))
    camera = bpy.context.object
    camera.name = 'Top-down orthographic camera'
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = SPAN
    camera.rotation_euler = (0, 0, 0)
    scene.camera = camera
    for pos, energy, size in [((-3, 4, 8), 650, 6), ((4, -2, 6), 400, 5)]:
        bpy.ops.object.light_add(type='AREA', location=pos)
        light = bpy.context.object
        light.data.energy = energy
        light.data.size = size
        light.rotation_euler = (-light.location).to_track_quat('-Z', 'Y').to_euler()
    return meshes


def is_under(obj, name):
    while obj:
        if obj.name == name:
            return True
        obj = obj.parent
    return False


def bounds(meshes):
    bpy.context.view_layer.update()
    points = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
    return [min(v[i] for v in points) for i in range(3)], [max(v[i] for v in points) for i in range(3)]


def png(path, pixels):
    """Write generated RGBA pixels without an external image dependency."""
    height, width, _ = pixels.shape
    def chunk(kind, data):
        return struct.pack('!I', len(data)) + kind + data + struct.pack('!I', zlib.crc32(kind + data))
    rows = b''.join(b'\x00' + row.tobytes() for row in pixels)
    path.write_bytes(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!2I5B', width, height, 8, 6, 0, 0, 0))
                     + chunk(b'IDAT', zlib.compress(rows, 9)) + chunk(b'IEND', b''))


def render(name, crop=False):
    scene = bpy.context.scene
    # Reload the saved render so Blender applies the view transform before packing.
    intermediate = OUT / f'.{name}.png'
    scene.render.filepath = str(intermediate)
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(str(intermediate), check_existing=False)
    pixels = np.empty(SIZE * SIZE * 4, dtype=np.float32)
    img.pixels.foreach_get(pixels)
    pixels = pixels.reshape(SIZE, SIZE, 4)[::-1].copy()
    # Loaded PNG pixel data is sRGB for this generated file in Blender's image API.
    rgba = np.clip(np.round(pixels * 255), 0, 255).astype(np.uint8)
    bpy.data.images.remove(img)
    intermediate.unlink()
    if crop:
        y, x = np.nonzero(rgba[:, :, 3] > 4)
        if len(x):
            rgba = rgba[max(0, y.min() - 2):min(SIZE, y.max() + 3), max(0, x.min() - 2):min(SIZE, x.max() + 3)]
    index = len(PIXELS)
    height, width = rgba.shape[:2]
    FRAMES[name] = {'frame': {'x': (index % 8) * SIZE, 'y': (index // 8) * SIZE, 'w': width, 'h': height},
                    'rotated': False, 'trimmed': False,
                    'spriteSourceSize': {'x': 0, 'y': 0, 'w': width, 'h': height},
                    'sourceSize': {'w': width, 'h': height}}
    PIXELS.append(rgba)
    REPORT.append(name)
    print('SPRITE_COMPLETE', name, flush=True)


def preview(name, meshes):
    for obj in meshes:
        obj.hide_render = False
    scene = bpy.context.scene
    scene.camera.location = (4, -6, 5)
    scene.camera.rotation_euler = (Vector((0, 0, .45)) - scene.camera.location).to_track_quat('-Z', 'Y').to_euler()
    scene.camera.data.ortho_scale = 4.5
    scene.render.resolution_x = 384
    scene.render.resolution_y = 256
    scene.render.filepath = str(OUT / f'unit-{name}.png')
    bpy.ops.render.render(write_still=True)


def tank(variant, faction):
    meshes = load('tank')
    root = bpy.data.objects['Tank']
    # Source front is -Y. The 2D game faces +X at zero radians.
    root.rotation_mode = 'XYZ'
    root.rotation_euler.z = math.pi / 2
    root.scale = (.56, .56, .56)
    hull = bpy.data.objects['Hull']
    turret = bpy.data.objects['Turret']
    if variant == 'mini':
        hull.scale = (1, .78, .8)
        turret.scale = (.8, .65, .72)
        # A genuine twin machine-gun preview, matching the Mini Tank's loadout.
        for obj in list(meshes):
            if obj.name in ('GunBarrel', 'MuzzleBrake', 'Detail thermal sleeve', 'Detail muzzle bore'):
                for side in (-1, 1):
                    twin = obj.copy()
                    twin.data = obj.data.copy()
                    bpy.context.collection.objects.link(twin)
                    twin.location.x += side * .28
                    meshes.append(twin)
                meshes.remove(obj)
                bpy.data.objects.remove(obj, do_unlink=True)
    elif variant == 'scout':
        hull.scale = (.88, .95, .84)
        turret.scale = (.78, .82, .88)
    elif variant == 'siege':
        hull.scale = (1.13, 1.03, 1.08)
        turret.scale = (1.15, 1.13, 1.06)
    player_colors = {'Armor': '6c988b', 'Trim': 'bbd0b4', 'Tracks': '333e42', 'Gunmetal': '728381', 'Signal': 'a1f9d7'}
    enemy_colors = {'Armor': 'a95f48', 'Trim': 'd8b080', 'Tracks': '34363c', 'Gunmetal': '7a7774', 'Signal': 'ffb45e'}
    for key, color in (player_colors if faction == 'player' else enemy_colors).items():
        recolor(key, color)
    # Extra reactive armor is authored here for the heavy silhouette.
    if variant == 'siege':
        for side in (-1, 1):
            for y in (-.9, -.3, .3, .9):
                bpy.ops.mesh.primitive_cube_add(size=1)
                block = bpy.context.object
                block.name = 'Reactive armor'
                block.parent = hull
                block.location = (side * 1.13, y, 1.1)
                block.scale = (.48, .45, .22)
                block.data.materials.append(bpy.data.materials['Armor'])
                bevel = block.modifiers.new('Edge highlights', 'BEVEL')
                bevel.width = .08
                bevel.segments = 1
                meshes.append(block)
    gun_names = ('GunBarrel', 'MuzzleBrake', 'Bore', 'Barrel', 'Muzzle', 'thermal sleeve')
    for layer in ('hull', 'turret'):
        for obj in meshes:
            turret_part = is_under(obj, 'Turret')
            gun = any(token.lower() in obj.name.lower() for token in gun_names)
            obj.hide_render = (turret_part if layer == 'hull' else not turret_part) or gun
        render(f'{faction}-{variant}-{layer}')
    if faction == 'player':
        preview({'mini': 'rocketeer', 'scout': 'light', 'player': 'medium', 'siege': 'heavy'}[variant], meshes)
        if variant == 'siege':
            # Editable reference with the actual render rig and adapted armor.
            bpy.context.preferences.filepaths.save_version = 0
            bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'assets/blender/sprite-studio.blend'))


def infantry(kind, faction):
    meshes = load(kind)
    root = bpy.data.objects[kind]
    root.rotation_mode = 'XYZ'
    root.rotation_euler.z = math.pi / 2
    root.scale = (1.2, 1.2, 1.2)
    recolor('InfantryUniform', '6c988b' if faction == 'player' else 'a56647')
    recolor('InfantryHelmet', 'c2d3ae' if faction == 'player' else 'd2ac65')
    for layer in ('hull', 'turret'):
        for obj in meshes:
            obj.hide_render = is_under(obj, 'Turret') if layer == 'hull' else not is_under(obj, 'Turret')
        render(f'{faction}-{kind}-{layer}')
    if kind == 'rifleman' and faction == 'player':
        preview('rifleman', meshes)


def prop(name, source):
    meshes = load(source)
    # Convert deliberate sRGB art colors to linear PBR values; the source kit
    # used brighter linear material values suited to its outdoor 3D lighting.
    for material, color in [('Concrete', '8b958d'), ('Granite', '7c877e'),
                            ('Supply', 'be9256'), ('Fuel', 'b75c40')]:
        recolor(material, color)
    if name == 'houseOpen':
        recolor('Terracotta', '9aa799')
        recolor('Slate', '657e7a')
    elif name == 'houseSealed':
        recolor('Slate', 'a97552')
    low, high = bounds(meshes)
    camera = bpy.context.scene.camera
    camera.location.x = (low[0] + high[0]) / 2
    camera.location.y = (low[1] + high[1]) / 2
    camera.data.ortho_scale = max(high[0] - low[0], high[1] - low[1]) * 1.08
    render(f'prop-{name}', crop=True)


def weapon(kind):
    load(None)
    def material(name, color, metallic):
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        m.node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value = metallic
        recolor(name, color)
        return m
    steel = material('Weapon steel', '829391', .55)
    dark = material('Weapon recess', '29373e', .25)
    accent = material('Weapon signal', 'f0be6a' if kind in ('launcher', 'mortar', 'drone') else '96d7e4', .1)
    def box(x, y, z, sx, sy, sz, mat):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, z))
        obj = bpy.context.object
        obj.dimensions = (sx, sy, sz)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        obj.data.materials.append(mat)
        mod = obj.modifiers.new('Beveled weapon casing', 'BEVEL')
        mod.width = .018
        mod.segments = 2
    width = .24 if kind in ('launcher', 'mortar') else .14
    box(0, 0, .12, 1, width, .17, steel)
    box(-.32, 0, .16, .28, width * 1.25, .22, dark)
    box(.45, 0, .13, .11, width * 1.4, .22, dark)
    box(.40, 0, .245, .1, width * 1.05, .02, steel)
    for x in (-.12, .04, .20):
        box(x, 0, .22, .035, width * 1.05, .05, dark)
    if kind in ('rail', 'rapid'):
        for side in (-1, 1):
            box(.09, side * width * .32, .255, .62, .025, .025, accent)
    if kind in ('launcher', 'mortar', 'drone'):
        box(.06, 0, .26, .42, width * .55, .03, accent)
    if kind == 'drone':
        for side in (-1, 1):
            box(-.05, side * .18, .15, .72, .065, .07, dark)
    bpy.context.scene.camera.data.ortho_scale = 1.22
    render(f'weapon-{kind}', crop=True)


if '--sample' in sys.argv:
    tank('player', 'player')
else:
    for team in ('player', 'enemy'):
        for archetype in ('mini', 'scout', 'player', 'siege'):
            tank(archetype, team)
        for archetype in ('rifleman', 'rocketeer'):
            infantry(archetype, team)
    for key, model in [('crate', 'crate'), ('barrel', 'barrel'), ('concrete', 'barricade'),
                       ('rockWall', 'stonewall'), ('houseOpen', 'house'), ('houseSealed', 'house'), ('transport', 'transport')]:
        prop(key, model)
    for kind in ('cannon', 'rapid', 'launcher', 'rail', 'mortar', 'drone'):
        weapon(kind)

height = math.ceil(len(PIXELS) / 8) * SIZE
atlas = np.zeros((height, 8 * SIZE, 4), dtype=np.uint8)
for name, pixels in zip(REPORT, PIXELS):
    frame = FRAMES[name]['frame']
    atlas[frame['y']:frame['y'] + frame['h'], frame['x']:frame['x'] + frame['w']] = pixels
png(OUT / 'combat.png', atlas)
(OUT / 'combat.json').write_text(json.dumps({'frames': FRAMES, 'meta': {
    'app': 'Blender 4.5 / tools/blender/render_sprites.py', 'image': 'combat.png',
    'size': {'w': 8 * SIZE, 'h': height}, 'scale': '1', 'radiusSpan': SPAN}}, indent=2))
print('ATLAS_COMPLETE', len(FRAMES), (OUT / 'combat.png').stat().st_size, flush=True)
