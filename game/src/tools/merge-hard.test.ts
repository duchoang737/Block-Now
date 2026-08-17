/**
 * Gộp các file `hard-<n>.json` mà `gen-hard.test.ts` sinh ra vào `levels.data.json`
 * VÀ `levels.solutions.json`.
 *   $env:VITE_GEN='1'; npx vitest run src/tools/merge-hard.test.ts
 *
 * Tách khỏi bộ sinh vì bộ sinh chạy SONG SONG nhiều tiến trình; mấy tiến trình cùng
 * ghi một file dữ liệu là mất màn. Ở đây một tiến trình duy nhất đọc kết quả rồi
 * vá vào đúng chỗ, phần còn lại của dãy 50 màn giữ nguyên từng byte.
 *
 * Vì sao phải vá cả LỜI GIẢI: từ Lv10 board là 6×6 đông block, và ở cỡ đó `solve`
 * (BFS ngắn nhất) không tìm nổi lời giải nào — bộ sinh dùng `findSolution` nên chỉ
 * bộ sinh mới có lời giải trong tay. Để `gen-solutions` tự tìm lại là màn vừa dựng
 * xong đã làm đỏ bộ test.
 *
 * Lời giải được REPLAY qua engine thật trước khi vá: file sinh ra từ tiến trình
 * khác, không được tin suông.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { applyMove, createState } from '../core/engine';
import { isCleared } from '../core/rules';
import { enclosedHoles } from '../editor/model';
import type { Move } from '../core/solver';
import type { Level } from '../types';

const LEVELS_FILE = new URL('../levels.data.json', import.meta.url);
const SOLUTIONS_FILE = new URL('../levels.solutions.json', import.meta.url);
const ENABLED = import.meta.env.VITE_GEN === '1';
/**
 * KHOẢNG màn được vá. Mặc định 5..20, nhưng phải khai báo được vì thư mục hay còn
 * đọng `hard-<n>.json` của những lượt dựng trước chưa gộp — vá bừa là đổi màn mà
 * lượt này không hề đụng tới.
 */
const FROM = Number(import.meta.env.VITE_MERGE_FROM ?? 5);
const TO = Number(import.meta.env.VITE_MERGE_TO ?? 20);

describe.runIf(ENABLED)(`gộp màn khó Lv${FROM}..Lv${TO}`, () => {
  it('vá vào levels.data.json + levels.solutions.json', () => {
    const all = JSON.parse(readFileSync(LEVELS_FILE, 'utf8')) as Level[];
    const sols = JSON.parse(readFileSync(SOLUTIONS_FILE, 'utf8')) as Record<string, Move[]>;
    const done: string[] = [];

    for (let n = FROM; n <= TO; n++) {
      const path = new URL(`./hard-${n}.json`, import.meta.url);
      if (!existsSync(path)) continue;
      const raw = JSON.parse(readFileSync(path, 'utf8')) as
        | Level
        | { level: Level; solution: Move[] };
      const lv = 'level' in raw ? raw.level : raw;
      const solution = 'level' in raw ? raw.solution : null;
      // id phải khớp: tiến độ người chơi lưu theo id, đổi id là mất tiến độ.
      expect(lv.id, `Lv${n}`).toBe(all[n - 1].id);
      // Chặn ở đây nữa, vì file này đến từ tiến trình khác: ô bỏ bị vây kín làm
      // khung ngoài vỡ thành hai đường bao (§6).
      expect(enclosedHoles(lv), `Lv${n}: ô bỏ bị vây kín`).toEqual([]);

      if (solution) {
        const state = createState(lv);
        for (const [id, anchor] of solution)
          expect(applyMove(state, id, anchor), `Lv${n}: nước ${id}→[${anchor}] không hợp lệ`).not.toBeNull();
        expect(isCleared(state), `Lv${n}: lời giải không dọn sạch board`).toBe(true);
        expect(state.moves, `Lv${n}: minMoves lệch lời giải`).toBe(lv.minMoves);
        sols[lv.id] = solution;
      }

      all[n - 1] = lv;
      done.push(`Lv${n} ${lv.minMoves} nước`);
    }

    writeFileSync(LEVELS_FILE, `${JSON.stringify(all, null, 2)}\n`, 'utf8');
    writeFileSync(SOLUTIONS_FILE, `${JSON.stringify(sols, null, 1)}\n`, 'utf8');
    // eslint-disable-next-line no-console -- đây là công cụ, báo cáo là đầu ra chính
    console.log(`đã vá: ${done.join(' · ')}`);
    expect(done.length).toBeGreaterThan(0);
  });
});
