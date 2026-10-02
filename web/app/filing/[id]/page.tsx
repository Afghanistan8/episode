"use client";

// One file: what is on it, what is still missing, and every move it can take.
//
// The preflight readout at the top is the contract's own, read as a view, so
// nobody spends a transaction to be told which view is missing.

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { Submit } from "@/components/Submit";
import {
  Complaints,
  Datum,
  Field,
  KindMark,
  Outcome,
  RatingMark,
  Refusal,
  Section,
  StateTrack,
  Waiting,
} from "@/components/ui";
import { call } from "@/lib/episode";
import { gen, moment, shortAddress, shortHash, span, until } from "@/lib/format";
import { useRead } from "@/lib/hooks";
import { digestOf, sniffMedia } from "@/lib/media";
import { requirementLabel } from "@/lib/outcome";
import type {
  ExhibitRow,
  Filing,
  Observation,
  Preflight,
  Programme,
  RoundRecord,
  Version,
} from "@/lib/types";
import { CAUSE_UNSTATED, checkExhibit, isHttpsLink, VIEWS } from "@/lib/validation";

export default function FilingPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [turn, setTurn] = useState(0);
  const refresh = useCallback(() => setTurn((n) => n + 1), []);

  const filing = useRead<Filing>("filing", [id]);
  const key = `${id}:${turn}`;

  if (filing.busy) return <Waiting what="reading the file" />;
  if (!filing.value) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 pt-16 sm:px-6">
        <p className="marginal">filing {params.id}</p>
        <h1 className="display mt-4 text-3xl">That file is not here.</h1>
        <Refusal>{filing.error}</Refusal>
        <Link href="/filing" className="press mt-6 inline-block">
          back to the filings
        </Link>
      </div>
    );
  }

  return <FileView key={key} filing={filing.value} refresh={() => {
    filing.reload();
    refresh();
  }} />;
}

