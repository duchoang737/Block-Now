// Board / occupancy / drop validity — GDD §3 R-MOVE
// XÁC MINH BẰNG VIDEO GAMEPLAY (2026-08-10):
//   Người chơi NHẤC MẢNH LÊN và KÉO TỰ DO (mảnh vẽ tràn cả ra ngoài khung board),
//   rồi THẢ. Không có trượt theo lưới, không có tìm đường. Ràng buộc duy nhất là
//   Ô THẢ có hợp lệ không.
import type { Cell, GameState, HolderState, Level, PieceState } from '../types';
import { matches } from './items';

export const key = (r: number, c: number): string => `${r},${c}`;
export const cellKey = (cell: Cell): string => key(cell[0], cell[1]);

/**
 * Tập ô chơi được. Có thể gồm NHIỀU PANEL RỜI NHAU (thấy ở Level 3 bản gốc).
 *
 * Chỉ phụ thuộc `level` — dữ liệu TĨNH suốt màn — nên nhớ theo tham chiếu level.
 * `checkDrop` gọi hàm này mỗi lần, mà solver (§5) gọi `checkDrop` hàng triệu lần;
 * dựng lại Set mỗi lần là O(rows×cols) vô ích.
 */
const playableCache = new WeakMap<Level, Set<string>>();

export function playableSet(level: Level): Set<string> {
  const cached = playableCache.get(level);
  if (cached) return cached;

  const set = new Set<string>();
  if (level.playable && level.playable.length > 0) {
    for (const [r, c] of level.playable) set.add(key(r, c));
  } else {
    for (let r = 0; r < level.rows; r++)
      for (let c = 0; c < level.cols; c++) set.add(key(r, c));
  }
  for (const ob of level.obstacles ?? []) {
    if (ob.kind === 'wall') for (const [r, c] of ob.cells) set.delete(key(r, c));
  }
  playableCache.set(level, set);
  return set;
}

/** Ô mà các chốt CÒN LẠI của mảnh chiếm, nếu anchor đặt tại `anchor`. */
export function pieceCells(piece: PieceState, anchor?: Cell): Cell[] {
  const [ar, ac] = anchor ?? piece.anchor;
  return piece.pegs
    .filter((peg) => !peg.removed)
    .map((peg) => [ar + peg.offset[0], ac + peg.offset[1]] as Cell);
}

/** Ô của một chốt cụ thể. */
export function pegCell(piece: PieceState, pegIndex: number, anchor?: Cell): Cell {
  const [ar, ac] = anchor ?? piece.anchor;
  const off = piece.pegs[pegIndex].offset;
  return [ar + off[0], ac + off[1]];
}

export interface HoleRef {
  holder: HolderState;
  holeIndex: number;
}

/** ô → (khay, chỉ số lỗ). Khay ĐỨNG YÊN nên map này ổn định trong suốt một nước. */
export function holeMap(state: GameState): Map<string, HoleRef> {
  const map = new Map<string, HoleRef>();
  for (const holder of state.holders) {
    if (holder.popped) continue;
    holder.cells.forEach((cell, holeIndex) => map.set(cellKey(cell), { holder, holeIndex }));
  }
  return map;
}

/**
 * Ô bị PHỦ — mọi thứ nằm dưới đó bị KHOÁ: không nhúc nhích, không cắm được.
 *
 * Hai thứ phủ ô, khác nhau ở điều kiện mở chứ không khác ở hệ quả:
 *   · `shutter` — mở theo số LỚP CHỐT đã cắm (R-SHUTTER).
 *   · `ice`     — mở theo số KHAY ĐÃ NỔ (R-ICE).
 *
 * Băng KHÔNG phải là bức tường rồi biến mất: nó ĐÓNG BĂNG thứ nằm dưới. Vỡ ra là
 * lộ nguyên khối bên trong và khối đó mới bắt đầu đi được — đó mới là chỗ đáng chơi
 * của cơ chế, vì nó biến `count` từ một con số chờ đợi thành một bài toán thứ tự:
 * phải nổ đủ mấy khay bằng quân đang tự do TRƯỚC, mới lấy được quân đang bị kẹt.
 *
 * Chốt bị phủ vẫn nằm trong `blockedCells` (chính mảnh của nó chiếm ô), nên mảnh
 * khác không đi xuyên qua được, và `checkDrop` cũng loại mọi chỗ đặt chồng lên ô
 * băng — mảnh bị đóng băng vì thế tự khắc bất động, không cần chặn thêm ở đâu.
 */
