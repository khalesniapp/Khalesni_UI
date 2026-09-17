import { afterEach, describe, expect, it } from "vitest";

import { enqueue, isQueueBusy, resetQueues } from "@/lib/api/queue";

/**
 * Trap 2 — UI_Plan.md §7.6.
 *
 * "Serialise mutations per `plan_id` through a queue, one in flight at a time,
 * or concurrent PATCHes corrupt the plan." These tests assert that property
 * directly: overlap within a key is a bug, overlap across keys is the point.
 */

/** A task that records when it starts and finishes, and resolves on command. */
function deferred(log: string[], name: string) {
  let release!: (value: string) => void;
  const gate = new Promise<string>((resolve) => {
    release = resolve;
  });

  const task = async () => {
    log.push(`start:${name}`);
    const value = await gate;
    log.push(`end:${name}`);
    return value;
  };

  return { task, release };
}

afterEach(() => resetQueues());

describe("enqueue", () => {
  it("runs tasks for the same key one at a time, in order", async () => {
    const log: string[] = [];
    const first = deferred(log, "a");
    const second = deferred(log, "b");

    const a = enqueue("plan-1", first.task);
    const b = enqueue("plan-1", second.task);

    // The second task must not have started while the first is unresolved.
    await Promise.resolve();
    expect(log).toEqual(["start:a"]);

    first.release("a");
    await a;
    second.release("b");
    await b;

    expect(log).toEqual(["start:a", "end:a", "start:b", "end:b"]);
  });

  it("runs different keys concurrently", async () => {
    const log: string[] = [];
    const one = deferred(log, "one");
    const two = deferred(log, "two");

    const a = enqueue("plan-1", one.task);
    const b = enqueue("plan-2", two.task);

    await Promise.resolve();
    // Different plans cannot corrupt each other's indices, so they overlap.
    expect(log).toEqual(["start:one", "start:two"]);

    one.release("one");
    two.release("two");
    await Promise.all([a, b]);
  });

  it("keeps running later tasks after one rejects", async () => {
    const log: string[] = [];

    const failing = enqueue("plan-1", async () => {
      log.push("failed");
      throw new Error("boom");
    });

    await expect(failing).rejects.toThrow("boom");

    // A failed rename must not wedge every later tick on that plan.
    await enqueue("plan-1", async () => {
      log.push("after");
    });

    expect(log).toEqual(["failed", "after"]);
  });

  it("surfaces the rejection to the caller, not just to the chain", async () => {
    const result = enqueue("plan-1", async () => {
      throw new Error("nope");
    });

    await expect(result).rejects.toThrow("nope");
  });

  it("reports busy while a task is in flight and idle once it settles", async () => {
    const log: string[] = [];
    const only = deferred(log, "x");

    const running = enqueue("plan-1", only.task);
    expect(isQueueBusy("plan-1")).toBe(true);

    only.release("x");
    await running;
    // One microtask for the bookkeeping that clears the chain.
    await Promise.resolve();
    await Promise.resolve();

    expect(isQueueBusy("plan-1")).toBe(false);
  });

  it("preserves the order of a burst of ticks", async () => {
    const order: number[] = [];

    const tasks = [0, 1, 2, 3, 4].map((index) =>
      enqueue("plan-1", async () => {
        order.push(index);
      }),
    );

    await Promise.all(tasks);
    expect(order).toEqual([0, 1, 2, 3, 4]);
  });
});
