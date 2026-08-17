/**
 * CHỮA Ô BỎ BỊ VÂY KÍN trong `levels.data.json` — chạy bằng
 *   $env:VITE_FIX='1'; npx vitest run src/tools/fix-holes.test.ts
 *
 * Vì sao phải chữa: xem `enclosedHoles` trong `editor/model.ts`. Tóm lại, ô bỏ bị
 * vây kín đẻ ra một đường bao thứ hai lọt giữa board, không cách vẽ nào làm nó
 * liền với khung ngoài được.
 *
 * Hai cách chữa, và KHÔNG chọn bằng mắt:
 *   · VỊNH — khoét thêm cho thông ra mép. Giữ được hình thù, board CHẬT thêm một ô.
 *   · LẤP  — trả ô đó về ô chơi được. Luôn làm được, nhưng board RỘNG thêm một ô.
 *
 * Cả hai đều đổi số ô trống, tức là đổi thẳng vào độ khó — nên mọi ứng viên phải
 * qua lại `judge` bằng engine thật. Ưu tiên VỊNH, nhưng chỉ khi nó vẫn giải được,
 * không có nhánh sớm tự thua, và vẫn làm người chơi THAM thất bại.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { cellKey, neighbors } from '../core/board';
import { enclosedHoles, occupantAt, playableCells } from '../editor/model';
import { greedySolves, judge, timeFor } from './design';
import { connected } from './build-level';
import type { Cell, Level } from '../types';

const OUT = new URL('../levels.data.json', import.meta.url);

interface Fix {
  kind: 'vịnh' | 'lấp';
  cells: Cell[];
  level: Level;
}

/** Đường ngắn nhất từ ô kín ra mép lưới, chỉ đi qua ô chơi được và TRỐNG. */
function bays(level: Level, hole: Cell): Cell[][] {
  const play = new Set(playableCells(level).map(cellKey));
  const edge = ([r, c]: Cell) => r === 0 || c === 0 || r === level.rows - 1 || c === level.cols - 1;
  const out: Cell[][] = [];
  const seen = new Set([cellKey(hole)]);
  let frontier: { cell: Cell; path: Cell[] }[] = [{ cell: hole, path: [] }];
  while (frontier.length > 0 && out.length === 0) {
    const next: typeof frontier = [];
    for (const node of frontier) {
      for (const nb of neighbors(node.cell)) {
        const k = cellKey(nb);
        if (seen.has(k) || !play.has(k) || occupantAt(level, nb) !== null) continue;
        seen.add(k);
        const path = [...node.path, nb];
        if (edge(nb)) out.push(path);
        else next.push({ cell: nb, path });
      }
    }
    frontier = next;
  }
  return out;
}

function candidates(level: Level, hole: Cell): Fix[] {
  const play = playableCells(level);
  const out: Fix[] = [];
  for (const path of bays(level, hole)) {
    const cut = new Set(path.map(cellKey));
    const left = play.filter((c) => !cut.has(cellKey(c)));
    if (!connected(left)) continue; // vùng chơi được phải LIỀN MỘT KHỐI (§8.2)
    out.push({ kind: 'vịnh', cells: path, level: { ...level, playable: left } });
  }
  out.push({ kind: 'lấp', cells: [hole], level: { ...level, playable: [...play, hole] } });
  return out;
}

const ENABLED = import.meta.env.VITE_FIX === '1';

describe.runIf(ENABLED)('chữa ô bỏ bị vây kín', () => {
  it('khoét thông hoặc lấp, rồi thẩm lại bằng engine', () => {
    const levels = JSON.parse(readFileSync(OUT, 'utf8')) as Level[];
    const report: string[] = [];

    for (let i = 0; i < levels.length; i++) {
      const lv = levels[i];
      const holes = enclosedHoles(lv);
      if (holes.length === 0) continue;

      // Người chơi THAM có xong màn GỐC không. Nếu gốc đã bắt phải tính thì bản
      // chữa cũng phải giữ được — không thì coi như làm hỏng độ khó của màn.
      const wantPlanning = !greedySolves(lv);
      const picks: string[] = [];
      // `work` cộng dồn từng phép chữa: màn có hai ô kín thì ô thứ hai phải chữa
      // TRÊN bản đã chữa ô thứ nhất, không thì phép chữa sau ghi đè phép chữa trước.
      let work: Level = lv;
      let moves = 0;
      let kind = '';

      for (const hole of holes) {
        for (const fix of candidates(work, hole)) {
          const v = judge(fix.level, { needPlanning: false, cap: 25_000 });
          if (!v.ok) {
            picks.push(`${fix.kind} ${JSON.stringify(fix.cells)} ✗ ${v.reasons[0]}`);
            continue;
          }
          if (wantPlanning && v.greedy) {
            picks.push(`${fix.kind} ${JSON.stringify(fix.cells)} ✗ mất độ khó (THAM xong)`);
            continue;
          }
          work = fix.level;
          moves = v.minMoves;
          kind = `${fix.kind} ${JSON.stringify(fix.cells)}`;
          picks.push(`${kind} ✓ ${v.minMoves} nước`);
          break;
        }
      }

      const n = i + 1;
      if (work === lv) {
        report.push(`Lv${n} ${lv.id}: KHÔNG chữa được\n    ${picks.join('\n    ')}`);
        continue;
      }
      levels[i] = { ...work, minMoves: moves, timeLimitMs: timeFor(moves, n) };
      expect(enclosedHoles(levels[i])).toHaveLength(0);
      report.push(
        `Lv${n} ${lv.id}: ${kind}` +
          ` · ${lv.minMoves ?? '?'}→${moves} nước` +
          ` · ${lv.timeLimitMs / 1000}→${levels[i].timeLimitMs / 1000}s`,
      );
    }

    writeFileSync(OUT, `${JSON.stringify(levels, null, 2)}\n`, 'utf8');
    // eslint-disable-next-line no-console -- đây là công cụ, báo cáo là đầu ra chính
    console.log(report.join('\n'));
    expect(levels.flatMap(enclosedHoles)).toHaveLength(0);
  }, 600_000);
});
