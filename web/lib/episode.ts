// Reading Episode, and submitting to it.
//
// Reads go through the SDK for the configured chain. Studionet writes use
// the stable SDK with the selected browser provider; preview writes use the
// transaction kit. The browser wallet signs both paths.
//
// Fixture mode (NEXT_PUBLIC_EPISODE_FIXTURES=1) swaps the reads for a file
// held in memory and the kit for the kit's own mock. It is for working on the
// pages. It is off by default and the banner says so when it is on.

import { createClient } from "genlayer-js";
import { createClient as createStableClient } from "genlayer-js-stable";
import { studionet as stableStudionet } from "genlayer-js-stable/chains";
import type { CalldataEncodable, GenLayerClient, GenLayerChain } from "genlayer-js/types";
import {
  createTransactionKit,
  type SubmitInput,
  type TransactionKit,
} from "@genlayer/transaction-kit";
import { createMockKit } from "@genlayer/transaction-kit-react";

import { CHAIN_ID, CONTRACT_ADDRESS, CONTRACT_SET, RPC_URL, USING_FIXTURES, chain } from "./chain";
import { fixtureRead } from "./fixtures";
import { withReadDeadline } from "./read-deadline";
import type { InjectedProvider } from "./wallet";

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
let stableReader: ReturnType<typeof createStableClient> | null = null;

function client(): GenLayerClient<GenLayerChain> {
  // `endpoint` as well as the chain's own rpcUrls, so the client cannot end
  // up reading from the SDK's URL for this chain rather than the configured
  // one.
  reader ??= createClient({ chain, endpoint: RPC_URL });
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
  return withReadDeadline(async () => {
    if (CHAIN_ID === stableStudionet.id) {
      stableReader ??= createStableClient({
        chain: stableStudionet,
        endpoint: RPC_URL,
      });
      const answer = await stableReader.readContract({
        address: CONTRACT_ADDRESS,
        functionName,
        args,
      });
      return plain(answer) as T;
    }
    const answer = await client().readContract({
      address: CONTRACT_ADDRESS,
      functionName,
      args,
      jsonSafeReturn: true,
    });
    return plain(answer) as T;
  }, functionName);
}

/** A view that is allowed to refuse: an unknown id is a 404, not a crash. */
export async function tryRead<T>(
  functionName: string,
  args: CalldataEncodable[] = [],
): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    return { ok: true, value: await read<T>(functionName, args) };
  } catch (error) {
    return { ok: false, error: readDiagnostic(error) };
  }
}

/**
 * Episode's own refusals read as `episode/<code>: <what is missing>`. Pull the
 * sentence out of whatever the transport wrapped it in, and leave anything
 * that is not one of ours alone.
 */
export function describeRefusal(error: unknown): string {
  const text =
    error instanceof Error ? error.message
      : typeof error === "string" ? error
      : error && typeof error === "object" && "message" in error
        ? String(error.message) : "";
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

/** The kit the submit panel drives. In fixture mode, the kit's own mock. */
export function transactionKit(account?: `0x${string}`, provider?: InjectedProvider | null): TransactionKit | null {
  if (USING_FIXTURES) return createMockKit({ queueAhead: 1 });
  if (!provider) return null;
  return createTransactionKit({ chain, provider, account });
}

export function readDiagnostic(error: unknown): string {
  return `${describeRefusal(error)} RPC: ${RPC_URL}; chain: ${CHAIN_ID}; contract: ${CONTRACT_ADDRESS}.`;
}

export { CONTRACT_ADDRESS, CONTRACT_SET, USING_FIXTURES };
