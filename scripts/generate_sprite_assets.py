#!/usr/bin/env python3
from __future__ import annotations

import math
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUT_ROOT = ROOT / "public" / "assets" / "sprites"

PLAYER_LOGICAL = (32, 32)
PLAYER_SCALE = 2
ENEMY_LOGICAL = (24, 24)
ENEMY_SCALE = 2
BOSS_LOGICAL = (64, 48)
BOSS_SCALE = 2


@dataclass(frozen=True)
class SoldierPalette:
    skin: tuple[int, int, int, int]
    hair: tuple[int, int, int, int]
    bandana: tuple[int, int, int, int]
    vest: tuple[int, int, int, int]
    pants: tuple[int, int, int, int]
    boots: tuple[int, int, int, int]
    weapon: tuple[int, int, int, int]
    accent: tuple[int, int, int, int]


@dataclass(frozen=True)
class StagePalette:
    primary: tuple[int, int, int, int]
    secondary: tuple[int, int, int, int]
    trim: tuple[int, int, int, int]
    hull: tuple[int, int, int, int]
    glow: tuple[int, int, int, int]
    muzzle: tuple[int, int, int, int]


PLAYER_PALETTE = SoldierPalette(
    skin=(203, 162, 118, 255),
    hair=(29, 18, 15, 255),
    bandana=(175, 34, 32, 255),
    vest=(101, 117, 64, 255),
    pants=(53, 77, 46, 255),
    boots=(66, 42, 26, 255),
    weapon=(100, 106, 112, 255),
    accent=(232, 177, 74, 255),
)

ENEMY_PALETTES: dict[str, SoldierPalette] = {
    "emerald": SoldierPalette(
        skin=(180, 144, 108, 255),
        hair=(20, 18, 16, 255),
        bandana=(144, 31, 24, 255),
        vest=(76, 96, 49, 255),
        pants=(44, 65, 36, 255),
        boots=(52, 38, 24, 255),
        weapon=(115, 116, 120, 255),
        accent=(225, 160, 78, 255),
    ),
    "river": SoldierPalette(
        skin=(182, 146, 112, 255),
        hair=(17, 17, 21, 255),
        bandana=(42, 89, 104, 255),
        vest=(73, 103, 108, 255),
        pants=(41, 62, 74, 255),
        boots=(38, 42, 46, 255),
        weapon=(150, 161, 166, 255),
        accent=(120, 214, 214, 255),
    ),
    "blacksite": SoldierPalette(
        skin=(184, 149, 116, 255),
        hair=(22, 18, 18, 255),
        bandana=(187, 74, 32, 255),
        vest=(75, 77, 89, 255),
        pants=(45, 47, 56, 255),
        boots=(36, 31, 30, 255),
        weapon=(161, 164, 171, 255),
        accent=(255, 116, 71, 255),
    ),
}

STAGE_PALETTES: dict[str, StagePalette] = {
    "emerald": StagePalette(
        primary=(92, 117, 68, 255),
        secondary=(130, 151, 82, 255),
        trim=(223, 171, 86, 255),
        hull=(110, 60, 47, 255),
        glow=(255, 190, 104, 255),
        muzzle=(255, 208, 118, 255),
    ),
    "river": StagePalette(
        primary=(80, 110, 118, 255),
        secondary=(116, 151, 153, 255),
        trim=(119, 216, 214, 255),
        hull=(77, 96, 112, 255),
        glow=(176, 247, 244, 255),
        muzzle=(172, 249, 243, 255),
    ),
    "blacksite": StagePalette(
        primary=(84, 82, 96, 255),
        secondary=(128, 126, 138, 255),
        trim=(255, 120, 74, 255),
        hull=(70, 70, 78, 255),
        glow=(255, 174, 120, 255),
        muzzle=(255, 186, 129, 255),
    ),
}


def make_canvas(size: tuple[int, int]) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    image = Image.new("RGBA", size, (0, 0, 0, 0))
    return image, ImageDraw.Draw(image)


def upscale(image: Image.Image, scale: int) -> Image.Image:
    return image.resize((image.width * scale, image.height * scale), Image.Resampling.NEAREST)


