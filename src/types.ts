export type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

export interface PieceState {
  type: PieceType;
  x: number;
  y: number;
  rotation: number;
}

export type Cell = number;

export type Grid = Cell[][];

export interface ClearResult {
  clearedRows: number[];
  count: number;
}
