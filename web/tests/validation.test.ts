// Form validation, held to the contract's preflight.

import { describe, expect, it } from "vitest";

import { sniffMedia, isSceneFrame } from "../lib/media";
import {
  checkExhibit,
  checkLodge,
  checkProgramme,
  isCalendarDay,
  isHttpsLink,
  isSlug,
  type LodgeFields,
  type ProgrammeTerms,
} from "../lib/validation";

const SPONSOR = `0x${"a1".repeat(20)}`;
const ASSESSOR = `0x${"c4".repeat(20)}`;

function terms(over: Partial<ProgrammeTerms> = {}): ProgrammeTerms {
  return {
    category: 1,
    kind: "gala-venue-water",
    definition: "Water reached the floor and left it unusable.",
    exclusions: "Condensation.",
    criteria: ["Standing water is visible.", "The floor cannot be staged on."],
    minFrames: 2,
    requiredViews: ["wide", "detail"],
    paperRequired: false,
    paperKind: "",
    award: "40000000000000000000",
    stake: "2000000000000000000",
    evidenceWindow: 7 * 24 * 60 * 60,
    appealWindow: 3 * 24 * 60 * 60,
    assessor: "",
    sponsor: SPONSOR,
    ...over,
  };
}

function codes(found: { code: string }[]): string[] {
  return found.map((c) => c.code);
}

describe("programme terms", () => {
  it("accepts a well-formed programme", () => {
    expect(checkProgramme(terms())).toEqual([]);
  });

  it("offers four categories and no more", () => {
    expect(codes(checkProgramme(terms({ category: 9 })))).toContain(
      "episode/category-unknown",
    );
    for (const category of [1, 2, 3, 4]) {
      expect(checkProgramme(terms({ category }))).toEqual([]);
    }
  });

  it("wants a slug for a kind", () => {
    expect(isSlug("berth-idling")).toBe(true);
    expect(isSlug("storm-parcel-2")).toBe(true);
    expect(isSlug("Gala Venue")).toBe(false);
    expect(isSlug("-leading")).toBe(false);
    expect(isSlug("trailing-")).toBe(false);
    expect(isSlug("")).toBe(false);
    expect(codes(checkProgramme(terms({ kind: "Gala Venue" })))).toContain(
      "episode/kind-blank",
    );
  });

  it("counts criteria, ignoring blank rows", () => {
    expect(codes(checkProgramme(terms({ criteria: ["", "  "] })))).toContain(
      "episode/criteria-count",
    );
    expect(
      codes(checkProgramme(terms({ criteria: Array(9).fill("a statement") }))),
    ).toContain("episode/criteria-count");
    expect(
      checkProgramme(terms({ criteria: ["one real statement", "   "] })),
    ).toEqual([]);
  });

  it("asks for enough frames to cover the required views", () => {
    const found = checkProgramme(
      terms({ minFrames: 2, requiredViews: ["wide", "detail", "identifier"] }),
    );
    expect(codes(found)).toContain("episode/scene-frames-short");
    expect(found[0]?.detail).toContain("at least 3");
  });

  it("names the field a complaint belongs beside", () => {
    const found = checkProgramme(terms({ minFrames: 0, requiredViews: ["wide"] }));
    expect(found[0]?.field).toBe("minFrames");
  });

  it("refuses a view outside the three", () => {
    expect(
      codes(checkProgramme(terms({ requiredViews: ["wide", "aerial"] }))),
    ).toContain("episode/view-unknown");
  });

  it("refuses an award or bond of nothing", () => {
    expect(codes(checkProgramme(terms({ award: "0" })))).toContain(
      "episode/award-zero",
    );
    expect(codes(checkProgramme(terms({ stake: "" })))).toContain(
      "episode/stake-zero",
    );
    expect(codes(checkProgramme(terms({ award: "not a number" })))).toContain(
      "episode/award-zero",
    );
  });

  it("bounds both windows at both ends", () => {
    expect(codes(checkProgramme(terms({ evidenceWindow: 60 })))).toContain(
      "episode/window-bounds",
    );
    expect(
      codes(checkProgramme(terms({ evidenceWindow: 60 * 24 * 60 * 60 }))),
    ).toContain("episode/window-bounds");
    expect(
      codes(checkProgramme(terms({ appealWindow: 30 * 24 * 60 * 60 }))),
    ).toContain("episode/window-bounds");
  });

  it("will not let the sponsor be its own assessor", () => {
    expect(codes(checkProgramme(terms({ assessor: SPONSOR })))).toContain(
      "episode/assessor-is-sponsor",
    );
    expect(
      codes(checkProgramme(terms({ assessor: SPONSOR.toUpperCase() }))),
    ).toContain("episode/assessor-is-sponsor");
    expect(checkProgramme(terms({ assessor: ASSESSOR }))).toEqual([]);
  });

  it("wants an address or nothing for the assessor", () => {
    expect(codes(checkProgramme(terms({ assessor: "J. Mellor" })))).toContain(
      "episode/assessor-malformed",
    );
  });
});

function lodge(over: Partial<LodgeFields> = {}): LodgeFields {
  return {
    programmeId: 0,
    version: 1,
    currentVersion: 1,
    category: 1,
    subjectLabel: "Thornbury Assembly Rooms, main floor",
    subjectIdentifier: "POL-44198",
    eventDate: "2026-05-02",
    declaredCause: "storm water through the roof light",
    stake: "2000000000000000000",
    posting: "2000000000000000000",
    idleReserve: "200000000000000000000",
    award: "40000000000000000000",
    liveFilings: 0,
    ...over,
  };
}

