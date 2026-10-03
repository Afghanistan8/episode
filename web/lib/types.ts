// The shapes the contract's views return.
//
// Money and timestamps come back as decimal strings on purpose: a u256 does
// not fit a JavaScript number, and a bond that silently loses its last digits
// on the way to the page is worse than one that is awkward to add up.

export type Preflight = { ok: boolean; code: string; detail: string };

export type Programme = {
  programme: string;
  sponsor: string;
  assessor: string;
  category: string;
  category_name: string;
  kind: string;
  current_version: string;
  paused: boolean;
  balance: string;
  committed: string;
  idle: string;
  paid: string;
  opened_at: string;
};

export type Version = {
  programme: string;
  version: string;
  definition: string;
  exclusions: string;
  criteria: string[];
  min_frames: string;
  required_views: string[];
  paper_required: boolean;
  paper_kind: string;
  award: string;
  stake: string;
  evidence_window: string;
  appeal_window: string;
  published_at: string;
};

export type FilingState =
  | "OPEN"
  | "DETERMINED"
  | "UNDER_APPEAL"
  | "FINAL"
  | "WITHDRAWN"
  | "CLOSED";

export type Filing = {
  filing: string;
  programme: string;
  version: string;
  claimant: string;
  subject: string;
  identifier: string;
  event_date: string;
  declared_cause: string;
  state: FilingState;
  outcome: string;
  rule: string;
  stake_held: string;
  award_held: string;
  lodged_at: string;
  evidence_deadline: string;
  determined_at: string;
  appeal_deadline: string;
  appellant: string;
  appeal_ground: string;
  appeal_evidence_deadline: string;
  appealed_outcome: string;
  exhibit_count: string;
  rounds: string;
  settled: boolean;
  now: string;
};

export type ExhibitRow = {
  exhibit: string;
  party: "claimant" | "sponsor" | "assessor";
  kind: "frame" | "paper";
  media: "png" | "jpeg" | "other" | "link";
  view_label: string;
  paper_kind: string;
  caption: string;
  link: string;
  sha256: string;
  size: string;
  new_on_appeal: boolean;
  filed_at: string;
};

/** `exhibit_index` hands back a record carrying its rows, like every other
 *  view on the contract, so there is one shape to decode. */
export type ExhibitIndex = {
  filing: string;
  count: string;
  rows: ExhibitRow[];
};

export type SnapshotRow = {
  exhibit: string;
  sha256: string;
  party: string;
  kind: string;
  new_on_appeal: boolean;
};

export type RoundRecord = {
  filing: string;
  round: string;
  on_appeal: boolean;
  outcome: string;
  rule: string;
  record: {
    seen: string[];
    scope: string[];
    ratings: Record<string, string>;
    grounds: Record<string, string[]>;
    conflict: boolean;
    conflict_exhibits: string[];
    sufficient: boolean;
    bound: string[];
    failed: string[];
    outcome: string;
    rule: string;
  };
  snapshot: SnapshotRow[];
  convened_at: string;
};

export type Receipt = {
  filing: string;
  programme: string;
  version: string;
  category: string;
  kind: string;
  subject: string;
  identifier: string;
  event_date: string;
  state: FilingState;
  outcome: string;
  rule: string;
  final: boolean;
  terminal: boolean;
  rounds: string;
  exhibits: SnapshotRow[];
};

export type Observation = {
  filed: boolean;
  assessor: string;
  text: string;
  filed_at: string;
};
