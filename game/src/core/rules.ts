// R-SEAT / R-UNLINK / R-POP / R-ICE / R-SHUTTER / R-WIN / R-DEAD — GDD §3
import { cellKey, checkDrop, holeMap, isCovered, neighbors, pegCell, reachableAnchors } from './board';
import { peel } from './items';
import type { Cell, GameState, MoveResult, PegState, PieceState, Transfer } from '../types';

const emptyResult = (): MoveResult => ({
  clearedPegs: [],
  pluggedLayers: 0,
  poppedHolders: [],
  transfers: [],
});

const DIRS: Cell[] = [
  [-1, 0],
  [0, -1],
  [0, 1],
  [1, 0],
];

/**
 * R-SEAT — chạy ngay sau khi mảnh được THẢ và đứng yên.
 * Mỗi chốt nhìn **4 ô kề cạnh**: nếu ô đó là một **lỗ còn trống khớp cả màu khay
 * lẫn hình lỗ** → chốt **NHẢY vào lỗ đó**. Chốt không bao giờ nằm đè lên khay.
 * Quét chốt theo reading order, mỗi chốt duyệt hướng theo reading order, lặp tới
 * khi không nhảy thêm được (lớp trong vừa lộ ra có thể nhảy tiếp trong cùng lượt).
 */
export function seat(state: GameState, piece: PieceState): MoveResult {
  const result = emptyResult();
  if (piece.gone) return result;

  const holes = holeMap(state);

  let progressed = true;
  while (progressed) {
    progressed = false;

    const live = piece.pegs
      .map((peg, index) => ({ peg, cell: pegCell(piece, index) }))
      .filter((e) => !e.peg.removed)
      .sort((a, b) => a.cell[0] - b.cell[0] || a.cell[1] - b.cell[1]);

    for (const { peg, cell } of live) {
      if (peg.removed) continue;
      if (isCovered(state, cell)) continue;
      const layer = peg.layers[0];
      if (!layer) continue;

      for (const [dr, dc] of DIRS) {
        const nb: Cell = [cell[0] + dr, cell[1] + dc];
        const ref = holes.get(cellKey(nb));
        if (!ref || ref.holder.popped || ref.holder.filled[ref.holeIndex]) continue;
        if (isCovered(state, nb)) continue;
        if (layer.color !== ref.holder.color || layer.shape !== ref.holder.holes[ref.holeIndex]) continue;

        ref.holder.filled[ref.holeIndex] = true;
        const taken = peel(peg);
        if (!taken) break;

        const transfer: Transfer = {
          pegId: peg.id,
          from: cell,
          holderId: ref.holder.id,
          holeIndex: ref.holeIndex,
          layer: taken,
        };
        result.transfers.push(transfer);
        result.pluggedLayers += 1;
        if (peg.removed) result.clearedPegs.push(peg.id);

        // R-SHUTTER: mỗi LỚP cắm được → giảm 1
        for (const ob of state.obstacles) {
          if (ob.kind !== 'shutter' || ob.cleared) continue;
          ob.count -= 1;
          if (ob.count <= 0) ob.cleared = true;
        }

        progressed = true;
        break; // chốt này vừa nhảy 1 lớp; lớp trong (nếu có) xử ở vòng sau
      }
    }
  }

  if (piece.pegs.every((peg) => peg.removed)) piece.gone = true;
  else if (result.pluggedLayers > 0) unlink(state, piece);

  // R-POP + R-ICE — khay đầy hết lỗ thì nổ, trả lại ô
  for (const holder of state.holders) {
    if (holder.popped || !holder.filled.every(Boolean)) continue;
    holder.popped = true;
    result.poppedHolders.push(holder.id);
    for (const ob of state.obstacles) {
      if (ob.kind !== 'ice' || ob.cleared) continue;
      ob.count -= 1;
      if (ob.count <= 0) ob.cleared = true;
    }
  }

  return result;
}

/**
 * R-UNLINK — "Complete goals to unlink" (tutorial text bản gốc).
 * Chốt bị cắm đi làm chuỗi đứt: các chốt còn lại tách thành những mảnh RỜI NHAU
 * theo thành phần liên thông, và từ đó di chuyển độc lập.
 */