describe("lodging a filing", () => {
  it("accepts a well-formed filing", () => {
    expect(checkLodge(lodge())).toEqual([]);
  });

  it("names the version in force when a stale one is offered", () => {
    const found = checkLodge(lodge({ version: 1, currentVersion: 3 }));
    expect(codes(found)).toContain("episode/version-stale");
    expect(found[0]?.detail).toContain("Version 3 is in force");
  });

  it("wants a subject and an identifier", () => {
    expect(codes(checkLodge(lodge({ subjectLabel: "  " })))).toContain(
      "episode/subject-blank",
    );
    expect(codes(checkLodge(lodge({ subjectIdentifier: "" })))).toContain(
      "episode/subject-blank",
    );
  });

  it("wants a real calendar day", () => {
    expect(isCalendarDay("2026-05-02")).toBe(true);
    expect(isCalendarDay("2026-02-29")).toBe(false);
    expect(isCalendarDay("2024-02-29")).toBe(true);
    expect(isCalendarDay("2026-13-01")).toBe(false);
    expect(isCalendarDay("2026-5-2")).toBe(false);
    expect(isCalendarDay("last Tuesday")).toBe(false);
    expect(codes(checkLodge(lodge({ eventDate: "2026-02-30" })))).toContain(
      "episode/event-date-malformed",
    );
  });

  it("lets only an interruption leave the cause unstated", () => {
    expect(codes(checkLodge(lodge({ declaredCause: "unstated" })))).toContain(
      "episode/cause-must-be-stated",
    );
    expect(
      checkLodge(lodge({ declaredCause: "unstated", category: 4 })),
    ).toEqual([]);
    expect(codes(checkLodge(lodge({ declaredCause: "" })))).toContain(
      "episode/cause-blank",
    );
  });

  it("wants the bond posted exactly", () => {
    expect(codes(checkLodge(lodge({ posting: "1999999999999999999" })))).toContain(
      "episode/stake-mismatch",
    );
  });

  it("says when the reserve cannot cover the award", () => {
    const found = checkLodge(lodge({ idleReserve: "1" }));
    expect(codes(found)).toContain("episode/reserve-short");
    expect(found[0]?.detail).toContain("cannot cover this award");
  });

  it("holds the three-filing cap", () => {
    expect(codes(checkLodge(lodge({ liveFilings: 3 })))).toContain(
      "episode/live-filings-capped",
    );
    expect(checkLodge(lodge({ liveFilings: 2 }))).toEqual([]);
  });
});

const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3,
]);
const JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1,
]);
const EXIF = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe1, 0x00, 0x10, 0x45, 0x78, 0x69, 0x66, 0, 0,
]);
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);

describe("reading an exhibit off its bytes", () => {
  it("knows a PNG and a JFIF JPEG", () => {
    expect(sniffMedia(PNG)).toBe("png");
    expect(sniffMedia(JPEG)).toBe("jpeg");
    expect(isSceneFrame(PNG)).toBe(true);
    expect(isSceneFrame(JPEG)).toBe(true);
  });

  it("files an Exif JPEG and a PDF as paperwork", () => {
    expect(sniffMedia(EXIF)).toBe("other");
    expect(sniffMedia(PDF)).toBe("other");
    expect(isSceneFrame(EXIF)).toBe(false);
  });

  it("refuses a truncated PNG signature", () => {
    expect(sniffMedia(PNG.slice(0, 7))).toBe("other");
  });

  it("wants a view on a frame and a kind on a document", () => {
    const frame = checkExhibit({
      bytes: PNG,
      viewLabel: "",
      paperKind: "",
      knownDigests: [],
      digest: null,
    });
    expect(frame.isFrame).toBe(true);
    expect(codes(frame.complaints)).toContain("episode/view-unknown");

    const paper = checkExhibit({
      bytes: PDF,
      viewLabel: "wide",
      paperKind: "",
      knownDigests: [],
      digest: null,
    });
    expect(paper.isFrame).toBe(false);
    expect(codes(paper.complaints)).toContain("episode/document-kind-blank");
  });

  it("catches a duplicate before it is sent", () => {
    const found = checkExhibit({
      bytes: PNG,
      viewLabel: "wide",
      paperKind: "",
      knownDigests: ["abc123"],
      digest: "abc123",
    });
    expect(codes(found.complaints)).toContain("episode/exhibit-duplicate");
  });

  it("refuses an exhibit of no bytes", () => {
    const found = checkExhibit({
      bytes: new Uint8Array(0),
      viewLabel: "wide",
      paperKind: "",
      knownDigests: [],
      digest: null,
    });
    expect(codes(found.complaints)).toEqual(["episode/exhibit-empty"]);
  });
});

describe("a linked document", () => {
  it("is an https url with a host", () => {
    expect(isHttpsLink("https://registry.example.org/berth/44")).toBe(true);
    expect(isHttpsLink("http://registry.example.org/x")).toBe(false);
    expect(isHttpsLink("https://nodot")).toBe(false);
    expect(isHttpsLink(`https://a.example/${"x".repeat(600)}`)).toBe(false);
  });
});
