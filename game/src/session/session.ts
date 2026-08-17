// Ghép core (tất định) + clock (thời gian) → thắng / hết giờ / kẹt.
import { applyMove, createState } from '../core/engine';
import { isCleared, isDead } from '../core/rules';
import { layersLeft } from '../core/items';
import { Clock } from './clock';
import type { Cell, EndReason, GameResult, GameState, Level, MoveResult } from '../types';

export type Status = 'idle' | 'playing' | 'cleared' | 'timeout' | 'deadlock';

export class Session {
  readonly level: Level;
  state: GameState;
  clock: Clock;
  status: Status = 'idle';
  restarts = 0;
  private startedAt = 0;
  private endedAt = 0;

  constructor(level: Level) {
    this.level = level;
    this.state = createState(level);
    this.clock = new Clock(level.timeLimitMs);
  }

  begin(now: number): void {
    this.status = 'playing';
    this.startedAt = now;
    this.clock.reset(now);
    this.clock.start(now);
  }

  /** Restart — reset CẢ board LẪN đồng hồ (GDD §4). */
  restart(now: number): void {
    this.state = createState(this.level);
    this.restarts += 1;
    this.begin(now);
  }

  pause(now: number): void {
    if (this.status === 'playing') this.clock.pause(now);
  }

  resume(now: number): void {
    if (this.status === 'playing') this.clock.resume(now);
  }

  /** Rewarded +30s — CHỈ chạy được sau khi thua vì hết giờ (§12). */
  addTime(ms: number, now: number): boolean {
    if (this.status !== 'timeout') return false;
    this.clock.addTime(ms, now);
    this.clock.start(now);
    this.status = 'playing';
    return true;
  }

  /** Bơm thời gian; trả về true nếu vừa hết giờ trong tick này. */
  tick(now: number): boolean {
    if (this.status !== 'playing') return false;
    this.clock.update(now);
    if (this.clock.expired) {
      this.end('timeout', now);
      return true;
    }
    return false;
  }

  move(pieceId: string, anchor: Cell, now: number): MoveResult | null {
    if (this.status !== 'playing') return null;
    const result = applyMove(this.state, pieceId, anchor);
    if (!result) return null;

    if (isCleared(this.state)) this.end('cleared', now);
    else if (isDead(this.state)) this.end('deadlock', now);

    return result;
  }

  private end(reason: EndReason, now: number): void {
    this.clock.pause(now);
    this.endedAt = now;
    this.status = reason === 'cleared' ? 'cleared' : reason === 'timeout' ? 'timeout' : 'deadlock';
  }

  get layersLeft(): number {
    return layersLeft(this.state.pieces);
  }

  result(): GameResult {
    const reason: EndReason =
      this.status === 'cleared' ? 'cleared' : this.status === 'timeout' ? 'timeout' : 'deadlock';
    return {
      levelId: this.level.id,
      solved: this.status === 'cleared',
      reason,
      remainingMs: this.clock.remainingMs,
      timeLimitMs: this.clock.limit,
      moves: this.state.moves,
      restarts: this.restarts,
      elapsedMs: Math.max(0, (this.endedAt || this.startedAt) - this.startedAt),
    };
  }
}
