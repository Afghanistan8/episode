// A client, an account, the fee flow, and the deployment record.
//
// Studio charges fees, so a write is a two-step: estimate the policy for the
// concrete call, then submit that estimate's `distribution` and `feeValue`
// alongside it. Submitting without them is how a write fails on a
// fee-charging deployment while looking fine in the code.
//
// Settlement is `waitForFinalization` plus `isSuccessful`: a transaction can
// finalize by consensus and still have reverted in execution, and those are
// two different questions.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_FEES_DISTRIBUTION,
  createAccount,
  createClient,
  isSuccessful,
} from "genlayer-js";

import { resolveTarget } from "./chain.mjs";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const CONTRACT_PATH = resolve(ROOT, "contracts/episode.py");
export const RECORD_PATH = resolve(ROOT, ".episode-deploy.json");

export async function contractSource() {
  return readFile(CONTRACT_PATH, "utf8");
}

/** The signer must be supplied by the deployer for this session. */
export function account() {
  const given = process.env.EPISODE_PRIVATE_KEY;
  if (!given || !/^0x[0-9a-fA-F]{64}$/.test(given)) {
    throw new Error("EPISODE_PRIVATE_KEY must be a 0x-prefixed 32-byte hex key in the process environment");
  }
  return createAccount(given);
}

export async function connect() {
  const { target, fellBack, insteadOf } = await resolveTarget();
  if (fellBack) {
    console.log(`! ${insteadOf.name} did not answer; using ${target.name}`);
  }
  const signer = account();
  // `endpoint` as well as the chain's own rpcUrls: the SDK ships a URL per
  // named chain, and if that ever diverges from the one being advertised the
  // client would quietly read and write against a different node.
  const client = createClient({
    chain: target.chain,
    endpoint: target.rpc,
    account: signer,
  });
  console.log(`- ${target.name} (chain ${target.id}) at ${target.rpc}`);
  console.log(`- signing as ${signer.address}`);
  return { client, target, account: signer };
}

/**
 * Wait for finalization, then say plainly whether the execution succeeded.
 *
 * Consensus finalizing and the contract not reverting are separate facts, and
 * a script that conflates them reports a refused call as a successful one.
 */
export async function settle(client, hash, label) {
  const transaction = await client.waitForFinalization({ hash, fullTransaction: true });
  const status = transaction.statusName ?? transaction.status_name ?? "unknown";
  const consensus = transaction.resultName ?? transaction.result_name ?? "unknown";
  const receipts = transaction.consensus_data?.leader_receipt;
  const leader = Array.isArray(receipts) ? receipts[0] : receipts;
  const execution = transaction.txExecutionResultName ?? leader?.execution_result ?? "unknown";

  // The current Studio RPC returns a legacy receipt without
  // txExecutionResultName. Its leader receipt reports SUCCESS and a return
  // status when execution finished normally; consensus must also agree.
  const studioSuccess =
    status === "FINALIZED" &&
    consensus === "MAJORITY_AGREE" &&
    leader?.execution_result === "SUCCESS" &&
    leader?.result?.status === "return";

  if (!isSuccessful(transaction) && !studioSuccess) {
    const refusal = refusalIn(transaction);
    throw new Error(
      `${label} ${hash} did not succeed: ${status} / ${consensus} / ${execution}` +
        (refusal ? `\n    ${refusal}` : ""),
    );
  }
  console.log(`  ${label}: ${status} / ${consensus} / ${execution}`);
  return transaction;
}

/**
 * Episode's own refusals read as `episode/<code>: <what is missing>`. Dig one
 * out of a receipt so a failed call says why rather than just that it failed.
 */
export function refusalIn(transaction) {
  const text = JSON.stringify(transaction ?? {}, (_, value) =>
    typeof value === "bigint" ? value.toString() : value,
  );
  const found = text.match(/episode\\?\/[a-z-]+:(?:\\.|[^"\\])*/);
  return found ? found[0].replace(/\\"/g, '"').replace(/\\\//g, "/").trim() : "";
}

/**
 * One write, with its fees estimated first. R-MON aside, this is the only
 * place fees are decided, so every script charges the same way.
 *
 * The estimate is a simulation of the concrete call, so it also fails early
 * and loudly on a call the contract would refuse -- before anything is sent.
 */
export async function write(client, call, label) {
  let fees;
  try {
    const estimate = await client.estimateTransactionFeesForWrite(call);
    fees = {
      distribution: estimate.distribution,
      feeValue: estimate.feeValue,
      ...(estimate.messageAllocations
        ? { messageAllocations: estimate.messageAllocations }
        : {}),
    };
    if (estimate.policy && estimate.policy.enabled === false) {
      console.log(`  ${label}: gasless deployment, no fee deposit`);
    }
  } catch (error) {
    // A deployment that does not charge fees has nothing to estimate. Carry
    // on without a deposit rather than refusing to write at all.
    console.log(`  ${label}: no fee estimate (${short(error)}); submitting without one`);
    fees = undefined;
  }

  const hash = await client.writeContract({ ...call, ...(fees ? { fees } : {}) });
  console.log(`  ${label}: ${hash}`);
  return settle(client, hash, label);
}

/** Deploy has no estimator of its own, so it carries the default distribution. */
export async function deploy(client, code, args = []) {
  const hash = await client.deployContract({
    code,
    args,
    fees: { distribution: DEFAULT_FEES_DISTRIBUTION },
  });
  console.log(`- deploy transaction ${hash}`);
  return { hash, transaction: await settle(client, hash, "deploy") };
}

export function short(error) {
  const text = error instanceof Error ? error.message : String(error);
  return text.split("\n")[0].slice(0, 160);
}

export async function readRecord() {
  const given = process.env.EPISODE_CONTRACT;
  if (given) return { address: given, source: "EPISODE_CONTRACT" };
  try {
    const held = JSON.parse(await readFile(RECORD_PATH, "utf8"));
    return { ...held, source: RECORD_PATH };
  } catch {
    throw new Error(
      "no deployment found. Run `npm run deploy`, or set EPISODE_CONTRACT to " +
        "an address already on the network.",
    );
  }
}

export async function writeRecord(record) {
  await writeFile(RECORD_PATH, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  console.log(`- wrote ${RECORD_PATH}`);
}