function FileView({ filing, refresh }: { filing: Filing; refresh: () => void }) {
  const id = Number(filing.filing);
  const programme = useRead<Programme>("programme", [Number(filing.programme)]);
  const version = useRead<Version>("programme_version", [
    Number(filing.programme),
    Number(filing.version),
  ]);
  const exhibits = useRead<ExhibitRow[]>("exhibit_index", [id]);
  const observation = useRead<Observation>("observation", [id]);
  const preflight = useRead<Preflight>("panel_preflight", [id]);

  const reloadAll = () => {
    refresh();
    programme.reload();
    exhibits.reload();
    observation.reload();
    preflight.reload();
  };

  const frames = (exhibits.value ?? []).filter((row) => row.kind === "frame");
  const papers = (exhibits.value ?? []).filter((row) => row.kind === "paper");
  const digests = (exhibits.value ?? []).map((row) => row.sha256).filter(Boolean);

  const open = filing.state === "OPEN";
  const determined = filing.state === "DETERMINED";
  const underAppeal = filing.state === "UNDER_APPEAL";
  const terminal = ["FINAL", "WITHDRAWN", "CLOSED"].includes(filing.state);

  const wentAgainst =
    filing.outcome === "ESTABLISHED" ? "the sponsor" : "the claimant";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <section className="pt-14">
        <p className="marginal">
          filing {filing.filing} · programme {filing.programme} · version{" "}
          {filing.version}
          {programme.value && ` · ${programme.value.kind}`}
        </p>
        <h1 className="display mt-4 text-[2rem] sm:text-[2.8rem]">
          {filing.subject}
        </h1>
        <p className="tabular mt-2 text-bone-faint">
          {filing.identifier} · event {filing.event_date} ·{" "}
          {filing.declared_cause === CAUSE_UNSTATED
            ? "cause unstated"
            : filing.declared_cause}
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-x-8 gap-y-4">
          <StateTrack state={filing.state} />
          <Outcome outcome={filing.outcome} rule={filing.rule} size="large" />
        </div>

        {Number(filing.rounds) > 0 && (
          <Link href={`/receipt/${filing.filing}`} className="press mt-6 inline-block">
            the receipt
          </Link>
        )}
      </section>

      <Section label="the clock">
        <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
          <Datum term="lodged">{moment(filing.lodged_at)}</Datum>
          <Datum term="evidence deadline" title={filing.evidence_deadline}>
            {moment(filing.evidence_deadline)}
            <span className="marginal ml-2">
              {open ? until(filing.evidence_deadline, filing.now) : ""}
            </span>
          </Datum>
          {determined || terminal ? (
            <Datum term="appeal deadline" title={filing.appeal_deadline}>
              {moment(filing.appeal_deadline)}
              <span className="marginal ml-2">
                {determined ? until(filing.appeal_deadline, filing.now) : ""}
              </span>
            </Datum>
          ) : null}
          {underAppeal && (
            <Datum term="appeal evidence shuts">
              {moment(filing.appeal_evidence_deadline)}
              <span className="marginal ml-2">
                {until(filing.appeal_evidence_deadline, filing.now)}
              </span>
            </Datum>
          )}
          <Datum term="bond held" title={`${filing.stake_held} wei`}>
            <span className="tabular">{gen(filing.stake_held)} GEN</span>
          </Datum>
          <Datum term="benefit committed" title={`${filing.award_held} wei`}>
            <span className="tabular">{gen(filing.award_held)} GEN</span>
          </Datum>
          <Datum term="claimant" title={filing.claimant}>
            <span className="tabular">{shortAddress(filing.claimant)}</span>
          </Datum>
          {version.value && (
            <Datum term="windows">
              {span(version.value.evidence_window)} then{" "}
              {span(version.value.appeal_window)}
            </Datum>
          )}
        </dl>
      </Section>

      <Section label="what the panel will be asked">
        {preflight.busy && <Waiting what="running the preflight" />}
        {preflight.value && (
          <div
            className={`inset p-4 ${
              preflight.value.ok ? "border-established/40" : "border-ochre/40"
            }`}
          >
            {preflight.value.ok ? (
              <p className="text-sm">
                <span className="ruleid text-established">complete</span>
                <span className="ml-2 text-bone-dim">
                  Everything the bound version asks for is on the file. A panel
                  can sit.
                </span>
              </p>
            ) : (
              <p className="text-sm">
                <span className="ruleid text-ochre">
                  {preflight.value.code}
                </span>
                <span className="ml-2 text-bone-dim">
                  {preflight.value.detail}
                </span>
              </p>
            )}
          </div>
        )}

        {version.value && (
          <ol className="mt-6 space-y-2">
            {version.value.criteria.map((statement, index) => (
              <li key={statement} className="flex gap-4 text-sm text-bone-dim">
                <span className="ruleid pt-0.5">criterion:{index}</span>
                <span>{statement}</span>
              </li>
            ))}
            <li className="flex gap-4 text-sm text-bone-faint">
              <span className="ruleid pt-0.5">subject</span>
              <span>
                Nothing in the evidence shows a different thing from the one
                named. Always in scope.
              </span>
            </li>
            {filing.declared_cause !== CAUSE_UNSTATED && (
              <li className="flex gap-4 text-sm text-bone-faint">
                <span className="ruleid pt-0.5">cause</span>
                <span>
                  What is shown is consistent with {filing.declared_cause}.
                </span>
              </li>
            )}
            {papers.length > 0 && (
              <li className="flex gap-4 text-sm text-bone-faint">
                <span className="ruleid pt-0.5">papers</span>
                <span>The filed documents agree with the photographs.</span>
              </li>
            )}
          </ol>
        )}
      </Section>

      <Section
        label={`the file · ${frames.length} frame${frames.length === 1 ? "" : "s"}, ${papers.length} paper${papers.length === 1 ? "" : "s"}`}
      >
        {exhibits.busy && <Waiting what="reading the exhibits" />}
        {(exhibits.value ?? []).length === 0 && !exhibits.busy && (
          <p className="text-sm text-bone-dim">Nothing is on the file yet.</p>
        )}
        <div className="divide-y divide-rule">
          {(exhibits.value ?? []).map((row) => (
            <div
              key={row.exhibit}
              className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 py-3.5"
            >
              <div className="flex items-baseline gap-4">
                <span className="ruleid w-6">{row.exhibit}</span>
                <div>
                  <p className="flex flex-wrap items-baseline gap-3">
                    <KindMark kind={row.kind} media={row.media} />
                    {row.view_label && (
                      <span className="text-sm text-bone">
                        labelled {row.view_label}
                      </span>
                    )}
                    {row.paper_kind && (
                      <span className="text-sm text-bone">{row.paper_kind}</span>
                    )}
                    {row.new_on_appeal && (
                      <span className="ruleid text-ochre">new on appeal</span>
                    )}
                  </p>
                  {row.caption && (
                    <p className="mt-0.5 text-sm text-bone-faint">{row.caption}</p>
                  )}
                  {row.link && (
                    <p className="mt-0.5 text-sm">
                      <a
                        href={row.link}
                        className="link"
                        rel="noreferrer noopener"
                        target="_blank"
                      >
                        {row.link}
                      </a>
                      {!row.sha256 && (
                        <span className="marginal ml-2">
                          pulled once when the panel sits
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="marginal">{row.party}</p>
                <p className="tabular text-bone-ghost" title={row.sha256}>
                  {row.sha256 ? shortHash(row.sha256, 16) : "—"}
                </p>
              </div>
            </div>
          ))}
        </div>

        <p className="measure mt-6 text-sm text-bone-faint">
          A label is the filer&rsquo;s claim about a frame. The panel reports what
          the frame actually reads as beside it, so a label the picture does not
          bear out counts against whoever wrote it.
        </p>

        {(open || underAppeal) && (
          <Attach
            filing={filing}
            version={version.value}
            digests={digests}
            onDone={reloadAll}
          />
        )}
      </Section>

      {(observation.value?.filed || (programme.value?.assessor && (open || underAppeal))) && (
        <Section label="assessor">
          {observation.value?.filed ? (
            <div className="inset p-4">
              <p className="marginal">
                filed by {shortAddress(observation.value.assessor)} ·{" "}
                {moment(observation.value.filed_at)}
              </p>
              <p className="measure mt-2 text-sm text-bone-dim">
                {observation.value.text}
              </p>
              <p className="marginal mt-3">
                an independent attendance: it can ground a rating, and with it on
                the file the claimant&rsquo;s own frames need it beside them to
                meet a criterion
              </p>
            </div>
          ) : (
            <FileObservation filing={filing} onDone={reloadAll} />
          )}
        </Section>
      )}

      {Number(filing.rounds) > 0 && (
        <Section label={`rounds · ${filing.rounds}`}>
          <div className="space-y-7">
            {Array.from({ length: Number(filing.rounds) }, (_, index) => (
              <Round key={index} filingId={id} ordinal={index} version={version.value} />
            ))}
          </div>
        </Section>
      )}

      <Section label="moves">
        <div className="grid gap-7 lg:grid-cols-2">
          {open && (
            <>
              <Move
                heading="Ask for a panel"
                note="The claimant asks. Preflight runs first, in code; if the file is short, no validator is asked anything."
                title={`Put filing ${filing.filing} to a panel.`}
                label="convene the panel"
                tx={call("convene", [id])}
                blocked={
                  preflight.value?.ok
                    ? undefined
                    : (preflight.value?.detail ?? "The preflight has not come back yet.")
                }
                onDone={reloadAll}
              />
              <Move
                heading="Withdraw"
                note="Before the evidence deadline only. The bond comes back and the benefit is uncommitted."
                title={`Withdraw filing ${filing.filing}. The bond is credited back to the claimant.`}
                label="withdraw the filing"
                tx={call("retract", [id])}
                onDone={reloadAll}
              />
            </>
          )}

          {open && until(filing.evidence_deadline, filing.now) === "shut" && (
            <Move
              heading="Close as lapsed"
              note="After the evidence deadline with no panel, anyone may close it. The benefit returns to the reserve and the bond is forfeited to it."
              title={`Close filing ${filing.filing} as lapsed.`}
              label="close as lapsed"
              tx={call("close_lapsed", [id])}
              onDone={reloadAll}
            />
          )}

          {determined && (
            <>
              <Appeal filing={filing} onDone={reloadAll} />
              <Move
                heading="Seal the finding"
                note={`Unappealed, after the window, by anyone. The finding becomes final and the money settles in one write.`}
                title={`Seal filing ${filing.filing} as ${filing.outcome}.`}
                label="seal it"
                tx={call("seal", [id])}
                blocked={
                  until(filing.appeal_deadline, filing.now) === "shut"
                    ? undefined
                    : `The appeal window runs for another ${until(filing.appeal_deadline, filing.now).replace(" left", "")}; it went against ${wentAgainst}.`
                }
                onDone={reloadAll}
              />
            </>
          )}

          {underAppeal && (
            <>
              <Move
                heading="Rehear it"
                note="Anyone may ask, once the appeal evidence period has shut, and only if the appellant filed something new. The second panel's finding is the one that becomes final."
                title={`Rehear filing ${filing.filing}.`}
                label="ask for a rehearing"
                tx={call("rehear", [id])}
                blocked={
                  preflight.value?.ok
                    ? undefined
                    : (preflight.value?.detail ?? "The preflight has not come back yet.")
                }
                onDone={reloadAll}
              />
              <Move
                heading="Close the appeal"
                note="Not while the appeal evidence period runs — the appellant keeps every hour of it. Once it has shut: at once if the appellant filed nothing new, since there is nothing a second panel could read, otherwise after the rehearing grace. Either way the appealed finding stands."
                title={`Close the appeal on filing ${filing.filing}. ${filing.appealed_outcome} stands.`}
                label="close the appeal"
                tx={call("close_appeal", [id])}
                onDone={reloadAll}
              />
            </>
          )}

          {terminal && <Collect />}
        </div>

        {filing.appeal_ground && (
          <div className="inset mt-7 p-4">
            <p className="marginal">
              appealed by {shortAddress(filing.appellant)} against a finding of{" "}
              {filing.appealed_outcome}
            </p>
            <p className="measure mt-2 text-sm text-bone-dim">
              {filing.appeal_ground}
            </p>
          </div>
        )}
      </Section>
    </div>
  );
}

function Move({
  heading,
  note,
  ...submit
}: {
  heading: string;
  note: string;
} & React.ComponentProps<typeof Submit>) {
  return (
    <div>
      <h3 className="text-bone">{heading}</h3>
      <p className="measure mt-1.5 text-sm text-bone-faint">{note}</p>
      <Submit {...submit} />
    </div>
  );
}

function Attach({
  filing,
  version,
  digests,
  onDone,
}: {
  filing: Filing;
  version: Version | null;
  digests: readonly string[];
  onDone: () => void;
}) {
  const id = Number(filing.filing);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [digest, setDigest] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [viewLabel, setViewLabel] = useState("wide");
  const [paperKind, setPaperKind] = useState(version?.paper_kind ?? "");
  const [caption, setCaption] = useState("");
  const [link, setLink] = useState("");
  const [linkKind, setLinkKind] = useState(version?.paper_kind ?? "");

  async function take(file: File | undefined) {
    if (!file) {
      setBytes(null);
      setDigest(null);
      setName("");
      return;
    }
    const held = new Uint8Array(await file.arrayBuffer());
    setBytes(held);
    setName(file.name);
    setDigest(await digestOf(held));
  }

  const read = useMemo(
    () =>
      checkExhibit({
        bytes,
        viewLabel,
        paperKind,
        knownDigests: digests,
        digest,
      }),
    [bytes, viewLabel, paperKind, digests, digest],
  );

  const ready = bytes !== null && read.complaints.length === 0;

  return (
    <div className="mt-8 grid gap-7 lg:grid-cols-2">
      <div className="inset p-4">
        <p className="marginal">attach bytes</p>
        <p className="measure mt-2 text-sm text-bone-faint">
          A PNG with the full signature, or a JPEG with a JFIF header, is a scene
          photograph. Everything else is paperwork — a sharp photograph of a bill
          of lading included. Episode reads that off the bytes, not off the name.
        </p>

        <div className="mt-4 space-y-4">
          <Field label="file">
            <input
              type="file"
              className="field"
              onChange={(event) => void take(event.target.files?.[0])}
            />
          </Field>

          {bytes && (
            <p className="tabular text-bone-faint">
              {name} · {bytes.byteLength} bytes ·{" "}
              <span className={read.isFrame ? "text-seal" : "text-ochre"}>
                {sniffMedia(bytes)} → {read.isFrame ? "scene frame" : "paperwork"}
              </span>
              {digest && (
                <>
                  {" "}
                  · <span title={digest}>{shortHash(digest, 16)}</span>
                </>
              )}
            </p>
          )}

          {read.isFrame ? (
            <Field
              label="view"
              hint="your claim about this frame; the panel decides whether it holds"
            >
              <select
                className="field"
                value={viewLabel}
                onChange={(event) => setViewLabel(event.target.value)}
              >
                {VIEWS.map((view) => (
                  <option key={view} value={view}>
                    {view}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            bytes && (
              <Field label="what this document is">
                <input
                  className="field"
                  placeholder="bill of lading, inventory sheet, parcel map, adjuster note"
                  value={paperKind}
                  onChange={(event) => setPaperKind(event.target.value)}
                />
              </Field>
            )
          )}

          <Field label="caption, optional">
            <input
              className="field"
              placeholder="the main floor from the doors"
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
            />
          </Field>
        </div>

        <Complaints found={read.complaints} />

        <Submit
          title={`Attach ${read.isFrame ? "a scene photograph" : "a document"} to filing ${filing.filing}.`}
          label="attach it"
          tx={
            ready && bytes
              ? call("attach_exhibit", [
                  id,
                  bytes,
                  read.isFrame ? viewLabel : "",
                  read.isFrame ? "" : paperKind.trim(),
                  caption.trim(),
                ])
              : null
          }
          blocked={ready ? undefined : "Choose a file first."}
          onDone={onDone}
        />
      </div>

      <div className="inset p-4">
        <p className="marginal">attach a document by link</p>
        <p className="measure mt-2 text-sm text-bone-faint">
          The panel opens it once, when it sits, and the file then carries those
          bytes and their sha256. A link is paperwork whatever it points at: it
          can be read, and it can neither prove nor disprove that the event
          happened.
        </p>

        <div className="mt-4 space-y-4">
          <Field label="https url">
            <input
              className="field"
              placeholder="https://registry.example.org/berth/44/log"
              value={link}
              onChange={(event) => setLink(event.target.value)}
              aria-invalid={link && !isHttpsLink(link) ? "true" : undefined}
            />
          </Field>
          <Field label="what this document is">
            <input
              className="field"
              placeholder="berth log"
              value={linkKind}
              onChange={(event) => setLinkKind(event.target.value)}
            />
          </Field>
        </div>

        {link && !isHttpsLink(link) && (
          <p className="mt-3 text-xs text-refused">
            A linked document is an https url with a host, under 512 characters.
          </p>
        )}

        <Submit
          title={`Attach ${link || "a link"} to filing ${filing.filing}.`}
          label="attach the link"
          tx={
            isHttpsLink(link) && linkKind.trim()
              ? call("attach_linked_paper", [
                  id,
                  link.trim(),
                  linkKind.trim(),
                  caption.trim(),
                ])
              : null
          }
          blocked={
            isHttpsLink(link) && linkKind.trim()
              ? undefined
              : "An https url and a document kind."
          }
          onDone={onDone}
        />
      </div>
    </div>
  );
}

function FileObservation({ filing, onDone }: { filing: Filing; onDone: () => void }) {
  const [text, setText] = useState("");
  return (
    <div className="inset p-4">
      <p className="marginal">file an observation</p>
      <p className="measure mt-2 text-sm text-bone-faint">
        The named assessor only, and once. An observation is an independent
        attendance rather than a party&rsquo;s account, which is why it can ground
        a rating on its own.
      </p>
      <div className="mt-4">
        <Field label="what you saw, and when">
          <textarea
            className="field min-h-28"
            placeholder="Attended 14:10. Water from stage to doors, two centimetres, sprung floor lifting at the joints."
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </Field>
      </div>
      <Submit
        title={`File an observation on filing ${filing.filing}.`}
        label="file the observation"
        tx={text.trim() ? call("attach_observation", [Number(filing.filing), text.trim()]) : null}
        blocked={text.trim() ? undefined : "Write the observation first."}
        onDone={onDone}
      />
    </div>
  );
}

function Appeal({ filing, onDone }: { filing: Filing; onDone: () => void }) {
  const [ground, setGround] = useState("");
  const [named, setNamed] = useState("");

  const ids = named
    .split(/[\s,]+/)
    .map((held) => held.trim())
    .filter(Boolean);
  const count = Number(filing.exhibit_count);
  const onThisFile = ids.filter((held) => /^\d+$/.test(held) && Number(held) < count);
  const thin = ids.length > 0 && onThisFile.length < 2;
  const ready = ground.trim().length > 0 && !thin;

  const against = filing.outcome === "ESTABLISHED" ? "the sponsor" : "the claimant";

  return (
    <div>
      <h3 className="text-bone">Appeal the finding</h3>
      <p className="measure mt-1.5 text-sm text-bone-faint">
        Once, inside the window, by the side it went against — here, {against}.
        An appeal has to bring something new, or there is nothing a second panel
        could read.
      </p>
      <div className="mt-4 space-y-4">
        <Field label="ground">
          <textarea
            className="field min-h-20"
            placeholder="That floor is not the hall named in the filing."
            value={ground}
            onChange={(event) => setGround(event.target.value)}
          />
        </Field>
        <Field
          label="conflict, optional"
          hint="two exhibit numbers on this filing that cannot both be true"
        >
          <input
            className="field tabular"
            placeholder="0 2"
            value={named}
            onChange={(event) => setNamed(event.target.value)}
            aria-invalid={thin ? "true" : undefined}
          />
        </Field>
      </div>
      {thin && (
        <p className="mt-2 text-xs text-refused">
          A conflict names two exhibits on this filing. {onThisFile.length} of{" "}
          {ids.length} named are on it.
        </p>
      )}
      <p className="marginal mt-3">
        A photograph that merely contradicts the claimant&rsquo;s account is a
        requirement not satisfied, not a conflict
      </p>
      <Submit
        title={`Appeal the ${filing.outcome} finding on filing ${filing.filing}.`}
        label="appeal it"
        tx={
          ready
            ? call("appeal", [Number(filing.filing), ground.trim(), onThisFile.slice(0, 2)])
            : null
        }
        blocked={ready ? undefined : "Say what is wrong with the finding."}
        onDone={onDone}
      />
    </div>
  );
}

function Collect() {
  const [who, setWho] = useState("");
  const owed = useRead<string>(
    /^0[xX][0-9a-fA-F]{40}$/.test(who) ? "credit_of" : null,
    [who],
  );
  return (
    <div>
      <h3 className="text-bone">Collect what you are owed</h3>
      <p className="measure mt-1.5 text-sm text-bone-faint">
        Nothing is ever pushed. Settlement credits a ledger, and the owner
        collects for themselves.
      </p>
      <div className="mt-4 max-w-sm">
        <Field label="address" hint="to read the ledger before you send">
          <input
            className="field tabular"
            placeholder="0x…"
            value={who}
            onChange={(event) => setWho(event.target.value.trim())}
          />
        </Field>
        {owed.value !== null && (
          <p className="tabular mt-2 text-bone-dim">
            the ledger owes {gen(owed.value)} GEN
          </p>
        )}
      </div>
      <Submit
        title="Collect the caller's ledger balance."
        label="withdraw"
        tx={call("withdraw", [])}
        onDone={() => owed.reload()}
      />
    </div>
  );
}

function Round({
  filingId,
  ordinal,
  version,
}: {
  filingId: number;
  ordinal: number;
  version: Version | null;
}) {
  const round = useRead<RoundRecord>("round_record", [filingId, ordinal]);
  if (round.busy) return <Waiting what={`reading round ${ordinal}`} />;
  if (!round.value) return <Refusal>{round.error}</Refusal>;

  const held = round.value;
  const criteria = version?.criteria ?? [];

  return (
    <article className="sheet p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <p className="marginal">
          round {held.round}
          {held.on_appeal ? " · on appeal" : ""} · {moment(held.convened_at)}
        </p>
        <Outcome outcome={held.outcome} rule={held.rule} />
      </header>

      <dl className="hairline mt-4 grid gap-x-8 gap-y-4 pt-4 sm:grid-cols-3">
        <Datum term="frames the panel saw">
          {held.record.seen.length ? held.record.seen.join(", ") : "none"}
        </Datum>
        <Datum term="ratings bound">
          {held.record.bound.length ? `${held.record.bound.length} of ${held.record.scope.length}` : "none"}
        </Datum>
        <Datum term="evidence enough to decide">
          {held.record.sufficient ? "yes" : "no"}
        </Datum>
      </dl>

      <div className="hairline mt-4 pt-4">
        <p className="marginal">every requirement in scope</p>
        <div className="mt-3 divide-y divide-rule">
          {held.record.scope.map((key) => {
            const rating = held.record.ratings[key] ?? "NOT_ESTABLISHED";
            const grounds = held.record.grounds[key] ?? [];
            return (
              <div key={key} className="flex flex-wrap items-baseline gap-x-5 gap-y-1 py-2.5">
                <span className="ruleid w-24">{key}</span>
                <span className="flex-1 text-sm text-bone-dim">
                  {requirementLabel(key, criteria)}
                </span>
                <span className="flex items-baseline gap-3">
                  <RatingMark rating={rating} />
                  <span className="ruleid">
                    {grounds.length ? `on ${grounds.join(", ")}` : "ungrounded"}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {held.record.conflict && (
        <p className="inset mt-4 px-3 py-2 text-sm text-bone-dim">
          <span className="ruleid text-ochre">conflict</span>
          <span className="ml-2">
            exhibits {held.record.conflict_exhibits.join(" and ")} cannot both be
            true, so the round is undetermined
          </span>
        </p>
      )}

      <div className="hairline mt-4 pt-4">
        <p className="marginal">the snapshot the panel sat on</p>
        <div className="mt-3 space-y-1">
          {held.snapshot.map((row) => (
            <p key={row.exhibit} className="tabular text-bone-ghost">
              <span className="text-bone-faint">{row.exhibit}</span> {row.kind} ·{" "}
              {row.party}
              {row.new_on_appeal ? " · new on appeal" : ""} ·{" "}
              <span title={row.sha256}>{shortHash(row.sha256, 24)}</span>
            </p>
          ))}
        </div>
      </div>
    </article>
  );
}