def draw_segment(draw: ImageDraw.ImageDraw, start: tuple[float, float], end: tuple[float, float], width: float, fill: tuple[int, int, int, int]) -> None:
    dx = end[0] - start[0]
    dy = end[1] - start[1]
    length = math.hypot(dx, dy) or 1
    nx = -dy / length * width / 2
    ny = dx / length * width / 2
    points = [
        (start[0] + nx, start[1] + ny),
        (end[0] + nx, end[1] + ny),
        (end[0] - nx, end[1] - ny),
        (start[0] - nx, start[1] - ny),
    ]
    draw.polygon(points, fill=fill)


def draw_dot(draw: ImageDraw.ImageDraw, center: tuple[float, float], radius: float, fill: tuple[int, int, int, int]) -> None:
    draw.ellipse(
        (center[0] - radius, center[1] - radius, center[0] + radius, center[1] + radius),
        fill=fill,
    )


def draw_flash(draw: ImageDraw.ImageDraw, center: tuple[float, float], color: tuple[int, int, int, int], scale: float = 1.0) -> None:
    x, y = center
    points = [
        (x, y - 1 * scale),
        (x + 2 * scale, y - 2 * scale),
        (x + 3 * scale, y),
        (x + 5 * scale, y - 1 * scale),
        (x + 4 * scale, y + 1 * scale),
        (x + 6 * scale, y + 3 * scale),
        (x + 3 * scale, y + 3 * scale),
        (x + 2 * scale, y + 5 * scale),
        (x + 1 * scale, y + 3 * scale),
        (x - 1 * scale, y + 4 * scale),
        (x, y + 1 * scale),
    ]
    draw.polygon(points, fill=color)


def draw_humanoid(
    size: tuple[int, int],
    palette: SoldierPalette,
    pose: dict[str, tuple[float, float] | float],
    weapon_kind: str,
    muzzle: bool = False,
    prone: bool = False,
) -> Image.Image:
    image, draw = make_canvas(size)
    head = pose["head"]
    shoulder = pose["shoulder"]
    hip = pose["hip"]
    stock = pose["stock"]
    muzzle_point = pose["muzzle"]
    support = pose["support"]
    trigger = pose["trigger"]
    front_knee = pose["front_knee"]
    front_foot = pose["front_foot"]
    rear_knee = pose["rear_knee"]
    rear_foot = pose["rear_foot"]
    bandana_tail = pose["bandana_tail"]

    if prone:
      draw_segment(draw, (head[0] - 1, head[1] + 4), (muzzle_point[0] + 1, muzzle_point[1] + 1), 4.6, palette.vest)
      draw_segment(draw, (hip[0] - 1, hip[1] + 1), (rear_foot[0], rear_foot[1]), 3.0, palette.pants)
      draw_segment(draw, (hip[0] + 1, hip[1]), (front_foot[0], front_foot[1]), 3.0, palette.pants)
    else:
      draw_segment(draw, hip, front_knee, 3.2, palette.pants)
      draw_segment(draw, front_knee, front_foot, 3.0, palette.pants)
      draw_segment(draw, hip, rear_knee, 3.2, palette.pants)
      draw_segment(draw, rear_knee, rear_foot, 3.0, palette.pants)
      draw_segment(draw, shoulder, hip, 5.2, palette.vest)

    draw_segment(draw, shoulder, support, 2.8, palette.skin)
    draw_segment(draw, shoulder, trigger, 2.8, palette.skin)
    draw_segment(draw, stock, muzzle_point, 2.6 if weapon_kind == "rifle" else 3.3, palette.weapon)

    if weapon_kind == "launcher":
      draw.rectangle((stock[0] - 1, stock[1] - 1, stock[0] + 4, stock[1] + 2), fill=palette.weapon)
      draw.rectangle((muzzle_point[0] - 2, muzzle_point[1] - 1, muzzle_point[0] + 1, muzzle_point[1] + 1), fill=palette.accent)

    draw_dot(draw, head, 3.2, palette.skin)
    draw.pieslice((head[0] - 3.4, head[1] - 3.4, head[0] + 3.4, head[1] + 3.4), 180, 360, fill=palette.hair)
    draw_segment(draw, (head[0] - 3, head[1] - 0.8), (head[0] + 3, head[1] - 0.8), 2.0, palette.bandana)
    draw_segment(draw, (head[0] - 2.6, head[1] - 0.5), bandana_tail, 1.4, palette.bandana)
    draw_segment(draw, (hip[0] - 1.4, hip[1] - 2), (hip[0] - 4.8, hip[1] + 2), 3.2, palette.accent)

    if muzzle:
      draw_flash(draw, muzzle_point, palette.accent)

    return image


