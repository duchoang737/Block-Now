/**
 * BỘ SINH MÀN 5..50 — chạy bằng `npx vitest run src/tools/gen-levels.test.ts`.
 *
 * Không phải test; đây là công cụ, đặt dưới dạng test để dùng thẳng engine +
 * solver thật thay vì dựng lại một bản mô phỏng (bản mô phỏng lệch luật là cách
 * chắc chắn nhất để ship màn hỏng).
 *
 * Cách làm: sinh ngẫu nhiên có kiểm soát rồi LỌC bằng `judge`. Không cố dựng màn
 * khó bằng tay — thứ quyết định độ khó ở đây là luật TRƯỢT, mà hệ quả của nó
 * (mảnh nào chắn đường mảnh nào, phải dọn theo thứ tự nào) thì mắt người rất
 * kém đoán, còn máy thì trả lời trong vài mili giây.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { judge, timeFor } from './design';
import { build, rng, type Recipe } from './build-level';
import type { Level } from '../types';

const OUT = new URL('../levels.data.json', import.meta.url);
/** Báo cáo ghi dần từng màn — chạy lâu nên phải nhìn được tiến độ giữa chừng. */
const PROGRESS = new URL('./gen-progress.txt', import.meta.url);

/**
 * KIỂU MÀN. Mỗi kiểu là một bài toán KHÁC CHẤT, không phải cùng một bài chỉnh to nhỏ.
 *
 * Bản trước chỉ có MỘT công thức cho cả 46 màn nên màn nào cũng na ná: hai khay
 * hai ô, mấy chốt lẻ, cùng một cỡ board. Ở đây cỡ khay và hình dạng mảnh được ghi
 * thẳng ra, nên mỗi kiểu ép người chơi nghĩ theo một hướng riêng.
 *
 * Ràng buộc số học: `tổng pieceSizes = tổng holderSizes − stacked` (mỗi lỗ đúng
 * một lớp chốt — §8.1).
 */
type Arch = Pick<Recipe, 'holderSizes' | 'pieceSizes' | 'stacked'> & { name: string };

const ARCHS: Arch[] = [
  // 3 màu, mảnh vừa phải — bài tập đọc bàn cờ
  { name: 'ba màu', holderSizes: [1, 1, 1], pieceSizes: [2, 1], stacked: 0 },
  // khối cứng 3 chốt: to quá không quay đầu nổi trong ngõ hẹp
  { name: 'khối dài', holderSizes: [2, 2], pieceSizes: [3, 1], stacked: 0 },
  // khay 3 ô: phải gom đủ 3 chốt mới nổ, thứ tự bị ép chặt
  { name: 'khay ba ô', holderSizes: [3, 1], pieceSizes: [2, 2], stacked: 0 },
  // shape-in-shape: một chốt phải cắm HAI LẦN ở hai chỗ khác nhau
  { name: 'lồng nhau', holderSizes: [2, 2], pieceSizes: [2, 1], stacked: 1 },
  // 4 màu toàn mảnh nhỏ — rối mắt, phải phân loại trước khi đi
  { name: 'bốn màu', holderSizes: [1, 1, 1, 1], pieceSizes: [2, 1, 1], stacked: 0 },
  // đúng MỘT khối cứng 3 chốt trên board chật
  { name: 'một khối', holderSizes: [2, 1], pieceSizes: [3], stacked: 0 },
  // 5 màu trên board rộng — bài toán phân loại trước, đường đi sau
  { name: 'năm màu', holderSizes: [1, 1, 1, 1, 1], pieceSizes: [2, 2, 1], stacked: 0 },
  // hai khay dài đối nhau: hai dây chuyền 3 bước chạy song song, chen nhau chỗ đứng
  { name: 'hai khay dài', holderSizes: [3, 3], pieceSizes: [3, 3], stacked: 0 },
  // board rộng nhất: 4 màu, khay to, một khối 3 chốt
  { name: 'ngã tư', holderSizes: [2, 2, 2, 1], pieceSizes: [3, 2, 2], stacked: 0 },
];

function recipeFor(n: number): Recipe {
  const t = (n - 5) / 45; // 0 ở Lv5, 1 ở Lv50
  // Xoay vòng kiểu màn theo số màn ⇒ Lv5..10 ra SÁU kiểu khác nhau.
  const arch = ARCHS[(n - 5) % ARCHS.length];
  return {
    ...arch,
    // Chật quá thì BẾ TẮC chứ không phải khó: `free=3` cộng mảnh nhiều chốt làm
    // ~480/500 ứng viên không giải được.
    free: t < 0.35 ? 6 : t < 0.7 ? 5 : 4,
    // Mọi màn từ Lv5 đều phải có ít nhất một nước dọn chỗ bắt buộc.
    extra: t < 0.35 ? 1 : t < 0.7 ? 1 : 2,
    planning: true,
  };
}

