/**
 * DỰNG LẠI Lv25 — "bắt phải sắp xếp, và lỗ phải ở XA chốt".
 *
 *   $env:VITE_GEN='1'; npx vitest run src/tools/gen25.test.ts
 *
 * Chỉ thị: người chơi phải VẬN DỤNG sắp xếp, không nhìn phát ra ngay; chốt và cái
 * lỗ nó cần cắm phải nằm XA nhau chứ không kề bên.
 *
 * VÌ SAO KHÔNG DÙNG `build-level.ts`. Bộ dựng đó rải chốt vào bất kỳ ô trống nào,
 * chỉ tránh mỗi chuyện đứng KỀ lỗ khớp. Đo thẳng: 85.526 ứng viên dựng ra, khoảng
 * cách chốt→lỗ xa nhất là **2 ô**, không một cái nào đạt 5. Lọc ngẫu nhiên để tìm
 * "xa nhau" là mò kim đáy bể — phải dựng có chủ đích.
 *
 * HÌNH BOARD Ở ĐÂY LÀ CƠ CHẾ, không phải trang trí:
 *
 *      phòng KHAY   (trên)      mọi lỗ nằm hết ở đây
 *      ────cổ hẹp────           rộng 1..2 ô, khoét thông ra hai mép
 *      phòng CHỐT   (dưới)      mọi mảnh xuất phát ở đây
 *
 * Tách hai phòng ra là ép khoảng cách ≥ chiều cao phòng dưới + cổ, tức là điều
 * kiện "xa nhau" được bảo đảm bằng CẤU TRÚC chứ không phải bằng may rủi. Cái cổ
 * hẹp là chỗ sinh ra "phải sắp xếp": mảnh là khối cứng và mọi vị trí trung gian
 * đều phải hợp lệ (R-MOVE), nên mảnh ngang 2 ô không chui lọt cổ rộng 1 ô, và
 * mảnh nào cũng phải xếp hàng qua từng cái một — thứ tự qua cổng chính là câu đố.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { ART_PAIRS, greedySolves, judge } from './design';
import { build, connected, key, rng, type Recipe } from './build-level';
import { applyMove, createState, hashState } from '../core/engine';
import { isCleared } from '../core/rules';
import { findSolution, successors } from '../core/solver';
import { playableSet } from '../core/board';
import type { Cell, Color, Level, PieceSpec, Shape } from '../types';

const LEVELS_FILE = new URL('../levels.data.json', import.meta.url);
const SOLUTIONS_FILE = new URL('../levels.solutions.json', import.meta.url);
const ENABLED = import.meta.env.VITE_GEN === '1';

const BUDGET_MS = Number(import.meta.env.VITE_BUDGET ?? 240_000);
/** khoảng cách tối thiểu đòi hỏi từ MỌI chốt tới chỗ cắm được gần nhất */
const FAR = Number(import.meta.env.VITE_FAR ?? 4);
/** đòi lời giải dài ít nhất bấy nhiêu nước */
const MIN_MOVES = Number(import.meta.env.VITE_MINMOVES ?? 11);
/** đòi ít nhất bấy nhiêu nước ĐỖ TẠM (không cắm được gì) trong lời giải */
const MIN_PARK = Number(import.meta.env.VITE_PARK ?? 4);
/** đòi MA SÁT tối thiểu — số nước dôi ra so với khi từng mảnh đi một mình */
const MIN_FRICTION = Number(import.meta.env.VITE_FRICTION ?? 5);
/** khoang cach TRUNG BINH toi thieu */
const FAR_AVG = Number(import.meta.env.VITE_FARAVG ?? 4.5);

// ---------------------------------------------------------------- thước đo XA

interface Far {
  min: number;
  avg: number;
}

/**
 * Khoảng cách từ mỗi chốt tới chỗ CẮM ĐƯỢC gần nhất của nó.
 *
 * BFS trên ô chơi được. KHAY là tường (khay là khối đặc, không đi xuyên), còn mảnh
 * khác thì KHÔNG — chúng dời được, tính chúng là tường thì ra khoảng cách của một
 * thế cờ nhất thời chứ không phải của thiết kế màn.
 *
 * Đích không phải ô của lỗ mà là ô KỀ lỗ: cắm là đứng cạnh rồi chốt nhảy vào.
 * Bỏ qua chuyện phải dọn chỗ nên đây là chặn DƯỚI của công sức thật — đúng thứ
 * cần cho câu hỏi "nhìn phát thấy ngay hay không".
 */
