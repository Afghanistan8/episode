// A client, an account, and the deployment record the other scripts share.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createAccount, createClient, generatePrivateKey } from "genlayer-js";
import { TransactionStatus } from "genlayer-js/types";

import { chainFor, resolveTarget } from "./chain.mjs";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const CONTRACT_PATH = resolve(ROOT, "contracts/episode.py");
export const RECORD_PATH = resolve(ROOT, ".episode-deploy.json");

export async function contractSource() {
  return readFile(CONTRACT_PATH, "utf8");
}

/** The signer. A generated key is printed, because an unprinted key is lost. */
export function account() {
  const given = process.env.EPISODE_PRIVATE_KEY;
  if (given) return createAccount(given.startsWith("0x") ? given : `0x${given}`);
  const made = generatePrivateKey();
  console.log(`! no EPISODE_PRIVATE_KEY set, using a fresh key: ${made}`);
  console.log("! fund it in Studio, or set EPISODE_PRIVATE_KEY to one you own.");
  return createAccount(made);
}

export async function connect() {
  const { target, fellBack, insteadOf } = await resolveTarget();
  if (fellBack) {
    console.log(`! ${insteadOf.name} did not answer; using ${target.name}`);
  }
  const chain = chainFor(target);
  const signer = account();
  const client = createClient({ chain, account: signer });
  console.log(`- ${target.name} (chain ${target.id}) at ${target.rpc}`);
  console.log(`- signing as ${signer.address}`);
  return { client, chain, target, account: signer };
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

/** Wait for a transaction and fail loudly on an execution that did not finish. */
export async function settle(client, hash, label) {
  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.FINALIZED,
  });
  const got = receipt.txExecutionResultName ?? receipt.status;
  if (receipt.txExecutionResultName === "FINISHED_WITH_ERROR") {
    throw new Error(`${label} reverted: ${JSON.stringify(receipt.result ?? got)}`);
  }
  console.log(`  ${label}: ${got}`);
  return receipt;
}