PLAYER_POSES: dict[str, list[dict[str, tuple[float, float] | float]]] = {
    "idle": [
        {"head": (11, 9), "shoulder": (14, 14), "hip": (14, 20), "stock": (16, 15), "muzzle": (27, 14), "support": (17, 14), "trigger": (19, 16), "front_knee": (15, 24), "front_foot": (18, 29), "rear_knee": (12, 24), "rear_foot": (11, 29), "bandana_tail": (7, 11)},
        {"head": (11, 10), "shoulder": (14, 15), "hip": (14, 21), "stock": (16, 16), "muzzle": (27, 15), "support": (17, 15), "trigger": (19, 17), "front_knee": (15, 25), "front_foot": (18, 29), "rear_knee": (12, 25), "rear_foot": (11, 29), "bandana_tail": (7, 12)},
        {"head": (11, 9), "shoulder": (14, 14), "hip": (14, 20), "stock": (16, 15), "muzzle": (27, 14), "support": (17, 14), "trigger": (19, 16), "front_knee": (15, 24), "front_foot": (18, 29), "rear_knee": (12, 24), "rear_foot": (11, 29), "bandana_tail": (7, 11)},
        {"head": (11, 8), "shoulder": (14, 13), "hip": (14, 19), "stock": (16, 14), "muzzle": (27, 13), "support": (17, 13), "trigger": (19, 15), "front_knee": (15, 23), "front_foot": (18, 29), "rear_knee": (12, 23), "rear_foot": (11, 29), "bandana_tail": (7, 10)},
    ],
    "walk": [
        {"head": (11, 9), "shoulder": (14, 14), "hip": (14, 20), "stock": (16, 15), "muzzle": (27, 14), "support": (17, 14), "trigger": (19, 16), "front_knee": (17, 23), "front_foot": (20, 29), "rear_knee": (12, 24), "rear_foot": (10, 29), "bandana_tail": (7, 11)},
        {"head": (11, 10), "shoulder": (14, 15), "hip": (14, 21), "stock": (16, 16), "muzzle": (27, 15), "support": (17, 15), "trigger": (19, 17), "front_knee": (16, 25), "front_foot": (18, 29), "rear_knee": (13, 24), "rear_foot": (10, 27), "bandana_tail": (7, 12)},
        {"head": (11, 9), "shoulder": (14, 14), "hip": (14, 20), "stock": (16, 15), "muzzle": (27, 14), "support": (17, 14), "trigger": (19, 16), "front_knee": (14, 24), "front_foot": (16, 28), "rear_knee": (11, 23), "rear_foot": (8, 29), "bandana_tail": (7, 11)},
        {"head": (11, 8), "shoulder": (14, 13), "hip": (14, 19), "stock": (16, 14), "muzzle": (27, 13), "support": (17, 13), "trigger": (19, 15), "front_knee": (15, 22), "front_foot": (18, 27), "rear_knee": (11, 22), "rear_foot": (8, 29), "bandana_tail": (7, 10)},
    ],
    "run": [
        {"head": (10, 8), "shoulder": (13, 13), "hip": (13, 19), "stock": (15, 14), "muzzle": (27, 13), "support": (16, 13), "trigger": (18, 15), "front_knee": (18, 21), "front_foot": (22, 28), "rear_knee": (11, 24), "rear_foot": (8, 29), "bandana_tail": (5, 10)},
        {"head": (10, 9), "shoulder": (13, 14), "hip": (13, 20), "stock": (15, 15), "muzzle": (27, 14), "support": (16, 14), "trigger": (18, 16), "front_knee": (16, 24), "front_foot": (19, 29), "rear_knee": (10, 22), "rear_foot": (6, 26), "bandana_tail": (5, 11)},
        {"head": (10, 10), "shoulder": (13, 15), "hip": (13, 21), "stock": (15, 16), "muzzle": (27, 15), "support": (16, 15), "trigger": (18, 17), "front_knee": (14, 25), "front_foot": (16, 29), "rear_knee": (10, 21), "rear_foot": (5, 25), "bandana_tail": (5, 12)},
        {"head": (10, 9), "shoulder": (13, 14), "hip": (13, 20), "stock": (15, 15), "muzzle": (27, 14), "support": (16, 14), "trigger": (18, 16), "front_knee": (12, 24), "front_foot": (13, 29), "rear_knee": (10, 21), "rear_foot": (4, 29), "bandana_tail": (5, 11)},
        {"head": (10, 8), "shoulder": (13, 13), "hip": (13, 19), "stock": (15, 14), "muzzle": (27, 13), "support": (16, 13), "trigger": (18, 15), "front_knee": (14, 20), "front_foot": (18, 25), "rear_knee": (11, 23), "rear_foot": (7, 29), "bandana_tail": (5, 10)},
        {"head": (10, 7), "shoulder": (13, 12), "hip": (13, 18), "stock": (15, 13), "muzzle": (27, 12), "support": (16, 12), "trigger": (18, 14), "front_knee": (16, 19), "front_foot": (20, 25), "rear_knee": (12, 22), "rear_foot": (10, 29), "bandana_tail": (5, 9)},
    ],
    "crawl": [
        {"head": (10, 18), "shoulder": (13, 18), "hip": (18, 20), "stock": (16, 18), "muzzle": (28, 18), "support": (17, 18), "trigger": (20, 19), "front_knee": (21, 23), "front_foot": (24, 24), "rear_knee": (16, 23), "rear_foot": (11, 24), "bandana_tail": (7, 19)},
        {"head": (10, 17), "shoulder": (13, 17), "hip": (18, 19), "stock": (16, 17), "muzzle": (28, 17), "support": (17, 17), "trigger": (20, 18), "front_knee": (20, 22), "front_foot": (24, 23), "rear_knee": (16, 22), "rear_foot": (12, 23), "bandana_tail": (7, 18)},
        {"head": (10, 18), "shoulder": (13, 18), "hip": (18, 20), "stock": (16, 18), "muzzle": (28, 18), "support": (17, 18), "trigger": (20, 19), "front_knee": (21, 23), "front_foot": (25, 24), "rear_knee": (16, 23), "rear_foot": (12, 24), "bandana_tail": (7, 19)},
        {"head": (10, 19), "shoulder": (13, 19), "hip": (18, 21), "stock": (16, 19), "muzzle": (28, 19), "support": (17, 19), "trigger": (20, 20), "front_knee": (22, 24), "front_foot": (25, 25), "rear_knee": (17, 24), "rear_foot": (12, 25), "bandana_tail": (7, 20)},
    ],
    "kneel": [
        {"head": (11, 10), "shoulder": (14, 15), "hip": (14, 20), "stock": (16, 16), "muzzle": (27, 15), "support": (17, 15), "trigger": (19, 17), "front_knee": (18, 23), "front_foot": (20, 28), "rear_knee": (12, 25), "rear_foot": (12, 29), "bandana_tail": (7, 12)},
        {"head": (11, 10), "shoulder": (14, 15), "hip": (14, 20), "stock": (16, 16), "muzzle": (27, 15), "support": (17, 15), "trigger": (19, 17), "front_knee": (18, 23), "front_foot": (20, 28), "rear_knee": (12, 25), "rear_foot": (12, 29), "bandana_tail": (7, 12)},
        {"head": (11, 9), "shoulder": (14, 14), "hip": (14, 19), "stock": (16, 15), "muzzle": (27, 14), "support": (17, 14), "trigger": (19, 16), "front_knee": (18, 22), "front_foot": (20, 28), "rear_knee": (12, 24), "rear_foot": (12, 29), "bandana_tail": (7, 11)},
        {"head": (11, 10), "shoulder": (14, 15), "hip": (14, 20), "stock": (16, 16), "muzzle": (27, 15), "support": (17, 15), "trigger": (19, 17), "front_knee": (18, 23), "front_foot": (20, 28), "rear_knee": (12, 25), "rear_foot": (12, 29), "bandana_tail": (7, 12)},
    ],
    "jump": [
        {"head": (10, 8), "shoulder": (13, 13), "hip": (15, 17), "stock": (16, 14), "muzzle": (28, 13), "support": (17, 13), "trigger": (19, 15), "front_knee": (18, 20), "front_foot": (22, 22), "rear_knee": (12, 19), "rear_foot": (8, 20), "bandana_tail": (4, 10)},
        {"head": (9, 7), "shoulder": (12, 12), "hip": (14, 16), "stock": (15, 13), "muzzle": (27, 12), "support": (16, 12), "trigger": (18, 14), "front_knee": (18, 18), "front_foot": (22, 19), "rear_knee": (12, 17), "rear_foot": (8, 18), "bandana_tail": (3, 9)},
        {"head": (9, 8), "shoulder": (12, 13), "hip": (14, 17), "stock": (15, 14), "muzzle": (27, 13), "support": (16, 13), "trigger": (18, 15), "front_knee": (17, 18), "front_foot": (22, 20), "rear_knee": (12, 18), "rear_foot": (8, 20), "bandana_tail": (3, 10)},
        {"head": (10, 9), "shoulder": (13, 14), "hip": (15, 18), "stock": (16, 15), "muzzle": (28, 14), "support": (17, 14), "trigger": (19, 16), "front_knee": (18, 21), "front_foot": (22, 24), "rear_knee": (12, 20), "rear_foot": (8, 22), "bandana_tail": (4, 11)},
    ],
    "fire": [
        {"head": (11, 9), "shoulder": (14, 14), "hip": (14, 20), "stock": (15, 15), "muzzle": (28, 13), "support": (17, 14), "trigger": (19, 16), "front_knee": (15, 24), "front_foot": (18, 29), "rear_knee": (12, 24), "rear_foot": (11, 29), "bandana_tail": (7, 11)},
        {"head": (10, 9), "shoulder": (13, 14), "hip": (13, 20), "stock": (14, 15), "muzzle": (29, 13), "support": (16, 14), "trigger": (18, 16), "front_knee": (14, 24), "front_foot": (18, 29), "rear_knee": (11, 24), "rear_foot": (10, 29), "bandana_tail": (6, 11)},
        {"head": (11, 9), "shoulder": (14, 14), "hip": (14, 20), "stock": (15, 15), "muzzle": (28, 13), "support": (17, 14), "trigger": (19, 16), "front_knee": (15, 24), "front_foot": (18, 29), "rear_knee": (12, 24), "rear_foot": (11, 29), "bandana_tail": (7, 11)},
        {"head": (11, 8), "shoulder": (14, 13), "hip": (14, 19), "stock": (15, 14), "muzzle": (28, 12), "support": (17, 13), "trigger": (19, 15), "front_knee": (15, 23), "front_foot": (18, 28), "rear_knee": (12, 23), "rear_foot": (11, 28), "bandana_tail": (7, 10)},
    ],
}

