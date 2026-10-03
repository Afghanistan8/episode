import { describe, expect, it } from "vitest";

import { assertProductionConfig, LIVE_CONTRACT, LIVE_RPC, resolveChainId } from "../lib/deployment";

const live = {
  NEXT_PUBLIC_EPISODE_CHAIN_ID: "61999",
  NEXT_PUBLIC_EPISODE_RPC: LIVE_RPC,
  NEXT_PUBLIC_EPISODE_CONTRACT: LIVE_CONTRACT,
  NEXT_PUBLIC_EPISODE_FIXTURES: "0",
};

describe("production deployment configuration", () => {
  it("accepts the SDK Studionet id and live public settings", () => {
    expect(resolveChainId("61999", true)).toBe(61999);
    expect(() => assertProductionConfig(live)).not.toThrow();
  });

  it("rejects the 6199 typo before a production build", () => {
    expect(() => assertProductionConfig({ ...live, NEXT_PUBLIC_EPISODE_CHAIN_ID: "6199" }))
      .toThrow("requires Studionet chain 61999");
  });

  it("rejects a stale Vercel contract override", () => {
    expect(() => assertProductionConfig({ ...live, NEXT_PUBLIC_EPISODE_CONTRACT: "0x0" }))
      .toThrow("requires contract");
  });
});
