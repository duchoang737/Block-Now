/**
 * Vá lại LỜI GIẢI của những màn mà lời giải đã ghi không còn replay được.
 *   $env:VITE_GEN='1'; npx vitest run src/tools/fix-solutions.test.ts
 *
 * Vì sao cần, thay vì chạy `gen-solutions`: `gen-solutions` tìm lại lời giải cho
 * TOÀN BỘ 50 màn bằng BFS ngắn nhất, mà từ Lv10 board đông tới mức BFS không tìm
 * nổi — chạy nó là xoá mất đúng những lời giải chỉ bộ sinh mới có. Ở đây chỉ đụng
 * vào màn thật sự hỏng, và mỗi màn thử BFS trước rồi mới tới bộ tìm ngẫu nhiên.
 *
 * Màn hỏng ở đây sinh ra từ một chỗ có thật: bản `gen-hard` đời đầu chỉ ghi ra
 * LEVEL chứ chưa ghi lời giải kèm, nên Lv5..Lv9 bị thay board mà `levels.solutions
 * .json` vẫn giữ lời giải của board cũ.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { applyMove, createState } from '../core/engine';
import { isCleared } from '../core/rules';
import { findSolution, solve, type Move } from '../core/solver';
import type { Level } from '../types';

const LEVELS_FILE = new URL('../levels.data.json', import.meta.url);
const SOLUTIONS_FILE = new URL('../levels.solutions.json', import.meta.url);
const ENABLED = import.meta.env.VITE_GEN === '1';

/** Chạy thử lời giải qua ENGINE THẬT. Trả về số nước, hoặc null nếu hỏng. */
function replay(level: Level, moves: Move[]): number | null {
  const state = createState(level);
  for (const [id, anchor] of moves) {
    if (applyMove(state, id, anchor) === null) return null;
  }
  return isCleared(state) ? state.moves : null;
}

describe.runIf(ENABLED)('vá lời giải hỏng', () => {
  it('mọi màn phải replay được qua engine', () => {
    const levels = JSON.parse(readFileSync(LEVELS_FILE, 'utf8')) as Level[];
    const sols = JSON.parse(readFileSync(SOLUTIONS_FILE, 'utf8')) as Record<string, Move[]>;
    const fixed: string[] = [];
    const failed: string[] = [];

    for (const level of levels) {
      const current = sols[level.id];
      if (current && replay(level, current) === level.minMoves) continue;

      // BFS trước — nó cho lời giải NGẮN NHẤT, tức `minMoves` giữ đúng nghĩa.
      const bfs = solve(level, { maxDepth: 16, maxStates: 200_000 });
      const found = bfs ?? findSolution(level, { attempts: 400, maxDepth: 30 });
      if (!found) {
        failed.push(level.id);
        continue;
      }

      const n = replay(level, found.moves);
      if (n === null) {
        failed.push(`${level.id} (lời giải mới cũng không replay được)`);
        continue;
      }

      sols[level.id] = found.moves;
      const was = level.minMoves;
      level.minMoves = n;
      // §5.3 — sàn thời gian bám theo minMoves, đổi nước là phải soát lại đồng hồ.
      const floor = n * 4000 + 20000;
      if (level.timeLimitMs < floor) level.timeLimitMs = Math.ceil((floor * 2) / 5000) * 5000;
      fixed.push(`${level.id}: ${was} → ${n} nước${bfs ? '' : ' (dense)'}`);
    }

    writeFileSync(LEVELS_FILE, `${JSON.stringify(levels, null, 2)}\n`, 'utf8');
    writeFileSync(SOLUTIONS_FILE, `${JSON.stringify(sols, null, 1)}\n`, 'utf8');
    // eslint-disable-next-line no-console -- đây là công cụ, báo cáo là đầu ra chính
    console.log(`đã vá ${fixed.length}: ${fixed.join(' · ')}`);
    expect(failed).toEqual([]);
  }, 900_000);
});
