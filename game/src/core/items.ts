// Chốt nhiều lớp (shape-in-shape) — GDD §3 M-LAYER
import type { Color, Layer, PegState, PieceState, Shape } from '../types';

/** Lớp trên cùng — thứ đang nhìn thấy & cắm được. */
export function topLayer(peg: PegState): Layer | null {
  if (peg.removed || peg.layers.length === 0) return null;
  return peg.layers[0];
}

/**
 * Điều kiện khớp là HAI CHIỀU: màu của khay VÀ hình của lỗ.
 * Cùng màu khác hình → không khớp. Cùng hình khác màu → không khớp.
 */
export function matches(layer: Layer, holderColor: Color, holeShape: Shape): boolean {
  return layer.color === holderColor && layer.shape === holeShape;
}

/** Bóc 1 lớp. Hết lớp thì chốt biến mất khỏi mảnh (ô của nó thành trống). */
export function peel(peg: PegState): Layer | null {
  const layer = peg.layers.shift() ?? null;
  if (peg.layers.length === 0) peg.removed = true;
  return layer;
}

/** Tổng số lớp còn lại trên board — dùng cho HUD/solver heuristic. */
export function layersLeft(pieces: PieceState[]): number {
  let n = 0;
  for (const piece of pieces)
    for (const peg of piece.pegs) if (!peg.removed) n += peg.layers.length;
  return n;
}
