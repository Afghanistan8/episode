"use client";

// Programmes: what is on offer, what each reserve can cover, and the sponsor
// calls — fund, pause, publish the next version, draw the idle reserve.

import { useMemo, useState } from "react";
import Link from "next/link";

import { CategoryGlyph } from "@/components/Mark";
import { Submit } from "@/components/Submit";
import { WalletIdentity } from "@/components/WalletConnect";
import { Complaints, Datum, Field, Section, Waiting } from "@/components/ui";
import { call } from "@/lib/episode";
import { gen, moment, shortAddress, span } from "@/lib/format";
import { useList, useRead } from "@/lib/hooks";
import type { Programme, Version } from "@/lib/types";
import {
  CATEGORIES,
  VIEWS,
  checkProgramme,
  type ProgrammeTerms,
} from "@/lib/validation";

const DAY = 24 * 60 * 60;

export default function ProgrammesPage() {
  const { rows, busy, error, reload } = useList<Programme>(
    "programme_count",
    "programme",
  );
  const [opening, setOpening] = useState(false);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <section className="pt-14">
        <p className="marginal">programmes</p>
        <h1 className="display mt-4 text-[2.2rem] sm:text-[3rem]">
          What a sponsor will pay on, and what the file has to show.
        </h1>
        <p className="lede measure mt-6">
          A programme is a category, a kind that stays the same across versions,
          and a version that says what must be true. Versions are immutable: a
          filing binds the one in force when it was lodged and keeps it for life.
        </p>
        <button
          type="button"
          className="press press-filled mt-7"
          onClick={() => setOpening((held) => !held)}
        >
          {opening ? "put that aside" : "open a programme"}
        </button>
      </section>

      {opening && <OpenProgramme onDone={reload} />}

      <Section label={`on offer${rows.length ? ` · ${rows.length}` : ""}`}>
        {busy && <Waiting what="reading the programmes" />}
        {error && <p className="text-sm text-refused">{error}</p>}
        {!busy && !error && rows.length === 0 && (
          <p className="measure text-sm text-bone-dim">
            No programmes yet. Open one above, or run{" "}
            <code className="tabular">npm run seed</code> from the repository
            root to put the three demo programmes on the chain.
          </p>
        )}
        <div className="space-y-10">
          {rows.map((programme) => (
            <ProgrammeCard
              key={programme.programme}
              programme={programme}
              onDone={reload}
            />
          ))}
        </div>
      </Section>
    </div>
  );
}

