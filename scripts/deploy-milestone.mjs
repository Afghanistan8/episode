// Deploy Episode's additive assurance suite in dependency order.
//
// This script never deploys or replaces contracts/episode.py. It requires the
// existing Episode address, deploys the three readers first, then gives their
// returned addresses to the separate native-GEN capital pool.
//
//   EPISODE_PRIVATE_KEY=0x... EPISODE_CONTRACT=0x... \
//   EPISODE_INTEGRITY_THRESHOLD_BPS=8800 npm run deploy:milestone

import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { connect, deploy } from "./client.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RECORD = resolve(ROOT, ".episode-milestone-deploy.json");

function addressFrom(transaction) {
  const address =
    transaction.txDataDecoded?.contractAddress ?? transaction.data?.contract_address ??
    transaction.to_address ?? transaction.recipient;
  if (!address) throw new Error("deployment receipt contains no contract address");
  return address;
}

async function source(name) {
  const code = await readFile(resolve(ROOT, "contracts", name), "utf8");
  if (!code.startsWith("# {")) throw new Error(`${name} lacks its pinned GenLayer dependency header`);
  return code;
}

async function preflight(client, names) {
  const codeByName = new Map();
  for (const name of names) {
    const code = await source(name);
    const schema = await client.getContractSchemaForCode(code);
    if (!schema?.methods || Object.keys(schema.methods).length === 0) {
      throw new Error(`${name} did not compile to a public contract surface`);
    }
    codeByName.set(name, code);
    console.log(`- ${name}: ${Object.keys(schema.methods).length} public methods`);
  }
  return codeByName;
}

async function deployChecked(client, name, code, args) {
  const { transaction } = await deploy(client, code, args);
  const address = addressFrom(transaction);
  console.log(`- ${name} at ${address}`);
  return address;
}

function requiredAddress(name) {
  const value = process.env[name];
  if (!value || !/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`${name} must be a 20-byte 0x address`);
  }
  return value;
}

function requiredBps() {
  const raw = process.env.EPISODE_INTEGRITY_THRESHOLD_BPS;
  if (!raw || !/^\d+$/.test(raw)) throw new Error("EPISODE_INTEGRITY_THRESHOLD_BPS must be an integer from 1 to 10000");
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > 10_000) {
    throw new Error("EPISODE_INTEGRITY_THRESHOLD_BPS must be an integer from 1 to 10000");
  }
  return value;
}

async function main() {
  const episode = requiredAddress("EPISODE_CONTRACT");
  const threshold = requiredBps();
  const { client, target, account } = await connect();
  const code = await preflight(client, [
    "episode_truth.py",
    "episode_policy_guard.py",
    "episode_integrity_graph.py",
    "episode_capital_pool.py",
  ]);
  const truth = await deployChecked(client, "episode_truth.py", code.get("episode_truth.py"), [episode]);
  const guard = await deployChecked(client, "episode_policy_guard.py", code.get("episode_policy_guard.py"), [episode]);
  const integrity = await deployChecked(client, "episode_integrity_graph.py", code.get("episode_integrity_graph.py"), [episode, threshold]);
  const pool = await deployChecked(client, "episode_capital_pool.py", code.get("episode_capital_pool.py"), [episode, truth, integrity, guard]);
  const record = {
    episode, truth, guard, integrity, pool, integrityThresholdBps: threshold,
    chainId: target.id, network: target.key, rpc: target.rpc, deployer: account.address,
    deployedAt: new Date().toISOString(),
  };
  await writeFile(RECORD, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  console.log(`- wrote ${RECORD}`);
  console.log("\nSet these Vercel environment values before deploying the web app:");
  console.log(`NEXT_PUBLIC_EPISODE_TRUTH_CONTRACT=${truth}`);
  console.log(`NEXT_PUBLIC_EPISODE_POLICY_GUARD_CONTRACT=${guard}`);
  console.log(`NEXT_PUBLIC_EPISODE_INTEGRITY_CONTRACT=${integrity}`);
  console.log(`NEXT_PUBLIC_EPISODE_CAPITAL_POOL_CONTRACT=${pool}`);
}

main().catch((error) => {
  console.error(`milestone deployment failed: ${error.message}`);
  process.exitCode = 1;
});
