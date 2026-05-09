import { Grid, PieceState, ClearResult } from './types';
import { PIECE_COLOR_ID, forEachCell } from './piece';

export const COLS = 10;
export const ROWS = 20;

export function createEmptyGrid(): Grid {
  const g: Grid = [];
  for (let r = 0; r < ROWS; r++) {
    g.push(new Array<number>(COLS).fill(0));
  }
  return g;
}

export class Board {
  grid: Grid;

  constructor(grid?: Grid) {
    this.grid = grid ?? createEmptyGrid();
  }

  clone(): Board {
    return new Board(this.grid.map((row) => row.slice()));
  }

  collides(piece: PieceState, dx = 0, dy = 0, rotation = piece.rotation): boolean {
    let hit = false;
    forEachCell(piece.type, rotation, (cx, cy) => {
      if (hit) return;
      const x = piece.x + cx + dx;
      const y = piece.y + cy + dy;
      if (x < 0 || x >= COLS || y >= ROWS) {
        hit = true;
        return;
      }
      if (y < 0) return;
      if (this.grid[y]![x]! !== 0) hit = true;
    });
    return hit;
  }

  merge(piece: PieceState): void {
    const colorId = PIECE_COLOR_ID[piece.type];
    forEachCell(piece.type, piece.rotation, (cx, cy) => {
      const x = piece.x + cx;
      const y = piece.y + cy;
      if (y >= 0 && y < ROWS && x >= 0 && x < COLS) {
        this.grid[y]![x] = colorId;
      }
    });
  }

  clearLines(): ClearResult {
    const cleared: number[] = [];
    for (let r = ROWS - 1; r >= 0; r--) {
      if (this.grid[r]!.every((v) => v !== 0)) cleared.push(r);
    }
    if (cleared.length === 0) return { clearedRows: [], count: 0 };
    const remaining = this.grid.filter((_, idx) => !cleared.includes(idx));
    while (remaining.length < ROWS) remaining.unshift(new Array<number>(COLS).fill(0));
    this.grid = remaining;
    return { clearedRows: cleared, count: cleared.length };
  }

  columnHeights(): number[] {
    const heights = new Array<number>(COLS).fill(0);
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        if (this.grid[r]![c] !== 0) {
          heights[c] = ROWS - r;
          break;
        }
      }
    }
    return heights;
  }

  countHoles(): number {
    let holes = 0;
    for (let c = 0; c < COLS; c++) {
      let blockSeen = false;
      for (let r = 0; r < ROWS; r++) {
        if (this.grid[r]![c] !== 0) blockSeen = true;
        else if (blockSeen) holes++;
      }
    }
    return holes;
  }
}
