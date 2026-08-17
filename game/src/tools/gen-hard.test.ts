/**
 * DỰNG LẠI KHÚC Lv5..Lv20 — "đông block và thực sự khó".
 *
 *   $env:VITE_GEN='1'; $env:VITE_ONLY='7'; npx vitest run src/tools/gen-hard.test.ts
 *
 * HAI CHẾ ĐỘ, cắt ở Lv10 (`DENSE`):
 *   · Lv5..9   — board 4×5..4×6, `solve` BFS ngắn nhất, `analyze` soi nhánh tự thua.
 *   · Lv10..20 — board 6×6 đông block. Ở cỡ này BFS VÔ DỤNG (0/12 ứng viên tìm ra
 *     lời giải, mỗi lần bỏ cuộc tới 150 giây), nên chuyển sang `findSolution` +
 *     `fatalFirstMoves`. Xem `dense` trong `design.ts` và §5.0b của GDD.
 *
 * Mỗi màn ghi ra một file riêng `hard-<n>.json`, KHÔNG đụng `levels.data.json` —
 * nhờ vậy chạy được sáu tiến trình song song, mỗi tiến trình một màn. Gộp lại bằng
 * `merge-hard.test.ts`. Tìm màn ở đây tốn hàng phút chứ không phải hàng giây, nên
 * chạy tuần tự là mất gần nửa tiếng cho một lần thử tham số.
 *
 * Vì sao tách khỏi `gen-levels.test.ts`: bộ sinh cả dãy đi theo một đường cong độ
 * khó trải đều 5→50, nên khúc đầu của nó cố tình nhẹ (4..5 nước, 2..3 mảnh, 6 ô
 * trống). Ở đây yêu cầu ngược lại — khúc đầu phải NẶNG ngay.
 *
 * BA NÚM VẶN, theo đúng thứ tự ảnh hưởng:
 *
 *  1. SỐ BLOCK. Mỗi mảnh thêm vào là một vật cản di động cho mọi mảnh còn lại; ở
 *     board chật thì chính chúng khoá nhau, và thứ tự gỡ mới là câu đố.
 *  2. Ô TRỐNG. `free` là số ô trống sau khi đặt hết. Đây là núm CHẶT NHẤT và cũng
 *     nguy hiểm nhất — xem ghi chú `mobile` bên dưới.
 *  3. LỜI GIẢI DÀI. `target` là số nước tối thiểu đòi ở lời giải NGẮN NHẤT.
 *
 * ĐO ĐƯỢC, và nó định hình toàn bộ file này: mảnh CỨNG 3 chốt gần như không nhúc
 * nhích nổi khi board chỉ còn 5..6 ô trống rời rạc — 6/6 ứng viên Lv10 kiểu
 * "4 khay ba ô + 4 mảnh ba chốt" có ĐÚNG 0 nước đi hợp lệ ngay từ state đầu. Nên
 * "đông block" ở đây là NHIỀU MẢNH NHỎ (1..2 chốt), không phải vài khối to.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { judge } from './design';
import { build, buildStats, rng, type Recipe } from './build-level';
import { createState } from '../core/engine';
import { findSolution, solve, successors } from '../core/solver';
import type { Level } from '../types';

const LEVELS_FILE = new URL('../levels.data.json', import.meta.url);
const outFor = (n: number) => new URL(`./hard-${n}.json`, import.meta.url);

interface Plan {
  rec: Recipe;
  /** số nước ĐÒI TỐI THIỂU ở lời giải ngắn nhất */
  target: number;
}

const mk = (
  name: string,
  holderSizes: number[],
  pieceSizes: number[],
  stacked: number,
  free: number,
  rows: number,
  cols: number,
  target: number,
): Plan => ({
  rec: { name, holderSizes, pieceSizes, stacked, free, rows, cols, extra: 0, planning: true },
  target,
});

/**
 * `target` là số nước TUYỆT ĐỐI, không phải "tổng lớp + extra" như bộ sinh cũ.
 *
 * Bộ cũ đòi `tổng lớp + extra`, tức đòi KHÔNG nước nào cắm được hai lớp một lúc.
 * Ở màn 6 lớp thì hợp lý; ở màn 12 lớp thì nó đòi lời giải 14 nước, mà BFS tìm lời
 * giải ngắn nhất không tới nổi độ sâu đó trong ngân sách — đo được 1815/1817 ứng
 * viên Lv10 bị loại vì đúng lý do này, kể cả màn giải được. Trần thật nằm ở
 * `gen-solutions` (16 nước / 200k state), nên `target` phải ở dưới trần đó.
 *
 * Phương án đầu là thứ ta muốn; phương án sau nới dần (thêm ô trống, bớt block) để
 * không bao giờ rơi vào cảnh không dựng nổi màn nào và phải giữ bản cũ.
 */
