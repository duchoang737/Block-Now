// Bộ TÌM LỜI GIẢI NGẪU NHIÊN (`findSolution`) — GDD §5.0b.
//
// Có test riêng vì nó là cổng duy nhất gác khúc Lv10..20: ở board 6×6 đông block,
// BFS ngắn nhất không tìm nổi lời giải nào, nên "màn này chơi được không" hoàn toàn
// dựa vào hàm này. Nó lệch luật engine một li là cả khúc ship màn không giải được.
import { describe, expect, it } from 'vitest';
import { LEVELS } from '../levels';
import { applyMove, createState } from './engine';
import { isCleared } from './rules';
import { findFrom, findSolution, solve } from './solver';
import type { Move } from './solver';

/** Replay qua ĐÚNG engine — lời giải chỉ có giá trị nếu engine đi được. */
function replays(levelIndex: number, moves: Move[]): boolean {
  const state = createState(LEVELS[levelIndex]);
  for (const [id, anchor] of moves) if (applyMove(state, id, anchor) === null) return false;
  return isCleared(state);
}

describe('findSolution', () => {
  it('tìm được lời giải THẬT cho màn đầu, và engine đi lọt', () => {
    const sol = findSolution(LEVELS[0], { attempts: 200, seed: 1 });
    expect(sol, 'không tìm được lời giải cho Lv1').not.toBeNull();
    expect(replays(0, sol!.moves)).toBe(true);
  });

  it('TẤT ĐỊNH: cùng hạt giống ⇒ cùng lời giải', () => {
    const a = findSolution(LEVELS[2], { attempts: 50, seed: 42 });
    const b = findSolution(LEVELS[2], { attempts: 50, seed: 42 });
    expect(a?.moves).toEqual(b?.moves);
  });

  /**
   * Nó là CHẶN TRÊN, không phải nước ngắn nhất — chỗ này ghi thành test để không ai
   * lỡ tay dùng kết quả của nó như `minMoves` thật ở khúc màn nhỏ, nơi `solve` vẫn
   * chạy được và vẫn là nguồn đúng.
   */
  it('không ngắn hơn lời giải ngắn nhất của solve', () => {
    const best = solve(LEVELS[1], { maxDepth: 16, maxStates: 200_000 });
    const found = findSolution(LEVELS[1], { attempts: 200, seed: 7 });
    expect(best).not.toBeNull();
    expect(found).not.toBeNull();
    expect(found!.moves.length).toBeGreaterThanOrEqual(best!.moves.length);
  });

  it('state đã sạch board ⇒ lời giải rỗng', () => {
    const state = createState(LEVELS[0]);
    const sol = findSolution(LEVELS[0], { attempts: 200, seed: 3 })!;
    for (const [id, anchor] of sol.moves) applyMove(state, id, anchor);
    expect(isCleared(state)).toBe(true);
    expect(findFrom(state)?.moves).toEqual([]);
  });
});
