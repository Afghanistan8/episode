// Reading Episode, and submitting to it.
//
// Reads go through genlayer-js against the configured endpoint. Writes go
// through the GenLayer transaction kit, which quotes the fee, takes the
// approval and tracks the round -- the app never signs anything itself.
//
// Fixture mode (NEXT_PUBLIC_EPISODE_FIXTURES=1) swaps the reads for a file
// held in memory and the kit for the kit's own mock. It is for working on the
// pages. It is off by default and the banner says so when it is on.

import { createClient } from "genlayer-js";
import type { CalldataEncodable, GenLayerClient, GenLayerChain } from "genlayer-js/types";
import {
  createTransactionKit,
  type Eip1193Provider,
  type SubmitInput,
  type TransactionKit,
} from "@genlayer/transaction-kit";
import { createMockKit } from "@genlayer/transaction-kit-react";

import { CONTRACT_ADDRESS, CONTRACT_SET, USING_FIXTURES, chain } from "./chain";
import { fixtureRead } from "./fixtures";

/** Calldata comes back with Maps in it. Flatten to plain data once, here. */
export function plain(value: unknown): unknown {
  if (value instanceof Map) {
    const out: Record<string, unknown> = {};
    for (const [key, held] of value) out[String(key)] = plain(held);
    return out;
  }
  if (Array.isArray(value)) return value.map(plain);
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Uint8Array) return value;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, held] of Object.entries(value)) out[key] = plain(held);
    return out;
  }
  return value;
}

let reader: GenLayerClient<GenLayerChain> | null = null;

function client(): GenLayerClient<GenLayerChain> {
  reader ??= createClient({ chain });
  return reader;
}

export class NotDeployed extends Error {
  constructor() {
    super(
      "No contract address is set. Deploy Episode and put its address in " +
        "NEXT_PUBLIC_EPISODE_CONTRACT, or set NEXT_PUBLIC_EPISODE_FIXTURES=1 " +
        "to work on the pages against a file held in memory.",
    );
    this.name = "NotDeployed";
  }
}

/** One view call. Throws with the contract's own refusal text when it refuses. */
export async function read<T>(
  functionName: string,
  args: CalldataEncodable[] = [],
): Promise<T> {
  if (USING_FIXTURES) return fixtureRead<T>(functionName, args);
  if (!CONTRACT_SET) throw new NotDeployed();
  const answer = await client().readContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args,
    jsonSafeReturn: true,
  });
  return plain(answer) as T;
}

/** A view that is allowed to refuse: an unknown id is a 404, not a crash. */
export async function tryRead<T>(
  functionName: string,
  args: CalldataEncodable[] = [],
): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    return { ok: true, value: await read<T>(functionName, args) };
  } catch (error) {
    return { ok: false, error: describeRefusal(error) };
  }
}

/**
 * Episode's own refusals read as `episode/<code>: <what is missing>`. Pull the
 * sentence out of whatever the transport wrapped it in, and leave anything
 * that is not one of ours alone.
 */
export function describeRefusal(error: unknown): string {
  const text =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const found = text.match(/episode\/[a-z-]+:[^"'\n}]*/);
  if (found) return found[0].trim();
  return text || "the call failed and said nothing about why";
}

export function refusalCode(error: unknown): string {
  const found = describeRefusal(error).match(/^(episode\/[a-z-]+):/);
  return found?.[1] ?? "";
}

/** A write, described for the transaction kit. */
export function call(method: string, args: CalldataEncodable[]): SubmitInput {
  return { kind: "write", address: CONTRACT_ADDRESS, method, args };
}

export function browserProvider(): Eip1193Provider | null {
  const held = (globalThis as { ethereum?: Eip1193Provider }).ethereum;
  return held ?? null;
}

/** The kit the submit panel drives. In fixture mode, the kit's own mock. */
export function transactionKit(account?: `0x${string}`): TransactionKit | null {
  if (USING_FIXTURES) return createMockKit({ queueAhead: 1 });
  const provider = browserProvider();
  if (!provider) return null;
  return createTransactionKit({ chain, provider, account });
}

export { CONTRACT_ADDRESS, CONTRACT_SET, USING_FIXTURES };