const PLANS: Record<number, Plan[]> = {
  // 6 lỗ · 6 chốt chia 4 mảnh trên 4×5 — đông ngay từ màn đầu khúc.
  //
  // 5 ô trống chứ không phải 4. Bản 4 ô trống ra màn 12 nước — NẶNG HƠN cả Lv6..Lv9
  // (11 nước), tức là màn mở khúc lại là màn khó nhất khúc. Và nó không hạ xuống
  // được bằng cách đòi ít nước hơn: chặn trần 9 rồi 10 đều về tay trắng, vì ở độ
  // chật đó gần như không tồn tại màn ngắn hơn. Nới đúng MỘT ô là núm chỉnh thật.
  5: [
    mk('ba khay · bốn mảnh', [2, 2, 2], [2, 2, 1, 1], 0, 5, 4, 5, 9),
    mk('ba khay · bốn mảnh', [2, 2, 2], [2, 2, 1, 1], 0, 6, 4, 5, 8),
    mk('ba khay · ba mảnh', [2, 2, 2], [2, 2, 2], 0, 6, 4, 5, 8),
  ],
  // khay 3 ô đầu tiên: phải gom đủ 3 chốt mới nổ ⇒ thứ tự bị ép chặt
  6: [
    mk('khay ba ô · bốn mảnh', [3, 2, 2], [2, 2, 2, 1], 0, 5, 4, 5, 9),
    mk('khay ba ô · bốn mảnh', [3, 2, 2], [2, 2, 2, 1], 0, 6, 4, 6, 8),
    mk('ba khay · bốn mảnh', [2, 2, 2], [2, 2, 1, 1], 0, 5, 4, 5, 8),
  ],
  // lồng nhau: một chốt phải cắm HAI LẦN ở hai chỗ khác nhau
  7: [
    mk('lồng nhau · bốn mảnh', [3, 3, 2], [2, 2, 2, 1], 1, 5, 4, 5, 10),
    mk('lồng nhau · bốn mảnh', [3, 3, 2], [2, 2, 2, 1], 1, 7, 4, 6, 9),
    mk('lồng nhau · bốn mảnh', [3, 2, 2], [2, 2, 1, 1], 1, 6, 4, 5, 8),
  ],
  // 4 màu, 5 mảnh — bài phân loại chồng lên bài đường đi.
  //
  // Lưới 5×5 / 5 ô trống, KHÔNG phải 4×6 / 8 ô trống. Bản 4×6 nới ra tưởng là dễ
  // dựng hơn nhưng đo ngược lại: 52 ứng viên trong 513 giây (so với 5×5 ra màn 11
  // nước), và bản lọt lưới chỉ còn 9 nước — rộng ra là thoáng ra, mà thoáng thì hết
  // khó. Board chật vừa khó hơn vừa rẻ hơn để tìm.
  8: [
    mk('bốn màu · năm mảnh', [2, 2, 2, 2], [2, 2, 2, 1, 1], 0, 5, 5, 5, 10),
    mk('bốn màu · năm mảnh', [2, 2, 2, 2], [2, 2, 2, 1, 1], 0, 6, 5, 5, 9),
    mk('bốn màu · bốn mảnh', [2, 2, 2, 2], [2, 2, 2, 2], 0, 6, 5, 5, 9),
  ],
  // 8 lỗ · 5 mảnh — hai khay ba ô chạy song song
  9: [
    mk('hai khay dài · năm mảnh', [3, 3, 2], [2, 2, 2, 1, 1], 0, 7, 4, 6, 11),
    mk('hai khay dài · năm mảnh', [3, 3, 2], [2, 2, 2, 1, 1], 0, 8, 4, 6, 10),
    mk('bốn màu · năm mảnh', [2, 2, 2, 2], [2, 2, 2, 1, 1], 0, 7, 4, 6, 10),
  ],
  // ---------- KHÚC BOARD 6×6, Lv10..Lv20 ----------
  //
  // Chỉ thị: "board rộng hơn, thật nhiều chốt và khay để người chơi bí đi".
  //
  // ĐO TRƯỚC KHI CHỌN (`probe.test.ts`, 20 ứng viên mỗi cấu hình). Kết quả lật
  // ngược đúng cái trực giác tôi vào việc với:
  //
  //   6×6 · 4 khay BA ô  · 12 lỗ  →  0/5   giải được   ✗
  //   6×6 · 5 khay BA ô  · 13 lỗ  →  0/7   giải được   ✗
  //   6×6 · 6 khay HAI ô · 12 lỗ  → 10/15  giải được   ✓  (10..18 nước)
  //   6×6 · 7 khay HAI ô · 14 lỗ  →  5/9   giải được   ✓  (9..17 nước)
  //
  // Thứ giết màn KHÔNG phải số lỗ mà là KHAY BA Ô: nó bắt gom đủ ba chốt mới nổ,
  // nên tới lúc board đông thì chuỗi phụ thuộc dài quá và không lối nào đi lọt.
  // Khay HAI Ô thì thêm khay = thêm màu + thêm khối mà chuỗi vẫn ngắn — đó chính
  // là "nhiều khay nhiều chốt" mà vẫn chơi được. Mảnh MỘT CHỐT giữ vai trò cũ:
  // luồn được vào mọi ô trống nên board không đông cứng.
  //
  // ---- SỬA LẠI: Ô TRỐNG 2..3, KHÔNG PHẢI 8..12 ----
  //
  // Chỉ thị mới: "giới hạn ô trống chỉ từ 1-3, để level khít và khó hơn". Ghi chú
  // cũ ở ngay trên kết luận ngược lại ("dưới 8 ô trống là bế tắc"), và ghi chú đó
  // SAI — nhưng sai một cách có ích, vì nó chỉ đúng cho ĐÚNG cái nó đã đo.
  //
  // Đo lại (`probe-tight.test.ts`), lần này với mảnh MỘT CHỐT:
  //
  //   4×4 · 6 lỗ · 6 mảnh MỘT chốt   · trống 2 → 32/486 giải được  (6..10 nước)
  //   4×4 · 6 lỗ · mảnh 2+2+1+1      · trống 3 → 104/728 giải được (4..8  nước)
  //   4×5 · 8 lỗ · mảnh 2+2+1+1+1+1  · trống 3 → 5/55   giải được  (8..12 nước)
  //   4×5 · 7 lỗ · 7 mảnh MỘT chốt   · trống 3 → 4/77   giải được  (7..13 nước)
  //
  // SÀN Ô TRỐNG KHÔNG PHẢI HẰNG SỐ — NÓ LÀ HÀM CỦA CỠ MẢNH. Mảnh một chốt cần đúng
  // MỘT ô trống để nhích; mảnh hai chốt trượt dọc trục cũng chỉ cần một. Mọi phép
  // đo dẫn tới con số "8 ô trống" đều chạy với mảnh 2 chốt trên 6×6, nên nó đo cỡ
  // mảnh chứ không đo ô trống. Board 2..3 ô trống toàn mảnh nhỏ là một bài trượt
  // kiểu 15-puzzle: chật nghẹt mà vẫn đi được, và lời giải DÀI HƠN board thoáng.
  //
  // Board cũng tự mở dần: khay nổ là trả lại ô. Chật nhất ở nước đầu, nhẹ dần về
  // sau — đúng hình dạng ta muốn.
  //
  // Board thu nhỏ lại theo (4×5 → 5×5 → 4×6 → 5×6) chứ không giữ 6×6: 6×6 mà chỉ
  // 3 ô trống thì phải nhét 33 ô khay+chốt, vượt xa chỗ bộ dựng đặt nổi.
  //
  // Mọi màn ở đây chạy `dense`: nhiều mảnh một chốt làm không gian state phình to
  // dù board chật, và BFS ngắn nhất tắc — đo được 0/5 ở 4×6, trong khi `dense` ra
  // 2/5. Hệ quả: `minMoves` là CHẶN TRÊN, không phải nước ngắn nhất.
  // Board 4×5 — 8 lỗ, 8 chốt, chỉ 2..3 ô trống
  10: [
    mk('bốn khay · sáu mảnh', [2, 2, 2, 2], [2, 2, 1, 1, 1, 1], 0, 3, 4, 5, 10),
    mk('bốn khay · bảy mảnh', [2, 2, 2, 2], [2, 1, 1, 1, 1, 1, 1], 0, 3, 4, 5, 10),
    mk('ba khay · sáu mảnh', [3, 2, 2], [2, 1, 1, 1, 1, 1], 0, 3, 4, 5, 9),
  ],
  11: [
    mk('bốn khay · sáu mảnh', [2, 2, 2, 2], [2, 2, 1, 1, 1, 1], 0, 2, 4, 5, 11),
    mk('bốn khay · bảy mảnh', [2, 2, 2, 2], [2, 1, 1, 1, 1, 1, 1], 0, 3, 4, 5, 10),
    mk('bốn khay · năm mảnh', [2, 2, 2, 2], [2, 2, 2, 1, 1], 0, 3, 4, 5, 10),
  ],
  // Board 5×5 — 10 lỗ
  12: [
    mk('năm khay · bảy mảnh', [2, 2, 2, 2, 2], [2, 2, 2, 1, 1, 1, 1], 0, 3, 5, 5, 11),
    mk('năm khay · tám mảnh', [2, 2, 2, 2, 2], [2, 2, 1, 1, 1, 1, 1, 1], 0, 3, 5, 5, 11),
    mk('bốn khay · bảy mảnh', [3, 2, 2, 2], [2, 2, 1, 1, 1, 1, 1], 0, 3, 5, 5, 10),
  ],
  13: [
    mk('năm khay · bảy mảnh', [2, 2, 2, 2, 2], [2, 2, 2, 1, 1, 1, 1], 0, 2, 5, 5, 12),
    mk('năm khay · tám mảnh', [2, 2, 2, 2, 2], [2, 2, 1, 1, 1, 1, 1, 1], 0, 3, 5, 5, 11),
    mk('năm khay · sáu mảnh', [2, 2, 2, 2, 2], [2, 2, 2, 2, 1, 1], 0, 3, 5, 5, 11),
  ],
  14: [
    mk('một khay dài · tám mảnh', [3, 2, 2, 2, 2], [2, 2, 2, 1, 1, 1, 1, 1], 0, 3, 5, 5, 12),
    mk('năm khay · bảy mảnh', [2, 2, 2, 2, 2], [2, 2, 2, 1, 1, 1, 1], 0, 3, 5, 5, 12),
    mk('năm khay · tám mảnh', [2, 2, 2, 2, 2], [2, 2, 1, 1, 1, 1, 1, 1], 0, 2, 5, 5, 11),
  ],
  // Board 4×6 — chữ nhật dẹt, đường đi một chiều hơn nên bí hơn
  15: [
    mk('năm khay · bảy mảnh', [2, 2, 2, 2, 2], [2, 2, 2, 1, 1, 1, 1], 0, 3, 4, 6, 12),
    mk('năm khay · sáu mảnh', [2, 2, 2, 2, 2], [2, 2, 2, 2, 1, 1], 0, 2, 4, 6, 12),
    mk('bốn khay · bảy mảnh', [3, 2, 2, 2], [2, 2, 1, 1, 1, 1, 1], 0, 3, 4, 6, 11),
  ],
  16: [
    mk('một khay dài · tám mảnh', [3, 2, 2, 2, 2], [2, 2, 2, 1, 1, 1, 1, 1], 0, 2, 4, 6, 13),
    mk('năm khay · tám mảnh', [2, 2, 2, 2, 2], [2, 2, 1, 1, 1, 1, 1, 1], 0, 3, 4, 6, 12),
    mk('năm khay · bảy mảnh', [2, 2, 2, 2, 2], [2, 2, 2, 1, 1, 1, 1], 0, 2, 4, 6, 12),
  ],
  // Board 5×6 — 12..14 lỗ, đông nhất khúc
  17: [
    mk('sáu khay · tám mảnh', [2, 2, 2, 2, 2, 2], [2, 2, 2, 2, 1, 1, 1, 1], 0, 3, 5, 6, 13),
    mk('sáu khay · chín mảnh', [2, 2, 2, 2, 2, 2], [2, 2, 2, 1, 1, 1, 1, 1, 1], 0, 3, 5, 6, 13),
    mk('năm khay · tám mảnh', [3, 2, 2, 2, 2], [2, 2, 2, 1, 1, 1, 1, 1], 0, 3, 5, 6, 12),
  ],
  18: [
    mk('sáu khay · tám mảnh', [2, 2, 2, 2, 2, 2], [2, 2, 2, 2, 1, 1, 1, 1], 0, 2, 5, 6, 14),
    mk('sáu khay · chín mảnh', [2, 2, 2, 2, 2, 2], [2, 2, 2, 1, 1, 1, 1, 1, 1], 0, 3, 5, 6, 13),
    mk('sáu khay · bảy mảnh', [2, 2, 2, 2, 2, 2], [2, 2, 2, 2, 2, 1, 1], 0, 3, 5, 6, 13),
  ],
  19: [
    mk('một khay dài · chín mảnh', [3, 2, 2, 2, 2, 2], [2, 2, 2, 2, 2, 1, 1, 1], 0, 3, 5, 6, 14),
    mk('sáu khay · tám mảnh', [2, 2, 2, 2, 2, 2], [2, 2, 2, 2, 1, 1, 1, 1], 0, 2, 5, 6, 14),
    mk('sáu khay · chín mảnh', [2, 2, 2, 2, 2, 2], [2, 2, 2, 1, 1, 1, 1, 1, 1], 0, 3, 5, 6, 13),
  ],
  20: [
    mk('bảy khay · mười mảnh', [2, 2, 2, 2, 2, 2, 2], [2, 2, 2, 2, 2, 1, 1, 1, 1, 1], 0, 2, 5, 6, 15),
    mk('bảy khay · tám mảnh', [2, 2, 2, 2, 2, 2, 2], [2, 2, 2, 2, 2, 2, 1, 1], 0, 3, 5, 6, 14),
    mk('sáu khay · chín mảnh', [2, 2, 2, 2, 2, 2], [2, 2, 2, 1, 1, 1, 1, 1, 1], 0, 3, 5, 6, 14),
  ],
};

