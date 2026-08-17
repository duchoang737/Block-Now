/**
 * Sinh `levels.solutions.json` — lời giải NGẮN NHẤT của mọi màn.
 *   npx vitest run src/tools/gen-solutions.test.ts
 *
 * Không viết tay: `levels.test.ts` replay đúng những nước này qua ENGINE THẬT, nên
 * lời giải viết tay mà lệch luật một li là test đỏ — và đó chính là chỗ ta muốn
 * test đỏ, vì nó bắt được lúc solver và engine trôi ra khỏi nhau.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { applyMove, createState } from '../core/engine';
import { isCleared } from '../core/rules';
import { findSolution, solve, type Move } from '../core/solver';
import type { Level } from '../types';

const LEVELS_FILE = new URL('../levels.data.json', import.meta.url);
const OUT = new URL('../levels.solutions.json', import.meta.url);

/** Lời giải cũ có còn chạy qua engine THẬT và dọn sạch board không. */
function replays(level: Level, moves: Move[]): boolean {
  const state = createState(level);
  for (const [id, anchor] of moves) if (applyMove(state, id, anchor) === null) return false;
  return isCleared(state);
}

/** Cùng cổng với `gen-levels`: `$env:VITE_GEN='1'` mới chạy. */
const ENABLED = import.meta.env.VITE_GEN === '1';

describe.runIf(ENABLED)('sinh lời giải', () => {
  it('mọi màn phải giải được', () => {
    const levels = JSON.parse(readFileSync(LEVELS_FILE, 'utf8')) as Level[];
    const old = JSON.parse(readFileSync(OUT, 'utf8')) as Record<string, Move[]>;
    const out: Record<string, unknown> = {};
    const fail: string[] = [];

    for (const level of levels) {
      // 1) Lời giải ĐÃ CÓ mà replay qua engine vẫn sạch board và đúng `minMoves` thì
      //    GIỮ. Bắt buộc từ Lv10: board 6×6 đông block nên `solve` (BFS ngắn nhất)
      //    không tìm nổi lời giải nào ở cỡ đó — lời giải duy nhất ta có là bản
      //    `findSolution` tìm ra lúc dựng màn, và tìm lại là mất.
      const kept = old[level.id];
      if (kept && replays(level, kept) && kept.length === level.minMoves) {
        out[level.id] = kept;
        continue;
      }
      // 2) Chưa có thì tìm mới: BFS ngắn nhất trước, không ra thì tới bộ tìm ngẫu nhiên.
      const sol =
        solve(level, { maxDepth: 16, maxStates: 200_000 }) ??
        findSolution(level, { attempts: 300, maxDepth: 26, seed: 20260814 });
      if (!sol) {
        fail.push(`${level.id}: không tìm được lời giải nào`);
        continue;
      }
      out[level.id] = sol.moves;
      if (sol.moves.length !== level.minMoves) {
        fail.push(`${level.id}: minMoves ghi ${level.minMoves} nhưng solver ra ${sol.moves.length}`);
      }
    }

    writeFileSync(OUT, `${JSON.stringify(out, null, 1)}\n`, 'utf8');
    // eslint-disable-next-line no-console -- đây là công cụ, báo cáo là đầu ra chính
    console.log(`đã ghi ${Object.keys(out).length} lời giải` + (fail.length ? `\nLỖI:\n${fail.join('\n')}` : ''));
    expect(fail).toEqual([]);
  }, 900_000);
});