function farness(level: Level): Far {
  const playable = playableSet(level);
  /**
   * KHAY KHÔNG PHẢI TƯỜNG VĨNH VIỄN — bản trước tính vậy và sai nặng.
   *
   * Khay đầy lỗ thì NỔ và trả lại ô trống, nên đường đi bị khay chắn hôm nay có
   * thể thông ngay sau cú cắm kế tiếp. Coi chúng là tường thì trên board dày
   * 97.994/98.039 màn bị báo "chốt không tới nổi lỗ" — trong khi chính những màn
   * ấy giải được, và đó là toàn bộ lý do bốn vòng dựng trước về tay trắng.
   *
   * Thứ cần đo ở đây cũng không phải đường đi thực tế mà là KHOẢNG CÁCH TRÊN MÀN
   * HÌNH: người chơi liếc một cái có thấy ngay chốt này ăn vào lỗ nào không. Nên
   * chỉ ô ngoài board mới chặn.
   */
  const solid = new Set<string>();

  const dists: number[] = [];
  for (const piece of level.pieces) {
    for (const peg of piece.pegs) {
      const layer = peg.layers[0];
      const goals = new Set<string>();
      for (const h of level.holders) {
        if (h.color !== layer.color) continue;
        h.cells.forEach((cell, i) => {
          if (h.holes[i] !== layer.shape) return;
          for (const nb of around(cell))
            if (playable.has(key(nb)) && !solid.has(key(nb))) goals.add(key(nb));
        });
      }
      if (goals.size === 0) return { min: -1, avg: -1 };

      const seen = new Set([key(peg.cell)]);
      let frontier: Cell[] = [peg.cell];
      let d = 0;
      let hit = -1;
      while (frontier.length > 0 && hit < 0) {
        if (frontier.some((c) => goals.has(key(c)))) break;
        const next: Cell[] = [];
        for (const cell of frontier)
          for (const nb of around(cell)) {
            const k = key(nb);
            if (!playable.has(k) || solid.has(k) || seen.has(k)) continue;
            seen.add(k);
            next.push(nb);
          }
        frontier = next;
        d++;
        if (frontier.some((c) => goals.has(key(c)))) hit = d;
      }
      if (hit < 0) return { min: -1, avg: -1 };
      dists.push(hit);
    }
  }
  return {
    min: Math.min(...dists),
    avg: Math.round((dists.reduce((s, v) => s + v, 0) / dists.length) * 10) / 10,
  };
}

const around = ([r, c]: Cell): Cell[] => [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];

// ------------------------------------------------------- thước đo PHẢI SẮP XẾP

/**
 * NGƯỜI CHƠI NHÌN TRƯỚC MỘT NƯỚC — mạnh hơn hẳn `greedySolves`.
 *
 * `greedySolves` một mình là cổng RỖNG với kiểu màn "lỗ ở xa": chốt cách lỗ 8 ô
 * thì nước đầu không tài nào cắm được gì, nên "tham thất bại" đúng tự động mà
 * chẳng chứng minh được màn có bắt phải tính hay không. Đo được: bản Lv25 đầu
 * tiên qua cổng đó nhưng chơi ra thì dễ, vì mỗi mảnh chỉ việc đi một mạch.
 *
 * Người chơi ở đây: có nước cắm thì cắm (nhiều lớp trước); KHÔNG có thì đi MỘT
 * nước dọn chỗ nào mở ra được nước cắm ngay sau đó. Đây là mức "nhìn trước một
 * bước" mà người chơi bình thường làm được. Màn nào hắn xong thì màn đó chưa đòi
 * SẮP XẾP — muốn khó thật, phải có chỗ cần HAI nước dọn liên tiếp trở lên.
 */
export function shallowSolves(level: Level, maxMoves = 60): boolean {
  let state = createState(level);
  for (let i = 0; i < maxMoves; i++) {
    if (isCleared(state)) return true;
    const succ = successors(state);
    const seating = succ.filter((s) => s.seated > 0).sort((a, b) => b.seated - a.seated);
    if (seating.length > 0) {
      state = seating[0].next;
      continue;
    }
    const unlock = succ.find((s) => successors(s.next).some((x) => x.seated > 0));
    if (!unlock) return false;
    state = unlock.next;
  }
  return isCleared(state);
}