ENEMY_STAND_POSES = [
    {"head": (9, 8), "shoulder": (11, 11), "hip": (11, 16), "stock": (12, 12), "muzzle": (21, 11), "support": (13, 11), "trigger": (14, 13), "front_knee": (12, 19), "front_foot": (14, 22), "rear_knee": (10, 19), "rear_foot": (9, 22), "bandana_tail": (6, 9)},
    {"head": (9, 9), "shoulder": (11, 12), "hip": (11, 17), "stock": (12, 13), "muzzle": (21, 12), "support": (13, 12), "trigger": (14, 14), "front_knee": (12, 20), "front_foot": (14, 22), "rear_knee": (10, 20), "rear_foot": (9, 22), "bandana_tail": (6, 10)},
    {"head": (9, 8), "shoulder": (11, 11), "hip": (11, 16), "stock": (12, 12), "muzzle": (21, 11), "support": (13, 11), "trigger": (14, 13), "front_knee": (12, 19), "front_foot": (14, 22), "rear_knee": (10, 19), "rear_foot": (9, 22), "bandana_tail": (6, 9)},
    {"head": (9, 7), "shoulder": (11, 10), "hip": (11, 15), "stock": (12, 11), "muzzle": (21, 10), "support": (13, 10), "trigger": (14, 12), "front_knee": (12, 18), "front_foot": (14, 22), "rear_knee": (10, 18), "rear_foot": (9, 22), "bandana_tail": (6, 8)},
]