function ProgrammeCard({
  programme,
  onDone,
}: {
  programme: Programme;
  onDone: () => void;
}) {
  const version = useRead<Version>("programme_version", [
    Number(programme.programme),
    Number(programme.current_version),
  ]);
  const [acting, setActing] = useState<"fund" | "draw" | "version" | null>(null);

  return (
    <article className="sheet p-5 sm:p-7">
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex gap-4">
          <span className="pt-1">
            <CategoryGlyph category={Number(programme.category)} />
          </span>
          <div>
            <h2 className="display text-xl">{programme.kind}</h2>
            <p className="marginal mt-1">
              programme {programme.programme} · {programme.category_name} ·
              version {programme.current_version}
              {programme.paused && (
                <span className="ml-2 text-ochre">paused — no new filings</span>
              )}
            </p>
          </div>
        </div>
        <Link href={`/filing?programme=${programme.programme}`} className="press">
          file under this
        </Link>
      </header>

      {version.value && (
        <p className="measure mt-5 text-sm text-bone-dim">
          {version.value.definition}
        </p>
      )}

      <dl className="hairline mt-5 grid gap-x-8 gap-y-5 pt-5 sm:grid-cols-3 lg:grid-cols-5">
        <Datum term="reserve balance" title={`${programme.balance} wei`}>
          <span className="tabular">{gen(programme.balance)} GEN</span>
        </Datum>
        <Datum term="committed" title={`${programme.committed} wei`}>
          <span className="tabular">{gen(programme.committed)} GEN</span>
        </Datum>
        <Datum term="idle" title={`${programme.idle} wei`}>
          <span className="tabular text-seal">{gen(programme.idle)} GEN</span>
        </Datum>
        <Datum term="paid out" title={`${programme.paid} wei`}>
          <span className="tabular">{gen(programme.paid)} GEN</span>
        </Datum>
        <Datum term="sponsor" title={programme.sponsor}>
          <span className="tabular">{shortAddress(programme.sponsor)}</span>
        </Datum>
      </dl>

      {version.value && (
        <>
          <div className="hairline mt-5 grid gap-x-8 gap-y-5 pt-5 sm:grid-cols-3 lg:grid-cols-5">
            <Datum term="benefit" title={`${version.value.award} wei`}>
              <span className="tabular">{gen(version.value.award)} GEN</span>
            </Datum>
            <Datum term="claimant bond" title={`${version.value.stake} wei`}>
              <span className="tabular">{gen(version.value.stake)} GEN</span>
            </Datum>
            <Datum term="scene photographs">
              <span className="tabular">{version.value.min_frames} minimum</span>
            </Datum>
            <Datum term="required views">
              {version.value.required_views.length
                ? version.value.required_views.join(", ")
                : "none named"}
            </Datum>
            <Datum term="document">
              {version.value.paper_required
                ? version.value.paper_kind || "required"
                : "not required"}
            </Datum>
          </div>

          <div className="hairline mt-5 grid gap-x-8 gap-y-5 pt-5 sm:grid-cols-3 lg:grid-cols-5">
            <Datum term="evidence window">{span(version.value.evidence_window)}</Datum>
            <Datum term="appeal window">{span(version.value.appeal_window)}</Datum>
            <Datum term="assessor" title={programme.assessor}>
              {programme.assessor ? shortAddress(programme.assessor) : "none named"}
            </Datum>
            <Datum term="opened">{moment(programme.opened_at)}</Datum>
            <Datum term="version published">
              {moment(version.value.published_at)}
            </Datum>
          </div>

          <div className="hairline mt-5 pt-5">
            <p className="marginal">criteria the panel rates</p>
            <ol className="mt-3 space-y-2">
              {version.value.criteria.map((statement, index) => (
                <li key={statement} className="flex gap-4 text-sm text-bone-dim">
                  <span className="ruleid pt-0.5">criterion:{index}</span>
                  <span>{statement}</span>
                </li>
              ))}
            </ol>
            {version.value.exclusions && (
              <p className="measure mt-4 text-sm text-bone-faint">
                <span className="marginal">outside the programme</span>{" "}
                {version.value.exclusions}
              </p>
            )}
          </div>
        </>
      )}

      <div className="hairline mt-6 flex flex-wrap gap-3 pt-5">
        <button
          type="button"
          className="press"
          onClick={() => setActing(acting === "fund" ? null : "fund")}
        >
          fund the reserve
        </button>
        <button
          type="button"
          className="press"
          onClick={() => setActing(acting === "draw" ? null : "draw")}
        >
          draw idle reserve
        </button>
        <button
          type="button"
          className="press"
          onClick={() => setActing(acting === "version" ? null : "version")}
        >
          publish a version
        </button>
        <Submit
          inline
          tone="plain"
          title={
            programme.paused
              ? `Take programme ${programme.programme} off pause.`
              : `Pause programme ${programme.programme}. Filings already on foot keep every one of their moves.`
          }
          label={programme.paused ? "resume" : "pause new filings"}
          tx={call("set_paused", [
            Number(programme.programme),
            !programme.paused,
          ])}
          onDone={onDone}
        />
      </div>

      {acting === "fund" && (
        <AmountAction
          key="fund"
          programme={programme}
          heading="Add to the reserve"
          note="The attached value joins the balance. It can be drawn again while it is idle."
          build={(wei) => ({
            tx: call("fund_programme", [Number(programme.programme)]),
            value: wei,
          })}
          onDone={onDone}
        />
      )}

      {acting === "draw" && (
        <AmountAction
          key="draw"
          programme={programme}
          heading="Draw the idle reserve"
          note={`Idle is balance less committed: ${gen(programme.idle)} GEN. Awards committed to live filings are not idle. The draw is credited to the sponsor's ledger and collected with withdraw.`}
          max={programme.idle}
          build={(wei) => ({
            tx: call("draw_idle_reserve", [
              Number(programme.programme),
              wei.toString(),
            ]),
            value: 0n,
          })}
          onDone={onDone}
        />
      )}

      {acting === "version" && version.value && (
        <OpenProgramme
          key="version"
          existing={{ programme, version: version.value }}
          onDone={onDone}
        />
      )}
    </article>
  );
}