/**
 * Số nước ĐỖ TẠM trong lời giải: nước không cắm được lớp nào.
 *
 * Đây là thước đo trực tiếp nhất của "phải sắp xếp" — mỗi nước như vậy là một
 * lần người chơi buộc phải dời một mảnh đi chỗ khác chỉ để mở đường, không thu
 * được gì ngay. Màn 12 nước mà 12 nước đều cắm được thì đó là 12 lần bấm, không
 * phải một câu đố.
 */
/**
 * MA SÁT — thước đo thật của "phải sắp xếp", và là thứ ba thước đo trước đều trượt.
 *
 * Chỗ dễ hiểu sai nhất của game này: R-MOVE cho mảnh trượt tới BẤT KỲ ô nào nó
 * với tới được, trong ĐÚNG MỘT nước. Nên "chốt cách lỗ 8 ô" KHÔNG tốn thêm nước
 * nào cả, miễn đường thông. Hệ quả: mọi thước đo dựa vào "nước đầu có cắm được
 * không" — `greedySolves`, `shallowSolves` — đều tự động báo "khó" ở màn xa, vì
 * hai nước đầu dĩ nhiên chưa cắm nổi gì. Cổng rỗng.
 *
 * Cái tốn nước thật là VẬT CẢN: mảnh khác chắn đường, phải dời đi rồi mới qua.
 * Nên đo bằng hiệu:
 *
 *     ma sát = (số nước của lời giải thật) − Σ (số nước mảnh đó cần khi ĐI MỘT MÌNH)
 *
 * Mảnh đi một mình = đúng màn đó nhưng bỏ hết mảnh khác. Hiệu số này chính là số
 * nước sinh ra bởi việc các mảnh vướng nhau — tức là bài sắp xếp, không lẫn với
 * quãng đường.
 */
function friction(level: Level, moves: [string, Cell][]): number {
  let solo = 0;
  for (const piece of level.pieces) {
    // BỎ chướng ngại khi đo mảnh đi một mình: băng chỉ tan khi khay nổ, mà một
    // mình nó thì chẳng nổ nổi khay nào ⇒ mảnh bị băng phủ sẽ vĩnh viễn "không
    // xong", và cả thước đo trả về -1. Chuẩn so sánh phải là "đường đi trống".
    const alone: Level = { ...level, pieces: [piece], obstacles: [] };
    const start = createState(alone);
    let frontier = [start];
    const seen = new Set([hashState(start)]);
    let d = 0;
    let done = -1;
    while (frontier.length > 0 && done < 0 && d < 8) {
      const next: typeof frontier = [];
      d++;
      for (const s of frontier)
        for (const { next: child } of successors(s)) {
          if (child.pieces[0].gone) {
            done = d;
            break;
          }
          const h = hashState(child);
          if (seen.has(h)) continue;
          seen.add(h);
          next.push(child);
        }
      frontier = next;
    }
    if (done < 0) return -1; // mảnh này một mình còn không xong ⇒ số liệu vô nghĩa
    solo += done;
  }
  return moves.length - solo;
}

function parkMoves(level: Level, moves: [string, Cell][]): number {
  const state = createState(level);
  let park = 0;
  for (const [id, anchor] of moves) {
    const r = applyMove(state, id, anchor);
    if (!r) return -1;
    if (r.pluggedLayers === 0) park++;
  }
  return park;
}

// ------------------------------------------------------------- bộ dựng HAI PHÒNG

interface FarRecipe {
  name: string;
  rows: number;
  cols: number;
  /** hàng cuối của phòng khay (trên) */
  topEnd: number;
  /** hàng đầu của phòng chốt (dưới) */
  botStart: number;
  /** bề rộng cổ nối hai phòng */
  neck: number;
  /**
   * Ép mọi mảnh nhiều chốt mọc theo CHIỀU DỌC.
   *
   * Bắt buộc khi cổ rộng 1 ô: game KHÔNG có xoay mảnh, nên mảnh nằm ngang 2 ô
   * vĩnh viễn không chui lọt cổ 1 ô — nó thành mảnh chết chứ không thành đố.
   * Đổi lại, cổ 1 ô mới là nút cổ chai THẬT: mỗi lúc đúng một mảnh ở trong đó,
   * và mảnh nào đỗ nhầm chỗ là chặn hết phần còn lại.
   */
  vertical?: boolean;
  holderSizes: number[];
  pieceSizes: number[];
}

