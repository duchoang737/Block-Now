/**
 * BỘ DỰNG MÀN — sinh ngẫu nhiên có kiểm soát một ứng viên level từ một "công thức".
 *
 * Tách khỏi `gen-levels.test.ts` vì có HAI bộ sinh dùng chung nó: bộ dựng cả dãy
 * 5..50, và bộ dựng lại riêng khúc đầu cho khó hơn (`gen-hard.test.ts`). Code ở
 * đây giữ nguyên từng dòng của bản cũ — đổi một li là dãy 50 màn sinh lại ra khác.
 *
 * Nó chỉ DỰNG, không phán xét: chuyện màn có giải được / có bắt phải tính không là
 * việc của `judge` trong `design.ts`.
 */
import { ART_PAIRS } from './design';
import type { Cell, Color, Level, PieceSpec, Shape } from '../types';

// ---------- ngẫu nhiên TẤT ĐỊNH ----------
// Sinh lại phải ra đúng bộ màn cũ, không thì mỗi lần chạy là một game khác.
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export const key = (c: Cell) => `${c[0]},${c[1]}`;

/** Vùng chơi được phải LIỀN MỘT KHỐI: mảnh trượt, không nhảy sang panel khác. */
export function connected(cells: Cell[]): boolean {
  if (cells.length === 0) return false;
  const set = new Set(cells.map(key));
  const seen = new Set([key(cells[0])]);
  const queue = [cells[0]];
  while (queue.length) {
    const [r, c] = queue.shift()!;
    for (const nb of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]] as Cell[]) {
      const k = key(nb);
      if (!set.has(k) || seen.has(k)) continue;
      seen.add(k);
      queue.push(nb);
    }
  }
  return seen.size === set.size;
}

export interface Recipe {
  /**
   * SỐ Ô CÒN TRỐNG sau khi đặt hết khay và chốt. Đây là núm vặn độ khó THẬT của
   * trò trượt khối: còn 8 ô trống thì mảnh nào cũng đi vòng được, còn 3 ô thì mỗi
   * nước đi đều phải tính trước hai ba bước — cùng một cơ chế, khác hẳn về chất.
   *
   * Board bị khoét cho tới khi đạt đúng con số này, chứ không khoét theo tỉ lệ
   * rồi phó mặc. Bản trước thả nổi nên màn nào cũng rộng rãi và dễ.
   */
  free: number;
  /** cỡ TỪNG khay; mỗi khay một MÀU riêng ⇒ số khay = số màu trên màn */
  holderSizes: number[];
  /** số chốt của TỪNG mảnh; tổng = tổng lỗ trừ số lớp gộp */
  pieceSizes: number[];
  /** số lớp gộp vào chốt sẵn có (shape-in-shape) */
  stacked: number;
  /**
   * Số nước ĐÒI THÊM so với sàn lý thuyết.
   *
   * Sàn = tổng số LỚP chốt: mỗi lớp cắm được là một nước. Đòi một con số tuyệt
   * đối là vô nghĩa — 2 mảnh một lớp thì lời giải ngắn nhất luôn đúng 2 nước, có
   * dựng kiểu gì cũng không ra 3. Mỗi nước đòi thêm ở đây chính là một nước DỌN
   * CHỖ bắt buộc, tức là đúng thứ độ khó ta cần.
   */
  extra: number;
  planning: boolean;
  /** tên kiểu màn — chỉ để đọc báo cáo */
  name: string;
  /**
   * Ép ĐÚNG cỡ lưới này thay vì để hàm tự dò. Bản tự dò lấy lưới đầu tiên vừa khít
   * theo thứ tự hàng tăng dần, nên want≈16 luôn ra board 3 hàng — mà board 3 hàng
   * thì bài toán đường đi gần như một chiều. Khúc màn khó cần lưới VUÔNG hơn.
   */
  rows?: number;
  cols?: number;
}

/** Trần cạnh board — chủ dự án chốt 6×6. */
export const MAX_SIDE = 6;

/**
 * Đếm CHỖ CHẾT của bộ dựng. Không có nó thì mọi thất bại đều chỉ là `null`, và khi
 * một công thức dày cho ra 1 ứng viên trên 600 nghìn lần dựng thì không có cách nào
 * biết nên nới cái gì — đo được đúng cảnh đó ở lần đầu thử khúc Lv11..20.
 */
export const buildStats: Record<string, number> = {};
const fail = (why: string): null => {
  buildStats[why] = (buildStats[why] ?? 0) + 1;
  return null;
};