ENEMY_FIRE_POSES = [
    {"head": (8, 8), "shoulder": (10, 11), "hip": (10, 16), "stock": (11, 12), "muzzle": (22, 10), "support": (12, 11), "trigger": (13, 13), "front_knee": (11, 19), "front_foot": (13, 22), "rear_knee": (9, 19), "rear_foot": (8, 22), "bandana_tail": (5, 9)},
    {"head": (9, 8), "shoulder": (11, 11), "hip": (11, 16), "stock": (12, 12), "muzzle": (21, 10), "support": (13, 11), "trigger": (14, 13), "front_knee": (12, 19), "front_foot": (14, 22), "rear_knee": (10, 19), "rear_foot": (9, 22), "bandana_tail": (6, 9)},
    {"head": (8, 8), "shoulder": (10, 11), "hip": (10, 16), "stock": (11, 12), "muzzle": (22, 10), "support": (12, 11), "trigger": (13, 13), "front_knee": (11, 19), "front_foot": (13, 22), "rear_knee": (9, 19), "rear_foot": (8, 22), "bandana_tail": (5, 9)},
    {"head": (9, 7), "shoulder": (11, 10), "hip": (11, 15), "stock": (12, 11), "muzzle": (21, 9), "support": (13, 10), "trigger": (14, 12), "front_knee": (12, 18), "front_foot": (14, 22), "rear_knee": (10, 18), "rear_foot": (9, 22), "bandana_tail": (6, 8)},
]


