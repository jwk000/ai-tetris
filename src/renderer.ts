import { Board, COLS, ROWS } from './board';
import { PieceState } from './types';
import { forEachCell, getColor, COLOR_BY_ID } from './piece';
import { ParticleSystem } from './particles';

const MIN_CELL = 12;
const MAX_CELL = 64;
const SCAN_SPEED_PX = 180;
const SCAN_WIDTH_PX = 140;

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private nextCtx: CanvasRenderingContext2D;
  private cell = 28;
  private elapsed = 0;
  private shakeTime = 0;
  private shakeMagnitude = 0;
  private lastNow = performance.now();

  constructor(
    private canvas: HTMLCanvasElement,
    private nextCanvas: HTMLCanvasElement,
  ) {
    const ctx = canvas.getContext('2d');
    const nctx = nextCanvas.getContext('2d');
    if (!ctx || !nctx) throw new Error('Canvas 2D unsupported');
    this.ctx = ctx;
    this.nextCtx = nctx;
    this.applyCellSize();
  }

  shake(magnitude: number, duration: number): void {
    this.shakeMagnitude = Math.max(this.shakeMagnitude, magnitude);
    this.shakeTime = Math.max(this.shakeTime, duration);
  }

  fitTo(availWidth: number, availHeight: number): void {
    if (availWidth <= 0 || availHeight <= 0) return;
    const byWidth = Math.floor(availWidth / COLS);
    const byHeight = Math.floor(availHeight / ROWS);
    const target = Math.max(MIN_CELL, Math.min(MAX_CELL, Math.min(byWidth, byHeight)));
    if (target === this.cell) return;
    this.cell = target;
    this.applyCellSize();
  }

  private applyCellSize(): void {
    this.canvas.width = COLS * this.cell;
    this.canvas.height = ROWS * this.cell;
  }

  cellSize(): number {
    return this.cell;
  }

  render(board: Board, piece: PieceState | null, ghost: PieceState | null, particles: ParticleSystem): void {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastNow) / 1000);
    this.lastNow = now;
    this.elapsed += dt;
    if (this.shakeTime > 0) this.shakeTime = Math.max(0, this.shakeTime - dt);

    const ctx = this.ctx;
    const cell = this.cell;
    const W = this.canvas.width;
    const H = this.canvas.height;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);

    let shakeX = 0;
    let shakeY = 0;
    if (this.shakeTime > 0 && this.shakeMagnitude > 0) {
      const decay = this.shakeTime / 0.6;
      const amp = this.shakeMagnitude * decay;
      shakeX = (Math.random() - 0.5) * 2 * amp;
      shakeY = (Math.random() - 0.5) * 2 * amp;
      if (this.shakeTime <= 0) this.shakeMagnitude = 0;
    }
    ctx.setTransform(1, 0, 0, 1, shakeX, shakeY);

    ctx.fillStyle = '#11141d';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * cell, 0);
      ctx.lineTo(c * cell, H);
      ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * cell);
      ctx.lineTo(W, r * cell);
      ctx.stroke();
    }

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const v = board.grid[r]![c]!;
        if (v) drawBlock(ctx, c * cell, r * cell, cell, COLOR_BY_ID[v]!);
      }
    }

    this.drawScanLight(ctx, W, H, cell, board);

    if (ghost) {
      forEachCell(ghost.type, ghost.rotation, (dx, dy) => {
        const x = (ghost.x + dx) * cell;
        const y = (ghost.y + dy) * cell;
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(x + 2, y + 2, cell - 4, cell - 4);
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.strokeRect(x + 2, y + 2, cell - 4, cell - 4);
      });
    }

    if (piece) {
      const color = getColor(piece.type);
      forEachCell(piece.type, piece.rotation, (dx, dy) => {
        drawBlock(ctx, (piece.x + dx) * cell, (piece.y + dy) * cell, cell, color);
      });
    }

    particles.forEach((p) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    });
    ctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  private drawScanLight(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    cell: number,
    board: Board,
  ): void {
    const diagMax = W + H;
    const period = diagMax + SCAN_WIDTH_PX * 2;
    const wavePos = ((this.elapsed * SCAN_SPEED_PX) % period) - SCAN_WIDTH_PX;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const v = board.grid[r]![c]!;
        if (!v) continue;
        const cx = c * cell + cell / 2;
        const cy = r * cell + cell / 2;
        const distToWave = Math.abs(cx + cy - wavePos);
        if (distToWave > SCAN_WIDTH_PX) continue;
        const wave = 1 - distToWave / SCAN_WIDTH_PX;
        const intensity = wave * wave * 0.55;
        ctx.fillStyle = `rgba(180, 220, 255, ${intensity})`;
        ctx.fillRect(c * cell + 1, r * cell + 1, cell - 2, cell - 2);
      }
    }
    ctx.globalCompositeOperation = 'source-over';

    ctx.strokeStyle = 'rgba(160, 210, 255, 0.18)';
    ctx.lineWidth = 1;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cx = c * cell + cell / 2;
        const cy = r * cell + cell / 2;
        const distToWave = Math.abs(cx + cy - wavePos);
        if (distToWave > SCAN_WIDTH_PX) continue;
        const wave = 1 - distToWave / SCAN_WIDTH_PX;
        ctx.globalAlpha = wave * wave * 0.5;
        ctx.strokeRect(c * cell + 0.5, r * cell + 0.5, cell - 1, cell - 1);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  renderNext(piece: PieceState | null): void {
    const ctx = this.nextCtx;
    const w = this.nextCanvas.width;
    const h = this.nextCanvas.height;
    ctx.fillStyle = '#11141d';
    ctx.fillRect(0, 0, w, h);
    if (!piece) return;
    let minX = 4,
      minY = 4,
      maxX = -1,
      maxY = -1;
    forEachCell(piece.type, 0, (cx, cy) => {
      if (cx < minX) minX = cx;
      if (cy < minY) minY = cy;
      if (cx > maxX) maxX = cx;
      if (cy > maxY) maxY = cy;
    });
    const pw = maxX - minX + 1;
    const ph = maxY - minY + 1;
    const cell = Math.min(w / (pw + 1), h / (ph + 1));
    const ox = (w - pw * cell) / 2 - minX * cell;
    const oy = (h - ph * cell) / 2 - minY * cell;
    const color = getColor(piece.type);
    forEachCell(piece.type, 0, (cx, cy) => {
      drawBlock(ctx, ox + cx * cell, oy + cy * cell, cell, color);
    });
  }
}

function drawBlock(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, size, size);

  const inset = Math.max(1, size * 0.08);
  ctx.fillStyle = lighten(color, 0.35);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + size, y);
  ctx.lineTo(x + size - inset, y + inset);
  ctx.lineTo(x + inset, y + inset);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + size);
  ctx.lineTo(x + inset, y + size - inset);
  ctx.lineTo(x + inset, y + inset);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = darken(color, 0.4);
  ctx.beginPath();
  ctx.moveTo(x + size, y);
  ctx.lineTo(x + size, y + size);
  ctx.lineTo(x + size - inset, y + size - inset);
  ctx.lineTo(x + size - inset, y + inset);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x, y + size);
  ctx.lineTo(x + size, y + size);
  ctx.lineTo(x + size - inset, y + size - inset);
  ctx.lineTo(x + inset, y + size - inset);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = parseInt(h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (x: number) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function lighten(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
}

function darken(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * (1 - amt), g * (1 - amt), b * (1 - amt));
}
