// Deploy the Episode contract and record where it landed.
//
//   EPISODE_PRIVATE_KEY=0x...  npm run deploy
//   EPISODE_NETWORK=studio-next npm run deploy
//   EPISODE_RPC=http://localhost:4000/api EPISODE_CHAIN_ID=61999 npm run deploy

import { connect, contractSource, settle, writeRecord } from "./client.mjs";

async function main() {
  const { client, target, account } = await connect();
  const code = await contractSource();

  const pin = code.split("\n", 1)[0];
  if (!pin.includes("py-genlayer:")) {
    throw new Error(
      "contracts/episode.py must start with its runner pin, e.g. " +
        '# { "Depends": "py-genlayer:<hash>" }',
    );
  }
  console.log(`- runner ${pin.trim()}`);

  const hash = await client.deployContract({ code, args: [] });
  console.log(`- deploy transaction ${hash}`);
  const receipt = await settle(client, hash, "deploy");

  // A deploy receipt carries the new address in its decoded tx data; the raw
  // shape and the recipient field are the fallbacks for older endpoints.
  const address =
    receipt.txDataDecoded?.contractAddress ??
    receipt.data?.contract_address ??
    receipt.to_address ??
    receipt.recipient;
  if (!address) {
    throw new Error(
      `the receipt carried no contract address: ${JSON.stringify(receipt).slice(0, 400)}`,
    );
  }

  console.log(`- Episode is at ${address}`);
  await writeRecord({
    address,
    chainId: target.id,
    network: target.key,
    rpc: target.rpc,
    deployer: account.address,
    deployedAt: new Date().toISOString(),
    transaction: hash,
  });
  console.log("");
  console.log("Point the app at it:");
  console.log(`  NEXT_PUBLIC_EPISODE_CONTRACT=${address}`);
  console.log(`  NEXT_PUBLIC_EPISODE_CHAIN_ID=${target.id}`);
  console.log(`  NEXT_PUBLIC_EPISODE_RPC=${target.rpc}`);
}

main().catch((error) => {
  console.error(`deploy failed: ${error.message}`);
  process.exitCode = 1;
});