function buildFar(rec: FarRecipe, rand: () => number): Level | null {
  const { rows, cols, topEnd, botStart, neck } = rec;

  // ---- hình board: đủ hàng, trừ phần bị cổ thắt lại ----
  // Cổ đặt lệch ngẫu nhiên, và phần bỏ đi luôn chạm mép trái/phải nên không bao
  // giờ sinh ô bỏ bị vây kín (`enclosedHoles`).
  const neckLeft = Math.floor(rand() * (cols - neck + 1));
  const playable: Cell[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const inNeck = r > topEnd && r < botStart;
      if (inNeck && (c < neckLeft || c >= neckLeft + neck)) continue;
      playable.push([r, c]);
    }
  if (!connected(playable)) return null;

  const onBoard = new Set(playable.map(key));
  const free = new Set(playable.map(key));
  const isFree = (c: Cell) => free.has(key(c));
  const openNbrs = (c: Cell) => around(c).filter((x) => free.has(key(x))).length;

  /**
   * CHỪA CỬA HÀNH LANG. Hai ô ngay trên miệng cổ và hai ô ngay dưới miệng cổ
   * không được đặt gì vào.
   *
   * Bỏ ràng buộc này thì khay dễ dàng bịt kín miệng cổ và board bị CẮT ĐÔI: chốt
   * ở phòng dưới không còn đường nào lên tới lỗ. Đo được 352.481/352.536 ứng viên
   * chết đúng vì lý do đó — không phải "màn khó" mà là màn hỏng.
   */
  const mouth = new Set<string>();
  for (let c = neckLeft; c < neckLeft + neck; c++) {
    mouth.add(key([topEnd, c]));
    mouth.add(key([botStart, c]));
  }
  const usable = (c: Cell) => isFree(c) && !mouth.has(key(c));

  // ---- khay: TẤT CẢ nằm trong phòng trên ----
  const byColor = new Map<string, Shape[]>();
  for (const [c, s] of ART_PAIRS) byColor.set(c, [...(byColor.get(c) ?? []), s as Shape]);
  const colors = [...byColor.keys()].sort(() => rand() - 0.5);
  if (colors.length < rec.holderSizes.length) return null;

  const holders: Level['holders'] = [];
  const holes: { color: Color; shape: Shape }[] = [];
  const inTop = ([r]: Cell) => r <= topEnd;
  for (let i = 0; i < rec.holderSizes.length; i++) {
    const color = colors[i] as Color;
    const palette = [...byColor.get(color)!].sort(() => rand() - 0.5);
    const size = rec.holderSizes[i];
    const spots = playable.filter((c) => inTop(c) && usable(c) && openNbrs(c) >= 2);
    if (spots.length === 0) return null;

    const head = spots[Math.floor(rand() * spots.length)];
    const cells: Cell[] = [head];
    if (size > 1) {
      const dirs: Cell[] = [[0, 1], [1, 0], [0, -1], [-1, 0]];
      const dir = dirs.sort(() => rand() - 0.5).find((d) => {
        for (let k = 1; k < size; k++) {
          const c: Cell = [head[0] + d[0] * k, head[1] + d[1] * k];
          if (!onBoard.has(key(c)) || !usable(c) || !inTop(c)) return false;
        }
        return true;
      });
      if (!dir) return null;
      for (let k = 1; k < size; k++) cells.push([head[0] + dir[0] * k, head[1] + dir[1] * k]);
    }
    const shapes = cells.map((_, k) => palette[k % palette.length]);
    for (const c of cells) free.delete(key(c));
    holders.push({ id: `k${i + 1}`, color, cells, holes: shapes });
    for (const s of shapes) holes.push({ color, shape: s });
  }

  // ---- chốt: TẤT CẢ nằm trong phòng dưới ----
  const layers = holes.map((h) => ({ color: h.color, shape: h.shape })).sort(() => rand() - 0.5);
  const inBot = ([r]: Cell) => r >= botStart;
  const pieces: PieceSpec[] = [];
  let gid = 0;
  for (const size of rec.pieceSizes) {
    const mine = layers.splice(0, size);
    if (mine.length !== size) return null;
    const spots = playable.filter((c) => inBot(c) && usable(c));
    if (spots.length === 0) return null;

    const cells: Cell[] = [spots[Math.floor(rand() * spots.length)]];
    free.delete(key(cells[0]));
    for (let k = 1; k < size; k++) {
      const step = rec.vertical
        ? ([r, c]: Cell): Cell[] => [[r - 1, c], [r + 1, c]]
        : around;
      const grow = cells
        .flatMap(step)
        .filter((c) => inBot(c) && usable(c) && !cells.some((x) => key(x) === key(c)));
      if (grow.length === 0) return null;
      const next = grow[Math.floor(rand() * grow.length)];
      cells.push(next);
      free.delete(key(next));
    }
    pieces.push({
      id: `p${pieces.length + 1}`,
      pegs: cells.map((cell, k) => ({ id: `g${++gid}`, cell, layers: [mine[k]] })),
    });
  }
  if (layers.length > 0) return null;

  return {
    id: 'lv_c3_25',
    name: 'Level 25',
    chapter: 3,
    rows,
    cols,
    playable,
    holders,
    pieces,
    timeLimitMs: 60_000,
    difficulty: 'hard',
  };
}

