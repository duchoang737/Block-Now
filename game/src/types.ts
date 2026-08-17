// Data + runtime types — GDD §8
// Doc: ../../ShapeInShape_GDD.md
//
// MÔ HÌNH (v2 — sửa theo chỉ thị chủ tài liệu):
//   MẢNH (piece) = thứ người chơi KÉO. Một mảnh gồm 1..n CHỐT (peg) nối nhau.
//   KHAY (holder) = ổ cắm có lỗ, ĐỨNG YÊN. Chốt cắm vào lỗ; khay đầy lỗ thì nổ.

export type Shape =
  | 'circle' | 'heart' | 'star' | 'diamond'
  | 'square' | 'cross' | 'pentagon' | 'triangle';

export type Color =
  | 'red' | 'pink' | 'blue' | 'yellow'
  | 'green' | 'purple' | 'orange' | 'white';

/** [row, col] */
export type Cell = [number, number];

export interface Layer {
  shape: Shape;
  color: Color;
}

// ---------- Level data (GDD §8) ----------

/** Khay có lỗ — ĐỨNG YÊN, không kéo được. */
export interface HolderSpec {
  id: string;
  color: Color;
  /** 1..5 ô liền nhau theo 1 trục */
  cells: Cell[];
  /** holes[i] ứng với cells[i]; cùng màu, khác hình được */
  holes: Shape[];
  filled?: boolean[];
}

/** Một chốt trong mảnh. `layers[0]` = lớp trên cùng (shape-in-shape). */
export interface PegSpec {
  id: string;
  cell: Cell;
  layers: Layer[];
}

/** MẢNH — đơn vị người chơi kéo. Các chốt nối nhau, di chuyển như MỘT khối cứng. */
export interface PieceSpec {
  id: string;
  pegs: PegSpec[];
}

export interface ObstacleSpec {
  kind: 'ice' | 'shutter' | 'wall' | 'park';
  cells: Cell[];
  count?: number;
}

export interface Level {
  id: string;
  chapter: number;
  rows: number;
  cols: number;
  /** ô chơi được; bỏ trống = full rect */
  playable?: Cell[];
  holders: HolderSpec[];
  pieces: PieceSpec[];
  obstacles?: ObstacleSpec[];
  /** BẮT BUỘC — countdown (R-TIME) */
  timeLimitMs: number;
  minMoves?: number;
  difficulty?: 'normal' | 'hard' | 'expert';
  name?: string;
}

// ---------- Runtime state ----------

export interface HolderState {
  id: string;
  color: Color;
  cells: Cell[];
  holes: Shape[];
  filled: boolean[];
  popped: boolean;
}

export interface PegState {
  id: string;
  /** offset so với anchor của mảnh — KHÔNG đổi khi mảnh di chuyển */
  offset: Cell;
  layers: Layer[];
  removed: boolean;
}

export interface PieceState {
  id: string;
  anchor: Cell;
  pegs: PegState[];
  /** mọi chốt đã cắm hết → mảnh biến mất, trả lại ô */
  gone: boolean;
}

export interface ObstacleState {
  kind: ObstacleSpec['kind'];
  cells: Cell[];
  count: number;
  cleared: boolean;
}

export interface GameState {
  level: Level;
  holders: HolderState[];
  pieces: PieceState[];
  obstacles: ObstacleState[];
  /** số nước đã đi — analytics/tuning, KHÔNG hiện in-game (GDD §7) */
  moves: number;
}

// ---------- Kết quả ----------

export type EndReason = 'cleared' | 'timeout' | 'deadlock';

export interface GameResult {
  levelId: string;
  solved: boolean;
  reason: EndReason;
  remainingMs: number;
  timeLimitMs: number;
  moves: number;
  restarts: number;
  elapsedMs: number;
}

export interface Transfer {
  pegId: string;
  /** ô của chốt lúc cắm — để view chạy anim bay vào lỗ */
  from: Cell;
  holderId: string;
  holeIndex: number;
  layer: Layer;
}

export interface MoveResult {
  /** id chốt đã BIẾN MẤT hẳn (hết lớp) trong nước này */
  clearedPegs: string[];
  /** số LỚP cắm được (dùng cho R-SHUTTER) */
  pluggedLayers: number;
  /** id khay nổ trong nước này */
  poppedHolders: string[];
  transfers: Transfer[];
}
