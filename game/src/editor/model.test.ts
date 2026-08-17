import { describe, expect, it } from 'vitest';
import { playableSet } from '../core/board';
import { validateLevel } from '../core/validate';
import {
  canMove,
  cellsKey,
  emptyLevel,
  enclosedHoles,
  eraseAt,
  exportLevel,
  moveObject,
  objectAt,
  occupantAt,
  paintHolder,
  paintPeg,
  peelPeg,
  playableCells,
  resize,
  setTime,
  toggleCell,
} from './model';
import type { Cell, Level } from '../types';

const lv = () => emptyLevel(4, 4);

describe('hình board', () => {
  it('tắt ô thì ô đó biến khỏi playable', () => {
    const a = toggleCell(lv(), [0, 1]);
    expect(playableCells(a)).toHaveLength(15);
    expect(cellsKey(playableCells(a))).not.toContain('0,1');
  });

  it('bật lại ô đã tắt', () => {
    const a = toggleCell(toggleCell(lv(), [0, 1]), [0, 1]);
    expect(playableCells(a)).toHaveLength(16);
  });

  /**
   * Ràng buộc HÌNH HỌC, không phải thẩm mỹ vặt: khung ngoài là đường bao của vùng
   * chơi được, nên ô bỏ bị vây kín đẻ ra một đường bao THỨ HAI lọt giữa board. Chặn
   * ở đây thay vì cố vẽ cho khéo — đã thử khoét tròn/vuông/bo mượt, không cách nào
   * làm hai đường bao rời nhau thành một nét.
   */
  it('KHÔNG cho tắt ô giữa board — sinh ra ô bỏ bị vây kín', () => {
    const before = lv();
    const after = toggleCell(before, [1, 1]);
    expect(after).toBe(before); // từ chối hẳn, không đổi gì
    expect(enclosedHoles(after)).toHaveLength(0);
  });

  it('KHÔNG cho bật ô bịt nốt lối thông cuối cùng của chỗ khoét', () => {
    // khoét từ mép vào: (0,1) rồi (1,1) — lúc này (1,1) vẫn thông ra mép qua (0,1)
    let l = toggleCell(toggleCell(lv(), [0, 1]), [1, 1]);
    expect(playableCells(l)).toHaveLength(14);
    // bật lại (0,1) thì (1,1) bị vây kín ⇒ phải từ chối
    const sealed = toggleCell(l, [0, 1]);
    expect(sealed).toBe(l);
    // nhưng lấp (1,1) trước rồi bật (0,1) thì được
    l = toggleCell(toggleCell(l, [1, 1]), [0, 1]);
    expect(playableCells(l)).toHaveLength(16);
  });

  it('khoét thành VỊNH thì vẫn được — vùng bỏ thông ra mép', () => {
    const l = [[0, 1], [1, 1], [2, 1]].reduce((acc, c) => toggleCell(acc, c as Cell), lv());
    expect(playableCells(l)).toHaveLength(13);
    expect(enclosedHoles(l)).toHaveLength(0);
  });

  it('KHÔNG cho tắt ô cuối cùng — board rỗng là dữ liệu vô nghĩa', () => {
    let l: Level = emptyLevel(1, 1);
    l = toggleCell(l, [0, 0]);
    expect(playableCells(l)).toHaveLength(1);
  });

  /**
   * Đây là cái bẫy chính của editor: `playableSet` nhớ theo WeakMap khoá bằng
   * object level. Sửa tại chỗ thì khung ngoài bám hình cũ.
   */
  it('level MỚI ⇒ playableSet tính lại ⇒ khung ngoài bám hình mới', () => {
    const before = lv();
    expect(playableSet(before).size).toBe(16);
    const after = toggleCell(before, [0, 0]);
    expect(after).not.toBe(before);
    expect(playableSet(after).size).toBe(15);
    expect(playableSet(before).size).toBe(16); // level cũ không bị đụng
  });

  it('tắt ô thì xoá luôn thứ đứng trên đó', () => {
    let l = paintHolder(lv(), [3, 3], 'red', 'heart');
    expect(l.holders).toHaveLength(1);
    l = toggleCell(l, [3, 3]);
    expect(l.holders).toHaveLength(0);
  });
});

