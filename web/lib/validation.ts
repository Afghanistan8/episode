// Form validation, mirrored from the contract's preflight.
//
// Every rule here is also enforced in contracts/episode.py, which is the
// only place it counts. The point of the copy is that a claimant should not
// have to spend a transaction to be told their event date is not a date.
// tests/validation.test.ts holds it to the same answers.

import { sniffMedia, type Media } from "./media";

export const CATEGORIES = [
  { id: 1, slug: "property-damage", label: "Property damage",
    note: "venue, warehouse, parcel, crop stand, terminal" },
  { id: 2, slug: "vehicle-damage", label: "Vehicle damage",
    note: "truck, railcar, stage vehicle, support craft" },
  { id: 3, slug: "cargo-damage-or-loss", label: "Cargo damage or loss",
    note: "container, bulk, inventory on hand" },
  { id: 4, slug: "visible-business-interruption", label: "Business interruption",
    note: "idling, blocked access, unusable floor, failed harvest stand" },
] as const;

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);
export const VIEWS = ["wide", "detail", "identifier"] as const;
export type View = (typeof VIEWS)[number];

export const CRITERIA_MIN = 1;
export const CRITERIA_MAX = 8;
export const EVIDENCE_WINDOW_MIN = 60 * 60;
export const EVIDENCE_WINDOW_MAX = 30 * 24 * 60 * 60;
export const APPEAL_WINDOW_MIN = 60 * 60;
export const APPEAL_WINDOW_MAX = 14 * 24 * 60 * 60;
export const LIVE_FILINGS_PER_ACCOUNT = 3;
export const CAUSE_UNSTATED = "unstated";
export const CAT_INTERRUPTION = 4;

/** One complaint, keyed by the field that caused it, so it can sit beside it. */
export type Complaint = { field: string; code: string; detail: string };

function say(field: string, code: string, detail: string): Complaint {
  return { field, code, detail };
}

/** A kind is a short lower-case slug and stays the same across versions. */
export function isSlug(value: string): boolean {
  if (!value || value.length > 64) return false;
  if (value.startsWith("-") || value.endsWith("-")) return false;
  return /^[a-z0-9-]+$/.test(value);
}

/** A calendar day, and a real one: 2026-02-30 is not a date. */
export function isCalendarDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  if (month < 1 || month > 12 || day < 1) return false;
  const stamp = new Date(Date.UTC(year, month - 1, day));
  return (
    stamp.getUTCFullYear() === year &&
    stamp.getUTCMonth() === month - 1 &&
    stamp.getUTCDate() === day
  );
}

export type ProgrammeTerms = {
  category: number;
  kind: string;
  definition: string;
  exclusions: string;
  criteria: string[];
  minFrames: number;
  requiredViews: string[];
  paperRequired: boolean;
  paperKind: string;
  award: string;
  stake: string;
  evidenceWindow: number;
  appealWindow: number;
  assessor: string;
  sponsor?: string;
};

function positiveAmount(value: string): boolean {
  if (!/^\d+$/.test(value.trim())) return false;
  return BigInt(value.trim()) > 0n;
}

export function checkProgramme(terms: ProgrammeTerms): Complaint[] {
  const found: Complaint[] = [];

  if (!CATEGORY_IDS.includes(terms.category as 1 | 2 | 3 | 4)) {
    found.push(
      say("category", "episode/category-unknown",
        "Episode offers four categories, and only events that have to be seen."),
    );
  }
  if (!isSlug(terms.kind)) {
    found.push(
      say("kind", "episode/kind-blank",
        "A kind is a short lower-case slug, such as berth-idling."),
    );
  }
  if (!terms.definition.trim()) {
    found.push(
      say("definition", "episode/definition-blank",
        "A programme has to say what must be true."),
    );
  }

  const written = terms.criteria.filter((c) => c.trim().length > 0);
  if (written.length < CRITERIA_MIN || written.length > CRITERIA_MAX) {
    found.push(
      say("criteria", "episode/criteria-count",
        `A programme carries ${CRITERIA_MIN} to ${CRITERIA_MAX} checkable ` +
          `statements; ${written.length} are written.`),
    );
  }

  const views = [...new Set(terms.requiredViews)];
  for (const view of views) {
    if (!VIEWS.includes(view as View)) {
      found.push(
        say("requiredViews", "episode/view-unknown",
          `A required view is wide, detail or identifier; got ${view}.`),
      );
    }
  }
  const floor = Math.max(1, views.length);
  if (!Number.isInteger(terms.minFrames) || terms.minFrames < floor) {
    found.push(
      say("minFrames", "episode/scene-frames-short",
        `Asking for ${views.length} view(s) needs at least ${floor} scene ` +
          `photograph(s).`),
    );
  }

  if (!positiveAmount(terms.award)) {
    found.push(say("award", "episode/award-zero", "A benefit of nothing is not a benefit."));
  }
  if (!positiveAmount(terms.stake)) {
    found.push(say("stake", "episode/stake-zero", "A bond of nothing is not a bond."));
  }

  if (
    terms.evidenceWindow < EVIDENCE_WINDOW_MIN ||
    terms.evidenceWindow > EVIDENCE_WINDOW_MAX
  ) {
    found.push(
      say("evidenceWindow", "episode/window-bounds",
        "The evidence window runs from one hour to thirty days."),
    );
  }
  if (
    terms.appealWindow < APPEAL_WINDOW_MIN ||
    terms.appealWindow > APPEAL_WINDOW_MAX
  ) {
    found.push(
      say("appealWindow", "episode/window-bounds",
        "The appeal window runs from one hour to fourteen days."),
    );
  }

  const assessor = terms.assessor.trim();
  // The prefix is matched case-insensitively because the comparison below is
  // case-insensitive, and refusing 0X while accepting 0x would be a trap.
  if (assessor && !/^0[xX][0-9a-fA-F]{40}$/.test(assessor)) {
    found.push(
      say("assessor", "episode/assessor-malformed",
        "An assessor is an address, or nothing at all."),
    );
  } else if (
    assessor &&
    terms.sponsor &&
    assessor.toLowerCase() === terms.sponsor.toLowerCase()
  ) {
    found.push(
      say("assessor", "episode/assessor-is-sponsor",
        "An assessor who is the sponsor is not an independent reading."),
    );
  }

  return found;
}

