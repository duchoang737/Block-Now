// Thước đo ĐỘ KHÓ và cổng chất lượng cho màn — dùng chung cho bộ sinh màn và test.
//
// "Khó" ở game này KHÔNG phải là nhiều nước đi. Luật trượt (R-MOVE) biến nó thành
// bài toán ĐƯỜNG ĐI: mảnh là khối cứng, khay là khối đặc, nên thứ tự dọn chỗ mới
// là chỗ người chơi phải tính. Hai thước đo dưới đây đo đúng chỗ đó.
import { createState, hashState } from '../core/engine';
import { isCleared, isDead } from '../core/rules';
import { findFrom, findSolution, solve, successors } from '../core/solver';
import { deadPieces, initialFreeSeats, validateLevel } from '../core/validate';
import { enclosedHoles } from '../editor/model';
import type { GameState, Level } from '../types';

/** Cặp (màu × hình) ĐÃ CÓ SPRITE. Dựng màn ngoài danh sách này là ra khay vẽ tay. */
export const ART_PAIRS: [string, string][] = [
  ['blue', 'circle'], ['blue', 'heart'], ['blue', 'star'],
  ['green', 'diamond'], ['green', 'triangle'],
  ['orange', 'cross'], ['orange', 'diamond'],
  ['pink', 'circle'], ['pink', 'star'],
  // purple/cross KHÔNG gen bằng AI mà CHUYỂN SẮC từ orange/cross: giữ nguyên V
  // (toàn bộ hình khối), chỉ thay H/S theo bảng học từ purple/diamond. Màu trung
  // bình đo được 147,85,197 so với 149,86,197 của ảnh mẫu.
  ['purple', 'circle'], ['purple', 'cross'], ['purple', 'diamond'], ['purple', 'star'],
  ['red', 'heart'], ['red', 'star'],
  ['white', 'pentagon'],
  ['yellow', 'heart'], ['yellow', 'square'], ['yellow', 'star'],
];

/**
 * Người chơi THAM: hễ có nước cắm được thì cắm ngay, cắm được nhiều lớp nhất thì
 * ưu tiên; không có nước cắm nào thì chịu.
 *
 * Đây là cách chơi mặc định của người mới. Màn nào tham mà xong thì màn đó KHÔNG
 * bắt ai phải tính — đó chính là thước đo "phải tính đường" mà ta cần.
 */
export function greedySolves(level: Level, maxMoves = 40): boolean {
  let state = createState(level);
  for (let i = 0; i < maxMoves; i++) {
    if (isCleared(state)) return true;
    let best: { seated: number; next: typeof state } | null = null;
    for (const s of successors(state)) {
      if (s.seated <= 0) continue;
      if (!best || s.seated > best.seated) best = { seated: s.seated, next: s.next };
    }
    if (!best) return false;
    state = best.next;
  }
  return isCleared(state);
}

export interface Analysis {
  /** lời giải ngắn nhất, -1 nếu không giải được */
  minMoves: number;
  /** những state đạt được sau ≤ depth nước mà từ đó KHÔNG còn thắng được */
  traps: number;
  /** vượt trần duyệt — không kết luận được gì */
  overflow: boolean;
}

/**
 * Dựng ĐỒ THỊ state đạt được MỘT LẦN rồi lan ngược từ các state đã thắng.
 *
 * Bản trước hỏi `winnable` riêng cho từng nhánh, mà mỗi lần hỏi là một lượt duyệt
 * lại gần như toàn bộ không gian — đo được **31 giây cho MỘT màn**. Một lượt tiến
 * để dựng cạnh, một lượt lùi để đánh dấu thắng, là đủ trả lời cả ba câu hỏi
 * (giải được không · ngắn nhất bao nhiêu · có nhánh tự thua không).
 */
export function analyze(level: Level, cap = 40_000, trapDepth = 2): Analysis {
  const start = createState(level);
  const h0 = hashState(start);
  if (isCleared(start)) return { minMoves: 0, traps: 0, overflow: false };

  const depth = new Map<string, number>([[h0, 0]]);
  const preds = new Map<string, string[]>();
  const cleared = new Set<string>();
  let frontier: { h: string; s: GameState }[] = [{ h: h0, s: start }];

  // ---- lượt TIẾN: dựng đồ thị state đạt được ----
  while (frontier.length > 0) {
    const next: typeof frontier = [];
    for (const node of frontier) {
      for (const { next: child } of successors(node.s)) {
        const h = hashState(child);
        const back = preds.get(h);
        if (back) back.push(node.h);
        else preds.set(h, [node.h]);
        if (depth.has(h)) continue;
        depth.set(h, depth.get(node.h)! + 1);
        if (depth.size > cap) return { minMoves: -1, traps: 0, overflow: true };
        if (isCleared(child)) cleared.add(h);
        else next.push({ h, s: child });
      }
    }
    frontier = next;
  }

  // ---- lượt LÙI: state nào có một nước dẫn tới state đã thắng thì cũng thắng ----
  const won = new Set(cleared);
  const queue = [...cleared];
  while (queue.length > 0) {
    for (const p of preds.get(queue.pop()!) ?? []) {
      if (won.has(p)) continue;
      won.add(p);
      queue.push(p);
    }
  }

  const minMoves = cleared.size === 0 ? -1 : Math.min(...[...cleared].map((h) => depth.get(h)!));
  let traps = 0;
  for (const [h, d] of depth) if (d > 0 && d <= trapDepth && !won.has(h)) traps++;

  return { minMoves: won.has(h0) ? minMoves : -1, traps, overflow: false };
}