/**
 * PHÒNG PHẢI CHẬT, và đây là chỗ lần chạy đầu sai.
 *
 * Bản đầu để mỗi phòng dư hơn chục ô trống. Board thoáng thì mỗi thế cờ có hàng
 * trăm nước đi hợp lệ, mà bậc soi kỹ `fatalFirstMoves` phải chạy `findFrom` lại
 * cho TỪNG nước đầu — 10 phút chưa xong một ứng viên. Thoáng còn làm hỏng luôn
 * cái đang cần: mảnh nào cũng đi vòng được thì hết chỗ để phải sắp xếp.
 *
 * Nên: phòng chỉ dư 4..6 ô trống, còn ĐỘ XA lấy từ CHIỀU DÀI CỔ chứ không từ độ
 * rộng phòng. Cổ dài vừa đẩy khoảng cách lên vừa không thêm nhánh — nó rộng đúng
 * 2 ô nên mỗi lúc chỉ một mảnh lách qua.
 */
/**
 * PHÒNG PHẢI CHẬT — bản trước sai ở chính chỗ này.
 *
 * Bản trước để mỗi phòng dư 4 ô nhưng hành lang thì dài 6 hàng và TRỐNG TRƠN, nên
 * mảnh nào cũng đi một mạch từ dưới lên và không mảnh nào cản mảnh nào. Nó dài chứ
 * không khó. Hai chỗ sửa:
 *
 *  · Hành lang NGẮN (2..3 hàng). Nó chỉ cần đủ để ép khoảng cách và ép đi một
 *    mảnh một lúc; dài thêm chỉ là thêm ô trống miễn phí.
 *  · Phòng CHẬT (dư 3..4 ô). Đây mới là chỗ sinh ra "phải sắp xếp": phòng dưới
 *    chật thì phải dời mảnh khác đi mới lôi được mảnh mình cần ra cửa; phòng trên
 *    chật thì phải cắm đúng khay nào NỔ TRƯỚC để lấy chỗ mà xoay xở tiếp — khay
 *    nổ là trả lại ô trống, nên THỨ TỰ NỔ chính là câu đố.
 */
/**
 * HAI PHÒNG KHÔNG ĐỐI XỨNG — đo được rồi mới chốt:
 *
 *  · Phòng KHAY phải RỘNG (khay chiếm ~60% phòng). Nhồi chặt hơn thì chính các
 *    khay vây kín lấy lỗ của nhau: 779.721/779.725 ứng viên có ít nhất một lỗ
 *    không còn đường vào, tức là màn hỏng chứ không phải màn khó.
 *  · Phòng CHỐT phải CHẬT (chốt chiếm ~75% phòng). Đây mới là chỗ sinh ra bài
 *    sắp xếp: muốn lôi mảnh cần đi ra cửa thì phải dời mấy mảnh khác trước, mà
 *    dời đi đâu cũng chỉ còn 4..6 ô.
 *  · Cổ NGẮN (2..3 hàng), rộng 2 ô. Nó chỉ cần ép "mỗi lúc một mảnh"; dài thêm
 *    chỉ là tặng thêm ô trống miễn phí — lỗi của bản Lv25 dễ vừa rồi.
 */