function AmountAction({
  heading,
  note,
  max,
  build,
  onDone,
}: {
  programme: Programme;
  heading: string;
  note: string;
  max?: string;
  build: (wei: bigint) => { tx: ReturnType<typeof call>; value: bigint };
  onDone: () => void;
}) {
  const [amount, setAmount] = useState("");
  const parsed = useMemo(() => {
    const text = amount.trim();
    if (!/^\d+$/.test(text)) return null;
    const held = BigInt(text);
    if (held <= 0n) return null;
    if (max && held > BigInt(max)) return null;
    return held;
  }, [amount, max]);

  const built = parsed ? build(parsed) : null;

  return (
    <div className="inset mt-5 p-4">
      <p className="marginal">{heading}</p>
      <p className="measure mt-2 text-sm text-bone-faint">{note}</p>
      <div className="mt-4 max-w-sm">
        <Field label="amount, in wei" hint="1 GEN is 1000000000000000000 wei">
          <input
            className="field tabular"
            inputMode="numeric"
            placeholder="100000000000000000"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            aria-invalid={amount && !parsed ? "true" : undefined}
          />
        </Field>
        {amount && !parsed && (
          <p className="mt-2 text-xs text-refused">
            {max
              ? `A whole number of wei, no more than the ${max} that is idle.`
              : "A whole number of wei, above zero."}
          </p>
        )}
      </div>
      <WalletIdentity />
      <Submit
        title={`${heading}: ${parsed ?? 0} wei.`}
        tx={built?.tx ?? null}
        value={built?.value ?? 0n}
        blocked={parsed ? undefined : "Enter an amount first."}
        onDone={onDone}
      />
    </div>
  );
}

