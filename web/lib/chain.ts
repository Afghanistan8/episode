// Where the app looks for Episode.
//
// Studio (61997) is the default. Studio Next (61998) is the alternate and is
// reached by setting the two env values; nothing here assumes either is up.
// There is no mock chain in this path. Fixture mode is a separate switch and
// is read in lib/episode.ts, not here.

import { studionet } from "genlayer-js/chains";
import type { GenLayerChain } from "genlayer-js/types";

// genlayer-js ships `studionet` as chain 61999 on the Studio endpoint, and
// the chain id is signed over, so the app defaults to the id the SDK and the
// network agree on rather than to the one the spec was written against.
export const STUDIONET = {
  id: studionet.id,
  name: "GenLayer Studionet",
  rpc: studionet.rpcUrls.default.http[0] ?? "https://studio.genlayer.com/api",
} as const;

export const STUDIO = {
  id: 61997,
  name: "GenLayer Studio",
  rpc: "https://studio.genlayer.com/api",
} as const;

export const STUDIO_NEXT = {
  id: 61998,
  name: "GenLayer Studio Next",
  rpc: "https://studio-next.genlayer.com/api",
} as const;

export const ZERO_ADDRESS = `0x${"0".repeat(40)}` as const;

function number(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const CHAIN_ID = number(
  process.env.NEXT_PUBLIC_EPISODE_CHAIN_ID,
  STUDIONET.id,
);
export const RPC_URL = process.env.NEXT_PUBLIC_EPISODE_RPC || STUDIONET.rpc;

export const NETWORK_NAME =
  CHAIN_ID === STUDIONET.id
    ? STUDIONET.name
    : CHAIN_ID === STUDIO.id
      ? STUDIO.name
      : CHAIN_ID === STUDIO_NEXT.id
        ? STUDIO_NEXT.name
        : `chain ${CHAIN_ID}`;

export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_EPISODE_CONTRACT ||
  ZERO_ADDRESS) as `0x${string}`;

export const CONTRACT_SET = CONTRACT_ADDRESS !== ZERO_ADDRESS;

export const USING_FIXTURES = process.env.NEXT_PUBLIC_EPISODE_FIXTURES === "1";

/** The chain genlayer-js works against: Studio's shape, this endpoint's id. */
export const chain: GenLayerChain = {
  ...studionet,
  id: CHAIN_ID,
  name: NETWORK_NAME,
  rpcUrls: { default: { http: [RPC_URL] } },
};
