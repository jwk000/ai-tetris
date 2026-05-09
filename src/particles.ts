export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  rotation: number;
  vr: number;
}

const GRAVITY = 900;
const MAX_PARTICLES = 600;

export class ParticleSystem {
  private list: Particle[] = [];

  spawn(p: Particle): void {
    if (this.list.length >= MAX_PARTICLES) this.list.shift();
    this.list.push(p);
  }

  spawnBurst(cx: number, cy: number, color: string, cellSize: number): void {
    const count = 5;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 220;
      this.spawn({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 120,
        size: cellSize * (0.18 + Math.random() * 0.22),
        color,
        life: 0.7 + Math.random() * 0.4,
        maxLife: 1.1,
        rotation: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 8,
      });
    }
  }

  update(dt: number): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i]!;
      p.life -= dt;
      if (p.life <= 0) {
        this.list.splice(i, 1);
        continue;
      }
      p.vy += GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.vr * dt;
    }
  }

  forEach(cb: (p: Particle) => void): void {
    this.list.forEach(cb);
  }

  clear(): void {
    this.list = [];
  }
}
