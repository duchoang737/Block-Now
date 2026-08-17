import { describe, expect, it } from 'vitest';
import { applyMove, createState } from './engine';
import { isCleared, isDead } from './rules';
import { checkDrop } from './board';
import type { Cell, Color, Layer, Level, Shape } from '../types';

const lv = (over: Partial<Level>): Level => ({
  id: 't',
  chapter: 1,
  rows: 4,
  cols: 4,
  timeLimitMs: 60_000,
  holders: [],
  pieces: [],
  ...over,
});

const holder = (id: string, color: Color, cells: Cell[], holes: Shape[]) => ({ id, color, cells, holes });
const peg = (id: string, cell: Cell, layers: Layer[]) => ({ id, cell, layers });
const L = (shape: Shape, color: Color): Layer => ({ shape, color });

describe('R-DEAD — chỉ chết khi KHÔNG BAO GIỜ cắm được nữa', () => {
  /**
   * Board hình chữ L. Khay đỏ-tim ở [0,0]; lối vào duy nhất là [0,1], đang bị
   * mảnh CHẶN (xanh-tròn, không khớp lỗ nào) đứng chắn. Mảnh đỏ-tim ở [1,2].
   *
   *   [0,0]=khay  [0,1]=chặn  [0,2]
   *               [1,1]       [1,2]=đỏ-tim
   *
   * Ngay lúc này KHÔNG có cú thả nào cắm được: đỏ-tim bò tới đâu cũng không kề
   * lỗ. Nhưng chỉ cần mảnh chặn DỌN sang [0,2] là đỏ-tim đi được [1,1] → [0,1]
   * và cắm. Đây đúng là tình huống bản `isDead` một-nước báo thua oan.
   */
  const stuckThenFree = () =>
    createState(
      lv({
        rows: 2,
        cols: 3,
        playable: [[0, 0], [0, 1], [0, 2], [1, 1], [1, 2]],
        holders: [holder('k', 'red', [[0, 0]], ['heart'])],
        pieces: [
          { id: 'block', pegs: [peg('b', [0, 1], [L('circle', 'blue')])] },
          { id: 'key', pegs: [peg('a', [1, 2], [L('heart', 'red')])] },
        ],
      }),
    );

  it('cần một NƯỚC DỌN CHỖ trước ⇒ CHƯA chết', () => {
    const s = stuckThenFree();
    // xác nhận tiền đề: ngay lúc này thật sự không có cú thả nào cắm được
    const seatsNow = s.pieces.some((p) =>
      [...Array(2)].some((_, r) =>
        [...Array(3)].some((__, c) => checkDrop(s, p, [r, c] as Cell).seats.length > 0),
      ),
    );
    expect(seatsNow).toBe(false);
    expect(isDead(s)).toBe(false);
  });

  it('dọn chỗ xong thì cắm được thật', () => {
    const s = stuckThenFree();
    expect(applyMove(s, 'block', [0, 2])).not.toBeNull();
    const r = applyMove(s, 'key', [0, 1]);
    expect(r?.pluggedLayers).toBe(1);
    expect(r?.poppedHolders).toEqual(['k']);
  });

  it('bịt luôn lối dọn chỗ ⇒ CHẾT thật', () => {
    // bỏ [0,2] và [1,1]: mảnh chặn hết chỗ nhúc nhích, khay vĩnh viễn không tới được
    const s = createState(
      lv({
        rows: 2,
        cols: 3,
        playable: [[0, 0], [0, 1], [1, 1], [1, 2]],
        holders: [holder('k', 'red', [[0, 0]], ['heart'])],
        pieces: [
          { id: 'block', pegs: [peg('b', [0, 1], [L('circle', 'blue')]), peg('b2', [1, 1], [L('circle', 'blue')])] },
          { id: 'key', pegs: [peg('a', [1, 2], [L('heart', 'red')])] },
        ],
      }),
    );
    expect(isDead(s)).toBe(true);
  });
});

