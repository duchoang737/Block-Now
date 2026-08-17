import { describe, expect, it } from 'vitest';
import * as engine from './engine';
import { applyMove, cloneState, createState, hashState } from './engine';
import { checkDrop, validAnchors } from './board';
import { Session } from '../session/session';
import type { Cell, Level } from '../types';

const base: Level = {
  id: 'e',
  chapter: 1,
  rows: 4,
  cols: 3,
  timeLimitMs: 60_000,
  holders: [{ id: 'k', color: 'red', cells: [[0, 0]], holes: ['heart'] }],
  pieces: [{ id: 'p', pegs: [{ id: 'g', cell: [3, 0], layers: [{ shape: 'heart', color: 'red' }] }] }],
};

describe('R-MOVE — kéo TỰ DO, không có đường đi (xác minh bằng video)', () => {
  it('mảnh nhảy thẳng qua vùng bị chắn kín mà không cần lối đi trống', () => {
    const level: Level = {
      ...base,
      pieces: [
        base.pieces[0],
        {
          id: 'wall',
          pegs: [
            { id: 'w0', cell: [2, 0], layers: [{ shape: 'star', color: 'purple' }] },
            { id: 'w1', cell: [2, 1], layers: [{ shape: 'star', color: 'purple' }] },
          ],
        },
      ],
    };
    const s = createState(level);
    expect(applyMove(s, 'p', [1, 0])).not.toBeNull();
    expect(s.holders[0].popped).toBe(true);
  });

  it('không thả chồng lên mảnh khác', () => {
    const level: Level = {
      ...base,
      pieces: [
        base.pieces[0],
        { id: 'other', pegs: [{ id: 'o', cell: [1, 1], layers: [{ shape: 'star', color: 'purple' }] }] },
      ],
    };
    const s = createState(level);
    expect(applyMove(s, 'p', [1, 1])).toBeNull();
  });

  it('không thả chồng lên KHAY', () => {
    const s = createState(base);
    expect(applyMove(s, 'p', [0, 0])).toBeNull();
  });

  it('không thả ra ngoài silhouette', () => {
    const s = createState({ ...base, playable: [[0, 0], [1, 0], [2, 0], [3, 0]] as Cell[] });
    expect(applyMove(s, 'p', [1, 1])).toBeNull();
    expect(applyMove(s, 'p', [1, 0])).not.toBeNull();
  });

  /**
   * Luật TRƯỢT lật ngược hành vi này. Bản đầu mảnh được NHẤC rồi thả xuống bất kỳ
   * ô hợp lệ nào, nên sang panel rời được. Chủ dự án chốt mảnh phải trượt và các
   * khối tương tác với nhau, nên hai panel không chạm nhau là hai thế giới tách
   * biệt — giữ nguyên test cũ là khoá chặt đúng cái luật đã bị bỏ.
   */
  it('board NHIỀU PANEL RỜI NHAU: KHÔNG trượt sang được', () => {
    const level: Level = {
      id: 'panels',
      chapter: 1,
      rows: 2,
      cols: 5,
      playable: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 3], [1, 3], [0, 4], [1, 4]] as Cell[],
      timeLimitMs: 60_000,
      holders: [{ id: 'k', color: 'red', cells: [[0, 4]], holes: ['heart'] }],
      pieces: [{ id: 'p', pegs: [{ id: 'g', cell: [1, 0], layers: [{ shape: 'heart', color: 'red' }] }] }],
    };
    const s = createState(level);
    expect(applyMove(s, 'p', [1, 4])).toBeNull();
    expect(s.holders[0].popped).toBe(false);
    // trong CÙNG panel thì vẫn trượt được bình thường
    expect(applyMove(s, 'p', [0, 1])).not.toBeNull();
  });

  it('nước đi không đổi chỗ → null (không tính là một nước)', () => {
    const s = createState(base);
    expect(applyMove(s, 'p', [3, 0])).toBeNull();
    expect(s.moves).toBe(0);
  });

  it('validAnchors chỉ trả về ô thả hợp lệ và không gồm ô của khay', () => {
    const s = createState(base);
    const anchors = validAnchors(s, 'p');
    expect(anchors.every((a) => checkDrop(s, s.pieces[0], a).ok)).toBe(true);
    expect(anchors.some((a) => a[0] === 0 && a[1] === 0)).toBe(false);
    expect(anchors.some((a) => a[0] === 1 && a[1] === 0)).toBe(true);
  });
});

describe('R-DETERMINISTIC — một nước = (pieceId, ô đích)', () => {
  it('cùng nước trên hai bản sao → hash giống hệt', () => {
    const a = createState(base);
    const b = cloneState(a);
    applyMove(a, 'p', [2, 0]);
    applyMove(b, 'p', [2, 0]);
    expect(hashState(a)).toBe(hashState(b));
  });

  it('cloneState không chia sẻ state đột biến', () => {
    const a = createState(base);
    const b = cloneState(a);
    applyMove(a, 'p', [1, 0]);
    expect(hashState(a)).not.toBe(hashState(b));
    expect(b.holders[0].popped).toBe(false);
  });

  it('hash không phụ thuộc thứ tự mảnh trong mảng (sau khi tách)', () => {
    const a = createState(base);
    const b = cloneState(a);
    b.pieces = [...b.pieces].reverse();
    expect(hashState(a)).toBe(hashState(b));
  });
});

describe('R-NO-UNDO — không có undo ở bất kỳ tầng nào', () => {
  it('engine không export undo và không giữ lịch sử', () => {
    expect(Object.keys(engine)).not.toContain('undo');
    const s = createState(base);
    expect(Object.keys(s)).not.toContain('history');
    expect(Object.keys(s)).not.toContain('undoStack');
  });

  it('Session không có method undo', () => {
    const session = new Session(base);
    expect((session as unknown as Record<string, unknown>).undo).toBeUndefined();
    expect(Object.getOwnPropertyNames(Session.prototype)).not.toContain('undo');
  });
});
