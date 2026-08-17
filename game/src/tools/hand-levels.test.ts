/**
 * MÀN XẾP TAY — chép lại đúng bố cục chủ dự án gửi ảnh.
 *   $env:VITE_HAND='1'; npx vitest run src/tools/hand-levels.test.ts
 *
 * Khác hẳn `gen-hard`: ở đây bố cục là ĐỀ BÀI, không phải thứ đi tìm. Máy chỉ làm
 * hai việc — thẩm xem màn có chơi được không, và tính `minMoves` + ngân sách giờ.
 *
 * Vẫn phải qua `judge` như màn máy sinh: chép từ ảnh thì rất dễ lệch một ô, mà một
 * ô lệch đủ để màn thành vô nghiệm. Thẩm bằng engine là cách duy nhất biết được.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { createState } from '../core/engine';
import { findSolution, solve, successors, type Move } from '../core/solver';
import { deadPieces, initialFreeSeats, validateLevel } from '../core/validate';
import { enclosedHoles } from '../editor/model';
import { greedySolves, timeFor } from './design';
import { rng } from './build-level';
import type { Cell, Color, Level, PieceSpec, Shape } from '../types';

const LEVELS_FILE = new URL('../levels.data.json', import.meta.url);
const SOLUTIONS_FILE = new URL('../levels.solutions.json', import.meta.url);

// ---------- tiện ích dựng ----------

const holder = (id: string, color: Color, cells: Cell[], holes: Shape[]) => ({
  id,
  color,
  cells,
  holes,
});

/** Mảnh một lớp: mọi chốt cùng (màu × hình). */
const piece = (id: string, color: Color, shape: Shape, cells: Cell[]): PieceSpec => ({
  id,
  pegs: cells.map((cell, i) => ({ id: `${id}g${i + 1}`, cell, layers: [{ color, shape }] })),
});

/** Mảnh HAI LỚP (shape-in-shape): lớp trên rồi lớp dưới, mọi chốt như nhau. */
const stackPiece = (
  id: string,
  top: [Color, Shape],
  under: [Color, Shape],
  cells: Cell[],
): PieceSpec => ({
  id,
  pegs: cells.map((cell, i) => ({
    id: `${id}g${i + 1}`,
    cell,
    layers: [
      { color: top[0], shape: top[1] },
      { color: under[0], shape: under[1] },
    ],
  })),
});

/** Ô chơi được = cả lưới TRỪ danh sách khoét. */
function playableExcept(rows: number, cols: number, carved: Cell[]): Cell[] {
  const gone = new Set(carved.map((c) => `${c[0]},${c[1]}`));
  const out: Cell[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) if (!gone.has(`${r},${c}`)) out.push([r, c]);
  return out;
}

// ---------- Lv5 ----------
//
// Ảnh chủ dự án gửi: board 7×6, tường ăn vào thành BỐN VỊNH kiểu chong chóng —
// trên (2 ô sâu 2 hàng), trái và phải (2 ô ở hàng 3), dưới (2 ô ở hàng cuối).
//
// Bố cục là một bài ĐỔI CHỖ có chủ ý: khay xanh nằm góc trên TRÁI còn mảnh xanh
// nằm trên PHẢI, khay đỏ thì ngược lại. Hàng 1 bị vịnh trên cắt đôi nên hai mảnh
// chỉ đổi chỗ được qua hàng 2, mà hàng 2 lại đang bị hai mảnh vàng chắn giữa.
//
// Số học khớp chính xác, và đó là bằng chứng đọc ảnh đúng: 3 tim đỏ / 3 lỗ đỏ,
// 3 tròn xanh / 3 lỗ xanh, 4 vuông vàng / 4 lỗ vàng.
const LV5: Omit<Level, 'minMoves' | 'timeLimitMs'> = {
  id: 'lv_c1_05',
  name: 'Level 5',
  chapter: 1,
  difficulty: 'hard',
  rows: 7,
  cols: 6,
  playable: playableExcept(7, 6, [
    [0, 2], [0, 3], [1, 2], [1, 3], // vịnh TRÊN
    [3, 0], [3, 1], // vịnh TRÁI
    [3, 4], [3, 5], // vịnh PHẢI
    [6, 2], [6, 3], // vịnh DƯỚI
  ]),
  holders: [
    holder('k1', 'blue', [[0, 0], [0, 1]], ['circle', 'circle']),
    holder('k2', 'red', [[0, 4], [0, 5]], ['heart', 'heart']),
    holder('k3', 'yellow', [[5, 0], [6, 0]], ['square', 'square']),
    holder('k4', 'red', [[5, 1]], ['heart']),
    holder('k5', 'blue', [[5, 4]], ['circle']),
    holder('k6', 'yellow', [[5, 5], [6, 5]], ['square', 'square']),
  ],
  pieces: [
    piece('p1', 'red', 'heart', [[2, 0], [2, 1]]),
    piece('p2', 'blue', 'circle', [[2, 4], [2, 5]]),
    // hai mảnh đứng ở giữa: hai chốt vàng trên, một chốt màu khác dưới cùng
    {
      id: 'p3',
      pegs: [
        { id: 'p3g1', cell: [2, 2], layers: [{ color: 'yellow', shape: 'square' }] },
        { id: 'p3g2', cell: [3, 2], layers: [{ color: 'yellow', shape: 'square' }] },
        { id: 'p3g3', cell: [4, 2], layers: [{ color: 'red', shape: 'heart' }] },
      ],
    },
    {
      id: 'p4',
      pegs: [
        { id: 'p4g1', cell: [2, 3], layers: [{ color: 'yellow', shape: 'square' }] },
        { id: 'p4g2', cell: [3, 3], layers: [{ color: 'yellow', shape: 'square' }] },
        { id: 'p4g3', cell: [4, 3], layers: [{ color: 'blue', shape: 'circle' }] },
      ],
    },
  ],
  obstacles: [],
};

// ---------- Lv8 ----------
//
// Ảnh là ảnh chụp game GỐC, cỡ 285px nên đọc không chắc bằng Lv5. Chắc chắn được:
// board 8×4, khay xanh 2 lỗ tròn ở đỉnh, khay vàng 2 ô bên trái, khay đỏ 3 ô bên
// phải, khay vàng 2 ô dưới-phải, và HAI mảng TÍM 2×2 ở giữa.
//
// Chỗ không chắc: mảng tím nào là MẢNH, mảng nào là KHAY. Phép đếm lớp chỉ khớp
// theo đúng một cách — 4 chốt tím HAI LỚP (tím/cross rồi vàng/square):
//   lỗ  = 2 tròn + 3 tim + 4 cross + 4 vuông = 13
//   lớp = 2 tròn + 3 tim + 4×2 (tím rồi vàng) = 13   ✓
// Còn lại đúng hai khả năng, và không phân biệt nổi bằng mắt ở cỡ ảnh đó. Nên
// dựng CẢ HAI rồi để engine chọn: bản nào giải được thì bản đó là bản đúng.
const LV8_CARVED: Cell[] = [
  [0, 0], [0, 3], // đỉnh thu lại còn 2 ô giữa
  [3, 0], // vịnh TRÁI
  [4, 3], // vịnh PHẢI
  [7, 0], [7, 3], // đáy thu lại còn 2 ô giữa
];

const LV8_BASE = {
  id: 'lv_c1_08',
  name: 'Level 8',
  chapter: 1,
  difficulty: 'hard' as const,
  rows: 8,
  cols: 4,
  playable: playableExcept(8, 4, LV8_CARVED),
  obstacles: [],
};

/** Khay/mảnh dùng chung cho cả hai khả năng. */
const LV8_FIXED = {
  holders: [
    holder('k1', 'blue', [[0, 1], [0, 2]], ['circle', 'circle']),
    holder('k2', 'yellow', [[1, 0], [2, 0]], ['square', 'square']),
    holder('k3', 'red', [[1, 3], [2, 3], [3, 3]], ['heart', 'heart', 'heart']),
    holder('k6', 'yellow', [[5, 3], [6, 3]], ['square', 'square']),
  ],
  pieces: [
    piece('p1', 'blue', 'circle', [[4, 0]]),
    piece('p2', 'red', 'heart', [[5, 0], [6, 0]]),
    piece('p3', 'blue', 'circle', [[7, 1]]),
    piece('p4', 'red', 'heart', [[7, 2]]),
  ],
};

/**
 * Mảng tím 2×2 = HAI khay 2 ô. Hướng của chúng đổi hẳn bài toán, và mắt không đọc
 * ra được ở cỡ ảnh đó:
 *   · NGANG — khay hàng trên đầy thì NỔ NGAY, trả lại hai ô cho mảnh đi xuống tiếp.
 *   · DỌC   — mỗi khay cần một chốt ở hàng trên và một ở hàng dưới, mà hàng giữa
 *             lại là chính khay đó, nên nửa dưới không với tới được.
 */
const purpleHolders = (top: number, dir: 'ngang' | 'dọc'): Level['holders'] =>
  dir === 'ngang'
    ? [
        holder('k4', 'purple', [[top, 1], [top, 2]], ['cross', 'cross']),
        holder('k5', 'purple', [[top + 1, 1], [top + 1, 2]], ['cross', 'cross']),
      ]
    : [
        holder('k4', 'purple', [[top, 1], [top + 1, 1]], ['cross', 'cross']),
        holder('k5', 'purple', [[top, 2], [top + 1, 2]], ['cross', 'cross']),
      ];

const lv8 = (
  pieceTop: number,
  holderTop: number,
  dir: 'ngang' | 'dọc',
  carved: Cell[],
): Omit<Level, 'minMoves' | 'timeLimitMs'> => ({
  ...LV8_BASE,
  playable: playableExcept(8, 4, carved),
  holders: [...LV8_FIXED.holders, ...purpleHolders(holderTop, dir)],
  pieces: [
    ...LV8_FIXED.pieces,
    stackPiece('p5', ['purple', 'cross'], ['yellow', 'square'], [
      [pieceTop, 1], [pieceTop, 2], [pieceTop + 1, 1], [pieceTop + 1, 2],
    ]),
  ],
});

const CARVE_FULL: Cell[] = [[0, 0], [0, 3], [3, 0], [4, 3], [7, 0], [7, 3]];

/**
 * BẢN CHỐT, và ba chỗ mập mờ đều do ENGINE phân xử chứ không do tôi đoán. Đã dựng
 * sáu cách đọc rồi thẩm từng bản:
 *
 *   khay tím NGANG · có vịnh hông · mảnh trên   → 10 nước ✓   ← chọn bản này
 *   khay tím NGANG · có vịnh hông · mảnh dưới   → 10 nước ✓
 *   khay tím NGANG · không vịnh   · mảnh trên   → 10 nước ✓
 *   khay tím NGANG · không vịnh   · mảnh dưới   → 10 nước ✓
 *   khay tím DỌC   · mảnh trên                  → VÔ NGHIỆM ✗
 *   khay tím DỌC   · mảnh dưới                  → VÔ NGHIỆM ✗
 *
 * Khay DỌC chết vì hình học: mỗi khay dọc cần một chốt cắm từ hàng trên và một từ
 * hàng dưới, mà hàng chắn giữa lại là chính cái khay đó — nửa dưới không với tới
 * được. Khay NGANG thì khay hàng trên đầy là NỔ ngay, trả lại hai ô cho mảnh đi
 * xuống cắm nốt hàng dưới. Đó chính là nhịp của màn.
 *
 * Còn lại hai chỗ mắt không đọc nổi ở cỡ ảnh 285px, và engine chấp nhận cả hai:
 * mảng tím nào là mảnh, và board có hai vịnh hông hay không. Lấy theo ảnh: ảnh có
 * chỗ thắt ở hông (nên `CARVE_FULL`), và mảng tím TRÊN nhìn ra các viên rời có
 * thanh nối — dấu hiệu của mảnh. Đổi lại chỉ là đổi hai số trong `lv8(...)`.
 */