describe('R-DROP — khay là KHỐI ĐẶC, chốt chỉ đứng vào ô trống', () => {
  const build = (layer: Layer) =>
    createState(
      lv({
        holders: [holder('k', 'red', [[0, 0]], ['heart'])],
        pieces: [{ id: 'p', pegs: [peg('g', [3, 0], [layer])] }],
      }),
    );

  it('KHÔNG thả đè lên ô của khay', () => {
    const s = build(L('heart', 'red'));
    expect(applyMove(s, 'p', [0, 0])).toBeNull();
    expect(s.moves).toBe(0);
  });

  it('đứng KỀ khay + khớp cả màu lẫn hình → chốt NHẢY vào lỗ, khay đầy → NỔ', () => {
    const s = build(L('heart', 'red'));
    const r = applyMove(s, 'p', [1, 0]); // ô ngay dưới khay
    expect(r?.pluggedLayers).toBe(1);
    expect(r?.poppedHolders).toEqual(['k']);
    expect(isCleared(s)).toBe(true);
  });

  it('đứng kề nhưng cùng hình KHÁC màu → thả hợp lệ nhưng KHÔNG nhảy', () => {
    const s = build(L('heart', 'blue'));
    const r = applyMove(s, 'p', [1, 0]);
    expect(r).not.toBeNull();
    expect(r?.pluggedLayers).toBe(0);
    expect(s.holders[0].filled).toEqual([false]);
  });

  it('đứng kề nhưng cùng màu KHÁC hình → không nhảy', () => {
    const s = build(L('circle', 'red'));
    expect(applyMove(s, 'p', [1, 0])?.pluggedLayers).toBe(0);
  });

  it('đứng xa khay → không nhảy (kề cạnh mới tính)', () => {
    const s = build(L('heart', 'red'));
    expect(applyMove(s, 'p', [2, 0])?.pluggedLayers).toBe(0);
  });

  it('mảnh là KHỐI CỨNG: một chốt rơi vào ô đặc là hỏng cả cú thả', () => {
    const s = createState(
      lv({
        holders: [holder('k', 'red', [[0, 1]], ['heart'])],
        pieces: [
          { id: 'p', pegs: [peg('a', [3, 0], [L('heart', 'red')]), peg('b', [3, 1], [L('heart', 'red')])] },
        ],
      }),
    );
    // anchor (0,0) → chốt b rơi trúng ô khay (0,1) ⇒ từ chối
    expect(applyMove(s, 'p', [0, 0])).toBeNull();
    // đứng hàng dưới thì được, và chốt b kề khay nên nhảy vào
    const r = applyMove(s, 'p', [1, 0]);
    expect(r?.pluggedLayers).toBe(1);
    expect(r?.transfers[0].pegId).toBe('b');
  });
});

describe('R-SEAT — nhiều chốt nhảy trong MỘT cú thả', () => {
  it('mảnh 2 chốt đứng dưới khay 2 lỗ → nhảy cả hai, khay nổ', () => {
    const s = createState(
      lv({
        holders: [holder('k', 'green', [[0, 1], [0, 2]], ['diamond', 'diamond'])],
        pieces: [{ id: 'p', pegs: [peg('a', [3, 1], [L('diamond', 'green')]), peg('b', [3, 2], [L('diamond', 'green')])] }],
      }),
    );
    const r = applyMove(s, 'p', [1, 1]);
    expect(r?.clearedPegs.sort()).toEqual(['a', 'b']);
    expect(r?.poppedHolders).toEqual(['k']);
    expect(s.pieces[0].gone).toBe(true);
  });

  it('một chốt kề HAI khay khác nhau → nhảy sang khay đúng luật reading order', () => {
    const s = createState(
      lv({
        rows: 3,
        cols: 3,
        holders: [
          holder('k_left', 'blue', [[1, 0]], ['circle']),
          holder('k_right', 'blue', [[1, 2]], ['circle']),
        ],
        pieces: [{ id: 'p', pegs: [peg('g', [0, 1], [L('circle', 'blue')])] }],
      }),
    );
    const r = applyMove(s, 'p', [1, 1]); // đứng giữa hai khay
    // hướng duyệt: lên · trái · phải · xuống ⇒ khay TRÁI nhận trước
    expect(r?.transfers[0].holderId).toBe('k_left');
    expect(s.holders.find((h) => h.id === 'k_right')!.filled).toEqual([false]);
  });
});

describe('M-LAYER — shape-in-shape', () => {
  it('nhảy lớp ngoài → chốt Ở LẠI đúng ô nó đứng, lộ lớp trong', () => {
    const s = createState(
      lv({
        holders: [holder('k', 'red', [[0, 0]], ['heart'])],
        pieces: [{ id: 'p', pegs: [peg('g', [3, 0], [L('heart', 'red'), L('heart', 'yellow')])] }],
      }),
    );
    const r = applyMove(s, 'p', [1, 0]);
    expect(r?.pluggedLayers).toBe(1);
    const g = s.pieces[0].pegs[0];
    expect(g.removed).toBe(false);
    expect(g.layers).toEqual([L('heart', 'yellow')]);
    expect(s.pieces[0].anchor).toEqual([1, 0]);
    expect(s.holders[0].popped).toBe(true);
  });

  it('combo: lớp trong nhảy luôn vào khay thứ hai nếu cũng đang kề', () => {
    const s = createState(
      lv({
        rows: 3,
        cols: 3,
        holders: [
          holder('k_red', 'red', [[1, 0]], ['heart']),
          holder('k_yel', 'yellow', [[1, 2]], ['heart']),
        ],
        pieces: [{ id: 'p', pegs: [peg('g', [0, 1], [L('heart', 'red'), L('heart', 'yellow')])] }],
      }),
    );
    const r = applyMove(s, 'p', [1, 1]);
    expect(r?.pluggedLayers).toBe(2);
    expect(isCleared(s)).toBe(true);
  });
});

