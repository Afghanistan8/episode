// Fixture mode: one file, held in memory, for working on the pages.
//
// This is not a mock chain and it is not in the default path. It answers the
// same view names with the same shapes so a page can be laid out and read
// without a deployment, and it is switched on only by
// NEXT_PUBLIC_EPISODE_FIXTURES=1, which puts a banner across the top of
// every page. Nothing here signs, settles or decides anything.

import type { CalldataEncodable } from "genlayer-js/types";

const SPONSOR = `0x${"a1".repeat(20)}`;
const CLAIMANT = `0x${"b2".repeat(20)}`;
const ASSESSOR = `0x${"c4".repeat(20)}`;

const NOW = 1_777_000_000;
const DAY = 24 * 60 * 60;

const GEN = (whole: string) => `${whole}000000000000000000`;

const PROGRAMMES = [
  {
    programme: "0",
    sponsor: SPONSOR,
    assessor: "",
    category: "1",
    category_name: "property-damage",
    kind: "gala-venue-water",
    current_version: "1",
    paused: false,
    balance: GEN("500"),
    committed: GEN("100"),
    idle: GEN("400"),
    paid: "0",
    opened_at: String(NOW - 30 * DAY),
  },
  {
    programme: "1",
    sponsor: SPONSOR,
    assessor: ASSESSOR,
    category: "3",
    category_name: "cargo-damage-or-loss",
    kind: "berth-idling",
    current_version: "2",
    paused: false,
    balance: GEN("1200"),
    committed: "0",
    idle: GEN("1200"),
    paid: GEN("250"),
    opened_at: String(NOW - 90 * DAY),
  },
  {
    programme: "2",
    sponsor: SPONSOR,
    assessor: "",
    category: "1",
    category_name: "property-damage",
    kind: "storm-parcel",
    current_version: "1",
    paused: true,
    balance: GEN("800"),
    committed: "0",
    idle: GEN("800"),
    paid: "0",
    opened_at: String(NOW - 12 * DAY),
  },
];

const VERSIONS: Record<string, unknown> = {
  "0/1": {
    programme: "0",
    version: "1",
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
    min_frames: "3",
    required_views: ["wide", "detail", "identifier"],
    paper_required: false,
    paper_kind: "",
    award: GEN("100"),
    stake: GEN("5"),
    evidence_window: String(7 * DAY),
    appeal_window: String(3 * DAY),
    published_at: String(NOW - 30 * DAY),
  },
  "1/2": {
    programme: "1",
    version: "2",
    definition:
      "A vessel at the named berth lay idle through a working shift with no " +
      "gang working it, or its cargo shifted in the hold, on the event date.",
    exclusions:
      "Idling inside the agreed laytime, idling for the vessel's own repairs, " +
      "and shift recorded before loading.",
    criteria: [
      "The berth shown is occupied and no loading or discharge is under way.",
      "Either the hold shows cargo out of its stow, or the quay shows no gang and no gear rigged.",
    ],
    min_frames: "2",
    required_views: ["wide", "identifier"],
    paper_required: true,
    paper_kind: "bill of lading or berth log",
    award: GEN("250"),
    stake: GEN("12"),
    evidence_window: String(5 * DAY),
    appeal_window: String(2 * DAY),
    published_at: String(NOW - 20 * DAY),
  },
  "2/1": {
    programme: "2",
    version: "1",
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
    min_frames: "2",
    required_views: ["wide", "detail"],
    paper_required: true,
    paper_kind: "parcel map",
    award: GEN("300"),
    stake: GEN("15"),
    evidence_window: String(14 * DAY),
    appeal_window: String(5 * DAY),
    published_at: String(NOW - 12 * DAY),
  },
};

const FILINGS = [
  {
    filing: "0",
    programme: "0",
    version: "1",
    claimant: CLAIMANT,
    subject: "Thornbury Assembly Rooms, main floor",
    identifier: "POL-44198",
    event_date: "2026-05-02",
    declared_cause: "storm water through the roof light",
    state: "DETERMINED",
    outcome: "ESTABLISHED",
    rule: "R-OUT-4",
    stake_held: GEN("5"),
    award_held: GEN("100"),
    lodged_at: String(NOW - 2 * DAY),
    evidence_deadline: String(NOW + 5 * DAY),
    determined_at: String(NOW - 3600),
    appeal_deadline: String(NOW + 3 * DAY),
    appellant: "",
    appeal_ground: "",
    appeal_evidence_deadline: "0",
    appealed_outcome: "",
    exhibit_count: "3",
    rounds: "1",
    settled: false,
    now: String(NOW),
  },
  {
    filing: "1",
    programme: "0",
    version: "1",
    claimant: CLAIMANT,
    subject: "Marchmont Pavilion, sprung floor",
    identifier: "POL-44210",
    event_date: "2026-05-04",
    declared_cause: "storm water through a failed gutter",
    state: "OPEN",
    outcome: "",
    rule: "",
    stake_held: GEN("5"),
    award_held: GEN("100"),
    lodged_at: String(NOW - 3600),
    evidence_deadline: String(NOW + 7 * DAY - 3600),
    determined_at: "0",
    appeal_deadline: "0",
    appellant: "",
    appeal_ground: "",
    appeal_evidence_deadline: "0",
    appealed_outcome: "",
    exhibit_count: "1",
    rounds: "0",
    settled: false,
    now: String(NOW),
  },
];