/**
 * HAI ĐƯỜNG DỰNG, và đường thứ hai mới là đường về đích.
 *
 * `two-room` (bộ dựng ở trên) cho khoảng cách lớn miễn phí, nhưng đo ra thì nó
 * chỉ có HAI trạng thái, không có khoảng giữa: phòng thoáng thì mảnh nào cũng
 * trượt thẳng tới lỗ trong một nước ⇒ dễ (27/51 ứng viên bị cổng "nhìn trước 1
 * nước" loại); phòng chật thì kẹt cứng ⇒ vô nghiệm (20/51). Nguyên nhân nằm ở
 * luật: R-MOVE cho trượt tới bất kỳ đâu, nên hành lang dài không hề tạo ra độ
 * khó, chỉ tạo ra khoảng cách nhìn.
 *
 * `dense` dùng THẲNG bộ dựng `build-level.ts` — thứ đã sinh ra khúc Lv10..20
 * "đông block và thực sự khó". Khó ở đó đến từ mảnh chắn nhau trên board chật,
 * đúng cơ chế ta cần. Nó không tự cho khoảng cách xa, nên ở đây bơm board to hơn
 * mức bộ sinh cũ dùng (8×5 thay vì 6×6) mà GIỮ NGUYÊN mật độ, rồi lọc bằng
 * `farness`. To hơn ở cùng mật độ = đường đi dài hơn mà vẫn chật.
 */
type Plan =
  | { name: string; kind: 'two-room'; rec: FarRecipe; ice?: number }
  | { name: string; kind: 'dense'; rec: Recipe; ice?: number };

const dense = (name: string, rows: number, cols: number, free: number,
  holderSizes: number[], pieceSizes: number[], stacked = 0, ice = 0): Plan => ({
  name, kind: 'dense', ice,
  rec: { name, rows, cols, free, holderSizes, pieceSizes, stacked, extra: 0, planning: true },
});

/**
 * ĐÓNG BĂNG một mảnh — nguồn độ khó THỨ TỰ, thay cho việc bóp nghẹt board.
 *
 * Băng phủ lên mảnh thì mảnh đó bất động cho tới khi NỔ ĐỦ `count` khay. Người
 * chơi buộc phải nhìn ra: quân nào đang tự do, chúng nổ được khay nào, và có nổ
 * đủ số đó trước khi bí không. Đó là bài toán thứ tự thuần tuý — nó không cần
 * board chật, nên không đụng vào điều kiện "chốt ở xa lỗ" như bảy vòng trước.
 *
 * Chỉ phủ lên MẢNH, không phủ lên khay: §8.2 cấm băng đè khay, và cũng đúng về
 * mặt chơi — khay bị phủ thì lỗ vừa không cắm được vừa không đọc ra vì sao.
 */
function withIce(lv: Level, rand: () => number, count: number): Level | null {
  if (count <= 0) return lv;
  if (lv.pieces.length < 3 || count > lv.holders.length) return null;

  /**
   * KHÔNG đóng băng bừa. Băng tan theo SỐ KHAY ĐÃ NỔ, nên nếu mảnh bị băng phủ
   * lại đang giữ lớp mà `count` khay đầu tiên cần thì màn tự khoá vĩnh viễn:
   * không nổ đủ khay ⇒ băng không tan ⇒ không lấy được lớp ⇒ không nổ đủ khay.
   *
   * Đặt băng ngẫu nhiên thì 333/342 ứng viên chết đúng vì vòng lặp đó. Điều kiện
   * cần (rẻ, kiểm bằng đếm): sau khi bỏ mảnh bị băng ra, phải còn ĐỦ `count` khay
   * mà số lớp tự do cung cấp được trọn bộ lỗ của nó.
   */
  const order = lv.pieces.map((_, i) => i).sort(() => rand() - 0.5);
  for (const i of order) {
    const freeLayers = new Map<string, number>();
    lv.pieces.forEach((p, j) => {
      if (j === i) return;
      for (const peg of p.pegs)
        for (const l of peg.layers) {
          const k = `${l.color}/${l.shape}`;
          freeLayers.set(k, (freeLayers.get(k) ?? 0) + 1);
        }
    });
    let poppable = 0;
    for (const h of lv.holders) {
      const need = new Map<string, number>();
      for (const s of h.holes) {
        const k = `${h.color}/${s}`;
        need.set(k, (need.get(k) ?? 0) + 1);
      }
      if ([...need].every(([k, n]) => (freeLayers.get(k) ?? 0) >= n)) poppable++;
    }
    if (poppable >= count)
      return { ...lv, obstacles: [{ kind: 'ice', cells: lv.pieces[i].pegs.map((p) => p.cell), count }] };
  }
  return null;
}