def draw_commando_frames(action: str) -> list[Image.Image]:
    frames = []
    for index, pose in enumerate(PLAYER_POSES[action]):
        frames.append(
            upscale(
                draw_humanoid(
                    PLAYER_LOGICAL,
                    PLAYER_PALETTE,
                    pose,
                    weapon_kind="rifle",
                    muzzle=action == "fire" and index in {0, 2},
                    prone=action == "crawl",
                ),
                PLAYER_SCALE,
            )
        )
    return frames


def draw_enemy_frames(theme: str, kind: str, action: str) -> list[Image.Image]:
    palette = ENEMY_PALETTES[theme]
    weapon_kind = "launcher" if kind == "rocketeer" else "rifle"
    source = ENEMY_FIRE_POSES if action == "fire" else ENEMY_STAND_POSES
    frames = []
    for index, pose in enumerate(source):
        frames.append(
            upscale(
                draw_humanoid(
                    ENEMY_LOGICAL,
                    palette,
                    pose,
                    weapon_kind=weapon_kind,
                    muzzle=action == "fire" and index in {0, 2},
                ),
                ENEMY_SCALE,
            )
        )
    return frames


def draw_turret_frames(theme: str, action: str) -> list[Image.Image]:
    palette = STAGE_PALETTES[theme]
    frames: list[Image.Image] = []
    for index in range(4 if action == "fire" else 2):
        image, draw = make_canvas(ENEMY_LOGICAL)
        recoil = -1 if action == "fire" and index in {0, 2} else 0
        blink = 1 if index % 2 else 0
        draw.rounded_rectangle((4, 10, 19, 19), radius=3, fill=palette.hull)
        draw.rectangle((8, 7, 14, 12), fill=palette.secondary)
        draw.rectangle((13 + recoil, 11, 22 + recoil, 13), fill=palette.primary)
        draw.rectangle((6, 13, 17, 16), fill=palette.trim)
        draw.rectangle((8, 17, 14, 21), fill=palette.primary)
        draw.rectangle((7, 7, 10, 9), fill=palette.glow if blink else palette.trim)
        if action == "fire" and index in {0, 2}:
            draw_flash(draw, (21, 11), palette.muzzle, 0.9)
        frames.append(upscale(image, ENEMY_SCALE))
    return frames


