"use client";

// The receipt. One shape for every category, shareable as a link, and it says
// which version bound the filing — a programme that has moved on since does
// not move the finding.

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { Datum, Outcome, RatingMark, Refusal, Section, Waiting } from "@/components/ui";
import { moment, shortHash } from "@/lib/format";
import { useRead } from "@/lib/hooks";
import { requirementLabel, ruleProse } from "@/lib/outcome";
import type { Receipt, RoundRecord, Version } from "@/lib/types";

export default function ReceiptPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const receipt = useRead<Receipt>("receipt", [id]);

  if (receipt.busy) return <Waiting what="reading the receipt" />;
  if (!receipt.value) {
    const missing = !receipt.error || receipt.error.startsWith("episode/filing-unknown");
    return (
      <div className="mx-auto w-full max-w-3xl px-4 pt-16 sm:px-6">
        <p className="marginal">receipt {params.id}</p>
        <h1 className="display mt-4 text-3xl">
          {missing ? "There is no such receipt." : "The receipt could not be read."}
        </h1>
        <Refusal>{receipt.error}</Refusal>
        <Link href="/" className="press mt-6 inline-block">
          back to the start
        </Link>
      </div>
    );
  }

  return <Sheet receipt={receipt.value} />;
}

/** The last round's ratings, as a table. Taken out of `Sheet` so the record is
 *  a value rather than something read off a possibly-null reading. */
function Ratings({
  record,
  criteria,
}: {
  record: RoundRecord["record"];
  criteria: readonly string[];
}) {
  return (
    <div className="hairline mt-7 pt-7">
      <p className="marginal">how each requirement was rated</p>
      <div className="mt-3 divide-y divide-rule">
        {record.scope.map((key) => (
          <div
            key={key}
            className="flex flex-wrap items-baseline gap-x-5 gap-y-1 py-2.5"
          >
            <span className="ruleid w-24">{key}</span>
            <span className="flex-1 text-sm text-bone-dim">
              {requirementLabel(key, criteria)}
            </span>
            <RatingMark rating={record.ratings[key] ?? "NOT_ESTABLISHED"} />
          </div>
        ))}
      </div>
      <p className="marginal mt-4">
        frames the panel saw:{" "}
        {record.seen.length ? record.seen.join(", ") : "none"}
        {" · "}
        ratings bound: {record.bound.length}
        {record.failed.length ? ` · failed: ${record.failed.join(", ")}` : ""}
      </p>
    </div>
  );
}

function Sheet({ receipt }: { receipt: Receipt }) {
  const version = useRead<Version>("programme_version", [
    Number(receipt.programme),
    Number(receipt.version),
  ]);
  const rounds = Number(receipt.rounds);
  const last = useRead<RoundRecord>(
    rounds > 0 ? "round_record" : null,
    rounds > 0 ? [Number(receipt.filing), rounds - 1] : [],
  );
  const [copied, setCopied] = useState(false);

  async function share() {
    try {
      await navigator.clipboard.writeText(globalThis.location?.href ?? "");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
      <article className="sheet mt-14 p-6 sm:p-10">
        <header>
          <p className="marginal">
            episode receipt · filing {receipt.filing} · {receipt.category}
          </p>
          <h1 className="display mt-4 text-[1.9rem] sm:text-[2.4rem]">
            {receipt.subject}
          </h1>
          <p className="tabular mt-2 text-bone-faint">
            {receipt.identifier} · event {receipt.event_date}
          </p>
        </header>

        <div className="hairline mt-7 pt-7">
          <Outcome outcome={receipt.outcome} rule={receipt.rule} size="large" />
          {receipt.rule && (
            <p className="measure mt-3 text-sm text-bone-dim">
              {receipt.rule}: {ruleProse(receipt.rule)}.
            </p>
          )}
          <p className="marginal mt-4">
            {receipt.final
              ? "final"
              : receipt.terminal
                ? `${receipt.state.toLowerCase()} — no finding was recorded`
                : `${receipt.state.replace(/_/g, " ").toLowerCase()} — not final yet`}
          </p>
        </div>

        <dl className="hairline mt-7 grid gap-x-8 gap-y-5 pt-7 sm:grid-cols-3">
          <Datum term="programme">
            {receipt.kind}
            <span className="ruleid ml-2">#{receipt.programme}</span>
          </Datum>
          <Datum
            term="version that bound it"
            title="A filing binds the version in force when it was lodged and keeps it for life."
          >
            version {receipt.version}
            {version.value && (
              <span className="marginal ml-2">
                {moment(version.value.published_at)}
              </span>
            )}
          </Datum>
          <Datum term="rounds held">{receipt.rounds}</Datum>
        </dl>

        {version.value && (
          <div className="hairline mt-7 pt-7">
            <p className="marginal">what that version required</p>
            <p className="measure mt-2.5 text-sm text-bone-dim">
              {version.value.definition}
            </p>
            <p className="marginal mt-4">
              {version.value.min_frames} scene photograph(s)
              {version.value.required_views.length
                ? ` · ${version.value.required_views.join(", ")}`
                : ""}
              {version.value.paper_required
                ? ` · ${version.value.paper_kind || "a document"}`
                : ""}
            </p>
          </div>
        )}

        {last.value && (
          <Ratings record={last.value.record} criteria={version.value?.criteria ?? []} />
        )}

        <div className="hairline mt-7 pt-7">
          <p className="marginal">the exhibit snapshot</p>
          {receipt.exhibits.length === 0 ? (
            <p className="mt-2 text-sm text-bone-faint">
              No panel has sat on this file, so there is no snapshot to show.
            </p>
          ) : (
            <div className="mt-3 space-y-1.5">
              {receipt.exhibits.map((row) => (
                <p key={row.exhibit} className="tabular break-all text-bone-ghost">
                  <span className="text-bone-faint">{row.exhibit}</span>{" "}
                  <span className={row.kind === "frame" ? "text-seal" : ""}>
                    {row.kind}
                  </span>{" "}
                  · {row.party}
                  {row.new_on_appeal ? " · new on appeal" : ""} ·{" "}
                  <span title={row.sha256}>{shortHash(row.sha256, 32)}</span>
                </p>
              ))}
            </div>
          )}
        </div>

        <footer className="hairline mt-8 flex flex-wrap items-center justify-between gap-4 pt-7">
          <p className="measure text-sm text-bone-faint">{receipt.tagline}</p>
          <div className="flex gap-3">
            <button type="button" className="press" onClick={() => void share()}>
              {copied ? "link copied" : "copy the link"}
            </button>
            <Link href={`/filing/${receipt.filing}`} className="press">
              the file
            </Link>
          </div>
        </footer>
      </article>

      <Section label="what this receipt is">
        <p className="measure text-sm text-bone-dim">
          Every hash above is of the bytes a panel of independent validators sat
          on. A rating stands only on a photograph that node actually saw, or on
          an assessor&rsquo;s own attendance. The outcome is a pure function of
          the ratings, so the same ratings always give this same finding, and the
          rule id says which clause gave it.
        </p>
      </Section>
    </div>
  );
}
