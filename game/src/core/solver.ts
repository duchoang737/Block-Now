// Solver + fairness harness — GDD §5.
//
// Vì sao cần: luật **không-Undo + có-đồng-hồ + khối cứng** nghĩa là một màn có
// nhánh chết sớm không phải "hơi khó" mà là **thua oan**. Không thể ship màn
// chưa quét bằng máy.
//
// HAI ĐIỀU DỄ HIỂU SAI:
//
//  1. Solver phải mô phỏng ĐÚNG luật engine, không phải luật lý tưởng. Cụ thể là
//     `reachableAnchors` (mảnh TRƯỢT, không tele) và `isDead`. Bản đầu `winnable`
//     đếm ngân sách "nước đỗ tạm" vì `isDead` khi đó cắt màn theo một nước; sau
//     khi `isDead` duyệt đủ không gian vị trí thì ngân sách đó biến mất — xem
//     chú thích của `winnable`. Lệch giữa hai bên là loại nhầm màn tốt hoặc ship
//     nhầm màn hỏng, cả hai đều khó truy.
//  2. Khối cứng + lỗ chỉ có ĐÚNG MỘT ô trống kề ⇒ hai chốt lẻ có thể kẹt vào thế
//     phải đổi chỗ cho nhau: không ai cắm được, không ai dọn được đường.
import { cellKey, playableSet, reachableAnchors } from './board';
import { applyMove, cloneState, createState, hashState } from './engine';
import { isCleared } from './rules';
import type { Cell, GameState, Level } from '../types';

/** Một nước đi = (mảnh, ô đích). Kéo tự do nên state sau chỉ phụ thuộc cặp này. */
export type Move = [pieceId: string, anchor: Cell];

export interface SolveOptions {
  /** trần số state được duyệt; vượt là bỏ level (GDD §5 "Budget") */
  maxStates?: number;
  /** trần số nước */
  maxDepth?: number;
}

export interface SolveResult {
  /** lời giải NGẮN NHẤT — BFS theo tầng nên nước đầu tiên tới `isCleared` là tối ưu */
  moves: Move[];
  statesVisited: number;
}

const DEFAULTS = { maxStates: 400_000, maxDepth: 16 };

export interface Successor {
  move: Move;
  next: GameState;
  /** số LỚP cắm được ở nước này — 0 nghĩa là "đỗ tạm" */
  seated: number;
}

/** Mọi nước hợp lệ từ `state`. */
export function successors(state: GameState): Successor[] {
  const out: Successor[] = [];
  for (const piece of state.pieces) {
    if (piece.gone) continue;
    // Chỉ những chỗ mảnh TRƯỢT tới được — cùng luật với engine (R-MOVE).
    for (const anchor of reachableAnchors(state, piece.id)) {
      if (cellKey(anchor) === cellKey(piece.anchor)) continue;
      const next = cloneState(state);
      // `pluggedLayers` của chính nước vừa đi — khỏi chạy `previewSeats` một lần nữa
      const result = applyMove(next, piece.id, anchor);
      if (result === null) continue;
      out.push({ move: [piece.id, anchor], next, seated: result.pluggedLayers });
    }
  }
  return out;
}

/**
 * Lời giải NGẮN NHẤT, hoặc null nếu không có (hoặc vượt ngân sách tìm kiếm).
 * BFS theo tầng + `visited` — màn của game này nhỏ, chưa cần IDA*.
 */
export function solve(level: Level, opts: SolveOptions = {}): SolveResult | null {
  const { maxStates, maxDepth } = { ...DEFAULTS, ...opts };
  const start = createState(level);
  if (isCleared(start)) return { moves: [], statesVisited: 1 };

  let frontier: { state: GameState; path: Move[] }[] = [{ state: start, path: [] }];
  const seen = new Set([hashState(start)]);

  for (let depth = 1; depth <= maxDepth; depth++) {
    const next: typeof frontier = [];
    for (const node of frontier) {
      for (const { move, next: child } of successors(node.state)) {
        const path = [...node.path, move];
        if (isCleared(child)) return { moves: path, statesVisited: seen.size };
        const h = hashState(child);
        if (seen.has(h)) continue;
        seen.add(h);
        if (seen.size > maxStates) return null;
        next.push({ state: child, path });
      }
    }
    if (next.length === 0) return null;
    frontier = next;
  }
  return null;
}

