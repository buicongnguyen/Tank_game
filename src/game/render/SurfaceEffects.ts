import type Phaser from 'phaser';
import type { CoverKind } from '../types';

export type SurfaceMaterial = 'wood' | 'stone' | 'metal' | 'fuel';
type ParticleKind = 'chip' | 'spark' | 'dust' | 'smoke' | 'fire';
interface Particle { x: number; y: number; vx: number; vy: number; age: number; life: number; size: number; color: number; kind: ParticleKind; }
interface Mark { x: number; y: number; size: number; angle: number; age: number; life: number; material: SurfaceMaterial; wreck: boolean; }
interface Fire { x: number; y: number; age: number; life: number; next: number; }
export const coverMaterial = (kind: CoverKind): SurfaceMaterial => kind === 'crate' ? 'wood'
  : kind === 'barrel' || kind === 'mine' ? 'fuel' : kind === 'concrete' || kind === 'rockWall' || kind === 'houseOpen' || kind === 'houseSealed' ? 'stone' : 'metal';

/** Cosmetic only: bounded pooled records, no GameObjects, timers, or damage. */
export class SurfaceEffects {
  readonly particles: Particle[] = [];
  readonly marks: Mark[] = [];
  readonly fires: Fire[] = [];
  private readonly pool: Particle[] = [];
  low = false;
  private sequence = 1;

  private random(): number {
    this.sequence = (Math.imul(this.sequence, 1664525) + 1013904223) >>> 0;
    return this.sequence / 4294967296;
  }

  private emit(x: number, y: number, kind: ParticleKind, color: number, size: number, life: number, vx = 0, vy = 0): void {
    if (this.particles.length >= (this.low ? 56 : 160)) return;
    const particle = this.pool.pop() ?? {} as Particle;
    Object.assign(particle, { x, y, kind, color, size, life, vx, vy, age: 0 });
    this.particles.push(particle);
  }

  impact(x: number, y: number, material: SurfaceMaterial, destroyed: boolean, size = 24, angle = 0, wreck = false): void {
    const count = this.low ? (destroyed ? 5 : 2) : (destroyed ? 12 : 4);
    for (let i = 0; i < count; i++) {
      const direction = this.random() * Math.PI * 2;
      const speed = (destroyed ? 65 : 30) * (0.4 + this.random());
      this.emit(x, y, material === 'metal' || material === 'fuel' ? 'spark' : 'chip',
        material === 'wood' ? 0xb68b54 : material === 'stone' ? 0x9a9b8d : 0xffcb72,
        destroyed ? 2 + this.random() * 3 : 1.5, 0.35 + this.random() * 0.55, Math.cos(direction) * speed, Math.sin(direction) * speed);
    }
    if (material === 'stone' || material === 'wood') {
      this.emit(x, y, 'dust', material === 'stone' ? 0xb8b7a8 : 0x9b825e, destroyed ? size * 0.45 : 7, destroyed ? 1.2 : 0.4, 4, -9);
    }
    if (!destroyed) return;
    this.marks.push({ x, y, size, angle, age: 0, life: wreck ? 14 : 10, material, wreck });
    while (this.marks.length > (this.low ? 12 : 32)) this.marks.shift();
    if (material === 'wood' || material === 'fuel' || wreck) {
      this.fires.push({ x, y, age: 0, life: material === 'fuel' ? 3 : 1.8, next: 0 });
      while (this.fires.length > (this.low ? 2 : 6)) this.fires.shift();
    }
  }

  exhaust(x: number, y: number, angle: number): void {
    this.emit(x - Math.cos(angle) * 22, y - Math.sin(angle) * 22, 'smoke', 0x9da69f, this.low ? 3 : 5, this.low ? 0.3 : 0.65,
      -Math.cos(angle) * 15, -Math.sin(angle) * 15 - 5);
  }

  update(dt: number, low: boolean): void {
    this.low = low;
    while (this.particles.length > (low ? 56 : 160)) this.pool.push(this.particles.pop()!);
    this.marks.splice(0, Math.max(0, this.marks.length - (low ? 12 : 32)));
    this.fires.splice(0, Math.max(0, this.fires.length - (low ? 2 : 6)));
    for (let i = this.fires.length - 1; i >= 0; i--) {
      const fire = this.fires[i];
      fire.age += dt;
      fire.next -= dt;
      if (fire.age >= fire.life) { this.fires.splice(i, 1); continue; }
      if (fire.next <= 0) {
        fire.next = low ? 0.4 : 0.18;
        this.emit(fire.x, fire.y, 'fire', 0xffa54b, 7, 0.4, (this.random() - 0.5) * 14, -22);
        this.emit(fire.x, fire.y - 5, 'smoke', 0x777d76, 8, 1.1, 6, -15);
      }
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      if (p.age >= p.life) { this.pool.push(p); this.particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'chip' || p.kind === 'spark') { const drag = Math.exp(-dt * 3); p.vx *= drag; p.vy *= drag; }
    }
    for (let i = this.marks.length - 1; i >= 0; i--) {
      this.marks[i].age += dt;
      if (this.marks[i].age >= this.marks[i].life) this.marks.splice(i, 1);
    }
  }

  drawGround(g: Phaser.GameObjects.Graphics, visible: (x: number, y: number, padding: number) => boolean): void {
    for (const m of this.marks) {
      if (!visible(m.x, m.y, m.size * 2)) continue;
      const alpha = Math.min(1, (m.life - m.age) / 3);
      g.fillStyle(m.material === 'stone' ? 0x7e8074 : 0x161c19, 0.38 * alpha);
      g.fillEllipse(m.x, m.y, m.size * 2, m.size * 1.4);
      if (m.wreck) {
        g.save(); g.translateCanvas(m.x, m.y); g.rotateCanvas(m.angle);
        g.fillStyle(0x282f2c, 0.75 * alpha); g.fillRoundedRect(-m.size * 0.7, -m.size * 0.4, m.size * 1.4, m.size * 0.8, 5);
        g.fillStyle(0x474940, 0.7 * alpha); g.fillCircle(0, 0, m.size * 0.3);
        g.lineStyle(4, 0x222a26, alpha); g.lineBetween(0, 0, m.size, m.size * 0.1); g.restore();
      } else {
        g.fillStyle(m.material === 'wood' ? 0x987449 : 0x8e9187, 0.6 * alpha);
        for (let i = 0; i < 4; i++) {
          const a = i * 2.4 + m.x;
          g.fillRect(m.x + Math.cos(a) * m.size * 0.5, m.y + Math.sin(a) * m.size * 0.35, m.material === 'wood' ? 12 : 6, 4);
        }
      }
    }
  }

  draw(g: Phaser.GameObjects.Graphics, visible: (x: number, y: number, padding: number) => boolean): void {
    for (const p of this.particles) {
      if (!visible(p.x, p.y, p.size * 4)) continue;
      const progress = p.age / p.life;
      const soft = p.kind === 'smoke' || p.kind === 'dust';
      g.fillStyle(p.color, (1 - progress) * (soft ? 0.25 : 0.85));
      if (p.kind === 'chip') g.fillRect(p.x, p.y, p.size * 2, p.size);
      else if (p.kind === 'spark') {
        g.lineStyle(1.5, p.color, 1 - progress); g.lineBetween(p.x, p.y, p.x - p.vx * 0.06, p.y - p.vy * 0.06);
      } else g.fillCircle(p.x, p.y, p.size * (soft ? 1 + progress : 1 - progress * 0.5));
    }
  }

  clear(): void { this.pool.push(...this.particles); this.particles.length = 0; this.marks.length = 0; this.fires.length = 0; }
}