const LV8 = lv8(1, 5, 'ngang', CARVE_FULL);

// ---------- thẩm định ----------

// ---------- Lv9 ----------
//
// Ảnh 701px nên đọc chắc hơn hẳn Lv8: chốt LỒI (mặt cầu bắt sáng) và lỗ LÕM (lòng
// chảo đổ bóng vào trong) phân biệt được bằng mắt — bốn hình tròn xanh góc trên
// phải lồi rõ, còn mảng 2×2 xanh dưới trái lõm rõ.
//
// Board 9×5 nhưng cột 0 chỉ có hai ô: đúng cái mấu lồi ra bên trái trong ảnh, chỗ
// đặt khay xanh lá. Phần còn lại là khối chữ nhật 9×4 đặc.
//
// Số học khớp tuyệt đối, không cần đoán lớp như Lv8:
//   4 tròn xanh / 4 lỗ xanh · 2 tim đỏ / 2 lỗ đỏ · 2 vuông vàng / 2 lỗ vàng
//   · 2 thoi lá / 2 lỗ lá   ⇒ 10 chốt một lớp, 10 lỗ.
const LV9_CARVED: Cell[] = [[0, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0]];

/** Mảng 2×2 tách thành hai khay/mảnh 2 ô — hướng đọc không ra, để engine phân xử. */
const pairCells = (top: number, left: number, dir: 'ngang' | 'dọc'): [Cell[], Cell[]] =>
  dir === 'ngang'
    ? [[[top, left], [top, left + 1]], [[top + 1, left], [top + 1, left + 1]]]
    : [[[top, left], [top + 1, left]], [[top, left + 1], [top + 1, left + 1]]];

const lv9 = (
  blueHolderDir: 'ngang' | 'dọc',
  bluePiece: 'một khối' | 'ngang' | 'dọc',
): Omit<Level, 'minMoves' | 'timeLimitMs'> => {
  const [hA, hB] = pairCells(6, 1, blueHolderDir);
  const bluePegs: Cell[] = [[0, 3], [0, 4], [1, 3], [1, 4]];
  const [pA, pB] = pairCells(0, 3, bluePiece === 'một khối' ? 'ngang' : bluePiece);
  return {
    id: 'lv_c2_09',
    name: 'Level 9',
    chapter: 2,
    difficulty: 'hard',
    rows: 9,
    cols: 5,
    playable: playableExcept(9, 5, LV9_CARVED),
    holders: [
      holder('k1', 'green', [[1, 0], [2, 0]], ['diamond', 'diamond']),
      holder('k2', 'red', [[0, 2], [1, 2]], ['heart', 'heart']),
      holder('k3', 'yellow', [[4, 1], [4, 2]], ['square', 'square']),
      holder('k4', 'blue', hA, ['circle', 'circle']),
      holder('k5', 'blue', hB, ['circle', 'circle']),
    ],
    pieces: [
      ...(bluePiece === 'một khối'
        ? [piece('p1', 'blue', 'circle', bluePegs)]
        : [piece('p1', 'blue', 'circle', pA), piece('p2', 'blue', 'circle', pB)]),
      // mảnh chữ L: tim đỏ trên, hai vuông vàng dưới
      {
        id: 'p3',
        pegs: [
          { id: 'p3g1', cell: [2, 4] as Cell, layers: [{ color: 'red' as Color, shape: 'heart' as Shape }] },
          { id: 'p3g2', cell: [3, 4] as Cell, layers: [{ color: 'yellow' as Color, shape: 'square' as Shape }] },
          { id: 'p3g3', cell: [3, 3] as Cell, layers: [{ color: 'yellow' as Color, shape: 'square' as Shape }] },
        ],
      },
      // mảnh đứng: tim đỏ trên, hai thoi xanh lá dưới
      {
        id: 'p4',
        pegs: [
          { id: 'p4g1', cell: [6, 4] as Cell, layers: [{ color: 'red' as Color, shape: 'heart' as Shape }] },
          { id: 'p4g2', cell: [7, 4] as Cell, layers: [{ color: 'green' as Color, shape: 'diamond' as Shape }] },
          { id: 'p4g3', cell: [8, 4] as Cell, layers: [{ color: 'green' as Color, shape: 'diamond' as Shape }] },
        ],
      },
    ],
    obstacles: [],
  };
};

// ---------- Lv10 ----------
//
// Board 10×4 ĐẶC, không khoét ô nào — ảnh là hình chữ nhật bo góc trơn.
//
// Bố cục ép THỨ TỰ chặt nhất trong ba màn xếp tay, và ép bằng hình chứ không bằng
// mẹo: hàng 2 (đỏ + vàng) và hàng 4 (tím + xanh) mỗi hàng là HAI khay phủ kín cả
// bốn cột. Khay là khối đặc, nên board bị cắt thành ba băng không thông nhau:
//
//     hàng 0    khay xanh lá 4 lỗ      ← đích cuối
//     hàng 1    trống
//     hàng 2    ███ khay đỏ + vàng ███
//     hàng 3    trống
//     hàng 4    ███ khay tím + xanh ███
//     hàng 5..9 mọi mảnh nằm ở đây
//
// Mảnh nào cũng khởi đầu ở băng dưới cùng, nên đường đi duy nhất là: cắm tím và
// xanh cho hàng 4 NỔ → mở lối lên băng giữa → cắm đỏ và vàng cho hàng 2 nổ → khối
// xanh lá bốn chốt mới lên tới hàng 1 được. Khối bốn chốt chiếm trọn bề rộng nên
// nó chỉ đi dọc — không có đường vòng nào khác.
//
// Đếm khớp: 4 thoi lá · 2 tim đỏ · 2 vuông vàng · 2 cross tím · 2 tròn xanh
//           = 12 lỗ = 12 chốt, tất cả một lớp.
const LV10: Omit<Level, 'minMoves' | 'timeLimitMs'> = {
  id: 'lv_c2_10',
  name: 'Level 10',
  chapter: 2,
  difficulty: 'hard',
  rows: 10,
  cols: 4,
  playable: playableExcept(10, 4, []),
  holders: [
    holder('k1', 'green', [[0, 0], [0, 1], [0, 2], [0, 3]], ['diamond', 'diamond', 'diamond', 'diamond']),
    holder('k2', 'red', [[2, 0], [2, 1]], ['heart', 'heart']),
    holder('k3', 'yellow', [[2, 2], [2, 3]], ['square', 'square']),
    holder('k4', 'purple', [[4, 0], [4, 1]], ['cross', 'cross']),
    holder('k5', 'blue', [[4, 2], [4, 3]], ['circle', 'circle']),
  ],
  pieces: [
    piece('p1', 'purple', 'cross', [[6, 1], [6, 2]]),
    piece('p2', 'blue', 'circle', [[7, 2], [7, 3]]),
    piece('p3', 'red', 'heart', [[8, 0], [8, 1]]),
    piece('p4', 'yellow', 'square', [[8, 2], [8, 3]]),
    piece('p5', 'green', 'diamond', [[9, 0], [9, 1], [9, 2], [9, 3]]),
  ],
  obstacles: [],
};

// ---------- Lv12..Lv14: xếp theo VỐN TỪ của bốn màn ảnh ----------
//
// Không có ảnh mẫu cho ba màn này. Chỉ thị: dựng "dựa vào những level đã cung cấp".
// Bốn màn chép từ ảnh cho ta ba cơ chế rõ rệt, mỗi màn dưới đây lấy MỘT cái rồi
// đẩy thêm một nấc — không trộn cả ba vào một màn, vì trộn thì màn nào cũng thành
// một mớ giống nhau, đúng cái lỗi bộ sinh máy đã mắc.
//
//   Lv10 → HÀNG KHAY CHẮN NGANG cắt board thành băng, ép thứ tự nổ.
//   Lv8  → LỒNG NHAU: chốt hai lớp, cắm lớp trên rồi mới lộ lớp dưới.
//   Lv5  → ĐỔI CHỖ: khay nằm ngược phía với mảnh cùng màu, tường cắt lối đi.

/**
 * Lv12 · BA TẦNG KHOÁ NHAU — 9×4 đặc, nối tiếp Lv10.
 *
 * Lv10 có hai hàng chắn; đây ba hàng, và khúc dưới CHẬT hẳn: 12 ô trống mà 8 ô
 * nằm ở hai băng bị niêm phong (hàng 1 và hàng 3), nên lúc mở màn chỉ có ĐÚNG
 * hàng 5 là bốn ô để xoay xở. Bốn mảnh dưới phải nhường chỗ cho nhau mới lên
 * được, mà nhường sai thứ tự là tự nhốt.
 *
 *   r0  ████ khay xanh lá 4 lỗ ████   ← đích cuối
 *   r2  ██ tím ██ | ██ xanh dương ██
 *   r4  ██ đỏ ██  | ██ vàng ██
 *   r6..r8  mọi mảnh nằm ở đây
 */
const LV12: Omit<Level, 'minMoves' | 'timeLimitMs'> = {
  id: 'lv_c2_12',
  name: 'Level 12',
  chapter: 2,
  difficulty: 'hard',
  rows: 9,
  cols: 4,
  playable: playableExcept(9, 4, []),
  holders: [
    holder('k1', 'green', [[0, 0], [0, 1], [0, 2], [0, 3]], ['diamond', 'diamond', 'diamond', 'diamond']),
    holder('k2', 'purple', [[2, 0], [2, 1]], ['cross', 'cross']),
    holder('k3', 'blue', [[2, 2], [2, 3]], ['circle', 'circle']),
    holder('k4', 'red', [[4, 0], [4, 1]], ['heart', 'heart']),
    holder('k5', 'yellow', [[4, 2], [4, 3]], ['square', 'square']),
  ],
  pieces: [
    piece('p1', 'purple', 'cross', [[6, 0], [6, 1]]),
    piece('p2', 'blue', 'circle', [[6, 2], [6, 3]]),
    piece('p3', 'red', 'heart', [[7, 0], [7, 1]]),
    piece('p4', 'yellow', 'square', [[7, 2], [7, 3]]),
    piece('p5', 'green', 'diamond', [[8, 0], [8, 1], [8, 2], [8, 3]]),
  ],
  obstacles: [],
};

/**
 * Lv13 · LỒNG NHAU — 9×5, nối tiếp Lv8.
 *
 * Khối 2×2 gồm bốn chốt HAI LỚP: tím/cross ở trên, thoi lá ở dưới. Hai khay tím
 * nằm giữa board, hai khay lá nằm ở HAI ĐẦU (hàng 0 và hàng 8).
 *
 * Chỗ hiểm nằm ngay dưới chân khối: hai lỗ lá của hàng 8 kề sát khối ngay từ đầu,
 * mà chừng nào lớp tím chưa bóc thì chúng vô dụng. Người chơi phải kéo khối ĐI XA
 * lên giữa board để cắm tím trước, rồi mới quay lại — đúng cái nhịp "cắm hai lần
 * ở hai chỗ khác nhau" mà Lv8 giới thiệu, nhưng quãng đường dài hơn hẳn.
 */