export interface FindOptions {
  /** số lần thử lại từ đầu, mỗi lần một chuỗi ngẫu nhiên khác */
  attempts?: number;
  /** trần số nước của MỘT lần thử */
  maxDepth?: number;
  /** hạt giống ngẫu nhiên — tất định để sinh lại ra đúng bộ màn cũ */
  seed?: number;
}

/**
 * TÌM MỘT lời giải, không đòi ngắn nhất — DFS ngẫu nhiên có định hướng, thử lại
 * nhiều lần.
 *
 * Vì sao phải có, dù đã có `solve`: `solve` là BFS theo tầng, tức là phải duyệt
 * TRỌN mọi state ở độ sâu d trước khi chạm độ sâu d+1. Ở board 6×6 đông block, đo
 * được: 0/12 ứng viên tìm ra lời giải, mỗi lần bỏ cuộc tốn tới **150 giây** vì đốt
 * hết 150k state mà mới tới độ sâu 4..5, trong khi lời giải dài 12..15 nước. Đó
 * không phải chậm — là bất khả thi về nguyên tắc, và tăng ngân sách không cứu được:
 * số state ở độ sâu 12 lớn hơn mọi trần ta dám đặt.
 *
 * DFS ngẫu nhiên đi thẳng xuống đáy nên chạm được độ sâu 15 trong vài chục nước.
 * Đổi lại nó KHÔNG chứng minh được tính ngắn nhất, và không chứng minh được "màn
 * này vô nghiệm" — thất bại ở đây chỉ có nghĩa "không tìm thấy". Cả hai chỗ đó đều
 * dùng được cho việc dựng màn: ta chỉ cần MỘT lời giải có thật để đảm bảo màn chơi
 * được, còn độ khó thì đo bằng `greedySolves`.
 *
 * Định hướng: ưu tiên nước CẮM ĐƯỢC (nhiều lớp trước), vì mọi lời giải cuối cùng
 * đều phải cắm hết. Nhưng KHÔNG cắm tham như `greedySolves` — chọn ngẫu nhiên trong
 * nhóm cắm được, và thỉnh thoảng đi một nước dọn chỗ, đúng chỗ mà người chơi tham
 * thua.
 */
export function findSolution(level: Level, opts: FindOptions = {}): SolveResult | null {
  return findFrom(createState(level), opts);
}

/** Như `findSolution` nhưng bắt đầu từ một state giữa chừng — dùng để dò nhánh đầu. */
export function findFrom(from: GameState, opts: FindOptions = {}): SolveResult | null {
  if (isCleared(from)) return { moves: [], statesVisited: 1 };
  const attempts = opts.attempts ?? 60;
  const maxDepth = opts.maxDepth ?? 24;
  let s = (opts.seed ?? 12345) >>> 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };

  let best: SolveResult | null = null;
  let visited = 0;
  for (let a = 0; a < attempts; a++) {
    let state = cloneState(from);
    const path: Move[] = [];
    const seen = new Set([hashState(state)]);

    for (let d = 0; d < maxDepth; d++) {
      const succ = successors(state).filter((x) => !seen.has(hashState(x.next)));
      visited += succ.length;
      if (succ.length === 0) break;

      const seating = succ.filter((x) => x.seated > 0);
      // 15% số lượt vẫn đi nước dọn chỗ dù đang có nước cắm: chính những màn ta
      // muốn là màn mà cắm ngay là hỏng, nên nhánh đó phải được thử tới.
      const pool = seating.length > 0 && rand() > 0.15 ? seating : succ;
      const pick = pool[Math.floor(rand() * pool.length)];

      state = pick.next;
      path.push(pick.move);
      seen.add(hashState(state));
      if (isCleared(state)) {
        if (!best || path.length < best.moves.length)
          best = { moves: [...path], statesVisited: visited };
        break;
      }
    }
    // Đã có lời giải ngắn thì thôi, khỏi đốt hết lượt thử.
    if (best && best.moves.length <= 8) break;
  }
  return best;
}

