// The small shared pieces. Every page is built out of these, which is what
// keeps a programme, a filing and a receipt looking like parts of one file.

import type { ReactNode } from "react";

import type { Complaint } from "@/lib/validation";
import { outcomeProse, ruleProse } from "@/lib/outcome";

/** A section, introduced by a hairline that runs through its label. */
export function Section({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`mt-12 ${className}`}>
      <div className="hairline-label mb-6">
        <span className="marginal">{label}</span>
      </div>
      {children}
    </section>
  );
}

/** A label-above-value pair. The unit of nearly every readout in the app. */
export function Datum({
  term,
  children,
  title,
}: {
  term: string;
  children: ReactNode;
  title?: string;
}) {
  return (
    <div>
      <dt className="marginal">{term}</dt>
      <dd className="mt-1 text-sm text-bone" title={title}>
        {children}
      </dd>
    </div>
  );
}

const OUTCOME_TONE: Record<string, string> = {
  ESTABLISHED: "text-established border-established/40 bg-established/10",
  NOT_ESTABLISHED: "text-refused border-refused/40 bg-refused/10",
  UNDETERMINED: "text-doubt border-rule-bright bg-bone/5",
};

/** The outcome, its rule id, and the one sentence the rule means. */
export function Outcome({
  outcome,
  rule,
  size = "normal",
}: {
  outcome: string;
  rule?: string;
  size?: "normal" | "large";
}) {
  if (!outcome) {
    return <span className="marginal">no finding yet</span>;
  }
  const tone = OUTCOME_TONE[outcome] ?? OUTCOME_TONE.UNDETERMINED;
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
      <span
        className={`inline-block border px-2.5 py-1 font-mono tracking-[0.12em] uppercase ${tone} ${
          size === "large" ? "text-sm" : "text-[0.6875rem]"
        }`}
      >
        {outcome.replace(/_/g, " ")}
      </span>
      {rule && (
        <span className="ruleid" title={ruleProse(rule)}>
          {rule}
        </span>
      )}
      {size === "large" && (
        <span className="text-sm text-bone-dim">{outcomeProse(outcome)}</span>
      )}
    </div>
  );
}

const RATING_TONE: Record<string, string> = {
  SATISFIED: "text-established",
  NOT_SATISFIED: "text-refused",
  NOT_ESTABLISHED: "text-doubt",
  NOT_APPLICABLE: "text-bone-ghost",
};

export function RatingMark({ rating }: { rating: string }) {
  return (
    <span
      className={`font-mono text-[0.6875rem] tracking-[0.1em] uppercase ${
        RATING_TONE[rating] ?? "text-bone-ghost"
      }`}
    >
      {rating.replace(/_/g, " ")}
    </span>
  );
}

const STATES = [
  "OPEN",
  "DETERMINED",
  "UNDER_APPEAL",
  "FINAL",
] as const;

/** Where the filing has got to. Terminal ends that are not FINAL say so. */
export function StateTrack({ state }: { state: string }) {
  if (state === "WITHDRAWN" || state === "CLOSED") {
    return (
      <div className="flex items-center gap-3">
        <span className="font-mono text-[0.6875rem] tracking-[0.12em] uppercase text-doubt">
          {state}
        </span>
        <span className="text-sm text-bone-faint">
          {state === "WITHDRAWN"
            ? "withdrawn by the claimant before the evidence deadline"
            : "closed after the evidence deadline with no panel"}
        </span>
      </div>
    );
  }
  const at = STATES.indexOf(state as (typeof STATES)[number]);
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {STATES.map((step, index) => {
        const reached = at >= index;
        const here = at === index;
        return (
          <li key={step} className="flex items-center gap-2">
            <span
              className={`font-mono text-[0.6875rem] tracking-[0.12em] uppercase ${
                here
                  ? "text-seal"
                  : reached
                    ? "text-bone-dim"
                    : "text-bone-ghost/60"
              }`}
            >
              {step.replace(/_/g, " ")}
            </span>
            {index < STATES.length - 1 && (
              <span
                aria-hidden="true"
                className={`h-px w-6 ${at > index ? "bg-rule-bright" : "bg-rule"}`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** A complaint, worded as the contract words it, beside the field it is about. */
export function Complaints({ found }: { found: readonly Complaint[] }) {
  if (found.length === 0) return null;
  return (
    <ul className="mt-3 space-y-2">
      {found.map((complaint) => (
        <li key={`${complaint.field}:${complaint.code}`} className="text-sm">
          <span className="ruleid text-refused">{complaint.code}</span>
          <span className="ml-2 text-bone-dim">{complaint.detail}</span>
        </li>
      ))}
    </ul>
  );
}

export function Refusal({ children }: { children: ReactNode }) {
  return (
    <p className="inset mt-4 px-3 py-2 text-sm text-bone-dim">
      <span className="ruleid text-refused">refused</span>
      <span className="ml-2">{children}</span>
    </p>
  );
}

export function Waiting({ what = "reading the file" }: { what?: string }) {
  return <p className="marginal py-6">{what}…</p>;
}

/** A labelled control with its own complaint slot. */
export function Field({
  label,
  hint,
  complaint,
  children,
}: {
  label: string;
  hint?: string;
  complaint?: Complaint | undefined;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="marginal">{label}</span>
      {hint && <span className="mt-1 block text-xs text-bone-ghost">{hint}</span>}
      <span className="mt-1.5 block">{children}</span>
      {complaint && (
        <span className="mt-1.5 block text-xs text-refused">{complaint.detail}</span>
      )}
    </label>
  );
}

/** A frame or a document, told apart at a glance. */
export function KindMark({ kind, media }: { kind: string; media?: string }) {
  const frame = kind === "frame";
  return (
    <span
      className={`font-mono text-[0.625rem] tracking-[0.1em] uppercase ${
        frame ? "text-seal" : "text-bone-ghost"
      }`}
      title={
        frame
          ? "a scene photograph: it can ground a rating"
          : "paperwork: it can be read, and it cannot ground a rating of the scene"
      }
    >
      {frame ? "frame" : "paper"}
      {media && media !== "other" && <span className="opacity-60"> · {media}</span>}
    </span>
  );
}