const PLANS: Plan[] = [
  // BOARD DAC, KHONG HANH LANG. Do duoc o probe cua repo: 6x6 + 6 khay HAI o +
  // 12 lo cho 10/15 ung vien giai duoc, dai 10..18 nuoc — day la cau hinh DUY
  // NHAT trong repo da chung minh vua kho vua giai duoc.
  //
  // Bo han kieu hai phong: hanh lang trong dai chi ton dien tich. Luat R-MOVE cho
  // mach truot het hanh lang trong MOT nuoc, nen khoang cach khong sinh ra do kho,
  // chi sinh ra o trong thua.
  dense('6×6 dac · 6 khay · 3 trong', 6, 6, 3, [2, 2, 2, 2, 2, 2], [2, 2, 2, 2, 1, 1, 1, 1]),
  dense('6×6 dac · 6 khay · 2 trong', 6, 6, 2, [2, 2, 2, 2, 2, 2], [2, 2, 2, 2, 1, 1, 1, 1]),
  dense('6×6 dac · 7 khay · 3 trong', 6, 6, 3, [2, 2, 2, 2, 2, 2, 2], [2, 2, 2, 2, 2, 1, 1, 1, 1]),
  dense('6×6 dac · 6 khay · 4 trong', 6, 6, 4, [2, 2, 2, 2, 2, 2], [2, 2, 2, 2, 1, 1, 1, 1]),
];