def draw_gunship_frames(theme: str) -> list[Image.Image]:
    palette = STAGE_PALETTES[theme]
    frames: list[Image.Image] = []
    flashes = {0, 3}
    for index in range(6):
        image, draw = make_canvas(BOSS_LOGICAL)
        bob = -1 if index in {1, 2} else 0
        draw.ellipse((12, 15 + bob, 49, 31 + bob), fill=palette.hull)
        draw.rectangle((23, 9 + bob, 38, 16 + bob), fill=palette.primary)
        draw.rectangle((18, 20 + bob, 54, 24 + bob), fill=palette.secondary)
        draw.rectangle((7, 21 + bob, 13, 24 + bob), fill=palette.secondary)
        draw.rectangle((28, 4 + bob, 32, 13 + bob), fill=palette.trim)
        draw.rectangle((16, 5 + bob, 46, 7 + bob), fill=palette.trim)
        draw.rectangle((10, 17 + bob, 18, 19 + bob), fill=palette.primary)
        draw.rectangle((43, 17 + bob, 52, 19 + bob), fill=palette.primary)
        draw.rectangle((45, 25 + bob, 54, 28 + bob), fill=palette.primary)
        if index % 2:
            draw.rectangle((6, 15 + bob, 10, 17 + bob), fill=palette.glow)
        if index in flashes:
            draw_flash(draw, (53, 21 + bob), palette.muzzle, 1.4)
            draw_flash(draw, (53, 26 + bob), palette.muzzle, 1.1)
        frames.append(upscale(image, BOSS_SCALE))
    return frames


def draw_barge_frames(theme: str) -> list[Image.Image]:
    palette = STAGE_PALETTES[theme]
    frames: list[Image.Image] = []
    flashes = {1, 4}
    for index in range(6):
        image, draw = make_canvas(BOSS_LOGICAL)
        sway = -1 if index in {0, 1, 5} else 1
        draw.polygon([(9, 27 + sway), (53, 27 + sway), (58, 33 + sway), (14, 33 + sway)], fill=palette.hull)
        draw.rectangle((15, 17 + sway, 44, 27 + sway), fill=palette.primary)
        draw.rectangle((21, 11 + sway, 38, 18 + sway), fill=palette.secondary)
        draw.rectangle((40, 14 + sway, 49, 22 + sway), fill=palette.secondary)
        draw.rectangle((46, 18 + sway, 58, 20 + sway), fill=palette.trim)
        draw.rectangle((15, 30 + sway, 52, 31 + sway), fill=palette.glow)
        draw.rectangle((24, 8 + sway, 28, 11 + sway), fill=palette.trim)
        if index in flashes:
            draw_flash(draw, (57, 18 + sway), palette.muzzle, 1.4)
        frames.append(upscale(image, BOSS_SCALE))
    return frames


def draw_tank_frames(theme: str) -> list[Image.Image]:
    palette = STAGE_PALETTES[theme]
    frames: list[Image.Image] = []
    flashes = {0, 2, 4}
    for index in range(6):
        image, draw = make_canvas(BOSS_LOGICAL)
        recoil = -2 if index in flashes else -1 if index in {1, 3, 5} else 0
        draw.rounded_rectangle((10, 22, 51, 35), radius=4, fill=palette.hull)
        draw.rounded_rectangle((19, 14, 39, 26), radius=4, fill=palette.primary)
        draw.rectangle((36, 18, 56 + recoil, 21), fill=palette.secondary)
        draw.rectangle((11, 34, 18, 38), fill=palette.trim)
        draw.rectangle((21, 34, 29, 38), fill=palette.trim)
        draw.rectangle((32, 34, 40, 38), fill=palette.trim)
        draw.rectangle((43, 34, 50, 38), fill=palette.trim)
        draw.rectangle((24, 10, 28, 14), fill=palette.glow)
        draw.rectangle((16, 17, 23, 20), fill=palette.secondary)
        if index in flashes:
            draw_flash(draw, (57 + recoil, 18), palette.muzzle, 1.6)
        frames.append(upscale(image, BOSS_SCALE))
    return frames