export function isCovered(state: GameState, cell: Cell): boolean {
  const k = cellKey(cell);
  return state.obstacles.some(
    (ob) =>
      (ob.kind === 'shutter' || ob.kind === 'ice') &&
      !ob.cleared &&
      ob.cells.some((c) => cellKey(c) === k),
  );
}

/**
 * Ô ĐẶC — không thả chốt lên được.
 * **KHAY cũng là khối đặc**, y như mảnh khác / băng / cửa cuốn:
 * chốt đứng CẠNH khay rồi nhảy vào, chứ không bao giờ nằm đè lên khay.
 */
export function blockedCells(state: GameState, ignorePieceId?: string): Set<string> {
  const set = new Set<string>();
  for (const ob of state.obstacles) {
    if (ob.cleared || ob.kind === 'park') continue;
    for (const cell of ob.cells) set.add(cellKey(cell));
  }
  for (const holder of state.holders) {
    if (holder.popped) continue;
    for (const cell of holder.cells) set.add(cellKey(cell));
  }
  for (const piece of state.pieces) {
    if (piece.gone || piece.id === ignorePieceId) continue;
    for (const cell of pieceCells(piece)) set.add(cellKey(cell));
  }
  return set;
}

export interface SeatPreview {
  pegId: string;
  holderId: string;
  holeIndex: number;
  /** ô chốt đang đứng */
  from: Cell;
  /** ô của lỗ nó sẽ nhảy vào */
  to: Cell;
}

export interface DropCheck {
  ok: boolean;
  /** ô không hợp lệ — dùng cho ghost đỏ (§4) */
  bad: Cell[];
  /** chốt nào sẽ NHẢY vào lỗ nào nếu thả ở đây */
  seats: SeatPreview[];
}

/**
 * R-DROP — mọi chốt của mảnh phải rơi vào một **ô trống chơi được**.
 * Khay / mảnh khác / băng / cửa cuốn đều là khối đặc.
 * Sai một ô là hỏng cả cú thả — mảnh là khối cứng ("Linked shapes move together").
 */
export function checkDrop(state: GameState, piece: PieceState, anchor: Cell): DropCheck {
  const playable = playableSet(state.level);
  const blocked = blockedCells(state, piece.id);

  const bad: Cell[] = [];
  for (const [index, peg] of piece.pegs.entries()) {
    if (peg.removed) continue;
    const cell = pegCell(piece, index, anchor);
    const k = cellKey(cell);
    if (!playable.has(k) || blocked.has(k)) bad.push(cell);
  }

  if (bad.length > 0) return { ok: false, bad, seats: [] };
  return { ok: true, bad, seats: previewSeats(state, piece, anchor) };
}

const DIRS: Cell[] = [
  [-1, 0],
  [0, -1],
  [0, 1],
  [1, 0],
];

/**
 * R-SEAT (dry-run) — chốt nào sẽ nhảy vào lỗ nào nếu mảnh đứng yên tại `anchor`.
 * Quét chốt theo reading order, mỗi chốt nhìn 4 ô kề cạnh theo reading order.
 * Lặp tới khi không nhảy thêm được (lớp trong vừa lộ ra có thể nhảy tiếp).
 */
