// Cổng chất lượng level — GDD §8 (data invariant) + §5 (giải được, ngân sách thời gian).
import { describe, expect, it } from 'vitest';
import { LEVELS } from './levels';
import solutionData from './levels.solutions.json';
import { deadPieces, initialFreeSeats, validateLevel } from './core/validate';
import { applyMove, createState } from './core/engine';
import { isCleared, isDead } from './core/rules';
import { enclosedHoles } from './editor/model';
import type { Cell } from './types';

/**
 * Lời giải NGẮN NHẤT của mọi màn — sinh bằng `core/solver.ts` (BFS theo tầng),
 * không viết tay. Test dưới đây replay chúng qua ĐÚNG engine, nên nếu solver và
 * engine lệch nhau một li thì test đỏ.
 */
const SOLUTIONS = solutionData as unknown as Record<string, [string, Cell][]>;

describe.each(LEVELS)('level $id', (level) => {
  it('pass ràng buộc data §8', () => {
    expect(validateLevel(level)).toEqual([]);
  });

  it('không có mảnh chết', () => {
    expect(deadPieces(level)).toEqual([]);
  });

  it('không chốt nào đứng sẵn cạnh lỗ khớp (bẫy với luật không-Undo)', () => {
    expect(initialFreeSeats(level)).toEqual([]);
  });

  /**
   * Ràng buộc HÌNH VẼ, nhưng phải chặn ở DỮ LIỆU. Khung ngoài dựng bằng cách phình
   * vùng chơi được rồi bo góc, nên nó là ĐƯỜNG BAO của vùng đó — một ô bỏ bị vây
   * kín sinh thêm đường bao thứ hai lọt giữa board, đọc ra "một hình dán vào giữa"
   * chứ không phải tường. Không cách vẽ nào chữa được (đã thử khoét tròn, khoét
   * vuông, bo mượt), nên chỗ khoét bắt buộc phải THÔNG RA MÉP.
   */
  it('không ô bỏ nào bị vây kín — tường phải là MỘT nét từ ngoài vào trong', () => {
    expect(enclosedHoles(level)).toEqual([]);
  });

  it('giải được bằng lời giải đã ghi, và đúng minMoves', () => {
    const moves = SOLUTIONS[level.id];
    expect(moves, `thiếu lời giải cho ${level.id}`).toBeDefined();

    const state = createState(level);
    moves.forEach(([id, anchor], idx) => {
      const result = applyMove(state, id, anchor);
      expect(result, `nước ${idx + 1} (${id} → ${anchor}) không hợp lệ`).not.toBeNull();
      if (idx < moves.length - 1) expect(isDead(state)).toBe(false);
    });

    expect(isCleared(state)).toBe(true);
    expect(state.moves).toBe(level.minMoves);
  });

  it('ngân sách thời gian §5.3 — timeLimit đủ cho người thật', () => {
    expect(level.timeLimitMs).toBeGreaterThanOrEqual((level.minMoves ?? 0) * 4000 + 20000);
  });

  it('không kẹt ngay ở state đầu', () => {
    expect(isDead(createState(level))).toBe(false);
  });
});

describe('lv_03 — hai panel + thứ tự bị ép bởi chỗ đứng', () => {
  const level = LEVELS.find((l) => l.id === 'lv_03')!;

  it('KHÔNG thả được đè lên khay (khay là khối đặc)', () => {
    const state = createState(level);
    expect(applyMove(state, 'pL_circle', [1, 0])).toBeNull();
  });

  it('mảnh đỏ phải chờ khay xanh nổ mới có chỗ đứng dưới khay đỏ', () => {
    const state = createState(level);
    // hàng 1 đang là khay xanh ⇒ chưa đứng được
    expect(applyMove(state, 'pL_heart', [1, 0])).toBeNull();

    applyMove(state, 'pL_circle', [2, 0]);
    expect(state.holders.find((h) => h.id === 'kL_blue')!.popped).toBe(true);

    expect(applyMove(state, 'pL_heart', [1, 0])).not.toBeNull();
    expect(state.holders.find((h) => h.id === 'kL_red')!.popped).toBe(true);
  });
});

/**
 * Hai bộ test bám nội dung cụ thể của `lv_c3_25` (shape-in-shape) và `lv_c4_ice`
 * (băng) đã BỎ: hai màn đó nằm trong khoảng 5..50 vừa được dựng lại, nên các id
 * mảnh/khay mà chúng khẳng định (`p_heart`, `k_red`, `p_main`…) không còn tồn tại.
 *
 * Luật của hai cơ chế đó vẫn được khoá bằng test riêng ở `core/rules.test.ts`,
 * chỗ dựng board tại chỗ thay vì dựa vào một màn cụ thể — đúng chỗ nó nên nằm.
 */
