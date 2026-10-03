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
  "programme_count",
  "filing_count",
  "programme",
  "programme_version",
  "filing",
  "exhibit_index",
  "exhibit_blob",
  "observation",
  "live_filings",
  "tagline",
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

  const record = await readRecord();
  console.log(`- reading ${record.address} (${record.source})`);
  const fromChain = methodNames(await client.getContractSchema(record.address));
  console.log(`- deployed contract declares ${fromChain.length} entry points`);

  const missing = EXPECTED.filter((name) => !fromChain.includes(name));
  const absentFromChain = fromSource.filter((name) => !fromChain.includes(name));
  const absentFromSource = fromChain.filter((name) => !fromSource.includes(name));

  console.log("");
  for (const name of fromChain) console.log(`  ${name}`);
  console.log("");

  if (missing.length || absentFromChain.length || absentFromSource.length) {
    if (missing.length) console.error(`missing expected entry points: ${missing.join(", ")}`);
    if (absentFromChain.length) console.error(`source-only entry points: ${absentFromChain.join(", ")}`);
    if (absentFromSource.length) console.error(`chain-only entry points: ${absentFromSource.join(", ")}`);
    process.exitCode = 1;
    return;
  }
  console.log("schema read back; every expected entry point is present.");
}

main().catch((error) => {
  console.error(`schema read failed: ${error.message}`);
  process.exitCode = 1;
});
