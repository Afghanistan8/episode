import { describe, expect, it, vi } from "vitest";

import { selectNetwork, type InjectedProvider } from "../lib/wallet";

describe("Studionet wallet network", () => {
  it("does not prompt when the wallet is already on the configured chain", async () => {
    const request = vi.fn(async () => "0xf22f"); // 61999
    await selectNetwork({ request });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith({ method: "eth_chainId" });
  });

  it("adds the configured RPC when the wallet does not know Studionet", async () => {
    let current = "0x1";
    const request = vi.fn(async ({ method }: { method: string; params?: unknown }) => {
      if (method === "eth_chainId") return current;
      if (method === "wallet_switchEthereumChain") {
        if (current === "0x1" && !added) throw { code: 4902 };
        current = "0xf22f";
      }
      if (method === "wallet_addEthereumChain") added = true;
      return null;
    });
    let added = false;

    await selectNetwork({ request } satisfies InjectedProvider);

    expect(request).toHaveBeenCalledWith({
      method: "wallet_addEthereumChain",
      params: [expect.objectContaining({
        chainId: "0xf22f",
        rpcUrls: ["https://studio.genlayer.com/api"],
      })],
    });
    expect(current).toBe("0xf22f");
  });
});