describe('đổi cỡ lưới', () => {
  it('cắt bỏ nội dung rơi ra ngoài lưới mới', () => {
    let l = paintHolder(lv(), [3, 3], 'blue', 'circle');
    l = paintPeg(l, [0, 0], 'blue', 'circle');
    l = resize(l, 2, 2);
    expect(l.rows).toBe(2);
    expect(l.holders).toHaveLength(0); // [3,3] rơi ra ngoài
    expect(l.pieces).toHaveLength(1); // [0,0] còn trong lưới
    expect(playableCells(l)).toHaveLength(4);
  });
});

describe('khay', () => {
  it('bấm ô trống ⇒ khay mới 1 ô', () => {
    const l = paintHolder(lv(), [1, 1], 'red', 'heart');
    expect(l.holders).toEqual([{ id: 'k1', color: 'red', cells: [[1, 1]], holes: ['heart'] }]);
  });

  /** Mặc định KHÔNG nối — hai ô kề nhau phải ra hai khay rời. */
  it('hai ô kề nhau MẶC ĐỊNH là hai khay rời', () => {
    let l = paintHolder(lv(), [1, 1], 'red', 'heart');
    l = paintHolder(l, [1, 2], 'red', 'star');
    expect(l.holders).toHaveLength(2);
  });

  it('bật `join` + CÙNG MÀU ⇒ nối dài, không mở khay mới', () => {
    let l = paintHolder(lv(), [1, 1], 'red', 'heart', true);
    l = paintHolder(l, [1, 2], 'red', 'star', true);
    expect(l.holders).toHaveLength(1);
    expect(l.holders[0].cells).toHaveLength(2);
    expect(l.holders[0].holes).toEqual(['heart', 'star']);
  });

  it('khác màu thì KHÔNG nối dù bật `join`', () => {
    let l = paintHolder(lv(), [1, 1], 'red', 'heart', true);
    l = paintHolder(l, [1, 2], 'blue', 'circle', true);
    expect(l.holders).toHaveLength(2);
  });

  it('không nối nếu làm khay gãy khúc (§8.3 thẳng hàng)', () => {
    let l = paintHolder(lv(), [1, 1], 'red', 'heart', true);
    l = paintHolder(l, [1, 2], 'red', 'heart', true);
    l = paintHolder(l, [2, 2], 'red', 'heart', true); // gãy góc
    expect(l.holders).toHaveLength(2);
  });

  it('không nối quá 5 ô (§8.3)', () => {
    let l: Level = emptyLevel(1, 7);
    for (let c = 0; c < 6; c++) l = paintHolder(l, [0, c], 'red', 'heart', true);
    expect(l.holders).toHaveLength(2);
    expect(l.holders[0].cells).toHaveLength(5);
  });

  it('bấm lại lên ô đã có khay ⇒ đổi hình lỗ, không thêm ô', () => {
    let l = paintHolder(lv(), [1, 1], 'red', 'heart');
    l = paintHolder(l, [1, 1], 'red', 'star');
    expect(l.holders[0].cells).toHaveLength(1);
    expect(l.holders[0].holes).toEqual(['star']);
  });

  it('không đè lên ô đang có chốt', () => {
    let l = paintPeg(lv(), [1, 1], 'red', 'heart');
    l = paintHolder(l, [1, 1], 'blue', 'circle');
    expect(l.holders).toHaveLength(0);
  });
});

