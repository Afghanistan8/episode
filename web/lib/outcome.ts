// The outcome rule, mirrored from contracts/episode.py.
//
// The contract is the authority. This copy exists so the app can say what a
// set of ratings means without a round trip, and the vitest suite in
// tests/outcome.test.ts checks it against the same table the pytest suite
// drives through the contract. If the two ever disagree, the contract is
// right and this file is the bug.
//
// Rule ids are defined in docs/rules.md: R-OUT-1..4.

export const RATINGS = [
  "SATISFIED",
  "NOT_SATISFIED",
  "NOT_ESTABLISHED",
  "NOT_APPLICABLE",
] as const;

export type Rating = (typeof RATINGS)[number];

export const OUTCOMES = ["ESTABLISHED", "NOT_ESTABLISHED", "UNDETERMINED"] as const;

export type Outcome = (typeof OUTCOMES)[number];

export type OutcomeRule = "R-OUT-1" | "R-OUT-2" | "R-OUT-3" | "R-OUT-4";

export const CRITERION_PREFIX = "criterion:";
export const REQ_SUBJECT = "subject";
export const REQ_CAUSE = "cause";
export const REQ_PAPERS = "papers";

export type Finding = { outcome: Outcome; rule: OutcomeRule };

/**
 * Conflict or evidence too thin beats everything; a failed requirement beats
 * an open one. The order of the clauses is the rule, not an implementation
 * detail: a file that was read and found wanting is a loss, not a doubt.
 */
export function outcomeOf(
  ratings: Readonly<Record<string, Rating>>,
  conflict: boolean,
  sufficient: boolean,
): Finding {
  if (conflict || !sufficient) {
    return { outcome: "UNDETERMINED", rule: "R-OUT-1" };
  }
  const values = Object.values(ratings);
  if (values.includes("NOT_SATISFIED")) {
    return { outcome: "NOT_ESTABLISHED", rule: "R-OUT-2" };
  }
  if (values.includes("NOT_ESTABLISHED")) {
    return { outcome: "UNDETERMINED", rule: "R-OUT-3" };
  }
  return { outcome: "ESTABLISHED", rule: "R-OUT-4" };
}

/** Every requirement a panel rates, in record order. R-PNL-6, R-PNL-7. */
export function requirementScope(
  criteriaCount: number,
  causeInScope: boolean,
  papersInScope: boolean,
): string[] {
  const scope: string[] = [];
  for (let n = 0; n < criteriaCount; n += 1) scope.push(`${CRITERION_PREFIX}${n}`);
  scope.push(REQ_SUBJECT);
  if (causeInScope) scope.push(REQ_CAUSE);
  if (papersInScope) scope.push(REQ_PAPERS);
  return scope;
}

/** What a requirement key is called on the page. */
export function requirementLabel(key: string, criteria: readonly string[]): string {
  if (key.startsWith(CRITERION_PREFIX)) {
    const index = Number(key.slice(CRITERION_PREFIX.length));
    return criteria[index] ?? `criterion ${index}`;
  }
  if (key === REQ_SUBJECT) return "Subject: the evidence shows the thing named";
  if (key === REQ_CAUSE) return "Cause: the damage shown fits the cause declared";
  if (key === REQ_PAPERS) return "Papers: the documents agree with the frames";
  return key;
}

const RULE_PROSE: Record<OutcomeRule, string> = {
  "R-OUT-1": "the evidence conflicted, or was too thin to decide either way",
  "R-OUT-2": "a requirement was read and not satisfied",
  "R-OUT-3": "a requirement was left open",
  "R-OUT-4": "every requirement in scope was satisfied",
};

export function ruleProse(rule: string): string {
  return RULE_PROSE[rule as OutcomeRule] ?? "";
}

const OUTCOME_PROSE: Record<Outcome, string> = {
  ESTABLISHED: "It happened, on this file.",
  NOT_ESTABLISHED: "Not on this file.",
  UNDETERMINED: "The file does not say.",
};

export function outcomeProse(outcome: string): string {
  return OUTCOME_PROSE[outcome as Outcome] ?? "No finding yet.";
}