/** The programme form, used both to open one and to publish the next version. */
function OpenProgramme({
  existing,
  onDone,
}: {
  existing?: { programme: Programme; version: Version };
  onDone: () => void;
}) {
  const publishing = existing !== undefined;
  const [terms, setTerms] = useState<ProgrammeTerms>(() => ({
    category: existing ? Number(existing.programme.category) : 1,
    kind: existing ? existing.programme.kind : "",
    definition: existing ? existing.version.definition : "",
    exclusions: existing ? existing.version.exclusions : "",
    criteria: existing ? [...existing.version.criteria] : [""],
    minFrames: existing ? Number(existing.version.min_frames) : 2,
    requiredViews: existing ? [...existing.version.required_views] : ["wide", "detail"],
    paperRequired: existing ? existing.version.paper_required : false,
    paperKind: existing ? existing.version.paper_kind : "",
    award: existing ? existing.version.award : "",
    stake: existing ? existing.version.stake : "",
    evidenceWindow: existing ? Number(existing.version.evidence_window) : 7 * DAY,
    appealWindow: existing ? Number(existing.version.appeal_window) : 3 * DAY,
    assessor: existing ? existing.programme.assessor : "",
  }));
  const [reserve, setReserve] = useState("");

  const found = useMemo(() => checkProgramme(terms), [terms]);
  const complaint = (field: string) => found.find((c) => c.field === field);

  const reserveWei = useMemo(() => {
    const text = reserve.trim();
    if (!/^\d+$/.test(text)) return null;
    return BigInt(text);
  }, [reserve]);

  const written = terms.criteria.filter((c) => c.trim());
  const ready =
    found.length === 0 && (publishing || (reserveWei !== null && reserveWei > 0n));

  const tx = !ready
    ? null
    : publishing
      ? call("publish_version", [
          Number(existing.programme.programme),
          terms.definition.trim(),
          terms.exclusions.trim(),
          written,
          terms.minFrames,
          [...new Set(terms.requiredViews)],
          terms.paperRequired,
          terms.paperKind.trim(),
          terms.award.trim(),
          terms.stake.trim(),
          terms.evidenceWindow,
          terms.appealWindow,
        ])
      : call("open_programme", [
          terms.category,
          terms.kind.trim(),
          terms.definition.trim(),
          terms.exclusions.trim(),
          written,
          terms.minFrames,
          [...new Set(terms.requiredViews)],
          terms.paperRequired,
          terms.paperKind.trim(),
          terms.award.trim(),
          terms.stake.trim(),
          terms.evidenceWindow,
          terms.appealWindow,
          terms.assessor.trim(),
        ]);

  function set<K extends keyof ProgrammeTerms>(key: K, value: ProgrammeTerms[K]) {
    setTerms((held) => ({ ...held, [key]: value }));
  }

  return (
    <div className={publishing ? "inset mt-5 p-4 sm:p-5" : "sheet mt-10 p-5 sm:p-7"}>
      <p className="marginal">
        {publishing
          ? `publish version ${Number(existing.programme.current_version) + 1} of ${existing.programme.kind}`
          : "open a programme"}
      </p>
      <p className="measure mt-2 text-sm text-bone-faint">
        {publishing
          ? "Category and kind carry over and cannot change. Filings already " +
            "lodged keep the version they were lodged under."
          : "The attached value funds the reserve. If the call is refused, " +
            "nothing is written and the value stays with you."}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="space-y-5">
          <Field label="category" complaint={complaint("category")}>
            <div className="space-y-2">
              {CATEGORIES.map((category) => (
                <label
                  key={category.id}
                  className={`flex items-start gap-3 text-sm ${
                    publishing ? "opacity-50" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="category"
                    className="mt-1.5 accent-seal"
                    checked={terms.category === category.id}
                    disabled={publishing}
                    onChange={() => set("category", category.id)}
                  />
                  <span>
                    <span className="text-bone">{category.label}</span>
                    <span className="block text-xs text-bone-ghost">
                      {category.note}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </Field>

          <Field
            label="kind"
            hint="a short lower-case slug, stable across versions"
            complaint={complaint("kind")}
          >
            <input
              className="field"
              placeholder="berth-idling"
              value={terms.kind}
              disabled={publishing}
              onChange={(event) => set("kind", event.target.value)}
              aria-invalid={complaint("kind") ? "true" : undefined}
            />
          </Field>

          <Field
            label="definition"
            hint="what must be true"
            complaint={complaint("definition")}
          >
            <textarea
              className="field min-h-24"
              placeholder="Water reached the floor of the named venue on the event date and left the floor unusable."
              value={terms.definition}
              onChange={(event) => set("definition", event.target.value)}
              aria-invalid={complaint("definition") ? "true" : undefined}
            />
          </Field>

          <Field label="exclusions" hint="what is outside the programme">
            <textarea
              className="field min-h-20"
              placeholder="Condensation, cleaning water, damage predating the booking."
              value={terms.exclusions}
              onChange={(event) => set("exclusions", event.target.value)}
            />
          </Field>

          <Field
            label={`criteria · ${written.length} of 8`}
            hint="one checkable statement per line, each rated on its own"
            complaint={complaint("criteria")}
          >
            <div className="space-y-2">
              {terms.criteria.map((statement, index) => (
                <div key={index} className="flex items-start gap-2">
                  <span className="ruleid w-20 pt-2.5">criterion:{index}</span>
                  <textarea
                    className="field min-h-16"
                    value={statement}
                    onChange={(event) => {
                      const next = [...terms.criteria];
                      next[index] = event.target.value;
                      set("criteria", next);
                    }}
                  />
                </div>
              ))}
              {terms.criteria.length < 8 && (
                <button
                  type="button"
                  className="press"
                  onClick={() => set("criteria", [...terms.criteria, ""])}
                >
                  another criterion
                </button>
              )}
            </div>
          </Field>
        </div>

        <div className="space-y-5">
          <Field
            label="required views"
            hint="a view is the filer's claim about a frame; the panel decides whether it is borne out"
            complaint={complaint("requiredViews")}
          >
            <div className="flex gap-4">
              {VIEWS.map((view) => (
                <label key={view} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="accent-seal"
                    checked={terms.requiredViews.includes(view)}
                    onChange={(event) =>
                      set(
                        "requiredViews",
                        event.target.checked
                          ? [...terms.requiredViews, view]
                          : terms.requiredViews.filter((held) => held !== view),
                      )
                    }
                  />
                  {view}
                </label>
              ))}
            </div>
          </Field>

          <Field
            label="minimum scene photographs"
            complaint={complaint("minFrames")}
          >
            <input
              className="field tabular w-24"
              inputMode="numeric"
              value={terms.minFrames}
              onChange={(event) => set("minFrames", Number(event.target.value) || 0)}
              aria-invalid={complaint("minFrames") ? "true" : undefined}
            />
          </Field>

          <Field label="document">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-seal"
                checked={terms.paperRequired}
                onChange={(event) => set("paperRequired", event.target.checked)}
              />
              a document is required
            </label>
            {terms.paperRequired && (
              <input
                className="field mt-2"
                placeholder="bill of lading, inventory sheet, parcel map, adjuster note"
                value={terms.paperKind}
                onChange={(event) => set("paperKind", event.target.value)}
              />
            )}
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="benefit, in wei" complaint={complaint("award")}>
              <input
                className="field tabular"
                inputMode="numeric"
                placeholder="100000000000000000"
                value={terms.award}
                onChange={(event) => set("award", event.target.value)}
                aria-invalid={complaint("award") ? "true" : undefined}
              />
            </Field>
            <Field label="claimant bond, in wei" complaint={complaint("stake")}>
              <input
                className="field tabular"
                inputMode="numeric"
                placeholder="5000000000000000"
                value={terms.stake}
                onChange={(event) => set("stake", event.target.value)}
                aria-invalid={complaint("stake") ? "true" : undefined}
              />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="evidence window"
              hint="one hour to thirty days"
              complaint={complaint("evidenceWindow")}
            >
              <WindowPicker
                seconds={terms.evidenceWindow}
                onChange={(value) => set("evidenceWindow", value)}
                choices={[DAY, 3 * DAY, 7 * DAY, 14 * DAY, 30 * DAY]}
              />
            </Field>
            <Field
              label="appeal window"
              hint="one hour to fourteen days"
              complaint={complaint("appealWindow")}
            >
              <WindowPicker
                seconds={terms.appealWindow}
                onChange={(value) => set("appealWindow", value)}
                choices={[DAY, 2 * DAY, 3 * DAY, 7 * DAY, 14 * DAY]}
              />
            </Field>
          </div>

          {!publishing && (
            <>
              <Field
                label="assessor, optional"
                hint="an independent observer whose reading can ground a rating. Never the sponsor."
                complaint={complaint("assessor")}
              >
                <input
                  className="field tabular"
                  placeholder="0x…"
                  value={terms.assessor}
                  onChange={(event) => set("assessor", event.target.value)}
                  aria-invalid={complaint("assessor") ? "true" : undefined}
                />
              </Field>

              <Field
                label="reserve to attach, in wei"
                hint="the reserve has to cover an award before a filing can commit one"
              >
                <input
                  className="field tabular"
                  inputMode="numeric"
                  placeholder="500000000000000000"
                  value={reserve}
                  onChange={(event) => setReserve(event.target.value)}
                />
              </Field>
            </>
          )}
        </div>
      </div>

      <Complaints found={found} />
      <WalletIdentity />

      <Submit
        title={
          publishing
            ? `Publish version ${Number(existing.programme.current_version) + 1}.`
            : `Open a ${CATEGORIES.find((c) => c.id === terms.category)?.label ?? ""} programme and fund its reserve with ${reserve || 0} wei.`
        }
        label={publishing ? "publish the version" : "open and fund"}
        tx={tx}
        value={publishing ? 0n : (reserveWei ?? 0n)}
        blocked={
          ready
            ? undefined
            : found.length > 0
              ? "Settle the complaints above first."
              : "Attach a reserve first."
        }
        onDone={onDone}
      />
    </div>
  );
}

function WindowPicker({
  seconds,
  onChange,
  choices,
}: {
  seconds: number;
  onChange: (value: number) => void;
  choices: number[];
}) {
  return (
    <select
      className="field"
      value={seconds}
      onChange={(event) => onChange(Number(event.target.value))}
    >
      {choices.map((choice) => (
        <option key={choice} value={choice}>
          {span(choice)}
        </option>
      ))}
    </select>
  );
}