export function previewSeats(state: GameState, piece: PieceState, anchor: Cell): SeatPreview[] {
  const holes = holeMap(state);
  const filledCopy = new Map<string, boolean[]>();
  const depth = new Map<string, number>();
  const out: SeatPreview[] = [];

  const live = () =>
    piece.pegs
      .map((peg, index) => ({ peg, cell: pegCell(piece, index, anchor) }))
      .filter((e) => !e.peg.removed)
      .sort((a, b) => a.cell[0] - b.cell[0] || a.cell[1] - b.cell[1]);

  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const { peg, cell } of live()) {
      const used = depth.get(peg.id) ?? 0;
      const layer = peg.layers[used];
      if (!layer) continue;
      if (isCovered(state, cell)) continue;

      for (const [dr, dc] of DIRS) {
        const nb: Cell = [cell[0] + dr, cell[1] + dc];
        const ref = holes.get(cellKey(nb));
        if (!ref || ref.holder.popped) continue;
        if (isCovered(state, nb)) continue;

        let filled = filledCopy.get(ref.holder.id);
        if (!filled) {
          filled = [...ref.holder.filled];
          filledCopy.set(ref.holder.id, filled);
        }
        if (filled[ref.holeIndex]) continue;
        if (!matches(layer, ref.holder.color, ref.holder.holes[ref.holeIndex])) continue;

        filled[ref.holeIndex] = true;
        depth.set(peg.id, used + 1);
        out.push({ pegId: peg.id, holderId: ref.holder.id, holeIndex: ref.holeIndex, from: cell, to: nb });
        progressed = true;
        break;
      }
    }
  }
  return out;
}

/**
 * Mọi ô mảnh ĐỨNG ĐƯỢC, không quan tâm nó tới đó bằng cách nào.
 * Dùng cho chẩn đoán; luật chơi thật là `reachableAnchors`.
 */
export function validAnchors(state: GameState, pieceId: string): Cell[] {
  const piece = state.pieces.find((p) => p.id === pieceId);
  if (!piece || piece.gone) return [];
  const out: Cell[] = [];
  for (let r = -piece.pegs.length; r < state.level.rows + piece.pegs.length; r++) {
    for (let c = -piece.pegs.length; c < state.level.cols + piece.pegs.length; c++) {
      if (checkDrop(state, piece, [r, c]).ok) out.push([r, c]);
    }
  }
  return out;
}

/**
 * R-MOVE — mảnh **TRƯỢT** qua ô trống, KHÔNG nhấc lên rồi đặt xuống chỗ khác.
 *
 * Mảnh là khối cứng: nó đi từng bước một ô theo 4 hướng, và **mọi vị trí trung
 * gian** đều phải hợp lệ (mọi chốt nằm trên ô trống chơi được). Nghĩa là muốn
 * qua được thì phải có **đủ diện tích trống** để lách — một mảnh ngang 4 ô không
 * chui lọt khe rộng 3 ô, dù ô đích có trống.
 *
 * BFS trên tập vị trí neo, xuất phát từ chỗ mảnh đang đứng.
 */
export function reachableAnchors(state: GameState, pieceId: string): Cell[] {
  const piece = state.pieces.find((p) => p.id === pieceId);
  if (!piece || piece.gone) return [];

  const start = piece.anchor;
  const seen = new Set<string>([cellKey(start)]);
  const queue: Cell[] = [start];
  const out: Cell[] = [];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const [dr, dc] of DIRS) {
      const next: Cell = [cur[0] + dr, cur[1] + dc];
      const k = cellKey(next);
      if (seen.has(k)) continue;
      seen.add(k);
      if (!checkDrop(state, piece, next).ok) continue;
      out.push(next);
      queue.push(next);
    }
  }
  return out;
}

/** Mảnh có trượt được từ chỗ đang đứng tới `anchor` không. */
export function canReach(state: GameState, pieceId: string, anchor: Cell): boolean {
  const k = cellKey(anchor);
  return reachableAnchors(state, pieceId).some((a) => cellKey(a) === k);
}

/** 4 ô kề cạnh, reading order — dùng cho tách mảnh (unlink) và validate. */
export function neighbors(cell: Cell): Cell[] {
  const [r, c] = cell;
  return [
    [r - 1, c],
    [r, c - 1],
    [r, c + 1],
    [r + 1, c],
  ];
}