describe('mảnh', () => {
  /** Mặc định KHÔNG nối — đặt hai chốt cạnh nhau phải ra hai mảnh rời. */
  it('hai chốt kề nhau MẶC ĐỊNH là hai mảnh rời', () => {
    let l = paintPeg(lv(), [0, 0], 'red', 'heart');
    l = paintPeg(l, [0, 1], 'red', 'heart');
    expect(l.pieces).toHaveLength(2);
  });

  it('bật `join` thì mới nhập thành MỘT mảnh', () => {
    let l = paintPeg(lv(), [0, 0], 'red', 'heart', true);
    l = paintPeg(l, [0, 1], 'red', 'heart', true);
    expect(l.pieces).toHaveLength(1);
    expect(l.pieces[0].pegs).toHaveLength(2);
  });

  it('chốt rời nhau thành hai mảnh', () => {
    let l = paintPeg(lv(), [0, 0], 'red', 'heart');
    l = paintPeg(l, [3, 3], 'red', 'heart');
    expect(l.pieces).toHaveLength(2);
  });

  it('bấm lại lên chốt ⇒ đắp thêm lớp', () => {
    let l = paintPeg(lv(), [0, 0], 'red', 'heart');
    l = paintPeg(l, [0, 0], 'yellow', 'star');
    expect(l.pieces[0].pegs[0].layers).toEqual([
      { color: 'red', shape: 'heart' },
      { color: 'yellow', shape: 'star' },
    ]);
  });

  it('bóc lớp trên cùng, hết lớp thì mất chốt', () => {
    let l = paintPeg(lv(), [0, 0], 'red', 'heart');
    l = paintPeg(l, [0, 0], 'yellow', 'star');
    l = peelPeg(l, [0, 0]);
    expect(l.pieces[0].pegs[0].layers).toHaveLength(1);
    l = peelPeg(l, [0, 0]);
    expect(l.pieces).toHaveLength(0);
  });

  /** §8.4: mảnh phải liên thông. Bỏ chốt giữa ⇒ phải TÁCH, không để dữ liệu sai. */
  it('bỏ chốt giữa làm mảnh đứt đôi ⇒ tách thành hai mảnh liên thông', () => {
    let l: Level = emptyLevel(1, 3);
    for (const c of [0, 1, 2]) l = paintPeg(l, [0, c], 'red', 'heart', true);
    expect(l.pieces).toHaveLength(1);
    l = eraseAt(l, [0, 1]);
    expect(l.pieces).toHaveLength(2);
    expect(validateLevel(l).filter((i) => i.rule.startsWith('§8.4'))).toEqual([]);
  });
});

describe('dời chỗ', () => {
  const board = () => {
    let l = paintHolder(lv(), [0, 0], 'red', 'heart', true);
    l = paintHolder(l, [0, 1], 'red', 'heart', true);
    l = paintPeg(l, [3, 0], 'red', 'heart', true);
    l = paintPeg(l, [3, 1], 'red', 'heart', true);
    return l;
  };

  it('dời KHAY là dời cả cụm', () => {
    const l = board();
    const t = objectAt(l, [0, 0])!;
    expect(t).toEqual({ kind: 'holder', id: 'k1' });
    const m = moveObject(l, t, 1, 1);
    expect(m.holders[0].cells).toEqual([[1, 1], [1, 2]]);
  });

  it('dời MẢNH là dời mọi chốt của nó', () => {
    const l = board();
    const t = objectAt(l, [3, 0])!;
    expect(t.kind).toBe('piece');
    const m = moveObject(l, t, -1, 2);
    expect(m.pieces[0].pegs.map((p) => p.cell)).toEqual([[2, 2], [2, 3]]);
  });

  it('không dời ra ngoài board', () => {
    const l = board();
    const t = objectAt(l, [0, 0])!;
    expect(canMove(l, t, -1, 0)).toBe(false);
    expect(moveObject(l, t, -1, 0)).toBe(l);
  });

  it('không dời đè lên thứ khác', () => {
    const l = board();
    const t = objectAt(l, [3, 0])!; // mảnh ở hàng 3
    expect(canMove(l, t, -3, 0)).toBe(false); // hàng 0 đang có khay
    expect(canMove(l, t, -1, 0)).toBe(true);
  });

  it('dời lên ô đã TẮT thì không được', () => {
    let l = board();
    l = toggleCell(l, [1, 0]);
    const t = objectAt(l, [3, 0])!;
    expect(canMove(l, t, -2, 0)).toBe(false);
  });

  it('cụm dời xong vẫn qua được validateLevel', () => {
    const l = board();
    const m = moveObject(l, objectAt(l, [3, 0])!, -1, 0);
    expect(validateLevel(m)).toEqual([]);
  });
});

