// The outcome mapping, held to the same table the pytest suite drives through
// the contract. If this file and tests/test_outcome.py ever disagree, the
// contract is right.

import { describe, expect, it } from "vitest";

import {
  outcomeOf,
  requirementLabel,
  requirementScope,
  ruleProse,
  outcomeProse,
  type Rating,
} from "../lib/outcome";

const POOL: Rating[] = ["SATISFIED", "NOT_SATISFIED", "NOT_ESTABLISHED"];

describe("the fixed outcome rule", () => {
  it("establishes when every requirement in scope is satisfied", () => {
    expect(
      outcomeOf({ "criterion:0": "SATISFIED", subject: "SATISFIED" }, false, true),
    ).toEqual({ outcome: "ESTABLISHED", rule: "R-OUT-4" });
  });

  it("does not establish when a requirement was read and not satisfied", () => {
    expect(
      outcomeOf(
        { "criterion:0": "NOT_SATISFIED", subject: "SATISFIED" },
        false,
        true,
      ),
    ).toEqual({ outcome: "NOT_ESTABLISHED", rule: "R-OUT-2" });
  });

  it("leaves an open requirement undetermined", () => {
    expect(
      outcomeOf(
        { "criterion:0": "SATISFIED", subject: "NOT_ESTABLISHED" },
        false,
        true,
      ),
    ).toEqual({ outcome: "UNDETERMINED", rule: "R-OUT-3" });
  });

  it("puts a conflict ahead of everything else", () => {
    expect(
      outcomeOf({ "criterion:0": "SATISFIED", subject: "SATISFIED" }, true, true),
    ).toEqual({ outcome: "UNDETERMINED", rule: "R-OUT-1" });
  });

  it("puts evidence too thin to decide ahead of everything else", () => {
    expect(
      outcomeOf({ "criterion:0": "SATISFIED", subject: "SATISFIED" }, false, false),
    ).toEqual({ outcome: "UNDETERMINED", rule: "R-OUT-1" });
  });

  it("puts a failed requirement ahead of an open one", () => {
    expect(
      outcomeOf(
        { "criterion:0": "NOT_SATISFIED", "criterion:1": "NOT_ESTABLISHED" },
        false,
        true,
      ),
    ).toEqual({ outcome: "NOT_ESTABLISHED", rule: "R-OUT-2" });
  });

  it("ignores a requirement that is out of scope", () => {
    expect(
      outcomeOf(
        { "criterion:0": "SATISFIED", subject: "SATISFIED", cause: "NOT_APPLICABLE" },
        false,
        true,
      ),
    ).toEqual({ outcome: "ESTABLISHED", rule: "R-OUT-4" });
  });

  it("is a function of its inputs across the whole table", () => {
    for (const conflict of [false, true]) {
      for (const sufficient of [false, true]) {
        for (const a of POOL) {
          for (const b of POOL) {
            for (const c of POOL) {
              const ratings = { "criterion:0": a, "criterion:1": b, subject: c };
              const once = outcomeOf(ratings, conflict, sufficient);
              expect(outcomeOf({ ...ratings }, conflict, sufficient)).toEqual(once);

              if (conflict || !sufficient) {
                expect(once).toEqual({ outcome: "UNDETERMINED", rule: "R-OUT-1" });
              } else if ([a, b, c].includes("NOT_SATISFIED")) {
                expect(once).toEqual({ outcome: "NOT_ESTABLISHED", rule: "R-OUT-2" });
              } else if ([a, b, c].includes("NOT_ESTABLISHED")) {
                expect(once).toEqual({ outcome: "UNDETERMINED", rule: "R-OUT-3" });
              } else {
                expect(once).toEqual({ outcome: "ESTABLISHED", rule: "R-OUT-4" });
              }
            }
          }
        }
      }
    }
  });
});

describe("requirement scope", () => {
  it("puts subject in every round", () => {
    expect(requirementScope(2, false, false)).toEqual([
      "criterion:0",
      "criterion:1",
      "subject",
    ]);
  });

  it("adds cause and papers when the file calls for them", () => {
    expect(requirementScope(1, true, true)).toEqual([
      "criterion:0",
      "subject",
      "cause",
      "papers",
    ]);
  });

  it("keeps record order past nine criteria", () => {
    const scope = requirementScope(11, false, false);
    expect(scope[9]).toBe("criterion:9");
    expect(scope[10]).toBe("criterion:10");
    expect(scope.at(-1)).toBe("subject");
  });
});

describe("how a record reads on the page", () => {
  it("names a criterion by its own words", () => {
    expect(requirementLabel("criterion:1", ["first", "second"])).toBe("second");
  });

  it("names a criterion that is out of range without throwing", () => {
    expect(requirementLabel("criterion:7", ["first"])).toBe("criterion 7");
  });

  it("has prose for every rule and outcome", () => {
    for (const rule of ["R-OUT-1", "R-OUT-2", "R-OUT-3", "R-OUT-4"]) {
      expect(ruleProse(rule)).not.toBe("");
    }
    for (const outcome of ["ESTABLISHED", "NOT_ESTABLISHED", "UNDETERMINED"]) {
      expect(outcomeProse(outcome)).not.toBe("");
    }
    expect(ruleProse("R-OUT-9")).toBe("");
    expect(outcomeProse("")).toBe("No finding yet.");
  });
});