const LV13: Omit<Level, 'minMoves' | 'timeLimitMs'> = {
  id: 'lv_c2_13',
  name: 'Level 13',
  chapter: 2,
  difficulty: 'hard',
  rows: 9,
  cols: 5,
  playable: playableExcept(9, 5, [[0, 0], [0, 4], [8, 0], [8, 4]]),
  holders: [
    holder('k1', 'green', [[0, 1], [0, 2]], ['diamond', 'diamond']),
    holder('k2', 'purple', [[2, 1], [2, 2]], ['cross', 'cross']),
    holder('k3', 'purple', [[3, 1], [3, 2]], ['cross', 'cross']),
    holder('k4', 'red', [[5, 0], [6, 0]], ['heart', 'heart']),
    holder('k5', 'blue', [[5, 4], [6, 4]], ['circle', 'circle']),
    holder('k6', 'green', [[8, 1], [8, 2]], ['diamond', 'diamond']),
  ],
  pieces: [
    stackPiece('p1', ['purple', 'cross'], ['green', 'diamond'], [
      [6, 1], [6, 2], [7, 1], [7, 2],
    ]),
    piece('p2', 'blue', 'circle', [[1, 2], [1, 3]]),
    piece('p3', 'red', 'heart', [[4, 2], [4, 3]]),
  ],
  obstacles: [],
};

/**
 * Lv14 · ĐỔI CHỖ BỐN GÓC — 8×6 chong chóng, nối tiếp Lv5.
 *
 * Cùng bộ xương với Lv5 — bốn vịnh chong chóng, khay nằm ngược phía với mảnh cùng
 * màu — nhưng board rộng hơn và có thêm HAI mảnh đứng ba chốt hai màu chắn ngay
 * giữa. Mảnh đỏ ở góc trên TRÁI phải sang phải, mảnh xanh dương trên PHẢI phải
 * sang trái, mà hành lang giữa lại đang bị hai khối dọc đó bịt.
 *
 * Hai khối dọc ấy tự chúng là một bài con: chốt cuối của chúng (đỏ, xanh dương)
 * phải cắm vào hai khay MỘT LỖ nằm sát vịnh, cắm xong khối mới rút ngắn còn hai
 * chốt và mới luồn đi tiếp được.
 */
const LV14: Omit<Level, 'minMoves' | 'timeLimitMs'> = {
  id: 'lv_c2_14',
  name: 'Level 14',
  chapter: 2,
  difficulty: 'hard',
  rows: 8,
  cols: 6,
  playable: playableExcept(8, 6, [
    [0, 2], [0, 3], // vịnh TRÊN
    [7, 2], [7, 3], // vịnh DƯỚI
    [3, 0], [3, 1], // vịnh TRÁI
    [4, 4], [4, 5], // vịnh PHẢI
  ]),
  holders: [
    holder('k1', 'blue', [[0, 0], [0, 1]], ['circle', 'circle']),
    holder('k2', 'red', [[0, 4], [0, 5]], ['heart', 'heart']),
    holder('k3', 'yellow', [[7, 0], [7, 1]], ['square', 'square']),
    holder('k4', 'green', [[7, 4], [7, 5]], ['diamond', 'diamond']),
    holder('k5', 'red', [[4, 0]], ['heart']),
    holder('k6', 'blue', [[3, 5]], ['circle']),
  ],
  pieces: [
    piece('p1', 'red', 'heart', [[1, 0], [1, 1]]),
    piece('p2', 'blue', 'circle', [[1, 4], [1, 5]]),
    // Chốt đỏ ở ĐẦU TRÊN, không phải đầu dưới như mảnh xanh lá bên cạnh.
    //
    // Bản đầu để đỏ ở dưới và engine báo VÔ NGHIỆM. Lý do đáng ghi lại: khay đỏ một
    // lỗ ở (4,0) chỉ nhận chốt đứng ở (4,1) hoặc (5,0), mà mảnh dọc ba chốt với đỏ
    // ở đáy thì hai chốt vàng phải nằm ở (2,1),(3,1) — (3,1) là vịnh trái, khoét
    // mất rồi. Đảo đầu là hai chốt vàng rơi xuống (5,1),(6,1), cả hai đều trống.
    // Đây đúng loại lỗi mắt người không bắt được mà engine bắt trong một giây.
    {
      id: 'p3',
      pegs: [
        { id: 'p3g1', cell: [2, 2], layers: [{ color: 'red', shape: 'heart' }] },
        { id: 'p3g2', cell: [3, 2], layers: [{ color: 'yellow', shape: 'square' }] },
        { id: 'p3g3', cell: [4, 2], layers: [{ color: 'yellow', shape: 'square' }] },
      ],
    },
    {
      id: 'p4',
      pegs: [
        { id: 'p4g1', cell: [2, 3], layers: [{ color: 'green', shape: 'diamond' }] },
        { id: 'p4g2', cell: [3, 3], layers: [{ color: 'green', shape: 'diamond' }] },
        { id: 'p4g3', cell: [4, 3], layers: [{ color: 'blue', shape: 'circle' }] },
      ],
    },
  ],
  obstacles: [],
};

// ---------- Lv15..Lv20: BOARD CHẬT, 5..6 ô trống ----------
//
// Chỉ thị: "ít chỗ trống hơn, chỉ trống tầm 5 tới 6 ô". Ba màn 12..14 đang trống
// 12..21 ô, nên đây là siết hơn gấp đôi.
//
// Ở mật độ đó CHỖ ĐẶT MẢNH quyết định màn sống hay chết, và mắt người đoán rất tệ:
// chỉ cần một mảnh nằm lệch một ô là cả board đông cứng, không nước đi nào hợp lệ.
// Nên chia đôi việc — phần NHÌN RA TAY NGƯỜI đặt bằng tay, phần dò để máy làm:
//
//   · Bộ xương KHAY xếp tay: vị trí, hướng, màu, cỡ. Đây là thứ tạo ra bố cục có
//     chủ ý — khay bám mép, đối xứng, khay dài chắn ngang — đúng ngôn ngữ hình của
//     bốn màn chép từ ảnh.
//   · Chỗ đặt MẢNH để máy rải ngẫu nhiên rồi lọc bằng engine thật.
//
// Số ô trống KHÔNG phải thứ đi dò: nó bằng `ô chơi được − ô khay − ô chốt`, mà cả
// ba đều do bộ xương ấn định. Chọn cỡ board theo công thức `playable = 2×số lỗ + 6`
// là ra đúng 6 ô trống, không cần chỉnh.

/**
 * Khuôn một mảnh: các ô LỆCH so với ô neo, kèm CHỒNG LỚP của từng ô.
 *
 * Mỗi ô là một mảng lớp chứ không phải một cặp (màu × hình): đó là chỗ chứa cả ba
 * thứ game có — mảnh một màu, mảnh ĐA-LOẠI (mỗi chốt một màu khác), và chốt NHIỀU
 * LỚP (cắm xong lộ ra màu/hình mới, phải cắm tiếp ở chỗ khác).
 */
interface Tmpl {
  id: string;
  cells: Cell[];
  /** stacks[i] = chồng lớp của cells[i]; phần tử [0] nằm TRÊN CÙNG */
  stacks: [Color, Shape][][];
  /**
   * Mảnh này nằm TRONG BĂNG — mọi ô của nó phải rơi trọn vào ô băng.
   *
   * Đây mới là chỗ đáng chơi của cơ chế: quân bị đóng băng là quân bạn CẦN, mà
   * muốn lấy thì phải nổ đủ số khay bằng quân đang tự do trước đã.
   */
  onIce?: boolean;
}

/** Mảnh MỘT màu một hình. */
const tmpl = (id: string, cells: Cell[], color: Color, shape: Shape): Tmpl => ({
  id,
  cells,
  stacks: cells.map(() => [[color, shape]]),
});

/** Mảnh ĐA-LOẠI: mỗi chốt một (màu × hình) riêng. Cắm được chốt nào là mảnh đứt ra. */
const tmplMix = (id: string, cells: Cell[], faces: [Color, Shape][]): Tmpl => ({
  id,
  cells,
  stacks: faces.map((f) => [f]),
});

/** Đánh dấu một khuôn là NẰM TRONG BĂNG. */
const onIce = (t: Tmpl): Tmpl => ({ ...t, onIce: true });

/** Mảnh NHIỀU LỚP: mọi chốt cùng một chồng, bóc dần từ lớp [0]. */
const tmplDeep = (id: string, cells: Cell[], stack: [Color, Shape][]): Tmpl => ({
  id,
  cells,
  stacks: cells.map(() => stack),
});

/** Hình mảnh hay dùng — chỉ 1..3 chốt. Khối cứng to hơn thì board 6 ô trống chết cứng. */
const H2: Cell[] = [[0, 0], [0, 1]]; // nằm ngang
const V2: Cell[] = [[0, 0], [1, 0]]; // dựng đứng
const S1: Cell[] = [[0, 0]]; // một chốt
// KHONG dung manh 3 chot o khuc nay. Do duoc: bon bo xuong dau tien deu co manh
// H3 tren board 4 cot va ca bon deu VO NGHIEM sau hang nghin lan rai — manh 3 chot
// can 3 o lien nhau cung hang, ma board 6 o trong thi gan nhu khong bao gio co.

interface TightSpec {
  id: string;
  n: number;
  rows: number;
  cols: number;
  carved: Cell[];
  holders: Level['holders'];
  tmpls: Tmpl[];
  /** ghi chú ý đồ, in ra báo cáo */
  idea: string;
  /**
   * Màn có chốt NHIỀU LỚP cần bộ dò khoẻ hơn hẳn. Một chốt ba lớp phải cắm ở ba nơi
   * khác nhau, nên lời giải dài gấp rưỡi và thứ tự bị ép chặt — dò 40 lượt/ứng viên
   * thì 0/86 bản tìm ra đường, dù màn không hề sai luật (engine cho phép một chốt
   * cắm nhiều lớp trong cùng một nước nếu đứng cạnh đủ các lỗ).
   */
  deep?: boolean;
  /**
   * BĂNG (`ice`) — xem R-ICE. Ba điều phải nắm, vì cả ba định hình cách dựng màn:
   *   · Băng CHẶN ĐƯỜNG ĐI như khay, nhưng KHÔNG chặn phép cắm: chốt đứng cạnh lỗ
   *     vẫn cắm được dù bên kia là băng.
   *   · Mỗi lần MỘT KHAY NỔ thì mọi tảng băng chưa tan đều giảm 1. Băng `count = 3`
   *     nghĩa là "mở sau khi nổ được ba khay" — một cái cổng hẹn giờ, mà đồng hồ của
   *     nó chính là tiến độ người chơi.
   *   · `count` phải nằm trong 1..số khay (§8.5), và phải nhỏ hơn số khay NỔ ĐƯỢC
   *     mà không cần đi qua băng — không thì màn tự khoá.
   */
  obstacles?: Level['obstacles'];
}

const k = (c: Cell) => `${c[0]},${c[1]}`;

