// Where Episode talks to the chain.
//
// GenLayer Studio is the target: chain 61997 at https://studio.genlayer.com/api.
// Studio Next (61998) is the alternate. Neither being down is fatal -- the
// resolver probes the one you asked for, falls back to the other, and says
// which one it ended up on. A deploy against a different endpoint is still a
// deploy; it is only the address that differs.

import { studionet } from "genlayer-js/chains";

// genlayer-js ships `studionet` as chain 61999 on the Studio endpoint. The
// chain id is signed over, so it has to be the one the network expects --
// hence a target of its own rather than a note in the README.
export const STUDIONET = {
  key: "studionet",
  id: studionet.id,
  name: "GenLayer Studionet",
  rpc: studionet.rpcUrls.default.http[0],
};

export const STUDIO = {
  key: "studio",
  id: 61997,
  name: "GenLayer Studio",
  rpc: "https://studio.genlayer.com/api",
};

export const STUDIO_NEXT = {
  key: "studio-next",
  id: 61998,
  name: "GenLayer Studio Next",
  rpc: "https://studio-next.genlayer.com/api",
};

export const TARGETS = [STUDIONET, STUDIO, STUDIO_NEXT];

/** A genlayer-js chain for one of the targets above, or for an env override. */
export function chainFor(target) {
  return {
    ...studionet,
    id: target.id,
    name: target.name,
    rpcUrls: { default: { http: [target.rpc] } },
  };
}

function fromEnv() {
  const rpc = process.env.EPISODE_RPC;
  if (!rpc) return null;
  const id = Number(process.env.EPISODE_CHAIN_ID || STUDIO.id);
  return { key: "env", id, name: `endpoint from EPISODE_RPC (chain ${id})`, rpc };
}

function asked() {
  const want = (process.env.EPISODE_NETWORK || STUDIONET.key).toLowerCase();
  const found = TARGETS.find((t) => t.key === want || String(t.id) === want);
  if (!found) {
    const known = TARGETS.map((t) => `${t.key} (${t.id})`).join(", ");
    throw new Error(`EPISODE_NETWORK is one of ${known}; got ${want}`);
  }
  return found;
}

/** Whether an endpoint answers a JSON-RPC call at all. */
export async function reachable(target, timeoutMs = 6000) {
  const stop = AbortSignal.timeout(timeoutMs);
  try {
    const answer = await fetch(target.rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "net_version", params: [] }),
      signal: stop,
    });
    return answer.ok;
  } catch {
    return false;
  }
}

/**
 * The endpoint to work against. An explicit EPISODE_RPC is taken as given and
 * never second-guessed; otherwise the asked-for target is probed and the other
 * one is tried before giving up.
 */
export async function resolveTarget() {
  const override = fromEnv();
  if (override) return { target: override, probed: false, fellBack: false };

  const first = asked();
  if (await reachable(first)) {
    return { target: first, probed: true, fellBack: false };
  }
  for (const other of TARGETS) {
    if (other.key === first.key) continue;
    if (await reachable(other)) {
      return { target: other, probed: true, fellBack: true, insteadOf: first };
    }
  }
  throw new Error(
    `none of ${TARGETS.map((t) => `${t.name} (${t.rpc})`).join(", ")} ` +
      `answered. Set EPISODE_RPC to an endpoint you can reach.`,
  );
}
