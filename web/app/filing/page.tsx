"use client";

// Filings: lodge one under a live version, and the list of what is on foot.

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Submit } from "@/components/Submit";
import { WalletIdentity } from "@/components/WalletConnect";
import { Complaints, Datum, Field, Outcome, Section, Waiting } from "@/components/ui";
import { call } from "@/lib/episode";
import { gen, until } from "@/lib/format";
import { useList, useRead } from "@/lib/hooks";
import { useWallet } from "@/lib/wallet";
import type { Filing, Programme, Version } from "@/lib/types";
import { CAUSE_UNSTATED, checkLodge, type LodgeFields } from "@/lib/validation";

export default function FilingsPage() {
  return (
    <Suspense fallback={<Waiting what="reading the filings" />}>
      <Filings />
    </Suspense>
  );
}

function Filings() {
  const params = useSearchParams();
  const asked = params.get("programme");
  const programmes = useList<Programme>("programme_count", "programme");
  const filings = useList<Filing>("filing_count", "filing");
  const [chosen, setChosen] = useState<string | null>(asked);

  const programme = programmes.rows.find(
    (held) => held.programme === (chosen ?? asked),
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <section className="pt-14">
        <p className="marginal">filings</p>
        <h1 className="display mt-4 text-[2.2rem] sm:text-[3rem]">
          Lodge under a programme, attach the frames, ask for a panel.
        </h1>
        <p className="lede measure mt-6">
          The bond is posted with the filing and the benefit is committed out of
          the reserve there and then, so two filings never share one award. What
          is missing is named before anyone is asked to look.
        </p>
      </section>

      <Section label="lodge a filing">
        {programmes.busy && <Waiting what="reading the programmes" />}
        {programmes.error && (
          <p className="text-sm text-refused">{programmes.error}</p>
        )}
        {!programmes.busy && !programmes.error && programmes.rows.length === 0 && (
          <p className="measure text-sm text-bone-dim">
            There is nothing to file under yet.{" "}
            <Link href="/programmes" className="link">
              Open a programme
            </Link>{" "}
            first.
          </p>
        )}

        {programmes.rows.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {programmes.rows.map((held) => (
              <button
                key={held.programme}
                type="button"
                className={`press ${
                  (chosen ?? asked) === held.programme ? "press-filled" : ""
                }`}
                onClick={() => setChosen(held.programme)}
                disabled={held.paused}
                title={held.paused ? "paused — taking no new filings" : undefined}
              >
                {held.kind}
                {held.paused ? " · paused" : ""}
              </button>
            ))}
          </div>
        )}

        {programme && (
          <Lodge
            programme={programme}
            onDone={() => {
              filings.reload();
              programmes.reload();
            }}
          />
        )}
      </Section>

      <Section label={`on foot${filings.rows.length ? ` · ${filings.rows.length}` : ""}`}>
        {filings.busy && <Waiting what="reading the filings" />}
        {filings.error && <p className="text-sm text-refused">{filings.error}</p>}
        {!filings.busy && !filings.error && filings.rows.length === 0 && (
          <p className="text-sm text-bone-dim">No filings yet.</p>
        )}
        <div className="divide-y divide-rule">
          {[...filings.rows].reverse().map((filing) => (
            <Link
              key={filing.filing}
              href={`/filing/${filing.filing}`}
              className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 py-4 hover:bg-bone/[0.02]"
            >
              <div>
                <p className="marginal">
                  filing {filing.filing} · programme {filing.programme} · version{" "}
                  {filing.version}
                </p>
                <p className="mt-1 text-bone">{filing.subject}</p>
                <p className="tabular mt-0.5 text-bone-faint">
                  {filing.identifier} · {filing.event_date} ·{" "}
                  {filing.declared_cause === CAUSE_UNSTATED
                    ? "cause unstated"
                    : filing.declared_cause}
                </p>
              </div>
              <div className="text-right">
                <p className="marginal">{filing.state.replace(/_/g, " ")}</p>
                <div className="mt-1 flex justify-end">
                  <Outcome outcome={filing.outcome} rule={filing.rule} />
                </div>
                {filing.state === "OPEN" && (
                  <p className="marginal mt-1">
                    evidence {until(filing.evidence_deadline, filing.now)}
                  </p>
                )}
                {filing.state === "DETERMINED" && (
                  <p className="marginal mt-1">
                    appeal {until(filing.appeal_deadline, filing.now)}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Lodge({
  programme,
  onDone,
}: {
  programme: Programme;
  onDone: () => void;
}) {
  const { address } = useWallet();
  const version = useRead<Version>("programme_version", [
    Number(programme.programme),
    Number(programme.current_version),
  ]);
  const live = useRead<string>(
    address ? "live_filings" : null,
    address ? [Number(programme.programme), address] : [],
  );

  const [fields, setFields] = useState({
    subjectLabel: "",
    subjectIdentifier: "",
    eventDate: "",
    declaredCause: "",
  });

  const stake = version.value?.stake ?? "";
  const checked: LodgeFields = useMemo(
    () => ({
      programmeId: Number(programme.programme),
      version: Number(programme.current_version),
      currentVersion: Number(programme.current_version),
      category: Number(programme.category),
      subjectLabel: fields.subjectLabel,
      subjectIdentifier: fields.subjectIdentifier,
      eventDate: fields.eventDate,
      declaredCause: fields.declaredCause,
      stake,
      posting: stake,
      idleReserve: programme.idle,
      award: version.value?.award ?? "0",
      liveFilings: Number(live.value ?? "0"),
    }),
    [programme, fields, stake, version.value, live.value],
  );

  const found = useMemo(
    () => (version.value ? checkLodge(checked) : []),
    [checked, version.value],
  );
  const complaint = (field: string) => found.find((c) => c.field === field);
  const ready = version.value !== null && address !== null &&
    live.value !== null && !live.busy && !live.error && found.length === 0;

  function set(key: keyof typeof fields, value: string) {
    setFields((held) => ({ ...held, [key]: value }));
  }

  if (version.busy) return <Waiting what="reading the version in force" />;
  if (!version.value) {
    return <p className="mt-6 text-sm text-refused">{version.error}</p>;
  }

  return (
    <div className="sheet mt-7 p-5 sm:p-7">
      <p className="marginal">
        {programme.kind} · version {programme.current_version} ·{" "}
        {programme.category_name}
      </p>
      <p className="measure mt-3 text-sm text-bone-dim">
        {version.value.definition}
      </p>

      <dl className="hairline mt-5 grid gap-x-8 gap-y-5 pt-5 sm:grid-cols-4">
        <Datum term="bond to post" title={`${version.value.stake} wei`}>
          <span className="tabular">{gen(version.value.stake)} GEN</span>
        </Datum>
        <Datum term="benefit" title={`${version.value.award} wei`}>
          <span className="tabular">{gen(version.value.award)} GEN</span>
        </Datum>
        <Datum term="reserve idle" title={`${programme.idle} wei`}>
          <span className="tabular">{gen(programme.idle)} GEN</span>
        </Datum>
        <Datum term="the file will need">
          {version.value.min_frames} photograph(s)
          {version.value.required_views.length
            ? `, labelled ${version.value.required_views.join(", ")}`
            : ""}
          {version.value.paper_required
            ? `, and a ${version.value.paper_kind || "document"}`
            : ""}
        </Datum>
      </dl>

      <div className="hairline mt-6 grid gap-5 pt-6 lg:grid-cols-2">
        <Field
          label="subject"
          hint="the property, vehicle, consignment or premises"
          complaint={complaint("subjectLabel")}
        >
          <input
            className="field"
            placeholder="Thornbury Assembly Rooms, main floor"
            value={fields.subjectLabel}
            onChange={(event) => set("subjectLabel", event.target.value)}
            aria-invalid={complaint("subjectLabel") ? "true" : undefined}
          />
        </Field>

        <Field
          label="subject identifier"
          hint="parcel id, VIN, container, berth, policy reference"
          complaint={complaint("subjectIdentifier")}
        >
          <input
            className="field tabular"
            placeholder="POL-44198"
            value={fields.subjectIdentifier}
            onChange={(event) => set("subjectIdentifier", event.target.value)}
            aria-invalid={complaint("subjectIdentifier") ? "true" : undefined}
          />
        </Field>

        <Field label="event date" complaint={complaint("eventDate")}>
          <input
            className="field tabular"
            type="date"
            value={fields.eventDate}
            onChange={(event) => set("eventDate", event.target.value)}
            aria-invalid={complaint("eventDate") ? "true" : undefined}
          />
        </Field>

        <Field
          label="declared cause"
          hint={
            Number(programme.category) === 4
              ? "or the single word unstated, which only a business-interruption programme takes"
              : "water not fire, collision not wear, drought not flood"
          }
          complaint={complaint("declaredCause")}
        >
          <input
            className="field"
            placeholder="storm water through the roof light"
            value={fields.declaredCause}
            onChange={(event) => set("declaredCause", event.target.value)}
            aria-invalid={complaint("declaredCause") ? "true" : undefined}
          />
        </Field>

      </div>

      <WalletIdentity />
      {live.error && <p className="mt-3 text-sm text-refused">{live.error}</p>}
      <Complaints found={found} />

      <Submit
        title={`Lodge under ${programme.kind} version ${programme.current_version}, posting a bond of ${version.value.stake} wei.`}
        label="lodge and post the bond"
        tx={
          ready
            ? call("lodge", [
                Number(programme.programme),
                Number(programme.current_version),
                fields.subjectLabel.trim(),
                fields.subjectIdentifier.trim(),
                fields.eventDate.trim(),
                fields.declaredCause.trim(),
              ])
            : null
        }
        value={BigInt(version.value.stake || "0")}
        blocked={ready ? undefined : !address ? "Connect the signing wallet first."
          : live.error ? "The filing count could not be checked."
          : live.busy || live.value === null ? "Checking this wallet's live filing count."
          : "Settle the complaints above first."}
        onDone={onDone}
      />
    </div>
  );
}