describe('thời gian', () => {
  it('làm tròn về bước 5 giây', () => {
    expect(setTime(lv(), 97_300).timeLimitMs).toBe(95_000);
  });

  it('kẹp trong 10s..15 phút — §8.7 đòi timeLimitMs > 0', () => {
    expect(setTime(lv(), 0).timeLimitMs).toBe(10_000);
    expect(setTime(lv(), -5_000).timeLimitMs).toBe(10_000);
    expect(setTime(lv(), 99_999_999).timeLimitMs).toBe(900_000);
  });

  it('không đổi thì trả về CHÍNH level cũ', () => {
    const a = lv();
    expect(setTime(a, a.timeLimitMs)).toBe(a);
  });
});

describe('soi ô', () => {
  it('phân biệt khay / chốt / trống', () => {
    let l = paintHolder(lv(), [0, 0], 'red', 'heart');
    l = paintPeg(l, [2, 2], 'blue', 'circle');
    expect(occupantAt(l, [0, 0])?.kind).toBe('holder');
    expect(occupantAt(l, [2, 2])?.kind).toBe('peg');
    expect(occupantAt(l, [3, 3])).toBeNull();
  });
});

describe('xuất JSON', () => {
  it('board đầy ⇒ BỎ trường playable (quy ước §8)', () => {
    const json = JSON.parse(exportLevel(lv()));
    expect(json.playable).toBeUndefined();
    expect(json.obstacles).toBeUndefined();
  });

  it('board khuyết ⇒ liệt kê playable', () => {
    const json = JSON.parse(exportLevel(toggleCell(lv(), [0, 0])));
    expect(json.playable).toHaveLength(15);
  });

  it('màn dựng bằng editor phải qua được validateLevel', () => {
    let l = lv();
    l = paintHolder(l, [0, 0], 'red', 'heart', true);
    l = paintHolder(l, [0, 1], 'red', 'heart', true);
    l = paintPeg(l, [3, 0], 'red', 'heart', true);
    l = paintPeg(l, [3, 1], 'red', 'heart', true);
    l = toggleCell(l, [2, 3]);
    expect(validateLevel(l)).toEqual([]);
    const round: Level = JSON.parse(exportLevel(l));
    expect(validateLevel(round)).toEqual([]);
    expect(cellsKey(playableCells(round))).toBe(cellsKey(playableCells(l)));
  });
});

describe('cân bằng lỗ ↔ lớp', () => {
  it('validate bắt được khi thiếu chốt cho lỗ', () => {
    const l = paintHolder(lv(), [0, 0], 'red', 'heart');
    const issues = validateLevel(l);
    expect(issues.some((i) => i.rule === '§8.1 balance')).toBe(true);
  });
});

describe('không đụng vào level cũ', () => {
  it('mọi phép sửa đều trả về object mới', () => {
    const a = lv();
    const snapshot = JSON.stringify(a);
    const ops: Array<(l: Level) => Level> = [
      (l) => toggleCell(l, [0, 0] as Cell),
      (l) => paintHolder(l, [1, 1] as Cell, 'red', 'heart'),
      (l) => paintPeg(l, [2, 2] as Cell, 'blue', 'circle'),
      (l) => resize(l, 3, 3),
      (l) => eraseAt(l, [1, 1] as Cell),
    ];
    for (const op of ops) expect(op(a)).not.toBe(a);
    expect(JSON.stringify(a)).toBe(snapshot);
  });
});
