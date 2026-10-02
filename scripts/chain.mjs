// Where Episode talks to the chain.
//
// The targets are the SDK's own chain definitions rather than hand-written
// ones, because the chain id is signed over and a pair invented here that the
// network does not use produces signatures it will not accept. What the SDK
// defines, as of genlayer-js 2.0.0-rc.1:
//
//   studionet     61999  https://studio.genlayer.com/api
//   studioDevnet  61997  https://studio-dev.genlayer.com/api
//   localnet      61127  http://127.0.0.1:4000/api
//
// Note that 61997 is Devnet on its own host -- it is not Studio's chain id.
// Anything else goes through EPISODE_RPC, which is taken as given.

import { localnet, studioDevnet, studionet } from "genlayer-js/chains";

function target(key, chain, note) {
  return {
    key,
    chain,
    id: chain.id,
    name: chain.name,
    rpc: chain.rpcUrls.default.http[0],
    note,
  };
}

export const STUDIONET = target("studionet", studionet, "Studio, the default");
export const STUDIO_DEVNET = target("studio-devnet", studioDevnet, "Studio Devnet");
export const LOCALNET = target("localnet", localnet, "a simulator on this machine");

export const TARGETS = [STUDIONET, STUDIO_DEVNET, LOCALNET];

function fromEnv() {
  const rpc = process.env.EPISODE_RPC;
  if (!rpc) return null;
  const id = Number(process.env.EPISODE_CHAIN_ID || STUDIONET.id);
  // Keep Studio's shape -- consensus contracts, currency, explorer -- and
  // override only what the operator asked to override.
  return {
    key: "env",
    id,
    name: "endpoint from EPISODE_RPC",
    rpc,
    note: "set by EPISODE_RPC",
    chain: { ...studionet, id, rpcUrls: { default: { http: [rpc] } } },
  };
}

function asked() {
  const want = (process.env.EPISODE_NETWORK || STUDIONET.key).toLowerCase();
  const found = TARGETS.find((t) => t.key === want || String(t.id) === want);
  if (!found) {
    const known = TARGETS.map((t) => `${t.key} (${t.id})`).join(", ");
    throw new Error(
      `EPISODE_NETWORK is one of ${known}; got ${want}. ` +
        `For anything else set EPISODE_RPC and EPISODE_CHAIN_ID.`,
    );
  }
  return found;
}

/** Whether an endpoint answers a JSON-RPC call at all. */
export async function reachable(target, timeoutMs = 8000) {
  try {
    const answer = await fetch(target.rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "net_version", params: [] }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    return answer.ok;
  } catch {
    return false;
  }
}

/**
 * The endpoint to work against. An explicit EPISODE_RPC is taken as given and
 * never second-guessed; otherwise the asked-for target is probed and the
 * others are tried before giving up, so one being down is not fatal.
 */
export async function resolveTarget() {
  const override = fromEnv();
  if (override) return { target: override, fellBack: false };

  const first = asked();
  if (await reachable(first)) return { target: first, fellBack: false };

  for (const other of TARGETS) {
    if (other.key === first.key) continue;
    if (await reachable(other)) {
      return { target: other, fellBack: true, insteadOf: first };
    }
  }
  throw new Error(
    `no endpoint answered. Tried ${TARGETS.map((t) => `${t.name} (${t.rpc})`).join(", ")}. ` +
      `Set EPISODE_RPC to one you can reach.`,
  );
}