export interface Verdict {
  ok: boolean;
  minMoves: number;
  /** người chơi tham có xong không — false nghĩa là màn BẮT phải tính */
  greedy: boolean;
  reasons: string[];
}

export interface JudgeOptions {
  needPlanning: boolean;
  minMovesAtLeast?: number;
  cap?: number;
  trapDepth?: number;
  /**
   * Trần cho `solve` ở bậc 4. Mặc định 13 nước / 20k state là đủ cho dãy màn sinh
   * theo `gen-levels`, nhưng khúc màn ĐÔNG BLOCK cần lời giải dài hơn thế — để
   * nguyên mặc định thì màn 14 nước bị loại vì "không giải được trong ngân sách",
   * tức là loại đúng những màn khó nhất.
   */
  maxDepth?: number;
  maxStates?: number;
  /**
   * Bỏ qua bậc phân tích đồ thị. Bộ sinh màn ném vào hàng trăm ứng viên mỗi màn,
   * mà `analyze` duyệt TRỌN không gian state — đo được 20 giây một lần. Nên vòng
   * lặp dùng `quick`, chỉ bản trúng tuyển mới soi kỹ.
   */
  quick?: boolean;
  /**
   * CHẾ ĐỘ BOARD ĐÔNG. Thay `solve` (BFS ngắn nhất) bằng `findSolution` (DFS ngẫu
   * nhiên), và thay `analyze` bằng phép dò nhánh đầu có giới hạn.
   *
   * Bắt buộc từ cỡ 6×6 trở lên. Đo được ở mật độ đó: `solve` tìm ra lời giải cho
   * **0/12** ứng viên, mỗi lần bỏ cuộc tốn tới **150 giây** — nó đốt sạch 150k
   * state mà mới tới độ sâu 4..5 trong khi lời giải dài 12..18 nước. Cùng bộ ứng
   * viên ấy, `findSolution` tìm ra lời giải cho 10/15 trong ~2 giây mỗi lần.
   *
   * ĐÁNH ĐỔI, phải nói thẳng: `minMoves` khi đó là ĐỘ DÀI LỜI GIẢI TÌM ĐƯỢC, không
   * phải lời giải ngắn nhất — nó là chặn TRÊN. Với ngân sách thời gian thì chặn
   * trên là phía an toàn (cho dư giờ, không cho thiếu).
   */
  dense?: boolean;
  /** số lần thử lại của `findSolution`; chỉ có nghĩa khi `dense` */
  findAttempts?: number;
  /** hạt giống cho `findSolution` — tất định để sinh lại ra đúng bộ màn cũ */
  seed?: number;
}

/**
 * Nhánh ĐẦU tự thua: nước đi đầu tiên nào khiến màn không còn thắng được.
 *
 * Dùng thay `analyze` ở board đông, nơi dựng trọn đồ thị state là bất khả thi.
 * BẢO THỦ MỘT CHIỀU: `findFrom` thất bại không chứng minh được nhánh đó chết —
 * chỉ nghĩa là không tìm thấy đường. Ta vẫn tính đó là hỏng và loại ứng viên. Loại
 * oan một màn tốt thì mất công dựng lại; ship một màn mà nước đầu đã thua thì người
 * chơi không có Undo và không có cách nào biết, nên chọn phía loại oan.
 */
export function fatalFirstMoves(level: Level, attempts: number, seed: number): number {
  const start = createState(level);
  let bad = 0;
  const seen = new Set<string>();
  for (const [i, { next }] of successors(start).entries()) {
    const h = hashState(next);
    if (seen.has(h)) continue;
    seen.add(h);
    if (isCleared(next)) continue;
    if (isDead(next)) {
      bad++;
      continue;
    }
    if (!findFrom(next, { attempts, maxDepth: 26, seed: seed + i * 7919 })) bad++;
  }
  return bad;
}