export function unlink(state: GameState, piece: PieceState): void {
  const live = piece.pegs.filter((peg) => !peg.removed);
  if (live.length <= 1) return;

  const cellOf = new Map<string, PegState>();
  for (const peg of live) {
    const cell: Cell = [piece.anchor[0] + peg.offset[0], piece.anchor[1] + peg.offset[1]];
    cellOf.set(cellKey(cell), peg);
  }

  const seen = new Set<string>();
  const groups: PegState[][] = [];
  for (const [startKey, startPeg] of cellOf) {
    if (seen.has(startKey)) continue;
    seen.add(startKey);
    const group = [startPeg];
    const queue: Cell[] = [startKey.split(',').map(Number) as Cell];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const nb of neighbors(cur)) {
        const k = cellKey(nb);
        if (seen.has(k) || !cellOf.has(k)) continue;
        seen.add(k);
        group.push(cellOf.get(k)!);
        queue.push(nb);
      }
    }
    groups.push(group);
  }

  if (groups.length <= 1) return;

  const index = state.pieces.indexOf(piece);
  const born: PieceState[] = groups.map((group, i) => {
    const anchorPeg = group.reduce((best, peg) =>
      peg.offset[0] < best.offset[0] || (peg.offset[0] === best.offset[0] && peg.offset[1] < best.offset[1])
        ? peg
        : best,
    );
    const anchor: Cell = [
      piece.anchor[0] + anchorPeg.offset[0],
      piece.anchor[1] + anchorPeg.offset[1],
    ];
    return {
      id: `${piece.id}~${i}`,
      anchor,
      pegs: group.map((peg) => ({
        ...peg,
        offset: [peg.offset[0] - anchorPeg.offset[0], peg.offset[1] - anchorPeg.offset[1]] as Cell,
      })),
      gone: false,
    };
  });

  state.pieces.splice(index, 1, ...born);
}

/** R-WIN — sạch mảnh và sạch khay. */
export function isCleared(state: GameState): boolean {
  return state.pieces.every((p) => p.gone) && state.holders.every((h) => h.popped);
}

/**
 * Trần số cấu hình được duyệt trong `isDead`. Vượt trần thì coi như CÒN SỐNG.
 * Báo thua oan một màn giải được là hỏng nặng hơn nhiều so với bắt người chơi
 * chờ thêm vài giây ở một màn thật sự kẹt, nên chỗ này cố ý lệch về phía an toàn.
 */
const DEAD_SCAN_CAP = 3000;

/**
 * R-DEAD — không còn cách nào cắm được chốt NỮA. Vì không có Undo, engine cắt
 * sớm thay vì bắt người chơi chờ hết giờ.
 *
 * KHÔNG chỉ nhìn một nước. Bản đầu chỉ hỏi "ngay lúc này có cú thả nào cắm được
 * không", nên màn cần một NƯỚC DỌN CHỖ trước rồi mới cắm được sẽ bị báo thua oan.
 *
 * Chỗ cứu là một tính chất của chính luật chơi: **chừng nào chưa cắm được chốt
 * nào thì thứ duy nhất thay đổi là vị trí các mảnh** — khay, băng, cửa cuốn đều
 * đứng yên. Nên duyệt hết không gian vị trí là ĐỦ để kết luận, không cần tìm
 * kiếm sâu vô hạn: hoặc gặp một cú thả cắm được, hoặc thật sự hết đường.
 */
export function isDead(state: GameState): boolean {
  if (isCleared(state)) return false;

  const live = state.pieces.filter((p) => !p.gone);
  if (live.length === 0) return true;
  const ids = live.map((p) => p.id);

  const withAnchors = (anchors: Cell[]): GameState => ({
    ...state,
    pieces: state.pieces.map((p) => {
      const i = ids.indexOf(p.id);
      return i < 0 ? p : { ...p, anchor: anchors[i] };
    }),
  });

  const start = live.map((p) => p.anchor);
  const keyOf = (anchors: Cell[]) => anchors.map(cellKey).join('|');
  const seen = new Set<string>([keyOf(start)]);
  const queue: Cell[][] = [start];

  while (queue.length > 0 && seen.size <= DEAD_SCAN_CAP) {
    const cur = queue.shift()!;
    const st = withAnchors(cur);
    for (let i = 0; i < ids.length; i++) {
      const piece = st.pieces.find((p) => p.id === ids[i])!;
      for (const anchor of reachableAnchors(st, piece.id)) {
        if (checkDrop(st, piece, anchor).seats.length > 0) return false;
        const next = [...cur];
        next[i] = anchor;
        const k = keyOf(next);
        if (seen.has(k)) continue;
        seen.add(k);
        queue.push(next);
      }
    }
  }
  // duyệt quá trần ⇒ không dám kết luận, cho chơi tiếp
  return seen.size <= DEAD_SCAN_CAP;
}