describe('R-UNLINK — "Complete goals to unlink"', () => {
  it('chốt nhảy đi thì chuỗi đứt: phần còn lại tách thành mảnh RỜI NHAU', () => {
    const s = createState(
      lv({
        rows: 3,
        cols: 4,
        holders: [holder('k', 'red', [[0, 1], [0, 2]], ['heart', 'heart'])],
        pieces: [
          {
            id: 'p',
            pegs: [
              peg('y0', [2, 0], [L('square', 'yellow')]),
              peg('r0', [2, 1], [L('heart', 'red')]),
              peg('r1', [2, 2], [L('heart', 'red')]),
              peg('y1', [2, 3], [L('square', 'yellow')]),
            ],
          },
        ],
      }),
    );
    const r = applyMove(s, 'p', [1, 0]);
    expect(r?.pluggedLayers).toBe(2);
    expect(r?.poppedHolders).toEqual(['k']);

    const alive = s.pieces.filter((p) => !p.gone);
    expect(alive).toHaveLength(2);
    expect(alive.map((p) => p.pegs.filter((g) => !g.removed).length)).toEqual([1, 1]);
    expect(alive.map((p) => p.anchor).sort()).toEqual([[1, 0], [1, 3]]);
  });

  it('chốt còn lại vẫn LIỀN NHAU thì KHÔNG tách', () => {
    const s = createState(
      lv({
        rows: 3,
        cols: 4,
        holders: [holder('k', 'red', [[0, 0]], ['heart'])],
        pieces: [
          {
            id: 'p',
            pegs: [
              peg('r0', [2, 0], [L('heart', 'red')]),
              peg('y0', [2, 1], [L('square', 'yellow')]),
              peg('y1', [2, 2], [L('square', 'yellow')]),
            ],
          },
        ],
      }),
    );
    applyMove(s, 'p', [1, 0]);
    expect(s.pieces.filter((p) => !p.gone)).toHaveLength(1);
  });
});

describe('R-POP / R-ICE', () => {
  it('mỗi lần khay NỔ → mọi ice giảm 1; về 0 thì vỡ', () => {
    const s = createState(
      lv({
        rows: 5,
        cols: 5,
        obstacles: [{ kind: 'ice', cells: [[4, 4]], count: 2 }],
        holders: [holder('k1', 'red', [[0, 0]], ['heart']), holder('k2', 'blue', [[0, 2]], ['circle'])],
        pieces: [
          { id: 'p1', pegs: [peg('a', [3, 0], [L('heart', 'red')])] },
          { id: 'p2', pegs: [peg('b', [3, 2], [L('circle', 'blue')])] },
        ],
      }),
    );
    applyMove(s, 'p1', [1, 0]);
    expect(s.obstacles[0].count).toBe(1);
    applyMove(s, 'p2', [1, 2]);
    expect(s.obstacles[0].cleared).toBe(true);
  });

  it('KHÔNG thả được chốt lên ô băng', () => {
    const s = createState(
      lv({
        rows: 4,
        cols: 1,
        obstacles: [{ kind: 'ice', cells: [[1, 0]], count: 1 }],
        holders: [holder('k', 'red', [[0, 0]], ['heart'])],
        pieces: [{ id: 'p', pegs: [peg('g', [3, 0], [L('heart', 'red')])] }],
      }),
    );
    expect(applyMove(s, 'p', [1, 0])).toBeNull();
    expect(applyMove(s, 'p', [2, 0])).not.toBeNull(); // đứng được nhưng chưa kề khay
    expect(s.holders[0].filled).toEqual([false]);
  });
});

describe('R-DEAD', () => {
  it('không cú thả nào nhảy được → kẹt', () => {
    const s = createState(
      lv({
        rows: 3,
        cols: 3,
        holders: [holder('k', 'red', [[0, 0]], ['heart'])],
        pieces: [{ id: 'p', pegs: [peg('g', [2, 2], [L('circle', 'blue')])] }],
      }),
    );
    expect(isDead(s)).toBe(true);
  });

  it('còn cú thả nhảy được → chưa kẹt', () => {
    const s = createState(
      lv({
        rows: 3,
        cols: 3,
        holders: [holder('k', 'red', [[0, 0]], ['heart'])],
        pieces: [{ id: 'p', pegs: [peg('g', [2, 2], [L('heart', 'red')])] }],
      }),
    );
    expect(isDead(s)).toBe(false);
  });
});

describe('checkDrop — preview phải khớp kết quả thật (GDD §4)', () => {
  it('dry-run không đổi state và dự đoán đúng', () => {
    const s = createState(
      lv({
        holders: [holder('k', 'green', [[0, 1], [0, 2]], ['diamond', 'diamond'])],
        pieces: [{ id: 'p', pegs: [peg('a', [3, 1], [L('diamond', 'green')]), peg('b', [3, 2], [L('diamond', 'green')])] }],
      }),
    );
    const preview = checkDrop(s, s.pieces[0], [1, 1]);
    expect(preview.ok).toBe(true);
    expect(preview.seats.map((x) => x.pegId).sort()).toEqual(['a', 'b']);
    expect(s.holders[0].filled).toEqual([false, false]);

    const actual = applyMove(s, 'p', [1, 1])!;
    expect(actual.transfers.map((t) => t.pegId).sort()).toEqual(['a', 'b']);
  });
});
