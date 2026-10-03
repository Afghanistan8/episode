import { studionet } from "genlayer-js-stable/chains";

export const LIVE_CONTRACT = "0x9e6985b530A0c422E876C773b2d8b4e58E20b4f5";
export const LIVE_RPC = studionet.rpcUrls.default.http[0]!;

export function resolveChainId(value: string | undefined, production: boolean): number {
  const id = value === undefined || value === "" ? studionet.id : Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`Invalid NEXT_PUBLIC_EPISODE_CHAIN_ID: ${value ?? "missing"}`);
  }
  if (production && id !== studionet.id) {
    throw new Error(`Production Episode requires Studionet chain ${studionet.id}; received ${id}.`);
  }
  return id;
}

/** Fail the build when Vercel overrides a checked-in public value. */
export function assertProductionConfig(env: Record<string, string | undefined>): void {
  if (env.NEXT_PUBLIC_EPISODE_CHAIN_ID === undefined) {
    throw new Error("Production Episode requires NEXT_PUBLIC_EPISODE_CHAIN_ID at build time.");
  }
  resolveChainId(env.NEXT_PUBLIC_EPISODE_CHAIN_ID, true);
  if (env.NEXT_PUBLIC_EPISODE_RPC !== LIVE_RPC) {
    throw new Error(`Production Episode requires RPC ${LIVE_RPC}.`);
  }
  if (env.NEXT_PUBLIC_EPISODE_CONTRACT?.toLowerCase() !== LIVE_CONTRACT.toLowerCase()) {
    throw new Error(`Production Episode requires contract ${LIVE_CONTRACT}.`);
  }
  if (env.NEXT_PUBLIC_EPISODE_FIXTURES !== "0") {
    throw new Error("Production Episode requires NEXT_PUBLIC_EPISODE_FIXTURES=0.");
  }
}