export function build(rec: Recipe, rand: () => number, id: string, n: number): Level | null {
  // ---- hình board ----
  // Khoét tới ĐÚNG số ô cần: khay + chốt + số ô trống mục tiêu. Số lỗ = số khay
  // cộng số khay 2 ô; mỗi lỗ một lớp chốt, mỗi chốt một ô.
  const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
  const holeCount = sum(rec.holderSizes);
  const pegCells = sum(rec.pieceSizes);
  if (pegCells !== holeCount - rec.stacked) return fail('số học kiểu màn'); // kiểu màn ghi sai
  const want = holeCount + pegCells + rec.free;

  // CHỌN CỠ BOARD THEO SỐ Ô CẦN, không cố định rồi khoét bừa. Cố định 5×6 mà chỉ
  // cần 15 ô là khoét mất nửa board — nó vỡ thành hành lang cụt và gần như màn nào
  // cũng bế tắc (đo được ~480/500 ứng viên không giải được). Lấy lưới vừa khít,
  // chỉ dư 1..4 ô để khoét, thì board chật mà vẫn liền khối.
  let rows = 0;
  let cols = 0;
  let found = false;
  if (rec.rows && rec.cols) {
    if (rec.rows * rec.cols < want) return fail('lưới ép nhỏ hơn số ô cần');
    rows = rec.rows;
    cols = rec.cols;
    found = true;
  }
  for (let r = 3; r <= MAX_SIDE && !found; r++) {
    for (let c = r; c <= MAX_SIDE && !found; c++) {
      // dư 1..6 ô để khoét: đủ chỗ tạo hình board khác nhau mà vẫn không vỡ vụn
      if (r * c >= want + 1 && r * c <= want + 6) {
        rows = rand() < 0.5 ? r : c;
        cols = rows === r ? c : r;
        found = true;
      }
    }
  }
  if (!found) return fail('không lưới nào vừa');

  const all: Cell[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) all.push([r, c]);
  if (all.length < want) return fail('lưới nhỏ hơn số ô cần');

  /**
   * KHOÉT TỪ NGOÀI VÀO. Chỉ bỏ được ô nằm ở MÉP lưới, hoặc ô kề một ô đã bỏ.
   *
   * Ràng buộc này giữ cho vùng bỏ luôn THÔNG RA NGOÀI, tức là board không bao giờ
   * có ô bỏ bị vây kín. Ô kín đẻ ra một đường bao thứ hai lọt giữa board, tách rời
   * khung ngoài — nhìn ra ngay thành "một hình dán vào giữa" chứ không phải tường,
   * và không cách vẽ nào chữa được (xem `enclosedHoles` trong `editor/model.ts`).
   *
   * Không mất hình dạng nào: mọi board có vùng bỏ thông ra mép đều dựng được bằng
   * cách khoét dần từ ngoài vào, nên đây chỉ là ép THỨ TỰ khoét chứ không cắt bớt
   * tập hình đích.
   */
  const playable = [...all];
  const gone = new Set<string>();
  const edge = ([r, c]: Cell) => r === 0 || c === 0 || r === rows - 1 || c === cols - 1;
  const touchesGone = ([r, c]: Cell) =>
    ([[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]] as Cell[]).some((x) => gone.has(key(x)));

  let guard = 0;
  while (playable.length > want && guard++ < 400) {
    const j = Math.floor(rand() * playable.length);
    const cell = playable[j];
    if (!edge(cell) && !touchesGone(cell)) continue;
    const kept = playable.filter((_, k) => k !== j);
    if (!connected(kept)) continue;
    playable.splice(j, 1);
    gone.add(key(cell));
  }
  if (playable.length !== want || !connected(playable)) return fail('khoét không tới đích');

  const onBoard = new Set(playable.map(key));
  const free = new Set(playable.map(key));
  const take = (cell: Cell) => free.delete(key(cell));
  const isFree = (cell: Cell) => free.has(key(cell));
  /** Ô kề CÒN TRỐNG — dùng để chọn chỗ đặt. */
  const nbrs = ([r, c]: Cell): Cell[] =>
    ([[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]] as Cell[]).filter((x) => free.has(key(x)));
  /**
   * Ô kề TRÊN BOARD, kể cả ô đã bị chiếm. Phải tách khỏi `nbrs`: ô khay đã bị lấy
   * khỏi tập trống, nên hỏi "chốt này có kề lỗ khớp không" bằng `nbrs` thì câu trả
   * lời luôn là KHÔNG — phép kiểm im lặng vô hiệu, và 3/4 ứng viên bị `judge` loại
   * ở tận bậc sau vì đúng cái lỗi mà bộ sinh tưởng đã tránh.
   */
  const around = ([r, c]: Cell): Cell[] =>
    ([[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]] as Cell[]).filter((x) => onBoard.has(key(x)));

  // ---- khay ----
  // Đặt ở chỗ CÒN ÍT NHẤT 2 lối vào: lỗ chỉ có 1 lối là nguồn bẫy "hai chốt phải
  // đổi chỗ cho nhau", `lonelyHoles` cảnh báo đúng chỗ này.
  // MỖI KHAY MỘT MÀU RIÊNG ⇒ số khay chính là số màu trên màn. Khay nhiều ô thì
  // các lỗ cùng màu nhưng ĐỔI HÌNH nếu màu đó có nhiều hình — luật cho phép
  // (§8.3 "cùng màu, khác hình được"), và đó là nguồn đa dạng gần như miễn phí.
  const byColor = new Map<string, Shape[]>();
  for (const [c, s] of ART_PAIRS) byColor.set(c, [...(byColor.get(c) ?? []), s as Shape]);
  const colors = [...byColor.keys()].sort(() => rand() - 0.5);
  if (colors.length < rec.holderSizes.length) return fail('thiếu màu');

  const holders: Level['holders'] = [];
  const holes: { color: Color; shape: Shape }[] = [];
  for (let i = 0; i < rec.holderSizes.length; i++) {
    const color = colors[i] as Color;
    const palette = [...byColor.get(color)!].sort(() => rand() - 0.5);
    const size = rec.holderSizes[i];

    // Đòi ≥3 lối vào lúc ĐẶT: những thứ đặt sau sẽ bịt bớt, nên không chừa dư một
    // lối thì phần lớn ứng viên chết vì lỗ kín.
    const roomy = playable.filter((c) => isFree(c) && nbrs(c).length >= 3);
    const spots = roomy.length > 0 ? roomy : playable.filter((c) => isFree(c) && nbrs(c).length >= 2);
    if (spots.length === 0) return fail('hết chỗ đặt khay');

    // Khay phải THẲNG HÀNG (§8.3): chọn một hướng rồi kéo dài theo đúng hướng đó.
    const head = spots[Math.floor(rand() * spots.length)];
    const cells: Cell[] = [head];
    if (size > 1) {
      const dirs: Cell[] = [[0, 1], [1, 0], [0, -1], [-1, 0]];
      const dir = dirs.sort(() => rand() - 0.5).find((d) => {
        for (let k = 1; k < size; k++) {
          const c: Cell = [head[0] + d[0] * k, head[1] + d[1] * k];
          if (!isFree(c)) return false;
        }
        return true;
      });
      if (!dir) return fail('khay dài không có hướng nào lọt');
      for (let k = 1; k < size; k++) cells.push([head[0] + dir[0] * k, head[1] + dir[1] * k]);
    }

    const shapes = cells.map((_, k) => palette[k % palette.length]);
    for (const c of cells) take(c);
    holders.push({ id: `k${i + 1}`, color, cells, holes: shapes });
    for (const s of shapes) holes.push({ color, shape: s });
  }

  // ---- chốt: đúng một lớp cho mỗi lỗ ----
  const layers = holes.map((h) => ({ color: h.color, shape: h.shape }));
  const stacks: (typeof layers)[] = [];
  for (let i = 0; i < rec.stacked && layers.length >= 2; i++) stacks.push([layers.pop()!, layers.pop()!]);
  for (const l of layers) stacks.push([l]);

  const holeCells = new Set(holders.flatMap((h) => h.cells.map(key)));
  // KHÔNG đặt chốt kề lỗ khớp: cắm được ngay từ đầu thì nhấc lên là mất chỗ, mà
  // không có Undo. `initialFreeSeats` cảnh báo đúng chỗ này.
  const okFor = (c: Cell, layer: { color: Color; shape: Shape }) =>
    isFree(c) && !around(c).some((nb) => holeCells.has(key(nb)) && matchesAt(holders, nb, layer));

  // Mảnh dựng theo ĐÚNG cỡ kiểu màn ghi ra. Chốt của một mảnh phải LIÊN THÔNG
  // (§8.4) nên mọc dần từ đầu mảnh sang ô kề, không rải bừa.
  const pieces: PieceSpec[] = [];
  let gid = 0;
  for (const size of rec.pieceSizes) {
    const mine = stacks.splice(0, size);
    if (mine.length !== size) return fail('thiếu lớp cho mảnh');

    const spots = playable.filter((c) => okFor(c, mine[0][0]));
    if (spots.length === 0) return fail('hết chỗ đặt đầu mảnh');
    const cells: Cell[] = [spots[Math.floor(rand() * spots.length)]];
    take(cells[0]);
    for (let k = 1; k < size; k++) {
      const grow = cells
        .flatMap(around)
        .filter((c) => okFor(c, mine[k][0]) && !cells.some((x) => key(x) === key(c)));
      if (grow.length === 0) return fail('mảnh không mọc thêm được');
      const next = grow[Math.floor(rand() * grow.length)];
      cells.push(next);
      take(next);
    }
    pieces.push({
      id: `p${pieces.length + 1}`,
      pegs: cells.map((cell, k) => ({ id: `g${++gid}`, cell, layers: mine[k] })),
    });
  }
  if (stacks.length > 0 || pieces.length === 0) return fail('còn lớp thừa');

  return {
    id,
    name: `Level ${n}`,
    chapter: Math.min(5, Math.ceil(n / 10)),
    rows,
    cols,
    playable,
    holders,
    pieces,
    timeLimitMs: 60_000,
    difficulty: n >= 41 ? 'expert' : n >= 25 ? 'hard' : 'normal',
  };
}

function matchesAt(
  holders: Level['holders'],
  cell: Cell,
  layer: { color: Color; shape: Shape },
): boolean {
  for (const h of holders) {
    const i = h.cells.findIndex((c) => key(c) === key(cell));
    if (i >= 0) return h.color === layer.color && h.holes[i] === layer.shape;
  }
  return false;
}
