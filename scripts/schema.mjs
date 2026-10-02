// Read the deployed contract's schema back off the chain.
//
// Worth running straight after a deploy: it is the cheapest proof that the
// contract compiled, that its public surface is what you meant to ship, and
// that the address in .episode-deploy.json is the one carrying it.

import { connect, contractSource, readRecord } from "./client.mjs";

const EXPECTED = [
  "open_programme",
  "publish_version",
  "fund_programme",
  "set_paused",
  "draw_idle_reserve",
  "lodge",
  "attach_exhibit",
  "attach_linked_paper",
  "attach_observation",
  "convene",
  "retract",
  "close_lapsed",
  "appeal",
  "rehear",
  "close_appeal",
  "seal",
  "withdraw",
  "receipt",
  "panel_preflight",
  "programme",
  "programme_version",
  "filing",
  "exhibit_index",
  "round_record",
  "credit_of",
];

// A ContractSchema is { ctor, methods }. Only `methods` is the public
// surface; `ctor` describes the constructor's own parameters.
function methodNames(schema) {
  const methods = schema?.methods;
  if (!methods || typeof methods !== "object") return [];
  return Object.keys(methods).sort();
}

async function main() {
  const { client } = await connect();

  // The schema for the source on disk, which needs no deployment at all.
  const local = await client.getContractSchemaForCode(await contractSource());
  const fromSource = methodNames(local);
  console.log(`- source declares ${fromSource.length} entry points`);

  let fromChain = null;
  try {
    const record = await readRecord();
    console.log(`- reading ${record.address} (${record.source})`);
    fromChain = methodNames(await client.getContractSchema(record.address));
    console.log(`- deployed contract declares ${fromChain.length} entry points`);
  } catch (error) {
    console.log(`! no deployed schema to compare: ${error.message}`);
  }

  const names = fromChain ?? fromSource;
  const missing = EXPECTED.filter((name) => !names.includes(name));
  const ok = missing.length === 0;

  console.log("");
  for (const name of names) console.log(`  ${name}`);
  console.log("");

  if (!ok) {
    console.error(`missing entry points: ${missing.join(", ")}`);
    process.exitCode = 1;
    return;
  }
  if (fromChain) {
    const drift = fromSource.filter((name) => !fromChain.includes(name));
    if (drift.length) {
      console.log(
        `! the source on disk has entry points the deployed contract does not: ` +
          `${drift.join(", ")} -- redeploy before trusting the address`,
      );
    }
  }
  console.log("schema read back; every expected entry point is present.");
}

main().catch((error) => {
  console.error(`schema read failed: ${error.message}`);
  process.exitCode = 1;
});
