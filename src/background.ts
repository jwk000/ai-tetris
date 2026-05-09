interface Raindrop {
  x: number;
  y: number;
  len: number;
  speed: number;
  alpha: number;
  hitY: number;
}

interface Splash {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

interface LightningBolt {
  segments: Array<{ x: number; y: number }>;
  life: number;
  maxLife: number;
  startX: number;
  startY: number;
}

interface FlashEvent {
  life: number;
  maxLife: number;
  intensity: number;
}

const RAIN_COUNT = 240;
const WIND_X = -120;
const RAIN_SPEED_MIN = 800;
const RAIN_SPEED_MAX = 1300;

const CLOUD_HEIGHT = 200;
const SPLASH_RAIN_PROB = 0.45;
const SPLASH_GRAVITY = 1400;

// Cloud noise tile: tileable in X for seamless horizontal scrolling
const NOISE_TILE_W = 512;
const NOISE_TILE_H = 256;

export class Background {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private widthCss = 0;
  private heightCss = 0;

  private rain: Raindrop[] = [];
  private splashes: Splash[] = [];
  private bolts: LightningBolt[] = [];
  private flashes: FlashEvent[] = [];

  private cloudTile: HTMLCanvasElement | null = null;

  private rafId: number | null = null;
  private elapsed = 0;

  boardCanvas: HTMLCanvasElement | null = null;
  getBoardRect: (() => DOMRect) | null = null;

  onRipple: (() => void) | null = null;
  onThunder: (() => void) | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D unsupported');
    this.ctx = ctx;
    this.resize();
    window.addEventListener('resize', this.resize);
    this.initRain();
    this.cloudTile = generateCloudNoiseTile(NOISE_TILE_W, NOISE_TILE_H);
  }

  attachBoard(boardCanvas: HTMLCanvasElement, getRect: () => DOMRect): void {
    this.boardCanvas = boardCanvas;
    this.getBoardRect = getRect;
  }

  waterLineY(): number {
    if (this.getBoardRect) {
      const r = this.getBoardRect();
      return r.bottom + 24;
    }
    return this.heightCss * 0.7;
  }

  private resize = (): void => {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.widthCss = window.innerWidth;
    this.heightCss = window.innerHeight;
    this.canvas.width = Math.floor(this.widthCss * this.dpr);
    this.canvas.height = Math.floor(this.heightCss * this.dpr);
    this.canvas.style.width = `${this.widthCss}px`;
    this.canvas.style.height = `${this.heightCss}px`;
  };

  private initRain(): void {
    this.rain = [];
    for (let i = 0; i < RAIN_COUNT; i++) {
      this.rain.push(this.makeDrop(true));
    }
  }

  private makeDrop(initial = false): Raindrop {
    const speed = RAIN_SPEED_MIN + Math.random() * (RAIN_SPEED_MAX - RAIN_SPEED_MIN);
    const depth = (speed - RAIN_SPEED_MIN) / (RAIN_SPEED_MAX - RAIN_SPEED_MIN);
    const water = this.waterLineY();
    return {
      x: Math.random() * (this.widthCss + 200) - 100,
      y: initial ? Math.random() * water : -20 - Math.random() * 80,
      len: 10 + depth * 18,
      speed,
      alpha: 0.18 + depth * 0.42,
      hitY: water,
    };
  }

  getFlash(): number {
    return this.currentFlash();
  }

  flashLightning(linesCleared: number): void {
    const intensity = Math.min(1, 0.55 + linesCleared * 0.18);
    this.flashes.push({ life: 0.55, maxLife: 0.55, intensity });
    const boltCount = 1 + Math.min(2, Math.floor(linesCleared / 2));
    for (let i = 0; i < boltCount; i++) {
      this.bolts.push(this.makeBolt());
    }
    this.onThunder?.();
  }

