import { Board, COLS, ROWS } from './board';
import { PieceState, PieceType } from './types';
import { PieceBag, spawnPiece, getColor, forEachCell } from './piece';
import { ParticleSystem } from './particles';
import { computeBestMove, AIDecision } from './ai';

export type GameStatus = 'playing' | 'paused' | 'gameover';

export interface GameSnapshot {
  score: number;
  lines: number;
  level: number;
  speed: number;
  status: GameStatus;
  aiEnabled: boolean;
  manualControl: boolean;
}

const BASE_DROP_INTERVAL_MS = 600;
const SOFT_DROP_INTERVAL_MS = 30;
const AI_TICK_MS = 90;

export class Game {
  board = new Board();
  bag = new PieceBag();
  current: PieceState | null = null;
  next: PieceType;

  particles = new ParticleSystem();

  score = 0;
  lines = 0;
  level = 1;
  status: GameStatus = 'playing';
  aiEnabled = true;
  speedMultiplier = 1;

  softDropping = false;

  visualX = 0;
  visualY = 0;

  onLineClear: ((count: number) => void) | null = null;
  onMove: (() => void) | null = null;
  onRotate: (() => void) | null = null;
  onLock: (() => void) | null = null;
  getCellSize: () => number = () => 28;

  private dropAccum = 0;
  private aiAccum = 0;
  private aiDecision: AIDecision | null = null;

  constructor() {
    this.next = this.bag.next();
    this.spawn();
  }

  private spawn(): void {
    const type = this.next;
    this.next = this.bag.next();
    this.current = spawnPiece(type);
    this.aiDecision = null;
    if (this.current) {
      this.visualX = this.current.x;
      this.visualY = this.current.y - 0.6;
    }
    if (this.current && this.board.collides(this.current, 0, 0)) {
      this.status = 'gameover';
      this.current = null;
    }
  }

  reset(): void {
    this.board = new Board();
    this.bag = new PieceBag();
    this.particles.clear();
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.speedMultiplier = 1;
    this.status = 'playing';
    this.softDropping = false;
    this.next = this.bag.next();
    this.spawn();
  }

  togglePause(): void {
    if (this.status === 'playing') this.status = 'paused';
    else if (this.status === 'paused') this.status = 'playing';
  }

  setAIEnabled(v: boolean): void {
    this.aiEnabled = v;
    this.aiDecision = null;
  }