/** Rải mảnh vào ô còn trống. Trả null nếu có khuôn không còn chỗ nào đặt vừa. */
function placeAll(spec: TightSpec, playable: Cell[], rand: () => number): PieceSpec[] | null {
  const free = new Set(playable.map(k));
  /** ô khay → (màu × hình) của lỗ ở đó */
  const hole = new Map<string, string>();
  for (const h of spec.holders)
    h.cells.forEach((c, i) => {
      free.delete(k(c));
      hole.set(k(c), `${h.color}/${h.holes[i]}`);
    });

  /**
   * KHÔNG đặt chốt kề lỗ khớp — luật §5 "không cắm được ngay từ đầu".
   *
   * Phép kiểm này phải nằm ở BƯỚC ĐẶT chứ không để `judge` loại về sau. Board khúc
   * này dày khay tới mức rải ngẫu nhiên là gần như chắc chắn có một chốt rơi cạnh
   * lỗ khớp: đo ở Lv29 được 1270/1346 ứng viên chết đúng vì lý do đó, tức là 94%
   * ngân sách dò bị đốt vào những bản không bao giờ dùng được.
   */
  const seatsNow = (cell: Cell, top: [Color, Shape]) => {
    const want = `${top[0]}/${top[1]}`;
    const [r, c] = cell;
    return ([[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]] as Cell[]).some(
      (nb) => hole.get(k(nb)) === want,
    );
  };

  // Ô BĂNG vẫn nằm trong `free`: mảnh được đánh dấu `onIce` phải đặt VÀO đó.
  // Ô tường/cửa cuốn thì không.
  const iceSet = new Set<string>();
  for (const ob of spec.obstacles ?? []) {
    if (ob.kind === 'ice') for (const c of ob.cells) iceSet.add(k(c));
    else if (ob.kind !== 'park') for (const c of ob.cells) free.delete(k(c));
  }

  const out: PieceSpec[] = [];
  for (const t of spec.tmpls) {
    const spots: Cell[] = [];
    for (const a of playable) {
      const cells = t.cells.map(([dr, dc]) => [a[0] + dr, a[1] + dc] as Cell);
      if (!cells.every((c) => free.has(k(c)))) continue;
      // Mảnh trong băng phải nằm TRỌN trong băng; mảnh thường phải nằm HẲN ngoài.
      // Nửa trong nửa ngoài là trạng thái vô nghĩa: mảnh là khối cứng, một chốt bị
      // đóng băng thì cả mảnh bất động, mà nhìn thì tưởng đi được.
      const inIce = cells.filter((c) => iceSet.has(k(c))).length;
      if (t.onIce ? inIce !== cells.length : inIce !== 0) continue;
      if (cells.some((c, i) => seatsNow(c, t.stacks[i][0]))) continue;
      spots.push(a);
    }
    if (spots.length === 0) return null;
    const a = spots[Math.floor(rand() * spots.length)];
    const cells = t.cells.map(([dr, dc]) => [a[0] + dr, a[1] + dc] as Cell);
    for (const c of cells) free.delete(k(c));
    out.push({
      id: t.id,
      pegs: cells.map((cell, i) => ({
        id: `${t.id}g${i + 1}`,
        cell,
        layers: t.stacks[i].map(([c, sh]) => ({ color: c, shape: sh })),
      })),
    });
  }
  return out;
}

/** Đếm (màu × hình) của lỗ và của chốt — lệch một cái là màn không bao giờ xong. */
function tally(spec: TightSpec): string | null {
  const bag = new Map<string, number>();
  for (const h of spec.holders)
    h.holes.forEach((s) => bag.set(`${h.color}/${s}`, (bag.get(`${h.color}/${s}`) ?? 0) + 1));
  for (const t of spec.tmpls)
    for (const stack of t.stacks)
      for (const [c, s] of stack) bag.set(`${c}/${s}`, (bag.get(`${c}/${s}`) ?? 0) - 1);
  const bad = [...bag.entries()].filter(([, v]) => v !== 0);
  return bad.length ? bad.map(([kk, v]) => `${kk} lệch ${v}`).join(', ') : null;
}

interface Checked {
  level: Level;
  solution: Move[];
  note: string;
}

/**
 * Ngân sách cho BFS ngắn nhất. Board tay xếp to hơn hẳn màn máy sinh khúc đầu, mà
 * BFS thì tắc ở đúng chỗ đã đo (§5.0b) — cho nó ngân sách vừa phải để TRƯỢT NHANH
 * rồi nhường cho bộ tìm ngẫu nhiên, thay vì đốt vài phút mỗi bản.
 */
const EXACT = { maxDepth: 16, maxStates: 60_000 } as const;

/**
 * `timeMs` chép thẳng từ đồng hồ trong ảnh gốc khi ảnh có HUD — chỉ thị là "y đúc",
 * mà đồng hồ cũng là một phần của màn. Không có thì lấy ngân sách §5.3.
 */
function check(
  base: Omit<Level, 'minMoves' | 'timeLimitMs'>,
  n: number,
  timeMs?: number,
  fast: boolean | 'sâu' = false,
): Checked | string {
  const draft = { ...base, minMoves: 0, timeLimitMs: 60_000 } as Level;

  const issues = validateLevel(draft);
  if (issues.length) return `${issues[0].rule}: ${issues[0].message}`;
  const shut = enclosedHoles(draft);
  if (shut.length) return `ô bỏ bị vây kín tại ${JSON.stringify(shut[0])}`;
  const dead = deadPieces(draft);
  if (dead.length) return `mảnh chết — ${dead[0]}`;
  const free = initialFreeSeats(draft);
  if (free.length) return `cắm được ngay từ đầu — ${free[0]}`;
  const first = successors(createState(draft));
  if (first.length === 0) return 'kẹt ngay nước đầu, không có nước đi nào';

  // BFS ngắn nhất trước; board tay xếp có thể quá đông cho nó, khi đó dùng bộ tìm
  // ngẫu nhiên (§5.0b) và `minMoves` thành CHẶN TRÊN.
  // `fast` BỎ HẲN bậc BFS. Đo được ở vòng dò Lv15..20: board chật thì `solve` quét
  // cạn 60k state mà vẫn không kết luận, ~1ms một state ⇒ tới 60 GIÂY cho MỘT ứng
  // viên. Vòng dò gọi `check` hàng nghìn lần nên nó ăn sạch ngân sách và cả tiếng
  // đồng hồ không xong nổi một màn. Vòng dò dùng `fast`, chỉ bản trúng tuyển mới
  // soi kỹ.
  const exact = fast ? null : solve(draft, EXACT);
  const sol =
    exact ??
    findSolution(draft, {
      attempts: fast === 'sâu' ? 400 : fast ? 40 : 600,
      maxDepth: fast === 'sâu' ? 36 : fast ? 22 : 30,
      seed: n * 7919 + 13,
    });
  if (!sol) return `không tìm được lời giải (${first.length} nước đầu)`;

  const moves = sol.moves.length;
  return {
    level: { ...draft, minMoves: moves, timeLimitMs: timeMs ?? timeFor(moves, n) },
    solution: sol.moves,
    note:
      `${moves} nước${exact ? '' : ' (chặn trên)'}` +
      ` · ${first.length} nước đầu` +
      ` · tham ${greedySolves(draft) ? 'THẮNG ⇒ dễ' : 'thua ⇒ phải tính'}`,
  };
}

/**
 * Sáu bộ xương khay. Mỗi màn một HÌNH KHÁC HẲN — bản trước chủ dự án chê bộ màn
 * máy sinh "bị một màu quá", mà cách chắc chắn nhất để rơi lại vào đó là copy một
 * bộ xương rồi chỉ đổi con số.
 *
 * Cỡ board chọn theo `ô chơi được = 2 × số lỗ + 6` ⇒ đúng 6 ô trống.
 */
