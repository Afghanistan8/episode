// Where Episode talks to the chain.
//
// The targets are the SDK's own chain definitions rather than hand-written
// ones, because the chain id is signed over and a pair invented here that the
// network does not use produces signatures it will not accept. Stable
// Studionet uses genlayer-js 1.1.8; the Studio-dev preview uses the 2.0 RC:
//
//   studionet     61999  https://studio.genlayer.com/api
//   studioDevnet  61997  https://studio-dev.genlayer.com/api
//   localnet      61127  http://127.0.0.1:4000/api
//
// Note that 61997 is Devnet on its own host -- it is not Studio's chain id.
// Anything else goes through EPISODE_RPC, which is taken as given.

import { localnet, studioDevnet } from "genlayer-js/chains";
import { studionet } from "genlayer-js-stable/chains";

function target(key, chain, note, explorer = "") {
  return {
    key,
    chain,
    id: chain.id,
    name: chain.name,
    rpc: chain.rpcUrls.default.http[0],
    explorer: explorer || chain.blockExplorers?.default?.url || "",
    note,
  };
}

export const STUDIONET = target(
  "studionet",
  studionet,
  "Studio, the default",
  "https://explorer-studio.genlayer.com",
);
export const STUDIO_DEVNET = target("studio-devnet", studioDevnet, "Studio Devnet");
export const LOCALNET = target("localnet", localnet, "a simulator on this machine");

export const TARGETS = [STUDIONET, STUDIO_DEVNET, LOCALNET];

/**
 * An endpoint named by EPISODE_RPC, on a chain the SDK knows.
 *
 * The SDK's chain definition carries the consensus and fee contract
 * addresses. Inventing one for an unknown id would hand the client a chain
 * whose consensus contracts are wrong for it -- which surfaces as "consensus
 * main contract address not found" from inside the send, after signing. So an
 * unknown id has to be named explicitly, and then it borrows the definition of
 * the chain whose id it is.
 */
function fromEnv() {
  const rpc = process.env.EPISODE_RPC;
  if (!rpc) return null;
  const id = Number(process.env.EPISODE_CHAIN_ID || STUDIONET.id);
  const known = TARGETS.find((t) => t.id === id);
  if (!known) {
    const pairs = TARGETS.map((t) => `${t.id} (${t.key})`).join(", ");
    throw new Error(
      `EPISODE_CHAIN_ID=${id} is not a chain this SDK defines, so its ` +
        `consensus contracts are unknown and a write could not be signed ` +
        `against it. Known ids: ${pairs}.`,
    );
  }
  return {
    ...known,
    key: "env",
    name: `${known.name} via EPISODE_RPC`,
    rpc,
    note: "endpoint set by EPISODE_RPC",
    // Force the endpoint into the definition as well as passing it to the
    // client, so nothing reads the SDK's own URL by accident.
    chain: {
      ...known.chain,
      rpcUrls: {
        ...known.chain.rpcUrls,
        default: { ...known.chain.rpcUrls.default, http: [rpc] },
      },
    },
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
 * The endpoint to work against. Never silently switch chains when the
 * requested network is down: the same signing key may not be used there.
 */
export async function resolveTarget() {
  const override = fromEnv();
  if (override) return { target: override, fellBack: false };

  const first = asked();
  if (await reachable(first)) return { target: first, fellBack: false };
  throw new Error(
    `${first.name} did not answer at ${first.rpc} (chain ${first.id}). ` +
      `Check the endpoint or set EPISODE_RPC explicitly for this chain.`,
  );
}