/**
 * Cổng chất lượng đầy đủ. XẾP THEO BẬC: kiểm rẻ trước, đắt sau, và THOÁT NGAY khi
 * trượt. Bộ sinh màn ném vào đây hàng nghìn ứng viên mà hầu hết chết ở bậc rẻ;
 * chạy `solve` rồi mới phát hiện màn sai dữ liệu là phí hàng trăm lần thời gian.
 *
 * `needPlanning` bật thì màn phải làm người chơi THAM thất bại.
 */
export function judge(level: Level, opts: JudgeOptions): Verdict {
  const no = (r: string): Verdict => ({ ok: false, minMoves: 0, greedy: false, reasons: [r] });

  // bậc 1 — dữ liệu, gần như miễn phí
  const issues = validateLevel(level);
  if (issues.length) return no(`${issues[0].rule}: ${issues[0].message}`);
  // Ô bỏ bị vây kín không sai luật chơi, nhưng khung ngoài không vẽ nổi: nó thành
  // một đường bao thứ hai lọt giữa board. Chặn ở đây để không màn nào lọt ra ngoài
  // với hình board như vậy — xem `enclosedHoles`.
  const shut = enclosedHoles(level);
  if (shut.length) return no(`ô bỏ bị vây kín tại ${JSON.stringify(shut[0])}`);
  const dead = deadPieces(level);
  if (dead.length) return no(`mảnh chết — ${dead[0]}`);
  const free = initialFreeSeats(level);
  if (free.length) return no(`cắm được ngay từ đầu — ${free[0]}`);

  // `lonelyHoles` KHÔNG còn là cổng chặn.
  //
  // Nó là phép thử thay thế rẻ tiền cho bẫy "hai chốt phải đổi chỗ", ra đời hồi
  // `isDead` còn cắt màn theo một nước. Giờ bậc 5 dựng trọn đồ thị state và bắt
  // mọi nhánh tự thua — tức là bắt đúng cái bẫy đó, chặt chẽ hơn hẳn. Giữ nó làm
  // cổng thì nó chặn mất đúng thứ ta cần: màn CHẬT, nơi lỗ khó mà có ≥2 lối vào.
  // Đo được: bật lên thì 1217/1250 ứng viên bị loại vì lý do này.

  // bậc 3 — mô phỏng một ván tham, rẻ hơn BFS nhiều bậc
  const greedy = greedySolves(level);
  if (opts.needPlanning && greedy) return no('người chơi THAM vẫn xong ⇒ không bắt phải tính');

  // bậc 4 — tìm lời giải. Board CHẬT thì không gian state nhỏ đi, nên BFS ngắn nhất
  // rộng tay hơn được; board ĐÔNG thì BFS bất khả thi, xem `dense`.
  const seed = opts.seed ?? 20260814;
  const sol = opts.dense
    ? findSolution(level, { attempts: opts.findAttempts ?? 60, maxDepth: 26, seed })
    : solve(level, { maxDepth: opts.maxDepth ?? 13, maxStates: opts.maxStates ?? 20_000 });
  if (!sol) return no('không giải được trong ngân sách nhanh');
  if (sol.moves.length < (opts.minMovesAtLeast ?? 0))
    return no(`quá ngắn: ${sol.moves.length} < ${opts.minMovesAtLeast} nước`);
  if (opts.quick) return { ok: true, minMoves: sol.moves.length, greedy, reasons: [] };

  // bậc 5 — chỉ chạy cho bản trúng tuyển: soi nhánh tự thua
  if (opts.dense) {
    const bad = fatalFirstMoves(level, opts.findAttempts ?? 60, seed);
    if (bad > 0) return no(`${bad} nước đầu tự thua`);
    return { ok: true, minMoves: sol.moves.length, greedy, reasons: [] };
  }
  const a = analyze(level, opts.cap ?? 40_000, opts.trapDepth ?? 2);
  if (a.overflow) return no('không gian state quá lớn, không kết luận được');
  if (a.minMoves < 0) return no('không giải được');
  if (a.traps > 0) return no(`${a.traps} nhánh sớm tự thua`);

  return { ok: true, minMoves: a.minMoves, greedy, reasons: [] };
}

/**
 * Ngân sách thời gian. `minMoves × 4000 + 20000` của §5.3 là mức SÀN — test chỉ
 * bắt không được thấp hơn, không cấm rộng hơn.
 *
 * Từ Lv10 trở đi nhân đôi: những màn đó bắt phải TÍNH trước khi đi, mà đồng hồ
 * sát nút thì nó biến bài toán tư duy thành bài toán bấm nhanh — hai thứ khác hẳn
 * nhau, và cái sau không phải thứ game này muốn.
 */
export const timeFor = (minMoves: number, levelNo = 1): number => {
  const floor = minMoves * 4000 + 20000;
  return Math.ceil((levelNo >= 10 ? floor * 2 : floor) / 5000) * 5000;
};