/**
 * Ngân sách thời gian riêng cho khúc này. §5.3 cho sàn `minMoves×4000 + 20000`;
 * nhân 1.5 vì màn ở đây BẮT phải nhìn trước vài nước, mà đồng hồ sát nút thì biến
 * bài toán tư duy thành bài toán bấm nhanh. Không nhân đôi như Lv10+ của bản cũ:
 * còn để lại sức ép thì mới còn là màn khó.
 */
export const timeForHard = (minMoves: number, n: number): number =>
  Math.ceil(((minMoves * 4000 + 20000) * (n >= 10 ? 2 : 1.5)) / 5000) * 5000;

/**
 * Trần tìm kiếm — phải NẰM DƯỚI trần của `gen-solutions.test.ts` (16 nước /
 * 200k state). Màn nào ở đây lọt qua mà bộ sinh lời giải lại không tìm nổi lời
 * giải là hỏng cả bộ test, nên hai chỗ phải khớp nhau.
 */
const SOLVE_CAPS = { maxDepth: 16, maxStates: 150_000 } as const;


/**
 * Lọc RẺ đứng trước `solve`. Board đông cứng thì `solve` phải duyệt hàng chục nghìn
 * state mới dám kết luận — đo được 27 GIÂY cho một ứng viên, và ở cỡ 10 lỗ thì
 * gần như ứng viên nào cũng vậy. Hai câu hỏi dưới đây trả lời trong micro-giây và
 * loại đúng lô đó: bàn có nhúc nhích được không, và có nước cắm nào để mở màn không.
 */
