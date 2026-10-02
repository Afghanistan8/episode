// Where the app looks for Episode.
//
// The chain comes from the SDK's own definitions, not from values written out
// here: the chain id is signed over, so a pair invented in the app produces
// signatures the network will not accept. As of genlayer-js 2.0.0-rc.1 the
// SDK defines studionet (61999, studio.genlayer.com), studioDevnet (61997,
// studio-dev.genlayer.com) and localnet (61127). 61997 is Devnet on its own
// host; it is not Studio's chain id.
//
// There is no mock chain in this path. Fixture mode is a separate switch and
// is read in lib/episode.ts.

import { localnet, studioDevnet, studionet } from "genlayer-js/chains";
import type { GenLayerChain } from "genlayer-js/types";

export const KNOWN: readonly GenLayerChain[] = [studionet, studioDevnet, localnet];

export const ZERO_ADDRESS = `0x${"0".repeat(40)}` as const;

function number(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const CHAIN_ID = number(
  process.env.NEXT_PUBLIC_EPISODE_CHAIN_ID,
  studionet.id,
);

/** The SDK's definition for this id, when it has one. */
const matched = KNOWN.find((held) => held.id === CHAIN_ID);

export const RPC_URL =
  process.env.NEXT_PUBLIC_EPISODE_RPC ||
  matched?.rpcUrls.default.http[0] ||
  (studionet.rpcUrls.default.http[0] as string);

export const NETWORK_NAME = matched?.name ?? `chain ${CHAIN_ID}`;

/** True when the id is one the SDK knows, so its consensus contracts apply. */
export const CHAIN_KNOWN = matched !== undefined;

export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_EPISODE_CONTRACT ||
  ZERO_ADDRESS) as `0x${string}`;

export const CONTRACT_SET = CONTRACT_ADDRESS !== ZERO_ADDRESS;

export const USING_FIXTURES = process.env.NEXT_PUBLIC_EPISODE_FIXTURES === "1";

/**
 * The chain the client works against: the SDK's definition where the id is
 * one it knows, otherwise Studio's shape with the id and endpoint overridden.
 */
export const chain: GenLayerChain =
  matched && !process.env.NEXT_PUBLIC_EPISODE_RPC
    ? matched
    : {
        ...(matched ?? studionet),
        id: CHAIN_ID,
        name: NETWORK_NAME,
        rpcUrls: { default: { http: [RPC_URL] } },
      };
