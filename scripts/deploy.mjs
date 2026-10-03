// Deploy the Episode contract and record where it landed.
//
//   EPISODE_PRIVATE_KEY=0x... npm run deploy          # studionet, chain 61999
//   EPISODE_NETWORK=studio-devnet npm run deploy      # chain 61997
//   EPISODE_RPC=http://localhost:4000/api EPISODE_CHAIN_ID=61127 npm run deploy

import { connect, contractSource, deploy, writeRecord } from "./client.mjs";

async function main() {
  const { client, target, account } = await connect();
  const code = await contractSource();

  const pin = code.match(/^#\s*\{\s*"Depends"\s*:\s*"py-genlayer:([^"]+)"\s*\}/m);
  if (!pin) {
    throw new Error(
      "contracts/episode.py must start with a runner header containing " +
        'a { "Depends": "py-genlayer:<hash>" } entry',
    );
  }
  if (/^(test|latest)$/.test(pin[1])) {
    throw new Error(
      `the runner pin is an alias (${pin[0].trim()}); the networks reject ` +
        "py-genlayer:test and py-genlayer:latest. Pin a concrete runner hash.",
    );
  }
  console.log(`- runner ${pin[0].trim()}`);

  // The schema for the source on disk, before anything is sent: it costs
  // nothing and it fails on a contract that would not compile.
  const schema = await client.getContractSchemaForCode(code);
  const surface = Object.keys(schema?.methods ?? {});
  if (surface.length === 0) {
    throw new Error("the contract declares no public methods; nothing to deploy");
  }
  console.log(`- source compiles, ${surface.length} entry points`);

  const { hash, transaction } = await deploy(client, code, []);

  const address =
    transaction.txDataDecoded?.contractAddress ??
    transaction.data?.contract_address ??
    transaction.to_address ??
    transaction.recipient;
  if (!address) {
    throw new Error(
      `the receipt carried no contract address: ${JSON.stringify(transaction).slice(0, 400)}`,
    );
  }

  console.log(`- Episode is at ${address}`);
  if (target.explorer) {
    console.log(`- ${target.explorer}/address/${address}`);
  }
  await writeRecord({
    address,
    chainId: target.id,
    network: target.key,
    rpc: target.rpc,
    deployer: account.address,
    deployedAt: new Date().toISOString(),
    transaction: hash,
    runner: pin[0].trim(),
    explorer: target.explorer
      ? `${target.explorer}/address/${address}`
      : "",
  });

  console.log("");
  console.log("Point the app at it:");
  console.log(`  NEXT_PUBLIC_EPISODE_CONTRACT=${address}`);
  console.log(`  NEXT_PUBLIC_EPISODE_CHAIN_ID=${target.id}`);
  console.log(`  NEXT_PUBLIC_EPISODE_RPC=${target.rpc}`);
  console.log("");
  console.log("Then: npm run schema && npm run seed");
}

main().catch((error) => {
  console.error(`deploy failed: ${error.message}`);
  process.exitCode = 1;
});