/**
 * CHỈ chạy khi gọi có chủ đích:
 *   $env:VITE_GEN='1'; npx vitest run src/tools/gen-levels.test.ts
 *
 * Không có cổng này thì mỗi lần `npm test` là dựng lại toàn bộ 50 màn — vừa mất
 * gần một phút, vừa khiến dữ liệu game đổi sau một lệnh mà ai cũng nghĩ là chỉ đọc.
 */
const ENABLED = import.meta.env.VITE_GEN === '1';
/**
 * Dựng lại MỘT KHÚC thay vì cả dãy:
 *   $env:VITE_GEN='1'; $env:VITE_GEN_FROM='13'; $env:VITE_GEN_TO='13'
 * Màn ngoài khúc giữ nguyên từng byte. Cần vì có lúc chỉ một màn hỏng (ví dụ dính
 * ô bỏ bị vây kín) mà dựng lại cả 46 màn thì mất gần một phút và đổi hết dãy.
 */
const FROM = Number(import.meta.env.VITE_GEN_FROM ?? 5);
const TO = Number(import.meta.env.VITE_GEN_TO ?? 50);

describe.runIf(ENABLED)(`sinh màn ${FROM}..${TO}`, () => {
  it('dựng và lọc bằng engine thật', () => {
    const old = JSON.parse(readFileSync(OUT, 'utf8')) as Level[];
    const out: Level[] = [...old]; // ngoài khúc dựng lại thì giữ nguyên
    const report: string[] = [];

    const t0 = Date.now();
    for (let n = FROM; n <= TO; n++) {
      const rec = recipeFor(n);
      const rand = rng(n * 7919 + 13);
      let best: { level: Level; moves: number; planned: boolean } | null = null;

      // Vòng 1 ĐÒI phải-tính; không ra thì vòng 2 nới điều kiện đó ra, thà có màn
      // dễ hơn là bỏ trống một số trong dãy 50.
      // Trần số lần SOI KỸ: bậc đó tốn tới 21s ở board lớn, không thể chạy vô hạn.
      let deep = 0;
      const why = new Map<string, number>();
      const note = (r: string) => {
        const k = r.split(' —')[0].split(':')[0];
        why.set(k, (why.get(k) ?? 0) + 1);
      };
      for (const planning of rec.planning ? [true, false] : [false]) {
        for (let attempt = 0; attempt < 800 && !best && deep < 5; attempt++) {
          const lv = build(rec, rand, old[n - 1]?.id ?? `lv_${n}`, n);
          if (!lv) continue;
          // sàn = tổng số LỚP chốt; đòi thêm bao nhiêu là đòi bấy nhiêu nước dọn chỗ
          const floor =
            lv.pieces.reduce((s, p) => s + p.pegs.reduce((m, g) => m + g.layers.length, 0), 0) +
            (planning ? rec.extra : 0);
          // lọc nhanh trước — hầu hết ứng viên chết ở đây với giá vài chục ms
          const q = judge(lv, { needPlanning: planning, minMovesAtLeast: floor, quick: true });
          if (!q.ok) {
            note(q.reasons[0]);
            continue;
          }
          // rồi mới soi kỹ bản lọt lưới
          deep++;
          const v = judge(lv, { needPlanning: planning, minMovesAtLeast: floor, cap: 25_000 });
          if (!v.ok) {
            note(`SÂU ${v.reasons[0]}`);
            continue;
          }
          lv.minMoves = v.minMoves;
          lv.timeLimitMs = timeFor(v.minMoves, n);
          best = { level: lv, moves: v.minMoves, planned: planning };
        }
        if (best) break;
      }

      if (!best) {
        const top = [...why.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
        report.push(
          `Lv${n}: KHÔNG dựng được — giữ bản cũ  [${top.map(([k, v]) => `${k}×${v}`).join(', ')}]`,
        );
        // ghi tiến độ CẢ khi trượt: bản trước chỉ ghi lúc thành công, nên loạt màn
        // trượt cuối dãy không để lại dấu vết nào và báo cáo đọc ra như bị cụt.
        writeFileSync(PROGRESS, `${report.join('\n')}\n\n${Date.now() - t0}ms\n`, 'utf8');
        continue;
      }
      out[n - 1] = best.level;
      const L = best.level;
      const occupied =
        L.holders.reduce((s, h) => s + h.cells.length, 0) +
        L.pieces.reduce((s, p) => s + p.pegs.length, 0);
      report.push(
        `Lv${n}: ${String(best.moves).padStart(2)} nước · ${L.rows}×${L.cols}` +
          ` · ${(L.playable ?? []).length} ô · trống ${(L.playable ?? []).length - occupied}` +
          ` · ${L.holders.length} màu · mảnh ${L.pieces.map((p) => p.pegs.length).join('+')}` +
          ` · ${rec.name}${best.planned ? ' · TÍNH' : ''}`,
      );
      writeFileSync(PROGRESS, `${report.join('\n')}\n\n${Date.now() - t0}ms\n`, 'utf8');
    }

    writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
    // eslint-disable-next-line no-console -- đây là công cụ, báo cáo là đầu ra chính
    console.log(report.join('\n'));
    expect(out).toHaveLength(50);
  }, 900_000);
});
