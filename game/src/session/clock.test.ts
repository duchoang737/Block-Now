import { describe, expect, it } from 'vitest';
import { Clock } from './clock';
import { Session } from './session';
import type { Level } from '../types';

const level: Level = {
  id: 'clock',
  chapter: 1,
  rows: 4,
  cols: 2,
  timeLimitMs: 10_000,
  holders: [{ id: 'k', color: 'red', cells: [[0, 0]], holes: ['heart'] }],
  pieces: [{ id: 'p', pegs: [{ id: 'g', cell: [3, 0], layers: [{ shape: 'heart', color: 'red' }] }] }],
};

/** Bơm thời gian theo bước nhỏ như một game loop thật. */
function advance(session: Session, from: number, to: number, step = 200): number {
  let t = from;
  while (t < to) {
    t = Math.min(to, t + step);
    session.tick(t);
  }
  return t;
}

describe('Clock — R-TIME', () => {
  it('đếm ngược theo thời gian bơm vào', () => {
    const c = new Clock(5_000, 60_000);
    c.start(0);
    expect(c.update(1_000)).toBe(4_000);
    expect(c.update(3_500)).toBe(1_500);
  });

  it('pause đóng băng thời gian, resume chạy tiếp không nhảy giây', () => {
    const c = new Clock(5_000, 60_000);
    c.start(0);
    c.update(1_000);
    c.pause(1_000);
    expect(c.update(9_000)).toBe(4_000);
    c.resume(9_000);
    expect(c.update(10_000)).toBe(3_000);
  });

  it('CLAMP: một tick sau khi tab bị treo không được nuốt cả màn chơi', () => {
    const c = new Clock(30_000); // maxStep mặc định 250ms
    c.start(0);
    c.update(24_000);
    expect(c.remainingMs).toBe(29_750);
  });

  it('hết giờ thì kẹp ở 0, không âm', () => {
    const c = new Clock(1_000, 60_000);
    c.start(0);
    expect(c.update(5_000)).toBe(0);
    expect(c.expired).toBe(true);
  });

  it('reset trả về mốc gốc', () => {
    const c = new Clock(3_000, 60_000);
    c.start(0);
    c.update(2_000);
    c.reset(2_000);
    expect(c.remainingMs).toBe(3_000);
    expect(c.isRunning).toBe(false);
  });
});

describe('Session — thua vì hết giờ + rewarded +30s', () => {
  it('hết giờ → status timeout, không đi được nước nào nữa', () => {
    const s = new Session(level);
    s.begin(0);
    const t = advance(s, 0, 9_800);
    expect(s.status).toBe('playing');
    expect(s.tick(t + 200)).toBe(true);
    expect(s.status).toBe('timeout');
    expect(s.move('p', [1, 0],10_000)).toBeNull();
  });

  it('addTime CHỈ chạy được sau khi thua', () => {
    const s = new Session(level);
    s.begin(0);
    expect(s.addTime(30_000, 1_000)).toBe(false);
    advance(s, 0, 10_000);
    expect(s.status).toBe('timeout');
    expect(s.addTime(30_000, 10_000)).toBe(true);
    expect(s.status).toBe('playing');
    expect(s.clock.remainingMs).toBe(30_000);
  });

  it('cắm chốt / nổ khay KHÔNG cộng thêm giây', () => {
    const s = new Session(level);
    s.begin(0);
    advance(s, 0, 2_000);
    const before = s.clock.remainingMs;
    s.move('p', [1, 0],2_000);
    expect(s.clock.remainingMs).toBe(before);
    expect(s.status).toBe('cleared');
  });

  it('restart reset CẢ board LẪN đồng hồ', () => {
    const s = new Session(level);
    s.begin(0);
    advance(s, 0, 4_000);
    s.move('p', [1, 0],4_000);
    s.restart(4_000);
    expect(s.clock.remainingMs).toBe(level.timeLimitMs);
    expect(s.state.pieces[0].gone).toBe(false);
    expect(s.state.moves).toBe(0);
    expect(s.restarts).toBe(1);
  });

  it('pause/resume khi app vào background', () => {
    const s = new Session(level);
    s.begin(0);
    advance(s, 0, 2_000);
    const frozen = s.clock.remainingMs;
    s.pause(2_000);
    s.tick(60_000);
    expect(s.clock.remainingMs).toBe(frozen);
    s.resume(60_000);
    s.tick(60_200);
    expect(s.clock.remainingMs).toBe(frozen - 200);
  });
});
