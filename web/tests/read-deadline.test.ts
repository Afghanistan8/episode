import { describe, expect, it } from "vitest";

import { withReadDeadline } from "../lib/read-deadline";

describe("contract read deadline", () => {
  it("returns a settled read", async () => {
    await expect(withReadDeadline(async () => 3, "programme_count", 20)).resolves.toBe(3);
  });

  it("ends a read that never settles", async () => {
    await expect(withReadDeadline(() => new Promise<number>(() => {}), "receipt", 20))
      .rejects.toThrow("receipt timed out");
  });
});
