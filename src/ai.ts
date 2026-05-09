import { Board, COLS, ROWS } from './board';
import { PieceState } from './types';
import { forEachCell } from './piece';

const W_HEIGHT = -0.510066;
const W_LINES = 0.760666;
const W_HOLES = -0.35663;
const W_BUMP = -0.184483;

export interface AIDecision {
  rotation: number;
  targetX: number;
  score: number;
}

function simulateDrop(board: Board, piece: PieceState, rotation: number, x: number): Board | null {
  const test: PieceState = { ...piece, x, y: 0, rotation };
  if (board.collides(test, 0, 0, rotation)) return null;
  let dy = 0;
  while (!board.collides(test, 0, dy + 1, rotation)) dy++;
  const finalPiece: PieceState = { ...test, y: test.y + dy };
  const next = board.clone();
  next.merge(finalPiece);
  return next;
}

function evaluate(board: Board): number {
  const heights = board.columnHeights();
  const aggregate = heights.reduce((a, b) => a + b, 0);
  const holes = board.countHoles();
  let bumpiness = 0;
  for (let i = 0; i < heights.length - 1; i++) {
    bumpiness += Math.abs(heights[i]! - heights[i + 1]!);
  }
  let completed = 0;
  for (let r = 0; r < ROWS; r++) {
    if (board.grid[r]!.every((v) => v !== 0)) completed++;
  }
  return W_HEIGHT * aggregate + W_LINES * completed + W_HOLES * holes + W_BUMP * bumpiness;
}

export function computeBestMove(board: Board, piece: PieceState): AIDecision {
  let best: AIDecision = { rotation: 0, targetX: piece.x, score: -Infinity };
  for (let rot = 0; rot < 4; rot++) {
    let minDx = -COLS;
    let maxDx = COLS;
    for (let x = minDx; x <= maxDx; x++) {
      const test: PieceState = { ...piece, x, y: 0, rotation: rot };
      let inBounds = true;
      forEachCell(test.type, rot, (cx) => {
        const px = test.x + cx;
        if (px < 0 || px >= COLS) inBounds = false;
      });
      if (!inBounds) continue;
      const next = simulateDrop(board, piece, rot, x);
      if (!next) continue;
      const score = evaluate(next);
      if (score > best.score) best = { rotation: rot, targetX: x, score };
    }
  }
  return best;
}