  private makeBolt(): LightningBolt {
    const startX = this.widthCss * (0.15 + Math.random() * 0.7);
    const startY = 30 + Math.random() * (CLOUD_HEIGHT - 60);
    const segments: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];
    let x = startX;
    let y = startY;
    const targetY = this.heightCss * (0.4 + Math.random() * 0.35);
    while (y < targetY) {
      const stepY = 16 + Math.random() * 26;
      const stepX = (Math.random() - 0.5) * 70;
      x += stepX;
      y += stepY;
      segments.push({ x, y });
    }
    return { segments, life: 0.22, maxLife: 0.22, startX, startY };
  }

  private spawnSplash(x: number, y: number): void {
    const count = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI * 0.5 + (Math.random() - 0.5) * Math.PI * 0.65;
      const speed = 90 + Math.random() * 120;
      const life = 0.32 + Math.random() * 0.18;
      this.splashes.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        maxLife: life,
        size: 1.0 + Math.random() * 1.4,
      });
    }
    if (this.splashes.length > 240) this.splashes.splice(0, this.splashes.length - 240);
    this.onRipple?.();
  }

  start(): void {
    if (this.rafId !== null) return;
    let last = performance.now();
    const tick = (now: number): void => {
      const dt = Math.min(50, now - last) / 1000;
      last = now;
      this.elapsed += dt;
      this.update(dt);
      this.draw();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private update(dt: number): void {
    const water = this.waterLineY();

    for (let i = 0; i < this.rain.length; i++) {
      const d = this.rain[i]!;
      d.x += WIND_X * dt;
      d.y += d.speed * dt;
      if (d.y >= d.hitY) {
        if (Math.random() < SPLASH_RAIN_PROB) {
          this.spawnSplash(d.x, water);
        }
        this.rain[i] = this.makeDrop();
      } else if (d.x < -50) {
        this.rain[i] = this.makeDrop();
      }
    }

    for (let i = this.splashes.length - 1; i >= 0; i--) {
      const s = this.splashes[i]!;
      s.life -= dt;
      if (s.life <= 0) {
        this.splashes.splice(i, 1);
        continue;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += SPLASH_GRAVITY * dt;
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      this.bolts[i]!.life -= dt;
      if (this.bolts[i]!.life <= 0) this.bolts.splice(i, 1);
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      this.flashes[i]!.life -= dt;
      if (this.flashes[i]!.life <= 0) this.flashes.splice(i, 1);
    }

  }

  private currentFlash(): number {
    let a = 0;
    for (const f of this.flashes) {
      const t = f.life / f.maxLife;
      a = Math.max(a, t * t * f.intensity);
    }
    return a;
  }

  private draw(): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const flash = this.currentFlash();
    const water = this.waterLineY();

    const skyGrad = ctx.createLinearGradient(0, 0, 0, this.heightCss);
    skyGrad.addColorStop(0, '#070a13');
    skyGrad.addColorStop(0.55, '#0d1320');
    skyGrad.addColorStop(1, '#050811');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, this.widthCss, this.heightCss);

    this.drawClouds(ctx, flash);

    this.drawRain(ctx, water);

    this.drawSplashes(ctx);

    this.drawBolts(ctx);

    if (flash > 0) {
      ctx.fillStyle = `rgba(220, 230, 255, ${flash * 0.45})`;
      ctx.fillRect(0, 0, this.widthCss, this.heightCss);
    }
  }

  private drawClouds(ctx: CanvasRenderingContext2D, flash: number): void {
    const tile = this.cloudTile;
    if (!tile) return;
    const w = this.widthCss;
    const tileW = tile.width;
    const tileH = tile.height;

    const layers = [
      { scaleX: 1.0, scaleY: 0.55, speed: 9, alpha: 0.55, tint: 18 },
      { scaleX: 1.6, scaleY: 0.85, speed: 16, alpha: 0.4, tint: 0 },
      { scaleX: 0.7, scaleY: 0.4, speed: 26, alpha: 0.3, tint: 30 },
    ];

    ctx.save();
    for (const layer of layers) {
      const drawW = tileW * layer.scaleX;
      const drawH = tileH * layer.scaleY;
      const offset = (this.elapsed * layer.speed) % drawW;
      const baseY = -drawH * 0.15;
      const baseAlpha = layer.alpha + flash * 0.45;

      ctx.globalAlpha = Math.min(0.95, baseAlpha);
      const tintShift = layer.tint + Math.round(flash * 180);
      ctx.globalCompositeOperation = flash > 0.05 ? 'screen' : 'source-over';
      const filterTint = 30 + tintShift;
      ctx.filter = `brightness(${0.5 + flash * 1.2}) hue-rotate(${filterTint}deg)`;

      let x = -offset - drawW;
      while (x < w + drawW) {
        ctx.drawImage(tile, x, baseY, drawW, drawH);
        x += drawW;
      }
    }
    ctx.restore();
  }

  private drawRain(ctx: CanvasRenderingContext2D, water: number): void {
    ctx.strokeStyle = 'rgba(180, 210, 255, 0.6)';
    ctx.lineWidth = 1;
    for (const d of this.rain) {
      if (d.y > water && d.hitY > water) continue;
      const tail = Math.atan2(d.speed, WIND_X);
      const dx = Math.cos(tail) * d.len;
      const dy = Math.sin(tail) * d.len;
      ctx.globalAlpha = d.alpha;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - dx, d.y - dy);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private drawSplashes(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(190, 220, 255, 1)';
    for (const s of this.splashes) {
      const t = s.life / s.maxLife;
      const alpha = Math.min(1, t * 1.6);
      ctx.globalAlpha = alpha * 0.85;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawBolts(ctx: CanvasRenderingContext2D): void {
    for (const b of this.bolts) {
      const t = b.life / b.maxLife;

      ctx.shadowColor = 'rgba(180, 210, 255, 0.95)';
      ctx.shadowBlur = 24;
      ctx.strokeStyle = `rgba(255, 255, 255, ${t * 0.95})`;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(b.segments[0]!.x, b.segments[0]!.y);
      for (let i = 1; i < b.segments.length; i++) {
        ctx.lineTo(b.segments[i]!.x, b.segments[i]!.y);
      }
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.strokeStyle = `rgba(220, 235, 255, ${t})`;
      ctx.lineWidth = 1.4;
      ctx.stroke();

      const halo = ctx.createRadialGradient(b.startX, b.startY, 0, b.startX, b.startY, 90);
      halo.addColorStop(0, `rgba(220, 235, 255, ${t * 0.55})`);
      halo.addColorStop(1, 'rgba(220, 235, 255, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(b.startX, b.startY, 90, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function generateCloudNoiseTile(width: number, height: number): HTMLCanvasElement {
  const tile = document.createElement('canvas');
  tile.width = width;
  tile.height = height;
  const ctx = tile.getContext('2d');
  if (!ctx) return tile;

  const img = ctx.createImageData(width, height);
  const data = img.data;

  // Tileable value noise: sum 4 octaves; X axis wraps via integer-grid lookup mod cellsX
  const octaves = [
    { cellsX: 8, cellsY: 4, amp: 0.5 },
    { cellsX: 16, cellsY: 8, amp: 0.28 },
    { cellsX: 32, cellsY: 16, amp: 0.15 },
    { cellsX: 64, cellsY: 32, amp: 0.07 },
  ];

  const grids = octaves.map((o) => {
    const arr = new Float32Array(o.cellsX * o.cellsY);
    for (let i = 0; i < arr.length; i++) arr[i] = Math.random();
    return arr;
  });

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let oi = 0; oi < octaves.length; oi++) {
        const o = octaves[oi]!;
        const grid = grids[oi]!;
        const fx = (x / width) * o.cellsX;
        const fy = (y / height) * o.cellsY;
        const ix = Math.floor(fx);
        const iy = Math.floor(fy);
        const tx = smoothstep(fx - ix);
        const ty = smoothstep(fy - iy);
        const ix0 = ix % o.cellsX;
        const ix1 = (ix + 1) % o.cellsX;
        const iy0 = Math.min(iy, o.cellsY - 1);
        const iy1 = Math.min(iy + 1, o.cellsY - 1);
        const v00 = grid[iy0 * o.cellsX + ix0]!;
        const v10 = grid[iy0 * o.cellsX + ix1]!;
        const v01 = grid[iy1 * o.cellsX + ix0]!;
        const v11 = grid[iy1 * o.cellsX + ix1]!;
        const a = v00 + (v10 - v00) * tx;
        const b = v01 + (v11 - v01) * tx;
        sum += (a + (b - a) * ty) * o.amp;
      }

      // Vertical fade so cloud thins out at top and bottom of tile
      const yNorm = y / height;
      const fade = Math.sin(yNorm * Math.PI);
      const v = Math.max(0, sum * fade - 0.18);
      const alpha = Math.min(255, Math.round(v * 320));
      const idx = (y * width + x) * 4;
      data[idx] = 30;
      data[idx + 1] = 36;
      data[idx + 2] = 52;
      data[idx + 3] = alpha;
    }
  }

  ctx.putImageData(img, 0, 0);
  return tile;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}
