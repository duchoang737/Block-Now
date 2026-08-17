/**
 * ĐO chi phí thật của từng bậc lọc ở board 6×6 đông block.
 *   $env:VITE_PROBE='1'; npx vitest run src/tools/probe.test.ts
 *
 * Có nó vì lần đầu thử khúc Lv11..20 chỉ dựng nổi 1 ứng viên trong 247 giây, mà
 * báo cáo không nói được thời gian đi đâu. Đoán mò tham số ở đây tốn hàng chục
 * phút một vòng, nên phải đo.
 */
import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { createState } from '../core/engine';
import { findSolution, successors } from '../core/solver';
import { greedySolves } from './design';
import { build, buildStats, rng, type Recipe } from './build-level';
import type { Level } from '../types';

const rec = (
  name: string,
  holderSizes: number[],
  pieceSizes: number[],
  stacked: number,
  free: number,
  rows: number,
  cols: number,
): Recipe => ({ name, holderSizes, pieceSizes, stacked, free, rows, cols, extra: 0, planning: true });

const CASES: Recipe[] = [
  rec('6×6 · 6 khay · 12 lỗ · 8 mảnh · trống 8', [2, 2, 2, 2, 2, 2], [2, 2, 2, 2, 1, 1, 1, 1], 0, 8, 6, 6),
  rec('6×6 · 6 khay · 12 lỗ · 9 mảnh · trống 10', [2, 2, 2, 2, 2, 2], [2, 2, 2, 1, 1, 1, 1, 1, 1], 0, 10, 6, 6),
  rec('6×6 · 6 khay · 13 lỗ · 8 mảnh · trống 9', [3, 2, 2, 2, 2, 2], [2, 2, 2, 2, 2, 1, 1, 1], 0, 9, 6, 6),
  rec('6×6 · 7 khay · 14 lỗ · 8 mảnh · trống 8', [2, 2, 2, 2, 2, 2, 2], [2, 2, 2, 2, 2, 2, 1, 1], 0, 8, 6, 6),
  rec('6×6 · 7 khay · 14 lỗ · 10 mảnh · trống 6', [2, 2, 2, 2, 2, 2, 2], [2, 2, 2, 2, 1, 1, 1, 1, 1, 1], 0, 6, 6, 6),
];

const ENABLED = import.meta.env.VITE_PROBE === '1';

describe.runIf(ENABLED)('đo chi phí lọc', () => {
  it('dựng · động · tham · solve', () => {
    const lines: string[] = [];
    for (const [ci, r] of CASES.entries()) {
      for (const k of Object.keys(buildStats)) delete buildStats[k];
      const rand = rng(ci * 104729 + 13);
      const built: Level[] = [];
      const t0 = Date.now();
      // dựng cho tới khi có 20 ứng viên hoặc hết 20 giây
      for (let i = 0; i < 200_000 && built.length < 20 && Date.now() - t0 < 20_000; i++) {
        const lv = build(r, rand, 'probe', 10);
        if (lv) built.push(lv);
      }
      const tBuild = Date.now() - t0;

      let moved = 0;
      let greedyWins = 0;
      let succAvg = 0;
      for (const lv of built) {
        const s = successors(createState(lv));
        succAvg += s.length;
        if (s.length >= 6 && s.some((x) => x.seated > 0)) moved++;
        if (greedySolves(lv)) greedyWins++;
      }
      succAvg = built.length ? succAvg / built.length : 0;

      // `findSolution` trên MỌI ứng viên động — bậc đắt nhất, đo riêng
      const solveTimes: string[] = [];
      let found = 0;
      for (const [li, lv] of built.entries()) {
        const s = successors(createState(lv));
        if (s.length < 6 || !s.some((x) => x.seated > 0)) continue;
        const t = Date.now();
        const sol = findSolution(lv, { attempts: 60, maxDepth: 24, seed: li * 7919 + 1 });
        if (sol) found++;
        solveTimes.push(`${sol ? `${sol.moves.length}n` : 'X'}/${Date.now() - t}ms`);
      }
      solveTimes.push(`⇒ ${found} giải được`);

      const dead = Object.entries(buildStats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([k, v]) => `${k}×${v}`)
        .join(', ');
      lines.push(
        `${r.name}\n  dựng ${built.length} trong ${tBuild}ms · động ${moved}` +
          ` · tham thắng ${greedyWins} · nhánh TB ${succAvg.toFixed(1)}` +
          `\n  solve: ${solveTimes.join(' · ') || '(không có ứng viên động)'}` +
          `\n  chết: ${dead || '(không)'}`,
      );
    }
    // Ghi ra FILE, không chỉ console: chạy qua PowerShell thì stdout của vitest có
    // lúc không về tới nơi, mà một lượt đo ở đây tốn gần mười phút — mất báo cáo là
    // mất luôn mười phút đó.
    writeFileSync(new URL('./probe-out.txt', import.meta.url), `${lines.join('\n')}\n`, 'utf8');
    // eslint-disable-next-line no-console -- đây là công cụ đo, báo cáo là đầu ra chính
    console.log(lines.join('\n'));
    expect(lines).toHaveLength(CASES.length);
  }, 900_000);
});
