/**
 * 喷泉运动工具（T4）。
 * 状态变化使用 300–800ms 平滑过渡（设计书 §8.1），数值插值与缓动集中于此。
 */

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

/** 平滑数值：目标变化时在 duration 内缓动趋近，避免喷泉参数跳变。 */
export class SmoothValue {
  private current: number;
  private from: number;
  private target: number;
  private elapsed = 0;
  private readonly duration: number;

  public constructor(initial: number, duration = 600) {
    this.current = initial;
    this.from = initial;
    this.target = initial;
    this.duration = duration;
  }

  public setTarget(target: number): void {
    if (target === this.target) return;
    this.from = this.current;
    this.target = target;
    this.elapsed = 0;
  }

  /** 按增量时间推进，返回当前值。 */
  public update(deltaMs: number): number {
    if (this.elapsed >= this.duration) {
      this.current = this.target;
      return this.current;
    }
    this.elapsed += deltaMs;
    const t = easeOutCubic(clamp(this.elapsed / this.duration, 0, 1));
    this.current = lerp(this.from, this.target, t);
    return this.current;
  }

  public snapshot(): number {
    return this.current;
  }
}