/**
 * "Người chơi thật còn thắng được từ đây không?"
 *
 * Trước đây hàm này phải đếm ngân sách "nước đỗ tạm", vì `isDead` cũ cắt màn
 * ngay khi *lúc đó* không có cú thả nào cắm được — nên đỗ tạm chỉ dùng được khi
 * vẫn còn một nước cắm ở chỗ khác.
 *
 * `isDead` giờ duyệt đủ không gian vị trí, tức chỉ kết thúc khi **không bao giờ**
 * cắm được nữa — mà state như thế thì cũng không thể clear. Hai điều kiện trùng
 * nhau, nên câu hỏi rút gọn đúng bằng: **còn đường nào tới `isCleared` không**.
 * Ngân sách đỗ tạm biến mất khỏi mô hình.
 */
export function winnable(state: GameState, maxStates = 60_000): boolean {
  if (isCleared(state)) return true;
  const seen = new Set([hashState(state)]);
  const stack: GameState[] = [state];

  while (stack.length > 0) {
    const cur = stack.pop()!;
    for (const { next } of successors(cur)) {
      if (isCleared(next)) return true;
      const h = hashState(next);
      if (seen.has(h)) continue;
      seen.add(h);
      if (seen.size > maxStates) return true; // hết ngân sách ⇒ không dám kết tội
      stack.push(next);
    }
  }
  return false;
}

export interface FairnessOptions {
  /** quét mọi state đạt được sau ≤ depth nước (GDD §5 điều 4 dùng 3) */
  depth?: number;
}

/**
 * GDD §5 điều 4 — không state đạt được sau ≤`depth` nước mà người chơi đã thua.
 * Trả về mô tả từng đường đi hỏng (rỗng = màn sạch).
 */
export function fairnessIssues(level: Level, opts: FairnessOptions = {}): string[] {
  const depth = opts.depth ?? 3;

  let frontier = [{ state: createState(level), path: [] as Move[] }];
  const seen = new Set([hashState(frontier[0].state)]);
  const bad: string[] = [];

  for (let d = 1; d <= depth; d++) {
    const next: typeof frontier = [];
    for (const node of frontier) {
      for (const { move, next: child } of successors(node.state)) {
        const h = hashState(child);
        if (seen.has(h)) continue;
        seen.add(h);
        const path = [...node.path, move];
        if (isCleared(child)) continue;
        if (winnable(child)) next.push({ state: child, path });
        else bad.push(path.map(([id, a]) => `${id}→[${a}]`).join('  |  '));
      }
    }
    frontier = next;
  }
  return bad;
}

/**
 * Cảnh báo thiết kế đứng trước cả solver: lỗ chỉ có MỘT ô trống kề nó là nguồn
 * bẫy "hai chốt phải đổi chỗ". Rẻ hơn `fairnessIssues` hàng nghìn lần nên dùng
 * để bắt lỗi lúc đang dựng màn.
 */
export function lonelyHoles(level: Level): string[] {
  const playable = playableSet(level);
  const solid = new Set<string>();
  for (const h of level.holders) for (const cell of h.cells) solid.add(cellKey(cell));
  for (const ob of level.obstacles ?? [])
    if (ob.kind === 'ice') for (const cell of ob.cells) solid.add(cellKey(cell));

  const out: string[] = [];
  for (const holder of level.holders) {
    holder.cells.forEach((cell, i) => {
      const open = ([
        [cell[0] - 1, cell[1]],
        [cell[0] + 1, cell[1]],
        [cell[0], cell[1] - 1],
        [cell[0], cell[1] + 1],
      ] as Cell[]).filter((nb) => playable.has(cellKey(nb)) && !solid.has(cellKey(nb)));
      if (open.length < 2)
        out.push(`${holder.id}#${i} (${holder.color}/${holder.holes[i]}) chỉ có ${open.length} ô đứng kề`);
    });
  }
  return out;
}
