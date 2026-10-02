// Seed the demo: three programmes, and optionally a file to look at.
//
//   EPISODE_PRIVATE_KEY=0x... npm run seed
//   EPISODE_SEED_FILING=0     leave the demo filing out
//   EPISODE_RESERVE=500000000000000000  reserve per programme, in wei
//
// The programmes are seeded here and not in the contract's constructor. A
// constructor that invented programmes would have to invent their sponsor
// too, and a sponsor nobody controls cannot fund a reserve, pause a
// programme, or publish a version.

import { connect, readRecord, settle } from "./client.mjs";
import { detailFrame, identifierFrame, wideFrame } from "./frames.mjs";

const CAT_PROPERTY = 1;
const CAT_CARGO = 3;

const HOUR = 60 * 60;
const DAY = 24 * HOUR;

const RESERVE = BigInt(process.env.EPISODE_RESERVE ?? "500000000000000000");
const AWARD = BigInt(process.env.EPISODE_AWARD ?? "100000000000000000");
const STAKE = BigInt(process.env.EPISODE_STAKE ?? "5000000000000000");

const PROGRAMMES = [
  {
    label: "gala venue water damage",
    category: CAT_PROPERTY,
    kind: "gala-venue-water",
    definition:
      "Water reached the floor of the named venue on the event date and left " +
      "the floor unusable for the booking it was taken for.",
    exclusions:
      "Condensation, cleaning water, water confined to back-of-house, and " +
      "damage that predates the booking.",
    criteria: [
      "Standing water, or a water line left by standing water, is visible on the venue floor.",
      "The floor shown cannot be walked or staged on in the state it is in.",
      "The damage is to the floor and fabric of the room named, not to equipment brought in.",
    ],
    minFrames: 3,
    views: ["wide", "detail", "identifier"],
    paperRequired: false,
    paperKind: "",
    evidenceWindow: 7 * DAY,
    appealWindow: 3 * DAY,
  },
  {
    label: "berth idling and cargo shift",
    category: CAT_CARGO,
    kind: "berth-idling",
    definition:
      "A vessel at the named berth lay idle through a working shift with no " +
      "gang working it, or its cargo shifted in the hold, on the event date.",
    exclusions:
      "Idling inside the agreed laytime, idling for the vessel's own repairs, " +
      "and shift that was recorded before loading.",
    criteria: [
      "The berth shown is occupied and no loading or discharge is under way.",
      "Either the hold shows cargo out of its stow, or the quay shows no gang and no gear rigged.",
      "The condition shown is the one the berth was in on the event date, not a later tidy-up.",
    ],
    minFrames: 2,
    views: ["wide", "identifier"],
    paperRequired: true,
    paperKind: "bill of lading or berth log",
    evidenceWindow: 5 * DAY,
    appealWindow: 2 * DAY,
  },
  {
    label: "storm-surge parcel bound",
    category: CAT_PROPERTY,
    kind: "storm-parcel",
    definition:
      "Sea water crossed the named parcel during the surge on the event date " +
      "and left damage inside the parcel bound.",
    exclusions:
      "Rainfall flooding with no sea water, damage outside the parcel bound, " +
      "and erosion without inundation.",
    criteria: [
      "Sea water, or the silt and wrack it leaves, is visible inside the parcel bound.",
      "The damage shown is wetting or scour, not wind.",
    ],
    minFrames: 2,
    views: ["wide", "detail"],
    paperRequired: true,
    paperKind: "parcel map",
    evidenceWindow: 14 * DAY,
    appealWindow: 5 * DAY,
  },
];

const PARCEL_MAP =
  "PARCEL MAP EXTRACT\n" +
  "parcel: HOLBECK-SOUTH-114\n" +
  "bound: sea wall to the drain line, 1.8 ha\n" +
  "surveyed: 2026-03-11 by R. Aldiss, licensed surveyor\n" +
  "note: ground level 0.4 m above mean high water springs\n";

async function programmeId(client, address, account) {
  const count = await client.readContract({
    account,
    address,
    functionName: "programme_count",
    args: [],
  });
  return Number(count) - 1;
}