export type LodgeFields = {
  programmeId: number | null;
  version: number | null;
  currentVersion: number | null;
  category: number;
  subjectLabel: string;
  subjectIdentifier: string;
  eventDate: string;
  declaredCause: string;
  stake: string;
  posting: string;
  idleReserve: string;
  award: string;
  liveFilings: number;
};

export function checkLodge(fields: LodgeFields): Complaint[] {
  const found: Complaint[] = [];

  if (fields.programmeId === null) {
    found.push(say("programmeId", "episode/programme-unknown", "Choose a programme."));
  }
  if (
    fields.version !== null &&
    fields.currentVersion !== null &&
    fields.version !== fields.currentVersion
  ) {
    found.push(
      say("version", "episode/version-stale",
        `Version ${fields.currentVersion} is in force. A filing binds the ` +
          `version in force when it is lodged, and keeps it for life.`),
    );
  }
  if (!fields.subjectLabel.trim()) {
    found.push(
      say("subjectLabel", "episode/subject-blank",
        "Name the property, vehicle, consignment or premises."),
    );
  }
  if (!fields.subjectIdentifier.trim()) {
    found.push(
      say("subjectIdentifier", "episode/subject-blank",
        "Give the parcel id, VIN, container, berth or policy reference."),
    );
  }
  if (!isCalendarDay(fields.eventDate.trim())) {
    found.push(
      say("eventDate", "episode/event-date-malformed",
        "The event date is a calendar day, as YYYY-MM-DD."),
    );
  }
  const cause = fields.declaredCause.trim();
  if (!cause) {
    found.push(
      say("declaredCause", "episode/cause-blank", "Say what caused this."),
    );
  } else if (cause === CAUSE_UNSTATED && fields.category !== CAT_INTERRUPTION) {
    found.push(
      say("declaredCause", "episode/cause-must-be-stated",
        "Only a business-interruption programme takes an unstated cause; " +
          "damage has to name one."),
    );
  }
  if (fields.posting.trim() !== fields.stake.trim()) {
    found.push(
      say("posting", "episode/stake-mismatch",
        `This version takes a bond of exactly ${fields.stake}.`),
    );
  }
  if (
    /^\d+$/.test(fields.idleReserve) &&
    /^\d+$/.test(fields.award) &&
    BigInt(fields.idleReserve) < BigInt(fields.award)
  ) {
    found.push(
      say("programmeId", "episode/reserve-short",
        `The reserve cannot cover this award: ${fields.idleReserve} idle ` +
          `against an award of ${fields.award}.`),
    );
  }
  if (fields.liveFilings >= LIVE_FILINGS_PER_ACCOUNT) {
    found.push(
      say("programmeId", "episode/live-filings-capped",
        `An account carries at most ${LIVE_FILINGS_PER_ACCOUNT} live filings ` +
          `under one programme and already carries ${fields.liveFilings}.`),
    );
  }

  return found;
}

export type ExhibitFields = {
  bytes: Uint8Array | null;
  viewLabel: string;
  paperKind: string;
  knownDigests: readonly string[];
  digest: string | null;
};

/** What the contract will make of these bytes, before anyone spends on it. */
export function checkExhibit(fields: ExhibitFields): {
  complaints: Complaint[];
  media: Media | null;
  isFrame: boolean;
} {
  const found: Complaint[] = [];
  if (!fields.bytes || fields.bytes.byteLength === 0) {
    return {
      complaints: [
        say("bytes", "episode/exhibit-empty", "An exhibit of no bytes is not an exhibit."),
      ],
      media: null,
      isFrame: false,
    };
  }

  const media = sniffMedia(fields.bytes);
  const isFrame = media === "png" || media === "jpeg";

  if (isFrame && !VIEWS.includes(fields.viewLabel as View)) {
    found.push(
      say("viewLabel", "episode/view-unknown",
        "A scene photograph carries a view of wide, detail or identifier."),
    );
  }
  if (!isFrame && !fields.paperKind.trim()) {
    found.push(
      say("paperKind", "episode/document-kind-blank",
        "Say what this document is, so the panel knows what it is reading."),
    );
  }
  if (fields.digest && fields.knownDigests.includes(fields.digest)) {
    found.push(
      say("bytes", "episode/exhibit-duplicate",
        "These exact bytes are already on this filing."),
    );
  }
  return { complaints: found, media, isFrame };
}

export function isHttpsLink(value: string): boolean {
  const url = value.trim();
  if (!url.startsWith("https://") || url.length > 512) return false;
  return url.slice(8).includes(".");
}
