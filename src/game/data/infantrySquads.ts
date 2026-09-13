import type { EnemySpawn, MissionConfig } from '../types';

/** Applied once while loading the campaign, never during the frame loop. */
export const INFANTRY_SQUAD_SIZE = 3;
const SOLDIER_CLEARANCE = 22;
const DEPLOYMENT_CLEAR_X = 520;

function isInfantry(spawn: EnemySpawn): boolean {
  return spawn.kind === 'rifleman' || spawn.kind === 'rocketeer';
}

/** Convert each authored soldier into a spaced squad without multiplying armor. */
export function withInfantrySquads(mission: MissionConfig): MissionConfig {
  const enemies = mission.enemies.map(spawn => ({ ...spawn }));
  const occupied = enemies.map(spawn => ({
    id: spawn.id, x: spawn.x, y: spawn.y, radius: isInfantry(spawn) ? 18 : 42,
  }));
  if (mission.boss) occupied.push({ ...mission.boss, radius: 64 });

  const clear = (x: number, y: number, id: string): boolean => {
    if (x < DEPLOYMENT_CLEAR_X || x > mission.worldWidth - 40 || y < 40 || y > mission.worldHeight - 40) return false;
    // Keep new troops off buildings, barrels, mines, and pickup pads alike.
    if (mission.covers.some(cover => Math.abs(x - cover.x) < cover.width / 2 + SOLDIER_CLEARANCE
      && Math.abs(y - cover.y) < cover.height / 2 + SOLDIER_CLEARANCE)) return false;
    return occupied.every(other => other.id === id
      || Math.hypot(x - other.x, y - other.y) >= SOLDIER_CLEARANCE + other.radius + 8);
  };

  const position = (anchor: EnemySpawn, id: string): { x: number; y: number } => {
    if (clear(anchor.x, anchor.y, id)) return { x: anchor.x, y: anchor.y };
    // Small deterministic rings keep squads local without stacking duplicates.
    for (const radius of [72, 112, 160, 224, 288]) {
      for (let step = 0; step < 8; step++) {
        const angle = step * Math.PI / 4;
        const x = Math.round(anchor.x + Math.cos(angle) * radius);
        const y = Math.round(anchor.y + Math.sin(angle) * radius);
        if (clear(x, y, id)) return { x, y };
      }
    }
    // Bounded fallback for unusually dense future maps; never spawn into cover.
    for (let y = 40; y <= mission.worldHeight - 40; y += 48) {
      for (let x = DEPLOYMENT_CLEAR_X; x <= mission.worldWidth - 40; x += 48) {
        if (clear(x, y, id)) return { x, y };
      }
    }
    throw new Error(`No clear infantry spawn for ${id} in ${mission.id}`);
  };

  for (const source of mission.enemies) {
    if (!isInfantry(source)) continue;
    const leader = enemies.find(spawn => spawn.id === source.id)!;
    Object.assign(leader, position(source, source.id));
    Object.assign(occupied.find(spawn => spawn.id === source.id)!, { x: leader.x, y: leader.y });
    for (let member = 2; member <= INFANTRY_SQUAD_SIZE; member++) {
      const id = `${source.id}-squad-${member}`;
      const point = position(leader, id);
      enemies.push({ ...source, id, ...point });
      occupied.push({ id, ...point, radius: 18 });
    }
  }

  return {
    ...mission,
    enemies,
    covers: mission.covers.map(cover => cover.kind === 'houseSealed' && cover.garrison
      ? { ...cover, garrison: cover.garrison.flatMap(kind => Array.from({ length: INFANTRY_SQUAD_SIZE }, () => kind)) }
      : cover),
  };
}