const TIGHT: TightSpec[] = [
  {
    id: 'lv_c2_15', n: 15, rows: 6, cols: 5, carved: [],
    idea: 'hai chìa khoá tím ở hai mép — cắm tím thì khay nổ, board mới đủ chỗ đổi chỗ',
    holders: [
      holder('k1', 'red', [[0, 0], [0, 1]], ['heart', 'heart']),
      holder('k2', 'blue', [[0, 3], [0, 4]], ['circle', 'circle']),
      holder('k3', 'purple', [[2, 0], [3, 0]], ['cross', 'cross']),
      holder('k4', 'purple', [[2, 4], [3, 4]], ['cross', 'cross']),
      holder('k5', 'yellow', [[5, 0], [5, 1]], ['square', 'square']),
      holder('k6', 'green', [[5, 3], [5, 4]], ['diamond', 'diamond']),
    ],
    tmpls: [
      tmpl('p1', H2, 'red', 'heart'), tmpl('p2', H2, 'blue', 'circle'),
      tmpl('p3', H2, 'yellow', 'square'), tmpl('p4', H2, 'green', 'diamond'),
      tmpl('p5', V2, 'purple', 'cross'), tmpl('p6', V2, 'purple', 'cross'),
    ],
  },
  {
    id: 'lv_c2_16', n: 16, rows: 7, cols: 5, carved: [[0, 0], [0, 4], [6, 2]],
    idea: 'khay bám cả bốn mép, ruột board trống trơn — mảnh nào cũng phải ra rìa mới cắm được',
    holders: [
      holder('k1', 'red', [[0, 1], [0, 2]], ['heart', 'heart']),
      holder('k2', 'yellow', [[0, 3]], ['square']),
      holder('k3', 'purple', [[2, 0], [3, 0]], ['cross', 'cross']),
      holder('k4', 'blue', [[2, 4], [3, 4]], ['circle', 'circle']),
      holder('k5', 'green', [[4, 1], [4, 2]], ['diamond', 'diamond']),
      holder('k6', 'white', [[6, 0], [6, 1]], ['pentagon', 'pentagon']),
      holder('k7', 'orange', [[6, 3], [6, 4]], ['cross', 'cross']),
    ],
    tmpls: [
      tmpl('p1', H2, 'red', 'heart'), tmpl('p2', S1, 'yellow', 'square'),
      tmpl('p3', V2, 'purple', 'cross'), tmpl('p4', V2, 'blue', 'circle'),
      tmpl('p5', H2, 'green', 'diamond'), tmpl('p6', H2, 'white', 'pentagon'),
      tmpl('p7', H2, 'orange', 'cross'),
    ],
  },
  {
    id: 'lv_c2_17', n: 17, rows: 9, cols: 4, carved: [[0, 0], [8, 3]],
    idea: 'hai bờ — khay tím và xanh dựng đứng ép sát hai mép, hành lang giữa chỉ hai cột',
    holders: [
      holder('k1', 'red', [[0, 1], [0, 2]], ['heart', 'heart']),
      holder('k2', 'orange', [[0, 3]], ['diamond']),
      holder('k3', 'purple', [[2, 0], [3, 0]], ['cross', 'cross']),
      holder('k4', 'blue', [[2, 3], [3, 3]], ['circle', 'circle']),
      holder('k5', 'yellow', [[5, 0], [5, 1]], ['square', 'square']),
      holder('k6', 'green', [[5, 2], [5, 3]], ['diamond', 'diamond']),
      holder('k7', 'white', [[7, 0], [7, 1], [7, 2]], ['pentagon', 'pentagon', 'pentagon']),
    ],
    tmpls: [
      tmpl('p1', H2, 'red', 'heart'), tmpl('p2', S1, 'orange', 'diamond'),
      tmpl('p3', V2, 'purple', 'cross'), tmpl('p4', V2, 'blue', 'circle'),
      tmpl('p5', H2, 'yellow', 'square'), tmpl('p6', H2, 'green', 'diamond'),
      // Khay trắng ba lỗ nhưng mảnh trắng chỉ 2+1 chốt: board 4 cột mà 6 ô trống thì
      // mảnh ba chốt nằm ngang không bao giờ nhúc nhích được (đo ở bốn bộ xương đầu).
      tmpl('p7', H2, 'white', 'pentagon'), tmpl('p8', S1, 'white', 'pentagon'),
    ],
  },
  {
    id: 'lv_c2_18', n: 18, rows: 8, cols: 5, carved: [[0, 0], [0, 4], [7, 0], [7, 4]],
    idea: 'ba tầng chắn ngang nhưng CHỪA cột hở — khay không phủ kín bề rộng nữa',
    holders: [
      holder('k1', 'green', [[0, 1], [0, 2], [0, 3]], ['diamond', 'diamond', 'diamond']),
      holder('k2', 'red', [[2, 0], [2, 1]], ['heart', 'heart']),
      holder('k3', 'yellow', [[2, 3], [2, 4]], ['square', 'square']),
      holder('k4', 'purple', [[4, 0], [4, 1]], ['cross', 'cross']),
      holder('k5', 'blue', [[4, 3], [4, 4]], ['circle', 'circle']),
      holder('k6', 'white', [[7, 1], [7, 2], [7, 3]], ['pentagon', 'pentagon', 'pentagon']),
      holder('k7', 'orange', [[6, 0]], ['cross']),
    ],
    tmpls: [
      tmpl('p1', H2, 'green', 'diamond'), tmpl('p2', S1, 'green', 'diamond'),
      tmpl('p3', H2, 'red', 'heart'), tmpl('p4', H2, 'yellow', 'square'),
      tmpl('p5', H2, 'purple', 'cross'), tmpl('p6', H2, 'blue', 'circle'),
      tmpl('p7', H2, 'white', 'pentagon'), tmpl('p8', S1, 'white', 'pentagon'),
      tmpl('p9', S1, 'orange', 'cross'),
    ],
  },
  {
    id: 'lv_c2_19', n: 19, rows: 8, cols: 5, carved: [[0, 0], [7, 4]],
    idea: 'hai khay dựng đứng kẹp giữa, một lỗ hồng lẻ nằm giữa board làm chốt chặn',
    holders: [
      holder('k1', 'red', [[0, 1], [0, 2]], ['heart', 'heart']),
      holder('k2', 'yellow', [[0, 3], [0, 4]], ['square', 'square']),
      holder('k3', 'purple', [[2, 0], [3, 0]], ['cross', 'cross']),
      holder('k4', 'blue', [[2, 4], [3, 4]], ['circle', 'circle']),
      holder('k5', 'pink', [[3, 2]], ['circle']),
      holder('k6', 'green', [[5, 0], [5, 1]], ['diamond', 'diamond']),
      holder('k7', 'orange', [[5, 3], [5, 4]], ['diamond', 'diamond']),
      holder('k8', 'white', [[7, 0], [7, 1], [7, 2]], ['pentagon', 'pentagon', 'pentagon']),
    ],
    tmpls: [
      tmpl('p1', H2, 'red', 'heart'), tmpl('p2', H2, 'yellow', 'square'),
      tmpl('p3', V2, 'purple', 'cross'), tmpl('p4', V2, 'blue', 'circle'),
      tmpl('p5', S1, 'pink', 'circle'), tmpl('p6', H2, 'green', 'diamond'),
      tmpl('p7', H2, 'orange', 'diamond'), tmpl('p8', H2, 'white', 'pentagon'),
      tmpl('p9', S1, 'white', 'pentagon'),
    ],
  },
  {
    id: 'lv_c2_20', n: 20, rows: 8, cols: 5, carved: [],
    idea: 'cầu thang khe đôi — mỗi hàng khay chừa HAI ô liền nhau, so le trái/phải',
    // KHE PHẢI RỘNG HAI Ô. Hai bản trước để khe rộng một ô và cả hai VÔ NGHIỆM sau
    // 4000 lần rải: mảnh hai chốt nằm ngang muốn đổi hàng thì cần HAI ô liền nhau ở
    // hàng đích, nên khe một ô chỉ lọt mảnh một chốt — rows 1,3,5 bị cô lập hẳn.
    // Khe đôi so le trái/phải biến cả board thành một cầu thang đi được.
    holders: [
      holder('k1', 'green', [[0, 0], [0, 1], [0, 2]], ['diamond', 'diamond', 'diamond']),
      holder('k2', 'yellow', [[2, 2], [2, 3], [2, 4]], ['square', 'square', 'square']),
      holder('k3', 'purple', [[4, 0], [4, 1], [4, 2]], ['cross', 'cross', 'cross']),
      holder('k4', 'blue', [[6, 2], [6, 3], [6, 4]], ['circle', 'circle', 'circle']),
      holder('k5', 'white', [[7, 0], [7, 1], [7, 2]], ['pentagon', 'pentagon', 'pentagon']),
      // Hai lỗ cam nằm SAU khay xanh: chỉ với tới được sau khi xanh nổ ⇒ thứ tự bị ép.
      holder('k6', 'orange', [[7, 3], [7, 4]], ['diamond', 'diamond']),
    ],
    tmpls: [
      tmpl('p1', H2, 'green', 'diamond'), tmpl('p2', S1, 'green', 'diamond'),
      tmpl('p3', H2, 'yellow', 'square'), tmpl('p4', S1, 'yellow', 'square'),
      tmpl('p5', H2, 'purple', 'cross'), tmpl('p6', S1, 'purple', 'cross'),
      tmpl('p7', H2, 'blue', 'circle'), tmpl('p8', S1, 'blue', 'circle'),
      tmpl('p9', H2, 'white', 'pentagon'), tmpl('p10', S1, 'white', 'pentagon'),
      tmpl('p11', H2, 'orange', 'diamond'),
    ],
  },
  // ---------- Lv25..Lv30: HÌNH BOARD là đề bài ----------
  //
  // Chỉ thị: "nhiều ý tưởng hơn, board có nhiều hình dạng hay hơn, khó hơn rất
  // nhiều lần". Khúc 15..20 khó bằng MẬT ĐỘ — cùng một hình chữ nhật, chỉ bóp chỗ
  // trống. Khúc này khó bằng HÌNH: mỗi board là một bài toán giao thông riêng, và
  // mỗi màn thêm một cơ chế mà bộ màn xếp tay chưa dùng tới.
  {
    id: 'lv_c3_25', n: 25, rows: 7, cols: 7,
    carved: [
      [0, 0], [0, 1], [1, 0], [1, 1], [0, 5], [0, 6], [1, 5], [1, 6],
      [5, 0], [5, 1], [6, 0], [6, 1], [5, 5], [5, 6], [6, 5], [6, 6],
    ],
    idea: 'CHỮ THẬP — bốn nhánh cụt, khay nằm ở đầu mút, mọi thứ phải chui qua ruột 3×3',
    holders: [
      holder('k1', 'red', [[0, 2], [0, 3], [0, 4]], ['heart', 'heart', 'heart']),
      holder('k2', 'blue', [[6, 2], [6, 3], [6, 4]], ['circle', 'circle', 'circle']),
      holder('k3', 'green', [[2, 0], [3, 0], [4, 0]], ['diamond', 'diamond', 'diamond']),
      holder('k4', 'yellow', [[2, 6], [3, 6], [4, 6]], ['square', 'square', 'square']),
      holder('k5', 'purple', [[1, 3]], ['cross']),
      holder('k6', 'white', [[5, 3]], ['pentagon']),
    ],
    tmpls: [
      tmpl('p1', H2, 'red', 'heart'), tmpl('p2', S1, 'red', 'heart'),
      tmpl('p3', H2, 'blue', 'circle'), tmpl('p4', S1, 'blue', 'circle'),
      tmpl('p5', V2, 'green', 'diamond'), tmpl('p6', S1, 'green', 'diamond'),
      tmpl('p7', V2, 'yellow', 'square'), tmpl('p8', S1, 'yellow', 'square'),
      tmpl('p9', S1, 'purple', 'cross'), tmpl('p10', S1, 'white', 'pentagon'),
    ],
  },
  {
    id: 'lv_c3_26', n: 26, rows: 8, cols: 6,
    carved: [[3, 0], [3, 1], [3, 4], [3, 5], [4, 0], [4, 1], [4, 4], [4, 5]],
    idea: 'ĐỒNG HỒ CÁT — hai bầu rộng nối nhau bằng eo 2×2, mọi mảnh phải lách qua eo',
    holders: [
      holder('k1', 'red', [[0, 0], [0, 1]], ['heart', 'heart']),
      holder('k2', 'blue', [[0, 4], [0, 5]], ['circle', 'circle']),
      holder('k3', 'purple', [[2, 0], [2, 1]], ['cross', 'cross']),
      holder('k4', 'orange', [[2, 4], [2, 5]], ['diamond', 'diamond']),
      holder('k5', 'white', [[5, 0], [5, 1]], ['pentagon', 'pentagon']),
      holder('k6', 'pink', [[5, 3], [5, 4], [5, 5]], ['circle', 'circle', 'circle']),
      holder('k7', 'green', [[7, 0], [7, 1]], ['diamond', 'diamond']),
      holder('k8', 'yellow', [[7, 4], [7, 5]], ['square', 'square']),
    ],
    tmpls: [
      tmpl('p1', H2, 'red', 'heart'), tmpl('p2', H2, 'blue', 'circle'),
      tmpl('p3', H2, 'purple', 'cross'), tmpl('p4', H2, 'orange', 'diamond'),
      tmpl('p5', H2, 'white', 'pentagon'), tmpl('p6', H2, 'pink', 'circle'),
      tmpl('p7', S1, 'pink', 'circle'), tmpl('p8', H2, 'green', 'diamond'),
      tmpl('p9', H2, 'yellow', 'square'),
    ],
  },
  {
    id: 'lv_c3_27', n: 27, rows: 8, cols: 5,
    carved: [[0, 2], [1, 2], [2, 2], [5, 2], [6, 2], [7, 2]],
    idea: 'CHỮ H — hai tháp rời, chỉ nối nhau bằng cây cầu hai hàng ở giữa',
    holders: [
      holder('k1', 'red', [[0, 0], [0, 1]], ['heart', 'heart']),
      holder('k2', 'blue', [[0, 3], [0, 4]], ['circle', 'circle']),
      holder('k3', 'purple', [[2, 0], [2, 1]], ['cross', 'cross']),
      holder('k4', 'orange', [[2, 3], [2, 4]], ['diamond', 'diamond']),
      holder('k5', 'white', [[5, 0], [5, 1]], ['pentagon', 'pentagon']),
      holder('k6', 'green', [[7, 0], [7, 1]], ['diamond', 'diamond']),
      holder('k7', 'yellow', [[7, 3], [7, 4]], ['square', 'square']),
    ],
    tmpls: [
      tmpl('p1', H2, 'red', 'heart'), tmpl('p2', H2, 'blue', 'circle'),
      tmpl('p3', H2, 'purple', 'cross'), tmpl('p4', H2, 'orange', 'diamond'),
      tmpl('p5', H2, 'white', 'pentagon'), tmpl('p6', H2, 'green', 'diamond'),
      tmpl('p7', H2, 'yellow', 'square'),
    ],
  },
  {
    id: 'lv_c3_28', n: 28, rows: 8, cols: 6,
    carved: [[0, 4], [0, 5], [1, 5], [6, 0], [7, 0], [7, 1]],
    idea: 'BẬC THANG CHÉO — board vát hai góc đối nhau, đường đi lệch hẳn sang đường chéo',
    holders: [
      holder('k1', 'red', [[0, 0], [0, 1]], ['heart', 'heart']),
      holder('k2', 'yellow', [[0, 2], [0, 3]], ['square', 'square']),
      holder('k3', 'blue', [[2, 0], [2, 1]], ['circle', 'circle']),
      holder('k4', 'green', [[2, 4], [2, 5]], ['diamond', 'diamond']),
      holder('k5', 'purple', [[4, 0], [4, 1]], ['cross', 'cross']),
      holder('k6', 'orange', [[4, 4], [4, 5]], ['diamond', 'diamond']),
      holder('k7', 'red', [[6, 1], [6, 2]], ['heart', 'heart']),
      holder('k8', 'white', [[6, 4], [6, 5]], ['pentagon', 'pentagon']),
      holder('k9', 'pink', [[7, 4], [7, 5]], ['star', 'star']),
    ],
    tmpls: [
      tmpl('p1', H2, 'red', 'heart'), tmpl('p2', H2, 'red', 'heart'),
      tmpl('p3', H2, 'yellow', 'square'), tmpl('p4', H2, 'blue', 'circle'),
      tmpl('p5', H2, 'green', 'diamond'), tmpl('p6', H2, 'purple', 'cross'),
      tmpl('p7', H2, 'orange', 'diamond'), tmpl('p8', H2, 'white', 'pentagon'),
      tmpl('p9', H2, 'pink', 'star'),
    ],
  },
  {
    id: 'lv_c3_29', n: 29, rows: 7, cols: 6, carved: [[0, 0], [0, 5], [6, 0], [6, 5]],
    idea: 'BÁT GIÁC — vát bốn góc, chốt HAI LỚP: cắm lớp cam ở đỉnh xong phải đi hết board xuống đáy cắm lớp xanh',
    // Ý đồ ban đầu là BA LỚP và tôi đã bỏ, sau sáu bố cục thất bại: bốn chốt ba
    // lớp, hai chốt ba lớp, khay xếp chéo, khay xếp đối xứng, board chữ C có cửa ải
    // hai ô, và tăng ngân sách dò lên gấp mười. Không bản nào tìm ra lời giải.
    //
    // Màn KHÔNG sai luật — `previewSeats` cho một chốt cắm liên tiếp nhiều lớp
    // trong cùng một nước nếu đứng cạnh đủ các lỗ. Nhưng ba lớp × nhiều chốt, lại
    // cộng thêm board chật, đòi lời giải đi đúng gần hai chục lượt cắm theo một thứ
    // tự cứng — sâu hơn thứ bộ dò ngẫu nhiên với tới. Ship một màn mà máy không
    // chứng minh nổi là giải được thì tệ hơn nhiều so với hạ một nấc cơ chế.
    //
    // Bản này giữ trọn cái hay của shape-in-shape ở hai lớp: chốt cắm lớp cam ở
    // đỉnh xong lộ lớp xanh, phải đi hết chiều dài board xuống đáy cắm tiếp. Board
    // vát bốn góc thành bát giác, và mật độ nới ra cho bộ dò còn đường.
    holders: [
      holder('k1', 'orange', [[0, 1], [0, 2]], ['cross', 'cross']),
      holder('k2', 'orange', [[0, 3], [0, 4]], ['cross', 'cross']),
      holder('k3', 'red', [[3, 0], [3, 1]], ['heart', 'heart']),
      holder('k4', 'yellow', [[3, 4], [3, 5]], ['square', 'square']),
      holder('k5', 'green', [[5, 0], [5, 1]], ['diamond', 'diamond']),
      holder('k6', 'pink', [[1, 5]], ['star']),
      holder('k7', 'blue', [[6, 1], [6, 2]], ['circle', 'circle']),
      holder('k8', 'blue', [[6, 3], [6, 4]], ['circle', 'circle']),
    ],
    tmpls: [
      // Chốt hai lớp phải là mảnh MỘT CHỐT, không phải mảnh dọc hai chốt.
      //
      // Đây là chỗ giết sáu bố cục trước, và nó là hình học của MẢNH chứ không phải
      // của board: mảnh dọc chiếm (r,c) và (r+1,c), nên muốn chốt TRÊN đứng ở hàng 5
      // thì chốt dưới phải rơi vào hàng 6 — mà hàng 6 là khay xanh. Chốt trên vĩnh
      // viễn không bao giờ kề được lỗ xanh, tức là lớp thứ hai không có đường cắm.
      // Engine phát hiện đúng điều đó và trả về vô nghiệm ở cả bảy bản.
      tmplDeep('p1', S1, [['orange', 'cross'], ['blue', 'circle']]),
      tmplDeep('p2', S1, [['orange', 'cross'], ['blue', 'circle']]),
      tmplDeep('p3', S1, [['orange', 'cross'], ['blue', 'circle']]),
      tmplDeep('p4', S1, [['orange', 'cross'], ['blue', 'circle']]),
      tmpl('p5', H2, 'red', 'heart'), tmpl('p6', H2, 'yellow', 'square'),
      tmpl('p7', H2, 'green', 'diamond'), tmpl('p8', S1, 'pink', 'star'),
    ],
  },
  {
    id: 'lv_c3_30', n: 30, rows: 9, cols: 5,
    carved: [[0, 0], [0, 4], [8, 0], [8, 4], [3, 0]],
    idea: 'KHAY ĐA HÌNH — cùng một khay nhưng mỗi lỗ một HÌNH khác, phải gom đúng bộ',
    // Bản đầu 17 lỗ / 6 ô trống và TOÀN mảnh hai chốt đa-loại: 850 lần đặt lọt mà
    // không bản nào chơi được. Mảnh đa-loại hai chốt là thứ khó đi nhất trong game —
    // hai đầu của nó thuộc về hai khay ở hai đầu board, nên nó phải đi tới nơi, cắm
    // một đầu, ĐỨT ra, rồi nửa còn lại mới đi tiếp. Ở 6 ô trống thì gần như không
    // nhúc nhích. Bớt một lỗ (16) cho tám ô trống, và một nửa số mảnh chuyển thành
    // MỘT chốt để board còn đường đi.
    holders: [
      holder('k1', 'blue', [[0, 1], [0, 2], [0, 3]], ['circle', 'heart', 'star']),
      holder('k2', 'purple', [[2, 0], [2, 1]], ['cross', 'diamond']),
      holder('k3', 'yellow', [[2, 3], [2, 4]], ['heart', 'square']),
      holder('k4', 'red', [[4, 0], [4, 1]], ['heart', 'star']),
      holder('k5', 'green', [[4, 3], [4, 4]], ['diamond', 'triangle']),
      holder('k6', 'orange', [[6, 1], [6, 2]], ['cross', 'diamond']),
      holder('k7', 'pink', [[8, 1], [8, 2]], ['circle', 'star']),
      holder('k8', 'white', [[6, 4]], ['pentagon']),
    ],
    tmpls: [
      tmplMix('m1', H2, [['blue', 'circle'], ['blue', 'heart']]),
      tmplMix('m2', H2, [['purple', 'cross'], ['purple', 'diamond']]),
      tmplMix('m3', H2, [['yellow', 'heart'], ['yellow', 'square']]),
      tmplMix('m4', H2, [['red', 'heart'], ['red', 'star']]),
      tmpl('m5', S1, 'blue', 'star'), tmpl('m6', S1, 'green', 'diamond'),
      tmpl('m7', S1, 'green', 'triangle'), tmpl('m8', S1, 'orange', 'cross'),
      tmpl('m9', S1, 'orange', 'diamond'), tmpl('m10', S1, 'pink', 'circle'),
      tmpl('m11', S1, 'pink', 'star'), tmpl('m12', S1, 'white', 'pentagon'),
    ],
  },
  // ---------- Lv31..Lv40: CƠ CHẾ BĂNG ----------
  //
  // BĂNG ĐÓNG BĂNG MỘT KHỐI, KHÔNG PHẢI LÀ TƯỜNG TỰ TAN.
  //
  // Bản đầu tôi làm băng thành một mảng chắn đường rồi biến mất sau N lần nổ. Chủ
  // dự án chỉnh lại: vỡ ra là LỘ RA KHỐI BÊN TRONG. Khác nhau một trời:
  //
  //   · tường tự tan  → “chờ đủ N rồi đi tiếp”, người chơi không phải quyết gì.
  //   · đóng băng khối → quân bạn CẦN đang bị nhốt. Muốn lấy phải nổ đủ N khay bằng
  //     quân đang tự do TRƯỚC, mà quân tự do thì có hạn. Con số trên tảng băng biến
  //     từ đồng hồ đếm ngược thành một bài toán thứ tự.
  //
  // Mọi màn dưới đây đều có ít nhất một mảnh nằm TRONG băng. Ràng buộc dựng màn:
  // `count` phải nổ được bằng quân TỰ DO — nhốt quân của quá nhiều khay là màn tự
  // khoá, và engine bắt ngay vì không tìm ra lời giải.
  {
    id: 'lv_c3_31', n: 31, rows: 7, cols: 5, carved: [],
    idea: 'DẠY BĂNG — mảnh xanh lá bị nhốt, nổ một khay bất kỳ là băng vỡ và lấy được nó',
    obstacles: [{ kind: 'ice' as const, cells: [[3, 1], [3, 2], [3, 3]], count: 1 }],
    holders: [
      holder('k1', 'red', [[0, 0], [0, 1]], ['heart', 'heart']),
      holder('k2', 'blue', [[0, 3], [0, 4]], ['circle', 'circle']),
      holder('k3', 'purple', [[3, 0], [4, 0]], ['cross', 'cross']),
      holder('k4', 'yellow', [[6, 0], [6, 1]], ['square', 'square']),
      holder('k5', 'green', [[6, 3], [6, 4]], ['diamond', 'diamond']),
    ],
    tmpls: [
      tmpl('p1', H2, 'red', 'heart'), tmpl('p2', H2, 'blue', 'circle'),
      tmpl('p3', V2, 'purple', 'cross'), tmpl('p4', H2, 'yellow', 'square'),
      onIce(tmpl('p5', H2, 'green', 'diamond')),
    ],
  },
  {
    id: 'lv_c3_32', n: 32, rows: 8, cols: 5, carved: [],
    idea: 'HAI NHỊP — mảnh xanh lá bị nhốt sau HAI lần nổ, mà chỉ bốn khay kia là mở được ngay',
    obstacles: [{ kind: 'ice' as const, cells: [[4, 1], [4, 2], [4, 3]], count: 2 }],
    holders: [
      holder('k1', 'red', [[0, 0], [0, 1]], ['heart', 'heart']),
      holder('k2', 'blue', [[0, 3], [0, 4]], ['circle', 'circle']),
      holder('k3', 'purple', [[2, 0], [2, 1]], ['cross', 'cross']),
      holder('k4', 'orange', [[2, 3], [2, 4]], ['diamond', 'diamond']),
      holder('k5', 'yellow', [[7, 0], [7, 1]], ['square', 'square']),
      holder('k6', 'green', [[7, 3], [7, 4]], ['diamond', 'diamond']),
    ],
    tmpls: [
      tmpl('p1', H2, 'red', 'heart'), tmpl('p2', H2, 'blue', 'circle'),
      tmpl('p3', H2, 'purple', 'cross'), tmpl('p4', H2, 'orange', 'diamond'),
      tmpl('p5', H2, 'yellow', 'square'),
      onIce(tmpl('p6', H2, 'green', 'diamond')),
    ],
  },
  {
    id: 'lv_c4_ice', n: 33, rows: 8, cols: 5, carved: [],
    idea: 'HAI TẢNG LỆCH NHỊP — tảng trên vỡ sau một lần nổ, tảng dưới sau ba, mỗi tảng nhốt một mảnh',
    obstacles: [{ kind: 'ice' as const, cells: [[1, 2], [1, 3]], count: 1 }, { kind: 'ice' as const, cells: [[5, 1], [5, 2], [5, 3]], count: 3 }],
    holders: [
      holder('k1', 'red', [[0, 0], [0, 1]], ['heart', 'heart']),
      holder('k2', 'blue', [[0, 3], [0, 4]], ['circle', 'circle']),
      holder('k3', 'purple', [[3, 0], [3, 1]], ['cross', 'cross']),
      holder('k4', 'orange', [[3, 3], [3, 4]], ['diamond', 'diamond']),
      holder('k5', 'yellow', [[7, 0], [7, 1]], ['square', 'square']),
      holder('k6', 'green', [[7, 3], [7, 4]], ['diamond', 'diamond']),
    ],
    tmpls: [
      tmpl('p1', H2, 'red', 'heart'), tmpl('p2', H2, 'purple', 'cross'),
      tmpl('p3', H2, 'orange', 'diamond'), tmpl('p4', H2, 'yellow', 'square'),
      onIce(tmpl('p5', H2, 'blue', 'circle')),
      onIce(tmpl('p6', H2, 'green', 'diamond')),
    ],
  },
  {
    id: 'lv_c4_34', n: 34, rows: 8, cols: 6,
    carved: [[0, 0], [0, 5], [7, 0], [7, 5]],
    idea: 'CẢ HÀNG ĐÓNG BĂNG — tảng bốn ô nhốt TRỌN hai mảnh của hai khay đáy, ba lần nổ mới lấy ra được',
    obstacles: [{ kind: 'ice' as const, cells: [[5, 1], [5, 2], [5, 3], [5, 4]], count: 3 }],
    holders: [
      holder('k1', 'red', [[0, 1], [0, 2]], ['heart', 'heart']),
      holder('k2', 'blue', [[0, 3], [0, 4]], ['circle', 'circle']),
      holder('k3', 'purple', [[2, 0], [2, 1]], ['cross', 'cross']),
      holder('k4', 'orange', [[2, 4], [2, 5]], ['diamond', 'diamond']),
      holder('k5', 'white', [[3, 2], [3, 3]], ['pentagon', 'pentagon']),
      holder('k6', 'yellow', [[7, 1], [7, 2]], ['square', 'square']),
      holder('k7', 'green', [[7, 3], [7, 4]], ['diamond', 'diamond']),
    ],
    tmpls: [
      tmpl('p1', H2, 'red', 'heart'), tmpl('p2', H2, 'blue', 'circle'),
      tmpl('p3', H2, 'purple', 'cross'), tmpl('p4', H2, 'orange', 'diamond'),
      tmpl('p5', H2, 'white', 'pentagon'),
      onIce(tmpl('p6', H2, 'yellow', 'square')),
      onIce(tmpl('p7', H2, 'green', 'diamond')),
    ],
  },
  {
    id: 'lv_c4_35', n: 35, rows: 8, cols: 6,
    carved: [[3, 0], [3, 5], [4, 0], [4, 5]],
    idea: 'BĂNG Ở EO — đồng hồ cát thắt lại, và chính cái eo đang đóng băng một mảnh',
    obstacles: [{ kind: 'ice' as const, cells: [[3, 2], [3, 3], [4, 2], [4, 3]], count: 2 }],
    holders: [
      holder('k1', 'red', [[0, 0], [0, 1]], ['heart', 'heart']),
      holder('k2', 'blue', [[0, 4], [0, 5]], ['circle', 'circle']),
      holder('k3', 'purple', [[2, 0], [2, 1]], ['cross', 'cross']),
      holder('k4', 'orange', [[2, 4], [2, 5]], ['diamond', 'diamond']),
      holder('k5', 'white', [[5, 0], [5, 1]], ['pentagon', 'pentagon']),
      holder('k6', 'pink', [[5, 4], [5, 5]], ['star', 'star']),
      holder('k7', 'yellow', [[7, 0], [7, 1]], ['square', 'square']),
      holder('k8', 'green', [[7, 4], [7, 5]], ['diamond', 'diamond']),
    ],
    tmpls: [
      tmpl('p1', H2, 'red', 'heart'), tmpl('p2', H2, 'blue', 'circle'),
      tmpl('p3', H2, 'purple', 'cross'), tmpl('p4', H2, 'orange', 'diamond'),
      tmpl('p5', H2, 'white', 'pentagon'), tmpl('p6', H2, 'yellow', 'square'),
      tmpl('p7', H2, 'green', 'diamond'),
      onIce(tmpl('p8', H2, 'pink', 'star')),
    ],
  },
  {
    id: 'lv_c4_36', n: 36, rows: 7, cols: 6,
    carved: [[0, 0], [0, 5], [6, 0], [6, 5]],
    idea: 'BĂNG NHỐT CHỐT HAI LỚP — hai chốt cam/xanh bị đóng băng, mà chúng phải cắm ở CẢ đỉnh lẫn đáy',
    obstacles: [{ kind: 'ice' as const, cells: [[3, 2], [3, 3]], count: 2 }],
    holders: [
      holder('k1', 'orange', [[0, 1], [0, 2]], ['cross', 'cross']),
      holder('k2', 'orange', [[0, 3], [0, 4]], ['cross', 'cross']),
      holder('k3', 'red', [[2, 0], [2, 1]], ['heart', 'heart']),
      holder('k4', 'yellow', [[2, 4], [2, 5]], ['square', 'square']),
      holder('k5', 'green', [[4, 0], [4, 1]], ['diamond', 'diamond']),
      holder('k6', 'blue', [[6, 1], [6, 2]], ['circle', 'circle']),
      holder('k7', 'blue', [[6, 3], [6, 4]], ['circle', 'circle']),
    ],
    tmpls: [
      tmplDeep('p1', S1, [['orange', 'cross'], ['blue', 'circle']]),
      tmplDeep('p2', S1, [['orange', 'cross'], ['blue', 'circle']]),
      onIce(tmplDeep('p3', S1, [['orange', 'cross'], ['blue', 'circle']])),
      onIce(tmplDeep('p4', S1, [['orange', 'cross'], ['blue', 'circle']])),
      tmpl('p5', H2, 'red', 'heart'), tmpl('p6', H2, 'yellow', 'square'),
      tmpl('p7', H2, 'green', 'diamond'),
    ],
  },
  {
    id: 'lv_c4_37', n: 37, rows: 9, cols: 5,
    carved: [[0, 0], [0, 4], [8, 0], [8, 4]],
    idea: 'BĂNG + KHAY ĐA HÌNH — mảnh bị nhốt là mảnh đa-loại, cắm một đầu là đứt ra',
    obstacles: [{ kind: 'ice' as const, cells: [[4, 1], [4, 2], [4, 3]], count: 2 }],
    holders: [
      holder('k1', 'blue', [[0, 1], [0, 2], [0, 3]], ['circle', 'heart', 'star']),
      holder('k2', 'purple', [[2, 0], [2, 1]], ['cross', 'diamond']),
      holder('k3', 'yellow', [[2, 3], [2, 4]], ['heart', 'square']),
      holder('k4', 'red', [[5, 0], [5, 1]], ['heart', 'star']),
      holder('k5', 'green', [[5, 3], [5, 4]], ['diamond', 'triangle']),
      holder('k6', 'pink', [[8, 1], [8, 2], [8, 3]], ['circle', 'star', 'circle']),
    ],
    tmpls: [
      tmplMix('m1', H2, [['blue', 'circle'], ['blue', 'heart']]),
      tmplMix('m2', H2, [['purple', 'cross'], ['purple', 'diamond']]),
      tmplMix('m3', H2, [['yellow', 'heart'], ['yellow', 'square']]),
      onIce(tmplMix('m4', H2, [['red', 'heart'], ['red', 'star']])),
      tmpl('m5', S1, 'blue', 'star'), tmpl('m6', S1, 'green', 'diamond'),
      tmpl('m7', S1, 'green', 'triangle'), tmpl('m8', S1, 'pink', 'circle'),
      tmpl('m9', S1, 'pink', 'star'), tmpl('m10', S1, 'pink', 'circle'),
    ],
  },
  {
    id: 'lv_c4_38', n: 38, rows: 8, cols: 6,
    carved: [[0, 0], [0, 5], [7, 0], [7, 5]],
    idea: 'BA TẢNG BA NHỊP — mỗi tảng nhốt một mảnh, vỡ sau một, hai và bốn lần nổ',
    obstacles: [{ kind: 'ice' as const, cells: [[1, 1], [1, 2]], count: 1 }, { kind: 'ice' as const, cells: [[3, 2], [3, 3]], count: 2 }, { kind: 'ice' as const, cells: [[6, 2], [6, 3]], count: 4 }],
    holders: [
      holder('k1', 'red', [[0, 1], [0, 2]], ['heart', 'heart']),
      holder('k2', 'blue', [[0, 3], [0, 4]], ['circle', 'circle']),
      holder('k3', 'purple', [[2, 0], [2, 1]], ['cross', 'cross']),
      holder('k4', 'orange', [[2, 4], [2, 5]], ['diamond', 'diamond']),
      holder('k5', 'white', [[4, 0], [4, 1]], ['pentagon', 'pentagon']),
      holder('k6', 'pink', [[4, 4], [4, 5]], ['star', 'star']),
      holder('k7', 'yellow', [[7, 1], [7, 2]], ['square', 'square']),
      holder('k8', 'green', [[7, 3], [7, 4]], ['diamond', 'diamond']),
    ],
    tmpls: [
      tmpl('p1', H2, 'red', 'heart'), tmpl('p2', H2, 'purple', 'cross'),
      tmpl('p3', H2, 'orange', 'diamond'), tmpl('p4', H2, 'white', 'pentagon'),
      tmpl('p5', H2, 'yellow', 'square'),
      onIce(tmpl('p6', H2, 'blue', 'circle')),
      onIce(tmpl('p7', H2, 'pink', 'star')),
      onIce(tmpl('p8', H2, 'green', 'diamond')),
    ],
  },
  {
    id: 'lv_c4_39', n: 39, rows: 8, cols: 5, carved: [],
    idea: 'BOARD CHẬT + BĂNG — tảng băng vừa nhốt mảnh tím vừa ăn mất chỗ xoay xở vốn đã ít',
    // Băng ở HÀNG 5, không phải hàng 4: hàng 4 là khay tím và khay xanh, mà băng đè
    // lên khay thì §8.2 chặn — 4000 lần rải ra ĐÚNG 0 chỗ đặt lọt.
    obstacles: [{ kind: 'ice' as const, cells: [[5, 1], [5, 2], [5, 3]], count: 2 }],
    holders: [
      holder('k1', 'green', [[0, 0], [0, 1], [0, 2]], ['diamond', 'diamond', 'diamond']),
      holder('k2', 'red', [[2, 0], [2, 1]], ['heart', 'heart']),
      holder('k3', 'yellow', [[2, 3], [2, 4]], ['square', 'square']),
      holder('k4', 'purple', [[4, 0], [4, 1]], ['cross', 'cross']),
      holder('k5', 'blue', [[4, 3], [4, 4]], ['circle', 'circle']),
      holder('k6', 'white', [[7, 1], [7, 2], [7, 3]], ['pentagon', 'pentagon', 'pentagon']),
    ],
    tmpls: [
      tmpl('p1', H2, 'green', 'diamond'), tmpl('p2', S1, 'green', 'diamond'),
      tmpl('p3', H2, 'red', 'heart'), tmpl('p4', H2, 'yellow', 'square'),
      tmpl('p5', H2, 'blue', 'circle'),
      tmpl('p6', H2, 'white', 'pentagon'), tmpl('p7', S1, 'white', 'pentagon'),
      onIce(tmpl('p8', H2, 'purple', 'cross')),
    ],
  },
  {
    id: 'lv_c4_40', n: 40, rows: 9, cols: 6,
    carved: [[0, 0], [0, 5], [4, 0], [4, 5], [8, 0], [8, 5]],
    idea: 'SIÊU KHÓ — ba tảng ba nhịp nhốt ba mảnh, trong đó có chốt hai lớp; chín khay, board thắt ba lần',
    obstacles: [{ kind: 'ice' as const, cells: [[1, 2], [1, 3]], count: 1 }, { kind: 'ice' as const, cells: [[3, 2], [3, 3]], count: 2 }, { kind: 'ice' as const, cells: [[7, 2], [7, 3]], count: 4 }],
    holders: [
      holder('k1', 'orange', [[0, 1], [0, 2]], ['cross', 'cross']),
      holder('k2', 'orange', [[0, 3], [0, 4]], ['cross', 'cross']),
      holder('k3', 'red', [[2, 0], [2, 1]], ['heart', 'heart']),
      holder('k4', 'yellow', [[2, 4], [2, 5]], ['square', 'square']),
      holder('k5', 'white', [[4, 1], [4, 2]], ['pentagon', 'pentagon']),
      holder('k6', 'pink', [[4, 3], [4, 4]], ['star', 'star']),
      holder('k7', 'green', [[6, 0], [6, 1]], ['diamond', 'diamond']),
      holder('k8', 'purple', [[6, 4], [6, 5]], ['cross', 'cross']),
      holder('k9', 'blue', [[8, 1], [8, 2], [8, 3], [8, 4]], ['circle', 'circle', 'circle', 'circle']),
    ],
    tmpls: [
      tmplDeep('p1', S1, [['orange', 'cross'], ['blue', 'circle']]),
      tmplDeep('p2', S1, [['orange', 'cross'], ['blue', 'circle']]),
      onIce(tmplDeep('p3', S1, [['orange', 'cross'], ['blue', 'circle']])),
      onIce(tmplDeep('p4', S1, [['orange', 'cross'], ['blue', 'circle']])),
      tmpl('p5', H2, 'red', 'heart'), tmpl('p6', H2, 'yellow', 'square'),
      tmpl('p7', H2, 'white', 'pentagon'), tmpl('p8', H2, 'green', 'diamond'),
      onIce(tmpl('p9', H2, 'pink', 'star')),
      onIce(tmpl('p10', H2, 'purple', 'cross')),
    ],
  },
];