async function main() {
  const { client, account } = await connect();
  const record = await readRecord();
  const address = record.address;
  console.log(`- seeding ${address} (${record.source})`);
  console.log(
    `- reserve ${RESERVE} wei per programme, award ${AWARD}, bond ${STAKE}`,
  );

  const opened = [];
  for (const programme of PROGRAMMES) {
    console.log(`\n* ${programme.label} (${programme.kind})`);
    const hash = await client.writeContract({
      account,
      address,
      functionName: "open_programme",
      args: [
        programme.category,
        programme.kind,
        programme.definition,
        programme.exclusions,
        programme.criteria,
        programme.minFrames,
        programme.views,
        programme.paperRequired,
        programme.paperKind,
        AWARD,
        STAKE,
        programme.evidenceWindow,
        programme.appealWindow,
        "",
      ],
      value: RESERVE,
    });
    await settle(client, hash, "open_programme");
    const id = await programmeId(client, address, account);
    opened.push({ ...programme, id });
    console.log(`  programme ${id}, version 1`);
  }

  if (process.env.EPISODE_SEED_FILING === "0") {
    console.log("\nEPISODE_SEED_FILING=0, so no demo filing was lodged.");
    summarise(opened, address, record);
    return;
  }

  // One file on the first programme, with frames that are genuinely PNGs, so
  // the panel has something to look at rather than something to refuse.
  const gala = opened[0];
  console.log(`\n* a demo filing under programme ${gala.id}`);
  const lodged = await client.writeContract({
    account,
    address,
    functionName: "lodge",
    args: [
      gala.id,
      1,
      "Thornbury Assembly Rooms, main floor",
      "POL-44198",
      "2026-05-02",
      "storm water through the roof light",
    ],
    value: STAKE,
  });
  await settle(client, lodged, "lodge");
  const filingCount = await client.readContract({
    account,
    address,
    functionName: "filing_count",
    args: [],
  });
  const filingId = Number(filingCount) - 1;
  console.log(`  filing ${filingId}`);

  const exhibits = [
    ["wide", wideFrame(1), "the main floor from the doors"],
    ["detail", detailFrame(2), "the tide line on the skirting"],
    ["identifier", identifierFrame(3), "the room plate above the doors"],
  ];
  for (const [view, blob, caption] of exhibits) {
    const hash = await client.writeContract({
      account,
      address,
      functionName: "attach_exhibit",
      args: [filingId, new Uint8Array(blob), view, "", caption],
      value: 0n,
    });
    await settle(client, hash, `attach ${view} (${blob.length} bytes)`);
  }

  const preflight = await client.readContract({
    account,
    address,
    functionName: "panel_preflight",
    args: [filingId],
  });
  console.log(`  preflight: ${JSON.stringify(preflight)}`);
  console.log(
    "  the file is complete. `convene` from the app to put it to a panel.",
  );

  summarise(opened, address, record, filingId);
}

function summarise(opened, address, record, filingId) {
  console.log("\n--- seeded ---");
  for (const programme of opened) {
    console.log(`  programme ${programme.id}  ${programme.kind}  ${programme.label}`);
  }
  if (filingId !== undefined) console.log(`  filing ${filingId}  open, panel-ready`);
  console.log("");
  console.log(`  NEXT_PUBLIC_EPISODE_CONTRACT=${address}`);
  console.log(`  NEXT_PUBLIC_EPISODE_CHAIN_ID=${record.chainId ?? ""}`);
  console.log(`  NEXT_PUBLIC_EPISODE_RPC=${record.rpc ?? ""}`);
  if (process.env.EPISODE_SEED_FILING !== "0") {
    console.log("");
    console.log(`  A parcel-map document for programme 2, if you want one:`);
    console.log(`  ${JSON.stringify(PARCEL_MAP).slice(0, 72)}...`);
  }
}

main().catch((error) => {
  console.error(`seed failed: ${error.message}`);
  process.exitCode = 1;
});
