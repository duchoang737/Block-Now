// Engine — applyMove / clone / hash. KHÔNG có undo stack (GDD §3 R-NO-UNDO).
import { canReach, cellKey, checkDrop } from './board';
import { seat } from './rules';
import type { Cell, GameState, Level, MoveResult } from '../types';

export function createState(level: Level): GameState {
  return {
    level,
    holders: level.holders.map((spec) => ({
      id: spec.id,
      color: spec.color,
      cells: spec.cells.map(([r, c]) => [r, c] as Cell),
      holes: [...spec.holes],
      filled: spec.filled ? [...spec.filled] : spec.holes.map(() => false),
      popped: false,
    })),
    pieces: level.pieces.map((spec) => {
      const [ar, ac] = spec.pegs[0].cell;
      return {
        id: spec.id,
        anchor: [ar, ac] as Cell,
        pegs: spec.pegs.map((peg) => ({
          id: peg.id,
          offset: [peg.cell[0] - ar, peg.cell[1] - ac] as Cell,
          layers: peg.layers.map((l) => ({ ...l })),
          removed: false,
        })),
        gone: false,
      };
    }),
    obstacles: (level.obstacles ?? [])
      .filter((ob) => ob.kind !== 'wall')
      .map((ob) => ({
        kind: ob.kind,
        cells: ob.cells.map(([r, c]) => [r, c] as Cell),
        count: ob.count ?? 0,
        cleared: false,
      })),
    moves: 0,
  };
}

export function cloneState(state: GameState): GameState {
  return {
    level: state.level, // static, chia sẻ tham chiếu
    holders: state.holders.map((h) => ({
      ...h,
      cells: h.cells.map(([r, c]) => [r, c] as Cell),
      holes: [...h.holes],
      filled: [...h.filled],
    })),
    pieces: state.pieces.map((p) => ({
      ...p,
      anchor: [p.anchor[0], p.anchor[1]] as Cell,
      pegs: p.pegs.map((peg) => ({
        ...peg,
        offset: [peg.offset[0], peg.offset[1]] as Cell,
        layers: peg.layers.map((l) => ({ ...l })),
      })),
    })),
    obstacles: state.obstacles.map((o) => ({
      ...o,
      cells: o.cells.map(([r, c]) => [r, c] as Cell),
    })),
    moves: state.moves,
  };
}

/**
 * Một nước đi = (pieceId, ô đích). Kéo tự do nên không có đường đi để phụ thuộc
 * ⇒ state sau chỉ phụ thuộc cặp này ⇒ solver + replay chạy đúng.
 * Trả về null nếu cú thả không hợp lệ (R-DROP) hoặc không đổi chỗ.
 */
export function applyMove(state: GameState, pieceId: string, anchor: Cell): MoveResult | null {
  const piece = state.pieces.find((p) => p.id === pieceId);
  if (!piece || piece.gone) return null;

  if (cellKey(anchor) === cellKey(piece.anchor)) return null;
  if (!checkDrop(state, piece, anchor).ok) return null;
  // R-MOVE: phải TRƯỢT tới được, không nhấc-rồi-đặt. Ô đích trống là chưa đủ —
  // giữa đường phải có đủ diện tích cho cả khối lách qua.
  if (!canReach(state, pieceId, anchor)) return null;

  piece.anchor = [anchor[0], anchor[1]];
  state.moves += 1;

  return seat(state, piece);
}

/** Hash tất định của state — dùng cho test determinism và cho solver sau này. */
export function hashState(state: GameState): string {
  const holders = state.holders
    .map((h) => `${h.id}:${h.filled.map((f) => (f ? 1 : 0)).join('')}${h.popped ? 'P' : ''}`)
    .sort()
    .join('|');
  const pieces = state.pieces
    .filter((p) => !p.gone)
    .map(
      (p) =>
        `${p.anchor[0]},${p.anchor[1]}[` +
        p.pegs
          .filter((peg) => !peg.removed)
          .map(
            (peg) =>
              `${peg.offset[0]},${peg.offset[1]}:` +
              peg.layers.map((l) => `${l.color}-${l.shape}`).join('>'),
          )
          .join(';') +
        ']',
    )
    .sort()
    .join('|');
  const obstacles = state.obstacles
    .map((o, idx) => `${idx}${o.kind}:${o.count}${o.cleared ? 'C' : ''}`)
    .join('|');
  return `${holders}#${pieces}#${obstacles}`;
}