/** Dò chỗ đặt mảnh cho MỘT bộ xương. Giữ bản tốt nhất: bắt-phải-tính trước, dài sau. */
function searchTight(spec: TightSpec, budgetMs: number): Checked | string {
  const mismatch = tally(spec);
  if (mismatch) return `đếm lệch — ${mismatch}`;

  const playable = playableExcept(spec.rows, spec.cols, spec.carved);
  const pegCells = spec.tmpls.reduce((s, t) => s + t.cells.length, 0);
  const holderCells = spec.holders.reduce((s, h) => s + h.cells.length, 0);
  const frozenCells = spec.tmpls.filter((t) => t.onIce).reduce((n, t) => n + t.cells.length, 0);
  const iceCells = (spec.obstacles ?? [])
    .filter((o) => o.kind !== 'park')
    .reduce((n, o) => n + o.cells.length, 0);
  // ô băng có chốt nằm trong thì đã đếm ở `pegCells`, đừng trừ hai lần
  const freeCount = playable.length - holderCells - pegCells - (iceCells - frozenCells);

  const rand = rng(spec.n * 7919 + 2026);
  const until = Date.now() + budgetMs;
  let best: Checked | null = null;
  let bestGreedy = true;
  let tried = 0;
  let placed = 0;
  /** Bậc nào loại nhiều nhất — không có nó thì mọi thất bại chỉ là con số 0. */
  const why = new Map<string, number>();

  for (let i = 0; i < 4000 && Date.now() < until; i++) {
    tried++;
    const pieces = placeAll(spec, playable, rand);
    if (!pieces) continue;
    placed++;
    const draft: Omit<Level, 'minMoves' | 'timeLimitMs'> = {
      id: spec.id,
      name: `Level ${spec.n}`,
      chapter: 2,
      difficulty: 'hard',
      rows: spec.rows,
      cols: spec.cols,
      playable,
      holders: spec.holders,
      pieces,
      obstacles: spec.obstacles ?? [],
    };
    const r = check(draft, spec.n, undefined, spec.deep ? 'sâu' : true);
    if (typeof r === 'string') {
      const key = r.split(' —')[0].split(':')[0].slice(0, 40);
      why.set(key, (why.get(key) ?? 0) + 1);
      continue;
    }
    const greedy = r.note.includes('THẮNG');
    // bắt-phải-tính hơn hẳn; cùng hạng thì lấy bản DÀI hơn
    const better = !best || (bestGreedy && !greedy) || (bestGreedy === greedy && r.level.minMoves! > best.level.minMoves!);
    if (better) {
      best = r;
      bestGreedy = greedy;
    }
    if (best && !bestGreedy && best.level.minMoves! >= 10) break;
  }

  if (!best) {
    const top = [...why.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    return (
      `${tried} lần rải, ${placed} lần đặt lọt, không bản nào chơi được` +
      `  [${top.map(([kk, v]) => `${kk}×${v}`).join(', ')}]`
    );
  }
  // Soi kỹ lại bản trúng tuyển: bậc lọc chạy `fast` nên `minMoves` của nó là chặn
  // trên khá lỏng; ở đây cho bộ tìm nhiều lượt hơn để rút ngắn lời giải, và thử cả
  // BFS ngắn nhất một lần cho biết con số thật.
  const full = check(best.level, spec.n);
  const pick = typeof full === 'string' ? best : full;
  pick.note = `${pick.note} · ${freeCount} ô trống · ${placed}/${tried} lần đặt lọt · ${spec.idea}`;
  return pick;
}

const ENABLED = import.meta.env.VITE_HAND === '1';
/**
 * Chi do may man ghi o day, vi du VITE_TIGHT=16,18. Rong = do het. Mot luot do du
 * sau man mat muoi may phut, ma thuong chi mot hai man can chinh.
 */
const ONLY = String(import.meta.env.VITE_TIGHT ?? '')
  .split(',')
  .map((x) => Number(x.trim()))
  .filter((x) => x > 0);
/** Bo qua khuc man CHEP TU ANH (5,8,9,10,12,13,14) — chung da chot, tham lai la phi. */
const SKIP_FIXED = import.meta.env.VITE_TIGHT_ONLY === '1';

describe.runIf(ENABLED)('màn xếp tay', () => {
  it('thẩm rồi vá vào levels.data.json + levels.solutions.json', () => {
    const all = JSON.parse(readFileSync(LEVELS_FILE, 'utf8')) as Level[];
    const sols = JSON.parse(readFileSync(SOLUTIONS_FILE, 'utf8')) as Record<string, Move[]>;
    const report: string[] = [];

    const put = (n: number, c: Checked) => {
      expect(c.level.id).toBe(all[n - 1].id); // đổi id là mất tiến độ người chơi
      all[n - 1] = c.level;
      sols[c.level.id] = c.solution;
    };

    // --- Lv5 ---
    if (!SKIP_FIXED) {
    const r5 = check(LV5, 5);
    if (typeof r5 === 'string') report.push(`Lv5 HỎNG: ${r5}`);
    else {
      put(5, r5);
      report.push(`Lv5 ✓ ${r5.note}`);
    }

    // --- Lv8 ---
    const r8 = check(LV8, 8, 85_000); // ảnh gốc: 01:25
    if (typeof r8 === 'string') report.push(`Lv8 HỎNG: ${r8}`);
    else {
      put(8, r8);
      report.push(`Lv8 ✓ ${r8.note}`);
    }

    // --- Lv9: mảng 2×2 xanh (khay dưới-trái và mảnh trên-phải) đọc không ra hướng,
    //     để engine loại bớt rồi lấy bản đầu tiên còn đứng vững ---
    const LV9_VARIANTS: [string, ReturnType<typeof lv9>][] = [
      ['khay NGANG · mảnh NGANG', lv9('ngang', 'ngang')],
      ['khay NGANG · mảnh MỘT KHỐI', lv9('ngang', 'một khối')],
      ['khay DỌC · mảnh NGANG', lv9('dọc', 'ngang')],
      ['khay NGANG · mảnh DỌC', lv9('ngang', 'dọc')],
    ];
    let best9: Checked | null = null;
    for (const [name, lv] of LV9_VARIANTS) {
      const r = check(lv, 9, 90_000); // ảnh gốc: 01:30
      if (typeof r === 'string') {
        report.push(`Lv9 ${name} ✗ ${r}`);
        continue;
      }
      report.push(`Lv9 ${name} ✓ ${r.note}`);
      if (!best9) best9 = r;
    }
    if (best9) put(9, best9);
    else report.push('Lv9 HỎNG: không cách đọc nào chơi được');

    // --- Lv10..Lv14 --- (không ảnh nào có HUD ⇒ ngân sách §5.3, Lv10+ nhân đôi)
    for (const [n, lv] of [[10, LV10], [12, LV12], [13, LV13], [14, LV14]] as const) {
      const r = check(lv, n);
      if (typeof r === 'string') report.push(`Lv${n} HỎNG: ${r}`);
      else {
        put(n, r);
        report.push(`Lv${n} ✓ ${r.note}`);
      }
    }
    }

    // --- Lv15..Lv20: bộ xương xếp tay + chỗ đặt mảnh do máy dò ---
    for (const spec of TIGHT) {
      if (ONLY.length > 0 && !ONLY.includes(spec.n)) continue;
      const r = searchTight(spec, 90_000);
      if (typeof r === 'string') report.push(`Lv${spec.n} HỎNG: ${r}`);
      else {
        put(spec.n, r);
        report.push(`Lv${spec.n} ✓ ${r.note}`);
      }
      writeFileSync(new URL('./hand-out.txt', import.meta.url), `${report.join('\n')}\n`, 'utf8');
    }

    writeFileSync(LEVELS_FILE, `${JSON.stringify(all, null, 2)}\n`, 'utf8');
    writeFileSync(SOLUTIONS_FILE, `${JSON.stringify(sols, null, 1)}\n`, 'utf8');
    writeFileSync(new URL('./hand-out.txt', import.meta.url), `${report.join('\n')}\n`, 'utf8');
    // eslint-disable-next-line no-console -- đây là công cụ, báo cáo là đầu ra chính
    console.log(report.join('\n'));
    expect(report.filter((r) => r.includes('HỎNG'))).toEqual([]);
  }, 900_000);
});