  bumpSpeed(delta: number): void {
    const steps = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8];
    const idx = steps.indexOf(this.speedMultiplier);
    const ni = Math.max(0, Math.min(steps.length - 1, (idx === -1 ? 3 : idx) + delta));
    this.speedMultiplier = steps[ni]!;
  }

  private dropInterval(): number {
    if (this.softDropping) return SOFT_DROP_INTERVAL_MS;
    const levelFactor = Math.max(0.15, 1 - (this.level - 1) * 0.08);
    return (BASE_DROP_INTERVAL_MS * levelFactor) / this.speedMultiplier;
  }

  private aiTickInterval(): number {
    return Math.max(8, AI_TICK_MS / this.speedMultiplier);
  }

  ghost(): PieceState | null {
    if (!this.current) return null;
    let dy = 0;
    while (!this.board.collides(this.current, 0, dy + 1)) dy++;
    return { ...this.current, y: this.current.y + dy };
  }

  moveLeft(): boolean {
    if (!this.current || this.status !== 'playing') return false;
    if (!this.board.collides(this.current, -1, 0)) {
      this.current.x -= 1;
      this.onMove?.();
      return true;
    }
    return false;
  }

  moveRight(): boolean {
    if (!this.current || this.status !== 'playing') return false;
    if (!this.board.collides(this.current, 1, 0)) {
      this.current.x += 1;
      this.onMove?.();
      return true;
    }
    return false;
  }

  rotate(): boolean {
    if (!this.current || this.status !== 'playing') return false;
    const next = (this.current.rotation + 1) % 4;
    const kicks = [0, -1, 1, -2, 2];
    for (const k of kicks) {
      if (!this.board.collides(this.current, k, 0, next)) {
        this.current.x += k;
        this.current.rotation = next;
        this.onRotate?.();
        return true;
      }
    }
    return false;
  }

  hardDrop(): void {
    if (!this.current || this.status !== 'playing') return;
    let dy = 0;
    while (!this.board.collides(this.current, 0, dy + 1)) dy++;
    this.current.y += dy;
    this.score += dy * 2;
    this.lockAndAdvance();
  }

  private lockAndAdvance(): void {
    if (!this.current) return;
    this.onLock?.();
    this.board.merge(this.current);
    const result = this.board.clearLines();
    if (result.count > 0) {
      const cell = this.getCellSize();
      for (const row of result.clearedRows) {
        for (let c = 0; c < COLS; c++) {
          this.particles.spawnBurst(
            (c + 0.5) * cell,
            (row + 0.5) * cell,
            getColor(this.current.type),
            cell,
          );
        }
      }
      const lineScores = [0, 100, 300, 500, 800];
      this.score += (lineScores[result.count] ?? 0) * this.level;
      this.lines += result.count;
      this.level = 1 + Math.floor(this.lines / 10);
      this.onLineClear?.(result.count);
    }
    this.spawn();
  }

  step(dtMs: number): void {
    if (this.status !== 'playing') return;
    if (!this.current) return;

    if (this.aiEnabled) {
      this.aiAccum += dtMs;
      const aiInterval = this.aiTickInterval();
      let aiBudget = 24;
      while (this.aiAccum >= aiInterval && aiBudget-- > 0) {
        this.aiAccum -= aiInterval;
        if (!this.current) break;
        if (!this.aiDecision) this.aiDecision = computeBestMove(this.board, this.current);
        this.aiAdvance();
      }
      this.dropAccum = 0;
      return;
    }

    this.dropAccum += dtMs;
    let gravityBudget = 64;
    let interval = this.dropInterval();
    while (this.dropAccum >= interval && gravityBudget-- > 0) {
      this.dropAccum -= interval;
      this.gravityTick();
      if (!this.current) break;
      interval = this.dropInterval();
    }
    if (this.dropAccum > interval * 4) this.dropAccum = 0;
  }

  private aiAdvance(): void {
    if (!this.current || !this.aiDecision) return;
    if (this.current.rotation !== this.aiDecision.rotation) {
      this.rotate();
      return;
    }
    if (this.current.x < this.aiDecision.targetX) {
      if (!this.moveRight()) this.gravityTick();
      return;
    }
    if (this.current.x > this.aiDecision.targetX) {
      if (!this.moveLeft()) this.gravityTick();
      return;
    }
    this.gravityTick();
  }

  private gravityTick(): void {
    if (!this.current) return;
    if (!this.board.collides(this.current, 0, 1)) {
      this.current.y += 1;
      if (this.softDropping) this.score += 1;
    } else {
      this.lockAndAdvance();
    }
  }

  updateParticles(dtMs: number): void {
    this.particles.update(dtMs / 1000);
  }

  updateVisual(dtMs: number): void {
    if (!this.current) return;
    const dt = dtMs / 1000;
    const lerpRate = 22;
    const k = 1 - Math.exp(-lerpRate * dt);
    this.visualX += (this.current.x - this.visualX) * k;
    this.visualY += (this.current.y - this.visualY) * k;
    if (Math.abs(this.visualX - this.current.x) < 0.001) this.visualX = this.current.x;
    if (Math.abs(this.visualY - this.current.y) < 0.001) this.visualY = this.current.y;
  }

  visualPiece(): PieceState | null {
    if (!this.current) return null;
    return { ...this.current, x: this.visualX as unknown as number, y: this.visualY as unknown as number };
  }

  snapshot(): GameSnapshot {
    return {
      score: this.score,
      lines: this.lines,
      level: this.level,
      speed: this.speedMultiplier,
      status: this.status,
      aiEnabled: this.aiEnabled,
      manualControl: !this.aiEnabled,
    };
  }
}

export function maxFillRow(board: Board): number {
  for (let r = 0; r < ROWS; r++) {
    if (board.grid[r]!.some((v) => v !== 0)) return r;
  }
  return ROWS;
}

export function pieceCellsAbsolute(p: PieceState): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  forEachCell(p.type, p.rotation, (dx, dy) => out.push([p.x + dx, p.y + dy]));
  return out;
}
