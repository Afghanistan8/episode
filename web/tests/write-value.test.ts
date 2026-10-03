import { describe, expect, it } from "vitest";

import { payableValueError } from "../lib/write-value";

const write = (method: string) => ({
  kind: "write" as const,
  address: "0x9e6985b530A0c422E876C773b2d8b4e58E20b4f5" as `0x${string}`,
  method,
  args: [],
});

describe("payable submissions", () => {
  it.each(["open_programme", "fund_programme", "lodge"])(
    "blocks zero-value %s before the wallet prompt",
    (method) => expect(payableValueError(write(method), 0n)).toContain("positive attached value"),
  );

  it("permits a positive reserve and zero-value nonpayable call", () => {
    expect(payableValueError(write("fund_programme"), 1n)).toBeUndefined();
    expect(payableValueError(write("seal"), 0n)).toBeUndefined();
  });
});