const EXHIBITS: Record<string, unknown[]> = {
  "0": [
    {
      exhibit: "0",
      party: "claimant",
      kind: "frame",
      media: "png",
      view_label: "wide",
      paper_kind: "",
      caption: "the main floor from the doors",
      link: "",
      sha256: "4f2a".repeat(16),
      size: "349",
      new_on_appeal: false,
      filed_at: String(NOW - 2 * DAY + 600),
    },
    {
      exhibit: "1",
      party: "claimant",
      kind: "frame",
      media: "jpeg",
      view_label: "detail",
      paper_kind: "",
      caption: "the tide line on the skirting",
      link: "",
      sha256: "9c71".repeat(16),
      size: "412",
      new_on_appeal: false,
      filed_at: String(NOW - 2 * DAY + 900),
    },
    {
      exhibit: "2",
      party: "claimant",
      kind: "paper",
      media: "other",
      view_label: "",
      paper_kind: "adjuster note",
      caption: "attendance note, 2 May",
      link: "",
      sha256: "b03e".repeat(16),
      size: "1184",
      new_on_appeal: false,
      filed_at: String(NOW - 2 * DAY + 1200),
    },
  ],
  "1": [
    {
      exhibit: "0",
      party: "claimant",
      kind: "frame",
      media: "png",
      view_label: "wide",
      paper_kind: "",
      caption: "the pavilion floor",
      link: "",
      sha256: "1d55".repeat(16),
      size: "361",
      new_on_appeal: false,
      filed_at: String(NOW - 3000),
    },
  ],
};

const ROUND = {
  filing: "0",
  round: "0",
  on_appeal: false,
  outcome: "ESTABLISHED",
  rule: "R-OUT-4",
  record: {
    seen: ["0", "1"],
    scope: ["criterion:0", "criterion:1", "criterion:2", "subject", "cause", "papers"],
    ratings: {
      "criterion:0": "SATISFIED",
      "criterion:1": "SATISFIED",
      "criterion:2": "SATISFIED",
      subject: "SATISFIED",
      cause: "SATISFIED",
      papers: "SATISFIED",
    },
    grounds: {
      "criterion:0": ["0", "1"],
      "criterion:1": ["0"],
      "criterion:2": ["0", "1"],
      subject: ["0"],
      cause: ["1"],
      papers: ["0", "1"],
    },
    conflict: false,
    conflict_exhibits: [],
    sufficient: true,
    bound: ["criterion:0", "criterion:1", "criterion:2", "subject", "cause", "papers"],
    failed: [],
    outcome: "ESTABLISHED",
    rule: "R-OUT-4",
  },
  snapshot: (EXHIBITS["0"] ?? []).map((row) => {
    const held = row as Record<string, unknown>;
    return {
      exhibit: held.exhibit,
      sha256: held.sha256,
      party: held.party,
      kind: held.kind,
      new_on_appeal: held.new_on_appeal,
    };
  }),
  convened_at: String(NOW - 3600),
};

function receiptFor(id: string): unknown {
  const filing = FILINGS.find((f) => f.filing === id);
  if (!filing) throw new Error(`episode/filing-unknown: no filing ${id}`);
  const programme = PROGRAMMES.find((p) => p.programme === filing.programme);
  return {
    filing: filing.filing,
    programme: filing.programme,
    version: filing.version,
    category: programme?.category_name ?? "",
    kind: programme?.kind ?? "",
    subject: filing.subject,
    identifier: filing.identifier,
    event_date: filing.event_date,
    state: filing.state,
    outcome: filing.outcome,
    rule: filing.rule,
    final: filing.state === "FINAL",
    terminal: ["FINAL", "WITHDRAWN", "CLOSED"].includes(filing.state),
    rounds: filing.rounds,
    exhibits:
      filing.rounds === "0"
        ? []
        : (EXHIBITS[filing.filing] ?? []).map((row) => {
            const held = row as Record<string, unknown>;
            return {
              exhibit: held.exhibit,
              sha256: held.sha256,
              party: held.party,
              kind: held.kind,
              new_on_appeal: held.new_on_appeal,
            };
          }),
  };
}

/** Answer a view by name, with the shape the contract would return. */
export function fixtureRead<T>(functionName: string, args: CalldataEncodable[]): T {
  const first = String(args[0] ?? "");
  switch (functionName) {
    case "programme_count":
      return PROGRAMMES.length as T;
    case "filing_count":
      return FILINGS.length as T;
    case "programme": {
      const held = PROGRAMMES[Number(first)];
      if (!held) throw new Error(`episode/programme-unknown: no programme ${first}`);
      return held as T;
    }
    case "programme_version": {
      const held = VERSIONS[`${first}/${String(args[1] ?? "")}`];
      if (!held) {
        throw new Error(
          `episode/version-unknown: programme ${first} has no version ${args[1]}`,
        );
      }
      return held as T;
    }
    case "filing": {
      const held = FILINGS[Number(first)];
      if (!held) throw new Error(`episode/filing-unknown: no filing ${first}`);
      return held as T;
    }
    case "exhibit_index": {
      const rows = EXHIBITS[first] ?? [];
      return { filing: first, count: String(rows.length), rows } as T;
    }
    case "round_record": {
      if (first !== "0") {
        throw new Error(`episode/filing-unknown: filing ${first} has no round`);
      }
      return ROUND as T;
    }
    case "observation":
      return { filed: false, assessor: "", text: "", filed_at: "0" } as T;
    case "panel_preflight":
      return (first === "1"
        ? {
            ok: false,
            code: "episode/scene-frames-short",
            detail: "version 1 asks for 3 scene photograph(s) and the file carries 1",
          }
        : { ok: true, code: "", detail: "" }) as T;
    case "receipt":
      return receiptFor(first) as T;
    case "credit_of":
      return "0" as T;
    case "live_filings":
      return (first === "0" ? "2" : "0") as T;
    default:
      throw new Error(`fixture mode has no answer for ${functionName}`);
  }
}