function mobile(level: Level): boolean {
  const succ = successors(createState(level));
  return succ.length >= MIN_SUCC && succ.some((s) => s.seated > 0);
}

/**
 * Ngưỡng "còn nhúc nhích được", và nó PHẢI theo độ chật của màn.
 *
 * Ngưỡng 6 được hiệu chỉnh cho board 5..12 ô trống, nơi một board lành mạnh có
 * hàng chục nước đi hợp lệ. Ở board 2..3 ô trống thì cả bàn chỉ có vài nước — đó
 * là ĐẶC ĐIỂM của thể loại, không phải triệu chứng hỏng — nên giữ ngưỡng 6 là tự
 * tay loại sạch đúng những màn khít mà ta đang đi tìm.
 */
const MIN_SUCC = 2;

const layerCount = (lv: Level): number =>
  lv.pieces.reduce((s, p) => s + p.pegs.reduce((m, g) => m + g.layers.length, 0), 0);

/** Chỉ chạy khi gọi có chủ đích — cùng cổng với `gen-levels`. */
const ENABLED = import.meta.env.VITE_GEN === '1';
/** Màn cần dựng. Bắt buộc: mỗi tiến trình lo đúng một màn. */
const ONLY = Number(import.meta.env.VITE_ONLY ?? 0);
/** Ngân sách mili-giây cho vòng tìm ứng viên. */
const BUDGET_MS = Number(import.meta.env.VITE_BUDGET ?? 240_000);
/**
 * TRẦN số nước, để giữ ĐƯỜNG CONG khó tăng dần.
 *
 * Bộ tìm giữ bản DÀI NHẤT, mà độ dài thì tuỳ may rủi của lô ứng viên — lần chạy
 * đầu ra Lv5 12 nước trong khi Lv6..Lv8 chỉ 11, tức là màn mở khúc lại nặng hơn ba
 * màn sau nó. Đặt trần cho từng màn thì vẫn lấy bản dài nhất, nhưng chỉ trong số
 * bản không vượt trần. 0 = không giới hạn.
 */
