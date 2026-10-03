import type { SubmitInput } from "@genlayer/transaction-kit";

const PAYABLE = new Set(["open_programme", "fund_programme", "lodge"]);

export function payableValueError(tx: SubmitInput | null, value: bigint): string | undefined {
  if (tx?.kind === "write" && PAYABLE.has(tx.method) && value <= 0n) {
    return `${tx.method} requires a positive attached value before wallet approval.`;
  }
  return undefined;
}
