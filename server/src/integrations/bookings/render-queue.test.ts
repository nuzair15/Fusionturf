import { describe, expect, it, vi } from "vitest";
import { RenderQueue } from "./render-queue.js";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
describe("booking export rendering queue", () => {
  it("serializes overlapping exports and releases the next one after failure", async () => {
    const queue = new RenderQueue(), first = deferred(), order: number[] = [];
    const a = queue.run(async () => { order.push(1); await first.promise; throw new Error("render failed"); });
    const rejected = expect(a).rejects.toThrow("render failed");
    const b = queue.run(async () => { order.push(2); return "image"; });
    const c = queue.run(async () => { order.push(3); return "invoice"; });
    await Promise.resolve(); expect(order).toEqual([1]);
    first.resolve(); await rejected;
    expect(await b).toBe("image"); expect(await c).toBe("invoice");
    expect(order).toEqual([1, 2, 3]);
    expect(await queue.run(async () => "next")).toBe("next");
  });
  it("bounds queue capacity", async () => {
    const queue = new RenderQueue(1), first = deferred();
    const a = queue.run(() => first.promise), b = queue.run(async () => "second");
    await expect(queue.run(async () => "overflow")).rejects.toThrow("busy");
    first.resolve(); await a; expect(await b).toBe("second");
  });
  it("removes timed-out requests so they never run later", async () => {
    vi.useFakeTimers();
    try {
      const queue = new RenderQueue(1, 100), first = deferred(), work = vi.fn();
      const a = queue.run(() => first.promise), b = queue.run(work);
      const rejection = expect(b).rejects.toThrow("timed out");
      await vi.advanceTimersByTimeAsync(101); await rejection;
      first.resolve(); await a;
      expect(work).not.toHaveBeenCalled();
      expect(await queue.run(async () => "recovered")).toBe("recovered");
    } finally { vi.useRealTimers(); }
  });
});
