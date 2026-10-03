// Where the app looks for Episode.
//
// The chain comes from the SDK's own definitions, not from values written out
// here: the chain id is signed over, so a pair invented in the app produces
// signatures the network will not accept. Stable genlayer-js defines
// studionet (61999); the separate preview SDK defines studioDevnet (61997)
// and localnet (61127). 61997 is Devnet on its own host.
//
// There is no mock chain in this path. Fixture mode is a separate switch and
// is read in lib/episode.ts.

import { localnet, studioDevnet } from "genlayer-js/chains";
import { studionet } from "genlayer-js-stable/chains";
import type { GenLayerChain } from "genlayer-js/types";
import { resolveChainId } from "./deployment";

export const KNOWN: readonly GenLayerChain[] = [
  studionet as unknown as GenLayerChain,
  studioDevnet,
  localnet,
];

export const ZERO_ADDRESS = `0x${"0".repeat(40)}` as const;

export const CHAIN_ID = resolveChainId(
  process.env.NEXT_PUBLIC_EPISODE_CHAIN_ID,
  process.env.NODE_ENV === "production",
);

/** The SDK's definition for this id, when it has one. */
const matched = KNOWN.find((held) => held.id === CHAIN_ID);
if (!matched) throw new Error(`No GenLayer SDK chain definition for ${CHAIN_ID}.`);

export const RPC_URL =
  process.env.NEXT_PUBLIC_EPISODE_RPC ||
  matched.rpcUrls.default.http[0]!;

export const NETWORK_NAME = matched.name;

export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_EPISODE_CONTRACT ||
  ZERO_ADDRESS) as `0x${string}`;

export const CONTRACT_SET = CONTRACT_ADDRESS !== ZERO_ADDRESS;

export const USING_FIXTURES = process.env.NEXT_PUBLIC_EPISODE_FIXTURES === "1";

export const EXPLORER_URL =
  CHAIN_ID === studionet.id
    ? "https://explorer-studio.genlayer.com"
    : (matched.blockExplorers?.default?.url ?? "");

export const explorerAddress = (address: string): string =>
  EXPLORER_URL ? `${EXPLORER_URL}/address/${address}` : "";

/**
 * The chain the client works against.
 *
 * The SDK's definition carries the consensus and fee contract addresses. An
 * unknown id is rejected above; only the RPC endpoint can be overridden.
 */
export const chain: GenLayerChain = (() => {
  if (matched.rpcUrls.default.http[0] === RPC_URL) {
    return matched;
  }
  return {
    ...matched,
    rpcUrls: {
      ...matched.rpcUrls,
      default: { ...matched.rpcUrls.default, http: [RPC_URL] },
    },
  };
})();
