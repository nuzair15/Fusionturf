import { AppError } from "../../middleware/errorHandler.js";

// Keep Chromium memory bounded on the small production host while allowing
// overlapping read-only exports to wait their turn.
export class RenderQueue {
  private active = false;
  private waiting: Array<() => void> = [];
  constructor(private maxWaiting = 3, private waitMs = 30_000) {}

  private async acquire() {
    if (!this.active) { this.active = true; return; }
    if (this.waiting.length >= this.maxWaiting) throw new AppError("File exports are busy. Retry the same read-only request shortly.", 429);
    await new Promise<void>((resolve, reject) => {
      const start = () => { clearTimeout(timer); resolve(); };
      const timer = setTimeout(() => {
        this.waiting = this.waiting.filter(entry => entry !== start);
        reject(new AppError("The file export queue timed out. Retry the same read-only request shortly.", 429));
      }, this.waitMs);
      this.waiting.push(start);
    });
  }

  async run<T>(work: () => Promise<T>): Promise<T> {
    await this.acquire();
    try { return await work(); }
    finally {
      const next = this.waiting.shift();
      if (next) next();
      else this.active = false;
    }
  }
}