describe.runIf(ENABLED)('dựng Lv25', () => {
  it('xa nhau + bắt phải tính', () => {
    const t0 = Date.now();
    const levels = JSON.parse(readFileSync(LEVELS_FILE, 'utf8')) as Level[];
    const idx = levels.findIndex((l) => l.id === 'lv_c3_25');
    const old = levels[idx];

    const pool: { level: Level; moves: number; far: Far; park: number; fric: number; plan: string }[] = [];
    const why = new Map<string, number>();
    const note = (r: string) => {
      const k = r.split(' —')[0].split(':')[0];
      why.set(k, (why.get(k) ?? 0) + 1);
    };
    let built = 0;
    let farOk = 0;

    const slice = Math.floor(BUDGET_MS / PLANS.length);
    for (const [vi, plan] of PLANS.entries()) {
      const rand = rng(25 * 7919 + vi * 104729 + 17);
      const until = Date.now() + slice;
      for (let a = 0; a < 500_000 && Date.now() < until; a++) {
        const raw =
          plan.kind === 'two-room'
            ? buildFar(plan.rec, rand)
            : build(plan.rec, rand, 'lv_c3_25', 25);
        if (!raw) continue;
        const lv = withIce(raw, rand, plan.ice ?? 0);
        if (!lv) continue;
        built++;
        const far = farness(lv);
        // Board dày không tách phòng nên không thể đòi MỌI chốt đều xa; đòi thế
        // là quay lại chỗ mò kim đáy bể. Đòi KHÔNG CÓ chốt nào sát lỗ (min ≥ FAR)
        // và mặt bằng chung phải xa (trung bình ≥ FAR_AVG) — đủ để không nhìn
        // phát ra cặp nào, mà vẫn dựng được.
        if (far.min < FAR || far.avg < FAR_AVG) {
          note(`gần quá (${far.min}/${far.avg})`);
          continue;
        }
        farOk++;
        if (successors(createState(lv)).length === 0) {
          note('board đông cứng');
          continue;
        }
        // Cổng "nhìn trước một nước" chạy TRƯỚC `judge`: nó rẻ hơn `findSolution`
        // hàng chục lần và loại thẳng đúng cái kiểu màn dễ mà bản trước lọt qua.
        if (shallowSolves(lv)) {
          note('nhìn trước 1 nước là xong');
          continue;
        }
        const q = judge(lv, {
          needPlanning: true,
          minMovesAtLeast: MIN_MOVES,
          quick: true,
          dense: true,
          findAttempts: 200,
          seed: 20260817 + vi,
        });
        if (!q.ok) {
          note(q.reasons[0]);
          continue;
        }
        const sol = findSolution(lv, { attempts: 200, maxDepth: 26, seed: 20260817 + vi });
        const park = sol ? parkMoves(lv, sol.moves) : -1;
        if (park < MIN_PARK) {
          note(`đỗ tạm quá ít (${park})`);
          continue;
        }
        const fric = friction(lv, sol!.moves);
        if (fric < MIN_FRICTION) {
          note(`ma sát quá thấp (${fric})`);
          continue;
        }
        pool.push({ level: lv, moves: sol!.moves.length, far, park, fric, plan: plan.name });
      }
      // eslint-disable-next-line no-console -- công cụ, báo cáo là đầu ra chính
      console.log(`[${plan.name}] dựng ${built} · đủ xa ${farOk} · ứng viên ${pool.length}`);
    }

    // Xếp hạng: ĐỖ TẠM trước — đó là thước đo trực tiếp của "phải sắp xếp" —
    // rồi mới tới XA, rồi tới DÀI. Bản trước xếp theo XA nên chọn trúng màn xa
    // nhất mà chẳng đòi sắp xếp gì.
    const ranked = pool.sort(
      (a, b) => b.fric - a.fric || b.park - a.park || b.far.min - a.far.min,
    );
    let picked: (typeof pool)[number] | null = null;
    for (const cand of ranked.slice(0, 6)) {
      const v = judge(cand.level, {
        needPlanning: true,
        dense: true,
        findAttempts: 100,
        seed: 20260817,
      });
      if (!v.ok) {
        note(`SÂU ${v.reasons[0]}`);
        continue;
      }
      picked = { ...cand, moves: v.minMoves };
      break;
    }

    const top = [...why.entries()].sort((a, b) => b[1] - a[1]).filter(([k]) => !k.startsWith('gần quá')).slice(0, 12);
    const stats = `dựng ${built} · đủ xa ${farOk} · ứng viên ${pool.length} [${top
      .map(([k, v]) => `${k}×${v}`)
      .join(', ')}]`;
    if (!picked) {
      // eslint-disable-next-line no-console -- công cụ
      console.log(`Lv25 KHÔNG dựng được — ${stats} · ${Date.now() - t0}ms`);
      expect.fail('không dựng được');
    }

    const L = picked.level;
    L.name = old.name;
    L.chapter = old.chapter;
    L.difficulty = 'hard';
    L.minMoves = picked.moves;
    // §5.3 sàn, nhân đôi từ Lv10 — màn bắt phải TÍNH mà đồng hồ sát nút thì nó
    // biến bài toán tư duy thành bài toán bấm nhanh.
    L.timeLimitMs = Math.ceil(((picked.moves * 4000 + 20000) * 2) / 5000) * 5000;

    const sol = findSolution(L, { attempts: 100, maxDepth: 26, seed: 20260817 });
    if (!sol || sol.moves.length !== picked.moves)
      expect.fail(`không dựng lại được lời giải (${sol?.moves.length ?? 'không có'} ≠ ${picked.moves})`);

    levels[idx] = L;
    writeFileSync(LEVELS_FILE, `${JSON.stringify(levels, null, 1)}\n`, 'utf8');
    const sols = JSON.parse(readFileSync(SOLUTIONS_FILE, 'utf8')) as Record<string, unknown>;
    sols[L.id] = sol.moves;
    writeFileSync(SOLUTIONS_FILE, `${JSON.stringify(sols, null, 1)}\n`, 'utf8');

    const occupied =
      L.holders.reduce((s, h) => s + h.cells.length, 0) +
      L.pieces.reduce((s, p) => s + p.pegs.length, 0);
    // eslint-disable-next-line no-console -- công cụ
    console.log(
      `Lv25: ${picked.moves} nước · ${L.rows}×${L.cols} · ${(L.playable ?? []).length} ô · trống ${
        (L.playable ?? []).length - occupied
      } · ${L.holders.length} khay · mảnh ${L.pieces.map((p) => p.pegs.length).join('+')}` +
        ` · XA min ${picked.far.min} / tb ${picked.far.avg} · MA SÁT ${picked.fric} · đỗ tạm ${picked.park}/${picked.moves}` +
        ` · tham xong: ${greedySolves(L)} · nhìn-trước-1 xong: ${shallowSolves(L)}` +
        ` · ${Math.round(L.timeLimitMs / 1000)}s · ${picked.plan}\n${stats} · ${Date.now() - t0}ms`,
    );
    expect(picked.moves).toBeGreaterThan(0);
  }, 1_800_000);
});