const CEIL = Number(import.meta.env.VITE_CEIL ?? 0);
/**
 * Từ Lv10 board là 6×6 đông block, và ở cỡ đó BFS ngắn nhất VÔ DỤNG: đo được 0/12
 * ứng viên tìm ra lời giải, mỗi lần bỏ cuộc tốn tới 150 giây. Chuyển sang bộ tìm
 * ngẫu nhiên (`dense`) thì cùng lô ứng viên ấy ra 10/15 lời giải, ~2 giây một lần.
 * Đánh đổi: `minMoves` thành CHẶN TRÊN chứ không còn là nước ngắn nhất.
 */
const DENSE = ONLY >= 10;
const modeOpts = DENSE
  ? ({ dense: true, findAttempts: 60, seed: ONLY * 7919 + 13 } as const)
  : SOLVE_CAPS;

describe.runIf(ENABLED && ONLY >= 5 && ONLY <= 20)(`dựng lại Lv${ONLY}`, () => {
  it('đông block, board chật, lời giải dài', () => {
    const n = ONLY;
    const all = JSON.parse(readFileSync(LEVELS_FILE, 'utf8')) as Level[];
    const old = all[n - 1];
    const deadline = Date.now() + BUDGET_MS;
    const t0 = Date.now();

    const why = new Map<string, number>();
    const note = (r: string) => {
      const k = r.split(' —')[0].split(':')[0];
      why.set(k, (why.get(k) ?? 0) + 1);
    };

    // Giữ NHIỀU ứng viên rồi mới soi kỹ: bậc soi kỹ (`analyze`) dựng trọn đồ thị
    // state nên tốn hàng giây, không chạy được cho mọi ứng viên; mà bản dài nhất
    // lại hay là bản trượt bậc đó, nên phải có bản dự bị xếp sau.
    const pool: { level: Level; moves: number; plan: string }[] = [];
    let built = 0;
    let moved = 0;

    // NGÂN SÁCH CHIA ĐỀU cho từng phương án, không dùng chung một hạn chót.
    // Dùng chung thì phương án 0 — phương án tham nhất — ăn hết giờ và hai phương
    // án nới rộng phía sau KHÔNG BAO GIỜ chạy; đo được: Lv6 và Lv7 dựng 12k..18k
    // ứng viên toàn ở phương án 0 rồi về tay trắng, đúng lúc phương án 1 (thêm ô
    // trống) mới là thứ cứu được màn.
    const slice = Math.floor(BUDGET_MS / PLANS[n].length);
    for (const [vi, { rec, target }] of PLANS[n].entries()) {
      const rand = rng(n * 7919 + vi * 104729 + 13);
      const until = Math.min(deadline, Date.now() + slice);
      for (let attempt = 0; attempt < 200_000 && Date.now() < until; attempt++) {
        const lv = build(rec, rand, old.id, n);
        if (!lv) continue;
        built++;
        if (!mobile(lv)) {
          note('board đông cứng');
          continue;
        }
        moved++;
        const q = judge(lv, {
          needPlanning: true,
          minMovesAtLeast: target,
          quick: true,
          ...modeOpts,
        });
        if (!q.ok) {
          note(q.reasons[0]);
          continue;
        }
        pool.push({ level: lv, moves: q.minMoves, plan: rec.name });
      }
      // Phương án sau chỉ để cứu màn; đã đạt đích rồi thì không nới nữa.
      if (pool.some((c) => c.moves >= target)) break;
    }

    // Soi kỹ từ bản DÀI NHẤT xuống. Bậc này dựng trọn đồ thị state và bắt nhánh tự
    // thua sớm — luật không-Undo nên màn khó vẫn phải CÔNG BẰNG: không cú thả nào
    // trong hai nước đầu được phép biến màn thành không thắng nổi.
    const ranked = (CEIL > 0 ? pool.filter((c) => c.moves <= CEIL) : pool).sort(
      (a, b) => b.moves - a.moves,
    );
    let picked: { level: Level; moves: number; plan: string } | null = null;
    for (const cand of ranked.slice(0, 15)) {
      const v = judge(cand.level, {
        needPlanning: true,
        cap: 250_000,
        trapDepth: 2,
        ...modeOpts,
        // Bậc soi kỹ chạy nhiều lần thử hơn hẳn bậc lọc: ở đây thất bại bị tính là
        // "nhánh đầu tự thua" và loại màn, nên phải cho bộ tìm đủ cơ hội trước khi
        // kết tội.
        ...(DENSE ? { findAttempts: 200 } : {}),
      });
      if (!v.ok) {
        note(`SÂU ${v.reasons[0]}`);
        continue;
      }
      picked = { ...cand, moves: v.minMoves };
      break;
    }

    const top = [...why.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const dead = Object.entries(buildStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([k, v]) => `${k}×${v}`)
      .join(', ');
    const stats =
      `dựng ${built} · động ${moved} · ứng viên ${pool.length}` +
      `  [${top.map(([k, v]) => `${k}×${v}`).join(', ')}]` +
      `\nbộ dựng chết ở: ${dead}`;

    if (!picked) {
      // eslint-disable-next-line no-console -- đây là công cụ, báo cáo là đầu ra chính
      console.log(`Lv${n}: KHÔNG dựng được — ${stats} · ${Date.now() - t0}ms`);
      expect.fail(`Lv${n} không dựng được`);
    }

    const L = picked.level;
    L.chapter = old.chapter;
    L.difficulty = 'hard';
    L.minMoves = picked.moves;
    L.timeLimitMs = timeForHard(picked.moves, n);

    /**
     * GHI KÈM LỜI GIẢI, không để `gen-solutions` tự tìm lại.
     *
     * Ở chế độ `dense` lời giải do DFS ngẫu nhiên tìm ra; `gen-solutions` chạy BFS
     * ngắn nhất thì KHÔNG tìm nổi (0/12 ở cỡ này), nên màn vừa dựng xong sẽ lập tức
     * làm đỏ bộ test vì "thiếu lời giải". Ai tìm được thì người đó ghi lại.
     */
    const sol = DENSE
      ? findSolution(L, { attempts: 200, maxDepth: 26, seed: n * 7919 + 13 })
      : solve(L, SOLVE_CAPS);
    if (!sol || sol.moves.length !== picked.moves) {
      expect.fail(
        `Lv${n}: không dựng lại được lời giải đã thẩm (${sol?.moves.length ?? 'không có'} ≠ ${picked.moves})`,
      );
    }
    writeFileSync(
      outFor(n),
      `${JSON.stringify({ level: L, solution: sol.moves }, null, 2)}\n`,
      'utf8',
    );

    const occupied =
      L.holders.reduce((s, h) => s + h.cells.length, 0) +
      L.pieces.reduce((s, p) => s + p.pegs.length, 0);
    // eslint-disable-next-line no-console -- đây là công cụ, báo cáo là đầu ra chính
    console.log(
      `Lv${n}: ${picked.moves} nước · ${L.rows}×${L.cols} · ${(L.playable ?? []).length} ô` +
        ` · trống ${(L.playable ?? []).length - occupied} · ${L.holders.length} khay` +
        ` · mảnh ${L.pieces.map((p) => p.pegs.length).join('+')} · ${layerCount(L)} lớp` +
        ` · ${Math.round(L.timeLimitMs / 1000)}s · ${picked.plan}\n${stats} · ${Date.now() - t0}ms`,
    );
    expect(picked.moves).toBeGreaterThan(0);
  }, 1_800_000);
});
