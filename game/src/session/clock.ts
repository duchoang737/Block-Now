// R-TIME — countdown. Nằm NGOÀI core để core vẫn tất định (GDD §7).
// Không tự đọc đồng hồ hệ thống: mọi bước thời gian do bên ngoài bơm vào
// ⇒ test không cần fake timer.

export class Clock {
  private limitMs: number;
  private remaining: number;
  private running = false;
  private last = 0;

  /**
   * Trần cho một bước thời gian. Nếu tab bị treo / máy ngủ / breakpoint,
   * delta có thể lên tới hàng chục giây — trừ thẳng vào đồng hồ là cướp
   * màn chơi của người chơi. Không có Undo nên sai sót kiểu này không cứu được.
   */
  readonly maxStepMs: number;

  constructor(limitMs: number, maxStepMs = 250) {
    this.limitMs = limitMs;
    this.remaining = limitMs;
    this.maxStepMs = maxStepMs;
  }

  get remainingMs(): number {
    return Math.max(0, this.remaining);
  }

  get limit(): number {
    return this.limitMs;
  }

  get isRunning(): boolean {
    return this.running;
  }

  get expired(): boolean {
    return this.remaining <= 0;
  }

  start(now: number): void {
    this.running = true;
    this.last = now;
  }

  pause(now: number): void {
    if (!this.running) return;
    this.update(now);
    this.running = false;
  }

  resume(now: number): void {
    if (this.running) return;
    this.running = true;
    this.last = now;
  }

  /** Reset về mốc gốc (Restart) — GDD §4. */
  reset(now: number, limitMs?: number): void {
    if (limitMs != null) this.limitMs = limitMs;
    this.remaining = this.limitMs;
    this.running = false;
    this.last = now;
  }

  /** Rewarded +30s — chỉ host mới được gọi, và chỉ SAU KHI thua (§12). */
  addTime(ms: number, now: number): void {
    this.remaining += ms;
    this.last = now;
  }

  /** Bơm thời gian thực vào; trả về remainingMs sau khi cập nhật. */
  update(now: number): number {
    if (this.running) {
      const delta = Math.min(now - this.last, this.maxStepMs);
      this.last = now;
      if (delta > 0) this.remaining -= delta;
      if (this.remaining < 0) this.remaining = 0;
    } else {
      this.last = now;
    }
    return this.remainingMs;
  }
}