def save_frames(frames: list[Image.Image], out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    for index, frame in enumerate(frames, start=1):
        frame.save(out_dir / f"frame-{index:02d}.png")


def save_strip(frames: list[Image.Image], out_path: Path) -> None:
    width = sum(frame.width for frame in frames)
    height = max(frame.height for frame in frames)
    strip = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    cursor = 0
    for frame in frames:
        strip.alpha_composite(frame, (cursor, 0))
        cursor += frame.width
    out_path.parent.mkdir(parents=True, exist_ok=True)
    strip.save(out_path)


def save_preview(frames: list[Image.Image], out_path: Path, columns: int = 4) -> None:
    gap = 8
    rows = math.ceil(len(frames) / columns)
    cell_w = max(frame.width for frame in frames)
    cell_h = max(frame.height for frame in frames)
    preview = Image.new(
        "RGBA",
        (columns * cell_w + (columns - 1) * gap, rows * cell_h + (rows - 1) * gap),
        (240, 243, 246, 255),
    )
    checker = ((240, 243, 246, 255), (226, 230, 234, 255))
    draw = ImageDraw.Draw(preview)
    for top in range(0, preview.height, 16):
        for left in range(0, preview.width, 16):
            draw.rectangle((left, top, left + 16, top + 16), fill=checker[((left // 16) + (top // 16)) % 2])

    for index, frame in enumerate(frames):
        row = index // columns
        col = index % columns
        x = col * (cell_w + gap) + (cell_w - frame.width) // 2
        y = row * (cell_h + gap) + (cell_h - frame.height) // 2
        preview.alpha_composite(frame, (x, y))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    preview.save(out_path)


def build_player_assets() -> None:
    for action in PLAYER_POSES:
        frames = draw_commando_frames(action)
        save_frames(frames, OUT_ROOT / "player" / action)
        save_strip(frames, OUT_ROOT / "player" / f"commando_{action}.png")
        save_preview(frames, OUT_ROOT / "previews" / "player" / f"{action}.png")


def build_enemy_assets() -> None:
    for theme in ENEMY_PALETTES:
        for kind in ("rifleman", "rocketeer"):
            for action in ("stand", "fire"):
                frames = draw_enemy_frames(theme, kind, action)
                save_frames(frames, OUT_ROOT / "enemies" / theme / kind / action)
                save_strip(frames, OUT_ROOT / "enemies" / f"{theme}_{kind}_{action}.png")
                save_preview(frames, OUT_ROOT / "previews" / "enemies" / f"{theme}_{kind}_{action}.png")

        for action in ("stand", "fire"):
            turret_frames = draw_turret_frames(theme, action)
            save_frames(turret_frames, OUT_ROOT / "enemies" / theme / "turret" / action)
            save_strip(turret_frames, OUT_ROOT / "enemies" / f"{theme}_turret_{action}.png")
            save_preview(turret_frames, OUT_ROOT / "previews" / "enemies" / f"{theme}_turret_{action}.png")


def build_boss_assets() -> None:
    boss_builders = {
        "gunship": draw_gunship_frames,
        "barge": draw_barge_frames,
        "tank": draw_tank_frames,
    }
    theme_by_boss = {
        "gunship": "emerald",
        "barge": "river",
        "tank": "blacksite",
    }
    for boss_kind, builder in boss_builders.items():
        theme = theme_by_boss[boss_kind]
        frames = builder(theme)
        save_frames(frames, OUT_ROOT / "bosses" / boss_kind / "fire")
        save_strip(frames, OUT_ROOT / "bosses" / f"{boss_kind}_fire.png")
        save_preview(frames, OUT_ROOT / "previews" / "bosses" / f"{boss_kind}_fire.png", columns=3)


def main() -> None:
    build_player_assets()
    build_enemy_assets()
    build_boss_assets()


if __name__ == "__main__":
    main()
