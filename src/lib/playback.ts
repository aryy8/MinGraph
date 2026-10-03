/**
 * Playback clock for trace replay. Lives outside React so map layers can
 * update every animation frame without re-rendering the component tree.
 *
 * Timeline unit is one explored edge ("step"). After the longest exploration
 * ends, a short route phase draws the final path(s) in.
 */
export const STEPS_PER_SECOND_AT_1X = 250;
const ROUTE_PHASE_SECONDS = 1.1;

type Listener = () => void;

export class Playback {
  t = 0;
  exploreEnd = 0;
  routeSteps = 1;
  total = 0;
  playing = false;
  speed = 24;
  /** Incremented on every change; used as the external store snapshot. */
  version = 0;

  private listeners = new Set<Listener>();
  private finishListeners = new Set<Listener>();
  private raf = 0;
  private last = 0;

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  onFinish(fn: Listener): () => void {
    this.finishListeners.add(fn);
    return () => this.finishListeners.delete(fn);
  }

  getVersion = (): number => this.version;

  private emit(): void {
    this.version++;
    for (const fn of this.listeners) fn();
  }

  get loaded(): boolean {
    return this.total > 0;
  }

  /** Loads a new timeline (longest exploration length in steps) and starts playing. */
  load(exploreEnd: number): void {
    this.exploreEnd = exploreEnd;
    this.routeSteps = Math.max(300, Math.round(exploreEnd * 0.1));
    this.total = exploreEnd + this.routeSteps;
    this.t = 0;
    this.play();
  }

  clear(): void {
    this.stop();
    this.playing = false;
    this.t = 0;
    this.total = 0;
    this.exploreEnd = 0;
    this.emit();
  }

  play(): void {
    if (!this.loaded) return;
    if (this.t >= this.total) this.t = 0;
    this.playing = true;
    this.last = performance.now();
    this.stop();
    this.raf = requestAnimationFrame(this.tick);
    this.emit();
  }

  pause(): void {
    this.playing = false;
    this.stop();
    this.emit();
  }

  toggle(): void {
    if (this.playing) this.pause();
    else this.play();
  }

  restart(): void {
    this.t = 0;
    this.play();
  }

  seek(t: number): void {
    this.t = Math.min(this.total, Math.max(0, t));
    this.emit();
  }

  setSpeed(speed: number): void {
    this.speed = Math.min(100, Math.max(1, speed));
    this.emit();
  }

  /** Steps of the exploration drawn for a trace with `steps` explored edges. */
  explored(steps: number): number {
    return Math.min(steps, Math.floor(this.t));
  }

  /** 0..1 progress of the route draw-in for a trace with `steps` explored edges. */
  routeProgress(steps: number): number {
    if (this.t <= steps) return 0;
    return Math.min(1, (this.t - steps) / this.routeSteps);
  }

  private stop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private tick = (now: number): void => {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const rate = this.t < this.exploreEnd ? this.speed * STEPS_PER_SECOND_AT_1X : this.routeSteps / ROUTE_PHASE_SECONDS;
    this.t = Math.min(this.total, this.t + rate * dt);
    if (this.t >= this.total) {
      this.playing = false;
      this.raf = 0;
      this.emit();
      for (const fn of this.finishListeners) fn();
      return;
    }
    this.emit();
    this.raf = requestAnimationFrame(this.tick);
  };
}
